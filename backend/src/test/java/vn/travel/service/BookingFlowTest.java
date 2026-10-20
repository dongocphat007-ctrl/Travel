package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BookingFlowTest {
    private static Map<String, Object> req(String tourId, String date) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", tourId); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("email", "");
        m.put("date", date); m.put("adults", 2); m.put("kids", 0); m.put("infants", 0);
        return m;
    }

    @Test void serverComputesPriceAndIgnoresClientPrice(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> in = req("101", "2026-11-10");
        in.put("price", 1); in.put("deposit", 1); in.put("priceBreakdown", Map.of("final", 1));
        Map<String, Object> b = f.bookings.create(u, in);
        assertEquals(5_000_000L, ((Number) b.get("price")).longValue());
        assertEquals(1_000_000L, ((Number) b.get("deposit")).longValue());
        assertEquals("pending", b.get("status"));
        assertTrue(Maps.str(b, "payCode").matches("TRAVEL\\d{13}"));
        assertEquals(Maps.str(u, "id"), b.get("userId"));
    }

    @Test void validatesPhoneDateAndTour(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> badPhone = req("101", "2026-11-10"); badPhone.put("phone", "123");
        assertEquals("phone", assertThrows(HttpError.class, () -> f.bookings.create(u, badPhone)).field());
        assertEquals("date", assertThrows(HttpError.class, () -> f.bookings.create(u, req("101", "2026-11-02"))).field());   // < 3 ngày
        assertEquals("date", assertThrows(HttpError.class, () -> f.bookings.create(u, req("101", "2026-02-30"))).field());
        assertEquals(404, assertThrows(HttpError.class, () -> f.bookings.create(u, req("khong-co", "2026-11-10"))).status());
    }

    @Test void voucherAppliedOnceAndRefundedOnCancel(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        String uid = Maps.str(u, "id");
        String code = f.vouchers.mine(uid).stream().filter(v -> "welcome".equals(v.get("source"))).map(v -> Maps.str(v, "code")).findFirst().orElseThrow();
        Map<String, Object> in = req("101", "2026-11-10"); in.put("voucherCode", code);
        Map<String, Object> b = f.bookings.create(u, in);
        assertEquals(4_500_000L, ((Number) b.get("price")).longValue());   // 5.000.000 − 10%
        assertEquals(900_000L, ((Number) b.get("deposit")).longValue());
        HttpError again = assertThrows(HttpError.class, () -> f.bookings.create(u, in));
        assertEquals("voucher", again.field());
        f.bookings.cancel(Maps.str(b, "id"), u);
        assertEquals("active", f.vouchers.mine(uid).stream().filter(v -> code.equals(v.get("code"))).findFirst().get().get("state"));
        assertNotNull(f.bookings.create(u, in));   // dùng lại được sau khi hủy
    }

    @Test void voucherOfAnotherAccountOrTourIsRejected(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = f.newUser("a@gmail.com"), c = f.newUser("c@gmail.com");
        String codeA = f.vouchers.mine(Maps.str(a, "id")).stream().filter(v -> "welcome".equals(v.get("source"))).map(v -> Maps.str(v, "code")).findFirst().orElseThrow();
        Map<String, Object> in = req("101", "2026-11-10"); in.put("voucherCode", codeA);
        assertEquals("voucher", assertThrows(HttpError.class, () -> f.bookings.create(c, in)).field());
        String tour15 = f.vouchers.mine(Maps.str(a, "id")).stream().filter(v -> "hot07".equals(v.get("tourId"))).map(v -> Maps.str(v, "code")).findFirst().orElseThrow();
        Map<String, Object> wrongTour = req("101", "2026-11-10"); wrongTour.put("voucherCode", tour15);
        assertEquals("voucher", assertThrows(HttpError.class, () -> f.bookings.create(a, wrongTour)).field());
    }

    @Test void guideIsCheckedAgainstBusyDatesAndOtherBookings(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = f.newUser("a@gmail.com"), c = f.newUser("c@gmail.com");
        Map<String, Object> busy = req("101", "2026-12-09"); busy.put("guideId", "g1");   // g1 bận 10/12, tour 3 ngày
        assertEquals(409, assertThrows(HttpError.class, () -> f.bookings.create(a, busy)).status());
        Map<String, Object> off = req("101", "2026-11-10"); off.put("guideId", "g2");
        assertEquals("guide", assertThrows(HttpError.class, () -> f.bookings.create(a, off)).field());
        assertEquals("guide", assertThrows(HttpError.class, () -> { Map<String, Object> m = req("101", "2026-11-10"); m.put("guideId", "khong-co"); f.bookings.create(a, m); }).field());
        Map<String, Object> ok = req("101", "2026-11-10"); ok.put("guideId", "g1");
        Map<String, Object> first = f.bookings.create(a, ok);
        Map<String, Object> clash = req("101", "2026-11-12"); clash.put("guideId", "g1");   // trùng ngày 12 với đơn đầu (10–12)
        assertEquals(409, assertThrows(HttpError.class, () -> f.bookings.create(c, clash)).status());
        assertTrue(Maps.list(f.guides.get("g1").get("busyDates")).contains("2026-11-11"));
        f.bookings.cancel(Maps.str(first, "id"), a);   // hủy đơn nhả lịch
        assertNotNull(f.bookings.create(c, clash));
    }

    @Test void selfGuidedTourNeedsHdvToPickGuide(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = f.newUser("a@gmail.com");
        Map<String, Object> in = req("s1", "2026-11-10"); in.put("guideId", "g1");
        assertEquals("guide", assertThrows(HttpError.class, () -> f.bookings.create(a, in)).field());
        in.put("hdvOn", true); in.put("hdvHours", 10);
        Map<String, Object> b = f.bookings.create(a, in);
        // 2 người × 1.000.000 + HDV 2 ngày × (1.500.000 + 2h × 200.000)
        assertEquals(2_000_000L + 2 * 1_900_000L, ((Number) b.get("price")).longValue());
    }

    @Test void permissionsOnListCancelAndSync(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.accounts.seedAdmin("boss@example.com", "mat-khau-manh-1");
        Map<String, Object> admin = f.accounts.byEmail("boss@example.com");
        Map<String, Object> a = f.newUser("a@gmail.com"), c = f.newUser("c@gmail.com");
        Map<String, Object> b = f.bookings.create(a, req("101", "2026-11-10"));
        String id = Maps.str(b, "id");
        assertEquals(1, f.bookings.listFor(a).size());
        assertEquals(0, f.bookings.listFor(c).size());
        assertEquals(1, f.bookings.listFor(admin).size());
        assertEquals(404, assertThrows(HttpError.class, () -> f.bookings.getFor(id, c)).status());
        assertEquals(404, assertThrows(HttpError.class, () -> f.bookings.cancel(id, c)).status());

        // khách KHÔNG tự đánh dấu đã cọc / xác nhận / đổi giá / đổi mã chuyển khoản
        f.bookings.sync(a, List.of(Map.of("id", id, "depositPaid", true, "status", "confirmed", "price", 1, "payCode", "TRAVEL1", "adminNote", "x")));
        Map<String, Object> after = f.bookings.find(id);
        assertEquals(false, after.get("depositPaid"));
        assertEquals("pending", after.get("status"));
        assertEquals(5_000_000L, ((Number) after.get("price")).longValue());
        assertEquals(b.get("payCode"), after.get("payCode"));
        // người khác không sửa được đơn của mình
        f.bookings.sync(c, List.of(Map.of("id", id, "payChoice", "full")));
        assertNull(f.bookings.find(id).get("payChoice"));
        // khách ghi "đã chuyển khoản" (claims) + chọn cách trả được
        f.bookings.sync(a, List.of(Map.of("id", id, "payChoice", "full", "claims", Map.of("deposit", "2026-11-01T03:00:00Z"))));
        assertEquals("full", f.bookings.find(id).get("payChoice"));
        assertNotNull(Maps.map(f.bookings.find(id).get("claims")).get("deposit"));
        // Admin xác nhận được
        f.bookings.sync(admin, List.of(Map.of("id", id, "status", "confirmed", "adminNote", "ok")));
        assertEquals("confirmed", f.bookings.find(id).get("status"));
        // đã xác nhận thì khách không tự hủy được
        assertEquals(409, assertThrows(HttpError.class, () -> f.bookings.cancel(id, a)).status());
        assertEquals(1, f.bookings.delete(List.of(id)));
    }
}
