package vn.travel.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** BE-04: allowlist file tĩnh và giới hạn trang khách/dashboard theo phiên + vai trò. */
class StaticSiteConfigTest {
    private final OncePerRequestFilter filter = new StaticSiteConfig(null, req -> {
        String role = req.getHeader("X-Test-Role");
        return role == null ? null : Map.of("role", role);
    }).publicOnlyFilter();

    private int status(String uri) throws Exception {
        return response(uri, null).getStatus();
    }

    private MockHttpServletResponse response(String uri, String role) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        req.setRequestURI(uri);
        if (role != null) req.addHeader("X-Test-Role", role);
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        return res;
    }

    @Test void privateAndSourceFilesAreNotFound() throws Exception {
        for (String p : new String[]{"/storage/db/accounts.json", "/storage/db/.secret", "/storage", "/.env", "/backend/.env", "/.git/config",
                "/pom.xml", "/src/main/resources/application.properties", "/legacy-node/server.js", "/README.md", "/Dockerfile"})
            assertEquals(404, status(p), p);
    }

    @Test void traversalAndEncodedTricksAreNotFound() throws Exception {
        for (String p : new String[]{"/js/../.env", "/js/..%2F..%2F.env", "/css/%2e%2e/storage/db/accounts.json", "/img/%2e%2e/.env", "/js/a.js%00.png", "/data/db/bookings.json",
                "/data/private/x.json", "/data/orders.json", "/js/.hidden", "/js/app.bak", "/js/key.pem", "/data/x.env"})
            assertEquals(404, status(p), p);
    }

    @Test void publicAssetsAndApiPassThrough() throws Exception {
        for (String p : new String[]{"/", "/index.html", "/guide.html", "/js/api-client.js", "/css/style.css", "/data/tours/mien-bac.json", "/img/favicon/logo.png", "/fonts/x.woff2",
                "/robots.txt", "/sitemap.xml", "/api/health", "/api/tours", "/api/admin/anything"})
            assertEquals(200, status(p), p);
    }

    @Test void internalRolesAreRedirectedAwayFromCustomerPages() throws Exception {
        Map<String, String> ownPages = Map.of(
                "admin", "/staff/admin.html", "cashier", "/staff/cashier.html", "operator", "/staff/operator.html",
                "support", "/staff/support.html", "content", "/staff/content.html", "guide", "/staff/guide.html");
        for (var entry : ownPages.entrySet()) {
            for (String page : new String[]{"/", "/index.html", "/guide.html", "/print.html", "/html/page-home.html"}) {
                MockHttpServletResponse res = response(page, entry.getKey());
                assertEquals(302, res.getStatus(), entry.getKey() + " " + page);
                assertEquals(entry.getValue(), res.getRedirectedUrl(), entry.getKey() + " " + page);
            }
        }
    }

    @Test void internalRolesCanOnlyOpenTheirOwnStaffPage() throws Exception {
        Map<String, String> ownPages = Map.of(
                "admin", "/staff/admin.html", "cashier", "/staff/cashier.html", "operator", "/staff/operator.html",
                "support", "/staff/support.html", "content", "/staff/content.html", "guide", "/staff/guide.html");
        for (var entry : ownPages.entrySet()) {
            MockHttpServletResponse own = response(entry.getValue(), entry.getKey());
            assertEquals(200, own.getStatus(), entry.getKey());
        }

        MockHttpServletResponse other = response("/staff/admin.html", "cashier");
        assertEquals(302, other.getStatus());
        assertEquals("/staff/cashier.html", other.getRedirectedUrl());

        MockHttpServletResponse customer = response("/staff/admin.html", "user");
        assertEquals(302, customer.getStatus());
        assertEquals("/", customer.getRedirectedUrl());
    }
}
