package vn.travel.util;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Bản Java của frontend/shared/guide-availability.js — server kiểm tra lại lịch rảnh khi lưu đơn (G5). */
public final class GuideAvailability {
    private GuideAvailability() { }

    private static final Pattern DATE_RE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final int MAX_DAYS = 366;

    /** "YYYY-MM-DD" hợp lệ thật → LocalDate, ngược lại null (từ chối 2026-02-30...). */
    public static LocalDate parse(Object s) {
        if (!(s instanceof String str) || !DATE_RE.matcher(str).matches()) return null;
        try {
            return LocalDate.of(Integer.parseInt(str.substring(0, 4)), Integer.parseInt(str.substring(5, 7)), Integer.parseInt(str.substring(8, 10)));
        } catch (DateTimeException e) {
            return null;
        }
    }

    public static List<String> rangeDays(Object startDate, Object nDays) {
        LocalDate d0 = parse(startDate);
        double n = Pricing.num(nDays);
        List<String> out = new ArrayList<>();
        if (d0 == null || !(Math.floor(n) >= 1) || Math.floor(n) > MAX_DAYS) return out;
        for (int i = 0; i < (int) Math.floor(n); i++) out.add(d0.plusDays(i).toString());
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Set<String> busySet(Map<String, Object> guide) {
        Set<String> set = new HashSet<>();
        if (guide != null && guide.get("busyDates") instanceof List<?> l)
            for (Object o : l) if (parse(o) != null) set.add((String) o);
        return set;
    }

    /** true ⇔ CẢ nDays ngày liên tiếp đều rảnh; đầu vào sai → false (không chắc thì coi là bận). */
    public static boolean isFreeRange(Map<String, Object> guide, Object startDate, Object nDays) {
        if (guide == null) return false;
        List<String> days = rangeDays(startDate, nDays);
        if (days.isEmpty()) return false;
        Set<String> busy = busySet(guide);
        for (String d : days) if (busy.contains(d)) return false;
        return true;
    }

    public static List<String> busyInRange(Map<String, Object> guide, Object startDate, Object nDays) {
        Set<String> busy = busySet(guide);
        List<String> out = new ArrayList<>();
        for (String d : rangeDays(startDate, nDays)) if (busy.contains(d)) out.add(d);
        return out;
    }
}
