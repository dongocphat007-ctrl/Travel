package vn.travel.security;

/**
 * Danh mục quyền hạn chi tiết trong hệ thống (Fine-grained Permissions).
 * Phục vụ phân quyền ma trận RBAC theo tài liệu nghiệp vụ.
 */
public enum Permission {
    // -------------------------------------------------------------
    // KHÁCH HÀNG (CUSTOMER)
    // -------------------------------------------------------------
    BOOKING_CREATE("booking:create", "Đặt tour mới"),
    BOOKING_VIEW_OWN("booking:view_own", "Xem đơn tour của chính mình"),
    BOOKING_CANCEL_OWN("booking:cancel_own", "Hủy đơn tour của chính mình theo chính sách hoàn tiền"),
    BOOKING_RESCHEDULE_OWN("booking:reschedule_own", "Yêu cầu đổi ngày khởi hành"),
    BOOKING_EXTEND_OWN("booking:extend_own", "Yêu cầu gia hạn thêm ngày"),
    REVIEW_CREATE_OWN("review:create_own", "Viết đánh giá sao và nhận xét cho tour & HDV đã hoàn thành"),
    COMPLAINT_CREATE_OWN("complaint:create_own", "Gửi phản hồi / khiếu nại về tour"),

    // -------------------------------------------------------------
    // THU NGÂN (CASHIER)
    // -------------------------------------------------------------
    PAYMENT_VIEW("payment:view", "Xem danh sách và trạng thái thanh toán"),
    PAYMENT_CONFIRM("payment:confirm", "Xác nhận nhận tiền cọc (20%) hoặc nhận đủ (100%)"),
    PAYMENT_RESOLVE_DISCREPANCY("payment:resolve_discrepancy", "Xử lý giao dịch chuyển thiếu/thừa/sai nội dung"),
    PAYMENT_REFUND("payment:refund", "Thực hiện lệnh hoàn tiền (chuyển sang trạng thái refunded)"),
    GUIDE_FEE_PAY("guide_fee:pay", "Ghi nhận đã chi thù lao cho hướng dẫn viên sau tour"),
    RECONCILE_CREATE("reconcile:create", "Tạo bản đóng sổ đối soát cuối ngày"),
    STATS_VIEW_CASHIER("stats:view_cashier", "Xem tổng số tiền thu trong ngày"),

    // -------------------------------------------------------------
    // ĐIỀU HÀNH TOUR (OPERATOR)
    // -------------------------------------------------------------
    TOUR_ASSIGN_GUIDE("tour:assign_guide", "Gán hoặc đổi hướng dẫn viên cho tour"),
    TOUR_SCHEDULE_MANAGE("tour:schedule_manage", "Quản lý lịch khởi hành, ngày đi và số lượng chỗ còn lại"),
    TOUR_CANCEL_PROPOSE("tour:cancel_propose", "Đề xuất hủy hoặc dồn tour khi không đủ số khách tối thiểu"),
    OVERDUE_ASSIGNMENT_HANDLE("tour:overdue_assignment_handle", "Xử lý các đơn chưa có HDV hoặc HDV từ chối"),
    INCIDENT_MANAGE("incident:manage", "Tiếp nhận và xử lý báo cáo sự cố đoàn từ hướng dẫn viên"),
    PASSENGER_VIEW_UNMASKED("passenger:view_unmasked", "Xem thông tin hành khách và CCCD/hộ chiếu đầy đủ không che"),
    STATS_VIEW_OPERATOR("stats:view_operator", "Xem số lượng đơn, chuyến sắp đi, tình trạng phân bổ HDV"),
    ACTIVITY_VIEW_OPERATOR("activity:view_operator", "Xem lịch sử hoạt động điều hành (đổi tour, phân công HDV, lịch trình, sự cố, điều phối)"),

    // -------------------------------------------------------------
    // CHĂM SÓC KHÁCH HÀNG (SUPPORT)
    // -------------------------------------------------------------
    COMPLAINT_PROCESS("complaint:process", "Tiếp nhận, xử lý khiếu nại và phản hồi trao đổi với khách"),
    COMPLAINT_REFUND_PROPOSE("complaint:refund_propose", "Đề xuất mức hoàn tiền đền bù khiếu nại để Admin duyệt"),
    WAITLIST_MANAGE("waitlist:manage", "Quản lý danh sách chờ (waitlist) và thông báo khi có chỗ trống"),
    SUPPORT_ASSIST_CUSTOMER("support:assist_customer", "Hỗ trợ khách hàng đổi ngày tour hoặc xử lý sai lệch thanh toán"),
    PASSENGER_VIEW_MASKED("passenger:view_masked", "Xem thông tin hành khách với số CCCD/hộ chiếu được che"),
    STATS_VIEW_SUPPORT("stats:view_support", "Xem thống kê khiếu nại và thời gian xử lý trung bình"),
    CUSTOMER_VIEW("customer:view", "Tra cứu khách hàng (email/SĐT/mã đơn), xem thông tin, lịch sử đặt tour và khiếu nại/hỗ trợ"),

    // -------------------------------------------------------------
    // BIÊN TẬP NỘI DUNG (CONTENT)
    // -------------------------------------------------------------
    CONTENT_MANAGE_TOUR("content:manage_tour", "Tạo/sửa mô tả, ảnh, lịch trình tour (lưu ở bản nháp chờ Admin duyệt)"),
    CONTENT_MANAGE_FOOD("content:manage_food", "Quản lý danh mục món ăn đặc sản 3 miền"),
    CONTENT_MANAGE_BANNER("content:manage_banner", "Quản lý banner carousel trang chủ"),
    REVIEW_MODERATE("review:moderate", "Ẩn hoặc hiện bình luận/đánh giá vi phạm tiêu chuẩn cộng đồng"),
    STATS_VIEW_CONTENT("stats:view_content", "Xem thống kê lượt xem tour, điểm đánh giá và tour được yêu thích"),

    // -------------------------------------------------------------
    // HƯỚNG DẪN VIÊN (GUIDE)
    // -------------------------------------------------------------
    GUIDE_VIEW_ASSIGNED("guide:view_assigned", "Xem danh sách và chi tiết các tour được phân công"),
    GUIDE_RESPOND_ASSIGNMENT("guide:respond_assignment", "Bấm nhận hoặc từ chối tour được giao kèm lý do"),
    TRIP_CHECKIN("trip:checkin", "Điểm danh hành khách trong đoàn và đánh dấu vắng mặt (no-show)"),
    TRIP_START_END("trip:start_end", "Bắt đầu chuyến đi (in_progress) và kết thúc chuyến đi (completed)"),
    INCIDENT_REPORT("incident:report", "Lập báo cáo sự cố phát sinh trong chuyến đi gắn với mã đơn tour"),
    GUIDE_VIEW_SCHEDULE("guide:view_schedule", "Xem lịch làm việc cá nhân, ngày bận và ngày nghỉ bù sau tour"),
    GUIDE_VIEW_PROFILE("guide:view_profile", "Xem hồ sơ hướng dẫn viên của chính mình (kinh nghiệm, ngôn ngữ, chứng chỉ, khu vực)"),
    TRIP_REPORT("trip:report", "Nộp báo cáo tour sau khi kết thúc chuyến đi (số khách, sự cố, ghi chú)"),

    // -------------------------------------------------------------
    // QUẢN TRỊ VIÊN (ADMIN) - QUYỀN DUYỆT & QUẢN TRỊ ĐẶC THÙ
    // -------------------------------------------------------------
    BOOKING_MANAGE("booking:manage", "Quản lý và giám sát đơn tour cấp quản trị"),
    BOOKING_CONFIRM("booking:confirm", "Xác nhận duyệt đơn tour (chuyển sang confirmed)"),
    BOOKING_REJECT("booking:reject", "Từ chối duyệt đơn tour kèm lý do và chuyển sang hoàn tiền"),
    REFUND_APPROVE("refund:approve", "Duyệt yêu cầu hoàn tiền (từ hủy đơn hoặc đề xuất của CSKH)"),
    RECONCILE_APPROVE("reconcile:approve", "Duyệt bản đóng sổ đối soát cuối ngày của thu ngân"),
    COMPANY_CANCEL_APPROVE("company_cancel:approve", "Duyệt quyết định hủy tour từ phía công ty"),
    TOUR_APPROVE_CONTENT("tour:approve_content", "Duyệt xuất bản nội dung tour nháp của biên tập lên công khai"),
    TOUR_MANAGE_SENSITIVE("tour:manage_sensitive", "Chỉnh sửa các trường nhạy cảm: giá tour, loại HDV, cho phép gia hạn, sức chứa"),
    STAFF_MANAGE("staff:manage", "Quản lý nhân viên: tạo mới, sửa thông tin, khóa tài khoản, cấp lại mật khẩu"),
    SYSTEM_CONFIG("system:config", "Quản lý cấu hình hệ thống, tham số vận hành và khóa dịch vụ ngoài"),
    AUDIT_VIEW("audit:view", "Xem lịch sử thay đổi trạng thái đơn và nhật ký thao tác hệ thống"),
    STATS_VIEW_FULL("stats:view_full", "Xem đầy đủ báo cáo dashboard, doanh thu, tăng trưởng, KPI theo kỳ"),
    CUSTOMER_LOCK("customer:lock", "Khóa / mở khóa tài khoản khách hàng"),
    NOTIFY_SEND("notify:send", "Gửi thông báo / trao đổi chủ động cho một vai trò hoặc một người (người nhận có thể phản hồi lại)"),
    NOTIFICATION_CUSTOMER_SEND("notification:customer_send", "Gửi thông báo tới khách hàng"),
    NOTIFICATION_REMINDER_SEND("notification:reminder_send", "Gửi thông báo nhắc nhở nhân viên (ghi lỗi & trừ 200k tiền lương)"),
    ACCOUNT_DELETE("account:delete", "Xóa tài khoản người dùng hoặc nhân viên"),
    VOUCHER_MANAGE("voucher:manage", "Quản lý mã giảm giá / voucher: tạo mới, bật/tắt, xóa");

    private final String code;
    private final String description;

    Permission(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public String getCode() { return code; }
    public String getDescription() { return description; }

    public static Permission fromCode(String code) {
        if (code == null) return null;
        for (Permission p : values()) {
            if (p.code.equalsIgnoreCase(code) || p.name().equalsIgnoreCase(code)) {
                return p;
            }
        }
        return null;
    }
}
