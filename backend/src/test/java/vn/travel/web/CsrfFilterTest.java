package vn.travel.web;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class CsrfFilterTest {
    private static final Set<String> OK = Set.of("https://travel.vn", "http://localhost:3000");

    @Test void onlyStateChangingApiCallsAreChecked() {
        assertTrue(CsrfFilter.needsCheck("POST", "/api/bookings"));
        assertTrue(CsrfFilter.needsCheck("DELETE", "/api/admin/banners/1"));
        assertTrue(CsrfFilter.needsCheck("PUT", "/api/admin/vouchers/X"));
        assertFalse(CsrfFilter.needsCheck("GET", "/api/bookings"));
        assertFalse(CsrfFilter.needsCheck("POST", "/index.html"));
        assertFalse(CsrfFilter.needsCheck("POST", "/api/payments/webhook"), "webhook ngân hàng dùng khóa bí mật, không có Origin");
    }

    @Test void sameOriginPasses() {
        assertTrue(CsrfFilter.allowed("https://travel.vn", null, true, OK));
        assertTrue(CsrfFilter.allowed("https://TRAVEL.vn:443", null, true, OK), "chuẩn hóa hoa/thường và cổng mặc định");
        assertTrue(CsrfFilter.allowed("http://localhost:3000", null, true, OK));
    }

    @Test void foreignOrNullOriginIsRejected() {
        assertFalse(CsrfFilter.allowed("https://evil.example", null, true, OK));
        assertFalse(CsrfFilter.allowed("https://travel.vn.evil.example", null, true, OK));
        assertFalse(CsrfFilter.allowed("http://travel.vn", null, true, OK), "khác scheme là khác origin");
        assertFalse(CsrfFilter.allowed("null", null, false, OK));
        assertFalse(CsrfFilter.allowed("https://evil.example", "https://travel.vn/", true, OK), "Origin thắng Referer");
    }

    @Test void refererIsUsedWhenOriginMissing() {
        assertTrue(CsrfFilter.allowed(null, "https://travel.vn/?tour=1", true, OK));
        assertFalse(CsrfFilter.allowed(null, "https://evil.example/p", true, OK));
    }

    @Test void noOriginNoRefererOnlyWithoutSessionCookie() {
        assertTrue(CsrfFilter.allowed(null, null, false, OK), "curl / máy chủ khác, không có cookie để lạm dụng");
        assertFalse(CsrfFilter.allowed(null, null, true, OK));
    }

    @Test void normalizeRejectsGarbage() {
        assertNull(CsrfFilter.normalize("javascript:alert(1)"));
        assertNull(CsrfFilter.normalize("not a url"));
        assertEquals("https://x.vn", CsrfFilter.normalize("https://x.vn/a/b?c=d"));
    }
}
