package vn.travel.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;

import vn.travel.store.Db;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

/**
 * Cấu hình hệ thống (TASKS 17.23) – chỉ ADMIN xem/sửa, mỗi lần sửa ghi nhật ký (ai, lúc nào, giá trị cũ → mới).
 * Giá trị lưu ở storage/db/config.json; thiếu khóa nào thì dùng mặc định ở {@link #defaults()}.
 */
@Service
@SuppressWarnings("unchecked")
public class SystemConfig {
    private final Db db;
    private final Audit audit;

    public SystemConfig(Db db, Audit audit) {
        this.db = db;
        this.audit = audit;
    }

    public static Map<String, Object> defaults() {
        Map<String, Object> d = new LinkedHashMap<>();
        // 8.1 bảng hoàn tiền theo mốc: số ngày báo hủy trước ngày đi → % số tiền đã nhận được hoàn (khớp trang Chính sách)
        d.put("refundPolicy", List.of(Maps.of("minDaysBefore", 15, "pct", 100), Maps.of("minDaysBefore", 7, "pct", 50), Maps.of("minDaysBefore", 0, "pct", 0)));
        d.put("paymentHoldHours", 24);          // 3.8 giữ chỗ khi chưa thanh toán
        d.put("balanceDueDaysAfterTrip", 3);    // 4.4 hạn thu nốt (kể cả phụ thu làm thêm giờ) = sau ngày kết thúc tour N ngày
        d.put("guideFeePerDay", 500000);        // 7.9 thù lao HDV mỗi ngày tour (chỉ tính khi đơn completed)
        d.put("guideResponseHours", 24);        // 5.8 hạn HDV trả lời
        d.put("restDays", List.of(Maps.of("minTourDays", 5, "rest", 1)));   // 5.3 ngày nghỉ sau tour (chỉ HDV chính thức)
        d.put("complaintResponseHours", 24);    // 6.9
        d.put("undoMinutes", 15);               // 3.7 thời gian cho phép hoàn tác thao tác nhầm
        d.put("autoComplete", Maps.of("guided", false, "selfGuided", true, "daysAfterEnd", 1));   // 6.3
        d.put("departure", Maps.of("defaultCapacity", 20, "defaultMinGuests", 2, "cutoffDaysBeforeTrip", 3));   // 9.1, 9.3
        d.put("extension", Maps.of("maxDays", 2, "noticeHours", 24, "surchargePct", 0));   // 8.14, 8.15
        d.put("aiLinks", List.of(
                Maps.of("name", "Gemini", "url", "https://gemini.google.com"),
                Maps.of("name", "ChatGPT", "url", "https://chatgpt.com"),
                Maps.of("name", "Claude", "url", "https://claude.ai"),
                Maps.of("name", "Perplexity", "url", "https://www.perplexity.ai"),
                Maps.of("name", "Microsoft Copilot", "url", "https://copilot.microsoft.com")));
        return d;
    }

    /** Cấu hình đang áp dụng = mặc định + phần admin đã sửa. */
    public Map<String, Object> get() {
        Map<String, Object> out = defaults();
        Map<String, Object> saved = db.obj("config");
        for (Map.Entry<String, Object> e : saved.entrySet()) {
            if (!out.containsKey(e.getKey())) continue;
            Object def = out.get(e.getKey());
            if (def instanceof Map<?, ?> dm && e.getValue() instanceof Map<?, ?> sm) {
                Map<String, Object> merged = new LinkedHashMap<>((Map<String, Object>) dm);
                for (Map.Entry<?, ?> x : sm.entrySet()) if (merged.containsKey(String.valueOf(x.getKey()))) merged.put(String.valueOf(x.getKey()), x.getValue());
                out.put(e.getKey(), merged);
            } else {
                out.put(e.getKey(), e.getValue());
            }
        }
        return out;
    }

    /** Phần công khai (khách và chatbot cần): bảng hoàn tiền, hạn giữ chỗ, link AI. */
    public Map<String, Object> publicView() {
        Map<String, Object> c = get();
        return Maps.of("refundPolicy", c.get("refundPolicy"), "paymentHoldHours", c.get("paymentHoldHours"), "balanceDueDaysAfterTrip", c.get("balanceDueDaysAfterTrip"),
                "aiLinks", c.get("aiLinks"), "extension", c.get("extension"));
    }

    // ───────── đọc có kiểu ─────────
    public int i(String key) { return (int) Math.round(num(get().get(key))); }

    public int i(String key, String sub) {
        Map<String, Object> m = Maps.map(get().get(key));
        return m == null ? 0 : (int) Math.round(num(m.get(sub)));
    }

    public boolean b(String key, String sub) {
        Map<String, Object> m = Maps.map(get().get(key));
        return m != null && Boolean.TRUE.equals(m.get(sub));
    }

    private static double num(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); } catch (RuntimeException e) { return 0; }
    }

    /** % được hoàn khi khách hủy cách ngày đi {@code daysBefore} ngày (duyệt từ mốc lớn đến nhỏ). */
    public int refundPct(long daysBefore) {
        List<Map<String, Object>> tiers = new ArrayList<>();
        for (Object o : Maps.list(get().get("refundPolicy"))) { Map<String, Object> t = Maps.map(o); if (t != null) tiers.add(t); }
        tiers.sort((a, b) -> Long.compare(Maps.lng(b, "minDaysBefore"), Maps.lng(a, "minDaysBefore")));
        for (Map<String, Object> t : tiers) if (daysBefore >= Maps.lng(t, "minDaysBefore")) return (int) Maps.lng(t, "pct");
        return 0;
    }

    /** Số ngày nghỉ sau tour {@code tourDays} ngày (áp dụng cho HDV chính thức). */
    public int restDaysFor(int tourDays) {
        int best = 0;
        long bestMin = -1;
        for (Object o : Maps.list(get().get("restDays"))) {
            Map<String, Object> r = Maps.map(o);
            if (r == null) continue;
            long min = Maps.lng(r, "minTourDays");
            if (tourDays >= min && min > bestMin) { bestMin = min; best = (int) Maps.lng(r, "rest"); }
        }
        return best;
    }

    // ───────── sửa (chỉ ADMIN, controller đã kiểm tra quyền) ─────────
    public Map<String, Object> update(Map<String, Object> actor, Map<String, Object> patch) {
        Map<String, Object> cur = get();
        Map<String, Object> next = new LinkedHashMap<>();
        List<String> changes = new ArrayList<>();
        for (Map.Entry<String, Object> e : patch.entrySet()) {
            String k = e.getKey();
            if (!cur.containsKey(k)) throw HttpError.bad("Khóa cấu hình không tồn tại: " + k, k);
            Object v = clean(k, e.getValue(), cur.get(k));
            if (!Objects.equals(String.valueOf(cur.get(k)), String.valueOf(v))) changes.add(k + ": " + cur.get(k) + " → " + v);
            next.put(k, v);
        }
        if (next.isEmpty()) return cur;
        db.editObj("config", m -> m.putAll(next));
        for (String c : changes) audit.log(actor, "config.update", "config", c);
        return get();
    }

    private static int intIn(Object o, int min, int max, String field) {
        if (!(o instanceof Number) && !(o instanceof String s && s.trim().matches("-?\\d+"))) throw HttpError.bad("Giá trị không hợp lệ", field);
        long v = Math.round(num(o));
        if (v < min || v > max) throw HttpError.bad("Giá trị phải từ " + min + " đến " + max, field);
        return (int) v;
    }

    private Object clean(String k, Object v, Object old) {
        switch (k) {
            case "paymentHoldHours": return intIn(v, 1, 720, k);
            case "balanceDueDaysAfterTrip": return intIn(v, 0, 90, k);
            case "guideFeePerDay": return intIn(v, 0, 100_000_000, k);
            case "guideResponseHours": return intIn(v, 1, 168, k);
            case "complaintResponseHours": return intIn(v, 1, 720, k);
            case "undoMinutes": return intIn(v, 0, 1440, k);
            case "refundPolicy": {
                List<Object> in = Maps.list(v);
                if (in.isEmpty()) throw HttpError.bad("Bảng hoàn tiền phải có ít nhất một mốc", k);
                List<Map<String, Object>> out = new ArrayList<>();
                boolean hasZero = false;
                for (Object o : in) {
                    Map<String, Object> t = Maps.map(o);
                    if (t == null) throw HttpError.bad("Mốc hoàn tiền không hợp lệ", k);
                    int days = intIn(t.get("minDaysBefore"), 0, 365, k), pct = intIn(t.get("pct"), 0, 100, k);
                    if (days == 0) hasZero = true;
                    out.add(Maps.of("minDaysBefore", days, "pct", pct));
                }
                if (!hasZero) throw HttpError.bad("Phải có mốc 0 ngày (sát ngày đi)", k);
                out.sort((a, b) -> Long.compare(Maps.lng(b, "minDaysBefore"), Maps.lng(a, "minDaysBefore")));
                for (int i = 1; i < out.size(); i++)
                    if (Maps.lng(out.get(i), "minDaysBefore") == Maps.lng(out.get(i - 1), "minDaysBefore")) throw HttpError.bad("Hai mốc trùng số ngày", k);
                return out;
            }
            case "restDays": {
                List<Map<String, Object>> out = new ArrayList<>();
                for (Object o : Maps.list(v)) {
                    Map<String, Object> t = Maps.map(o);
                    if (t == null) throw HttpError.bad("Quy tắc ngày nghỉ không hợp lệ", k);
                    out.add(Maps.of("minTourDays", intIn(t.get("minTourDays"), 1, 60, k), "rest", intIn(t.get("rest"), 0, 7, k)));
                }
                return out;
            }
            case "autoComplete": {
                Map<String, Object> m = Maps.map(v);
                if (m == null) throw HttpError.bad("Giá trị không hợp lệ", k);
                return Maps.of("guided", Boolean.TRUE.equals(m.get("guided")), "selfGuided", Boolean.TRUE.equals(m.get("selfGuided")),
                        "daysAfterEnd", intIn(m.get("daysAfterEnd"), 0, 30, k));
            }
            case "departure": {
                Map<String, Object> m = Maps.map(v);
                if (m == null) throw HttpError.bad("Giá trị không hợp lệ", k);
                return Maps.of("defaultCapacity", intIn(m.get("defaultCapacity"), 1, 500, k), "defaultMinGuests", intIn(m.get("defaultMinGuests"), 1, 100, k),
                        "cutoffDaysBeforeTrip", intIn(m.get("cutoffDaysBeforeTrip"), 0, 60, k));
            }
            case "extension": {
                Map<String, Object> m = Maps.map(v);
                if (m == null) throw HttpError.bad("Giá trị không hợp lệ", k);
                return Maps.of("maxDays", intIn(m.get("maxDays"), 1, 2, k), "noticeHours", intIn(m.get("noticeHours"), 0, 168, k),
                        "surchargePct", intIn(m.get("surchargePct"), 0, 20, k));
            }
            case "aiLinks": {
                List<Map<String, Object>> out = new ArrayList<>();
                for (Object o : Maps.list(v)) {
                    Map<String, Object> t = Maps.map(o);
                    String name = t == null ? "" : Maps.str(t, "name").trim(), url = t == null ? "" : Maps.str(t, "url").trim();
                    if (name.isEmpty() || name.length() > 40 || !url.matches("^https://[^\\s\"'<>]+$")) throw HttpError.bad("Link AI phải có tên và bắt đầu bằng https://", k);
                    out.add(Maps.of("name", name, "url", url));
                }
                if (out.size() > 12) throw HttpError.bad("Tối đa 12 link", k);
                return out;
            }
            default: throw HttpError.bad("Khóa cấu hình không tồn tại: " + k, k);
        }
    }
}