package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.web.HttpError;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class OtpTest {
    @Test void notRequiredAndSendRefusedWhenNoEmailService(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp, "S", false);
        assertFalse(f.otp.required());
        assertEquals(503, assertThrows(HttpError.class, () -> f.otp.send("A", "a@gmail.com")).status());
    }

    @Test void ticketIsBoundToEmailAndExpires(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp, "S", true);   // otpDevLog = true → mã in ra log, không gửi email thật
        assertTrue(f.otp.required());
        f.otp.send("A", "a@gmail.com");
        assertEquals(429, assertThrows(HttpError.class, () -> f.otp.send("A", "a@gmail.com")).status());   // gửi lại quá nhanh
        assertEquals(400, assertThrows(HttpError.class, () -> f.otp.verify("a@gmail.com", "000000")).status());
        assertEquals(400, assertThrows(HttpError.class, () -> f.otp.verify("khac@gmail.com", "123456")).status());
        // lấy mã đúng bằng cách gửi lại sau 31 giây rồi thử vét cạn tối đa 5 lần → bị khóa
        f.clock.now += 31_000;
        f.otp.send("A", "a@gmail.com");
        for (int i = 0; i < 5; i++) assertEquals(400, assertThrows(HttpError.class, () -> f.otp.verify("a@gmail.com", "000000")).status());
        assertEquals(429, assertThrows(HttpError.class, () -> f.otp.verify("a@gmail.com", "000000")).status());
    }

    @Test void ticketValidationRejectsOtherEmailTamperAndExpiry(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp, "S", true);
        String body = "a@gmail.com|" + (f.clock.millis() + 60_000);
        String ticket = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(body.getBytes()) + "." + f.sessions.sign("otp:" + body);
        assertTrue(f.otp.ticketValid("A@gmail.com", ticket));
        assertFalse(f.otp.ticketValid("b@gmail.com", ticket));
        assertFalse(f.otp.ticketValid("a@gmail.com", ticket + "x"));
        assertFalse(f.otp.ticketValid("a@gmail.com", null));
        f.clock.now += 120_000;
        assertFalse(f.otp.ticketValid("a@gmail.com", ticket));
    }
}
