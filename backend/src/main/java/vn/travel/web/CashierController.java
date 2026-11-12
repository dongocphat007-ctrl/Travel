package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.service.CashierOps;
import vn.travel.service.OpsCore;
import vn.travel.service.Refunds;
import vn.travel.security.Role;
import vn.travel.util.Maps;

import java.util.Map;

/** API Thu ngân. Mỗi endpoint kiểm quyền riêng: ADMIN không có PAYMENT_CONFIRM nên không xác nhận tiền được (tách người thu tiền và người duyệt đơn). */
@RestController
public class CashierController {
    private final CurrentUser current;
    private final CashierOps cashier;
    private final Refunds refunds;
    private final OpsCore core;

    public CashierController(CurrentUser current, CashierOps cashier, Refunds refunds, OpsCore core) {
        this.current = current;
        this.cashier = cashier;
        this.refunds = refunds;
        this.core = core;
    }

    @GetMapping("/api/cashier/queue")
    public Map<String, Object> queue(@RequestParam(required = false) String q, @RequestParam(required = false) String date, @RequestParam(required = false) String kind, HttpServletRequest req) {
        current.requirePermission(req, Permission.PAYMENT_VIEW);
        return cashier.queue(q, date, kind);
    }

    @GetMapping("/api/cashier/stats")
    public Map<String, Object> stats(@RequestParam(required = false) String date, HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_CASHIER);
        return Maps.of("ok", true, "stats", cashier.dayStats(date));
    }

    @GetMapping("/api/cashier/daily-stats")
    public Map<String, Object> dailyStats(@RequestParam(required = false) String date, HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_CASHIER);
        return Maps.of("ok", true, "stats", cashier.dayStats(date));
    }

    @PostMapping("/api/cashier/daily-revenue")
    public Map<String, Object> addDailyRevenue(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.RECONCILE_CREATE);
        return Maps.of("ok", true, "revenue", cashier.addDailyRevenue(Api.actor(u), Api.body(body)));
    }

    @PostMapping("/api/cashier/daily-revenue/import")
    public Map<String, Object> importDailyRevenue(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        throw new HttpError(403, "Thu ngân chỉ được phép xuất file báo cáo, không được phép nhập file từ ngoài vào. Quyền nhập file chỉ dành cho Admin.");
    }

    /** Thù lao HDV: danh sách chờ chi (gom theo HDV) + đã chi. */
    @GetMapping("/api/cashier/guide-fees")
    public Map<String, Object> guideFees(HttpServletRequest req) {
        current.requirePermission(req, Permission.GUIDE_FEE_PAY);
        return cashier.guideFees();
    }

    @PostMapping("/api/cashier/guide-fees/pay")
    public Map<String, Object> payGuideFees(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.GUIDE_FEE_PAY);
        return cashier.payGuideFees(Api.actor(u), Api.body(body).get("ids") instanceof java.util.List<?> l ? l : java.util.List.of());
    }

    @GetMapping("/api/cashier/bookings/{id}")
    public Map<String, Object> booking(@PathVariable String id, HttpServletRequest req) {
        current.requirePermission(req, Permission.PAYMENT_VIEW);
        return Maps.of("ok", true, "booking", core.view(core.require(id), Role.CASHIER));
    }

    @PostMapping("/api/cashier/bookings/{id}/confirm")
    public Map<String, Object> confirm(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_CONFIRM);
        return Maps.of("ok", true, "booking", cashier.confirm(Api.actor(u), id, Api.s(body, "kind"), Api.num(body, "amount"), Api.s(body, "note")));
    }

    /** 8.10: tiền gia hạn thu riêng theo mã TRAVEL<số>-EXT<n>. */
    @GetMapping("/api/cashier/extensions")
    public Map<String, Object> extensions(HttpServletRequest req) {
        current.requirePermission(req, Permission.PAYMENT_VIEW);
        return Maps.of("ok", true, "items", core.extensions().awaitingPayment());
    }

    @PostMapping("/api/cashier/extensions/{id}/{no}/confirm")
    public Map<String, Object> confirmExtension(@PathVariable String id, @PathVariable int no, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_CONFIRM);
        return core.extensions().confirmPayment(Api.actor(u), id, no, Api.num(body, "amount"), Api.s(body, "note"));
    }

    @PostMapping("/api/cashier/bookings/{id}/discrepancy")
    public Map<String, Object> discrepancy(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_RESOLVE_DISCREPANCY);
        return Maps.of("ok", true, "payment", cashier.flagDiscrepancy(Api.actor(u), id, Api.num(body, "amount"), Api.s(body, "problem"), Api.s(body, "note"), Boolean.TRUE.equals(Api.body(body).get("handoff"))));
    }

    @PostMapping("/api/cashier/payments/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_RESOLVE_DISCREPANCY);
        return Maps.of("ok", true, "payment", cashier.resolveDiscrepancy(Api.actor(u), id, Api.s(body, "action"), Api.s(body, "note")));
    }

    @PostMapping("/api/cashier/payments/{id}/attach")
    public Map<String, Object> attach(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_RESOLVE_DISCREPANCY);
        cashier.attachToBooking(Api.actor(u), id, Api.s(body, "bookingId"));
        return Maps.of("ok", true);
    }

    @PostMapping("/api/cashier/bookings/{id}/undo")
    public Map<String, Object> undo(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_CONFIRM);
        return Maps.of("ok", true, "booking", cashier.undo(Api.actor(u), id, Api.s(body, "paymentId"), Api.s(body, "reason")));
    }

    @GetMapping("/api/cashier/refunds")
    public Map<String, Object> refundList(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.PAYMENT_REFUND);
        return Maps.of("ok", true, "refunds", refunds.list(status));
    }

    @PostMapping("/api/cashier/refunds/{id}/pay")
    public Map<String, Object> payRefund(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_REFUND);
        return Maps.of("ok", true, "refund", refunds.pay(Api.actor(u), id, Api.s(body, "note")));
    }

    @GetMapping("/api/cashier/reconcile")
    public Map<String, Object> reconcileList(@RequestParam(required = false) String date, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.RECONCILE_CREATE);
        String d = date == null || date.isEmpty() ? core.today().toString() : date;
        return Maps.of("ok", true, "today", cashier.dayTotals(d), "reconciliations", cashier.reconciliations(Maps.str(u, "id")));
    }

    @PostMapping("/api/cashier/reconcile")
    public Map<String, Object> reconcileCreate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.RECONCILE_CREATE);
        return Maps.of("ok", true, "reconciliation", cashier.reconcileCreate(Api.actor(u), Api.s(body, "date"), Api.num(body, "bankStatementTotal"), Api.s(body, "note")));
    }
}
