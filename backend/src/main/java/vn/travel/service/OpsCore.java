package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.store.Db;
import vn.travel.util.*;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Consumer;

/**
 * Lõi nghiệp vụ dùng chung của các vai trò (CASHIER, OPERATOR, SUPPORT, CONTENT, GUIDE, ADMIN):
 *  • {@link #changeStatus} – NGUỒN DUY NHẤT đổi trạng thái đơn: tra bảng {@link Flow}, sai thứ tự / sai vai trò thì từ chối, ghi lịch sử (2.3, 2.4, 17.25)
 *  • tra cứu đơn / tour / HDV, tính lịch rảnh của HDV (5.2, 5.3, 5.11, 5.12)
 *  • {@link #view} – cắt dữ liệu đơn theo vai trò: mỗi vai trò chỉ thấy phần thông tin mình cần (9.8)
 *  • thông báo đúng người theo từng bước (10.1)
 */
@Service
@SuppressWarnings("unchecked")
public class OpsCore {
    /** Người thực hiện: id tài khoản, tên và vai trò (CASHIER, ADMIN... hoặc SYSTEM). */
    public record Actor(String id, String name, String role) {
        public static Actor of(Map<String, Object> account) {
            return new Actor(Maps.str(account, "id"), Maps.str(account, "name"), Role.from(account.get("role")).name());
        }

        public static Actor customer(Map<String, Object> account) {
            return new Actor(Maps.str(account, "id"), Maps.str(account, "name"), Flow.CUSTOMER);
        }

        public static Actor system() { return new Actor("", "Hệ thống", Flow.SYSTEM); }
    }

    public final Db db;
    public final Accounts accounts;
    public final TourCatalog tours;
    public final Notifications noti;
    public final SystemConfig config;
    public final Audit audit;
    public final Vouchers vouchers;
    public final Clock clock;

    public TourCatalog tours() { return tours; }

    public OpsCore(Db db, Accounts accounts, TourCatalog tours, Notifications noti, SystemConfig config, Audit audit, Vouchers vouchers, Clock clock) {
        this.db = db;
        this.accounts = accounts;
        this.tours = tours;
        this.noti = noti;
        this.config = config;
        this.audit = audit;
        this.vouchers = vouchers;
        this.clock = clock;
    }

    public long now() { return clock.millis(); }

    /** Quà / điểm / thù lao sau khi đơn completed (giai đoạn 7). */
    public Rewards rewards() { return new Rewards(this); }

    /** Gia hạn thêm ngày (giai đoạn 8). */
    public Extensions extensions() { return new Extensions(this); }

    public LocalDate today() { return Times.todayVN(clock.millis()); }

    // ───────────────────────── tra cứu ─────────────────────────
    public static boolean isTourBooking(Map<String, Object> b) {
        return !Maps.str(b, "tourId").isEmpty() && Maps.str(b, "kind").isEmpty();
    }

    /** Danh sách đơn tour (bỏ vé máy bay / khách sạn), chuẩn hóa trạng thái cũ. */
    public List<Map<String, Object>> bookings() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : db.list("bookings")) if (isTourBooking(b)) out.add(b);
        return out;
    }

    public Map<String, Object> find(String id) {
        for (Map<String, Object> b : db.list("bookings")) if (isTourBooking(b) && Maps.str(b, "id").equals(id)) return b;
        return null;
    }

    public Map<String, Object> require(String id) {
        Map<String, Object> b = find(id);
        if (b == null) throw HttpError.notFound("Không tìm thấy đơn");
        return b;
    }

    /** Sửa một đơn trong khóa ghi bookings.json; ném HttpError trong {@code fn} thì không ghi gì. Trả bản đã sửa. */
    public Map<String, Object> edit(String id, Consumer<Map<String, Object>> fn) {
        Map<String, Object>[] out = new Map[1];
        db.edit("bookings", all -> {
            for (Map<String, Object> b : all) {
                if (isTourBooking(b) && Maps.str(b, "id").equals(id)) {
                    fn.accept(b);
                    out[0] = b;
                    return;
                }
            }
            throw HttpError.notFound("Không tìm thấy đơn");
        });
        return out[0];
    }

    public Map<String, Object> tourOf(Map<String, Object> b) {
        return tours.find(b.get("tourId"));
    }

    public int daysOf(Map<String, Object> b) {
        return Math.max(1, Guides.tourDays(b)) + (int) Maps.lng(b, "extraDays");
    }

    /** Ngày cuối của tour (kể cả ngày gia hạn). */
    public LocalDate endDate(Map<String, Object> b) {
        LocalDate s = GuideAvailability.parse(b.get("date"));
        return s == null ? null : s.plusDays(daysOf(b) - 1L);
    }

    public String regionOf(Map<String, Object> b) {
        String r = Maps.str(b, "tourRegion");
        if (!r.isEmpty()) return r;
        Map<String, Object> t = tourOf(b);
        return t == null ? "" : Maps.str(t, "region");
    }

    /** "domestic" | "international": tour nước ngoài chỉ gán HDV quốc tế (5.12). */
    public String tourGuideType(Map<String, Object> b) {
        Map<String, Object> t = tourOf(b);
        String g = t == null ? "" : Maps.str(t, "guideType");
        if (g.equals("domestic") || g.equals("international")) return g;
        String bt = Maps.str(b, "tourGuideType");
        if (!bt.isEmpty()) return bt;
        return "Quốc tế".equals(regionOf(b)) ? "international" : "domestic";
    }

    /** Tour có cần HDV của công ty không (tour tự túc không thuê HDV thì không gán). */
    public boolean needsGuide(Map<String, Object> b) {
        return !"self".equals(Maps.str(b, "guideType")) || (Maps.map(b.get("guideHire")) != null && Maps.bool(Maps.map(b.get("guideHire")), "enabled"));
    }

    // ───────────────────────── hướng dẫn viên ─────────────────────────
    public List<Map<String, Object>> guideProfiles() { return db.list("guides"); }

    /** Đưa id tài khoản (hdv001) hoặc id hồ sơ (g_hn01) về id hồ sơ HDV. */
    public String canonGuide(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        for (Map<String, Object> g : guideProfiles()) if (raw.equals(Maps.str(g, "id"))) return raw;
        Map<String, Object> a = accounts.byId(raw);
        if (a != null && !Maps.str(a, "guideId").isEmpty()) return Maps.str(a, "guideId");
        return raw;
    }

    public Map<String, Object> guide(String raw) {
        String id = canonGuide(raw);
        for (Map<String, Object> g : guideProfiles()) if (id.equals(Maps.str(g, "id"))) return g;
        return null;
    }

    public static String guideTypeOf(Map<String, Object> g) {
        String t = Maps.str(g, "guideType");
        if (t.equals("domestic") || t.equals("international")) return t;
        return Maps.str(g, "title").toLowerCase().contains("quốc tế") ? "international" : "domestic";
    }

    public static boolean isStaffGuide(Map<String, Object> g) {
        return !"freelance".equals(Maps.str(g, "employmentType"));
    }

    /** Ngày nghỉ bắt buộc sau tour (chỉ HDV chính thức, 5.3 + 5.11). */
    public int restAfter(Map<String, Object> g, int tourDays) {
        return isStaffGuide(g) ? config.restDaysFor(tourDays) : 0;
    }

    /** Các ngày HDV không nhận được việc: lịch bận trong hồ sơ + ngày của các đơn khác + ngày nghỉ sau mỗi tour (chỉ HDV chính thức). */
    public Set<String> blockedDays(Map<String, Object> g, String excludeBookingId) {
        return blockedDays(g, excludeBookingId, bookings());
    }

    /** Như trên nhưng dùng danh sách đơn đã đọc sẵn (gọi cho nhiều HDV liên tiếp thì chỉ đọc đơn một lần). */
    public Set<String> blockedDays(Map<String, Object> g, String excludeBookingId, List<Map<String, Object>> allBookings) {
        Set<String> blocked = new TreeSet<>();
        for (Object d : Maps.list(g.get("busyDates"))) blocked.add(String.valueOf(d));
        String gid = Maps.str(g, "id");
        for (Map<String, Object> b : allBookings) {
            if (Maps.str(b, "id").equals(excludeBookingId) || Flow.inactive(b.get("status"))) continue;
            if (!gid.equals(canonGuide(Maps.str(b, "guideId")))) continue;
            int n = daysOf(b) + Extensions.reservedDays(b);   // 8.8: ngày gia hạn đã duyệt/chờ thanh toán cũng giữ lịch HDV
            List<String> days = GuideAvailability.rangeDays(b.get("date"), n);
            blocked.addAll(days);
            int rest = restAfter(g, n);
            if (!days.isEmpty() && rest > 0) {
                LocalDate last = LocalDate.parse(days.get(days.size() - 1));
                for (int i = 1; i <= rest; i++) blocked.add(last.plusDays(i).toString());
            }
        }
        return blocked;
    }

    /** Lý do HDV KHÔNG nhận được tour {@code nDays} ngày từ {@code start} (rỗng = rảnh). Tính cả ngày nghỉ sau tour này. */
    public List<String> guideConflicts(Map<String, Object> g, String excludeBookingId, String start, int nDays) {
        return guideConflicts(g, excludeBookingId, start, nDays, null);
    }

    /** {@code allBookings} = null thì tự đọc; truyền vào khi duyệt nhiều HDV để tránh đọc lại file đơn cho từng người. */
    public List<String> guideConflicts(Map<String, Object> g, String excludeBookingId, String start, int nDays, List<Map<String, Object>> allBookings) {
        List<String> out = new ArrayList<>();
        if ("off".equals(g.get("status"))) { out.add("Đang tạm nghỉ"); return out; }
        Set<String> blocked = blockedDays(g, excludeBookingId, allBookings == null ? bookings() : allBookings);
        List<String> days = new ArrayList<>(GuideAvailability.rangeDays(start, nDays));
        if (days.isEmpty()) { out.add("Ngày đi không hợp lệ"); return out; }
        int rest = restAfter(g, nDays);
        LocalDate last = LocalDate.parse(days.get(days.size() - 1));
        List<String> clash = new ArrayList<>();
        for (String d : days) if (blocked.contains(d)) clash.add(d);
        if (!clash.isEmpty()) out.add("Bận: " + String.join(", ", clash));
        List<String> restClash = new ArrayList<>();
        for (int i = 1; i <= rest; i++) if (blocked.contains(last.plusDays(i).toString())) restClash.add(last.plusDays(i).toString());
        if (!restClash.isEmpty()) out.add("Không đủ ngày nghỉ sau tour (vướng " + String.join(", ", restClash) + ")");
        return out;
    }

    /** Loại HDV, khu vực có phù hợp với tour không (5.5, 5.12). Trả lý do không phù hợp hoặc rỗng. */
    public String fitProblem(Map<String, Object> g, Map<String, Object> booking) {
        String tg = tourGuideType(booking), gt = guideTypeOf(g);
        if ("international".equals(tg) && !"international".equals(gt)) return "Tour nước ngoài chỉ gán HDV quốc tế";
        if ("domestic".equals(tg) && "international".equals(gt) && !Maps.bool(g, "allowDomestic")) return "HDV quốc tế chưa được phép dẫn tour trong nước";
        String region = regionOf(booking);
        List<Object> regions = Maps.list(g.get("regions"));
        if (!region.isEmpty() && !regions.isEmpty() && !regions.contains(region)) return "Không phụ trách " + region;
        return "";
    }

    /** Số tour HDV đã nhận trong tháng của ngày đi (ưu tiên người ít việc, 5.5). */
    public int workload(String guideId, String monthPrefix) {
        return workload(guideId, monthPrefix, bookings());
    }

    public int workload(String guideId, String monthPrefix, List<Map<String, Object>> allBookings) {
        int n = 0;
        for (Map<String, Object> b : allBookings)
            if (guideId.equals(canonGuide(Maps.str(b, "guideId"))) && Flow.active(b.get("status")) && Maps.str(b, "date").startsWith(monthPrefix)) n++;
        return n;
    }

    // ───────────────────────── đổi trạng thái ─────────────────────────
    /**
     * Đổi trạng thái một đơn (gọi TRONG {@link #edit}). Sai thứ tự (không có trong bảng) → 409; đúng thứ tự nhưng sai vai trò → 403.
     * Mỗi lần đổi ghi một dòng lịch sử: ai, vai trò gì, lúc nào, từ → sang, ghi chú.
     */
    public void changeStatus(Map<String, Object> b, String to, Actor actor, String note) {
        applyStatus(b, to, actor, note, now());
    }

    /** Lõi đổi trạng thái (tra bảng {@link Flow}, ghi lịch sử). Dùng chung cho mọi service để không có đường tắt bỏ qua bảng chuyển trạng thái. */
    public static void applyStatus(Map<String, Object> b, String to, Actor actor, String note, long nowMillis) {
        String from = Flow.norm(b.get("status"));
        if (!Flow.known(to)) throw HttpError.bad("Trạng thái không hợp lệ: " + to);
        if (!Flow.valid(from, to))
            throw HttpError.conflict("Không thể chuyển đơn từ \"" + Flow.label(from) + "\" sang \"" + Flow.label(to) + "\"", "status");
        if (!Flow.allowed(from, to, actor.role())) throw HttpError.forbidden();
        b.put("status", to);
        b.put("statusAt", Times.iso(nowMillis));
        if (Flow.CONFIRMED.equals(to)) {
            b.putIfAbsent("confirmedAt", Times.iso(nowMillis));
        }
        Flow.addHistory(b, "status", from, to, actor.id(), actor.name(), actor.role(), note, nowMillis);
    }

    /** Ghi lịch sử không đổi trạng thái (gán HDV, thu nốt, ghi chú...). */
    public void note(Map<String, Object> b, String action, Actor actor, String text) {
        String s = Flow.norm(b.get("status"));
        Flow.addHistory(b, action, s, s, actor.id(), actor.name(), actor.role(), text, now());
    }

    // ───────────────────────── thông báo ─────────────────────────
    public void notifyUser(String userId, String title, String body, String link, String key) {
        noti.add(userId, "ops", title, body, link, key);
    }

    /** Gửi cho mọi tài khoản đang hoạt động của các vai trò; key != null thì mỗi người chỉ nhận một lần (10.1). */
    public void notifyRoles(String title, String body, String link, String key, Role... roles) {
        Set<Role> want = new HashSet<>(Arrays.asList(roles));
        for (Map<String, Object> a : accounts.all()) {
            if (!Accounts.isActive(a) || !want.contains(Role.from(a.get("role")))) continue;
            noti.add(Maps.str(a, "id"), "ops", title, body, link, key);
        }
    }

    // ───────────────────────── tiền ─────────────────────────
    public static long paid(Map<String, Object> b) { return Flow.paidIn(b); }

    public static long remaining(Map<String, Object> b) { return Math.max(0, Maps.lng(b, "price") - Flow.paidIn(b)); }

    /** Số tiền hoàn theo bảng hoàn tiền khi KHÁCH hủy (8.1): % × số tiền đã nhận, theo số ngày từ hôm nay đến ngày đi. */
    public long customerRefund(Map<String, Object> b) {
        long paidNet = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
        LocalDate d = GuideAvailability.parse(b.get("date"));
        long days = d == null ? 0 : java.time.temporal.ChronoUnit.DAYS.between(today(), d);
        return Math.round(paidNet * config.refundPct(Math.max(0, days)) / 100.0);
    }

    // ───────────────────────── cắt dữ liệu theo vai trò ─────────────────────────
    private static final List<String> COMMON = List.of("id", "payCode", "tourId", "tourName", "tourDest", "tourDays", "tourDuration", "date", "pax", "adults",
            "children", "infants", "status", "statusAt", "createdAt", "guideId", "guideName", "tourRegion", "tourGuideType", "noShow", "extraDays", "balanceDueDate",
            "balanceOverdue", "needsAttention", "guideChosen", "guideIssue", "cancelledAt", "refundId", "extensions", "extended", "companyOffer", "reschedule", "priceDiffRescheduled");
    private static final List<String> MONEY = List.of("price", "deposit", "depositPercent", "payChoice", "claims", "payments", "depositPaid", "fullPaid", "finalPaid",
            "voucherCode", "priceBreakdown", "depositPaidAt", "finalPaidAt", "overtimeHours");
    private static final List<String> CONTACT = List.of("customerName", "phone", "email");
    private static final List<String> TRIP = List.of("note", "specialRequest", "pickup", "itinerary", "tourHighlight", "checkin", "tourReport");

    /** Phần đơn mà vai trò {@code role} được xem. CUSTOMER không dùng hàm này (khách xem đơn của mình ở /api/bookings). */
    public Map<String, Object> view(Map<String, Object> b, Role role) {
        Map<String, Object> o = new LinkedHashMap<>();
        copy(b, o, COMMON);
        o.put("status", Flow.norm(b.get("status")));
        o.put("statusLabel", Flow.label(Flow.norm(b.get("status"))));
        o.put("paidAmount", Flow.paidIn(b));
        o.put("remaining", remaining(b));
        o.put("fullyPaid", Flow.fullyPaid(b));
        if (Maps.str(b, "guideName").isEmpty() && !Maps.str(b, "guideId").isEmpty()) {
            Map<String, Object> g = guide(Maps.str(b, "guideId"));
            if (g != null) o.put("guideName", g.get("name"));
        }
        String canonG = canonGuide(Maps.str(b, "guideId"));
        o.put("guideId", canonG.isEmpty() ? null : canonG);
        Map<String, Object> as = Maps.map(b.get("assignment"));
        if (as != null) o.put("assignment", Maps.of("guideId", as.get("guideId"), "status", as.get("status"), "assignedAt", as.get("assignedAt"),
                "assignedBy", as.get("assignedBy"), "deadline", as.get("deadline"), "rejectReason", as.get("rejectReason"), "rejected", as.get("rejected")));
        switch (role) {
            case ADMIN -> {
                copy(b, o, MONEY);
                copy(b, o, CONTACT);
                copy(b, o, TRIP);
                copy(b, o, List.of("adminNote", "snapshot", "refund"));
                o.put("passengers", passengers(b, false));
                o.put("history", b.get("history") == null ? List.of() : b.get("history"));
            }
            case CASHIER -> {
                copy(b, o, MONEY);
                o.put("customerName", b.get("customerName"));
                o.put("email", b.get("email"));
                o.put("history", b.get("history") == null ? List.of() : b.get("history"));
            }
            case OPERATOR -> {
                copy(b, o, CONTACT);
                copy(b, o, TRIP);
                o.put("passengers", passengers(b, false));
                o.put("history", b.get("history") == null ? List.of() : b.get("history"));
            }
            case SUPPORT -> {
                copy(b, o, MONEY);
                copy(b, o, CONTACT);
                copy(b, o, List.of("note", "specialRequest", "pickup"));
                o.put("passengers", passengers(b, true));
                o.put("history", b.get("history") == null ? List.of() : b.get("history"));
            }
            case GUIDE -> {
                copy(b, o, List.of("customerName", "phone"));
                copy(b, o, TRIP);
                o.put("passengers", passengers(b, false));
            }
            default -> { /* CONTENT, CUSTOMER: không có quyền xem đơn qua API vận hành */ }
        }
        return o;
    }

    private static void copy(Map<String, Object> from, Map<String, Object> to, List<String> keys) {
        for (String k : keys) if (from.containsKey(k)) to.put(k, from.get(k));
    }

    /** Danh sách hành khách; {@code masked} = che bớt CCCD/hộ chiếu (chỉ giữ 3 ký tự cuối). */
    public static List<Map<String, Object>> passengers(Map<String, Object> b, boolean masked) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : Maps.list(b.get("passengers"))) {
            Map<String, Object> p = Maps.map(o);
            if (p == null) continue;
            Map<String, Object> c = new LinkedHashMap<>(p);
            if (masked) c.put("idNumber", mask(Maps.str(p, "idNumber")));
            out.add(c);
        }
        return out;
    }

    public static String mask(String id) {
        if (id == null || id.isEmpty()) return "";
        if (id.length() <= 3) return "***";
        return "*".repeat(id.length() - 3) + id.substring(id.length() - 3);
    }

    /** Lịch sử cho KHÁCH xem (timeline "Đơn của tôi"): không lộ mã nhân viên, chỉ nội dung dễ hiểu (2.5). */
    public List<Map<String, Object>> customerTimeline(Map<String, Object> b) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : Maps.list(b.get("history"))) {
            Map<String, Object> h = Maps.map(o);
            if (h == null) continue;
            String to = Maps.str(h, "to"), from = Maps.str(h, "from");
            if (!"status".equals(h.get("action")) && !"create".equals(h.get("action")) && !"payment".equals(h.get("action"))) continue;
            if (!"create".equals(h.get("action")) && to.equals(from) && !"payment".equals(h.get("action"))) continue;
            out.add(Maps.of("at", h.get("at"), "status", to, "label", Flow.label(to), "action", h.get("action")));
        }
        return out;
    }

    /** Sức chứa hiệu lực của một chuyến: Điều hành có thể đặt riêng ở departures.json; chuyến đóng/hủy = 0 chỗ. */
    public int depCapacity(Map<String, Object> tour, Object tourId, Object date) {
        String key = vn.travel.util.Capacity.depKey(tourId, date);
        for (Map<String, Object> d : db.list("departures"))
            if (key.equals(Maps.str(d, "id")) && ("closed".equals(d.get("status")) || "cancelled".equals(d.get("status")))) return 0;
        return depCapacityRaw(tour, tourId, date);
    }

    /** Sức chứa đã đặt cho chuyến (Điều hành chỉnh hoặc mặc định), KHÔNG tính việc chuyến đang đóng/hủy – để hiển thị cho điều hành. */
    public int depCapacityRaw(Map<String, Object> tour, Object tourId, Object date) {
        int cap = vn.travel.util.Capacity.maxGuests(tour, config.i("departure", "defaultCapacity"));
        String key = vn.travel.util.Capacity.depKey(tourId, date);
        for (Map<String, Object> d : db.list("departures"))
            if (key.equals(Maps.str(d, "id")) && Maps.lng(d, "capacity") > 0) cap = (int) Maps.lng(d, "capacity");
        return cap;
    }

    /**
     * 9.1: tình trạng chỗ của một chuyến khởi hành — sức chứa, đã đặt, còn lại và trạng thái:
     * {@code open} (còn chỗ) · {@code full} (hết chỗ) · {@code closed} (Điều hành đóng đặt chỗ) · {@code cancelled} (công ty hủy chuyến).
     * Đếm đúng như lúc đặt chỗ ({@code Bookings.checkSeats}): mọi đơn còn hiệu lực giữ chỗ, kể cả đơn chờ thanh toán. Trả null nếu không có tour.
     */
    public Map<String, Object> seatInfo(String tourId, String date) {
        Map<String, Object> tour = tours.find(tourId);
        if (tour == null) return null;
        int cap = vn.travel.util.Capacity.maxGuests(tour, config.i("departure", "defaultCapacity"));
        String key = vn.travel.util.Capacity.depKey(tour.get("id"), date), state = "open";
        for (Map<String, Object> d : db.list("departures")) {
            if (!key.equals(Maps.str(d, "id"))) continue;
            if (Maps.lng(d, "capacity") > 0) cap = (int) Maps.lng(d, "capacity");
            if ("closed".equals(d.get("status")) || "cancelled".equals(d.get("status"))) state = Maps.str(d, "status");
        }
        int booked = 0;
        for (Map<String, Object> b : bookings())
            if (Maps.str(b, "tourId").equals(String.valueOf(tour.get("id"))) && date.equals(Maps.str(b, "date")) && Flow.active(b.get("status"))) booked += (int) Maps.lng(b, "pax");
        int left = "open".equals(state) ? Math.max(0, cap - booked) : 0;
        if ("open".equals(state) && left == 0) state = "full";
        return Maps.of("tourId", String.valueOf(tour.get("id")), "date", date, "status", state, "capacity", cap, "booked", booked, "left", left);
    }

    /** Đơn dưới góc nhìn của KHÁCH: bỏ ghi chú nội bộ, mã nhân viên, sổ thanh toán chi tiết; thay lịch sử bằng timeline dễ hiểu (2.5, 17.22). */
    public Map<String, Object> customerView(Map<String, Object> b) {
        Map<String, Object> o = new LinkedHashMap<>(b);
        for (String k : List.of("adminNote", "history", "assignment", "payments", "releasedGuideId", "cancelledBy", "needsAttention", "refundId", "snapshotInternal", "guideIssue")) o.remove(k);
        String st = Flow.norm(b.get("status"));
        o.put("status", st);
        o.put("statusLabel", Flow.label(st));
        o.put("timeline", customerTimeline(b));
        if (b.get("passengers") != null) o.put("passengers", passengers(b, true));   // 9.8: màn hình khách cũng che bớt CCCD/hộ chiếu (máy dùng chung, chụp màn hình)
        o.put("paidAmount", Flow.paidIn(b));
        o.put("refundedAmount", Flow.refundedOut(b));
        o.put("remaining", remaining(b));
        o.put("canCancel", Set.of(Flow.PENDING_PAYMENT, Flow.PAID_DEPOSIT, Flow.PAID_FULL, Flow.CONFIRMED, Flow.GUIDE_PENDING, Flow.GUIDE_ACCEPTED).contains(st));
        o.put("refundPreview", customerRefund(b));
        String rid = Maps.str(b, "refundId");
        if (!rid.isEmpty()) for (Map<String, Object> r : db.list("refunds"))
            if (rid.equals(Maps.str(r, "id"))) o.put("refund", Maps.of("amount", r.get("amount"), "status", r.get("status")));
        if (Maps.str(b, "guideName").isEmpty() && !Maps.str(b, "guideId").isEmpty()) { Map<String, Object> g = guide(Maps.str(b, "guideId")); if (g != null) o.put("guideName", g.get("name")); }
        // chỉ cho khách thấy HDV khi HDV đã nhận tour
        if (!Flow.GUIDE_ACCEPTED.equals(st) && !Flow.IN_PROGRESS.equals(st) && !Flow.COMPLETED.equals(st)) { o.remove("guideId"); o.remove("guideName"); }
        return o;
    }
}
