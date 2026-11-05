package vn.travel.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.util.Times;

import java.util.*;

/**
 * Chuẩn hóa dữ liệu cũ một lần khi khởi động (chạy lại nhiều lần vẫn an toàn): đơn chỉ có cờ depositPaid/fullPaid/finalPaid được dựng sổ thanh toán,
 * mã HDV tài khoản (hdv001) đổi thành mã hồ sơ (g_hn01), đơn đã gán HDV có bản ghi assignment, đơn refund_pending có hồ sơ hoàn tiền, đơn có history đầu tiên.
 */
@Component
@SuppressWarnings("unchecked")
public class LegacyMigration implements ApplicationRunner {
    private final vn.travel.store.Db db;
    private final OpsCore core;

    public LegacyMigration(vn.travel.store.Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    @Override
    public void run(ApplicationArguments args) { migrate(); }

    /** Trả số đơn đã được chỉnh. */
    public int migrate() {
        long now = core.now();
        int[] changed = {0};
        List<Map<String, Object>> needRefund = new ArrayList<>();
        db.edit("bookings", all -> {
            for (Map<String, Object> b : all) {
                if (!OpsCore.isTourBooking(b)) continue;
                boolean dirty = false;
                String st = Flow.norm(b.get("status"));
                if (!st.equals(Maps.str(b, "status"))) { b.put("status", st); dirty = true; }
                String g = Maps.str(b, "guideId");
                if (!g.isEmpty()) {
                    String c = core.canonGuide(g);
                    if (!c.equals(g)) { b.put("guideId", c); dirty = true; }
                    Map<String, Object> prof = core.guide(c);
                    if (prof != null && Maps.str(b, "guideName").isEmpty()) { b.put("guideName", prof.get("name")); dirty = true; }
                    if (b.get("assignment") == null && (Flow.GUIDE_PENDING.equals(st) || Flow.GUIDE_ACCEPTED.equals(st) || Flow.IN_PROGRESS.equals(st) || Flow.COMPLETED.equals(st))) {
                        boolean accepted = !Flow.GUIDE_PENDING.equals(st);
                        b.put("assignment", Maps.of("guideId", c, "status", accepted ? "accepted" : "pending", "assignedAt", Times.iso(now),
                                "deadline", Times.iso(now + core.config.i("guideResponseHours") * 3_600_000L), "rejected", new ArrayList<>()));
                        dirty = true;
                    }
                }
                if (b.get("payments") == null && (Maps.bool(b, "depositPaid") || Maps.bool(b, "fullPaid") || Maps.bool(b, "finalPaid"))) {
                    long price = Maps.lng(b, "price"), deposit = Maps.lng(b, "deposit");
                    long at = Times.parse(b.get("depositPaidAt")) != null ? Times.parse(b.get("depositPaidAt")) : (Times.parse(b.get("createdAt")) != null ? Times.parse(b.get("createdAt")) : now);
                    if (Maps.bool(b, "fullPaid") && !Maps.bool(b, "finalPaid")) Flow.addPayment(b, "full", price, "legacy", "", "Dữ liệu cũ", "SYSTEM", "Dựng từ cờ cũ", at);
                    else {
                        Flow.addPayment(b, "deposit", deposit > 0 ? deposit : Math.round(price * 0.2), "legacy", "", "Dữ liệu cũ", "SYSTEM", "Dựng từ cờ cũ", at);
                        if (Maps.bool(b, "finalPaid")) Flow.addPayment(b, "final", Math.max(0, price - (deposit > 0 ? deposit : Math.round(price * 0.2))), "legacy", "", "Dữ liệu cũ", "SYSTEM", "Dựng từ cờ cũ", at);
                    }
                    dirty = true;
                }
                if (b.get("history") == null) {
                    Flow.addHistory(b, "create", "", st, Maps.str(b, "userId"), "", Flow.CUSTOMER, "Tạo đơn (dữ liệu cũ)", Times.parse(b.get("createdAt")) != null ? Times.parse(b.get("createdAt")) : now);
                    dirty = true;
                }
                if (Flow.REFUND_PENDING.equals(st) && Maps.str(b, "refundId").isEmpty() && Flow.paidIn(b) > 0) needRefund.add(b);
                if (dirty) changed[0]++;
            }
            for (Map<String, Object> b : needRefund) {
                long net = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
                String id = vn.travel.util.Ids.newId("rf");
                Map<String, Object> r = Maps.of("id", id, "bookingId", b.get("id"), "payCode", b.get("payCode"), "customerName", b.get("customerName"), "tourName", b.get("tourName"),
                        "userId", b.get("userId"), "amount", net, "source", Refunds.SRC_CUSTOMER, "status", "pending_approval", "reason", "Dữ liệu cũ", "requestedById", Maps.str(b, "userId"),
                        "requestedByName", Maps.str(b, "customerName"), "requestedRole", Flow.CUSTOMER, "requestedAt", Times.iso(now), "complaintId", "", "full", true);
                b.put("refundId", id);
                db.edit("refunds", rs -> rs.add(r));
                changed[0]++;
            }
        });
        return changed[0];
    }
}
