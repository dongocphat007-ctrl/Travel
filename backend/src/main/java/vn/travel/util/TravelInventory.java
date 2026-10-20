package vn.travel.util;

import java.text.Normalizer;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tìm kiếm + TÍNH GIÁ chuyến bay / khách sạn (thuần Java, không phụ thuộc Spring để test được).
 * Giá luôn do server tính từ danh mục (flights/hotels); client chỉ gửi mã chuyến bay / khách sạn, ngày, số khách.
 */
public final class TravelInventory {
    private TravelInventory() { }

    public static final Map<String, Double> CABIN = Map.of("economy", 1.0, "premium", 1.5, "business", 3.0, "first", 5.0);
    public static final Map<String, String> CABIN_LABEL = Map.of("economy", "Phổ thông", "premium", "Phổ thông ĐB", "business", "Thương gia", "first", "Hạng nhất");
    public static final int MAX_PAX = 9, MAX_NIGHTS = 30;
    private static final Pattern IATA = Pattern.compile("\\(([A-Za-z]{3})\\)");

    // ───────── tiện ích ─────────
    /** Bỏ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng: "Đà Nẵng" → "da nang". */
    public static String norm(String s) {
        if (s == null) return "";
        String t = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D');
        return t.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    public static LocalDate date(String s) {
        try { return s == null || s.isBlank() ? null : LocalDate.parse(s.trim()); } catch (DateTimeParseException e) { return null; }
    }

    public static int intIn(Object v, int def, int min, int max) {
        int n = (int) Pricing.num(v);
        if (v == null || String.valueOf(v).isBlank()) n = def;
        return Math.max(min, Math.min(max, n));
    }

    public static String cabin(Object v) {
        String c = v == null ? "economy" : String.valueOf(v).toLowerCase(Locale.ROOT);
        return CABIN.containsKey(c) ? c : "economy";
    }

    private static long round1000(double v) { return Math.round(v / 1000.0) * 1000L; }

    // ───────── chuyến bay ─────────
    /** "Hà Nội (HAN)", "HAN", "ha noi", "đà nẵng" → mã sân bay; không khớp → null. */
    public static String airportCode(List<Map<String, Object>> airports, String q) {
        if (q == null || q.isBlank()) return null;
        Matcher m = IATA.matcher(q);
        String code = m.find() ? m.group(1).toUpperCase(Locale.ROOT) : q.trim().toUpperCase(Locale.ROOT);
        for (Map<String, Object> a : airports) if (code.equals(Maps.str(a, "code"))) return code;
        String n = norm(q.replaceAll("\\([^)]*\\)", ""));
        if (n.isEmpty()) return null;
        for (Map<String, Object> a : airports) if (norm(Maps.str(a, "city")).equals(n)) return Maps.str(a, "code");
        for (Map<String, Object> a : airports) {
            String c = norm(Maps.str(a, "city")), nm = norm(Maps.str(a, "name"));
            if (c.contains(n) || n.contains(c) || nm.contains(n)) return Maps.str(a, "code");
        }
        return null;
    }

    /** Hệ số theo ngày bay: bay sát ngày +15% (≤7 ngày), cuối tuần (T6/CN) +8%, đặt sớm ≥30 ngày −5%. */
    public static double demand(LocalDate flight, LocalDate today) {
        long ahead = ChronoUnit.DAYS.between(today, flight);
        double f = 1.0;
        if (ahead <= 7) f *= 1.15; else if (ahead >= 30) f *= 0.95;
        DayOfWeek d = flight.getDayOfWeek();
        if (d == DayOfWeek.FRIDAY || d == DayOfWeek.SUNDAY) f *= 1.08;
        return f;
    }

    public static long farePerPax(Map<String, Object> flight, String cabin, LocalDate date, LocalDate today) {
        return round1000(Pricing.num(flight.get("baseFare")) * CABIN.getOrDefault(cabin, 1.0) * demand(date, today));
    }

    private static Map<String, Object> airport(List<Map<String, Object>> airports, String code) {
        for (Map<String, Object> a : airports) if (Maps.str(a, "code").equals(code)) return a;
        return Maps.of("code", code, "city", code, "utcOffset", 7L);
    }

    public static String hhmm(long minutes) {
        long m = Math.floorMod(minutes, 1440L);
        return String.format("%02d:%02d", m / 60, m % 60);
    }

    /** Một chuyến cụ thể (đã định giá) cho ngày/cabin/số khách; null nếu chuyến không bay ngày đó. */
    public static Map<String, Object> flightOffer(List<Map<String, Object>> airports, Map<String, Object> f, LocalDate date, int pax, String cabin, LocalDate today) {
        int dow = date.getDayOfWeek().getValue();
        List<Object> days = Maps.list(f.get("days"));
        if (!days.isEmpty() && days.stream().noneMatch(x -> (int) Pricing.num(x) == dow)) return null;
        String[] hm = Maps.str(f, "depart").split(":");
        if (hm.length != 2) return null;
        long dep = Long.parseLong(hm[0].trim()) * 60 + Long.parseLong(hm[1].trim());
        long dur = Maps.lng(f, "durationMins");
        Map<String, Object> a = airport(airports, Maps.str(f, "from")), b = airport(airports, Maps.str(f, "to"));
        long arrTotal = dep + dur + (Maps.lng(b, "utcOffset") - Maps.lng(a, "utcOffset")) * 60;
        long fare = farePerPax(f, cabin, date, today);
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("id", f.get("id"));
        o.put("airline", f.get("airline")); o.put("code", f.get("code")); o.put("color", f.get("color")); o.put("flightNo", f.get("flightNo"));
        o.put("from", f.get("from")); o.put("to", f.get("to")); o.put("fromCity", a.get("city")); o.put("toCity", b.get("city"));
        o.put("date", date.toString()); o.put("depart", hhmm(dep)); o.put("arrive", hhmm(arrTotal));
        o.put("arriveDayOffset", Math.floorDiv(arrTotal, 1440L));
        o.put("durationMins", dur); o.put("duration", (dur / 60) + "g " + (dur % 60) + "p");
        o.put("stops", f.get("stops") == null ? 0 : f.get("stops"));
        o.put("cabin", cabin); o.put("cabinLabel", CABIN_LABEL.get(cabin));
        o.put("baggage", f.get("baggage")); o.put("refundable", Maps.bool(f, "refundable"));
        o.put("pax", pax); o.put("farePerPax", fare); o.put("price", fare * pax);
        return o;
    }

    public static List<Map<String, Object>> searchFlights(List<Map<String, Object>> airports, List<Map<String, Object>> flights,
                                                           String from, String to, LocalDate date, int pax, String cabin, LocalDate today) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> f : flights) {
            if (!Maps.str(f, "from").equals(from) || !Maps.str(f, "to").equals(to)) continue;
            Map<String, Object> o = flightOffer(airports, f, date, pax, cabin, today);
            if (o != null) out.add(o);
        }
        out.sort(Comparator.comparingLong((Map<String, Object> m) -> Maps.lng(m, "price")).thenComparing(m -> Maps.str(m, "depart")));
        return out;
    }

    // ───────── khách sạn ─────────
    public static boolean matchesDest(Map<String, Object> h, String destNorm) {
        if (destNorm.isEmpty()) return true;
        return norm(Maps.str(h, "city")).contains(destNorm) || destNorm.contains(norm(Maps.str(h, "city")))
                || norm(Maps.str(h, "name")).contains(destNorm) || norm(Maps.str(h, "address")).contains(destNorm);
    }

    /** Giá 1 phòng/đêm theo ngày: đêm T6, T7 +15%. */
    public static long nightRate(long base, LocalDate night) {
        DayOfWeek d = night.getDayOfWeek();
        return round1000(base * ((d == DayOfWeek.FRIDAY || d == DayOfWeek.SATURDAY) ? 1.15 : 1.0));
    }

    /** Báo giá 1 loại phòng; null nếu loại phòng không tồn tại. Số phòng = ceil(khách / sức chứa), có thể ép bằng rooms>0. */
    public static Map<String, Object> roomQuote(Map<String, Object> hotel, String roomType, LocalDate in, LocalDate out, int guests, int rooms) {
        Map<String, Object> room = null;
        for (Object r : Maps.list(hotel.get("rooms"))) { Map<String, Object> m = Maps.map(r); if (m != null && Maps.str(m, "type").equalsIgnoreCase(roomType)) room = m; }
        if (room == null) return null;
        int cap = Math.max(1, (int) Maps.lng(room, "capacity"));
        int need = Math.max(rooms, (int) Math.ceil(guests / (double) cap));
        long perRoom = 0;
        for (LocalDate d = in; d.isBefore(out); d = d.plusDays(1)) perRoom += nightRate(Maps.lng(room, "rate"), d);
        long nights = ChronoUnit.DAYS.between(in, out);
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("type", room.get("type")); q.put("capacity", cap); q.put("rate", room.get("rate"));
        q.put("rooms", need); q.put("nights", nights); q.put("avgNight", Math.round(perRoom / (double) nights));
        q.put("total", perRoom * need);
        return q;
    }

    public static List<Map<String, Object>> searchHotels(List<Map<String, Object>> hotels, String dest, LocalDate in, LocalDate out, int guests, int minStars) {
        String dn = norm(dest);
        List<Map<String, Object>> res = new ArrayList<>();
        for (Map<String, Object> h : hotels) {
            if (!matchesDest(h, dn) || Maps.lng(h, "stars") < minStars) continue;
            List<Map<String, Object>> quotes = new ArrayList<>();
            for (Object r : Maps.list(h.get("rooms"))) {
                Map<String, Object> rm = Maps.map(r);
                Map<String, Object> q = rm == null ? null : roomQuote(h, Maps.str(rm, "type"), in, out, guests, 0);
                if (q != null) quotes.add(q);
            }
            if (quotes.isEmpty()) continue;
            quotes.sort(Comparator.comparingLong(q -> Maps.lng(q, "total")));
            Map<String, Object> o = new LinkedHashMap<>();
            for (String k : List.of("id", "name", "city", "address", "stars", "kind", "rating", "reviews", "distCenter", "amenities", "refundable")) o.put(k, h.get(k));
            o.put("nights", ChronoUnit.DAYS.between(in, out)); o.put("guests", guests);
            o.put("rooms", quotes); o.put("fromTotal", quotes.get(0).get("total"));
            res.add(o);
        }
        res.sort(Comparator.comparingLong((Map<String, Object> m) -> Maps.lng(m, "fromTotal")));
        return res;
    }
}
