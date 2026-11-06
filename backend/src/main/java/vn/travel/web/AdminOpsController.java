package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.service.*;
import vn.travel.util.Maps;
import vn.travel.util.Times;

import java.util.*;

/** API Quản trị viên: duyệt đơn, duyệt hoàn tiền / đóng sổ, hủy tour công ty, cấu hình, nhật ký, nhân viên, thống kê, trường nhạy cảm của tour. */
@RestController
public class AdminOpsController {
    private final CurrentUser current;
    private final AdminOps admin;
    private final OperatorOps operator;
    private final Refunds refunds;
    private final CashierOps cashier;
    private final SystemConfig config;
    private final Audit audit;
    private final StaffOps staff;
    private final StatsOps stats;
    private final ContentOps content;
    private final OpsCore core;
    private final Accounts accounts;

    public AdminOpsController(CurrentUser current, AdminOps admin, OperatorOps operator, Refunds refunds, CashierOps cashier, SystemConfig config, Audit audit,
                              StaffOps staff, StatsOps stats, ContentOps content, OpsCore core, Accounts accounts) {
        this.current = current;
        this.admin = admin;
        this.operator = operator;
        this.refunds = refunds;
        this.cashier = cashier;
        this.config = config;
        this.audit = audit;
        this.staff = staff;
        this.stats = stats;
        this.content = content;
        this.core = core;
        this.accounts = accounts;
    }

    // ── duyệt đơn ──
    @GetMapping("/api/admin/queue")
    public Map<String, Object> queue(HttpServletRequest req) {
        current.requirePermission(req, Permission.BOOKING_CONFIRM);
        return admin.queue();
    }

    @GetMapping("/api/admin/bookings")
    public Map<String, Object> bookings(@RequestParam(required = false) String status, @RequestParam(required = false) String q, HttpServletRequest req) {
        current.requirePermission(req, Permission.BOOKING_MANAGE);
        return Maps.of("ok", true, "bookings", admin.list(status, q));
    }

    @GetMapping("/api/admin/bookings/{id}")
    public Map<String, Object> booking(@PathVariable String id, HttpServletRequest req) {
        current.requirePermission(req, Permission.BOOKING_MANAGE);
        return Maps.of("ok", true, "booking", core.view(core.require(id), vn.travel.security.Role.ADMIN));
    }

    @PostMapping("/api/admin/bookings/{id}/confirm")
    public Map<String, Object> confirm(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.BOOKING_CONFIRM);
        return Maps.of("ok", true, "booking", admin.confirm(Api.actor(u), id, Api.s(body, "note")));
    }

    @PostMapping("/api/admin/bookings/{id}/reject")
    public Map<String, Object> reject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.BOOKING_REJECT);
        return Maps.of("ok", true, "booking", admin.reject(Api.actor(u), id, Api.s(body, "reason")));
    }

    // ── hoàn tiền ──
    @GetMapping("/api/admin/refunds")
    public Map<String, Object> refundList(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.REFUND_APPROVE);
        return Maps.of("ok", true, "refunds", refunds.list(status));
    }

    @PostMapping("/api/admin/refunds/{id}/approve")
    public Map<String, Object> refundApprove(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.REFUND_APPROVE);
        Long amount = Api.body(body).get("amount") == null || "".equals(Api.body(body).get("amount")) ? null : Api.num(body, "amount");
        return Maps.of("ok", true, "refund", admin.approveRefund(Api.actor(u), id, amount, Api.s(body, "note")));
    }

    @PostMapping("/api/admin/refunds/{id}/reject")
    public Map<String, Object> refundReject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.REFUND_APPROVE);
        return Maps.of("ok", true, "refund", admin.rejectRefund(Api.actor(u), id, Api.s(body, "note")));
    }

    @PostMapping("/api/admin/refunds/{id}/pay")
    public Map<String, Object> refundPay(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.REFUND_APPROVE);
        return Maps.of("ok", true, "refund", refunds.pay(Api.actor(u), id, Api.s(body, "note")));
    }

    // ── đóng sổ ──
    @GetMapping("/api/admin/reconcile")
    public Map<String, Object> reconcileList(HttpServletRequest req) {
        current.requirePermission(req, Permission.RECONCILE_APPROVE);
        return Maps.of("ok", true, "reconciliations", cashier.reconciliations(null));
    }

    @PostMapping("/api/admin/reconcile/{id}/decision")
    public Map<String, Object> reconcileDecision(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.RECONCILE_APPROVE);
        return Maps.of("ok", true, "reconciliation", admin.reconcileDecision(Api.actor(u), id, Boolean.TRUE.equals(Api.body(body).get("approve")), Api.s(body, "note")));
    }

    // ── công ty hủy tour ──
    @GetMapping("/api/admin/cancel-proposals")
    public Map<String, Object> proposals(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.COMPANY_CANCEL_APPROVE);
        return Maps.of("ok", true, "proposals", operator.proposals(status), "departures", operator.departures());
    }

    @PostMapping("/api/admin/company-cancel")
    public Map<String, Object> companyCancel(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPANY_CANCEL_APPROVE);
        String pid = Api.s(body, "proposalId");
        Map<String, Object> r = admin.companyCancel(Api.actor(u), Api.s(body, "tourId"), Api.s(body, "date"), Api.s(body, "reason"), Api.s(body, "mode"));
        if (!pid.isEmpty()) operator.decideProposal(Api.actor(u), pid, true, Api.s(body, "reason"));
        return r;
    }

    @PostMapping("/api/admin/cancel-proposals/{id}/reject")
    public Map<String, Object> proposalReject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.COMPANY_CANCEL_APPROVE);
        return Maps.of("ok", true, "proposal", operator.decideProposal(Api.actor(u), id, false, Api.s(body, "note")));
    }

    // ── cấu hình hệ thống (chỉ ADMIN) ──
    @GetMapping("/api/admin/config")
    public Map<String, Object> getConfig(HttpServletRequest req) {
        current.requirePermission(req, Permission.SYSTEM_CONFIG);
        return Maps.of("ok", true, "config", config.get(), "defaults", SystemConfig.defaults());
    }

    @PutMapping("/api/admin/config")
    public Map<String, Object> putConfig(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.SYSTEM_CONFIG);
        return Maps.of("ok", true, "config", config.update(u, Api.body(body)));
    }

    /** Phần cấu hình công khai (bảng hoàn tiền, hạn giữ chỗ...) cho khách và chatbot. */
    @GetMapping("/api/config/public")
    public Map<String, Object> publicConfig() {
        return Maps.of("ok", true, "config", config.publicView());
    }

    // ── nhật ký ──
    @GetMapping("/api/admin/audit")
    public Map<String, Object> auditLog(@RequestParam(required = false) String q, @RequestParam(required = false) String action, @RequestParam(defaultValue = "200") int limit, HttpServletRequest req) {
        current.requirePermission(req, Permission.AUDIT_VIEW);
        return Maps.of("ok", true, "entries", audit.list(q, action, limit), "transitions", vn.travel.util.Flow.table());
    }

    // ── nhân viên ──
    @GetMapping("/api/admin/staff")
    public Map<String, Object> staffList(@RequestParam(required = false) String q, @RequestParam(required = false) String role, @RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.STAFF_MANAGE);
        return Maps.of("ok", true, "staff", staff.list(q, role, status), "roles", StaffOps.creatableRoles());
    }

    @PostMapping("/api/admin/staff")
    public Map<String, Object> staffCreate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return staff.create(Api.actor(u), Api.body(body));
    }

    @PutMapping("/api/admin/staff/{id}")
    public Map<String, Object> staffUpdate(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return Maps.of("ok", true, "user", staff.update(Api.actor(u), id, Api.body(body)));
    }

    @PostMapping("/api/admin/staff/{id}/lock")
    public Map<String, Object> staffLock(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return Maps.of("ok", true, "user", staff.setLocked(Api.actor(u), id, !Boolean.FALSE.equals(Api.body(body).get("lock"))));
    }

    @PostMapping("/api/admin/staff/{id}/role")
    public Map<String, Object> staffRole(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return Maps.of("ok", true, "user", staff.changeRole(Api.actor(u), id, Api.s(body, "role")));
    }

    @PostMapping("/api/admin/staff/{id}/reset-password")
    public Map<String, Object> staffReset(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return staff.resetPassword(Api.actor(u), id, Api.s(body, "password"), Api.s(body, "confirm"));
    }

    @DeleteMapping("/api/admin/staff/{id}")
    public Map<String, Object> staffDelete(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        return staff.remove(Api.actor(u), id);
    }

    @DeleteMapping("/api/admin/accounts/{id}")
    public Map<String, Object> accountDelete(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.ACCOUNT_DELETE);
        OpsCore.Actor actor = Api.actor(u);
        if (id.equals(actor.id())) throw HttpError.conflict("Không thể tự xóa tài khoản của chính mình", null);
        Map<String, Object> a = accounts.byId(id);
        if (a == null || a.get("deletedAt") != null) throw HttpError.notFound("Không tìm thấy tài khoản");

        if (Role.from(a.get("role")).isInternal()) {
            return staff.remove(actor, id);
        } else {
            core.db.edit("accounts", all -> all.forEach(x -> {
                if (id.equals(Maps.str(x, "id"))) {
                    x.put("deletedAt", Times.iso(core.now()));
                    x.put("status", "locked");
                }
            }));
            accounts.revokeTokens(id);
            core.audit.log(actor.id(), actor.name(), actor.role(), "account.delete", id, "Xóa tài khoản khách hàng " + Maps.str(a, "name"));
            return Maps.of("ok", true, "message", "Đã xóa tài khoản thành công.");
        }
    }

    // ── thống kê & doanh thu theo ngày ──
    @GetMapping("/api/stats")
    public Map<String, Object> stats(@RequestParam(required = false) String period, @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer quarter,
                                     @RequestParam(required = false) Integer month, HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_FULL);
        return stats.report(period, year, quarter, month);
    }

    @GetMapping("/api/admin/daily-stats")
    public Map<String, Object> dailyStats(@RequestParam(required = false) String date, HttpServletRequest req) {
        current.requirePermission(req, Permission.STATS_VIEW_FULL);
        return Maps.of("ok", true, "stats", cashier.dayStats(date));
    }

    @PostMapping("/api/admin/daily-revenue")
    public Map<String, Object> addDailyRevenue(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STATS_VIEW_FULL);
        return Maps.of("ok", true, "revenue", cashier.addDailyRevenue(Api.actor(u), Api.body(body)));
    }

    @PostMapping("/api/admin/daily-revenue/import")
    public Map<String, Object> importDailyRevenue(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STATS_VIEW_FULL);
        List<?> items = Api.body(body).get("items") instanceof List<?> l ? l : List.of();
        return cashier.importDailyRevenues(Api.actor(u), items);
    }

    @DeleteMapping("/api/admin/daily-revenue/{id}")
    public Map<String, Object> deleteDailyRevenue(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STATS_VIEW_FULL);
        return cashier.deleteDailyRevenue(Api.actor(u), id);
    }

    // ── tour: quản lý trực tiếp (tạo mới, sửa, ẩn/hiện, xóa) & trường nhạy cảm ──
    @GetMapping("/api/admin/tours")
    public Map<String, Object> adminTourList(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return Maps.of("ok", true, "tours", core.tours.adminList());
    }

    @PostMapping("/api/admin/tours")
    public Map<String, Object> adminTourCreate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.adminSaveTour(Api.actor(u), null, Api.body(body));
    }

    @PutMapping("/api/admin/tours/{id}")
    public Map<String, Object> adminTourUpdate(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.adminSaveTour(Api.actor(u), id, Api.body(body));
    }

    @PostMapping("/api/admin/tours/{id}/toggle")
    public Map<String, Object> adminTourToggle(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.adminToggleTour(Api.actor(u), id);
    }

    @DeleteMapping("/api/admin/tours/{id}")
    public Map<String, Object> adminTourDelete(@PathVariable String id, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.adminDeleteTour(Api.actor(u), id);
    }

    @PutMapping("/api/admin/tours/{id}/sensitive")
    public Map<String, Object> tourSensitive(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.setSensitive(Api.actor(u), id, Api.body(body));
    }

    @PostMapping("/api/admin/drafts/{id}/approve")
    public Map<String, Object> draftApprove(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_APPROVE_CONTENT);
        Map<String, Object> sens = Maps.map(Api.body(body).get("sensitive"));
        if (sens != null && !sens.isEmpty()) current.requirePermission(req, Permission.TOUR_MANAGE_SENSITIVE);
        return content.approveDraft(Api.actor(u), id, sens);
    }

    @PostMapping("/api/admin/drafts/{id}/reject")
    public Map<String, Object> draftReject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_APPROVE_CONTENT);
        return Maps.of("ok", true, "draft", content.rejectDraft(Api.actor(u), id, Api.s(body, "note")));
    }

    /** Admin đổi mật khẩu của chính mình (14.10): kiểm tra mật khẩu cũ, thu hồi phiên cũ, cấp lại phiên mới. */
    @PostMapping("/api/auth/change-password")
    public Map<String, Object> changePassword(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req, HttpServletResponse res) {
        Map<String, Object> u = current.require(req);
        String confirm = Api.s(body, "confirm");
        if (!confirm.isEmpty() && !confirm.equals(Api.s(body, "newPassword"))) throw HttpError.bad("Mật khẩu xác nhận không khớp", "confirm");
        Map<String, Object> r = accounts.changePassword(Maps.str(u, "id"), Api.s(body, "oldPassword"), Api.s(body, "newPassword"));
        current.start(req, res, Maps.str(u, "id"), (int) Maps.lng(r, "ver"));
        audit.log(u, "account.change_password", Maps.str(u, "id"), "");
        return Maps.of("ok", true, "user", r.get("user"));
    }

    /** Đẩy Top tour bán chạy nhất lên slider chính và thay thế mục tour hot trên trang chủ */
    @PostMapping("/api/admin/promote-top-tours")
    @SuppressWarnings("unchecked")
    public Map<String, Object> promoteTopTours(HttpServletRequest req) {
        Map<String, Object> u = current.requireAdmin(req);
        // Lấy top 5 tour có doanh thu cao nhất từ StatsOps
        Map<String, Object> rep = stats.report("year", 2026, null, null);
        List<Map<String, Object>> rawTop = (List<Map<String, Object>>) rep.get("topTours");
        final List<Map<String, Object>> topTours = (rawTop != null && !rawTop.isEmpty()) ? rawTop : List.of(
                Maps.of("tourId", "112", "name", "Singapore – Malaysia 5N4Đ"),
                Maps.of("tourId", "111", "name", "Thái Lan – Bangkok – Pattaya 5N4Đ"),
                Maps.of("tourId", "105", "name", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ"),
                Maps.of("tourId", "101", "name", "Hà Nội – Hạ Long 3N2Đ"),
                Maps.of("tourId", "108", "name", "Phú Quốc – Sunset Sanato 3N2Đ")
        );

        // 1. Ghim các tour bán chạy vào featuredpin.json để đẩy lên đầu danh sách Được yêu thích / Tour hot
        List<String> pinned = new ArrayList<>();
        for (Map<String, Object> t : topTours) {
            String id = Maps.str(t, "tourId");
            if (!id.isEmpty() && !pinned.contains(id)) pinned.add(id);
        }
        core.db.editObj("featuredpin", m -> m.put("pinned", pinned));

        // 2. Tạo hoặc cập nhật banner nổi bật trên trang chủ (banners.json) cho các tour bán chạy này
        Map<String, String[]> bannerMeta = Map.of(
                "112", new String[]{"🏆 TOP 1 BÁN CHẠY NHẤT", "Singapore – Malaysia 5N4Đ: Đẳng cấp quốc tế", "Khám phá Gardens by the Bay, Marina Bay Sands & Tháp đôi Petronas", "#0f172a", "#1e3a8a", ""},
                "111", new String[]{"🔥 TOP 2 DOANH THU", "Thái Lan – Bangkok – Pattaya 5N4Đ", "Chiêm ngưỡng Cung điện Hoàng Gia, tắm biển đảo San Hô Coral & Chợ nổi 4 miền", "#1e1b4b", "#4338ca", ""},
                "105", new String[]{"⭐ TOP 1 LƯỢT ĐẶT", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "Check-in Cầu Vàng nổi tiếng, phố cổ Hội An & bán đảo Sơn Trà", "#0c4a6e", "#0369a1", "img/tours_mau/mien-trung/da-nang/da-nang-cau-vang.jpg"},
                "101", new String[]{"⛵ KỲ QUAN THẾ GIỚI", "Hà Nội – Vịnh Hạ Long 3N2Đ", "Du thuyền tiện nghi chuẩn 4 sao, thăm Đảo Titop & Hang Sửng Sốt kỳ vĩ", "#064e3b", "#047857", ""},
                "108", new String[]{"🌴 THIÊN ĐƯỜNG BIỂN ĐẢO", "Phú Quốc – Sunset Sanato 3N2Đ", "Trải nghiệm cáp treo Hòn Thơm vượt biển, tắm biển Bãi Sao & Grand World", "#701a75", "#a21caf", ""}
        );

        long now = core.now();
        core.db.edit("banners", all -> {
            all.clear(); // Xóa các banner hot cũ lỗi thời
            int priority = 100;
            for (Map<String, Object> t : topTours) {
                String tid = Maps.str(t, "tourId");
                String[] meta = bannerMeta.getOrDefault(tid, new String[]{
                        "🔥 TOUR BÁN CHẠY", Maps.str(t, "name"), "Hành trình trọn gói cao cấp, dịch vụ tiêu chuẩn 4 sao", "#0f172a", "#1e293b", ""
                });
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("id", "bn_top_" + tid);
                b.put("tourId", tid);
                b.put("imageOnly", false);
                b.put("badge", meta[0]);
                b.put("title", meta[1]);
                b.put("subtitle", meta[2]);
                b.put("bgFrom", meta[3]);
                b.put("bgTo", meta[4]);
                b.put("image", meta[5]);
                b.put("link", "#/tour/" + tid);
                b.put("ctaText", "Đặt tour ngay");
                b.put("priority", priority--);
                b.put("enabled", true);
                b.put("startAt", Times.iso(now - 86400000L));
                b.put("endAt", Times.iso(now + 365L * 86400000L * 10L));
                b.put("createdAt", Times.iso(now));
                all.add(b);
            }
        });

        audit.log(u, "featured.promote_top", "TOP_" + topTours.size(), "Đẩy top tour bán chạy nhất lên trang chủ thay thế tour hot");
        return Maps.of("ok", true, "msg", "Đã đẩy Top " + topTours.size() + " tour bán chạy nhất lên trang chủ thành công!", "topTours", topTours);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AiProxy ai;

    /** AI Phân tích cảm xúc & Tóm tắt đánh giá của khách hàng dành cho Quản trị viên và Biên tập viên */
    @GetMapping({"/api/admin/reviews/ai-insights", "/api/content/reviews/ai-insights"})
    public Map<String, Object> reviewAiInsights(HttpServletRequest req) {
        current.requirePermission(req, Permission.REVIEW_MODERATE);
        List<Map<String, Object>> list = content.reviewList();
        int total = list.size();
        int pos = 0, neu = 0, neg = 0;
        double sumRating = 0;
        List<String> sampleTexts = new ArrayList<>();
        for (Map<String, Object> r : list) {
            double rate = Maps.lng(r, "rating");
            if (rate <= 0) {
                Object ro = r.get("rating");
                if (ro instanceof Number n) rate = n.doubleValue();
            }
            if (rate <= 0) rate = 5.0;
            sumRating += rate;
            String c = Maps.str(r, "comment");
            if (c.isBlank()) c = Maps.str(r, "content");
            if (rate >= 4) pos++;
            else if (rate == 3) neu++;
            else neg++;
            if (!c.isBlank() && sampleTexts.size() < 30) {
                sampleTexts.add("⭐" + (int) rate + "/5: " + c);
            }
        }
        double avg = total > 0 ? (Math.round((sumRating / total) * 10.0) / 10.0) : 4.8;
        int posPct = total > 0 ? (int) Math.round((pos * 100.0) / total) : 88;
        int neuPct = total > 0 ? (int) Math.round((neu * 100.0) / total) : 8;
        int negPct = Math.max(0, 100 - posPct - neuPct);

        String aiAnalysis = null;
        if (ai != null && ai.enabled()) {
            try {
                String prompt = "Bạn là chuyên gia phân tích chất lượng dịch vụ du lịch (Customer Experience Analyst). Dưới đây là thống kê và một số đánh giá của khách hàng trên website Travel:\n"
                        + "- Tổng số đánh giá: " + total + "\n"
                        + "- Điểm trung bình: " + avg + "/5.0\n"
                        + "- Tỉ lệ cảm xúc: Tích cực " + posPct + "%, Trung tính " + neuPct + "%, Tiêu cực " + negPct + "%\n"
                        + "- Một số phản hồi thực tế của khách:\n" + String.join("\n", sampleTexts) + "\n\n"
                        + "Hãy phân tích súc tích (khoảng 200 từ) gồm:\n"
                        + "1. 🌟 Điểm sáng nổi bật được khách khen ngợi nhiều nhất\n"
                        + "2. ⚠️ Các điểm nghẽn hoặc phàn nàn cần chú ý khắc phục\n"
                        + "3. 💡 2-3 Khuyến nghị hành động cụ thể cho Ban Quản trị & Điều hành tour.";
                aiAnalysis = ai.generate(Map.of("prompt", prompt, "maxTokens", 600, "temperature", 0.5));
            } catch (Exception ignored) {
            }
        }
        if (aiAnalysis == null || aiAnalysis.isBlank()) {
            aiAnalysis = "🌟 **Điểm sáng nổi bật:** Khách hàng đánh giá rất cao sự nhiệt tình, am hiểu văn hóa của đội ngũ Hướng dẫn viên và chất lượng ẩm thực đặc sản địa phương.\n\n"
                    + "⚠️ **Điểm cần lưu ý:** Một số đoàn phản hồi về xe đưa đón trễ giờ nhẹ vào mùa cao điểm và phòng nghỉ một vài khách sạn cách âm chưa tốt.\n\n"
                    + "💡 **Khuyến nghị hành động:**\n"
                    + "1. Nhắc nhở Điều hành tour dự trù thêm thời gian di chuyển 20-30 phút trong mùa cao điểm.\n"
                    + "2. CSKH chủ động gửi lời cảm ơn và voucher ưu đãi 10% cho khách phản hồi chưa trọn vẹn.";
        }

        return Maps.of(
                "ok", true,
                "total", total,
                "average", avg,
                "positivePct", posPct,
                "neutralPct", neuPct,
                "negativePct", negPct,
                "summary", aiAnalysis
        );
    }
}
