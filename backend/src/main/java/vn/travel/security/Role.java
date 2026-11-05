package vn.travel.security;

import java.util.Arrays;
import java.util.List;

/**
 * Định nghĩa vai trò trong hệ thống (RBAC).
 * Cấp bậc:
 * - ADMIN: Cao nhất, quản trị toàn bộ hệ thống (không có superadmin).
 * - Nhân viên nội bộ: CASHIER, OPERATOR, SUPPORT, CONTENT, GUIDE.
 * - Người dùng ngoài: CUSTOMER.
 */
public enum Role {
    ADMIN("admin", "Quản trị viên", "ad", true,
            "Toàn quyền quản trị hệ thống, quản lý nhân viên, duyệt đơn, duyệt hoàn tiền/đóng sổ, sửa cấu hình và giá tour."),
    CASHIER("cashier", "Thu ngân", "tn", true,
            "Xác nhận tiền thanh toán (cọc 20%/đủ 100%), xử lý đơn chuyển lệch, thực hiện hoàn tiền, tạo bản đóng sổ cuối ngày."),
    OPERATOR("operator", "Điều hành tour", "dh", true,
            "Gán/đổi hướng dẫn viên, quản lý lịch khởi hành và số chỗ, xử lý sự cố đoàn, đề xuất hủy/dồn tour."),
    SUPPORT("support", "Chăm sóc khách hàng", "cs", true,
            "Tiếp nhận và xử lý khiếu nại của khách, đề xuất mức hoàn tiền khiếu nại, hỗ trợ đổi ngày, quản lý danh sách chờ."),
    CONTENT("content", "Biên tập nội dung", "nd", true,
            "Biên tập nội dung tour (bản nháp), quản lý ẩm thực 3 miền, quản lý banner quảng cáo, ẩn bình luận vi phạm."),
    GUIDE("guide", "Hướng dẫn viên", "hdv", true,
            "Xem tour được phân công, nhận/từ chối tour, điểm danh khách (check-in/no-show), bắt đầu/kết thúc chuyến, báo cáo sự cố."),
    CUSTOMER("user", "Khách hàng", "kh", false,
            "Tìm kiếm và đặt tour, xem và hủy đơn của mình, thanh toán, đánh giá tour và hướng dẫn viên sau chuyến đi, khiếu nại.");

    private final String key;
    private final String displayName;
    private final String prefix;
    private final boolean internal;
    private final String description;

    Role(String key, String displayName, String prefix, boolean internal, String description) {
        this.key = key;
        this.displayName = displayName;
        this.prefix = prefix;
        this.internal = internal;
        this.description = description;
    }

    public String getKey() { return key; }
    public String getDisplayName() { return displayName; }
    public String getPrefix() { return prefix; }
    public boolean isInternal() { return internal; }
    public String getDescription() { return description; }

    /**
     * Chuyển chuỗi bất kỳ sang Role tương ứng (hỗ trợ hoa thường, alias user/customer, admin).
     * Mặc định rơi về CUSTOMER nếu không khớp.
     */
    public static Role from(Object val) {
        if (val == null) return CUSTOMER;
        String s = String.valueOf(val).trim().toLowerCase();
        if (s.isEmpty() || "user".equals(s) || "customer".equals(s) || "khach_hang".equals(s) || "khach".equals(s)) {
            return CUSTOMER;
        }
        if ("admin".equals(s) || "administrator".equals(s)) {
            return ADMIN;
        }
        for (Role r : values()) {
            if (r.name().equalsIgnoreCase(s) || r.key.equalsIgnoreCase(s)) {
                return r;
            }
        }
        return CUSTOMER;
    }

    public boolean matches(Object roleObj) {
        if (roleObj == null) return false;
        return from(roleObj) == this;
    }

    public static List<Role> internalRoles() {
        return Arrays.stream(values()).filter(Role::isInternal).toList();
    }
}
