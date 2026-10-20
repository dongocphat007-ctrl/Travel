package vn.travel.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * BE-04: phục vụ frontend CÙNG origin (không cần CORS) nhưng theo danh sách TRẮNG.
 * Chỉ các thư mục/file công khai được trả ra; storage/, .env, pom.xml, src/, legacy-node/ ... luôn 404.
 */
@Configuration
public class StaticSiteConfig implements WebMvcConfigurer {

    /** File/thư mục công khai của frontend. Mọi thứ khác (ngoài /api) → 404. */
    static final Pattern PUBLIC = Pattern.compile(
            "^/(index\\.html|guide\\.html|print\\.html|sitemap\\.xml|robots\\.txt|favicon\\.ico)?$"
                    + "|^/(css|js|html|shared|data|img|fonts|lib)/.*");

    /** Chặn thêm dù nằm trong thư mục công khai. */
    static final Pattern DENY = Pattern.compile(
            "(^|/)\\.[^/]*|\\.(bak|tmp|env|key|pem)$|^/data/(db|private)(/|$)|^/data/orders\\.json$", Pattern.CASE_INSENSITIVE);

    private final TravelProperties props;

    public StaticSiteConfig(TravelProperties props) {
        this.props = props;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Paths.get(props.webRoot()).toAbsolutePath().normalize();
        registry.addResourceHandler("/**")
                .addResourceLocations(root.toUri().toString())
                .setCacheControl(CacheControl.maxAge(0, TimeUnit.SECONDS).mustRevalidate());
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

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
                chain.doFilter(req, res);
            }
        };
    }
}
