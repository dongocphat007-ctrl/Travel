package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.security.SecureRandom;
import java.util.*;

/**
 * Quản lý tài khoản nhân viên (TASKS giai đoạn 14) – CHỈ ADMIN. Tạo (tự nhập
 * hoặc tự sinh mật khẩu), sửa, khóa/mở khóa, đặt lại mật khẩu,
 * đổi vai trò, xóa mềm; có ràng buộc "không còn việc dở" và không đụng được
 * admin cuối cùng. Không ghi mật khẩu vào nhật ký.
 */
@Service
@SuppressWarnings("unchecked")
public class StaffOps {
    /** Vai trò admin được phép tạo (lấy từ enum Role: mọi vai trò nội bộ). */
    public static List<Map<String, Object>> creatableRoles() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Role r : Role.values())
            if (r.isInternal())
                out.add(Maps.of("key", r.getKey(), "name", r.getDisplayName(), "prefix", r.getPrefix()));
        return out;
    }

    private static final SecureRandom RNG = new SecureRandom();
    private final Db db;
    private final Accounts accounts;
    private final PasswordHasher hasher;
    private final OpsCore core;

    public StaffOps(Db db, Accounts accounts, PasswordHasher hasher, OpsCore core) {
        this.db = db;
        this.accounts = accounts;
        this.hasher = hasher;
        this.core = core;
    }

    // ───────────────────────── danh sách ─────────────────────────
    public List<Map<String, Object>> list(String q, String role, String status) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> a : accounts.all()) {
            Role r = Role.from(a.get("role"));
            if (!r.isInternal() || a.get("deletedAt") != null)
                continue;
            if (!needle.isEmpty() && !(Maps.str(a, "name") + " " + Maps.str(a, "email") + " " + Maps.str(a, "id") + " "
                    + Maps.str(a, "phone")).toLowerCase().contains(needle))
                continue;
            if (role != null && !role.isEmpty() && !r.getKey().equals(role))
                continue;
            boolean locked = !Accounts.isActive(a);
            if ("locked".equals(status) && !locked)
                continue;
            if ("active".equals(status) && locked)
                continue;
            Map<String, Object> o = Accounts.pub(a);
            o.put("locked", locked);
            o.remove("permissions");
            if (r == Role.GUIDE) {
                Map<String, Object> g = core.guide(Maps.str(a, "guideId"));
                if (g != null)
                    o.put("guide", Maps.of("guideType", OpsCore.guideTypeOf(g), "employmentType",
                            g.get("employmentType"), "regions", g.get("regions")));
            }

            // Bổ sung thông tin quản lý nhân sự & lương chuẩn hóa
            long curSal = getStaffBaseSalary(a);
            o.put("baseSalary", curSal);
            String startDate = Maps.str(a, "startDate");
            if (startDate.isEmpty())
                startDate = "2025-11-06";
            o.put("startDate", startDate);

            String nextReview = Maps.str(a, "nextReviewDate");
            if (nextReview.isEmpty()) {
                try {
                    nextReview = java.time.LocalDate.parse(startDate).plusYears(1).toString();
                } catch (Exception e) {
                    nextReview = core.today().plusYears(1).toString();
                }
            }
            o.put("nextReviewDate", nextReview);
            try {
                java.time.LocalDate nextLd = java.time.LocalDate.parse(nextReview);
                long daysUntil = java.time.temporal.ChronoUnit.DAYS.between(core.today(), nextLd);
                o.put("daysUntilReview", daysUntil);
                o.put("isDue", daysUntil <= 0);
                o.put("isUpcoming", daysUntil > 0 && daysUntil <= 30);
            } catch (Exception e) {
                o.put("daysUntilReview", 365L);
                o.put("isDue", false);
                o.put("isUpcoming", false);
            }

            Object kpiObj = a.get("kpiRecent");
            if (kpiObj == null) kpiObj = a.get("kpi");
            if (kpiObj != null) {
                int kpi = (int) vn.travel.util.Pricing.num(kpiObj);
                o.put("kpiRecent", kpi);
                o.put("kpiRating", a.getOrDefault("kpiRating", kpiRating(kpi)));
                o.put("expectedRaisePercent", kpiRaisePercent(kpi));
                o.put("expectedNewSalary", calculateNewSalary(curSal, kpiRaisePercent(kpi)));
            } else {
                o.put("kpiRecent", null);
                o.put("kpiRating", null);
                o.put("expectedRaisePercent", 0);
                o.put("expectedNewSalary", curSal);
            }
            o.put("workingStatus", a.getOrDefault("workingStatus", locked ? "suspended" : "active"));

            out.add(o);
        }
        out.sort((a, b) -> Maps.str(a, "id").compareTo(Maps.str(b, "id")));
        return out;
    }

    // ───────────────────────── tạo ─────────────────────────
    /**
     * Số thứ tự kế tiếp của tiền tố: tăng đơn điệu, không dùng lại số của tài khoản
     * đã khóa/xóa.
     */
    private String nextId(Role r) {
        int[] n = { 0 };
        db.editObj("staffseq", m -> {
            long cur = Maps.lng(m, r.getKey());
            for (Map<String, Object> a : accounts.all()) {
                String id = Maps.str(a, "id");
                if (id.matches("^" + r.getPrefix() + "\\d+$"))
                    cur = Math.max(cur, Long.parseLong(id.substring(r.getPrefix().length())));
            }
            n[0] = (int) cur + 1;
            m.put(r.getKey(), n[0]);
        });
        return r.getPrefix() + String.format("%03d", n[0]);
    }

    static String randomPassword() {
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnpqrstuvwxyz";
        String digits = "23456789";
        String special = "@#$%&*!";
        String all = upper + lower + digits + special;
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(RNG.nextInt(upper.length())));
        sb.append(lower.charAt(RNG.nextInt(lower.length())));
        sb.append(digits.charAt(RNG.nextInt(digits.length())));
        sb.append(special.charAt(RNG.nextInt(special.length())));
        while (sb.length() < 10)
            sb.append(all.charAt(RNG.nextInt(all.length())));
        char[] c = sb.toString().toCharArray();
        for (int i = c.length - 1; i > 0; i--) {
            int j = RNG.nextInt(i + 1);
            char t = c[i];
            c[i] = c[j];
            c[j] = t;
        }
        return new String(c);
    }

    /**
     * Tạo nhân viên. Trả tài khoản + mật khẩu (CHỈ trả đúng lần này nếu auto). in:
     * name, email?, phone?, role, auto (bool), password?, confirm?,
     * guide: {guideType, employmentType, regions}.
     */
    public Map<String, Object> create(Actor admin, Map<String, Object> in) {
        String name = Maps.str(in, "name").trim(), email = Maps.str(in, "email").trim().toLowerCase(),
                phone = Maps.str(in, "phone").trim();
        Role r = Role.from(in.get("role"));
        if (name.length() < 2 || name.length() > 80)
            throw HttpError.bad("Họ tên 2–80 ký tự", "name");
        if (!r.isInternal())
            throw HttpError.bad("Vai trò không hợp lệ", "role");
        if (email.isEmpty() && phone.isEmpty())
            throw HttpError.bad("Cần email hoặc số điện thoại", "email");
        if (!email.isEmpty() && !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
            throw HttpError.bad("Email không hợp lệ", "email");
        if (!phone.isEmpty() && !phone.matches("^[0-9+ ]{9,15}$"))
            throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        boolean auto = !Boolean.FALSE.equals(in.get("auto"));
        String password;
        if (auto)
            password = randomPassword();
        else {
            password = Maps.str(in, "password");
            String problem = Accounts.passwordProblem(password, true);
            if (problem != null)
                throw HttpError.bad(problem, "password");
            if (!password.equals(Maps.str(in, "confirm")))
                throw HttpError.bad("Mật khẩu xác nhận không khớp", "confirm");
        }
        if (!email.isEmpty() && accounts.byEmail(email) != null)
            throw new HttpError(409, "Email đã được dùng", "email");
        final String finalEmail = email;
        Map<String, Object> g = r == Role.GUIDE ? Maps.map(in.get("guide")) : null;
        String guideType = g == null ? "domestic" : Maps.str(g, "guideType"),
                employment = g == null ? "staff" : Maps.str(g, "employmentType");
        if (r == Role.GUIDE) {
            if (!Set.of("domestic", "international").contains(guideType))
                throw HttpError.bad("Loại HDV phải là domestic hoặc international", "guideType");
            if (!Set.of("staff", "freelance").contains(employment))
                throw HttpError.bad("Hình thức làm việc phải là staff hoặc freelance", "employmentType");
        }
        String id = nextId(r);
        String guideId = "g_" + id;
        String startDate = Maps.str(in, "startDate").trim();
        if (startDate.isEmpty()) {
            startDate = core.today().toString();
        }
        long baseSalary = Math.round(vn.travel.util.Pricing.num(in.get("baseSalary")));
        if (baseSalary <= 0) {
            baseSalary = defaultBaseSalaryForRole(r.getKey());
        }
        java.time.LocalDate startLd;
        try {
            startLd = java.time.LocalDate.parse(startDate);
        } catch (Exception e) {
            startLd = core.today();
            startDate = startLd.toString();
        }
        String nextReviewDate = startLd.plusYears(1).toString();

        Map<String, Object> acc = Maps.of("id", id, "name", name, "email",
                finalEmail.isEmpty() ? id + "@staff.travel.vn" : finalEmail, "phone", phone, "initials",
                Accounts.initials(name),
                "bg", "#0F766E", "provider", "local", "role", r.getKey(), "passHash", hasher.hash(password),
                "mustChangePassword", true, "createdAt", Times.iso(core.now()), "createdBy", admin.id());
        acc.put("startDate", startDate);
        acc.put("baseSalary", baseSalary);
        acc.put("nextReviewDate", nextReviewDate);
        acc.put("workingStatus", "active");
        if (r == Role.GUIDE)
            acc.put("guideId", guideId);
        db.edit("accounts", all -> all.add(acc));

        // Bản ghi lương khởi điểm vào lịch sử lương
        String hid = vn.travel.util.Ids.newId("sh");
        Map<String, Object> initHist = new LinkedHashMap<>();
        initHist.put("id", hid);
        initHist.put("staffId", id);
        initHist.put("staffName", name);
        initHist.put("role", r.getKey());
        initHist.put("oldSalary", 0L);
        initHist.put("newSalary", baseSalary);
        initHist.put("increasePercent", 0.0);
        initHist.put("effectiveDate", startDate);
        initHist.put("reason", "Lương khởi điểm khi vào làm");
        initHist.put("type", "initial");
        initHist.put("approvedBy", admin.id());
        initHist.put("approvedByName", admin.name());
        initHist.put("createdAt", Times.iso(core.now()));
        db.edit("salary_history", all -> all.add(initHist));
        if (r == Role.GUIDE) {
            List<Object> regions = g == null || !(g.get("regions") instanceof List<?> l) ? new ArrayList<>()
                    : new ArrayList<>(l);
            db.edit("guides",
                    all -> all.add(Maps.of("id", guideId, "name", name, "guideType", guideType, "employmentType",
                            employment, "regions", regions, "status", "active",
                            "title", "international".equals(guideType) ? "Hướng dẫn viên quốc tế" : "Hướng dẫn viên",
                            "busyDates", new ArrayList<>(), "rating", 0)));
        }
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.create", id,
                r.getKey() + (r == Role.GUIDE ? " " + guideType + "/" + employment : ""));
        Map<String, Object> out = Maps.of("ok", true, "user", Accounts.pub(acc), "loginId", id);
        if (auto)
            out.put("password", password); // hiện đúng một lần
        return out;
    }

    // ───────────────────────── sửa / khóa / đổi vai trò / đặt lại / xóa
    // ─────────────────────────
    private Map<String, Object> staff(String id) {
        Map<String, Object> a = accounts.byId(id);
        if (a == null || a.get("deletedAt") != null || !Role.from(a.get("role")).isInternal())
            throw HttpError.notFound("Không tìm thấy nhân viên");
        return a;
    }

    public Map<String, Object> update(Actor admin, String id, Map<String, Object> in) {
        staff(id);
        String name = in.containsKey("name") ? Maps.str(in, "name").trim() : null,
                phone = in.containsKey("phone") ? Maps.str(in, "phone").trim() : null;
        if (name != null && (name.length() < 2 || name.length() > 80))
            throw HttpError.bad("Họ tên 2–80 ký tự", "name");
        if (phone != null && !phone.isEmpty() && !phone.matches("^[0-9+ ]{9,15}$"))
            throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        String email = in.containsKey("email") ? Maps.str(in, "email").trim().toLowerCase() : null;
        if (email != null) {
            if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))
                throw HttpError.bad("Email không hợp lệ", "email");
            Map<String, Object> o = accounts.byEmail(email);
            if (o != null && !id.equals(Maps.str(o, "id")))
                throw new HttpError(409, "Email đã được dùng", "email");
        }
        db.edit("accounts", all -> all.forEach(a -> {
            if (!id.equals(Maps.str(a, "id")))
                return;
            if (name != null) {
                a.put("name", name);
                a.put("initials", Accounts.initials(name));
            }
            if (phone != null)
                a.put("phone", phone);
            if (email != null)
                a.put("email", email);
            if (in.containsKey("startDate")) {
                String sd = Maps.str(in, "startDate").trim();
                if (!sd.isEmpty())
                    a.put("startDate", sd);
            }
            if (in.containsKey("workingStatus")) {
                String ws = Maps.str(in, "workingStatus").trim();
                if (!ws.isEmpty())
                    a.put("workingStatus", ws);
            }
            if (in.containsKey("nextReviewDate")) {
                String nrd = Maps.str(in, "nextReviewDate").trim();
                if (!nrd.isEmpty())
                    a.put("nextReviewDate", nrd);
            }
            if (in.containsKey("baseSalary")) {
                long bs = Math.round(vn.travel.util.Pricing.num(in.get("baseSalary")));
                if (bs > 0)
                    a.put("baseSalary", bs);
            }
        }));
        if (name != null)
            db.edit("guides", all -> all.forEach(g -> {
                if (Maps.str(staff(id), "guideId").equals(Maps.str(g, "id")))
                    g.put("name", name);
            }));
        Map<String, Object> gin = Maps.map(in.get("guide"));
        String gid = Maps.str(staff(id), "guideId");
        if (gin != null && !gid.isEmpty()) {
            db.edit("guides", all -> all.forEach(g -> {
                if (!gid.equals(Maps.str(g, "id")))
                    return;
                if (Set.of("domestic", "international").contains(Maps.str(gin, "guideType")))
                    g.put("guideType", gin.get("guideType"));
                if (Set.of("staff", "freelance").contains(Maps.str(gin, "employmentType")))
                    g.put("employmentType", gin.get("employmentType"));
                if (gin.get("regions") instanceof List<?> l)
                    g.put("regions", new ArrayList<>(l));
            }));
        }
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.update", id, String.join(",", in.keySet()));
        return Accounts.pub(staff(id));
    }

    /** Việc dở của nhân viên (rỗng = có thể khóa / đổi vai trò / xóa). */
    public List<String> pendingWork(Map<String, Object> a) {
        List<String> out = new ArrayList<>();
        String id = Maps.str(a, "id");
        switch (Role.from(a.get("role"))) {
            case GUIDE -> {
                String gid = core.canonGuide(Maps.str(a, "guideId"));
                int n = 0;
                for (Map<String, Object> b : core.bookings()) {
                    String st = Flow.norm(b.get("status"));
                    if (gid.equals(core.canonGuide(Maps.str(b, "guideId"))) && Flow.active(st)
                            && !Flow.COMPLETED.equals(st))
                        n++;
                }
                if (n > 0)
                    out.add("còn " + n + " tour được giao – hãy gán lại HDV khác trước");
            }
            case SUPPORT -> {
                int n = 0;
                for (Map<String, Object> c : db.list("complaints"))
                    if (id.equals(Maps.str(c, "assignee")) && "in_progress".equals(c.get("status")))
                        n++;
                if (n > 0)
                    out.add("còn " + n + " khiếu nại đang xử lý – hãy chuyển người khác trước");
            }
            case CASHIER -> {
                int n = 0;
                for (Map<String, Object> r : db.list("reconciliations"))
                    if (id.equals(Maps.str(r, "cashierId")) && "pending_approval".equals(r.get("status")))
                        n++;
                if (n > 0)
                    out.add("còn " + n + " bản đóng sổ chưa được duyệt");
            }
            case ADMIN -> {
                int admins = 0;
                for (Map<String, Object> x : accounts.all())
                    if (Role.ADMIN.matches(x.get("role")) && Accounts.isActive(x))
                        admins++;
                if (admins <= 1 && Accounts.isActive(a))
                    out.add("đây là quản trị viên cuối cùng");
            }
            default -> {
            }
        }
        return out;
    }

    public Map<String, Object> setLocked(Actor admin, String id, boolean lock) {
        Map<String, Object> a = staff(id);
        if (lock) {
            if (id.equals(admin.id()))
                throw HttpError.conflict("Không thể tự khóa tài khoản của mình", null);
            List<String> work = pendingWork(a);
            if (!work.isEmpty())
                throw new HttpError(409, "Không thể khóa: " + String.join("; ", work), "staff_busy");
        }
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(Maps.str(x, "id")))
                return;
            if (lock) {
                x.put("status", "locked");
                x.put("lockedAt", Times.iso(core.now()));
            } else {
                x.remove("status");
                x.remove("lockedAt");
                x.remove("failedLogins");
                x.remove("lockUntil");
            }
        }));
        if (lock)
            accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), lock ? "staff.lock" : "staff.unlock", id, "");
        return Accounts.pub(staff(id));
    }

    public Map<String, Object> changeRole(Actor admin, String id, String roleKey) {
        Map<String, Object> a = staff(id);
        Role to = Role.from(roleKey);
        if (!to.isInternal() || !to.getKey().equals(roleKey))
            throw HttpError.bad("Vai trò không hợp lệ", "role");
        if (to == Role.from(a.get("role")))
            throw HttpError.conflict("Nhân viên đã có vai trò này", null);
        if (id.equals(admin.id()))
            throw HttpError.conflict("Không thể tự đổi vai trò của mình", null);
        List<String> work = pendingWork(a);
        if (!work.isEmpty())
            throw new HttpError(409, "Không thể đổi vai trò: " + String.join("; ", work), "staff_busy");
        if (to == Role.GUIDE && Maps.str(a, "guideId").isEmpty())
            throw HttpError.bad("Hãy tạo tài khoản HDV mới thay vì đổi vai trò sang HDV", "role");
        String from = Maps.str(a, "role");
        db.edit("accounts", all -> all.forEach(x -> {
            if (id.equals(Maps.str(x, "id")))
                x.put("role", to.getKey());
        }));
        accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.role", id, from + " → " + to.getKey());
        return Accounts.pub(staff(id));
    }

    /**
     * Đặt lại mật khẩu: tự sinh (trả một lần) hoặc nhập tay; buộc đổi ở lần đăng
     * nhập đầu và thu hồi phiên cũ.
     */
    public Map<String, Object> resetPassword(Actor admin, String id, String password, String confirm) {
        staff(id);
        boolean auto = password == null || password.isEmpty();
        String pw = auto ? randomPassword() : password;
        if (!auto) {
            String problem = Accounts.passwordProblem(pw, true);
            if (problem != null)
                throw HttpError.bad(problem, "password");
            if (!pw.equals(confirm))
                throw HttpError.bad("Mật khẩu xác nhận không khớp", "confirm");
        }
        String hash = hasher.hash(pw);
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(Maps.str(x, "id")))
                return;
            x.put("passHash", hash);
            x.put("mustChangePassword", true);
            x.remove("failedLogins");
            x.remove("lockUntil");
        }));
        accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.reset_password", id,
                auto ? "tự sinh" : "nhập tay");
        Map<String, Object> out = Maps.of("ok", true, "loginId", id);
        if (auto)
            out.put("password", pw);
        return out;
    }

    /** Xóa mềm: không xóa admin cuối cùng / chính mình / người còn việc dở. */
    public Map<String, Object> remove(Actor admin, String id) {
        Map<String, Object> a = staff(id);
        if (id.equals(admin.id()))
            throw HttpError.conflict("Không thể tự xóa tài khoản của mình", null);
        List<String> work = pendingWork(a);
        if (!work.isEmpty())
            throw new HttpError(409, "Không thể xóa: " + String.join("; ", work), "staff_busy");
        db.edit("accounts", all -> all.forEach(x -> {
            if (id.equals(Maps.str(x, "id"))) {
                x.put("deletedAt", Times.iso(core.now()));
                x.put("status", "locked");
            }
        }));
        accounts.revokeTokens(id);
        db.edit("guides", all -> all.forEach(g -> {
            if (Maps.str(a, "guideId").equals(Maps.str(g, "id")))
                g.put("status", "off");
        }));
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.delete", id, "");
        return Maps.of("ok", true);
    }

    // ───────────────────────── NGHIỆP VỤ LƯƠNG, KPI & XÉT TĂNG LƯƠNG
    // ─────────────────────────

    public static long defaultBaseSalaryForRole(String role) {
        if (role == null)
            return 8_500_000L;
        return switch (role.toLowerCase()) {
            case "operator" -> 12_000_000L;
            case "content" -> 10_000_000L;
            case "cashier", "support" -> 8_500_000L;
            case "admin" -> 20_000_000L;
            default -> 8_500_000L;
        };
    }

    public static long getStaffBaseSalary(Map<String, Object> acc) {
        if (acc == null)
            return 8_500_000L;
        if (acc.get("baseSalary") != null) {
            long bs = Math.round(vn.travel.util.Pricing.num(acc.get("baseSalary")));
            if (bs > 0)
                return bs;
        }
        return defaultBaseSalaryForRole(Maps.str(acc, "role"));
    }

    public static String kpiRating(int kpi) {
        if (kpi >= 90)
            return "Xuất sắc";
        if (kpi >= 80)
            return "Tốt";
        if (kpi >= 70)
            return "Khá";
        if (kpi >= 60)
            return "Đạt";
        return "Không đạt";
    }

    public static int kpiRaisePercent(int kpi) {
        if (kpi >= 90)
            return 10;
        if (kpi >= 80)
            return 7;
        if (kpi >= 70)
            return 5;
        if (kpi >= 60)
            return 3;
        return 0;
    }

    public static long calculateNewSalary(long currentSalary, int percent) {
        if (percent <= 0)
            return currentSalary;
        double factor = 1.0 + (percent / 100.0);
        long raw = Math.round(currentSalary * factor);
        return Math.round(raw / 1000.0) * 1000L;
    }

    public Map<String, Object> evaluateKpi(Actor admin, String id, int kpi, String period, String note) {
        if (kpi < 0 || kpi > 100)
            throw HttpError.bad("Điểm KPI phải từ 0% đến 100%", "kpi");
        Map<String, Object> a = staff(id);
        String rating = kpiRating(kpi);
        int raisePct = kpiRaisePercent(kpi);
        String nowIso = Times.iso(core.now());
        String prd = (period == null || period.trim().isEmpty()) ? "Kỳ đánh giá " + core.today().getYear()
                : period.trim();
        String nt = note == null ? "" : note.trim();

        db.edit("accounts", all -> {
            for (Map<String, Object> acc : all) {
                if (id.equals(Maps.str(acc, "id"))) {
                    acc.put("kpiRecent", kpi);
                    acc.put("kpiRating", rating);
                    acc.put("kpiPeriod", prd);
                    acc.put("kpiEvaluatedAt", nowIso);
                    acc.put("kpiEvaluatedBy", admin.id());
                    acc.put("kpiEvaluatedByName", admin.name());
                    acc.put("kpiNote", nt);
                    break;
                }
            }
        });

        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.kpi_eval", id,
                kpi + "% (" + rating + ") - " + prd + (nt.isEmpty() ? "" : ": " + nt));
        core.notifyUser(id, "🎯 Kết quả đánh giá KPI",
                "Bạn đạt " + kpi + "% (" + rating + ") trong " + prd
                        + (raisePct > 0 ? " · Dự kiến tăng lương +" + raisePct + "%"
                                : " · Chưa đạt điều kiện tăng lương"),
                "staff", "kpi-" + id);

        return getSalaryProfile(id);
    }

    public Map<String, Object> reviewSalary(Actor admin, String id, String note) {
        Map<String, Object> a = staff(id);
        if (a.get("deletedAt") != null || "resigned".equals(a.get("workingStatus"))) {
            throw HttpError.bad("Nhân viên đã nghỉ việc, không thể xét tăng lương", "workingStatus");
        }
        Object kpiObj = a.get("kpiRecent");
        if (kpiObj == null) {
            throw HttpError.bad(
                    "Nhân viên chưa có kết quả đánh giá KPI. Vui lòng đánh giá KPI trước khi xét tăng lương.", "kpi");
        }
        int kpi = (int) vn.travel.util.Pricing.num(kpiObj);
        int raisePct = kpiRaisePercent(kpi);
        String rating = kpiRating(kpi);
        long curSal = getStaffBaseSalary(a);
        String nowIso = Times.iso(core.now());
        java.time.LocalDate today = core.today();

        long newSal = curSal;
        String reason;
        if (raisePct > 0) {
            newSal = calculateNewSalary(curSal, raisePct);
            reason = "Xét tăng lương định kỳ 12 tháng (KPI " + kpi + "% - " + rating + ", +" + raisePct + "%)";
        } else {
            reason = "Xét định kỳ 12 tháng: Giữ nguyên mức lương (KPI " + kpi + "% - Không đạt)";
        }
        if (note != null && !note.trim().isEmpty()) {
            reason += " · " + note.trim();
        }

        final long finalNewSal = newSal;
        final String nextReview = today.plusYears(1).toString();
        final String effective = today.toString();
        final String finalReason = reason;

        db.edit("accounts", all -> {
            for (Map<String, Object> acc : all) {
                if (id.equals(Maps.str(acc, "id"))) {
                    acc.put("baseSalary", finalNewSal);
                    acc.put("lastReviewDate", effective);
                    acc.put("nextReviewDate", nextReview);
                    break;
                }
            }
        });

        // Tạo bản ghi lịch sử lương (Không ghi đè, lưu vĩnh viễn)
        String hid = vn.travel.util.Ids.newId("sh");
        Map<String, Object> hist = new LinkedHashMap<>();
        hist.put("id", hid);
        hist.put("staffId", id);
        hist.put("staffName", a.get("name"));
        hist.put("role", a.get("role"));
        hist.put("oldSalary", curSal);
        hist.put("newSalary", finalNewSal);
        hist.put("increasePercent", raisePct);
        hist.put("kpi", kpi);
        hist.put("kpiRating", rating);
        hist.put("effectiveDate", effective);
        hist.put("reason", finalReason);
        hist.put("type", "regular");
        hist.put("approvedBy", admin.id());
        hist.put("approvedByName", admin.name());
        hist.put("createdAt", nowIso);

        db.edit("salary_history", all -> all.add(hist));

        // Ghi vào salary_logs để đồng bộ giao diện quỹ lương
        Map<String, Object> slog = new LinkedHashMap<>();
        slog.put("id", vn.travel.util.Ids.newId("slog"));
        slog.put("type", "increase");
        slog.put("staffId", id);
        slog.put("staffName", a.get("name"));
        slog.put("role", a.get("role"));
        slog.put("amount", finalNewSal - curSal);
        slog.put("reason", finalReason);
        slog.put("desc", finalReason + " (Lương mới: " + String.format("%,d", finalNewSal) + " ₫)");
        slog.put("by", admin.id());
        slog.put("byName", admin.name());
        slog.put("at", nowIso);
        db.edit("salary_logs", all -> all.add(slog));

        core.audit.log(admin.id(), admin.name(), admin.role(), "salary.regular_raise", id,
                String.format("%,d", curSal) + " → " + String.format("%,d", finalNewSal) + " ₫ (+" + raisePct + "%)");
        core.notifyUser(id, "📈 Thông báo điều chỉnh lương định kỳ",
                raisePct > 0
                        ? ("Mức lương mới của bạn là " + String.format("%,d", finalNewSal) + " ₫/tháng (+" + raisePct
                                + "%). Ngày xét lương tiếp theo: " + nextReview)
                        : "Mức lương của bạn được giữ nguyên do kết quả KPI chưa đạt điều kiện tăng lương. Ngày xét tiếp theo: "
                                + nextReview,
                "staff", "sal-rev-" + hid);

        return Maps.of("ok", true, "staffId", id, "oldSalary", curSal, "newSalary", finalNewSal, "increasePercent",
                raisePct, "nextReviewDate", nextReview, "history", hist);
    }

    public Map<String, Object> earlyRaiseSalary(Actor admin, String id, long newSalary, String reasonType,
            String reason, String effectiveDate) {
        Map<String, Object> a = staff(id);
        long curSal = getStaffBaseSalary(a);
        if (newSalary <= 0)
            throw HttpError.bad("Mức lương mới phải lớn hơn 0", "newSalary");
        if (reason == null || reason.trim().length() < 3)
            throw HttpError.bad("Vui lòng nhập lý do cụ thể", "reason");

        java.time.LocalDate effLd;
        try {
            effLd = (effectiveDate != null && !effectiveDate.isBlank())
                    ? java.time.LocalDate.parse(effectiveDate.trim())
                    : core.today();
        } catch (Exception e) {
            effLd = core.today();
        }
        final java.time.LocalDate finalEffLd = effLd;

        double diff = newSalary - curSal;
        double pct = curSal > 0 ? Math.round((diff / curSal) * 1000.0) / 10.0 : 0.0;
        String nowIso = Times.iso(core.now());
        String typeLabel = switch (reasonType == null ? "" : reasonType.toLowerCase()) {
            case "promotion" -> "Thăng chức";
            case "outstanding" -> "Thành tích nổi bật";
            case "responsibility" -> "Đảm nhận thêm trách nhiệm";
            case "position_adjustment" -> "Điều chỉnh vị trí";
            default -> "Tăng lương trước hạn";
        };
        String fullReason = typeLabel + ": " + reason.trim();
        final String nextReview = finalEffLd.plusYears(1).toString();

        db.edit("accounts", all -> {
            for (Map<String, Object> acc : all) {
                if (id.equals(Maps.str(acc, "id"))) {
                    acc.put("baseSalary", newSalary);
                    acc.put("lastReviewDate", finalEffLd.toString());
                    acc.put("nextReviewDate", nextReview);
                    break;
                }
            }
        });

        // Ghi bản ghi lịch sử lương
        String hid = vn.travel.util.Ids.newId("sh");
        Map<String, Object> hist = new LinkedHashMap<>();
        hist.put("id", hid);
        hist.put("staffId", id);
        hist.put("staffName", a.get("name"));
        hist.put("role", a.get("role"));
        hist.put("oldSalary", curSal);
        hist.put("newSalary", newSalary);
        hist.put("increasePercent", pct);
        hist.put("effectiveDate", effLd.toString());
        hist.put("reason", fullReason);
        hist.put("reasonType", reasonType);
        hist.put("type", "early");
        hist.put("approvedBy", admin.id());
        hist.put("approvedByName", admin.name());
        hist.put("createdAt", nowIso);

        db.edit("salary_history", all -> all.add(hist));

        // Ghi vào salary_logs
        Map<String, Object> slog = new LinkedHashMap<>();
        slog.put("id", vn.travel.util.Ids.newId("slog"));
        slog.put("type", "increase");
        slog.put("staffId", id);
        slog.put("staffName", a.get("name"));
        slog.put("role", a.get("role"));
        slog.put("amount", newSalary - curSal);
        slog.put("reason", fullReason);
        slog.put("desc", fullReason + " (Mức lương mới: " + String.format("%,d", newSalary) + " ₫, +" + pct + "%)");
        slog.put("by", admin.id());
        slog.put("byName", admin.name());
        slog.put("at", nowIso);
        db.edit("salary_logs", all -> all.add(slog));

        core.audit.log(admin.id(), admin.name(), admin.role(), "salary.early_raise", id,
                String.format("%,d", curSal) + " → " + String.format("%,d", newSalary) + " ₫ (" + fullReason + ")");
        core.notifyUser(id, "🎉 Quyết định điều chỉnh lương",
                "Ban Giám Đốc đã quyết định điều chỉnh lương của bạn lên " + String.format("%,d", newSalary)
                        + " ₫/tháng (" + fullReason + "). Ngày xét lương tiếp theo: " + nextReview,
                "staff", "sal-er-" + hid);

        return Maps.of("ok", true, "staffId", id, "oldSalary", curSal, "newSalary", newSalary, "increasePercent", pct,
                "nextReviewDate", nextReview, "history", hist);
    }

    public Map<String, Object> getSalaryProfile(String id) {
        Map<String, Object> a = staff(id);
        long curSal = getStaffBaseSalary(a);
        String role = Maps.str(a, "role");
        String startDate = Maps.str(a, "startDate");
        if (startDate.isEmpty()) {
            startDate = "2025-11-06";
        }
        String nextReview = Maps.str(a, "nextReviewDate");
        if (nextReview.isEmpty()) {
            try {
                nextReview = java.time.LocalDate.parse(startDate).plusYears(1).toString();
            } catch (Exception e) {
                nextReview = core.today().plusYears(1).toString();
            }
        }

        // Tính số ngày đến hạn xét lương
        long daysUntil = 365L;
        boolean isDue = false;
        boolean isUpcoming = false;
        try {
            java.time.LocalDate nextLd = java.time.LocalDate.parse(nextReview);
            java.time.LocalDate today = core.today();
            daysUntil = java.time.temporal.ChronoUnit.DAYS.between(today, nextLd);
            isDue = daysUntil <= 0;
            isUpcoming = daysUntil > 0 && daysUntil <= 30;
        } catch (Exception ignored) {
        }

        Object kpiObj = a.get("kpiRecent");
        if (kpiObj == null) kpiObj = a.get("kpi");
        Integer kpi = kpiObj != null ? (int) vn.travel.util.Pricing.num(kpiObj) : null;
        if (kpi == null) {
            kpi = 88;
        }
        String rating = kpiRating(kpi);
        int raisePct = kpiRaisePercent(kpi);
        long expNewSal = calculateNewSalary(curSal, raisePct);

        Map<String, Object> profile = new LinkedHashMap<>(Accounts.pub(a));
        profile.put("baseSalary", curSal);
        profile.put("startDate", startDate);
        profile.put("nextReviewDate", nextReview);
        profile.put("workingStatus", a.getOrDefault("workingStatus", (!Accounts.isActive(a)) ? "suspended" : "active"));
        profile.put("daysUntilReview", daysUntil);
        profile.put("isDue", isDue);
        profile.put("isUpcoming", isUpcoming);
        profile.put("kpiRecent", kpi);
        profile.put("kpiRating", rating);
        profile.put("kpiPeriod", a.getOrDefault("kpiPeriod", "Kỳ đánh giá 2026"));
        profile.put("kpiEvaluatedAt", a.get("kpiEvaluatedAt"));
        profile.put("kpiEvaluatedBy", a.get("kpiEvaluatedBy"));
        profile.put("kpiEvaluatedByName", a.get("kpiEvaluatedByName"));
        profile.put("kpiNote", a.get("kpiNote"));
        profile.put("expectedRaisePercent", raisePct);
        profile.put("expectedNewSalary", expNewSal);

        // Lấy lịch sử lương của nhân viên này
        List<Map<String, Object>> hist = getSalaryHistory(id);

        return Maps.of("ok", true, "profile", profile, "history", hist);
    }

    public List<Map<String, Object>> getSalaryHistory(String staffId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String normalizedId = staffId == null ? "" : staffId.replace("_alias", "");
        for (Map<String, Object> h : db.list("salary_history")) {
            String hid = Maps.str(h, "staffId");
            if (staffId.equals(hid) || (!normalizedId.isEmpty() && normalizedId.equals(hid))) {
                list.add(h);
            }
        }
        list.sort((x, y) -> Maps.str(y, "effectiveDate").compareTo(Maps.str(x, "effectiveDate")));
        return list;
    }
}
