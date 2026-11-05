package vn.travel.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.travel.config.TravelProperties;
import vn.travel.service.SessionService;

import java.io.IOException;
import java.net.URI;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * NEW-08: chống CSRF bằng kiểm tra Origin / Referer cho mọi yêu cầu ĐỔI DỮ LIỆU (POST, PUT, PATCH, DELETE) vào /api/.
 *  • Có Origin  → phải trùng origin của chính site (hoặc SITE_URL). "null" bị từ chối.
 *  • Không có Origin nhưng có Referer → origin của Referer phải trùng.
 *  • Không có cả hai → chỉ cho qua khi yêu cầu KHÔNG mang cookie phiên (curl, máy chủ khác); có cookie phiên → 403.
 *  • /api/payments/webhook được miễn (ngân hàng gọi từ máy chủ, đã xác thực bằng khóa bí mật, không dùng cookie).
 * Cookie phiên còn có SameSite=Lax nên đây là lớp bảo vệ thứ hai.
 */
@Component
public class CsrfFilter extends OncePerRequestFilter {
    private final String siteOrigin;
    private final boolean trustProxy;

    public CsrfFilter(TravelProperties props) {
        this.siteOrigin = TravelProperties.blank(props.siteUrl()) ? null : normalize(props.siteUrl().trim());
        this.trustProxy = props.trustProxy();
    }

    static boolean needsCheck(String method, String path) {
        if (!path.startsWith("/api/")) return false;
        if (path.equals("/api/payments/webhook")) return false;
        return switch (method) {
            case "POST", "PUT", "PATCH", "DELETE" -> true;
            default -> false;
        };
    }

    /** "https://Site.vn:443/x?y" → "https://site.vn"; không hợp lệ → null. */
    static String normalize(String url) {
        if (url == null) return null;
        try {
            URI u = new URI(url.trim());
            if (u.getScheme() == null || u.getHost() == null) return null;
            String scheme = u.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) return null;
            int port = u.getPort();
            boolean std = port == -1 || (port == 80 && scheme.equals("http")) || (port == 443 && scheme.equals("https"));
            return scheme + "://" + u.getHost().toLowerCase(Locale.ROOT) + (std ? "" : ":" + port);
        } catch (Exception e) {
            return null;
        }
    }

    /** Quyết định thuần (dễ test). {@code allowed} = các origin hợp lệ đã chuẩn hóa. */
    static boolean allowed(String origin, String referer, boolean hasSessionCookie, Set<String> allowed) {
        if (origin != null && !origin.isBlank()) return member(allowed, normalize(origin));
        if (referer != null && !referer.isBlank()) return member(allowed, normalize(referer));
        return !hasSessionCookie;
    }

    /** Origin không phân tích được (vd. "null", rác) → normalize = null → luôn bị từ chối (không gọi contains(null)). */
    private static boolean member(Set<String> allowed, String normalized) {
        return normalized != null && allowed.contains(normalized);
    }

    private Set<String> allowedOrigins(HttpServletRequest req) {
        Set<String> set = new HashSet<>();
        String scheme = req.getScheme();
        String host = req.getHeader("Host");
        if (trustProxy) {
            String xp = first(req.getHeader("X-Forwarded-Proto"));
            String xh = first(req.getHeader("X-Forwarded-Host"));
            if (xp != null) scheme = xp;
            if (xh != null) host = xh;
        }
        if (host == null || host.isBlank()) host = req.getServerName() + ":" + req.getServerPort();
        String own = normalize(scheme + "://" + host);
        if (own != null) set.add(own);
        if (siteOrigin != null) set.add(siteOrigin);
        return set;
    }

    private static String first(String v) {
        if (v == null || v.isBlank()) return null;
        return v.split(",")[0].trim();
    }

    private static boolean hasSession(HttpServletRequest req) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return false;
        for (Cookie c : cs) if (SessionService.COOKIE.equals(c.getName())) return true;
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        if (needsCheck(req.getMethod(), req.getRequestURI())
                && !allowed(req.getHeader("Origin"), req.getHeader("Referer"), hasSession(req), allowedOrigins(req))) {
            res.setStatus(403);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"ok\":false,\"msg\":\"Yêu cầu bị từ chối: nguồn gửi không hợp lệ\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
