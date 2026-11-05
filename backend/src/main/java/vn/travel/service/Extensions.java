package vn.travel.service;

import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.*;
import vn.travel.web.HttpError;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Gia hạn thêm ngày (8.7–8.18). Mỗi lần gia hạn là một phần tử trong mảng {@code extensions} của đơn (không sửa đè đơn gốc):
 * {no, days, amount, status, paymentCode, ...}. Trạng thái: requested (đang đi tour, chờ duyệt) → approved → paid;
 * hoặc pending_payment (xin trước chuyến, tự duyệt) → paid; rejected / cancelled / expired.
 * Khi paid mới cộng vào {@code extraDays} (ngày kết thúc thực tế, lịch HDV, thời hạn đánh giá đều tính từ đây).
 * Thu 100% (không cọc), mã thanh toán riêng TRAVEL&lt;số&gt;-EXT&lt;n&gt;.
 */
public final class Extensions {
    public static final Set<String> OPEN = Set.of("requested", "approved", "pending_payment");
    private static final Set<String> BEFORE_TRIP = Set.of(Flow.CONFIRMED, Flow.GUIDE_PENDING, Flow.GUIDE_ACCEPTED);
    private final OpsCore core;

    Extensions(OpsCore core) { this.core = core; }

    // ───────────────────────── truy xuất ─────────────────────────
    public static List<Map<String, Object>> list(Map<String, Object> b) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : Maps.list(b.get("extensions"))) { Map<String, Object> m = Maps.map(o); if (m != null) out.add(m); }
        return out;
    }

    public static Map<String, Object> find(Map<String, Object> b, int no) {
        for (Map<String, Object> e : list(b)) if (Maps.lng(e, "no") == no) return e;
        return null;
    }

    /** Số ngày gia hạn đã giữ lịch nhưng chưa thanh toán (để HDV không bị gán đè). */
    public static int reservedDays(Map<String, Object> b) {
        int n = 0;
        for (Map<String, Object> e : list(b)) if ("approved".equals(e.get("status")) || "pending_payment".equals(e.get("status"))) n += (int) Maps.lng(e, "days");
        return n;
    }

    private Map<String, Object> mine(Map<String, Object> user, String id) {
        Map<String, Object> b = core.find(id);
        if (b == null || !Maps.str(b, "userId").equals(Maps.str(user, "id"))) throw HttpError.notFound("Không tìm thấy đơn");
        return b;
    }

    // ───────────────────────── điều kiện + giá ─────────────────────────
    /** 8.8, 8.13, 8.15: lý do KHÔNG gia hạn được (rỗng = được). skipOpen: bỏ qua kiểm tra "đang có yêu cầu mở" (khi chính yêu cầu đó đang được duyệt). */
    List<String> problems(Map<String, Object> b, int days, boolean skipOpen) {
        List<String> p = new ArrayList<>();
        String st = Flow.norm(b.get("status"));
        boolean during = Flow.IN_PROGRESS.equals(st);
        if (!during && !BEFORE_TRIP.contains(st)) { p.add("Chỉ gia hạn được khi đơn đã xác nhận và chưa kết thúc"); return p; }
        Map<String, Object> tour = core.tourOf(b);
        if (tour != null && Boolean.FALSE.equals(tour.get("allowExtension"))) p.add("Tour này không cho gia hạn");
        int max = core.config.i("extension", "maxDays");
        int taken = (int) Maps.lng(b, "extraDays") + (skipOpen ? 0 : reservedDays(b));
        if (days < 1 || days > max) p.add("Chỉ gia hạn từ 1 đến " + max + " ngày");
        else if (taken + days > max) p.add("Tổng ngày gia hạn tối đa " + max + " ngày (đã có " + taken + ")");
        if (!skipOpen) for (Map<String, Object> e : list(b)) if (OPEN.contains(Maps.str(e, "status"))) { p.add("Đang có một yêu cầu gia hạn chưa xử lý xong"); break; }
        LocalDate end = core.endDate(b);
        if (end == null) { p.add("Ngày đi không hợp lệ"); return p; }
        long deadline = end.plusDays(1).atStartOfDay(Times.VN).toInstant().toEpochMilli() - core.config.i("extension", "noticeHours") * 3_600_000L;
        if (core.now() > deadline) p.add("Phải xin gia hạn trước ngày cuối ít nhất " + core.config.i("extension", "noticeHours") + " giờ");
        String gid = core.canonGuide(Maps.str(b, "guideId"));
        if (!gid.isEmpty() && (during || Flow.GUIDE_PENDING.equals(st) || Flow.GUIDE_ACCEPTED.equals(st))) {
            Map<String, Object> g = core.guide(gid);
            if (g != null && days >= 1) {
                int total = core.daysOf(b) + days;
                for (String c : core.guideConflicts(g, Maps.str(b, "id"), Maps.str(b, "date"), total)) p.add("HDV không rảnh: " + c);
            }
        }
        if (Flow.CONFIRMED.equals(st) || Flow.GUIDE_PENDING.equals(st) || Flow.GUIDE_ACCEPTED.equals(st) || during) {
            // 8.13: chuyến khởi hành bị đóng/hủy thì không gia hạn (khách sạn/xe theo ngày mới do Điều hành xác nhận khi duyệt)
            for (Map<String, Object> d : core.db.list("departures"))
                if (Maps.str(b, "tourId").equals(Maps.str(d, "tourId")) && Maps.str(b, "date").equals(Maps.str(d, "date")) && "cancelled".equals(d.get("status"))) p.add("Chuyến khởi hành đã bị hủy");
        }
        return p;
    }

    /** 8.9, 8.14, 8.18: giá phần ngày thêm bằng Pricing.compute (hàm tính giá duy nhất), thu 100%. */
    public Map<String, Object> quote(Map<String, Object> b, int days) {
        Map<String, Object> tour = core.tourOf(b);
        long full = Math.round(Pricing.num(tour == null ? null : tour.get("price")));
        int tourDays = Math.max(1, Guides.tourDays(b));
        if (full <= 0) full = Math.max(0, Maps.lng(Maps.map(b.get("priceBreakdown")), "base")) / Math.max(1, Maps.lng(b, "adults") + Maps.lng(b, "children") / 2);
        double perDay = full / (double) tourDays * (1 + core.config.i("extension", "surchargePct") / 100.0);
        Map<String, Object> hire = Maps.map(b.get("guideHire"));
        boolean hdv = hire != null && Maps.bool(hire, "enabled");
        Map<String, Object> voucher = reusableVoucher(b);
        Map<String, Object> bd = Pricing.compute(new Pricing.Input(Math.round(perDay * days), Maps.lng(b, "adults"), Maps.lng(b, "children"), Maps.lng(b, "infants"),
                hdv, hire == null ? 0 : hire.get("hoursPerDay"), days, voucher));
        return Maps.of("days", days, "perDay", Math.round(perDay), "surchargePct", core.config.i("extension", "surchargePct"), "breakdown", bd, "amount", Maps.lng(bd, "final"),
                "discount", Maps.lng(bd, "discount"), "voucherCode", bd.get("voucherCode"));
    }

    /** 8.18: voucher của đơn gốc, chỉ áp lại khi còn hợp lệ (chưa bị tắt, chưa hết hạn). */
    private Map<String, Object> reusableVoucher(Map<String, Object> b) {
        String code = Maps.str(b, "voucherCode");
        if (code.isEmpty()) return null;
        Map<String, Object> v = core.vouchers.find(code);
        if (v == null || Maps.bool(v, "disabled")) return null;
        Long end = Times.parse(v.get("endAt"));
        if (end != null && core.now() >= end) return null;
        return v;
    }

    public Map<String, Object> preview(Map<String, Object> user, String id, int days) {
        Map<String, Object> b = mine(user, id);
        List<String> pr = problems(b, days, false);
        Map<String, Object> q = days >= 1 ? quote(b, days) : new LinkedHashMap<String, Object>();
        return Maps.of("ok", true, "canExtend", pr.isEmpty(), "problems", pr, "quote", q, "maxDays", core.config.i("extension", "maxDays"),
                "extensions", list(b), "newEndDate", String.valueOf(core.endDate(b) == null ? "" : core.endDate(b).plusDays(Math.max(0, days))));
    }

    // ───────────────────────── khách ─────────────────────────
    /** 8.7, 8.12: khách xin gia hạn. Trước chuyến → chờ thanh toán ngay; đang đi → chờ Điều hành duyệt. */
    public Map<String, Object> request(Map<String, Object> user, String id, int days, String note) {
        mine(user, id);
        Actor me = Actor.customer(user);
        Map<String, Object> out = core.edit(id, b -> {
            List<String> pr = problems(b, days, false);
            if (!pr.isEmpty()) throw new HttpError(409, pr.get(0), "extension");
            boolean during = Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")));
            Map<String, Object> q = quote(b, days);
            int no = list(b).size() + 1;
            Map<String, Object> e = new LinkedHashMap<>(Maps.of("no", no, "days", days, "amount", q.get("amount"), "discount", q.get("discount"), "voucherCode", q.get("voucherCode"),
                    "priceBreakdown", q.get("breakdown"), "status", during ? "requested" : "pending_payment", "phase", during ? "during" : "before",
                    "paymentCode", Maps.str(b, "payCode") + "-EXT" + no, "note", note == null ? "" : note.trim(), "requestedAt", Times.iso(core.now()), "requestedBy", me.id()));
            List<Object> all = new ArrayList<>(Maps.list(b.get("extensions")));
            all.add(e);
            b.put("extensions", all);
            core.note(b, "extension", me, "Khách xin gia hạn " + days + " ngày (" + q.get("amount") + " ₫, mã " + e.get("paymentCode") + ")");
        });
        Map<String, Object> e = last(out);
        core.audit.log(me.id(), me.name(), me.role(), "extension.request", Maps.str(out, "payCode"), days + " ngày");
        if ("requested".equals(e.get("status")))
            core.notifyRoles("➕ Khách đang đi xin gia hạn", "Đơn " + out.get("payCode") + ": thêm " + days + " ngày", "operator.html#extensions", "ex-" + id + "-" + e.get("no"), Role.OPERATOR);
        else core.notifyUser(Maps.str(out, "userId"), "➕ Hãy thanh toán phần gia hạn", "Đơn " + out.get("payCode") + ": thêm " + days + " ngày = " + e.get("amount") + " ₫. Nội dung chuyển khoản: " + e.get("paymentCode"), "profile", "exp-" + id + "-" + e.get("no"));
        return Maps.of("ok", true, "extension", e);
    }

    private static Map<String, Object> last(Map<String, Object> b) {
        List<Map<String, Object>> l = list(b);
        return l.get(l.size() - 1);
    }

    /** 8.16: hủy phần gia hạn (trước chuyến đi), hoàn tiền riêng theo bảng hoàn, không ảnh hưởng đơn gốc. */
    public Map<String, Object> cancel(Map<String, Object> user, String id, int no) {
        mine(user, id);
        Actor me = Actor.customer(user);
        Map<String, Object>[] refund = new Map[1];
        Map<String, Object> out = core.edit(id, b -> {
            Map<String, Object> e = find(b, no);
            if (e == null) throw HttpError.notFound("Không tìm thấy lần gia hạn");
            String es = Maps.str(e, "status");
            String st = Flow.norm(b.get("status"));
            if (!OPEN.contains(es) && !"paid".equals(es)) throw HttpError.conflict("Lần gia hạn này không hủy được", "status");
            if ("paid".equals(es)) {
                if (!BEFORE_TRIP.contains(st)) throw HttpError.conflict("Chuyến đã bắt đầu, không hủy được phần gia hạn", "status");
                for (Map<String, Object> o : list(b)) if (Maps.lng(o, "no") > no && "paid".equals(o.get("status"))) throw HttpError.conflict("Hãy hủy lần gia hạn sau trước", "status");
                long daysBefore = java.time.temporal.ChronoUnit.DAYS.between(core.today(), GuideAvailability.parse(b.get("date")));
                int pct = core.config.refundPct(Math.max(0, daysBefore));
                long amount = Math.round(Maps.lng(e, "amount") * pct / 100.0);
                b.put("extraDays", Math.max(0, Maps.lng(b, "extraDays") - Maps.lng(e, "days")));
                shiftBalanceDue(b);
                e.put("refundPct", pct);
                e.put("refundAmount", amount);
                if (amount > 0) refund[0] = refunds().createPartial(b, Refunds.SRC_CUSTOMER, amount, "Hủy gia hạn " + e.get("paymentCode"), me, false, no);
            }
            e.put("status", "cancelled");
            e.put("cancelledAt", Times.iso(core.now()));
            core.note(b, "extension", me, "Khách hủy gia hạn " + e.get("paymentCode") + (refund[0] == null ? "" : " – hoàn " + refund[0].get("amount") + " ₫ (chờ duyệt)"));
        });
        core.audit.log(me.id(), me.name(), me.role(), "extension.cancel", Maps.str(out, "payCode"), "EXT" + no);
        return Maps.of("ok", true, "extension", find(out, no), "refund", refund[0]);
    }

    // ───────────────────────── điều hành duyệt (đang đi tour) ─────────────────────────
    public List<Map<String, Object>> requested() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings())
            for (Map<String, Object> e : list(b)) {
                if (!"requested".equals(e.get("status"))) continue;
                Map<String, Object> v = core.view(b, Role.OPERATOR);
                v.put("extension", e);
                v.put("problems", problems(b, (int) Maps.lng(e, "days"), true));
                out.add(v);
            }
        out.sort((a, c) -> Maps.str(a, "date").compareTo(Maps.str(c, "date")));
        return out;
    }

    public Map<String, Object> decide(Actor staff, String id, int no, boolean approve, String note) {
        if (!approve && (note == null || note.isBlank())) throw HttpError.bad("Vui lòng ghi lý do từ chối", "note");
        Map<String, Object> out = core.edit(id, b -> {
            Map<String, Object> e = find(b, no);
            if (e == null || !"requested".equals(e.get("status"))) throw HttpError.conflict("Không có yêu cầu gia hạn đang chờ", null);
            if (approve) {
                if (!Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")))) throw HttpError.conflict("Đơn không còn đang đi tour", "status");
                List<String> pr = problems(b, (int) Maps.lng(e, "days"), true);
                if (!pr.isEmpty()) throw new HttpError(409, pr.get(0), "extension");
            }
            e.put("status", approve ? "approved" : "rejected");
            e.put("decidedBy", staff.id());
            e.put("decidedAt", Times.iso(core.now()));
            e.put("decisionNote", note == null ? "" : note.trim());
            core.note(b, "extension", staff, (approve ? "Duyệt gia hạn " : "Từ chối gia hạn ") + e.get("paymentCode") + (note == null || note.isBlank() ? "" : " – " + note.trim()));
        });
        Map<String, Object> e = find(out, no);
        core.audit.log(staff.id(), staff.name(), staff.role(), approve ? "extension.approve" : "extension.reject", Maps.str(out, "payCode"), "EXT" + no);
        core.notifyUser(Maps.str(out, "userId"), approve ? "✅ Đã duyệt gia hạn" : "❌ Chưa gia hạn được",
                approve ? "Đơn " + out.get("payCode") + ": thanh toán " + e.get("amount") + " ₫, nội dung chuyển khoản " + e.get("paymentCode") : "Đơn " + out.get("payCode") + ": " + note, "profile", "exd-" + id + "-" + no);
        return Maps.of("ok", true, "extension", e);
    }

    // ───────────────────────── thanh toán ─────────────────────────
    /** Danh sách gia hạn chờ thu (cho thu ngân). */
    public List<Map<String, Object>> awaitingPayment() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings())
            for (Map<String, Object> e : list(b))
                if ("approved".equals(e.get("status")) || "pending_payment".equals(e.get("status"))) {
                    Map<String, Object> v = core.view(b, Role.CASHIER);
                    v.put("extension", e);
                    out.add(v);
                }
        out.sort((a, c) -> Maps.str(a, "date").compareTo(Maps.str(c, "date")));
        return out;
    }

    /** Thu ngân xác nhận đã nhận tiền gia hạn (số tiền phải đúng). */
    public Map<String, Object> confirmPayment(Actor cashier, String id, int no, long amount, String note) {
        Map<String, Object> out = core.edit(id, b -> {
            Map<String, Object> e = find(b, no);
            if (e == null) throw HttpError.notFound("Không tìm thấy lần gia hạn");
            if (amount != Maps.lng(e, "amount")) throw new HttpError(409, "Số tiền nhập (" + amount + " ₫) không khớp số tiền gia hạn (" + e.get("amount") + " ₫)", "amount_mismatch");
            List<String> pr = problems(b, (int) Maps.lng(e, "days"), true);
            if (!pr.isEmpty() && !"paid".equals(e.get("status"))) throw new HttpError(409, pr.get(0), "extension");
            markPaid(b, no, amount, "cashier", cashier.id(), cashier.name(), cashier.role(), note, core.now());
        });
        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "payment.confirm.ext", Maps.str(out, "payCode"), "EXT" + no + " " + amount + " ₫");
        notifyPaid(out, no);
        return Maps.of("ok", true, "extension", find(out, no));
    }

    /** Gửi lại xác nhận cho khách sau khi gia hạn thành công (8.11). */
    void notifyPaid(Map<String, Object> b, int no) {
        Map<String, Object> e = find(b, no);
        LocalDate end = core.endDate(b);
        core.notifyUser(Maps.str(b, "userId"), "✅ Gia hạn thành công", "Đơn " + b.get("payCode") + ": thêm " + e.get("days") + " ngày, ngày kết thúc mới " + end + ". Xác nhận gia hạn " + e.get("paymentCode") + " đã được ghi nhận.", "profile", "exok-" + b.get("id") + "-" + no);
        String gid = core.canonGuide(Maps.str(b, "guideId"));
        if (!gid.isEmpty()) for (Map<String, Object> a : core.accounts.all())
            if (gid.equals(core.canonGuide(Maps.str(a, "guideId"))))
                core.notifyUser(Maps.str(a, "id"), "➕ Tour được gia hạn", "Đơn " + b.get("payCode") + " thêm " + e.get("days") + " ngày, kết thúc " + end + ".", "guide.html#schedule", "exg-" + b.get("id") + "-" + no);
    }

    /**
     * Ghi nhận tiền gia hạn vào đơn (gọi TRONG khóa sửa đơn; dùng chung cho thu ngân và webhook ngân hàng).
     * Cộng ngày vào extraDays → ngày kết thúc thực tế, lịch bận HDV và hạn đánh giá đều tự cập nhật.
     */
    public static void markPaid(Map<String, Object> b, int no, long amount, String source, String byId, String byName, String role, String note, long now) {
        Map<String, Object> e = find(b, no);
        if (e == null) throw HttpError.notFound("Không tìm thấy lần gia hạn");
        String es = Maps.str(e, "status");
        if (!"approved".equals(es) && !"pending_payment".equals(es)) throw HttpError.conflict("Lần gia hạn này không ở trạng thái chờ thanh toán (" + es + ")", "status");
        if (amount < Maps.lng(e, "amount")) throw new HttpError(409, "Thiếu tiền gia hạn: nhận " + amount + ", cần " + e.get("amount"), "amount_mismatch");
        Flow.addPayment(b, "ext", Maps.lng(e, "amount"), source, byId, byName, role, "Gia hạn " + e.get("paymentCode") + (note == null || note.isEmpty() ? "" : " – " + note), now);
        e.put("status", "paid");
        e.put("paidAt", Times.iso(now));
        e.put("paidSource", source);
        b.put("extraDays", Maps.lng(b, "extraDays") + Maps.lng(e, "days"));
        b.put("extended", true);
        String st = Flow.norm(b.get("status"));
        Flow.addHistory(b, "extension", st, st, byId, byName, role, "Đã thu gia hạn " + e.get("paymentCode") + ": +" + e.get("days") + " ngày (" + e.get("amount") + " ₫)", now);
        shiftBalanceDue(b);
    }

    /** Hạn thu nốt = ngày kết thúc thực tế + N ngày; tính lại khi số ngày thay đổi. */
    private static void shiftBalanceDue(Map<String, Object> b) {
        LocalDate s = GuideAvailability.parse(b.get("date"));
        if (s == null || b.get("balanceDueDate") == null) return;
        long old = Maps.lng(b, "extraDays");
        String due = Maps.str(b, "balanceDueDate");
        // balanceDueDate hiện = (kết thúc cũ + N): dời theo chênh lệch giữa kết thúc mới và kết thúc cũ lưu trong baseEnd
        String baseDue = Maps.str(b, "balanceDueBase");
        if (baseDue.isEmpty()) { baseDue = due; b.put("balanceDueBase", due); }
        b.put("balanceDueDate", LocalDate.parse(baseDue).plusDays(old).toString());
    }

    /** 3.8 mở rộng: gia hạn chờ thanh toán quá hạn giữ chỗ → hết hạn (nhả lịch HDV đã giữ). */
    public int expireUnpaid() {
        long limit = core.config.i("paymentHoldHours") * 3_600_000L;
        int n = 0;
        for (Map<String, Object> b : core.bookings()) {
            for (Map<String, Object> e : list(b)) {
                String s = Maps.str(e, "status");
                if (!"pending_payment".equals(s) && !"approved".equals(s)) continue;
                Long at = Times.parse("approved".equals(s) ? e.get("decidedAt") : e.get("requestedAt"));
                if (at == null || core.now() - at < limit) continue;
                int no = (int) Maps.lng(e, "no");
                core.edit(Maps.str(b, "id"), x -> {
                    Map<String, Object> y = find(x, no);
                    if (y == null || !OPEN.contains(Maps.str(y, "status")) || "requested".equals(y.get("status"))) return;
                    y.put("status", "expired");
                    core.note(x, "extension", Actor.system(), "Gia hạn " + y.get("paymentCode") + " hết hạn thanh toán");
                });
                core.notifyUser(Maps.str(b, "userId"), "⌛ Gia hạn đã hết hạn", "Đơn " + b.get("payCode") + ": yêu cầu gia hạn chưa được thanh toán nên đã hết hạn.", "profile", "exe-" + b.get("id") + "-" + no);
                n++;
            }
        }
        return n;
    }

    /** Đơn gốc bị hủy: hủy các lần gia hạn chưa trả, hoàn các lần đã trả theo cùng tỷ lệ. Gọi TRONG khóa sửa đơn. */
    public void onOrderCancelled(Map<String, Object> b, Actor by, String source, int pct) {
        List<Map<String, Object>> exts = list(b);
        if (exts.isEmpty()) return;
        for (Map<String, Object> e : exts) {
            String s = Maps.str(e, "status");
            if ("paid".equals(s)) {
                long amount = Math.round(Maps.lng(e, "amount") * pct / 100.0);
                e.put("refundPct", pct);
                e.put("refundAmount", amount);
                if (amount > 0) refunds().createPartial(b, source, amount, "Đơn gốc bị hủy – hoàn gia hạn " + e.get("paymentCode"), by, !Refunds.SRC_CUSTOMER.equals(source), (int) Maps.lng(e, "no"));
                e.put("status", "cancelled");
                e.put("cancelledAt", Times.iso(core.now()));
            } else if (OPEN.contains(s)) {
                e.put("status", "cancelled");
                e.put("cancelledAt", Times.iso(core.now()));
            }
        }
        b.put("extraDays", 0L);
    }

    private Refunds refunds() { return new Refunds(core.db, core); }
}
