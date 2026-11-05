package vn.travel.util;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Sức chứa / số khách tối thiểu của một tour: trường capacity, minGuests của tour (chỉ ADMIN sửa) hoặc đọc từ groupSize "6–12 người". */
public final class Capacity {
    private Capacity() { }

    private static final Pattern RANGE = Pattern.compile("(\\d+)\\D+(\\d+)");

    public static int maxGuests(Map<String, Object> tour, int fallback) {
        if (tour == null) return fallback;
        long c = Maps.lng(tour, "capacity");
        if (c > 0) return (int) c;
        Matcher m = RANGE.matcher(Maps.str(tour, "groupSize"));
        if (m.find()) return Math.max(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)));
        return fallback;
    }

    public static int minGuests(Map<String, Object> tour, int fallback) {
        if (tour == null) return fallback;
        long c = Maps.lng(tour, "minGuests");
        if (c > 0) return (int) c;
        Matcher m = RANGE.matcher(Maps.str(tour, "groupSize"));
        if (m.find()) return Math.max(1, Math.min(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2))));
        return fallback;
    }

    /** Khóa của một chuyến khởi hành: tourId|yyyy-MM-dd. */
    public static String depKey(Object tourId, Object date) {
        return String.valueOf(tourId) + "|" + String.valueOf(date);
    }
}
