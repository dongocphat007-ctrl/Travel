package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Flow;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Hoàn tiền (TASKS 8.1–8.5, 6.8): hồ sơ hoàn tiền ở refunds.json, đi qua
 *   pending_approval (ADMIN duyệt) → approved → paid (CASHIER bấm "Đã hoàn tiền").
 * Nguồn: khách hủy, admin từ chối đơn, công ty hủy, khiếu nại (hoàn một phần).
 * Hoàn toàn đơn (khách hủy / từ chối / công ty hủy) đưa đơn sang refund_pending → refunded; hoàn một phần do khiếu nại không đổi trạng thái đơn.
 * Khóa luôn lấy theo thứ tự bookings → refunds, KHÔNG BAO GIỜ lồng ngược để tránh khóa chéo.
 */
@Service
public class Refunds {
    public static final String SRC_CUSTOMER = "customer_cancel", SRC_ADMIN = "admin_reject", SRC_COMPANY = "company_cancel",
            SRC_COMPLAINT = "complaint", SRC_OVERDUE = "balance_overdue";

    private final Db db;
    private final OpsCore core;

    public Refunds(Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    /** Tạo hồ sơ hoàn tiền cho đơn (gọi TRONG khóa sửa đơn). autoApprove = admin đã quyết (từ chối đơn, công ty hủy). Trả hồ sơ. */
    public Map<String, Object> create(Map<String, Object> booking, String source, long amount, String reason, Actor by, boolean autoApprove, String complaintId) {
        Map<String, Object> r = Maps.of("id", Ids.newId("rf"), "bookingId", booking.get("id"), "payCode", booking.get("payCode"),
                "customerName", booking.get("customerName"), "tourName", booking.get("tourName"), "userId", booking.get("userId"), "amount", amount, "source", source,
                "status", autoApprove ? "approved" : "pending_approval", "reason", reason == null ? "" : reason,
                "requestedById", by.id(), "requestedByName", by.name(), "requestedRole", by.role(), "requestedAt", Times.iso(core.now()),
                "complaintId", complaintId == null ? "" : complaintId, "full", !SRC_COMPLAINT.equals(source));
        if (autoApprove) {
            r.put("approvedById", by.id());
            r.put("approvedAt", Times.iso(core.now()));
        }
        db.edit("refunds", all -> all.add(r));
        if (!SRC_COMPLAINT.equals(source)) booking.put("refundId", r.get("id"));
        if (autoApprove) core.notifyRoles("💸 Có khoản hoàn tiền cần thực hiện", "Đơn " + booking.get("payCode") + ": hoàn " + amount + " ₫", "cashier.html#refunds", "rf-" + r.get("id"), Role.CASHIER);
        else core.notifyRoles("📝 Có yêu cầu hoàn tiền chờ duyệt", "Đơn " + booking.get("payCode") + ": " + amount + " ₫ (" + sourceLabel(source) + ")", "admin.html#refunds", "rfa-" + r.get("id"), Role.ADMIN);
        return r;
    }

    /**
     * Hoàn một PHẦN không đổi trạng thái đơn (gia hạn bị hủy, chênh lệch giá khi đổi ngày). extNo > 0: hoàn tiền gia hạn số đó.
     * Gọi TRONG khóa sửa đơn; không ghi đè refundId của đơn.
     */
    public Map<String, Object> createPartial(Map<String, Object> booking, String source, long amount, String reason, Actor by, boolean autoApprove, int extNo) {
        Map<String, Object> r = Maps.of("id", Ids.newId("rf"), "bookingId", booking.get("id"), "payCode", booking.get("payCode"),
                "customerName", booking.get("customerName"), "tourName", booking.get("tourName"), "userId", booking.get("userId"), "amount", amount, "source", source,
                "status", autoApprove ? "approved" : "pending_approval", "reason", reason == null ? "" : reason,
                "requestedById", by.id(), "requestedByName", by.name(), "requestedRole", by.role(), "requestedAt", Times.iso(core.now()),
                "complaintId", "", "full", false, "extNo", extNo);
        if (autoApprove) { r.put("approvedById", by.id()); r.put("approvedAt", Times.iso(core.now())); }
        db.edit("refunds", all -> all.add(r));
        if (autoApprove) core.notifyRoles("💸 Có khoản hoàn tiền cần thực hiện", "Đơn " + booking.get("payCode") + ": hoàn " + amount + " ₫ (" + reason + ")", "cashier.html#refunds", "rf-" + r.get("id"), Role.CASHIER);
        else core.notifyRoles("📝 Có yêu cầu hoàn tiền chờ duyệt", "Đơn " + booking.get("payCode") + ": " + amount + " ₫ (" + reason + ")", "admin.html#refunds", "rfa-" + r.get("id"), Role.ADMIN);
        return r;
    }

    public static String sourceLabel(String s) {
        return switch (s) {
            case SRC_CUSTOMER -> "khách hủy";
            case SRC_ADMIN -> "admin từ chối đơn";
            case SRC_COMPANY -> "công ty hủy tour";
            case SRC_COMPLAINT -> "đền bù khiếu nại";
            case SRC_OVERDUE -> "quá hạn thanh toán";
            default -> s == null ? "" : s;
        };
    }

    /** Danh sách yêu cầu hoàn tiền (lọc theo trạng thái: pending_approval, approved, paid, rejected). */
    public List<Map<String, Object>> list(String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : db.list("refunds")) {
            if (status == null || status.isBlank() || status.equalsIgnoreCase(Maps.str(r, "status"))) out.add(r);
        }
        out.sort((a, b) -> Objects.compare(Maps.str(b, "requestedAt"), Maps.str(a, "requestedAt"), Comparator.naturalOrder()));
        return out;
    }

    public Map<String, Object> find(String id) {
        for (Map<String, Object> r : db.list("refunds")) if (Maps.str(r, "id").equals(id)) return r;
        return null;
    }

    /** ADMIN duyệt (có thể chỉnh số tiền, không vượt số tiền khách đã trả). */
    public Map<String, Object> approve(Actor admin, String refundId, Long newAmount, String note) {
        Map<String, Object> rf = find(refundId);
        if (rf == null) throw HttpError.notFound("Không tìm thấy yêu cầu hoàn tiền");
        Map<String, Object> b = core.find(Maps.str(rf, "bookingId"));
        long cap = b == null ? Long.MAX_VALUE : Maps.lng(rf, "extNo") > 0 ? Maps.lng(Extensions.find(b, (int) Maps.lng(rf, "extNo")), "amount") : Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
        long amount = newAmount == null ? Maps.lng(rf, "amount") : newAmount;
        if (amount <= 0) throw HttpError.bad("Số tiền hoàn phải lớn hơn 0", "amount");
        if (amount > cap) throw HttpError.bad("Số tiền hoàn vượt quá số tiền khách đã trả (" + cap + " ₫)", "amount");
        Map<String, Object>[] out = new Map[1];
        db.edit("refunds", all -> {
            for (Map<String, Object> r : all) {
                if (!refundId.equals(Maps.str(r, "id"))) continue;
                if (!"pending_approval".equals(r.get("status"))) throw HttpError.conflict("Yêu cầu này đã được xử lý", null);
                r.put("amount", amount);
                r.put("status", "approved");
                r.put("approvedById", admin.id());
                r.put("approvedByName", admin.name());
                r.put("approvedAt", Times.iso(core.now()));
                r.put("approveNote", note == null ? "" : note.trim());
                out[0] = r;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy yêu cầu hoàn tiền");
        if (!Maps.str(rf, "bookingId").isEmpty() && core.find(Maps.str(rf, "bookingId")) != null) {
            core.edit(Maps.str(rf, "bookingId"), x -> core.note(x, "refund", admin, "Admin duyệt hoàn " + amount + " ₫" + (note == null || note.isBlank() ? "" : ": " + note.trim())));
        }
        core.audit.log(admin.id(), admin.name(), admin.role(), "refund.approve", Maps.str(rf, "payCode"), amount + " ₫" + (note == null || note.isEmpty() ? "" : " – " + note));
        core.notifyRoles("💸 Có khoản hoàn tiền cần thực hiện", "Đơn " + rf.get("payCode") + ": hoàn " + amount + " ₫", "cashier.html#refunds", "rf-" + refundId, Role.CASHIER);
        core.notifyUser(Maps.str(rf, "userId"), "✅ Yêu cầu hoàn tiền đã được duyệt", "Đơn " + rf.get("payCode") + ": " + amount + " ₫ sẽ được chuyển về tài khoản của bạn.", "profile", "rfok-" + refundId);
        return out[0];
    }

    /** Chỉ từ chối được khoản đền bù khiếu nại; hoàn tiền do hủy đơn thì admin chỉ chỉnh số tiền. */
    public Map<String, Object> reject(Actor admin, String refundId, String note) {
        if (note == null || note.trim().isEmpty()) throw HttpError.bad("Vui lòng nhập lý do từ chối", "note");
        Map<String, Object>[] out = new Map[1];
        db.edit("refunds", all -> {
            for (Map<String, Object> r : all) {
                if (!refundId.equals(Maps.str(r, "id"))) continue;
                if (!"pending_approval".equals(r.get("status"))) throw HttpError.conflict("Yêu cầu này đã được xử lý", null);
                if (!SRC_COMPLAINT.equals(r.get("source"))) throw HttpError.conflict("Chỉ từ chối được khoản đền bù khiếu nại; hoàn tiền do hủy đơn hãy chỉnh số tiền", null);
                r.put("status", "rejected");
                r.put("approvedById", admin.id());
                r.put("approvedAt", Times.iso(core.now()));
                r.put("approveNote", note.trim());
                out[0] = r;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy yêu cầu hoàn tiền");
        if (!Maps.str(out[0], "bookingId").isEmpty() && core.find(Maps.str(out[0], "bookingId")) != null) core.edit(Maps.str(out[0], "bookingId"), x -> core.note(x, "refund", admin, "Admin từ chối đền bù khiếu nại: " + note.trim()));
        core.audit.log(admin.id(), admin.name(), admin.role(), "refund.reject", Maps.str(out[0], "payCode"), note.trim());
        return out[0];
    }

    /** CASHIER bấm "Đã hoàn tiền": ghi sổ, đơn refund_pending → refunded. */
    public Map<String, Object> pay(Actor cashier, String refundId, String note) {
        if (!Role.CASHIER.name().equals(cashier.role())) throw HttpError.forbidden();
        Map<String, Object> rf = find(refundId);
        if (rf == null) throw HttpError.notFound("Không tìm thấy yêu cầu hoàn tiền");
        if (!"approved".equals(rf.get("status"))) throw HttpError.conflict("Khoản hoàn này chưa được admin duyệt hoặc đã hoàn rồi", null);
        long amount = Maps.lng(rf, "amount");
        boolean full = Maps.bool(rf, "full");
        core.edit(Maps.str(rf, "bookingId"), b -> {
            Flow.addPayment(b, Maps.lng(rf, "extNo") > 0 ? "ext_refund" : "refund", amount, "cashier", cashier.id(), cashier.name(), cashier.role(), note == null ? "" : note, core.now());
            if (full && Flow.REFUND_PENDING.equals(Flow.norm(b.get("status")))) core.changeStatus(b, Flow.REFUNDED, cashier, "Đã hoàn " + amount + " ₫");
            else core.note(b, "refund", cashier, "Đã hoàn " + amount + " ₫" + (full ? "" : " (đền bù khiếu nại)"));
        });
        Map<String, Object>[] out = new Map[1];
        db.edit("refunds", all -> {
            for (Map<String, Object> r : all) {
                if (!refundId.equals(Maps.str(r, "id"))) continue;
                r.put("status", "paid");
                r.put("paidById", cashier.id());
                r.put("paidByName", cashier.name());
                r.put("paidAt", Times.iso(core.now()));
                r.put("payNote", note == null ? "" : note);
                out[0] = r;
            }
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "refund.pay", Maps.str(rf, "payCode"), amount + " ₫");
        core.notifyUser(Maps.str(rf, "userId"), "💸 Đã hoàn tiền", "Đơn " + rf.get("payCode") + ": đã hoàn " + amount + " ₫ về tài khoản của bạn.", "profile", "rfpd-" + refundId);

        // Hoàn tiền vào ví khách hàng (nếu khách có tài khoản)
        String uid = Maps.str(rf, "userId");
        if (uid.isEmpty()) {
            Map<String, Object> b = core.find(Maps.str(rf, "bookingId"));
            if (b != null) uid = Maps.str(b, "userId");
        }
        if (uid != null && !uid.isBlank()) {
            final String targetUid = uid;
            db.edit("accounts", all -> {
                for (Map<String, Object> a : all) {
                    if (targetUid.equals(Maps.str(a, "id"))) {
                        long curBal = Maps.lng(a, "balance");
                        a.put("balance", curBal + amount);
                        break;
                    }
                }
            });
        }
        return out[0];
    }
}
