package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Mã WELCOME10-xxxx: −10%, hiệu lực đúng 7 ngày kể từ lúc tạo tài khoản theo ĐỒNG HỒ SERVER. */
class WelcomeVoucherTest {
    private static String state(Fixture f, String uid, String code) {
        return Maps.str(f.vouchers.mine(uid).stream().filter(v -> code.equals(v.get("code"))).findFirst().orElseThrow(), "state");
    }

    @Test void welcomeCodeHas10PercentAndExpiresExactlyAfter7Days(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        String uid = Maps.str(u, "id");
        Map<String, Object> w = f.vouchers.mine(uid).stream().filter(v -> "welcome".equals(v.get("source"))).findFirst().orElseThrow();
        String code = Maps.str(w, "code");
        assertTrue(code.startsWith("WELCOME10-"));
        assertEquals("percent", w.get("type"));
        assertEquals(10L, Maps.lng(w, "value"));

        f.clock.now += 7 * 86_400_000L - 60_000L;           // còn 1 phút → vẫn dùng được
        assertEquals("active", state(f, uid, code));
        assertDoesNotThrow(() -> f.vouchers.validate(code, "101", uid));
        f.clock.now += 120_000L;                             // quá 7 ngày 1 phút → hết hạn
        assertEquals("expired", state(f, uid, code));
        assertEquals(410, assertThrows(HttpError.class, () -> f.vouchers.validate(code, "101", uid)).status());
    }

    @Test void accountOlderThan7DaysGetsNoWelcomeVoucher(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        f.clock.plusDays(8);
        assertNull(f.vouchers.grantWelcome(u), "tài khoản quá 7 ngày không còn quyền nhận");
    }

    @Test void welcomeCodeOnlyWorksForItsOwner(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = f.newUser("a@gmail.com"), b = f.newUser("b@gmail.com");
        String code = Maps.str(f.vouchers.mine(Maps.str(a, "id")).stream().filter(v -> "welcome".equals(v.get("source"))).findFirst().orElseThrow(), "code");
        assertThrows(HttpError.class, () -> f.vouchers.validate(code, "101", Maps.str(b, "id")));
    }
}
