package vn.travel.util;

import java.util.*;

/**
 * Vòng đời đơn tour (TASKS giai đoạn 2): danh sách trạng thái + bảng chuyển trạng thái hợp lệ
 * (từ → sang → vai trò được phép). Đây là NGUỒN DUY NHẤT: mọi thay đổi trạng thái đơn đi qua
 * {@code Ops.changeStatus}, hàm này tra bảng ở đây và từ chối nếu sai thứ tự hoặc sai vai trò.
 *
 * Vai trò trong bảng: CUSTOMER, CASHIER, OPERATOR, GUIDE, ADMIN và SYSTEM (việc tự động do server làm).
 */
public final class Flow {
    private Flow() { }

    public static final String PENDING_PAYMENT = "pending_payment";
    public static final String PAID_DEPOSIT = "paid_deposit";
    public static final String PAID_FULL = "paid_full";
    public static final String CONFIRMED = "confirmed";
    public static final String GUIDE_PENDING = "guide_pending";
    public static final String GUIDE_ACCEPTED = "guide_accepted";
    public static final String IN_PROGRESS = "in_progress";
    public static final String COMPLETED = "completed";
    public static final String CANCELLED = "cancelled";
    public static final String REFUND_PENDING = "refund_pending";
    public static final String REFUNDED = "refunded";

    public static final String CUSTOMER = "CUSTOMER", CASHIER = "CASHIER", OPERATOR = "OPERATOR", GUIDE = "GUIDE",
            ADMIN = "ADMIN", SYSTEM = "SYSTEM", SUPPORT = "SUPPORT", CONTENT = "CONTENT";

    public static final List<String> ALL = List.of(PENDING_PAYMENT, PAID_DEPOSIT, PAID_FULL, CONFIRMED, GUIDE_PENDING,
            GUIDE_ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED, REFUND_PENDING, REFUNDED);

    private static final Map<String, String> LABEL = new LinkedHashMap<>();
    static {
        LABEL.put(PENDING_PAYMENT, "Chờ thanh toán");
        LABEL.put(PAID_DEPOSIT, "Đã nhận cọc – chờ duyệt");
        LABEL.put(PAID_FULL, "Đã nhận đủ – chờ duyệt");
        LABEL.put(CONFIRMED, "Đã xác nhận");
        LABEL.put(GUIDE_PENDING, "Chờ HDV nhận tour");
        LABEL.put(GUIDE_ACCEPTED, "HDV đã nhận tour");
        LABEL.put(IN_PROGRESS, "Đang đi tour");
        LABEL.put(COMPLETED, "Đã hoàn thành");
        LABEL.put(CANCELLED, "Đã hủy");
        LABEL.put(REFUND_PENDING, "Chờ hoàn tiền");
        LABEL.put(REFUNDED, "Đã hoàn tiền");
    }

    /** from → (to → vai trò được phép). */
    private static final Map<String, Map<String, Set<String>>> T = new LinkedHashMap<>();

    private static void add(String from, String to, String... roles) {
        T.computeIfAbsent(from, k -> new LinkedHashMap<>()).computeIfAbsent(to, k -> new LinkedHashSet<>()).addAll(Arrays.asList(roles));
    }

    static {
        // Thanh toán (Thu ngân xác nhận tiền; SYSTEM = webhook ngân hàng đã khớp mã + số tiền)
        add(PENDING_PAYMENT, PAID_DEPOSIT, CASHIER, SYSTEM);
        add(PENDING_PAYMENT, PAID_FULL, CASHIER, SYSTEM);
        add(PENDING_PAYMENT, CANCELLED, CUSTOMER, ADMIN, SYSTEM);
        add(PAID_DEPOSIT, PAID_FULL, CASHIER, SYSTEM);
        add(PAID_DEPOSIT, PENDING_PAYMENT, CASHIER);        // hoàn tác thao tác nhầm (3.7)
        add(PAID_FULL, PENDING_PAYMENT, CASHIER);
        add(PAID_FULL, PAID_DEPOSIT, CASHIER);              // hoàn tác khoản thu nốt
        // Admin duyệt đơn
        add(PAID_DEPOSIT, CONFIRMED, ADMIN);
        add(PAID_FULL, CONFIRMED, ADMIN);
        // Hủy / từ chối / công ty hủy: đã có tiền → chờ hoàn tiền, không có tiền hoàn → hủy
        for (String s : List.of(PAID_DEPOSIT, PAID_FULL, CONFIRMED, GUIDE_PENDING, GUIDE_ACCEPTED)) {
            add(s, REFUND_PENDING, CUSTOMER, ADMIN, SYSTEM);
            add(s, CANCELLED, CUSTOMER, ADMIN, SYSTEM);
        }
        // Gán HDV
        add(CONFIRMED, GUIDE_PENDING, OPERATOR, ADMIN, SYSTEM);
        add(GUIDE_PENDING, GUIDE_ACCEPTED, GUIDE);
        add(GUIDE_PENDING, CONFIRMED, GUIDE, OPERATOR, ADMIN, SYSTEM);       // HDV từ chối / quá hạn / điều hành gỡ gán
        add(GUIDE_ACCEPTED, GUIDE_PENDING, OPERATOR, ADMIN);                 // đổi HDV sau khi đã nhận
        add(GUIDE_ACCEPTED, CONFIRMED, OPERATOR, ADMIN);
        // Chuyến đi
        add(GUIDE_ACCEPTED, IN_PROGRESS, GUIDE);
        add(IN_PROGRESS, COMPLETED, GUIDE, SYSTEM);
        add(CONFIRMED, COMPLETED, SYSTEM);                                   // tour tự túc không có HDV: hệ thống đóng đơn sau ngày kết thúc
        // Hoàn tiền
        add(REFUND_PENDING, REFUNDED, CASHIER);
    }

    public static boolean known(String s) { return ALL.contains(s); }

    public static String label(String s) { return LABEL.getOrDefault(s, s); }

    /** Trạng thái cũ ("pending") và giá trị rỗng → trạng thái mới tương ứng. */
    public static String norm(Object status) {
        String s = status == null ? "" : String.valueOf(status).trim();
        if (s.isEmpty() || "pending".equals(s)) return PENDING_PAYMENT;
        return s;
    }

    public static Set<String> rolesFor(String from, String to) {
        Map<String, Set<String>> m = T.get(from);
        Set<String> r = m == null ? null : m.get(to);
        return r == null ? Set.of() : Collections.unmodifiableSet(r);
    }

    public static boolean valid(String from, String to) { return !rolesFor(from, to).isEmpty(); }

    public static boolean allowed(String from, String to, String roleName) { return rolesFor(from, to).contains(roleName); }

    /** Bảng chuyển trạng thái ở dạng dữ liệu (cho trang nhật ký / tài liệu). */
    public static List<Map<String, Object>> table() {
        List<Map<String, Object>> out = new ArrayList<>();
        T.forEach((from, m) -> m.forEach((to, roles) -> out.add(Maps.of("from", from, "to", to, "roles", new ArrayList<>(roles)))));
        return out;
    }

    /** Đơn không còn giữ chỗ / giữ lịch HDV nữa. */
    public static boolean inactive(Object status) {
        String s = norm(status);
        return CANCELLED.equals(s) || REFUND_PENDING.equals(s) || REFUNDED.equals(s);
    }

    /** Đơn đang giữ chỗ (kể cả đơn đã hoàn thành: vẫn là một lượt dùng tour). */
    public static boolean active(Object status) { return !inactive(status); }

    /** Đã có hướng dẫn viên được giao (đang chờ nhận hoặc đã nhận) hoặc đã đi. */
    public static boolean afterGuide(String s) {
        return GUIDE_PENDING.equals(s) || GUIDE_ACCEPTED.equals(s) || IN_PROGRESS.equals(s) || COMPLETED.equals(s);
    }

    /** Đã được admin xác nhận (từ confirmed trở đi, còn hiệu lực). */
    public static boolean confirmedOrLater(String s) {
        return CONFIRMED.equals(s) || afterGuide(s);
    }

    // ───────────── sổ thanh toán (ledger) và lịch sử trên đơn ─────────────

    /** Tổng tiền khách đã trả và đã được ghi nhận (không tính khoản đã hoàn tác). */
    public static long paidIn(Map<String, Object> b) {
        long sum = 0;
        for (Object o : Maps.list(b.get("payments"))) {
            Map<String, Object> p = Maps.map(o);
            if (p == null || Maps.bool(p, "undone")) continue;
            String k = Maps.str(p, "kind");
            if ("deposit".equals(k) || "full".equals(k) || "final".equals(k)) sum += Maps.lng(p, "amount");
        }
        return sum;
    }

    /** Tổng tiền đã hoàn cho khách. */
    public static long refundedOut(Map<String, Object> b) {
        long sum = 0;
        for (Object o : Maps.list(b.get("payments"))) {
            Map<String, Object> p = Maps.map(o);
            if (p != null && !Maps.bool(p, "undone") && "refund".equals(Maps.str(p, "kind"))) sum += Maps.lng(p, "amount");
        }
        return sum;
    }

    /** Đã thu đủ 100% (thanh toán đủ ngay từ đầu hoặc đã thu nốt phần còn lại). */
    public static boolean fullyPaid(Map<String, Object> b) {
        return Maps.bool(b, "fullPaid") || Maps.bool(b, "finalPaid");
    }

    /** Thêm một dòng vào sổ thanh toán của đơn và trả dòng đó. */
    public static Map<String, Object> addPayment(Map<String, Object> b, String kind, long amount, String source, String byId, String byName,
                                                 String role, String note, long nowMillis) {
        List<Object> list = new ArrayList<>(Maps.list(b.get("payments")));
        Map<String, Object> p = Maps.of("id", Ids.newId("pm"), "kind", kind, "amount", amount, "source", source, "byId", byId == null ? "" : byId,
                "byName", byName == null ? "" : byName, "role", role == null ? "" : role, "note", note == null ? "" : note,
                "at", Times.iso(nowMillis), "undone", false);
        list.add(p);
        b.put("payments", list);
        return p;
    }

    /** Ghi một dòng lịch sử (ai – vai trò gì – lúc nào – từ đâu sang đâu – ghi chú), 17.25. */
    public static void addHistory(Map<String, Object> b, String action, String from, String to, String byId, String byName, String role,
                                  String note, long nowMillis) {
        List<Object> list = new ArrayList<>(Maps.list(b.get("history")));
        list.add(Maps.of("at", Times.iso(nowMillis), "action", action, "from", from == null ? "" : from, "to", to == null ? "" : to,
                "byId", byId == null ? "" : byId, "byName", byName == null ? "" : byName, "role", role == null ? "" : role,
                "by", (byId == null || byId.isEmpty() ? "hệ thống" : byId) + " – " + (role == null ? "" : role),
                "note", note == null ? "" : note));
        b.put("history", list);
    }
}
