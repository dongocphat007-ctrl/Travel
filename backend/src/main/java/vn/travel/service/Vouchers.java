package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Voucher (A1, A2): mã gắn tài khoản, đánh dấu đã dùng khi tạo đơn, chống dùng lại, hạn tính theo GIỜ SERVER.
 *  - WELCOME10: −10% cho tài khoản mới, hiệu lực 7 ngày kể từ createdAt (server đặt)
 *  - GIAM15-xxx: −15% riêng từng tour hot, 1 lần/mã
 *  - SINHNHAT: −20%, 7 ngày kể từ ngày sinh (giờ VN), mỗi năm 1 mã
 */
@Service
@SuppressWarnings("unchecked")
public class Vouchers {
    public static final int WELCOME_PCT = 10, WELCOME_DAYS = 7, TOUR_PCT = 15, BIRTHDAY_PCT = 20, BIRTHDAY_DAYS = 7;
    /** Tour hot trên banner → tiền tố mã. */
    static final String[][] TOUR_VOUCHERS = {{"hot07", "NB"}, {"hot08", "HUE"}, {"hot09", "DN"}, {"hot10", "SAPA"}, {"hot11", "QB"}};
    private static final long DAY = 86_400_000L;

    private final Db db;
    private final Notifications noti;
    private final TourCatalog tours;
    private final Clock clock;

    public Vouchers(Db db, Notifications noti, TourCatalog tours, Clock clock) {
        this.db = db;
        this.noti = noti;
        this.tours = tours;
        this.clock = clock;
    }

    // ───────── trạng thái ─────────
    /** active | upcoming | expired | disabled | exhausted | used (với người dùng userId; null = góc nhìn Admin) */
    public String state(Map<String, Object> v, String userId) {
        long now = clock.millis();
        if (Maps.bool(v, "disabled")) return "disabled";
        List<Object> used = Maps.list(v.get("usedBy"));
        if (userId != null && used.contains(userId)) return "used";
        long max = Maps.lng(v, "maxUses");
        if (max > 0 && used.size() >= max) return userId == null ? "exhausted" : "exhausted";
        Long s = Times.parse(v.get("startAt")), e = Times.parse(v.get("endAt"));
        if (s != null && now < s) return "upcoming";
        if (e != null && now >= e) return "expired";
        return "active";
    }

    private static Map<String, Object> publicView(Map<String, Object> v) {
        return Maps.of("code", v.get("code"), "title", v.get("title"), "type", v.get("type"), "value", v.get("value"),
                "maxDiscount", v.getOrDefault("maxDiscount", 0), "tourId", v.get("tourId"), "startAt", v.get("startAt"), "endAt", v.get("endAt"));
    }

    // ───────── cấp tự động ─────────
    public Map<String, Object> grantWelcome(Map<String, Object> user) {
        String uid = Maps.str(user, "id");
        Long created = Times.parse(user.get("createdAt"));
        if (created == null) created = clock.millis();
        long end = created + WELCOME_DAYS * DAY;
        if (end <= clock.millis()) return null;      // tài khoản quá 7 ngày: không còn quyền nhận
        Map<String, Object> v = newVoucher("WELCOME10-" + Ids.suffix(), "Chào mừng thành viên mới", "percent", WELCOME_PCT, uid,
                null, "welcome", null, Times.iso(end), 1);
        v = insertUnique(v, "WELCOME10-");
        noti.add(uid, "welcome", "🎉 Chào mừng bạn đến với Travel!",
                "Bạn nhận được mã " + v.get("code") + " giảm " + WELCOME_PCT + "%, dùng được trong " + WELCOME_DAYS + " ngày kể từ khi tạo tài khoản.", "profile", "welcome");
        return publicView(v);
    }

    /** 5 mã −15% cho 5 tour hot; mỗi tài khoản đúng 1 lần. */
    public void grantTourVouchers(String uid) {
        boolean has = db.list("vouchers").stream().anyMatch(v -> uid.equals(v.get("ownerId")) && "tour15".equals(v.get("source")));
        if (has) return;
        for (String[] tv : TOUR_VOUCHERS) {
            String title = "Giảm " + TOUR_PCT + "% " + tours.name(tv[0]);
            insertUnique(newVoucher("GIAM15-" + tv[1] + "-" + Ids.suffix(), title, "percent", TOUR_PCT, uid, tv[0], "tour15", null, null, 1), "GIAM15-" + tv[1] + "-");
        }
        noti.add(uid, "voucher", "🎟️ Bạn có 5 mã giảm 15% cho từng tour hot",
                "Mỗi mã dùng 1 lần cho đúng tour ghi trên mã. Xem trong Hồ sơ → Voucher của tôi.", "profile", "tour15");
    }

    /** Voucher sinh nhật: hiệu lực BIRTHDAY_DAYS ngày kể từ ngày sinh (giờ VN); đăng nhập trễ ≤ 7 ngày vẫn nhận. */
    public Map<String, Object> grantBirthday(Map<String, Object> user) {
        if (!Maps.bool(user, "profileVerified")) return null;
        LocalDate bd;
        try { bd = LocalDate.parse(Maps.str(user, "birthday")); } catch (Exception e) { return null; }
        long now = clock.millis();
        LocalDate today = Times.todayVN(now);
        int year = today.getYear();
        // lần sinh nhật gần nhất (≤ hôm nay); 29/2 năm không nhuận → 28/2
        LocalDate cand = anniversary(bd, year);
        if (cand.isAfter(today)) cand = anniversary(bd, year - 1);
        long start = cand.atStartOfDay(Times.VN).toInstant().toEpochMilli();
        long end = start + BIRTHDAY_DAYS * DAY;
        if (now >= end) return null;
        String uid = Maps.str(user, "id"), key = "birthday" + cand.getYear();
        boolean has = db.list("vouchers").stream().anyMatch(v -> uid.equals(v.get("ownerId")) && key.equals(v.get("source")));
        if (has) return null;
        Map<String, Object> v = insertUnique(newVoucher("SINHNHAT" + cand.getYear() + "-" + Ids.suffix(), "Quà sinh nhật " + cand.getYear(), "percent", BIRTHDAY_PCT,
                uid, null, key, Times.iso(start), Times.iso(end), 1), "SINHNHAT" + cand.getYear() + "-");
        noti.add(uid, "voucher", "🎂 Chúc mừng sinh nhật!", "Tặng bạn mã " + v.get("code") + " giảm " + BIRTHDAY_PCT + "%, dùng trong " + BIRTHDAY_DAYS + " ngày.", "profile", key);
        return publicView(v);
    }

    private static LocalDate anniversary(LocalDate bd, int year) {
        if (bd.getMonthValue() == 2 && bd.getDayOfMonth() == 29 && !java.time.Year.isLeap(year)) return LocalDate.of(year, 2, 28);
        return LocalDate.of(year, bd.getMonthValue(), bd.getDayOfMonth());
    }

    private Map<String, Object> newVoucher(String code, String title, String type, long value, String ownerId, String tourId,
                                           String source, String startAt, String endAt, long maxUses) {
        return Maps.of("code", code, "title", title, "type", type, "value", value, "maxDiscount", 0, "ownerId", ownerId, "tourId", tourId,
                "source", source, "startAt", startAt, "endAt", endAt, "maxUses", maxUses, "usedBy", new ArrayList<>(), "disabled", false,
                "createdAt", Times.iso(clock.millis()));
    }

    private Map<String, Object> insertUnique(Map<String, Object> v, String prefix) {
        db.edit("vouchers", all -> {
            Set<String> codes = new HashSet<>();
            all.forEach(x -> codes.add(Maps.str(x, "code").toUpperCase()));
            while (codes.contains(Maps.str(v, "code").toUpperCase())) v.put("code", prefix + Ids.suffix());
            all.add(v);
        });
        return v;
    }

    // ───────── khách ─────────
    public List<Map<String, Object>> mine(String userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> v : db.list("vouchers")) {
            String owner = Maps.str(v, "ownerId");
            if (!owner.isEmpty() && !owner.equals(userId)) continue;
            Map<String, Object> o = new LinkedHashMap<>(publicView(v));
            o.put("state", state(v, userId));
            o.put("source", v.get("source"));
            out.add(o);
        }
        return out;
    }

    /** Kiểm tra mã cho tài khoản userId (A1). Trả bản công khai của voucher, hoặc ném HttpError. */
    public Map<String, Object> validate(String code, String tourId, String userId) {
        Map<String, Object> v = find(code);
        if (v == null) throw HttpError.notFound("Mã không tồn tại");
        check(v, tourId, userId);
        return publicView(v);
    }

    private void check(Map<String, Object> v, String tourId, String userId) {
        String owner = Maps.str(v, "ownerId");
        if (!owner.isEmpty() && !owner.equals(userId)) throw new HttpError(403, "Mã này không dành cho tài khoản của bạn");
        String vt = Maps.str(v, "tourId");
        if (!vt.isEmpty() && tourId != null && !vt.equals(tourId)) throw new HttpError(400, "Mã này chỉ áp dụng cho tour " + tours.name(vt));
        switch (state(v, userId)) {
            case "active": return;
            case "used": throw new HttpError(409, "Bạn đã dùng mã này rồi");
            case "expired": throw new HttpError(410, "Mã đã hết hạn");
            case "upcoming": throw new HttpError(400, "Mã chưa đến thời gian áp dụng");
            case "exhausted": throw new HttpError(409, "Mã đã hết lượt sử dụng");
            default: throw new HttpError(400, "Mã đã bị tắt");
        }
    }

    public Map<String, Object> find(String code) {
        if (code == null) return null;
        String c = code.trim();
        for (Map<String, Object> v : db.list("vouchers")) if (Maps.str(v, "code").equalsIgnoreCase(c)) return v;
        return null;
    }

    /**
     * Kiểm tra lại + đánh dấu đã dùng, NGUYÊN TỬ (trong khóa của vouchers.json) → hai đơn song song không dùng chung 1 mã.
     * Trả voucher (đầy đủ trường để Pricing dùng).
     */
    public Map<String, Object> consume(String code, String tourId, String userId) {
        Map<String, Object>[] holder = new Map[1];
        db.edit("vouchers", all -> {
            Map<String, Object> v = null;
            for (Map<String, Object> x : all) if (Maps.str(x, "code").equalsIgnoreCase(code.trim())) v = x;
            if (v == null) throw HttpError.bad("Mã không tồn tại", "voucher");
            try { check(v, tourId, userId); } catch (HttpError e) { throw new HttpError(e.status() == 403 ? 400 : e.status(), e.getMessage(), "voucher"); }
            List<Object> used = new ArrayList<>(Maps.list(v.get("usedBy")));
            used.add(userId);
            v.put("usedBy", used);
            holder[0] = v;
        });
        return holder[0];
    }

    /** Hủy đơn → hoàn lại mã (bỏ userId khỏi usedBy). */
    public void release(String code, String userId) {
        if (code == null || code.isEmpty()) return;
        db.edit("vouchers", all -> {
            for (Map<String, Object> v : all) {
                if (!Maps.str(v, "code").equalsIgnoreCase(code)) continue;
                List<Object> used = new ArrayList<>(Maps.list(v.get("usedBy")));
                used.remove(userId);
                v.put("usedBy", used);
            }
        });
    }

    // ───────── Admin ─────────
    public List<Map<String, Object>> adminList(Accounts accounts) {
        Map<String, String> emailById = new HashMap<>();
        accounts.all().forEach(a -> emailById.put(Maps.str(a, "id"), Maps.str(a, "email")));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> v : db.list("vouchers")) {
            Map<String, Object> o = new LinkedHashMap<>(v);
            o.put("status", state(v, null));
            if (!Maps.str(v, "ownerId").isEmpty()) o.put("ownerEmail", emailById.getOrDefault(Maps.str(v, "ownerId"), ""));
            out.add(o);
        }
        return out;
    }

    public Map<String, Object> adminCreate(Map<String, Object> b, Accounts accounts) {
        String code = Maps.str(b, "code").trim().toUpperCase();
        if (!code.matches("[A-Z0-9_-]{3,24}")) throw HttpError.bad("Mã chỉ gồm chữ/số/gạch, 3–24 ký tự", "code");
        String type = Maps.str(b, "type");
        if (!type.equals("percent") && !type.equals("fixed")) throw HttpError.bad("Loại giảm không hợp lệ", "type");
        double value = vnum(b.get("value"));
        if (!(value > 0) || (type.equals("percent") && value > 100)) throw HttpError.bad("Giá trị giảm không hợp lệ", "value");
        double max = vnum(b.get("maxDiscount")), uses = vnum(b.get("maxUses"));
        if (max < 0 || uses < 0) throw HttpError.bad("Số liệu không hợp lệ");
        Long s = Times.parse(b.get("startAt")), e = Times.parse(b.get("endAt"));
        if (s != null && e != null && e <= s) throw HttpError.bad("Hết hạn phải sau thời gian bắt đầu", "endAt");
        String ownerId = "";
        String email = Maps.str(b, "ownerEmail").trim();
        if (!email.isEmpty()) {
            Map<String, Object> a = accounts.byEmail(email);
            if (a == null) throw HttpError.bad("Không có tài khoản với email này", "ownerEmail");
            ownerId = Maps.str(a, "id");
        }
        String title = Maps.str(b, "title").trim();
        Map<String, Object> v = newVoucher(code, title.isEmpty() ? code : title, type, (long) value, ownerId.isEmpty() ? null : ownerId, null, "admin",
                s == null ? null : Times.iso(s), e == null ? null : Times.iso(e), (long) uses);
        v.put("maxDiscount", (long) max);
        db.edit("vouchers", all -> {
            if (all.stream().anyMatch(x -> Maps.str(x, "code").equalsIgnoreCase(code))) throw new HttpError(409, "Mã đã tồn tại", "code");
            all.add(v);
        });
        return v;
    }

    public void adminSetDisabled(String code, boolean disabled) {
        boolean[] found = {false};
        db.edit("vouchers", all -> all.forEach(v -> {
            if (Maps.str(v, "code").equalsIgnoreCase(code)) { v.put("disabled", disabled); found[0] = true; }
        }));
        if (!found[0]) throw HttpError.notFound("Không tìm thấy voucher");
    }

    public void adminDelete(String code) {
        boolean[] found = {false};
        db.edit("vouchers", all -> found[0] = all.removeIf(v -> Maps.str(v, "code").equalsIgnoreCase(code)));
        if (!found[0]) throw HttpError.notFound("Không tìm thấy voucher");
    }

    private static double vnum(Object o) {
        try { return o == null || "".equals(o) ? 0 : Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return -1; }
    }
}
