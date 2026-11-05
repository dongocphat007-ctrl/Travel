package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Trang Thông báo (hội thoại giữa các vai trò + Admin chủ động gửi) và các chức năng HDV mới:
 * thu nhập đã nhận / chờ chi, báo cáo tour gọn, hồ sơ, trạng thái "đến trễ", chi tiết đánh giá.
 */
@SuppressWarnings("unchecked")
class MessagesAndGuideTest {
    static final Actor ADMIN = new Actor("ad001", "Quản trị", "ADMIN");
    static final Actor CASHIER = new Actor("tn001", "Thu ngân", "CASHIER");
    static final Actor OPERATOR = new Actor("dh001", "Điều hành", "OPERATOR");

    private static int code(Runnable r) { return assertThrows(HttpError.class, r::run).status(); }

    /** Tạo tài khoản mẫu trực tiếp (không cần mật khẩu) cho vai trò bất kỳ. */
    private static Map<String, Object> acct(Fixture f, String id, String name, String role) {
        Map<String, Object> a = Maps.of("id", id, "name", name, "email", id + "@travel.vn", "role", role, "createdAt", "2026-01-01T00:00:00Z");
        f.dbs.edit("accounts", all -> all.add(a));
        return a;
    }

    private static List<String> texts(Map<String, Object> thread) {
        List<String> out = new ArrayList<>();
        for (Object m : Maps.list(thread.get("messages"))) out.add(Maps.str(Maps.map(m), "text"));
        return out;
    }

    private static long unreadNoti(Fixture f, String uid) { return Maps.lng(f.noti.list(uid), "unread"); }

    // ───────────────────────── thông báo Admin → vai trò ─────────────────────────
    @Test void adminAnnouncementReachesRoleAndRepliesStayPrivateToAdmin(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> admin = acct(f, "ad001", "Quản Trị", "admin"), g1 = acct(f, "hdv001", "HDV Một", "guide"), g2 = acct(f, "hdv002", "HDV Hai", "guide"), op = acct(f, "dh001", "Điều Hành", "operator");

        Map<String, Object> t = f.messages.create(admin, "announcement", "Nhắc nộp báo cáo", "Mọi người nộp báo cáo trước thứ Sáu.", List.of("guide"), List.of(), "");
        String id = Maps.str(t, "id");
        assertEquals("announcement", t.get("kind"));
        for (String uid : List.of("hdv001", "hdv002")) {
            Map<String, Object> n = Maps.map(Maps.list(f.noti.list(uid).get("notifications")).get(0));
            assertTrue(Maps.str(n, "title").startsWith("📢"), "hiện ở chuông của người nhận");
            assertEquals("guide.html#notifications/" + id, n.get("link"));
        }
        assertEquals(0, Maps.list(f.noti.list("dh001").get("notifications")).size(), "Điều hành không nhận (không thuộc đối tượng)");
        assertEquals(1, unreadNoti(f, "hdv001"));

        // mở hội thoại → tắt chấm chưa đọc trên chuông
        Map<String, Object> opened = f.messages.open(g1, id);
        assertEquals(1, Maps.list(opened.get("messages")).size());
        assertEquals(0, unreadNoti(f, "hdv001"));
        assertEquals(1, unreadNoti(f, "hdv002"));

        // người nhận phản hồi: chỉ Admin + chính họ thấy
        f.messages.reply(g1, id, "Em đã nhận, sẽ nộp đúng hạn.", "");
        assertEquals(1, unreadNoti(f, "ad001"), "Admin được báo có phản hồi");
        assertEquals(2, texts(f.messages.open(admin, id)).size());
        assertEquals(1, texts(f.messages.open(g2, id)).size(), "HDV khác không thấy phản hồi của HDV một");
        assertEquals(2, texts(f.messages.open(g1, id)).size());

        // Admin trả lời riêng cho g1: g2 không thấy; trả lời chung: ai cũng thấy
        f.messages.reply(admin, id, "Cảm ơn bạn.", "hdv001");
        assertEquals(3, texts(f.messages.open(g1, id)).size());
        assertEquals(1, texts(f.messages.open(g2, id)).size());
        f.messages.reply(admin, id, "Nhắc lại: hạn là thứ Sáu.", "");
        assertEquals(2, texts(f.messages.open(g2, id)).size());
        assertEquals(400, code(() -> f.messages.reply(admin, id, "x", "dh001")), "chỉ trả lời riêng cho người thuộc thông báo");

        // người nhận không biết ai khác cũng nhận
        assertEquals(1, Maps.list(f.messages.open(g2, id).get("others")).size(), "chỉ biết người gửi (Admin)");
        assertTrue(Maps.list(f.messages.open(admin, id).get("replyTargets")).size() >= 2, "Admin chọn được từng người nhận để trả lời riêng");
        assertEquals(0, Maps.list(f.messages.open(g1, id).get("replyTargets")).size());
        assertEquals(0, Maps.list(f.messages.list(op).get("threads")).size(), "Điều hành không có hội thoại nào");
    }

    @Test void onlyAdminAnnouncesAndCustomersAreExcluded(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> op = acct(f, "dh001", "Điều Hành", "operator"), g1 = acct(f, "hdv001", "HDV Một", "guide"), cust = acct(f, "kh001", "Khách", "user");
        // Mọi vai trò nội bộ đều có thể gửi thông báo
        assertNotNull(f.messages.create(op, "announcement", "Thông báo", "Nội dung", List.of("guide"), List.of(), ""));
        assertEquals(403, code(() -> f.messages.create(cust, "chat", "Hỏi", "Nội dung", List.of("guide"), List.of(), "")), "khách không dùng hội thoại nội bộ");
        assertEquals(403, code(() -> f.messages.list(cust)));
        assertEquals(400, code(() -> f.messages.create(op, "chat", "Hỏi", "Nội dung", List.of(), List.of("kh001"), "")), "không nhắn cho khách");
        assertEquals(400, code(() -> f.messages.create(op, "chat", "Hỏi", "Nội dung", List.of("user"), List.of(), "")), "vai trò khách không hợp lệ");
        assertEquals(400, code(() -> f.messages.create(op, "chat", "", "Nội dung", List.of("guide"), List.of(), "")));
        assertEquals(400, code(() -> f.messages.create(op, "chat", "Hỏi", " ", List.of("guide"), List.of(), "")));
        assertEquals(400, code(() -> f.messages.create(op, "chat", "Hỏi", "Nội dung", List.of("operator"), List.of(), "")), "không có người nhận nào ngoài chính mình");
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFY_SEND));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFY_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.NOTIFY_SEND));
        // Chỉ ADMIN có quyền thông báo nhắc nhở
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFICATION_REMINDER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFICATION_REMINDER_SEND));
    }

    // ───────────────────────── chat giữa các vai trò ─────────────────────────
    @Test void roleChatAboutATourIsSharedAndOneBellItemPerThread(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> admin = acct(f, "ad001", "Quản Trị", "admin"), op = acct(f, "dh001", "Điều Hành", "operator"),
                cs1 = acct(f, "cs001", "CSKH Một", "support"), cs2 = acct(f, "cs002", "CSKH Hai", "support");
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(user, Maps.of("tourId", "101", "customerName", "Nguyễn Văn A", "phone", "0901234567", "email", "", "date", "2026-11-10", "adults", 2, "kids", 0, "infants", 0));
        String payCode = Maps.str(b, "payCode");

        Map<String, Object> t = f.messages.create(op, "chat", "Khách đổi lịch", "Khách xin đổi ngày, CSKH giúp mình.", List.of("support"), List.of(), payCode.toLowerCase());
        String id = Maps.str(t, "id");
        assertEquals(payCode, Maps.map(t.get("ref")).get("payCode"), "gắn mã đơn (không phân biệt hoa thường)");
        assertEquals("Hà Nội – Hạ Long 3N2Đ", Maps.map(t.get("ref")).get("tourName"));
        assertEquals(1, unreadNoti(f, "cs001"));
        assertEquals(1, unreadNoti(f, "cs002"));

        // trả lời nhiều lần: trên chuông chỉ còn MỘT thông báo cho hội thoại
        f.messages.reply(cs1, id, "Mình nhận nhé.", "");
        f.messages.reply(cs1, id, "Đã liên hệ khách.", "");
        List<Object> bell = Maps.list(f.noti.list("dh001").get("notifications"));
        assertEquals(1, bell.size());
        assertTrue(Maps.str(Maps.map(bell.get(0)), "body").contains("Đã liên hệ khách."), "thông báo là tin mới nhất");
        assertEquals(1, unreadNoti(f, "dh001"));

        // cs2 (cùng vai trò) thấy toàn bộ tin; cs1 thấy cả của mình
        assertEquals(3, texts(f.messages.open(cs2, id)).size());
        Map<String, Object> list = f.messages.list(op);
        assertEquals(1, Maps.lng(list, "unread"));
        Map<String, Object> s = Maps.map(Maps.list(list.get("threads")).get(0));
        assertEquals(2, Maps.lng(s, "unread"));
        f.messages.open(op, id);
        assertEquals(0, Maps.lng(f.messages.list(op), "unread"));
        assertEquals(0, unreadNoti(f, "dh001"));

        // Admin không tham gia thì không thấy; không phải người tham gia → 404
        assertEquals(404, code(() -> f.messages.open(admin, id)));
        assertEquals(404, code(() -> f.messages.reply(admin, id, "chen ngang", "")));
        assertEquals(0, Maps.list(f.messages.list(admin).get("threads")).size());
    }

    @Test void guideCanOnlyAttachOwnTourToAChat(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> admin = acct(f, "ad001", "Quản Trị", "admin");
        Map<String, Object> guide = f.staff.create(ADMIN, Maps.of("name", "Hướng Dẫn A", "role", "guide", "email", "hdva@travel.vn", "auto", true,
                "guide", Maps.of("guideType", "domestic", "employmentType", "staff", "regions", List.of())));
        Map<String, Object> acc = f.accounts.byId(Maps.str(Maps.map(guide.get("user")), "id"));
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(user, Maps.of("tourId", "101", "customerName", "Nguyễn Văn A", "phone", "0901234567", "email", "", "date", "2026-11-10", "adults", 2, "kids", 0, "infants", 0));
        assertEquals(400, code(() -> f.messages.create(acc, "chat", "Hỏi về tour", "Cho em hỏi", List.of("admin"), List.of(), Maps.str(b, "payCode"))), "đơn chưa giao cho HDV này");
        assertEquals(400, code(() -> f.messages.create(acc, "chat", "Hỏi về tour", "Cho em hỏi", List.of("admin"), List.of(), "KHONGCO")));
        Map<String, Object> t = f.messages.create(acc, "chat", "Hỏi", "Cho em hỏi", List.of("admin"), List.of(), "");
        assertNull(t.get("ref"));
        assertEquals(1, Maps.list(f.messages.list(admin).get("threads")).size(), "HDV phản hồi/hỏi Admin");
    }

    // ───────────────────────── HDV ─────────────────────────
    private Map<String, Object> newGuide(Fixture f, String name) {
        Map<String, Object> r = f.staff.create(ADMIN, Maps.of("name", name, "role", "guide", "email", name.toLowerCase().replace(" ", "") + "@travel.vn", "auto", true,
                "guide", Maps.of("guideType", "domestic", "employmentType", "staff", "regions", List.of())));
        return Maps.map(r.get("user"));
    }

    private static List<Map<String, Object>> pax(int n) {
        List<Map<String, Object>> l = new ArrayList<>();
        for (int i = 0; i < n; i++) l.add(Maps.of("name", "Khách " + (i + 1), "dob", "1990-01-01", "gender", "male", "idNumber", "00109900000" + i));
        return l;
    }

    private String readyToStart(Fixture f, Map<String, Object> user, Map<String, Object> guide, String date) {
        Map<String, Object> b = f.bookings.create(user, Maps.of("tourId", "101", "customerName", "Nguyễn Văn A", "phone", "0901234567", "email", "", "date", date, "adults", 2, "kids", 0, "infants", 0));
        String id = Maps.str(b, "id");
        f.cashier.confirm(CASHIER, id, "deposit", Maps.lng(b, "deposit"), "");
        f.adminOps.confirm(ADMIN, id, "");
        f.dbs.edit("bookings", all -> all.forEach(x -> { if (id.equals(Maps.str(x, "id"))) x.put("passengers", pax(3)); }));
        f.operator.assign(OPERATOR, id, Maps.str(guide, "guideId"));
        f.guideOps.accept(f.accounts.byId(Maps.str(guide, "id")), id);
        f.clock.now = java.time.Instant.parse(date + "T01:00:00Z").toEpochMilli();
        return id;
    }

    @Test void lateGuestsCountAsPresentAndFeedTheTourReport(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        acct(f, "dh001", "Điều Hành", "operator");
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A"), user = f.newUser("a@gmail.com");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        String id = readyToStart(f, user, guide, "2026-11-10");
        f.guideOps.start(acc, id);
        assertEquals(400, code(() -> f.guideOps.checkin(acc, id, List.of(Maps.of("index", 0, "state", "maybe")))));
        f.guideOps.checkin(acc, id, List.of(Maps.of("index", 0, "state", "present"), Maps.of("index", 1, "state", "late"), Maps.of("index", 2, "state", "absent")));
        Map<String, Object> b = f.core.find(id);
        assertEquals(false, b.get("noShow"), "có người đến (kể cả trễ) thì không phải no_show");
        assertEquals(1L, Maps.lng(b, "noShowCount"));
        assertEquals(1L, Maps.lng(b, "lateCount"));
        assertEquals("late", Maps.str(Maps.map(Maps.list(b.get("passengers")).get(1)), "checkin"));

        // đơn mọi người đều "đến trễ" vẫn không bị coi là vắng
        Map<String, Object> user2 = f.newUser("b@gmail.com");
        String id2 = readyToStart(f, user2, guide, "2026-11-20");
        f.guideOps.start(acc, id2);
        f.guideOps.checkin(acc, id2, List.of(Maps.of("index", 0, "state", "late"), Maps.of("index", 1, "state", "late"), Maps.of("index", 2, "state", "late")));
        assertEquals(false, f.core.find(id2).get("noShow"));

        // báo cáo: chỉ nộp sau khi kết thúc tour
        f.clock.now = java.time.Instant.parse("2026-11-10T01:00:00Z").toEpochMilli();
        Map<String, Object> rp = Maps.map(f.guideOps.report(acc, id).get("report"));
        assertEquals(false, rp.get("canSubmit"));
        assertEquals(409, code(() -> f.guideOps.submitReport(acc, id, "Ghi chú")));
        f.guideOps.reportIncident(acc, id, "delay", "low", "Kẹt xe 20 phút trên cao tốc");
        f.guideOps.end(acc, id);

        rp = Maps.map(f.guideOps.report(acc, id).get("report"));
        assertEquals(3L, Maps.lng(rp, "total"));
        assertEquals(2L, Maps.lng(rp, "present"), "có mặt gồm cả đến trễ");
        assertEquals(1L, Maps.lng(rp, "late"));
        assertEquals(1L, Maps.lng(rp, "absent"));
        assertEquals(1, Maps.list(rp.get("incidents")).size(), "sự cố lấy từ dữ liệu có sẵn");
        assertEquals(true, rp.get("canSubmit"));
        assertEquals(400, code(() -> f.guideOps.submitReport(acc, id, "x".repeat(2001))));

        Map<String, Object> saved = Maps.map(f.guideOps.submitReport(acc, id, "Chi phí phát sinh: 150.000 ₫ vé gửi xe.").get("report"));
        assertEquals("Chi phí phát sinh: 150.000 ₫ vé gửi xe.", saved.get("note"));
        assertNotNull(saved.get("submittedAt"));
        long told = Maps.list(f.noti.list("dh001").get("notifications")).stream().filter(n -> Maps.str(Maps.map(n), "title").contains("nộp báo cáo")).count();
        assertEquals(1, told, "báo Điều hành khi nộp lần đầu");
        f.guideOps.submitReport(acc, id, "Cập nhật ghi chú.");
        assertEquals("Cập nhật ghi chú.", Maps.str(Maps.map(f.guideOps.report(acc, id).get("report")), "note"));
        assertEquals(true, Maps.map(Maps.list(f.guideOps.myTours(acc).get("done")).get(0)).get("hasReport"));
        assertNotNull(f.core.view(f.core.find(id), Role.OPERATOR).get("tourReport"), "Điều hành xem được báo cáo");
        assertNull(f.core.view(f.core.find(id), Role.CASHIER).get("tourReport"));

        // HDV khác không đọc/nộp báo cáo tour người khác
        Map<String, Object> other = f.accounts.byId(Maps.str(newGuide(f, "Hướng Dẫn B"), "id"));
        assertEquals(404, code(() -> f.guideOps.report(other, id)));
        assertEquals(404, code(() -> f.guideOps.submitReport(other, id, "giả mạo")));
        assertTrue(RolePermissions.hasPermission(Role.GUIDE, Permission.TRIP_REPORT));
        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.TRIP_REPORT));
    }

    @Test void guideEarningsSplitPaidAndPendingAndCashierPaysOnce(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A"), user = f.newUser("a@gmail.com");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        String gid = Maps.str(guide, "guideId");
        String id1 = readyToStart(f, user, guide, "2026-11-10");
        f.guideOps.start(acc, id1);
        f.guideOps.end(acc, id1);
        String id2 = readyToStart(f, f.newUser("b@gmail.com"), guide, "2026-11-20");
        f.guideOps.start(acc, id2);
        f.guideOps.end(acc, id2);

        Map<String, Object> e = f.guideOps.earnings(acc, "");
        assertEquals(2L, Maps.lng(e, "toursLed"));
        assertEquals(2_000_000L, Maps.lng(e, "total"));
        assertEquals(0L, Maps.lng(e, "paidTotal"));
        assertEquals(2_000_000L, Maps.lng(e, "pendingTotal"));
        assertEquals(6, Maps.list(e.get("monthly")).size());
        assertEquals(2_000_000L, Maps.lng(Maps.map(Maps.list(e.get("monthly")).get(5)), "pending"), "tháng hiện tại ở cuối biểu đồ");

        // Thu ngân thấy khoản chờ chi gom theo HDV
        Map<String, Object> fees = f.cashier.guideFees();
        assertEquals(2_000_000L, Maps.lng(fees, "pendingTotal"));
        Map<String, Object> grp = Maps.map(Maps.list(fees.get("pending")).get(0));
        assertEquals(gid, grp.get("guideId"));
        assertEquals(2, Maps.list(grp.get("items")).size());

        f.cashier.payGuideFees(CASHIER, List.of(id1));
        assertEquals(409, code(() -> f.cashier.payGuideFees(CASHIER, List.of(id1))), "đã chi rồi thì không chi lại");
        assertEquals(400, code(() -> f.cashier.payGuideFees(CASHIER, List.of())));
        assertEquals(404, code(() -> f.cashier.payGuideFees(CASHIER, List.of("khong-co"))));

        e = f.guideOps.earnings(acc, "2026-11");
        assertEquals(1_000_000L, Maps.lng(e, "paidTotal"));
        assertEquals(1_000_000L, Maps.lng(e, "pendingTotal"));
        assertEquals(1_000_000L, Maps.lng(e, "allPaid"));
        assertEquals(1_000_000L, Maps.lng(e, "allPending"));
        Map<String, Object> paidRow = null;
        for (Object o : Maps.list(e.get("items"))) if (id1.equals(Maps.str(Maps.map(o), "id"))) paidRow = Maps.map(o);
        assertEquals(true, paidRow.get("paid"));
        assertNotNull(paidRow.get("paidAt"));
        assertEquals(1, Maps.list(f.cashier.guideFees().get("paid")).size());
        boolean told = false;
        for (Object o : Maps.list(f.noti.list(Maps.str(guide, "id")).get("notifications"))) if (Maps.str(Maps.map(o), "title").contains("nhận thù lao")) told = true;
        assertTrue(told);

        // đơn hoàn thành từ trước khi có tính năng (chưa có guideFee) vẫn tính theo số ngày × thù lao/ngày
        f.dbs.edit("bookings", all -> all.forEach(x -> { if (id2.equals(Maps.str(x, "id"))) x.remove("guideFee"); }));
        assertEquals(2_000_000L, Maps.lng(f.guideOps.earnings(acc, ""), "total"));
        assertTrue(RolePermissions.hasPermission(Role.CASHIER, Permission.GUIDE_FEE_PAY));
        assertFalse(RolePermissions.hasPermission(Role.ADMIN, Permission.GUIDE_FEE_PAY), "tách quyền: Admin không chi tiền");
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.GUIDE_FEE_PAY));
    }

    @Test void guideProfileAndRatingBreakdown(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> guide = newGuide(f, "Hướng Dẫn A");
        Map<String, Object> acc = f.accounts.byId(Maps.str(guide, "id"));
        Map<String, Object> p = Maps.map(f.guideOps.profile(acc).get("profile"));
        assertEquals("Hướng Dẫn A", p.get("name"));
        assertEquals("staff", p.get("employmentType"));
        assertEquals("domestic", p.get("guideType"));
        assertEquals(0, Maps.lng(p, "toursCompleted"));
        assertNull(p.get("busyDates"), "không lộ dữ liệu ngoài hồ sơ");
        assertNull(p.get("passHash"));

        String gid = Maps.str(guide, "guideId");
        f.dbs.edit("reviews", all -> {
            all.add(Maps.of("id", "rv1", "guideId", gid, "guideRating", 5, "guideComment", "Rất nhiệt tình", "name", "Nguyễn Văn An", "tourId", "101", "createdAt", "2026-10-01T00:00:00Z"));
            all.add(Maps.of("id", "rv2", "guideId", gid, "guideRating", 4, "guideComment", "", "name", "Lê Thị B", "tourId", "101", "createdAt", "2026-10-02T00:00:00Z"));
            all.add(Maps.of("id", "rv3", "guideId", gid, "guideRating", 5, "guideComment", "Tốt", "name", "Trần C", "tourId", "101", "createdAt", "2026-10-03T00:00:00Z"));
            all.add(Maps.of("id", "rv4", "guideId", "g_khac", "guideRating", 1, "name", "X", "tourId", "101", "createdAt", "2026-10-04T00:00:00Z"));
        });
        Map<String, Object> st = f.reviews.guideStats(gid);
        assertEquals(3L, Maps.lng(st, "count"));
        assertEquals(4.7, ((Number) st.get("average")).doubleValue(), 0.001);
        Map<String, Object> d = Maps.map(st.get("distribution"));
        assertEquals(2L, Maps.lng(d, "5"));
        assertEquals(1L, Maps.lng(d, "4"));
        assertEquals(0L, Maps.lng(d, "1"));
        List<Object> items = Maps.list(st.get("items"));
        assertEquals(3, items.size());
        assertEquals("Trần C.", Maps.str(Maps.map(items.get(0)), "reviewer"), "mới nhất trước, tên rút gọn");
        assertEquals("Nguyễn A.", Maps.str(Maps.map(items.get(2)), "reviewer"), "không lộ tên đầy đủ của khách");
        assertEquals(3, Maps.list(st.get("recent")).size(), "giữ nguyên trường cũ");
    }

    @Test void operatorActivityShowsOnlyOperatorWorkGroupedAndFiltered(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.audit.log("dh001", "Điều Hành", "OPERATOR", "guide.assign", "TRAVEL1", "giao HDV A");
        f.audit.log("dh001", "Điều Hành", "OPERATOR", "departure.update", "101", "đổi sức chứa");
        f.audit.log("dh001", "Điều Hành", "OPERATOR", "incident.resolved", "TRAVEL1", "đã xử lý");
        f.audit.log("hdv001", "HDV", "GUIDE", "trip.start", "TRAVEL1", "");
        f.audit.log("tn001", "Thu ngân", "CASHIER", "payment.confirm", "TRAVEL2", "300000");
        f.audit.log("ad001", "Admin", "ADMIN", "staff.create", "x", "mật khẩu không liên quan");
        assertEquals(4, f.audit.operatorActivity("", "", 100).size(), "bỏ qua việc của Thu ngân / Admin");
        assertEquals(1, f.audit.operatorActivity("assign", "", 100).size());
        assertEquals("tour", f.audit.operatorActivity("", "sức chứa", 100).get(0).get("group"));
        assertEquals("dispatch", Audit.operatorGroup("trip.start"));
        assertEquals("", Audit.operatorGroup("payment.confirm"));
        assertTrue(RolePermissions.hasPermission(Role.OPERATOR, Permission.ACTIVITY_VIEW_OPERATOR));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.ACTIVITY_VIEW_OPERATOR));
    }
}
