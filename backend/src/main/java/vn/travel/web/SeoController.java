package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.travel.config.TravelProperties;
import vn.travel.service.TourCatalog;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * B2: /sitemap.xml và /robots.txt do server sinh (index.html trỏ tới /sitemap.xml).
 * URL tuyệt đối lấy từ SITE_URL; không đặt thì suy ra từ chính request. Tour lấy từ TourCatalog nên tour Admin thêm/ẩn tự cập nhật.
 * Trang tour dùng URL chia sẻ "/?tour=ID" (cùng canonical với seo.js).
 */
@RestController
public class SeoController {
    private final TravelProperties props;
    private final TourCatalog tours;

    public SeoController(TravelProperties props, TourCatalog tours) {
        this.props = props;
        this.tours = tours;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap(HttpServletRequest req) {
        List<String> ids = new ArrayList<>();
        for (Map<String, Object> t : tours.all()) ids.add(String.valueOf(t.get("id")));
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").body(buildSitemap(baseUrl(req), ids));
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> robots(HttpServletRequest req) {
        return ResponseEntity.ok().header("Cache-Control", "public, max-age=3600").body(buildRobots(baseUrl(req)));
    }

    String baseUrl(HttpServletRequest req) {
        String configured = props.siteUrl();
        if (!TravelProperties.blank(configured)) return trimSlash(configured.trim());
        int port = req.getServerPort();
        boolean std = port <= 0 || (port == 80 && "http".equals(req.getScheme())) || (port == 443 && "https".equals(req.getScheme()));
        return req.getScheme() + "://" + req.getServerName() + (std ? "" : ":" + port);
    }

    static String trimSlash(String s) {
        int end = s.length();
        while (end > 0 && s.charAt(end - 1) == '/') end--;
        return s.substring(0, end);
    }

    static String buildRobots(String base) {
        return "User-agent: *\n"
                + "Allow: /\n"
                + "Disallow: /api/\n"
                + "Disallow: /print.html\n"
                + "\n"
                + "Sitemap: " + base + "/sitemap.xml\n";
    }

    static String buildSitemap(String base, List<String> tourIds) {
        StringBuilder sb = new StringBuilder(256 + tourIds.size() * 120);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
          .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        url(sb, base + "/", "daily", "1.0");
        for (String id : tourIds)
            url(sb, base + "/?tour=" + URLEncoder.encode(id, StandardCharsets.UTF_8), "weekly", "0.8");
        return sb.append("</urlset>\n").toString();
    }

    private static void url(StringBuilder sb, String loc, String freq, String prio) {
        sb.append("  <url><loc>").append(xml(loc)).append("</loc><changefreq>").append(freq)
          .append("</changefreq><priority>").append(prio).append("</priority></url>\n");
    }

    private static String xml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }
}
