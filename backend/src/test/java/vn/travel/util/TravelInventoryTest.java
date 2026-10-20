package vn.travel.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TravelInventoryTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 20);
    private static final List<Map<String, Object>> AIRPORTS = List.of(
            Map.of("code", "HAN", "city", "Hà Nội", "name", "Nội Bài", "utcOffset", 7),
            Map.of("code", "NRT", "city", "Tokyo", "name", "Narita", "utcOffset", 9),
            Map.of("code", "DAD", "city", "Đà Nẵng", "name", "Đà Nẵng", "utcOffset", 7));
    private static final Map<String, Object> FLIGHT = Maps.of("id", "VN1", "airline", "VN Air", "code", "VN", "color", "#000", "flightNo", "VN100",
            "from", "HAN", "to", "NRT", "depart", "23:30", "durationMins", 285, "baseFare", 9_500_000, "baggage", "23 kg", "refundable", true,
            "days", List.of(1, 2, 3, 4, 5, 6, 7));
    private static final Map<String, Object> HOTEL = Map.of("id", "H1", "name", "Grand Phố Cổ", "city", "Hội An", "address", "Khu Phố Cổ, Hội An", "stars", 4,
            "rooms", List.of(Map.of("type", "Standard", "rate", 1_000_000, "capacity", 2), Map.of("type", "Family", "rate", 1_800_000, "capacity", 4)));

    @Test void normStripsVietnamese() { assertEquals("da nang", TravelInventory.norm("Đà Nẵng")); }

    @Test void airportCodeFromIataCityOrFreeText() {
        assertEquals("HAN", TravelInventory.airportCode(AIRPORTS, "Hà Nội (HAN)"));
        assertEquals("DAD", TravelInventory.airportCode(AIRPORTS, "da nang"));
        assertEquals("NRT", TravelInventory.airportCode(AIRPORTS, "nrt"));
        assertNull(TravelInventory.airportCode(AIRPORTS, "Atlantis"));
    }

    @Test void arrivalUsesTimezoneAndRollsToNextDay() {
        Map<String, Object> o = TravelInventory.flightOffer(AIRPORTS, FLIGHT, LocalDate.of(2026, 12, 7), 1, "economy", TODAY);
        assertEquals("23:30", o.get("depart"));
        assertEquals("06:15", o.get("arrive"));          // 23:30 + 4g45p + 2g lệch múi giờ
        assertEquals(1L, o.get("arriveDayOffset"));
    }

    @Test void priceIsServerComputedFromCabinAndPax() {
        LocalDate d = LocalDate.of(2026, 12, 8);          // thứ Ba, ≥30 ngày → −5%
        long eco = Maps.lng(TravelInventory.flightOffer(AIRPORTS, FLIGHT, d, 2, "economy", TODAY), "price");
        long biz = Maps.lng(TravelInventory.flightOffer(AIRPORTS, FLIGHT, d, 2, "business", TODAY), "price");
        assertEquals(2 * 9_025_000L, eco);
        assertEquals(biz, 3 * eco);
    }

    @Test void lastMinuteAndWeekendCostMore() {
        assertTrue(TravelInventory.demand(TODAY.plusDays(3), TODAY) > TravelInventory.demand(TODAY.plusDays(40), TODAY));
        assertTrue(TravelInventory.demand(LocalDate.of(2026, 12, 6), TODAY) > TravelInventory.demand(LocalDate.of(2026, 12, 8), TODAY));
    }

    @Test void flightNotOperatingThatWeekdayIsSkipped() {
        Map<String, Object> mon = new java.util.HashMap<>(FLIGHT);
        mon.put("days", List.of(1));
        assertNull(TravelInventory.flightOffer(AIRPORTS, mon, LocalDate.of(2026, 12, 8), 1, "economy", TODAY));   // thứ Ba
        assertNotNull(TravelInventory.flightOffer(AIRPORTS, mon, LocalDate.of(2026, 12, 7), 1, "economy", TODAY)); // thứ Hai
    }

    @Test void hotelQuoteCountsRoomsNightsAndWeekendSurcharge() {
        // 2026-11-26 (T5) → 2026-11-29 (CN): đêm T5 + T6(+15%) + T7(+15%)
        Map<String, Object> q = TravelInventory.roomQuote(HOTEL, "Standard", LocalDate.of(2026, 11, 26), LocalDate.of(2026, 11, 29), 3, 0);
        assertEquals(2, q.get("rooms"));                                   // 3 khách / 2 người mỗi phòng
        assertEquals(2 * (1_000_000 + 1_150_000 + 1_150_000L), q.get("total"));
        assertNull(TravelInventory.roomQuote(HOTEL, "Penthouse", LocalDate.of(2026, 11, 26), LocalDate.of(2026, 11, 27), 1, 0));
    }

    @Test void hotelSearchFiltersByDestinationAndStars() {
        LocalDate in = LocalDate.of(2026, 11, 26), out = LocalDate.of(2026, 11, 27);
        assertEquals(1, TravelInventory.searchHotels(List.of(HOTEL), "hoi an", in, out, 2, 4).size());
        assertEquals(0, TravelInventory.searchHotels(List.of(HOTEL), "hoi an", in, out, 2, 5).size());
        assertEquals(0, TravelInventory.searchHotels(List.of(HOTEL), "da lat", in, out, 2, 0).size());
    }
}
