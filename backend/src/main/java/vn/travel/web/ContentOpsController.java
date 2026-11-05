package vn.travel.web;

import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.service.ContentOps;
import vn.travel.util.Maps;

/** API Biên tập nội dung: bản nháp tour (chờ Admin duyệt), ẩm thực, ẩn/hiện đánh giá. Trường nhạy cảm của tour bị chặn 403. */
@RestController
public class ContentOpsController {
    private final CurrentUser current;
    private final ContentOps content;

    private vn.travel.service.Stats stats;

    @org.springframework.beans.factory.annotation.Autowired
    public void setStats(vn.travel.service.Stats stats) { this.stats = stats; }

    /** 7.5: CONTENT ghim / bỏ ghim tour nổi bật (body: pinned=true|false). */
    @PostMapping("/api/content/featured/{tourId}/pin")
    public Map<String, Object> pin(@PathVariable String tourId, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_BANNER);
        return content.pinFeatured(Api.actor(u), stats, tourId, !Boolean.FALSE.equals(Api.body(body).get("pinned")));
    }

    @GetMapping("/api/content/featured")
    public Map<String, Object> featuredAdmin(HttpServletRequest req) {
        current.requirePermission(req, Permission.CONTENT_MANAGE_BANNER);
        return Maps.of("ok", true, "pins", stats.pins(), "tours", stats.featured());
    }

    public ContentOpsController(CurrentUser current, ContentOps content) {
        this.current = current;
        this.content = content;
    }

    /** Công khai: danh mục ẩm thực đang hiển thị. */
    @GetMapping("/api/foods")
    public Map<String, Object> foods() {
        return Maps.of("ok", true, "foods", content.foods(true));
    }

    @GetMapping("/api/content/drafts")
    public Map<String, Object> drafts(@RequestParam(required = false) String status, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_TOUR);
        boolean admin = Role.ADMIN == current.getRole(u);
        return Maps.of("ok", true, "drafts", content.drafts(status, admin ? null : Maps.str(u, "id")),
                "contentFields", ContentOps.CONTENT_FIELDS, "sensitiveFields", ContentOps.SENSITIVE_FIELDS);
    }

    @PostMapping("/api/content/drafts")
    public Map<String, Object> saveDraft(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_TOUR);
        return Maps.of("ok", true, "draft", content.saveDraft(Api.actor(u), Api.s(body, "id"), Api.s(body, "tourId"), Maps.map(Api.body(body).get("fields"))));
    }

    @PostMapping("/api/content/drafts/{id}/submit")
    public Map<String, Object> submit(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_TOUR);
        return Maps.of("ok", true, "draft", content.submitDraft(Api.actor(u), id));
    }

    @GetMapping("/api/content/foods")
    public Map<String, Object> allFoods(HttpServletRequest req) {
        current.requirePermission(req, Permission.CONTENT_MANAGE_FOOD);
        return Maps.of("ok", true, "foods", content.foods(false));
    }

    @PostMapping("/api/content/foods")
    public Map<String, Object> createFood(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_FOOD);
        return Maps.of("ok", true, "food", content.saveFood(Api.actor(u), null, Api.body(body)));
    }

    @PutMapping("/api/content/foods/{id}")
    public Map<String, Object> updateFood(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_FOOD);
        return Maps.of("ok", true, "food", content.saveFood(Api.actor(u), id, Api.body(body)));
    }

    @DeleteMapping("/api/content/foods/{id}")
    public Map<String, Object> deleteFood(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.CONTENT_MANAGE_FOOD);
        content.deleteFood(Api.actor(u), id);
        return Maps.of("ok", true);
    }

    @GetMapping("/api/content/reviews")
    public Map<String, Object> reviews(HttpServletRequest req) {
        current.requirePermission(req, Permission.REVIEW_MODERATE);
        return Maps.of("ok", true, "reviews", content.reviewList());
    }

    @PostMapping("/api/content/reviews/{id}/moderate")
    public Map<String, Object> moderate(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.REVIEW_MODERATE);
        return content.moderateReview(Api.actor(u), id, !Boolean.FALSE.equals(Api.body(body).get("hide")), Api.s(body, "reason"));
    }

    @PostMapping("/api/content/reviews/{id}/reply")
    public Map<String, Object> replyReview(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.REVIEW_MODERATE);
        String reply = Api.s(body, "reply");
        return content.replyReview(Api.actor(u), id, reply);
    }

    @GetMapping("/api/content/stats")
    public Map<String, Object> stats(HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_CONTENT);
        return Maps.of("ok", true, "stats", content.stats());
    }
}