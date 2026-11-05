package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Danh bạ khách hàng dùng chung cho CSKH (xem) và Admin (xem + khóa/mở khóa).
 * Tra cứu theo email / SĐT / mã đơn / tên; hồ sơ gồm thông tin khách, lịch sử đặt tour, khiếu nại – hỗ trợ, danh sách chờ
 * và (chỉ khi người xem có quyền xem thanh toán) lịch sử thanh toán. Không trả mật khẩu/token; không trả CCCD hành khách
 * (muốn xem chi tiết đơn thì dùng API chi tiết đơn của từng vai trò, vốn đã che dữ liệu theo vai trò).
 */
@Service
public class CustomerDirectory {
    private static final int DEFAULT_LIMIT = 200, MAX_LIMIT = 500;

    private final Db db;
    private final Accounts accounts;
    private final OpsCore core;

    public CustomerDirectory(Db db, Accounts accounts, OpsCore core) {
        this.db = db;
        this.accounts = accounts;
        this.core = core;
    }

    // ───────────────────────── tiện ích ─────────────────────────
    /** 0901234567 / +84 901 234 567 / 84901234567 → 901234567 (để so sánh số điện thoại không phụ thuộc cách gõ). */
    static String phoneKey(String s) {
        String d = s == null ? "" : s.replaceAll("[^0-9]", "");
        if (d.startsWith("84") && d.length() > 9) d = d.substring(2);
        else if (d.startsWith("0")) d = d.substring(1);
        return d;
    }

    private static boolean isCustomer(Map<String, Object> a) {
        return a != null && a.get("deletedAt") == null && Role.CUSTOMER.matches(a.get("role"));
    }

    private Map<String, Object> customer(String id) {
        Map<String, Object> a = accounts.byId(id);
        if (!isCustomer(a)) throw HttpError.notFound("Không tìm thấy khách hàng");
        return a;
    }

    private Map<String, List<Map<String, Object>>> bookingsByUser() {
        Map<String, List<Map<String, Object>>> out = new HashMap<>();
        for (Map<String, Object> b : core.bookings()) {
            String uid = Maps.str(b, "userId");
            if (!uid.isEmpty()) out.computeIfAbsent(uid, k -> new ArrayList<>()).add(b);
        }
        return out;
    }

    private static boolean openComplaint(Map<String, Object> c) {
        String s = Maps.str(c, "status");
        return "open".equals(s) || "in_progress".equals(s);
    }

    // ───────────────────────── danh sách / tra cứu ─────────────────────────
    /**
     * @param q      email, SĐT, mã đơn (payCode) hoặc tên/mã khách; rỗng = khách mới nhất
     * @param status "active" | "locked" | rỗng (tất cả)
     */
    public Map<String, Object> search(String q, String status, int limit) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        boolean numeric = needle.matches("^[0-9+ .\\-]{5,}$");
        String pk = numeric ? phoneKey(needle) : "";
        int max = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);

        Map<String, List<Map<String, Object>>> byUser = bookingsByUser();
        Map<String, Integer> openCmp = new HashMap<>();
        for (Map<String, Object> c : db.list("complaints"))
            if (openComplaint(c) && !Maps.str(c, "userId").isEmpty()) openCmp.merge(Maps.str(c, "userId"), 1, Integer::sum);

        // Khách có đơn khớp mã đơn / email / SĐT ghi trên đơn (khách có thể đặt hộ với liên hệ khác tài khoản)
        Set<String> viaBooking = new HashSet<>();
        if (!needle.isEmpty()) {
            for (Map<String, Object> b : core.bookings()) {
                String uid = Maps.str(b, "userId");
                if (uid.isEmpty()) continue;
                String code = Maps.str(b, "payCode").toLowerCase();
                boolean hit = code.equals(needle) || Maps.str(b, "id").equalsIgnoreCase(needle)
                        || (needle.length() >= 5 && code.contains(needle))
                        || (needle.contains("@") && Maps.str(b, "email").toLowerCase().contains(needle))
                        || (pk.length() >= 5 && phoneKey(Maps.str(b, "phone")).contains(pk));
                if (hit) viaBooking.add(uid);
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> a : accounts.all()) {
            if (!isCustomer(a)) continue;
            boolean locked = !Accounts.isActive(a);
            if ("locked".equals(status) && !locked) continue;
            if ("active".equals(status) && locked) continue;
            String id = Maps.str(a, "id");
            if (!needle.isEmpty()) {
                String hay = (Maps.str(a, "name") + " " + Maps.str(a, "email") + " " + id + " " + Maps.str(a, "phone")).toLowerCase();
                boolean hit = hay.contains(needle) || (pk.length() >= 5 && phoneKey(Maps.str(a, "phone")).contains(pk)) || viaBooking.contains(id);
                if (!hit) continue;
            }
            List<Map<String, Object>> bs = byUser.getOrDefault(id, List.of());
            long paid = 0;
            String last = "";
            for (Map<String, Object> b : bs) {
                paid += Flow.paidIn(b);
                String at = Maps.str(b, "createdAt");
                if (at.compareTo(last) > 0) last = at;
            }
            rows.add(Maps.of("id", id, "name", a.get("name"), "email", a.get("email"), "phone", Maps.str(a, "phone"), "createdAt", Maps.str(a, "createdAt"),
                    "locked", locked, "bookingCount", bs.size(), "totalPaid", paid, "lastBookingAt", last, "openComplaints", openCmp.getOrDefault(id, 0)));
        }
        rows.sort((x, y) -> Maps.str(y, "createdAt").compareTo(Maps.str(x, "createdAt")));
        int total = rows.size();
        if (rows.size() > max) rows = new ArrayList<>(rows.subList(0, max));
        return Maps.of("ok", true, "customers", rows, "total", total);
    }

    // ───────────────────────── hồ sơ khách ─────────────────────────
    /** @param withPayments có kèm sổ thanh toán hay không (chỉ vai trò có quyền xem thanh toán). */
    public Map<String, Object> detail(String id, boolean withPayments) {
        Map<String, Object> a = customer(id);
        List<Map<String, Object>> bs = new ArrayList<>(bookingsByUser().getOrDefault(id, List.of()));
        bs.sort((x, y) -> Maps.str(y, "createdAt").compareTo(Maps.str(x, "createdAt")));

        List<Map<String, Object>> bookings = new ArrayList<>(), payments = new ArrayList<>();
        long totalPaid = 0;
        int active = 0, completed = 0;
        for (Map<String, Object> b : bs) {
            String st = Flow.norm(b.get("status"));
            long paid = Flow.paidIn(b);
            totalPaid += paid;
            if (Flow.active(st)) active++;
            if (Flow.COMPLETED.equals(st)) completed++;
            bookings.add(Maps.of("id", b.get("id"), "payCode", Maps.str(b, "payCode"), "tourName", Maps.str(b, "tourName"), "date", Maps.str(b, "date"),
                    "pax", Maps.lng(b, "pax"), "status", st, "statusLabel", Flow.label(st), "price", Maps.lng(b, "price"), "paidAmount", paid,
                    "remaining", OpsCore.remaining(b), "createdAt", Maps.str(b, "createdAt")));
            if (withPayments) {
                for (Object o : Maps.list(b.get("payments"))) {
                    Map<String, Object> p = Maps.map(o);
                    if (p == null) continue;
                    payments.add(Maps.of("bookingId", b.get("id"), "payCode", Maps.str(b, "payCode"), "kind", Maps.str(p, "kind"), "amount", Maps.lng(p, "amount"),
                            "at", Maps.str(p, "at"), "byName", Maps.str(p, "byName"), "source", Maps.str(p, "source"), "note", Maps.str(p, "note"),
                            "undone", Maps.bool(p, "undone")));
                }
            }
        }
        payments.sort((x, y) -> Maps.str(y, "at").compareTo(Maps.str(x, "at")));

        List<Map<String, Object>> complaints = new ArrayList<>();
        long now = core.now();
        int openCmp = 0;
        for (Map<String, Object> c : db.list("complaints")) {
            if (!id.equals(Maps.str(c, "userId"))) continue;
            boolean open = openComplaint(c);
            if (open) openCmp++;
            Long due = Times.parse(c.get("dueAt"));
            complaints.add(Maps.of("id", c.get("id"), "payCode", Maps.str(c, "payCode"), "tourName", Maps.str(c, "tourName"), "title", Maps.str(c, "title"),
                    "status", Maps.str(c, "status"), "createdAt", Maps.str(c, "createdAt"), "resolvedAt", Maps.str(c, "resolvedAt"),
                    "assigneeName", Maps.str(c, "assigneeName"), "supportNote", Maps.str(c, "supportNote"), "proposedRefund", Maps.lng(c, "proposedRefund"),
                    "overdue", open && due != null && due < now));
        }
        complaints.sort((x, y) -> Maps.str(y, "createdAt").compareTo(Maps.str(x, "createdAt")));

        List<Map<String, Object>> waitlist = new ArrayList<>();
        for (Map<String, Object> w : db.list("waitlist")) {
            if (!id.equals(Maps.str(w, "userId"))) continue;
            waitlist.add(Maps.of("id", w.get("id"), "tourName", Maps.str(w, "tourName"), "date", Maps.str(w, "date"), "pax", Maps.lng(w, "pax"),
                    "status", Maps.str(w, "status"), "createdAt", Maps.str(w, "createdAt")));
        }
        waitlist.sort((x, y) -> Maps.str(y, "createdAt").compareTo(Maps.str(x, "createdAt")));

        Map<String, Object> out = Maps.of("ok", true, "customer", profile(a),
                "summary", Maps.of("bookingCount", bookings.size(), "activeCount", active, "completedCount", completed, "totalPaid", totalPaid, "openComplaints", openCmp),
                "bookings", bookings, "complaints", complaints, "waitlist", waitlist);
        if (withPayments) out.put("payments", payments);
        return out;
    }

    private static Map<String, Object> profile(Map<String, Object> a) {
        boolean locked = !Accounts.isActive(a);
        Map<String, Object> o = Maps.of("id", a.get("id"), "name", a.get("name"), "email", Maps.str(a, "email"), "phone", Maps.str(a, "phone"),
                "provider", Maps.str(a, "provider"), "createdAt", Maps.str(a, "createdAt"), "locked", locked);
        if (locked) {
            o.put("lockedAt", Maps.str(a, "lockedAt"));
            o.put("lockedByName", Maps.str(a, "lockedByName"));
            o.put("lockReason", Maps.str(a, "lockReason"));
        }
        return o;
    }

    // ───────────────────────── khóa / mở khóa (Admin) ─────────────────────────
    /** Khóa cần lý do (ghi nhật ký). Khách bị khóa không đăng nhập được và mọi phiên cũ bị thu hồi; các đơn đã đặt vẫn giữ nguyên. */
    public Map<String, Object> setLocked(Actor admin, String id, boolean lock, String reason) {
        Map<String, Object> a = customer(id);
        String why = reason == null ? "" : reason.trim();
        if (lock) {
            if (why.length() < 3) throw HttpError.bad("Vui lòng ghi lý do khóa tài khoản", "reason");
            if (!Accounts.isActive(a)) throw HttpError.conflict("Tài khoản này đã bị khóa", null);
        } else if (Accounts.isActive(a)) {
            throw HttpError.conflict("Tài khoản đang hoạt động, không cần mở khóa", null);
        }
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(Maps.str(x, "id"))) return;
            if (lock) {
                x.put("status", "locked");
                x.put("lockedAt", Times.iso(core.now()));
                x.put("lockedBy", admin.id());
                x.put("lockedByName", admin.name());
                x.put("lockReason", why);
            } else {
                x.remove("status");
                x.remove("lockedAt");
                x.remove("lockedBy");
                x.remove("lockedByName");
                x.remove("lockReason");
                x.remove("failedLogins");
                x.remove("lockUntil");
            }
        }));
        if (lock) accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), lock ? "customer.lock" : "customer.unlock", id, lock ? why : "");
        return profile(accounts.byId(id));
    }

    /** Xóa mềm tài khoản khách hàng và thu hồi toàn bộ token đăng nhập. */
    public Map<String, Object> deleteCustomer(Actor admin, String id) {
        Map<String, Object> a = customer(id);
        if (id.equals(admin.id())) throw HttpError.conflict("Không thể tự xóa tài khoản của chính mình", null);
        db.edit("accounts", all -> all.forEach(x -> {
            if (id.equals(Maps.str(x, "id"))) {
                x.put("deletedAt", Times.iso(core.now()));
                x.put("status", "locked");
            }
        }));
        accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), "customer.delete", id, "Xóa tài khoản khách hàng " + Maps.str(a, "name"));
        return Maps.of("ok", true, "message", "Đã xóa tài khoản khách hàng thành công.");
    }
}
