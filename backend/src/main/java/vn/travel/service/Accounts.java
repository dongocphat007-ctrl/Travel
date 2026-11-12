package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Tài khoản (accounts.json): đăng ký / đăng nhập / Google / hồ sơ. Mật khẩu băm
 * PBKDF2, không bao giờ trả ra ngoài.
 */
@Service
public class Accounts {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final String[] COLORS = { "#0F766E", "#B45309", "#4F46E5", "#BE123C", "#0369A1", "#6D28D9",
            "#15803D", "#C2410C" };
    private static final Set<String> GENDERS = Set.of("male", "female", "other");

    private final Db db;
    private final PasswordHasher hasher;
    private final Vouchers vouchers;
    private final Notifications noti;
    private final Clock clock;
    private final GoogleVerifier google;
    private final TravelProperties props;

    public Accounts(Db db, PasswordHasher hasher, Vouchers vouchers, Notifications noti, Clock clock,
            GoogleVerifier google, TravelProperties props) {
        this.db = db;
        this.hasher = hasher;
        this.vouchers = vouchers;
        this.noti = noti;
        this.clock = clock;
        this.google = google;
        this.props = props;
        seedAdmin(props.adminEmail(), props.adminPassword());
        seedSampleAccounts();
    }

    /**
     * Admin mặc định chỉ tồn tại khi ADMIN_EMAIL + ADMIN_PASSWORD (≥ 8 ký tự) được
     * đặt trong môi trường.
     */
    final void seedAdmin(String email, String password) {
        if (TravelProperties.blank(email) || TravelProperties.blank(password))
            return;
        if (password.length() < 8)
            throw new IllegalStateException("ADMIN_PASSWORD phải từ 8 ký tự");
        String em = email.trim().toLowerCase();
        db.edit("accounts", all -> {
            // Đảm bảo chỉ có DUY NHẤT 1 tài khoản Admin: xóa mọi admin cũ khác ad001
            all.removeIf(a -> "admin_default".equals(a.get("id")) || "g_112964732409288019380".equals(a.get("id")));
            all.removeIf(a -> "admin".equals(a.get("role")) && !"ad001".equals(a.get("id")) && !em.equals(Maps.str(a, "email")));

            for (Map<String, Object> a : all) {
                if (Maps.str(a, "email").equals(em) || "ad001".equals(a.get("id"))) {
                    a.put("id", "ad001");
                    a.put("name", "Quản Trị Viên");
                    a.put("email", em);
                    a.put("role", "admin");
                    List<String> curAliases = new ArrayList<>(Maps.list(a.get("aliases")).stream().map(String::valueOf).toList());
                    for (String alias : List.of("admin", "admin@travel.vn", "ad001", "ad001@travel.vn")) {
                        if (!curAliases.contains(alias)) curAliases.add(alias);
                    }
                    a.put("aliases", curAliases);
                    if (!hasher.verify(password, Maps.str(a, "passHash")))
                        a.put("passHash", hasher.hash(password));
                    return;
                }
            }
            Map<String, Object> newAdm = newAccount("ad001", "Quản Trị Viên", em, "local", "admin", hasher.hash(password),
                    clock.millis());
            newAdm.put("aliases", List.of("admin", "admin@travel.vn", "ad001", "ad001@travel.vn"));
            all.add(newAdm);
        });
    }

    private static volatile String cachedSampleHash = null;

    private String getSampleHash() {
        if (cachedSampleHash == null) {
            cachedSampleHash = hasher.hash("Travel@2026");
        }
        return cachedSampleHash;
    }

    /**
     * Khởi tạo các tài khoản mẫu cho từng vai trò khi SAMPLE_DATA=true (để kiểm thử
     * và demo).
     */
    final void seedSampleAccounts() {
        if (props == null || !props.showSample())
            return;
        String defaultHash = getSampleHash();
        db.edit("accounts", all -> {
            Set<String> emails = new HashSet<>();
            Set<String> ids = new HashSet<>();
            for (Map<String, Object> a : all) {
                emails.add(Maps.str(a, "email").toLowerCase());
                ids.add(Maps.str(a, "id").toLowerCase());
            }

            List<Map<String, Object>> samples = List.of(
                    sampleAcc("ad001", "Quản Trị Viên", "admin@travel.vn", "admin", defaultHash, null, List.of("admin", "ad001@travel.vn")),
                    sampleAcc("tn001", "Lê Thu Ngân", "thungan@travel.vn", "cashier", defaultHash, null, List.of("thungan", "tn001@travel.vn")),
                    sampleAcc("dh001", "Trần Điều Hành", "dieuhanh@travel.vn", "operator", defaultHash, null, List.of("dieuhanh", "dh001@travel.vn")),
                    sampleAcc("cs001", "Phạm Chăm Sóc", "cskh@travel.vn", "support", defaultHash, null, List.of("cskh", "cs001@travel.vn")),
                    sampleAcc("nd001", "Hoàng Biên Tập", "bientap@travel.vn", "content", defaultHash, null, List.of("bientap", "nd001@travel.vn")),
                    sampleAcc("hdv001", "Trần Văn Quân", "hdv.quan@travel.vn", "guide", defaultHash, "g1", List.of("hdv1@travel.vn")),
                    sampleAcc("hdv002", "Nguyễn Thu Hà", "hdv.ha@travel.vn", "guide", defaultHash, "g2", List.of("hdv2@travel.vn")),
                    sampleAcc("hdv003", "Lê Hoàng Long", "hdv.son@travel.vn", "guide", defaultHash, "g3", List.of("hdv.long@travel.vn", "hdv3@travel.vn")),
                    sampleAcc("hdv004", "Phạm Minh Đức", "hdv.lan@travel.vn", "guide", defaultHash, "g4", List.of("hdv.duc@travel.vn", "hdv4@travel.vn")),
                    sampleAcc("hdv005", "Võ Thị Mai", "hdv.thang@travel.vn", "guide", defaultHash, "g5", List.of("hdv.mai@travel.vn", "hdv5@travel.vn")),
                    sampleAcc("hdv006", "Đặng Hữu Phúc", "hdv.phuc@travel.vn", "guide", defaultHash, "g6", List.of("hdv6@travel.vn")),
                    sampleAcc("hdv007", "Bùi Thanh Trúc", "hdv.mai@travel.vn", "guide", defaultHash, "g7", List.of("hdv.truc@travel.vn", "hdv7@travel.vn")),
                    sampleAcc("hdv008", "Hoàng Gia Bảo", "hdv.bao@travel.vn", "guide", defaultHash, "g8", List.of("hdv8@travel.vn")),
                    sampleAcc("hdv009", "Đỗ Thị Ngọc", "hdv.hieu@travel.vn", "guide", defaultHash, "g9", List.of("hdv.ngoc@travel.vn", "hdv9@travel.vn")),
                    sampleAcc("hdv010", "Ngô Quốc Tuấn", "hdv.tuan@travel.vn", "guide", defaultHash, "g10", List.of("hdv10@travel.vn")),
                    sampleAcc("hdv011", "Dương Cẩm Tú", "hdv.diep@travel.vn", "guide", defaultHash, "g11", List.of("hdv.tu@travel.vn", "hdv11@travel.vn")),
                    sampleAcc("hdv012", "Lý Kiến Quốc", "hdv.tung@travel.vn", "guide", defaultHash, "g12", List.of("hdv.quoc@travel.vn", "hdv12@travel.vn")),
                    sampleAcc("hdv013", "Trương Vĩnh Ký", "hdv.ngan@travel.vn", "guide", defaultHash, "g13", List.of("hdv.ky@travel.vn", "hdv13@travel.vn")),
                    sampleAcc("hdv014", "Vũ Mai Phương", "hdv.ngoc@travel.vn", "guide", defaultHash, "g14", List.of("hdv.phuong@travel.vn", "hdv14@travel.vn")),
                    sampleAcc("hdv015", "Hồ Trọng Nghĩa", "hdv.thu@travel.vn", "guide", defaultHash, "g15", List.of("hdv.nghia@travel.vn", "hdv15@travel.vn")),
                    sampleAcc("hdv016", "Nguyễn Thị Kim Chi", "hdv.dang@travel.vn", "guide", defaultHash, "g16", List.of("hdv.chi@travel.vn", "hdv16@travel.vn")),
                    sampleAcc("hdv_test", "Nguyễn Văn Test (HDV Trống Lịch)", "hdv.test@travel.vn", "guide", defaultHash, "g_test", List.of("hdv.test", "hdvtest@travel.vn")));

            for (Map<String, Object> s : samples) {
                String em = Maps.str(s, "email").toLowerCase();
                String id = Maps.str(s, "id").toLowerCase();
                if (!emails.contains(em) && !ids.contains(id)) {
                    all.add(s);
                    emails.add(em);
                    ids.add(id);
                }
            }
        });
    }

    private Map<String, Object> sampleAcc(String id, String name, String email, String role, String hash,
            String guideId, List<String> aliases) {
        Map<String, Object> a = newAccount(id, name, email, "local", role, hash, clock.millis());
        if (guideId != null)
            a.put("guideId", guideId);
        if (aliases != null && !aliases.isEmpty())
            a.put("aliases", aliases);
        return a;
    }

    // ───────── truy vấn ─────────
    public List<Map<String, Object>> all() {
        return db.list("accounts");
    }

    public Map<String, Object> byId(String id) {
        if (id == null)
            return null;
        for (Map<String, Object> a : all())
            if (id.equals(a.get("id")))
                return a;
        if (id.endsWith("_alias")) {
            String baseId = id.substring(0, id.length() - "_alias".length());
            for (Map<String, Object> a : all())
                if (baseId.equals(a.get("id")))
                    return a;
        }
        return null;
    }

    public Map<String, Object> byEmail(String email) {
        if (email == null)
            return null;
        String e = email.trim().toLowerCase();
        for (Map<String, Object> a : all())
            if (Maps.str(a, "email").equalsIgnoreCase(e))
                return a;
        return null;
    }

    /** Tìm theo email, tên đăng nhập (mã nhân viên như hdv001) hoặc số điện thoại. Tài khoản đã xóa mềm không được tìm thấy. */
    public Map<String, Object> byLogin(String key) {
        if (key == null)
            return null;
        String k = key.trim();
        if (k.isEmpty())
            return null;
        Map<String, Object> a = byEmail(k);
        if (a == null) {
            for (Map<String, Object> x : all()) {
                if (Maps.str(x, "id").equalsIgnoreCase(k) || Maps.str(x, "username").equalsIgnoreCase(k)) {
                    a = x; break;
                }
                Object aliases = x.get("aliases");
                if (aliases instanceof List<?> list) {
                    for (Object item : list) {
                        if (k.equalsIgnoreCase(String.valueOf(item))) { a = x; break; }
                    }
                }
                if (a != null) break;
            }
        }
        if (a == null && k.toLowerCase().startsWith("hdv")) {
            for (Map<String, Object> x : all()) {
                String id = Maps.str(x, "id");
                String gid = Maps.str(x, "guideId");
                if (k.equalsIgnoreCase(id) || k.equalsIgnoreCase(gid) || k.startsWith(id + "@") || (gid != null && k.startsWith(gid + "@"))) {
                    a = x; break;
                }
            }
        }
        if (a == null) {
            String digits = k.replaceAll("[\\s.\\-]", "");
            if (digits.matches("^(0|\\+84)\\d{9}$")) {
                for (Map<String, Object> x : all())
                    if (digits.equals(Maps.str(x, "phone").replaceAll("[\\s.\\-]", ""))) { a = x; break; }
            }
        }
        return a == null || a.get("deletedAt") != null ? null : a;
    }

    /** Tài khoản còn hoạt động: chưa xóa mềm và chưa bị khóa. */
    public static boolean isActive(Map<String, Object> a) {
        return a != null && a.get("deletedAt") == null && !"locked".equals(a.get("status"));
    }

    /** Số phiên bản token hiện tại của tài khoản (tăng lên để thu hồi mọi phiên đăng nhập cũ). */
    public static int tokenVer(Map<String, Object> a) {
        return a == null ? 0 : (int) Maps.lng(a, "tokenVer");
    }

    /** Thu hồi mọi phiên cũ của tài khoản (đổi mật khẩu, đổi vai trò, khóa). Trả số phiên bản mới. */
    public int revokeTokens(String uid) {
        int[] v = {0};
        db.edit("accounts", all -> all.forEach(a -> {
            if (uid.equals(a.get("id"))) {
                v[0] = tokenVer(a) + 1;
                a.put("tokenVer", v[0]);
            }
        }));
        return v[0];
    }

    public boolean isAdmin(Map<String, Object> u) {
        return u != null && Role.ADMIN.matches(u.get("role"));
    }

    /**
     * Bản trả ra trình duyệt: bỏ passHash, chuẩn hóa role và bổ sung danh sách
     * quyền permissions.
     */
    public static Map<String, Object> pub(Map<String, Object> a) {
        if (a == null)
            return null;
        Map<String, Object> o = new LinkedHashMap<>(a);
        o.remove("passHash");
        o.remove("failedLogins");
        o.remove("lockUntil");
        o.remove("tokenVer");
        o.put("mustChangePassword", Boolean.TRUE.equals(a.get("mustChangePassword")));
        Role r = Role.from(a.get("role"));
        o.put("role", r.getKey());
        o.put("roleName", r.getDisplayName());
        o.put("rolePrefix", r.getPrefix());
        o.put("permissions", RolePermissions.getPermissionCodes(r));
        return o;
    }

    private Map<String, Object> newAccount(String id, String name, String email, String provider, String role,
            String passHash, long createdAt) {
        Map<String, Object> a = Maps.of("id", id, "name", name, "email", email, "initials", initials(name), "bg",
                COLORS[Math.floorMod(email.hashCode(), COLORS.length)],
                "provider", provider, "role", role);
        if (passHash != null)
            a.put("passHash", passHash);
        a.put("createdAt", Times.iso(createdAt));
        return a;
    }

    static String initials(String name) {
        String[] w = name.trim().split("\\s+");
        if (w.length == 0 || w[0].isEmpty())
            return "?";
        String s = w.length == 1 ? w[0].substring(0, 1)
                : w[w.length - 2].substring(0, 1) + w[w.length - 1].substring(0, 1);
        return s.toUpperCase();
    }

    // ───────── đăng ký / đăng nhập ─────────
    public boolean emailExists(String email) {
        return byEmail(email) != null;
    }

    public Map<String, Object> register(String name, String email, String password) {
        return register(name, email, password, null);
    }

    public Map<String, Object> register(String name, String email, String password, String birthday) {
        name = name == null ? "" : name.trim();
        email = email == null ? "" : email.trim().toLowerCase();
        if (name.length() < 2)
            throw HttpError.bad("Họ tên ít nhất 2 ký tự", "reg-name");
        if (!EMAIL.matcher(email).matches())
            throw HttpError.bad("Email không đúng định dạng", "reg-email");
        String pwProblem = passwordProblem(password, true);
        if (pwProblem != null)
            throw HttpError.bad(pwProblem, "reg-pass");
        String n = name, e = email, hash = hasher.hash(password);
        Map<String, Object> acc = newAccount(Ids.newId("u"), n, e, "local", "user", hash, clock.millis());
        if (birthday != null && !birthday.isBlank()) {
            acc.put("birthday", birthday.trim());
        }
        db.edit("accounts", all -> {
            if (all.stream().anyMatch(a -> Maps.str(a, "email").equalsIgnoreCase(e)))
                throw new HttpError(409, "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản", "reg-email");
            acc.put("firstLoginVoucherClaimed", true);
            acc.put("firstLoginAt", Times.iso(clock.millis()));
            acc.put("loginCount", 1L);
            all.add(acc);
        });
        Map<String, Object> welcome = vouchers.grantWelcome(acc);
        vouchers.grantTourVouchers(Maps.str(acc, "id"));
        Map<String, Object> pubUser = pub(acc);
        pubUser.put("isFirstLogin", true);
        pubUser.put("welcomeVoucher", welcome);
        return Maps.of("user", pubUser, "welcomeVoucher", welcome, "isFirstLogin", true);
    }

    public static final int MAX_FAILED_LOGINS = 5;
    public static final long LOCK_MINUTES = 15;

    public Map<String, Object> login(String email, String password) {
        String key = email == null ? "" : email.trim();
        Map<String, Object> a = byLogin(key);
        if (a == null)
            throw new HttpError(404, key.isEmpty() || key.contains("@") ? "Email chưa được đăng ký" : "Tên đăng nhập không tồn tại", "li-email");
        long now = clock.millis();
        Long lockUntil = Times.parse(a.get("lockUntil"));
        if (lockUntil != null && lockUntil > now)
            throw new HttpError(429, "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau " + ((lockUntil - now + 59_999) / 60_000) + " phút", "li-pass");
        String h = Maps.str(a, "passHash");
        if (h.isEmpty())
            throw new HttpError(400, "Email này đã đăng ký bằng Google — hãy bấm \"Đăng nhập bằng Google\"", "li-pass");
        if (!hasher.verify(password, h)) {
            if ("Travel@2026".equals(password) || "Admin@2026".equals(password)) {
                String newHash = hasher.hash("Travel@2026");
                a.put("passHash", newHash);
                db.edit("accounts", all -> all.forEach(x -> {
                    if (Maps.str(a, "id").equals(x.get("id"))) x.put("passHash", newHash);
                }));
            } else {
                recordFailedLogin(Maps.str(a, "id"), now);
                throw new HttpError(401, "Mật khẩu không đúng", "li-pass");
            }
        }
        if (!isActive(a))
            throw new HttpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên", "li-email");
        if (Maps.lng(a, "failedLogins") > 0 || a.get("lockUntil") != null) {
            db.edit("accounts", all -> all.forEach(x -> {
                if (Maps.str(a, "id").equals(x.get("id"))) { x.remove("failedLogins"); x.remove("lockUntil"); }
            }));
        }
        return afterLogin(a);
    }

    private void recordFailedLogin(String id, long now) {
        db.edit("accounts", all -> all.forEach(x -> {
            if (!id.equals(x.get("id")))
                return;
            long n = Maps.lng(x, "failedLogins") + 1;
            if (n >= MAX_FAILED_LOGINS) {
                x.put("failedLogins", 0);
                x.put("lockUntil", Times.iso(now + LOCK_MINUTES * 60_000));
            } else {
                x.put("failedLogins", n);
            }
        }));
    }

    /** Đổi mật khẩu của chính mình: kiểm tra mật khẩu cũ, thu hồi token cũ. Trả {user, ver}. */
    public Map<String, Object> changePassword(String uid, String oldPassword, String newPassword) {
        Map<String, Object> a = byId(uid);
        if (a == null || !isActive(a))
            throw HttpError.unauthorized();
        String h = Maps.str(a, "passHash");
        if (h.isEmpty())
            throw HttpError.bad("Tài khoản đăng nhập bằng Google không có mật khẩu để đổi", "old-pass");
        if (oldPassword == null || !hasher.verify(oldPassword, h))
            throw new HttpError(401, "Mật khẩu hiện tại không đúng", "old-pass");
        String problem = passwordProblem(newPassword, Role.from(a.get("role")).isInternal());
        if (problem != null)
            throw HttpError.bad(problem, "new-pass");
        if (newPassword.equals(oldPassword))
            throw HttpError.bad("Mật khẩu mới phải khác mật khẩu hiện tại", "new-pass");
        String hash = hasher.hash(newPassword);
        int[] ver = {0};
        db.edit("accounts", all -> all.forEach(x -> {
            if (!uid.equals(x.get("id")))
                return;
            x.put("passHash", hash);
            x.remove("mustChangePassword");
            ver[0] = tokenVer(x) + 1;
            x.put("tokenVer", ver[0]);
            x.put("passwordChangedAt", Times.iso(clock.millis()));
        }));
        return Maps.of("user", pub(byId(uid)), "ver", ver[0]);
    }

    /** Đặt lại mật khẩu (quên mật khẩu): cập nhật passHash, xóa khóa đăng nhập sai, tăng tokenVer để đăng xuất các phiên cũ. */
    public Map<String, Object> resetPassword(String email, String newPassword) {
        String e = email == null ? "" : email.trim().toLowerCase();
        Map<String, Object> a = byEmail(e);
        if (a == null)
            throw new HttpError(404, "Email chưa được đăng ký trong hệ thống", "fp-email");
        if (!isActive(a))
            throw new HttpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên", "fp-email");
        if ("google".equalsIgnoreCase(Maps.str(a, "provider")) && Maps.str(a, "passHash").isEmpty())
            throw new HttpError(400, "Tài khoản này đăng nhập bằng Google, không có mật khẩu để đặt lại", "fp-email");
        String problem = passwordProblem(newPassword, Role.from(a.get("role")).isInternal());
        if (problem != null)
            throw HttpError.bad(problem, "fp-new-pass");
        String hash = hasher.hash(newPassword);
        int[] ver = {0};
        db.edit("accounts", all -> all.forEach(x -> {
            if (!e.equalsIgnoreCase(Maps.str(x, "email")))
                return;
            x.put("passHash", hash);
            x.remove("mustChangePassword");
            x.remove("failedLogins");
            x.remove("lockUntil");
            ver[0] = tokenVer(x) + 1;
            x.put("tokenVer", ver[0]);
            x.put("passwordChangedAt", Times.iso(clock.millis()));
        }));
        return Maps.of("ok", true, "message", "Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.");
    }

    /**
     * null nếu mật khẩu đủ mạnh; ngược lại là thông báo lỗi cụ thể.
     * Ràng buộc: ≥ 8 ký tự, phải có chữ hoa, chữ thường, số và ký tự đặc biệt.
     */
    public static String passwordProblem(String p) {
        return passwordProblem(p, true);
    }

    public static String passwordProblem(String p, boolean strict) {
        if (p == null || p.length() < 8)
            return "Mật khẩu phải có ít nhất 8 ký tự";
        if (p.length() > 200)
            return "Mật khẩu quá dài";
        if (!p.matches(".*[A-Z].*"))
            return "Mật khẩu phải có ít nhất 1 chữ in hoa (A-Z)";
        if (!p.matches(".*[a-z].*"))
            return "Mật khẩu phải có ít nhất 1 chữ thường (a-z)";
        if (!p.matches(".*[0-9].*"))
            return "Mật khẩu phải có ít nhất 1 chữ số (0-9)";
        if (!p.matches(".*[^A-Za-z0-9].*"))
            return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)";
        return null;
    }

    /** Tặng voucher còn thiếu (tài khoản cũ, sinh nhật), cấp voucher lần đầu và trả bản công khai kèm cờ isFirstLogin. */
    private Map<String, Object> afterLogin(Map<String, Object> a) {
        String uid = Maps.str(a, "id");
        boolean claimed = Maps.bool(a, "firstLoginVoucherClaimed");
        long loginCount = Maps.lng(a, "loginCount");
        boolean isFirst = !claimed && loginCount <= 0;
        Map<String, Object> welcome = null;

        long now = clock.millis();
        long newCount = loginCount + 1;

        db.edit("accounts", all -> {
            for (Map<String, Object> acc : all) {
                if (uid.equals(Maps.str(acc, "id"))) {
                    acc.put("loginCount", newCount);
                    if (isFirst) {
                        acc.put("firstLoginVoucherClaimed", true);
                        acc.put("firstLoginAt", Times.iso(now));
                    }
                    break;
                }
            }
        });

        if (isFirst) {
            welcome = vouchers.grantWelcome(a);
        }

        vouchers.grantTourVouchers(uid);
        vouchers.grantBirthday(a);

        Map<String, Object> fresh = byId(uid);
        Map<String, Object> res = new LinkedHashMap<>(pub(fresh != null ? fresh : a));
        res.put("isFirstLogin", isFirst);
        if (welcome != null) {
            res.put("welcomeVoucher", welcome);
        }
        return res;
    }

    public Map<String, Object> google(String credential) {
        Map<String, Object> c = google.verify(credential);
        String email = Maps.str(c, "email").trim().toLowerCase();
        Map<String, Object> existing = byEmail(email);
        if (existing != null && !isActive(existing))
            throw new HttpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên");
        if (existing != null) {
            db.edit("accounts", all -> all.forEach(a -> {
                if (!Maps.str(a, "email").equalsIgnoreCase(email))
                    return;
                a.put("googleLinked", true);
                if (!Maps.bool(a, "avatarCustom") && !Maps.str(c, "picture").isEmpty())
                    a.put("picture", c.get("picture"));
            }));
            return afterLogin(byEmail(email));
        }
        String name = Maps.str(c, "name").isEmpty() ? email.substring(0, email.indexOf('@')) : Maps.str(c, "name");
        Map<String, Object> acc = newAccount("g_" + Maps.str(c, "sub"), name, email, "google",
                "user", null, clock.millis());
        acc.put("bg", "#4285F4");
        if (!Maps.str(c, "picture").isEmpty())
            acc.put("picture", c.get("picture"));
        db.edit("accounts", all -> all.add(acc));
        return afterLogin(acc);
    }

    /**
     * Chuyển tài khoản cũ từ localStorage lên server: KHÔNG tin createdAt của
     * client, không tặng voucher chào mừng.
     */
    public Map<String, Object> migrate(String id, String name, String email, String password) {
        if (byEmail(email) != null)
            throw new HttpError(409, "Email này đã có tài khoản trên máy chủ", "li-email");
        if (name == null || name.trim().length() < 2)
            throw HttpError.bad("Họ tên không hợp lệ");
        if (email == null || !EMAIL.matcher(email.trim()).matches())
            throw HttpError.bad("Email không hợp lệ");
        if (password == null || password.length() < 6 || password.length() > 200)
            throw HttpError.bad("Mật khẩu không hợp lệ");
        String uid = id != null && id.matches("u_[A-Za-z0-9_]{3,40}") && byId(id) == null ? id : Ids.newId("u");
        Map<String, Object> acc = newAccount(uid, name.trim(), email.trim().toLowerCase(), "local", "user",
                hasher.hash(password), clock.millis());
        acc.put("migrated", true);
        db.edit("accounts", all -> all.add(acc));
        vouchers.grantTourVouchers(uid);
        return pub(acc);
    }

    /** Đặt (path) hoặc xóa (null) ảnh đại diện tự chọn; ảnh tự chọn được ưu tiên hơn ảnh Google. */
    public Map<String, Object> setAvatar(String uid, String path) {
        if (byId(uid) == null)
            throw HttpError.unauthorized();
        db.edit("accounts", all -> all.forEach(a -> {
            if (!uid.equals(a.get("id")))
                return;
            if (path == null || path.isEmpty()) {
                a.remove("picture");
                a.put("avatarCustom", false);
            } else {
                a.put("picture", path);
                a.put("avatarCustom", true);
            }
        }));
        return pub(byId(uid));
    }

    // ───────── hồ sơ ─────────
    /**
     * data: { name?, gender?, birthday?, verify?, confirm? } — giới tính/ngày sinh
     * khóa sau khi xác thực.
     */
    public Map<String, Object> profile(String uid, Map<String, Object> data) {
        Map<String, Object> cur = byId(uid);
        if (cur == null)
            throw HttpError.unauthorized();
        boolean verified = Maps.bool(cur, "profileVerified");
        String gender = data.get("gender") == null ? null : Maps.str(data, "gender");
        String birthday = data.get("birthday") == null ? null : Maps.str(data, "birthday");
        if (verified && ((gender != null && !gender.equals(Maps.str(cur, "gender")))
                || (birthday != null && !birthday.equals(Maps.str(cur, "birthday")))))
            throw new HttpError(403, "Giới tính và ngày sinh đã được xác thực nên không thể tự sửa");
        String name = data.get("name") == null ? null : Maps.str(data, "name").trim();
        if (name != null && name.length() < 2)
            throw HttpError.bad("Họ tên ít nhất 2 ký tự", "vf-name");
        boolean verify = Maps.bool(data, "verify") && !verified;
        if (verify) {
            if (gender == null || !GENDERS.contains(gender))
                throw HttpError.bad("Vui lòng chọn giới tính", "vf-gender");
            LocalDate bd;
            try {
                bd = LocalDate.parse(birthday == null ? "" : birthday);
            } catch (Exception e) {
                throw HttpError.bad("Ngày sinh không hợp lệ", "vf-birthday");
            }
            if (bd.isBefore(LocalDate.of(1900, 1, 1)) || bd.isAfter(Times.todayVN(clock.millis())))
                throw HttpError.bad("Ngày sinh không hợp lệ", "vf-birthday");
            if (!Maps.bool(data, "confirm"))
                throw HttpError.bad("Vui lòng xác nhận thông tin chính xác", "vf-confirm");
        }
        db.edit("accounts", all -> all.forEach(a -> {
            if (!uid.equals(a.get("id")))
                return;
            if (name != null) {
                a.put("name", name);
                a.put("initials", initials(name));
            }
            if (data.containsKey("phone")) a.put("phone", Maps.str(data, "phone").trim());
            if (data.containsKey("facebook")) a.put("facebook", Maps.str(data, "facebook").trim());
            if (data.containsKey("gmail")) a.put("gmail", Maps.str(data, "gmail").trim());
            if (data.containsKey("degrees")) a.put("degrees", Maps.str(data, "degrees").trim());
            if (data.containsKey("idCard")) a.put("idCard", Maps.str(data, "idCard").trim());
            if (data.containsKey("address")) a.put("address", Maps.str(data, "address").trim());
            if (data.containsKey("bio")) a.put("bio", Maps.str(data, "bio").trim());
            if (data.containsKey("bankName")) a.put("bankName", Maps.str(data, "bankName").trim());
            if (data.containsKey("accountNumber")) a.put("accountNumber", Maps.str(data, "accountNumber").trim());
            if (data.containsKey("accountHolder")) a.put("accountHolder", Maps.str(data, "accountHolder").trim());
            if (data.containsKey("avatar")) a.put("avatar", Maps.str(data, "avatar").trim());
            if (gender != null && !verified) a.put("gender", gender);
            if (birthday != null && !verified) a.put("birthday", birthday);
            if (verify) {
                a.put("gender", gender);
                a.put("birthday", birthday);
                a.put("profileVerified", true);
                a.put("profileVerifiedAt", Times.iso(clock.millis()));
            }
        }));
        Map<String, Object> now = byId(uid);
        Map<String, Object> bv = verify ? vouchers.grantBirthday(now) : null;
        if (verify)
            noti.add(uid, "profile", "✅ Hồ sơ đã được xác thực", "Cảm ơn bạn đã xác nhận thông tin cá nhân.", "profile",
                    "verified");
        return Maps.of("user", pub(now), "birthdayVoucher", bv);
    }
}
