package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.security.Permission;
import vn.travel.service.WalletOps;
import vn.travel.util.Maps;

import java.util.Map;

/**
 * Controller cho Ví thu nhập cá nhân & Rút tiền.
 */
@RestController
public class WalletController {
    private final CurrentUser current;
    private final WalletOps wallet;

    public WalletController(CurrentUser current, WalletOps wallet) {
        this.current = current;
        this.wallet = wallet;
    }

    /** Lấy thông tin ví & lịch sử rút tiền của tài khoản đang đăng nhập. */
    @GetMapping("/api/wallet/me")
    public Map<String, Object> myWallet(HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        return wallet.getWallet(Maps.str(u, "id"));
    }

    /** Quy đổi điểm tích lũy thành số dư thu nhập tiền mặt. */
    @PostMapping("/api/wallet/redeem-points")
    public Map<String, Object> redeemPoints(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        long points = Maps.lng(Api.body(body), "points");
        return wallet.redeemPointsToBalance(Maps.str(u, "id"), points);
    }

    /** Gửi yêu cầu rút tiền về tài khoản ngân hàng. */
    @PostMapping("/api/wallet/withdraw")
    public Map<String, Object> withdraw(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> b = Api.body(body);
        return wallet.requestWithdrawal(
                Maps.str(u, "id"),
                Maps.lng(b, "amount"),
                Api.s(b, "bankName"),
                Api.s(b, "accountNumber"),
                Api.s(b, "accountHolder"),
                Api.s(b, "note")
        );
    }

    /** Thu ngân hoặc Admin xem danh sách yêu cầu rút tiền. */
    @GetMapping("/api/cashier/withdrawals")
    public Map<String, Object> listWithdrawals(@RequestParam(required = false) String status, HttpServletRequest req) {
        current.requirePermission(req, Permission.PAYMENT_VIEW);
        return Maps.of("ok", true, "withdrawals", wallet.listWithdrawals(status));
    }

    /** Thu ngân duyệt chi tiền rút. */
    @PostMapping("/api/cashier/withdrawals/{id}/approve")
    public Map<String, Object> approveWithdrawal(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_CONFIRM);
        return wallet.approveWithdrawal(Api.actor(u), id, Api.s(body, "note"));
    }

    /** Thu ngân từ chối yêu cầu rút tiền (hoàn lại số dư). */
    @PostMapping("/api/cashier/withdrawals/{id}/reject")
    public Map<String, Object> rejectWithdrawal(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.PAYMENT_CONFIRM);
        return wallet.rejectWithdrawal(Api.actor(u), id, Api.s(body, "reason"));
    }

    // ───────────────────────── Quản lý lương & phát lương của Admin ─────────────────────────

    /** Admin xem danh sách nhân viên và bảng lương. */
    @GetMapping("/api/admin/salaries")
    public Map<String, Object> listSalaries(HttpServletRequest req) {
        current.requirePermission(req, Permission.STAFF_MANAGE);
        return wallet.listStaffSalaries();
    }

    /** Admin phát lương cho 1 nhân viên. */
    @PostMapping("/api/admin/salaries/pay")
    public Map<String, Object> paySalary(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        Map<String, Object> b = Api.body(body);
        return wallet.paySalary(
                Api.actor(u),
                Api.s(b, "staffId"),
                b.get("amount") != null ? Maps.lng(b, "amount") : null,
                Api.s(b, "note")
        );
    }

    /** Admin phát lương hàng loạt cho tất cả nhân viên văn phòng. */
    @PostMapping("/api/admin/salaries/pay-all")
    public Map<String, Object> payAllSalaries(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        Map<String, Object> b = Api.body(body);
        return wallet.payAllSalaries(Api.actor(u), Api.s(b, "note"));
    }

    /** Admin tăng lương, trừ lương hoặc thưởng/phạt nhân viên. */
    @PostMapping("/api/admin/salaries/adjust")
    public Map<String, Object> adjustSalary(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.STAFF_MANAGE);
        Map<String, Object> b = Api.body(body);
        return wallet.adjustSalary(
                Api.actor(u),
                Api.s(b, "staffId"),
                Api.s(b, "action"),
                Maps.lng(b, "amount"),
                Api.s(b, "reason")
        );
    }

    /** Admin gửi thông báo nhắc nhở vi phạm: ghi 1 lỗi và phạt trừ 200.000 ₫ lương. */
    @PostMapping({"/api/admin/salaries/remind", "/api/admin/notifications/reminder"})
    public Map<String, Object> remindStaff(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.requirePermission(req, Permission.NOTIFICATION_REMINDER_SEND);
        Map<String, Object> b = Api.body(body);
        String staffId = Api.s(b, "staffId");
        if (staffId.isEmpty()) staffId = Api.s(b, "targetUserId");
        return wallet.remindStaff(
                Api.actor(u),
                staffId,
                Api.s(b, "title"),
                Api.s(b, "reason")
        );
    }
}

