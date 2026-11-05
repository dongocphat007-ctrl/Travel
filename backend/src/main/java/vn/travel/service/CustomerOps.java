package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.*;
import vn.travel.web.HttpError;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Khách hàng (TASKS 8.1–8.6): xem trước số tiền hoàn rồi hủy theo bảng hoàn tiền; xin đổi ngày một lần (CSKH / Điều hành duyệt). Chỉ thao tác trên đơn của CHÍNH MÌNH. */
@Service
@SuppressWarnings("unchecked")
public class CustomerOps {
    private final Db db;
    private final OpsCore core;
    private final AdminOps adminOps;

    public CustomerOps(Db db, OpsCore core, AdminOps adminOps) {
        this.db = db;
        this.core = core;
        this.adminOps = adminOps;
    }

    /** 9.1: khách xem chuyến ngày X còn bao nhiêu chỗ (công khai, không lộ thông tin đơn của ai). */
    public Map<String, Object> availability(String tourId, String date) {
        if (GuideAvailability.parse(date) == null) throw HttpError.bad("Ngày không hợp lệ (yyyy-MM-dd)", "date");
        Map<String, Object> info = core.seatInfo(tourId, date);
        if (info == null) throw HttpError.notFound("Không tìm thấy tour");
        return info;
    }

    private Map<String, Object> mine(Map<String, Object> user, String id) {
        Map<String, Object> b = core.find(id);
        if (b == null || !Maps.str(b, "userId").equals(Maps.str(user, "id"))) throw HttpError.notFound("Không tìm thấy đơn");   // 17.21: không lộ đơn người khác
        return b;
    }

    private long daysBefore(Map<String, Object> b) {
        LocalDate d = GuideAvailability.parse(b.get("date"));
        return d == null ? 0 : ChronoUnit.DAYS.between(core.today(), d);
    }

    private static final Set<String> CANCELLABLE = Set.of(Flow.PENDING_PAYMENT, Flow.PAID_DEPOSIT, Flow.PAID_FULL, Flow.CONFIRMED, Flow.GUIDE_PENDING, Flow.GUIDE_ACCEPTED);

    /** Xem trước: khách đã trả bao nhiêu, được hoàn bao nhiêu %, còn lại bao nhiêu ngày. */
    public Map<String, Object> cancelPreview(Map<String, Object> user, String id) {
        Map<String, Object> b = mine(user, id);
        String st = Flow.norm(b.get("status"));
        long net = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b)), days = daysBefore(b);
        int pct = core.config.refundPct(Math.max(0, days));
        boolean can = CANCELLABLE.contains(st) && days >= 0;
        return Maps.of("ok", true, "bookingId", b.get("id"), "status", st, "canCancel", can, "reason", can ? "" : (Flow.inactive(st) ? "Đơn đã được hủy" : "Đơn đang đi hoặc đã hoàn thành, không hủy được"),
                "paid", net, "daysBefore", days, "refundPct", pct, "refundAmount", net == 0 ? 0 : Math.round(net * pct / 100.0), "policy", core.config.get().get("refundPolicy"),
                "needsRefund", net > 0);
    }

    public Map<String, Object> cancel(Map<String, Object> user, String id, String reason) {
        Actor me = Actor.customer(user);
        mine(user, id);
        String why = reason == null || reason.isBlank() ? "Khách hủy đơn" : "Khách hủy: " + reason.trim();
        Map<String, Object> out = core.edit(id, b -> {
            String st = Flow.norm(b.get("status"));
            if (Flow.inactive(st)) throw HttpError.conflict("Đơn đã được hủy trước đó", null);
            if (!CANCELLABLE.contains(st)) throw HttpError.conflict("Đơn đang đi hoặc đã hoàn thành, không hủy được", "status");
            long days = daysBefore(b);
            if (days < 0) throw HttpError.conflict("Đơn đã quá ngày khởi hành", "status");
            boolean hadGuide = Flow.GUIDE_PENDING.equals(st) || Flow.GUIDE_ACCEPTED.equals(st);
            String guide = Maps.str(b, "guideId");
            if (Maps.lng(b, "price") > 0 && Flow.paidIn(b) == 0) {
                core.changeStatus(b, Flow.CANCELLED, me, why);
                b.put("cancelledAt", Times.iso(core.now()));
                b.put("cancelledBy", Flow.CUSTOMER);
                core.vouchers.release(Maps.str(b, "voucherCode"), Maps.str(b, "userId"));
            } else {
                adminOps.cancelWithRefund(b, me, Refunds.SRC_CUSTOMER, why, core.config.refundPct(Math.max(0, days)));
            }
            if (hadGuide && !guide.isEmpty()) b.put("releasedGuideId", guide);
        });
        core.audit.log(me.id(), me.name(), me.role(), "booking.cancel", Maps.str(out, "payCode"), why);
        String rg = Maps.str(out, "releasedGuideId");
        if (!rg.isEmpty()) {
            for (Map<String, Object> a : core.accounts.all())
                if (core.canonGuide(rg).equals(Maps.str(a, "guideId")))
                    core.notifyUser(Maps.str(a, "id"), "ℹ️ Tour đã bị hủy", "Khách đã hủy đơn " + out.get("payCode") + " (" + out.get("date") + "). Lịch của bạn đã được giải phóng.", "guide.html#schedule", "gc-" + out.get("id"));
            core.notifyRoles("ℹ️ Khách hủy đơn đã gán HDV", "Đơn " + out.get("payCode") + " (" + out.get("date") + ")", "operator.html#assign", "oc-" + out.get("id"), Role.OPERATOR);
        }
        if (Flow.REFUND_PENDING.equals(Flow.norm(out.get("status")))) { /* Refunds.create đã báo ADMIN */ }
        return cancelResult(out);
    }

    private Map<String, Object> cancelResult(Map<String, Object> b) {
        Map<String, Object> rf = null;
        String rid = Maps.str(b, "refundId");
        if (!rid.isEmpty()) for (Map<String, Object> r : db.list("refunds")) if (rid.equals(Maps.str(r, "id"))) rf = r;
        return Maps.of("ok", true, "status", Flow.norm(b.get("status")), "statusLabel", Flow.label(Flow.norm(b.get("status"))), "refund", rf == null ? null : Maps.of("amount", rf.get("amount"), "status", rf.get("status")));
    }

    // ───────────────────────── đổi ngày ─────────────────────────
    private static final Set<String> RESCHEDULABLE = Set.of(Flow.PAID_DEPOSIT, Flow.PAID_FULL, Flow.CONFIRMED, Flow.GUIDE_PENDING, Flow.GUIDE_ACCEPTED);

    public Map<String, Object> requestReschedule(Map<String, Object> user, String id, String newDate, String reason) {
        return requestReschedule(user, id, newDate, reason, false);
    }

    /** companyOffer = công ty hủy chuyến cũ: được đổi dù đã đổi một lần, không bị chặn vì sát ngày đi. */
    Map<String, Object> requestReschedule(Map<String, Object> user, String id, String newDate, String reason, boolean companyOffer) {
        mine(user, id);
        LocalDate nd = GuideAvailability.parse(newDate);
        if (nd == null) throw HttpError.bad("Ngày mới không hợp lệ", "date");
        Actor me = Actor.customer(user);
        Map<String, Object> out = core.edit(id, b -> {
            String st = Flow.norm(b.get("status"));
            if (!RESCHEDULABLE.contains(st)) throw HttpError.conflict("Chỉ đổi ngày được khi đơn đã thanh toán và chưa đi", "status");
            if (Maps.bool(b, "rescheduledOnce") && !companyOffer) throw HttpError.conflict("Mỗi đơn chỉ được đổi ngày một lần", "rescheduled");
            Map<String, Object> cur = Maps.map(b.get("reschedule"));
            if (cur != null && "requested".equals(cur.get("status"))) throw HttpError.conflict("Bạn đã có yêu cầu đổi ngày đang chờ xử lý", null);
            if (nd.isBefore(core.today().plusDays(Bookings.MIN_DAYS_AHEAD))) throw HttpError.bad("Ngày mới phải cách hôm nay ít nhất " + Bookings.MIN_DAYS_AHEAD + " ngày", "date");
            if (newDate.equals(Maps.str(b, "date"))) throw HttpError.bad("Ngày mới trùng ngày cũ", "date");
            if (daysBefore(b) < Bookings.MIN_DAYS_AHEAD && !companyOffer) throw HttpError.conflict("Quá sát ngày đi, hãy liên hệ CSKH", "date");
            b.put("reschedule", Maps.of("status", "requested", "from", b.get("date"), "to", newDate, "reason", reason == null ? "" : reason.trim(), "requestedAt", Times.iso(core.now()), "companyOffer", companyOffer));
            core.note(b, "reschedule", me, "Khách xin đổi ngày " + b.get("date") + " → " + newDate);
        });
        core.notifyRoles("📅 Khách xin đổi ngày", "Đơn " + out.get("payCode") + ": " + out.get("date") + " → " + newDate, "support.html#reschedule", "rs-" + id + "-" + newDate, Role.SUPPORT, Role.OPERATOR);
        return Maps.of("ok", true, "reschedule", out.get("reschedule"));
    }

    /** 8.5: khách trả lời đề nghị khi công ty hủy chuyến: choice = refund (hoàn 100%) | reschedule (kèm date). */
    public Map<String, Object> respondCompanyOffer(Map<String, Object> user, String id, String choice, String newDate) {
        Map<String, Object> b0 = mine(user, id);
        Map<String, Object> offer = Maps.map(b0.get("companyOffer"));
        if (offer == null || !"offered".equals(offer.get("status"))) throw HttpError.conflict("Đơn này không có đề nghị từ công ty đang chờ", null);
        Actor me = Actor.customer(user);
        if ("refund".equals(choice)) {
            core.edit(id, b -> {
                Map<String, Object> o = new LinkedHashMap<>(Maps.map(b.get("companyOffer")));
                o.put("status", "refunded");
                o.put("decidedAt", Times.iso(core.now()));
                b.put("companyOffer", o);
                adminOps.cancelWithRefund(b, me, Refunds.SRC_COMPANY, "Công ty hủy chuyến – khách chọn hoàn 100%", 100);
            });
            core.audit.log(me.id(), me.name(), me.role(), "booking.company_offer_refund", Maps.str(b0, "payCode"), "");
            return Maps.of("ok", true, "choice", "refund");
        }
        if ("reschedule".equals(choice)) {
            Map<String, Object> r = requestReschedule(user, id, newDate == null ? "" : newDate, "Công ty hủy chuyến: " + Maps.str(offer, "reason"), true);
            core.edit(id, b -> {
                Map<String, Object> o = new LinkedHashMap<>(Maps.map(b.get("companyOffer")));
                o.put("status", "reschedule_requested");
                o.put("newDate", newDate);
                b.put("companyOffer", o);
            });
            return Maps.of("ok", true, "choice", "reschedule", "reschedule", r.get("reschedule"));
        }
        throw HttpError.bad("choice phải là refund hoặc reschedule", "choice");
    }

    public List<Map<String, Object>> rescheduleQueue(Role view) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            Map<String, Object> r = Maps.map(b.get("reschedule"));
            if (r == null || !"requested".equals(r.get("status"))) continue;
            Map<String, Object> v = core.view(b, view);
            v.put("reschedule", r);
            v.put("check", rescheduleCheck(b, Maps.str(r, "to")));
            out.add(v);
        }
        out.sort((a, c) -> Maps.str(a, "date").compareTo(Maps.str(c, "date")));
        return out;
    }

    /** Kiểm tra đổi sang ngày mới: còn chỗ không, HDV đang gán có rảnh (kể cả ngày nghỉ) không. */
    public Map<String, Object> rescheduleCheck(Map<String, Object> b, String newDate) {
        Map<String, Object> t = core.tourOf(b);
        int cap = core.depCapacity(t, b.get("tourId"), newDate);
        int pax = 0;
        for (Map<String, Object> o : core.bookings())
            if (!Maps.str(o, "id").equals(Maps.str(b, "id")) && Maps.str(o, "tourId").equals(Maps.str(b, "tourId")) && newDate.equals(Maps.str(o, "date")) && Flow.active(o.get("status"))) pax += (int) Maps.lng(o, "pax");
        boolean seats = pax + Maps.lng(b, "pax") <= cap;
        List<String> guideProblems = new ArrayList<>();
        String gid = core.canonGuide(Maps.str(b, "guideId"));
        if (!gid.isEmpty()) {
            Map<String, Object> g = core.guide(gid);
            if (g != null) guideProblems = core.guideConflicts(g, Maps.str(b, "id"), newDate, core.daysOf(b));
        }
        return Maps.of("seatsOk", seats, "seatsLeft", Math.max(0, cap - pax), "guideOk", guideProblems.isEmpty(), "guideProblems", guideProblems, "priceDiff", priceDiff(b, newDate));
    }

    /**
     * 8.6: chênh lệch giá khi đổi ngày. Tour có thể khai báo giá theo ngày ({@code datePrices: {"yyyy-MM-dd": giá/người}});
     * ngày không khai báo dùng giá chuẩn của tour. Dương = thu thêm, âm = hoàn bớt. Voucher giữ nguyên số tiền giảm đã áp.
     */
    long priceDiff(Map<String, Object> b, String newDate) {
        Map<String, Object> tour = core.tourOf(b);
        Map<String, Object> dp = Maps.map(tour == null ? null : tour.get("datePrices"));
        if (dp == null || tour == null) return 0;
        double std = Pricing.num(tour.get("price"));
        double oldUnit = dp.get(Maps.str(b, "date")) != null ? Pricing.num(dp.get(Maps.str(b, "date"))) : std;
        double newUnit = dp.get(newDate) != null ? Pricing.num(dp.get(newDate)) : std;
        long adults = Math.max(1, Maps.lng(b, "adults")), kids = Maps.lng(b, "children");
        return Math.round(newUnit * adults + newUnit * kids * Pricing.CHILD_HALF_RATE) - Math.round(oldUnit * adults + oldUnit * kids * Pricing.CHILD_HALF_RATE);
    }

    /** Áp chênh lệch giá vào đơn (trong khóa sửa đơn): đổi price, breakdown; thu thêm ở lần thu nốt, hoặc tạo hoàn tiền phần dư. */
    private void applyPriceDiff(Map<String, Object> b, long diff, Actor by, String newDate) {
        if (diff == 0) return;
        long oldPrice = Maps.lng(b, "price"), newPrice = Math.max(0, oldPrice + diff);
        long paidNet = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
        Map<String, Object> bd = new LinkedHashMap<>();
        Map<String, Object> oldBd = Maps.map(b.get("priceBreakdown"));
        if (oldBd != null) bd.putAll(oldBd);
        bd.put("base", Maps.lng(bd, "base") + diff);
        bd.put("subtotal", Maps.lng(bd, "subtotal") + diff);
        bd.put("final", newPrice);
        b.put("priceBreakdown", bd);
        b.put("price", newPrice);
        b.put("priceDiffRescheduled", diff);
        if (diff > 0) {
            if (Flow.fullyPaid(b)) {   // đã thu đủ theo giá cũ: phần chênh lệch thu ở bước "thu nốt"
                b.put("fullPaid", false);
                b.put("finalPaid", false);
                b.put("deposit", paidNet);
            }
            core.note(b, "reschedule", by, "Giá ngày " + newDate + " cao hơn " + diff + " ₫ – thu thêm ở lần thu nốt");
        } else {
            long excess = Math.max(0, paidNet - newPrice);
            if (Maps.lng(b, "deposit") > newPrice) b.put("deposit", newPrice);
            if (excess > 0) new Refunds(db, core).createPartial(b, Refunds.SRC_CUSTOMER, excess, "Hoàn chênh lệch giá khi đổi ngày", by, false, 0);
            core.note(b, "reschedule", by, "Giá ngày " + newDate + " thấp hơn " + (-diff) + " ₫" + (excess > 0 ? " – hoàn " + excess + " ₫ (chờ duyệt)" : ""));
        }
    }

    /** SUPPORT (hỗ trợ khách) hoặc OPERATOR (kiểm tra lịch HDV) / ADMIN chốt. */
    public Map<String, Object> decideReschedule(Actor staff, String id, boolean approve, String note) {
        if (!approve && (note == null || note.isBlank())) throw HttpError.bad("Vui lòng ghi lý do từ chối", "note");
        Map<String, Object> out = core.edit(id, b -> {
            Map<String, Object> r = Maps.map(b.get("reschedule"));
            if (r == null || !"requested".equals(r.get("status"))) throw HttpError.conflict("Không có yêu cầu đổi ngày đang chờ", null);
            String to = Maps.str(r, "to");
            Map<String, Object> nr = new LinkedHashMap<>(r);
            nr.put("decidedBy", staff.id());
            nr.put("decidedAt", Times.iso(core.now()));
            nr.put("note", note == null ? "" : note.trim());
            if (approve) {
                Map<String, Object> chk = rescheduleCheck(b, to);
                if (!Maps.bool(chk, "seatsOk")) throw new HttpError(409, "Ngày mới không đủ chỗ (còn " + chk.get("seatsLeft") + ")", "no_seats");
                if (!Maps.bool(chk, "guideOk")) throw new HttpError(409, "HDV đang gán không rảnh ngày mới: " + String.join("; ", (List<String>) chk.get("guideProblems")) + ". Hãy gỡ/đổi HDV trước.", "guide_busy");
                String old = Maps.str(b, "date");
                long diff = priceDiff(b, to);
                b.put("date", to);
                applyPriceDiff(b, diff, staff, to);
                b.put("rescheduledOnce", true);
                nr.put("status", "approved");
                core.note(b, "reschedule", staff, "Đổi ngày " + old + " → " + to + (note == null || note.isBlank() ? "" : " – " + note.trim()));
            } else {
                nr.put("status", "rejected");
                core.note(b, "reschedule", staff, "Từ chối đổi ngày: " + note.trim());
            }
            b.put("reschedule", nr);
        });
        core.audit.log(staff.id(), staff.name(), staff.role(), approve ? "booking.reschedule_approve" : "booking.reschedule_reject", Maps.str(out, "payCode"), note == null ? "" : note);
        core.notifyUser(Maps.str(out, "userId"), approve ? "✅ Đã đổi ngày tour" : "❌ Chưa đổi được ngày tour", "Đơn " + out.get("payCode") + (approve ? ": ngày đi mới " + out.get("date") : ": " + note), "profile", "rsd-" + id + "-" + Maps.str(Maps.map(out.get("reschedule")), "status"));
        return Maps.of("ok", true, "date", out.get("date"), "reschedule", out.get("reschedule"));
    }
}
