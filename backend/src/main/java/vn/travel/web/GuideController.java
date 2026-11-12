package vn.travel.web;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import vn.travel.security.Permission;
import vn.travel.service.GuideOps;
import vn.travel.util.Maps;

/** API Hướng dẫn viên: chỉ thấy và thao tác trên tour được giao cho CHÍNH MÌNH (tour của HDV khác trả 404). */
@RestController
public class GuideController {
    private final CurrentUser current;
    private final GuideOps guide;

    private final vn.travel.service.Reviews reviews;

    public GuideController(CurrentUser current, GuideOps guide, vn.travel.service.Reviews reviews) {
        this.current = current;
        this.guide = guide;
        this.reviews = reviews;
    }

    /** 7.3: điểm đánh giá riêng của chính HDV. */
    @GetMapping("/api/guide/rating")
    public Map<String, Object> rating(HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.GUIDE_VIEW_SCHEDULE);
        return reviews.guideStats(guide.profileId(u));
    }

    @GetMapping("/api/guide/tours")
    public Map<String, Object> tours(HttpServletRequest req) {
        return guide.myTours(current.requirePermission(req, Permission.GUIDE_VIEW_ASSIGNED));
    }

    @GetMapping("/api/guide/tours/{id}")
    public Map<String, Object> tour(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", guide.detail(current.requirePermission(req, Permission.GUIDE_VIEW_ASSIGNED), id));
    }

    @PostMapping("/api/guide/tours/{id}/accept")
    public Map<String, Object> accept(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", guide.accept(current.requirePermission(req, Permission.GUIDE_RESPOND_ASSIGNMENT), id));
    }

    @PostMapping("/api/guide/tours/{id}/reject")
    public Map<String, Object> reject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", guide.reject(current.requirePermission(req, Permission.GUIDE_RESPOND_ASSIGNMENT), id, Api.s(body, "reason")));
    }

    @PostMapping("/api/guide/tours/{id}/start")
    public Map<String, Object> start(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", guide.start(current.requirePermission(req, Permission.TRIP_START_END), id));
    }

    @PostMapping("/api/guide/tours/{id}/end")
    public Map<String, Object> end(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", guide.end(current.requirePermission(req, Permission.TRIP_START_END), id));
    }

    @PostMapping("/api/guide/tours/{id}/checkin")
    public Map<String, Object> checkin(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TRIP_CHECKIN);
        List<Map<String, Object>> marks = new ArrayList<>();
        for (Object o : Maps.list(Api.body(body).get("marks"))) { Map<String, Object> m = Maps.map(o); if (m != null) marks.add(m); }
        if (marks.isEmpty()) throw HttpError.bad("Chưa có hành khách nào được điểm danh", "marks");
        return Maps.of("ok", true, "booking", guide.checkin(u, id, marks));
    }

    @PostMapping("/api/guide/tours/{id}/incidents")
    public Map<String, Object> incident(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.INCIDENT_REPORT);
        return Maps.of("ok", true, "incident", guide.reportIncident(u, id, Api.s(body, "type"), Api.s(body, "severity"), Api.s(body, "description")));
    }

    @GetMapping("/api/guide/incidents")
    public Map<String, Object> incidents(HttpServletRequest req) {
        return Maps.of("ok", true, "incidents", guide.myIncidents(current.requirePermission(req, Permission.INCIDENT_REPORT)));
    }

    /** 7.9: thù lao đã tính (chỉ tour completed). ?month=yyyy-MM */
    @GetMapping("/api/guide/earnings")
    public Map<String, Object> earnings(@RequestParam(required = false) String month, HttpServletRequest req) {
        return guide.earnings(current.requirePermission(req, Permission.GUIDE_VIEW_SCHEDULE), month);
    }

    /** Hồ sơ HDV của chính mình (bản xem). */
    @GetMapping("/api/guide/profile")
    public Map<String, Object> profile(HttpServletRequest req) {
        return guide.profile(current.requirePermission(req, Permission.GUIDE_VIEW_PROFILE));
    }

    /** Báo cáo tour gọn: số liệu điểm danh + sự cố lấy từ dữ liệu có sẵn, kèm ghi chú đã nộp. */
    @GetMapping("/api/guide/tours/{id}/report")
    public Map<String, Object> report(@PathVariable String id, HttpServletRequest req) {
        return guide.report(current.requirePermission(req, Permission.TRIP_REPORT), id);
    }

    @PostMapping("/api/guide/tours/{id}/report")
    public Map<String, Object> submitReport(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return guide.submitReport(current.requirePermission(req, Permission.TRIP_REPORT), id, body != null ? body : Map.of());
    }

    @GetMapping("/api/guide/schedule")
    public Map<String, Object> schedule(HttpServletRequest req) {
        return guide.schedule(current.requirePermission(req, Permission.GUIDE_VIEW_SCHEDULE));
    }

    /** 10.6: danh sách khách của CHÍNH tour mình (CSV). */
    @GetMapping(value = "/api/guide/tours/{id}/manifest.csv", produces = "text/csv;charset=UTF-8")
    public String manifest(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> b = guide.detail(current.requirePermission(req, Permission.GUIDE_VIEW_ASSIGNED), id);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object o : Maps.list(b.get("passengers"))) {
            Map<String, Object> p = Maps.map(o);
            if (p != null) rows.add(Maps.of("payCode", b.get("payCode"), "contact", b.get("customerName"), "phone", b.get("phone"), "name", p.get("name"), "dob", p.get("dob"),
                    "gender", p.get("gender"), "idNumber", p.get("idNumber"), "note", Maps.str(b, "specialRequest")));
        }
        return Api.csv(rows, "payCode", "contact", "phone", "name", "dob", "gender", "idNumber", "note");
    }
}