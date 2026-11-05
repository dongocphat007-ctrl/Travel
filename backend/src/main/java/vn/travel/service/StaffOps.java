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
 * Quản lý tài khoản nhân viên (TASKS giai đoạn 14) – CHỈ ADMIN. Tạo (tự nhập hoặc tự sinh mật khẩu), sửa, khóa/mở khóa, đặt lại mật khẩu,
 * đổi vai trò, xóa mềm; có ràng buộc "không còn việc dở" và không đụng được admin cuối cùng. Không ghi mật khẩu vào nhật ký.
 */
@Service
@SuppressWarnings("unchecked")
public class StaffOps {
    /** Vai trò admin được phép tạo (lấy từ enum Role: mọi vai trò nội bộ). */
    public static List<Map<String, Object>> creatableRoles() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Role r : Role.values()) if (r.isInternal()) out.add(Maps.of("key", r.getKey(), "name", r.getDisplayName(), "prefix", r.getPrefix()));
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
            if (!r.isInternal() || a.get("deletedAt") != null) continue;
            if (!needle.isEmpty() && !(Maps.str(a, "name") + " " + Maps.str(a, "email") + " " + Maps.str(a, "id") + " " + Maps.str(a, "phone")).toLowerCase().contains(needle)) continue;
            if (role != null && !role.isEmpty() && !r.getKey().equals(role)) continue;
            boolean locked = !Accounts.isActive(a);
            if ("locked".equals(status) && !locked) continue;
            if ("active".equals(status) && locked) continue;
            Map<String, Object> o = Accounts.pub(a);
            o.put("locked", locked);
            o.remove("permissions");
            if (r == Role.GUIDE) { Map<String, Object> g = core.guide(Maps.str(a, "guideId")); if (g != null) o.put("guide", Maps.of("guideType", OpsCore.guideTypeOf(g), "employmentType", g.get("employmentType"), "regions", g.get("regions"))); }
            out.add(o);
        }
        out.sort((a, b) -> Maps.str(a, "id").compareTo(Maps.str(b, "id")));
        return out;
    }

    // ───────────────────────── tạo ─────────────────────────
    /** Số thứ tự kế tiếp của tiền tố: tăng đơn điệu, không dùng lại số của tài khoản đã khóa/xóa. */
    private String nextId(Role r) {
        int[] n = {0};
        db.editObj("staffseq", m -> {
            long cur = Maps.lng(m, r.getKey());
            for (Map<String, Object> a : accounts.all()) {
                String id = Maps.str(a, "id");
                if (id.matches("^" + r.getPrefix() + "\\d+$")) cur = Math.max(cur, Long.parseLong(id.substring(r.getPrefix().length())));
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
        while (sb.length() < 10) sb.append(all.charAt(RNG.nextInt(all.length())));
        char[] c = sb.toString().toCharArray();
        for (int i = c.length - 1; i > 0; i--) { int j = RNG.nextInt(i + 1); char t = c[i]; c[i] = c[j]; c[j] = t; }
        return new String(c);
    }

    /**
     * Tạo nhân viên. Trả tài khoản + mật khẩu (CHỈ trả đúng lần này nếu auto). in: name, email?, phone?, role, auto (bool), password?, confirm?,
     * guide: {guideType, employmentType, regions}.
     */
    public Map<String, Object> create(Actor admin, Map<String, Object> in) {
        String name = Maps.str(in, "name").trim(), email = Maps.str(in, "email").trim().toLowerCase(), phone = Maps.str(in, "phone").trim();
        Role r = Role.from(in.get("role"));
        if (name.length() < 2 || name.length() > 80) throw HttpError.bad("Họ tên 2–80 ký tự", "name");
        if (!r.isInternal()) throw HttpError.bad("Vai trò không hợp lệ", "role");
        if (email.isEmpty() && phone.isEmpty()) throw HttpError.bad("Cần email hoặc số điện thoại", "email");
        if (!email.isEmpty() && !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw HttpError.bad("Email không hợp lệ", "email");
        if (!phone.isEmpty() && !phone.matches("^[0-9+ ]{9,15}$")) throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        boolean auto = !Boolean.FALSE.equals(in.get("auto"));
        String password;
        if (auto) password = randomPassword();
        else {
            password = Maps.str(in, "password");
            String problem = Accounts.passwordProblem(password, true);
            if (problem != null) throw HttpError.bad(problem, "password");
            if (!password.equals(Maps.str(in, "confirm"))) throw HttpError.bad("Mật khẩu xác nhận không khớp", "confirm");
        }
        if (!email.isEmpty() && accounts.byEmail(email) != null) throw new HttpError(409, "Email đã được dùng", "email");
        final String finalEmail = email;
        Map<String, Object> g = r == Role.GUIDE ? Maps.map(in.get("guide")) : null;
        String guideType = g == null ? "domestic" : Maps.str(g, "guideType"), employment = g == null ? "staff" : Maps.str(g, "employmentType");
        if (r == Role.GUIDE) {
            if (!Set.of("domestic", "international").contains(guideType)) throw HttpError.bad("Loại HDV phải là domestic hoặc international", "guideType");
            if (!Set.of("staff", "freelance").contains(employment)) throw HttpError.bad("Hình thức làm việc phải là staff hoặc freelance", "employmentType");
        }
        String id = nextId(r);
        String guideId = "g_" + id;
        Map<String, Object> acc = Maps.of("id", id, "name", name, "email", finalEmail.isEmpty() ? id + "@staff.travel.vn" : finalEmail, "phone", phone, "initials", Accounts.initials(name),
                "bg", "#0F766E", "provider", "local", "role", r.getKey(), "passHash", hasher.hash(password), "mustChangePassword", true, "createdAt", Times.iso(core.now()), "createdBy", admin.id());
        if (r == Role.GUIDE) acc.put("guideId", guideId);
        db.edit("accounts", all -> all.add(acc));
        if (r == Role.GUIDE) {
            List<Object> regions = g == null || !(g.get("regions") instanceof List<?> l) ? new ArrayList<>() : new ArrayList<>(l);
            db.edit("guides", all -> all.add(Maps.of("id", guideId, "name", name, "guideType", guideType, "employmentType", employment, "regions", regions, "status", "active",
                    "title", "international".equals(guideType) ? "Hướng dẫn viên quốc tế" : "Hướng dẫn viên", "busyDates", new ArrayList<>(), "rating", 0)));
        }
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.create", id, r.getKey() + (r == Role.GUIDE ? " " + guideType + "/" + employment : ""));
        Map<String, Object> out = Maps.of("ok", true, "user", Accounts.pub(acc), "loginId", id);
        if (auto) out.put("password", password);   // hiện đúng một lần
        return out;
    }

    // ───────────────────────── sửa / khóa / đổi vai trò / đặt lại / xóa ─────────────────────────
    private Map<String, Object> staff(String id) {
        Map<String, Object> a = accounts.byId(id);
        if (a == null || a.get("deletedAt") != null || !Role.from(a.get("role")).isInternal()) throw HttpError.notFound("Không tìm thấy nhân viên");
        return a;
    }

    public Map<String, Object> update(Actor admin, String id, Map<String, Object> in) {
        staff(id);
        String name = in.containsKey("name") ? Maps.str(in, "name").trim() : null, phone = in.containsKey("phone") ? Maps.str(in, "phone").trim() : null;
        if (name != null && (name.length() < 2 || name.length() > 80)) throw HttpError.bad("Họ tên 2–80 ký tự", "name");
        if (phone != null && !phone.isEmpty() && !phone.matches("^[0-9+ ]{9,15}$")) throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        String email = in.containsKey("email") ? Maps.str(in, "email").trim().toLowerCase() : null;
        if (email != null) {
            if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw HttpError.bad("Email không hợp lệ", "email");
            Map<String, Object> o = accounts.byEmail(email);
            if (o != null && !id.equals(Maps.str(o, "id"))) throw new HttpError(409, "Email đã được dùng", "email");
        }
        db.edit("accounts", all -> all.forEach(a -> {
            if (!id.equals(Maps.str(a, "id"))) return;
            if (name != null) { a.put("name", name); a.put("initials", Accounts.initials(name)); }
            if (phone != null) a.put("phone", phone);
            if (email != null) a.put("email", email);
        }));
        if (name != null) db.edit("guides", all -> all.forEach(g -> { if (Maps.str(staff(id), "guideId").equals(Maps.str(g, "id"))) g.put("name", name); }));
        Map<String, Object> gin = Maps.map(in.get("guide"));
        String gid = Maps.str(staff(id), "guideId");
        if (gin != null && !gid.isEmpty()) {
            db.edit("guides", all -> all.forEach(g -> {
                if (!gid.equals(Maps.str(g, "id"))) return;
                if (Set.of("domestic", "international").contains(Maps.str(gin, "guideType"))) g.put("guideType", gin.get("guideType"));
                if (Set.of("staff", "freelance").contains(Maps.str(gin, "employmentType"))) g.put("employmentType", gin.get("employmentType"));
                if (gin.get("regions") instanceof List<?> l) g.put("regions", new ArrayList<>(l));
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
                    if (gid.equals(core.canonGuide(Maps.str(b, "guideId"))) && Flow.active(st) && !Flow.COMPLETED.equals(st)) n++;
                }
                if (n > 0) out.add("còn " + n + " tour được giao – hãy gán lại HDV khác trước");
            }
            case SUPPORT -> {
                int n = 0;
                for (Map<String, Object> c : db.list("complaints")) if (id.equals(Maps.str(c, "assignee")) && "in_progress".equals(c.get("status"))) n++;
                if (n > 0) out.add("còn " + n + " khiếu nại đang xử lý – hãy chuyển người khác trước");
            }
            case CASHIER -> {
                int n = 0;
                for (Map<String, Object> r : db.list("reconciliations")) if (id.equals(Maps.str(r, "cashierId")) && "pending_approval".equals(r.get("status"))) n++;
                if (n > 0) out.add("còn " + n + " bản đóng sổ chưa được duyệt");
            }
            case ADMIN -> {
                int admins = 0;
                for (Map<String, Object> x : accounts.all()) if (Role.ADMIN.matches(x.get("role")) && Accounts.isActive(x)) admins++;
                if (admins <= 1 && Accounts.isActive(a)) out.add("đây là quản trị viên cuối cùng");
            }
            default -> { }
        }
        return out;
    }

    public Map<String, Object> setLocked(Actor admin, String id, boolean lock) {
        Map<String, Object> a = staff(id);
        if (lock) {
            if (id.equals(admin.id())) throw HttpError.conflict("Không thể tự khóa tài khoản của mình", null);
            List<String> work = pendingWork(a);
            if (!work.isEmpty()) throw new HttpError(409, "Không thể khóa: " + String.join("; ", work), "staff_busy");
        }
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(Maps.str(x, "id"))) return;
            if (lock) { x.put("status", "locked"); x.put("lockedAt", Times.iso(core.now())); }
            else { x.remove("status"); x.remove("lockedAt"); x.remove("failedLogins"); x.remove("lockUntil"); }
        }));
        if (lock) accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), lock ? "staff.lock" : "staff.unlock", id, "");
        return Accounts.pub(staff(id));
    }

    public Map<String, Object> changeRole(Actor admin, String id, String roleKey) {
        Map<String, Object> a = staff(id);
        Role to = Role.from(roleKey);
        if (!to.isInternal() || !to.getKey().equals(roleKey)) throw HttpError.bad("Vai trò không hợp lệ", "role");
        if (to == Role.from(a.get("role"))) throw HttpError.conflict("Nhân viên đã có vai trò này", null);
        if (id.equals(admin.id())) throw HttpError.conflict("Không thể tự đổi vai trò của mình", null);
        List<String> work = pendingWork(a);
        if (!work.isEmpty()) throw new HttpError(409, "Không thể đổi vai trò: " + String.join("; ", work), "staff_busy");
        if (to == Role.GUIDE && Maps.str(a, "guideId").isEmpty()) throw HttpError.bad("Hãy tạo tài khoản HDV mới thay vì đổi vai trò sang HDV", "role");
        String from = Maps.str(a, "role");
        db.edit("accounts", all -> all.forEach(x -> { if (id.equals(Maps.str(x, "id"))) x.put("role", to.getKey()); }));
        accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.role", id, from + " → " + to.getKey());
        return Accounts.pub(staff(id));
    }

    /** Đặt lại mật khẩu: tự sinh (trả một lần) hoặc nhập tay; buộc đổi ở lần đăng nhập đầu và thu hồi phiên cũ. */
    public Map<String, Object> resetPassword(Actor admin, String id, String password, String confirm) {
        staff(id);
        boolean auto = password == null || password.isEmpty();
        String pw = auto ? randomPassword() : password;
        if (!auto) {
            String problem = Accounts.passwordProblem(pw, true);
            if (problem != null) throw HttpError.bad(problem, "password");
            if (!pw.equals(confirm)) throw HttpError.bad("Mật khẩu xác nhận không khớp", "confirm");
        }
        String hash = hasher.hash(pw);
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(Maps.str(x, "id"))) return;
            x.put("passHash", hash);
            x.put("mustChangePassword", true);
            x.remove("failedLogins");
            x.remove("lockUntil");
        }));
        accounts.revokeTokens(id);
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.reset_password", id, auto ? "tự sinh" : "nhập tay");
        Map<String, Object> out = Maps.of("ok", true, "loginId", id);
        if (auto) out.put("password", pw);
        return out;
    }

    /** Xóa mềm: không xóa admin cuối cùng / chính mình / người còn việc dở. */
    public Map<String, Object> remove(Actor admin, String id) {
        Map<String, Object> a = staff(id);
        if (id.equals(admin.id())) throw HttpError.conflict("Không thể tự xóa tài khoản của mình", null);
        List<String> work = pendingWork(a);
        if (!work.isEmpty()) throw new HttpError(409, "Không thể xóa: " + String.join("; ", work), "staff_busy");
        db.edit("accounts", all -> all.forEach(x -> { if (id.equals(Maps.str(x, "id"))) { x.put("deletedAt", Times.iso(core.now())); x.put("status", "locked"); } }));
        accounts.revokeTokens(id);
        db.edit("guides", all -> all.forEach(g -> { if (Maps.str(a, "guideId").equals(Maps.str(g, "id"))) g.put("status", "off"); }));
        core.audit.log(admin.id(), admin.name(), admin.role(), "staff.delete", id, "");
        return Maps.of("ok", true);
    }
}
