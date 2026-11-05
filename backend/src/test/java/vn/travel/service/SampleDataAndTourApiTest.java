package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** NEW-03 (tour Admin đến được khách qua /api/tours, /api/tours/{id}, /api/locations) và NEW-04 (cờ SAMPLE_DATA tách dữ liệu mẫu khỏi dữ liệu thật). */
class SampleDataAndTourApiTest {
    private static Map<String, Object> adminTour(String id, String name, boolean active) {
        return Maps.of("id", id, "name", name, "price", 3_200_000, "destination", "Hội An", "region", "Miền Trung", "province", "Quảng Nam",
                "type", "guided", "coverEmoji", "🌅", "highlight", "Phố cổ", "active", active, "international", false, "lat", 15.88, "lng", 108.33);
    }

    @Test void adminTourReachesCustomersAndHiddenOnesDoNot(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.dbs.update("admin-tours", old -> List.of(adminTour("tour_1", "Hội An mới", true), adminTour("tour_2", "Tour ẩn", false)));
        List<Map<String, Object>> trung = f.tours.list("trung");
        assertTrue(trung.stream().anyMatch(t -> "tour_1".equals(t.get("id"))));
        assertTrue(trung.stream().noneMatch(t -> "tour_2".equals(t.get("id"))));
        Map<String, Object> t = f.tours.publicTour("tour_1");
        assertEquals("Hội An", t.get("dest"));
        assertEquals("central", t.get("rc"));
        assertEquals("guided", t.get("guide"));
        assertNull(f.tours.publicTour("tour_2"));
        assertNull(f.tours.find("tour_2"));                 // tour ẩn cũng không đặt được
        assertNull(f.tours.list("khong-co"));               // nhóm sai → controller trả 400
        assertTrue(f.tours.list("all").size() >= 4);        // 3 tour mẫu của Fixture + tour Admin
        assertTrue(f.tours.locations().stream().anyMatch(l -> "tour_1".equals(l.get("tourId"))));
    }

    @Test void hidingASampleTourInAdminHidesItEverywhere(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        assertNotNull(f.tours.find("101"));
        f.dbs.update("admin-tours", old -> List.of(Maps.of("id", "101", "name", "Hà Nội – Hạ Long 3N2Đ", "price", 2500000, "active", false)));
        assertNull(f.tours.find("101"));
        assertNull(f.tours.publicTour("101"));
        assertTrue(f.tours.list("bac").stream().noneMatch(t -> "101".equals(String.valueOf(t.get("id")))));
    }

    @Test void sampleDataOffKeepsOnlyRealData(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        TourCatalog real = new TourCatalog(f.web.resolve("data"), f.mapper, f.dbs, false);
        f.dbs.update("admin-tours", old -> List.of(adminTour("tour_1", "Hội An mới", true)));
        assertNull(real.find("101"));                                               // tour mẫu biến mất
        assertNotNull(real.find("tour_1"));                                         // tour Admin tự tạo vẫn còn
        assertEquals(1, real.list("all").size());
        Stats st = new Stats(f.dbs, f.data, false);
        assertTrue(st.featured().isEmpty());                                        // không còn lượt dùng mẫu
        Reviews rv = new Reviews(f.dbs, f.data, st, f.accounts, f.clock, true);
        assertEquals(0, rv.read("101").get("count"));                               // không còn review mẫu
        assertEquals(1, new Reviews(f.dbs, f.data, f.stats, f.accounts, f.clock, false).read("101").get("count"));
        // HDV demo bị gỡ khỏi storage khi tắt dữ liệu mẫu
        assertFalse(new Guides(f.dbs, f.web.resolve("data/guides-seed.json"), f.mapper, true).list().isEmpty());
        assertTrue(new Guides(f.dbs, f.web.resolve("data/guides-seed.json"), f.mapper, false).list().isEmpty());
    }
}
