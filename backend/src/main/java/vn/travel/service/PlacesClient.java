package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.LiveTravelConfig;
import vn.travel.util.HotelSources;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Khách sạn (danh sách, ảnh, đánh giá, toạ độ): Google Places API (New). Khóa chỉ ở máy chủ; ảnh đi qua /api/places/photo. */
@Service
public class PlacesClient {
    static final Pattern PHOTO_NAME = Pattern.compile("^places/[A-Za-z0-9_-]{1,200}/photos/[A-Za-z0-9_-]{1,600}$");
    private static final String FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.photos";
    private final LiveTravelConfig cfg;
    private final LiveHttp http;

    public PlacesClient(LiveTravelConfig cfg, LiveHttp http) {
        this.cfg = cfg;
        this.http = http;
    }

    public boolean enabled() { return cfg.placesEnabled(); }

    /** POST places:searchText, tối đa 20 kết quả loại lodging. */
    public List<Map<String, Object>> searchHotels(String dest) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("textQuery", "khách sạn ở " + dest);
        body.put("includedType", "lodging");
        body.put("languageCode", "vi");
        body.put("regionCode", "VN");
        body.put("pageSize", 20);
        Object r = http.json("POST", "https://places.googleapis.com/v1/places:searchText",
                Map.of("X-Goog-Api-Key", cfg.placesKey(), "X-Goog-FieldMask", FIELDS), body, 15);
        return HotelSources.parsePlaces(vn.travel.util.Maps.map(r));
    }

    public static boolean validPhotoName(String name) { return name != null && PHOTO_NAME.matcher(name).matches(); }

    /** Tải ảnh qua máy chủ để không lộ khóa. name phải đúng dạng places/ID/photos/REF. */
    public LiveHttp.Bytes photo(String name, int width) {
        if (!validPhotoName(name)) throw new LiveException(400, "Ảnh không hợp lệ");
        int w = Math.min(1200, Math.max(200, width));
        return http.bytes("https://places.googleapis.com/v1/" + name + "/media?maxWidthPx=" + w, Map.of("X-Goog-Api-Key", cfg.placesKey()), 15);
    }
}
