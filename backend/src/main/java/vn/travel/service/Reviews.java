package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
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

/**
 * Review (R5): đọc = seed công khai + review thật; ghi = chỉ khách ĐÃ ĐI XONG
 * tour, không trùng, validate bằng ReviewSchema.
 */
@Service
public class Reviews {
    private final Db db;
    private final PublicData data;
    private final Stats stats;
    private final Accounts accounts;
    private final Clock clock;
    private final boolean hideSample;

    @org.springframework.beans.factory.annotation.Autowired
    public Reviews(Db db, PublicData data, Stats stats, Accounts accounts, Clock clock,
            vn.travel.config.TravelProperties props) {
        this(db, data, stats, accounts, clock, props.hideSampleReviewsEffective());
    }

    public Reviews(Db db, PublicData data, Stats stats, Accounts accounts, Clock clock, boolean hideSample) {
        this.db = db;
        this.data = data;
        this.stats = stats;
        this.accounts = accounts;
        this.clock = clock;
        this.hideSample = hideSample;
    }

    /**
     * Mọi review (kể cả đang bị ẩn) kèm cờ hidden — dành cho biên tập viên kiểm
     * duyệt.
     */
    public List<Map<String, Object>> moderationList() {
        Map<String, Object> hidden = Maps.map(db.obj("reviewmod").get("hidden"));
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        if (!hideSample)
            for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> r = Maps.map(o);
                if (r != null)
                    byId.put(Maps.str(r, "id"), new LinkedHashMap<>(r));
            }
        for (Map<String, Object> r : db.list("reviews"))
            byId.put(Maps.str(r, "id"), r);
        List<Map<String, Object>> all = new ArrayList<>(byId.values());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : all) {
            Map<String, Object> c = new LinkedHashMap<>();
            for (String k : List.of("id", "tourId", "tourName", "targetType", "foodName", "rating", "content", "comment", "text", "title", "author", "name",
                    "createdAt", "guideId", "bookingId", "guideRating", "guideComment", "filtered", "reply", "source", "sample", "images", "replies", "kind",
                    "category", "categoryName", "forwardedTo", "forwardedToName", "forwardedNote", "forwardedBy", "forwardedByName", "forwardedAt", "handledBy", "handledRole"))
                if (r.containsKey(k))
                    c.put(k, r.get(k));
            if (!c.containsKey("comment") && c.containsKey("content")) c.put("comment", c.get("content"));
            if (!c.containsKey("content") && c.containsKey("comment")) c.put("content", c.get("comment"));
            // Giữ thông tin nhân sự nội bộ đã xử lý (reply) để Admin / CSKH kiểm soát
            if (c.get("reply") instanceof Map<?, ?> repMap) {
                if (repMap.containsKey("byName")) c.put("handledBy", repMap.get("byName"));
                if (repMap.containsKey("byRole")) c.put("handledRole", repMap.get("byRole"));
                if (repMap.containsKey("at")) c.put("handledAt", repMap.get("at"));
            }
            Object h = hidden == null ? null : hidden.get(Maps.str(r, "id"));
            c.put("hidden", h != null);
            if (h != null)
                c.put("hiddenInfo", h);
            out.add(c);
        }
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    private List<Map<String, Object>> visible() {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        if (!hideSample)
            for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> r = Maps.map(o);
                if (r != null) {
                    Map<String, Object> c = new LinkedHashMap<>(r);
                    c.put("sample", true);
                    byId.put(Maps.str(c, "id"), c);
                }
            }
        for (Map<String, Object> r : db.list("reviews")) {
            byId.put(Maps.str(r, "id"), r);
        }
        List<Map<String, Object>> all = new ArrayList<>(byId.values());
        Map<String, Object> hidden = Maps.map(db.obj("reviewmod").get("hidden"));
        if (hidden != null && !hidden.isEmpty())
            all.removeIf(r -> hidden.containsKey(Maps.str(r, "id")));
        return all;
    }

    /** GET /api/reviews[?tourId=][&targetType=] */
    public Map<String, Object> read(String tourId) {
        return read(tourId, null);
    }

    public Map<String, Object> read(String tourId, String targetType) {
        List<Map<String, Object>> pub = new ArrayList<>();
        for (Map<String, Object> r : visible()) {
            if (targetType != null && !targetType.isEmpty()) {
                String tt = Maps.str(r, "targetType");
                if (tt.isEmpty()) tt = "tour";
                if (!targetType.equalsIgnoreCase(tt)) continue;
            }
            if (tourId != null && !tourId.isEmpty()) {
                if (!Maps.str(r, "tourId").equals(tourId)) continue;
            }
            pub.add(ReviewSchema.toPublic(r));
        }
        pub.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("reviews", pub);
        out.put("count", pub.size());
        double avg = ReviewSchema.average(pub);
        long ratedCount = pub.stream().filter(r -> ReviewSchema.toRating(r.get("rating")) > 0).count();
        out.put("average", avg);
        Map<String, Object> st = tourId == null || tourId.isEmpty() ? null : stats.of(tourId);
        out.put("total", st == null ? ratedCount : Math.max(Maps.lng(st, "reviews"), ratedCount));
        out.put("rating", st == null || Maps.lng(st, "reviews") == 0 ? avg : st.get("rating"));
        out.put("used", st == null ? 0 : st.get("used"));
        out.put("rank", st == null ? 0 : st.get("rank"));
        out.put("distribution", ReviewSchema.distribution(pub));
        out.put("criteriaAverages", ReviewSchema.criteriaAverages(pub));
        return out;
    }

    public static final int REVIEW_WINDOW_DAYS = 30;

    /** 7.6: lọc từ ngữ xấu cơ bản – che bằng ***. */
    private static final java.util.regex.Pattern BAD = java.util.regex.Pattern.compile(
            "(?<![\\p{L}\\p{N}])(đm|đ\\.m|dm|vcl|vl|đcm|dcm|cặc|cac|lồn|loz|địt|dit me|đụ|đéo|đồ ngu|thằng ngu|con chó|óc chó|đồ rác)(?![\\p{L}\\p{N}])",
            java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE);

    /** Che từ xấu; trả {text, changed}. */
    static String maskBad(String text) {
        return BAD.matcher(text).replaceAll("***");
    }

    /**
     * 7.1/7.2/17.19: đơn "completed", không no_show, trong 30 ngày sau ngày kết
     * thúc, và CHƯA được đánh giá (mỗi đơn một lần).
     */
    private List<String> qualifying(String uid, String tourId, boolean onlyUnreviewed) {
        LocalDate today = Times.todayVN(clock.millis());
        List<Map<String, Object>> mine = new ArrayList<>();
        for (Map<String, Object> r : db.list("reviews"))
            if (uid.equals(Maps.str(r, "userId")) && tourId.equals(Maps.str(r, "tourId")))
                mine.add(r);
        Set<String> reviewed = new HashSet<>();
        int legacy = 0; // đánh giá cũ chưa gắn đơn: trừ dần vào các đơn đủ điều kiện
        for (Map<String, Object> r : mine) {
            String bid = Maps.str(r, "bookingId");
            if (bid.isEmpty())
                legacy++;
            else
                reviewed.add(bid);
        }
        List<String> out = new ArrayList<>();
        for (Map<String, Object> b : db.list("bookings")) {
            if (!uid.equals(Maps.str(b, "userId")) || !tourId.equals(Maps.str(b, "tourId")))
                continue;
            if (!vn.travel.util.Flow.COMPLETED.equals(vn.travel.util.Flow.norm(b.get("status")))
                    || Maps.bool(b, "noShow"))
                continue;
            List<String> days = GuideAvailability.rangeDays(b.get("date"),
                    Math.max(1, Guides.tourDays(b) + (int) Maps.lng(b, "extraDays")));
            if (days.isEmpty())
                continue;
            LocalDate end = LocalDate.parse(days.get(days.size() - 1));
            if (end.plusDays(REVIEW_WINDOW_DAYS).isBefore(today))
                continue;
            String id = Maps.str(b, "id");
            if (onlyUnreviewed && reviewed.contains(id))
                continue;
            out.add(id);
        }
        if (onlyUnreviewed)
            while (legacy-- > 0 && !out.isEmpty())
                out.remove(0);
        return out;
    }

    public Map<String, Object> eligible(Map<String, Object> user, String tourId) {
        if (tourId == null || tourId.isEmpty())
            throw HttpError.bad("Thiếu tourId");
        Role r = Role.from(user == null ? null : user.get("role"));
        if (r == null || r.isInternal()) {
            return Maps.of("ok", true, "eligible", false, "reason",
                    "Chỉ khách hàng mới có thể đánh giá tour.");
        }
        String uid = Maps.str(user, "id");
        List<String> open = qualifying(uid, tourId, true);
        if (!open.isEmpty())
            return Maps.of("ok", true, "eligible", true, "bookingId", open.get(0), "bookings", open);
        if (qualifying(uid, tourId, false).isEmpty())
            return Maps.of("ok", true, "eligible", false, "reason",
                    "Chỉ khách đã hoàn thành tour mới viết được đánh giá.");
        return Maps.of("ok", true, "eligible", false, "duplicate", true, "reason", "Bạn đã đánh giá tour này rồi.");
    }

    public Map<String, Object> create(Map<String, Object> user, Map<String, Object> in) {
        String tourId = Maps.str(in, "tourId");
        ReviewSchema.Check c = ReviewSchema.validateInput(in);
        if (!c.ok())
            throw HttpError.bad(c.msg(), c.field());
        List<String> attached = reviewImages(user, c.value().get("images"));
        String legacyImage = Maps.str(c.value(), "image");
        if (legacyImage.startsWith("img/") && !ImageStore.ownsReviewImage(Maps.str(user, "id"), legacyImage))
            throw HttpError.bad("Bạn chỉ có thể đính kèm ảnh đã tải lên từ tài khoản của mình", "image");
        Map<String, Object> el = eligible(user, tourId);
        if (!Boolean.TRUE.equals(el.get("eligible")))
            throw new HttpError(Boolean.TRUE.equals(el.get("duplicate")) ? 409 : 403, Maps.str(el, "reason"));
        List<Object> open = Maps.list(el.get("bookings"));
        String want = Maps.str(in, "bookingId");
        if (!want.isEmpty() && !open.contains(want))
            throw new HttpError(409, "Đơn này không đủ điều kiện hoặc đã được đánh giá.");
        String bookingId = want.isEmpty() ? Maps.str(el, "bookingId") : want;
        final String bid = bookingId;
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", Ids.newId("rv"));
        r.put("tourId", tourId);
        r.put("userId", Maps.str(user, "id")); // nội bộ, KHÔNG trả ra ngoài
        r.put("name", Maps.str(user, "name"));
        r.putAll(c.value());
        if (!attached.isEmpty()) r.put("images", attached);
        boolean filtered = false;
        for (String k : new String[] { "content", "guideComment" }) {
            String t = Maps.str(r, k);
            if (t.isEmpty())
                continue;
            String m = maskBad(t);
            if (!m.equals(t)) {
                r.put(k, m);
                filtered = true;
            }
        }
        if (filtered)
            r.put("filtered", true);
        if (!bid.isEmpty()) {
            r.put("bookingId", bid);
            Map<String, Object> b = db.list("bookings").stream().filter(x -> bid.equals(Maps.str(x, "id"))).findFirst()
                    .orElse(null);
            if (b != null && !Maps.str(b, "guideId").isEmpty())
                r.put("guideId", Maps.str(b, "guideId"));
        }
        r.put("source", "verified"); // do server đặt
        r.put("createdAt", Times.iso(clock.millis()));
        db.edit("reviews", all -> {
            if (all.stream().anyMatch(x -> bid.equals(Maps.str(x, "bookingId"))))
                throw new HttpError(409, "Bạn đã đánh giá đơn này rồi.");
            all.add(r);
        });
        return ReviewSchema.toPublic(r);
    }

    /**
     * "Nguyễn Văn An" → "Nguyễn A." (HDV chỉ cần biết ai đánh giá ở mức nhận diện,
     * không lộ tên đầy đủ).
     */
    private static String shortName(String full) {
        String[] w = full == null ? new String[0] : full.trim().split("\\s+");
        if (w.length == 0 || w[0].isEmpty())
            return "Khách";
        if (w.length == 1)
            return w[0];
        return w[0] + " " + w[w.length - 1].substring(0, 1).toUpperCase() + ".";
    }

    /**
     * 7.3: điểm đánh giá riêng của một HDV (bỏ đánh giá bị ẩn): điểm TB, số lượt,
     * phân bố 1–5 sao,
     * 10 nhận xét gần nhất ({@code recent}, giữ nguyên cho giao diện cũ) và tối đa
     * 100 đánh giá chi tiết ({@code items}: tour, mã đơn, người đánh giá rút gọn).
     */
    public Map<String, Object> guideStats(String guideId) {
        Map<String, Object> hidden = Maps.map(db.obj("reviewmod").get("hidden"));
        Map<String, Map<String, Object>> byBooking = new java.util.HashMap<>();
        for (Map<String, Object> b : db.list("bookings"))
            byBooking.put(Maps.str(b, "id"), b);
        long sum = 0, n = 0;
        long[] dist = new long[6];
        List<Map<String, Object>> recent = new ArrayList<>(), items = new ArrayList<>();
        for (Map<String, Object> r : db.list("reviews")) {
            if (!guideId.equals(Maps.str(r, "guideId")) || r.get("guideRating") == null)
                continue;
            if (hidden != null && hidden.containsKey(Maps.str(r, "id")))
                continue;
            long star = Math.max(1, Math.min(5, Maps.lng(r, "guideRating")));
            sum += Maps.lng(r, "guideRating");
            n++;
            dist[(int) star]++;
            Map<String, Object> b = byBooking.get(Maps.str(r, "bookingId"));
            recent.add(Maps.of("rating", r.get("guideRating"), "comment", Maps.str(r, "guideComment"), "tourId",
                    r.get("tourId"), "createdAt", r.get("createdAt")));
            items.add(Maps.of("rating", r.get("guideRating"), "comment", Maps.str(r, "guideComment"), "tourId",
                    r.get("tourId"), "createdAt", r.get("createdAt"),
                    "tourName", b == null ? "" : Maps.str(b, "tourName"), "payCode",
                    b == null ? "" : Maps.str(b, "payCode"), "reviewer", shortName(Maps.str(r, "name"))));
        }
        recent.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        items.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        double avg = n == 0 ? 0 : Math.floor(sum * 10.0 / n + 0.5) / 10.0;
        Map<String, Object> distribution = new java.util.LinkedHashMap<>();
        for (int i = 5; i >= 1; i--)
            distribution.put(String.valueOf(i), dist[i]);
        return Maps.of("ok", true, "guideId", guideId, "average", avg, "count", n, "distribution", distribution,
                "recent", recent.subList(0, Math.min(10, recent.size())), "items",
                items.subList(0, Math.min(100, items.size())));
    }

    /**
     * Phản hồi (Rep) bình luận / đánh giá bởi Content Creator hoặc Admin.
     */
    public Map<String, Object> replyReview(Actor by, String reviewId, String replyText) {
        if (reviewId == null || reviewId.isBlank()) throw HttpError.bad("Thiếu mã đánh giá");

        final boolean[] found = {false};
        final Map<String, Object>[] updated = new Map[]{null};

        db.edit("reviews", all -> {
            for (Map<String, Object> r : all) {
                if (reviewId.equals(Maps.str(r, "id"))) {
                    found[0] = true;
                    if (replyText == null || replyText.trim().isEmpty()) {
                        r.remove("reply");
                    } else {
                        Map<String, Object> rep = new LinkedHashMap<>();
                        rep.put("content", replyText.trim());
                        rep.put("by", by.id());
                        rep.put("byName", by.name());
                        rep.put("byRole", by.role());
                        rep.put("at", Times.iso(clock.millis()));
                        r.put("reply", rep);
                    }
                    updated[0] = r;
                    break;
                }
            }
        });

        if (!found[0]) {
            for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> seed = Maps.map(o);
                if (seed != null && reviewId.equals(Maps.str(seed, "id"))) {
                    Map<String, Object> copy = new LinkedHashMap<>(seed);
                    if (replyText != null && !replyText.trim().isEmpty()) {
                        Map<String, Object> rep = new LinkedHashMap<>();
                        rep.put("content", replyText.trim());
                        rep.put("by", by.id());
                        rep.put("byName", by.name());
                        rep.put("byRole", by.role());
                        rep.put("at", Times.iso(clock.millis()));
                        copy.put("reply", rep);
                    }
                    db.edit("reviews", all -> all.add(copy));
                    found[0] = true;
                    updated[0] = copy;
                    break;
                }
            }
        }

        if (!found[0]) throw HttpError.notFound("Không tìm thấy đánh giá: " + reviewId);

        return Maps.of("ok", true, "id", reviewId, "reply", updated[0] != null ? updated[0].get("reply") : null);
    }

    /** Gắn loại bình luận (Hỏi thông tin, Đánh giá, Khiếu nại, Góp ý) */
    public Map<String, Object> tagReview(Actor by, String reviewId, String category) {
        String catName = switch (category != null ? category.toLowerCase() : "") {
            case "inquiry" -> "Hỏi thông tin";
            case "complaint" -> "Khiếu nại";
            case "feedback" -> "Góp ý";
            default -> "Đánh giá";
        };
        final boolean[] found = {false};
        db.edit("reviews", all -> {
            for (Map<String, Object> r : all) {
                if (reviewId.equals(Maps.str(r, "id"))) {
                    r.put("category", category);
                    r.put("categoryName", catName);
                    r.put("taggedBy", by.name());
                    r.put("taggedAt", Times.iso(clock.millis()));
                    found[0] = true;
                    break;
                }
            }
        });
        if (!found[0]) {
            for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> seed = Maps.map(o);
                if (seed != null && reviewId.equals(Maps.str(seed, "id"))) {
                    Map<String, Object> copy = new LinkedHashMap<>(seed);
                    copy.put("category", category);
                    copy.put("categoryName", catName);
                    copy.put("taggedBy", by.name());
                    copy.put("taggedAt", Times.iso(clock.millis()));
                    db.edit("reviews", all -> all.add(copy));
                    found[0] = true;
                    break;
                }
            }
        }
        if (!found[0]) throw HttpError.notFound("Không tìm thấy đánh giá: " + reviewId);
        return Maps.of("ok", true, "id", reviewId, "category", category, "categoryName", catName);
    }

    /** Chuyển vấn đề cho bộ phận khác (Điều hành, Thu ngân, HDV, Kỹ thuật) */
    public Map<String, Object> forwardReview(Actor by, String reviewId, String toRole, String note) {
        String roleName = switch (toRole != null ? toRole.toLowerCase() : "") {
            case "operator" -> "Điều hành tour";
            case "cashier" -> "Thu ngân / Kế toán";
            case "guide" -> "Hướng dẫn viên";
            case "tech" -> "Bộ phận Kỹ thuật";
            default -> "Bộ phận liên quan";
        };
        final boolean[] found = {false};
        db.edit("reviews", all -> {
            for (Map<String, Object> r : all) {
                if (reviewId.equals(Maps.str(r, "id"))) {
                    r.put("forwardedTo", toRole);
                    r.put("forwardedToName", roleName);
                    r.put("forwardedNote", note != null ? note.trim() : "");
                    r.put("forwardedBy", by.id());
                    r.put("forwardedByName", by.name());
                    r.put("forwardedAt", Times.iso(clock.millis()));
                    found[0] = true;
                    break;
                }
            }
        });
        if (!found[0]) {
            for (Object o : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> seed = Maps.map(o);
                if (seed != null && reviewId.equals(Maps.str(seed, "id"))) {
                    Map<String, Object> copy = new LinkedHashMap<>(seed);
                    copy.put("forwardedTo", toRole);
                    copy.put("forwardedToName", roleName);
                    copy.put("forwardedNote", note != null ? note.trim() : "");
                    copy.put("forwardedBy", by.id());
                    copy.put("forwardedByName", by.name());
                    copy.put("forwardedAt", Times.iso(clock.millis()));
                    db.edit("reviews", all -> all.add(copy));
                    found[0] = true;
                    break;
                }
            }
        }
        if (!found[0]) throw HttpError.notFound("Không tìm thấy đánh giá: " + reviewId);
        return Maps.of("ok", true, "id", reviewId, "forwardedTo", toRole, "forwardedToName", roleName);
    }

    /** Xóa vĩnh viễn đánh giá / bình luận (Chỉ Admin) */
    public Map<String, Object> deleteReview(Actor by, String reviewId) {
        db.edit("reviews", all -> all.removeIf(r -> reviewId.equals(Maps.str(r, "id"))));
        db.editObj("reviewmod", m -> {
            if (m.get("hidden") instanceof Map<?, ?> h) {
                Map<String, Object> hMap = new LinkedHashMap<>((Map<String, Object>) h);
                hMap.remove(reviewId);
                m.put("hidden", hMap);
            }
        });
        return Maps.of("ok", true, "id", reviewId, "deleted", true);
    }

    /**
     * Khách hàng đăng nhập hoặc khách vãng lai gửi bình luận, hỏi đáp, đánh giá và phản hồi liên hệ.
     */
    public Map<String, Object> addComment(Map<String, Object> user, Map<String, Object> in) {
        String tourId = Maps.str(in, "tourId");
        String targetType = Maps.str(in, "targetType");
        if (targetType.isEmpty()) targetType = "tour";
        if (!Set.of("tour", "food", "contact", "feedback").contains(targetType)) throw HttpError.bad("Loại bài viết không hợp lệ", "targetType");

        String content = Maps.str(in, "content").trim();
        if (content.isEmpty()) content = Maps.str(in, "text").trim();
        if (content.isEmpty()) content = Maps.str(in, "comment").trim();
        if (content.isEmpty()) content = Maps.str(in, "message").trim();
        if (content.length() < 3) throw HttpError.bad("Nội dung bình luận ít nhất 3 ký tự");
        if (content.length() > 2000) throw HttpError.bad("Nội dung bình luận tối đa 2000 ký tự");

        int rating = ReviewSchema.toRating(in.get("rating"));
        if ("food".equals(targetType) && in.get("rating") != null && rating < 1)
            throw HttpError.bad("Điểm đánh giá phải là số nguyên từ 1 đến 5 sao", "rating");
        List<String> attached = user != null ? reviewImages(user, in.get("images")) : List.of();

        boolean admin = user != null && accounts.isAdmin(user);
        String uid = user != null ? Maps.str(user, "id") : "guest_" + System.currentTimeMillis();
        String uName = user != null ? Maps.str(user, "name") : Maps.str(in, "name");
        if (uName.isEmpty()) uName = "Khách hàng";

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", Ids.newId("rv"));
        if (!tourId.isEmpty()) r.put("tourId", tourId);
        r.put("targetType", targetType);
        if (in.containsKey("foodName")) r.put("foodName", Maps.str(in, "foodName"));
        if (in.containsKey("tourName")) r.put("tourName", Maps.str(in, "tourName"));
        r.put("userId", uid);
        r.put("name", uName);
        if (in.containsKey("email")) r.put("email", Maps.str(in, "email"));
        if (in.containsKey("phone")) r.put("phone", Maps.str(in, "phone"));
        if (in.containsKey("category")) r.put("category", Maps.str(in, "category"));
        r.put("content", maskBad(content));
        r.put("kind", "contact".equals(targetType) ? "feedback" : "comment");
        if (!"tour".equals(targetType) && rating > 0) r.put("rating", rating);
        if (!attached.isEmpty()) r.put("images", attached);
        r.put("source", admin ? "admin" : (user != null ? "member" : "guest"));
        r.put("createdAt", Times.iso(clock.millis()));

        db.edit("reviews", all -> all.add(r));
        return ReviewSchema.toPublic(r);
    }

    private static List<String> reviewImages(Map<String, Object> user, Object raw) {
        final List<String> paths;
        try { paths = ReviewSchema.validateImages(raw); }
        catch (IllegalArgumentException e) { throw HttpError.bad(e.getMessage(), "images"); }
        String uid = Maps.str(user, "id");
        for (String path : paths) {
            if (path.startsWith("http://")) throw HttpError.bad("Ảnh ngoài hệ thống phải dùng HTTPS", "images");
            if (path.startsWith("img/") && !ImageStore.ownsReviewImage(uid, path))
                throw HttpError.bad("Bạn chỉ có thể đính kèm ảnh đã tải lên từ tài khoản của mình", "images");
        }
        return paths;
    }

    /** Thành viên trả lời trong luồng công khai; câu trả lời con trỏ tới một reply cùng luồng. */
    public Map<String, Object> addCommunityReply(Map<String, Object> user, String reviewId, Map<String, Object> in) {
        String content = Maps.str(in, "content").trim();
        if (content.length() < ReviewSchema.COMMENT_MIN || content.length() > ReviewSchema.CONTENT_MAX)
            throw HttpError.bad("Nội dung phản hồi phải từ 3 đến 1000 ký tự", "content");
        List<String> attached = reviewImages(user, in.get("images"));
        String replyToId = Maps.str(in, "replyToId");
        Map<String, Object> hidden = Maps.map(db.obj("reviewmod").get("hidden"));
        if (hidden != null && hidden.containsKey(reviewId)) throw HttpError.notFound("Không tìm thấy bình luận");
        final Map<String, Object>[] rootRef = new Map[]{null};
        db.edit("reviews", all -> {
            Map<String, Object> root = all.stream().filter(x -> reviewId.equals(Maps.str(x, "id"))).findFirst().orElse(null);
            if (root == null) return;
            rootRef[0] = root;
            appendCommunityReply(root, user, content, attached, replyToId);
        });
        if (rootRef[0] == null) {
            for (Object item : Maps.list(data.obj("reviews-seed.json").get("reviews"))) {
                Map<String, Object> seed = Maps.map(item);
                if (seed == null || !reviewId.equals(Maps.str(seed, "id"))) continue;
                Map<String, Object> copy = new LinkedHashMap<>(seed);
                appendCommunityReply(copy, user, content, attached, replyToId);
                db.edit("reviews", all -> all.add(copy));
                rootRef[0] = copy;
                break;
            }
        }
        if (rootRef[0] == null) throw HttpError.notFound("Không tìm thấy bình luận");
        List<Map<String, Object>> replies = Maps.list(rootRef[0].get("replies")).stream().map(Maps::map).filter(Objects::nonNull).toList();
        Map<String, Object> latest = replies.get(replies.size() - 1);
        return ReviewSchema.toPublic(latest);
    }

    private void appendCommunityReply(Map<String, Object> root, Map<String, Object> user, String content, List<String> images, String replyToId) {
        List<Map<String, Object>> replies = new ArrayList<>();
        for (Object item : Maps.list(root.get("replies"))) { Map<String, Object> m = Maps.map(item); if (m != null) replies.add(m); }
        if (!replyToId.isEmpty() && !reviewIdExists(root, replies, replyToId)) throw HttpError.bad("Không tìm thấy phản hồi cần trả lời", "replyToId");
        Map<String, Object> reply = new LinkedHashMap<>();
        reply.put("id", Ids.newId("rp"));
        reply.put("userId", Maps.str(user, "id"));
        reply.put("name", Maps.str(user, "name").isEmpty() ? "Thành viên" : Maps.str(user, "name"));
        reply.put("content", maskBad(content));
        reply.put("createdAt", Times.iso(clock.millis()));
        reply.put("source", "member");
        if (!replyToId.isEmpty()) reply.put("replyToId", replyToId);
        if (!images.isEmpty()) reply.put("images", images);
        replies.add(reply);
        root.put("replies", replies);
    }

    private static boolean reviewIdExists(Map<String, Object> root, List<Map<String, Object>> replies, String id) {
        return id.equals(Maps.str(root, "id")) || replies.stream().anyMatch(r -> id.equals(Maps.str(r, "id")));
    }
}
