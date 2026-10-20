package vn.travel.util;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReviewSchemaTest {
    private static Map<String, Object> r(Object rating) { return Map.of("rating", rating); }

    @Test void ratingMustBeRealInteger() {
        assertEquals(4, ReviewSchema.toRating(4));
        assertEquals(4, ReviewSchema.toRating("4"));
        assertEquals(-1, ReviewSchema.toRating(4.5));
        assertEquals(-1, ReviewSchema.toRating(true));
        assertEquals(-1, ReviewSchema.toRating(null));
        assertEquals(-1, ReviewSchema.toRating("abc"));
        assertEquals(-1, ReviewSchema.toRating(0));
        assertEquals(-1, ReviewSchema.toRating(6));
    }

    @Test void validateInputRules() {
        assertFalse(ReviewSchema.validateInput(Map.of("rating", 5, "content", "abc")).ok());           // quá ngắn
        assertFalse(ReviewSchema.validateInput(Map.of("rating", 5, "content", "x".repeat(1001))).ok()); // quá dài
        assertEquals("rating", ReviewSchema.validateInput(Map.of("rating", 4.5, "content", "Rất tuyệt")).field());
        assertEquals("criteria", ReviewSchema.validateInput(Map.of("rating", 5, "content", "Rất tuyệt", "criteria", Map.of("lạ", 3))).field());
        assertEquals("image", ReviewSchema.validateInput(Map.of("rating", 5, "content", "Rất tuyệt", "image", "javascript:alert(1)")).field());
        ReviewSchema.Check ok = ReviewSchema.validateInput(Map.of("rating", "5", "content", "  Rất tuyệt  ", "criteria", Map.of("guide", 4), "image", "img/a.png"));
        assertTrue(ok.ok());
        assertEquals("Rất tuyệt", ok.value().get("content"));
    }

    @Test void averageRoundsHalfUp() {
        assertEquals(3.3, ReviewSchema.average(List.of(r(3), r(3), r(3), r(4)))); // 3.25 → 3.3
        assertEquals(0.0, ReviewSchema.average(List.of()));
    }

    @Test @SuppressWarnings("unchecked") void distributionSumsTo100() {
        Map<String, Object> d = ReviewSchema.distribution(List.of(r(5), r(5), r(4)));
        Map<String, Integer> pct = (Map<String, Integer>) d.get("percent");
        assertEquals(100, pct.values().stream().mapToInt(Integer::intValue).sum());
        assertEquals(3, d.get("total"));
    }
}
