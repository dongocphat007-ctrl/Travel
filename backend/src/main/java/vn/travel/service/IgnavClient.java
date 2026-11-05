package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.LiveTravelConfig;
import vn.travel.util.IgnavMapper;
import vn.travel.util.Maps;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Chuyến bay: Ignav (https://ignav.com/docs). Giá + liên kết đặt vé của hãng/đại lý; Travel KHÔNG thu tiền các vé này. */
@Service
public class IgnavClient {
    private final LiveTravelConfig cfg;
    private final LiveHttp http;

    public IgnavClient(LiveTravelConfig cfg, LiveHttp http) {
        this.cfg = cfg;
        this.http = http;
    }

    public boolean enabled() { return cfg.flightsEnabled(); }

    private Map<String, String> headers() { return Map.of("X-Api-Key", cfg.ignavKey()); }

    private static Map<String, Object> asMap(Object o) {
        Map<String, Object> m = Maps.map(o);
        if (m == null) throw new LiveException(502, "Nguồn dữ liệu trả về định dạng không đọc được");
        return m;
    }

    /** POST /api/fares/one-way */
    public Map<String, Object> oneWay(String from, String to, String date, int pax, String cabinKey) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("origin", from);
        body.put("destination", to);
        body.put("departure_date", date);
        body.put("adults", pax);
        body.put("cabin_class", IgnavMapper.ignavCabin(cabinKey));
        body.put("market", cfg.ignavMarket());
        return asMap(http.json("POST", cfg.ignavBase() + "/api/fares/one-way", headers(), body, 25));
    }

    /** POST /api/fares/booking-links → danh sách liên kết đã lọc an toàn. */
    public List<Map<String, Object>> bookingLinks(String ignavId) {
        Map<String, Object> resp = asMap(http.json("POST", cfg.ignavBase() + "/api/fares/booking-links", headers(), Map.of("ignav_id", ignavId), 20));
        return IgnavMapper.links(resp);
    }
}
