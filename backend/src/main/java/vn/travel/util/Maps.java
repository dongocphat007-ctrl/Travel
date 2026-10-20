package vn.travel.util;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Vài hàm nhỏ để đọc Map<String,Object> như đọc JSON. */
public final class Maps {
    private Maps() { }

    public static String str(Map<String, Object> m, String k) {
        Object v = m == null ? null : m.get(k);
        return v == null ? "" : String.valueOf(v);
    }

    public static boolean bool(Map<String, Object> m, String k) {
        return m != null && Boolean.TRUE.equals(m.get(k));
    }

    public static long lng(Map<String, Object> m, String k) {
        Object v = m == null ? null : m.get(k);
        return (long) Pricing.num(v);
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> map(Object v) {
        return v instanceof Map<?, ?> ? (Map<String, Object>) v : null;
    }

    @SuppressWarnings("unchecked")
    public static List<Object> list(Object v) {
        return v instanceof List<?> ? (List<Object>) v : List.of();
    }

    public static Map<String, Object> of(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    public static Map<String, Object> copy(Map<String, Object> m) {
        return new LinkedHashMap<>(m);
    }
}
