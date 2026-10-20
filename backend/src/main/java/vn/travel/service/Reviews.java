package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.GuideAvailability;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.ReviewSchema;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

/** Review (R5): đọc = seed công khai + review thật; ghi = chỉ khách ĐÃ ĐI XONG tour, không trùng, validate bằng ReviewSchema. */
@Service
public class Reviews {
    private final Db db;
    private final PublicData data;
    private final Stats stats;
    private final Accounts accounts;
    private final Clock clock;
    private final boolean hideSample;

    public Reviews(Db db, PublicData data, Stats stats, Accounts accounts, Clock clock) {
        this.db = db;
        this.data = data;
        this.stats = stats;
        this.accounts = accounts;
        this.clock = clock;
        this.hideSample = "1".equals(System.getenv("HIDE_SAMPLE_REVIEWS"));
    }

    private List<Map<String, Object>> visible() {
        List<Map<String, Object>> all = new ArrayList<>();
        if (!hideSample) for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
            Map<String, Object> r = Maps.map(o);
            if (r != null) { Map<String, Object> c = new LinkedHashMap<>(r); c.put("sample", true); all.add(c); }
        }
        all.addAll(db.list("reviews"));
        return all;
    }

    /** GET /api/reviews[?tourId=] */
    public Map<String, Object> read(String tourId) {
        List<Map<String, Object>> pub = new ArrayList<>();
        for (Map<String, Object> r : visible()) if (tourId == null || tourId.isEmpty() || Maps.str(r, "tourId").equals(tourId)) pub.add(ReviewSchema.toPublic(r));
        pub.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("reviews", pub);
        out.put("count", pub.size());
        double avg = ReviewSchema.average(pub);
        out.put("average", avg);
        Map<String, Object> st = tourId == null || tourId.isEmpty() ? null : stats.of(tourId);
        out.put("total", st == null ? pub.size() : Math.max(Maps.lng(st, "reviews"), pub.size()));
        out.put("rating", st == null || Maps.lng(st, "reviews") == 0 ? avg : st.get("rating"));
        out.put("used", st == null ? 0 : st.get("used"));
        out.put("rank", st == null ? 0 : st.get("rank"));
        out.put("distribution", ReviewSchema.distribution(pub));
        out.put("criteriaAverages", ReviewSchema.criteriaAverages(pub));
        return out;
    }

    /** Đã đi xong = ngày kết thúc < hôm nay (giờ VN), đơn không hủy. */
    private boolean completed(String uid, String tourId) {
        LocalDate today = Times.todayVN(clock.millis());
        for (Map<String, Object> b : db.list("bookings")) {
            if (!uid.equals(Maps.str(b, "userId")) || !tourId.equals(Maps.str(b, "tourId")) || "cancelled".equals(b.get("status"))) continue;
            List<String> days = GuideAvailability.rangeDays(b.get("date"), Math.max(1, Guides.tourDays(b)));
            if (days.isEmpty()) continue;
            if (LocalDate.parse(days.get(days.size() - 1)).isBefore(today)) return true;
        }
        return false;
    }

    public Map<String, Object> eligible(Map<String, Object> user, String tourId) {
        if (tourId == null || tourId.isEmpty()) throw HttpError.bad("Thiếu tourId");
        boolean admin = accounts.isAdmin(user);
        if (!admin && !completed(Maps.str(user, "id"), tourId))
            return Maps.of("ok", true, "eligible", false, "reason", "Chỉ khách đã hoàn thành tour mới viết được đánh giá.");
        boolean dup = db.list("reviews").stream().anyMatch(r -> Maps.str(r, "userId").equals(Maps.str(user, "id")) && Maps.str(r, "tourId").equals(tourId));
        if (dup && !admin) return Maps.of("ok", true, "eligible", false, "duplicate", true, "reason", "Bạn đã đánh giá tour này rồi.");
        return Maps.of("ok", true, "eligible", true);
    }

    public Map<String, Object> create(Map<String, Object> user, Map<String, Object> in) {
        String tourId = Maps.str(in, "tourId");
        ReviewSchema.Check c = ReviewSchema.validateInput(in);
        if (!c.ok()) throw HttpError.bad(c.msg(), c.field());
        Map<String, Object> el = eligible(user, tourId);
        if (!Boolean.TRUE.equals(el.get("eligible"))) throw new HttpError(Boolean.TRUE.equals(el.get("duplicate")) ? 409 : 403, Maps.str(el, "reason"));
        boolean admin = accounts.isAdmin(user);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", Ids.newId("rv"));
        r.put("tourId", tourId);
        r.put("userId", Maps.str(user, "id"));          // nội bộ, KHÔNG trả ra ngoài
        r.put("name", Maps.str(user, "name"));
        r.putAll(c.value());
        r.put("source", admin ? "admin" : "verified");   // do server đặt
        r.put("createdAt", Times.iso(clock.millis()));
        db.edit("reviews", all -> {
            if (!admin && all.stream().anyMatch(x -> Maps.str(x, "userId").equals(Maps.str(user, "id")) && Maps.str(x, "tourId").equals(tourId)))
                throw new HttpError(409, "Bạn đã đánh giá tour này rồi.");
            all.add(r);
        });
        return ReviewSchema.toPublic(r);
    }
}
