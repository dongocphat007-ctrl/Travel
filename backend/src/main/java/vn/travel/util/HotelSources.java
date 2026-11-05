package vn.travel.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Đọc JSON của Google Places (New) và Travelpayouts/Hotellook, rồi ghép thành danh sách khách sạn cho giao diện. Thuần hàm. */
public final class HotelSources {
    private HotelSources() { }

    public static String enc(String s) { return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8); }

    /** "Đà Nẵng" → "Da Nang" (Hotellook tìm theo tên không dấu). */
    public static String ascii(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D').trim();
    }

    private static double dbl(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        try { return v == null ? Double.NaN : Double.parseDouble(String.valueOf(v)); } catch (NumberFormatException e) { return Double.NaN; }
    }

    // ───────── Google Places (New): places:searchText ─────────
    public static List<Map<String, Object>> parsePlaces(Map<String, Object> resp) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (resp == null) return out;
        for (Object o : Maps.list(resp.get("places"))) {
            Map<String, Object> p = Maps.map(o);
            if (p == null || Maps.str(p, "id").isEmpty()) continue;
            Map<String, Object> dn = Maps.map(p.get("displayName")), loc = Maps.map(p.get("location"));
            String name = dn == null ? "" : Maps.str(dn, "text");
            if (name.isEmpty()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("placeId", Maps.str(p, "id"));
            m.put("name", name);
            m.put("address", Maps.str(p, "formattedAddress"));
            m.put("lat", loc == null ? Double.NaN : dbl(loc.get("latitude")));
            m.put("lng", loc == null ? Double.NaN : dbl(loc.get("longitude")));
            m.put("rating", Double.isNaN(dbl(p.get("rating"))) ? 0.0 : dbl(p.get("rating")));
            m.put("reviews", Maps.lng(p, "userRatingCount"));
            m.put("mapsUri", Maps.str(p, "googleMapsUri"));
            List<Object> photos = Maps.list(p.get("photos"));
            Map<String, Object> ph = photos.isEmpty() ? null : Maps.map(photos.get(0));
            m.put("photoName", ph == null ? "" : Maps.str(ph, "name"));
            List<Object> au = ph == null ? List.of() : Maps.list(ph.get("authorAttributions"));
            m.put("photoAuthor", au.isEmpty() || Maps.map(au.get(0)) == null ? "" : Maps.str(Maps.map(au.get(0)), "displayName"));
            out.add(m);
        }
        return out;
    }

    // ───────── Travelpayouts / Hotellook cache.json ─────────
    public static List<Map<String, Object>> parsePrices(Object resp) {
        List<Map<String, Object>> out = new ArrayList<>();
        List<Object> list = resp instanceof List<?> ? Maps.list(resp) : Maps.map(resp) == null ? List.of()
                : Maps.list(Maps.map(resp).get("hotels") != null ? Maps.map(resp).get("hotels") : Maps.map(resp).get("data"));
        for (Object o : list) {
            Map<String, Object> h = Maps.map(o);
            if (h == null) continue;
            double price = dbl(h.get("priceFrom"));
            if (Double.isNaN(price) || price <= 0) price = dbl(h.get("priceAvg"));
            Map<String, Object> loc = Maps.map(h.get("location")), geo = loc == null ? null : Maps.map(loc.get("geo"));
            String name = Maps.str(h, "hotelName");
            if (name.isEmpty() || Double.isNaN(price) || price <= 0) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("hotelId", Maps.str(h, "hotelId"));
            m.put("name", name);
            m.put("stars", (int) Maps.lng(h, "stars"));
            m.put("lat", geo == null ? Double.NaN : dbl(geo.get("lat")));
            m.put("lng", geo == null ? Double.NaN : dbl(geo.get("lon") != null ? geo.get("lon") : geo.get("lng")));
            m.put("price", price);
            out.add(m);
        }
        return out;
    }

    /** Thay {khóa} trong mẫu liên kết; giá trị được mã hóa URL. */
    public static String fill(String template, Map<String, String> vars) {
        String out = template;
        for (Map.Entry<String, String> e : vars.entrySet()) out = out.replace("{" + e.getKey() + "}", enc(e.getValue()));
        return out;
    }

    public static String mapsSearchUrl(String name, String address) {
        return "https://www.google.com/maps/search/?api=1&query=" + enc((name + " " + address).trim());
    }

    /**
     * Ghép Places (ảnh, đánh giá, toạ độ) với giá Travelpayouts. Giá "priceFrom" được coi là TỔNG cho cả kỳ lưu trú.
     * Nếu không có danh sách Places thì dùng thẳng danh sách có giá; nếu có Places thì mục giá không khớp sẽ bị bỏ.
     */
    public static List<Map<String, Object>> merge(List<Map<String, Object>> places, List<Map<String, Object>> prices, LocalDate in, LocalDate out,
                                                  int guests, String currency, String template, String marker, int minStars, int limit) {
        int nights = (int) Math.max(1, ChronoUnit.DAYS.between(in, out));
        List<HotelMatcher.Point> pa = new ArrayList<>(), pb = new ArrayList<>();
        for (Map<String, Object> p : places) pa.add(new HotelMatcher.Point(Maps.str(p, "name"), dbl(p.get("lat")), dbl(p.get("lng"))));
        for (Map<String, Object> p : prices) pb.add(new HotelMatcher.Point(Maps.str(p, "name"), dbl(p.get("lat")), dbl(p.get("lng"))));
        Map<Integer, Integer> pairs = new HashMap<>();
        for (HotelMatcher.Match m : HotelMatcher.match(pa, pb)) pairs.put(m.a(), m.b());

        List<Map<String, Object>> res = new ArrayList<>();
        for (int i = 0; i < places.size(); i++) {
            Map<String, Object> p = places.get(i);
            res.add(build(p, pairs.containsKey(i) ? prices.get(pairs.get(i)) : null, nights, in, out, guests, currency, template, marker));
        }
        if (places.isEmpty()) for (int j = 0; j < prices.size(); j++) res.add(build(null, prices.get(j), nights, in, out, guests, currency, template, marker));

        res.removeIf(h -> minStars > 0 && (int) Maps.lng(h, "stars") > 0 && (int) Maps.lng(h, "stars") < minStars);
        res.sort((a, b) -> {
            boolean pa1 = a.get("priceTotal") != null, pb1 = b.get("priceTotal") != null;
            if (pa1 != pb1) return pa1 ? -1 : 1;
            double sa = Pricing.num(a.get("rating")) * Math.log10(Maps.lng(a, "reviews") + 10), sb = Pricing.num(b.get("rating")) * Math.log10(Maps.lng(b, "reviews") + 10);
            return Double.compare(sb, sa);
        });
        return res.size() > limit ? new ArrayList<>(res.subList(0, limit)) : res;
    }

    private static Map<String, Object> build(Map<String, Object> place, Map<String, Object> price, int nights, LocalDate in, LocalDate out,
                                             int guests, String currency, String template, String marker) {
        Map<String, Object> h = new LinkedHashMap<>();
        String name = place != null ? Maps.str(place, "name") : Maps.str(price, "name");
        String address = place != null ? Maps.str(place, "address") : "";
        h.put("id", place != null ? "gp:" + Maps.str(place, "placeId") : "tp:" + Maps.str(price, "hotelId"));
        h.put("live", true);
        h.put("source", place != null && price != null ? "google+travelpayouts" : place != null ? "google" : "travelpayouts");
        h.put("name", name);
        h.put("address", address);
        h.put("stars", price != null ? (int) Maps.lng(price, "stars") : 0);
        h.put("kind", "Khách sạn");
        double r = place == null ? 0 : Pricing.num(place.get("rating"));
        h.put("rating", r > 0 ? Math.round(r * 20) / 10.0 : 0);          // Google /5 → thang /10 như danh mục
        h.put("reviews", place == null ? 0 : Maps.lng(place, "reviews"));
        h.put("distCenter", null);
        h.put("amenities", List.of());
        h.put("refundable", false);
        h.put("rooms", List.of());
        h.put("guests", guests);
        h.put("nights", nights);
        double lat = place != null ? dbl(place.get("lat")) : dbl(price.get("lat")), lng = place != null ? dbl(place.get("lng")) : dbl(price.get("lng"));
        if (!Double.isNaN(lat) && !Double.isNaN(lng)) { h.put("lat", lat); h.put("lng", lng); }
        String maps = place != null && !Maps.str(place, "mapsUri").isEmpty() ? Maps.str(place, "mapsUri") : mapsSearchUrl(name, address);
        h.put("mapsUrl", IgnavMapper.safeUrl(maps));
        if (place != null && !Maps.str(place, "photoName").isEmpty()) {
            h.put("photo", "/api/places/photo?name=" + enc(Maps.str(place, "photoName")));
            h.put("photoCredit", Maps.str(place, "photoAuthor"));
        }
        if (price != null) {
            double total = Pricing.num(price.get("price"));
            h.put("priceTotal", Math.round(total));
            h.put("priceNight", Math.round(total / nights));
            h.put("currency", currency.toUpperCase(Locale.ROOT));
            h.put("priceProvider", "Hotellook (so sánh giá Agoda & đối tác)");
            Map<String, String> v = new LinkedHashMap<>();
            v.put("hotelId", Maps.str(price, "hotelId"));
            v.put("checkIn", in.toString());
            v.put("checkOut", out.toString());
            v.put("guests", String.valueOf(guests));
            v.put("currency", currency);
            v.put("marker", marker);
            v.put("name", name);
            h.put("bookUrl", IgnavMapper.safeUrl(fill(template, v)));
        }
        return h;
    }
}
