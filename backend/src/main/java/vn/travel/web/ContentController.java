package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.*;
import vn.travel.util.Maps;

import java.util.Map;

/** Dữ liệu công khai cần server: banner đang chạy, tour nổi bật, guide (kèm lịch bận từ đơn), review. */
@RestController
public class ContentController {
    private final Banners banners;
    private final Stats stats;
    private final Guides guides;
    private final Reviews reviews;
    private final CurrentUser current;
    private final TourCatalog tours;

    public ContentController(Banners banners, Stats stats, Guides guides, Reviews reviews, CurrentUser current, TourCatalog tours) {
        this.tours = tours;
        this.banners = banners;
        this.stats = stats;
        this.guides = guides;
        this.reviews = reviews;
        this.current = current;
    }

    @GetMapping({"/api/banners/active", "/api/banners"})
    public Map<String, Object> activeBanners() {
        return banners.active();
    }

    @GetMapping("/api/tours/featured")
    public Map<String, Object> featured() {
        return Maps.of("ok", true, "tours", stats.featured(), "serverTime", java.time.Instant.now().toString());
    }

    /** NEW-13: điểm đánh giá, số đánh giá và lượt đặt của MỌI tour có số liệu (popup bản đồ). Chỉ trả số, không lộ thông tin khách. */
    @GetMapping("/api/tours/stats")
    public Map<String, Object> tourStats() {
        return Maps.of("ok", true, "stats", stats.ranking());
    }

    /** Danh sách tour khách thấy: tour mẫu + tour Admin đã đồng bộ. ?group=core|bac|trung|nam|intl (bỏ trống = tất cả). */
    @GetMapping("/api/tours")
    public Map<String, Object> tours(@RequestParam(required = false) String group) {
        var list = tours.list(group);
        if (list == null) throw HttpError.bad("Nhóm tour không hợp lệ", "group");
        return Maps.of("ok", true, "tours", list, "count", list.size());
    }

    @GetMapping("/api/tours/{id}")
    public Map<String, Object> tour(@PathVariable String id) {
        Map<String, Object> t = tours.publicTour(id);
        if (t == null) throw HttpError.notFound("Không tìm thấy tour");
        return Maps.of("ok", true, "tour", t);
    }

    @GetMapping("/api/locations")
    public Map<String, Object> locations() {
        return Maps.of("ok", true, "locations", tours.locations());
    }

    @GetMapping("/api/guides")
    public Map<String, Object> guides() {
        return Maps.of("ok", true, "guides", guides.list());
    }

    @GetMapping("/api/guides/{id}")
    public Map<String, Object> guide(@PathVariable String id) {
        Map<String, Object> g = guides.get(id);
        if (g == null) throw HttpError.notFound("Không tìm thấy hướng dẫn viên");
        return Maps.of("ok", true, "guide", g);
    }

    @GetMapping("/api/reviews")
    public Map<String, Object> reviews(@RequestParam(required = false) String tourId, @RequestParam(required = false) String targetType) {
        return reviews.read(tourId, targetType);
    }

    @GetMapping("/api/reviews/eligible")
    public Map<String, Object> eligible(@RequestParam String tourId, HttpServletRequest req) {
        return reviews.eligible(current.require(req), tourId);
    }

    @PostMapping("/api/reviews")
    public Map<String, Object> postReview(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "review", reviews.create(current.requirePermission(req, vn.travel.security.Permission.REVIEW_CREATE_OWN), body == null ? Map.of() : body));
    }

    @PostMapping("/api/reviews/comment")
    public Map<String, Object> postComment(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "review", reviews.addComment(current.require(req), body == null ? Map.of() : body));
    }

    /** Phản hồi công khai trong chuỗi bình luận của một đánh giá. */
    @PostMapping("/api/reviews/{id}/replies")
    public Map<String, Object> reply(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "reply", reviews.addCommunityReply(current.require(req), id, body == null ? Map.of() : body));
    }
}
