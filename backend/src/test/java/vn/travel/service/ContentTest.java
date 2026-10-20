package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ContentTest {
    private static Map<String, Object> req(String tourId, String date) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", tourId); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("date", date); m.put("adults", 1);
        return m;
    }
    private static Map<String, Object> banner(String title, String start, String end, int prio, boolean on) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title); m.put("startAt", start); m.put("endAt", end); m.put("priority", prio); m.put("enabled", on);
        return m;
    }

    @Test void bannerActiveWindowPriorityAndNextChange(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.banners.create(banner("Đang chạy", "2026-10-01T00:00:00Z", "2026-12-01T00:00:00Z", 5, true));
        f.banners.create(banner("Ưu tiên cao", "2026-10-01T00:00:00Z", null, 50, true));
        f.banners.create(banner("Sắp tới", "2026-11-05T00:00:00Z", "2026-11-20T00:00:00Z", 99, true));
        f.banners.create(banner("Đã hết hạn", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z", 99, true));
        f.banners.create(banner("Đang tắt", "2026-10-01T00:00:00Z", null, 99, false));
        Map<String, Object> a = f.banners.active();
        List<String> titles = ((List<Map<String, Object>>) a.get("banners")).stream().map(b -> Maps.str(b, "title")).toList();
        assertEquals(List.of("Ưu tiên cao", "Đang chạy"), titles);
        assertEquals("2026-11-05T00:00:00Z", a.get("nextChange"));
        f.clock.plusDays(5);   // 2026-11-06: banner "Sắp tới" bắt đầu
        titles = ((List<Map<String, Object>>) f.banners.active().get("banners")).stream().map(b -> Maps.str(b, "title")).toList();
        assertEquals(List.of("Sắp tới", "Ưu tiên cao", "Đang chạy"), titles);
        f.clock.plusDays(20);  // 2026-11-26: "Sắp tới" hết hạn tự động
        assertEquals(2, ((List<?>) f.banners.active().get("banners")).size());
    }

    @Test void bannerValidationAndUpload(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> bad = banner("X", "2026-10-02T00:00:00Z", "2026-10-01T00:00:00Z", 1, true);
        assertEquals("endAt", assertThrows(HttpError.class, () -> f.banners.create(bad)).field());
        Map<String, Object> js = banner("X", null, null, 1, true); js.put("link", "javascript:alert(1)");
        assertEquals("link", assertThrows(HttpError.class, () -> f.banners.create(js)).field());
        Map<String, Object> img = banner("X", null, null, 1, true); img.put("image", "../../etc/passwd");
        assertEquals("image", assertThrows(HttpError.class, () -> f.banners.create(img)).field());

        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0};
        String url = f.banners.upload("data:image/png;base64," + Base64.getEncoder().encodeToString(png));
        assertTrue(url.startsWith("img/banners/up-") && url.endsWith(".png"));
        assertTrue(Files.exists(f.web.resolve(url)));
        assertThrows(HttpError.class, () -> f.banners.upload("data:image/png;base64," + Base64.getEncoder().encodeToString("<script>alert(1)</script>".getBytes())));   // không phải ảnh thật
        assertThrows(HttpError.class, () -> f.banners.upload("data:text/html;base64,PGI+"));
    }

    @Test void featuredCountsRealBookingsExcludesCancelledAndZero(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        List<Map<String, Object>> top = f.stats.featured();
        assertEquals(1, top.size());                       // hot07 có 0 lượt → không hiển thị
        assertEquals("101", top.get(0).get("tourId"));
        assertEquals(100L, ((Number) top.get(0).get("used")).longValue());
        Map<String, Object> b1 = f.bookings.create(u, req("hot07", "2026-11-10"));
        Map<String, Object> b2 = f.bookings.create(u, req("101", "2026-11-10"));
        assertEquals(2, f.stats.featured().size());
        assertEquals(101L, ((Number) f.stats.of("101").get("used")).longValue());
        f.bookings.cancel(Maps.str(b2, "id"), u);          // đơn hủy không tính
        assertEquals(100L, ((Number) f.stats.of("101").get("used")).longValue());
        assertTrue(((Number) f.stats.of("hot07").get("reviews")).longValue() < ((Number) f.stats.of("hot07").get("used")).longValue() || ((Number) f.stats.of("hot07").get("reviews")).longValue() == 0);
        assertNotNull(b1);
    }

    @Test void featuredLimitedToTen(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        StringBuilder sb = new StringBuilder("{\"tours\":[");
        for (int i = 1; i <= 15; i++) sb.append(i > 1 ? "," : "").append("{\"tourId\":\"t").append(i).append("\",\"used\":").append(i * 10).append(",\"reviews\":1,\"rating\":4.5}");
        Files.writeString(f.web.resolve("data/tour-stats.json"), sb.append("]}").toString());
        List<Map<String, Object>> top = f.stats.featured();
        assertEquals(10, top.size());
        assertEquals("t15", top.get(0).get("tourId"));
        assertEquals(1, top.get(0).get("rank"));
    }

    @Test void reviewsOnlyAfterTourFinishedNoDuplicateAndValidated(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com"), other = f.newUser("c@gmail.com");
        assertEquals(false, f.reviews.eligible(u, "101").get("eligible"));       // chưa đặt
        f.bookings.create(u, req("101", "2026-11-10"));
        assertEquals(false, f.reviews.eligible(u, "101").get("eligible"));       // chưa đi xong
        assertEquals(403, assertThrows(HttpError.class, () -> f.reviews.create(u, Map.of("tourId", "101", "rating", 5, "content", "Rất tuyệt vời"))).status());
        f.clock.plusDays(20);                                                    // tour 10–12/11 đã kết thúc
        assertEquals(true, f.reviews.eligible(u, "101").get("eligible"));
        assertEquals(false, f.reviews.eligible(other, "101").get("eligible"));
        assertEquals("rating", assertThrows(HttpError.class, () -> f.reviews.create(u, Map.of("tourId", "101", "rating", 4.5, "content", "Rất tuyệt vời"))).field());
        Map<String, Object> r = f.reviews.create(u, Map.of("tourId", "101", "rating", 4, "content", "Rất tuyệt vời", "source", "admin", "userId", "x", "criteria", Map.of("guide", 5)));
        assertEquals("verified", r.get("source"));           // client không tự đặt được nguồn
        assertFalse(r.containsKey("userId"));                // không lộ userId
        assertEquals(409, assertThrows(HttpError.class, () -> f.reviews.create(u, Map.of("tourId", "101", "rating", 5, "content", "Thêm lần nữa"))).status());
        Map<String, Object> read = f.reviews.read("101");
        assertEquals(2, read.get("count"));                  // 1 mẫu + 1 thật
        assertTrue(((Map<String, Object>) read.get("criteriaAverages")).containsKey("guide"));
    }

    @Test void guideListMergesBookingHeldDates(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> in = req("101", "2026-11-10"); in.put("guideId", "g1");
        f.bookings.create(f.newUser("a@gmail.com"), in);
        List<?> busy = (List<?>) f.guides.get("g1").get("busyDates");
        assertTrue(busy.containsAll(List.of("2026-11-10", "2026-11-11", "2026-11-12", "2026-12-10")));
        assertNull(f.guides.get("nope"));
    }

    @Test void notificationsPerUserReadAndDelete(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        String a = Maps.str(f.newUser("a@gmail.com"), "id"), c = Maps.str(f.newUser("c@gmail.com"), "id");
        Map<String, Object> l = f.noti.list(a);
        assertEquals(2L, ((Number) l.get("unread")).longValue());      // chào mừng + mã tour
        String id = Maps.str(((List<Map<String, Object>>) l.get("notifications")).get(0), "id");
        f.noti.markRead(c, List.of(id));                               // người khác không đánh dấu hộ được
        assertEquals(2L, ((Number) f.noti.list(a).get("unread")).longValue());
        f.noti.markRead(a, List.of(id));
        assertEquals(1L, ((Number) f.noti.list(a).get("unread")).longValue());
        f.noti.delete(a, null);
        assertEquals(0, ((List<?>) f.noti.list(a).get("notifications")).size());
        assertEquals(2, ((List<?>) f.noti.list(c).get("notifications")).size());
    }

    @Test void firstRunSeedsDefaultBannersFromResource(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.banners.seedIfMissing();
        f.banners.seedIfMissing();   // chạy lại không nhân đôi
        assertEquals(5, f.banners.adminList().size());
        assertEquals(5, ((List<?>) f.banners.active().get("banners")).size());
    }
}
