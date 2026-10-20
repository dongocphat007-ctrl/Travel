package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.GuideAvailability;
import vn.travel.util.Maps;
import vn.travel.util.Pricing;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

/**
 * Booking (FE-03, FE-04, G5, A1, A3): server TỰ tính giá gốc → HDV → voucher → giá cuối → cọc 20% từ dữ liệu tour;
 * client không gửi được giá. Kiểm tra lại Guide rảnh, đánh dấu voucher đã dùng, tạo mã đơn + mã chuyển khoản.
 */
@Service
@SuppressWarnings("unchecked")
public class Bookings {
    public static final int MIN_DAYS_AHEAD = 3;
    private static final Pattern PHONE = Pattern.compile("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Set<String> STATUSES = Set.of("pending", "confirmed", "cancelled");
    private static final Set<String> BOOL_FIELDS = Set.of("depositPaid", "fullPaid", "finalPaid");
    private static final Set<String> ISO_FIELDS = Set.of("depositPaidAt", "finalPaidAt");

    private final Db db;
    private final TourCatalog tours;
    private final Vouchers vouchers;
    private final Guides guides;
    private final Notifications noti;
    private final Mailer mailer;
    private final Accounts accounts;
    private final Clock clock;
    private final String payPrefix;

    public Bookings(Db db, TourCatalog tours, Vouchers vouchers, Guides guides, Notifications noti, Mailer mailer, Accounts accounts,
                    Clock clock, TravelProperties props) {
        this.db = db;
        this.tours = tours;
        this.vouchers = vouchers;
        this.guides = guides;
        this.noti = noti;
        this.mailer = mailer;
        this.accounts = accounts;
        this.clock = clock;
        this.payPrefix = props.prefix();
    }

    // ───────── truy vấn ─────────
    public List<Map<String, Object>> listFor(Map<String, Object> user) {
        List<Map<String, Object>> all = db.list("bookings");
        if (accounts.isAdmin(user)) return all;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : all) if (Maps.str(b, "userId").equals(Maps.str(user, "id"))) out.add(b);
        return out;
    }

    public Map<String, Object> find(String id) {
        for (Map<String, Object> b : db.list("bookings")) if (Maps.str(b, "id").equals(id)) return b;
        return null;
    }

    public Map<String, Object> getFor(String id, Map<String, Object> user) {
        Map<String, Object> b = find(id);
        if (b == null || !(accounts.isAdmin(user) || Maps.str(b, "userId").equals(Maps.str(user, "id")))) throw HttpError.notFound("Không tìm thấy đơn");
        return b;
    }

    // ───────── tạo đơn ─────────
    public Map<String, Object> create(Map<String, Object> user, Map<String, Object> in) {
        Map<String, Object> tour = tours.find(in.get("tourId"));
        if (tour == null) throw HttpError.notFound("Không tìm thấy tour");
        String name = Maps.str(in, "customerName").trim();
        if (name.length() < 2 || name.length() > 100) throw HttpError.bad("Vui lòng nhập họ tên", "customerName");
        String phone = Maps.str(in, "phone").replaceAll("[\\s.\\-]", "");
        if (!PHONE.matcher(phone).matches()) throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        String email = Maps.str(in, "email").trim();
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) throw HttpError.bad("Email không hợp lệ", "email");
        String note = Maps.str(in, "note").trim();
        if (note.length() > 1000) note = note.substring(0, 1000);

        String date = Maps.str(in, "date");
        LocalDate d = GuideAvailability.parse(date);
        if (d == null) throw HttpError.bad("Vui lòng chọn ngày khởi hành", "date");
        LocalDate earliest = Times.todayVN(clock.millis()).plusDays(MIN_DAYS_AHEAD);
        if (d.isBefore(earliest)) throw HttpError.bad("Phải đăng ký trước ngày đi ít nhất " + MIN_DAYS_AHEAD + " ngày (chọn từ " + earliest + " trở đi)", "date");

        boolean hdvOn = Boolean.TRUE.equals(in.get("hdvOn"));
        int days = TourCatalog.days(tour);
        double hours = Pricing.num(in.get("hdvHours"));
        if (hours < 1 || hours > 24) hours = Pricing.GUIDE_DAY_HOURS;
        String guideId = Maps.str(in, "guideId").trim();
        String voucherCode = Maps.str(in, "voucherCode").trim();
        String tourId = String.valueOf(tour.get("id"));
        String uid = Maps.str(user, "id");

        String finalNote = note;
        double finalHours = hours;
        Map<String, Object>[] out = new Map[1];
        db.edit("bookings", all -> {
            Map<String, Object> guide = null;
            if (!guideId.isEmpty()) {
                if (!TourCatalog.hasGuide(tour) && !hdvOn) throw HttpError.bad("Tour tự túc chỉ chọn hướng dẫn viên khi bạn thuê HDV", "guide");
                guide = guides.get(guideId);
                if (guide == null) throw HttpError.bad("Hướng dẫn viên không tồn tại", "guide");
                if ("off".equals(guide.get("status"))) throw HttpError.conflict(Maps.str(guide, "name") + " đang tạm nghỉ", "guide");
                if (!GuideAvailability.isFreeRange(guide, date, days)) {
                    List<String> clash = GuideAvailability.busyInRange(guide, date, days);
                    throw HttpError.conflict(Maps.str(guide, "name") + " không rảnh đủ " + days + " ngày từ " + date
                            + (clash.isEmpty() ? "" : " (bận: " + String.join(", ", clash) + ")"), "guide");
                }
            }
            Map<String, Object> voucher = voucherCode.isEmpty() ? null : vouchers.consume(voucherCode, tourId, uid);
            try {
                Map<String, Object> bd = Pricing.compute(new Pricing.Input(tour.get("price"), in.get("adults"), in.get("kids"), in.get("infants"),
                        hdvOn, finalHours, days, voucher));
                String id = "bk_" + clock.millis();
                Set<String> ids = new HashSet<>();
                all.forEach(x -> ids.add(Maps.str(x, "id")));
                long seq = clock.millis();
                while (ids.contains("bk_" + seq)) seq++;
                id = "bk_" + seq;

                Map<String, Object> b = new LinkedHashMap<>();
                b.put("id", id);
                b.put("payCode", payPrefix + id.replaceAll("\\D", ""));
                b.put("depositPaid", false);
                b.put("tourId", tour.get("id"));
                b.put("tourName", tour.get("name"));
                b.put("tourDest", tour.get("dest") != null ? tour.get("dest") : tour.get("destination"));
                b.put("userId", uid);
                b.put("userEmail", Maps.str(user, "email"));
                b.put("guideId", guideId.isEmpty() ? null : guideId);
                b.put("customerName", name);
                b.put("phone", phone);
                b.put("email", email);
                b.put("date", date);
                b.put("pax", bd.get("pax"));
                b.put("adults", bd.get("adults"));
                b.put("children", bd.get("kids"));
                b.put("infants", bd.get("infants"));
                b.put("note", finalNote);
                b.put("price", bd.get("final"));
                b.put("deposit", bd.get("deposit"));
                b.put("depositPercent", Pricing.DEPOSIT_PCT);
                b.put("priceBreakdown", bd);
                b.put("voucherCode", voucher == null ? "" : voucher.get("code"));
                b.put("guideHire", hdvOn ? Maps.of("enabled", true, "hoursPerDay", (long) finalHours, "days", days, "cost", bd.get("hdv")) : Maps.of("enabled", false));
                b.put("itinerary", tour.get("itinerary") == null ? List.of() : tour.get("itinerary"));
                b.put("tourDuration", tour.get("duration") == null ? "" : tour.get("duration"));
                b.put("tourDays", days);
                b.put("tourHighlight", tour.get("highlight") == null ? "" : tour.get("highlight"));
                b.put("guideType", TourCatalog.hasGuide(tour) ? "guided" : "self");
                b.put("status", "pending");
                b.put("createdAt", Times.iso(clock.millis()));
                all.add(b);
                out[0] = b;
            } catch (RuntimeException e) {
                if (voucher != null) vouchers.release(voucherCode, uid);
                throw e;
            }
        });
        Map<String, Object> b = out[0];
        noti.add(uid, "booking", "🧳 Đã nhận yêu cầu đặt tour",
                "Đơn " + b.get("id") + " – " + b.get("tourName") + ". Vui lòng chuyển cọc " + Pricing.DEPOSIT_PCT + "% với nội dung " + b.get("payCode") + ".", "profile", "bk-" + b.get("id"));
        String to = !Maps.str(b, "email").isEmpty() ? Maps.str(b, "email") : Maps.str(user, "email");
        if (!to.isEmpty()) CompletableFuture.runAsync(() -> mailer.send(to, "Travel – Xác nhận đặt tour " + b.get("tourName"), mailer.bookingHtml(b)));
        return b;
    }

    // ───────── hủy / cập nhật ─────────
    public Map<String, Object> cancel(String id, Map<String, Object> user) {
        boolean admin = accounts.isAdmin(user);
        Map<String, Object>[] out = new Map[1];
        db.edit("bookings", all -> {
            for (Map<String, Object> b : all) {
                if (!Maps.str(b, "id").equals(id)) continue;
                if (!admin && !Maps.str(b, "userId").equals(Maps.str(user, "id"))) throw HttpError.notFound("Không tìm thấy đơn");
                if ("cancelled".equals(b.get("status"))) throw HttpError.conflict("Đơn đã được hủy trước đó", null);
                if (!admin && (!"pending".equals(b.get("status")) || Maps.bool(b, "depositPaid")))
                    throw HttpError.conflict("Đơn đã được xác nhận hoặc đã đặt cọc — vui lòng liên hệ Travel để hủy", null);
                doCancel(b);
                out[0] = b;
                return;
            }
            throw HttpError.notFound("Không tìm thấy đơn");
        });
        return out[0];
    }

    private void doCancel(Map<String, Object> b) {
        b.put("status", "cancelled");
        b.put("cancelledAt", Times.iso(clock.millis()));
        vouchers.release(Maps.str(b, "voucherCode"), Maps.str(b, "userId"));
        noti.add(Maps.str(b, "userId"), "booking", "❌ Đơn đã được hủy", "Đơn " + b.get("id") + " – " + b.get("tourName") + " đã được hủy.", "profile", "cancel-" + b.get("id"));
    }

    /**
     * /api/bookings/sync: chỉ các trường "được phép đổi". Khách chỉ đổi được claims/payChoice và hủy đơn chưa cọc của chính mình;
     * trạng thái thanh toán / xác nhận chỉ Admin (hoặc webhook) được đặt. payCode, giá, khách hàng KHÔNG bao giờ đổi qua đây.
     */
    public List<Map<String, Object>> sync(Map<String, Object> user, List<?> changes) {
        boolean admin = accounts.isAdmin(user);
        List<Map<String, Object>> changed = new ArrayList<>();
        db.edit("bookings", all -> {
            Map<String, Map<String, Object>> byId = new HashMap<>();
            all.forEach(b -> byId.put(Maps.str(b, "id"), b));
            for (Object o : changes) {
                Map<String, Object> c = Maps.map(o);
                Map<String, Object> b = c == null ? null : byId.get(Maps.str(c, "id"));
                if (b == null) continue;
                boolean owner = Maps.str(b, "userId").equals(Maps.str(user, "id"));
                if (!admin && !owner) continue;
                apply(b, c, admin);
                changed.add(b);
            }
        });
        return changed;
    }

    private void apply(Map<String, Object> b, Map<String, Object> c, boolean admin) {
        String before = Maps.str(b, "status");
        for (Map.Entry<String, Object> e : c.entrySet()) {
            String k = e.getKey();
            Object v = e.getValue();
            switch (k) {
                case "claims" -> {
                    Map<String, Object> cur = Maps.map(b.get("claims")), in = Maps.map(v);
                    if (in == null) break;
                    Map<String, Object> merged = cur == null ? new LinkedHashMap<>() : new LinkedHashMap<>(cur);
                    in.forEach((ck, cv) -> { if (ck.matches("[A-Za-z0-9_-]{1,20}") && !merged.containsKey(ck) && cv instanceof String s && Times.parse(s) != null) merged.put(ck, s); });
                    b.put("claims", merged);
                }
                case "payChoice" -> { if ("deposit".equals(v) || "full".equals(v)) b.put("payChoice", v); }
                case "status" -> {
                    if (!(v instanceof String s) || !STATUSES.contains(s) || s.equals(before)) break;
                    if (admin) {
                        b.put("status", s);
                    } else if ("cancelled".equals(s) && "pending".equals(before) && !Maps.bool(b, "depositPaid")) {
                        b.put("status", s);
                    }
                }
                case "adminNote" -> { if (admin && v instanceof String s) b.put("adminNote", s.length() > 1000 ? s.substring(0, 1000) : s); }
                case "overtimeHours" -> { if (admin) { double h = Pricing.num(v); if (h >= 0 && h <= 1000) b.put("overtimeHours", h); } }
                default -> {
                    if (!admin) break;
                    if (BOOL_FIELDS.contains(k) && v instanceof Boolean) b.put(k, v);
                    else if (ISO_FIELDS.contains(k) && (v == null || Times.parse(v) != null)) b.put(k, v);
                }
            }
        }
        String after = Maps.str(b, "status");
        if (!after.equals(before)) {
            if ("cancelled".equals(after)) doCancel(b);
            else if ("confirmed".equals(after))
                noti.add(Maps.str(b, "userId"), "booking", "✅ Đơn đã được xác nhận", "Đơn " + b.get("id") + " – " + b.get("tourName") + " đã được Travel xác nhận.", "profile", "confirm-" + b.get("id"));
        }
    }

    /** Sửa 1 đơn tại chỗ trong khóa của bookings.json (dùng cho thanh toán). */
    public void mutate(String id, java.util.function.Consumer<Map<String, Object>> change) {
        boolean[] hit = {false};
        db.edit("bookings", all -> {
            for (Map<String, Object> b : all) if (Maps.str(b, "id").equals(id)) { change.accept(b); hit[0] = true; }
        });
        if (!hit[0]) throw HttpError.notFound("Không tìm thấy đơn");
    }

    public int delete(List<?> ids) {
        Set<String> s = new HashSet<>();
        for (Object o : ids) s.add(String.valueOf(o));
        int[] n = {0};
        db.edit("bookings", all -> all.removeIf(b -> {
            boolean hit = s.contains(Maps.str(b, "id"));
            if (hit) { n[0]++; if (!"cancelled".equals(b.get("status"))) vouchers.release(Maps.str(b, "voucherCode"), Maps.str(b, "userId")); }
            return hit;
        }));
        return n[0];
    }
}
