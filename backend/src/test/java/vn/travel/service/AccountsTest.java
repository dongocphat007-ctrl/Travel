package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AccountsTest {
    @Test void registerCreatesAccountWelcomeAndTourVouchers(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> r = f.accounts.register("Nguyễn Văn A", "A@Gmail.com", "matkhau123");
        Map<String, Object> user = Maps.map(r.get("user"));
        assertEquals("a@gmail.com", user.get("email"));
        assertFalse(user.containsKey("passHash"), "không được trả passHash ra ngoài");
        assertEquals("user", user.get("role"));
        assertNotNull(r.get("welcomeVoucher"));
        List<Map<String, Object>> mine = f.vouchers.mine(Maps.str(user, "id"));
        assertEquals(6, mine.size());   // 1 welcome + 5 mã tour hot
        // passHash lưu trên đĩa là PBKDF2, không phải mật khẩu
        String h = Maps.str(f.accounts.byEmail("a@gmail.com"), "passHash");
        assertTrue(h.startsWith("pbkdf2$"));
        assertFalse(h.contains("matkhau123"));
    }

    @Test void duplicateEmailAndValidation(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.newUser("a@gmail.com");
        HttpError dup = assertThrows(HttpError.class, () -> f.accounts.register("Tên Khác", "A@gmail.com", "matkhau123"));
        assertEquals(409, dup.status());
        assertEquals("reg-email", dup.field());
        assertEquals("reg-pass", assertThrows(HttpError.class, () -> f.accounts.register("Tên", "b@gmail.com", "123")).field());
        assertEquals("reg-name", assertThrows(HttpError.class, () -> f.accounts.register("A", "b@gmail.com", "matkhau123")).field());
        assertEquals("reg-email", assertThrows(HttpError.class, () -> f.accounts.register("Tên", "khong-phai-email", "matkhau123")).field());
    }

    @Test void loginRules(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.newUser("a@gmail.com");
        assertEquals("a@gmail.com", f.accounts.login("A@GMAIL.com", "matkhau123").get("email"));
        assertEquals(401, assertThrows(HttpError.class, () -> f.accounts.login("a@gmail.com", "sai-mat-khau")).status());
        HttpError none = assertThrows(HttpError.class, () -> f.accounts.login("khong@gmail.com", "x"));
        assertEquals(404, none.status());   // frontend dựa vào 404 để thử tài khoản cũ ở localStorage
        assertEquals("li-email", none.field());
    }

    @Test void welcomeVoucherExpiresAfter7DaysByServerClock(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        String uid = Maps.str(u, "id");
        String welcome = f.vouchers.mine(uid).stream().filter(v -> "welcome".equals(v.get("source"))).map(v -> Maps.str(v, "code")).findFirst().orElseThrow();
        assertEquals("active", f.vouchers.mine(uid).stream().filter(v -> welcome.equals(v.get("code"))).findFirst().get().get("state"));
        f.clock.plusDays(6);
        assertEquals("active", f.vouchers.mine(uid).stream().filter(v -> welcome.equals(v.get("code"))).findFirst().get().get("state"));
        f.clock.plusDays(2);
        assertEquals("expired", f.vouchers.mine(uid).stream().filter(v -> welcome.equals(v.get("code"))).findFirst().get().get("state"));
        assertEquals(410, assertThrows(HttpError.class, () -> f.vouchers.validate(welcome, "101", uid)).status());
    }

    @Test void migrateIgnoresClientCreatedAtAndGivesNoWelcome(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.accounts.migrate("u_old123", "Khách Cũ", "old@gmail.com", "matkhau123");
        assertEquals("u_old123", u.get("id"));
        assertTrue(f.vouchers.mine("u_old123").stream().noneMatch(v -> "welcome".equals(v.get("source"))));
        assertEquals(409, assertThrows(HttpError.class, () -> f.accounts.migrate("u_x1234", "Khách", "old@gmail.com", "matkhau123")).status());
    }

    @Test void adminSeededOnlyFromEnvironment(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertNull(f.accounts.byEmail("admin@travel.com"), "không có admin mặc định nếu chưa đặt ADMIN_EMAIL/ADMIN_PASSWORD");
        f.accounts.seedAdmin("Boss@Example.com", "mat-khau-manh-1");
        assertTrue(f.accounts.isAdmin(f.accounts.byEmail("boss@example.com")));
        assertEquals("boss@example.com", f.accounts.login("boss@example.com", "mat-khau-manh-1").get("email"));
        assertThrows(IllegalStateException.class, () -> f.accounts.seedAdmin("x@example.com", "short"));
    }

    @Test void profileLocksGenderAndBirthdayAfterVerification(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        String uid = Maps.str(f.newUser("a@gmail.com"), "id");
        assertEquals("vf-confirm", assertThrows(HttpError.class, () -> f.accounts.profile(uid, Map.of("verify", true, "gender", "male", "birthday", "1999-05-05"))).field());
        Map<String, Object> r = f.accounts.profile(uid, Map.of("verify", true, "confirm", true, "gender", "male", "birthday", "1999-05-05"));
        assertEquals(true, Maps.map(r.get("user")).get("profileVerified"));
        assertEquals(403, assertThrows(HttpError.class, () -> f.accounts.profile(uid, Map.of("birthday", "1990-01-01"))).status());
        assertEquals("Tên Mới", Maps.map(f.accounts.profile(uid, Map.of("name", "Tên Mới")).get("user")).get("name"));
    }

    @Test void sessionTokenSignedAndExpiring(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        String t = f.sessions.create("u_1");
        assertEquals("u_1", f.sessions.verify(t));
        assertNull(f.sessions.verify(t.substring(0, t.length() - 2) + "xx"), "chữ ký sai phải bị từ chối");
        assertNull(f.sessions.verify("rac"));
        f.clock.plusDays(31);
        assertNull(f.sessions.verify(t), "hết hạn 30 ngày");
    }

    @Test void googleTokenWithoutVerifiableKeyIsRejected(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertEquals(401, assertThrows(HttpError.class, () -> f.accounts.google("aaa.bbb.ccc")).status());
        assertEquals(401, assertThrows(HttpError.class, () -> f.accounts.google("khong-phai-jwt")).status());
    }
}
