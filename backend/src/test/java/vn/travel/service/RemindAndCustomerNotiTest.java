package vn.travel.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SuppressWarnings("unchecked")
class RemindAndCustomerNotiTest {
    static final Actor ADMIN = new Actor("ad001", "Quản trị viên", "ADMIN");
    static final Actor CONTENT = new Actor("nd001", "Biên tập viên", "CONTENT");
    static final Actor OPERATOR = new Actor("dh001", "Điều hành tour", "OPERATOR");

    private static Map<String, Object> newStaff(Fixture f, String id, String name, String role, long balance) {
        Map<String, Object> a = Maps.of("id", id, "name", name, "email", id + "@travel.vn", "role", role, "balance", balance, "totalEarned", balance, "strikes", 0, "createdAt", "2026-01-01T00:00:00Z");
        f.dbs.edit("accounts", all -> all.add(a));
        return a;
    }

    private static Map<String, Object> newCustomer(Fixture f, String id, String name, String email) {
        Map<String, Object> a = Maps.of("id", id, "name", name, "email", email, "role", "user", "provider", "local", "createdAt", "2026-01-01T00:00:00Z");
        f.dbs.edit("accounts", all -> all.add(a));
        return a;
    }

    @Test
    @DisplayName("Admin gửi thông báo nhắc nhở: ghi 1 lỗi và trừ đúng 200.000 ₫ tiền lương")
    void adminRemindRecordsStrikeAndDeducts200k(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        WalletOps wallet = new WalletOps(f.dbs, f.core);
        newStaff(f, "st_op_99", "Điều Hành A", "operator", 15_000_000L);

        // Ban đầu strikes = 0, balance = 15.000.000 ₫
        Map<String, Object> before = f.accounts.byId("st_op_99");
        assertEquals(0, ((Number) before.getOrDefault("strikes", 0)).intValue());
        assertEquals(15_000_000L, Maps.lng(before, "balance"));

        // Admin gửi thông báo nhắc nhở vi phạm
        Map<String, Object> res = wallet.remindStaff(ADMIN, "st_op_99", "Đi làm muộn", "Đến văn phòng muộn 30 phút mà không báo trước");
        assertTrue(Maps.bool(res, "ok"));
        assertEquals(1, ((Number) res.get("strikes")).intValue());
        assertEquals(200_000L, Maps.lng(res, "fineAmount"));

        // Kiểm tra tài khoản đã bị ghi 1 lỗi và trừ 200.000 ₫
        Map<String, Object> after = f.accounts.byId("st_op_99");
        assertEquals(1, ((Number) after.getOrDefault("strikes", 0)).intValue());
        assertEquals(14_800_000L, Maps.lng(after, "balance"));

        // Kiểm tra thông báo được gửi vào chuông của nhân viên
        List<Map<String, Object>> notis = (List<Map<String, Object>>) f.noti.list("st_op_99").get("notifications");
        assertFalse(notis.isEmpty());
        assertTrue(notis.stream().anyMatch(n -> Maps.str(n, "title").contains("Nhắc nhở vi phạm")));
        assertTrue(notis.stream().anyMatch(n -> Maps.str(n, "body").contains("200") && Maps.str(n, "body").contains("tiền lương")));

        // Kiểm tra lịch sử lương có ghi nhận phạt 200k
        List<Map<String, Object>> logs = (List<Map<String, Object>>) wallet.listStaffSalaries().get("logs");
        assertFalse(logs.isEmpty());
        assertEquals("fine", logs.get(0).get("type"));
        assertEquals(200_000L, Maps.lng(logs.get(0), "amount"));

        // Lần nhắc nhở thứ 2 -> strikes = 2, balance = 14.600.000 ₫
        wallet.remindStaff(ADMIN, "st_op_99", "Quên xác nhận đơn", "Chưa cập nhật HDV cho chuyến đi");
        Map<String, Object> after2 = f.accounts.byId("st_op_99");
        assertEquals(2, ((Number) after2.getOrDefault("strikes", 0)).intValue());
        assertEquals(14_600_000L, Maps.lng(after2, "balance"));
    }

    @Test
    @DisplayName("Admin tự nhắc nhở chính mình bị chặn")
    void adminCannotRemindSelf(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        WalletOps wallet = new WalletOps(f.dbs, f.core);
        newStaff(f, "ad001", "Quản Trị", "admin", 0);

        HttpError err = assertThrows(HttpError.class, () ->
                wallet.remindStaff(ADMIN, "ad001", "Tự phạt", "Không hợp lệ"));
        assertEquals(409, err.status());
    }

    @Test
    @DisplayName("Admin xóa tài khoản khách hàng thành công và thu hồi phiên")
    void adminCanDeleteCustomerAccount(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        CustomerDirectory dir = new CustomerDirectory(f.dbs, f.accounts, f.core);
        newCustomer(f, "kh_test_01", "Khách Hàng A", "khachA@gmail.com");

        assertNotNull(f.accounts.byId("kh_test_01"));
        assertTrue(Accounts.isActive(f.accounts.byId("kh_test_01")));

        // Admin xóa tài khoản khách hàng
        Map<String, Object> res = dir.deleteCustomer(ADMIN, "kh_test_01");
        assertTrue(Maps.bool(res, "ok"));

        // Tài khoản đã bị xóa mềm (deletedAt != null) và không còn active
        Map<String, Object> cust = f.accounts.byId("kh_test_01");
        assertNotNull(cust.get("deletedAt"));
        assertEquals("locked", cust.get("status"));
        assertFalse(Accounts.isActive(cust));
    }

    @Test
    @DisplayName("Admin xóa nhân viên thành công nhưng chặn tự xóa chính mình")
    void adminCanDeleteStaffButNotSelf(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        newStaff(f, "ad_test_02", "Quản Trị 2", "admin", 0);
        newStaff(f, "st_test_03", "Điều Hành B", "operator", 15_000_000L);

        // Tự xóa chính mình -> 409 Conflict
        HttpError errSelf = assertThrows(HttpError.class, () -> f.staff.remove(ADMIN, "ad001"));
        assertEquals(409, errSelf.status());

        // Xóa nhân viên khác -> thành công
        Map<String, Object> res = f.staff.remove(ADMIN, "st_test_03");
        assertTrue(Maps.bool(res, "ok"));
        Map<String, Object> deleted = f.accounts.byId("st_test_03");
        assertNotNull(deleted.get("deletedAt"));
        assertFalse(Accounts.isActive(deleted));
    }

    @Test
    @DisplayName("Phân quyền thông báo cho khách hàng: chỉ ADMIN và CONTENT có quyền")
    void permissionNotificationCustomerSend() {
        assertTrue(RolePermissions.hasPermission(Role.ADMIN, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertTrue(RolePermissions.hasPermission(Role.CONTENT, Permission.NOTIFICATION_CUSTOMER_SEND));

        assertFalse(RolePermissions.hasPermission(Role.OPERATOR, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CASHIER, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.SUPPORT, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.GUIDE, Permission.NOTIFICATION_CUSTOMER_SEND));
        assertFalse(RolePermissions.hasPermission(Role.CUSTOMER, Permission.NOTIFICATION_CUSTOMER_SEND));
    }
}
