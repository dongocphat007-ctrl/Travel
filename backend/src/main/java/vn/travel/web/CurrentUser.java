package vn.travel.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import vn.travel.service.Accounts;
import vn.travel.service.SessionService;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;

import java.util.Map;

/** Lấy người dùng hiện tại từ cookie phiên HttpOnly (đã ký HMAC); kiểm tra vai trò Admin từ dữ liệu SERVER. */
@Component
public class CurrentUser {
    private final SessionService sessions;
    private final Accounts accounts;

    public CurrentUser(SessionService sessions, Accounts accounts) {
        this.sessions = sessions;
        this.accounts = accounts;
    }

    public Map<String, Object> optional(HttpServletRequest req) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return null;
        for (Cookie c : cs) {
            if (!SessionService.COOKIE.equals(c.getName())) continue;
            SessionService.Verified v = sessions.verifyFull(c.getValue());
            if (v == null) return null;
            Map<String, Object> a = accounts.byId(v.uid());
            // khóa / xóa mềm / token đã bị thu hồi (đổi mật khẩu, đổi vai trò) → coi như chưa đăng nhập
            if (a == null || !Accounts.isActive(a) || Accounts.tokenVer(a) != v.ver()) return null;
            return a;
        }
        return null;
    }

    public Map<String, Object> require(HttpServletRequest req) {
        Map<String, Object> u = optional(req);
        if (u == null) throw HttpError.unauthorized();
        // Mật khẩu do admin cấp: chỉ được đổi mật khẩu / xem hồ sơ / đăng xuất cho tới khi đổi xong (TASKS 14.7)
        if (Boolean.TRUE.equals(u.get("mustChangePassword"))) {
            String uri = req.getRequestURI() == null ? "" : req.getRequestURI();
            if (!uri.startsWith("/api/auth/") && !uri.startsWith("/api/notifications"))
                throw new HttpError(403, "Bạn cần đổi mật khẩu trước khi tiếp tục", "must_change_password");
        }
        return u;
    }

    public Role getRole(HttpServletRequest req) {
        Map<String, Object> u = optional(req);
        return getRole(u);
    }

    public Role getRole(Map<String, Object> user) {
        if (user == null) return null;
        return Role.from(user.get("role"));
    }

    public boolean hasPermission(HttpServletRequest req, Permission permission) {
        Role r = getRole(req);
        if (r == null || permission == null) return false;
        return RolePermissions.hasPermission(r, permission);
    }

    public Map<String, Object> requirePermission(HttpServletRequest req, Permission permission) {
        Map<String, Object> u = require(req);
        Role r = getRole(u);
        if (!RolePermissions.hasPermission(r, permission)) {
            throw HttpError.forbidden();
        }
        return u;
    }

    public Map<String, Object> requireAdmin(HttpServletRequest req) {
        Map<String, Object> u = require(req);
        if (!accounts.isAdmin(u)) throw HttpError.forbidden();
        return u;
    }

    public void start(HttpServletRequest req, HttpServletResponse res, String userId) {
        Map<String, Object> acc = accounts.byId(userId);
        start(req, res, userId, Accounts.tokenVer(acc));
    }

    public void start(HttpServletRequest req, HttpServletResponse res, String userId, int ver) {
        boolean secure = req.isSecure() || "https".equalsIgnoreCase(req.getHeader("X-Forwarded-Proto"));
        res.addHeader("Set-Cookie", SessionService.COOKIE + "=" + sessions.create(userId, ver) + "; Path=/; Max-Age=" + SessionService.TTL_SECONDS
                + "; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : ""));
    }

    public void end(HttpServletResponse res) {
        res.addHeader("Set-Cookie", SessionService.COOKIE + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    }
}
