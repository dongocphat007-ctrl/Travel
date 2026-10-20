package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Chuyến bay / khách sạn: dữ liệu từ danh mục server, giá server tính, thanh toán qua webhook như đơn tour. Đồng hồ giả: 2026-11-01. */
class TravelBookingTest {
    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> m, String k) { return (List<Map<String, Object>>) m.get(k); }

    private static Map<String, Object> contact(Map<String, Object> m) {
        m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("email", "a@gmail.com");
        return m;
    }

    @Test void flightPriceComesFromServerAndWebhookConfirmsIt(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Inventory inv = new Inventory(f.dbs, f.clock);
        TravelBookings tb = new TravelBookings(f.dbs, inv, f.noti, f.clock, f.props);
        Map<String, Object> u = f.newUser("a@gmail.com");

        Map<String, Object> res = inv.searchFlights("Hà Nội (HAN)", "sgn", "2026-12-08", 2, "economy");
        List<Map<String, Object>> flights = list(res, "flights");
        assertFalse(flights.isEmpty());
        Map<String, Object> pick = flights.get(0);

        Map<String, Object> in = contact(new java.util.LinkedHashMap<>());
        in.put("flightId", pick.get("id")); in.put("date", "2026-12-08"); in.put("pax", 2); in.put("cabin", "economy");
        in.put("price", 1); in.put("deposit", 1);                     // client gửi giá → bị bỏ qua
        Map<String, Object> b = tb.bookFlight(u, in);
        assertEquals("flight", b.get("kind"));
        assertEquals(Maps.lng(pick, "price"), Maps.lng(b, "price"));
        assertEquals(Maps.lng(b, "price"), Maps.lng(b, "deposit"));
        assertEquals("pending", b.get("status"));

        Map<String, Object> hook = Maps.of("id", "tx-1", "transferType", "in", "transferAmount", Maps.lng(b, "price"), "content", "CK " + b.get("payCode"));
        f.payments.webhook(hook);
        Map<String, Object> after = f.bookings.find(Maps.str(b, "id"));
        assertEquals("confirmed", after.get("status"));
        assertTrue(Maps.bool(after, "fullPaid"));
    }

    @Test void hotelQuoteMatchesSearchAndRejectsBadInput(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Inventory inv = new Inventory(f.dbs, f.clock);
        TravelBookings tb = new TravelBookings(f.dbs, inv, f.noti, f.clock, f.props);
        Map<String, Object> u = f.newUser("a@gmail.com");

        Map<String, Object> res = inv.searchHotels("Hội An", "2026-11-26", "2026-11-29", 3, "any");
        Map<String, Object> hotel = list(res, "hotels").get(0);
        Map<String, Object> room = list(hotel, "rooms").get(0);

        Map<String, Object> in = contact(new java.util.LinkedHashMap<>());
        in.put("hotelId", hotel.get("id")); in.put("roomType", room.get("type")); in.put("checkin", "2026-11-26"); in.put("checkout", "2026-11-29"); in.put("guests", 3);
        Map<String, Object> b = tb.bookHotel(u, in);
        assertEquals("hotel", b.get("kind"));
        assertEquals(Maps.lng(room, "total"), Maps.lng(b, "price"));

        in.put("roomType", "Penthouse");
        assertEquals("roomType", assertThrows(HttpError.class, () -> tb.bookHotel(u, in)).field());
        in.put("roomType", room.get("type")); in.put("checkout", "2026-11-26");
        assertEquals("checkout", assertThrows(HttpError.class, () -> tb.bookHotel(u, in)).field());
    }

    @Test void validatesContactDateAndUnknownFlight(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Inventory inv = new Inventory(f.dbs, f.clock);
        TravelBookings tb = new TravelBookings(f.dbs, inv, f.noti, f.clock, f.props);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> bad = new java.util.LinkedHashMap<>(Map.of("customerName", "A B", "phone", "123"));
        assertEquals("phone", assertThrows(HttpError.class, () -> tb.bookFlight(u, bad)).field());
        Map<String, Object> noFlight = contact(new java.util.LinkedHashMap<>());
        noFlight.put("flightId", "nope"); noFlight.put("date", "2026-12-08");
        assertEquals(404, assertThrows(HttpError.class, () -> tb.bookFlight(u, noFlight)).status());
        assertEquals("date", assertThrows(HttpError.class, () -> inv.searchFlights("HAN", "SGN", "2026-10-01", 1, "economy")).field());   // quá khứ
        assertEquals("to", assertThrows(HttpError.class, () -> inv.searchFlights("HAN", "HAN", "2026-12-08", 1, "economy")).field());
    }
}
