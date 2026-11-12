package vn.travel.service;

import vn.travel.util.Flow;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Sau tour (giai đoạn 7): khi đơn chuyển sang completed → (7.8) tặng voucher lần đặt sau, (7.10) cộng điểm 1% giá trị đã thu,
 * (7.9) ghi thù lao HDV. Chạy đúng một lần cho mỗi đơn ({@code rewardedAt}), no_show thì không có quà/điểm.
 */
public final class Rewards {
    /** 1 điểm = 1.000 ₫; cộng 1% giá trị → 1 điểm cho mỗi 100.000 ₫ khách đã trả. */
    public static final long POINT_VALUE = 1000, EARN_PER = 100_000, MIN_REDEEM = 50;
    private final OpsCore core;

    Rewards(OpsCore core) { this.core = core; }

    /**
     * Bảng phân loại thù lao HDV theo quy chuẩn:
     * - HDV chính thức, đã có lương: 3–5% giá trị tour (mặc định 4%)
     * - HDV chính thức, tour khó/dài: 5–7% (mặc định 6%)
     * - HDV cộng tác viên: 7–10% (mặc định 8%)
     * - Tour đặc biệt/khó (quốc tế hoặc trekking/thám hiểm hang động/mạo hiểm): 10–12% (mặc định 10%)
     */
    public static class GuideFeeTier {
        public final String code;
        public final String name;
        public final double defaultPercent;
        public final String rangeLabel;

        public GuideFeeTier(String code, String name, double defaultPercent, String rangeLabel) {
            this.code = code;
            this.name = name;
            this.defaultPercent = defaultPercent;
            this.rangeLabel = rangeLabel;
        }
    }

    public static GuideFeeTier determineTier(Map<String, Object> g, Map<String, Object> b, int days) {
        String empType = g != null ? Maps.str(g, "employmentType").toLowerCase() : "";
        String gType = g != null ? Maps.str(g, "guideType").toLowerCase() : "";
        String tName = Maps.str(b, "tourName").toLowerCase();
        String tDest = Maps.str(b, "tourDest").toLowerCase();

        boolean isSpecial = tName.contains("trekking") || tName.contains("thám hiểm") || tName.contains("leo núi")
                || tName.contains("hang động") || tName.contains("fansipan") || tName.contains("mạo hiểm")
                || tName.contains("quốc tế") || tName.contains("nước ngoài") || "outbound".equals(gType);

        if (isSpecial) {
            return new GuideFeeTier("special_hard", "Tour đặc biệt/khó", 0.10, "10–12%");
        }
        if ("collaborator".equals(empType) || "freelance".equals(empType)) {
            return new GuideFeeTier("collaborator", "HDV cộng tác viên", 0.08, "7–10%");
        }
        if (days >= 4 || tName.contains("xuyên việt") || tName.contains("liên tuyến") || tName.contains("dài ngày")) {
            return new GuideFeeTier("permanent_hard", "HDV chính thức, tour khó/dài", 0.06, "5–7%");
        }
        return new GuideFeeTier("permanent_regular", "HDV chính thức, đã có lương", 0.04, "3–5% giá trị tour");
    }

    public long getOrComputeFee(Map<String, Object> b) {
        if (b.get("guideFee") != null) {
            long f = Maps.lng(b, "guideFee");
            if (f > 0) return f;
        }
        String gid = core.canonGuide(Maps.str(b, "guideId"));
        Map<String, Object> g = core.guide(gid);
        int days = feeDays(b);
        long price = Maps.lng(b, "price");
        GuideFeeTier tier = determineTier(g, b, days);
        long fee = Math.round(price * tier.defaultPercent);
        if (fee <= 0) {
            fee = (long) days * core.config.i("guideFeePerDay");
        }
        return fee;
    }

    /** Gọi SAU khi đơn đã lưu ở trạng thái completed. Idempotent. */
    public void onCompleted(String bookingId) {
        String[] user = new String[1];
        boolean[] fresh = new boolean[1];
        long[] pts = new long[1];
        core.edit(bookingId, b -> {
            if (!Flow.COMPLETED.equals(Flow.norm(b.get("status"))) || b.get("rewardedAt") != null) return;
            fresh[0] = true;
            b.put("rewardedAt", Times.iso(core.now()));
            user[0] = Maps.str(b, "userId");
            // 7.9: thù lao HDV theo bảng thù lao quy chuẩn (3-5%, 5-7%, 7-10%, 10-12%) – chỉ khi completed và có HDV
            if (!Maps.str(b, "guideId").isEmpty()) {
                String gid = core.canonGuide(Maps.str(b, "guideId"));
                Map<String, Object> g = core.guide(gid);
                int days = feeDays(b);
                long price = Maps.lng(b, "price");
                GuideFeeTier tier = determineTier(g, b, days);
                long fee = Math.round(price * tier.defaultPercent);
                if (fee <= 0) {
                    fee = (long) days * core.config.i("guideFeePerDay");
                }
                b.put("guideFee", fee);
                b.put("guideFeeRate", Math.round(tier.defaultPercent * 100) + "%");
                b.put("guideFeeTier", tier.name);
                b.put("guideFeeRange", tier.rangeLabel);
            }
            // 7.10: điểm
            if (!Maps.bool(b, "noShow")) {
                pts[0] = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b)) / EARN_PER;
                b.put("pointsEarned", pts[0]);
            }
        });
        if (!fresh[0] || user[0].isEmpty() || Maps.bool(core.find(bookingId), "noShow")) return;
        String code = core.vouchers.grantAfterTour(user[0], bookingId);   // 7.8
        if (pts[0] > 0) {
            core.db.edit("accounts", all -> all.forEach(a -> { if (user[0].equals(Maps.str(a, "id"))) a.put("points", Maps.lng(a, "points") + pts[0]); }));
            core.notifyUser(user[0], "⭐ Bạn được cộng " + pts[0] + " điểm", "Điểm tích lũy từ đơn " + core.find(bookingId).get("payCode") + ". Đổi điểm lấy voucher trong Hồ sơ.", "profile", "pts-" + bookingId);
        }
    }

    public long points(String uid) {
        Map<String, Object> a = core.accounts.byId(uid);
        return a == null ? 0 : Maps.lng(a, "points");
    }

    /** 7.10: đổi điểm → voucher cố định. Trừ điểm và tạo voucher; không đủ điểm → 409. */
    public Map<String, Object> redeem(String uid, long points) {
        if (points < MIN_REDEEM) throw HttpError.bad("Đổi tối thiểu " + MIN_REDEEM + " điểm", "points");
        boolean[] ok = new boolean[1];
        core.db.edit("accounts", all -> all.forEach(a -> {
            if (!uid.equals(Maps.str(a, "id"))) return;
            long have = Maps.lng(a, "points");
            if (have < points) return;
            a.put("points", have - points);
            ok[0] = true;
        }));
        if (!ok[0]) throw HttpError.conflict("Bạn không đủ điểm để đổi", "points");
        String code = core.vouchers.grantPointsVoucher(uid, points);
        core.audit.log(uid, "", "CUSTOMER", "points.redeem", code, points + " điểm");
        return Maps.of("ok", true, "code", code, "value", points * POINT_VALUE, "points", points(uid));
    }

    /** Số ngày tính thù lao của một đơn (kể cả ngày gia hạn). */
    private static int feeDays(Map<String, Object> b) {
        return Math.max(1, Guides.tourDays(b) + (int) Maps.lng(b, "extraDays"));
    }

    /**
     * Các dòng thù lao HDV (mọi đơn completed có HDV). {@code guideId} == null → của tất cả HDV (Thu ngân dùng để chi).
     * Đơn cũ chưa có {@code guideFee} (hoàn thành trước khi có tính năng này) được tính theo số ngày × thù lao/ngày hiện hành.
     * Mỗi dòng có {@code paid} / {@code paidAt}: đã chi hay đang chờ thanh toán. Mới nhất trước.
     */
    List<Map<String, Object>> guideFeeRows(String guideId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        long perDay = core.config.i("guideFeePerDay");
        for (Map<String, Object> b : core.bookings()) {
            String gid = core.canonGuide(Maps.str(b, "guideId"));
            if (gid.isEmpty() || (guideId != null && !guideId.equals(gid)) || !Flow.COMPLETED.equals(Flow.norm(b.get("status")))) continue;
            int days = feeDays(b);
            long price = Maps.lng(b, "price");
            Map<String, Object> g = core.guide(gid);
            GuideFeeTier tier = determineTier(g, b, days);
            long calculated = Math.round(price * tier.defaultPercent);
            long fee = b.get("guideFee") != null ? Maps.lng(b, "guideFee") : (calculated > 0 ? calculated : days * perDay);
            String rate = b.get("guideFeeRate") != null ? Maps.str(b, "guideFeeRate") : (Math.round(tier.defaultPercent * 100) + "%");
            String tierLabel = b.get("guideFeeTier") != null ? Maps.str(b, "guideFeeTier") : tier.name;
            String paidAt = Maps.str(b, "guideFeePaidAt");
            String done = Maps.str(b, "completedAt");
            if (done.isEmpty()) done = Maps.str(b, "statusAt");
            rows.add(Maps.of("id", b.get("id"), "payCode", b.get("payCode"), "tourName", b.get("tourName"), "date", b.get("date"), "days", days,
                    "price", price, "rate", rate, "tier", tierLabel, "range", tier.rangeLabel,
                    "completedAt", done, "fee", fee, "paid", !paidAt.isEmpty(), "paidAt", paidAt, "paidByName", Maps.str(b, "guideFeePaidByName"),
                    "guideId", gid, "guideName", g == null ? Maps.str(b, "guideName") : Maps.str(g, "name")));
        }
        rows.sort((a, c) -> Maps.str(c, "completedAt").compareTo(Maps.str(a, "completedAt")));
        return rows;
    }

    /**
     * 7.9: thu nhập của một HDV. {@code month} (yyyy-MM, rỗng = tất cả) lọc danh sách + các tổng "trong kỳ";
     * kèm tổng cả đời (đã nhận / đang chờ) và 6 tháng gần nhất để vẽ biểu đồ.
     */
    public Map<String, Object> guideEarnings(String guideId, String month) {
        List<Map<String, Object>> all = guideFeeRows(guideId), rows = new ArrayList<>();
        long total = 0, paidTotal = 0, pendingTotal = 0, allPaid = 0, allPending = 0;
        Map<String, long[]> perMonth = new java.util.HashMap<>();
        for (Map<String, Object> r : all) {
            long fee = Maps.lng(r, "fee");
            boolean paid = Maps.bool(r, "paid");
            if (paid) allPaid += fee; else allPending += fee;
            String done = Maps.str(r, "completedAt");
            String key = done.length() >= 7 ? done.substring(0, 7) : "";
            long[] m = perMonth.computeIfAbsent(key, x -> new long[3]);
            m[paid ? 0 : 1] += fee;
            m[2]++;
            if (month != null && !month.isEmpty() && !done.startsWith(month)) continue;
            rows.add(r);
            total += fee;
            if (paid) paidTotal += fee; else pendingTotal += fee;
        }
        List<Map<String, Object>> monthly = new ArrayList<>();
        java.time.YearMonth cur = java.time.YearMonth.from(core.today());
        for (int i = 5; i >= 0; i--) {
            String key = cur.minusMonths(i).toString();
            long[] m = perMonth.getOrDefault(key, new long[3]);
            monthly.add(Maps.of("month", key, "paid", m[0], "pending", m[1], "total", m[0] + m[1], "count", m[2]));
        }
        return Maps.of("ok", true, "month", month == null ? "" : month, "total", total, "count", rows.size(), "paidTotal", paidTotal, "pendingTotal", pendingTotal,
                "items", rows, "allPaid", allPaid, "allPending", allPending, "toursLed", all.size(), "monthly", monthly, "feeRate", "3% – 12% theo quy chế bảng thù lao", "feePerDay", core.config.i("guideFeePerDay"));
    }
}
