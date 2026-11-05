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

/** Màn hình Khách hàng dùng chung: tra cứu (email / SĐT / mã đơn), hồ sơ khách, khóa – mở khóa (chỉ Admin), phân quyền xem thanh toán. */
@SuppressWarnings("unchecked")
class CustomerDirectoryTest {
    static final Actor ADMIN = new Actor("ad001", "Quản trị", "ADMIN");
    static final Actor CASHIER = new Actor("tn001", "Thu ngân", "CASHIER");
    static final Actor SUPPORT = new Actor("cs001", "CSKH", "SUPPORT");

    private static int code(Runnable r) { return assertThrows(HttpError.class, r::run).status(); }

    private static Map<String, Object> req() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", "101"); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("email", "");
        m.put("date", "2026-11-10"); m.put("adults", 2); m.put("kids", 0); m.put("infants", 0);
        return m;
    }

    private static void setPhone(Fixture f, String id, String phone) {
        f.dbs.edit("accounts", all -> all.forEach(a -> { if (id.equals(Maps.str(a, "id"))) a.put("phone", phone); }));
    }

    private static List<String> ids(Map<String, Object> result) {
        List<String> out = new ArrayList<>();
        for (Object o : (List<?>) result.get("customers")) out.add(Maps.str((Map<String, Object>) o, "id"));
        return out;
    }

    @Test void searchByEmailPhoneOrderCodeAndName(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        CustomerDirectory dir = new CustomerDirectory(f.dbs, f.accounts, f.core);
        Map<String, Object> a = f.newUser("an@gmail.com"), b = f.newUser("binh@gmail.com");
        String ida = Maps.str(a, "id"), idb = Maps.str(b, "id");
        setPhone(f, ida, "0912 345 678");
        setPhone(f, idb, "+84 987 654 321");
        Map<String, Object> order = f.bookings.create(a, req());
        String payCode = Maps.str(order, "payCode");
        assertFalse(payCode.isEmpty());

        assertEquals(2, ((Number) dir.search("", "", 0).get("total")).intValue(), "không từ khóa → liệt kê khách");
        assertEquals(List.of(ida), ids(dir.search("an@gmail.com", "", 0)), "theo email");
        assertEquals(List.of(ida), ids(dir.search("0912345678", "", 0)), "theo SĐT gõ liền");
        assertEquals(List.of(idb), ids(dir.search("0987654321", "", 0)), "SĐT lưu dạng +84 vẫn khớp số bắt đầu bằng 0");
        assertEquals(List.of(ida), ids(dir.search(payCode, "", 0)), "theo mã đơn");
        assertEquals(List.of(ida), ids(dir.search(payCode.toLowerCase(), "", 0)), "mã đơn không phân biệt hoa thường");
        assertTrue(ids(dir.search("binh", "", 0)).contains(idb), "theo tên/email một phần");
        assertTrue(ids(dir.search("khong-co-ai-ten-nay", "", 0)).isEmpty());
    }

    @Test void staffAccountsAreNeverListedAsCustomers(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        CustomerDirectory dir = new CustomerDirectory(f.dbs, f.accounts, f.core);
        Map<String, Object> user = f.newUser("an@gmail.com");
        Map<String, Object> st = f.staff.create(ADMIN, Maps.of("name", "Cô CSKH", "role", "support", "email", "cs@travel.vn", "auto", true));
        String staffId = Maps.str(Maps.map(st.get("user")), "id");
        Map<String, Object> all = dir.search("", "", 0);
        assertEquals(List.of(Maps.str(user, "id")), ids(all));
        assertEquals(404, code(() -> dir.detail(staffId, false)), "không mở hồ sơ nhân viên qua màn hình khách");
        assertEquals(404, code(() -> dir.setLocked(ADMIN, staffId, true, "thử khóa")), "không khóa nhân viên qua màn hình khách");
        assertEquals(404, code(() -> dir.detail("khong-ton-tai", false)));
    }

    @Test void detailShowsOrdersComplaintsAndPaymentsOnlyWhenAllowed(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        CustomerDirectory dir = new CustomerDirectory(f.dbs, f.accounts, f.core);
        Map<String, Object> user = f.newUser("an@gmail.com"), other = f.newUser("binh@gmail.com");
        String uid = Maps.str(user, "id");
        Map<String, Object> b = f.bookings.create(user, req());
        String bid = Maps.str(b, "id");
        long deposit = Maps.lng(b, "deposit");
        f.cashier.confirm(CASHIER, bid, "deposit", deposit, "");
        f.adminOps.confirm(ADMIN, bid, "");
        f.support.createComplaint(user, bid, "Xe đón trễ", "Xe đón trễ 30 phút so với lịch hẹn");
        f.dbs.edit("waitlist", all -> all.add(Maps.of("id", "wl1", "userId", uid, "tourName", "Tour X", "date", "2026-12-01", "pax", 2, "status", "waiting", "createdAt", "2026-11-01T03:00:00Z")));

        Map<String, Object> d = dir.detail(uid, true);
        Map<String, Object> sum = Maps.map(d.get("summary"));
        assertEquals(1L, ((Number) sum.get("bookingCount")).longValue());
        assertEquals(deposit, ((Number) sum.get("totalPaid")).longValue());
        assertEquals(1L, ((Number) sum.get("openComplaints")).longValue());
        assertEquals(1, ((List<?>) d.get("bookings")).size());
        assertEquals(1, ((List<?>) d.get("complaints")).size());
        assertEquals(1, ((List<?>) d.get("waitlist")).size());
        assertEquals(1, ((List<?>) d.get("payments")).size(), "Admin thấy sổ thanh toán");

        Map<String, Object> forSupport = dir.detail(uid, false);
        assertFalse(forSupport.containsKey("payments"), "CSKH không nhận sổ thanh toán");
        assertFalse(forSupport.toString().contains("passHash"), "không lộ mật khẩu");

        assertEquals(0, ((List<?>) dir.detail(Maps.str(other, "id"), true).get("bookings")).size(), "đơn của khách khác không lẫn sang");
        Map<String, Object> list = dir.search("", "", 0);
        Map<String, Object> row = ((List<Map<String, Object>>) list.get("customers")).stream().filter(x -> uid.equals(x.get("id"))).findFirst().orElseThrow();
        assertEquals(1, ((Number) row.get("openComplaints")).intValue());
        assertEquals(1, ((Number) row.get("bookingCount")).intValue());
    }

    @Test void lockNeedsReasonBlocksLoginAndUnlockRestores(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        CustomerDirectory dir = new CustomerDirectory(f.dbs, f.accounts, f.core);
        Map<String, Object> user = f.newUser("an@gmail.com");
        String uid = Maps.str(user, "id");

        assertEquals(400, code(() -> dir.setLocked(ADMIN, uid, true, "")), "khóa phải có lý do");
        assertEquals(409, code(() -> dir.setLocked(ADMIN, uid, false, "")), "đang hoạt động thì không có gì để mở khóa");

        Map<String, Object> locked = dir.setLocked(ADMIN, uid, true, "Nghi ngờ gian lận thanh toán");
        assertEquals(true, locked.get("locked"));
        assertEquals("Nghi ngờ gian lận thanh toán", locked.get("lockReason"));
        assertEquals(409, code(() -> dir.setLocked(ADMIN, uid, true, "khóa lần hai")));
        assertEquals(403, code(() -> f.accounts.login("an@gmail.com", "Matkhau@123")), "khách bị khóa không đăng nhập được");
        assertEquals(1, ((List<?>) dir.search("", "locked", 0).get("customers")).size());
        assertEquals(0, ((List<?>) dir.search("", "active", 0).get("customers")).size());
        assertEquals(1, f.audit.list("", "customer.lock", 10).size(), "khóa được ghi nhật ký");

        Map<String, Object> open = dir.setLocked(ADMIN, uid, false, "");
        assertEquals(false, open.get("locked"));
        assertNull(f.accounts.byId(uid).get("lockReason"), "mở khóa xóa lý do cũ");
        assertNotNull(f.accounts.login("an@gmail.com", "Matkhau@123"), "mở khóa → đăng nhập lại được");
        assertEquals(1, f.audit.list("", "customer.unlock", 10).size());
    }

    @Test void permissionsSupportViewsAdminAlsoLocks() {
        assertTrue(RolePermissions.hasPermission(Role.SUPPORT, Permission.CUSTOMER_VIEW));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.CUSTOMER_LOCK), "CSKH chỉ xem, không khóa");
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.PAYMENT_VIEW), "CSKH không xem sổ thanh toán");
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.CUSTOMER_VIEW));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.CUSTOMER_LOCK));
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.PAYMENT_VIEW));
        for (Role r : List.of(Role.CASHIER, Role.OPERATOR, Role.CONTENT, Role.GUIDE, Role.CUSTOMER)) {
            assertFalse(RolePermissions.hasPermission(r, Permission.CUSTOMER_VIEW), r + " không được xem danh bạ khách");
            assertFalse(RolePermissions.hasPermission(r, Permission.CUSTOMER_LOCK), r + " không được khóa khách");
        }
    }
}
