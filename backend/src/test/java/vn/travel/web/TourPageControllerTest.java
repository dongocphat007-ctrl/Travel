package vn.travel.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TourPageControllerTest {
    private static final String HTML = """
            <!DOCTYPE html><html><head>
              <title>Travel – Tour du lịch</title>
              <meta name="description" content="mặc định">
              <meta name="robots" content="index, follow">
              <meta property="og:title" content="Travel – Tour du lịch">
              <meta property="og:image" content="img/og-cover.png">
              <link rel="sitemap" type="application/xml" href="/sitemap.xml">
            </head><body></body></html>""";
    private static final ObjectMapper M = new ObjectMapper();

    private static Map<String, Object> tour() {
        return Map.of("id", 101, "name", "Hà Nội – Hạ Long 3N2Đ", "price", 2500000, "region", "Miền Bắc", "dest", "Hạ Long",
                "duration", "3 ngày 2 đêm", "desc", "Khám phá vịnh \"Hạ Long\" <kỳ vĩ>");
    }

    @Test void tourPageGetsItsOwnTitleDescriptionCanonicalAndJsonLd() {
        String out = TourPageController.forTour(HTML, "https://travel.vn", "101", tour(), M);
        assertTrue(out.contains("<title>Hà Nội – Hạ Long 3N2Đ – Travel</title>"));
        assertFalse(out.contains("<title>Travel – Tour du lịch</title>"));
        assertTrue(out.contains("<link rel=\"canonical\" href=\"https://travel.vn/?tour=101\">"));
        assertTrue(out.contains("<meta property=\"og:url\" content=\"https://travel.vn/?tour=101\">"));
        assertTrue(out.contains("<meta property=\"og:image\" content=\"https://travel.vn/img/og-cover.png\">"));
        assertTrue(out.contains("\"@type\":\"TouristTrip\""));
        assertTrue(out.contains("\"priceCurrency\":\"VND\""));
        assertTrue(out.contains("\"price\":2500000"));
        assertEquals(1, out.split("name=\"description\"", -1).length - 1, "không nhân đôi thẻ description");
        assertEquals(1, out.split("<title>", -1).length - 1);
    }

    @Test void userTextIsEscapedInAttributesAndJsonLd() {
        String out = TourPageController.forTour(HTML, "https://travel.vn", "101", tour(), M);
        assertTrue(out.contains("&quot;Hạ Long&quot; &lt;kỳ vĩ&gt;"));
        String ld = out.substring(out.indexOf("application/ld+json"));
        assertFalse(ld.substring(0, ld.indexOf("</script>")).contains("<kỳ"), "dấu < trong JSON-LD phải bị escape");
    }

    @Test void unknownTourIsNoindexWithHomeCanonical() {
        String out = TourPageController.forUnknown(HTML, "https://travel.vn");
        assertTrue(out.contains("<meta name=\"robots\" content=\"noindex, nofollow\">"));
        assertTrue(out.contains("<link rel=\"canonical\" href=\"https://travel.vn/\">"));
    }

    @Test void tourWithoutPriceHasNoOffer() {
        String out = TourPageController.forTour(HTML, "https://travel.vn", "x", Map.of("name", "Tour thử"), M);
        assertFalse(out.contains("\"offers\""));
        assertTrue(out.contains("<title>Tour thử – Travel</title>"));
    }

    @Test void clipAndVnd() {
        assertEquals("2.500.000", TourPageController.vnd(2500000));
        assertTrue(TourPageController.clip("a ".repeat(200), 20).length() <= 20);
    }
}
