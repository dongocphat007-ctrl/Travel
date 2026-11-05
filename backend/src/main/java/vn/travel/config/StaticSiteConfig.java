package vn.travel.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import vn.travel.security.Role;
import vn.travel.web.CurrentUser;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.function.Function;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * BE-04: phục vụ frontend CÙNG origin (không cần CORS) nhưng theo danh sách TRẮNG.
 * Chỉ các thư mục/file công khai được trả ra; storage/, .env, pom.xml, src/, legacy-node/ ... luôn 404.
 * Phiên nội bộ chỉ được mở dashboard đúng vai trò; các trang khách được chuyển về dashboard đó.
 */
@Configuration
public class StaticSiteConfig implements WebMvcConfigurer {

    /** File/thư mục công khai của frontend. Mọi thứ khác (ngoài /api) → 404. */
    static final Pattern PUBLIC = Pattern.compile(
            "^/(index\\.html|guide\\.html|print\\.html|sitemap\\.xml|robots\\.txt|favicon\\.ico)?$"
                    + "|^/(css|js|html|shared|data|img|fonts|lib|staff)/.*");

    /** Chặn thêm dù nằm trong thư mục công khai. */
    static final Pattern DENY = Pattern.compile(
            "(^|/)\\.[^/]*|\\.(bak|tmp|env|key|pem)$|^/data/(db|private)(/|$)|^/data/orders\\.json$", Pattern.CASE_INSENSITIVE);

    private final TravelProperties props;
    private final Function<HttpServletRequest, Map<String, Object>> sessionUser;

    @Autowired
    public StaticSiteConfig(TravelProperties props, CurrentUser currentUser) {
        this(props, currentUser::optional);
    }

    StaticSiteConfig(TravelProperties props, Function<HttpServletRequest, Map<String, Object>> sessionUser) {
        this.props = props;
        this.sessionUser = sessionUser;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Paths.get(props.webRoot()).toAbsolutePath().normalize();
        registry.addResourceHandler("/**")
                .addResourceLocations(root.toUri().toString())
                .setCacheControl(CacheControl.maxAge(0, TimeUnit.SECONDS).mustRevalidate());
    }

    // "/" và "/index.html" do TourPageController phục vụ (chèn SEO riêng cho /?tour=ID).

    @Bean
    OncePerRequestFilter publicOnlyFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                String raw = req.getRequestURI();
                if (raw.startsWith("/api/")) {
                    chain.doFilter(req, res);
                    return;
                }
                String p;
                try {
                    p = URLDecoder.decode(raw, StandardCharsets.UTF_8);
                } catch (IllegalArgumentException e) {
                    res.sendError(400);
                    return;
                }
                boolean bad = p.indexOf('\0') >= 0 || p.contains("..") || p.contains("\\")
                        || !PUBLIC.matcher(p).matches() || DENY.matcher(p).find();
                if (bad) {
                    res.sendError(404);
                    return;
                }
                if (isCustomerPage(p) || isStaffPage(p)) {
                    Map<String, Object> user = sessionUser.apply(req);
                    Role role = Role.from(user == null ? null : user.get("role"));
                    String ownStaffPage = staffPage(role);
                    if (ownStaffPage != null && isCustomerPage(p)) {
                        res.sendRedirect(ownStaffPage);
                        return;
                    }
                    if (isStaffPage(p) && user != null) {
                        if (ownStaffPage == null) {
                            res.sendRedirect("/");
                            return;
                        }
                        if (!ownStaffPage.equals(p)) {
                            res.sendRedirect(ownStaffPage);
                            return;
                        }
                    }
                }
                chain.doFilter(req, res);
            }
        };
    }

    private static boolean isCustomerPage(String path) {
        return "/".equals(path) || "/index.html".equals(path) || "/guide.html".equals(path)
                || "/print.html".equals(path) || (path.startsWith("/html/") && path.endsWith(".html"));
    }

    private static boolean isStaffPage(String path) {
        return path.matches("^/staff/(admin|cashier|operator|support|content|guide)\\.html$");
    }

    private static String staffPage(Role role) {
        return role != null && role.isInternal() ? "/staff/" + role.getKey() + ".html" : null;
    }
}
