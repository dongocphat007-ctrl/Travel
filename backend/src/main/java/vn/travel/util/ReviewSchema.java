package vn.travel.util;

import java.util.*;
import java.util.regex.Pattern;

/** Bản Java của frontend/shared/review-schema.js (validate + thống kê). */
public final class ReviewSchema {
    private ReviewSchema() { }

    public static final int CONTENT_MIN = 5, CONTENT_MAX = 1000, IMAGE_MAX = 500;
    public static final Map<String, String> CRITERIA = new LinkedHashMap<>();
    static {
        CRITERIA.put("guide", "Hướng dẫn viên");
        CRITERIA.put("transport", "Di chuyển");
        CRITERIA.put("food", "Ăn uống");
        CRITERIA.put("hotel", "Lưu trú");
        CRITERIA.put("value", "Đáng tiền");
    }

    private static final Pattern HTTP = Pattern.compile("^https?://[^\\s<>\"'`]+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMG = Pattern.compile("^img/[A-Za-z0-9_\\-./]+$");
    private static final Pattern DIGITS = Pattern.compile("^\\s*\\d+\\s*$");
    private static final Pattern CTRL = Pattern.compile("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]");

    /** Số nguyên 1–5 THẬT; không hợp lệ → -1. Chấp nhận 4 hoặc "4"; từ chối 4.5, true, null, "". */
    public static int toRating(Object v) {
        if (v == null || v instanceof Boolean) return -1;
        double n;
        if (v instanceof String s) {
            if (!DIGITS.matcher(s).matches()) return -1;
            n = Double.parseDouble(s.trim());
        } else if (v instanceof Number num) {
            n = num.doubleValue();
        } else return -1;
        return n == Math.rint(n) && n >= 1 && n <= 5 ? (int) n : -1;
    }

    public static boolean safeImage(Object s) {
        if (!(s instanceof String str) || str.isEmpty() || str.length() > IMAGE_MAX) return false;
        if (HTTP.matcher(str).matches()) return true;
        return IMG.matcher(str).matches() && !str.contains("..");
    }

    /** Kết quả kiểm tra: value != null nếu hợp lệ, ngược lại msg + field. */
    public record Check(Map<String, Object> value, String msg, String field) {
        public boolean ok() { return value != null; }
    }

    private static Check fail(String field, String msg) { return new Check(null, msg, field); }

    @SuppressWarnings("unchecked")
    public static Check validateInput(Map<String, Object> b) {
        if (b == null) b = Map.of();
        int rating = toRating(b.get("rating"));
        if (rating < 0) return fail("rating", "Điểm đánh giá phải là số nguyên từ 1 đến 5 sao");
        if (!(b.get("content") instanceof String raw)) return fail("content", "Vui lòng nhập nội dung đánh giá");
        String content = CTRL.matcher(raw).replaceAll("").trim();
        if (content.isEmpty()) return fail("content", "Nội dung đánh giá không được để trống");
        int len = content.codePointCount(0, content.length());
        if (len < CONTENT_MIN) return fail("content", "Nội dung ít nhất " + CONTENT_MIN + " ký tự");
        if (len > CONTENT_MAX) return fail("content", "Nội dung tối đa " + CONTENT_MAX + " ký tự (hiện " + len + ")");
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("rating", rating);
        value.put("content", content);

        Object crit = b.get("criteria");
        if (crit != null) {
            if (!(crit instanceof Map<?, ?> cm)) return fail("criteria", "Điểm thành phần không hợp lệ");
            Map<String, Object> c = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : cm.entrySet()) {
                String k = String.valueOf(e.getKey());
                if (!CRITERIA.containsKey(k)) return fail("criteria", "Tiêu chí không hợp lệ: " + k);
                int s = toRating(e.getValue());
                if (s < 0) return fail("criteria", "Điểm \"" + CRITERIA.get(k) + "\" phải từ 1 đến 5");
                c.put(k, s);
            }
            if (!c.isEmpty()) value.put("criteria", c);
        }
        Object img = b.get("image");
        if (img != null && !"".equals(img)) {
            if (!safeImage(img)) return fail("image", "Ảnh phải là liên kết https hoặc đường dẫn img/… hợp lệ (tối đa " + IMAGE_MAX + " ký tự)");
            value.put("image", img);
        }
        return new Check(value, null, null);
    }

    /** Dạng công khai của 1 review đã lưu: bỏ userId, bổ sung date. */
    public static Map<String, Object> toPublic(Map<String, Object> r) {
        String created = String.valueOf(r.getOrDefault("createdAt", ""));
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("id", r.get("id"));
        o.put("tourId", String.valueOf(r.get("tourId")));
        o.put("name", r.get("name") == null || "".equals(r.get("name")) ? "Khách" : r.get("name"));
        o.put("rating", r.get("rating"));
        o.put("content", r.get("content"));
        Object date = r.get("date");
        o.put("date", date != null && !"".equals(date) ? date : created.substring(0, Math.min(10, created.length())));
        o.put("createdAt", r.get("createdAt"));
        if (r.get("criteria") != null) o.put("criteria", r.get("criteria"));
        if (safeImage(r.get("image"))) o.put("image", r.get("image"));
        boolean sample = Boolean.TRUE.equals(r.get("sample"));
        if (sample) o.put("sample", true);
        o.put("source", sample ? "demo" : ("admin".equals(r.get("source")) ? "admin" : "verified"));
        return o;
    }

    private static List<Integer> ratingsOf(List<Map<String, Object>> list) {
        List<Integer> out = new ArrayList<>();
        if (list != null) for (Map<String, Object> r : list) {
            int n = toRating(r == null ? null : r.get("rating"));
            if (n > 0) out.add(n);
        }
        return out;
    }

    /** Điểm TB làm tròn 1 chữ số (nửa lên) bằng số nguyên; rỗng → 0. */
    public static double average(List<Map<String, Object>> list) {
        List<Integer> r = ratingsOf(list);
        if (r.isEmpty()) return 0;
        long sum = 0;
        for (int n : r) sum += n;
        return Math.floor(sum * 10.0 / r.size() + 0.5) / 10.0;
    }

    /** { counts:{5..1}, percent:{5..1}, total } — percent nguyên, tổng = 100 (phần dư lớn nhất). */
    public static Map<String, Object> distribution(List<Map<String, Object>> list) {
        List<Integer> r = ratingsOf(list);
        Map<String, Integer> counts = new LinkedHashMap<>(), percent = new LinkedHashMap<>();
        for (int k = 5; k >= 1; k--) { counts.put(String.valueOf(k), 0); percent.put(String.valueOf(k), 0); }
        for (int n : r) counts.merge(String.valueOf(n), 1, Integer::sum);
        int total = r.size();
        if (total > 0) {
            int used = 0;
            List<double[]> rem = new ArrayList<>();
            for (int k = 5; k >= 1; k--) {
                double exact = counts.get(String.valueOf(k)) * 100.0 / total;
                int fl = (int) Math.floor(exact);
                percent.put(String.valueOf(k), fl);
                used += fl;
                rem.add(new double[]{k, exact - fl});
            }
            rem.sort((a, b) -> b[1] != a[1] ? Double.compare(b[1], a[1]) : Double.compare(b[0], a[0]));
            for (int i = 0; i < 100 - used; i++) percent.merge(String.valueOf((int) rem.get(i)[0]), 1, Integer::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("counts", counts);
        out.put("percent", percent);
        out.put("total", total);
        return out;
    }

    /** Điểm TB từng tiêu chí; chỉ có khoá của tiêu chí đã có người chấm. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> criteriaAverages(List<Map<String, Object>> list) {
        Map<String, List<Map<String, Object>>> acc = new LinkedHashMap<>();
        if (list != null) for (Map<String, Object> r : list) {
            if (r == null || !(r.get("criteria") instanceof Map<?, ?> c)) continue;
            for (String k : CRITERIA.keySet()) {
                if (!c.containsKey(k)) continue;
                int n = toRating(c.get(k));
                if (n < 0) continue;
                acc.computeIfAbsent(k, x -> new ArrayList<>()).add(Map.of("rating", n));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        acc.forEach((k, v) -> out.put(k, Map.of("avg", average(v), "n", v.size())));
        return out;
    }
}
