package vn.travel.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Cấu hình nguồn dữ liệu TRỰC TUYẾN cho chuyến bay / khách sạn (prefix "travel.live").
 * Chỉ cần điền 3 khóa trong .env: IGNAV_API_KEY, GOOGLE_PLACES_API_KEY, TRAVELPAYOUTS_TOKEN (+ TRAVELPAYOUTS_MARKER để ăn hoa hồng).
 * Mọi giá trị còn lại đã có mặc định trong application.properties. Khóa để trống → nguồn đó tắt và hệ thống dùng danh mục có sẵn.
 */
@Component
public class LiveTravelConfig {
    private final String ignavKey, ignavBase, ignavMarket, placesKey, tpToken, tpMarker, tpBase, hotelCurrency, linkTemplate;
    private final int cacheSeconds;

    public LiveTravelConfig(@Value("${travel.live.ignav-api-key:}") String ignavKey,
                            @Value("${travel.live.ignav-base-url:https://ignav.com}") String ignavBase,
                            @Value("${travel.live.ignav-market:VN}") String ignavMarket,
                            @Value("${travel.live.google-places-api-key:}") String placesKey,
                            @Value("${travel.live.travelpayouts-token:}") String tpToken,
                            @Value("${travel.live.travelpayouts-marker:}") String tpMarker,
                            @Value("${travel.live.travelpayouts-base-url:https://engine.hotellook.com/api/v2/cache.json}") String tpBase,
                            @Value("${travel.live.hotel-currency:vnd}") String hotelCurrency,
                            @Value("${travel.live.hotel-link-template:}") String linkTemplate,
                            @Value("${travel.live.cache-seconds:600}") int cacheSeconds) {
        this.ignavKey = nz(ignavKey);
        this.ignavBase = nz(ignavBase).replaceAll("/+$", "");
        this.ignavMarket = nz(ignavMarket).isEmpty() ? "VN" : ignavMarket.trim().toUpperCase();
        this.placesKey = nz(placesKey);
        this.tpToken = nz(tpToken);
        this.tpMarker = nz(tpMarker);
        this.tpBase = nz(tpBase);
        this.hotelCurrency = nz(hotelCurrency).isEmpty() ? "vnd" : hotelCurrency.trim().toLowerCase();
        this.linkTemplate = nz(linkTemplate).isEmpty()
                ? "https://search.hotellook.com/hotels?hotelId={hotelId}&checkIn={checkIn}&checkOut={checkOut}&adults={guests}&currency={currency}&language=vi&marker={marker}"
                : linkTemplate.trim();
        this.cacheSeconds = Math.max(0, cacheSeconds);
    }

    private static String nz(String s) { return s == null ? "" : s.trim(); }

    public String ignavKey() { return ignavKey; }
    public String ignavBase() { return ignavBase; }
    public String ignavMarket() { return ignavMarket; }
    public String placesKey() { return placesKey; }
    public String tpToken() { return tpToken; }
    public String tpMarker() { return tpMarker; }
    public String tpBase() { return tpBase; }
    public String hotelCurrency() { return hotelCurrency; }
    public String linkTemplate() { return linkTemplate; }
    public int cacheSeconds() { return cacheSeconds; }

    public boolean flightsEnabled() { return !ignavKey.isEmpty(); }
    public boolean placesEnabled() { return !placesKey.isEmpty(); }
    public boolean pricesEnabled() { return !tpToken.isEmpty(); }
    public boolean hotelsEnabled() { return placesEnabled() || pricesEnabled(); }
}
