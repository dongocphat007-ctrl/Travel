package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.*;
import vn.travel.util.Maps;

import java.util.List;
import java.util.Map;

/** Voucher, Booking, Notification (cần đăng nhập). Giữ nguyên đường dẫn/JSON mà frontend đang gọi. */
@RestController
public class CommerceController {
    private final CurrentUser current;
    private final Vouchers vouchers;
    private final Bookings bookings;
    private final Notifications noti;
    private final Accounts accounts;

    public CommerceController(CurrentUser current, Vouchers vouchers, Bookings bookings, Notifications noti, Accounts accounts) {
        this.current = current;
        this.vouchers = vouchers;
        this.bookings = bookings;
        this.noti = noti;
        this.accounts = accounts;
    }

    private static Map<String, Object> b(Map<String, Object> body) { return body == null ? Map.of() : body; }

    // ── Voucher ──
    @GetMapping({"/api/vouchers/mine", "/api/my-vouchers"})
    public Map<String, Object> myVouchers(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        vouchers.grantBirthday(u);
        return Maps.of("ok", true, "vouchers", vouchers.mine(Maps.str(u, "id")));
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
        return Maps.of("ok", true, "booking", bookings.create(current.require(req), b(body)));
    }

    @GetMapping("/api/bookings")
    public Map<String, Object> list(HttpServletRequest req) {
        return Maps.of("ok", true, "bookings", bookings.listFor(current.require(req)));
    }

    @GetMapping("/api/my-bookings")
    public Map<String, Object> mine(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        List<Map<String, Object>> own = bookings.listFor(u).stream().filter(x -> Maps.str(x, "userId").equals(Maps.str(u, "id"))).toList();
        return Maps.of("ok", true, "bookings", own);
    }

    @GetMapping("/api/bookings/{id}")
    public Map<String, Object> one(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", bookings.getFor(id, current.require(req)));
    }

    @PostMapping("/api/bookings/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", bookings.cancel(id, current.require(req)));
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
}
