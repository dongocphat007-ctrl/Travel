package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.service.CustomerOps;
import vn.travel.service.OpsCore;
import vn.travel.service.SupportOps;
import vn.travel.util.Maps;

import java.util.Map;

/** API Chăm sóc khách hàng: khiếu nại, đề xuất đền bù (ADMIN duyệt), danh sách chờ, chuyển khoản lệch (chỉ liên hệ khách), đổi ngày. CCCD luôn bị che. */
@RestController
public class SupportController {
    private final CurrentUser current;
    private final SupportOps support;
    private final CustomerOps customers;
    private final OpsCore core;

    public SupportController(CurrentUser current, SupportOps support, CustomerOps customers, OpsCore core) {
        this.current = current;
        this.support = support;
        this.customers = customers;
        this.core = core;
    }

    @GetMapping("/api/support/complaints")
    public Map<String, Object> complaints(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.COMPLAINT_PROCESS);
        return Maps.of("ok", true, "complaints", support.complaints(status));
    }

    @PostMapping("/api/support/complaints/{id}/take")
    public Map<String, Object> take(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_PROCESS);
        return Maps.of("ok", true, "complaint", support.take(Api.actor(u), id));
    }

    @PostMapping("/api/support/complaints/{id}/reply")
    public Map<String, Object> reply(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_PROCESS);
        return Maps.of("ok", true, "complaint", support.reply(Api.actor(u), id, Api.s(body, "text"), Boolean.TRUE.equals(Api.body(body).get("internal"))));
    }

    @PostMapping("/api/support/complaints/{id}/propose-refund")
    public Map<String, Object> proposeRefund(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_REFUND_PROPOSE);
        return Maps.of("ok", true, "refund", support.proposeRefund(Api.actor(u), id, Api.num(body, "amount"), Api.s(body, "reason")));
    }

    @PostMapping("/api/support/complaints/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_PROCESS);
        return Maps.of("ok", true, "complaint", support.resolve(Api.actor(u), id, Api.s(body, "note")));
    }

    @GetMapping("/api/support/bookings/{id}")
    public Map<String, Object> booking(@PathVariable String id, HttpServletRequest req) {
        current.requirePermission(req, Permission.PASSENGER_VIEW_MASKED);
        return Maps.of("ok", true, "booking", core.view(core.require(id), Role.SUPPORT));
    }

    @GetMapping("/api/support/waitlist")
    public Map<String, Object> waitlist(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.WAITLIST_MANAGE);
        return Maps.of("ok", true, "waitlist", support.waitlist(status));
    }

    @PostMapping("/api/support/waitlist/{id}")
    public Map<String, Object> waitlistAct(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.WAITLIST_MANAGE);
        return Maps.of("ok", true, "item", support.waitlistAct(Api.actor(u), id, Api.s(body, "action"), Api.s(body, "note")));
    }

    @GetMapping("/api/support/payment-issues")
    public Map<String, Object> paymentIssues(HttpServletRequest req) {
        current.requirePermission(req, Permission.SUPPORT_ASSIST_CUSTOMER);
        return Maps.of("ok", true, "issues", support.paymentIssues());
    }

    @PostMapping("/api/support/payment-issues/{id}/contact")
    public Map<String, Object> contact(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.SUPPORT_ASSIST_CUSTOMER);
        return support.contactPaymentIssue(Api.actor(u), id, Api.s(body, "note"));
    }

    @GetMapping("/api/support/reschedule")
    public Map<String, Object> reschedules(HttpServletRequest req) {
        current.requirePermission(req, Permission.SUPPORT_ASSIST_CUSTOMER);
        return Maps.of("ok", true, "requests", customers.rescheduleQueue(Role.SUPPORT));
    }

    @PostMapping("/api/support/reschedule/{id}")
    public Map<String, Object> decideReschedule(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.SUPPORT_ASSIST_CUSTOMER);
        return customers.decideReschedule(Api.actor(u), id, Boolean.TRUE.equals(Api.body(body).get("approve")), Api.s(body, "note"));
    }

    @GetMapping("/api/support/stats")
    public Map<String, Object> stats(HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_SUPPORT);
        return Maps.of("ok", true, "stats", support.stats());
    }
}
