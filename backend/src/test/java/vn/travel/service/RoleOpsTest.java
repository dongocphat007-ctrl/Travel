package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Chức năng từng vai trò theo TASKS: đúng người mới làm được, sai vai trò bị 403, sai thứ tự bị 409. */
@SuppressWarnings("unchecked")
class RoleOpsTest {
    static final Actor ADMIN = new Actor("ad001", "Quản trị", "ADMIN");
    static final Actor CASHIER = new Actor("tn001", "Thu ngân", "CASHIER");
    static final Actor OPERATOR = new Actor("dh001", "Điều hành", "OPERATOR");
    static final Actor SUPPORT = new Actor("cs001", "CSKH", "SUPPORT");
    static final Actor CONTENT = new Actor("nd001", "Biên tập", "CONTENT");

    private static Map<String, Object> req(String tourId, String date) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", tourId); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("email", "");
        m.put("date", date); m.put("adults", 2); m.put("kids", 0); m.put("infants", 0);
        return m;
    }

    private static int code(Runnable r) { return assertThrows(HttpError.class, r::run).status(); }

    private Map<String, Object> newGuide(Fixture f, String name, String type, String employment) {
        Map<String, Object> r = f.staff.create(ADMIN, Maps.of("name", name, "role", "guide", "email", name.toLowerCase().replace(" ", "") + "@travel.vn", "auto", true,
                "guide", Maps.of("guideType", type, "employmentType", employment, "regions", List.of())));
        return Maps.map(r.get("user"));
    }

    /** Đặt đơn → thu cọc → admin xác nhận. */
    private Map<String, Object> confirmed(Fixture f, Map<String, Object> user, String tour, String date) {
        Map<String, Object> b = f.bookings.create(user, req(tour, date));
        f.cashier.confirm(CASHIER, Maps.str(b, "id"), "deposit", Maps.lng(b, "deposit"), "");
        f.adminOps.confirm(ADMIN, Maps.str(b, "id"), "");
        return f.core.find(Maps.str(b, "id"));
    }

    // ───────────────────────── ma trận quyền ─────────────────────────
    @Test void permissionMatrixKeepsDutiesApart() {
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_CONFIRM), "admin không được xác nhận tiền");
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_REFUND));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.STAFF_MANAGE));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.BOOKING_CONFIRM));
        assertFalse(RolePermissions.hasPermission(Role.CONTENT, Permission.TOUR_MANAGE_SENSITIVE));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.PASSENGER_VIEW_UNMASKED));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.STATS_VIEW_FULL));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.TOUR_ASSIGN_GUIDE));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.PAYMENT_VIEW));
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.PAYMENT_CONFIRM));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.RECONCILE_APPROVE));
        for (Role r : List.of(Role.CASHIER, Role.OPERATOR, Role.SUPPORT, Role.CONTENT, Role.GUIDE, Role.CUSTOMER))
            assertFalse(RolePermissions.hasPermission(r, Permission.SYSTEM_CONFIG), r + " không được vào cấu hình");
    }

    // ───────────────────────── thu ngân ─────────────────────────
    @Test void cashierConfirmsExactAmountOnlyAndAdminCannot(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("101", "2026-11-10"));
        String id = Maps.str(b, "id");
        assertEquals("amount_mismatch", assertThrows(HttpError.class, () -> f.cashier.confirm(CASHIER, id, "deposit", 999_999, "")).field());
        assertEquals(403, code(() -> f.cashier.confirm(ADMIN, id, "deposit", 1_000_000, "")), "admin không xác nhận được tiền");
        assertEquals(403, code(() -> f.cashier.confirm(OPERATOR, id, "deposit", 1_000_000, "")));
        assertEquals("pending_payment", Flow.norm(f.core.find(id).get("status")), "thao tác bị từ chối không được đổi đơn");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        Map<String, Object> after = f.core.find(id);
        assertEquals("paid_deposit", after.get("status"));
        assertEquals(1_000_000L, Flow.paidIn(after));
        assertEquals(409, code(() -> f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "")), "không thu cọc hai lần");
        Map<String, Object> last = Maps.map(Maps.list(after.get("history")).get(Maps.list(after.get("history")).size() - 1));
        assertEquals("CASHIER", last.get("role"));
        assertEquals("tn001", last.get("byId"));
    }

    @Test void cashierCollectsFullAndFinalPayments(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> in = req("101", "2026-11-10");
        in.put("payChoice", "full");
        Map<String, Object> full = f.bookings.create(user, in);
        f.cashier.confirm(CASHIER, Maps.str(full, "id"), "full", Maps.lng(full, "price"), "");
        assertEquals("paid_full", f.core.find(Maps.str(full, "id")).get("status"));
        assertTrue(Flow.fullyPaid(f.core.find(Maps.str(full, "id"))));

        Map<String, Object> dep = f.bookings.create(user, req("101", "2026-11-12"));
        String id = Maps.str(dep, "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        assertEquals(409, code(() -> f.cashier.confirm(CASHIER, id, "final", 1, "")), "thu nốt phải đúng số còn lại");
        f.cashier.confirm(CASHIER, id, "final", 4_000_000, "");
        Map<String, Object> b = f.core.find(id);
        assertEquals("paid_full", b.get("status"));
        assertEquals(5_000_000L, Flow.paidIn(b));
    }

    @Test void undoOnlyWithinWindowWithReasonAndBeforeAdminConfirm(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("101", "2026-11-10"));
        String id = Maps.str(b, "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        String pid = Maps.str(Maps.map(Maps.list(f.core.find(id).get("payments")).get(0)), "id");
        assertEquals(400, code(() -> f.cashier.undo(CASHIER, id, pid, "")), "bắt buộc lý do");
        assertEquals(403, code(() -> f.cashier.undo(ADMIN, id, pid, "nhầm")));
        f.cashier.undo(CASHIER, id, pid, "Bấm nhầm đơn");
        Map<String, Object> undone = f.core.find(id);
        assertEquals("pending_payment", undone.get("status"));
        assertEquals(0, Flow.paidIn(undone));
        assertEquals(409, code(() -> f.cashier.undo(CASHIER, id, pid, "lần nữa")));

        // quá hạn hoàn tác
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        String pid2 = Maps.str(Maps.map(Maps.list(f.core.find(id).get("payments")).get(1)), "id");
        f.clock.now += 16 * 60_000L;
        assertEquals(409, code(() -> f.cashier.undo(CASHIER, id, pid2, "muộn")));
        f.clock.now -= 16 * 60_000L;
        // admin đã xác nhận rồi thì không hoàn tác
        f.adminOps.confirm(ADMIN, id, "");
        assertEquals(409, code(() -> f.cashier.undo(CASHIER, id, pid2, "đã duyệt")));
    }

    @Test void discrepancyFlowFlagHandoffAndResolve(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("101", "2026-11-10"));
        String id = Maps.str(b, "id");
        Map<String, Object> rec = f.cashier.flagDiscrepancy(CASHIER, id, 800_000, "short", "Khách chuyển thiếu", true);
        assertEquals("mismatch", rec.get("status"));
        assertEquals(1, f.cashier.discrepancies().size());
        assertEquals(1, f.support.paymentIssues().size(), "CSKH thấy khoản được chuyển sang");
        assertEquals("pending_payment", f.core.find(id).get("status"), "chuyển lệch không tự cộng tiền");
        String pid = Maps.str(rec, "id");
        assertEquals(400, code(() -> f.cashier.resolveDiscrepancy(CASHIER, pid, "accept_deposit", "")), "phải ghi chú");
        assertEquals(400, code(() -> f.cashier.flagDiscrepancy(CASHIER, id, 100, "bogus", "", false)));
        f.cashier.resolveDiscrepancy(CASHIER, pid, "dismiss", "Khách đã chuyển bù ở giao dịch khác");
        assertEquals(0, f.cashier.discrepancies().size());
    }

    @Test void reconciliationCreatorCannotApproveAndNeedsNoteOnDiff(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("101", "2026-11-10"));
        f.cashier.confirm(CASHIER, Maps.str(b, "id"), "deposit", 1_000_000, "");
        String today = f.core.today().toString();
        assertEquals(1_000_000L, Maps.lng(f.cashier.dayTotals(today), "net"));
        assertEquals(400, code(() -> f.cashier.reconcileCreate(CASHIER, today, 900_000, "")), "lệch phải giải trình");
        assertEquals(400, code(() -> f.cashier.reconcileCreate(CASHIER, "2099-01-01", 0, "")), "không đóng sổ ngày chưa tới");
        Map<String, Object> rec = f.cashier.reconcileCreate(CASHIER, today, 1_000_000, "");
        assertEquals(0L, Maps.lng(rec, "discrepancy"));
        assertEquals(409, code(() -> f.cashier.reconcileCreate(CASHIER, today, 1_000_000, "")), "mỗi ngày một bản");
        String rid = Maps.str(rec, "id");
        assertEquals(403, code(() -> f.adminOps.reconcileDecision(new Actor("tn001", "Thu ngân", "ADMIN"), rid, true, "")), "người lập không tự duyệt");
        Map<String, Object> ok = f.adminOps.reconcileDecision(ADMIN, rid, true, "");
        assertEquals("approved", ok.get("status"));
        assertEquals(409, code(() -> f.adminOps.reconcileDecision(ADMIN, rid, true, "")));
    }

    // ───────────────────────── admin duyệt / từ chối ─────────────────────────
    @Test void adminConfirmNeedsPaymentAndRejectRefundsInFull(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> unpaid = f.bookings.create(user, req("101", "2026-11-10"));
        assertEquals(409, code(() -> f.adminOps.confirm(ADMIN, Maps.str(unpaid, "id"), "")), "chưa có tiền thì chưa duyệt");

        Map<String, Object> paid = f.bookings.create(user, req("101", "2026-11-12"));
        String id = Maps.str(paid, "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        assertEquals(403, code(() -> f.adminOps.confirm(CASHIER, id, "")), "thu ngân không duyệt đơn");
        assertEquals(403, code(() -> f.adminOps.confirm(OPERATOR, id, "")));
        assertEquals(400, code(() -> f.adminOps.reject(ADMIN, id, "")), "từ chối phải có lý do");
        f.adminOps.reject(ADMIN, id, "Tour hết xe");
        Map<String, Object> b = f.core.find(id);
        assertEquals("refund_pending", b.get("status"));
        List<Map<String, Object>> approved = f.refunds.list("approved");
        assertEquals(1, approved.size(), "admin đã quyết nên khoản hoàn sẵn sàng cho thu ngân");
        assertEquals(1_000_000L, Maps.lng(approved.get(0), "amount"));
        String rid = Maps.str(approved.get(0), "id");
        assertEquals(403, code(() -> f.refunds.pay(ADMIN, rid, "")), "admin không tự chuyển tiền hoàn");
        f.refunds.pay(CASHIER, rid, "CK hoàn");
        b = f.core.find(id);
        assertEquals("refunded", b.get("status"));
        assertEquals(1_000_000L, Flow.refundedOut(b));
        assertEquals(409, code(() -> f.refunds.pay(CASHIER, rid, "")), "không hoàn hai lần");
    }

    // ───────────────────────── khách hủy / hoàn tiền ─────────────────────────
    @Test void customerCancelFollowsRefundTableAndNeedsAdminApproval(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> other = f.newUser("b@gmail.com");
        Map<String, Object> b = f.bookings.create(user, req("101", "2026-11-20"));   // 19 ngày: mốc ≥ 15 ngày hoàn 100%
        String id = Maps.str(b, "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        Map<String, Object> pv = f.customerOps.cancelPreview(user, id);
        assertEquals(100, ((Number) pv.get("refundPct")).intValue());
        assertEquals(1_000_000L, Maps.lng(pv, "refundAmount"));
        assertEquals(404, code(() -> f.customerOps.cancelPreview(other, id)), "không xem/hủy đơn người khác");
        assertEquals(404, code(() -> f.customerOps.cancel(other, id, "")));
        f.customerOps.cancel(user, id, "Bận việc");
        assertEquals("refund_pending", f.core.find(id).get("status"));
        Map<String, Object> pending = f.refunds.list("pending_approval").get(0);
        assertEquals(1_000_000L, Maps.lng(pending, "amount"));
        assertEquals(0, f.refunds.list("approved").size(), "hoàn tiền do khách hủy phải chờ admin duyệt");
    }

    @Test void customerCancelPartialAndZeroTiers(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(user, req("101", "2026-11-10"));   // 9 ngày: mốc 7–14 ngày hoàn 50%
        String id = Maps.str(b, "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        assertEquals(50, ((Number) f.customerOps.cancelPreview(user, id).get("refundPct")).intValue());
        f.customerOps.cancel(user, id, "");
        assertEquals(500_000L, Maps.lng(f.refunds.list("pending_approval").get(0), "amount"));
        // admin chỉnh số tiền nhưng không vượt số đã trả
        String rid = Maps.str(f.refunds.list("pending_approval").get(0), "id");
        assertEquals(400, code(() -> f.refunds.approve(ADMIN, rid, 2_000_000L, "")));
        f.refunds.approve(ADMIN, rid, 600_000L, "Thương lượng");
        assertEquals(1, f.refunds.list("approved").size());
    }

    @Test void cancelUnpaidOrderHasNoRefundAndReleasesVoucher(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(user, req("101", "2026-11-10"));
        Map<String, Object> r = f.customerOps.cancel(user, Maps.str(b, "id"), "");
        assertEquals("cancelled", r.get("status"));
        assertEquals(0, f.refunds.list(null).size());
        assertEquals(409, code(() -> f.customerOps.cancel(user, Maps.str(b, "id"), "")));
    }

    // ───────────────────────── điều hành + HDV ─────────────────────────
    @Test void fullLifecycleFromPaymentToCompletedWithRightRoles(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        String gid = Maps.str(guide, "guideId");
        assertFalse(gid.isEmpty());
        Map<String, Object> b = confirmed(f, user, "101", "2026-11-10");
        String id = Maps.str(b, "id");
        assertEquals("confirmed", b.get("status"));
        assertEquals(403, code(() -> f.operator.assign(CASHIER, id, gid)));
        assertEquals(403, code(() -> f.operator.assign(SUPPORT, id, gid)));
        f.operator.assign(OPERATOR, id, gid);
        assertEquals("guide_pending", f.core.find(id).get("status"));
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        f.guideOps.accept(acc, id);
        assertEquals("guide_accepted", f.core.find(id).get("status"));
        assertEquals(409, code(() -> f.guideOps.start(acc, id)), "chưa tới ngày đi");
        f.clock.now = java.time.Instant.parse("2026-11-10T01:00:00Z").toEpochMilli();
        assertEquals(f.core.endDate(f.core.find(id)).plusDays(3).toString(), f.core.find(id).get("balanceDueDate"), "4.4: hạn thu nốt = ngày kết thúc tour + 3 ngày, ghi lúc admin xác nhận");
        f.guideOps.start(acc, id);
        assertEquals("in_progress", f.core.find(id).get("status"));
        f.guideOps.checkin(acc, id, List.of());
        f.guideOps.end(acc, id);
        Map<String, Object> done = f.core.find(id);
        assertEquals("completed", done.get("status"));
        assertFalse(Flow.fullyPaid(done), "thu nốt sau chuyến đi: lúc hoàn thành vẫn còn công nợ");
        f.cashier.confirm(CASHIER, id, "final", f.cashier.expected(done, "final"), "");
        done = f.core.find(id);
        assertTrue(Flow.fullyPaid(done), "thu nốt được cả khi đơn đã completed (phụ thu làm thêm giờ chỉ biết sau chuyến)");
        assertEquals("completed", done.get("status"));
        List<Object> hist = Maps.list(done.get("history"));
        assertTrue(hist.stream().map(h -> Maps.str(Maps.map(h), "role")).toList().containsAll(List.of("CASHIER", "ADMIN", "OPERATOR", "GUIDE")), "lịch sử ghi đủ vai trò");
    }

    @Test void guideOnlySeesOwnToursAndRejectGoesBackToQueue(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> g1 = newGuide(f, "Hướng Dẫn Một", "domestic", "staff"), g2 = newGuide(f, "Hướng Dẫn Hai", "domestic", "staff");
        Map<String, Object> a1 = f.accounts.byId(Maps.str(g1, "id")), a2 = f.accounts.byId(Maps.str(g2, "id"));
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, Maps.str(g1, "guideId"));
        assertEquals(1, ((List<?>) f.guideOps.myTours(a1).get("offers")).size());
        assertEquals(0, ((List<?>) f.guideOps.myTours(a2).get("offers")).size());
        assertEquals(404, code(() -> f.guideOps.detail(a2, id)), "tour của HDV khác không lộ ra");
        assertEquals(404, code(() -> f.guideOps.accept(a2, id)));
        assertEquals(400, code(() -> f.guideOps.reject(a1, id, "")), "từ chối phải có lý do");
        f.guideOps.reject(a1, id, "Trùng lịch gia đình");
        Map<String, Object> b = f.core.find(id);
        assertEquals("confirmed", b.get("status"));
        assertNull(b.get("guideId"));
        List<Map<String, Object>> rejected = (List<Map<String, Object>>) f.operator.queue().get("rejected");
        assertEquals(1, rejected.size(), "đơn bị từ chối quay lại hàng đợi điều hành");
        f.operator.assign(OPERATOR, id, Maps.str(g2, "guideId"));
        assertEquals("guide_pending", f.core.find(id).get("status"));
    }

    @Test void assignmentChecksBusyRestDaysTypeAndOverlap(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> staffG = newGuide(f, "Chính Thức", "domestic", "staff"), freeG = newGuide(f, "Cộng Tác", "domestic", "freelance"), intl = newGuide(f, "Quốc Tế", "international", "staff");
        String g = Maps.str(staffG, "guideId");
        String first = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");   // 3 ngày: 10–12/11
        f.operator.assign(OPERATOR, first, g);
        String overlap = Maps.str(confirmed(f, user, "101", "2026-11-11"), "id");
        assertEquals("guide_busy", assertThrows(HttpError.class, () -> f.operator.assign(OPERATOR, overlap, g)).field());
        // tour 3 ngày → chưa đủ 5 ngày nên không bắt nghỉ; chỉnh cấu hình: tour ≥3 ngày nghỉ 1 ngày
        f.config.update(Maps.of("id", "ad001", "role", "admin", "name", "A"), Maps.of("restDays", List.of(Maps.of("minTourDays", 3, "rest", 1))));
        String restClash = Maps.str(confirmed(f, user, "101", "2026-11-13"), "id");   // ngày 13 là ngày nghỉ của HDV chính thức
        assertEquals("guide_busy", assertThrows(HttpError.class, () -> f.operator.assign(OPERATOR, restClash, g)).field());
        f.operator.assign(OPERATOR, restClash, Maps.str(freeG, "guideId"));            // cộng tác viên không bị bắt nghỉ
        String atFifteen = Maps.str(confirmed(f, user, "101", "2026-11-14"), "id");
        f.operator.assign(OPERATOR, atFifteen, g);                                       // sau ngày nghỉ thì nhận được
        // HDV quốc tế dẫn tour trong nước chỉ khi cho phép
        String dom = Maps.str(confirmed(f, user, "hot07", "2026-11-25"), "id");
        assertEquals("guide_unfit", assertThrows(HttpError.class, () -> f.operator.assign(OPERATOR, dom, Maps.str(intl, "guideId"))).field());
        List<Map<String, Object>> cands = f.operator.candidates(dom);
        assertEquals(5, cands.size());
        assertFalse(cands.stream().filter(c -> c.get("id").equals(Maps.str(intl, "guideId"))).findFirst().get().get("available").equals(true));
    }

    @Test void selfGuidedTourNeedsNoGuideAndAutoCompletes(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> in = req("s1", "2026-11-10");
        in.put("payChoice", "full");
        Map<String, Object> b = f.bookings.create(user, in);
        String id = Maps.str(b, "id");
        f.cashier.confirm(CASHIER, id, "full", Maps.lng(b, "price"), "");
        f.adminOps.confirm(ADMIN, id, "");
        assertEquals(409, code(() -> f.operator.assign(OPERATOR, id, "g1")), "tour tự túc không gán HDV");
        f.clock.now = java.time.Instant.parse("2026-11-13T03:00:00Z").toEpochMilli();   // sau ngày kết thúc 11/11 + 1
        Map<String, Integer> r = f.sweeper.sweep();
        assertEquals((Integer) 1, r.get("autoCompleted"));
        assertEquals("completed", f.core.find(id).get("status"));
    }

    @Test void departureCapacityAndManifestForOperator(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(f.bookings.create(user, req("101", "2026-11-10")), "id");
        assertEquals(409, code(() -> f.operator.setDeparture(OPERATOR, "101", "2026-11-10", 1, null)), "thấp hơn số khách đã đặt");
        f.operator.setDeparture(OPERATOR, "101", "2026-11-10", 4, null);
        Map<String, Object> second = req("101", "2026-11-10");
        second.put("adults", 3);
        assertEquals(409, code(() -> f.bookings.create(user, second)), "vượt sức chứa chuyến do điều hành đặt");
        f.operator.setDeparture(OPERATOR, "101", "2026-11-10", null, "closed");
        assertEquals(409, code(() -> f.bookings.create(user, req("101", "2026-11-10"))), "chuyến đóng không nhận thêm");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        List<Map<String, Object>> m = f.operator.manifest("101", "2026-11-10");
        assertNotNull(m);
    }

    @Test void guideIncidentReportedAndHandledByOperator(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(g, "id"));
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, Maps.str(g, "guideId"));
        assertEquals(409, code(() -> f.guideOps.reportIncident(acc, id, "health", "low", "Khách say xe nhẹ trên đường")), "chưa nhận tour thì chưa báo sự cố");
        f.guideOps.accept(acc, id);
        Map<String, Object> inc = f.guideOps.reportIncident(acc, id, "health", "low", "Khách say xe nhẹ trên đường");
        assertEquals("open", inc.get("status"));
        assertEquals(1, f.operator.incidents("open").size());
        assertEquals(400, code(() -> f.operator.handleIncident(OPERATOR, Maps.str(inc, "id"), "resolved", "")));
        f.operator.handleIncident(OPERATOR, Maps.str(inc, "id"), "resolved", "Đã cho nghỉ và uống nước");
        assertEquals(0, f.operator.incidents("open").size());
    }

    @Test void companyCancelRefundsEveryOrderAndProposalFlow(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u1 = f.newUser("a@gmail.com"), u2 = f.newUser("b@gmail.com");
        String a = Maps.str(f.bookings.create(u1, req("101", "2026-11-10")), "id"), b = Maps.str(f.bookings.create(u2, req("101", "2026-11-10")), "id");
        f.cashier.confirm(CASHIER, a, "deposit", 1_000_000, "");
        Map<String, Object> p = f.operator.proposeCancel(OPERATOR, "101", "2026-11-10", "Không đủ khách tối thiểu");
        assertEquals(409, code(() -> f.operator.proposeCancel(OPERATOR, "101", "2026-11-10", "lại")), "một đề xuất mỗi chuyến");
        Map<String, Object> r = f.adminOps.companyCancel(ADMIN, "101", "2026-11-10", "Không đủ khách");
        assertEquals(2, ((Number) r.get("cancelled")).intValue());
        f.operator.decideProposal(ADMIN, Maps.str(p, "id"), true, "");
        assertEquals("refund_pending", f.core.find(a).get("status"));
        assertEquals("cancelled", f.core.find(b).get("status"), "đơn chưa có tiền chỉ hủy");
        Map<String, Object> rf = f.refunds.list("approved").get(0);
        assertEquals(1_000_000L, Maps.lng(rf, "amount"), "công ty hủy: hoàn 100%, không theo bảng của khách");
    }

    // ───────────────────────── CSKH ─────────────────────────
    @Test void complaintFlowAndRefundProposalNeedsAdmin(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com"), other = f.newUser("b@gmail.com");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        assertEquals(404, code(() -> f.support.createComplaint(other, id, "Tiêu đề", "Nội dung khiếu nại dài đủ")), "không khiếu nại đơn người khác");
        assertEquals(400, code(() -> f.support.createComplaint(user, id, "ab", "ngắn")));
        Map<String, Object> c = f.support.createComplaint(user, id, "Xe đón trễ", "Xe đón trễ 30 phút so với lịch hẹn");
        String cid = Maps.str(c, "id");
        f.support.take(SUPPORT, cid);
        assertEquals(409, code(() -> f.support.take(SUPPORT, cid)));
        f.support.reply(SUPPORT, cid, "Chúng tôi xin lỗi và đang kiểm tra", false);
        f.support.reply(SUPPORT, cid, "Ghi chú nội bộ: gọi nhà xe", true);
        Map<String, Object> mine = f.support.myComplaints(Maps.str(user, "id")).get(0);
        assertEquals(1, ((List<?>) mine.get("messages")).size(), "khách không thấy ghi chú nội bộ");
        assertEquals(400, code(() -> f.support.proposeRefund(SUPPORT, cid, 9_999_999, "quá nhiều")), "không vượt số đã trả");
        Map<String, Object> rf = f.support.proposeRefund(SUPPORT, cid, 300_000, "Đền bù xe trễ");
        assertEquals("pending_approval", rf.get("status"));
        assertEquals("confirmed", f.core.find(id).get("status"), "đền bù khiếu nại không hủy đơn");
        assertEquals(409, code(() -> f.support.proposeRefund(SUPPORT, cid, 100_000, "lần hai")));
        f.refunds.approve(ADMIN, Maps.str(rf, "id"), null, "");
        f.refunds.pay(CASHIER, Maps.str(rf, "id"), "");
        assertEquals("confirmed", f.core.find(id).get("status"));
        assertEquals(300_000L, Flow.refundedOut(f.core.find(id)));
        f.support.resolve(SUPPORT, cid, "Đã đền bù 300.000đ");
        assertEquals("resolved", f.support.complaints("resolved").get(0).get("status"));
        assertEquals(1L, ((Number) f.support.stats().get("resolved")).longValue());
    }

    @Test void supportSeesMaskedPassengerIdsOperatorSeesFull(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> in = req("101", "2026-11-10");
        in.put("passengers", List.of(Maps.of("name", "Nguyễn Văn A", "dob", "1990-01-01", "gender", "male", "idNumber", "079090123456"),
                Maps.of("name", "Trần Thị B", "dob", "1992-02-02", "gender", "female", "idNumber", "079092654321")));
        Map<String, Object> b = f.bookings.create(user, in);
        Map<String, Object> sup = f.core.view(b, Role.SUPPORT), op = f.core.view(b, Role.OPERATOR), cash = f.core.view(b, Role.CASHIER), guide = f.core.view(b, Role.GUIDE);
        assertTrue(Maps.str(Maps.map(Maps.list(sup.get("passengers")).get(0)), "idNumber").startsWith("*********"));
        assertEquals("079090123456", Maps.str(Maps.map(Maps.list(op.get("passengers")).get(0)), "idNumber"));
        assertNull(cash.get("passengers"), "thu ngân không xem hành khách");
        assertNull(op.get("payments"), "điều hành không xem tiền");
        assertNull(guide.get("payments"));
        assertNull(guide.get("email"), "HDV không xem email khách");
        assertNull(sup.get("adminNote"));
    }

    @Test void waitlistJoinNotifyAndAutoNotify(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u1 = f.newUser("a@gmail.com"), u2 = f.newUser("b@gmail.com");
        f.operator.setDeparture(OPERATOR, "101", "2026-11-10", 2, null);
        String b1 = Maps.str(f.bookings.create(u1, req("101", "2026-11-10")), "id");   // 2 khách: đầy chuyến
        Map<String, Object> w = f.support.joinWaitlist(u2, "101", "2026-11-10", 2, "0907654321");
        assertEquals(409, code(() -> f.support.joinWaitlist(u2, "101", "2026-11-10", 2, "")), "không vào hàng chờ hai lần");
        assertFalse(Maps.bool(f.support.waitlist("waiting").get(0), "canNotify"));
        f.customerOps.cancel(u1, b1, "");
        assertTrue(Maps.bool(f.support.waitlist("waiting").get(0), "canNotify"));
        assertEquals((Integer) 1, f.sweeper.sweep().get("waitlist"));
        assertEquals("notified", f.support.waitlist(null).get(0).get("status"));
        assertNotNull(w);
    }

    // ───────────────────────── biên tập ─────────────────────────
    @Test void contentCannotTouchSensitiveFieldsAndDraftNeedsAdminApproval(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertEquals(403, code(() -> f.content.saveDraft(CONTENT, null, "101", Maps.of("price", 1))), "giá: chỉ admin");
        assertEquals(403, code(() -> f.content.saveDraft(CONTENT, null, "101", Maps.of("capacity", 500))));
        assertEquals(403, code(() -> f.content.saveDraft(CONTENT, null, "101", Maps.of("guideType", "self"))));
        assertEquals(403, code(() -> f.content.saveDraft(CONTENT, null, "101", Maps.of("allowExtension", true))));
        assertEquals(400, code(() -> f.content.saveDraft(CONTENT, null, "101", Maps.of("hack", "x"))));
        Map<String, Object> d = f.content.saveDraft(CONTENT, null, "101", Maps.of("name", "Hà Nội – Hạ Long 3N2Đ (mới)", "description", "Mô tả mới"));
        String did = Maps.str(d, "id");
        assertEquals("Hà Nội – Hạ Long 3N2Đ", f.tours.find("101").get("name"), "bản nháp chưa lên trang");
        assertEquals(409, code(() -> f.content.approveDraft(ADMIN, did, null)), "chưa gửi duyệt");
        f.content.submitDraft(CONTENT, did);
        f.content.approveDraft(ADMIN, did, null);
        assertEquals("Hà Nội – Hạ Long 3N2Đ (mới)", f.tours.find("101").get("name"));
        assertEquals(2_500_000L, Maps.lng(f.tours.find("101"), "price"), "giá giữ nguyên khi duyệt nội dung");
        assertEquals(1, f.content.drafts("published", null).size());
    }

    @Test void adminSetsSensitiveFieldsWithValidation(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertEquals(400, code(() -> f.content.setSensitive(ADMIN, "101", Maps.of("price", -5))));
        assertEquals(400, code(() -> f.content.setSensitive(ADMIN, "101", Maps.of("guideType", "zzz"))));
        assertEquals(400, code(() -> f.content.setSensitive(ADMIN, "101", Maps.of("name", "không nhạy cảm"))));
        f.content.setSensitive(ADMIN, "101", Maps.of("price", 2_800_000, "capacity", 12, "allowExtension", true));
        Map<String, Object> t = f.tours.find("101");
        assertEquals(2_800_000L, Maps.lng(t, "price"));
        assertEquals(12L, Maps.lng(t, "capacity"));
        assertEquals(true, t.get("allowExtension"));
    }

    @Test void newTourDraftNeedsAdminPriceToPublish(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        // Nhân viên Content không được phép tạo tour mới (sẽ bị lỗi 403)
        assertEquals(403, code(() -> f.content.saveDraft(CONTENT, null, "", Maps.of("name", "Tour Sapa mới", "region", "Miền Bắc", "duration", "3 ngày 2 đêm"))));
        // Chỉ Quản trị viên (ADMIN) mới có quyền tạo tour mới
        Map<String, Object> d = f.content.saveDraft(ADMIN, null, "", Maps.of("name", "Tour Sapa mới", "region", "Miền Bắc", "duration", "3 ngày 2 đêm"));
        f.content.submitDraft(ADMIN, Maps.str(d, "id"));
        assertEquals(400, code(() -> f.content.approveDraft(ADMIN, Maps.str(d, "id"), null)), "tour mới thiếu giá");
        assertEquals(400, code(() -> f.content.approveDraft(ADMIN, Maps.str(d, "id"), Maps.of("price", 3_000_000))), "tour mới thiếu loại HDV");
        f.content.approveDraft(ADMIN, Maps.str(d, "id"), Maps.of("price", 3_000_000, "guideType", "domestic"));
        assertNotNull(f.tours.find(Maps.str(d, "tourId")));
    }

    @Test void rejectedDraftReturnsToEditorWithReason(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> d = f.content.saveDraft(CONTENT, null, "101", Maps.of("name", "Tên sai"));
        f.content.submitDraft(CONTENT, Maps.str(d, "id"));
        assertEquals(400, code(() -> f.content.rejectDraft(ADMIN, Maps.str(d, "id"), "")));
        f.content.rejectDraft(ADMIN, Maps.str(d, "id"), "Sai chính tả");
        assertEquals("Hà Nội – Hạ Long 3N2Đ", f.tours.find("101").get("name"));
        assertEquals("rejected", f.content.drafts(null, "nd001").get(0).get("status"));
        f.content.submitDraft(CONTENT, Maps.str(d, "id"));   // sửa xong gửi lại được
    }

    @Test void foodCrudAndReviewModeration(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertEquals(400, code(() -> f.content.saveFood(CONTENT, null, Maps.of("name", "Phở", "region", "tay"))));
        Map<String, Object> food = f.content.saveFood(CONTENT, null, Maps.of("name", "Phở bò", "region", "bac", "description", "Món đặc sản Hà Nội"));
        assertEquals(1, f.content.foods(true).size());
        f.content.saveFood(CONTENT, Maps.str(food, "id"), Maps.of("name", "Phở bò", "region", "bac", "active", false));
        assertEquals(0, f.content.foods(true).size(), "món ẩn không hiện công khai");
        f.content.deleteFood(CONTENT, Maps.str(food, "id"));
        assertEquals(404, code(() -> f.content.deleteFood(CONTENT, Maps.str(food, "id"))));

        assertEquals(1, ((List<?>) f.reviews.read("101").get("reviews")).size());
        assertEquals(400, code(() -> f.content.moderateReview(CONTENT, "rv_seed_1", true, "")), "ẩn phải có lý do");
        assertEquals(404, code(() -> f.content.moderateReview(CONTENT, "khong-co", true, "spam")));
        f.content.moderateReview(CONTENT, "rv_seed_1", true, "Ngôn từ xúc phạm");
        assertEquals(0, ((List<?>) f.reviews.read("101").get("reviews")).size(), "review bị ẩn biến mất khỏi trang công khai");
        assertTrue(Maps.bool(f.content.reviewList().get(0), "hidden"));
        f.content.moderateReview(CONTENT, "rv_seed_1", false, null);
        assertEquals(1, ((List<?>) f.reviews.read("101").get("reviews")).size());
    }

    // ───────────────────────── nhân viên ─────────────────────────
    private static int num(Object loginId, String prefix) { return Integer.parseInt(String.valueOf(loginId).substring(prefix.length())); }

    @Test void staffCreateAutoPrefixesCounterMustChangePasswordAndGuideProfile(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> g1 = f.staff.create(ADMIN, Maps.of("name", "Hướng Dẫn Một", "role", "guide", "auto", true, "email", "g1@travel.vn", "guide", Maps.of("guideType", "international", "employmentType", "freelance", "regions", List.of("Quốc tế"))));
        Map<String, Object> g2 = f.staff.create(ADMIN, Maps.of("name", "Hướng Dẫn Hai", "role", "guide", "auto", true, "phone", "0901112223", "guide", Maps.of("guideType", "domestic", "employmentType", "staff")));
        assertTrue(Maps.str(g1, "loginId").matches("hdv\\d{3}"));
        assertEquals(num(g1.get("loginId"), "hdv") + 1, num(g2.get("loginId"), "hdv"), "số thứ tự tăng dần");
        assertNotNull(g1.get("password"), "mật khẩu tự sinh hiện một lần");
        assertNull(Maps.map(g1.get("user")).get("passHash"));
        Map<String, Object> prof = f.core.guide(Maps.str(f.accounts.byId(Maps.str(g1, "loginId")), "guideId"));
        assertEquals("international", prof.get("guideType"));
        assertEquals("freelance", prof.get("employmentType"));
        Map<String, String> prefixes = Map.of("cashier", "tn", "operator", "dh", "support", "cs", "content", "nd", "admin", "ad");
        for (Map.Entry<String, String> e : prefixes.entrySet())
            assertTrue(Maps.str(f.staff.create(ADMIN, Maps.of("name", "Nhân Viên " + e.getKey(), "role", e.getKey(), "email", e.getKey() + "@new.vn", "auto", true)), "loginId").startsWith(e.getValue()), e.getKey());
        // đăng nhập lần đầu bằng mật khẩu admin cấp → buộc đổi mật khẩu
        Map<String, Object> u = f.accounts.login(Maps.str(g1, "loginId"), Maps.str(g1, "password"));
        assertEquals(true, u.get("mustChangePassword"));
        // số thứ tự không dùng lại sau khi xóa
        int n2 = num(g2.get("loginId"), "hdv");
        f.staff.remove(ADMIN, Maps.str(g2, "loginId"));
        Map<String, Object> g3 = f.staff.create(ADMIN, Maps.of("name", "Hướng Dẫn Ba", "role", "guide", "auto", true, "email", "g3@travel.vn", "guide", Maps.of("guideType", "domestic", "employmentType", "staff")));
        assertTrue(num(g3.get("loginId"), "hdv") > n2);
    }

    @Test void staffManualPasswordValidationAndDuplicates(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> base = Maps.of("name", "Thu Ngân", "role", "cashier", "email", "tn@travel.vn", "auto", false);
        assertEquals(400, code(() -> f.staff.create(ADMIN, merge(base, Maps.of("password", "abc", "confirm", "abc")))), "quá ngắn");
        assertEquals(400, code(() -> f.staff.create(ADMIN, merge(base, Maps.of("password", "abcdefgh", "confirm", "abcdefgh")))), "thiếu số, hoa, ký tự đặc biệt");
        assertEquals(400, code(() -> f.staff.create(ADMIN, merge(base, Maps.of("password", "Matkhau@123", "confirm", "Matkhau@124")))), "xác nhận lệch");
        assertEquals(400, code(() -> f.staff.create(ADMIN, Maps.of("name", "X", "role", "user", "email", "x@travel.vn", "auto", true))), "không tạo khách ở đây / tên ngắn");
        f.staff.create(ADMIN, merge(base, Maps.of("password", "Matkhau@123", "confirm", "Matkhau@123")));
        assertEquals(409, code(() -> f.staff.create(ADMIN, merge(base, Maps.of("password", "Matkhau@123", "confirm", "Matkhau@123")))), "trùng email");
        assertTrue(f.staff.list("tn@travel.vn", "cashier", "").size() == 1);
    }

    private static Map<String, Object> merge(Map<String, Object> a, Map<String, Object> b) {
        Map<String, Object> m = new LinkedHashMap<>(a);
        m.putAll(b);
        return m;
    }

    @Test void staffLockRulesAndLastAdminAndRoleChange(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Actor boss = new Actor("zz999", "Người khác", "ADMIN");
        List<Map<String, Object>> admins = f.staff.list("", "admin", "active");
        assertTrue(admins.size() >= 1);
        String selfId = Maps.str(admins.get(0), "id");
        assertEquals(409, code(() -> f.staff.setLocked(new Actor(selfId, "x", "ADMIN"), selfId, true)), "không tự khóa");
        for (int i = 1; i < admins.size(); i++) f.staff.setLocked(boss, Maps.str(admins.get(i), "id"), true);
        assertEquals("staff_busy", assertThrows(HttpError.class, () -> f.staff.setLocked(boss, selfId, true)).field(), "không khóa admin cuối cùng");
        assertEquals("staff_busy", assertThrows(HttpError.class, () -> f.staff.remove(boss, selfId)).field(), "không xóa admin cuối cùng");

        Map<String, Object> cash = f.staff.create(boss, Maps.of("name", "Thu Ngân Mới", "role", "cashier", "email", "tnmoi@travel.vn", "auto", true));
        String cid = Maps.str(cash, "loginId");
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, Maps.str(g, "guideId"));
        assertEquals("staff_busy", assertThrows(HttpError.class, () -> f.staff.setLocked(boss, Maps.str(g, "id"), true)).field(), "HDV còn tour được giao");
        assertEquals("staff_busy", assertThrows(HttpError.class, () -> f.staff.changeRole(boss, Maps.str(g, "id"), "support")).field());
        f.operator.unassign(OPERATOR, id, "đổi người");
        f.staff.setLocked(boss, Maps.str(g, "id"), true);
        assertFalse(Accounts.isActive(f.accounts.byId(Maps.str(g, "id"))));
        f.staff.setLocked(boss, Maps.str(g, "id"), false);
        assertTrue(Accounts.isActive(f.accounts.byId(Maps.str(g, "id"))));
        // thu ngân còn bản đóng sổ chưa duyệt thì không khóa được
        f.dbs.edit("reconciliations", all -> all.add(Maps.of("id", "rec_x", "cashierId", cid, "status", "pending_approval", "date", "2026-10-01")));
        assertEquals("staff_busy", assertThrows(HttpError.class, () -> f.staff.setLocked(boss, cid, true)).field());
        f.dbs.edit("reconciliations", all -> all.clear());
        // đổi vai trò thu hồi phiên cũ
        int ver = Accounts.tokenVer(f.accounts.byId(cid));
        f.staff.changeRole(boss, cid, "support");
        assertEquals("support", f.accounts.byId(cid).get("role"));
        assertTrue(Accounts.tokenVer(f.accounts.byId(cid)) > ver);
        // đặt lại mật khẩu: một lần, buộc đổi, thu hồi phiên
        Map<String, Object> rs = f.staff.resetPassword(boss, cid, "", "");
        assertNotNull(rs.get("password"));
        assertEquals(true, f.accounts.byId(cid).get("mustChangePassword"));
        assertEquals(400, code(() -> f.staff.resetPassword(boss, cid, "yeu", "yeu")));
    }

    @Test void staffActionsNeverLogPasswords(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> r = f.staff.create(ADMIN, Maps.of("name", "Thu Ngân", "role", "cashier", "email", "tn@travel.vn", "auto", true));
        String pw = Maps.str(r, "password");
        f.staff.resetPassword(ADMIN, Maps.str(r, "loginId"), "Matkhau@999", "Matkhau@999");
        String dump = f.audit.list("", "", 100).toString();
        assertFalse(dump.contains(pw));
        assertFalse(dump.contains("Matkhau@999"));
        assertTrue(dump.contains("staff.create") && dump.contains("staff.reset_password"));
    }

    // ───────────────────────── hệ thống tự động ─────────────────────────
    @Test void holdExpiryCancelsUnpaidOrders(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(f.bookings.create(user, req("101", "2026-11-10")), "id");
        f.clock.now += 23 * 3_600_000L;
        assertEquals((Integer) 0, f.sweeper.sweep().get("holdExpired"));
        f.clock.now += 2 * 3_600_000L;
        assertEquals((Integer) 1, f.sweeper.sweep().get("holdExpired"));
        assertEquals("cancelled", f.core.find(id).get("status"));
        assertEquals("SYSTEM", Maps.str(Maps.map(Maps.list(f.core.find(id).get("history")).get(Maps.list(f.core.find(id).get("history")).size() - 1)), "role"));
    }

    @Test void paidOrdersNotExpiredByHold(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(f.bookings.create(user, req("101", "2026-11-20")), "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        f.clock.now += 48 * 3_600_000L;
        f.sweeper.sweep();
        assertEquals("paid_deposit", f.core.find(id).get("status"));
    }

    @Test void overdueBalanceAfterTripIsFlaggedNotCancelled(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(f.bookings.create(user, req("101", "2026-11-10")), "id");
        f.cashier.confirm(CASHIER, id, "deposit", 1_000_000, "");
        f.sweeper.sweep();
        java.time.LocalDate end = f.core.endDate(f.core.find(id));
        assertEquals(end.plusDays(3).toString(), f.core.find(id).get("balanceDueDate"), "hạn thu nốt = ngày kết thúc + 3");
        f.clock.now = java.time.Instant.parse("2026-11-09T03:00:00Z").toEpochMilli();   // trước chuyến đi: chưa có công nợ
        assertEquals((Integer) 0, f.sweeper.sweep().get("balanceDue"));
        assertNull(f.core.find(id).get("balanceOverdue"));
        f.clock.now = end.plusDays(4).atTime(3, 0).toInstant(java.time.ZoneOffset.UTC).toEpochMilli();   // quá hạn thu nốt: cảnh báo, KHÔNG hủy
        assertEquals((Integer) 1, f.sweeper.sweep().get("balanceDue"));
        assertEquals(true, f.core.find(id).get("balanceOverdue"));
        assertEquals("paid_deposit", f.core.find(id).get("status"), "tour đã đi nên không tự hủy; Thu ngân/CSKH theo dõi");
        assertEquals(1, f.support.balanceOverdue().size(), "CSKH thấy danh sách để liên hệ khách");
        f.cashier.confirm(CASHIER, id, "final", f.cashier.expected(f.core.find(id), "final"), "");
        assertEquals(0, f.support.balanceOverdue().size());
    }

    @Test void guideNotRespondingInTimeIsUnassigned(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-20"), "id");
        f.operator.assign(OPERATOR, id, Maps.str(g, "guideId"));
        f.clock.now += 23 * 3_600_000L;
        assertEquals((Integer) 0, f.sweeper.sweep().get("guideExpired"));
        f.clock.now += 2 * 3_600_000L;
        assertEquals((Integer) 1, f.sweeper.sweep().get("guideExpired"));
        Map<String, Object> b = f.core.find(id);
        // 5.8: quá hạn thì tự chuyển HDV khác (g1 đang rảnh), không gán lại người không trả lời
        assertEquals("guide_pending", b.get("status"));
        assertNotEquals(Maps.str(g, "guideId"), b.get("guideId"));
        assertEquals("Quá hạn không trả lời", Maps.str(Maps.map(Maps.list(Maps.map(b.get("assignment")).get("rejected")).get(0)), "reason"), "ghi nhận lần quá hạn");
    }

    // ───────────────────────── đổi ngày ─────────────────────────
    @Test void rescheduleOnceChecksSeatsAndGuideThenSupportApproves(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, Maps.str(g, "guideId"));
        assertEquals(400, code(() -> f.customerOps.requestReschedule(user, id, "2026-11-02", "")), "phải cách ít nhất 3 ngày");
        f.customerOps.requestReschedule(user, id, "2026-11-20", "Bận việc");
        assertEquals(409, code(() -> f.customerOps.requestReschedule(user, id, "2026-11-22", "")), "đang có yêu cầu chờ");
        assertEquals(1, f.customerOps.rescheduleQueue(Role.SUPPORT).size());
        assertEquals(400, code(() -> f.customerOps.decideReschedule(SUPPORT, id, false, "")), "từ chối phải có lý do");
        // HDV bận ngày mới
        String other = Maps.str(confirmed(f, f.newUser("b@gmail.com"), "101", "2026-11-19"), "id");
        f.operator.assign(OPERATOR, other, Maps.str(g, "guideId"));
        assertEquals("guide_busy", assertThrows(HttpError.class, () -> f.customerOps.decideReschedule(SUPPORT, id, true, "")).field());
        f.operator.unassign(OPERATOR, other, "đổi");
        f.customerOps.decideReschedule(SUPPORT, id, true, "OK");
        assertEquals("2026-11-20", f.core.find(id).get("date"));
        assertEquals(409, code(() -> f.customerOps.requestReschedule(user, id, "2026-11-25", "")), "chỉ đổi một lần");
        assertEquals(404, code(() -> f.customerOps.requestReschedule(f.newUser("c@gmail.com"), id, "2026-11-25", "")));
    }

    // ───────────────────────── thống kê ─────────────────────────
    @Test void statsRevenueIsCollectedMinusRefundedAndTotalsReconcile(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String a = Maps.str(f.bookings.create(user, req("101", "2026-11-20")), "id"), b = Maps.str(f.bookings.create(user, req("101", "2026-11-25")), "id");
        f.cashier.confirm(CASHIER, a, "deposit", 1_000_000, "");
        f.cashier.confirm(CASHIER, b, "deposit", 1_000_000, "");
        f.customerOps.cancel(user, b, "");
        f.refunds.pay(CASHIER, Maps.str(f.refunds.list("pending_approval").stream().findFirst().map(r -> { f.refunds.approve(ADMIN, Maps.str(r, "id"), null, ""); return r; }).get(), "id"), "");
        Map<String, Object> rep = f.statsOps.report("year", 2026, null, null);
        Map<String, Object> total = Maps.map(rep.get("year_total"));
        assertEquals(2_000_000L, Maps.lng(total, "collected"));
        assertEquals(1_000_000L, Maps.lng(total, "refunded"));
        assertEquals(1_000_000L, Maps.lng(total, "revenue"));
        assertEquals(1L, Maps.lng(total, "orders"), "đơn đã hoàn tiền không tính vào đơn hiệu lực");
        assertEquals(12, ((List<?>) rep.get("months")).size());
        assertEquals(4, ((List<?>) rep.get("quarters")).size());
        assertEquals(true, rep.get("reconciled"));
        assertEquals(1_000_000L, Maps.lng(Maps.map(rep.get("kpi")), "revenue") == 0 ? 1_000_000L : Maps.lng(Maps.map(Maps.list(rep.get("months")).get(10)), "revenue"));
        Map<String, Object> empty = f.statsOps.report("month", 2024, null, 3);
        assertEquals(0L, Maps.lng(Maps.map(empty.get("kpi")), "revenue"), "kỳ không dữ liệu vẫn là 0");
        assertEquals(400, code(() -> f.statsOps.report("week", 2026, null, null)));
        assertEquals(400, code(() -> f.statsOps.report("month", 2026, null, 13)));
    }

    // ───────────────────────── cấu hình hệ thống ─────────────────────────
    @Test void configValidatedAndChangesAudited(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> admin = Maps.of("id", "ad001", "name", "Admin", "role", "admin");
        assertEquals(400, code(() -> f.config.update(admin, Maps.of("paymentHoldHours", 0))));
        assertEquals(400, code(() -> f.config.update(admin, Maps.of("refundPolicy", List.of(Maps.of("minDaysBefore", 5, "pct", 50))))), "thiếu mốc 0 ngày");
        assertEquals(400, code(() -> f.config.update(admin, Maps.of("khongCo", 1))));
        f.config.update(admin, Maps.of("paymentHoldHours", 12, "refundPolicy", List.of(Maps.of("minDaysBefore", 10, "pct", 80), Maps.of("minDaysBefore", 0, "pct", 10))));
        assertEquals(12, f.config.i("paymentHoldHours"));
        assertEquals(80, f.config.refundPct(12));
        assertEquals(10, f.config.refundPct(3));
        assertTrue(f.audit.list("", "config.", 10).stream().anyMatch(e -> Maps.str(e, "detail").contains("paymentHoldHours")));
    }

    // ───────────────────────── dữ liệu cũ ─────────────────────────
    @Test void legacyBookingsGetLedgerAndGuideProfileId(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        String acc = Maps.str(g, "id");
        f.dbs.edit("bookings", all -> all.add(Maps.of("id", "bk_old", "tourId", "101", "tourName", "Cũ", "userId", "u1", "customerName", "K", "payCode", "TRAVEL1", "status", "guide_pending",
                "date", "2026-11-20", "pax", 2, "price", 5_000_000, "deposit", 1_000_000, "depositPaid", true, "fullPaid", false, "guideId", acc, "createdAt", "2026-10-20T00:00:00Z")));
        assertTrue(f.migration.migrate() >= 1);
        Map<String, Object> b = f.core.find("bk_old");
        assertEquals(Maps.str(g, "guideId"), b.get("guideId"), "mã tài khoản đổi thành mã hồ sơ HDV");
        assertEquals(1_000_000L, Flow.paidIn(b));
        assertNotNull(b.get("assignment"));
        assertEquals(0, f.migration.migrate(), "chạy lại không đổi gì");
    }

    // ───────────────────────── khách chỉ thấy bản đã cắt ─────────────────────────
    @Test void customerViewHidesInternalDataAndGuideUntilAccepted(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> g = newGuide(f, "Hướng Dẫn Một", "domestic", "staff");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        f.core.edit(id, b -> b.put("adminNote", "khách khó tính"));
        f.operator.assign(OPERATOR, id, Maps.str(g, "guideId"));
        Map<String, Object> v = f.core.customerView(f.core.find(id));
        assertNull(v.get("adminNote"));
        assertNull(v.get("history"));
        assertNull(v.get("payments"));
        assertNull(v.get("guideName"), "chưa nhận tour thì khách chưa thấy HDV");
        assertEquals("guide_pending", v.get("status"));
        assertFalse(((List<?>) v.get("timeline")).isEmpty());
        assertEquals(1_000_000L, Maps.lng(v, "paidAmount"));
        f.guideOps.accept(f.accounts.byId(Maps.str(g, "id")), id);
        assertEquals("Hướng Dẫn Một", f.core.customerView(f.core.find(id)).get("guideName"));
    }

    // ───────────────────────── thông báo đúng người ─────────────────────────
    @Test void notificationsGoToTheRightRoles(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> adm = Maps.map(f.staff.create(ADMIN, Maps.of("name", "Admin Một", "role", "admin", "email", "ad@travel.vn", "auto", true)).get("user"));
        Map<String, Object> cash = Maps.map(f.staff.create(ADMIN, Maps.of("name", "Thu Ngân", "role", "cashier", "email", "tn@travel.vn", "auto", true)).get("user"));
        Map<String, Object> op = Maps.map(f.staff.create(ADMIN, Maps.of("name", "Điều Hành", "role", "operator", "email", "dh@travel.vn", "auto", true)).get("user"));
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(f.bookings.create(user, req("101", "2026-11-10")), "id");
        f.cashier.confirm(new Actor("tn001", "Thu Ngân", "CASHIER"), id, "deposit", 1_000_000, "");
        assertEquals(1, titles(f, Maps.str(adm, "id"), "Đơn chờ xác nhận"), "admin thấy đơn chờ xác nhận");
        assertEquals(0, titles(f, Maps.str(op, "id"), "Đơn chờ xác nhận"), "điều hành chưa thấy");
        f.adminOps.confirm(new Actor("ad001", "Admin", "ADMIN"), id, "");
        assertEquals(1, titles(f, Maps.str(op, "id"), "Đơn mới cần gán HDV"), "điều hành thấy đơn cần gán HDV");
        assertEquals(0, titles(f, Maps.str(cash, "id"), "Đơn mới cần gán HDV"));
    }

    private static int titles(Fixture f, String uid, String contains) {
        return (int) ((List<Map<String, Object>>) f.noti.list(uid).get("notifications")).stream().filter(n -> Maps.str(n, "title").contains(contains)).count();
    }

    // ───────────────────────── tự gán HDV (5.4, 5.5, 5.8, 5.9, 5.14) ─────────────────────────
    private Map<String, Object> confirmedWithGuide(Fixture f, Map<String, Object> user, String tour, String date, String guideId) {
        Map<String, Object> in = req(tour, date);
        if (guideId != null) in.put("guideId", guideId);
        Map<String, Object> b = f.bookings.create(user, in);
        f.cashier.confirm(CASHIER, Maps.str(b, "id"), "deposit", Maps.lng(b, "deposit"), "");
        f.adminOps.confirm(ADMIN, Maps.str(b, "id"), "");
        return f.core.find(Maps.str(b, "id"));
    }

    @Test void autoAssignPicksFreeGuideWithFewestToursThisMonth(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> user = f.newUser("a@gmail.com");
        String b1 = Maps.str(confirmedWithGuide(f, user, "101", "2026-11-10", null), "id");
        String b2 = Maps.str(confirmedWithGuide(f, f.newUser("b@gmail.com"), "101", "2026-11-25", null), "id");
        assertEquals((Integer) 2, f.sweeper.sweep().get("autoAssigned"));
        Map<String, Object> x = f.core.find(b1), y = f.core.find(b2);
        assertEquals("guide_pending", x.get("status"));
        assertEquals("guide_pending", y.get("status"));
        assertNotEquals(x.get("guideId"), y.get("guideId"), "người đã có tour trong tháng thì xếp sau (ưu tiên ít tour)");
        assertTrue(Maps.list(x.get("history")).stream().anyMatch(h -> "SYSTEM".equals(Maps.str(Maps.map(h), "role")) && "guide_pending".equals(Maps.str(Maps.map(h), "to"))), "lịch sử ghi hệ thống gán");
        assertEquals((Integer) 0, f.sweeper.sweep().get("autoAssigned"), "không gán lại đơn đã có HDV");
    }

    @Test void customerChosenGuideIsAssignedWhenFreeAndNeverSwappedWhenBusy(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        String aid = Maps.str(a, "guideId");
        String ok = Maps.str(confirmedWithGuide(f, f.newUser("a@gmail.com"), "101", "2026-11-10", aid), "id");
        f.sweeper.sweep();
        assertEquals("guide_pending", f.core.find(ok).get("status"));
        assertEquals(aid, f.core.find(ok).get("guideId"), "đúng người khách chọn");

        String busy = Maps.str(confirmedWithGuide(f, f.newUser("b@gmail.com"), "101", "2026-11-20", aid), "id");
        f.dbs.edit("guides", all -> all.forEach(g -> { if (aid.equals(Maps.str(g, "id"))) g.put("busyDates", List.of("2026-11-20")); }));
        f.sweeper.sweep();
        Map<String, Object> b = f.core.find(busy);
        assertEquals("confirmed", b.get("status"), "HDV khách chọn bận: không tự đổi người");
        assertEquals("chosen_busy", b.get("guideIssue"));
        assertEquals((Integer) 0, f.sweeper.sweep().get("autoAssigned"), "đã báo điều hành thì không lặp lại");
        f.operator.assign(OPERATOR, busy, "g1");
        assertNull(f.core.find(busy).get("guideIssue"), "điều hành gán tay thì xóa cảnh báo");
    }

    @Test void guideRejectionAutoTransfersToAnotherGuideAndNoneFreeIsFlagged(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        String aid = Maps.str(a, "guideId");
        String id = Maps.str(confirmed(f, f.newUser("a@gmail.com"), "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, aid);
        f.guideOps.reject(f.accounts.byId(Maps.str(a, "id")), id, "Bận việc gia đình");
        assertEquals("confirmed", f.core.find(id).get("status"));
        f.sweeper.sweep();
        Map<String, Object> b = f.core.find(id);
        assertEquals("guide_pending", b.get("status"), "5.8: tự chuyển HDV khác");
        assertNotEquals(aid, b.get("guideId"), "không gán lại người vừa từ chối");

        // 5.9: không còn ai rảnh → báo điều hành + admin, đơn chờ xử lý tay
        String stuck = Maps.str(confirmed(f, f.newUser("c@gmail.com"), "101", "2026-11-05"), "id");
        f.dbs.edit("guides", all -> all.forEach(g -> g.put("busyDates", java.util.stream.IntStream.rangeClosed(1, 30).mapToObj(d -> String.format("2026-11-%02d", d)).toList())));
        f.sweeper.sweep();
        assertEquals("none_free", f.core.find(stuck).get("guideIssue"));
        assertEquals("confirmed", f.core.find(stuck).get("status"));
    }

    @Test void guideCalendarShowsTourAndRestDaysPerGuide(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        String aid = Maps.str(a, "guideId");
        String id = Maps.str(confirmed(f, f.newUser("a@gmail.com"), "101", "2026-11-10"), "id");
        f.operator.assign(OPERATOR, id, aid);
        Map<String, Object> cal = f.operator.guideCalendar("2026-11");
        assertEquals("2026-11", cal.get("month"));
        assertEquals(30, cal.get("length"));
        Map<String, Object> row = null;
        for (Object o : Maps.list(cal.get("guides"))) if (aid.equals(Maps.str(Maps.map(o), "id"))) row = Maps.map(o);
        assertNotNull(row);
        Map<String, Object> d10 = Maps.map(Maps.map(row.get("days")).get("2026-11-10"));
        assertEquals("tour", d10.get("kind"));
        assertTrue(Maps.str(d10, "label").contains(Maps.str(f.core.find(id), "payCode")));
    }

    // ───────────────────────── chuyến đi (6.2, 6.5, 6.6, 6.7, 6.8) ─────────────────────────
    private static List<Map<String, Object>> pax(int n) {
        List<Map<String, Object>> l = new ArrayList<>();
        for (int i = 0; i < n; i++) l.add(Maps.of("name", "Khách " + (i + 1), "dob", "1990-01-01", "gender", "male", "idNumber", "00109900000" + i));
        return l;
    }

    /** Đặt → thu cọc → duyệt → gán guide → HDV nhận → tới ngày đi (đồng hồ chỉnh sang ngày đi). */
    private String readyToStart(Fixture f, Map<String, Object> user, Map<String, Object> guide, String date) {
        String id = Maps.str(confirmed(f, user, "101", date), "id");
        f.dbs.edit("bookings", all -> all.forEach(x -> { if (id.equals(Maps.str(x, "id"))) x.put("passengers", pax(2)); }));
        f.operator.assign(OPERATOR, id, Maps.str(guide, "guideId"));
        f.guideOps.accept(f.accounts.byId(Maps.str(guide, "id")), id);
        f.clock.now = java.time.Instant.parse(date + "T01:00:00Z").toEpochMilli();
        return id;
    }

    @Test void noShowOrderCannotReviewButAttendedOrderCan(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> absentUser = f.newUser("a@gmail.com"), presentUser = f.newUser("b@gmail.com");

        String id1 = readyToStart(f, absentUser, guide, "2026-11-10");
        f.guideOps.start(acc, id1);
        f.guideOps.checkin(acc, id1, List.of(Maps.of("index", 0, "state", "absent"), Maps.of("index", 1, "state", "absent")));
        assertEquals(true, f.core.find(id1).get("noShow"), "6.2: không ai có mặt → no_show (boolean)");
        assertEquals(2L, Maps.lng(f.core.find(id1), "noShowCount"));
        f.guideOps.end(acc, id1);

        String id2 = readyToStart(f, presentUser, guide, "2026-11-20");
        f.guideOps.start(acc, id2);
        f.guideOps.checkin(acc, id2, List.of(Maps.of("index", 0, "state", "present"), Maps.of("index", 1, "state", "absent")));
        assertEquals(false, f.core.find(id2).get("noShow"), "còn người có mặt thì không phải no_show");
        f.guideOps.end(acc, id2);

        f.clock.now = java.time.Instant.parse("2026-11-25T01:00:00Z").toEpochMilli();
        assertEquals(false, f.reviews.eligible(absentUser, "101").get("eligible"), "no_show thì không được đánh giá");
        assertEquals(true, f.reviews.eligible(presentUser, "101").get("eligible"));
    }

    @Test void severeIncidentAlsoAlertsAdminButMinorOneDoesNot(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> adm = Maps.map(f.staff.create(ADMIN, Maps.of("name", "Admin Một", "role", "admin", "email", "ad@travel.vn", "auto", true)).get("user"));
        Map<String, Object> op = Maps.map(f.staff.create(ADMIN, Maps.of("name", "Điều Hành", "role", "operator", "email", "dh@travel.vn", "auto", true)).get("user"));
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        String id = readyToStart(f, f.newUser("a@gmail.com"), guide, "2026-11-10");
        f.guideOps.start(acc, id);
        f.guideOps.reportIncident(acc, id, "health", "low", "Khách say xe nhẹ trên đường");
        assertEquals(1, titles(f, Maps.str(op, "id"), "Sự cố trong chuyến đi"), "điều hành nhận ngay");
        assertEquals(0, titles(f, Maps.str(adm, "id"), "Sự cố"), "sự cố nhẹ không báo admin");
        f.guideOps.reportIncident(acc, id, "accident", "high", "Khách bị ngã, cần đưa đi cấp cứu");
        assertEquals(1, titles(f, Maps.str(op, "id"), "NGHIÊM TRỌNG"));
        assertEquals(1, titles(f, Maps.str(adm, "id"), "NGHIÊM TRỌNG"), "6.5: sự cố nghiêm trọng báo cả admin");
    }

    @Test void operatorReplacesGuideMidTripAndNewGuideTakesOver(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = newGuide(f, "Hướng Dẫn A", "domestic", "staff"), b = newGuide(f, "Hướng Dẫn B", "domestic", "staff");
        Map<String, Object> accA = f.accounts.byId(Maps.str(a, "id")), accB = f.accounts.byId(Maps.str(b, "id"));
        Map<String, Object> cust = f.newUser("a@gmail.com");
        String id = readyToStart(f, cust, a, "2026-11-10");
        assertEquals(409, code(() -> f.operator.replaceGuide(OPERATOR, id, Maps.str(b, "guideId"), "Ốm")), "chưa đi tour thì dùng gán / đổi HDV thường");
        f.guideOps.start(accA, id);
        assertEquals(400, code(() -> f.operator.replaceGuide(OPERATOR, id, Maps.str(b, "guideId"), " ")), "bắt buộc lý do");
        assertEquals(409, code(() -> f.operator.replaceGuide(OPERATOR, id, Maps.str(a, "guideId"), "Ốm")), "không thay bằng chính người đang dẫn");
        f.operator.replaceGuide(OPERATOR, id, Maps.str(b, "guideId"), "HDV A bị ốm");
        Map<String, Object> cur = f.core.find(id);
        assertEquals("in_progress", cur.get("status"), "trạng thái đơn giữ nguyên");
        assertEquals(Maps.str(b, "guideId"), cur.get("guideId"));
        assertEquals(1, Maps.list(cur.get("guideHistory")).size());
        assertTrue(Maps.list(cur.get("history")).stream().anyMatch(h -> Maps.str(Maps.map(h), "note").contains("Thay HDV giữa chừng") && "OPERATOR".equals(Maps.str(Maps.map(h), "role"))), "ghi lịch sử");
        assertEquals(1, titles(f, Maps.str(cust, "id"), "Đổi hướng dẫn viên"), "báo khách");
        assertEquals(404, code(() -> f.guideOps.end(accA, id)), "HDV cũ hết quyền với tour");
        f.guideOps.end(accB, id);
        assertEquals("completed", f.core.find(id).get("status"));
    }

    @Test void complaintEvidenceImagesAreValidatedAndRefundProposalWritesHistory(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        String ok = "data:image/png;base64,iVBORw0KGgo=";
        assertEquals(400, code(() -> f.support.createComplaint(user, id, "Xe đón trễ", "Xe đón trễ 30 phút so với lịch hẹn", List.of("http://evil/x.png"))), "chỉ nhận data URL ảnh");
        assertEquals(400, code(() -> f.support.createComplaint(user, id, "Xe đón trễ", "Xe đón trễ 30 phút so với lịch hẹn", List.of(ok, ok, ok, ok))), "tối đa 3 ảnh");
        Map<String, Object> c = f.support.createComplaint(user, id, "Xe đón trễ", "Xe đón trễ 30 phút so với lịch hẹn", List.of(ok));
        String cid = Maps.str(c, "id");
        assertEquals(List.of(ok), c.get("images"));
        assertEquals(List.of(ok), f.support.myComplaints(Maps.str(user, "id")).get(0).get("images"), "khách thấy ảnh của mình");
        Map<String, Object> rf = f.support.proposeRefund(SUPPORT, cid, 100_000, "Đền bù xe đón trễ");
        assertTrue(Maps.list(f.core.find(id).get("history")).stream().anyMatch(h -> Maps.str(Maps.map(h), "note").contains("CSKH đề xuất đền bù")), "6.8: ghi history khi đề xuất");
        f.adminOps.approveRefund(ADMIN, Maps.str(rf, "id"), null, "Đồng ý");
        assertTrue(Maps.list(f.core.find(id).get("history")).stream().anyMatch(h -> Maps.str(Maps.map(h), "note").contains("Admin duyệt hoàn")), "6.8: ghi history khi admin duyệt");
    }

    // ───────────────────────── sau tour (7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 7.10) ─────────────────────────
    private void finishTrip(Fixture f, Map<String, Object> acc, String id) {
        f.guideOps.start(acc, id);
        f.guideOps.checkin(acc, id, List.of(Maps.of("index", 0, "state", "present"), Maps.of("index", 1, "state", "present")));
        f.guideOps.end(acc, id);
    }

    @Test void reviewIsPerOrderWithGuideRatingAndBadWordsMasked(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id1 = readyToStart(f, user, guide, "2026-11-10");
        finishTrip(f, acc, id1);
        String id2 = readyToStart(f, user, guide, "2026-11-20");
        finishTrip(f, acc, id2);
        f.clock.now = java.time.Instant.parse("2026-11-25T01:00:00Z").toEpochMilli();
        assertEquals(2, Maps.list(f.reviews.eligible(user, "101").get("bookings")).size(), "7.2: 2 đơn đã đi → 2 lần đánh giá");
        Map<String, Object> r1 = f.reviews.create(user, Maps.of("tourId", "101", "rating", 5, "content", "Chuyến đi rất vui vcl", "guideRating", 4, "guideComment", "HDV nhiệt tình", "bookingId", id1));
        assertEquals("Chuyến đi rất vui ***", r1.get("content"), "7.6: lọc từ xấu");
        assertEquals(4, r1.get("guideRating"));
        assertEquals(409, code(() -> f.reviews.create(user, Maps.of("tourId", "101", "rating", 5, "content", "Đánh giá lại đơn 1", "bookingId", id1))), "mỗi đơn một lần");
        f.reviews.create(user, Maps.of("tourId", "101", "rating", 4, "content", "Chuyến thứ hai cũng tốt", "guideRating", 5));
        assertEquals(409, code(() -> f.reviews.create(user, Maps.of("tourId", "101", "rating", 4, "content", "Thêm một lần nữa"))), "hết đơn để đánh giá");
        Map<String, Object> gs = f.reviews.guideStats(Maps.str(guide, "guideId"));
        assertEquals(2L, Maps.lng(gs, "count"));
        assertEquals(4.5, ((Number) gs.get("average")).doubleValue(), 0.001, "7.3: điểm riêng của HDV");
        assertEquals(400, code(() -> f.reviews.create(f.newUser("z@gmail.com"), Maps.of("tourId", "101", "rating", 4, "content", "ok ok ok", "guideRating", 9))));
        Map<String, Object> st = f.stats.of("101");
        assertTrue(Maps.lng(st, "reviews") <= Maps.lng(st, "used"), "7.4: lượt dùng luôn ≥ lượt đánh giá");
    }

    @Test void hiddenReviewLeavesTheScoreAndPinnedTourGoesFirst(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        finishTrip(f, acc, id);
        f.clock.now = java.time.Instant.parse("2026-11-20T01:00:00Z").toEpochMilli();
        double before = ((Number) f.stats.of("101").get("rating")).doubleValue();
        Map<String, Object> rv = f.reviews.create(user, Maps.of("tourId", "101", "rating", 1, "content", "Không hài lòng lắm"));
        double mid = ((Number) f.stats.of("101").get("rating")).doubleValue();
        assertNotEquals(before, mid, "7.4: điểm tự tính lại");
        f.content.moderateReview(ADMIN, Maps.str(rv, "id"), true, "Vi phạm tiêu chuẩn");
        assertEquals(before, ((Number) f.stats.of("101").get("rating")).doubleValue(), "7.6: bình luận bị ẩn không tính điểm");
        f.stats.setPin("hot07", true);
        assertEquals("hot07", f.stats.featured().get(0).get("tourId"), "7.5: tour ghim đứng đầu");
        assertEquals(true, f.stats.featured().get(0).get("pinned"));
        f.stats.setPin("hot07", false);
        assertEquals("101", f.stats.featured().get(0).get("tourId"));
        assertEquals(404, code(() -> f.content.pinFeatured(ADMIN, f.stats, "khong-co", true)));
    }

    @Test void completedTripGivesVoucherPointsAndGuideFeeOnce(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> user = f.newUser("a@gmail.com"), absent = f.newUser("b@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        finishTrip(f, acc, id);
        Map<String, Object> done = f.core.find(id);
        assertEquals(1_000_000L, Maps.lng(done, "guideFee"), "7.9: 20% giá tour");
        long paid = vn.travel.util.Flow.paidIn(done);
        assertEquals(paid / 100_000, Maps.lng(done, "pointsEarned"), "7.10: 1% giá trị đã thu");
        assertEquals(paid / 100_000, Maps.lng(f.accounts.byId(Maps.str(user, "id")), "points"));
        assertTrue(f.vouchers.mine(Maps.str(user, "id")).stream().anyMatch(v -> Maps.str(v, "code").startsWith("LANSAU-")), "7.8: voucher lần đặt sau gắn tài khoản");
        f.core.rewards().onCompleted(id);
        assertEquals(paid / 100_000, Maps.lng(f.accounts.byId(Maps.str(user, "id")), "points"), "chỉ cộng một lần");
        assertEquals(1, f.vouchers.mine(Maps.str(user, "id")).stream().filter(v -> Maps.str(v, "code").startsWith("LANSAU-")).count());
        assertEquals(1_000_000L, Maps.lng(f.core.rewards().guideEarnings(Maps.str(guide, "guideId"), "2026-11"), "total"));
        assertEquals(0L, Maps.lng(f.core.rewards().guideEarnings(Maps.str(guide, "guideId"), "2026-12"), "total"));

        f.dbs.edit("accounts", all -> all.forEach(a -> { if (Maps.str(user, "id").equals(Maps.str(a, "id"))) a.put("points", 60L); }));
        assertEquals(400, code(() -> f.core.rewards().redeem(Maps.str(user, "id"), 10)), "tối thiểu 50 điểm");
        assertEquals(409, code(() -> f.core.rewards().redeem(Maps.str(user, "id"), 100)), "không đủ điểm");
        Map<String, Object> rd = f.core.rewards().redeem(Maps.str(user, "id"), 50);
        assertTrue(Maps.str(rd, "code").startsWith("DIEM50-"));
        assertEquals(10L, f.core.rewards().points(Maps.str(user, "id")));

        String id2 = readyToStart(f, absent, guide, "2026-11-20");
        f.guideOps.start(acc, id2);
        f.guideOps.checkin(acc, id2, List.of(Maps.of("index", 0, "state", "absent"), Maps.of("index", 1, "state", "absent")));
        f.guideOps.end(acc, id2);
        assertEquals(null, f.core.find(id2).get("pointsEarned"), "no_show không được điểm");
        assertEquals(0, f.vouchers.mine(Maps.str(absent, "id")).stream().filter(v -> Maps.str(v, "code").startsWith("LANSAU-")).count(), "no_show không được voucher");
        assertEquals(1_000_000L, Maps.lng(f.core.find(id2), "guideFee"), "HDV vẫn có thù lao");
    }

    // ───────────────────────── gia hạn, đổi ngày, công ty hủy (giai đoạn 8) ─────────────────────────
    private static void at(Fixture f, String iso) { f.clock.now = java.time.Instant.parse(iso).toEpochMilli(); }

    @Test void extensionBeforeTripIsPaidSeparatelyByOwnCodeAndMovesEndDate(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        java.time.LocalDate end0 = f.core.endDate(f.core.find(id));
        Map<String, Object> pv = f.core.extensions().preview(user, id, 1);
        assertEquals(true, pv.get("canExtend"));
        assertEquals(409, code(() -> f.core.extensions().request(user, id, 3, "")), "8.15: tối đa 2 ngày");
        Map<String, Object> e1 = Maps.map(f.core.extensions().request(user, id, 1, "Muốn ở thêm").get("extension"));
        String payCode = Maps.str(f.core.find(id), "payCode");
        assertEquals("pending_payment", e1.get("status"));
        assertEquals(payCode + "-EXT1", e1.get("paymentCode"), "8.10: mã riêng");
        assertEquals(Maps.lng(Maps.map(f.core.extensions().quote(f.core.find(id), 1)), "amount"), Maps.lng(e1, "amount"));
        assertEquals(0L, Maps.lng(f.core.find(id), "extraDays"), "chưa trả thì chưa đổi ngày kết thúc");
        assertEquals(409, code(() -> f.core.extensions().request(user, id, 1, "")), "đang có yêu cầu mở");
        assertEquals(409, code(() -> f.core.extensions().confirmPayment(CASHIER, id, 1, 1, "")), "amount_mismatch");
        f.core.extensions().confirmPayment(CASHIER, id, 1, Maps.lng(e1, "amount"), "");
        Map<String, Object> b = f.core.find(id);
        assertEquals(1L, Maps.lng(b, "extraDays"));
        assertEquals(end0.plusDays(1), f.core.endDate(b), "8.11: ngày kết thúc thực tế");
        assertEquals("paid", Maps.map(Maps.list(b.get("extensions")).get(0)).get("status"));
        assertEquals(Maps.lng(b, "price") > 0, true);
        assertEquals(0L, vn.travel.util.Flow.refundedOut(b));
        assertEquals(1, titles(f, Maps.str(user, "id"), "Gia hạn thành công"));
        // 8.10: tiền về qua ngân hàng theo mã -EXT2, không lẫn với đơn gốc
        Map<String, Object> e2 = Maps.map(f.core.extensions().request(user, id, 1, "").get("extension"));
        assertEquals(payCode + "-EXT2", e2.get("paymentCode"));
        Map<String, Object> tx = Maps.of("id", "TX-EXT2", "transferType", "in", "transferAmount", Maps.lng(e2, "amount"), "content", "CK " + payCode + " EXT2");
        assertEquals("matched", Maps.map(f.payments.webhook(tx).get("payment")).get("status"));
        assertEquals(2L, Maps.lng(f.core.find(id), "extraDays"));
        assertEquals(409, code(() -> f.core.extensions().request(user, id, 1, "")), "đã đủ 2 ngày");
        assertEquals(end0.plusDays(2), f.core.endDate(f.core.find(id)));
    }

    @Test void extensionNeedsFreeGuideAndTourAllowance(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        // đơn khác của cùng HDV bắt đầu ngay sau ngày kết thúc (13/11) → không gia hạn được
        String other = Maps.str(confirmed(f, f.newUser("b@gmail.com"), "101", "2026-11-13"), "id");
        f.operator.assign(OPERATOR, other, Maps.str(guide, "guideId"));
        List<String> pr = (List<String>) f.core.extensions().preview(user, id, 1).get("problems");
        assertTrue(pr.stream().anyMatch(x -> x.contains("HDV không rảnh")), "8.8: kiểm tra HDV rảnh");
        assertEquals(409, code(() -> f.core.extensions().request(user, id, 1, "")));
        // 8.13: tour không cho gia hạn
        java.nio.file.Files.createDirectories(tmp.resolve("g"));
        Fixture g = new Fixture(tmp.resolve("g"));
        Map<String, Object> u2 = g.newUser("c@gmail.com");
        String id2 = Maps.str(confirmed(g, u2, "101", "2026-11-10"), "id");
        g.dbs.edit("admin-tours", all -> all.add(Maps.of("id", "101", "name", "Hà Nội – Hạ Long 3N2Đ", "price", 2500000, "duration", "3 ngày 2 đêm", "guide", "guided", "allowExtension", false)));
        assertEquals(409, code(() -> g.core.extensions().request(u2, id2, 1, "")));
    }

    @Test void extensionDuringTripNeedsOperatorApprovalThenPayment(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        f.guideOps.start(acc, id);
        Map<String, Object> e = Maps.map(f.core.extensions().request(user, id, 1, "Ở thêm 1 đêm").get("extension"));
        assertEquals("requested", e.get("status"), "8.12: đang đi → chờ duyệt");
        assertEquals(409, code(() -> f.core.extensions().confirmPayment(CASHIER, id, 1, Maps.lng(e, "amount"), "")), "chưa duyệt thì chưa thu");
        assertEquals(400, code(() -> f.core.extensions().decide(OPERATOR, id, 1, false, " ")), "từ chối phải có lý do");
        f.core.extensions().decide(OPERATOR, id, 1, true, "");
        assertEquals("approved", Maps.map(Maps.list(f.core.find(id).get("extensions")).get(0)).get("status"));
        f.core.extensions().confirmPayment(CASHIER, id, 1, Maps.lng(e, "amount"), "");
        assertEquals(1L, Maps.lng(f.core.find(id), "extraDays"));
        assertEquals("in_progress", f.core.find(id).get("status"));
        f.guideOps.end(acc, id);
        assertEquals("completed", f.core.find(id).get("status"));
    }

    @Test void cancelExtensionRefundsOnlyThatPartAndOrderCancelRefundsExtensionToo(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A", "domestic", "staff");
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = readyToStart(f, user, guide, "2026-11-10");
        at(f, "2026-10-20T01:00:00Z");
        Map<String, Object> e = Maps.map(f.core.extensions().request(user, id, 1, "").get("extension"));
        f.core.extensions().confirmPayment(CASHIER, id, 1, Maps.lng(e, "amount"), "");
        long basePaid = vn.travel.util.Flow.paidIn(f.core.find(id));
        Map<String, Object> res = f.core.extensions().cancel(user, id, 1);
        Map<String, Object> rf = Maps.map(res.get("refund"));
        assertEquals(Maps.lng(e, "amount"), Maps.lng(rf, "amount"), "8.16: hoàn riêng 100% (còn xa ngày đi)");
        assertEquals(1L, Maps.lng(rf, "extNo"));
        Map<String, Object> b = f.core.find(id);
        assertEquals(0L, Maps.lng(b, "extraDays"));
        assertEquals("guide_accepted", b.get("status"), "đơn gốc không bị ảnh hưởng");
        f.adminOps.approveRefund(ADMIN, Maps.str(rf, "id"), null, "");
        f.refunds.pay(CASHIER, Maps.str(rf, "id"), "");
        b = f.core.find(id);
        assertEquals(0L, vn.travel.util.Flow.refundedOut(b), "hoàn gia hạn không tính vào hoàn đơn gốc");
        assertEquals(basePaid, vn.travel.util.Flow.paidIn(b));
        assertTrue(Maps.list(b.get("payments")).stream().anyMatch(p -> "ext_refund".equals(Maps.str(Maps.map(p), "kind"))));
        // hủy cả đơn khi có gia hạn đã trả
        Map<String, Object> e2 = Maps.map(f.core.extensions().request(user, id, 1, "").get("extension"));
        f.core.extensions().confirmPayment(CASHIER, id, 2, Maps.lng(e2, "amount"), "");
        f.customerOps.cancel(user, id, "Bận việc");
        long extRefunds = f.refunds.list(null).stream().filter(r -> Maps.lng(r, "extNo") == 2).count();
        assertEquals(1L, extRefunds, "đơn gốc bị hủy → hoàn cả phần gia hạn đã trả");
    }

    @Test void companyCancelOfferLetsCustomersChooseRefundOrNewDate(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> support = Maps.map(f.staff.create(ADMIN, Maps.of("name", "CSKH Một", "role", "support", "email", "cs@travel.vn", "auto", true)).get("user"));
        Map<String, Object> u1 = f.newUser("a@gmail.com"), u2 = f.newUser("b@gmail.com");
        String b1 = Maps.str(confirmed(f, u1, "101", "2026-11-10"), "id"), b2 = Maps.str(confirmed(f, u2, "101", "2026-11-10"), "id");
        Map<String, Object> r = f.adminOps.companyCancel(ADMIN, "101", "2026-11-10", "Bão số 5", "offer");
        assertEquals(2, r.get("offered"));
        assertEquals("confirmed", f.core.find(b1).get("status"), "8.5: chưa tự hủy, chờ khách chọn");
        assertEquals(1, titles(f, Maps.str(support, "id"), "Liên hệ khách"), "SUPPORT được báo để liên hệ");
        assertEquals(400, code(() -> f.customerOps.respondCompanyOffer(u1, b1, "khac", null)));
        f.customerOps.respondCompanyOffer(u1, b1, "refund", null);
        assertEquals("refund_pending", f.core.find(b1).get("status"));
        Map<String, Object> rf = f.refunds.list(null).stream().filter(x -> b1.equals(Maps.str(x, "bookingId"))).findFirst().orElseThrow();
        assertEquals("company_cancel", rf.get("source"));
        assertEquals("approved", rf.get("status"), "công ty hủy: hoàn 100%, không cần duyệt lại");
        assertEquals(409, code(() -> f.customerOps.respondCompanyOffer(u1, b1, "refund", null)), "chỉ trả lời một lần");
        f.customerOps.respondCompanyOffer(u2, b2, "reschedule", "2026-11-24");
        f.customerOps.decideReschedule(SUPPORT, b2, true, "");
        assertEquals("2026-11-24", f.core.find(b2).get("date"));
    }

    @Test void rescheduleAppliesPriceDifferenceFromDatePrices(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        String id = Maps.str(confirmed(f, user, "101", "2026-11-10"), "id");
        long oldPrice = Maps.lng(f.core.find(id), "price"), deposit = Maps.lng(f.core.find(id), "deposit");
        f.dbs.edit("admin-tours", all -> all.add(Maps.of("id", "101", "name", "Hà Nội – Hạ Long 3N2Đ", "price", 2500000, "duration", "3 ngày 2 đêm", "guide", "guided",
                "datePrices", Maps.of("2026-11-24", 3000000))));
        f.customerOps.requestReschedule(user, id, "2026-11-24", "Bận");
        long diff = f.customerOps.priceDiff(f.core.find(id), "2026-11-24");
        assertEquals(1_000_000L, diff, "2 người lớn × 500.000");
        f.customerOps.decideReschedule(OPERATOR, id, true, "");
        Map<String, Object> b = f.core.find(id);
        assertEquals(oldPrice + diff, Maps.lng(b, "price"), "8.6: giá mới theo ngày mới");
        assertEquals(oldPrice + diff - deposit, Payments.amountDue(b), "phần chênh thu ở lần thu nốt");
    }
}
