package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;

/** Tài khoản (accounts.json): đăng ký / đăng nhập / Google / hồ sơ. Mật khẩu băm PBKDF2, không bao giờ trả ra ngoài. */
@Service
public class Accounts {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final String[] COLORS = {"#0F766E", "#B45309", "#4F46E5", "#BE123C", "#0369A1", "#6D28D9", "#15803D", "#C2410C"};
    private static final Set<String> GENDERS = Set.of("male", "female", "other");

    private final Db db;
    private final PasswordHasher hasher;
    private final Vouchers vouchers;
    private final Notifications noti;
    private final Clock clock;
    private final GoogleVerifier google;
    private final String superAdminEmail;

    public Accounts(Db db, PasswordHasher hasher, Vouchers vouchers, Notifications noti, Clock clock, GoogleVerifier google, TravelProperties props) {
        this.db = db;
        this.hasher = hasher;
        this.vouchers = vouchers;
        this.noti = noti;
        this.clock = clock;
        this.google = google;
        this.superAdminEmail = props.superAdminEmail() == null ? "" : props.superAdminEmail().trim().toLowerCase();
        seedAdmin(props.adminEmail(), props.adminPassword());
    }

    /** Admin mặc định chỉ tồn tại khi ADMIN_EMAIL + ADMIN_PASSWORD (≥ 8 ký tự) được đặt trong môi trường. */
    final void seedAdmin(String email, String password) {
        if (TravelProperties.blank(email) || TravelProperties.blank(password)) return;
        if (password.length() < 8) throw new IllegalStateException("ADMIN_PASSWORD phải từ 8 ký tự");
        String em = email.trim().toLowerCase();
        db.edit("accounts", all -> {
            for (Map<String, Object> a : all) {
                if (Maps.str(a, "email").equals(em)) {
                    a.put("role", "admin");
                    if (!hasher.verify(password, Maps.str(a, "passHash"))) a.put("passHash", hasher.hash(password));
                    return;
                }
            }
            all.add(newAccount("admin_default", "Admin Travel", em, "local", "admin", hasher.hash(password), clock.millis()));
        });
    }

    // ───────── truy vấn ─────────
    public List<Map<String, Object>> all() { return db.list("accounts"); }

    public Map<String, Object> byId(String id) {
        if (id == null) return null;
        for (Map<String, Object> a : all()) if (id.equals(a.get("id"))) return a;
        return null;
    }

    public Map<String, Object> byEmail(String email) {
        if (email == null) return null;
        String e = email.trim().toLowerCase();
        for (Map<String, Object> a : all()) if (Maps.str(a, "email").equalsIgnoreCase(e)) return a;
        return null;
    }

    public boolean isAdmin(Map<String, Object> u) { return u != null && "admin".equals(u.get("role")); }

    /** Bản trả ra trình duyệt: bỏ passHash. */
    public static Map<String, Object> pub(Map<String, Object> a) {
        Map<String, Object> o = new LinkedHashMap<>(a);
        o.remove("passHash");
        return o;
    }

    private Map<String, Object> newAccount(String id, String name, String email, String provider, String role, String passHash, long createdAt) {
        Map<String, Object> a = Maps.of("id", id, "name", name, "email", email, "initials", initials(name), "bg", COLORS[Math.floorMod(email.hashCode(), COLORS.length)],
                "provider", provider, "role", role);
        if (passHash != null) a.put("passHash", passHash);
        a.put("createdAt", Times.iso(createdAt));
        return a;
    }

    static String initials(String name) {
        String[] w = name.trim().split("\\s+");
        if (w.length == 0 || w[0].isEmpty()) return "?";
        String s = w.length == 1 ? w[0].substring(0, 1) : w[w.length - 2].substring(0, 1) + w[w.length - 1].substring(0, 1);
        return s.toUpperCase();
    }

    // ───────── đăng ký / đăng nhập ─────────
    public boolean emailExists(String email) { return byEmail(email) != null; }

    public Map<String, Object> register(String name, String email, String password) {
        name = name == null ? "" : name.trim();
        email = email == null ? "" : email.trim().toLowerCase();
        if (name.length() < 2) throw HttpError.bad("Họ tên ít nhất 2 ký tự", "reg-name");
        if (!EMAIL.matcher(email).matches()) throw HttpError.bad("Email không đúng định dạng", "reg-email");
        if (password == null || password.length() < 6) throw HttpError.bad("Mật khẩu ít nhất 6 ký tự", "reg-pass");
        if (password.length() > 200) throw HttpError.bad("Mật khẩu quá dài", "reg-pass");
        String n = name, e = email, hash = hasher.hash(password);
        Map<String, Object> acc = newAccount(Ids.newId("u"), n, e, "local", "user", hash, clock.millis());
        db.edit("accounts", all -> {
            if (all.stream().anyMatch(a -> Maps.str(a, "email").equalsIgnoreCase(e)))
                throw new HttpError(409, "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản", "reg-email");
            all.add(acc);
        });
        Map<String, Object> welcome = vouchers.grantWelcome(acc);
        vouchers.grantTourVouchers(Maps.str(acc, "id"));
        return Maps.of("user", pub(acc), "welcomeVoucher", welcome);
    }

    public Map<String, Object> login(String email, String password) {
        Map<String, Object> a = byEmail(email);
        if (a == null) throw new HttpError(404, "Email chưa được đăng ký", "li-email");
        String h = Maps.str(a, "passHash");
        if (h.isEmpty()) throw new HttpError(400, "Email này đã đăng ký bằng Google — hãy bấm \"Đăng nhập bằng Google\"", "li-pass");
        if (!hasher.verify(password, h)) throw new HttpError(401, "Mật khẩu không đúng", "li-pass");
        return afterLogin(a);
    }

    /** Tặng voucher còn thiếu (tài khoản cũ, sinh nhật) rồi trả bản công khai. */
    private Map<String, Object> afterLogin(Map<String, Object> a) {
        vouchers.grantTourVouchers(Maps.str(a, "id"));
        vouchers.grantBirthday(a);
        return pub(a);
    }

    public Map<String, Object> google(String credential) {
        Map<String, Object> c = google.verify(credential);
        String email = Maps.str(c, "email").trim().toLowerCase();
        boolean isSuper = !superAdminEmail.isEmpty() && email.equals(superAdminEmail);
        Map<String, Object> existing = byEmail(email);
        if (existing != null) {
            db.edit("accounts", all -> all.forEach(a -> {
                if (!Maps.str(a, "email").equalsIgnoreCase(email)) return;
                a.put("googleLinked", true);
                if (!Maps.bool(a, "avatarCustom") && !Maps.str(c, "picture").isEmpty()) a.put("picture", c.get("picture"));
                if (isSuper) a.put("role", "admin");
            }));
            return afterLogin(byEmail(email));
        }
        String name = Maps.str(c, "name").isEmpty() ? email.substring(0, email.indexOf('@')) : Maps.str(c, "name");
        Map<String, Object> acc = newAccount("g_" + Maps.str(c, "sub"), name, email, "google", isSuper ? "admin" : "user", null, clock.millis());
        acc.put("bg", "#4285F4");
        if (!Maps.str(c, "picture").isEmpty()) acc.put("picture", c.get("picture"));
        db.edit("accounts", all -> all.add(acc));
        vouchers.grantWelcome(acc);
        return afterLogin(acc);
    }

    /** Chuyển tài khoản cũ từ localStorage lên server: KHÔNG tin createdAt của client, không tặng voucher chào mừng. */
    public Map<String, Object> migrate(String id, String name, String email, String password) {
        if (byEmail(email) != null) throw new HttpError(409, "Email này đã có tài khoản trên máy chủ", "li-email");
        if (name == null || name.trim().length() < 2) throw HttpError.bad("Họ tên không hợp lệ");
        if (email == null || !EMAIL.matcher(email.trim()).matches()) throw HttpError.bad("Email không hợp lệ");
        if (password == null || password.length() < 6 || password.length() > 200) throw HttpError.bad("Mật khẩu không hợp lệ");
        String uid = id != null && id.matches("u_[A-Za-z0-9_]{3,40}") && byId(id) == null ? id : Ids.newId("u");
        Map<String, Object> acc = newAccount(uid, name.trim(), email.trim().toLowerCase(), "local", "user", hasher.hash(password), clock.millis());
        acc.put("migrated", true);
        db.edit("accounts", all -> all.add(acc));
        vouchers.grantTourVouchers(uid);
        return pub(acc);
    }

    // ───────── hồ sơ ─────────
    /** data: { name?, gender?, birthday?, verify?, confirm? } — giới tính/ngày sinh khóa sau khi xác thực. */
    public Map<String, Object> profile(String uid, Map<String, Object> data) {
        Map<String, Object> cur = byId(uid);
        if (cur == null) throw HttpError.unauthorized();
        boolean verified = Maps.bool(cur, "profileVerified");
        String gender = data.get("gender") == null ? null : Maps.str(data, "gender");
        String birthday = data.get("birthday") == null ? null : Maps.str(data, "birthday");
        if (verified && ((gender != null && !gender.equals(Maps.str(cur, "gender"))) || (birthday != null && !birthday.equals(Maps.str(cur, "birthday")))))
            throw new HttpError(403, "Giới tính và ngày sinh đã được xác thực nên không thể tự sửa");
        String name = data.get("name") == null ? null : Maps.str(data, "name").trim();
        if (name != null && name.length() < 2) throw HttpError.bad("Họ tên ít nhất 2 ký tự", "vf-name");
        boolean verify = Maps.bool(data, "verify") && !verified;
        if (verify) {
            if (gender == null || !GENDERS.contains(gender)) throw HttpError.bad("Vui lòng chọn giới tính", "vf-gender");
            LocalDate bd;
            try { bd = LocalDate.parse(birthday == null ? "" : birthday); } catch (Exception e) { throw HttpError.bad("Ngày sinh không hợp lệ", "vf-birthday"); }
            if (bd.isBefore(LocalDate.of(1900, 1, 1)) || bd.isAfter(Times.todayVN(clock.millis()))) throw HttpError.bad("Ngày sinh không hợp lệ", "vf-birthday");
            if (!Maps.bool(data, "confirm")) throw HttpError.bad("Vui lòng xác nhận thông tin chính xác", "vf-confirm");
        }
        db.edit("accounts", all -> all.forEach(a -> {
            if (!uid.equals(a.get("id"))) return;
            if (name != null) {
                a.put("name", name);
                a.put("initials", initials(name));
            }
            if (verify) {
                a.put("gender", gender);
                a.put("birthday", birthday);
                a.put("profileVerified", true);
                a.put("profileVerifiedAt", Times.iso(clock.millis()));
            }
        }));
        Map<String, Object> now = byId(uid);
        Map<String, Object> bv = verify ? vouchers.grantBirthday(now) : null;
        if (verify) noti.add(uid, "profile", "✅ Hồ sơ đã được xác thực", "Cảm ơn bạn đã xác nhận thông tin cá nhân.", "profile", "verified");
        return Maps.of("user", pub(now), "birthdayVoucher", bv);
    }
}
