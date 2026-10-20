package vn.travel.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * A3/E5: bản Java phải cho CÙNG kết quả với frontend/shared/pricing.js trên cùng bộ dữ liệu mẫu.
 * pricing-cases.json sinh bằng cách chạy Pricing.compute của JS (module.exports) trên các đầu vào, gồm cả đầu vào "rác"
 * (số lẻ, chuỗi, vượt giới hạn, voucher lớn hơn tạm tính...). Sinh lại khi sửa shared/pricing.js.
 */
class PricingParityTest {
    @Test
    void javaMatchesJavaScriptOnSharedCases() throws Exception {
        List<Map<String, Object>> cases;
        try (InputStream in = getClass().getResourceAsStream("/pricing-cases.json")) {
            cases = new ObjectMapper().readValue(in, new TypeReference<>() { });
        }
        assertTrue(cases.size() >= 100, "bộ dữ liệu đối chiếu quá ít");
        for (Map<String, Object> c : cases) {
            @SuppressWarnings("unchecked") Map<String, Object> i = (Map<String, Object>) c.get("input");
            @SuppressWarnings("unchecked") Map<String, Object> exp = (Map<String, Object>) c.get("expected");
            @SuppressWarnings("unchecked") Map<String, Object> v = (Map<String, Object>) i.get("voucher");
            Map<String, Object> got = Pricing.compute(new Pricing.Input(i.get("price"), i.get("adults"), i.get("kids"), i.get("infants"),
                    Boolean.TRUE.equals(i.get("hdvOn")), i.get("hdvHours"), i.get("days"), v));
            for (String k : exp.keySet()) {
                Object e = exp.get(k), g = got.get(k);
                if (e instanceof Number n) assertEquals(n.longValue(), ((Number) g).longValue(), k + " lệch cho " + i);
                else assertEquals(e, g, k + " lệch cho " + i);
            }
        }
    }

    @Test
    void depositIs20PercentOfFinal() {
        Map<String, Object> r = Pricing.compute(new Pricing.Input(2_000_000, 2, 0, 0, false, 8, 1, null));
        assertEquals(4_000_000L, r.get("final"));
        assertEquals(800_000L, r.get("deposit"));
        assertEquals(3_200_000L, r.get("remaining"));
    }
}
