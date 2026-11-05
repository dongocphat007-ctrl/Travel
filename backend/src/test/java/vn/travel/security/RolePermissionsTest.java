package vn.travel.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class RolePermissionsTest {

    @Test
    @DisplayName("Role.from() nhận diện đúng các vai trò và chuẩn hóa case-insensitive")
    void roleParsingAndNormalization() {
        assertEquals(Role.ADMIN, Role.from("admin"));
        assertEquals(Role.ADMIN, Role.from("ADMIN"));
        assertEquals(Role.ADMIN, Role.from("administrator"));

        assertEquals(Role.CASHIER, Role.from("cashier"));
        assertEquals(Role.CASHIER, Role.from("CASHIER"));

        assertEquals(Role.OPERATOR, Role.from("operator"));
        assertEquals(Role.OPERATOR, Role.from("OPERATOR"));

        assertEquals(Role.SUPPORT, Role.from("support"));
        assertEquals(Role.SUPPORT, Role.from("SUPPORT"));

        assertEquals(Role.CONTENT, Role.from("content"));
        assertEquals(Role.CONTENT, Role.from("CONTENT"));

        assertEquals(Role.GUIDE, Role.from("guide"));
        assertEquals(Role.GUIDE, Role.from("GUIDE"));

        assertEquals(Role.CUSTOMER, Role.from("customer"));
        assertEquals(Role.CUSTOMER, Role.from("user"));
        assertEquals(Role.CUSTOMER, Role.from("khach_hang"));
        assertEquals(Role.CUSTOMER, Role.from("khach"));
        assertEquals(Role.CUSTOMER, Role.from(""));
        assertEquals(Role.CUSTOMER, Role.from(null));
        assertEquals(Role.CUSTOMER, Role.from("invalid_role"));
    }

    @Test
    @DisplayName("Đúng tiền tố tài khoản theo quy định TASKS (14.4)")
    void rolePrefixes() {
        assertEquals("ad", Role.ADMIN.getPrefix());
        assertEquals("tn", Role.CASHIER.getPrefix());
        assertEquals("dh", Role.OPERATOR.getPrefix());
        assertEquals("cs", Role.SUPPORT.getPrefix());
        assertEquals("nd", Role.CONTENT.getPrefix());
        assertEquals("hdv", Role.GUIDE.getPrefix());
        assertEquals("kh", Role.CUSTOMER.getPrefix());
    }

    @Test
    @DisplayName("Nguyên tắc phân lập quyền: ADMIN không được xác nhận nhận tiền (việc riêng của CASHIER)")
    void segregationOfDutiesCashierAndAdmin() {
        // Thu ngân có quyền xác nhận tiền
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.PAYMENT_CONFIRM));
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.PAYMENT_REFUND));
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.RECONCILE_CREATE));

        // ADMIN TUYỆT ĐỐI KHÔNG có quyền xác nhận nhận tiền (tránh vừa thu vừa duyệt)
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_CONFIRM),
                "ADMIN không được có quyền PAYMENT_CONFIRM để đảm bảo phân lập quyền");

        // Thu ngân KHÔNG được duyệt đơn (confirmed), duyệt hoàn tiền hoặc quản lý nhân viên
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.RECONCILE_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.STAFF_MANAGE));

        // Admin có quyền duyệt đơn, duyệt hoàn tiền, duyệt đóng sổ
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CONFIRM));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.REFUND_APPROVE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.RECONCILE_APPROVE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.STAFF_MANAGE));
    }

    @Test
    @DisplayName("Phân quyền CONTENT: Biên tập chỉ sửa nội dung/bản nháp, không sửa trường nhạy cảm")
    void contentPermissions() {
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.CONTENT_MANAGE_TOUR));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.CONTENT_MANAGE_FOOD));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.CONTENT_MANAGE_BANNER));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.REVIEW_MODERATE));

        // CONTENT không được sửa các trường nhạy cảm (giá, guideType, allowExtension, sức chứa)
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_MANAGE_SENSITIVE));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_APPROVE_CONTENT));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.STAFF_MANAGE));

        // ADMIN có quyền sửa trường nhạy cảm và duyệt nội dung
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.TOUR_MANAGE_SENSITIVE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.TOUR_APPROVE_CONTENT));
    }

    @Test
    @DisplayName("Phân quyền OPERATOR: Điều hành gán/đổi HDV, lịch tour nhưng không duyệt hoàn tiền")
    void operatorPermissions() {
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_ASSIGN_GUIDE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_SCHEDULE_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_CANCEL_PROPOSE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.OVERDUE_ASSIGNMENT_HANDLE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.INCIDENT_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.PASSENGER_VIEW_UNMASKED));

        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.STAFF_MANAGE));
    }

    @Test
    @DisplayName("Phân quyền SUPPORT: Xử lý khiếu nại, đề xuất hoàn tiền, xem CCCD dạng che")
    void supportPermissions() {
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.COMPLAINT_PROCESS));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.COMPLAINT_REFUND_PROPOSE));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.WAITLIST_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.SUPPORT_ASSIST_CUSTOMER));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.PASSENGER_VIEW_MASKED));

        // CSKH chỉ xem CCCD dạng che, không xem dạng unmasked
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.PASSENGER_VIEW_UNMASKED));
        // CSKH chỉ đề xuất hoàn tiền, không được tự duyệt hoàn tiền
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.REFUND_APPROVE));
    }

    @Test
    @DisplayName("Phân quyền GUIDE: Hướng dẫn viên chỉ thao tác trên tour được phân công")
    void guidePermissions() {
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.GUIDE_VIEW_ASSIGNED));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.GUIDE_RESPOND_ASSIGNMENT));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.TRIP_CHECKIN));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.TRIP_START_END));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.INCIDENT_REPORT));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.GUIDE_VIEW_SCHEDULE));

        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.STAFF_MANAGE));
    }

    @Test
    @DisplayName("Phân quyền CUSTOMER: Khách hàng chỉ thao tác trên đơn và đánh giá của mình")
    void customerPermissions() {
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_CREATE));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_VIEW_OWN));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_CANCEL_OWN));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_RESCHEDULE_OWN));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_EXTEND_OWN));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.REVIEW_CREATE_OWN));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.COMPLAINT_CREATE_OWN));

        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_CONFIRM));
    }

    @Test
    @DisplayName("Phân quyền thông báo khách hàng, thông báo nhắc nhở và xóa tài khoản")
    void notificationAndAccountPermissions() {
        // Chỉ ADMIN và CONTENT có quyền thông báo cho khách hàng
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.NOTIFICATION_CUSTOMER_SEND));

        // Chỉ ADMIN có quyền gửi thông báo nhắc nhở (ghi lỗi & trừ 200k lương)
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.NOTIFICATION_REMINDER_SEND));

        // Chỉ ADMIN có quyền xóa tài khoản
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.ACCOUNT_DELETE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.ACCOUNT_DELETE));

        // Mọi vai trò nội bộ đều có quyền gửi thông báo/trao đổi nội bộ
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.NOTIFY_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.NOTIFY_SEND));
    }

    @Test
    @DisplayName("Chuẩn hóa RBAC: ADMIN có quyền quản lý đơn tour cấp quản trị (BOOKING_MANAGE) nhưng KHÔNG có quyền khách hàng cá nhân")
    void adminDoesNotHaveCustomerPersonalPermissions() {
        // ADMIN có quyền quản lý đơn tour cấp quản trị
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_MANAGE));

        // ADMIN TUYỆT ĐỐI KHÔNG có các quyền mang bản chất người dùng cá nhân (Phần 4 Yêu cầu)
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_VIEW_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CANCEL_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_RESCHEDULE_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_EXTEND_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.REVIEW_CREATE_OWN));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.COMPLAINT_CREATE_OWN));

        // Không một nhân sự nội bộ nào được phép đặt tour (chỉ duy nhất CUSTOMER)
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.BOOKING_CREATE));
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_CREATE));
    }

    @Test
    @DisplayName("Metadata và danh sách roles đầy đủ cho API và Client")
    void metadataAndMatrixMap() {
        List<Map<String, Object>> all = RolePermissions.getAllRolesMetadata();
        assertEquals(7, all.size());

        Map<String, List<String>> matrix = RolePermissions.getMatrixMap();
        assertEquals(7, matrix.size());
        assertTrue(matrix.containsKey("ADMIN"));
        assertTrue(matrix.containsKey("CASHIER"));
        assertTrue(matrix.containsKey("OPERATOR"));
        assertTrue(matrix.containsKey("SUPPORT"));
        assertTrue(matrix.containsKey("CONTENT"));
        assertTrue(matrix.containsKey("GUIDE"));
        assertTrue(matrix.containsKey("CUSTOMER"));
    }

    @Test
    @DisplayName("Kiểm tra toàn diện ranh giới phân quyền Separation of Duties (SoD) giữa 7 vai trò theo 22 Phần Yêu Cầu")
    void crossRoleSeparationOfDutiesValidation() {
        // 1. CASHIER: Độc quyền xác nhận tiền, nhưng không duyệt đơn, không duyệt hoàn tiền, không quản lý nhân viên
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.TOUR_ASSIGN_GUIDE));

        // 2. OPERATOR: Điều hành chuyến và HDV, nhưng không đụng chạm tiền bạc hay duyệt hoàn tiền
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_ASSIGN_GUIDE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_SCHEDULE_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.TOUR_CANCEL_PROPOSE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.COMPANY_CANCEL_APPROVE));

        // 3. SUPPORT: Chăm sóc khách hàng, đề xuất hoàn tiền nhưng không tự duyệt hoàn tiền hay xác nhận tiền
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.COMPLAINT_PROCESS));
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.COMPLAINT_REFUND_PROPOSE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.REFUND_APPROVE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.BOOKING_CONFIRM));

        // 4. CONTENT: Soạn nội dung nhưng không sửa trường nhạy cảm (giá, loại HDV) hay duyệt xuất bản
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.CONTENT_MANAGE_TOUR));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_MANAGE_SENSITIVE));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_APPROVE_CONTENT));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.STAFF_MANAGE));

        // 5. GUIDE: Chỉ tác nghiệp tour được phân công
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.TRIP_CHECKIN));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.TRIP_START_END));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.INCIDENT_REPORT));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.REFUND_APPROVE));

        // 6. CUSTOMER: Khách hàng mua tour, tuyệt đối không có quyền quản trị/nhân sự
        assertTrue(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.BOOKING_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.SYSTEM_CONFIG));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.AUDIT_VIEW));

        // 7. ADMIN: Quản trị cấp cao nhưng không có quyền mua tour cá nhân hay tự xác nhận nhận tiền
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CONFIRM));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.REFUND_APPROVE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.STAFF_MANAGE));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.BOOKING_CREATE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.VOUCHER_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.VOUCHER_MANAGE));

        // Kiểm tra tiền tố và tính chất nội bộ (Internal)
        assertTrue(Role.ADMIN.isInternal());
        assertTrue(Role.CASHIER.isInternal());
        assertTrue(Role.OPERATOR.isInternal());
        assertTrue(Role.SUPPORT.isInternal());
        assertTrue(Role.CONTENT.isInternal());
        assertTrue(Role.GUIDE.isInternal());
        assertFalse(Role.CUSTOMER.isInternal(), "CUSTOMER không phải nhân sự nội bộ");
    }
}
