package vn.travel.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vn.travel.config.LiveTravelConfig;
import vn.travel.util.HotelSources;
import vn.travel.util.IgnavMapper;
import vn.travel.util.Maps;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

/**
 * Tổng hợp nguồn dữ liệu trực tuyến:
 *   Chuyến bay  → Ignav (giá + liên kết đặt vé của hãng)
 *   Khách sạn   → Google Places (danh sách, ảnh, đánh giá) + Travelpayouts/Hotellook (giá, liên kết), ghép theo tên + toạ độ
 * Kết quả được nhớ ngắn hạn trong RAM (mặc định 10 phút, LIVE_CACHE_SECONDS) để tiết kiệm hạn mức API; KHÔNG lưu xuống đĩa.
 */
@Service
public class LiveTravel {
    private static final Logger log = LoggerFactory.getLogger(LiveTravel.class);
    private static final int MAX_CACHE = 300;
    private record Entry(long at, Object value) { }

    private final LiveTravelConfig cfg;
    private final IgnavClient ignav;
    private final PlacesClient places;
    private final TravelpayoutsClient prices;
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    public LiveTravel(LiveTravelConfig cfg, IgnavClient ignav, PlacesClient places, TravelpayoutsClient prices) {
        this.cfg = cfg;
        this.ignav = ignav;
        this.places = places;
        this.prices = prices;
    }

    public boolean flightsEnabled() { return ignav.enabled(); }
    public boolean hotelsEnabled() { return places.enabled() || prices.enabled(); }

    public Map<String, Object> status() {
        return Maps.of("flights", ignav.enabled(), "hotelPlaces", places.enabled(), "hotelPrices", prices.enabled());
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> load) {
        long now = System.currentTimeMillis(), ttl = cfg.cacheSeconds() * 1000L;
        Entry e = cache.get(key);
        if (ttl > 0 && e != null && now - e.at() < ttl) return (T) e.value();
        T v = load.get();
        if (ttl > 0) {
            if (cache.size() >= MAX_CACHE) cache.clear();
            cache.put(key, new Entry(now, v));
        }
        return v;
    }

    // ───────── chuyến bay ─────────
    public Map<String, Object> searchFlights(String from, String to, LocalDate date, int pax, String cabinKey, UnaryOperator<String> cityOf) {
        List<Map<String, Object>> flights = cached("fl|" + from + "|" + to + "|" + date + "|" + pax + "|" + cabinKey, () -> {
            Map<String, Object> resp = ignav.oneWay(from, to, date.toString(), pax, cabinKey);
            return IgnavMapper.flights(resp, date.toString(), pax, cabinKey, cityOf, 30);
        });
        String cur = flights.isEmpty() ? "" : Maps.str(flights.get(0), "currency");
        return Maps.of("ok", true, "from", from, "to", to, "date", date.toString(), "pax", pax, "cabin", cabinKey, "flights", flights,
                "source", "ignav", "live", true, "currency", cur,
                "note", "Giá tham khảo theo thời điểm tìm kiếm, có thể thay đổi. Bạn đặt và thanh toán trực tiếp tại trang của hãng/đại lý.");
    }

    public Map<String, Object> flightLinks(String ignavId) {
        if (ignavId == null || !ignavId.matches("[A-Za-z0-9_-]{8,80}")) throw new LiveException(400, "Mã chuyến bay không hợp lệ");
        List<Map<String, Object>> links = cached("lk|" + ignavId, () -> ignav.bookingLinks(ignavId));
        return Maps.of("ok", true, "links", links);
    }

    // ───────── khách sạn ─────────
    public Map<String, Object> searchHotels(String dest, LocalDate in, LocalDate out, int guests, int stars) {
        String key = "ht|" + dest.toLowerCase(Locale.ROOT) + "|" + in + "|" + out + "|" + guests + "|" + stars;
        List<Map<String, Object>> hotels = cached(key, () -> {
            List<Map<String, Object>> pl = List.of(), pr = List.of();
            LiveException firstError = null;
            if (places.enabled()) {
                try { pl = places.searchHotels(dest); } catch (LiveException e) { firstError = e; log.warn("Google Places loi: {}", e.getMessage()); }
            }
            if (prices.enabled()) {
                try { pr = prices.prices(dest, in, out, guests); } catch (LiveException e) { if (firstError == null) firstError = e; log.warn("Travelpayouts loi: {}", e.getMessage()); }
            }
            if (pl.isEmpty() && pr.isEmpty() && firstError != null) throw firstError;
            return HotelSources.merge(pl, pr, in, out, guests, cfg.hotelCurrency(), cfg.linkTemplate(), cfg.tpMarker(), stars, 30);
        });
        return Maps.of("ok", true, "dest", dest, "checkin", in.toString(), "checkout", out.toString(), "guests", guests, "hotels", hotels,
                "source", "live", "live", true, "currency", cfg.hotelCurrency().toUpperCase(Locale.ROOT),
                "note", "Danh sách & đánh giá từ Google; giá từ Travelpayouts/Hotellook (gồm Agoda), có thể thay đổi. Bạn đặt phòng trực tiếp tại trang đối tác.");
    }

    public LiveHttp.Bytes photo(String name, int width) {
        if (!places.enabled()) throw new LiveException(404, "Chưa bật Google Places");
        return places.photo(name, width);
    }
}
