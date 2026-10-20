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

class PaymentsTest {
    private static Map<String, Object> req(String date) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", "101"); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("date", date); m.put("adults", 2);
        return m;
    }
    private static Map<String, Object> tx(String id, long amount, String content) {
        return Map.of("id", id, "transferType", "in", "transferAmount", amount, "content", content);
    }

    @Test void webhookRequiresSecret(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertEquals(401, assertThrows(HttpError.class, () -> f.payments.authenticate(null, null)).status());
        assertEquals(401, assertThrows(HttpError.class, () -> f.payments.authenticate("Apikey sai", null)).status());
        f.payments.authenticate("Apikey WEBHOOK-SECRET", null);
        f.payments.authenticate(null, "WEBHOOK-SECRET");
        Fixture noSecret = new Fixture(tmp.resolve("n"), "", false);
        assertEquals(503, assertThrows(HttpError.class, () -> noSecret.payments.authenticate("Apikey ", null)).status());
    }

    @Test void matchingTransferConfirmsBookingOnce(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(u, req("2026-11-10"));
        String code = Maps.str(b, "payCode");
        // nội dung do ngân hàng chèn thêm ký tự / viết thường vẫn tách được mã
        Map<String, Object> r = f.payments.webhook(tx("T1", 1_000_000, "MBVCB.123 chuyen tien " + code.toLowerCase() + " FT26"));
        assertEquals("matched", Maps.map(r.get("payment")).get("status"));
        Map<String, Object> nb = f.bookings.find(Maps.str(b, "id"));
        assertEquals(true, nb.get("depositPaid"));
        assertEquals("confirmed", nb.get("status"));
        // gửi lại cùng mã giao dịch → không ghi trùng
        Map<String, Object> dup = f.payments.webhook(tx("T1", 1_000_000, code));
        assertEquals(true, dup.get("duplicate"));
        assertEquals(1, f.payments.list().size());
    }

    @Test void underpaymentWrongCodeAndCancelledAreFlaggedNotConfirmed(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(u, req("2026-11-10"));
        String code = Maps.str(b, "payCode");
        assertEquals("mismatch", Maps.map(f.payments.webhook(tx("T2", 500_000, code)).get("payment")).get("status"));
        assertEquals(false, f.bookings.find(Maps.str(b, "id")).get("depositPaid"));
        assertEquals("unmatched", Maps.map(f.payments.webhook(tx("T3", 1_000_000, "chuyen tien linh tinh")).get("payment")).get("status"));
        assertEquals("unmatched", Maps.map(f.payments.webhook(tx("T4", 1_000_000, "TRAVEL9999999999999")).get("payment")).get("status"));
        assertTrue(f.payments.webhook(Map.of("id", "T5", "transferType", "out", "transferAmount", 1, "content", code)).containsKey("ignored"));
        f.bookings.cancel(Maps.str(b, "id"), u);
        assertEquals("mismatch", Maps.map(f.payments.webhook(tx("T6", 1_000_000, code)).get("payment")).get("status"));
        assertEquals(400, assertThrows(HttpError.class, () -> f.payments.webhook(Map.of("transferAmount", 1))).status());
    }

    @Test void fullPaymentThenFinalPayment(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(u, req("2026-11-10"));
        String id = Maps.str(b, "id"), code = Maps.str(b, "payCode");
        f.payments.webhook(tx("T1", 1_000_000, code));                                  // cọc 20%
        assertEquals(4_000_000L, Payments.amountDue(f.bookings.find(id)));              // còn lại
        assertEquals("mismatch", Maps.map(f.payments.webhook(tx("T2", 1_000_000, code)).get("payment")).get("status"));
        assertEquals("matched", Maps.map(f.payments.webhook(tx("T3", 4_000_000, code)).get("payment")).get("status"));
        assertEquals(true, f.bookings.find(id).get("finalPaid"));
        assertEquals("mismatch", Maps.map(f.payments.webhook(tx("T4", 4_000_000, code)).get("payment")).get("status"));   // đã đủ
    }

    @Test void payingFullUpFrontMarksFullPaid(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("2026-11-10"));
        f.payments.webhook(tx("T1", 5_000_000, Maps.str(b, "payCode")));
        Map<String, Object> nb = f.bookings.find(Maps.str(b, "id"));
        assertEquals(true, nb.get("fullPaid"));
        assertEquals(true, nb.get("depositPaid"));
    }

    @Test void manualConfirmResolvesMismatchAndFeedsStats(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.accounts.seedAdmin("boss@example.com", "mat-khau-manh-1");
        Map<String, Object> admin = f.accounts.byEmail("boss@example.com");
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req("2026-11-10"));
        String id = Maps.str(b, "id");
        Map<String, Object> bad = Maps.map(f.payments.webhook(tx("T1", 900_000, Maps.str(b, "payCode"))).get("payment"));
        assertEquals("mismatch", bad.get("status"));
        Map<String, Object> st0 = f.payments.stats();
        assertEquals(1L, ((Number) st0.get("mismatchCount")).longValue());
        assertEquals(0L, ((Number) st0.get("received")).longValue());

        assertEquals(400, assertThrows(HttpError.class, () -> f.payments.manual(admin, Map.of("bookingId", id, "kind", "xyz"))).status());
        Map<String, Object> rec = f.payments.manual(admin, Map.of("bookingId", id, "kind", "deposit", "paymentId", bad.get("id"), "note", "Khách chuyển thiếu, đã gọi xác nhận"));
        assertEquals("matched", rec.get("status"));
        assertEquals("boss@example.com", rec.get("handledBy"));
        assertEquals(true, f.bookings.find(id).get("depositPaid"));
        assertEquals(409, assertThrows(HttpError.class, () -> f.payments.manual(admin, Map.of("bookingId", id, "kind", "deposit"))).status());

        Map<String, Object> st = f.payments.stats();
        assertEquals(900_000L, ((Number) st.get("received")).longValue());
        assertEquals(0L, ((Number) st.get("mismatchCount")).longValue());
        assertEquals(1L, ((Number) Maps.map(st.get("bookings")).get("deposited")).longValue());
        assertEquals("2026-11", Maps.map((Map<String, Object>) ((List<?>) st.get("byMonth")).get(0)).get("month"));
    }

    @Test void infoComputedByServer(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> a = f.newUser("a@gmail.com"), c = f.newUser("c@gmail.com");
        Map<String, Object> b = f.bookings.create(a, req("2026-11-10"));
        Map<String, Object> info = f.payments.info(Maps.str(b, "id"), a);
        assertEquals(1_000_000L, ((Number) info.get("amount")).longValue());
        assertEquals(b.get("payCode"), info.get("content"));
        assertTrue(Maps.str(info, "qrUrl").contains("970436-123456789"));
        assertEquals(404, assertThrows(HttpError.class, () -> f.payments.info(Maps.str(b, "id"), c)).status());
        assertEquals("Vietcombank", f.payments.publicConfig().get("bank"));
    }
}
