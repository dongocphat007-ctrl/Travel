package vn.travel.web;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {
    @Test void blocksAfterMaxAndRecoversAfterWindow() {
        RateLimiter r = new RateLimiter();
        for (int i = 0; i < 3; i++) assertTrue(r.allow("login|1.1.1.1", 3, 60_000, 1_000 + i));
        assertFalse(r.allow("login|1.1.1.1", 3, 60_000, 2_000));
        assertTrue(r.allow("login|2.2.2.2", 3, 60_000, 2_000), "IP khác không bị ảnh hưởng");
        assertTrue(r.allow("login|1.1.1.1", 3, 60_000, 62_000), "hết cửa sổ thì được lại");
    }

    @Test void onlySensitivePostsAreLimited() {
        assertNotNull(RateLimitFilter.rule("POST", "/api/auth/login"));
        assertNotNull(RateLimitFilter.rule("POST", "/api/ai/generate"));
        assertNotNull(RateLimitFilter.rule("POST", "/api/vouchers/validate"));
        assertNotNull(RateLimitFilter.rule("POST", "/api/otp/send"));
        assertNull(RateLimitFilter.rule("GET", "/api/auth/login"));
        assertNull(RateLimitFilter.rule("POST", "/api/payments/webhook"));   // webhook có xác thực riêng
    }
}
