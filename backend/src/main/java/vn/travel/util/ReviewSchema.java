package vn.travel.util;

import java.util.*;
import java.util.regex.Pattern;

/** Bản Java của frontend/shared/review-schema.js (validate + thống kê). */
public final class ReviewSchema {
    private ReviewSchema() { }

    public static final int CONTENT_MIN = 5, COMMENT_MIN = 3, CONTENT_MAX = 1000, IMAGE_MAX = 500, MAX_IMAGES = 5;
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

    /** Danh sách ảnh công khai đính kèm review/comment; giới hạn số lượng và từng URL. */
    public static List<String> validateImages(Object raw) {
        if (raw == null) return List.of();
        if (!(raw instanceof List<?> list)) throw new IllegalArgumentException("Danh sách ảnh không hợp lệ");
        if (list.size() > MAX_IMAGES) throw new IllegalArgumentException("Mỗi bài viết được đính kèm tối đa " + MAX_IMAGES + " ảnh");
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (!safeImage(item)) throw new IllegalArgumentException("Ảnh phải là liên kết HTTPS hoặc ảnh Travel đã tải lên");
            String path = String.valueOf(item);
            if (!out.contains(path)) out.add(path);
        }
        return out;
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
        Object gr = b.get("guideRating");   // 7.3: đánh giá riêng cho HDV (tùy chọn)
        if (gr != null && !"".equals(gr)) {
            int g = toRating(gr);
            if (g < 0) return fail("guideRating", "Điểm hướng dẫn viên phải là số nguyên từ 1 đến 5 sao");
            value.put("guideRating", g);
        }
        if (b.get("guideComment") instanceof String gcRaw) {
            String gc = CTRL.matcher(gcRaw).replaceAll("").trim();
            if (gc.codePointCount(0, gc.length()) > 300) return fail("guideComment", "Nhận xét về hướng dẫn viên tối đa 300 ký tự");
            if (!gc.isEmpty()) value.put("guideComment", gc);
        }
        Object img = b.get("image");
        if (img != null && !"".equals(img)) {
            if (!safeImage(img)) return fail("image", "Ảnh phải là liên kết https hoặc đường dẫn img/… hợp lệ (tối đa " + IMAGE_MAX + " ký tự)");
            value.put("image", img);
        }
        if (b.get("images") != null) {
            try {
                List<String> images = validateImages(b.get("images"));
                if (!images.isEmpty()) value.put("images", images);
            } catch (IllegalArgumentException e) {
                return fail("images", e.getMessage());
            }
        }
        return new Check(value, null, null);
    }

    /** Dạng công khai của 1 review đã lưu: bỏ userId, bổ sung date. */
    public static Map<String, Object> toPublic(Map<String, Object> r) {
        String created = String.valueOf(r.getOrDefault("createdAt", ""));
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("id", r.get("id"));
        o.put("tourId", r.get("tourId") == null ? "" : String.valueOf(r.get("tourId")));
        if (r.get("tourName") != null) o.put("tourName", r.get("tourName"));
        if (r.get("targetType") != null) o.put("targetType", r.get("targetType"));
        if (r.get("foodName") != null) o.put("foodName", r.get("foodName"));
        o.put("name", r.get("name") == null || "".equals(r.get("name")) ? "Khách" : r.get("name"));
        if (toRating(r.get("rating")) > 0) o.put("rating", toRating(r.get("rating")));
        o.put("content", r.get("content") != null ? r.get("content") : r.get("comment"));
        Object date = r.get("date");
        o.put("date", date != null && !"".equals(date) ? date : created.substring(0, Math.min(10, created.length())));
        o.put("createdAt", r.get("createdAt"));
        if (r.get("criteria") != null) o.put("criteria", r.get("criteria"));
        if (r.get("guideRating") != null) o.put("guideRating", r.get("guideRating"));
        if (r.get("guideComment") != null) o.put("guideComment", r.get("guideComment"));
        if (safeImage(r.get("image"))) o.put("image", r.get("image"));
        if (r.get("images") instanceof List<?> images) {
            List<String> safe = new ArrayList<>();
            for (Object image : images) if (safeImage(image)) safe.add(String.valueOf(image));
            if (!safe.isEmpty()) o.put("images", safe);
        }
        if (r.get("reply") != null) o.put("reply", r.get("reply"));
        if (r.get("replies") instanceof List<?> replies) {
            List<Map<String, Object>> publicReplies = new ArrayList<>();
            for (Object item : replies) {
                Map<String, Object> reply = Maps.map(item);
                if (reply == null) continue;
                Map<String, Object> clean = new LinkedHashMap<>();
                for (String key : List.of("id", "name", "content", "createdAt", "replyToId"))
                    if (reply.containsKey(key)) clean.put(key, reply.get(key));
                if (reply.get("images") instanceof List<?> imgs) {
                    List<String> safe = new ArrayList<>();
                    for (Object image : imgs) if (safeImage(image)) safe.add(String.valueOf(image));
                    if (!safe.isEmpty()) clean.put("images", safe);
                }
                publicReplies.add(clean);
            }
            o.put("replies", publicReplies);
        }
        if (r.get("kind") != null) o.put("kind", r.get("kind"));
        boolean sample = Boolean.TRUE.equals(r.get("sample"));
        if (sample) o.put("sample", true);
        String src = Maps.str(r, "source");
        if (src.isEmpty()) src = sample ? "demo" : ("admin".equals(r.get("source")) ? "admin" : "verified");
        o.put("source", src);
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
