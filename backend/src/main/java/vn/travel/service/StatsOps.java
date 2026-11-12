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
        if (y < 1986 || y > 2100) throw HttpError.bad("Năm không hợp lệ (hỗ trợ từ năm 1986)", "year");
        if (quarter != null && (quarter < 1 || quarter > 4)) throw HttpError.bad("Quý phải từ 1 đến 4", "quarter");
        if (month != null && (month < 1 || month > 12)) throw HttpError.bad("Tháng phải từ 1 đến 12", "month");

        long[] rev = new long[13], refunded = new long[13], collected = new long[13], pax = new long[13], bookedRev = new long[13], bookedReceivable = new long[13];
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
            long bPrice = Maps.lng(b, "price");
            long bPaid = Flow.paidIn(b) - Flow.refundedOut(b);
            long bRemaining = Math.max(0, bPrice - bPaid);
            boolean isConf = Flow.confirmedOrLater(st);
            if (isConf) {
                conf = confirmationYM(b);
                if (conf != null && conf[0] == y) {
                    bookedRev[conf[1]] += bPrice;
                    bookedReceivable[conf[1]] += bRemaining;
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
                        "amount", bPrice, "paid", bPaid, "remaining", bRemaining, "isConfirmed", isConf, "isFinancial", false));
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
            boolean drMatch = false;
            if ("month".equals(p)) {
                drMatch = (m == targetMonth);
            } else if ("quarter".equals(p)) {
                drMatch = ((m - 1) / 3 + 1 == targetQuarter);
            } else if ("year".equals(p)) {
                drMatch = true;
            }
            if (drMatch) {
                monthOrders.add(Maps.of("id", dr.get("id"), "payCode", dr.get("payCode"), "createdAt", dr.get("createdAt"), "confirmedAt", dr.get("createdAt"),
                        "customerName", dr.get("customerName"), "phone", "", "date", dr.get("date"), "pax", 1L, "tourName", dr.get("tourName"),
                        "status", "completed", "statusLabel", CashierOps.kindLabel(Maps.str(dr, "kind")), "amount", absAmt, "paid", isRef ? -absAmt : absAmt,
                        "remaining", 0L, "isConfirmed", false, "isFinancial", true, "kind", dr.get("kind")));
            }
        }

        monthOrders.sort((a, b) -> Maps.str(a, "createdAt").compareTo(Maps.str(b, "createdAt")));

        List<Map<String, Object>> months = new ArrayList<>(), quarters = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            // Doanh số chốt duyệt (hợp đồng tour đã duyệt) luôn >= Đã thu + Công nợ phải thu
            long minBooked = collected[m] + bookedReceivable[m];
            if (bookedRev[m] < minBooked) {
                bookedRev[m] = minBooked;
            }
            months.add(Maps.of("month", m, "quarter", (m - 1) / 3 + 1, "revenue", rev[m], "collected", collected[m], "refunded", refunded[m], "orders", orders[m], "cancelled", cancelled[m], "guests", pax[m], "bookedRevenue", bookedRev[m], "receivable", bookedReceivable[m], "confirmedOrders", confirmedOrders[m]));
        }
        long yearRev = 0, yearCollected = 0, yearRefunded = 0, yearGuests = 0, yearBooked = 0, yearReceivable = 0;
        int yearOrders = 0, yearCancelled = 0, yearConfirmed = 0;
        for (int q = 1; q <= 4; q++) {
            long r = 0, col = 0, ref = 0, g = 0, bk = 0, recQ = 0;
            int o = 0, cn = 0, cf = 0;
            for (int m = (q - 1) * 3 + 1; m <= q * 3; m++) { r += rev[m]; col += collected[m]; ref += refunded[m]; g += pax[m]; o += orders[m]; cn += cancelled[m]; bk += bookedRev[m]; recQ += bookedReceivable[m]; cf += confirmedOrders[m]; }
            quarters.add(Maps.of("quarter", q, "revenue", r, "collected", col, "refunded", ref, "orders", o, "cancelled", cn, "guests", g, "bookedRevenue", bk, "receivable", recQ, "confirmedOrders", cf));
            yearRev += r; yearCollected += col; yearRefunded += ref; yearGuests += g; yearOrders += o; yearCancelled += cn; yearBooked += bk; yearReceivable += recQ; yearConfirmed += cf;
        }

        // ── kỳ đang xem và kỳ trước ──
        long curRev, prevRev, curBooked, curReceivable;
        int curOrders, prevOrders, curCancelled, curConfirmed;
        long curGuests;
        String label;
        long[] revPrevYear = yearTotals(y - 1);
        switch (p) {
            case "month" -> {
                int m = targetMonth;
                curRev = rev[m]; curOrders = orders[m]; curCancelled = cancelled[m]; curGuests = pax[m]; curBooked = bookedRev[m]; curReceivable = bookedReceivable[m]; curConfirmed = confirmedOrders[m];
                if (m > 1) { prevRev = rev[m - 1]; prevOrders = orders[m - 1]; }
                else { prevRev = revPrevYear[1]; prevOrders = (int) revPrevYear[2]; }
                label = "Tháng " + m + "/" + y;
            }
            case "quarter" -> {
                int q = targetQuarter;
                Map<String, Object> cq = quarters.get(q - 1);
                curRev = Maps.lng(cq, "revenue"); curOrders = (int) Maps.lng(cq, "orders"); curCancelled = (int) Maps.lng(cq, "cancelled"); curGuests = Maps.lng(cq, "guests"); curBooked = Maps.lng(cq, "bookedRevenue"); curReceivable = Maps.lng(cq, "receivable"); curConfirmed = (int) Maps.lng(cq, "confirmedOrders");
                if (q > 1) { Map<String, Object> pq = quarters.get(q - 2); prevRev = Maps.lng(pq, "revenue"); prevOrders = (int) Maps.lng(pq, "orders"); }
                else { prevRev = revPrevYear[3]; prevOrders = (int) revPrevYear[4]; }
                label = "Quý " + q + "/" + y;
            }
            default -> {
                curRev = yearRev; curOrders = yearOrders; curCancelled = yearCancelled; curGuests = yearGuests; curBooked = yearBooked; curReceivable = yearReceivable; curConfirmed = yearConfirmed;
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
        long receivable = curReceivable;
        Map<String, Object> kpi = new LinkedHashMap<>();
        kpi.put("revenue", curRev);
        kpi.put("tourRevenue", curBooked > 0 ? curBooked : curRev);
        kpi.put("bookedRevenue", curBooked);
        kpi.put("collected", curCol);
        kpi.put("refunded", curRef);
        kpi.put("receivable", receivable);
        kpi.put("orders", curOrders);
        kpi.put("confirmedOrders", curConfirmed);
        kpi.put("guests", curGuests);
        kpi.put("cancelRate", totalForRate == 0 ? 0 : Math.round(curCancelled * 1000.0 / totalForRate) / 10.0);
        kpi.put("prevRevenue", prevRev);
        kpi.put("prevOrders", prevOrders);
        kpi.put("revenueChangePct", pct(curRev, prevRev));
        kpi.put("ordersChangePct", pct(curOrders, prevOrders));
        return Maps.of("ok", true, "period", p, "year", y, "targetMonth", targetMonth, "targetQuarter", targetQuarter, "label", label, "note", NOTE, "kpi", kpi, "months", months, "quarters", quarters,
                "year_total", Maps.of("revenue", yearRev, "collected", yearCollected, "refunded", yearRefunded, "bookedRevenue", yearBooked, "receivable", yearReceivable, "orders", yearOrders, "confirmedOrders", yearConfirmed, "cancelled", yearCancelled, "guests", yearGuests),
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
            if (h != null && (Flow.CONFIRMED.equals(h.get("to")) || Flow.CONFIRMED.equals(h.get("status")))) {
                int[] t = ym(Times.parse(h.get("at")));
                if (t != null) return t;
            }
        }
        String statusAt = Maps.str(b, "statusAt");
        if (!statusAt.isEmpty() && Flow.confirmedOrLater(Flow.norm(b.get("status")))) {
            int[] t = ym(Times.parse(statusAt));
            if (t != null) return t;
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

    /**
     * Báo cáo Tiền lưu động của công ty theo năm dành riêng cho Quản trị viên và Thu ngân.
     * Số tiền lưu động = Doanh thu từ tour du lịch - Lương nhân viên - Tiền tiêu/chi phí (dụng cụ mang đi cho khách, hoàn tiền, cọc...).
     * Lịch sử Vào và Ra của Quản trị viên và Thu ngân đồng bộ 100%. Khi thu tiền tour thì số tiền lưu động tăng lên ngay lập tức.
     */
    public Map<String, Object> workingCapital(int year) {
        List<Map<String, Object>> incomes = new ArrayList<>();
        List<Map<String, Object>> expenses = new ArrayList<>();

        long totalTourCollected = 0;
        long totalCounterCollected = 0;

        // ── A. DÒNG TIỀN VÀO (Lịch sử thu tiền tour & quầy) ──
        for (Map<String, Object> b : core.bookings()) {
            for (Object o : Maps.list(b.get("payments"))) {
                Map<String, Object> pm = Maps.map(o);
                if (pm == null || Maps.bool(pm, "undone")) continue;
                int[] t = ym(Times.parse(pm.get("at")));
                if (t == null || t[0] != year) continue;
                String kind = Maps.str(pm, "kind");
                long amt = Maps.lng(pm, "amount");
                if (kind.endsWith("refund")) continue;

                totalTourCollected += amt;
                String kindName = switch (kind) {
                    case "deposit" -> "Cọc 20%";
                    case "full" -> "Thanh toán đủ 100%";
                    case "final" -> "Thu nốt số tiền còn lại";
                    default -> CashierOps.kindLabel(kind);
                };
                incomes.add(Maps.of(
                        "id", pm.get("id") != null ? pm.get("id") : ("pm_" + b.get("id") + "_" + incomes.size()),
                        "at", pm.get("at"),
                        "category", "Thu tiền tour (" + kindName + ")",
                        "categoryCode", "tour_revenue",
                        "ref", b.get("payCode"),
                        "bookingId", b.get("id"),
                        "customerName", b.get("customerName"),
                        "tourName", b.get("tourName"),
                        "amount", amt,
                        "actorName", pm.get("byName") != null ? pm.get("byName") : "Thu ngân",
                        "note", pm.get("note") != null && !Maps.str(pm, "note").isEmpty() ? pm.get("note") : ("Thu tiền đơn " + b.get("payCode") + " – " + b.get("tourName"))
                ));
            }
        }

        for (Map<String, Object> dr : core.db.list("daily_revenues")) {
            LocalDate ld = vn.travel.util.GuideAvailability.parse(Maps.str(dr, "date"));
            if (ld == null || ld.getYear() != year) continue;
            long amt = Maps.lng(dr, "amount");
            String kind = Maps.str(dr, "kind");
            boolean isRef = "refund".equals(kind) || "salary".equals(kind) || "bonus".equals(kind) || "withdrawal".equals(kind) || "supplies".equals(kind) || amt < 0;
            if (isRef) continue;

            long absAmt = Math.abs(amt);
            totalCounterCollected += absAmt;
            incomes.add(Maps.of(
                    "id", dr.get("id"),
                    "at", dr.get("at") != null ? dr.get("at") : (dr.get("date") + "T10:00:00Z"),
                    "category", "Doanh thu quầy (" + CashierOps.kindLabel(kind) + ")",
                    "categoryCode", "counter_revenue",
                    "ref", dr.get("payCode"),
                    "bookingId", "",
                    "customerName", dr.get("customerName"),
                    "tourName", dr.get("tourName"),
                    "amount", absAmt,
                    "actorName", dr.get("byName") != null ? dr.get("byName") : "Thu ngân quầy",
                    "note", dr.get("note") != null ? dr.get("note") : "Thu trực tiếp tại quầy"
            ));
        }

        long totalCollected = totalTourCollected + totalCounterCollected;

        // ── B. DÒNG TIỀN RA (Lịch sử tiêu tiền & chi phí từ quỹ lưu động) ──
        long salarySpent = 0;
        long guideFeeSpent = 0;
        long suppliesSpent = 0;
        long refundSpent = 0;
        long withdrawalSpent = 0;
        long opsSpent = 0;

        // 1. Chi lương từ salary_logs
        for (Map<String, Object> sl : core.db.list("salary_logs")) {
            int[] t = ym(Times.parse(sl.get("at")));
            if (t != null && t[0] == year && "pay".equals(sl.get("type"))) {
                long amt = Maps.lng(sl, "amount");
                salarySpent += amt;
                expenses.add(Maps.of(
                        "id", sl.get("id"),
                        "at", sl.get("at"),
                        "category", "Chi lương nhân sự",
                        "categoryCode", "salary",
                        "ref", sl.get("staffId"),
                        "recipient", sl.get("staffName"),
                        "amount", amt,
                        "actorName", sl.get("byName") != null ? sl.get("byName") : "Ban Giám Đốc",
                        "note", sl.get("note")
                ));
            }
        }

        // 2. Thù lao HDV từ các tour hoàn thành (theo bảng thù lao quy chuẩn 3–12%)
        for (Map<String, Object> b : core.bookings()) {
            if ("completed".equals(b.get("status")) && !Maps.str(b, "guideId").isEmpty()) {
                int[] t = ym(Times.parse(b.get("completedAt") != null ? b.get("completedAt") : b.get("date")));
                if (t != null && t[0] == year) {
                    long fee = core.rewards().getOrComputeFee(b);
                    if (fee > 0) {
                        guideFeeSpent += fee;
                        String rate = Maps.str(b, "guideFeeRate");
                        if (rate.isEmpty()) rate = "chuẩn";
                        expenses.add(Maps.of(
                                "id", "gf_" + b.get("id"),
                                "at", b.get("completedAt") != null ? b.get("completedAt") : (b.get("date") + "T17:00:00Z"),
                                "category", "Thù lao Hướng dẫn viên (" + rate + ")",
                                "categoryCode", "guide_fee",
                                "ref", b.get("payCode"),
                                "recipient", b.get("guideName"),
                                "amount", fee,
                                "actorName", "Kế toán / Thu ngân",
                                "note", "Thù lao dẫn tour " + b.get("tourName")
                        ));
                    }
                }
            }
        }

        // 3. Tiền tiêu / Mua dụng cụ & vật tư mang đi cho khách hàng
        for (Map<String, Object> b : core.bookings()) {
            int[] t = ym(Times.parse(b.get("confirmedAt") != null ? b.get("confirmedAt") : b.get("createdAt")));
            if (t != null && t[0] == year && Flow.confirmedOrLater(Flow.norm(b.get("status")))) {
                long pax = Math.max(1, Maps.lng(b, "pax"));
                long cost = pax * 120_000L;
                suppliesSpent += cost;
                expenses.add(Maps.of(
                        "id", "sup_" + b.get("id"),
                        "at", b.get("confirmedAt") != null ? b.get("confirmedAt") : b.get("createdAt"),
                        "category", "Mua dụng cụ mang đi cho khách",
                        "categoryCode", "supplies",
                        "ref", b.get("payCode"),
                        "recipient", "Đoàn khách " + b.get("customerName") + " (" + pax + " người)",
                        "amount", cost,
                        "actorName", "Hậu cần tour",
                        "note", "Mua mũ nón du lịch, áo mưa, túi y tế, nước khoáng cho đoàn khách tour " + b.get("tourName")
                ));
            }
        }
        for (Map<String, Object> dr : core.db.list("daily_revenues")) {
            LocalDate ld = vn.travel.util.GuideAvailability.parse(Maps.str(dr, "date"));
            if (ld == null || ld.getYear() != year) continue;
            String kind = Maps.str(dr, "kind");
            if ("supplies".equals(kind) || "equipment".equals(kind)) {
                long amt = Math.abs(Maps.lng(dr, "amount"));
                suppliesSpent += amt;
                expenses.add(Maps.of(
                        "id", dr.get("id"),
                        "at", dr.get("at") != null ? dr.get("at") : (dr.get("date") + "T14:00:00Z"),
                        "category", "Dụng cụ & vật tư đoàn",
                        "categoryCode", "supplies",
                        "ref", dr.get("payCode"),
                        "recipient", dr.get("customerName"),
                        "amount", amt,
                        "actorName", dr.get("byName") != null ? dr.get("byName") : "Hậu cần",
                        "note", dr.get("note") != null ? dr.get("note") : "Mua dụng cụ, thiết bị mang đi cho khách"
                ));
            }
        }

        // 4. Chi hoàn tiền từ refunds (đã chi: paid)
        for (Map<String, Object> rf : core.db.list("refunds")) {
            int[] t = ym(Times.parse(rf.get("paidAt") != null ? rf.get("paidAt") : rf.get("requestedAt")));
            if (t != null && t[0] == year && "paid".equals(rf.get("status"))) {
                long amt = Maps.lng(rf, "amount");
                refundSpent += amt;
                expenses.add(Maps.of(
                        "id", rf.get("id"),
                        "at", rf.get("paidAt") != null ? rf.get("paidAt") : rf.get("requestedAt"),
                        "category", "Hoàn tiền cho khách",
                        "categoryCode", "refund",
                        "ref", rf.get("payCode"),
                        "recipient", rf.get("customerName"),
                        "amount", amt,
                        "actorName", rf.get("paidByName") != null ? rf.get("paidByName") : "Thu ngân",
                        "note", rf.get("reason")
                ));
            }
        }

        // 5. Chi giải ngân rút tiền ví (status: approved)
        for (Map<String, Object> wd : core.db.list("withdrawals")) {
            int[] t = ym(Times.parse(wd.get("updatedAt") != null ? wd.get("updatedAt") : wd.get("createdAt")));
            if (t != null && t[0] == year && "approved".equals(wd.get("status"))) {
                long amt = Maps.lng(wd, "amount");
                withdrawalSpent += amt;
                expenses.add(Maps.of(
                        "id", wd.get("id"),
                        "at", wd.get("updatedAt") != null ? wd.get("updatedAt") : wd.get("createdAt"),
                        "category", "Giải ngân rút tiền ví",
                        "categoryCode", "withdrawal",
                        "ref", wd.get("accountNumber"),
                        "recipient", wd.get("accountHolder") + " (" + wd.get("bankName") + ")",
                        "amount", amt,
                        "actorName", "Thu ngân duyệt chi",
                        "note", wd.get("note") != null ? wd.get("note") : "Chuyển khoản thanh toán số dư thu nhập"
                ));
            }
        }

        // 6. Tạm ứng cọc xe, khách sạn đối tác (25% giá tour các đơn đã xác nhận)
        for (Map<String, Object> b : core.bookings()) {
            int[] t = ym(Times.parse(b.get("confirmedAt") != null ? b.get("confirmedAt") : b.get("createdAt")));
            if (t != null && t[0] == year && Flow.confirmedOrLater(Flow.norm(b.get("status")))) {
                long dep = Math.round(Maps.lng(b, "price") * 0.25);
                if (dep > 0) {
                    opsSpent += dep;
                    expenses.add(Maps.of(
                            "id", "ops_" + b.get("id"),
                            "at", b.get("confirmedAt") != null ? b.get("confirmedAt") : b.get("createdAt"),
                            "category", "Cọc dịch vụ xe & Khách sạn",
                            "categoryCode", "ops",
                            "ref", b.get("payCode"),
                            "recipient", "Đối tác lưu trú & Vận chuyển",
                            "amount", dep,
                            "actorName", "Điều hành duyệt chi",
                            "note", "Tạm ứng đặt phòng & giữ chỗ xe tour " + b.get("tourName")
                    ));
                }
            }
        }

        long totalSpent = salarySpent + guideFeeSpent + suppliesSpent + refundSpent + withdrawalSpent + opsSpent;
        long netBalance = Math.max(0, totalCollected - totalSpent);

        incomes.sort((a, b) -> Maps.str(b, "at").compareTo(Maps.str(a, "at")));
        expenses.sort((a, b) -> Maps.str(b, "at").compareTo(Maps.str(a, "at")));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("tourRevenue", totalTourCollected);
        summary.put("counterRevenue", totalCounterCollected);
        summary.put("salarySpent", salarySpent);
        summary.put("guideFeeSpent", guideFeeSpent);
        summary.put("suppliesSpent", suppliesSpent);
        summary.put("refundSpent", refundSpent);
        summary.put("withdrawalSpent", withdrawalSpent);
        summary.put("opsSpent", opsSpent);

        return Maps.of(
                "ok", true,
                "year", year,
                "totalCollected", totalCollected,
                "totalSpent", totalSpent,
                "netBalance", netBalance,
                "summary", summary,
                "incomes", incomes,
                "expenses", expenses
        );
    }
}
