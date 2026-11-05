package vn.travel.util;

import java.text.Normalizer;
import java.util.*;

/**
 * Ghép khách sạn từ hai nguồn (Google Places ↔ Travelpayouts/Hotellook) theo TÊN + TOẠ ĐỘ.
 * Mỗi mục ở nguồn giá chỉ được gán cho tối đa một khách sạn; ưu tiên cặp có điểm cao nhất.
 */
public final class HotelMatcher {
    private HotelMatcher() { }

    public record Point(String name, double lat, double lng) {
        public boolean hasGeo() { return !Double.isNaN(lat) && !Double.isNaN(lng) && !(lat == 0 && lng == 0); }
    }

    /** a = chỉ số bên Places, b = chỉ số bên giá. */
    public record Match(int a, int b, double score) { }

    private static final Set<String> STOP = Set.of("hotel", "hotels", "khach", "san", "resort", "spa", "the", "by", "and", "va", "nha", "nghi",
            "homestay", "villa", "apartment", "boutique", "inn", "lodge", "suites", "suite", "residence", "residences", "at", "of");

    public static List<String> tokens(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('đ', 'd').replace('Đ', 'd').toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
        List<String> all = n.isEmpty() ? List.of() : Arrays.asList(n.split(" "));
        List<String> keep = new ArrayList<>();
        for (String t : all) if (!STOP.contains(t)) keep.add(t);
        return keep.isEmpty() ? all : keep;
    }

    public static double nameSimilarity(String x, String y) {
        Set<String> a = new LinkedHashSet<>(tokens(x)), b = new LinkedHashSet<>(tokens(y));
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        if (inter.isEmpty()) return 0;
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        double jaccard = (double) inter.size() / union.size();
        double contain = (double) inter.size() / Math.min(a.size(), b.size());
        return Math.max(jaccard, contain * 0.85);
    }

    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double r = 6_371_000, p1 = Math.toRadians(lat1), p2 = Math.toRadians(lat2);
        double dp = p2 - p1, dl = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    /** Điểm ghép (0 = không khớp). Gần + giống tên → cao; chỉ tên rất giống thì cần cách nhau ≤ 1,5 km. */
    static double score(Point p, Point q) {
        double sim = nameSimilarity(p.name(), q.name());
        if (p.hasGeo() && q.hasGeo()) {
            double d = distanceMeters(p.lat(), p.lng(), q.lat(), q.lng());
            boolean ok = (d <= 300 && sim >= 0.34) || (d <= 100 && sim >= 0.15) || (d <= 1500 && sim >= 0.8);
            return ok ? sim + Math.max(0, 1 - d / 1000.0) * 0.5 : 0;
        }
        return sim >= 0.8 ? sim : 0;
    }

    public static List<Match> match(List<Point> places, List<Point> prices) {
        List<Match> cand = new ArrayList<>();
        for (int i = 0; i < places.size(); i++)
            for (int j = 0; j < prices.size(); j++) {
                double s = score(places.get(i), prices.get(j));
                if (s > 0) cand.add(new Match(i, j, s));
            }
        cand.sort((x, y) -> Double.compare(y.score(), x.score()));
        Set<Integer> usedA = new HashSet<>(), usedB = new HashSet<>();
        List<Match> out = new ArrayList<>();
        for (Match m : cand) {
            if (usedA.contains(m.a()) || usedB.contains(m.b())) continue;
            usedA.add(m.a());
            usedB.add(m.b());
            out.add(m);
        }
        return out;
    }
}
