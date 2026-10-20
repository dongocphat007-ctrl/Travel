package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.*;
import vn.travel.store.Db;
import vn.travel.util.Maps;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Ghi của Admin: voucher, banner (+ upload ảnh), tour tự tạo. Mọi endpoint kiểm tra vai trò Admin phía server. */
@RestController
public class AdminController {
    private final CurrentUser current;
    private final Vouchers vouchers;
    private final Banners banners;
    private final Accounts accounts;
    private final Db db;

    public AdminController(CurrentUser current, Vouchers vouchers, Banners banners, Accounts accounts, Db db) {
        this.current = current;
        this.vouchers = vouchers;
        this.banners = banners;
        this.accounts = accounts;
        this.db = db;
    }

    private static Map<String, Object> b(Map<String, Object> body) { return body == null ? Map.of() : body; }

    // ── Voucher ──
    @GetMapping("/api/admin/vouchers")
    public Map<String, Object> vouchers(HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "vouchers", vouchers.adminList(accounts));
    }

    @PostMapping("/api/admin/vouchers")
    public Map<String, Object> createVoucher(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "voucher", vouchers.adminCreate(b(body), accounts));
    }

    @PutMapping("/api/admin/vouchers/{code}")
    public Map<String, Object> toggleVoucher(@PathVariable String code, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        vouchers.adminSetDisabled(code, Boolean.TRUE.equals(b(body).get("disabled")));
        return Maps.of("ok", true);
    }

    @DeleteMapping("/api/admin/vouchers/{code}")
    public Map<String, Object> deleteVoucher(@PathVariable String code, HttpServletRequest req) {
        current.requireAdmin(req);
        vouchers.adminDelete(code);
        return Maps.of("ok", true);
    }

    // ── Banner ──
    @GetMapping("/api/admin/banners")
    public Map<String, Object> banners(HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "banners", banners.adminList());
    }

    @PostMapping("/api/admin/banners")
    public Map<String, Object> createBanner(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "banner", banners.create(b(body)));
    }

    @PutMapping("/api/admin/banners/{id}")
    public Map<String, Object> updateBanner(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "banner", banners.update(id, b(body)));
    }

    @DeleteMapping("/api/admin/banners/{id}")
    public Map<String, Object> deleteBanner(@PathVariable String id, HttpServletRequest req) {
        current.requireAdmin(req);
        banners.delete(id);
        return Maps.of("ok", true);
    }

    @PostMapping("/api/admin/upload")
    public Map<String, Object> upload(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        return Maps.of("ok", true, "url", banners.upload(Maps.str(b(body), "dataUrl")));
    }

    // ── Tour do Admin tạo (để server tính giá) ──
    @PostMapping("/api/admin/tours/sync")
    public Map<String, Object> syncTours(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        List<?> in = b(body).get("tours") instanceof List<?> l ? l : List.of();
        if (in.size() > 2000) throw HttpError.bad("Quá nhiều tour");
        List<Map<String, Object>> clean = new ArrayList<>();
        for (Object o : in) {
            Map<String, Object> t = Maps.map(o);
            if (t == null || Maps.str(t, "id").isEmpty() || Maps.str(t, "name").isEmpty()) continue;
            double price = vn.travel.util.Pricing.num(t.get("price"));
            if (price < 0 || price > 1_000_000_000) throw HttpError.bad("Giá tour không hợp lệ: " + Maps.str(t, "name"));
            clean.add(t);
        }
        db.update("admin-tours", old -> clean);
        return Maps.of("ok", true, "count", clean.size());
    }
}
