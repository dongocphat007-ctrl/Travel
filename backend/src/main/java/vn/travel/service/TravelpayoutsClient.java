package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.LiveTravelConfig;
import vn.travel.util.HotelSources;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Giá phòng + liên kết đặt: Travelpayouts / Hotellook (so sánh giá nhiều đại lý, trong đó có Agoda). Địa chỉ gốc đổi được bằng TRAVELPAYOUTS_BASE_URL. */
@Service
public class TravelpayoutsClient {
    private final LiveTravelConfig cfg;
    private final LiveHttp http;

    public TravelpayoutsClient(LiveTravelConfig cfg, LiveHttp http) {
        this.cfg = cfg;
        this.http = http;
    }

    public boolean enabled() { return cfg.pricesEnabled(); }

    public List<Map<String, Object>> prices(String dest, LocalDate in, LocalDate out, int guests) {
        String sep = cfg.tpBase().contains("?") ? "&" : "?";
        String url = cfg.tpBase() + sep + "location=" + HotelSources.enc(HotelSources.ascii(dest)) + "&currency=" + HotelSources.enc(cfg.hotelCurrency())
                + "&checkIn=" + in + "&checkOut=" + out + "&adults=" + guests + "&limit=100&token=" + HotelSources.enc(cfg.tpToken());
        return HotelSources.parsePrices(http.json("GET", url, Map.of(), null, 15));
    }
}
