package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.service.CustomerOps;
import vn.travel.service.OperatorOps;
import vn.travel.service.OpsCore;
import vn.travel.util.Maps;

import java.util.Map;

/** API Điều hành tour (ADMIN làm thay được vì có cùng quyền; thu ngân / CSKH / biên tập / HDV nhận 403). */
@RestController
public class OperatorController {
    private final CurrentUser current;
    private final OperatorOps ops;
    private final CustomerOps customers;
    private final OpsCore core;

    public OperatorController(CurrentUser current, OperatorOps ops, CustomerOps customers, OpsCore core) {
        this.current = current;
        this.ops = ops;
        this.customers = customers;
        this.core = core;
    }

    @GetMapping("/api/operator/queue")
    public Map<String, Object> queue(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_ASSIGN_GUIDE);
        return ops.queue();
    }

    @GetMapping("/api/operator/stats")
    public Map<String, Object> stats(HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_OPERATOR);
        return Maps.of("ok", true, "stats", ops.stats());
    }

    /** Lịch sử hoạt động điều hành (nhật ký hệ thống đã lọc sẵn theo 5 nhóm việc của Điều hành). */
    @GetMapping("/api/operator/activity")
    public Map<String, Object> activity(@RequestParam(required = false) String group, @RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "200") int limit, HttpServletRequest req) {
        current.requirePermission(req, Permission.ACTIVITY_VIEW_OPERATOR);
        java.util.List<Map<String, Object>> groups = new java.util.ArrayList<>();
        for (Map.Entry<String, Object[]> g : vn.travel.service.Audit.OPERATOR_GROUPS.entrySet()) groups.add(Maps.of("id", g.getKey(), "label", g.getValue()[0]));
        return Maps.of("ok", true, "groups", groups, "entries", core.audit.operatorActivity(group, q, limit));
    }

    @GetMapping("/api/operator/bookings/{id}")
    public Map<String, Object> booking(@PathVariable String id, HttpServletRequest req) {
        current.requirePermission(req, Permission.PASSENGER_VIEW_UNMASKED);
        return Maps.of("ok", true, "booking", core.view(core.require(id), Role.OPERATOR));
    }

    @GetMapping("/api/operator/guide-calendar")
    public Map<String, Object> guideCalendar(@RequestParam(required = false) String month, HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_ASSIGN_GUIDE);
        return Maps.of("ok", true, "calendar", ops.guideCalendar(month));
    }

    @GetMapping("/api/operator/bookings/{id}/candidates")
    public Map<String, Object> candidates(@PathVariable String id, HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_ASSIGN_GUIDE);
        return Maps.of("ok", true, "guides", ops.candidates(id));
    }

    @PostMapping("/api/operator/bookings/{id}/assign")
    public Map<String, Object> assign(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_ASSIGN_GUIDE);
        return Maps.of("ok", true, "booking", ops.assign(Api.actor(u), id, Api.s(body, "guideId")));
    }

    @PostMapping("/api/operator/bookings/{id}/replace-guide")
    public Map<String, Object> replaceGuide(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_ASSIGN_GUIDE);
        return Maps.of("ok", true, "booking", ops.replaceGuide(Api.actor(u), id, Api.s(body, "guideId"), Api.s(body, "reason")));
    }

    @PostMapping("/api/operator/bookings/{id}/unassign")
    public Map<String, Object> unassign(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.OVERDUE_ASSIGNMENT_HANDLE);
        return Maps.of("ok", true, "booking", ops.unassign(Api.actor(u), id, Api.s(body, "reason")));
    }

    @GetMapping("/api/operator/departures")
    public Map<String, Object> departures(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "departures", ops.departures());
    }

    @PutMapping("/api/operator/departures")
    public Map<String, Object> setDeparture(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "departure", ops.setDeparture(Api.actor(u), Api.s(body, "tourId"), Api.s(body, "date"), Api.optInt(body, "capacity"),
                Api.s(body, "status").isEmpty() ? null : Api.s(body, "status")));
    }

    @GetMapping(value = "/api/operator/departures/manifest.csv", produces = "text/csv;charset=UTF-8")
    public String manifest(@RequestParam String tourId, @RequestParam String date, HttpServletRequest req) {
        current.requirePermission(req, Permission.PASSENGER_VIEW_UNMASKED);
        return Api.csv(ops.manifest(tourId, date), "payCode", "contact", "phone", "name", "dob", "gender", "idNumber", "note");
    }

    @PostMapping("/api/operator/cancel-proposals")
    public Map<String, Object> propose(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_CANCEL_PROPOSE);
        return Maps.of("ok", true, "proposal", ops.proposeCancel(Api.actor(u), Api.s(body, "tourId"), Api.s(body, "date"), Api.s(body, "reason")));
    }

    @GetMapping("/api/operator/incidents")
    public Map<String, Object> incidents(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.INCIDENT_MANAGE);
        return Maps.of("ok", true, "incidents", ops.incidents(status));
    }

    @PostMapping("/api/operator/incidents/{id}")
    public Map<String, Object> incident(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.INCIDENT_MANAGE);
        return Maps.of("ok", true, "incident", ops.handleIncident(Api.actor(u), id, Api.s(body, "status"), Api.s(body, "note")));
    }

    // ── gia hạn khi đang đi tour (8.12) ──
    @GetMapping("/api/operator/extensions")
    public Map<String, Object> extensions(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "requests", core.extensions().requested());
    }

    @PostMapping("/api/operator/extensions/{id}/{no}")
    public Map<String, Object> decideExtension(@PathVariable String id, @PathVariable int no, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return core.extensions().decide(Api.actor(u), id, no, Boolean.TRUE.equals(Api.body(body).get("approve")), Api.s(body, "note"));
    }

    // ── đổi ngày: Điều hành kiểm tra lịch HDV và chốt ──
    @GetMapping("/api/operator/reschedule")
    public Map<String, Object> reschedules(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "requests", customers.rescheduleQueue(Role.OPERATOR));
    }

    @PostMapping("/api/operator/reschedule/{id}")
    public Map<String, Object> decideReschedule(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return customers.decideReschedule(Api.actor(u), id, Boolean.TRUE.equals(Api.body(body).get("approve")), Api.s(body, "note"));
    }
}
