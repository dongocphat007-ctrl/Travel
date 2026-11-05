package vn.travel.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Maps;
import vn.travel.util.RagChunker;
import vn.travel.util.RagChunker.Chunk;
import vn.travel.web.HttpError;

import java.text.Normalizer;
import java.util.*;
import java.util.logging.Logger;

/**
 * RAG Ở SERVER (cách B): chunker → embedding (Gemini, khóa ở server) → vectors.json → tìm theo cosine.
 *   • Nguồn: tour hiển thị cho khách (TourCatalog, đã gồm tour Admin), data/foods.json, data/unesco.json.
 *   • Vector lưu ở storage/db/vectors.json (RIÊNG TƯ, ngoài thư mục public): 1 dòng meta {model,dims} + mỗi chunk {id,hash,v(base64 float32)}.
 *     Chỉ nhúng lại chunk mới/đổi nội dung (so hash); chunk không còn tồn tại bị xóa.
 *   • Chưa có khóa AI / chưa lập chỉ mục / embedding lỗi → tự rơi về BM25 trên cùng các chunk, câu trả lời có mode = "bm25".
 */
@Service
public class Rag {
    private static final Logger LOG = Logger.getLogger("travel.rag");
    static final String COLLECTION = "vectors";
    private static final Set<String> STOP = new HashSet<>(Arrays.asList(("la va cua o co khong nao gi cho toi minh muon di the nay ban hay nhung mot cac "
            + "nhu de voi tai trong khi duoc bao nhieu nhe a oi ve nen thi se dang can biet goi y giup nhat rat qua cung ra vao len xuong tu den hon het moi").split(" ")));

    private final TourCatalog tours;
    private final PublicData data;
    private final Db db;
    private final Embedder embedder;

    private Index index;                          // chunk + BM25, dựng lại khi invalidate()
    private long indexAt;
    private Map<String, Vec> vectors;             // id → vector đã lưu (null = chưa nạp từ đĩa)
    private volatile String lastError = "";
    private volatile boolean indexing;

    @Autowired
    public Rag(TourCatalog tours, PublicData data, Db db, Embedder embedder) {
        this.tours = tours;
        this.data = data;
        this.db = db;
        this.embedder = embedder;
    }

    record Vec(String hash, float[] v) { }

    private static final class Index {
        final List<Chunk> chunks;
        final List<Map<String, Integer>> tf = new ArrayList<>();
        final List<Integer> len = new ArrayList<>();
        final Map<String, Integer> df = new HashMap<>();
        double avg;

        Index(List<Chunk> chunks) {
            this.chunks = chunks;
            long total = 0;
            for (Chunk c : chunks) {
                Map<String, Integer> m = new HashMap<>();
                List<String> toks = tokenize(c.title() + " " + c.text());
                for (String t : toks) m.merge(t, 1, Integer::sum);
                tf.add(m);
                len.add(toks.size());
                total += toks.size();
                for (String t : m.keySet()) df.merge(t, 1, Integer::sum);
            }
            avg = chunks.isEmpty() ? 1 : Math.max(1.0, (double) total / chunks.size());
        }
    }

    // ───────── chunk ─────────
    private synchronized Index index() {
        long now = System.currentTimeMillis();
        if (index == null || now - indexAt > 60_000) {
            List<Chunk> all = new ArrayList<>(RagChunker.tours(tours.all()));
            all.addAll(RagChunker.foods(data.obj("foods.json")));
            all.addAll(RagChunker.unesco(data.obj("unesco.json")));
            index = new Index(all);
            indexAt = now;
        }
        return index;
    }

    public synchronized void invalidate() { index = null; }

    public List<Chunk> chunks() { return index().chunks; }

    // ───────── vector lưu trữ ─────────
    private synchronized Map<String, Vec> stored() {
        if (vectors != null) return vectors;
        Map<String, Vec> m = new HashMap<>();
        List<Map<String, Object>> rows = db.list(COLLECTION);
        boolean compatible = false;
        for (Map<String, Object> r : rows) {
            if (Maps.bool(r, "_meta")) { compatible = embedder.model().equals(Maps.str(r, "model")) && embedder.dims() == Maps.lng(r, "dims"); continue; }
            if (!compatible) continue;
            try {
                float[] v = decode(Maps.str(r, "v"));
                if (v.length == embedder.dims()) m.put(Maps.str(r, "id"), new Vec(Maps.str(r, "hash"), v));
            } catch (IllegalArgumentException ignored) { /* dòng hỏng → nhúng lại lần sau */ }
        }
        vectors = m;
        return m;
    }

    private synchronized void persist(Map<String, Vec> m) {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(Maps.of("_meta", true, "model", embedder.model(), "dims", embedder.dims(), "updatedAt", java.time.Instant.now().toString()));
        m.forEach((id, v) -> rows.add(Maps.of("id", id, "hash", v.hash(), "v", encode(v.v()))));
        db.update(COLLECTION, old -> rows);
        vectors = m;
    }

    /**
     * Lập chỉ mục: chỉ nhúng chunk chưa có hoặc đổi nội dung. Nhúng lỗi giữa chừng → vẫn lưu phần đã xong rồi ném lỗi
     * (lần chạy sau làm tiếp phần còn lại). Trả số liệu để Admin xem.
     */
    public Map<String, Object> reindex() {
        if (!embedder.enabled()) throw new HttpError(503, "Chưa cấu hình GEMINI_API_KEY nên chưa thể tạo embedding");
        synchronized (this) {
            if (indexing) throw new HttpError(409, "Đang lập chỉ mục, vui lòng đợi");
            indexing = true;
        }
        try {
            invalidate();
            List<Chunk> chunks = chunks();
            Map<String, Vec> old = stored();
            Map<String, Vec> next = new LinkedHashMap<>();
            List<Chunk> todo = new ArrayList<>();
            for (Chunk c : chunks) {
                Vec v = old.get(c.id());
                if (v != null && v.hash().equals(c.hash())) next.put(c.id(), v); else todo.add(c);
            }
            int reused = next.size();
            try {
                for (int i = 0; i < todo.size(); i += 64) {
                    List<Chunk> part = todo.subList(i, Math.min(todo.size(), i + 64));
                    List<float[]> vs = embedder.embed(part.stream().map(Chunk::text).toList(), false);
                    for (int k = 0; k < part.size(); k++) next.put(part.get(k).id(), new Vec(part.get(k).hash(), vs.get(k)));
                }
                lastError = "";
            } catch (RuntimeException e) {
                lastError = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                persist(next);
                throw e;
            }
            persist(next);
            return Maps.of("ok", true, "chunks", chunks.size(), "embedded", todo.size(), "reused", reused, "removed", Math.max(0, old.size() - reused));
        } finally {
            indexing = false;
        }
    }

    /** Khi khởi động: đủ khóa mà chỉ mục thiếu → nền sẽ làm nốt (không chặn việc chạy server). */
    public void ensureIndexInBackground() {
        if (!embedder.enabled() || indexing) return;
        Map<String, Vec> have = stored();
        if (chunks().stream().allMatch(c -> have.containsKey(c.id()) && have.get(c.id()).hash().equals(c.hash()))) return;
        Thread t = new Thread(() -> {
            try { LOG.info("RAG: lap chi muc " + reindex()); } catch (RuntimeException e) { LOG.warning("RAG: lap chi muc do dang - " + e.getMessage()); }
        }, "rag-index");
        t.setDaemon(true);
        t.start();
    }

    public Map<String, Object> status() {
        Index ix = index();
        Map<String, Vec> have = stored();
        long covered = ix.chunks.stream().filter(c -> have.containsKey(c.id()) && have.get(c.id()).hash().equals(c.hash())).count();
        return Maps.of("ok", true, "mode", embedder.enabled() && covered > 0 ? "vector" : "bm25", "embeddingEnabled", embedder.enabled(),
                "model", embedder.model(), "dims", embedder.dims(), "chunks", ix.chunks.size(), "indexed", covered, "indexing", indexing, "lastError", lastError);
    }

    // ───────── tìm kiếm ─────────
    /**
     * type: null | "tour" | "food" | "unesco". Mỗi tour/món chỉ xuất hiện 1 lần (chunk điểm cao nhất).
     * Trả {mode, hits:[{id,type,refId,title,text,score}]}.
     */
    public Map<String, Object> search(String query, int k, String type) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) throw HttpError.bad("Thiếu câu hỏi", "query");
        if (q.length() > 500) throw HttpError.bad("Câu hỏi quá dài", "query");
        k = Math.max(1, Math.min(20, k));
        if (type != null && !type.isEmpty() && !Set.of("tour", "food", "unesco").contains(type)) throw HttpError.bad("Loại dữ liệu không hợp lệ", "type");
        Index ix = index();
        double[] score = null;
        String mode = "bm25";
        Map<String, Vec> have = stored();
        if (embedder.enabled() && !have.isEmpty()) {
            try {
                float[] qv = embedder.embed(List.of(q), true).get(0);
                score = new double[ix.chunks.size()];
                int found = 0;
                for (int i = 0; i < score.length; i++) {
                    Vec v = have.get(ix.chunks.get(i).id());
                    if (v == null) { score[i] = Double.NEGATIVE_INFINITY; continue; }
                    score[i] = dot(qv, v.v());
                    found++;
                }
                if (found > 0) mode = "vector"; else score = null;
            } catch (RuntimeException e) {
                LOG.warning("RAG: embedding cau hoi loi, dung BM25 - " + e.getMessage());
                score = null;
            }
        }
        if (score == null) score = bm25(ix, q);
        Integer[] order = new Integer[score.length];
        for (int i = 0; i < order.length; i++) order[i] = i;
        final double[] sc = score;
        Arrays.sort(order, (a, b) -> Double.compare(sc[b], sc[a]));
        List<Map<String, Object>> hits = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i : order) {
            if (sc[i] == Double.NEGATIVE_INFINITY || (mode.equals("bm25") && sc[i] <= 0)) break;
            Chunk c = ix.chunks.get(i);
            if (type != null && !type.isEmpty() && !c.type().equals(type)) continue;
            if (!seen.add(c.type() + ":" + c.refId())) continue;
            hits.add(Maps.of("id", c.id(), "type", c.type(), "refId", c.refId(), "title", c.title(), "text", c.text(), "score", Math.round(sc[i] * 10000) / 10000.0));
            if (hits.size() >= k) break;
        }
        return Maps.of("ok", true, "mode", mode, "hits", hits);
    }

    private static double[] bm25(Index ix, String q) {
        double[] s = new double[ix.chunks.size()];
        int n = ix.chunks.size();
        for (String t : new LinkedHashSet<>(tokenize(q))) {
            Integer df = ix.df.get(t);
            if (df == null) continue;
            double idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
            for (int i = 0; i < n; i++) {
                Integer f = ix.tf.get(i).get(t);
                if (f == null) continue;
                s[i] += idf * f * 2.5 / (f + 1.5 * (0.25 + 0.75 * ix.len.get(i) / ix.avg));
            }
        }
        return s;
    }

    // ───────── tiện ích ─────────
    static List<String> tokenize(String text) {
        String n = Normalizer.normalize(String.valueOf(text).toLowerCase().replace('đ', 'd'), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        n = n.replaceAll("\\bnhat ban\\b", "nhatban").replaceAll("\\bson la\\b", "sonla");   // địa danh chứa từ dừng
        List<String> out = new ArrayList<>();
        for (String w : n.split("[^a-z0-9]+")) if (w.length() > 1 && !STOP.contains(w)) out.add(w);
        return out;
    }

    public static float[] normalize(float[] v) {
        double s = 0;
        for (float x : v) s += (double) x * x;
        double d = Math.sqrt(s);
        if (d == 0) return v;
        float[] o = new float[v.length];
        for (int i = 0; i < v.length; i++) o[i] = (float) (v[i] / d);
        return o;
    }

    static double dot(float[] a, float[] b) {
        double s = 0;
        for (int i = 0; i < a.length && i < b.length; i++) s += (double) a[i] * b[i];
        return s;
    }

    static String encode(float[] v) {
        java.nio.ByteBuffer bb = java.nio.ByteBuffer.allocate(v.length * 4);
        for (float x : v) bb.putFloat(x);
        return Base64.getEncoder().encodeToString(bb.array());
    }

    static float[] decode(String s) {
        java.nio.ByteBuffer bb = java.nio.ByteBuffer.wrap(Base64.getDecoder().decode(s));
        float[] v = new float[bb.remaining() / 4];
        for (int i = 0; i < v.length; i++) v[i] = bb.getFloat();
        return v;
    }
}
