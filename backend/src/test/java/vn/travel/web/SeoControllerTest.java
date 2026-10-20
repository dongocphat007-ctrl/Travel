package vn.travel.web;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SeoControllerTest {
    @Test void sitemapListsHomeAndEveryTourWithEscapedIds() {
        String xml = SeoController.buildSitemap("https://travel.example", List.of("DL001", "a&b c"));
        assertTrue(xml.startsWith("<?xml"));
        assertTrue(xml.contains("<loc>https://travel.example/</loc>"));
        assertTrue(xml.contains("<loc>https://travel.example/?tour=DL001</loc>"));
        assertTrue(xml.contains("?tour=a%26b+c</loc>"), "id phải được URL-encode rồi mới escape XML");
        assertEquals(3, xml.split("<url>", -1).length - 1);
    }

    @Test void robotsBlocksApiAndPointsToSitemap() {
        String r = SeoController.buildRobots("https://travel.example");
        assertTrue(r.contains("Disallow: /api/"));
        assertTrue(r.contains("Sitemap: https://travel.example/sitemap.xml"));
    }

    @Test void trimSlashRemovesTrailingSlashes() {
        assertEquals("https://x.vn", SeoController.trimSlash("https://x.vn//"));
    }
}
