package vn.travel.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Ghép khách sạn (Google Places ↔ Travelpayouts) và đổi dữ liệu Ignav sang dạng giao diện dùng. Không gọi mạng. */
class LiveTravelTest {
    private static final String TPL = "https://search.hotellook.com/hotels?hotelId={hotelId}&checkIn={checkIn}&checkOut={checkOut}&adults={guests}&currency={currency}&language=vi&marker={marker}";

    @Test
    void matcherIgnoresAccentsAndGenericWordsButNeedsNearbyCoordinates() {
        var places = List.of(new HotelMatcher.Point("Khách sạn Mường Thanh Luxury Đà Nẵng", 16.0610, 108.2280),
                new HotelMatcher.Point("Sunrise Hotel", 16.0700, 108.2300));
        var prices = List.of(new HotelMatcher.Point("Muong Thanh Luxury Da Nang Hotel", 16.0612, 108.2283),
                new HotelMatcher.Point("Sunrise Premium", 16.2000, 108.3000));
        var m = HotelMatcher.match(places, prices);
        assertEquals(1, m.size());
        assertEquals(0, m.get(0).a());
        assertEquals(0, m.get(0).b());
    }

    @Test
    void eachPriceEntryIsUsedOnce() {
        var p = new HotelMatcher.Point("Pearl Hotel", 10, 10);
        assertEquals(1, HotelMatcher.match(List.of(p, p), List.of(p)).size());
    }

    @Test
    void ignavFlightsAreMappedAndInvalidFaresDropped() {
        Map<String, Object> seg = Maps.of("marketing_carrier_code", "VJ", "flight_number", "123", "operating_carrier_name", "VietJet Air",
                "departure_airport", "SGN", "departure_time_local", "2026-11-20T23:30:00", "arrival_airport", "HAN", "arrival_time_local", "2026-11-21T01:35:00");
        Map<String, Object> ok = Maps.of("price", Maps.of("amount", 1250000, "currency", "VND", "status", "verified"),
                "outbound", Maps.of("carrier", "VietJet Air", "duration_minutes", 125, "segments", List.of(seg)), "ignav_id", "abc123def456", "bags", Maps.of("carry_on", 1, "checked", 0));
        Map<String, Object> bad = Maps.of("price", Maps.of("amount", 0, "currency", "VND", "status", "unverified"), "outbound", Maps.of("segments", List.of(seg)), "ignav_id", "zzz");
        var list = IgnavMapper.flights(Maps.of("itineraries", List.of(bad, ok)), "2026-11-20", 2, "economy", c -> c, 30);
        assertEquals(1, list.size());
        var f = list.get(0);
        assertEquals("23:30", f.get("depart"));
        assertEquals(1, f.get("arriveDayOffset"));
        assertEquals("2g 05p", f.get("duration"));
        assertEquals(625000.0, f.get("farePerPax"));
        assertEquals("abc123def456", f.get("id"));
    }

    @Test
    void bookingLinksRejectUnsafeSchemesAndPreferAirline() {
        var links = IgnavMapper.links(Maps.of("booking_options", List.of(Maps.of("legs", List.of("outbound"), "links", List.of(
                Maps.of("provider_name", "Expedia", "provider_type", "third_party", "price", Maps.of("amount", 502, "currency", "USD"), "url", "expedia.com/flights/x"),
                Maps.of("provider_name", "VietJet", "provider_type", "airline", "price", Maps.of("amount", 488, "currency", "USD"), "url", "https://vietjetair.com/b"),
                Maps.of("provider_name", "Evil", "url", "javascript:alert(1)"),
                Maps.of("provider_name", "Evil2", "url", "data:text/html,hi"))))));
        assertEquals(2, links.size());
        assertEquals("VietJet", links.get(0).get("provider"));
        assertEquals("https://expedia.com/flights/x", links.get(1).get("url"));
    }

    @Test
    void hotelMergeCombinesPhotoRatingAndPrice() {
        var pl = HotelSources.parsePlaces(Maps.of("places", List.of(
                Maps.of("id", "ChIJabc", "displayName", Maps.of("text", "Khách sạn Mường Thanh Luxury Đà Nẵng"), "formattedAddress", "Đà Nẵng",
                        "location", Maps.of("latitude", 16.0610, "longitude", 108.2280), "rating", 4.5, "userRatingCount", 3200,
                        "photos", List.of(Maps.of("name", "places/ChIJabc/photos/AUc7tX_1"))))));
        var pr = HotelSources.parsePrices(List.of(Maps.of("hotelId", "123456", "hotelName", "Muong Thanh Luxury Da Nang", "stars", 5, "priceFrom", 3000000,
                "location", Maps.of("geo", Maps.of("lat", 16.0612, "lon", 108.2283)))));
        var hs = HotelSources.merge(pl, pr, LocalDate.parse("2026-11-20"), LocalDate.parse("2026-11-23"), 2, "vnd", TPL, "MK123", 0, 30);
        assertEquals(1, hs.size());
        var h = hs.get(0);
        assertEquals(3000000L, h.get("priceTotal"));
        assertEquals(1000000L, h.get("priceNight"));
        assertEquals(9.0, h.get("rating"));
        assertEquals(5, h.get("stars"));
        assertTrue(String.valueOf(h.get("bookUrl")).contains("hotelId=123456"));
        assertTrue(String.valueOf(h.get("bookUrl")).contains("marker=MK123"));
        assertEquals("/api/places/photo?name=places%2FChIJabc%2Fphotos%2FAUc7tX_1", h.get("photo"));
    }

    @Test
    void starFilterKeepsHotelsWithUnknownStars() {
        var pl = HotelSources.parsePlaces(Maps.of("places", List.of(Maps.of("id", "x1", "displayName", Maps.of("text", "Little House Homestay")))));
        assertEquals(1, HotelSources.merge(pl, List.of(), LocalDate.parse("2026-11-20"), LocalDate.parse("2026-11-21"), 2, "vnd", TPL, "", 4, 30).size());
    }
}
