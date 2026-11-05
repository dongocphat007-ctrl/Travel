package vn.travel.web;

import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Maps;
import vn.travel.util.Pricing;

import java.util.Map;

/** Tiện ích nhỏ dùng chung cho các controller vai trò. */
final class Api {
    private Api() { }

    static Map<String, Object> body(Map<String, Object> b) { return b == null ? Map.of() : b; }

    static String s(Map<String, Object> b, String k) { return Maps.str(body(b), k); }

    /** Số nguyên dương/âm từ JSON; thiếu hoặc không phải số → 400. */
    static long num(Map<String, Object> b, String k) {
        Object v = body(b).get(k);
        if (!(v instanceof Number) && !(v instanceof String str && str.trim().matches("-?\\d+(\\.\\d+)?"))) throw HttpError.bad("Thiếu hoặc sai số: " + k, k);
        return (long) Pricing.num(v);
    }

    static Integer optInt(Map<String, Object> b, String k) {
        Object v = body(b).get(k);
        if (v == null || "".equals(v)) return null;
        return (int) num(b, k);
    }

    static Actor actor(Map<String, Object> account) { return Actor.of(account); }

    static String csv(java.util.List<Map<String, Object>> rows, String... cols) {
        StringBuilder sb = new StringBuilder("﻿");
        sb.append(String.join(",", cols)).append("\r\n");
        for (Map<String, Object> r : rows) {
            for (int i = 0; i < cols.length; i++) {
                if (i > 0) sb.append(',');
                String v = Maps.str(r, cols[i]);
                if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) v = "'" + v;   // chống CSV injection
                sb.append('"').append(v.replace("\"", "\"\"")).append('"');
            }
            sb.append("\r\n");
        }
        return sb.toString();
    }
}
