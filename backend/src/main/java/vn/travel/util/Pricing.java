package vn.travel.util;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bản Java của frontend/shared/pricing.js — CHỈ để server kiểm tra lại giá (A3/E5/FE-03).
 *   giá gốc → (+ phí HDV) → tạm tính → − voucher → GIÁ CUỐI → cọc 20%
 * Mọi con số khớp từng bước với bản JS (làm tròn nửa lên như Math.round). Test đối chiếu: PricingParityTest.
 */
public final class Pricing {
    private Pricing() { }

    public static final int DEPOSIT_PCT = 20;
    public static final double CHILD_HALF_RATE = 0.5;
    public static final long GUIDE_DAY_FEE = 1_500_000L;
    public static final int GUIDE_DAY_HOURS = 8;
    public static final long GUIDE_EXTRA_HOUR_FEE = 200_000L;

    private static int toInt(Object v, int min, int max) {
        long n = (long) Math.floor(num(v));
        return (int) Math.min(max, Math.max(min, n));
    }

    /** Giống `+v || 0` trong JS. */
    public static double num(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) { double d = n.doubleValue(); return Double.isNaN(d) ? 0 : d; }
        if (v instanceof Boolean b) return b ? 1 : 0;
        try {
            String s = v.toString().trim();
            if (s.isEmpty()) return 0;
            double d = Double.parseDouble(s);
            return Double.isNaN(d) || Double.isInfinite(d) ? 0 : d;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Math.round của JS: nửa làm tròn lên. */
    static long round(double d) { return (long) Math.floor(d + 0.5); }

    public static long guideFee(Object days, Object hours) {
        double d = Math.max(0, num(days));
        double h = num(hours);
        if (h == 0) h = GUIDE_DAY_HOURS;
        double extra = Math.max(0, h - GUIDE_DAY_HOURS);
        return (long) (d * GUIDE_DAY_FEE + d * extra * GUIDE_EXTRA_HOUR_FEE);
    }

    /** v: { type: "percent"|"fixed", value, maxDiscount? } */
    public static long voucherDiscount(Map<String, Object> v, long subtotal) {
        if (v == null || subtotal <= 0) return 0;
        long d = 0;
        Object type = v.get("type");
        if ("percent".equals(type)) d = round(subtotal * num(v.get("value")) / 100.0);
        else if ("fixed".equals(type)) d = round(num(v.get("value")));
        double max = num(v.get("maxDiscount"));
        if (max > 0) d = Math.min(d, round(max));
        return Math.max(0, Math.min(d, subtotal));
    }

    /** Tham số tính giá — cùng ý nghĩa với `o` trong Pricing.compute của JS. */
    public record Input(Object price, Object adults, Object kids, Object infants, boolean hdvOn,
                        Object hdvHours, Object days, Map<String, Object> voucher) { }

    public static Map<String, Object> compute(Input o) {
        long price = Math.max(0, round(num(o.price())));
        int adults = toInt(o.adults(), 1, 50);
        int kids = toInt(o.kids(), 0, 50);
        int infIn = toInt(o.infants(), 0, 50);
        int infants = Math.min(infIn, adults);
        kids += infIn - infants;
        long base = price * adults + round(price * (double) kids * CHILD_HALF_RATE);
        double daysRaw = num(o.days());
        long hdv = o.hdvOn() ? guideFee(daysRaw == 0 ? 1 : daysRaw, o.hdvHours()) : 0;
        long subtotal = base + hdv;
        long discount = voucherDiscount(o.voucher(), subtotal);
        long fin = subtotal - discount;
        long deposit = round(fin * DEPOSIT_PCT / 100.0);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("adults", adults);
        r.put("kids", kids);
        r.put("infants", infants);
        r.put("pax", adults + kids + infants);
        r.put("base", base);
        r.put("hdv", hdv);
        r.put("subtotal", subtotal);
        r.put("discount", discount);
        r.put("voucherCode", discount > 0 && o.voucher() != null ? String.valueOf(o.voucher().getOrDefault("code", "")) : "");
        r.put("final", fin);
        r.put("depositPct", DEPOSIT_PCT);
        r.put("deposit", deposit);
        r.put("remaining", fin - deposit);
        return r;
    }
}
