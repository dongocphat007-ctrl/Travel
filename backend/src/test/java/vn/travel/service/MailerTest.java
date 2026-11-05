package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.travel.util.Maps;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Mailer: tắt khi thiếu cấu hình, lỗi mạng không làm hỏng đặt tour, email không bị chèn HTML. */
class MailerTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void disabledWithoutKeyOrFrom() {
        assertFalse(new Mailer(TestProps.with("", "", "Travel <no-reply@x.vn>", ""), mapper).enabled());
        assertFalse(new Mailer(TestProps.with("", "key", "", ""), mapper).enabled());
        assertTrue(new Mailer(TestProps.with("", "key", "Travel <no-reply@x.vn>", ""), mapper).enabled());
        assertFalse(new Mailer(TestProps.with("", "", "", ""), mapper).send("a@gmail.com", "Chủ đề", "<p>x</p>"));
    }

    @Test void networkFailureReturnsFalseAndNeverThrows() {
        Mailer m = new Mailer(TestProps.with("", "key", "Travel <no-reply@x.vn>", "http://127.0.0.1:9/emails"), mapper);   // cổng 9: không có ai nghe
        assertFalse(m.send("a@gmail.com", "Chủ đề", "<p>x</p>"));
    }

    @Test void escapesHtml() {
        assertEquals("&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt; &amp; ok", Mailer.esc("<script>alert(\"1\")</script> & ok"));
        assertEquals("", Mailer.esc(null));
    }

    @Test void bookingEmailUsesStoredBreakdownAndEscapesCustomerInput() {
        Mailer m = new Mailer(TestProps.with("", "", "", ""), mapper);
        Map<String, Object> b = Maps.of("id", "bk_1", "customerName", "<img src=x onerror=alert(1)>", "tourName", "Hạ Long", "date", "2026-11-10", "pax", 2,
                "payCode", "TRAVEL123",
                "priceBreakdown", Maps.of("base", 5000000, "hdv", 0, "discount", 500000, "voucherCode", "WELCOME10-AB", "final", 4500000, "depositPct", 20, "deposit", 900000));
        String html = m.bookingHtml(b);
        assertFalse(html.contains("<img"), "tên khách phải được escape");
        assertTrue(html.contains("&lt;img"));
        assertTrue(html.contains("4.500.000 ₫"));
        assertTrue(html.contains("900.000 ₫"));
        assertTrue(html.contains("WELCOME10-AB"));
        assertTrue(html.contains("TRAVEL123"));
    }
}
