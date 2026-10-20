package vn.travel.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;

public final class Times {
    private Times() { }

    public static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    /** ISO-8601 → epoch millis; rỗng/sai → null. */
    public static Long parse(Object iso) {
        if (iso == null || "".equals(iso)) return null;
        try {
            return Instant.parse(String.valueOf(iso)).toEpochMilli();
        } catch (DateTimeParseException e) {
            try {
                return java.time.OffsetDateTime.parse(String.valueOf(iso)).toInstant().toEpochMilli();
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    public static String iso(long millis) {
        return Instant.ofEpochMilli(millis).toString();
    }

    public static LocalDate todayVN(long nowMillis) {
        return Instant.ofEpochMilli(nowMillis).atZone(VN).toLocalDate();
    }
}
