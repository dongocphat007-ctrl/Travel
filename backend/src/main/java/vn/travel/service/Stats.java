package vn.travel.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import vn.travel.store.Db;
import vn.travel.util.Maps;

/**
 * Số liệu tổng hợp theo tour (A4): lượt dùng = số liệu mẫu khởi điểm (data/tour-stats.json) + đơn THẬT không hủy.
 * Chỉ trả số, không lộ thông tin khách. Lượt đánh giá luôn nhỏ hơn lượt dùng.
 */
@Service
public class Stats {
    public static final int TOP_N = 10;
    private final Db db;
    private final PublicData data;

    private final boolean sampleData;

    @org.springframework.beans.factory.annotation.Autowired
    public Stats(Db db, PublicData data, vn.travel.config.TravelProperties props) {
        this(db, data, props.showSample());
    }

    public Stats(Db db, PublicData data, boolean sampleData) {
        this.db = db;
        this.data = data;
        this.sampleData = sampleData;
    }

    /** Mọi tour có số liệu, đã xếp hạng (rank 1..n). */
    public List<Map<String, Object>> ranking() {
        Map<String, double[]> rows = new LinkedHashMap<>();   // tourId → {used, reviews, ratingSum*weight, ratingWeight}
        for (Object o : sampleData ? Maps.list(data.obj("tour-stats.json").get("tours")) : List.<Object>of()) {   // số liệu mẫu chỉ khi SAMPLE_DATA=true
            Map<String, Object> t = Maps.map(o);
            if (t == null) continue;
            double rev = Maps.lng(t, "reviews");
            rows.put(Maps.str(t, "tourId"), new double[]{Maps.lng(t, "used"), rev, Double.parseDouble(String.valueOf(t.getOrDefault("rating", 0))) * rev, rev});
        }
        for (Map<String, Object> b : db.list("bookings")) {
            if (vn.travel.util.Flow.inactive(b.get("status")) || Maps.str(b, "tourId").isEmpty()) continue;   // đơn vé máy bay / khách sạn (kind) không tính vào xếp hạng tour
            rows.computeIfAbsent(Maps.str(b, "tourId"), k -> new double[4])[0]++;
        }
        Map<String, Object> hidden = Maps.map(db.obj("reviewmod").get("hidden"));
        for (Map<String, Object> r : db.list("reviews")) {
            if (hidden != null && hidden.containsKey(Maps.str(r, "id"))) continue;   // 7.4/7.6: đánh giá bị ẩn không tính điểm
            String targetType = Maps.str(r, "targetType");
            if ((!targetType.isEmpty() && !"tour".equals(targetType))
                    || !"verified".equals(Maps.str(r, "source"))
                    || Maps.str(r, "bookingId").isEmpty()
                    || vn.travel.util.ReviewSchema.toRating(r.get("rating")) < 1) continue;
            if (Maps.str(r, "tourId").isEmpty()) continue;
            double[] row = rows.computeIfAbsent(Maps.str(r, "tourId"), k -> new double[4]);
            row[1]++;
            row[2] += Maps.lng(r, "rating");
            row[3]++;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        rows.forEach((id, v) -> {
            long used = (long) v[0];
            long reviews = Math.min((long) v[1], Math.max(0, used));   // 7.4: lượt dùng luôn ≥ lượt đánh giá
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

    /** 7.5: tour được CONTENT ghim (đúng thứ tự ghim). */
    public List<String> pins() {
        List<String> out = new ArrayList<>();
        for (Object o : Maps.list(db.obj("featuredpin").get("pinned"))) out.add(String.valueOf(o));
        return out;
    }

    public void setPin(String tourId, boolean pinned) {
        db.editObj("featuredpin", m -> {
            List<Object> l = new ArrayList<>(Maps.list(m.get("pinned")));
            l.remove(tourId);
            if (pinned) l.add(tourId);
            m.put("pinned", l);
        });
    }

    /** Tối đa TOP_N tour, bỏ tour 0 lượt; tour đã ghim luôn đứng đầu (cờ pinned), còn lại xếp theo số liệu mới. */
    public List<Map<String, Object>> featured() {
        List<Map<String, Object>> rank = ranking(), out = new ArrayList<>();
        for (String id : pins()) for (Map<String, Object> r : rank) if (Maps.str(r, "tourId").equals(id)) { Map<String, Object> c = new LinkedHashMap<>(r); c.put("pinned", true); out.add(c); }
        for (Map<String, Object> r : rank) {
            if (out.size() >= TOP_N) break;
            if (Maps.lng(r, "used") <= 0 || pins().contains(Maps.str(r, "tourId"))) continue;
            out.add(r);
        }
        return out.size() > TOP_N ? out.subList(0, TOP_N) : out;
    }

    public Map<String, Object> of(String tourId) {
        for (Map<String, Object> r : ranking()) if (Maps.str(r, "tourId").equals(tourId)) return r;
        return null;
    }
}
