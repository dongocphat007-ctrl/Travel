package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Reviews: chỉ khách ĐÃ ĐI XONG tour mới được đánh giá, không trùng, validate đầu vào, review mẫu ẩn được. */
class ReviewsTest {
    private static Map<String, Object> req(String tourId, String date) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", tourId); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("date", date); m.put("adults", 1);
        return m;
    }

    /** Vòng đời mới: chỉ đơn đã "completed" (HDV kết thúc chuyến) mới được đánh giá. */
    private static void done(Fixture f) {
        f.dbs.edit("bookings", all -> all.forEach(x -> x.put("status", "completed")));
    }

    private static Map<String, Object> review(String tourId, int rating) {
        return Maps.of("tourId", tourId, "rating", rating, "content", "Chuyến đi rất tuyệt vời, hướng dẫn viên nhiệt tình và lịch trình hợp lý.");
    }

    @Test void seedReviewsAreMarkedSampleAndReadable(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> out = f.reviews.read("101");
        assertEquals(1, out.get("count"));
        assertEquals(0, f.reviews.read("hot07").get("count"));
    }

    @Test void hideSampleFlagRemovesSeedButKeepsReal(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Reviews hidden = new Reviews(f.dbs, f.data, f.stats, f.accounts, f.clock, true);
        assertEquals(0, hidden.read("101").get("count"));
    }

    @Test void cannotReviewBeforeCompletingTour(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        assertEquals(Boolean.FALSE, f.reviews.eligible(u, "101").get("eligible"));          // chưa đặt tour
        f.bookings.create(u, req("101", "2026-11-10"));
        assertEquals(Boolean.FALSE, f.reviews.eligible(u, "101").get("eligible"));          // đã đặt nhưng chưa đi
        f.clock.plusDays(20);                                                                // tour đã qua ngày nhưng chưa "completed" → vẫn chưa được đánh giá
        assertEquals(Boolean.FALSE, f.reviews.eligible(u, "101").get("eligible"));
        assertEquals(403, assertThrows(HttpError.class, () -> f.reviews.create(u, review("101", 5))).status());
    }

    @Test void completedCustomerReviewsOnceAndTotalsUpdate(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        f.bookings.create(u, req("101", "2026-11-10"));
        f.clock.plusDays(20); done(f);                                                                // tour 3 ngày kết thúc 12/11 → đã đi xong
        assertEquals(Boolean.TRUE, f.reviews.eligible(u, "101").get("eligible"));
        Map<String, Object> pub = f.reviews.create(u, review("101", 4));
        assertFalse(pub.containsKey("userId"), "không lộ userId ra ngoài");
        assertEquals(2, f.reviews.read("101").get("count"));                                 // 1 mẫu + 1 thật
        HttpError dup = assertThrows(HttpError.class, () -> f.reviews.create(u, review("101", 5)));
        assertEquals(409, dup.status());
        assertEquals(Boolean.TRUE, f.reviews.eligible(u, "101").get("duplicate"));
    }

    @Test void cancelledBookingDoesNotQualify(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        Map<String, Object> b = f.bookings.create(u, req("101", "2026-11-10"));
        f.dbs.edit("bookings", all -> all.forEach(x -> { if (Maps.str(x, "id").equals(Maps.str(b, "id"))) x.put("status", "cancelled"); }));
        f.clock.plusDays(20);
        assertEquals(Boolean.FALSE, f.reviews.eligible(u, "101").get("eligible"));
    }

    @Test void invalidInputIsRejectedWithField(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("a@gmail.com");
        f.bookings.create(u, req("101", "2026-11-10"));
        f.clock.plusDays(20); done(f);
        assertEquals("rating", assertThrows(HttpError.class, () -> f.reviews.create(u, review("101", 9))).field());
        assertEquals("content", assertThrows(HttpError.class, () -> f.reviews.create(u, Maps.of("tourId", "101", "rating", 5, "content", "  "))).field());
        assertEquals(400, assertThrows(HttpError.class, () -> f.reviews.eligible(u, "")).status());
    }

    @Test void contentCanReplyToReviewAndCustomersCanComment(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u = f.newUser("customer@gmail.com");

        // 1. Khách hàng gửi bình luận / hỏi đáp (không cần hoàn thành tour)
        Map<String, Object> c = f.reviews.addComment(u, Maps.of("tourId", "101", "rating", 5, "content", "Tour này có hỗ trợ ăn chay không?"));
        assertNotNull(c.get("id"));
        assertEquals("member", c.get("source"));
        assertEquals("Tour này có hỗ trợ ăn chay không?", c.get("content"));

        // 2. Nhân viên Content rep lại bình luận đó
        OpsCore.Actor contentStaff = new OpsCore.Actor("nd001", "Biên tập viên", "content");
        Map<String, Object> rep = f.reviews.replyReview(contentStaff, Maps.str(c, "id"), "Dạ bên em có phục vụ thực đơn chay riêng chu đáo ạ!");
        assertTrue((Boolean) rep.get("ok"));
        assertNotNull(rep.get("reply"));

        // 3. Khách thấy câu trả lời của Content trong danh sách công khai
        Map<String, Object> pub = f.reviews.read("101");
        List<Map<String, Object>> list = (List<Map<String, Object>>) pub.get("reviews");
        Map<String, Object> target = list.stream().filter(r -> Maps.str(c, "id").equals(r.get("id"))).findFirst().orElseThrow();
        assertNotNull(target.get("reply"));
        Map<String, Object> repObj = (Map<String, Object>) target.get("reply");
        assertEquals("Dạ bên em có phục vụ thực đơn chay riêng chu đáo ạ!", repObj.get("content"));
        assertEquals("Biên tập viên", repObj.get("byName"));

        // 4. Content xóa hoặc sửa reply
        f.reviews.replyReview(contentStaff, Maps.str(c, "id"), "");
        Map<String, Object> updated = f.reviews.read("101");
        List<Map<String, Object>> updatedList = (List<Map<String, Object>>) updated.get("reviews");
        Map<String, Object> targetCleared = updatedList.stream().filter(r -> Maps.str(c, "id").equals(r.get("id"))).findFirst().orElseThrow();
        assertNull(targetCleared.get("reply"));
    }

    @Test void membersCanReplyToEachOtherWithoutCreatingTourRatings(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> alice = f.newUser("alice@gmail.com");
        Map<String, Object> bob = f.newUser("bob@gmail.com");
        Map<String, Object> comment = f.reviews.addComment(alice, Maps.of(
                "tourId", "101", "targetType", "tour", "rating", 5,
                "content", "Mọi người cho mình hỏi lịch trình có phù hợp trẻ nhỏ không?"));
        assertFalse(comment.containsKey("rating"), "bình luận tour không được tạo điểm sao");

        Map<String, Object> reply = f.reviews.addCommunityReply(bob, Maps.str(comment, "id"),
                Maps.of("content", "Nhà mình đi cùng bé 6 tuổi, lịch trình khá thoải mái."));
        assertFalse(reply.containsKey("userId"), "response của reply không lộ userId");
        String replyId = Maps.str(reply, "id");
        f.reviews.addCommunityReply(alice, Maps.str(comment, "id"),
                Maps.of("content", "Cảm ơn bạn đã chia sẻ!", "replyToId", replyId));

        Map<String, Object> publicData = f.reviews.read("101");
        List<Map<String, Object>> list = (List<Map<String, Object>>) publicData.get("reviews");
        Map<String, Object> visible = list.stream()
                .filter(item -> Maps.str(comment, "id").equals(Maps.str(item, "id")))
                .findFirst().orElseThrow();
        List<Map<String, Object>> replies = (List<Map<String, Object>>) visible.get("replies");
        assertEquals(2, replies.size());
        assertEquals(replyId, replies.get(1).get("replyToId"));
        assertTrue(replies.stream().noneMatch(item -> item.containsKey("userId")));
        assertTrue(replies.stream().allMatch(item -> !item.containsKey("rating")));
    }
}
