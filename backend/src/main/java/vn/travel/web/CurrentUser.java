package vn.travel.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import vn.travel.service.Accounts;
import vn.travel.service.SessionService;

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
            String uid = sessions.verify(c.getValue());
            return uid == null ? null : accounts.byId(uid);
        }
        return null;
    }

    public Map<String, Object> require(HttpServletRequest req) {
        Map<String, Object> u = optional(req);
        if (u == null) throw HttpError.unauthorized();
        return u;
    }

    public Map<String, Object> requireAdmin(HttpServletRequest req) {
        Map<String, Object> u = require(req);
        if (!accounts.isAdmin(u)) throw HttpError.forbidden();
        return u;
    }

    public void start(HttpServletRequest req, HttpServletResponse res, String userId) {
        boolean secure = req.isSecure() || "https".equalsIgnoreCase(req.getHeader("X-Forwarded-Proto"));
        res.addHeader("Set-Cookie", SessionService.COOKIE + "=" + sessions.create(userId) + "; Path=/; Max-Age=" + SessionService.TTL_SECONDS
                + "; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : ""));
    }

    public void end(HttpServletResponse res) {
        res.addHeader("Set-Cookie", SessionService.COOKIE + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    }
}
