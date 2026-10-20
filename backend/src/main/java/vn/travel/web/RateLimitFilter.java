package vn.travel.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.travel.config.TravelProperties;

import java.io.IOException;
import java.time.Clock;

/** BE-08: giới hạn đăng nhập, đăng ký, OTP, chat AI, voucher, review theo IP. Quá giới hạn → 429 JSON. */
@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final RateLimiter limiter = new RateLimiter();
    private final Clock clock;
    private final boolean trustProxy;
    private final int scale;

    public RateLimitFilter(Clock clock, TravelProperties props) {
        this.clock = clock;
        this.trustProxy = props.trustProxy();
        String s = System.getenv("RATE_LIMIT_SCALE");   // chỉ dùng khi chạy test tải
        this.scale = s != null && s.matches("\\d{1,3}") ? Math.max(1, Integer.parseInt(s)) : 1;
    }

    /** {nhóm, tối đa, cửa sổ ms} hoặc null nếu đường dẫn không bị giới hạn. */
    static Object[] rule(String method, String path) {
        if (!"POST".equals(method)) return null;
        if (path.equals("/api/auth/login") || path.equals("/api/auth/google")) return new Object[]{"login", 10, 60_000L};
        if (path.equals("/api/auth/register") || path.equals("/api/auth/migrate") || path.equals("/api/auth/check-email")) return new Object[]{"register", 10, 60_000L};
        if (path.startsWith("/api/otp/")) return new Object[]{"otp", 8, 60_000L};
        if (path.startsWith("/api/ai/")) return new Object[]{"ai", 20, 60_000L};
        if (path.equals("/api/vouchers/validate")) return new Object[]{"voucher", 30, 60_000L};
        if (path.equals("/api/reviews")) return new Object[]{"review", 5, 60_000L};
        return null;
    }

    String clientIp(HttpServletRequest req) {
        if (trustProxy) {
            String xf = req.getHeader("X-Forwarded-For");
            if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        Object[] r = rule(req.getMethod(), req.getRequestURI());
        if (r != null) {
            long now = clock.millis();
            if (!limiter.allow(r[0] + "|" + clientIp(req), (int) r[1] * scale, (long) r[2], now)) {
                res.setStatus(429);
                res.setContentType("application/json;charset=UTF-8");
                res.setHeader("Retry-After", "60");
                res.getWriter().write("{\"ok\":false,\"msg\":\"Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút\"}");
                return;
            }
            if (now % 50 == 0) limiter.sweep(60_000L, now);
        }
        chain.doFilter(req, res);
    }
}
