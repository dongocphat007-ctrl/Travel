package vn.travel.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;

/**
 * Cắt dữ liệu Travel (tour, món ăn, di sản UNESCO) thành các đoạn (chunk) ngắn, tự chứa đủ ngữ cảnh để tìm bằng embedding.
 * Mỗi chunk bắt đầu bằng tên tour/món để câu trả lời luôn biết nó thuộc về đâu. Chunk dài hơn MAX_CHARS được tách theo câu.
 * Hàm thuần (không I/O) nên kiểm thử được.
 */
public final class RagChunker {
    public static final int MAX_CHARS = 900;

    /** id ổn định (type:refId:phần) để so khớp vector cũ; hash đổi khi nội dung đổi → chỉ nhúng lại chunk đã đổi. */
    public record Chunk(String id, String type, String refId, String title, String text) {
        public String hash() { return sha(text); }
    }

    private RagChunker() { }

    public static List<Chunk> tours(List<Map<String, Object>> tours) {
        List<Chunk> out = new ArrayList<>();
        for (Map<String, Object> t : tours) {
            String id = Maps.str(t, "id"), name = Maps.str(t, "name");
            if (id.isEmpty() || name.isEmpty()) continue;
            StringBuilder o = new StringBuilder("Tour ").append(name).append(". ");
            put(o, "Điểm đến", first(Maps.str(t, "dest"), Maps.str(t, "destination")));
            put(o, "Vùng", Maps.str(t, "region"));
            put(o, "Thời gian", Maps.str(t, "duration"));
            put(o, "Giá", money(t.get("price")) + "/người");
            put(o, "Nhóm", Maps.str(t, "groupSize"));
            put(o, "Độ khó", Maps.str(t, "difficulty"));
            put(o, "Hình thức", "self".equals(Maps.str(t, "guide")) ? "tự túc" : "có hướng dẫn viên");
            put(o, "Chủ đề", String.join(", ", strings(t.get("tags"))));
            put(o, "Điểm nhấn", Maps.str(t, "highlight"));
            put(o, "Mô tả", Maps.str(t, "desc"));
            add(out, "tour", id, name, "o", o.toString());

            int n = 0;
            for (Object d : Maps.list(t.get("itinerary"))) {
                Map<String, Object> day = Maps.map(d);
                if (day == null) continue;
                n++;
                StringBuilder s = new StringBuilder("Tour ").append(name).append(" – Ngày ").append(first(String.valueOf(day.getOrDefault("day", n)), String.valueOf(n)))
                        .append(": ").append(Maps.str(day, "title")).append(". ");
                for (Object it : Maps.list(day.get("items"))) {
                    Map<String, Object> m = Maps.map(it);
                    if (m != null) s.append(Maps.str(m, "time")).append(": ").append(Maps.str(m, "desc")).append(". ");
                }
                add(out, "tour", id, name, "d" + n, s.toString());
            }
            StringBuilder p = new StringBuilder("Tour ").append(name).append(" – Dịch vụ & chính sách. ");
            put(p, "Bao gồm", String.join("; ", strings(t.get("includes"))));
            put(p, "Không bao gồm", String.join("; ", strings(t.get("excludes"))));
            put(p, "Điểm đón", Maps.str(t, "pickup"));
            put(p, "Hủy tour", Maps.str(t, "cancelNote"));
            if (p.length() > ("Tour " + name + " – Dịch vụ & chính sách. ").length()) add(out, "tour", id, name, "p", p.toString());
        }
        return out;
    }

    /** foods.json: {north:{label, foods:[{name, region, desc, tags}]}, center:…, south:…} */
    public static List<Chunk> foods(Map<String, Object> root) {
        List<Chunk> out = new ArrayList<>();
        for (Map.Entry<String, Object> e : root.entrySet()) {
            Map<String, Object> region = Maps.map(e.getValue());
            if (region == null) continue;
            String label = Maps.str(region, "label");
            for (Object o : Maps.list(region.get("foods"))) {
                Map<String, Object> f = Maps.map(o);
                if (f == null || Maps.str(f, "name").isEmpty()) continue;
                StringBuilder s = new StringBuilder("Món ").append(Maps.str(f, "name")).append(". ");
                put(s, "Vùng", label);
                put(s, "Nơi nổi tiếng", Maps.str(f, "region"));
                put(s, "Đặc điểm", String.join(", ", strings(f.get("tags"))));
                put(s, "Mô tả", Maps.str(f, "desc"));
                add(out, "food", e.getKey() + ":" + slug(Maps.str(f, "name")), Maps.str(f, "name"), "o", s.toString());
            }
        }
        return out;
    }

    /** unesco.json: {sites:[{name, year, loc}]} */
    public static List<Chunk> unesco(Map<String, Object> root) {
        List<Chunk> out = new ArrayList<>();
        for (Object o : Maps.list(root.get("sites"))) {
            Map<String, Object> s = Maps.map(o);
            if (s == null || Maps.str(s, "name").isEmpty()) continue;
            add(out, "unesco", slug(Maps.str(s, "name")), Maps.str(s, "name"), "o",
                    "Di sản UNESCO " + Maps.str(s, "name") + ", tại " + Maps.str(s, "loc") + ", được công nhận năm " + s.getOrDefault("year", "") + ".");
        }
        return out;
    }

    // ───────── tiện ích ─────────
    private static void add(List<Chunk> out, String type, String refId, String title, String part, String text) {
        List<String> pieces = split(text.trim(), MAX_CHARS);
        for (int i = 0; i < pieces.size(); i++)
            out.add(new Chunk(type + ":" + refId + ":" + part + (i == 0 ? "" : "." + i), type, refId, title, pieces.get(i)));
    }

    /** Tách theo ranh giới câu ". " (không cắt giữa từ); mảnh nào vẫn quá dài thì cắt cứng. */
    public static List<String> split(String text, int max) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String sentence : text.split("(?<=\\.)\\s+")) {
            if (cur.length() > 0 && cur.length() + sentence.length() + 1 > max) { out.add(cur.toString().trim()); cur.setLength(0); }
            while (sentence.length() > max) { out.add(sentence.substring(0, max)); sentence = sentence.substring(max); }
            cur.append(sentence).append(' ');
        }
        if (cur.toString().isBlank() && out.isEmpty()) return List.of(text);
        if (!cur.toString().isBlank()) out.add(cur.toString().trim());
        return out;
    }

    private static void put(StringBuilder sb, String label, String v) {
        if (v != null && !v.isBlank() && !v.equals("0₫/người")) sb.append(label).append(": ").append(v.trim()).append(". ");
    }

    private static String first(String a, String b) { return a == null || a.isBlank() ? b : a; }

    private static List<String> strings(Object o) {
        List<String> r = new ArrayList<>();
        for (Object x : Maps.list(o)) if (x != null && !String.valueOf(x).isBlank()) r.add(String.valueOf(x));
        return r;
    }

    private static String money(Object v) {
        long n = (long) Pricing.num(v);
        return String.format("%,d", n).replace(',', '.') + "₫";
    }

    public static String slug(String s) {
        return Normalizer.normalize(s.toLowerCase().replace('đ', 'd'), Normalizer.Form.NFD).replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }

    static String sha(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
