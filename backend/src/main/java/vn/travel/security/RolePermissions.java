package vn.travel.security;

import java.util.*;

/**
 * Ma trận phân quyền theo vai trò (RBAC Matrix).
 * Trung tâm điều phối quyền hạn duy nhất của hệ thống:
 * - Dễ dàng mở rộng vai trò mới (như ACCOUNTANT) chỉ cần thêm Role và cấu hình Set<Permission> tại đây.
 * - Đảm bảo nguyên tắc phân lập quyền: ADMIN KHÔNG có quyền PAYMENT_CONFIRM (xác nhận nhận tiền là việc riêng của CASHIER).
 */
public final class RolePermissions {
    private RolePermissions() { }

    private static final Map<Role, Set<Permission>> MATRIX = new EnumMap<>(Role.class);

    static {
        // 1. KHÁCH HÀNG (CUSTOMER)
        MATRIX.put(Role.CUSTOMER, Collections.unmodifiableSet(EnumSet.of(
                Permission.BOOKING_CREATE,
                Permission.BOOKING_VIEW_OWN,
                Permission.BOOKING_CANCEL_OWN,
                Permission.BOOKING_RESCHEDULE_OWN,
                Permission.BOOKING_EXTEND_OWN,
                Permission.REVIEW_CREATE_OWN,
                Permission.COMPLAINT_CREATE_OWN
        )));

        // 2. THU NGÂN (CASHIER)
        MATRIX.put(Role.CASHIER, Collections.unmodifiableSet(EnumSet.of(
                Permission.PAYMENT_VIEW,
                Permission.PAYMENT_CONFIRM,
                Permission.PAYMENT_RESOLVE_DISCREPANCY,
                Permission.PAYMENT_REFUND,
                Permission.GUIDE_FEE_PAY,
                Permission.RECONCILE_CREATE,
                Permission.STATS_VIEW_CASHIER,
                Permission.NOTIFY_SEND
        )));

        // 3. ĐIỀU HÀNH TOUR (OPERATOR)
        MATRIX.put(Role.OPERATOR, Collections.unmodifiableSet(EnumSet.of(
                Permission.TOUR_ASSIGN_GUIDE,
                Permission.TOUR_SCHEDULE_MANAGE,
                Permission.TOUR_CANCEL_PROPOSE,
                Permission.OVERDUE_ASSIGNMENT_HANDLE,
                Permission.INCIDENT_MANAGE,
                Permission.PASSENGER_VIEW_UNMASKED,
                Permission.STATS_VIEW_OPERATOR,
                Permission.ACTIVITY_VIEW_OPERATOR,
                Permission.NOTIFY_SEND
        )));

        // 4. CHĂM SÓC KHÁCH HÀNG (SUPPORT)
        MATRIX.put(Role.SUPPORT, Collections.unmodifiableSet(EnumSet.of(
                Permission.COMPLAINT_PROCESS,
                Permission.COMPLAINT_REFUND_PROPOSE,
                Permission.WAITLIST_MANAGE,
                Permission.SUPPORT_ASSIST_CUSTOMER,
                Permission.PASSENGER_VIEW_MASKED,
                Permission.STATS_VIEW_SUPPORT,
                Permission.CUSTOMER_VIEW,
                Permission.NOTIFY_SEND
        )));

        // 5. BIÊN TẬP NỘI DUNG (CONTENT)
        MATRIX.put(Role.CONTENT, Collections.unmodifiableSet(EnumSet.of(
                Permission.CONTENT_MANAGE_TOUR,
                Permission.CONTENT_MANAGE_FOOD,
                Permission.CONTENT_MANAGE_BANNER,
                Permission.REVIEW_MODERATE,
                Permission.STATS_VIEW_CONTENT,
                Permission.NOTIFY_SEND,
                Permission.NOTIFICATION_CUSTOMER_SEND
        )));

        // 6. HƯỚNG DẪN VIÊN (GUIDE)
        MATRIX.put(Role.GUIDE, Collections.unmodifiableSet(EnumSet.of(
                Permission.GUIDE_VIEW_ASSIGNED,
                Permission.GUIDE_RESPOND_ASSIGNMENT,
                Permission.TRIP_CHECKIN,
                Permission.TRIP_START_END,
                Permission.INCIDENT_REPORT,
                Permission.GUIDE_VIEW_SCHEDULE,
                Permission.GUIDE_VIEW_PROFILE,
                Permission.TRIP_REPORT,
                Permission.NOTIFY_SEND
        )));

        // 7. QUẢN TRỊ VIÊN (ADMIN)
        // Admin làm được việc quản trị + giám sát / can thiệp Operator, Support, Content
        // NGOẠI LỆ: ADMIN KHÔNG có quyền PAYMENT_CONFIRM (nguyên tắc tách người thu tiền CASHIER và người duyệt đơn ADMIN)
        // ADMIN KHÔNG có các quyền cá nhân của CUSTOMER (booking:create, booking:view_own, review:create_own...)
        EnumSet<Permission> adminPerms = EnumSet.of(
                // Quyền quản trị đặc thù
                Permission.BOOKING_MANAGE,
                Permission.BOOKING_CONFIRM,
                Permission.BOOKING_REJECT,
                Permission.REFUND_APPROVE,
                Permission.RECONCILE_APPROVE,
                Permission.COMPANY_CANCEL_APPROVE,
                Permission.TOUR_APPROVE_CONTENT,
                Permission.TOUR_MANAGE_SENSITIVE,
                Permission.STAFF_MANAGE,
                Permission.SYSTEM_CONFIG,
                Permission.AUDIT_VIEW,
                Permission.STATS_VIEW_FULL,
                Permission.NOTIFY_SEND,
                Permission.NOTIFICATION_CUSTOMER_SEND,
                Permission.NOTIFICATION_REMINDER_SEND,
                Permission.ACCOUNT_DELETE,
                Permission.CUSTOMER_LOCK,
                Permission.PAYMENT_VIEW,
                Permission.VOUCHER_MANAGE,

                // Giám sát / Can thiệp Điều hành (OPERATOR)
                Permission.TOUR_ASSIGN_GUIDE,
                Permission.TOUR_SCHEDULE_MANAGE,
                Permission.TOUR_CANCEL_PROPOSE,
                Permission.OVERDUE_ASSIGNMENT_HANDLE,
                Permission.INCIDENT_MANAGE,
                Permission.PASSENGER_VIEW_UNMASKED,
                Permission.STATS_VIEW_OPERATOR,
                Permission.ACTIVITY_VIEW_OPERATOR,

                // Giám sát / Can thiệp CSKH (SUPPORT)
                Permission.COMPLAINT_PROCESS,
                Permission.COMPLAINT_REFUND_PROPOSE,
                Permission.WAITLIST_MANAGE,
                Permission.SUPPORT_ASSIST_CUSTOMER,
                Permission.PASSENGER_VIEW_MASKED,
                Permission.STATS_VIEW_SUPPORT,
                Permission.CUSTOMER_VIEW,

                // Quản trị / Giám sát Biên tập (CONTENT)
                Permission.CONTENT_MANAGE_TOUR,
                Permission.CONTENT_MANAGE_FOOD,
                Permission.CONTENT_MANAGE_BANNER,
                Permission.REVIEW_MODERATE,
                Permission.STATS_VIEW_CONTENT
        );
        MATRIX.put(Role.ADMIN, Collections.unmodifiableSet(adminPerms));
    }

    public static Set<Permission> getPermissions(Role role) {
        if (role == null) return Collections.emptySet();
        return MATRIX.getOrDefault(role, Collections.emptySet());
    }

    public static Set<String> getPermissionCodes(Role role) {
        Set<Permission> perms = getPermissions(role);
        Set<String> codes = new LinkedHashSet<>();
        for (Permission p : perms) {
            codes.add(p.getCode());
        }
        return codes;
    }

    public static boolean hasPermission(Role role, Permission permission) {
        if (role == null || permission == null) return false;
        Set<Permission> perms = MATRIX.get(role);
        return perms != null && perms.contains(permission);
    }

    public static boolean hasPermission(Object roleObj, String permissionCode) {
        Role r = Role.from(roleObj);
        Permission p = Permission.fromCode(permissionCode);
        return hasPermission(r, p);
    }

    public static Map<String, Object> getRoleMetadata(Role role) {
        if (role == null) return Map.of();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role.name());
        m.put("key", role.getKey());
        m.put("displayName", role.getDisplayName());
        m.put("prefix", role.getPrefix());
        m.put("internal", role.isInternal());
        m.put("description", role.getDescription());
        m.put("permissions", getPermissionCodes(role));
        return m;
    }

    public static List<Map<String, Object>> getAllRolesMetadata() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Role r : Role.values()) {
            list.add(getRoleMetadata(r));
        }
        return list;
    }

    public static Map<String, List<String>> getMatrixMap() {
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (Map.Entry<Role, Set<Permission>> entry : MATRIX.entrySet()) {
            List<String> codes = new ArrayList<>();
            for (Permission p : entry.getValue()) {
                codes.add(p.getCode());
            }
            out.put(entry.getKey().name(), codes);
        }
        return out;
    }
}
