package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.service.CustomerOps;
import vn.travel.service.SupportOps;
import vn.travel.util.Maps;

import java.util.Map;

/** API riêng của KHÁCH: xem trước và hủy đơn theo bảng hoàn tiền, xin đổi ngày, khiếu nại, danh sách chờ. Nhân viên không có các quyền này (403). */
@RestController
public class CustomerController {
    private final CurrentUser current;
    private final CustomerOps customers;
    private final SupportOps support;

    private vn.travel.service.OpsCore core;

    @org.springframework.beans.factory.annotation.Autowired
    public void setCore(vn.travel.service.OpsCore core) { this.core = core; }

    // ── gia hạn thêm ngày (8.7–8.16) ──
    @GetMapping("/api/bookings/{id}/extensions/preview")
    public Map<String, Object> extPreview(@PathVariable String id, @RequestParam(defaultValue = "1") int days, HttpServletRequest req) {
        return core.extensions().preview(current.requirePermission(req, Permission.BOOKING_EXTEND_OWN), id, days);
    }

    @PostMapping("/api/bookings/{id}/extensions")
    public Map<String, Object> extRequest(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Integer days = Api.optInt(body, "days");
        return core.extensions().request(current.requirePermission(req, Permission.BOOKING_EXTEND_OWN), id, days == null ? 0 : days, Api.s(body, "note"));
    }

    @PostMapping("/api/bookings/{id}/extensions/{no}/cancel")
    public Map<String, Object> extCancel(@PathVariable String id, @PathVariable int no, HttpServletRequest req) {
        return core.extensions().cancel(current.requirePermission(req, Permission.BOOKING_EXTEND_OWN), id, no);
    }

    /** 8.5: trả lời đề nghị khi công ty hủy chuyến (hoàn 100% hoặc đổi ngày). */
    @PostMapping("/api/bookings/{id}/company-offer")
    public Map<String, Object> companyOffer(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return customers.respondCompanyOffer(current.requirePermission(req, Permission.BOOKING_RESCHEDULE_OWN), id, Api.s(body, "choice"), Api.s(body, "date"));
    }

    public CustomerController(CurrentUser current, CustomerOps customers, SupportOps support) {
        this.current = current;
        this.customers = customers;
        this.support = support;
    }

    @GetMapping("/api/bookings/{id}/cancel-preview")
    public Map<String, Object> preview(@PathVariable String id, HttpServletRequest req) {
        return customers.cancelPreview(current.requirePermission(req, Permission.BOOKING_CANCEL_OWN), id);
    }

    @PostMapping("/api/bookings/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return customers.cancel(current.requirePermission(req, Permission.BOOKING_CANCEL_OWN), id, Api.s(body, "reason"));
    }

    @PostMapping("/api/bookings/{id}/reschedule")
    public Map<String, Object> reschedule(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return customers.requestReschedule(current.requirePermission(req, Permission.BOOKING_RESCHEDULE_OWN), id, Api.s(body, "date"), Api.s(body, "reason"));
    }

    @PostMapping("/api/complaints")
    public Map<String, Object> complain(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_CREATE_OWN);
        return Maps.of("ok", true, "complaint", support.createComplaint(u, Api.s(body, "bookingId"), Api.s(body, "title"), Api.s(body, "content"), body == null ? null : body.get("images")));
    }

    @GetMapping("/api/complaints/mine")
    public Map<String, Object> myComplaints(HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPLAINT_CREATE_OWN);
        return Maps.of("ok", true, "complaints", support.myComplaints(Maps.str(u, "id")));
    }

    /** 9.1: chỗ còn lại của một chuyến khởi hành (công khai): form đặt tour dùng để báo "còn N chỗ" hoặc mời vào danh sách chờ. */
    @GetMapping("/api/tours/{tourId}/availability")
    public Map<String, Object> availability(@PathVariable String tourId, @RequestParam String date) {
        return Maps.of("ok", true, "availability", customers.availability(tourId, date));
    }

    @PostMapping("/api/waitlist")
    public Map<String, Object> join(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.BOOKING_CREATE);
        Integer pax = Api.optInt(body, "pax");
        return Maps.of("ok", true, "item", support.joinWaitlist(u, Api.s(body, "tourId"), Api.s(body, "date"), pax == null ? 1 : pax, Api.s(body, "phone")));
    }
}
