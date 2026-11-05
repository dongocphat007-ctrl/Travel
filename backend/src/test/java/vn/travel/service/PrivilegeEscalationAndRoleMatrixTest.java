package vn.travel.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.service.OpsCore.Actor;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PHASE 8 & PHASE 9: KIỂM TRA TOÀN DIỆN API AUTHORIZATION, BUSINESS LOGIC VÀ PRIVILEGE ESCALATION
 * Tuân thủ nghiêm ngặt Phần 18, Phần 19 & Phần 20 của chỉ thị nghiệp vụ.
 */
class PrivilegeEscalationAndRoleMatrixTest {

    private static Map<String, Object> mockUser(String id, String name, Role role) {
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("id", id);
        u.put("name", name);
        u.put("role", role.name().toLowerCase());
        u.put("status", "active");
        u.put("permissions", RolePermissions.getPermissions(role).stream().map(Permission::getCode).toList());
        return u;
    }

    // =========================================================================
    // PHASE 9 - KỊCH BẢN 1 ĐẾN 6: CÁC ROLE KHÔNG PHẢI ADMIN GỌI API ADMIN -> BỊ TỪ CHỐI 403
    // =========================================================================

    @Test
    @DisplayName("Kịch bản 1: CUSTOMER gọi các API quản trị của ADMIN đều bị từ chối 403")
    void customerCannotAccessAdminApis() {
        Role r = Role.CUSTOMER;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE), "Customer không thể quản lý nhân viên");
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_MANAGE), "Customer không thể quản lý đơn cấp admin");
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM), "Customer không thể duyệt đơn tour");
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE), "Customer không thể duyệt hoàn tiền");
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE), "Customer không thể duyệt đóng sổ");
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG), "Customer không thể sửa cấu hình hệ thống");
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW), "Customer không thể xem audit log");
        assertFalse(RolePermissions.hasPermission(r, Permission.STATS_VIEW_FULL), "Customer không thể xem dashboard doanh thu");
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE), "Customer không thể tạo/sửa voucher");
        assertFalse(RolePermissions.hasPermission(r, Permission.ACCOUNT_DELETE), "Customer không thể xóa tài khoản");
    }

    @Test
    @DisplayName("Kịch bản 2: GUIDE gọi các API quản trị của ADMIN đều bị từ chối 403")
    void guideCannotAccessAdminApis() {
        Role r = Role.GUIDE;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_MANAGE));
    }

    @Test
    @DisplayName("Kịch bản 3: CASHIER gọi các API quản trị của ADMIN đều bị từ chối 403")
    void cashierCannotAccessAdminApis() {
        Role r = Role.CASHIER;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM), "Thu ngân không duyệt đơn");
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE), "Thu ngân không tự duyệt hoàn tiền");
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE), "Thu ngân không tự duyệt bản đóng sổ");
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.COMPANY_CANCEL_APPROVE));
    }

    @Test
    @DisplayName("Kịch bản 4: OPERATOR gọi các API quản trị của ADMIN đều bị từ chối 403")
    void operatorCannotAccessAdminApis() {
        Role r = Role.OPERATOR;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.COMPANY_CANCEL_APPROVE), "Điều hành chỉ đề xuất hủy, không tự duyệt");
    }

    @Test
    @DisplayName("Kịch bản 5: SUPPORT gọi các API quản trị của ADMIN đều bị từ chối 403")
    void supportCannotAccessAdminApis() {
        Role r = Role.SUPPORT;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE), "CSKH chỉ đề xuất hoàn tiền, không tự duyệt");
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.ACCOUNT_DELETE));
    }

    @Test
    @DisplayName("Kịch bản 6: CONTENT gọi các API quản trị của ADMIN đều bị từ chối 403")
    void contentCannotAccessAdminApis() {
        Role r = Role.CONTENT;
        assertFalse(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE));
        assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertFalse(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(r, Permission.TOUR_MANAGE_SENSITIVE), "Biên tập không được đổi giá hay loại HDV");
        assertFalse(RolePermissions.hasPermission(r, Permission.TOUR_APPROVE_CONTENT), "Biên tập chỉ lưu bản nháp, không tự xuất bản");
    }

    // =========================================================================
    // PHASE 9 - KỊCH BẢN 7: ADMIN GỌI API QUẢN TRỊ ĐƯỢC PHÉP
    // =========================================================================

    @Test
    @DisplayName("Kịch bản 7: ADMIN được phép thực hiện tất cả chức năng quản trị, giám sát và can thiệp")
    void adminHasAllAdministrativeAndSupervisionPermissions() {
        Role r = Role.ADMIN;
        assertTrue(RolePermissions.hasPermission(r, Permission.BOOKING_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.BOOKING_CONFIRM));
        assertTrue(RolePermissions.hasPermission(r, Permission.BOOKING_REJECT));
        assertTrue(RolePermissions.hasPermission(r, Permission.REFUND_APPROVE));
        assertTrue(RolePermissions.hasPermission(r, Permission.RECONCILE_APPROVE));
        assertTrue(RolePermissions.hasPermission(r, Permission.COMPANY_CANCEL_APPROVE));
        assertTrue(RolePermissions.hasPermission(r, Permission.TOUR_APPROVE_CONTENT));
        assertTrue(RolePermissions.hasPermission(r, Permission.TOUR_MANAGE_SENSITIVE));
        assertTrue(RolePermissions.hasPermission(r, Permission.STAFF_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG));
        assertTrue(RolePermissions.hasPermission(r, Permission.AUDIT_VIEW));
        assertTrue(RolePermissions.hasPermission(r, Permission.STATS_VIEW_FULL));
        assertTrue(RolePermissions.hasPermission(r, Permission.VOUCHER_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.CUSTOMER_LOCK));
        assertTrue(RolePermissions.hasPermission(r, Permission.ACCOUNT_DELETE));

        // Can thiệp & giám sát Operator
        assertTrue(RolePermissions.hasPermission(r, Permission.TOUR_ASSIGN_GUIDE));
        assertTrue(RolePermissions.hasPermission(r, Permission.TOUR_SCHEDULE_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.INCIDENT_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.PASSENGER_VIEW_UNMASKED));

        // Can thiệp & giám sát Support
        assertTrue(RolePermissions.hasPermission(r, Permission.COMPLAINT_PROCESS));
        assertTrue(RolePermissions.hasPermission(r, Permission.WAITLIST_MANAGE));
        assertTrue(RolePermissions.hasPermission(r, Permission.CUSTOMER_VIEW));

        // Quản trị & duyệt Content
        assertTrue(RolePermissions.hasPermission(r, Permission.CONTENT_MANAGE_TOUR));
        assertTrue(RolePermissions.hasPermission(r, Permission.CONTENT_MANAGE_BANNER));
        assertTrue(RolePermissions.hasPermission(r, Permission.REVIEW_MODERATE));
    }

    // =========================================================================
    // PHASE 9 - KỊCH BẢN 8 ĐẾN 10: RÀNG BUỘC RIÊNG CỦA ADMIN (SEPARATION OF DUTIES)
    // =========================================================================

    @Test
    @DisplayName("Kịch bản 8: ADMIN không có payment:confirm (độc quyền của CASHIER để tách người thu tiền)")
    void adminDoesNotHavePaymentConfirm() {
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_CONFIRM),
                "Phần 5: ADMIN tuyệt đối không được có payment:confirm");
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.PAYMENT_CONFIRM),
                "CASHIER độc quyền xác nhận nhận tiền");
    }

    @Test
    @DisplayName("Kịch bản 9: ADMIN không có các quyền cá nhân của CUSTOMER (booking:create, view_own, cancel_own, extend_own...)")
    void adminDoesNotHaveCustomerBookingPermissions() {
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CREATE),
                "Phần 4: ADMIN không được giả lập CUSTOMER để đặt tour cho chính mình");
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_VIEW_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CANCEL_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_RESCHEDULE_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_EXTEND_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.COMPLAINT_CREATE_OWN));
    }

    @Test
    @DisplayName("Kịch bản 10: ADMIN không có review:create_own (không tự tạo đánh giá tour)")
    void adminDoesNotHaveReviewCreateOwnPermission() {
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.REVIEW_CREATE_OWN),
                "Phần 4: ADMIN không có review:create_own");
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.REVIEW_CREATE_OWN));
    }

    // =========================================================================
    // PHASE 9 - KỊCH BẢN 11 & 12: TÁC NGHIỆP CHÉO VÀ STAFF PORTAL ACCESS
    // =========================================================================

    @Test
    @DisplayName("Kịch bản 11: CUSTOMER bị chặn không thể truy cập bất kỳ staff portal hay staff actions")
    void customerCannotAccessStaffPortalsOrActions() {
        Set<Permission> custPerms = RolePermissions.getPermissions(Role.CUSTOMER);
        for (Permission p : custPerms) {
            assertTrue(p.getCode().startsWith("booking:") || p.getCode().startsWith("review:") || p.getCode().startsWith("complaint:"));
        }
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.PAYMENT_VIEW));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.TRIP_CHECKIN));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.COMPLAINT_PROCESS));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.CONTENT_MANAGE_TOUR));
    }

    @Test
    @DisplayName("Kịch bản 12: Staff role không thể truy cập chức năng đặc thù của role khác")
    void crossRoleSeparationOfDuties() {
        // Thu ngân không được gán HDV hay sửa nội dung tour
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.CONTENT_MANAGE_TOUR));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.COMPLAINT_PROCESS));

        // Điều hành không được xác nhận tiền hay duyệt hoàn tiền
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.RECONCILE_CREATE));

        // CSKH không được gán HDV hay xác nhận tiền
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.PAYMENT_CONFIRM));

        // Biên tập không được đổi giá tour hay xem CCCD không che
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_MANAGE_SENSITIVE));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.PASSENGER_VIEW_UNMASKED));

        // HDV không được duyệt đơn hay lên lịch tour cho công ty
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.TOUR_SCHEDULE_MANAGE));
    }

    // =========================================================================
    // PHASE 8 & 9 - BUSINESS LOGIC PHÒNG VỆ: CHẶN TẠO ĐƠN & REVIEW NỘI BỘ
    // =========================================================================

    @Test
    @DisplayName("Kịch bản 13 (Phòng vệ Service): Bookings.create() chặn toàn bộ tài khoản nội bộ (Admin, Staff)")
    void bookingsCreateBlocksInternalAccounts(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);

        // Tạo tài khoản admin và staff
        Map<String, Object> adminUser = mockUser("ad_test", "Admin User", Role.ADMIN);
        Map<String, Object> cashierUser = mockUser("tn_test", "Cashier User", Role.CASHIER);
        Map<String, Object> operatorUser = mockUser("dh_test", "Operator User", Role.OPERATOR);
        Map<String, Object> guideUser = mockUser("hdv_test", "Guide User", Role.GUIDE);
        Map<String, Object> supportUser = mockUser("cs_test", "Support User", Role.SUPPORT);
        Map<String, Object> contentUser = mockUser("nd_test", "Content User", Role.CONTENT);

        Map<String, Object> bookingReq = new HashMap<>();
        bookingReq.put("tourId", "101");
        bookingReq.put("customerName", "Test Booking");
        bookingReq.put("phone", "0901234567");
        bookingReq.put("date", "2026-11-20");
        bookingReq.put("adults", 2);

        // Toàn bộ 6 vai trò nội bộ đều bị từ chối 403 Forbidden khi cố tình gọi tạo đơn
        HttpError errAdmin = assertThrows(HttpError.class, () -> f.bookings.create(adminUser, bookingReq));
        assertEquals(403, errAdmin.status());
        assertTrue(errAdmin.getMessage().contains("Tài khoản nội bộ không được phép đặt tour"));

        assertEquals(403, assertThrows(HttpError.class, () -> f.bookings.create(cashierUser, bookingReq)).status());
        assertEquals(403, assertThrows(HttpError.class, () -> f.bookings.create(operatorUser, bookingReq)).status());
        assertEquals(403, assertThrows(HttpError.class, () -> f.bookings.create(guideUser, bookingReq)).status());
        assertEquals(403, assertThrows(HttpError.class, () -> f.bookings.create(supportUser, bookingReq)).status());
        assertEquals(403, assertThrows(HttpError.class, () -> f.bookings.create(contentUser, bookingReq)).status());

        // Duy nhất Customer (tài khoản bên ngoài) được phép đặt tour thành công
        Map<String, Object> customerUser = mockUser("kh_test", "Khách Hàng A", Role.CUSTOMER);
        Map<String, Object> created = f.bookings.create(customerUser, bookingReq);
        assertNotNull(created);
        assertEquals("pending_payment", created.get("status"));
        assertEquals("kh_test", created.get("userId"));
    }

    @Test
    @DisplayName("Kịch bản 14 (Phòng vệ Service): Reviews.eligible() từ chối toàn bộ tài khoản nội bộ")
    void reviewsEligibleBlocksInternalAccounts(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);

        Map<String, Object> adminUser = mockUser("ad_test", "Admin User", Role.ADMIN);
        Map<String, Object> staffUser = mockUser("tn_test", "Staff User", Role.CASHIER);

        Map<String, Object> elAdmin = f.reviews.eligible(adminUser, "101");
        assertEquals(false, elAdmin.get("eligible"));
        assertEquals("Chỉ khách hàng mới có thể đánh giá tour.", elAdmin.get("reason"));

        Map<String, Object> elStaff = f.reviews.eligible(staffUser, "101");
        assertEquals(false, elStaff.get("eligible"));
        assertEquals("Chỉ khách hàng mới có thể đánh giá tour.", elStaff.get("reason"));
    }
}

