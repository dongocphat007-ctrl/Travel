package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.RagChunker;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** RAG server (cách B): chunker → embedding → vectors.json → tìm; rơi về BM25 khi không có khóa/lỗi. */
class RagTest {
    /** Embedding giả (túi từ băm 256 chiều) để không cần mạng. */
    static class Fake implements Embedder {
        boolean on = true, failQuery = false;
        int calls = 0;
        @Override public boolean enabled() { return on; }
        @Override public String model() { return "fake"; }
        @Override public int dims() { return 256; }
        @Override public List<float[]> embed(List<String> texts, boolean query) {
            calls += texts.size();
            if (query && failQuery) throw new RuntimeException("down");
            List<float[]> out = new ArrayList<>();
            for (String t : texts) {
                float[] v = new float[256];
                for (String w : t.toLowerCase().split("[^\\p{L}\\p{N}]+")) if (w.length() > 1) v[Math.floorMod(w.hashCode(), 256)] += 1;
                out.add(Rag.normalize(v));
            }
            return out;
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> hits(Map<String, Object> r) { return (List<Map<String, Object>>) r.get("hits"); }

    @Test void chunkerSplitsTourIntoOverviewDaysAndPolicyWithBoundedSize() {
        Map<String, Object> t = Maps.of("id", "x1", "name", "Đà Lạt 3N2Đ", "price", 2500000, "dest", "Đà Lạt", "duration", "3 ngày 2 đêm", "guide", "guided",
                "itinerary", List.of(Maps.of("day", 1, "title", "Đến Đà Lạt", "items", List.of(Maps.of("time", "Sáng", "desc", "Đón khách"))),
                        Maps.of("day", 2, "title", "Langbiang", "items", List.of())),
                "includes", List.of("Xe", "Khách sạn"), "cancelNote", "Hủy trước 7 ngày");
        List<RagChunker.Chunk> cs = RagChunker.tours(List.of(t));
        assertEquals(4, cs.size());                                   // tổng quan + 2 ngày + chính sách
        assertTrue(cs.get(0).text().contains("2.500.000₫"));
        assertTrue(cs.stream().allMatch(c -> c.text().startsWith("Tour Đà Lạt 3N2Đ") && c.text().length() <= RagChunker.MAX_CHARS));
        assertEquals(cs.size(), cs.stream().map(RagChunker.Chunk::id).distinct().count(), "id phải duy nhất");
        Map<String, Object> changed = new LinkedHashMap<>(t); changed.put("price", 3000000);
        assertNotEquals(cs.get(0).hash(), RagChunker.tours(List.of(changed)).get(0).hash(), "đổi nội dung → hash đổi → nhúng lại");
        assertEquals(cs.get(1).hash(), RagChunker.tours(List.of(changed)).get(1).hash(), "chunk không đổi giữ nguyên hash");
    }

    @Test void longTextIsSplitOnSentenceBoundaries() {
        String text = ("Câu thứ nhất khá dài để chiếm chỗ. ").repeat(80);
        List<String> parts = RagChunker.split(text.trim(), 300);
        assertTrue(parts.size() > 5);
        assertTrue(parts.stream().allMatch(p -> p.length() <= 300));
    }

    @Test void bm25FallbackWhenNoKeyThenVectorAfterReindexAndReuse(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Fake emb = new Fake();
        emb.on = false;
        Rag rag = new Rag(f.tours, f.data, f.dbs, emb);
        Map<String, Object> r = rag.search("tour Hạ Long", 5, "tour");
        assertEquals("bm25", r.get("mode"));
        assertEquals("101", hits(r).get(0).get("refId"));
        assertEquals(503, assertThrows(HttpError.class, rag::reindex).status());

        emb.on = true;
        Map<String, Object> st = rag.reindex();
        assertEquals(rag.chunks().size(), ((Number) st.get("embedded")).intValue());
        assertTrue(Files.exists(f.db.resolve("vectors.json")));
        int calls = emb.calls;
        assertEquals(0, ((Number) rag.reindex().get("embedded")).intValue());     // lần 2: không nhúng lại gì
        assertEquals(calls, emb.calls);

        Rag restarted = new Rag(f.tours, f.data, f.dbs, emb);                      // khởi động lại: đọc từ vectors.json
        assertEquals("vector", restarted.status().get("mode"));
        assertEquals("vector", restarted.search("Hạ Long", 3, null).get("mode"));
        emb.failQuery = true;                                                      // embedding câu hỏi lỗi → vẫn trả kết quả (BM25)
        assertEquals("bm25", restarted.search("Hạ Long", 3, null).get("mode"));
    }

    @Test void onlyChangedChunksAreReembeddedAndModelChangeDropsOldVectors(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Fake emb = new Fake();
        Rag rag = new Rag(f.tours, f.data, f.dbs, emb);
        rag.reindex();
        f.dbs.update("admin-tours", old -> List.of(Maps.of("id", "tour_9", "name", "Tour Cô Tô Mới", "price", 1500000, "destination", "Cô Tô", "region", "Miền Bắc",
                "active", true, "type", "guided", "highlight", "Biển đảo hoang sơ")));
        Map<String, Object> st = rag.reindex();
        assertTrue(((Number) st.get("embedded")).intValue() >= 1 && ((Number) st.get("embedded")).intValue() < 5);
        assertEquals("tour_9", hits(rag.search("Tour Cô Tô Mới Biển đảo hoang sơ", 3, "tour")).get(0).get("refId"));

        Fake other = new Fake() { @Override public String model() { return "model-khac"; } };
        assertEquals("bm25", new Rag(f.tours, f.data, f.dbs, other).status().get("mode"));
    }

    @Test void searchValidatesInputAndDedupesPerTour(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Rag rag = new Rag(f.tours, f.data, f.dbs, new Fake());
        assertEquals(400, assertThrows(HttpError.class, () -> rag.search("  ", 5, null)).status());
        assertEquals(400, assertThrows(HttpError.class, () -> rag.search("x".repeat(501), 5, null)).status());
        assertEquals(400, assertThrows(HttpError.class, () -> rag.search("tour", 5, "khac")).status());
        List<Map<String, Object>> h = hits(rag.search("Hạ Long Ninh Bình", 20, "tour"));
        assertEquals(h.size(), h.stream().map(x -> x.get("refId")).distinct().count());
    }
}
