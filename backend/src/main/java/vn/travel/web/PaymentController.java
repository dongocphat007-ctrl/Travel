package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.Payments;
import vn.travel.util.Maps;

import java.util.Map;

/** Thanh toán chuyển khoản: cấu hình/QR cho khách, webhook ngân hàng (có xác thực), xác nhận tay + thống kê cho Admin. */
@RestController
public class PaymentController {
    private final Payments payments;
    private final CurrentUser current;

    public PaymentController(Payments payments, CurrentUser current) {
        this.payments = payments;
        this.current = current;
    }

    @GetMapping("/api/payments/config")
    public Map<String, Object> config() {
        return payments.publicConfig();
    }

    @GetMapping("/api/payments/info/{bookingId}")
    public Map<String, Object> info(@PathVariable String bookingId, HttpServletRequest req) {
        return payments.info(bookingId, current.require(req));
    }

    /** SePay/Casso/PayOS gọi vào đây. Thành công trả {"success":true} (SePay cần mã 2xx + success để không gửi lại). */
    @PostMapping("/api/payments/webhook")
    public Map<String, Object> webhook(@RequestBody(required = false) Map<String, Object> body,
                                       @RequestHeader(value = "Authorization", required = false) String auth,
                                       @RequestHeader(value = "X-Webhook-Secret", required = false) String secret) {
        payments.authenticate(auth, secret);
        Map<String, Object> r = payments.webhook(body == null ? Map.of() : body);
        Map<String, Object> out = Maps.of("success", true, "ok", true);
        Map<String, Object> p = Maps.map(r.get("payment"));
        if (p != null) out.put("status", p.get("status"));
        if (r.get("duplicate") != null) out.put("duplicate", true);
        return out;
    }

    @PostMapping("/api/admin/payments/manual")
    public Map<String, Object> manual(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> admin = current.requireAdmin(req);
        return Maps.of("ok", true, "payment", payments.manual(admin, body == null ? Map.of() : body));
    }

    @GetMapping("/api/admin/payments")
    public Map<String, Object> list(HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "payments", payments.list());
    }

    @GetMapping("/api/admin/payments/stats")
    public Map<String, Object> stats(HttpServletRequest req) {
        current.requireAdmin(req);
        return payments.stats();
    }
}
