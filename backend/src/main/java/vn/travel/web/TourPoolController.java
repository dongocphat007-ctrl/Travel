package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.service.OpsCore.Actor;
import vn.travel.service.TourPoolOps;
import vn.travel.util.Maps;

import java.util.List;
import java.util.Map;

@RestController
public class TourPoolController {
    private final TourPoolOps poolOps;
    private final CurrentUser current;

    public TourPoolController(TourPoolOps poolOps, CurrentUser current) {
        this.poolOps = poolOps;
        this.current = current;
    }

    /** Danh sách tour ghép đang mở dành cho khách hàng & công chúng */
    @GetMapping("/api/tours/pool")
    public Map<String, Object> listPublicPools() {
        return Maps.of("ok", true, "pools", poolOps.listPools(true));
    }

    /** Khách hàng / nhân viên đăng ký tham gia ghép tour */
    @PostMapping("/api/tours/pool/join")
    public Map<String, Object> joinPool(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> in = Api.body(body);
        String poolId = Maps.str(in, "poolId");
        String bookingId = Maps.str(in, "bookingId");
        Actor actor = Api.actor(u);
        return poolOps.mergeBookings(actor, poolId, List.of(bookingId), "Khách hàng đăng ký ghép đoàn qua cổng trực tuyến", false);
    }

    /** Quản lý tour ghép dành cho Admin và Điều hành */
    @GetMapping("/api/admin/tours/pool")
    public Map<String, Object> listAdminPools(HttpServletRequest req) {
        current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "pools", poolOps.listPools(false));
    }

    /** Admin / Điều hành tạo nhóm ghép tour mới */
    @PostMapping("/api/admin/tours/pool")
    public Map<String, Object> createPool(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return Maps.of("ok", true, "pool", poolOps.createPool(Api.actor(u), Api.body(body)));
    }

    /** AI & RAG: Quét danh sách các đơn lẻ và gợi ý ghép tour thông minh */
    @PostMapping("/api/admin/tours/pool/ai-match")
    public Map<String, Object> aiMatch(HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        return poolOps.aiScanAndMatch(Api.actor(u));
    }

    /** Admin / Điều hành ghép đoàn bằng tay hoặc xác nhận theo AI */
    @PostMapping("/api/admin/tours/pool/merge")
    public Map<String, Object> merge(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TOUR_SCHEDULE_MANAGE);
        Map<String, Object> in = Api.body(body);
        String poolId = Maps.str(in, "poolId");
        List<String> bookingIds = Maps.list(in.get("bookingIds")).stream().map(String::valueOf).toList();
        String note = Maps.str(in, "note");
        return poolOps.mergeBookings(Api.actor(u), poolId, bookingIds, note, false);
    }

    /** Hướng dẫn viên (HDV) thao tác ghép tay / bổ sung khách vào đoàn tại hiện trường */
    @PostMapping("/api/guide/tours/pool/merge-onsite")
    public Map<String, Object> guideMergeOnsite(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.TRIP_CHECKIN);
        Map<String, Object> in = Api.body(body);
        String poolId = Maps.str(in, "poolId");
        List<String> bookingIds = Maps.list(in.get("bookingIds")).stream().map(String::valueOf).toList();
        String note = Maps.str(in, "note");
        return poolOps.mergeBookings(Api.actor(u), poolId, bookingIds, note, true);
    }
}

