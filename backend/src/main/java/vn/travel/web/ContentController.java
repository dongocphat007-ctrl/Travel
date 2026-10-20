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

    public ContentController(Banners banners, Stats stats, Guides guides, Reviews reviews, CurrentUser current) {
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
    public Map<String, Object> reviews(@RequestParam(required = false) String tourId) {
        return reviews.read(tourId);
    }

    @GetMapping("/api/reviews/eligible")
    public Map<String, Object> eligible(@RequestParam String tourId, HttpServletRequest req) {
        return reviews.eligible(current.require(req), tourId);
    }

    @PostMapping("/api/reviews")
    public Map<String, Object> postReview(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "review", reviews.create(current.require(req), body == null ? Map.of() : body));
    }
}
