package vn.travel.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Việc tự động của hệ thống (actor SYSTEM, ghi lịch sử): hết hạn giữ chỗ, hạn thu nốt / quá hạn, HDV không trả lời,
 * tự đóng đơn sau tour, nhắc lịch, cảnh báo đơn bị bỏ quên, báo danh sách chờ. Mỗi bước độc lập – lỗi một bước không chặn các bước khác.
 */
@Service
public class OpsSweeper {
    private final OpsCore core;
    private final AdminOps adminOps;
    private final OperatorOps operator;
    private final SupportOps support;

    public OpsSweeper(OpsCore core, AdminOps adminOps, OperatorOps operator, SupportOps support) {
        this.core = core;
        this.adminOps = adminOps;
        this.operator = operator;
        this.support = support;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void tick() { sweep(); }

    /** Chạy mọi bước; trả số việc đã xử lý theo từng loại (dùng cho kiểm thử). */
    public Map<String, Integer> sweep() {
        Map<String, Integer> r = new LinkedHashMap<>();
        step(r, "holdExpired", this::expireHolds);
        step(r, "balanceDue", this::balanceDeadlines);
        step(r, "extensionExpired", () -> core.extensions().expireUnpaid());   // 8.7
        step(r, "guideExpired", operator::expireAssignments);
        step(r, "autoAssigned", operator::autoAssignPending);   // 5.4, 5.5, 5.8, 5.9
        step(r, "autoCompleted", this::autoComplete);
        step(r, "alerts", this::alerts);
        step(r, "reminders", this::reminders);
        step(r, "waitlist", support::autoNotifyWaitlist);
        return r;
    }

    private interface Job { int run(); }

    private static void step(Map<String, Integer> out, String name, Job j) {
        try { out.put(name, j.run()); } catch (RuntimeException e) { out.put(name, -1); }
    }

    private long ms(Object iso) { Long t = Times.parse(iso); return t == null ? 0 : t; }

    /** 3.8: đơn chưa thanh toán quá hạn giữ chỗ → hủy, nhả chỗ và voucher. */
    int expireHolds() {
        long limit = core.config.i("paymentHoldHours") * 3_600_000L;
        int n = 0;
        for (Map<String, Object> b : core.bookings()) {
            if (!Flow.PENDING_PAYMENT.equals(Flow.norm(b.get("status")))) continue;
            long created = ms(b.get("createdAt"));
            if (created == 0 || core.now() - created < limit) continue;
            String id = Maps.str(b, "id");
            Map<String, Object> out = core.edit(id, x -> {
                if (!Flow.PENDING_PAYMENT.equals(Flow.norm(x.get("status"))) || Flow.paidIn(x) > 0) return;
                core.changeStatus(x, Flow.CANCELLED, Actor.system(), "Quá hạn thanh toán – hệ thống tự hủy");
                x.put("cancelledAt", Times.iso(core.now()));
                x.put("cancelledBy", Flow.SYSTEM);
                core.vouchers.release(Maps.str(x, "voucherCode"), Maps.str(x, "userId"));
            });
            if (Flow.CANCELLED.equals(Flow.norm(out.get("status"))))
                core.notifyUser(Maps.str(out, "userId"), "⌛ Đơn đã hết hạn thanh toán", "Đơn " + out.get("payCode") + " bị hủy do quá " + core.config.i("paymentHoldHours") + " giờ chưa thanh toán.", "profile", "hx-" + id);
            n++;
        }
        return n;
    }

    /**
     * 4.4–4.5: thu nốt SAU chuyến đi (chuyến có thể phát sinh làm thêm giờ). Hạn = ngày kết thúc tour + balanceDueDaysAfterTrip.
     * Trước hạn 2 ngày: nhắc khách. Quá hạn: đánh dấu và báo Thu ngân + CSKH (CSKH liên hệ khách). KHÔNG tự hủy: tour đã đi rồi nên đây là công nợ cần thu.
     */
    int balanceDeadlines() {
        int n = 0;
        int after = core.config.i("balanceDueDaysAfterTrip");
        LocalDate today = core.today();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (Flow.inactive(st) || Flow.PENDING_PAYMENT.equals(st) || !Maps.bool(b, "depositPaid") || Flow.fullyPaid(b)) continue;
            LocalDate end = core.endDate(b);
            if (end == null) continue;
            String id = Maps.str(b, "id");
            if (Maps.str(b, "balanceDueDate").isEmpty()) {
                String due = end.plusDays(after).toString();
                core.edit(id, x -> x.put("balanceDueDate", due));
            }
            LocalDate d = GuideAvailability.parse(Maps.str(b, "balanceDueDate").isEmpty() ? end.plusDays(after).toString() : b.get("balanceDueDate"));
            if (d == null) d = end.plusDays(after);
            if (today.isBefore(end)) continue;   // chưa đi xong: chưa tính công nợ
            long late = ChronoUnit.DAYS.between(d, today);
            if (late < 0) {
                if (late >= -2) core.notifyUser(Maps.str(b, "userId"), "⏰ Sắp đến hạn thanh toán phần còn lại", "Đơn " + b.get("payCode") + ": còn " + OpsCore.remaining(b) + " ₫ (gồm phụ thu nếu có), hạn " + d + ".", "profile", "bal-" + id);
                continue;
            }
            if (!Maps.bool(b, "balanceOverdue")) {
                core.edit(id, x -> x.put("balanceOverdue", true));
                core.notifyRoles("⚠️ Đơn quá hạn thu nốt", "Đơn " + b.get("payCode") + " còn " + OpsCore.remaining(b) + " ₫", "cashier.html#collect", "bod-" + id, Role.CASHIER, Role.SUPPORT);
                core.notifyUser(Maps.str(b, "userId"), "⚠️ Đơn đã quá hạn thanh toán phần còn lại", "Vui lòng thanh toán " + OpsCore.remaining(b) + " ₫ cho đơn " + b.get("payCode") + ".", "profile", "bod-u-" + id);
                n++;
            }
        }
        return n;
    }

    /** 6.3: tự đóng đơn sau ngày kết thúc (tour tự túc: từ confirmed; có HDV: tùy cấu hình, từ in_progress). */
    int autoComplete() {
        int n = 0;
        LocalDate today = core.today();
        int after = core.config.i("autoComplete", "daysAfterEnd");
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            boolean self = Flow.CONFIRMED.equals(st) && !core.needsGuide(b) && core.config.b("autoComplete", "selfGuided");
            boolean guided = Flow.IN_PROGRESS.equals(st) && core.config.b("autoComplete", "guided");
            if (!self && !guided) continue;
            LocalDate end = core.endDate(b);
            if (end == null || today.isBefore(end.plusDays(after))) continue;
            if (self && !Flow.fullyPaid(b)) continue;   // chưa thu đủ thì không tự đóng
            Map<String, Object> out = core.edit(Maps.str(b, "id"), x -> {
                String s = Flow.norm(x.get("status"));
                if (!Flow.CONFIRMED.equals(s) && !Flow.IN_PROGRESS.equals(s)) return;
                core.changeStatus(x, Flow.COMPLETED, Actor.system(), "Hệ thống tự đóng đơn sau ngày kết thúc");
                x.put("completedAt", Times.iso(core.now()));
            });
            if (Flow.COMPLETED.equals(Flow.norm(out.get("status")))) {
                core.rewards().onCompleted(Maps.str(out, "id"));
                core.notifyUser(Maps.str(out, "userId"), "🏁 Chuyến đi đã hoàn thành", "Hãy đánh giá tour " + out.get("tourName") + ".", "profile", "ac-" + out.get("id"));
                n++;
            }
        }
        return n;
    }

    /** 17.3: cảnh báo đơn bị bỏ quên. */
    int alerts() {
        int n = 0;
        LocalDate today = core.today();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status")), id = Maps.str(b, "id");
            if ((Flow.PAID_DEPOSIT.equals(st) || Flow.PAID_FULL.equals(st)) && core.now() - ms(b.get("statusAt")) > 24 * 3_600_000L && ms(b.get("statusAt")) > 0) {
                core.notifyRoles("⏳ Đơn chờ xác nhận quá 24 giờ", "Đơn " + b.get("payCode") + " – " + b.get("tourName"), "admin.html#confirm", "late-cf-" + id, Role.ADMIN);
                n++;
            }
            if (Flow.CONFIRMED.equals(st) && core.needsGuide(b)) {
                LocalDate d = GuideAvailability.parse(b.get("date"));
                if (d != null && ChronoUnit.DAYS.between(today, d) <= 3) {
                    core.notifyRoles("🚨 Sắp đi mà chưa có HDV", "Đơn " + b.get("payCode") + " ngày " + b.get("date"), "operator.html#assign", "noguide-" + id, Role.OPERATOR, Role.ADMIN);
                    n++;
                }
            }
        }
        // 9.3: đến hạn chốt mà chưa đủ khách tối thiểu → báo Điều hành để đề xuất hủy hoặc dồn tour (chưa có đề xuất nào đang chờ Admin duyệt)
        Set<String> proposed = new HashSet<>();
        for (Map<String, Object> p : operator.proposals("pending")) proposed.add(Capacity.depKey(p.get("tourId"), p.get("date")));
        for (Map<String, Object> d : operator.departures()) {
            if (!Maps.bool(d, "atRisk") || Maps.bool(d, "cancelled") || proposed.contains(Maps.str(d, "key"))) continue;
            core.notifyRoles("⚠️ Chuyến chưa đủ khách tối thiểu", d.get("tourName") + " ngày " + d.get("date") + ": mới " + d.get("pax") + "/" + d.get("minGuests")
                    + " khách, còn " + d.get("daysLeft") + " ngày. Hãy đề xuất hủy hoặc dồn tour.", "operator.html#departures", "lowpax-" + d.get("key"), Role.OPERATOR);
            n++;
        }
        for (Map<String, Object> c : support.complaints(null)) {
            if (!Maps.bool(c, "overdue")) continue;
            core.notifyRoles("⏰ Khiếu nại quá hạn phản hồi", Maps.str(c, "title"), "support.html#complaints", "late-cmp-" + c.get("id"), Role.SUPPORT, Role.ADMIN);
            n++;
        }
        return n;
    }

    /** 10.2: nhắc khách trước ngày đi 1–2 ngày. */
    int reminders() {
        int n = 0;
        LocalDate today = core.today();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (!Flow.confirmedOrLater(st) || Flow.IN_PROGRESS.equals(st) || Flow.COMPLETED.equals(st)) continue;
            LocalDate d = GuideAvailability.parse(b.get("date"));
            long left = d == null ? 99 : ChronoUnit.DAYS.between(today, d);
            if (left < 1 || left > 2) continue;
            core.notifyUser(Maps.str(b, "userId"), "🧳 Sắp đến ngày khởi hành", "Tour " + b.get("tourName") + " ngày " + b.get("date") + ". Điểm đón: " + (Maps.str(b, "pickup").isEmpty() ? "theo xác nhận của HDV" : b.get("pickup")) + ".", "profile", "rem-" + b.get("id"));
            n++;
        }
        return n;
    }
}
