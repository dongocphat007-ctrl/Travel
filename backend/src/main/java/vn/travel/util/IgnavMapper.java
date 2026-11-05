package vn.travel.util;

import java.time.LocalDate;
import java.util.*;
import java.util.function.UnaryOperator;

/** Chuyển JSON của Ignav sang đúng dạng mà giao diện đã dùng (cùng khóa với danh mục có sẵn). Thuần hàm, không gọi mạng. */
public final class IgnavMapper {
    private IgnavMapper() { }

    public static String ignavCabin(String cabinKey) {
        return switch (cabinKey == null ? "" : cabinKey) {
            case "premium" -> "premium_economy";
            case "business" -> "business";
            case "first" -> "first";
            default -> "economy";
        };
    }

    public static String hm(String iso) { return iso != null && iso.length() >= 16 ? iso.substring(11, 16) : ""; }

    public static String duration(long minutes) {
        return minutes <= 0 ? "" : (minutes / 60) + "g " + String.format("%02d", minutes % 60) + "p";
    }

    /** Màu cố định theo mã hãng để logo ổn định giữa các lần tìm. */
    public static String color(String code) {
        int h = Math.floorMod((code == null ? "" : code).hashCode() * 37, 360);
        double s = 0.55, l = 0.38, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60.0) % 2 - 1)), m = l - c / 2;
        double[] rgb = switch (h / 60) { case 0 -> new double[]{c, x, 0}; case 1 -> new double[]{x, c, 0}; case 2 -> new double[]{0, c, x};
            case 3 -> new double[]{0, x, c}; case 4 -> new double[]{x, 0, c}; default -> new double[]{c, 0, x}; };
        return String.format("#%02x%02x%02x", Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255));
    }

    static String baggage(Map<String, Object> bags) {
        if (bags == null) return "Chưa rõ hành lý";
        long carry = Maps.lng(bags, "carry_on"), checked = Maps.lng(bags, "checked");
        return "Xách tay " + carry + " · Ký gửi " + checked;
    }

    public static List<Map<String, Object>> flights(Map<String, Object> resp, String date, int pax, String cabinKey, UnaryOperator<String> cityOf, int limit) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (resp == null) return out;
        for (Object o : Maps.list(resp.get("itineraries"))) {
            Map<String, Object> it = Maps.map(o), price = it == null ? null : Maps.map(it.get("price")), ob = it == null ? null : Maps.map(it.get("outbound"));
            if (price == null || ob == null) continue;
            double amount = Pricing.num(price.get("amount"));
            String id = Maps.str(it, "ignav_id");
            if (amount <= 0 || "unverified".equals(Maps.str(price, "status")) || id.isEmpty()) continue;
            List<Object> segs = Maps.list(ob.get("segments"));
            Map<String, Object> first = segs.isEmpty() ? null : Maps.map(segs.get(0)), last = segs.isEmpty() ? null : Maps.map(segs.get(segs.size() - 1));
            if (first == null || last == null) continue;
            String code = Maps.str(first, "marketing_carrier_code"), dep = Maps.str(first, "departure_time_local"), arr = Maps.str(last, "arrival_time_local");
            String from = Maps.str(first, "departure_airport"), to = Maps.str(last, "arrival_airport");
            int offset = 0;
            try { offset = (int) (LocalDate.parse(arr.substring(0, 10)).toEpochDay() - LocalDate.parse(dep.substring(0, 10)).toEpochDay()); } catch (RuntimeException ignored) { }
            String airline = Maps.str(ob, "carrier").isEmpty() ? Maps.str(first, "operating_carrier_name") : Maps.str(ob, "carrier");
            String flightNo = (code + Maps.str(first, "flight_number")) + (segs.size() > 1 ? " +" + (segs.size() - 1) : "");
            Map<String, Object> f = new LinkedHashMap<>();
            f.put("id", id);
            f.put("live", true);
            f.put("source", "ignav");
            f.put("airline", airline.isEmpty() ? code : airline);
            f.put("code", code);
            f.put("color", color(code));
            f.put("flightNo", flightNo);
            f.put("from", from);
            f.put("to", to);
            f.put("fromCity", cityOf.apply(from));
            f.put("toCity", cityOf.apply(to));
            f.put("date", date);
            f.put("depart", hm(dep));
            f.put("arrive", hm(arr));
            f.put("arriveDayOffset", Math.max(0, offset));
            f.put("duration", duration(Maps.lng(ob, "duration_minutes")));
            f.put("stops", segs.size() - 1);
            f.put("price", Math.round(amount * 100) / 100.0);
            f.put("currency", Maps.str(price, "currency").isEmpty() ? "USD" : Maps.str(price, "currency"));
            f.put("farePerPax", Math.round(amount / Math.max(1, pax) * 100) / 100.0);
            f.put("pax", pax);
            f.put("cabin", cabinKey);
            f.put("cabinLabel", TravelInventory.CABIN_LABEL.getOrDefault(cabinKey, "Phổ thông"));
            f.put("baggage", baggage(Maps.map(it.get("bags"))));
            f.put("selfTransfer", Maps.bool(it, "requires_self_transfer"));
            out.add(f);
        }
        out.sort(Comparator.comparingDouble(m -> Pricing.num(m.get("price"))));
        return out.size() > limit ? new ArrayList<>(out.subList(0, limit)) : out;
    }

    /** Chỉ nhận http/https; thêm https:// nếu Ignav trả URL không có scheme. Trả null nếu không an toàn. */
    public static String safeUrl(String u) {
        if (u == null) return null;
        String s = u.trim();
        if (s.isEmpty() || s.matches(".*[\\s<>\"'\\\\].*")) return null;
        String low = s.toLowerCase(Locale.ROOT);
        if (low.startsWith("https://") || low.startsWith("http://")) return s;
        if (low.contains("://") || low.startsWith("javascript:") || low.startsWith("data:") || low.startsWith("//")) return null;
        return "https://" + s;
    }

    public static List<Map<String, Object>> links(Map<String, Object> resp) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (resp == null) return out;
        for (Object o : Maps.list(resp.get("booking_options"))) {
            Map<String, Object> opt = Maps.map(o);
            if (opt == null) continue;
            for (Object l : Maps.list(opt.get("links"))) {
                Map<String, Object> link = Maps.map(l);
                String url = link == null ? null : safeUrl(Maps.str(link, "url"));
                if (url == null) continue;
                Map<String, Object> price = Maps.map(link.get("price"));
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("provider", Maps.str(link, "provider_name"));
                r.put("type", Maps.str(link, "provider_type"));
                r.put("fare", Maps.str(link, "fare_name"));
                r.put("specificity", Maps.str(link, "specificity"));
                r.put("legs", opt.get("legs") != null ? opt.get("legs") : opt.get("leg_indexes"));
                if (price != null && Pricing.num(price.get("amount")) > 0) { r.put("price", Pricing.num(price.get("amount"))); r.put("currency", Maps.str(price, "currency")); }
                r.put("url", url);
                out.add(r);
            }
        }
        out.sort(Comparator.<Map<String, Object>>comparingInt(m -> "airline".equals(m.get("type")) ? 0 : 1)
                .thenComparingDouble(m -> m.get("price") == null ? Double.MAX_VALUE : Pricing.num(m.get("price"))));
        return out;
    }
}
