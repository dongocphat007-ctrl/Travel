/**
 * shared/roles-permissions.js – ĐỊNH NGHĨA VAI TRÒ VÀ MA TRẬN PHÂN QUYỀN (RBAC)
 * Dùng chung cho Server (Node/kiểm thử) và Trình duyệt (window.TravelRoles / window.TravelPermissions).
 *
 * Cấp bậc:
 * - ADMIN: Cao nhất, toàn quyền quản trị, duyệt đơn, duyệt hoàn tiền/đóng sổ, sửa cấu hình.
 * - Nhân viên nội bộ: CASHIER, OPERATOR, SUPPORT, CONTENT, GUIDE.
 * - Khách hàng: CUSTOMER (tự đăng ký).
 *
 * Nguyên tắc phân lập quyền cốt lõi:
 * - ADMIN KHÔNG bấm xác nhận thu tiền (đây là quyền riêng của CASHIER).
 * - CONTENT tạo/sửa tour ở dạng bản nháp; các trường nhạy cảm (giá, guideType, allowExtension, sức chứa) chỉ ADMIN được sửa.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    root.TravelRoles = exp.Roles;
    root.TravelPermissions = exp.Permissions;
    root.TravelRBAC = exp;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 1. Danh sách vai trò và metadata
  var Roles = {
    ADMIN: {
      id: "ADMIN",
      key: "admin",
      name: "Quản trị viên",
      prefix: "ad",
      internal: true,
      dashboard: "admin.html",
      badgeClass: "badge-role-admin",
      description:
        "Toàn quyền quản trị hệ thống, quản lý nhân viên, duyệt đơn, duyệt hoàn tiền và đóng sổ, cấu hình hệ thống.",
    },
    CASHIER: {
      id: "CASHIER",
      key: "cashier",
      name: "Thu ngân",
      prefix: "tn",
      internal: true,
      dashboard: "cashier.html",
      badgeClass: "badge-role-cashier",
      description:
        "Xác nhận tiền thanh toán (cọc 20%/đủ 100%), xử lý đơn chuyển lệch, thực hiện hoàn tiền, lập bản đóng sổ cuối ngày.",
    },
    OPERATOR: {
      id: "OPERATOR",
      key: "operator",
      name: "Điều hành tour",
      prefix: "dh",
      internal: true,
      dashboard: "operator.html",
      badgeClass: "badge-role-operator",
      description:
        "Gán và đổi hướng dẫn viên, quản lý lịch khởi hành và số chỗ, đề xuất hủy/dồn tour, xử lý sự cố.",
    },
    SUPPORT: {
      id: "SUPPORT",
      key: "support",
      name: "Chăm sóc khách hàng",
      prefix: "cs",
      internal: true,
      dashboard: "support.html",
      badgeClass: "badge-role-support",
      description:
        "Tiếp nhận và xử lý khiếu nại, hỗ trợ khách hàng đổi ngày tour, đề xuất hoàn tiền khiếu nại, quản lý danh sách chờ.",
    },
    CONTENT: {
      id: "CONTENT",
      key: "content",
      name: "Biên tập nội dung",
      prefix: "nd",
      internal: true,
      dashboard: "content.html",
      badgeClass: "badge-role-content",
      description:
        "Biên tập nội dung tour (bản nháp), quản lý ẩm thực 3 miền, banner quảng cáo và ẩn bình luận vi phạm.",
    },
    GUIDE: {
      id: "GUIDE",
      key: "guide",
      name: "Hướng dẫn viên",
      prefix: "hdv",
      internal: true,
      dashboard: "guide.html",
      badgeClass: "badge-role-guide",
      description:
        "Xem tour được giao, nhận/từ chối tour, điểm danh khách (check-in/no-show), bắt đầu/kết thúc chuyến, báo cáo sự cố.",
    },
    CUSTOMER: {
      id: "CUSTOMER",
      key: "user",
      name: "Khách hàng",
      prefix: "kh",
      internal: false,
      dashboard: "page-profile.html",
      badgeClass: "badge-role-customer",
      description:
        "Đặt tour, xem và hủy đơn của mình, thanh toán, đánh giá tour và hướng dẫn viên sau chuyến đi, khiếu nại.",
    },
  };

  // 2. Danh mục quyền hạn chi tiết (Permission Codes)
  var Permissions = {
    // CUSTOMER
    BOOKING_CREATE: "booking:create",
    BOOKING_VIEW_OWN: "booking:view_own",
    BOOKING_CANCEL_OWN: "booking:cancel_own",
    BOOKING_RESCHEDULE_OWN: "booking:reschedule_own",
    BOOKING_EXTEND_OWN: "booking:extend_own",
    REVIEW_CREATE_OWN: "review:create_own",
    COMPLAINT_CREATE_OWN: "complaint:create_own",

    // CASHIER
    PAYMENT_VIEW: "payment:view",
    PAYMENT_CONFIRM: "payment:confirm",
    PAYMENT_RESOLVE_DISCREPANCY: "payment:resolve_discrepancy",
    PAYMENT_REFUND: "payment:refund",
    GUIDE_FEE_PAY: "guide_fee:pay",
    RECONCILE_CREATE: "reconcile:create",
    STATS_VIEW_CASHIER: "stats:view_cashier",

    // OPERATOR
    TOUR_ASSIGN_GUIDE: "tour:assign_guide",
    TOUR_SCHEDULE_MANAGE: "tour:schedule_manage",
    TOUR_CANCEL_PROPOSE: "tour:cancel_propose",
    OVERDUE_ASSIGNMENT_HANDLE: "tour:overdue_assignment_handle",
    INCIDENT_MANAGE: "incident:manage",
    PASSENGER_VIEW_UNMASKED: "passenger:view_unmasked",
    STATS_VIEW_OPERATOR: "stats:view_operator",
    ACTIVITY_VIEW_OPERATOR: "activity:view_operator",

    // SUPPORT
    COMPLAINT_PROCESS: "complaint:process",
    COMPLAINT_REFUND_PROPOSE: "complaint:refund_propose",
    WAITLIST_MANAGE: "waitlist:manage",
    SUPPORT_ASSIST_CUSTOMER: "support:assist_customer",
    PASSENGER_VIEW_MASKED: "passenger:view_masked",
    STATS_VIEW_SUPPORT: "stats:view_support",
    CUSTOMER_VIEW: "customer:view",

    // CONTENT
    CONTENT_MANAGE_TOUR: "content:manage_tour",
    CONTENT_MANAGE_FOOD: "content:manage_food",
    CONTENT_MANAGE_BANNER: "content:manage_banner",
    REVIEW_MODERATE: "review:moderate",
    STATS_VIEW_CONTENT: "stats:view_content",

    // GUIDE
    GUIDE_VIEW_ASSIGNED: "guide:view_assigned",
    GUIDE_RESPOND_ASSIGNMENT: "guide:respond_assignment",
    TRIP_CHECKIN: "trip:checkin",
    TRIP_START_END: "trip:start_end",
    INCIDENT_REPORT: "incident:report",
    GUIDE_VIEW_SCHEDULE: "guide:view_schedule",
    GUIDE_VIEW_PROFILE: "guide:view_profile",
    TRIP_REPORT: "trip:report",

    // ADMIN (Quản trị & duyệt)
    BOOKING_MANAGE: "booking:manage",
    BOOKING_CONFIRM: "booking:confirm",
    BOOKING_REJECT: "booking:reject",
    REFUND_APPROVE: "refund:approve",
    RECONCILE_APPROVE: "reconcile:approve",
    COMPANY_CANCEL_APPROVE: "company_cancel:approve",
    TOUR_APPROVE_CONTENT: "tour:approve_content",
    TOUR_MANAGE_SENSITIVE: "tour:manage_sensitive",
    STAFF_MANAGE: "staff:manage",
    SYSTEM_CONFIG: "system:config",
    AUDIT_VIEW: "audit:view",
    STATS_VIEW_FULL: "stats:view_full",
    CUSTOMER_LOCK: "customer:lock",
    NOTIFY_SEND: "notify:send",
    NOTIFICATION_CUSTOMER_SEND: "notification:customer_send",
    NOTIFICATION_REMINDER_SEND: "notification:reminder_send",
    ACCOUNT_DELETE: "account:delete",
    VOUCHER_MANAGE: "voucher:manage",
  };

  // 3. Ma trận quyền theo vai trò (Role Permissions Matrix)
  var Matrix = {};

  Matrix[Roles.CUSTOMER.id] = [
    Permissions.BOOKING_CREATE,
    Permissions.BOOKING_VIEW_OWN,
    Permissions.BOOKING_CANCEL_OWN,
    Permissions.BOOKING_RESCHEDULE_OWN,
    Permissions.BOOKING_EXTEND_OWN,
    Permissions.REVIEW_CREATE_OWN,
    Permissions.COMPLAINT_CREATE_OWN,
  ];

  Matrix[Roles.CASHIER.id] = [
    Permissions.PAYMENT_VIEW,
    Permissions.PAYMENT_CONFIRM,
    Permissions.PAYMENT_RESOLVE_DISCREPANCY,
    Permissions.PAYMENT_REFUND,
    Permissions.GUIDE_FEE_PAY,
    Permissions.RECONCILE_CREATE,
    Permissions.STATS_VIEW_CASHIER,
    Permissions.NOTIFY_SEND,
  ];

  Matrix[Roles.OPERATOR.id] = [
    Permissions.TOUR_ASSIGN_GUIDE,
    Permissions.TOUR_SCHEDULE_MANAGE,
    Permissions.TOUR_CANCEL_PROPOSE,
    Permissions.OVERDUE_ASSIGNMENT_HANDLE,
    Permissions.INCIDENT_MANAGE,
    Permissions.PASSENGER_VIEW_UNMASKED,
    Permissions.STATS_VIEW_OPERATOR,
    Permissions.ACTIVITY_VIEW_OPERATOR,
    Permissions.NOTIFY_SEND,
  ];

  Matrix[Roles.SUPPORT.id] = [
    Permissions.COMPLAINT_PROCESS,
    Permissions.COMPLAINT_REFUND_PROPOSE,
    Permissions.WAITLIST_MANAGE,
    Permissions.SUPPORT_ASSIST_CUSTOMER,
    Permissions.PASSENGER_VIEW_MASKED,
    Permissions.STATS_VIEW_SUPPORT,
    Permissions.CUSTOMER_VIEW,
    Permissions.NOTIFY_SEND,
  ];

  Matrix[Roles.CONTENT.id] = [
    Permissions.CONTENT_MANAGE_TOUR,
    Permissions.CONTENT_MANAGE_FOOD,
    Permissions.CONTENT_MANAGE_BANNER,
    Permissions.REVIEW_MODERATE,
    Permissions.STATS_VIEW_CONTENT,
    Permissions.NOTIFY_SEND,
    Permissions.NOTIFICATION_CUSTOMER_SEND,
  ];

  Matrix[Roles.GUIDE.id] = [
    Permissions.GUIDE_VIEW_ASSIGNED,
    Permissions.GUIDE_RESPOND_ASSIGNMENT,
    Permissions.TRIP_CHECKIN,
    Permissions.TRIP_START_END,
    Permissions.INCIDENT_REPORT,
    Permissions.GUIDE_VIEW_SCHEDULE,
    Permissions.GUIDE_VIEW_PROFILE,
    Permissions.TRIP_REPORT,
    Permissions.NOTIFY_SEND,
  ];

  // ADMIN: Toàn quyền quản trị + giám sát / can thiệp Operator, Support, Content
  // NGOẠI LỆ: ADMIN KHÔNG có PAYMENT_CONFIRM (tách biệt giữa thu tiền và duyệt đơn)
  // ADMIN KHÔNG có các quyền cá nhân của CUSTOMER (booking:create, booking:view_own, review:create_own...)
  Matrix[Roles.ADMIN.id] = [
    // Quản trị
    Permissions.BOOKING_MANAGE,
    Permissions.BOOKING_CONFIRM,
    Permissions.BOOKING_REJECT,
    Permissions.REFUND_APPROVE,
    Permissions.RECONCILE_APPROVE,
    Permissions.COMPANY_CANCEL_APPROVE,
    Permissions.TOUR_APPROVE_CONTENT,
    Permissions.TOUR_MANAGE_SENSITIVE,
    Permissions.STAFF_MANAGE,
    Permissions.SYSTEM_CONFIG,
    Permissions.AUDIT_VIEW,
    Permissions.STATS_VIEW_FULL,
    Permissions.NOTIFY_SEND,
    Permissions.NOTIFICATION_CUSTOMER_SEND,
    Permissions.NOTIFICATION_REMINDER_SEND,
    Permissions.ACCOUNT_DELETE,
    Permissions.CUSTOMER_LOCK,
    Permissions.PAYMENT_VIEW,
    Permissions.VOUCHER_MANAGE,

    // Giám sát / Can thiệp Operator
    Permissions.TOUR_ASSIGN_GUIDE,
    Permissions.TOUR_SCHEDULE_MANAGE,
    Permissions.TOUR_CANCEL_PROPOSE,
    Permissions.OVERDUE_ASSIGNMENT_HANDLE,
    Permissions.INCIDENT_MANAGE,
    Permissions.PASSENGER_VIEW_UNMASKED,
    Permissions.STATS_VIEW_OPERATOR,
    Permissions.ACTIVITY_VIEW_OPERATOR,

    // Giám sát / Can thiệp Support
    Permissions.COMPLAINT_PROCESS,
    Permissions.COMPLAINT_REFUND_PROPOSE,
    Permissions.WAITLIST_MANAGE,
    Permissions.SUPPORT_ASSIST_CUSTOMER,
    Permissions.PASSENGER_VIEW_MASKED,
    Permissions.STATS_VIEW_SUPPORT,
    Permissions.CUSTOMER_VIEW,

    // Quản trị / Giám sát Content
    Permissions.CONTENT_MANAGE_TOUR,
    Permissions.CONTENT_MANAGE_FOOD,
    Permissions.CONTENT_MANAGE_BANNER,
    Permissions.REVIEW_MODERATE,
    Permissions.STATS_VIEW_CONTENT,
  ];

  // 4. Các hàm hỗ trợ tra cứu và kiểm tra quyền
  function normalizeRole(roleOrUser) {
    if (!roleOrUser) return Roles.CUSTOMER.id;
    var raw = "";
    if (typeof roleOrUser === "object") {
      raw = roleOrUser.role || roleOrUser.roleId || "";
    } else {
      raw = String(roleOrUser);
    }
    raw = raw.trim().toUpperCase();
    if (!raw || raw === "USER" || raw === "CUSTOMER" || raw === "KHACH_HANG")
      return Roles.CUSTOMER.id;
    if (raw === "ADMIN" || raw === "ADMINISTRATOR") return Roles.ADMIN.id;
    if (Roles[raw]) return raw;
    // Tìm theo key (chữ thường)
    var lower = raw.toLowerCase();
    for (var k in Roles) {
      if (Roles[k].key === lower || Roles[k].id === raw) return Roles[k].id;
    }
    return Roles.CUSTOMER.id;
  }

  function getRoleMeta(roleOrUser) {
    var roleId = normalizeRole(roleOrUser);
    return Roles[roleId] || Roles.CUSTOMER;
  }

  function getPermissions(roleOrUser) {
    var roleId = normalizeRole(roleOrUser);
    return Matrix[roleId] ? Matrix[roleId].slice() : [];
  }

  function hasPermission(roleOrUser, permCode) {
    if (!permCode) return false;
    var perms = getPermissions(roleOrUser);
    return perms.indexOf(permCode) >= 0;
  }

  function hasRole(roleOrUser, targetRole) {
    var current = normalizeRole(roleOrUser);
    var target = normalizeRole(targetRole);
    return current === target;
  }

  function isStaff(roleOrUser) {
    var meta = getRoleMeta(roleOrUser);
    return !!meta.internal;
  }

  function isAdmin(roleOrUser) {
    return normalizeRole(roleOrUser) === Roles.ADMIN.id;
  }

  return {
    Roles: Roles,
    Permissions: Permissions,
    Matrix: Matrix,
    normalizeRole: normalizeRole,
    getRoleMeta: getRoleMeta,
    getPermissions: getPermissions,
    hasPermission: hasPermission,
    hasRole: hasRole,
    isStaff: isStaff,
    isAdmin: isAdmin,
  };
});
