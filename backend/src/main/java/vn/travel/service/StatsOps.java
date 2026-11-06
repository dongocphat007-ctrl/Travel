package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.LocalDate;
import java.util.*;

/**
 * Thống kê đầy đủ cho ADMIN (TASKS 15.1–15.9). Doanh thu = tiền thu ngân đã xác nhận (sổ thanh toán) trừ tiền đã hoàn, tính theo NGÀY GHI NHẬN, giờ Việt Nam;
 * số đơn tính theo ngày đặt; đơn cancelled / refunded không tính vào số đơn hiệu lực. Kỳ không có dữ liệu vẫn trả về 0 (đủ 12 tháng, 4 quý).
 */
@Service
@SuppressWarnings("unchecked")
public class StatsOps {
    public static final String NOTE = "Doanh thu = tiền thu ngân đã xác nhận trừ tiền đã hoàn, tính theo ngày xác nhận (giờ Việt Nam). Số đơn tính theo ngày đặt; đơn đã hủy / đã hoàn tiền không tính vào đơn hiệu lực.";
    private final OpsCore core;

    public StatsOps(OpsCore core) { this.core = core; }

    private static int[] ym(Long ms) {
        if (ms == null) return null;
        LocalDate d = Times.todayVN(ms);
        return new int[]{d.getYear(), d.getMonthValue()};
    }

    public Map<String, Object> report(String period, Integer year, Integer quarter, Integer month) {
        String p = period == null || period.isEmpty() ? "month" : period;
        if (!Set.of("month", "quarter", "year").contains(p)) throw HttpError.bad("period phải là month, quarter hoặc year", "period");
        int y = year == null ? core.today().getYear() : year;
        if (y < 2000 || y > 2100) throw HttpError.bad("Năm không hợp lệ", "year");
        if (quarter != null && (quarter < 1 || quarter > 4)) throw HttpError.bad("Quý phải từ 1 đến 4", "quarter");
        if (month != null && (month < 1 || month > 12)) throw HttpError.bad("Tháng phải từ 1 đến 12", "month");

        long[] rev = new long[13], refunded = new long[13], collected = new long[13], pax = new long[13], bookedRev = new long[13];
        int[] orders = new int[13], cancelled = new int[13], confirmedOrders = new int[13];
        Map<String, Integer> byStatus = new LinkedHashMap<>();
        for (String s : Flow.ALL) byStatus.put(s, 0);
        Map<String, long[]> tours = new HashMap<>();   // tourId -> {orders, revenue}
        Map<String, String> tourName = new HashMap<>();
        int targetMonth = month != null ? month : (y == core.today().getYear() ? core.today().getMonthValue() : 12);
        int targetQuarter = quarter != null ? quarter : (y == core.today().getYear() ? (core.today().getMonthValue() - 1) / 3 + 1 : 4);
        List<Map<String, Object>> monthOrders = new ArrayList<>();

        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            int[] c = ym(Times.parse(b.get("createdAt")));
            boolean inYear = c != null && c[0] == y;
            if (inYear) {
                byStatus.merge(st, 1, Integer::sum);
                if (Flow.CANCELLED.equals(st) || Flow.REFUNDED.equals(st) || Flow.REFUND_PENDING.equals(st)) cancelled[c[1]]++;
                else {
                    orders[c[1]]++;
                    pax[c[1]] += Maps.lng(b, "pax");
                }
            }
            int[] conf = null;
            if (Flow.confirmedOrLater(st)) {
                conf = confirmationYM(b);
                if (conf != null && conf[0] == y) {
                    bookedRev[conf[1]] += Maps.lng(b, "price");
                    confirmedOrders[conf[1]]++;
                }
            }
            boolean match = false;
            if ("month".equals(p)) {
                if (c != null && c[0] == y && c[1] == targetMonth) match = true;
                else if (conf != null && conf[0] == y && conf[1] == targetMonth) match = true;
            } else if ("quarter".equals(p)) {
                if (c != null && c[0] == y && (c[1] - 1) / 3 + 1 == targetQuarter) match = true;
                else if (conf != null && conf[0] == y && (conf[1] - 1) / 3 + 1 == targetQuarter) match = true;
            } else if ("year".equals(p)) {
                if (inYear || (conf != null && conf[0] == y)) match = true;
            }
            if (match) {
                monthOrders.add(Maps.of("id", b.get("id"), "payCode", b.get("payCode"), "createdAt", b.get("createdAt"), "confirmedAt", b.get("confirmedAt"), "customerName", b.get("customerName"),
                        "phone", b.get("phone"), "date", b.get("date"), "pax", Maps.lng(b, "pax"), "tourName", b.get("tourName"), "status", st, "statusLabel", Flow.label(st),
                        "amount", Maps.lng(b, "price"), "paid", Flow.paidIn(b) - Flow.refundedOut(b)));
            }
            long net = 0;
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> pm = Maps.map(o);
                if (pm == null || Maps.bool(pm, "undone")) continue;
                int[] t = ym(Times.parse(pm.get("at")));
                if (t == null || t[0] != y) continue;
                long amt = Maps.lng(pm, "amount");
                if (String.valueOf(pm.get("kind")).endsWith("refund")) { refunded[t[1]] += amt; rev[t[1]] -= amt; net -= amt; }
                else { collected[t[1]] += amt; rev[t[1]] += amt; net += amt; }
            }
            if (net != 0) {
                long[] tr = tours.computeIfAbsent(Maps.str(b, "tourId"), k -> new long[2]);
                tr[1] += net;
                tourName.put(Maps.str(b, "tourId"), Maps.str(b, "tourName"));
            }
            if (inYear && Flow.active(st)) tours.computeIfAbsent(Maps.str(b, "tourId"), k -> new long[2])[0]++;
            if (inYear) tourName.putIfAbsent(Maps.str(b, "tourId"), Maps.str(b, "tourName"));
        }

        // Bổ sung các khoản doanh thu theo ngày (thu quầy, bổ sung, import)
        for (Map<String, Object> dr : core.db.list("daily_revenues")) {
            LocalDate ld = vn.travel.util.GuideAvailability.parse(Maps.str(dr, "date"));
            if (ld == null || ld.getYear() != y) continue;
            int m = ld.getMonthValue();
            long amt = Maps.lng(dr, "amount");
            boolean isRef = "refund".equals(dr.get("kind")) || "salary".equals(dr.get("kind")) || "bonus".equals(dr.get("kind")) || "withdrawal".equals(dr.get("kind")) || amt < 0;
            long absAmt = Math.abs(amt);
            if (isRef) {
                refunded[m] += absAmt;
                rev[m] -= absAmt;
            } else {
                collected[m] += absAmt;
                rev[m] += absAmt;
            }
            if ("month".equals(p) && m == targetMonth) {
                monthOrders.add(Maps.of("id", dr.get("id"), "payCode", dr.get("payCode"), "createdAt", dr.get("createdAt"), "confirmedAt", dr.get("createdAt"),
                        "customerName", dr.get("customerName"), "phone", "", "date", dr.get("date"), "pax", 1L, "tourName", dr.get("tourName"),
                        "status", "completed", "statusLabel", CashierOps.kindLabel(Maps.str(dr, "kind")), "amount", absAmt, "paid", isRef ? -absAmt : absAmt));
            }
        }

        monthOrders.sort((a, b) -> Maps.str(a, "createdAt").compareTo(Maps.str(b, "createdAt")));

        List<Map<String, Object>> months = new ArrayList<>(), quarters = new ArrayList<>();
        for (int m = 1; m <= 12; m++)
            months.add(Maps.of("month", m, "quarter", (m - 1) / 3 + 1, "revenue", rev[m], "collected", collected[m], "refunded", refunded[m], "orders", orders[m], "cancelled", cancelled[m], "guests", pax[m], "bookedRevenue", bookedRev[m], "confirmedOrders", confirmedOrders[m]));
        long yearRev = 0, yearCollected = 0, yearRefunded = 0, yearGuests = 0, yearBooked = 0;
        int yearOrders = 0, yearCancelled = 0, yearConfirmed = 0;
        for (int q = 1; q <= 4; q++) {
            long r = 0, col = 0, ref = 0, g = 0, bk = 0;
            int o = 0, cn = 0, cf = 0;
            for (int m = (q - 1) * 3 + 1; m <= q * 3; m++) { r += rev[m]; col += collected[m]; ref += refunded[m]; g += pax[m]; o += orders[m]; cn += cancelled[m]; bk += bookedRev[m]; cf += confirmedOrders[m]; }
            quarters.add(Maps.of("quarter", q, "revenue", r, "collected", col, "refunded", ref, "orders", o, "cancelled", cn, "guests", g, "bookedRevenue", bk, "confirmedOrders", cf));
            yearRev += r; yearCollected += col; yearRefunded += ref; yearGuests += g; yearOrders += o; yearCancelled += cn; yearBooked += bk; yearConfirmed += cf;
        }

        // ── kỳ đang xem và kỳ trước ──
        long curRev, prevRev, curBooked;
        int curOrders, prevOrders, curCancelled, curConfirmed;
        long curGuests;
        String label;
        long[] revPrevYear = yearTotals(y - 1);
        switch (p) {
            case "month" -> {
                int m = targetMonth;
                curRev = rev[m]; curOrders = orders[m]; curCancelled = cancelled[m]; curGuests = pax[m]; curBooked = bookedRev[m]; curConfirmed = confirmedOrders[m];
                if (m > 1) { prevRev = rev[m - 1]; prevOrders = orders[m - 1]; }
                else { prevRev = revPrevYear[1]; prevOrders = (int) revPrevYear[2]; }
                label = "Tháng " + m + "/" + y;
            }
            case "quarter" -> {
                int q = targetQuarter;
                Map<String, Object> cq = quarters.get(q - 1);
                curRev = Maps.lng(cq, "revenue"); curOrders = (int) Maps.lng(cq, "orders"); curCancelled = (int) Maps.lng(cq, "cancelled"); curGuests = Maps.lng(cq, "guests"); curBooked = Maps.lng(cq, "bookedRevenue"); curConfirmed = (int) Maps.lng(cq, "confirmedOrders");
                if (q > 1) { Map<String, Object> pq = quarters.get(q - 2); prevRev = Maps.lng(pq, "revenue"); prevOrders = (int) Maps.lng(pq, "orders"); }
                else { prevRev = revPrevYear[3]; prevOrders = (int) revPrevYear[4]; }
                label = "Quý " + q + "/" + y;
            }
            default -> {
                curRev = yearRev; curOrders = yearOrders; curCancelled = yearCancelled; curGuests = yearGuests; curBooked = yearBooked; curConfirmed = yearConfirmed;
                prevRev = revPrevYear[0]; prevOrders = (int) revPrevYear[5];
                label = "Năm " + y;
            }
        }

        // ── tự đối chiếu (15.8) ──
        List<String> warnings = new ArrayList<>();
        long sumMonths = 0;
        for (int m = 1; m <= 12; m++) sumMonths += rev[m];
        for (int q = 0; q < 4; q++) {
            long s = 0;
            for (int m = q * 3 + 1; m <= q * 3 + 3; m++) s += rev[m];
            if (s != Maps.lng(quarters.get(q), "revenue")) warnings.add("Quý " + (q + 1) + " lệch " + (Maps.lng(quarters.get(q), "revenue") - s) + " ₫ so với tổng 3 tháng");
        }
        if (sumMonths != yearRev) warnings.add("Năm lệch " + (yearRev - sumMonths) + " ₫ so với tổng 12 tháng");
        if (yearRev != yearCollected - yearRefunded) warnings.add("Doanh thu năm lệch " + (yearRev - (yearCollected - yearRefunded)) + " ₫ so với thu − hoàn");

        List<Map<String, Object>> top = new ArrayList<>();
        tours.entrySet().stream().sorted((a, b) -> Long.compare(b.getValue()[1], a.getValue()[1]) != 0 ? Long.compare(b.getValue()[1], a.getValue()[1]) : Long.compare(b.getValue()[0], a.getValue()[0]))
                .limit(5).forEach(e -> top.add(Maps.of("tourId", e.getKey(), "name", tourName.getOrDefault(e.getKey(), e.getKey()), "orders", e.getValue()[0], "revenue", e.getValue()[1])));

        int totalForRate = curOrders + curCancelled;
        long curCol = "year".equals(p) ? yearCollected : ("month".equals(p) ? collected[targetMonth] : Maps.lng(quarters.get(targetQuarter - 1), "collected"));
        long curRef = "year".equals(p) ? yearRefunded : ("month".equals(p) ? refunded[targetMonth] : Maps.lng(quarters.get(targetQuarter - 1), "refunded"));
        long receivable = Math.max(0, curBooked - curRev);
        Map<String, Object> kpi = Maps.of(
                "revenue", curRev,
                "bookedRevenue", curBooked,
                "collected", curCol,
                "refunded", curRef,
                "receivable", receivable,
                "orders", curOrders,
                "confirmedOrders", curConfirmed,
                "guests", curGuests,
                "cancelRate", totalForRate == 0 ? 0 : Math.round(curCancelled * 1000.0 / totalForRate) / 10.0,
                "prevRevenue", prevRev,
                "prevOrders", prevOrders,
                "revenueChangePct", pct(curRev, prevRev),
                "ordersChangePct", pct(curOrders, prevOrders));
        return Maps.of("ok", true, "period", p, "year", y, "targetMonth", targetMonth, "targetQuarter", targetQuarter, "label", label, "note", NOTE, "kpi", kpi, "months", months, "quarters", quarters,
                "year_total", Maps.of("revenue", yearRev, "collected", yearCollected, "refunded", yearRefunded, "bookedRevenue", yearBooked, "receivable", Math.max(0, yearBooked - yearRev), "orders", yearOrders, "confirmedOrders", yearConfirmed, "cancelled", yearCancelled, "guests", yearGuests),
                "byStatus", byStatus, "topTours", top, "orders", monthOrders, "warnings", warnings, "reconciled", warnings.isEmpty());
    }

    private static int[] confirmationYM(Map<String, Object> b) {
        String confAt = Maps.str(b, "confirmedAt");
        if (!confAt.isEmpty()) {
            int[] t = ym(Times.parse(confAt));
            if (t != null) return t;
        }
        for (Object o : Maps.list(b.get("history"))) {
            Map<String, Object> h = Maps.map(o);
            if (h != null && Flow.CONFIRMED.equals(h.get("to"))) {
                int[] t = ym(Times.parse(h.get("at")));
                if (t != null) return t;
            }
        }
        return ym(Times.parse(b.get("createdAt")));
    }

    private static List<Map<String, Object>> filterMonth(List<Map<String, Object>> l, int m, int y) { return l; }

    /** [doanh thu năm, doanh thu Q4, đơn Q4, ...] — chỉ cần cho so sánh kỳ trước của tháng 1 / quý 1 / năm. Trả {yearRev, decRev, decOrders, q4Rev, q4Orders, yearOrders}. */
    private long[] yearTotals(int y) {
        long[] rev = new long[13];
        int[] orders = new int[13];
        for (Map<String, Object> b : core.bookings()) {
            int[] c = ym(Times.parse(b.get("createdAt")));
            String st = Flow.norm(b.get("status"));
            if (c != null && c[0] == y && Flow.active(st)) orders[c[1]]++;
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> pm = Maps.map(o);
                if (pm == null || Maps.bool(pm, "undone")) continue;
                int[] t = ym(Times.parse(pm.get("at")));
                if (t == null || t[0] != y) continue;
                rev[t[1]] += String.valueOf(pm.get("kind")).endsWith("refund") ? -Maps.lng(pm, "amount") : Maps.lng(pm, "amount");
            }
        }
        for (Map<String, Object> dr : core.db.list("daily_revenues")) {
            LocalDate ld = vn.travel.util.GuideAvailability.parse(Maps.str(dr, "date"));
            if (ld == null || ld.getYear() != y) continue;
            long amt = Maps.lng(dr, "amount");
            boolean isRef = "refund".equals(dr.get("kind")) || amt < 0;
            rev[ld.getMonthValue()] += isRef ? -Math.abs(amt) : Math.abs(amt);
        }
        long yr = 0;
        int yo = 0;
        for (int m = 1; m <= 12; m++) { yr += rev[m]; yo += orders[m]; }
        return new long[]{yr, rev[12], orders[12], rev[10] + rev[11] + rev[12], orders[10] + orders[11] + orders[12], yo};
    }

    private static Object pct(long cur, long prev) {
        if (prev == 0) return cur == 0 ? 0 : null;   // không so sánh được (kỳ trước = 0)
        return Math.round((cur - prev) * 1000.0 / prev) / 10.0;
    }
}
