package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Quản lý Ví thu nhập cá nhân & Rút tiền cho mọi tài khoản (Khách hàng, HDV,
 * Nhân viên).
 * - Mỗi tài khoản có số dư thu nhập khả dụng (balance), tổng thu nhập
 * (totalEarned), tổng đã rút (totalWithdrawn).
 * - Cho phép quy đổi điểm thưởng (points) sang số dư tiền mặt (1 điểm = 1.000
 * ₫).
 * - Cho phép gửi yêu cầu rút tiền về tài khoản ngân hàng / ví điện tử.
 * - Thu ngân / Quản trị viên duyệt chi và chuyển tiền.
 */
@Service
@SuppressWarnings("unchecked")
public class WalletOps {
    public static final long MIN_WITHDRAW = 50_000L;
    public static final long POINT_RATE = 1000L; // 1 điểm = 1.000 ₫
    public static final long DEFAULT_STAFF_SALARY = 15_000_000L; // Mặc định mỗi nhân viên văn phòng có lương 15 triệu
                                                                 // đồng

    private final Db db;
    private final OpsCore core;

    public WalletOps(Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    public static boolean isOfficeStaff(String role) {
        if (role == null)
            return false;
        return switch (role.toLowerCase()) {
            case "operator", "cashier", "support", "content" -> true;
            default -> false; // Admin và Customer không có lương nhân viên
        };
    }

    public static boolean isStaffRole(String role) {
        if (role == null)
            return false;
        return switch (role.toLowerCase()) {
            case "operator", "cashier", "support", "content", "admin", "guide" -> true;
            default -> false;
        };
    }

    public static boolean isGuide(String role) {
        return "guide".equalsIgnoreCase(role);
    }

    public static String roleIncomeTitle(String role) {
        if (role == null)
            return "Thu nhập cá nhân";
        return switch (role.toLowerCase()) {
            case "admin" -> "Quản trị viên (Không có thu nhập)";
            case "operator" -> "Lương quản lý điều hành tour";
            case "cashier" -> "Lương kế toán nghiệp vụ & quản lý quỹ";
            case "support" -> "Lương chuyên viên CSKH & giải quyết khiếu nại";
            case "content" -> "Lương biên tập viên & nhuận bút bài viết";
            case "guide" -> "Thù lao theo tour đã dẫn";
            default -> "Tài khoản khách hàng";
        };
    }

    public static String roleDisplayName(String role) {
        if (role == null)
            return "Khách hàng";
        return switch (role.toLowerCase()) {
            case "admin" -> "Quản trị viên";
            case "operator" -> "Điều hành tour";
            case "cashier" -> "Thu ngân";
            case "support" -> "Chăm sóc khách hàng";
            case "content" -> "Biên tập nội dung";
            case "guide" -> "Hướng dẫn viên";
            default -> "Khách hàng";
        };
    }

    private void updateAccount(String userId, Map<String, ?> fields) {
        db.edit("accounts", all -> {
            for (Map<String, Object> a : all) {
                if (userId.equals(Maps.str(a, "id"))) {
                    fields.forEach(a::put);
                    break;
                }
            }
        });
    }

    /**
     * Lấy thông tin ví và lịch sử rút tiền của người dùng hiện tại (chỉ nhân viên
     * có lương 15tr, HDV theo tour, khách hàng không có).
     */
    public Map<String, Object> getWallet(String userId) {
        if (userId == null || userId.isBlank())
            throw HttpError.unauthorized();
        Map<String, Object> acc = core.accounts.byId(userId);
        if (acc == null)
            throw HttpError.notFound("Không tìm thấy tài khoản");

        String role = Maps.str(acc, "role");
        if (role == null || role.isBlank())
            role = "user";

        long withdrawn = Maps.lng(acc, "totalWithdrawn");
        long bal;
        long earned;
        String incomeTitle = roleIncomeTitle(role);
        long defIncome = 0;

        if (isOfficeStaff(role)) {
            // Nhân viên văn phòng: cố định 15 triệu
            defIncome = DEFAULT_STAFF_SALARY;
            if (acc.get("balance") == null || (Maps.lng(acc, "balance") < DEFAULT_STAFF_SALARY && withdrawn == 0)) {
                long initBal = DEFAULT_STAFF_SALARY;
                updateAccount(userId, Map.of(
                        "balance", initBal,
                        "totalEarned", initBal,
                        "totalWithdrawn", 0L));
                acc = core.accounts.byId(userId);
            }
            bal = Maps.lng(acc, "balance");
            earned = Maps.lng(acc, "totalEarned");
        } else if (isGuide(role)) {
            // Hướng dẫn viên: thu nhập THEO TOUR hoàn thành (xác nhận tour để lấy tiền) + lương cứng (nếu có)
            String gid = Maps.str(acc, "guideId");
            if (gid.isEmpty()) {
                Map<String, Object> gp = Maps.map(acc.get("guideProfile"));
                if (gp != null) gid = Maps.str(gp, "guideId");
            }
            if (gid.isEmpty()) gid = userId;
            gid = core.canonGuide(gid);
            Map<String, Object> ge = core.rewards().guideEarnings(gid, null);
            long feePaid = Maps.lng(ge, "allPaid"); // tiền thù lao từ các tour đã được thu ngân xác nhận chi
            long pendingTour = Maps.lng(ge, "allPending"); // các tour đã hoàn thành nhưng đang chờ chi
            long accEarned = Maps.lng(acc, "totalEarned");
            earned = Math.max(feePaid, accEarned);
            if (earned == 0 && Maps.lng(acc, "baseSalary") > 0) {
                earned = Maps.lng(acc, "baseSalary");
            }
            bal = Math.max(0, earned - withdrawn);
            if (bal == 0 && Maps.lng(acc, "balance") > 0 && withdrawn == 0) {
                bal = Maps.lng(acc, "balance");
                earned = Math.max(earned, bal);
            }
            updateAccount(userId, Map.of(
                    "balance", bal,
                    "totalEarned", earned));
            incomeTitle = "Thù lao theo tour (" + ge.get("toursLed") + " tour đã dẫn · Chờ chi: "
                    + String.format("%,d", pendingTour).replace(',', '.') + " ₫)";
        } else {
            // Admin hoặc Khách hàng: Không có thu nhập/lương nhân viên
            bal = 0;
            earned = 0;
            incomeTitle = "admin".equalsIgnoreCase(role) ? "Quản trị viên (Không có thu nhập)" : "Tài khoản khách hàng";
        }

        long points = Maps.lng(acc, "points");

        List<Map<String, Object>> myWithdrawals = new ArrayList<>();
        withdrawn = 0;
        long pendingAmt = 0;
        String normUserId = userId != null ? userId.replace("_alias", "") : "";
        for (Map<String, Object> w : db.list("withdrawals")) {
            String uid = Maps.str(w, "userId");
            if (userId.equals(uid) || (!normUserId.isEmpty() && normUserId.equals(uid))) {
                myWithdrawals.add(w);
                if ("approved".equals(w.get("status"))) {
                    withdrawn += Maps.lng(w, "amount");
                } else if ("pending".equals(w.get("status"))) {
                    pendingAmt += Maps.lng(w, "amount");
                }
            }
        }
        myWithdrawals.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));

        // Lấy lịch sử phát lương và thù lao chi tiết
        List<Map<String, Object>> mySalaryLogs = new ArrayList<>();
        for (Map<String, Object> log : db.list("salary_logs")) {
            String sid = Maps.str(log, "staffId");
            if (userId.equals(sid) || (!normUserId.isEmpty() && normUserId.equals(sid))) {
                mySalaryLogs.add(log);
            }
        }
        if (isGuide(role)) {
            String gid = Maps.str(acc, "guideId");
            if (gid.isEmpty()) {
                Map<String, Object> gp = Maps.map(acc.get("guideProfile"));
                if (gp != null) gid = Maps.str(gp, "guideId");
            }
            if (gid.isEmpty()) gid = userId;
            gid = core.canonGuide(gid);
            Map<String, Object> ge = core.rewards().guideEarnings(gid, null);
            List<?> rawTrips = Maps.list(ge.get("items"));
            for (Object item : rawTrips) {
                if (item instanceof Map<?, ?> m) {
                    Map<String, Object> tr = (Map<String, Object>) m;
                    if (Maps.bool(tr, "paid")) {
                        mySalaryLogs.add(Maps.of(
                                "id", "fee_" + tr.get("bookingId"),
                                "type", "guide_fee",
                                "amount", tr.get("fee"),
                                "at", tr.get("paidAt") != null ? tr.get("paidAt") : tr.get("completedAt"),
                                "note", "Thù lao dẫn tour " + tr.get("tourName") + " (" + tr.get("payCode") + ")",
                                "byName", "Thu ngân"
                        ));
                    }
                }
            }
        }
        mySalaryLogs.sort((a, b) -> Maps.str(b, "at").compareTo(Maps.str(a, "at")));

        // Đảm bảo khớp 100% toán học: Số dư ví = Tổng thu nhập đã nhận - Tổng tiền đã rút
        bal = Math.max(0, earned - withdrawn);
        updateAccount(userId, Map.of(
                "balance", bal,
                "totalEarned", earned,
                "totalWithdrawn", withdrawn
        ));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("ok", true);
        res.put("userId", userId);
        res.put("userName", acc.get("name"));
        res.put("email", acc.get("email"));
        res.put("role", role);
        res.put("roleName", roleDisplayName(role));
        res.put("isStaff", isOfficeStaff(role) || isGuide(role));
        res.put("incomeTitle", incomeTitle);
        res.put("defaultIncome", defIncome);
        res.put("balance", bal);
        res.put("totalEarned", earned);
        res.put("totalWithdrawn", withdrawn);
        res.put("pendingWithdrawn", pendingAmt);
        res.put("points", points);
        res.put("pointValue", POINT_RATE);
        res.put("minWithdraw", MIN_WITHDRAW);
        res.put("withdrawals", myWithdrawals);
        res.put("salaryHistory", mySalaryLogs);
        return res;
    }

    /** Quy đổi điểm tích lũy thành số dư thu nhập tiền mặt. */
    public Map<String, Object> redeemPointsToBalance(String userId, long points) {
        if (points < 10)
            throw HttpError.bad("Quy đổi tối thiểu 10 điểm", "points");
        Map<String, Object> acc = core.accounts.byId(userId);
        if (acc == null)
            throw HttpError.unauthorized();

        long currentPoints = Maps.lng(acc, "points");
        if (currentPoints < points)
            throw HttpError.conflict("Bạn không đủ điểm để quy đổi", "points");

        long addMoney = points * POINT_RATE;
        long newPoints = currentPoints - points;
        long newBal = Maps.lng(acc, "balance") + addMoney;
        long newEarned = Maps.lng(acc, "totalEarned") + addMoney;

        updateAccount(userId, Map.of(
                "points", newPoints,
                "balance", newBal,
                "totalEarned", newEarned));

        core.audit.log(userId, Maps.str(acc, "name"), Maps.str(acc, "role"), "wallet.redeem_points", points + " điểm",
                "+" + addMoney + " ₫");
        core.notifyUser(
                userId, "💰 Quy đổi điểm thành công", "Bạn đã đổi " + points + " điểm thành +"
                        + String.format("%,d", addMoney) + " ₫ vào Ví thu nhập cá nhân.",
                "profile", "pts-conv-" + Ids.hex(3));

        return getWallet(userId);
    }

    /** Tạo yêu cầu rút tiền từ số dư thu nhập cá nhân. */
    public Map<String, Object> requestWithdrawal(String userId, long amount, String bankName, String accountNumber,
            String accountHolder, String note) {
        if (amount < MIN_WITHDRAW)
            throw HttpError.bad("Số tiền rút tối thiểu là " + String.format("%,d", MIN_WITHDRAW) + " ₫", "amount");
        if (bankName == null || bankName.trim().isEmpty())
            throw HttpError.bad("Vui lòng chọn hoặc nhập tên ngân hàng", "bankName");
        if (accountNumber == null || accountNumber.trim().isEmpty())
            throw HttpError.bad("Vui lòng nhập số tài khoản", "accountNumber");
        if (accountHolder == null || accountHolder.trim().isEmpty())
            throw HttpError.bad("Vui lòng nhập tên chủ tài khoản", "accountHolder");

        Map<String, Object> acc = core.accounts.byId(userId);
        if (acc == null)
            throw HttpError.unauthorized();

        String role = Maps.str(acc, "role");
        if (!isOfficeStaff(role) && !isGuide(role)) {
            throw HttpError.bad("Chức năng rút tiền thu nhập chỉ dành cho nhân viên và hướng dẫn viên", "role");
        }

        long curBal = Maps.lng(acc, "balance");
        if (curBal < amount)
            throw HttpError.bad("Số dư thu nhập không đủ (" + String.format("%,d", curBal) + " ₫) để rút "
                    + String.format("%,d", amount) + " ₫", "amount");

        // Trừ tiền khỏi số dư khả dụng
        long newBal = curBal - amount;
        updateAccount(userId, Map.of("balance", newBal));

        String id = Ids.newId("wd");
        Map<String, Object> rec = new LinkedHashMap<>();
        rec.put("id", id);
        rec.put("userId", userId);
        rec.put("userName", acc.get("name"));
        rec.put("userEmail", acc.get("email"));
        rec.put("amount", amount);
        rec.put("bankName", bankName.trim());
        rec.put("accountNumber", accountNumber.trim());
        rec.put("accountHolder", accountHolder.trim().toUpperCase());
        rec.put("note", note == null ? "" : note.trim());
        rec.put("status", "pending"); // pending | approved | rejected
        rec.put("createdAt", Times.iso(core.now()));

        db.edit("withdrawals", all -> all.add(rec));

        core.audit.log(userId, Maps.str(acc, "name"), Maps.str(acc, "role"), "wallet.withdraw", id,
                amount + " ₫ (" + bankName + ")");
        core.notifyRoles("💸 Yêu cầu rút tiền mới",
                Maps.str(acc, "name") + " yêu cầu rút " + String.format("%,d", amount) + " ₫ về " + bankName.trim(),
                "cashier.html#withdrawals", "wd-" + id, vn.travel.security.Role.CASHIER, vn.travel.security.Role.ADMIN);

        return Maps.of("ok", true, "withdrawal", rec, "wallet", getWallet(userId));
    }

    /** Danh sách yêu cầu rút tiền cho Thu ngân / Admin. */
    public List<Map<String, Object>> listWithdrawals(String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> w : db.list("withdrawals")) {
            if (status == null || status.isBlank() || status.equalsIgnoreCase(Maps.str(w, "status"))) {
                out.add(w);
            }
        }
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    /** Thu ngân duyệt chi tiền rút. */
    public Map<String, Object> approveWithdrawal(Actor cashier, String withdrawalId, String note) {
        final boolean[] found = { false };
        final Map<String, Object>[] hit = new Map[] { null };

        db.edit("withdrawals", all -> {
            for (Map<String, Object> w : all) {
                if (withdrawalId.equals(Maps.str(w, "id"))) {
                    if (!"pending".equals(w.get("status")))
                        throw HttpError.conflict("Yêu cầu này đã được xử lý", null);
                    w.put("status", "approved");
                    w.put("handledBy", cashier.id());
                    w.put("handledByName", cashier.name());
                    w.put("handledAt", Times.iso(core.now()));
                    w.put("adminNote", note == null ? "" : note.trim());
                    hit[0] = w;
                    found[0] = true;
                    break;
                }
            }
        });

        if (!found[0])
            throw HttpError.notFound("Không tìm thấy yêu cầu rút tiền");

        Map<String, Object> w = hit[0];
        String uid = Maps.str(w, "userId");
        long amt = Maps.lng(w, "amount");

        // Cập nhật tổng đã rút của tài khoản
        Map<String, Object> acc = core.accounts.byId(uid);
        if (acc != null) {
            updateAccount(uid, Map.of("totalWithdrawn", Maps.lng(acc, "totalWithdrawn") + amt));
        }

        // Ghi nhận chi trả rút tiền ví vào daily_revenues
        Map<String, Object> revRow = new LinkedHashMap<>();
        revRow.put("id", Ids.newId("dr"));
        revRow.put("date", core.today().toString());
        revRow.put("amount", -amt);
        revRow.put("kind", "withdrawal");
        revRow.put("kindLabel", "Chi rút tiền ví");
        revRow.put("customerName", Maps.str(w, "userName"));
        revRow.put("tourName", "Rút tiền về " + Maps.str(w, "bankName"));
        revRow.put("payCode", Maps.str(w, "id"));
        revRow.put("note", "Đã duyệt chi rút tiền về " + Maps.str(w, "bankName") + " (" + Maps.str(w, "accountNumber") + ")");
        revRow.put("source", "withdrawal");
        revRow.put("by", cashier.id());
        revRow.put("byName", cashier.name());
        revRow.put("byRole", cashier.role());
        revRow.put("createdAt", Times.iso(core.now()));
        revRow.put("at", Times.iso(core.now()));
        db.edit("daily_revenues", all -> all.add(revRow));

        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "wallet.withdraw.approve", withdrawalId,
                "Đã chi " + amt + " ₫");
        core.notifyUser(uid, "✅ Rút tiền thành công",
                "Yêu cầu rút " + String.format("%,d", amt) + " ₫ về " + Maps.str(w, "bankName") + " ("
                        + Maps.str(w, "accountNumber") + ") đã được chuyển khoản thành công.",
                "profile", "wd-appr-" + Ids.hex(3));

        return Maps.of("ok", true, "withdrawal", w);
    }

    /**
     * Thu ngân từ chối yêu cầu rút tiền -> hoàn lại số dư vào tài khoản người dùng.
     */
    public Map<String, Object> rejectWithdrawal(Actor cashier, String withdrawalId, String reason) {
        if (reason == null || reason.trim().length() < 3)
            throw HttpError.bad("Vui lòng nhập lý do từ chối", "reason");
        final boolean[] found = { false };
        final Map<String, Object>[] hit = new Map[] { null };

        db.edit("withdrawals", all -> {
            for (Map<String, Object> w : all) {
                if (withdrawalId.equals(Maps.str(w, "id"))) {
                    if (!"pending".equals(w.get("status")))
                        throw HttpError.conflict("Yêu cầu này đã được xử lý", null);
                    w.put("status", "rejected");
                    w.put("handledBy", cashier.id());
                    w.put("handledByName", cashier.name());
                    w.put("handledAt", Times.iso(core.now()));
                    w.put("rejectReason", reason.trim());
                    hit[0] = w;
                    found[0] = true;
                    break;
                }
            }
        });

        if (!found[0])
            throw HttpError.notFound("Không tìm thấy yêu cầu rút tiền");

        Map<String, Object> w = hit[0];
        String uid = Maps.str(w, "userId");
        long amt = Maps.lng(w, "amount");

        // Hoàn lại tiền vào số dư khả dụng
        Map<String, Object> acc = core.accounts.byId(uid);
        if (acc != null) {
            updateAccount(uid, Map.of("balance", Maps.lng(acc, "balance") + amt));
        }

        core.audit.log(cashier.id(), cashier.name(), cashier.role(), "wallet.withdraw.reject", withdrawalId,
                "Từ chối: " + reason.trim());
        core.notifyUser(
                uid, "❌ Yêu cầu rút tiền bị từ chối", "Yêu cầu rút " + String.format("%,d", amt) + " ₫ bị từ chối: "
                        + reason.trim() + ". Số tiền đã được hoàn lại vào Ví của bạn.",
                "profile", "wd-rej-" + Ids.hex(3));

        return Maps.of("ok", true, "withdrawal", w);
    }

    // ───────────────────────── Quản lý lương & phát lương của Admin
    // ─────────────────────────

    public static long getStaffBaseSalary(Map<String, Object> acc) {
        return StaffOps.getStaffBaseSalary(acc);
    }

    /** Danh sách nhân viên và bảng lương (mọi vai trò nội bộ). */
    public Map<String, Object> listStaffSalaries() {
        List<Map<String, Object>> staffList = new ArrayList<>();
        for (Map<String, Object> a : core.accounts.all()) {
            String role = Maps.str(a, "role");
            if (isStaffRole(role) && Accounts.isActive(a)) {
                Map<String, Object> item = new LinkedHashMap<>();
                String uid = Maps.str(a, "id");
                item.put("id", uid);
                item.put("name", a.get("name"));
                item.put("email", a.get("email"));
                item.put("role", role);
                item.put("roleName", roleDisplayName(role));
                item.put("incomeTitle", roleIncomeTitle(role));
                long curSal = getStaffBaseSalary(a);
                item.put("baseSalary", curSal);
                item.put("balance", Maps.lng(a, "balance"));
                item.put("totalEarned", Maps.lng(a, "totalEarned"));
                item.put("totalWithdrawn", Maps.lng(a, "totalWithdrawn"));
                item.put("lastPaidAt", a.get("lastPaidAt"));

                String startDate = Maps.str(a, "startDate");
                if (startDate.isEmpty()) {
                    String ca = Maps.str(a, "createdAt");
                    startDate = !ca.isEmpty() && ca.length() >= 10 ? ca.substring(0, 10) : "2020-01-15";
                }
                item.put("startDate", startDate);

                String nextReview = Maps.str(a, "nextReviewDate");
                if (nextReview.isEmpty()) {
                    try {
                        nextReview = java.time.LocalDate.parse(startDate).plusYears(1).toString();
                    } catch (Exception e) {
                        nextReview = core.today().plusYears(1).toString();
                    }
                }
                item.put("nextReviewDate", nextReview);
                try {
                    java.time.LocalDate nextLd = java.time.LocalDate.parse(nextReview);
                    long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(core.today(), nextLd);
                    item.put("daysUntilReview", daysUntil);
                    item.put("isDue", daysUntil <= 0);
                    item.put("isUpcoming", daysUntil > 0 && daysUntil <= 30);
                } catch (Exception e) {
                    item.put("daysUntilReview", 365L);
                    item.put("isDue", false);
                    item.put("isUpcoming", false);
                }

                Object kpiObj = a.get("kpiRecent");
                if (kpiObj == null) kpiObj = a.get("kpi");
                if (kpiObj != null) {
                    int kpi = (int) vn.travel.util.Pricing.num(kpiObj);
                    item.put("kpiRecent", kpi);
                    item.put("kpiRating", a.getOrDefault("kpiRating", StaffOps.kpiRating(kpi)));
                    item.put("expectedRaisePercent", StaffOps.kpiRaisePercent(kpi));
                    item.put("expectedNewSalary", StaffOps.calculateNewSalary(curSal, StaffOps.kpiRaisePercent(kpi)));
                } else {
                    item.put("kpiRecent", null);
                    item.put("kpiRating", null);
                    item.put("expectedRaisePercent", 0);
                    item.put("expectedNewSalary", curSal);
                }
                item.put("workingStatus", a.getOrDefault("workingStatus", "active"));

                staffList.add(item);
            }
        }

        List<Map<String, Object>> logs = new ArrayList<>(db.list("salary_logs"));
        logs.sort((x, y) -> Maps.str(y, "at").compareTo(Maps.str(x, "at")));
        if (logs.size() > 100)
            logs = logs.subList(0, 100);

        return Maps.of("ok", true, "staff", staffList, "logs", logs, "defaultSalary", DEFAULT_STAFF_SALARY);
    }

    /** Admin phát lương cho 1 nhân viên. */
    public Map<String, Object> paySalary(Actor admin, String staffUserId, Long customAmount, String note) {
        Map<String, Object> acc = core.accounts.byId(staffUserId);
        if (acc == null)
            throw HttpError.notFound("Không tìm thấy nhân viên");
        String role = Maps.str(acc, "role");
        if (!isStaffRole(role))
            throw HttpError.bad("Tài khoản này không thuộc nhóm nhân viên", "role");

        long base = getStaffBaseSalary(acc);
        long payAmt = (customAmount != null && customAmount > 0) ? customAmount : base;
        if (payAmt <= 0)
            throw HttpError.bad("Số tiền phát lương phải lớn hơn 0", "amount");

        long newBal = Maps.lng(acc, "balance") + payAmt;
        long newEarned = Maps.lng(acc, "totalEarned") + payAmt;
        String nowIso = Times.iso(core.now());

        updateAccount(staffUserId, Map.of(
                "balance", newBal,
                "totalEarned", newEarned,
                "lastPaidAt", nowIso));

        String logId = Ids.newId("slog");
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("id", logId);
        log.put("type", "pay");
        log.put("staffId", staffUserId);
        log.put("staffName", acc.get("name"));
        log.put("role", role);
        log.put("amount", payAmt);
        log.put("note", note == null ? "" : note.trim());
        log.put("by", admin.id());
        log.put("byName", admin.name());
        log.put("at", nowIso);
        db.edit("salary_logs", all -> all.add(log));

        // Trừ tiền khỏi doanh thu & quỹ công ty bằng việc ghi nhận chi lương vào daily_revenues
        Map<String, Object> revRow = new LinkedHashMap<>();
        revRow.put("id", Ids.newId("dr"));
        revRow.put("date", core.today().toString());
        revRow.put("amount", -payAmt);
        revRow.put("kind", "salary");
        revRow.put("kindLabel", "Chi trả lương");
        revRow.put("customerName", acc.get("name"));
        revRow.put("tourName", "Lương " + roleDisplayName(role));
        revRow.put("payCode", "SAL-" + staffUserId);
        revRow.put("note", note != null && !note.isBlank() ? note.trim() : "Chi trả lương nhân viên");
        revRow.put("source", "salary");
        revRow.put("by", admin.id());
        revRow.put("byName", admin.name());
        revRow.put("byRole", admin.role());
        revRow.put("createdAt", nowIso);
        revRow.put("at", nowIso);
        db.edit("daily_revenues", all -> all.add(revRow));

        core.audit.log(admin.id(), admin.name(), admin.role(), "salary.pay", Maps.str(acc, "name"),
                String.format("%,d", payAmt) + " ₫");
        core.notifyUser(staffUserId, "💵 Bạn đã được phát lương",
                "Ban Giám Đốc đã phát " + String.format("%,d", payAmt) + " ₫ vào Ví thu nhập."
                        + (note != null && !note.isBlank() ? " Lời nhắn: " + note.trim() : ""),
                "staff", "sal-pay-" + Ids.hex(3));

        return Maps.of("ok", true, "paidAmount", payAmt, "staffId", staffUserId, "balance", newBal);
    }

    /** Admin phát lương hàng loạt cho tất cả nhân viên văn phòng. */
    public Map<String, Object> payAllSalaries(Actor admin, String note) {
        List<Map<String, Object>> staffList = (List<Map<String, Object>>) listStaffSalaries().get("staff");
        int count = 0;
        long totalMoney = 0;

        for (Map<String, Object> st : staffList) {
            String uid = Maps.str(st, "id");
            long base = Maps.lng(st, "baseSalary");
            paySalary(admin, uid, base, note != null && !note.isBlank() ? note : "Phát lương định kỳ từ Ban Giám Đốc");
            count++;
            totalMoney += base;
        }

        return Maps.of("ok", true, "count", count, "totalAmount", totalMoney);
    }

    /** Admin tăng lương, trừ lương hoặc thưởng/phạt nhân viên. */
    public Map<String, Object> adjustSalary(Actor admin, String staffUserId, String action, long amount,
            String reason) {
        if (amount <= 0)
            throw HttpError.bad("Số tiền phải lớn hơn 0", "amount");
        if (reason == null || reason.trim().length() < 3)
            throw HttpError.bad("Vui lòng nhập lý do cụ thể", "reason");

        Map<String, Object> acc = core.accounts.byId(staffUserId);
        if (acc == null)
            throw HttpError.notFound("Không tìm thấy nhân viên");
        String role = Maps.str(acc, "role");
        if (!isStaffRole(role))
            throw HttpError.bad("Tài khoản này không thuộc nhóm nhân viên có thu nhập", "role");

        long base = getStaffBaseSalary(acc);
        long curBal = Maps.lng(acc, "balance");
        long curEarned = Maps.lng(acc, "totalEarned");
        String actDesc;
        String nowIso = Times.iso(core.now());

        switch (action.toLowerCase()) {
            case "increase" -> {
                // Tăng mức lương cơ bản
                long newBase = base + amount;
                updateAccount(staffUserId, Map.of("baseSalary", newBase));
                actDesc = "Tăng lương cơ bản +" + String.format("%,d", amount) + " ₫ (Mức lương mới: "
                        + String.format("%,d", newBase) + " ₫)";
            }
            case "decrease" -> {
                // Giảm mức lương cơ bản
                long newBase = Math.max(5_000_000L, base - amount);
                updateAccount(staffUserId, Map.of("baseSalary", newBase));
                actDesc = "Giảm lương cơ bản -" + String.format("%,d", amount) + " ₫ (Mức lương mới: "
                        + String.format("%,d", newBase) + " ₫)";
            }
            case "bonus" -> {
                // Thưởng trực tiếp vào ví
                long newBal = curBal + amount;
                long newEarned = curEarned + amount;
                updateAccount(staffUserId, Map.of("balance", newBal, "totalEarned", newEarned));
                actDesc = "Thưởng nóng +" + String.format("%,d", amount) + " ₫ vào Ví";

                // Chi tiền thưởng từ quỹ công ty
                Map<String, Object> revRow = new LinkedHashMap<>();
                revRow.put("id", Ids.newId("dr"));
                revRow.put("date", core.today().toString());
                revRow.put("amount", -amount);
                revRow.put("kind", "bonus");
                revRow.put("kindLabel", "Thưởng nóng");
                revRow.put("customerName", acc.get("name"));
                revRow.put("tourName", "Thưởng nóng nhân viên (" + roleDisplayName(role) + ")");
                revRow.put("payCode", "BON-" + staffUserId);
                revRow.put("note", reason.trim());
                revRow.put("source", "bonus");
                revRow.put("by", admin.id());
                revRow.put("byName", admin.name());
                revRow.put("byRole", admin.role());
                revRow.put("createdAt", nowIso);
                revRow.put("at", nowIso);
                db.edit("daily_revenues", all -> all.add(revRow));
            }
            case "fine" -> {
                // Phạt / trừ trực tiếp khỏi ví
                long newBal = curBal - amount;
                updateAccount(staffUserId, Map.of("balance", newBal));
                actDesc = "Trừ phạt -" + String.format("%,d", amount) + " ₫ từ Ví";

                // Thu phạt vào quỹ công ty
                Map<String, Object> revRow = new LinkedHashMap<>();
                revRow.put("id", Ids.newId("dr"));
                revRow.put("date", core.today().toString());
                revRow.put("amount", amount);
                revRow.put("kind", "fine");
                revRow.put("kindLabel", "Thu phạt vi phạm");
                revRow.put("customerName", acc.get("name"));
                revRow.put("tourName", "Phạt vi phạm quy chế");
                revRow.put("payCode", "FINE-" + staffUserId);
                revRow.put("note", reason.trim());
                revRow.put("source", "fine");
                revRow.put("by", admin.id());
                revRow.put("byName", admin.name());
                revRow.put("byRole", admin.role());
                revRow.put("createdAt", nowIso);
                revRow.put("at", nowIso);
                db.edit("daily_revenues", all -> all.add(revRow));
            }
            default -> throw HttpError.bad(
                    "Hành động phải là increase (tăng lương), decrease (trừ lương), bonus (thưởng) hoặc fine (phạt)",
                    "action");
        }

        String logId = Ids.newId("slog");
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("id", logId);
        log.put("type", action);
        log.put("staffId", staffUserId);
        log.put("staffName", acc.get("name"));
        log.put("role", role);
        log.put("amount", amount);
        log.put("reason", reason.trim());
        log.put("desc", actDesc);
        log.put("by", admin.id());
        log.put("byName", admin.name());
        log.put("at", nowIso);
        db.edit("salary_logs", all -> all.add(log));

        core.audit.log(admin.id(), admin.name(), admin.role(), "salary.adjust." + action, Maps.str(acc, "name"),
                actDesc + ": " + reason.trim());
        core.notifyUser(staffUserId, "💼 Quyết định lương thưởng",
                "Ban Giám Đốc đã " + actDesc + ". Lý do: " + reason.trim(), "staff", "sal-adj-" + Ids.hex(3));

        return Maps.of("ok", true, "action", action, "description", actDesc, "staffId", staffUserId);
    }

    /**
     * Admin gửi thông báo nhắc nhở nhân viên: ghi 1 lỗi và trừ 200.000 ₫ tiền
     * lương.
     */
    public Map<String, Object> remindStaff(Actor admin, String staffUserId, String title, String reason) {
        if (title == null || title.trim().isEmpty())
            throw HttpError.bad("Vui lòng nhập tiêu đề nhắc nhở", "title");
        if (reason == null || reason.trim().length() < 3)
            throw HttpError.bad("Vui lòng nhập lý do cụ thể", "reason");
        if (staffUserId == null || staffUserId.trim().isEmpty())
            throw HttpError.bad("Chưa chọn nhân viên", "staffId");
        if (staffUserId.equals(admin.id()))
            throw HttpError.conflict("Không thể tự nhắc nhở chính mình", null);

        Map<String, Object> acc = core.accounts.byId(staffUserId);
        if (acc == null)
            throw HttpError.notFound("Không tìm thấy nhân viên");

        // Ghi 1 lỗi (strike)
        int currentStrikes = acc.get("strikes") instanceof Number n ? n.intValue() : 0;
        int newStrikes = currentStrikes + 1;
        updateAccount(staffUserId, Map.of("strikes", newStrikes));

        // Tự động trừ 200.000 ₫ tiền lương
        long fineAmt = 200_000L;
        adjustSalary(admin, staffUserId, "fine", fineAmt,
                "Nhắc nhở vi phạm (lỗi #" + newStrikes + "): " + title.trim() + " - " + reason.trim());

        // Gửi thông báo đến nhân viên
        String notiTitle = "⚠️ Nhắc nhở vi phạm: " + title.trim();
        String notiBody = "Bạn bị ghi 1 lỗi vi phạm (Tổng cộng: " + newStrikes + " lỗi) và bị trừ "
                + String.format("%,d", fineAmt) + " ₫ tiền lương theo quy chế. Lý do: " + reason.trim();
        core.notifyUser(staffUserId, notiTitle, notiBody, "staff", "remind-" + Ids.hex(4));

        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.reminder_penalty", staffUserId,
                "Lỗi #" + newStrikes + " (-" + String.format("%,d", fineAmt) + " ₫): " + title.trim() + " - "
                        + reason.trim());

        return Maps.of("ok", true, "strikes", newStrikes, "fineAmount", fineAmt, "message",
                "Đã gửi thông báo nhắc nhở, ghi 1 lỗi và trừ 200.000 ₫ tiền lương.");
    }
}
