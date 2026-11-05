package vn.travel.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.travel.config.TravelProperties;
import vn.travel.service.TourCatalog;
import vn.travel.util.Maps;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NEW-07: SEO cho TỪNG tour ở phía máy chủ (trình thu thập không chạy JS).
 * GET / và /index.html?tour=ID → trả index.html với title, description, canonical, Open Graph, Twitter và JSON-LD
 * (schema.org TouristTrip + Offer) của đúng tour. Cùng quy tắc với frontend/js/seo.js; URL canonical là "/?tour=ID"
 * (khớp sitemap.xml do SeoController sinh). id không tồn tại / tour đang ẩn → giữ trang mặc định + noindex.
 */
@RestController
public class TourPageController {
    private static final String DEFAULT_IMAGE = "img/og-cover.png";
    private static final String BRAND = "Travel";

    private final TravelProperties props;
    private final TourCatalog tours;
    private final SeoController seo;
    private final ObjectMapper mapper;

    public TourPageController(TravelProperties props, TourCatalog tours, SeoController seo, ObjectMapper mapper) {
        this.props = props;
        this.tours = tours;
        this.seo = seo;
        this.mapper = mapper;
    }

    @GetMapping(value = {"/", "/index.html"}, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> index(@RequestParam(value = "tour", required = false) String tourId, HttpServletRequest req) throws IOException {
        Path file = Paths.get(props.webRoot()).toAbsolutePath().normalize().resolve("index.html");
        if (!Files.isRegularFile(file)) return ResponseEntity.notFound().build();
        String html = Files.readString(file, StandardCharsets.UTF_8);
        if (tourId != null && !tourId.isBlank() && tourId.length() <= 64) {
            String base = seo.baseUrl(req);
            Map<String, Object> t = tours.publicTour(tourId.trim());
            html = t != null ? forTour(html, base, tourId.trim(), t, mapper) : forUnknown(html, base);
        }
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .header("Cache-Control", "no-cache")
                .body(html);
    }

    // ───────────── Phần thuần (test được không cần Spring) ─────────────

    static String forTour(String html, String base, String id, Map<String, Object> t, ObjectMapper mapper) {
        String name = Maps.str(t, "name").isBlank() ? "Tour " + id : Maps.str(t, "name");
        long price = Maps.lng(t, "price");
        String place = !Maps.str(t, "dest").isBlank() ? Maps.str(t, "dest") : !Maps.str(t, "destination").isBlank() ? Maps.str(t, "destination") : Maps.str(t, "region");
        String facts = String.join(" · ", nonBlank(Maps.str(t, "duration"), place, price > 0 ? "giá từ " + vnd(price) + " ₫" : ""));
        String desc = !Maps.str(t, "desc").isBlank() ? Maps.str(t, "desc") : Maps.str(t, "highlight");
        desc = clip(desc.isBlank() ? name + (facts.isEmpty() ? "" : " – " + facts) + ". Xem lịch trình, đánh giá và đặt tour." : desc + (facts.isEmpty() ? "" : " " + facts + "."), 160);
        String title = clip(name.contains(BRAND) ? name : name + " – " + BRAND, 70);
        String canonical = base + "/?tour=" + java.net.URLEncoder.encode(id, StandardCharsets.UTF_8);
        String image = absolute(base, firstImage(t));

        String out = html;
        out = replaceTitle(out, title);
        out = setMeta(out, "name", "description", desc);
        out = setMeta(out, "name", "robots", "index, follow");
        out = setMeta(out, "property", "og:type", "article");
        out = setMeta(out, "property", "og:title", title);
        out = setMeta(out, "property", "og:description", desc);
        out = setMeta(out, "property", "og:url", canonical);
        out = setMeta(out, "property", "og:image", image);
        out = setMeta(out, "property", "og:image:alt", name);
        out = setMeta(out, "name", "twitter:card", "summary_large_image");
        out = setMeta(out, "name", "twitter:title", title);
        out = setMeta(out, "name", "twitter:description", desc);
        out = setMeta(out, "name", "twitter:image", image);
        out = setCanonical(out, canonical);
        return insertBeforeHead(out, "<script type=\"application/ld+json\">" + jsonLd(mapper, name, desc, canonical, image, price, place) + "</script>");
    }

    /** Link tour hỏng/đã ẩn: không cho lập chỉ mục, canonical về trang chủ. */
    static String forUnknown(String html, String base) {
        return setCanonical(setMeta(html, "name", "robots", "noindex, nofollow"), base + "/");
    }

    static String jsonLd(ObjectMapper mapper, String name, String desc, String url, String image, long price, String place) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "TouristTrip");
        ld.put("name", name);
        ld.put("description", desc);
        ld.put("url", url);
        ld.put("image", image);
        ld.put("inLanguage", "vi");
        if (!place.isBlank()) ld.put("touristType", place);
        if (price > 0) {
            Map<String, Object> offer = new LinkedHashMap<>();
            offer.put("@type", "Offer");
            offer.put("price", price);
            offer.put("priceCurrency", "VND");
            offer.put("availability", "https://schema.org/InStock");
            offer.put("url", url);
            ld.put("offers", offer);
        }
        try {
            // "<" → \u003c để chuỗi trong tên/mô tả không thể đóng thẻ <script> sớm
            return mapper.writeValueAsString(ld).replace("<", "\\u003c");
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    static String setMeta(String html, String attr, String key, String content) {
        String tag = "<meta " + attr + "=\"" + key + "\" content=\"" + esc(content) + "\">";
        Matcher m = Pattern.compile("<meta\\s+" + attr + "=\"" + Pattern.quote(key) + "\"\\s+content=\"[^\"]*\"\\s*/?>").matcher(html);
        return m.find() ? m.replaceFirst(Matcher.quoteReplacement(tag)) : insertBeforeHead(html, tag);
    }

    static String setCanonical(String html, String href) {
        String tag = "<link rel=\"canonical\" href=\"" + esc(href) + "\">";
        Matcher m = Pattern.compile("<link\\s+rel=\"canonical\"\\s+href=\"[^\"]*\"\\s*/?>").matcher(html);
        return m.find() ? m.replaceFirst(Matcher.quoteReplacement(tag)) : insertBeforeHead(html, tag);
    }

    static String replaceTitle(String html, String title) {
        Matcher m = Pattern.compile("<title>[^<]*</title>").matcher(html);
        String tag = "<title>" + esc(title) + "</title>";
        return m.find() ? m.replaceFirst(Matcher.quoteReplacement(tag)) : insertBeforeHead(html, tag);
    }

    static String insertBeforeHead(String html, String tag) {
        int i = html.indexOf("</head>");
        return i < 0 ? html + tag : html.substring(0, i) + "  " + tag + "\n" + html.substring(i);
    }

    static String esc(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    static String clip(String s, int n) {
        String c = s == null ? "" : s.replaceAll("\\s+", " ").trim();
        return c.length() <= n ? c : c.substring(0, n - 1).replaceAll("\\s+\\S*$", "") + "…";
    }

    static String vnd(long v) {
        return String.format(Locale.GERMANY, "%,d", v);   // 2.500.000
    }

    private static List<String> nonBlank(String... parts) {
        return java.util.Arrays.stream(parts).filter(p -> p != null && !p.isBlank()).toList();
    }

    private static String firstImage(Map<String, Object> t) {
        for (String k : new String[]{"image", "img", "thumbnail"}) if (!Maps.str(t, k).isBlank()) return Maps.str(t, k);
        List<Object> imgs = Maps.list(t.get("images"));
        return imgs.isEmpty() ? DEFAULT_IMAGE : String.valueOf(imgs.get(0));
    }

    private static String absolute(String base, String path) {
        if (path.matches("(?i)^(https?:)?//.*")) return path;
        return base + (path.startsWith("/") ? "" : "/") + path;
    }
}
