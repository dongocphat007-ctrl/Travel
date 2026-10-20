package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Maps;

import java.util.*;

/**
 * Số liệu tổng hợp theo tour (A4): lượt dùng = số liệu mẫu khởi điểm (data/tour-stats.json) + đơn THẬT không hủy.
 * Chỉ trả số, không lộ thông tin khách. Lượt đánh giá luôn nhỏ hơn lượt dùng.
 */
@Service
public class Stats {
    public static final int TOP_N = 10;
    private final Db db;
    private final PublicData data;

    public Stats(Db db, PublicData data) {
        this.db = db;
        this.data = data;
    }

    /** Mọi tour có số liệu, đã xếp hạng (rank 1..n). */
    public List<Map<String, Object>> ranking() {
        Map<String, double[]> rows = new LinkedHashMap<>();   // tourId → {used, reviews, ratingSum*weight, ratingWeight}
        for (Object o : Maps.list(data.obj("tour-stats.json").get("tours"))) {
            Map<String, Object> t = Maps.map(o);
            if (t == null) continue;
            double rev = Maps.lng(t, "reviews");
            rows.put(Maps.str(t, "tourId"), new double[]{Maps.lng(t, "used"), rev, Double.parseDouble(String.valueOf(t.getOrDefault("rating", 0))) * rev, rev});
        }
        for (Map<String, Object> b : db.list("bookings")) {
            if ("cancelled".equals(b.get("status")) || Maps.str(b, "tourId").isEmpty()) continue;   // đơn vé máy bay / khách sạn (kind) không tính vào xếp hạng tour
            rows.computeIfAbsent(Maps.str(b, "tourId"), k -> new double[4])[0]++;
        }
        for (Map<String, Object> r : db.list("reviews")) {
            double[] row = rows.computeIfAbsent(Maps.str(r, "tourId"), k -> new double[4]);
            row[1]++;
            row[2] += Maps.lng(r, "rating");
            row[3]++;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        rows.forEach((id, v) -> {
            long used = (long) v[0];
            long reviews = Math.min((long) v[1], Math.max(0, used - 1));
            double rating = v[3] > 0 ? Math.floor(v[2] / v[3] * 10 + 0.5) / 10 : 0;
            out.add(Maps.of("tourId", id, "count", used, "used", used, "reviews", reviews, "rating", rating));
        });
        out.sort((a, b) -> {
            int c = Long.compare(Maps.lng(b, "used"), Maps.lng(a, "used"));
            return c != 0 ? c : Long.compare(Maps.lng(b, "reviews"), Maps.lng(a, "reviews"));
        });
        for (int i = 0; i < out.size(); i++) out.get(i).put("rank", i + 1);
        return out;
    }

    /** Tối đa TOP_N tour, bỏ tour 0 lượt. */
    public List<Map<String, Object>> featured() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : ranking()) {
            if (Maps.lng(r, "used") <= 0) continue;
            out.add(r);
            if (out.size() >= TOP_N) break;
        }
        return out;
    }

    public Map<String, Object> of(String tourId) {
        for (Map<String, Object> r : ranking()) if (Maps.str(r, "tourId").equals(tourId)) return r;
        return null;
    }
}
