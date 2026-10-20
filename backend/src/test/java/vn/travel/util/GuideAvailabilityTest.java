package vn.travel.util;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GuideAvailabilityTest {
    private static Map<String, Object> g(String... busy) { return Map.of("busyDates", List.of(busy)); }

    @Test void freeWhenNoBusy() { assertTrue(GuideAvailability.isFreeRange(g(), "2026-11-02", 3)); }
    @Test void busyFirstDay() { assertFalse(GuideAvailability.isFreeRange(g("2026-11-02"), "2026-11-02", 3)); }
    @Test void busyMiddleDay() { assertFalse(GuideAvailability.isFreeRange(g("2026-11-03"), "2026-11-02", 3)); }
    @Test void busyLastDay() { assertFalse(GuideAvailability.isFreeRange(g("2026-11-04"), "2026-11-02", 3)); }
    @Test void justOutsideRangeIsFree() { assertTrue(GuideAvailability.isFreeRange(g("2026-11-01", "2026-11-05"), "2026-11-02", 3)); }
    @Test void crossesMonthAndLeapYear() {
        assertEquals(List.of("2028-02-28", "2028-02-29", "2028-03-01"), GuideAvailability.rangeDays("2028-02-28", 3));
        assertFalse(GuideAvailability.isFreeRange(g("2026-12-01"), "2026-11-30", 2));
    }
    @Test void garbageInputIsNotFree() {
        assertFalse(GuideAvailability.isFreeRange(null, "2026-11-02", 3));
        assertFalse(GuideAvailability.isFreeRange(g(), "2026-02-30", 3));
        assertFalse(GuideAvailability.isFreeRange(g(), "2026-11-02", 0));
        assertFalse(GuideAvailability.isFreeRange(g(), "abc", 2));
    }
    @Test void busyInRangeListsClashes() {
        assertEquals(List.of("2026-11-03"), GuideAvailability.busyInRange(g("2026-11-03", "2026-12-01"), "2026-11-02", 3));
    }
}
