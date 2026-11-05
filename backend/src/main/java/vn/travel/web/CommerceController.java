package vn.travel.web;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import vn.travel.security.Permission;
import vn.travel.service.Accounts;
import vn.travel.service.Bookings;
import vn.travel.service.Notifications;
import vn.travel.service.OpsCore;
import vn.travel.service.Vouchers;
import vn.travel.util.Maps;

/** Voucher, Booking, Notification (cần đăng nhập). Giữ nguyên đường dẫn/JSON mà frontend đang gọi. */
@RestController
public class CommerceController {
    private final CurrentUser current;
    private final Vouchers vouchers;
    private final Bookings bookings;
    private final Notifications noti;
    private final Accounts accounts;
    private final OpsCore core;

    public CommerceController(CurrentUser current, Vouchers vouchers, Bookings bookings, Notifications noti, Accounts accounts, OpsCore core) {
        this.core = core;
        this.current = current;
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.noti = noti;
        this.accounts = accounts;
    }

    private static Map<String, Object> b(Map<String, Object> body) { return body == null ? Map.of() : body; }

    /** Khách: luôn dùng bản đã cắt dữ liệu nội bộ. Admin xem danh sách quản trị (bản đầy đủ) khi gọi /api/bookings. */
    private List<Map<String, Object>> shape(Map<String, Object> adminOrNull, List<Map<String, Object>> in) {
        if (adminOrNull != null && accounts.isAdmin(adminOrNull)) return in;
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (Map<String, Object> x : in) out.add(OpsCore.isTourBooking(x) ? core.customerView(x) : x);
        return out;
    }

    // ── Voucher ──
    @GetMapping({"/api/vouchers/mine", "/api/my-vouchers"})
    public Map<String, Object> myVouchers(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        vouchers.grantBirthday(u);
        return Maps.of("ok", true, "vouchers", vouchers.mine(Maps.str(u, "id")));
    }

    /** 7.10: điểm tích lũy và đổi điểm lấy voucher. */
    @GetMapping("/api/points")
    public Map<String, Object> points(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        return Maps.of("ok", true, "points", core.rewards().points(Maps.str(u, "id")), "pointValue", vn.travel.service.Rewards.POINT_VALUE, "minRedeem", vn.travel.service.Rewards.MIN_REDEEM);
    }

    @PostMapping("/api/points/redeem")
    public Map<String, Object> redeem(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> in = body == null ? new java.util.HashMap<>() : body;
        return core.rewards().redeem(Maps.str(u, "id"), Maps.lng(in, "points"));
    }

    @PostMapping("/api/vouchers/validate")
    public Map<String, Object> validate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        String tourId = body == null || body.get("tourId") == null ? null : String.valueOf(body.get("tourId"));
        return Maps.of("ok", true, "voucher", vouchers.validate(Maps.str(b(body), "code"), tourId, Maps.str(u, "id")));
    }

    // ── Booking ──
    @PostMapping("/api/bookings")
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.BOOKING_CREATE);   // nhân viên không đặt tour
        return Maps.of("ok", true, "booking", core.customerView(bookings.create(u, b(body))));
    }

    @GetMapping("/api/bookings")
    public Map<String, Object> list(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        return Maps.of("ok", true, "bookings", shape(u, bookings.listFor(u)));
    }

    @GetMapping("/api/my-bookings")
    public Map<String, Object> mine(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        List<Map<String, Object>> own = bookings.listFor(u).stream().filter(x -> Maps.str(x, "userId").equals(Maps.str(u, "id"))).toList();
        return Maps.of("ok", true, "bookings", shape(null, own));
    }

    @GetMapping("/api/bookings/{id}")
    public Map<String, Object> one(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> b = bookings.getFor(id, u);
        return Maps.of("ok", true, "booking", accounts.isAdmin(u) && !Maps.str(b, "userId").equals(Maps.str(u, "id")) ? b : core.customerView(b));
    }

    @PostMapping("/api/bookings/sync")
    public Map<String, Object> sync(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        List<?> changes = b(body).get("bookings") instanceof List<?> l ? l : List.of();
        if (changes.size() > 200) throw HttpError.bad("Quá nhiều thay đổi trong một lần gửi");
        return Maps.of("ok", true, "bookings", bookings.sync(current.require(req), changes));
    }

    @PostMapping("/api/bookings/delete")
    public Map<String, Object> delete(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        List<?> ids = b(body).get("ids") instanceof List<?> l ? l : List.of();
        return Maps.of("ok", true, "deleted", bookings.delete(ids));
    }

    // ── Notification ──
    @GetMapping("/api/notifications")
    public Map<String, Object> notifications(HttpServletRequest req) {
        return noti.list(Maps.str(current.require(req), "id"));
    }

    @PostMapping("/api/notifications/read")
    public Map<String, Object> read(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        noti.markRead(Maps.str(current.require(req), "id"), b(body).get("ids") instanceof List<?> l ? l : null);
        return Maps.of("ok", true);
    }

    @PostMapping("/api/notifications/delete")
    public Map<String, Object> deleteNoti(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        noti.delete(Maps.str(current.require(req), "id"), b(body).get("ids") instanceof List<?> l ? l : null);
        return Maps.of("ok", true);
    }

    @PostMapping("/api/notifications/customer")
    public Map<String, Object> notifyCustomer(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> actorMap = current.requirePermission(req, Permission.NOTIFICATION_CUSTOMER_SEND);
        OpsCore.Actor actor = Api.actor(actorMap);
        Map<String, Object> b = b(body);
        String title = Api.s(b, "title");
        String text = Api.s(b, "body");
        if (text.isEmpty()) text = Api.s(b, "text");
        String link = Api.s(b, "link");
        String target = Api.s(b, "target");
        String customerId = Api.s(b, "customerId");

        if (title.isEmpty()) throw HttpError.bad("Vui lòng nhập tiêu đề thông báo", "title");
        if (text.isEmpty()) throw HttpError.bad("Vui lòng nhập nội dung thông báo", "body");

        int count = 0;
        if (!customerId.isEmpty() || (!target.isEmpty() && !"all".equalsIgnoreCase(target))) {
            String uid = !customerId.isEmpty() ? customerId : target;
            Map<String, Object> c = accounts.byId(uid);
            if (c == null) throw HttpError.notFound("Không tìm thấy khách hàng");
            noti.add(uid, "announcement", "📢 " + title, text, link.isEmpty() ? "profile" : link, "cust-" + vn.travel.util.Ids.hex(4));
            count = 1;
        } else {
            for (Map<String, Object> a : accounts.all()) {
                if (vn.travel.security.Role.CUSTOMER.matches(a.get("role")) && Accounts.isActive(a)) {
                    String uid = Maps.str(a, "id");
                    noti.add(uid, "announcement", "📢 " + title, text, link.isEmpty() ? "profile" : link, "cust-all-" + vn.travel.util.Ids.hex(4));
                    count++;
                }
            }
        }
        core.audit.log(actor.id(), actor.name(), actor.role(), "notification.customer", !customerId.isEmpty() ? customerId : (target.isEmpty() ? "all" : target), title + " (" + count + " khách)");
        return Maps.of("ok", true, "count", count, "message", "Đã gửi thông báo tới " + count + " khách hàng.");
    }
}