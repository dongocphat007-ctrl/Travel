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

import java.time.LocalDate;
import java.util.*;

/**
 * Thu ngân (TASKS giai đoạn 3 + 17.2): xác nhận tiền cọc 20% / đủ 100% / thu nốt, xử lý chuyển khoản lệch,
 * hoàn tác thao tác nhầm, thực hiện hoàn tiền và lập bản đóng sổ cuối ngày. ADMIN KHÔNG làm được các việc này (tách người thu tiền và người duyệt đơn).
 */
@Service
@SuppressWarnings("unchecked")
public class CashierOps {
    private final Db db;
    private final OpsCore core;
    private final Refunds refunds;
    private final Mailer mailer;

    public CashierOps(Db db, OpsCore core, Refunds refunds, Mailer mailer) {
        this.db = db;
        this.core = core;
        this.refunds = refunds;
        this.mailer = mailer;
    }

    // ───────────────────────── danh sách việc ─────────────────────────
    /** Hàng đợi của thu ngân: chờ thu cọc/đủ, chờ thu nốt, chuyển khoản lệch, khoản hoàn đã duyệt. */
    public Map<String, Object> queue(String q, String date, String kind) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Map<String, Object>> awaiting = new ArrayList<>(), balance = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (!needle.isEmpty() && !(Maps.str(b, "payCode") + " " + Maps.str(b, "id") + " " + Maps.str(b, "customerName")).toLowerCase().contains(needle)) continue;
            if (date != null && !date.isEmpty() && !Maps.str(b, "createdAt").startsWith(date)) continue;
            if (Flow.PENDING_PAYMENT.equals(st)) {
                if (kind != null && !kind.isEmpty() && !kind.equals(payKindWanted(b))) continue;
                awaiting.add(withDue(b, payKindWanted(b)));
            } else if (Flow.active(st) && Maps.bool(b, "depositPaid") && !Flow.fullyPaid(b)) {
                if (kind != null && !kind.isEmpty() && !kind.equals("final")) continue;
                balance.add(withDue(b, "final"));
            }
        }
        awaiting.sort((a, b) -> Maps.str(a, "createdAt").compareTo(Maps.str(b, "createdAt")));
        balance.sort((a, b) -> Maps.str(a, "balanceDueDate").compareTo(Maps.str(b, "balanceDueDate")));
        List<Map<String, Object>> due = new ArrayList<>();
        for (Map<String, Object> r : refunds.list("approved")) due.add(refundRow(r));
        return Maps.of("ok", true, "awaiting", awaiting, "balance", balance, "discrepancies", discrepancies(), "refunds", due, "recent", recentConfirmations(),
                "undoMinutes", core.config.i("undoMinutes"));
    }

    private Map<String, Object> withDue(Map<String, Object> b, String kind) {
        Map<String, Object> v = core.view(b, Role.CASHIER);
        v.put("dueKind", kind);
        v.put("due", expected(b, kind));
        return v;
    }

    private static String payKindWanted(Map<String, Object> b) { return "full".equals(b.get("payChoice")) ? "full" : "deposit"; }

    private Map<String, Object> refundRow(Map<String, Object> r) {
        Map<String, Object> o = new LinkedHashMap<>(r);
        Map<String, Object> b = core.find(Maps.str(r, "bookingId"));
        if (b != null) o.put("paidAmount", Flow.paidIn(b));
        return o;
    }

    public List<Map<String, Object>> discrepancies() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> p : db.list("payments")) {
            String st = Maps.str(p, "status");
            if (("mismatch".equals(st) || "unmatched".equals(st) || "waiting".equals(st)) && !Maps.bool(p, "dismissed")) out.add(p);
        }
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    /** Các khoản thu nhận trong thời gian còn hoàn tác được (3.7). */
    private List<Map<String, Object>> recentConfirmations() {
        long win = core.config.i("undoMinutes") * 60_000L;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> p = Maps.map(o);
                if (p == null || Maps.bool(p, "undone") || String.valueOf(p.get("kind")).endsWith("refund") || "bank".equals(p.get("source"))) continue;
                Long at = Times.parse(p.get("at"));
                if (at == null || core.now() - at > win) continue;
                out.add(Maps.of("bookingId", b.get("id"), "payCode", b.get("payCode"), "customerName", b.get("customerName"), "paymentId", p.get("id"),
                        "kind", p.get("kind"), "amount", p.get("amount"), "at", p.get("at"), "byName", p.get("byName")));
            }
        }
        return out;
    }

    // ───────────────────────── thù lao hướng dẫn viên ─────────────────────────
    /** Thù lao HDV: các khoản đang chờ chi (gom theo HDV) và các khoản đã chi gần đây. */
    public Map<String, Object> guideFees() {
        List<Map<String, Object>> rows = core.rewards().guideFeeRows(null);
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        List<Map<String, Object>> paid = new ArrayList<>();
        long pendingTotal = 0;
        for (Map<String, Object> r : rows) {
            if (Maps.bool(r, "paid")) {
                if (paid.size() < 100) paid.add(r);
                continue;
            }
            pendingTotal += Maps.lng(r, "fee");
            Map<String, Object> g = groups.computeIfAbsent(Maps.str(r, "guideId"), k -> Maps.of("guideId", k, "guideName", r.get("guideName"), "total", 0L, "items", new ArrayList<Map<String, Object>>()));
            g.put("total", Maps.lng(g, "total") + Maps.lng(r, "fee"));
            ((List<Map<String, Object>>) g.get("items")).add(r);
        }
        paid.sort((a, b) -> Maps.str(b, "paidAt").compareTo(Maps.str(a, "paidAt")));
        return Maps.of("ok", true, "pending", new ArrayList<>(groups.values()), "pendingTotal", pendingTotal, "paid", paid);
    }

    /** Ghi nhận đã chi thù lao cho các đơn (mỗi đơn một lần). Chốt số tiền thù lao vào đơn và báo cho HDV. */
    public Map<String, Object> payGuideFees(Actor cashier, List<?> bookingIds) {
        if (bookingIds == null || bookingIds.isEmpty()) throw HttpError.bad("Chưa chọn khoản thù lao nào", "ids");
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> r : core.rewards().guideFeeRows(null)) byId.put(Maps.str(r, "id"), r);
        int done = 0;
        long sum = 0;
        for (Object o : bookingIds) {
            String id = String.valueOf(o);
            Map<String, Object> row = byId.get(id);
            if (row == null) throw HttpError.notFound("Không tìm thấy khoản thù lao của đơn " + id);
            if (Maps.bool(row, "paid")) continue;
            long fee = Maps.lng(row, "fee");
            core.edit(id, b -> {
                if (!Maps.str(b, "guideFeePaidAt").isEmpty()) return;
                b.put("guideFee", fee);
                b.put("guideFeePaidAt", Times.iso(core.now()));
                b.put("guideFeePaidBy", cashier.id());
                b.put("guideFeePaidByName", cashier.name());
                core.note(b, "guide_fee", cashier, "Đã chi thù lao HDV " + fee + " ₫");
            });
            done++;
            sum += fee;
            core.audit.log(cashier.id(), cashier.name(), cashier.role(), "guide_fee.pay", Maps.str(row, "payCode"), Maps.str(row, "guideName") + ": " + fee + " ₫");
            for (Map<String, Object> a : core.accounts.all())
                if (Maps.str(row, "guideId").equals(Maps.str(a, "guideId")) && Accounts.isActive(a))
                    core.notifyUser(Maps.str(a, "id"), "💰 Bạn đã nhận thù lao", "Đơn " + row.get("payCode") + " – " + row.get("tourName") + ": " + String.format("%,d", fee).replace(',', '.') + " ₫.", "guide.html#earnings", "gfp-" + id);
        }
        if (done == 0) throw HttpError.conflict("Các khoản đã chọn đã được chi trước đó", "ids");
        return Maps.of("ok", true, "paid", done, "amount", sum);
    }

    // ───────────────────────── xác nhận tiền ─────────────────────────
    /** Số tiền đúng phải thu cho từng loại (3.5). */
    public long expected(Map<String, Object> b, String kind) {
        return switch (kind) {
            case "deposit" -> Maps.lng(b, "deposit");
            case "full" -> Maps.lng(b, "price");
            case "final" -> Payments.amountDue(b);
            default -> throw HttpError.bad("Loại thanh toán phải là deposit, full hoặc final", "kind");
        };
    }

    /**
     * Bấm "Đã nhận cọc 20%" / "Đã nhận đủ 100%" / "Đã thu nốt". Số tiền nhập phải đúng; lệch thì báo 409 (code amount_mismatch)
     * và thu ngân dùng {@link #flagDiscrepancy} để ghi nhận chờ xử lý.
     */
    public Map<String, Object> confirm(Actor cashier, String bookingId, String kind, long amount, String note) {
        Map<String, Object> cur = core.require(bookingId);
        long want = expected(cur, kind);
        if (amount != want)
            throw new HttpError(409, "Số tiền nhập (" + amount + " ₫) không khớp số tiền cần thu (" + want + " ₫). Hãy ghi nhận là chuyển khoản lệch để xử lý.", "amount_mismatch");
        return apply(cashier, bookingId, kind, amount, note == null ? "" : note, "cashier");
    }

    /** Ghi nhận tiền vào đơn (dùng cả khi xử lý giao dịch lệch: số tiền là số thực nhận). */
    private Map<String, Object> apply(Actor cashier, String bookingId, String kind, long amount, String note, String source) {
        if (amount <= 0) throw HttpError.bad("Số tiền phải lớn hơn 0", "amount");
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            // thu nốt được phép SAU khi tour hoàn thành (phụ thu làm thêm giờ chỉ biết sau chuyến); cọc/đủ thì không
            if (Flow.inactive(st) || (Flow.COMPLETED.equals(st) && !"final".equals(kind))) throw HttpError.conflict("Đơn đã hủy hoặc đã hoàn thành", null);
            switch (kind) {
                case "deposit", "full" -> {
                    if (!Flow.PENDING_PAYMENT.equals(st)) throw HttpError.conflict("Đơn đã ghi nhận thanh toán, không thu thêm cọc/đủ lần nữa", null);
                    b.put("depositPaid", true);
                    b.put("depositPaidAt", Times.iso(core.now()));
                    if ("full".equals(kind)) b.put("fullPaid", true);
                    Flow.addPayment(b, kind, amount, source, cashier.id(), cashier.name(), cashier.role(), note, core.now());
                    core.changeStatus(b, "full".equals(kind) ? Flow.PAID_FULL : Flow.PAID_DEPOSIT, cashier,
                            ("full".equals(kind) ? "Đã nhận đủ 100%: " : "Đã nhận cọc: ") + amount + " ₫" + (note.isEmpty() ? "" : " – " + note));
                }
                case "final" -> {
                    if (!Maps.bool(b, "depositPaid") || Flow.fullyPaid(b)) throw HttpError.conflict("Đơn chưa đặt cọc hoặc đã thu đủ", null);
                    b.put("finalPaid", true);
                    b.put("finalPaidAt", Times.iso(core.now()));
                    Flow.addPayment(b, "final", amount, source, cashier.id(), cashier.name(), cashier.role(), note, core.now());
                    b.remove("balanceOverdue");
                    if (Flow.PAID_DEPOSIT.equals(st)) core.changeStatus(b, Flow.PAID_FULL, cashier, "Đã thu nốt phần còn lại: " + amount + " ₫");
                    else core.note(b, "payment", cashier, "Đã thu nốt phần còn lại: " + amount + " ₫" + (note.isEmpty() ? "" : " – " + note));
                }
                default -> throw HttpError.bad("Loại thanh toán phải là deposit, full hoặc final", "kind");
            }
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.confirm." + kind, Maps.str(out, "payCode"), amount + " ₫");
        String st = Flow.norm(out.get("status"));
        core.notifyUser(Maps.str(out, "userId"), "💰 Đã nhận tiền", "Đơn " + out.get("payCode") + " – " + out.get("tourName") + ": đã nhận " + amount + " ₫.", "profile", "cpay-" + Ids.hex(4));
        // Gửi hóa đơn điện tử về email của khách
        String custEmail = Maps.str(out, "email");
        if (custEmail != null && !custEmail.isBlank()) {
            try {
                String invHtml = this.mailer.invoiceHtml(out, kind, amount, note);
                this.mailer.send(custEmail, "🧾 Hóa đơn điện tử thanh toán tour " + out.get("payCode") + " – Travel", invHtml);
            } catch (Exception ignored) {
            }
        }
        if (Flow.PAID_DEPOSIT.equals(st) || Flow.PAID_FULL.equals(st))
            core.notifyRoles("🧾 Đơn chờ xác nhận", "Đơn " + out.get("payCode") + " đã nhận tiền, chờ admin xác nhận.", "admin.html#confirm", "cfm-" + out.get("id"), Role.ADMIN);
        return core.view(out, Role.CASHIER);
    }

    // ───────────────────────── chuyển khoản lệch ─────────────────────────
    /** 3.6: chuyển thiếu / thừa / sai nội dung / chuyển hai lần → ghi nhận "chờ xử lý"; cần liên hệ khách thì chuyển cho SUPPORT. */
    public Map<String, Object> flagDiscrepancy(Actor cashier, String bookingId, long received, String problem, String note, boolean handoffSupport) {
        Map<String, Object> b = core.require(bookingId);
        if (problem == null || !Set.of("short", "excess", "wrong_content", "double").contains(problem))
            throw HttpError.bad("Loại lệch phải là short, excess, wrong_content hoặc double", "problem");
        if (received <= 0) throw HttpError.bad("Số tiền thực nhận phải lớn hơn 0", "amount");
        String text = switch (problem) {
            case "short" -> "Chuyển thiếu";
            case "excess" -> "Chuyển thừa";
            case "wrong_content" -> "Sai nội dung chuyển khoản";
            default -> "Chuyển hai lần";
        };
        Map<String, Object> rec = Maps.of("id", Ids.newId("pay"), "txId", "cashier-" + Ids.hex(5), "source", "cashier", "bookingId", b.get("id"), "payCode", b.get("payCode"),
                "amount", received, "content", note == null ? "" : note, "status", "mismatch", "problem", problem, "reason", text + ": nhận " + received + " ₫, cần " + (Flow.PENDING_PAYMENT.equals(Flow.norm(b.get("status"))) ? Maps.lng(b, "deposit") : Payments.amountDue(b)) + " ₫",
                "kind", "", "createdAt", Times.iso(core.now()), "flaggedBy", cashier.id(), "flaggedByName", cashier.name(), "handoff", handoffSupport, "dismissed", false);
        db.edit("payments", all -> all.add(rec));
        core.edit(bookingId, x -> {
            x.put("needsAttention", "payment_discrepancy");
            core.note(x, "payment", cashier, "Ghi nhận chuyển khoản lệch: " + text + " (" + received + " ₫)" + (handoffSupport ? " – chuyển CSKH liên hệ khách" : ""));
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.flag", Maps.str(b, "payCode"), text + " " + received + " ₫");
        if (handoffSupport) core.notifyRoles("📞 Cần liên hệ khách về chuyển khoản lệch", "Đơn " + b.get("payCode") + ": " + text + " (" + received + " ₫).", "support.html#payment-issues", "pd-" + rec.get("id"), Role.SUPPORT);
        return rec;
    }

    /** action: accept_deposit | accept_full | accept_final (ghi nhận theo số thực nhận) | handoff | dismiss. */
    public Map<String, Object> resolveDiscrepancy(Actor cashier, String paymentId, String action, String note) {
        Map<String, Object> pay = null;
        for (Map<String, Object> p : db.list("payments")) if (paymentId.equals(Maps.str(p, "id"))) pay = p;
        if (pay == null) throw HttpError.notFound("Không tìm thấy giao dịch");
        if (!Set.of("mismatch", "unmatched", "waiting").contains(Maps.str(pay, "status"))) throw HttpError.conflict("Giao dịch này đã được xử lý", null);
        String n = note == null ? "" : note.trim();
        final Map<String, Object> rec = pay;
        switch (action == null ? "" : action) {
            case "accept_deposit", "accept_full", "accept_final" -> {
                String bid = Maps.str(rec, "bookingId");
                if (bid.isEmpty()) throw HttpError.bad("Giao dịch chưa gắn với đơn nào (sai mã) — hãy gắn đơn trước", "bookingId");
                if (n.isEmpty()) throw HttpError.bad("Vui lòng ghi chú cách xử lý", "note");
                String kind = action.substring("accept_".length());
                apply(cashier, bid, kind, Maps.lng(rec, "amount"), "Xử lý giao dịch lệch: " + n, "cashier");
                finish(paymentId, "matched", kind, cashier, n);
            }
            case "handoff" -> {
                db.edit("payments", all -> all.forEach(p -> { if (paymentId.equals(Maps.str(p, "id"))) { p.put("handoff", true); p.put("handoffNote", n); } }));
                core.notifyRoles("📞 Cần liên hệ khách về chuyển khoản lệch", "Đơn " + rec.get("payCode") + ": " + rec.get("reason"), "support.html#payment-issues", "pd-" + paymentId, Role.SUPPORT);
            }
            case "dismiss" -> {
                if (n.isEmpty()) throw HttpError.bad("Vui lòng ghi chú lý do bỏ qua", "note");
                finish(paymentId, "dismissed", "", cashier, n);
            }
            default -> throw HttpError.bad("Hành động không hợp lệ", "action");
        }
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.resolve." + action, Maps.str(rec, "payCode"), n);
        for (Map<String, Object> p : db.list("payments")) if (paymentId.equals(Maps.str(p, "id"))) return p;
        return rec;
    }

    /** Gắn giao dịch (sai mã) vào một đơn. */
    public Map<String, Object> attachToBooking(Actor cashier, String paymentId, String bookingId) {
        Map<String, Object> b = core.require(bookingId);
        boolean[] hit = {false};
        db.edit("payments", all -> all.forEach(p -> {
            if (paymentId.equals(Maps.str(p, "id"))) { p.put("bookingId", b.get("id")); p.put("payCode", b.get("payCode")); hit[0] = true; }
        }));
        if (!hit[0]) throw HttpError.notFound("Không tìm thấy giao dịch");
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.attach", Maps.str(b, "payCode"), paymentId);
        return b;
    }

    private void finish(String paymentId, String status, String kind, Actor by, String note) {
        db.edit("payments", all -> all.forEach(p -> {
            if (!paymentId.equals(Maps.str(p, "id"))) return;
            p.put("status", status);
            p.put("kind", kind);
            p.put("handledBy", by.id());
            p.put("handledAt", Times.iso(core.now()));
            p.put("reason", note);
            if ("dismissed".equals(status)) p.put("dismissed", true);
        }));
    }

    // ───────────────────────── hoàn tác ─────────────────────────
    /** 3.7: hoàn tác thao tác nhầm trong thời gian ngắn, bắt buộc lý do, ghi lịch sử. */
    public Map<String, Object> undo(Actor cashier, String bookingId, String paymentId, String reason) {
        if (reason == null || reason.trim().length() < 3) throw HttpError.bad("Bắt buộc nhập lý do hoàn tác", "reason");
        Map<String, Object> out = core.edit(bookingId, b -> {
            Map<String, Object> hit = null;
            List<Object> list = Maps.list(b.get("payments"));
            for (Object o : list) { Map<String, Object> p = Maps.map(o); if (p != null && paymentId.equals(Maps.str(p, "id"))) hit = p; }
            if (hit == null) throw HttpError.notFound("Không tìm thấy khoản thu");
            if (Maps.bool(hit, "undone")) throw HttpError.conflict("Khoản thu này đã được hoàn tác", null);
            String kind = Maps.str(hit, "kind");
            if (kind.endsWith("refund") || "ext".equals(kind)) throw HttpError.conflict("Không hoàn tác được khoản hoàn tiền", null);
            if ("bank".equals(hit.get("source"))) throw HttpError.conflict("Giao dịch ngân hàng tự động không hoàn tác được — hãy dùng chức năng chuyển khoản lệch", null);
            Long at = Times.parse(hit.get("at"));
            if (at == null || core.now() - at > core.config.i("undoMinutes") * 60_000L)
                throw HttpError.conflict("Đã quá " + core.config.i("undoMinutes") + " phút, không hoàn tác được. Hãy nhờ admin xử lý.", null);
            String st = Flow.norm(b.get("status"));
            if (!("final".equals(kind)) && !(Flow.PAID_DEPOSIT.equals(st) || Flow.PAID_FULL.equals(st)))
                throw HttpError.conflict("Đơn đã được admin xác nhận hoặc đã đổi trạng thái, không hoàn tác được", null);
            hit.put("undone", true);
            hit.put("undoneAt", Times.iso(core.now()));
            hit.put("undoneBy", cashier.id());
            hit.put("undoReason", reason.trim());
            boolean dep = false, full = false, fin = false;
            for (Object o : list) {
                Map<String, Object> p = Maps.map(o);
                if (p == null || Maps.bool(p, "undone")) continue;
                String k = Maps.str(p, "kind");
                if ("deposit".equals(k)) dep = true;
                if ("full".equals(k)) { dep = true; full = true; }
                if ("final".equals(k)) fin = true;
            }
            b.put("depositPaid", dep);
            b.put("fullPaid", full);
            b.put("finalPaid", fin);
            String text = "Hoàn tác khoản " + kind + " " + Maps.lng(hit, "amount") + " ₫ – " + reason.trim();
            if (Flow.PAID_DEPOSIT.equals(st) || Flow.PAID_FULL.equals(st)) {
                String to = !dep ? Flow.PENDING_PAYMENT : (full || fin) ? Flow.PAID_FULL : Flow.PAID_DEPOSIT;
                if (to.equals(st)) core.note(b, "undo", cashier, text);
                else core.changeStatus(b, to, cashier, text);
            } else {
                core.note(b, "undo", cashier, text);
            }
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.undo", Maps.str(out, "payCode"), reason.trim());
        return core.view(out, Role.CASHIER);
    }

    // ───────────────────────── đóng sổ cuối ngày & doanh thu theo ngày ─────────────────────────
    public static String kindLabel(String k) {
        if (k == null || k.isEmpty()) return "Khác";
        return switch (k) {
            case "deposit" -> "Cọc 20%";
            case "full" -> "Thu đủ 100%";
            case "final" -> "Thu nốt";
            case "counter" -> "Thu trực tiếp tại quầy";
            case "manual" -> "Thu thủ công";
            case "ticket" -> "Bán vé tại quầy";
            case "service" -> "Dịch vụ phát sinh";
            case "imported" -> "Sao kê / Import";
            case "refund", "customer_cancel_refund", "admin_reject_refund", "company_cancel_refund", "complaint_refund" -> "Hoàn tiền";
            default -> k;
        };
    }

    /** Số liệu tự tính của một ngày (giờ Việt Nam): tiền thu, tiền hoàn, số giao dịch. */
    public Map<String, Object> dayTotals(String date) {
        long in = 0, out = 0;
        int n = 0;
        for (Map<String, Object> b : core.bookings()) {
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> p = Maps.map(o);
                if (p == null || Maps.bool(p, "undone")) continue;
                Long at = Times.parse(p.get("at"));
                if (at == null || !Times.todayVN(at).toString().equals(date)) continue;
                if (String.valueOf(p.get("kind")).endsWith("refund")) out += Maps.lng(p, "amount");
                else in += Maps.lng(p, "amount");
                n++;
            }
        }
        for (Map<String, Object> dr : db.list("daily_revenues")) {
            if (!date.equals(Maps.str(dr, "date"))) continue;
            long amt = Maps.lng(dr, "amount");
            if ("refund".equals(dr.get("kind")) || amt < 0) out += Math.abs(amt);
            else in += amt;
            n++;
        }
        return Maps.of("date", date, "totalCollected", in, "totalRefunded", out, "net", in - out, "transactionCount", n);
    }

    /** Dashboard thống kê chi tiết theo ngày: KPI, danh sách giao dịch chi tiết và 7 ngày gần nhất. */
    public Map<String, Object> dayStats(String date) {
        String d = date == null || date.isEmpty() ? core.today().toString() : date.trim();
        long in = 0, out = 0;
        List<Map<String, Object>> items = new ArrayList<>();

        for (Map<String, Object> b : core.bookings()) {
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> p = Maps.map(o);
                if (p == null || Maps.bool(p, "undone")) continue;
                Long at = Times.parse(p.get("at"));
                if (at == null || !Times.todayVN(at).toString().equals(d)) continue;
                boolean isRef = String.valueOf(p.get("kind")).endsWith("refund");
                long amt = Maps.lng(p, "amount");
                if (isRef) out += amt;
                else in += amt;

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", p.get("id"));
                row.put("payCode", b.get("payCode"));
                row.put("bookingId", b.get("id"));
                row.put("customerName", b.get("customerName"));
                row.put("tourName", b.get("tourName"));
                row.put("kind", p.get("kind"));
                row.put("kindLabel", kindLabel(Maps.str(p, "kind")));
                row.put("amount", amt);
                row.put("isRefund", isRef);
                row.put("at", p.get("at"));
                row.put("byName", p.get("byName"));
                row.put("note", p.get("note"));
                row.put("source", "booking");
                items.add(row);
            }
        }

        for (Map<String, Object> dr : db.list("daily_revenues")) {
            if (!d.equals(Maps.str(dr, "date"))) continue;
            long amt = Maps.lng(dr, "amount");
            boolean isRef = "refund".equals(dr.get("kind")) || amt < 0;
            long absAmt = Math.abs(amt);
            if (isRef) out += absAmt;
            else in += absAmt;

            Map<String, Object> row = new LinkedHashMap<>(dr);
            row.put("amount", absAmt);
            row.put("isRefund", isRef);
            if (row.get("at") == null) row.put("at", dr.get("createdAt"));
            if (row.get("kindLabel") == null) row.put("kindLabel", kindLabel(Maps.str(dr, "kind")));
            items.add(row);
        }

        items.sort((a, b) -> Maps.str(b, "at").compareTo(Maps.str(a, "at")));

        int awaiting = 0, balance = 0;
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (Flow.PENDING_PAYMENT.equals(st)) awaiting++;
            else if (Flow.active(st) && Maps.bool(b, "depositPaid") && !Flow.fullyPaid(b)) balance++;
        }

        List<Map<String, Object>> recentDays = new ArrayList<>();
        LocalDate target = vn.travel.util.GuideAvailability.parse(d);
        if (target != null) {
            for (int i = 6; i >= 0; i--) {
                String prevD = target.minusDays(i).toString();
                recentDays.add(dayTotals(prevD));
            }
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("date", d);
        res.put("totalCollected", in);
        res.put("totalRefunded", out);
        res.put("net", in - out);
        res.put("transactionCount", items.size());
        res.put("awaiting", awaiting);
        res.put("balanceDue", balance);
        res.put("discrepancies", discrepancies().size());
        res.put("refundsDue", refunds.list("approved").size());
        res.put("items", items);
        res.put("recentDays", recentDays);
        return res;
    }

    /** Thêm khoản doanh thu thủ công theo ngày (bán vé ngoài quầy, thu bổ sung, v.v.). */
    public Map<String, Object> addDailyRevenue(Actor by, Map<String, Object> in) {
        String date = Maps.str(in, "date").trim();
        if (date.isEmpty()) date = core.today().toString();
        if (vn.travel.util.GuideAvailability.parse(date) == null) throw HttpError.bad("Ngày không hợp lệ (định dạng YYYY-MM-DD)", "date");
        long amount = Maps.lng(in, "amount");
        if (amount <= 0) throw HttpError.bad("Số tiền phải lớn hơn 0", "amount");
        String kind = Maps.str(in, "kind").trim();
        if (kind.isEmpty()) kind = "counter";
        String customerName = Maps.str(in, "customerName").trim();
        if (customerName.isEmpty()) customerName = "Khách lẻ tại quầy";
        String tourName = Maps.str(in, "tourName").trim();
        if (tourName.isEmpty()) tourName = "Dịch vụ tour";
        String payCode = Maps.str(in, "payCode").trim();
        if (payCode.isEmpty()) payCode = "REV" + (System.currentTimeMillis() % 1000000);
        String note = Maps.str(in, "note").trim();
        String id = Ids.newId("dr");

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("date", date);
        row.put("amount", amount);
        row.put("kind", kind);
        row.put("kindLabel", kindLabel(kind));
        row.put("customerName", customerName);
        row.put("tourName", tourName);
        row.put("payCode", payCode);
        row.put("note", note);
        row.put("source", in.get("source") != null ? Maps.str(in, "source") : "manual");
        row.put("by", by.id());
        row.put("byName", by.name());
        row.put("byRole", by.role());
        row.put("createdAt", Times.iso(core.now()));
        row.put("at", Times.iso(core.now()));

        db.edit("daily_revenues", all -> all.add(row));
        core.audit.log(by.id(), by.name(), by.role(), "daily_revenue.add", payCode, amount + " ₫ (" + date + ")");
        return row;
    }

    /** Nạp hàng loạt khoản doanh thu theo ngày từ Excel/CSV. */
    public Map<String, Object> importDailyRevenues(Actor by, List<?> items) {
        if (items == null || items.isEmpty()) throw HttpError.bad("Không có dữ liệu nhập", "items");
        List<Map<String, Object>> created = new ArrayList<>();
        for (Object o : items) {
            Map<String, Object> item = Maps.map(o);
            if (item == null) continue;
            try {
                item.put("source", "imported");
                created.add(addDailyRevenue(by, item));
            } catch (Exception ignored) {
            }
        }
        return Maps.of("ok", true, "importedCount", created.size(), "items", created);
    }

    /** Xóa khoản doanh thu thủ công (nếu nhập sai). */
    public Map<String, Object> deleteDailyRevenue(Actor by, String id) {
        boolean[] removed = {false};
        db.edit("daily_revenues", all -> removed[0] = all.removeIf(x -> id.equals(Maps.str(x, "id"))));
        if (!removed[0]) throw HttpError.notFound("Không tìm thấy bản ghi doanh thu");
        core.audit.log(by.id(), by.name(), by.role(), "daily_revenue.delete", id, "Xóa khoản doanh thu thủ công");
        return Maps.of("ok", true);
    }

    public Map<String, Object> reconcileCreate(Actor cashier, String date, long bankStatementTotal, String note) {
        String d = date == null || date.isEmpty() ? core.today().toString() : date;
        if (vn.travel.util.GuideAvailability.parse(d) == null) throw HttpError.bad("Ngày không hợp lệ", "date");
        if (LocalDate.parse(d).isAfter(core.today())) throw HttpError.bad("Không đóng sổ cho ngày chưa tới", "date");
        if (bankStatementTotal < 0) throw HttpError.bad("Số tiền trên sao kê không hợp lệ", "bankStatementTotal");
        Map<String, Object> t = dayTotals(d);
        long net = Maps.lng(t, "net");
        long diff = bankStatementTotal - net;
        if (diff != 0 && (note == null || note.trim().isEmpty())) throw HttpError.bad("Có chênh lệch " + diff + " ₫ — vui lòng ghi chú giải trình", "note");
        String id = "rec_" + d.replace("-", "");
        Map<String, Object> rec = Maps.of("id", id, "date", d, "cashierId", cashier.id(), "cashierName", cashier.name(), "totalCollected", t.get("totalCollected"),
                "totalRefunded", t.get("totalRefunded"), "netTotal", net, "bankStatementTotal", bankStatementTotal, "discrepancy", diff, "transactionCount", t.get("transactionCount"),
                "status", "pending_approval", "note", note == null ? "" : note.trim(), "createdAt", Times.iso(core.now()));
        db.edit("reconciliations", all -> {
            for (Map<String, Object> r : all)
                if (id.equals(Maps.str(r, "id")) && !"rejected".equals(r.get("status"))) throw HttpError.conflict("Ngày " + d + " đã có bản đóng sổ (" + Maps.str(r, "status") + ")", "date");
            all.removeIf(r -> id.equals(Maps.str(r, "id")));
            all.add(rec);
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "reconcile.create", id, "Chênh lệch " + diff + " ₫");
        core.notifyRoles("📒 Bản đóng sổ chờ duyệt", "Ngày " + d + (diff != 0 ? " – có chênh lệch " + diff + " ₫" : " – khớp sao kê"), "admin.html#reconcile", "rc-" + id, Role.ADMIN);
        return rec;
    }

    public List<Map<String, Object>> reconciliations(String cashierId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : db.list("reconciliations")) if (cashierId == null || cashierId.equals(Maps.str(r, "cashierId"))) out.add(r);
        out.sort((a, b) -> Maps.str(b, "date").compareTo(Maps.str(a, "date")));
        return out;
    }

    /** Thu ngân chỉ xem tổng thu trong ngày (15.14). */
    public Map<String, Object> todayStats() {
        Map<String, Object> t = dayTotals(core.today().toString());
        int awaiting = 0, balance = 0;
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (Flow.PENDING_PAYMENT.equals(st)) awaiting++;
            else if (Flow.active(st) && Maps.bool(b, "depositPaid") && !Flow.fullyPaid(b)) balance++;
        }
        t.put("awaiting", awaiting);
        t.put("balanceDue", balance);
        t.put("discrepancies", discrepancies().size());
        t.put("refundsDue", refunds.list("approved").size());
        return t;
    }
}
