package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.security.RolePermissions;
import vn.travel.service.CustomerDirectory;
import vn.travel.util.Maps;

import java.util.Map;

/**
 * Màn hình "Khách hàng" dùng chung: CSKH và Admin xem (customer:view); chỉ Admin khóa/mở khóa (customer:lock).
 * Sổ thanh toán của khách chỉ trả cho vai trò có quyền xem thanh toán (Admin), CSKH không thấy.
 */
@RestController
public class CustomerDirectoryController {
    private final CurrentUser current;
    private final CustomerDirectory directory;

    public CustomerDirectoryController(CurrentUser current, CustomerDirectory directory) {
        this.current = current;
        this.directory = directory;
    }

    @GetMapping("/api/staff/customers")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                    @RequestParam(required = false, defaultValue = "200") int limit, HttpServletRequest req) {
        current.requirePermission(req, Permission.CUSTOMER_VIEW);
        return directory.search(q, status, limit);
    }

    @GetMapping("/api/staff/customers/{id}")
    public Map<String, Object> detail(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CUSTOMER_VIEW);
        boolean withPayments = RolePermissions.hasPermission(current.getRole(u), Permission.PAYMENT_VIEW);
        return directory.detail(id, withPayments);
    }

    @PostMapping("/api/staff/customers/{id}/lock")
    public Map<String, Object> lock(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CUSTOMER_LOCK);
        boolean lock = !Boolean.FALSE.equals(Api.body(body).get("lock"));
        return Maps.of("ok", true, "customer", directory.setLocked(Api.actor(u), id, lock, Api.s(body, "reason")));
    }

    @DeleteMapping("/api/staff/customers/{id}")
    public Map<String, Object> deleteCustomer(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.ACCOUNT_DELETE);
        return directory.deleteCustomer(Api.actor(u), id);
    }
}
