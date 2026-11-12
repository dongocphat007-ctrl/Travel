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
 * Quản trị viên (TASKS giai đoạn 4, 8, 17): duyệt / từ chối đơn đã nhận tiền, duyệt hoàn tiền, duyệt đóng sổ,
 * hủy tour phía công ty. ADMIN không xác nhận tiền (việc của thu ngân) và không tự duyệt bản đóng sổ do chính mình lập.
 */
@Service
@SuppressWarnings("unchecked")
public class AdminOps {
    private final Db db;
    private final OpsCore core;
    private final Refunds refunds;

    public AdminOps(Db db, OpsCore core, Refunds refunds) {
        this.db = db;
        this.core = core;
        this.refunds = refunds;
    }

    /** Hàng đợi duyệt: đơn đã nhận tiền chờ xác nhận, hoàn tiền chờ duyệt, đóng sổ chờ duyệt. */
    public Map<String, Object> queue() {
        List<Map<String, Object>> confirm = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (Flow.PAID_DEPOSIT.equals(st) || Flow.PAID_FULL.equals(st)) confirm.add(core.view(b, Role.ADMIN));
        }
        // 4.1: ngày đi gần nhất lên đầu; cùng ngày thì đơn chờ lâu hơn lên trước
        confirm.sort(Comparator.comparing((Map<String, Object> x) -> Maps.str(x, "date")).thenComparing(x -> Maps.str(x, "statusAt")));
        List<Map<String, Object>> rec = new ArrayList<>();
        for (Map<String, Object> r : db.list("reconciliations")) if ("pending_approval".equals(r.get("status"))) rec.add(r);
        return Maps.of("ok", true, "confirm", confirm, "refunds", refunds.list("pending_approval"), "reconciliations", rec);
    }

    /** 4.1: xác nhận đơn → confirmed (giữ chỗ chính thức). */
    public Map<String, Object> confirm(Actor admin, String bookingId, String note) {
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            if (!Flow.PAID_DEPOSIT.equals(st) && !Flow.PAID_FULL.equals(st)) throw HttpError.conflict("Chỉ xác nhận được đơn đã nhận tiền", "status");
            core.changeStatus(b, Flow.CONFIRMED, admin, note == null || note.isBlank() ? "Admin xác nhận đơn" : note.trim());
            b.remove("needsAttention");
            // 4.4: đơn mới cọc thì ghi hạn thu nốt. Thu SAU chuyến đi (chuyến có thể phát sinh làm thêm giờ):
            // hạn = ngày kết thúc tour + balanceDueDaysAfterTrip (mặc định 3 ngày)
            if (Maps.bool(b, "depositPaid") && !Flow.fullyPaid(b) && Maps.str(b, "balanceDueDate").isEmpty()) {
                java.time.LocalDate end = core.endDate(b);
                if (end != null) {
                    String due = end.plusDays(core.config.i("balanceDueDaysAfterTrip")).toString();
                    b.put("balanceDueDate", due);
                    core.note(b, "balance_due", admin, "Hạn thu nốt phần còn lại (sau chuyến đi): " + due);
                }
            }
        });
        core.audit.log(admin.id(), admin.name(), admin.role(), "booking.confirm", Maps.str(out, "payCode"), note == null ? "" : note);
        core.notifyUser(Maps.str(out, "userId"), "✅ Đơn đã được xác nhận", "Đơn " + out.get("payCode") + " – " + out.get("tourName") + " đã được xác nhận.", "profile", "bcf-" + out.get("id"));
        core.notifyRoles("🧭 Đơn mới cần gán HDV", "Đơn " + out.get("payCode") + " – " + out.get("tourName") + " (" + out.get("date") + ")", "operator.html#assign", "asg-" + out.get("id"), Role.OPERATOR);
        return core.view(out, Role.ADMIN);
    }

    /** 4.2: từ chối kèm lý do; đã thu tiền → hoàn 100% (admin đã quyết nên khoản hoàn ở trạng thái approved, thu ngân thực hiện). */
    public Map<String, Object> reject(Actor admin, String bookingId, String reason) {
        if (reason == null || reason.trim().length() < 3) throw HttpError.bad("Bắt buộc nhập lý do từ chối", "reason");
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            if (!Flow.PAID_DEPOSIT.equals(st) && !Flow.PAID_FULL.equals(st) && !Flow.PENDING_PAYMENT.equals(st))
                throw HttpError.conflict("Chỉ từ chối được đơn chưa xác nhận", "status");
            cancelWithRefund(b, admin, Refunds.SRC_ADMIN, "Admin từ chối: " + reason.trim(), 100);
            b.put("rejectReason", reason.trim());
        });
        core.audit.log(admin.id(), admin.name(), admin.role(), "booking.reject", Maps.str(out, "payCode"), reason.trim());
        core.notifyUser(Maps.str(out, "userId"), "❌ Đơn không được duyệt", "Đơn " + out.get("payCode") + " không được duyệt: " + reason.trim(), "profile", "brj-" + out.get("id"));
        return core.view(out, Role.ADMIN);
    }

    /** Nạp danh sách đơn hàng từ tệp Excel/CSV cho Quản trị viên (Admin). */
    public Map<String, Object> importBookings(Actor admin, List<?> items) {
        if (items == null || items.isEmpty()) throw HttpError.bad("Không có dữ liệu đơn hàng để nhập", "items");
        List<Map<String, Object>> created = new ArrayList<>();
        core.db.edit("bookings", all -> {
            for (Object o : items) {
                Map<String, Object> row = Maps.map(o);
                if (row == null) continue;
                String id = Maps.str(row, "id");
                if (id.isEmpty()) id = "bk_" + vn.travel.util.Ids.hex(5);
                String payCode = Maps.str(row, "payCode");
                if (payCode.isEmpty()) payCode = "TRAVEL-IMP" + (System.currentTimeMillis() % 1000000);
                long price = Maps.lng(row, "price");
                if (price <= 0) price = 3_000_000L;
                long paidAmount = Maps.lng(row, "paidAmount");
                long pax = Math.max(1, Maps.lng(row, "pax"));
                String date = Maps.str(row, "date");
                if (date.isEmpty()) date = core.today().plusDays(7).toString();
                String status = Maps.str(row, "status");
                if (status.isEmpty()) {
                    status = (paidAmount >= price) ? Flow.CONFIRMED : (paidAmount > 0 ? Flow.PAID_DEPOSIT : Flow.PENDING_PAYMENT);
                }
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("id", id);
                b.put("payCode", payCode);
                b.put("tourId", row.get("tourId") != null ? Maps.str(row, "tourId") : "101");
                b.put("tourName", row.get("tourName") != null ? Maps.str(row, "tourName") : "Tour du lịch trải nghiệm");
                b.put("customerName", row.get("customerName") != null ? Maps.str(row, "customerName") : "Khách nhập file");
                b.put("phone", Maps.str(row, "phone"));
                b.put("email", Maps.str(row, "email"));
                b.put("date", date);
                b.put("pax", pax);
                b.put("price", price);
                b.put("deposit", Math.round(price * 0.20));
                b.put("status", status);
                b.put("createdAt", Times.iso(core.now()));
                b.put("statusAt", Times.iso(core.now()));
                if (Flow.CONFIRMED.equals(status)) {
                    b.put("confirmedAt", Times.iso(core.now()));
                    b.put("confirmedBy", admin.id());
                    b.put("confirmedByName", admin.name());
                }
                List<Map<String, Object>> payments = new ArrayList<>();
                if (paidAmount > 0) {
                    Map<String, Object> p = Maps.of(
                            "id", "pay_imp_" + vn.travel.util.Ids.hex(4),
                            "amount", paidAmount,
                            "kind", paidAmount >= price ? "full" : "deposit",
                            "at", Times.iso(core.now()),
                            "byName", admin.name(),
                            "note", "Nhập từ file đơn hàng"
                    );
                    payments.add(p);
                    if (paidAmount >= price) b.put("fullPaid", true);
                    else b.put("depositPaid", true);
                }
                b.put("payments", payments);
                all.add(b);
                created.add(b);
            }
        });
        core.audit.log(admin.id(), admin.name(), admin.role(), "booking.import", "Nạp file", created.size() + " đơn");
        return Maps.of("ok", true, "importedCount", created.size(), "bookings", created);
    }

    /**
     * Hủy đơn: chưa có tiền → cancelled; đã có tiền → refund_pending + hồ sơ hoàn tiền (gọi TRONG khóa sửa đơn).
     * pct = % số tiền đã nhận được hoàn.
     */
    public void cancelWithRefund(Map<String, Object> b, Actor by, String source, String note, int pct) {
        long net = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
        long amount = Math.round(net * pct / 100.0);
        b.put("cancelledAt", Times.iso(core.now()));
        b.put("cancelledBy", by.role());
        if (net <= 0 || amount <= 0) {
            core.changeStatus(b, Flow.CANCELLED, by, note);
        } else {
            core.changeStatus(b, Flow.REFUND_PENDING, by, note + " – hoàn " + amount + " ₫");
            refunds.create(b, source, amount, note, by, !Refunds.SRC_CUSTOMER.equals(source), null);
        }
        b.remove("assignment");
        core.extensions().onOrderCancelled(b, by, source, pct);   // 8.16: phần gia hạn hoàn riêng
        if (pct >= 100) core.vouchers.release(Maps.str(b, "voucherCode"), Maps.str(b, "userId"));   // 8.4: hoàn 100% (admin/công ty hủy) thì hoàn mã; khách tự hủy có phí thì mất mã
    }

    /** 8.3: công ty hủy tour (không đủ khách, bất khả kháng...) – hủy mọi đơn còn hiệu lực của ngày khởi hành, hoàn 100%. */
    public Map<String, Object> companyCancel(Actor admin, String tourId, String date, String reason) {
        return companyCancel(admin, tourId, date, reason, "refund");
    }

    /**
     * 8.5: mode "refund" = hủy mọi đơn và hoàn 100%; mode "offer" = KHÔNG tự hủy, mỗi khách được đề nghị chọn hoàn 100% hoặc đổi sang ngày khác
     * (khác quy tắc khách tự hủy: không phí, không giới hạn đổi một lần). Cả hai mode đều báo CSKH để liên hệ khách.
     */
    public Map<String, Object> companyCancel(Actor admin, String tourId, String date, String reason, String mode) {
        if (mode != null && !mode.isBlank() && !Set.of("refund", "offer").contains(mode)) throw HttpError.bad("Cách xử lý phải là refund hoặc offer", "mode");
        boolean offer = "offer".equals(mode);
        if (reason == null || reason.trim().length() < 3) throw HttpError.bad("Bắt buộc nhập lý do hủy", "reason");
        if (tourId == null || tourId.isBlank() || date == null || date.isBlank()) throw HttpError.bad("Thiếu tour hoặc ngày khởi hành", "date");
        List<String> ids = new ArrayList<>();
        for (Map<String, Object> b : core.bookings())
            if (tourId.equals(Maps.str(b, "tourId")) && date.equals(Maps.str(b, "date")) && Flow.active(b.get("status")) && !Flow.COMPLETED.equals(Flow.norm(b.get("status")))
                    && !Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")))) ids.add(Maps.str(b, "id"));
        int n = 0;
        for (String id : ids) {
            Map<String, Object> out;
            if (offer) {
                out = core.edit(id, b -> {
                    b.put("companyOffer", Maps.of("status", "offered", "reason", reason.trim(), "at", Times.iso(core.now()), "by", admin.id()));
                    core.note(b, "company_cancel", admin, "Công ty hủy chuyến " + date + " – đề nghị khách chọn hoàn 100% hoặc đổi ngày: " + reason.trim());
                });
                core.notifyUser(Maps.str(out, "userId"), "⚠️ Chuyến đi bị hủy – hãy chọn cách xử lý", "Tour " + out.get("tourName") + " ngày " + date + " bị hủy: " + reason.trim() + ". Bạn có thể nhận hoàn 100% hoặc đổi sang ngày khác (không mất phí).", "profile", "cc-" + id);
            } else {
                out = core.edit(id, b -> cancelWithRefund(b, admin, Refunds.SRC_COMPANY, "Công ty hủy tour: " + reason.trim(), 100));
                core.notifyUser(Maps.str(out, "userId"), "⚠️ Tour bị hủy", "Tour " + out.get("tourName") + " ngày " + date + " bị hủy: " + reason.trim() + ". Bạn được hoàn 100%.", "profile", "cc-" + id);
            }
            n++;
        }
        if (n > 0) core.notifyRoles("📞 Liên hệ khách vì công ty hủy chuyến", n + " đơn tour " + core.tours.name(tourId) + " ngày " + date + (offer ? " cần tư vấn chọn hoàn tiền hoặc đổi ngày" : " đã được hoàn 100%, cần thông báo trực tiếp") + ": " + reason.trim(), "support.html#reschedule", "cc-sup-" + tourId + "-" + date, Role.SUPPORT);
        db.edit("departures", all -> all.forEach(d -> {
            if (tourId.equals(Maps.str(d, "tourId")) && date.equals(Maps.str(d, "date"))) { d.put("status", "cancelled"); d.put("cancelReason", reason.trim()); }
        }));
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.company_cancel", tourId + "@" + date, reason.trim() + " (" + n + " đơn)");
        return Maps.of("ok", true, "cancelled", offer ? 0 : n, "offered", offer ? n : 0);
    }


    /** Mọi đơn tour (ADMIN thấy đầy đủ), lọc theo trạng thái / từ khóa. */
    public List<Map<String, Object>> list(String status, String q) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            if (status != null && !status.isEmpty() && !status.equals(Flow.norm(b.get("status")))) continue;
            if (!needle.isEmpty() && !(Maps.str(b, "payCode") + " " + Maps.str(b, "id") + " " + Maps.str(b, "customerName") + " " + Maps.str(b, "tourName")).toLowerCase().contains(needle)) continue;
            out.add(core.view(b, Role.ADMIN));
        }
        out.sort((a, c) -> Maps.str(c, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    // ───── hoàn tiền ─────
    public Map<String, Object> approveRefund(Actor admin, String id, Long amount, String note) { return refunds.approve(admin, id, amount, note); }

    public Map<String, Object> rejectRefund(Actor admin, String id, String note) { return refunds.reject(admin, id, note); }

    // ───── đóng sổ ─────
    public Map<String, Object> reconcileDecision(Actor admin, String id, boolean approve, String note) {
        if (!approve && (note == null || note.isBlank())) throw HttpError.bad("Vui lòng nhập lý do từ chối", "note");
        Map<String, Object>[] out = new Map[1];
        db.edit("reconciliations", all -> {
            for (Map<String, Object> r : all) {
                if (!id.equals(Maps.str(r, "id"))) continue;
                if (!"pending_approval".equals(r.get("status"))) throw HttpError.conflict("Bản đóng sổ này đã được xử lý", null);
                if (admin.id().equals(Maps.str(r, "cashierId"))) throw HttpError.forbidden();   // người lập ≠ người duyệt
                r.put("status", approve ? "approved" : "rejected");
                r.put("approvedById", admin.id());
                r.put("approvedByName", admin.name());
                r.put("approvedAt", Times.iso(core.now()));
                r.put("approveNote", note == null ? "" : note.trim());
                out[0] = r;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy bản đóng sổ");
        core.audit.log(admin.id(), admin.name(), admin.role(), approve ? "reconcile.approve" : "reconcile.reject", id, note == null ? "" : note);
        core.notifyUser(Maps.str(out[0], "cashierId"), approve ? "✅ Bản đóng sổ đã được duyệt" : "❌ Bản đóng sổ bị từ chối", "Ngày " + out[0].get("date") + (note == null || note.isBlank() ? "" : ": " + note), "cashier.html#reconcile", "rcd-" + id);
        return out[0];
    }
}
