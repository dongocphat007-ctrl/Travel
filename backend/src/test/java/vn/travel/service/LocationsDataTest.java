package vn.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** NEW-14: toạ độ tour phải hợp lệ và đa số tour trong nước phải ở mức điểm đến (không còn dồn về tâm tỉnh). */
class LocationsDataTest {
    private static JsonNode load() throws Exception {
        Path f = Path.of("../frontend/data/locations.json");
        assumeTrue(Files.exists(f), "chạy từ thư mục backend/ để thấy ../frontend");
        return new ObjectMapper().readTree(Files.readString(f));
    }

    @Test void everyEntryHasValidUniqueCoordinates() throws Exception {
        Set<String> ids = new HashSet<>();
        for (JsonNode l : load().get("locations")) {
            assertTrue(ids.add(l.get("tourId").asText()), "trùng tourId " + l.get("tourId"));
            double lat = l.get("lat").asDouble(), lng = l.get("lng").asDouble();
            assertTrue(Math.abs(lat) <= 90 && Math.abs(lng) <= 180, "toạ độ ngoài phạm vi: " + l);
            assertTrue(Set.of("city", "place", "province", "country").contains(l.get("precision").asText()), "precision lạ: " + l);
            if ("Việt Nam".equals(l.get("country").asText()))
                assertTrue(lat >= 8.0 && lat <= 23.6 && lng >= 102.0 && lng <= 110.0, "toạ độ không nằm trong Việt Nam: " + l);
            if ("place".equals(l.get("precision").asText()))
                assertFalse(l.path("place").asText().isBlank(), "precision=place phải có tên điểm đến: " + l);
        }
    }

    @Test void mostVietnamToursAreRefinedBeyondProvinceCentre() throws Exception {
        int vn = 0, province = 0;
        for (JsonNode l : load().get("locations")) {
            if (!"Việt Nam".equals(l.get("country").asText())) continue;
            vn++;
            if ("province".equals(l.get("precision").asText())) province++;
        }
        assertTrue(vn > 500);
        assertTrue(province * 100 < vn * 20, "quá 20% tour trong nước vẫn ở mức tâm tỉnh: " + province + "/" + vn);
    }
}
