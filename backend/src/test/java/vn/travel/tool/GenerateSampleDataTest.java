package vn.travel.tool;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Công cụ sinh thêm dữ liệu mẫu (100% Java + Jackson, TUYỆT ĐỐI KHÔNG DÙNG PYTHON).
 * Bổ sung dữ liệu đơn đặt tour cho cả 12 tháng năm 2026 và Q4 năm 2025:
 *   - Doanh thu trải đều và hợp lý theo mùa (Q1 Tết, Q2 đầu hè, Q3 hè cao điểm, Q4 cuối năm).
 *   - Các HDV đều đã dẫn nhiều tour, có đánh giá, nhật ký, checkin.
 *   - Thu ngân có các bản đóng sổ đối chiếu theo tháng.
 *   - Các tour top đều có doanh số và lượng khách phong phú.
 */
public class GenerateSampleDataTest {

    record TourInfo(String id, String name, String dest, long price, String duration, int days, String highlight, String guideType) {}
    record GuideInfo(String id, String name, String region) {}
    record CustInfo(String id, String name, String phone, String email) {}

    private static final List<TourInfo> TOURS = List.of(
            new TourInfo("101", "Hà Nội – Hạ Long 3N2Đ", "Hạ Long", 2500000L, "3 ngày 2 đêm", 3, "Vịnh Hạ Long · Đảo Titop · Hang Sửng Sốt", "guided"),
            new TourInfo("102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "Sa Pa", 2850000L, "3 ngày 2 đêm", 3, "Bản Cát Cát · Đỉnh Fansipan · Đèo Ô Quy Hồ", "guided"),
            new TourInfo("103", "Hà Giang – Mã Pí Lèng 3N2Đ", "Hà Giang", 2950000L, "3 ngày 2 đêm", 3, "Cột cờ Lũng Cú · Đèo Mã Pí Lèng · Sông Nho Quế", "guided"),
            new TourInfo("104", "Ninh Bình – Tràng An – Bái Đính 1N", "Ninh Bình", 850000L, "1 ngày", 1, "Khu sinh thái Tràng An · Chùa Bái Đính · Hang Múa", "guided"),
            new TourInfo("105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "Đà Nẵng", 3650000L, "4 ngày 3 đêm", 4, "Bán đảo Sơn Trà · Cầu Vàng · Phố cổ Hội An", "guided"),
            new TourInfo("106", "Huế – Di sản Cố Đô 3N2Đ", "Huế", 2450000L, "3 ngày 2 đêm", 3, "Đại Nội Huế · Chùa Thiên Mụ · Lăng Khải Định", "guided"),
            new TourInfo("107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "Quy Nhơn", 2750000L, "3 ngày 2 đêm", 3, "Bãi biển Kỳ Co · Eo Gió ngắm hoàng hôn · Tháp Đôi", "guided"),
            new TourInfo("108", "Phú Quốc – Sunset Sanato 3N2Đ", "Phú Quốc", 3950000L, "3 ngày 2 đêm", 3, "Grand World · Cáp treo Hòn Thơm · Bãi Sao", "guided"),
            new TourInfo("109", "Miền Tây – Cần Thơ – Cái Răng 2N1Đ", "Cần Thơ", 1450000L, "2 ngày 1 đêm", 2, "Chợ nổi Cái Răng · Vườn trái cây · Bến Ninh Kiều", "guided"),
            new TourInfo("110", "TP.HCM – Củ Chi – Mekong 1N", "TP.HCM", 750000L, "1 ngày", 1, "Địa đạo Củ Chi · Nhà thờ Đức Bà · Chợ Bến Thành", "guided"),
            new TourInfo("111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "Thái Lan", 6990000L, "5 ngày 4 đêm", 5, "Cung điện Hoàng Gia · Đảo San Hô Coral · Chợ nổi 4 miền", "international"),
            new TourInfo("112", "Singapore – Malaysia 5N4Đ", "Singapore", 10990000L, "5 ngày 4 đêm", 5, "Gardens by the Bay · Marina Bay Sands · Tháp đôi Petronas", "international")
    );

    private static final List<GuideInfo> GUIDES = List.of(
            new GuideInfo("g_hn01", "Nguyễn Minh Quân", "Miền Bắc"),
            new GuideInfo("g_hn02", "Trần Thu Hà", "Miền Bắc"),
            new GuideInfo("g_hn03", "Hoàng Văn Sơn", "Miền Bắc"),
            new GuideInfo("g_hn04", "Phạm Thị Lan", "Miền Bắc"),
            new GuideInfo("g_dn01", "Lê Hoàng Nam", "Miền Trung"),
            new GuideInfo("g_dn02", "Ngô Bảo Châu", "Miền Trung"),
            new GuideInfo("g_dn03", "Võ Minh Trí", "Miền Trung"),
            new GuideInfo("g_sg01", "Trương Gia Huy", "Miền Nam"),
            new GuideInfo("g_sg02", "Đỗ Mỹ Linh", "Miền Nam"),
            new GuideInfo("g_sg03", "Bùi Quang Khải", "Miền Nam"),
            new GuideInfo("hdv01", "Nguyễn Văn Hướng Dẫn", "Toàn quốc"),
            new GuideInfo("hdv02", "Trần Thị Dẫn Tour", "Toàn quốc"),
            new GuideInfo("hdv03", "Lê Văn Miền Trung", "Miền Trung"),
            new GuideInfo("hdv04", "Phạm Thị Miền Nam", "Miền Nam"),
            new GuideInfo("hdv05", "Hoàng Văn Quốc Tế", "Quốc tế")
    );

    private static final List<CustInfo> CUSTOMERS = List.of(
            new CustInfo("kh001", "Nguyễn Văn An", "0912345678", "khachhang@travel.vn"),
            new CustInfo("kh002", "Trần Thị Bình", "0912345679", "kh002@travel.vn"),
            new CustInfo("kh003", "Lê Văn Cường", "0912345680", "kh003@travel.vn"),
            new CustInfo("kh004", "Phạm Thị Dung", "0912345681", "kh004@travel.vn"),
            new CustInfo("kh005", "Hoàng Văn Em", "0912345682", "kh005@travel.vn"),
            new CustInfo("kh006", "Võ Thị Giang", "0912345683", "kh006@travel.vn"),
            new CustInfo("kh007", "Đặng Văn Hùng", "0912345684", "kh007@travel.vn"),
            new CustInfo("kh008", "Bùi Thị Mai", "0912345685", "kh008@travel.vn"),
            new CustInfo("kh009", "Dương Văn Nam", "0912345686", "kh009@travel.vn"),
            new CustInfo("kh010", "Ngô Thị Oanh", "0912345687", "kh010@travel.vn"),
            new CustInfo("kh011", "Vũ Hoàng Phúc", "0912345688", "kh011@travel.vn"),
            new CustInfo("kh012", "Đinh Tuyết Mai", "0912345689", "kh012@travel.vn"),
            new CustInfo("kh013", "Lý Gia Hân", "0912345690", "kh013@travel.vn"),
            new CustInfo("kh014", "Trương Quốc Bảo", "0912345691", "kh014@travel.vn"),
            new CustInfo("kh015", "Cao Thị Ngọc", "0912345692", "kh015@travel.vn")
    );

    private static final List<String> PASSENGER_NAMES = List.of(
            "Nguyễn Hải Đăng", "Trần Mai Anh", "Lê Quốc Toàn", "Phạm Thùy Linh", "Vũ Minh Trí",
            "Đỗ Thu Thảo", "Bùi Đức Thịnh", "Hoàng Kim Ngân", "Đặng Tuấn Kiệt", "Lý Cẩm Tú",
            "Cao Văn Khánh", "Dương Ngọc Bích", "Ngô Trọng Hiếu", "Phan Thanh Tâm", "Tạ Hồng Nhung"
    );

    @Test
    void enrichSampleData() throws Exception {
        Path dbDir = Files.exists(Paths.get("storage/db")) ? Paths.get("storage/db") : Paths.get("backend/storage/db");
        assertTrue(Files.exists(dbDir), "dbDir must exist: " + dbDir.toAbsolutePath());

        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);

        File bkFile = dbDir.resolve("bookings.json").toFile();
        List<Map<String, Object>> bookings = mapper.readValue(bkFile, new TypeReference<>() {});

        Set<String> existingCodes = new HashSet<>();
        int maxId = 2105;
        for (Map<String, Object> b : bookings) {
            existingCodes.add(String.valueOf(b.get("payCode")));
            String id = String.valueOf(b.get("id"));
            if (id.startsWith("bk_")) {
                try {
                    int num = Integer.parseInt(id.substring(3));
                    if (num > maxId) maxId = num;
                } catch (Exception ignored) {}
            }
        }

        System.out.println("Starting enrichment check. Existing bookings: " + bookings.size() + ", Max ID: " + maxId);
        if (bookings.size() >= 300) {
            System.out.println("Sample data already enriched (" + bookings.size() + " bookings). Skipping generation.");
            return;
        }

        record MonthPlan(int year, int month, int count, String defaultStatus) {}
        List<MonthPlan> plans = List.of(
                new MonthPlan(2026, 1, 16, "completed"),
                new MonthPlan(2026, 2, 18, "completed"),
                new MonthPlan(2026, 3, 20, "completed"),
                new MonthPlan(2026, 4, 20, "completed"),
                new MonthPlan(2026, 5, 22, "completed"),
                new MonthPlan(2026, 6, 25, "completed"),
                new MonthPlan(2026, 7, 25, "completed"),
                new MonthPlan(2026, 8, 8, "completed"),
                new MonthPlan(2026, 11, 14, "mixed_future"),
                new MonthPlan(2026, 12, 12, "mixed_future"),
                new MonthPlan(2025, 11, 12, "completed"),
                new MonthPlan(2025, 12, 16, "completed")
        );

        Random rnd = new Random(20261027);
        List<Map<String, Object>> newReviews = new ArrayList<>();

        for (MonthPlan plan : plans) {
            for (int i = 0; i < plan.count; i++) {
                maxId++;
                String bId = "bk_" + maxId;
                String payCode = "TRAVEL" + maxId;

                TourInfo tour = TOURS.get(rnd.nextInt(TOURS.size()));
                GuideInfo guide = GUIDES.get(rnd.nextInt(GUIDES.size()));
                CustInfo cust = CUSTOMERS.get(rnd.nextInt(CUSTOMERS.size()));

                int day = 1 + rnd.nextInt(26);
                String bookDate = String.format("%04d-%02d-%02d", plan.year, plan.month, day);
                int departDay = Math.min(28, day + 3 + rnd.nextInt(4));
                String departDate = String.format("%04d-%02d-%02d", plan.year, plan.month, departDay);

                int pax = 2 + rnd.nextInt(5);
                long unitPrice = tour.price;
                long totalPrice = unitPrice * pax;
                long deposit = Math.round(totalPrice * 0.2 / 10000) * 10000;
                long balance = totalPrice - deposit;

                String status = plan.defaultStatus;
                if ("mixed_future".equals(status)) {
                    int r = rnd.nextInt(10);
                    if (r < 3) status = "paid_deposit";
                    else if (r < 6) status = "paid_full";
                    else if (r < 8) status = "guide_accepted";
                    else if (r < 9) status = "guide_pending";
                    else status = "confirmed";
                } else {
                    if (rnd.nextInt(20) == 0) status = "refunded";
                }

                Map<String, Object> bk = new LinkedHashMap<>();
                bk.put("id", bId);
                bk.put("payCode", payCode);
                bk.put("tourId", tour.id);
                bk.put("tourName", tour.name);
                bk.put("tourDest", tour.dest);
                bk.put("userId", cust.id);
                bk.put("userEmail", cust.email);
                bk.put("customerName", cust.name);
                bk.put("phone", cust.phone);
                bk.put("email", cust.email);
                bk.put("date", departDate);
                bk.put("pax", pax);
                bk.put("adults", pax);
                bk.put("children", 0);
                bk.put("infants", 0);
                bk.put("note", "Đoàn " + pax + " khách đi " + tour.name + ", yêu cầu dịch vụ tiêu chuẩn chu đáo.");
                bk.put("price", totalPrice);
                bk.put("deposit", deposit);
                bk.put("depositPercent", 20);

                Map<String, Object> breakdown = new LinkedHashMap<>();
                breakdown.put("adults", pax);
                breakdown.put("kids", 0);
                breakdown.put("infants", 0);
                breakdown.put("pax", pax);
                breakdown.put("base", totalPrice);
                breakdown.put("hdv", 0);
                breakdown.put("subtotal", totalPrice);
                breakdown.put("discount", 0);
                breakdown.put("voucherCode", "");
                breakdown.put("final", totalPrice);
                breakdown.put("depositPct", 20);
                breakdown.put("deposit", deposit);
                breakdown.put("remaining", balance);
                bk.put("priceBreakdown", breakdown);

                bk.put("tourDuration", tour.duration);
                bk.put("tourDays", tour.days);
                bk.put("tourHighlight", tour.highlight);
                bk.put("guideType", tour.guideType);
                bk.put("status", status);

                if (!"pending_payment".equals(status)) {
                    bk.put("guideId", guide.id);
                    bk.put("guideName", guide.name);
                }

                boolean isFullPaid = "completed".equals(status) || "in_progress".equals(status) || "paid_full".equals(status) || "guide_accepted".equals(status) || "confirmed".equals(status);
                boolean isDepPaid = isFullPaid || "paid_deposit".equals(status) || "refunded".equals(status);

                bk.put("depositPaid", isDepPaid);
                bk.put("fullPaid", isFullPaid);
                bk.put("finalPaid", isFullPaid);

                String depAt = bookDate + "T09:30:00.000Z";
                String finAt = departDate + "T16:00:00.000Z";
                if (isDepPaid) bk.put("depositPaidAt", depAt);
                if (isFullPaid) bk.put("finalPaidAt", finAt);

                List<Map<String, Object>> paxList = new ArrayList<>();
                for (int p = 0; p < pax; p++) {
                    String pName = p == 0 ? cust.name : PASSENGER_NAMES.get((p + maxId) % PASSENGER_NAMES.size());
                    Map<String, Object> px = new LinkedHashMap<>();
                    px.put("name", pName);
                    px.put("gender", p % 2 == 0 ? "male" : "female");
                    px.put("birthday", "199" + (p % 9) + "-05-15");
                    px.put("idCard", "07909******" + (100 + p));
                    px.put("phone", p == 0 ? cust.phone : "09887766" + p);
                    if ("completed".equals(status)) {
                        px.put("checkin", "present");
                        px.put("checkinAt", departDate + "T07:30:00Z");
                    }
                    paxList.add(px);
                }
                bk.put("passengers", paxList);

                List<Map<String, Object>> payments = new ArrayList<>();
                if (isDepPaid) {
                    Map<String, Object> pm1 = new LinkedHashMap<>();
                    pm1.put("id", "pm_" + maxId + "_1");
                    pm1.put("kind", "deposit");
                    pm1.put("amount", deposit);
                    pm1.put("source", "cashier");
                    pm1.put("byId", "tn001");
                    pm1.put("byName", "Lê Thu Ngân");
                    pm1.put("role", "CASHIER");
                    pm1.put("note", "Thu cọc 20%");
                    pm1.put("at", depAt);
                    pm1.put("undone", false);
                    payments.add(pm1);
                }
                if (isFullPaid) {
                    Map<String, Object> pm2 = new LinkedHashMap<>();
                    pm2.put("id", "pm_" + maxId + "_2");
                    pm2.put("kind", "balance");
                    pm2.put("amount", balance);
                    pm2.put("source", "cashier");
                    pm2.put("byId", "tn001");
                    pm2.put("byName", "Lê Thu Ngân");
                    pm2.put("role", "CASHIER");
                    pm2.put("note", "Thu phần còn lại trước giờ khởi hành");
                    pm2.put("at", finAt);
                    pm2.put("undone", false);
                    payments.add(pm2);
                }
                if ("refunded".equals(status)) {
                    Map<String, Object> pmRef = new LinkedHashMap<>();
                    pmRef.put("id", "pm_" + maxId + "_ref");
                    pmRef.put("kind", "customer_cancel_refund");
                    pmRef.put("amount", deposit);
                    pmRef.put("source", "cashier");
                    pmRef.put("byId", "tn001");
                    pmRef.put("byName", "Lê Thu Ngân");
                    pmRef.put("role", "CASHIER");
                    pmRef.put("note", "Hoàn tiền cho khách");
                    pmRef.put("at", departDate + "T10:00:00.000Z");
                    pmRef.put("undone", false);
                    payments.add(pmRef);
                }
                bk.put("payments", payments);

                List<Map<String, Object>> hist = new ArrayList<>();
                hist.add(Map.of("at", bookDate + "T08:00:00Z", "action", "create", "from", "", "to", "pending_payment", "byId", cust.id, "byName", cust.name, "role", "CUSTOMER", "by", cust.id + " – CUSTOMER", "note", "Đặt tour trực tuyến"));
                if (isDepPaid) {
                    hist.add(Map.of("at", depAt, "action", "status", "from", "pending_payment", "to", "paid_deposit", "byId", "tn001", "byName", "Lê Thu Ngân", "role", "CASHIER", "by", "tn001 – CASHIER", "note", "Xác nhận thu cọc " + String.format("%,d ₫", deposit)));
                }
                if ("completed".equals(status)) {
                    hist.add(Map.of("at", departDate + "T07:00:00Z", "action", "status", "from", "paid_full", "to", "in_progress", "byId", guide.id, "byName", guide.name, "role", "GUIDE", "by", guide.id + " – GUIDE", "note", "Đón đoàn và bắt đầu hành trình"));
                    hist.add(Map.of("at", departDate + "T18:00:00Z", "action", "status", "from", "in_progress", "to", "completed", "byId", guide.id, "byName", guide.name, "role", "GUIDE", "by", guide.id + " – GUIDE", "note", "Tour hoàn tất xuất sắc, an toàn"));
                }
                bk.put("history", hist);

                bk.put("createdAt", bookDate + "T08:00:00.000Z");
                bk.put("statusAt", departDate + "T18:00:00.000Z");

                bookings.add(bk);

                if ("completed".equals(status) && rnd.nextInt(3) == 0) {
                    Map<String, Object> rev = new LinkedHashMap<>();
                    rev.put("id", "rev_" + maxId);
                    rev.put("tourId", tour.id);
                    rev.put("tourName", tour.name);
                    rev.put("bookingId", bId);
                    rev.put("payCode", payCode);
                    rev.put("userId", cust.id);
                    rev.put("author", cust.name);
                    rev.put("name", cust.name);
                    int star = rnd.nextInt(5) == 0 ? 4 : 5;
                    rev.put("rating", star);
                    rev.put("title", "Trải nghiệm " + tour.name + " cùng HDV " + guide.name);
                    rev.put("comment", "Chuyến đi vô cùng tuyệt vời và đáng nhớ! Hướng dẫn viên " + guide.name + " rất nhiệt tình, am hiểu văn hóa và tận tâm hỗ trợ đoàn từ đầu đến cuối.");
                    rev.put("text", "Chuyến đi vô cùng tuyệt vời và đáng nhớ! Hướng dẫn viên " + guide.name + " rất nhiệt tình, am hiểu văn hóa và tận tâm hỗ trợ đoàn từ đầu đến cuối.");
                    rev.put("guideId", guide.id);
                    rev.put("guideRating", star);
                    rev.put("guideComment", "Đoàn khách " + cust.name + " rất dễ thương, đúng giờ và đồng hành nhiệt tình trong các hoạt động.");
                    rev.put("createdAt", departDate + "T20:00:00.000Z");
                    rev.put("status", "approved");
                    rev.put("sample", true);
                    newReviews.add(rev);
                }
            }
        }

        mapper.writeValue(bkFile, bookings);
        System.out.println("Enriched bookings.json successfully. Total bookings now: " + bookings.size());

        File revFile = dbDir.resolve("reviews.json").toFile();
        if (revFile.exists()) {
            List<Map<String, Object>> revs = mapper.readValue(revFile, new TypeReference<>() {});
            revs.addAll(newReviews);
            mapper.writeValue(revFile, revs);
            System.out.println("Enriched reviews.json successfully. Total reviews now: " + revs.size());
        }

        File recFile = dbDir.resolve("reconciliations.json").toFile();
        if (recFile.exists()) {
            List<Map<String, Object>> recs = mapper.readValue(recFile, new TypeReference<>() {});
            int[] recMonths = {1, 2, 3, 4, 5, 6, 7, 8, 9};
            for (int rm : recMonths) {
                String dStr = String.format("2026-%02d-28", rm);
                boolean exists = recs.stream().anyMatch(r -> String.valueOf(r.get("date")).startsWith(String.format("2026-%02d", rm)));
                if (!exists) {
                    Map<String, Object> rec = new LinkedHashMap<>();
                    rec.put("id", "rec_2026" + String.format("%02d", rm) + "28");
                    rec.put("date", dStr);
                    rec.put("cashierId", "tn001");
                    rec.put("cashierName", "Lê Thu Ngân");
                    long col = 35000000L + rm * 4000000L;
                    rec.put("totalCollected", col);
                    rec.put("totalRefunded", 0L);
                    rec.put("netTotal", col);
                    rec.put("bankStatementTotal", col);
                    rec.put("discrepancy", 0L);
                    rec.put("transactionCount", 8 + rm);
                    rec.put("status", "approved");
                    rec.put("approvedBy", "ad001");
                    rec.put("approvedByName", "Quản Trị Viên");
                    rec.put("approvedAt", dStr + "T18:30:00.000Z");
                    rec.put("note", "Đóng sổ đối soát ngân hàng cuối tháng " + rm + "/2026: Khớp 100% sao kê.");
                    rec.put("createdAt", dStr + "T17:30:00.000Z");
                    recs.add(rec);
                }
            }
            mapper.writeValue(recFile, recs);
            System.out.println("Enriched reconciliations.json successfully. Total records: " + recs.size());
        }

        File depFile = dbDir.resolve("departures.json").toFile();
        if (depFile.exists()) {
            List<Map<String, Object>> deps = mapper.readValue(depFile, new TypeReference<>() {});
            String[] depDates = {"2026-11-20", "2026-11-25", "2026-11-28", "2026-12-05", "2026-12-12", "2026-12-20", "2026-12-28"};
            for (int di = 0; di < depDates.length; di++) {
                String dDate = depDates[di];
                TourInfo t = TOURS.get(di % TOURS.size());
                String depId = "dep_" + t.id + "_" + dDate;
                boolean exists = deps.stream().anyMatch(d -> depId.equals(d.get("id")));
                if (!exists) {
                    Map<String, Object> dp = new LinkedHashMap<>();
                    dp.put("id", depId);
                    dp.put("tourId", t.id);
                    dp.put("date", dDate);
                    dp.put("capacity", 20 + di * 2);
                    dp.put("minGuests", 6);
                    dp.put("status", "open");
                    dp.put("price", t.price);
                    dp.put("note", "Khởi hành định kỳ mùa đông " + t.name);
                    deps.add(dp);
                }
            }
            mapper.writeValue(depFile, deps);
            System.out.println("Enriched departures.json successfully. Total departures: " + deps.size());
        }
    }

    @Test
    void seedRoleTestData() throws Exception {
        Path dbDir = Files.exists(Paths.get("storage/db")) ? Paths.get("storage/db") : Paths.get("backend/storage/db");
        assertTrue(Files.exists(dbDir), "dbDir must exist: " + dbDir.toAbsolutePath());

        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);

        // 1. TÀI KHOẢN: Thêm tài khoản Khách Hàng Tuổi Teen (<18 tuổi) để test tính năng cảnh báo & người giám hộ
        File accFile = dbDir.resolve("accounts.json").toFile();
        if (accFile.exists()) {
            List<Map<String, Object>> accounts = mapper.readValue(accFile, new TypeReference<>() {});
            boolean hasTeen = accounts.stream().anyMatch(a -> "khach.teen@travel.vn".equalsIgnoreCase(String.valueOf(a.get("email"))));
            if (!hasTeen) {
                Map<String, Object> teen = new LinkedHashMap<>();
                teen.put("id", "kh_teen");
                teen.put("name", "Trần Gia Bảo (Khách 16t)");
                teen.put("email", "khach.teen@travel.vn");
                teen.put("initials", "GB");
                teen.put("bg", "#8B5CF6");
                teen.put("provider", "local");
                teen.put("role", "user");
                teen.put("passHash", "pbkdf2$210000$xBL6pn66wnuc+DjnJckJKw==$efwhr9Dt28rZSV7EQSip9F0Hlt7MjDDv+MjMFdIr634="); // Travel@2026
                teen.put("createdAt", "2026-10-29T08:00:00Z");
                teen.put("gender", "male");
                teen.put("birthday", "2010-06-15"); // 16 tuổi (<18)
                teen.put("phone", "0981234567");
                teen.put("profileVerified", true);
                teen.put("profileVerifiedAt", "2026-10-29T08:05:00Z");
                accounts.add(teen);
                mapper.writeValue(accFile, accounts);
                System.out.println("Added teen account (khach.teen@travel.vn) to accounts.json");
            }
        }

        // 2. ĐƠN ĐẶT TOUR: Thêm các đơn mẫu cho từng vai trò kiểm thử
        File bkFile = dbDir.resolve("bookings.json").toFile();
        List<Map<String, Object>> bookings = bkFile.exists() ? mapper.readValue(bkFile, new TypeReference<>() {}) : new ArrayList<>();
        Set<String> existingCodes = new HashSet<>();
        for (Map<String, Object> b : bookings) {
            existingCodes.add(String.valueOf(b.get("payCode")));
        }

        List<Map<String, Object>> roleMockBookings = new ArrayList<>();

        // ── [CASHIER] 1. Chờ thu cọc 20%
        if (!existingCodes.contains("TRAVEL-TN01")) {
            Map<String, Object> b = createBooking("bk_tn01", "TRAVEL-TN01", "101", "Hà Nội – Hạ Long 3N2Đ", "Hạ Long", 2500000L, 2,
                    "kh001", "Nguyễn Văn An", "khachhang@travel.vn", "0912345678", "2026-11-05", "pending_payment", 20);
            b.put("note", "Đoàn 2 khách yêu cầu phòng view vịnh, khách hẹn chuyển khoản đặt cọc 20%.");
            roleMockBookings.add(b);
        }

        // ── [CASHIER] 2. Chờ thu đủ 100%
        if (!existingCodes.contains("TRAVEL-TN02")) {
            Map<String, Object> b = createBooking("bk_tn02", "TRAVEL-TN02", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "Đà Nẵng", 3650000L, 2,
                    "kh002", "Trần Thị Bình", "kh002@travel.vn", "0912345679", "2026-11-08", "pending_payment", 100);
            b.put("note", "Khách chọn hình thức thanh toán 100% trọn gói.");
            roleMockBookings.add(b);
        }

        // ── [CASHIER] 3. Chờ thu nốt 80% (đã cọc 20%)
        if (!existingCodes.contains("TRAVEL-TN03")) {
            Map<String, Object> b = createBooking("bk_tn03", "TRAVEL-TN03", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "Sa Pa", 2850000L, 2,
                    "kh003", "Lê Văn Cường", "kh003@travel.vn", "0912345680", "2026-11-03", "confirmed", 20);
            b.put("depositPaid", true);
            b.put("depositPaidAt", "2026-10-28T09:00:00Z");
            b.put("fullPaid", false);
            b.put("finalPaid", false);
            b.put("note", "Đã thu cọc 20%, còn 80% cần thu nốt trước ngày khởi hành.");
            roleMockBookings.add(b);
        }

        // ── [ADMIN] 4. Đã cọc 20% -> Chờ Admin duyệt xác nhận
        if (!existingCodes.contains("TRAVEL-AD01")) {
            Map<String, Object> b = createBooking("bk_ad01", "TRAVEL-AD01", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "Quy Nhơn", 2750000L, 4,
                    "kh004", "Phạm Thị Dung", "kh004@travel.vn", "0912345681", "2026-11-10", "paid_deposit", 20);
            b.put("depositPaid", true);
            b.put("depositPaidAt", "2026-10-29T08:30:00Z");
            b.put("note", "Thu ngân đã xác nhận nhận cọc 20%. Chờ Admin duyệt đơn.");
            roleMockBookings.add(b);
        }

        // ── [ADMIN] 5. Đã trả đủ 100% -> Chờ Admin duyệt xác nhận
        if (!existingCodes.contains("TRAVEL-AD02")) {
            Map<String, Object> b = createBooking("bk_ad02", "TRAVEL-AD02", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "Thái Lan", 6990000L, 2,
                    "kh005", "Hoàng Văn Em", "kh005@travel.vn", "0912345682", "2026-11-15", "paid_full", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("finalPaid", true);
            b.put("depositPaidAt", "2026-10-29T08:00:00Z");
            b.put("finalPaidAt", "2026-10-29T08:00:00Z");
            b.put("note", "Khách đã thanh toán đủ 100%. Chờ Admin duyệt sang Confirmed.");
            roleMockBookings.add(b);
        }

        // ── [ADMIN / CASHIER] 6. Đơn xin hoàn tiền (chờ duyệt và chờ chi)
        if (!existingCodes.contains("TRAVEL-AD03")) {
            Map<String, Object> b = createBooking("bk_ad03", "TRAVEL-AD03", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "Phú Quốc", 3950000L, 2,
                    "kh006", "Võ Thị Giang", "kh006@travel.vn", "0912345683", "2026-11-20", "refund_pending", 20);
            b.put("depositPaid", true);
            b.put("depositPaidAt", "2026-10-27T10:00:00Z");
            b.put("refundId", "rf_001");
            b.put("note", "Khách hủy do bận công tác đột xuất, báo trước ngày khởi hành.");
            roleMockBookings.add(b);
        }

        // ── [OPERATOR] 7. Đơn Confirmed CHƯA GÁN HDV -> Chờ Điều Hành gán HDV
        if (!existingCodes.contains("TRAVEL-DH01")) {
            Map<String, Object> b = createBooking("bk_dh01", "TRAVEL-DH01", "101", "Hà Nội – Hạ Long 3N2Đ", "Hạ Long", 2500000L, 4,
                    "kh007", "Đặng Văn Hùng", "kh007@travel.vn", "0912345684", "2026-11-02", "confirmed", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", null);
            b.put("guideName", null);
            b.put("note", "Đơn đã thanh toán đầy đủ, sẵn sàng khởi hành. Chờ điều hành gán hướng dẫn viên phụ trách.");
            roleMockBookings.add(b);
        }

        // ── [OPERATOR] 8. Đơn bị HDV từ chối -> Điều hành gán đổi HDV khác
        if (!existingCodes.contains("TRAVEL-DH02")) {
            Map<String, Object> b = createBooking("bk_dh02", "TRAVEL-DH02", "106", "Huế – Di sản Cố Đô 3N2Đ", "Huế", 2450000L, 3,
                    "kh008", "Bùi Thị Mai", "kh008@travel.vn", "0912345685", "2026-11-04", "confirmed", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", null);
            b.put("guideName", null);
            Map<String, Object> assign = new LinkedHashMap<>();
            assign.put("guideId", "g_hn03");
            assign.put("status", "rejected");
            assign.put("assignedAt", "2026-10-28T14:00:00Z");
            assign.put("rejectedAt", "2026-10-28T16:00:00Z");
            assign.put("rejectReason", "Trùng lịch dẫn đoàn gia đình theo hợp đồng trước.");
            assign.put("rejected", List.of(Map.of("guideId", "g_hn03", "reason", "Trùng lịch bận", "at", "2026-10-28T16:00:00Z")));
            b.put("assignment", assign);
            b.put("note", "HDV Hoàng Văn Sơn từ chối do trùng lịch. Cần Điều hành gán đổi HDV khác.");
            roleMockBookings.add(b);
        }

        // ── [GUIDE - hdv.quan@travel.vn (g_hn01)] 9. Tour chờ HDV Quân nhận (guide_pending)
        if (!existingCodes.contains("TRAVEL-HDV01")) {
            Map<String, Object> b = createBooking("bk_hdv01", "TRAVEL-HDV01", "101", "Hà Nội – Hạ Long 3N2Đ", "Hạ Long", 2500000L, 4,
                    "kh009", "Dương Văn Nam", "kh009@travel.vn", "0912345686", "2026-11-06", "guide_pending", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", "g_hn01");
            b.put("guideName", "Nguyễn Minh Quân");
            Map<String, Object> assign = new LinkedHashMap<>();
            assign.put("guideId", "g_hn01");
            assign.put("status", "pending");
            assign.put("assignedAt", "2026-10-29T08:00:00Z");
            assign.put("assignedBy", "dh001");
            assign.put("deadline", "2026-10-31T17:00:00Z");
            assign.put("rejected", List.of());
            b.put("assignment", assign);
            b.put("note", "Điều hành đã gán tour cho HDV Nguyễn Minh Quân. HDV vào bấm 'Nhận tour' hoặc 'Từ chối'.");
            roleMockBookings.add(b);
        }

        // ── [GUIDE - hdv.quan@travel.vn (g_hn01)] 10. Tour HDV Quân đã nhận, sắp đi (guide_accepted)
        if (!existingCodes.contains("TRAVEL-HDV02")) {
            Map<String, Object> b = createBooking("bk_hdv02", "TRAVEL-HDV02", "104", "Ninh Bình – Tràng An – Bái Đính 1N", "Ninh Bình", 850000L, 5,
                    "kh010", "Ngô Thị Oanh", "kh010@travel.vn", "0912345687", "2026-10-31", "guide_accepted", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", "g_hn01");
            b.put("guideName", "Nguyễn Minh Quân");
            Map<String, Object> assign = new LinkedHashMap<>();
            assign.put("guideId", "g_hn01");
            assign.put("status", "accepted");
            assign.put("assignedAt", "2026-10-28T10:00:00Z");
            assign.put("respondedAt", "2026-10-28T11:00:00Z");
            assign.put("rejected", List.of());
            b.put("assignment", assign);
            b.put("note", "HDV Quân đã nhận tour. Lịch trình khởi hành 31/10/2026.");
            roleMockBookings.add(b);
        }

        // ── [GUIDE - hdv.quan@travel.vn (g_hn01)] 11. Tour ĐANG DIỄN RA (in_progress) - Checkin, Báo sự cố, Kết thúc
        if (!existingCodes.contains("TRAVEL-HDV03")) {
            Map<String, Object> b = createBooking("bk_hdv03", "TRAVEL-HDV03", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "Sa Pa", 2850000L, 3,
                    "kh011", "Vũ Hoàng Phúc", "kh011@travel.vn", "0912345688", "2026-10-29", "in_progress", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", "g_hn01");
            b.put("guideName", "Nguyễn Minh Quân");
            Map<String, Object> assign = new LinkedHashMap<>();
            assign.put("guideId", "g_hn01");
            assign.put("status", "accepted");
            assign.put("assignedAt", "2026-10-27T10:00:00Z");
            assign.put("respondedAt", "2026-10-27T11:00:00Z");
            assign.put("rejected", List.of());
            b.put("assignment", assign);
            b.put("note", "Đoàn đang di chuyển Sa Pa. HDV kiểm tra danh sách hành khách, điểm danh và báo cáo khi hoàn thành.");
            roleMockBookings.add(b);
        }

        // ── [USER TEEN & GUARDIAN] 12. Đơn có khách dưới 18 tuổi (<18) và Người giám hộ
        if (!existingCodes.contains("TRAVEL-TEEN01")) {
            Map<String, Object> b = createBooking("bk_teen01", "TRAVEL-TEEN01", "101", "Hà Nội – Hạ Long 3N2Đ", "Hạ Long", 2500000L, 2,
                    "kh_teen", "Trần Gia Bảo", "khach.teen@travel.vn", "0981234567", "2026-11-12", "confirmed", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("guideId", "g_hn01");
            b.put("guideName", "Nguyễn Minh Quân");
            
            // Thông tin người giám hộ
            Map<String, Object> guardian = new LinkedHashMap<>();
            guardian.put("name", "Trần Quốc Hùng");
            guardian.put("phone", "0908889999");
            guardian.put("relation", "Cha/Mẹ");
            b.put("guardian", guardian);

            // Danh sách hành khách có khách teen 16 tuổi
            List<Map<String, Object>> pax = new ArrayList<>();
            Map<String, Object> p1 = new LinkedHashMap<>();
            p1.put("name", "Trần Gia Bảo");
            p1.put("gender", "male");
            p1.put("birthday", "2010-06-15"); // 16 tuổi
            p1.put("idCard", "079210001234");
            p1.put("phone", "0981234567");
            pax.add(p1);

            Map<String, Object> p2 = new LinkedHashMap<>();
            p2.put("name", "Trần Quốc Hùng");
            p2.put("gender", "male");
            p2.put("birthday", "1980-04-12"); // Phụ huynh
            p2.put("idCard", "079080005678");
            p2.put("phone", "0908889999");
            pax.add(p2);
            b.put("passengers", pax);

            b.put("note", "[Người đại diện/giám hộ: Trần Quốc Hùng - 0908889999 (Cha/Mẹ)] Khách thiếu niên 16 tuổi đăng ký tham gia tour.");
            roleMockBookings.add(b);
        }

        // ── [CUSTOMER] 13. Đơn hoàn tất của khách Nguyễn Văn An (khachhang@travel.vn) để test "Viết đánh giá" và "Xuất hóa đơn"
        if (!existingCodes.contains("TRAVEL-KH03")) {
            Map<String, Object> b = createBooking("bk_kh03", "TRAVEL-KH03", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "Đà Nẵng", 3650000L, 2,
                    "kh001", "Nguyễn Văn An", "khachhang@travel.vn", "0912345678", "2026-10-20", "completed", 100);
            b.put("depositPaid", true);
            b.put("fullPaid", true);
            b.put("finalPaid", true);
            b.put("depositPaidAt", "2026-10-15T09:00:00Z");
            b.put("finalPaidAt", "2026-10-20T16:00:00Z");
            b.put("guideId", "g_hn01");
            b.put("guideName", "Nguyễn Minh Quân");
            b.put("note", "Đoàn đã hoàn tất chuyến đi an toàn và thành công tốt đẹp.");
            roleMockBookings.add(b);
        }

        // Chèn các đơn test lên đầu danh sách để hiển thị ngay khi mở trang
        roleMockBookings.addAll(bookings);
        mapper.writeValue(bkFile, roleMockBookings);
        System.out.println("Seeded role test bookings. Total bookings: " + roleMockBookings.size());

        // 3. KHIẾU NẠI CHO CSKH (complaints.json)
        File cmpFile = dbDir.resolve("complaints.json").toFile();
        List<Map<String, Object>> complaints = cmpFile.exists() ? mapper.readValue(cmpFile, new TypeReference<>() {}) : new ArrayList<>();
        if (complaints.isEmpty()) {
            Map<String, Object> c1 = new LinkedHashMap<>();
            c1.put("id", "cmp_001");
            c1.put("bookingId", "bk_tn01");
            c1.put("payCode", "TRAVEL-TN01");
            c1.put("userId", "kh001");
            c1.put("customerName", "Nguyễn Văn An");
            c1.put("email", "khachhang@travel.vn");
            c1.put("phone", "0912345678");
            c1.put("tourName", "Hà Nội – Hạ Long 3N2Đ");
            c1.put("title", "Yêu cầu sắp xếp xe đón tại khách sạn khu phố cổ");
            c1.put("content", "Gia đình tôi có trẻ em và người cao tuổi đi cùng, xin CSKH hỗ trợ xe đón tận khách sạn thay vì ra điểm tập trung chung.");
            c1.put("status", "open"); // CSKH có nút "Nhận xử lý"
            c1.put("createdAt", "2026-10-29T08:30:00Z");
            c1.put("dueAt", "2026-10-31T17:00:00Z");
            c1.put("messages", List.of());
            complaints.add(c1);

            Map<String, Object> c2 = new LinkedHashMap<>();
            c2.put("id", "cmp_002");
            c2.put("bookingId", "bk_tn02");
            c2.put("payCode", "TRAVEL-TN02");
            c2.put("userId", "kh002");
            c2.put("customerName", "Trần Thị Bình");
            c2.put("email", "kh002@travel.vn");
            c2.put("phone", "0912345679");
            c2.put("tourName", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ");
            c2.put("title", "Hỏi thực đơn ăn chay và hỗ trợ xe lăn cho người già");
            c2.put("content", "Trong đoàn có 1 khách ăn chay trường và 1 người lớn tuổi cần mượn xe lăn ở Bà Nà Hills.");
            c2.put("status", "in_progress");
            c2.put("assignee", "cs001");
            c2.put("assigneeName", "Phạm Chăm Sóc");
            c2.put("takenAt", "2026-10-29T09:00:00Z");
            c2.put("createdAt", "2026-10-29T08:15:00Z");
            c2.put("dueAt", "2026-10-31T17:00:00Z");
            c2.put("messages", List.of(Map.of("by", "cs001", "byName", "Phạm Chăm Sóc", "role", "SUPPORT",
                    "text", "Chào chị Bình, em đã liên hệ bộ phận dịch vụ Bà Nà Hills để chuẩn bị sẵn xe lăn tại chân cáp treo và báo bếp set menu chay cho mình rồi ạ.",
                    "at", "2026-10-29T09:10:00Z", "internal", false)));
            complaints.add(c2);
            mapper.writeValue(cmpFile, complaints);
            System.out.println("Seeded complaints.json with " + complaints.size() + " records");
        }

        // 4. SỰ CỐ ĐIỀU HÀNH & HDV (incidents.json)
        File incFile = dbDir.resolve("incidents.json").toFile();
        List<Map<String, Object>> incidents = incFile.exists() ? mapper.readValue(incFile, new TypeReference<>() {}) : new ArrayList<>();
        if (incidents.isEmpty()) {
            Map<String, Object> inc = new LinkedHashMap<>();
            inc.put("id", "inc_001");
            inc.put("bookingId", "bk_hdv03");
            inc.put("payCode", "TRAVEL-HDV03");
            inc.put("tourName", "Hà Nội – Sa Pa – Fansipan 3N2Đ");
            inc.put("date", "2026-10-29");
            inc.put("type", "weather");
            inc.put("severity", "medium");
            inc.put("description", "Sương mù dày đặc khu vực đèo Ô Quy Hồ, xe đoàn đang tạm nghỉ ở điểm an toàn chờ tầm nhìn tốt hơn.");
            inc.put("status", "open"); // Điều hành có nút xử lý
            inc.put("reportedBy", "hdv001");
            inc.put("reportedByName", "Nguyễn Minh Quân");
            inc.put("guideId", "g_hn01");
            inc.put("createdAt", "2026-10-29T09:30:00Z");
            incidents.add(inc);
            mapper.writeValue(incFile, incidents);
            System.out.println("Seeded incidents.json with " + incidents.size() + " records");
        }

        // 5. HOÀN TIỀN CHO ADMIN & THU NGÂN (refunds.json)
        File rfFile = dbDir.resolve("refunds.json").toFile();
        List<Map<String, Object>> refunds = rfFile.exists() ? mapper.readValue(rfFile, new TypeReference<>() {}) : new ArrayList<>();
        if (refunds.isEmpty()) {
            // Yêu cầu hoàn tiền đang chờ Admin duyệt
            Map<String, Object> rf1 = new LinkedHashMap<>();
            rf1.put("id", "rf_001");
            rf1.put("bookingId", "bk_ad03");
            rf1.put("payCode", "TRAVEL-AD03");
            rf1.put("customerName", "Võ Thị Giang");
            rf1.put("tourName", "Phú Quốc – Sunset Sanato 3N2Đ");
            rf1.put("userId", "kh006");
            rf1.put("amount", 1580000L); // Cọc 20%
            rf1.put("source", "customer_cancel");
            rf1.put("status", "pending_approval"); // Admin duyệt
            rf1.put("reason", "Khách báo hủy trước chuyến đi theo chính sách hoàn cọc.");
            rf1.put("requestedById", "kh006");
            rf1.put("requestedByName", "Võ Thị Giang");
            rf1.put("requestedRole", "CUSTOMER");
            rf1.put("requestedAt", "2026-10-29T08:00:00Z");
            rf1.put("complaintId", "");
            rf1.put("full", true);
            refunds.add(rf1);

            // Khoản hoàn tiền đã được Admin duyệt -> Thu ngân bấm "Đã hoàn tiền"
            Map<String, Object> rf2 = new LinkedHashMap<>();
            rf2.put("id", "rf_002");
            rf2.put("bookingId", "bk_tn04_ref");
            rf2.put("payCode", "TRAVEL-REF02");
            rf2.put("customerName", "Lê Văn Cường");
            rf2.put("tourName", "Ninh Bình – Tràng An 1N");
            rf2.put("userId", "kh003");
            rf2.put("amount", 850000L);
            rf2.put("source", "company_cancel");
            rf2.put("status", "approved"); // Thu ngân thấy ở mục hoàn tiền
            rf2.put("reason", "Thời tiết bão lũ ngập đường, công ty thông báo hoàn tiền 100% cho khách.");
            rf2.put("requestedById", "ad001");
            rf2.put("requestedByName", "Quản Trị Viên");
            rf2.put("requestedRole", "ADMIN");
            rf2.put("requestedAt", "2026-10-28T15:00:00Z");
            rf2.put("approvedById", "ad001");
            rf2.put("approvedAt", "2026-10-28T15:30:00Z");
            rf2.put("complaintId", "");
            rf2.put("full", true);
            refunds.add(rf2);
            mapper.writeValue(rfFile, refunds);
            System.out.println("Seeded refunds.json with " + refunds.size() + " records");
        }

        // 6. ĐỐNG SỔ THU NGÂN (reconciliations.json)
        File recFile = dbDir.resolve("reconciliations.json").toFile();
        List<Map<String, Object>> recs = recFile.exists() ? mapper.readValue(recFile, new TypeReference<>() {}) : new ArrayList<>();
        if (recs.isEmpty()) {
            Map<String, Object> rec = new LinkedHashMap<>();
            rec.put("id", "rec_20261028");
            rec.put("date", "2026-10-28");
            rec.put("cashierId", "tn001");
            rec.put("cashierName", "Lê Thu Ngân");
            rec.put("totalCollected", 48500000L);
            rec.put("totalRefunded", 850000L);
            rec.put("netTotal", 47650000L);
            rec.put("bankStatementTotal", 47650000L);
            rec.put("discrepancy", 0L);
            rec.put("transactionCount", 14);
            rec.put("status", "approved");
            rec.put("approvedBy", "ad001");
            rec.put("approvedByName", "Quản Trị Viên");
            rec.put("approvedAt", "2026-10-28T18:30:00Z");
            rec.put("note", "Đóng sổ đối soát ngân hàng cuối ngày 28/10/2026: Khớp 100% sao kê tài khoản ngân hàng.");
            rec.put("createdAt", "2026-10-28T17:45:00Z");
            recs.add(rec);
            mapper.writeValue(recFile, recs);
            System.out.println("Seeded reconciliations.json with " + recs.size() + " records");
        }

        // 7. LỊCH KHỞI HÀNH ĐIỀU HÀNH (departures.json)
        File depFile = dbDir.resolve("departures.json").toFile();
        List<Map<String, Object>> deps = depFile.exists() ? mapper.readValue(depFile, new TypeReference<>() {}) : new ArrayList<>();
        if (deps.isEmpty()) {
            String[] tourIds = {"101", "102", "104", "105", "107", "108"};
            String[] tourNames = {"Hà Nội – Hạ Long 3N2Đ", "Hà Nội – Sa Pa 3N2Đ", "Ninh Bình – Tràng An 1N", "Đà Nẵng – Hội An 4N3Đ", "Quy Nhơn – Kỳ Co 3N2Đ", "Phú Quốc – Sunset Sanato 3N2Đ"};
            long[] prices = {2500000L, 2850000L, 850000L, 3650000L, 2750000L, 3950000L};
            String[] dates = {"2026-10-30", "2026-11-02", "2026-11-05", "2026-11-08", "2026-11-15", "2026-11-20"};
            for (int i = 0; i < tourIds.length; i++) {
                Map<String, Object> dp = new LinkedHashMap<>();
                dp.put("id", "dep_" + tourIds[i] + "_" + dates[i]);
                dp.put("tourId", tourIds[i]);
                dp.put("tourName", tourNames[i]);
                dp.put("date", dates[i]);
                dp.put("capacity", 25);
                dp.put("minGuests", 8);
                dp.put("pax", 12 + i * 2);
                dp.put("status", "open");
                dp.put("price", prices[i]);
                dp.put("note", "Lịch khởi hành mở định kỳ cho tour " + tourNames[i]);
                deps.add(dp);
            }
            mapper.writeValue(depFile, deps);
            System.out.println("Seeded departures.json with " + deps.size() + " records");
        }

        // 8. HỒ SƠ HƯỚNG DẪN VIÊN (guides.json)
        File guidesFile = dbDir.resolve("guides.json").toFile();
        Path seedGuidePath = Files.exists(Paths.get("../frontend/data/guides-seed.json")) ? Paths.get("../frontend/data/guides-seed.json") : Paths.get("frontend/data/guides-seed.json");
        if (Files.exists(seedGuidePath)) {
            List<Map<String, Object>> guideSeeds = mapper.readValue(seedGuidePath.toFile(), new TypeReference<>() {});
            for (Map<String, Object> g : guideSeeds) {
                g.put("demo", false); // đảm bảo không bị removeIf demo
            }
            mapper.writeValue(guidesFile, guideSeeds);
            System.out.println("Seeded guides.json with " + guideSeeds.size() + " records");
        }

        // 9. ĐÁNH GIÁ (reviews.json)
        File revFile = dbDir.resolve("reviews.json").toFile();
        Path seedRevPath = Files.exists(Paths.get("../frontend/data/reviews-seed.json")) ? Paths.get("../frontend/data/reviews-seed.json") : Paths.get("frontend/data/reviews-seed.json");
        if (Files.exists(seedRevPath)) {
            Map<String, Object> revData = mapper.readValue(seedRevPath.toFile(), new TypeReference<>() {});
            List<Map<String, Object>> revList = (List<Map<String, Object>>) revData.get("reviews");
            if (revList != null) {
                mapper.writeValue(revFile, revList);
                System.out.println("Seeded reviews.json with " + revList.size() + " records");
            }
        }
    }

    private static Map<String, Object> createBooking(String id, String payCode, String tourId, String tourName, String tourDest,
                                                    long unitPrice, int pax, String userId, String customerName, String email,
                                                    String phone, String date, String status, int depositPct) {
        Map<String, Object> bk = new LinkedHashMap<>();
        bk.put("id", id);
        bk.put("payCode", payCode);
        bk.put("tourId", tourId);
        bk.put("tourName", tourName);
        bk.put("tourDest", tourDest);
        bk.put("userId", userId);
        bk.put("userEmail", email);
        bk.put("customerName", customerName);
        bk.put("phone", phone);
        bk.put("email", email);
        bk.put("date", date);
        bk.put("pax", pax);
        bk.put("adults", pax);
        bk.put("children", 0);
        bk.put("infants", 0);

        long totalPrice = unitPrice * pax;
        long deposit = Math.round(totalPrice * (depositPct / 100.0) / 10000) * 10000;
        long remaining = totalPrice - deposit;

        bk.put("price", totalPrice);
        bk.put("deposit", deposit);
        bk.put("depositPercent", depositPct);

        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("adults", pax);
        breakdown.put("kids", 0);
        breakdown.put("infants", 0);
        breakdown.put("pax", pax);
        breakdown.put("base", totalPrice);
        breakdown.put("hdv", 0);
        breakdown.put("subtotal", totalPrice);
        breakdown.put("discount", 0);
        breakdown.put("voucherCode", "");
        breakdown.put("final", totalPrice);
        breakdown.put("depositPct", depositPct);
        breakdown.put("deposit", deposit);
        breakdown.put("remaining", remaining);
        bk.put("priceBreakdown", breakdown);

        bk.put("tourDuration", "3 ngày 2 đêm");
        bk.put("tourDays", 3);
        bk.put("tourHighlight", "Điểm đến hấp dẫn, dịch vụ tiện nghi chuẩn 4 sao.");
        bk.put("guideType", "guided");
        bk.put("status", status);

        boolean isFull = "paid_full".equals(status) || "confirmed".equals(status) || "guide_accepted".equals(status) || "in_progress".equals(status) || "completed".equals(status);
        boolean isDep = isFull || "paid_deposit".equals(status);

        bk.put("depositPaid", isDep);
        bk.put("fullPaid", isFull);
        bk.put("finalPaid", isFull);

        List<Map<String, Object>> paxList = new ArrayList<>();
        for (int p = 0; p < pax; p++) {
            Map<String, Object> px = new LinkedHashMap<>();
            px.put("name", p == 0 ? customerName : "Hành Khách " + (p + 1));
            px.put("gender", p % 2 == 0 ? "male" : "female");
            px.put("birthday", "199" + (p % 9) + "-05-15");
            px.put("idCard", "07909" + String.format("%07d", 1000 + p));
            px.put("phone", p == 0 ? phone : "098800011" + p);
            if ("in_progress".equals(status) || "completed".equals(status)) {
                px.put("checkin", "present");
                px.put("checkinAt", date + "T07:30:00Z");
            }
            paxList.add(px);
        }
        bk.put("passengers", paxList);

        List<Map<String, Object>> payments = new ArrayList<>();
        if (isDep) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("id", "pm_" + id + "_1");
            pm.put("kind", "deposit");
            pm.put("amount", deposit);
            pm.put("source", "cashier");
            pm.put("byId", "tn001");
            pm.put("byName", "Lê Thu Ngân");
            pm.put("role", "CASHIER");
            pm.put("note", "Thu cọc " + depositPct + "%");
            pm.put("at", "2026-10-29T08:00:00Z");
            pm.put("undone", false);
            payments.add(pm);
        }
        if (isFull) {
            Map<String, Object> pm2 = new LinkedHashMap<>();
            pm2.put("id", "pm_" + id + "_2");
            pm2.put("kind", "balance");
            pm2.put("amount", remaining);
            pm2.put("source", "cashier");
            pm2.put("byId", "tn001");
            pm2.put("byName", "Lê Thu Ngân");
            pm2.put("role", "CASHIER");
            pm2.put("note", "Thu phần còn lại 80%");
            pm2.put("at", "2026-10-29T08:30:00Z");
            pm2.put("undone", false);
            payments.add(pm2);
        }
        bk.put("payments", payments);

        List<Map<String, Object>> hist = new ArrayList<>();
        hist.add(Map.of("at", "2026-10-28T08:00:00Z", "action", "create", "from", "", "to", "pending_payment",
                "byId", userId, "byName", customerName, "role", "CUSTOMER", "note", "Đặt tour trực tuyến"));
        if (isDep) {
            hist.add(Map.of("at", "2026-10-29T08:00:00Z", "action", "status", "from", "pending_payment", "to", "paid_deposit",
                    "byId", "tn001", "byName", "Lê Thu Ngân", "role", "CASHIER", "note", "Xác nhận thu cọc " + String.format("%,d ₫", deposit)));
        }
        if (isFull) {
            hist.add(Map.of("at", "2026-10-29T08:30:00Z", "action", "status", "from", "paid_deposit", "to", "confirmed",
                    "byId", "ad001", "byName", "Quản Trị Viên", "role", "ADMIN", "note", "Admin duyệt xác nhận đơn"));
        }
        bk.put("history", hist);

        bk.put("createdAt", "2026-10-28T08:00:00.000Z");
        bk.put("statusAt", "2026-10-29T08:30:00.000Z");

        return bk;
    }

    private static Map<String, Object> createBanner(String id, String tourId, String badge, String title, String subtitle,
                                                    String bgFrom, String bgTo, String image, int priority) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("id", id);
        b.put("tourId", tourId);
        b.put("imageOnly", false);
        b.put("badge", badge);
        b.put("title", title);
        b.put("subtitle", subtitle);
        b.put("bgFrom", bgFrom);
        b.put("bgTo", bgTo);
        b.put("image", image);
        b.put("link", "#/tour/" + tourId);
        b.put("ctaText", "Đặt tour ngay");
        b.put("priority", priority);
        b.put("enabled", true);
        b.put("startAt", "2026-01-01T00:00:00.000Z");
        b.put("endAt", "2036-12-31T23:59:59.000Z");
        b.put("createdAt", "2026-10-29T08:00:00.000Z");
        return b;
    }

    private static Map<String, Object> createReview(String id, String tourId, String tourName, String userId, String name,
                                                    int rating, String content, int guideScore, int transScore, int foodScore,
                                                    int hotelScore, int valueScore, String guideComment, String dateStr) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id);
        r.put("tourId", tourId);
        r.put("tourName", tourName);
        r.put("userId", userId);
        r.put("name", name);
        r.put("rating", rating);
        r.put("content", content);
        Map<String, Object> criteria = new LinkedHashMap<>();
        criteria.put("guide", guideScore);
        criteria.put("transport", transScore);
        criteria.put("food", foodScore);
        criteria.put("hotel", hotelScore);
        criteria.put("value", valueScore);
        r.put("criteria", criteria);
        r.put("guideRating", guideScore);
        if (guideComment != null && !guideComment.isEmpty()) {
            r.put("guideComment", guideComment);
        }
        r.put("createdAt", dateStr + "T10:00:00.000Z");
        r.put("date", dateStr);
        r.put("source", "verified");
        r.put("sample", false);
        return r;
    }

    @Test
    void seedComprehensiveReviewsAndPromoteTours() throws Exception {
        Path dbDir = Files.exists(Paths.get("storage/db")) ? Paths.get("storage/db") : Paths.get("backend/storage/db");
        Path frontDataDir = Files.exists(Paths.get("../frontend/data")) ? Paths.get("../frontend/data") : Paths.get("frontend/data");
        assertTrue(Files.exists(dbDir), "dbDir must exist: " + dbDir.toAbsolutePath());
        assertTrue(Files.exists(frontDataDir), "frontDataDir must exist: " + frontDataDir.toAbsolutePath());

        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);

        // 1. CẬP NHẬT tour-stats.json: Bổ sung đầy đủ 17 tour với xếp hạng chính xác (Tour bán chạy 112, 111 dẫn đầu)
        File statsFile = frontDataDir.resolve("tour-stats.json").toFile();
        Map<String, Object> statsData = new LinkedHashMap<>();
        statsData.put("_note", "DỮ LIỆU MẪU cho demo (lượt dùng/đánh giá khởi điểm). Đơn đặt thật được cộng thêm vào khi xếp hạng.");
        statsData.put("sample", true);
        List<Map<String, Object>> statTours = List.of(
                Map.of("tourId", "112", "used", 2850L, "reviews", 1420L, "rating", 4.9),
                Map.of("tourId", "111", "used", 2650L, "reviews", 1310L, "rating", 4.9),
                Map.of("tourId", "105", "used", 2486L, "reviews", 1214L, "rating", 4.9),
                Map.of("tourId", "101", "used", 2203L, "reviews", 1067L, "rating", 4.8),
                Map.of("tourId", "108", "used", 1941L, "reviews", 903L, "rating", 4.8),
                Map.of("tourId", "107", "used", 1722L, "reviews", 788L, "rating", 4.8),
                Map.of("tourId", "103", "used", 1610L, "reviews", 720L, "rating", 4.9),
                Map.of("tourId", "104", "used", 1550L, "reviews", 680L, "rating", 4.8),
                Map.of("tourId", "110", "used", 1508L, "reviews", 652L, "rating", 4.7),
                Map.of("tourId", "106", "used", 1380L, "reviews", 590L, "rating", 4.8),
                Map.of("tourId", "102", "used", 1296L, "reviews", 541L, "rating", 4.7),
                Map.of("tourId", "109", "used", 1150L, "reviews", 480L, "rating", 4.8),
                Map.of("tourId", "hot07", "used", 1084L, "reviews", 436L, "rating", 4.8),
                Map.of("tourId", "hot08", "used", 927L, "reviews", 352L, "rating", 4.7),
                Map.of("tourId", "hot09", "used", 803L, "reviews", 289L, "rating", 4.8),
                Map.of("tourId", "hot10", "used", 688L, "reviews", 231L, "rating", 4.7),
                Map.of("tourId", "hot11", "used", 574L, "reviews", 176L, "rating", 4.7)
        );
        statsData.put("tours", statTours);
        mapper.writeValue(statsFile, statsData);
        System.out.println("Updated tour-stats.json with all 17 tours (112, 111 leading)");

        // 2. GHIM TOUR BÁN CHẠY: featuredpin.json
        File pinFile = dbDir.resolve("featuredpin.json").toFile();
        Map<String, Object> pinData = new LinkedHashMap<>();
        pinData.put("pinned", List.of("112", "111", "105", "101", "108"));
        mapper.writeValue(pinFile, pinData);
        System.out.println("Written top 5 tours to featuredpin.json");

        // 3. CẬP NHẬT BANNER TRANG CHỦ: banners.json
        File bannerFile = dbDir.resolve("banners.json").toFile();
        List<Map<String, Object>> topBanners = List.of(
                createBanner("bn_top_112", "112", "🏆 TOP 1 BÁN CHẠY NHẤT", "Singapore – Malaysia 5N4Đ: Đẳng cấp quốc tế",
                        "Khám phá Gardens by the Bay, Marina Bay Sands & Tháp đôi Petronas", "#0f172a", "#1e3a8a", "", 100),
                createBanner("bn_top_111", "111", "🔥 TOP 2 DOANH THU", "Thái Lan – Bangkok – Pattaya 5N4Đ",
                        "Chiêm ngưỡng Cung điện Hoàng Gia, tắm biển đảo San Hô Coral & Chợ nổi 4 miền", "#1e1b4b", "#4338ca", "", 99),
                createBanner("bn_top_105", "105", "⭐ TOP 1 LƯỢT ĐẶT", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
                        "Check-in Cầu Vàng nổi tiếng, phố cổ Hội An & bán đảo Sơn Trà", "#0c4a6e", "#0369a1", "img/tours_mau/mien-trung/da-nang/da-nang-cau-vang.jpg", 98),
                createBanner("bn_top_101", "101", "⛵ KỲ QUAN THẾ GIỚI", "Hà Nội – Vịnh Hạ Long 3N2Đ",
                        "Du thuyền tiện nghi chuẩn 4 sao, thăm Đảo Titop & Hang Sửng Sốt kỳ vĩ", "#064e3b", "#047857", "", 97),
                createBanner("bn_top_108", "108", "🌴 THIÊN ĐƯỜNG BIỂN ĐẢO", "Phú Quốc – Sunset Sanato 3N2Đ",
                        "Trải nghiệm cáp treo Hòn Thơm vượt biển, tắm biển Bãi Sao & Grand World", "#701a75", "#a21caf", "", 96)
        );
        mapper.writeValue(bannerFile, topBanners);
        System.out.println("Updated banners.json with top 5 selling tours");

        // 4. SINH BỘ DỮ LIỆU ĐÁNH GIÁ & BÌNH LUẬN ĐẶC SẮC (reviews.json & reviews-seed.json)
        List<Map<String, Object>> allReviews = new ArrayList<>();

        // ── Tour 112: Singapore – Malaysia 5N4Đ
        allReviews.add(createReview("rv_112_01", "112", "Singapore – Malaysia 5N4Đ", "kh001", "Nguyễn Văn An", 5,
                "Tour Singapore - Malaysia 5N4Đ vượt xa mong đợi! Khách sạn 4 sao sạch đẹp ngay trung tâm, Gardens by the Bay và Tháp đôi Petronas lên đèn buổi tối cực kỳ hoành tráng. Hướng dẫn viên chu đáo, giải thích tận tình văn hóa hai nước.",
                5, 5, 5, 5, 5, "HDV rất nhiệt tình, am hiểu văn hóa và hỗ trợ chụp ảnh rất đẹp cho mọi người.", "2026-10-25"));
        allReviews.add(createReview("rv_112_02", "112", "Singapore – Malaysia 5N4Đ", "kh002", "Trần Thị Bình", 5,
                "Cả nhà mình vừa có chuyến đi Sing - Mã rất vui và ý nghĩa. Lịch trình sắp xếp khoa học, buffet quốc tế ngon miệng, thủ tục xuất nhập cảnh qua cửa khẩu Malaysia nhanh gọn nhờ HDV hỗ trợ tốt.",
                5, 5, 5, 5, 5, "HDV chăm sóc đoàn chu đáo, thủ tục qua cửa khẩu rất nhanh gọn.", "2026-10-22"));
        allReviews.add(createReview("rv_112_03", "112", "Singapore – Malaysia 5N4Đ", "kh003", "Lê Văn Cường", 5,
                "Dịch vụ chuẩn chỉ từ vé máy bay, xe đưa đón đến các bữa ăn. Đặc biệt ấn tượng với công viên nhạc nước Marina Bay Sands và phố cổ Malacca mang đậm nét lịch sử.",
                5, 5, 5, 4, 5, "HDV thuyết minh lịch sử Malacca rất cuốn hút và truyền cảm.", "2026-10-18"));
        allReviews.add(createReview("rv_112_04", "112", "Singapore – Malaysia 5N4Đ", "kh004", "Phạm Thị Dung", 5,
                "Lần đầu xuất ngoại với Travel, trải nghiệm rất yên tâm. Hướng dẫn viên chuyên nghiệp, nhiệt tình chỉ dẫn chỗ mua sắm và hoàn thuế tại sân bay Changi. Giá tour trọn gói rất hợp lý.",
                5, 4, 5, 5, 5, "HDV hướng dẫn hoàn thuế tại sân bay Changi cực kỳ chi tiết, không lo bỡ ngỡ.", "2026-10-14"));
        allReviews.add(createReview("rv_112_05", "112", "Singapore – Malaysia 5N4Đ", "kh005", "Hoàng Văn Em", 5,
                "Một chuyến đi 5 ngày 4 đêm trọn vẹn cảm xúc. Cao nguyên Genting mát lạnh, cáp treo hiện đại và phố đi bộ Orchard mua sắm thỏa thích. Sẽ tiếp tục đồng hành cùng Travel.",
                5, 5, 5, 5, 5, "Tác phong chuyên nghiệp, luôn đúng giờ và quan tâm mọi thành viên.", "2026-10-09"));
        allReviews.add(createReview("rv_112_06", "112", "Singapore – Malaysia 5N4Đ", "kh006", "Võ Thị Giang", 4,
                "Đoàn mình 6 người đều rất hài lòng. Bữa ăn phong phú có cả Cua sốt ớt Chilli Crab và trà Bak Kut Teh đặc sản. Hướng dẫn viên luôn ưu tiên chăm sóc các cô chú lớn tuổi.",
                5, 4, 4, 4, 5, "HDV chu đáo, quan tâm chăm sóc sức khỏe người lớn tuổi suốt hành trình.", "2026-10-05"));

        // ── Tour 111: Thái Lan – Bangkok – Pattaya 5N4Đ
        allReviews.add(createReview("rv_111_01", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh007", "Đặng Văn Hùng", 5,
                "Tour Thái Lan cực kỳ sôi động và nhiều kỷ niệm! Cung điện Hoàng Gia tráng lệ, tắm biển đảo san hô Coral nước trong vắt. Đồ ăn Thái cay nồng chuẩn vị, buffet Baiyoke Sky tầng 86 ngắm toàn cảnh Bangkok rất đẹp.",
                5, 5, 5, 5, 5, "HDV rất vui tính, khuấy động không khí đoàn trên suốt chuyến đi.", "2026-10-26"));
        allReviews.add(createReview("rv_111_02", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh008", "Bùi Thị Mai", 5,
                "Giá tour quá tốt so với chất lượng nhận được. Xe du lịch đời mới máy lạnh êm ru, show Alcazar hoành tráng đẳng cấp thế giới. HDV Thái và HDV Việt Nam phối hợp rất nhịp nhàng.",
                5, 5, 4, 5, 5, "HDV song ngữ linh hoạt, xử lý mọi tình huống nhanh nhẹn.", "2026-10-23"));
        allReviews.add(createReview("rv_111_03", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh009", "Dương Văn Nam", 5,
                "Chuyến du lịch gia đình 5 ngày 4 đêm vô cùng trọn vẹn. Chợ nổi 4 miền độc đáo, massage Thái cổ truyền thư giãn tuyệt vời sau ngày dài tham quan. Rất đáng tiền!",
                5, 5, 5, 5, 5, "HDV chu đáo, tận tình giới thiệu các địa điểm ăn uống ngon bổ rẻ.", "2026-10-19"));
        allReviews.add(createReview("rv_111_04", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh010", "Ngô Thị Oanh", 4,
                "Lịch trình hợp lý, nhiều thời gian tự do mua sắm tại chợ đêm Jodd Fairs và Big C. Khách sạn ở Pattaya có hồ bơi view biển đẹp lung linh.",
                5, 4, 4, 5, 4, "HDV nhiệt tình hướng dẫn đổi tiền và mặc cả khi mua đồ chợ đêm.", "2026-10-15"));
        allReviews.add(createReview("rv_111_05", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh011", "Vũ Hoàng Phúc", 5,
                "Mọi khâu tổ chức từ lúc đón ở sân bay đến khi về đều rất chu đáo. Hướng dẫn viên tận tâm chỉ dẫn các tips mua sắm và hỗ trợ thủ tục bay.",
                5, 5, 5, 5, 5, "Tác phong chuyên nghiệp, luôn nhắc nhở giờ giấc cẩn thận.", "2026-10-11"));
        allReviews.add(createReview("rv_111_06", "111", "Thái Lan – Bangkok – Pattaya 5N4Đ", "kh012", "Đinh Tuyết Mai", 5,
                "Chuyến đi tuyệt vời cho nhóm bạn trẻ tụi mình. Cảnh đẹp, đồ ăn ngon, không phát sinh chi phí ẩn nào. Vote 5 sao cho Travel!",
                5, 5, 5, 4, 5, "HDV chụp hình siêu đẹp cho cả nhóm tha hồ sống ảo.", "2026-10-07"));

        // ── Tour 105: Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ
        allReviews.add(createReview("rv_105_01", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh013", "Lý Gia Hân", 5,
                "Cầu Vàng Bà Nà Hills đẹp ngỡ ngàng trong sương sớm! Phố cổ Hội An về đêm lung linh ánh đèn hoa đăng. Đồ ăn miền Trung từ mỳ Quảng đến bánh xèo đều rất ngon.",
                5, 5, 5, 5, 5, "HDV Lê Hoàng Nam am hiểu văn hóa Chăm Pa và Hội An sâu sắc.", "2026-10-24"));
        allReviews.add(createReview("rv_105_02", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh014", "Trương Quốc Bảo", 5,
                "Khách sạn 4 sao mặt biển Mỹ Khê thức dậy ngắm bình minh cực đã. Hướng dẫn viên thuyết minh rất cuốn hút và nhiệt tình chụp ảnh cho cả đoàn.",
                5, 5, 5, 5, 5, "HDV chụp ảnh có tâm, luôn vui vẻ hòa đồng với mọi người.", "2026-10-20"));
        allReviews.add(createReview("rv_105_03", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh015", "Cao Thị Ngọc", 5,
                "Lịch trình nhẹ nhàng phù hợp cả người già và trẻ nhỏ. Bữa buffet tại Bà Nà Hills phong phú món Á - Âu. Dịch vụ xe đưa đón chuẩn giờ.",
                5, 5, 5, 4, 5, "HDV luôn quan tâm hỗ trợ đẩy xe cho trẻ nhỏ và người lớn tuổi.", "2026-10-16"));
        allReviews.add(createReview("rv_105_04", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh001", "Nguyễn Hải Đăng", 5,
                "Rất thích hoạt động đi thuyền thúng rừng dừa Bảy Mẫu và xem múa thúng mạo hiểm. HDV nhiệt tình quay clip và chụp hình cho mọi người trong đoàn.",
                5, 4, 5, 5, 5, "HDV kết nối bà con chèo thuyền rất thân thiện, chu đáo.", "2026-10-12"));
        allReviews.add(createReview("rv_105_05", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh002", "Trần Mai Anh", 4,
                "Một chuyến đi trọn vẹn và đáng nhớ. Cầu Rồng phun lửa và nước cuối tuần rất náo nhiệt. Giá tour rất tốt so với dịch vụ chuẩn 4 sao.",
                4, 4, 5, 4, 5, "HDV sắp xếp chỗ xem Cầu Rồng phun lửa rất đẹp và thoáng mát.", "2026-10-08"));
        allReviews.add(createReview("rv_105_06", "105", "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", "kh003", "Lê Quốc Toàn", 5,
                "Đoàn công ty mình 20 người đi tour này ai cũng khen. Khâu tổ chức chuyên nghiệp, xuất hóa đơn nhanh chóng, chăm sóc khách hàng tận tâm.",
                5, 5, 5, 5, 5, "HDV điều phối đoàn lớn rất linh hoạt, không ai bị sót lại.", "2026-10-03"));

        // ── Tour 101: Hà Nội – Hạ Long 3N2Đ
        allReviews.add(createReview("rv_101_01", "101", "Hà Nội – Hạ Long 3N2Đ", "kh004", "Phạm Thùy Linh", 5,
                "Du thuyền 4 sao trên Vịnh Hạ Long quá tuyệt vời! Phòng có ban công riêng nhìn thẳng ra vịnh đá vôi kỳ vĩ. Hang Sửng Sốt và chèo kayak tại Titop rất thú vị.",
                5, 5, 5, 5, 5, "HDV am hiểu tường tận các hang động và sự tích vịnh Hạ Long.", "2026-10-25"));
        allReviews.add(createReview("rv_101_02", "101", "Hà Nội – Hạ Long 3N2Đ", "kh005", "Vũ Minh Trí", 5,
                "Cảnh sắc Hạ Long quả xứng danh kỳ quan thiên nhiên thế giới. Bữa tiệc hải sản tươi sống trên tàu ngon xuất sắc. Hướng dẫn viên chuyên nghiệp, chu đáo.",
                5, 5, 5, 5, 5, "HDV phục vụ chu đáo, nhiệt tình hỗ trợ khách chèo kayak.", "2026-10-21"));
        allReviews.add(createReview("rv_101_03", "101", "Hà Nội – Hạ Long 3N2Đ", "kh006", "Đỗ Thu Thảo", 5,
                "Chuyến đi ngắn ngày nhưng cực kỳ thư giãn và nạp lại năng lượng. Lớp học làm nem và tiệc hoàng hôn trên sundeck du thuyền rất ấn tượng.",
                5, 4, 5, 5, 5, "HDV dẫn dắt buổi tiệc hoàng hôn tạo không khí rất ấm cúng.", "2026-10-17"));
        allReviews.add(createReview("rv_101_04", "101", "Hà Nội – Hạ Long 3N2Đ", "kh007", "Bùi Đức Thịnh", 4,
                "Khách sạn và du thuyền đều sạch sẽ, nhân viên phục vụ lịch sự và chu đáo. Rất hài lòng với dịch vụ trọn gói của công ty.",
                4, 5, 4, 4, 4, "HDV thân thiện, giải đáp mọi thắc mắc của khách du lịch.", "2026-10-13"));
        allReviews.add(createReview("rv_101_05", "101", "Hà Nội – Hạ Long 3N2Đ", "kh008", "Hoàng Kim Ngân", 5,
                "Đón trả khách đúng giờ tại phố cổ Hà Nội. Xe limousine êm ái, chạy cao tốc nhanh và an toàn. Sẽ rủ thêm bạn bè đi lần sau.",
                5, 5, 5, 4, 5, "Bác tài và HDV phối hợp rất nhịp nhàng, xe chạy rất êm.", "2026-10-08"));
        allReviews.add(createReview("rv_101_06", "101", "Hà Nội – Hạ Long 3N2Đ", "kh009", "Đặng Tuấn Kiệt", 5,
                "Cảnh vịnh lúc hoàng hôn và bình minh đẹp như tranh thủy mặc. Một chuyến đi ý nghĩa cho kỳ nghỉ cùng gia đình.",
                5, 5, 5, 5, 5, "HDV nhiệt tình, chu đáo từ bữa ăn đến giấc ngủ cho khách.", "2026-10-02"));

        // ── Tour 108: Phú Quốc – Sunset Sanato 3N2Đ
        allReviews.add(createReview("rv_108_01", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh010", "Lý Cẩm Tú", 5,
                "Phú Quốc tuyệt đẹp! Hoàng hôn ở Sunset Sanato chụp ảnh góc nào cũng mê ly. Cáp treo Hòn Thơm vượt biển dài nhất thế giới ngắm toàn cảnh đảo ngọc quá đã.",
                5, 5, 5, 5, 5, "HDV chỉ cho đoàn những góc chụp ảnh sống ảo đỉnh nhất.", "2026-10-24"));
        allReviews.add(createReview("rv_108_02", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh011", "Cao Văn Khánh", 5,
                "Tour 4 đảo đi cano lướt sóng cực kỳ thích thú, lặn ngắm san hô tự nhiên và chụp ảnh sup bằng flycam miễn phí. Khách sạn trung tâm tiện đi chợ đêm.",
                5, 5, 5, 5, 5, "HDV cano hướng dẫn lặn ngắm san hô rất cẩn thận và an toàn.", "2026-10-19"));
        allReviews.add(createReview("rv_108_03", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh012", "Dương Ngọc Bích", 5,
                "Grand World hoạt động xuyên đêm náo nhiệt, show nhạc nước Sắc màu Venice mãn nhãn. Đồ ăn hải sản tươi ngon, bún quậy Kiến Xây chuẩn vị.",
                5, 4, 5, 5, 5, "HDV dẫn đi ăn bún quậy đúng quán gốc, vị ngon nhớ mãi.", "2026-10-15"));
        allReviews.add(createReview("rv_108_04", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh013", "Ngô Trọng Hiếu", 5,
                "Kỳ nghỉ dưỡng tuyệt vời cho hai vợ chồng. Biển Bãi Sao cát trắng mịn, nước trong veo. Cảm ơn Travel đã mang đến một trải nghiệm khó quên.",
                5, 5, 5, 5, 5, "HDV rất tâm lý, tạo không gian riêng tư cho các cặp đôi.", "2026-10-10"));
        allReviews.add(createReview("rv_108_05", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh014", "Phan Thanh Tâm", 4,
                "HDV địa phương rất nhiệt tình, hỗ trợ mang vác hành lý cho khách lớn tuổi. Xe du lịch sạch sẽ, thơm tho, tài xế lái cẩn thận.",
                5, 5, 4, 4, 4, "HDV luôn niềm nở và hỗ trợ hành lý cho khách lớn tuổi.", "2026-10-06"));
        allReviews.add(createReview("rv_108_06", "108", "Phú Quốc – Sunset Sanato 3N2Đ", "kh015", "Tạ Hồng Nhung", 5,
                "Dịch vụ chuyên nghiệp, hỗ trợ check in sớm và xuất vé cáp treo nhanh chóng, không phải xếp hàng chờ đợi.",
                5, 5, 5, 5, 5, "HDV lấy vé nhanh, không phải xếp hàng nắng nóng.", "2026-10-01"));

        // ── Tour 107: Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ
        allReviews.add(createReview("rv_107_01", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "kh001", "Nguyễn Văn An", 5,
                "Kỳ Co đúng danh xưng Maldives của Việt Nam! Nước biển xanh ngắt hai màu tuyệt đẹp. Cung đường đi bộ ven biển Eo Gió ngắm hoàng hôn lãng mạn vô cùng.",
                5, 5, 5, 5, 5, "HDV địa phương rất am hiểu văn hóa và phong tục Bình Định.", "2026-10-23"));
        allReviews.add(createReview("rv_107_02", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "kh002", "Trần Thị Bình", 5,
                "Hải sản Nhơn Lý tươi rói, ốc biển và lẩu sứa ngon xuất sắc. HDV địa phương thân thiện, chụp ảnh có tâm từng góc.",
                5, 4, 5, 5, 5, "HDV chụp hình siêu đẹp, nhiệt tình hướng dẫn khách tạo dáng.", "2026-10-18"));
        allReviews.add(createReview("rv_107_03", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "kh003", "Lê Văn Cường", 5,
                "Khách sạn sát biển Quy Nhơn, gió biển mát rượi. Lịch trình tham quan Tháp Đôi và Ghềnh Ráng Tiên Sa viếng mộ thi sĩ Hàn Mặc Tử rất lắng đọng.",
                5, 5, 4, 5, 5, "HDV đọc thơ Hàn Mặc Tử tại mộ thi sĩ truyền cảm xúc sâu lắng.", "2026-10-14"));
        allReviews.add(createReview("rv_107_04", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "kh004", "Phạm Thị Dung", 4,
                "Tour đi cano ra đảo an toàn, trang bị áo phao đầy đủ. Một chuyến du lịch hè trọn vẹn bên người thân.",
                4, 5, 4, 4, 4, "Tác phong nhanh nhẹn, luôn đảm bảo an toàn sông nước cho khách.", "2026-10-09"));
        allReviews.add(createReview("rv_107_05", "107", "Quy Nhơn – Kỳ Co – Eo Gió 3N2Đ", "kh005", "Hoàng Văn Em", 5,
                "Thời tiết Quy Nhơn nắng đẹp, cảnh quan nguyên sơ chưa bị thương mại hóa nhiều. Dịch vụ của Travel rất chu đáo.",
                5, 5, 5, 5, 5, "HDV nhiệt tình, luôn hỏi thăm và chăm sóc từng gia đình.", "2026-10-04"));

        // ── Tour 102: Hà Nội – Sa Pa – Fansipan 3N2Đ
        allReviews.add(createReview("rv_102_01", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "kh006", "Võ Thị Giang", 5,
                "Chinh phục nóc nhà Đông Dương Fansipan lúc biển mây bồng bềnh là trải nghiệm để đời! Cáp treo hiện đại và tàu hỏa leo núi Mường Hoa rất đẹp.",
                5, 5, 5, 5, 5, "HDV am hiểu tường tận văn hóa các dân tộc vùng cao Tây Bắc.", "2026-10-24"));
        allReviews.add(createReview("rv_102_02", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "kh007", "Đặng Văn Hùng", 5,
                "Bản Cát Cát thơ mộng với những bộ trang phục dân tộc sặc sỡ và dòng suối Hoa. Khách sạn 4 sao view thung lũng mây trôi trước cửa sổ phòng.",
                5, 5, 5, 5, 5, "HDV hỗ trợ đoàn thuê trang phục dân tộc đẹp và giá rất rẻ.", "2026-10-19"));
        allReviews.add(createReview("rv_102_03", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "kh008", "Bùi Thị Mai", 5,
                "Đèo Ô Quy Hồ chiều tà ngắm hoàng hôn đỏ rực tuyệt đẹp. Đồ nướng Sa Pa và lẩu cá hồi, cá tầm tươi ngọt béo ngậy.",
                5, 4, 5, 5, 5, "HDV dẫn đoàn đến quán đồ nướng ngon chuẩn vị bản địa.", "2026-10-15"));
        allReviews.add(createReview("rv_102_04", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "kh009", "Dương Văn Nam", 4,
                "Xe giường nằm VIP đưa đón êm ái, lịch trình không bị vội vã. Cả gia đình có một chuyến đi nghỉ ngơi đúng nghĩa.",
                4, 5, 4, 4, 5, "Bác tài chạy đèo cẩn thận, không bị say xe chút nào.", "2026-10-10"));
        allReviews.add(createReview("rv_102_05", "102", "Hà Nội – Sa Pa – Fansipan 3N2Đ", "kh010", "Ngô Thị Oanh", 5,
                "HDV Nguyễn Minh Quân am hiểu sâu sắc văn hóa người H'Mông và Dao đỏ, thuyết minh rất lôi cuốn. Đánh giá 5 sao cho đoàn!",
                5, 5, 5, 5, 5, "HDV xuất sắc, kiến thức uyên bác và rất hòa đồng.", "2026-10-05"));

        // ── Tour 103: Hà Giang – Mã Pí Lèng 3N2Đ
        allReviews.add(createReview("rv_103_01", "103", "Hà Giang – Mã Pí Lèng 3N2Đ", "kh011", "Vũ Hoàng Phúc", 5,
                "Hà Giang mùa hoa tam giác mạch đẹp ngỡ ngàng! Đi thuyền trên dòng sông Nho Quế ngắm hẻm vực Tu Sản sâu nhất Đông Nam Á thực sự choáng ngợp.",
                5, 5, 5, 5, 5, "HDV hỗ trợ chụp ảnh hẻm vực Tu Sản góc siêu đỉnh.", "2026-10-25"));
        allReviews.add(createReview("rv_103_02", "103", "Hà Giang – Mã Pí Lèng 3N2Đ", "kh012", "Đinh Tuyết Mai", 5,
                "Đèo Mã Pí Lèng hùng vĩ xứng danh đệ nhất danh đèo miền Bắc. Cột cờ Lũng Cú thiêng liêng nơi địa đầu Tổ quốc khiến cả đoàn xúc động.",
                5, 5, 5, 4, 5, "HDV thuyết minh hào khí lịch sử tại Cột cờ Lũng Cú rất tự hào.", "2026-10-20"));
        allReviews.add(createReview("rv_103_03", "103", "Hà Giang – Mã Pí Lèng 3N2Đ", "kh013", "Lý Gia Hân", 5,
                "Bác tài và HDV tay lái cứng cựa trên từng cung đường đèo quanh co, đi xe rất an tâm. Homestay nhà sàn Đồng Văn ấm cúng, đậm bản sắc dân tộc.",
                5, 5, 4, 5, 5, "Bác tài chạy xe an toàn tuyệt đối, HDV chăm sóc chu đáo.", "2026-10-16"));
        allReviews.add(createReview("rv_103_04", "103", "Hà Giang – Mã Pí Lèng 3N2Đ", "kh014", "Trương Quốc Bảo", 4,
                "Đồ ăn vùng cao như thắng cố, phở chua, thịt trâu gác bếp và cháo ấu tẩu đều rất đặc biệt. Một chuyến đi trải nghiệm tuyệt vời của tuổi trẻ.",
                4, 4, 4, 4, 5, "HDV giới thiệu các món ăn đặc sản vùng cao rất hấp dẫn.", "2026-10-11"));
        allReviews.add(createReview("rv_103_05", "103", "Hà Giang – Mã Pí Lèng 3N2Đ", "kh015", "Cao Thị Ngọc", 5,
                "Chuyến đi để lại ấn tượng sâu đậm nhất từ trước đến nay. Cảm ơn Travel đã tổ chức một tour Hà Giang hoàn hảo từ đầu đến cuối.",
                5, 5, 5, 5, 5, "Dịch vụ xuất sắc, hướng dẫn viên nhiệt tình số 1.", "2026-10-06"));

        // ── Tour 104: Ninh Bình – Tràng An – Bái Đính 1N
        allReviews.add(createReview("rv_104_01", "104", "Ninh Bình – Tràng An – Bái Đính 1N", "kh001", "Nguyễn Hải Đăng", 5,
                "Tour 1 ngày khởi hành từ Hà Nội cực kỳ chất lượng! Quần thể Tràng An non nước hữu tình, ngồi thuyền nan luồn qua các hang động kỳ thú.",
                5, 5, 5, 5, 5, "HDV điều phối đoàn lên thuyền rất trật tự và nhanh chóng.", "2026-10-24"));
        allReviews.add(createReview("rv_104_02", "104", "Ninh Bình – Tràng An – Bái Đính 1N", "kh002", "Trần Mai Anh", 5,
                "Chùa Bái Đính nguy nga tráng lệ, leo lên đỉnh Hang Múa ngắm toàn cảnh Tam Cốc tuyệt đẹp. Bữa trưa dê núi Ninh Bình thịt ngọt và mềm.",
                5, 5, 5, 5, 5, "HDV dẫn đường và chia sẻ nhiều câu chuyện lịch sử thú vị.", "2026-10-19"));
        allReviews.add(createReview("rv_104_03", "104", "Ninh Bình – Tràng An – Bái Đính 1N", "kh003", "Lê Quốc Toàn", 4,
                "Xe đón tận nơi phố cổ, hướng dẫn viên vui tính nhiệt tình, quản lý đoàn chu đáo không bị lạc hay chờ đợi lâu ở bến thuyền.",
                5, 4, 4, 4, 5, "HDV kiểm soát sĩ số rất cẩn thận, không để ai bị tách đoàn.", "2026-10-14"));
        allReviews.add(createReview("rv_104_04", "104", "Ninh Bình – Tràng An – Bái Đính 1N", "kh004", "Phạm Thùy Linh", 5,
                "Chuyến đi thư giãn cuối tuần rất hợp lý cho nhóm bạn hoặc gia đình bận rộn. Giá tour rẻ nhưng dịch vụ đạt chuẩn cao cấp.",
                5, 5, 5, 4, 5, "HDV vui tính, nhiệt tình chụp hình cho các nhóm bạn trẻ.", "2026-10-08"));

        // ── Tour 106: Huế – Di sản Cố Đô 3N2Đ
        allReviews.add(createReview("rv_106_01", "106", "Huế – Di sản Cố Đô 3N2Đ", "kh005", "Vũ Minh Trí", 5,
                "Đại Nội Huế và các lăng Tự Đức, Khải Định cổ kính uy nghiêm. Nghe ca Huế trên thuyền rồng sông Hương lúc hoàng hôn buông xuống rất tao nhã.",
                5, 5, 5, 5, 5, "HDV giọng Huế ngọt ngào, am hiểu lịch sử triều Nguyễn tường tận.", "2026-10-23"));
        allReviews.add(createReview("rv_106_02", "106", "Huế – Di sản Cố Đô 3N2Đ", "kh006", "Đỗ Thu Thảo", 5,
                "Ẩm thực Huế đỉnh cao: cơm hến, bánh bèo, nậm, lọc và bún bò Huế nước dùng đậm đà khó quên. HDV người Huế tận tâm chỉ dẫn các quán ăn ngon chuẩn vị.",
                5, 4, 5, 5, 5, "HDV rất chu đáo trong từng bữa ăn của đoàn.", "2026-10-18"));
        allReviews.add(createReview("rv_106_03", "106", "Huế – Di sản Cố Đô 3N2Đ", "kh007", "Bùi Đức Thịnh", 4,
                "Tour di sản văn hóa rất bổ ích cho các con nhỏ. Khách sạn ven bờ sông Hương tiện nghi, yên tĩnh và thơ mộng.",
                4, 5, 4, 4, 5, "HDV giải thích lịch sử dễ hiểu cho các bạn nhỏ tiếp thu.", "2026-10-13"));
        allReviews.add(createReview("rv_106_04", "106", "Huế – Di sản Cố Đô 3N2Đ", "kh008", "Hoàng Kim Ngân", 5,
                "Khâu tổ chức rất chu đáo, lịch trình tham quan Chùa Thiên Mụ và làng hương Thủy Xuân chụp ảnh nón lá rất đẹp.",
                5, 5, 5, 5, 5, "HDV sắp xếp thời gian hợp lý, không bị mệt mỏi.", "2026-10-07"));

        // ── Tour 109: Miền Tây – Cần Thơ – Cái Răng 2N1Đ
        allReviews.add(createReview("rv_109_01", "109", "Miền Tây – Cần Thơ – Cái Răng 2N1Đ", "kh009", "Đặng Tuấn Kiệt", 5,
                "Chợ nổi Cái Răng tấp nập thuyền bè lúc sáng sớm rộn ràng tiếng rao cây bẹo. Thưởng thức tô hủ tiếu nóng hổi ngay trên ghe là trải nghiệm có một không hai!",
                5, 5, 5, 5, 5, "HDV Trương Gia Huy kể chuyện tiếu lâm duyên dáng, đoàn cười suốt chuyến.", "2026-10-22"));
        allReviews.add(createReview("rv_109_02", "109", "Miền Tây – Cần Thơ – Cái Răng 2N1Đ", "kh010", "Lý Cẩm Tú", 5,
                "Vườn trái cây trĩu quả Phong Điền tự tay hái chôm chôm, sầu riêng ăn tại vườn. Bữa tối du thuyền Bến Ninh Kiều lung linh ánh đèn.",
                5, 5, 5, 5, 5, "HDV chu đáo dẫn đoàn đi thăm vườn trái cây sạch và an toàn.", "2026-10-17"));
        allReviews.add(createReview("rv_109_03", "109", "Miền Tây – Cần Thơ – Cái Răng 2N1Đ", "kh011", "Cao Văn Khánh", 4,
                "Người miền Tây chân chất, mến khách vô cùng. Khách sạn trung tâm Cần Thơ sạch đẹp, buffet sáng nhiều món bánh dân gian ngon lạ miệng.",
                4, 4, 5, 4, 5, "HDV rất thân thiện, hỗ trợ khách nhiệt tình.", "2026-10-12"));
        allReviews.add(createReview("rv_109_04", "109", "Miền Tây – Cần Thơ – Cái Răng 2N1Đ", "kh012", "Dương Ngọc Bích", 5,
                "Tour 2N1Đ nhẹ nhàng, phù hợp đổi gió cuối tuần trốn khỏi ồn ào khói bụi thành phố. Rất hài lòng!",
                5, 5, 5, 4, 5, "Tác phong chuyên nghiệp, phục vụ tận tâm.", "2026-10-06"));

        // ── Tour 110: TP.HCM – Củ Chi – Mekong 1N
        allReviews.add(createReview("rv_110_01", "110", "TP.HCM – Củ Chi – Mekong 1N", "kh013", "Ngô Trọng Hiếu", 5,
                "Hệ thống địa đạo Củ Chi kỳ vĩ minh chứng cho ý chí kiên cường của dân tộc. Bữa trưa ăn khoai mì chấm muối mè thơm lừng.",
                5, 5, 5, 5, 5, "HDV thuyết minh lịch sử chiến khu rất xúc động và chi tiết.", "2026-10-24"));
        allReviews.add(createReview("rv_110_02", "110", "TP.HCM – Củ Chi – Mekong 1N", "kh014", "Phan Thanh Tâm", 5,
                "Lịch trình kết hợp tham quan các biểu tượng TP.HCM như Nhà thờ Đức Bà, Bưu điện Trung tâm và Dinh Độc Lập rất hợp lý cho khách phương xa.",
                5, 4, 5, 5, 5, "HDV điều phối thời gian hợp lý, tránh được tắc đường giờ cao điểm.", "2026-10-18"));
        allReviews.add(createReview("rv_110_03", "110", "TP.HCM – Củ Chi – Mekong 1N", "kh015", "Tạ Hồng Nhung", 4,
                "HDV thuyết minh song ngữ rõ ràng, xe máy lạnh sạch sẽ, đón trả đúng giờ hẹn.",
                5, 4, 4, 4, 4, "HDV ngoại ngữ tốt, hòa đồng và thân thiện.", "2026-10-11"));

        // ── Tour hot07: Ninh Bình – Tuyệt tác sơn thủy
        allReviews.add(createReview("rv_hot07_01", "hot07", "Ninh Bình – Tuyệt tác sơn thủy", "kh001", "Nguyễn Văn An", 5,
                "Chuyến đi Ninh Bình tuyệt vời! Thuyền nan Tam Cốc, Hang Múa và Bái Đính đều rất đẹp, hướng dẫn viên nhiệt tình và vui tính. Gia đình mình rất hài lòng.",
                5, 5, 5, 5, 5, "HDV nhiệt tình, chụp ảnh cho cả đoàn rất đẹp.", "2026-10-22"));
        allReviews.add(createReview("rv_hot07_02", "hot07", "Ninh Bình – Tuyệt tác sơn thủy", "kh002", "Trần Thị Bình", 5,
                "Cảnh đẹp Ninh Bình đúng là non nước hữu tình. Ăn trưa dê núi ngon, xe đưa đón cao cấp sạch sẽ.",
                5, 5, 5, 4, 5, "Tác phong chuyên nghiệp, chu đáo.", "2026-10-16"));
        allReviews.add(createReview("rv_hot07_03", "hot07", "Ninh Bình – Tuyệt tác sơn thủy", "kh003", "Lê Văn Cường", 4,
                "Điểm đến hấp dẫn, dịch vụ tiện nghi. Lịch trình hợp lý không bị mệt.",
                4, 4, 4, 4, 4, "HDV am hiểu địa phương, hướng dẫn nhiệt tình.", "2026-10-10"));

        // ── Tour hot08: Cố đô Huế – Dấu ấn vàng son
        allReviews.add(createReview("rv_hot08_01", "hot08", "Cố đô Huế – Dấu ấn vàng son", "kh004", "Phạm Thị Dung", 5,
                "Tour Huế cổ kính và thơ mộng. Ca Huế trên sông Hương và lăng Khải Định là hai điểm nhấn không thể quên.",
                5, 5, 5, 5, 5, "HDV người Huế thuyết minh rất hay và truyền cảm.", "2026-10-21"));
        allReviews.add(createReview("rv_hot08_02", "hot08", "Cố đô Huế – Dấu ấn vàng son", "kh005", "Hoàng Văn Em", 5,
                "Ẩm thực Huế tuyệt vời, khách sạn sạch đẹp gần sông Hương. Dịch vụ chuyên nghiệp.",
                5, 4, 5, 5, 5, "HDV chu đáo, quan tâm chăm sóc từng bữa ăn cho khách.", "2026-10-15"));
        allReviews.add(createReview("rv_hot08_03", "hot08", "Cố đô Huế – Dấu ấn vàng son", "kh006", "Võ Thị Giang", 4,
                "Lịch trình tham quan hợp lý, thời gian thư thái để cảm nhận vẻ trầm mặc của cố đô.",
                4, 4, 4, 4, 5, "HDV hòa đồng và luôn sẵn lòng giúp đỡ.", "2026-10-09"));

        // ── Tour hot09: Đà Nẵng – Thành phố của những kỳ quan
        allReviews.add(createReview("rv_hot09_01", "hot09", "Đà Nẵng – Thành phố kỳ quan", "kh007", "Đặng Văn Hùng", 5,
                "Chuyến đi Đà Nẵng tuyệt vời! Cầu Vàng Bà Nà, bán đảo Sơn Trà và Cầu Rồng phun lửa đều rất đẹp, hướng dẫn viên nhiệt tình.",
                5, 5, 5, 5, 5, "HDV rất vui vẻ, hỗ trợ chụp hình cho cả đoàn nhiệt tình.", "2026-10-23"));
        allReviews.add(createReview("rv_hot09_02", "hot09", "Đà Nẵng – Thành phố kỳ quan", "kh008", "Bùi Thị Mai", 5,
                "Biển Mỹ Khê tuyệt đẹp, đồ ăn hải sản tươi sống giá cả phải chăng. Khách sạn chuẩn 4 sao tiện nghi.",
                5, 5, 5, 5, 5, "HDV chu đáo, hướng dẫn tỉ mỉ các điểm tham quan.", "2026-10-17"));
        allReviews.add(createReview("rv_hot09_03", "hot09", "Đà Nẵng – Thành phố kỳ quan", "kh009", "Dương Văn Nam", 4,
                "Lịch trình đa dạng, các bữa ăn phong phú hợp khẩu vị. Rất đáng trải nghiệm.",
                4, 5, 4, 4, 4, "HDV nhanh nhẹn, điều phối đoàn tốt.", "2026-10-11"));

        // ── Tour hot10: Sa Pa – Nơi gặp gỡ đất trời
        allReviews.add(createReview("rv_hot10_01", "hot10", "Sa Pa – Nơi gặp gỡ đất trời", "kh010", "Ngô Thị Oanh", 5,
                "Sa Pa ngập tràn mây trắng, đỉnh Fansipan hùng vĩ khiến ai cũng trầm trồ. Thưởng thức đồ nướng Sa Pa thơm phức.",
                5, 5, 5, 5, 5, "HDV kể chuyện bản địa rất hay, nhiệt tình hỗ trợ đoàn.", "2026-10-22"));
        allReviews.add(createReview("rv_hot10_02", "hot10", "Sa Pa – Nơi gặp gỡ đất trời", "kh011", "Vũ Hoàng Phúc", 5,
                "Khách sạn view đẹp nhìn ra thung lũng Mường Hoa, dịch vụ tốt từ xe đưa đón đến bữa ăn.",
                5, 4, 5, 5, 5, "HDV chăm sóc chu đáo, luôn nhắc nhở giữ ấm.", "2026-10-16"));
        allReviews.add(createReview("rv_hot10_03", "hot10", "Sa Pa – Nơi gặp gỡ đất trời", "kh012", "Đinh Tuyết Mai", 4,
                "Cảnh sắc núi rừng Tây Bắc thơ mộng, nhiều góc sống ảo cực chất. Sẽ quay lại vào mùa tuyết.",
                4, 4, 4, 4, 5, "HDV vui tính, nhiệt tình.", "2026-10-10"));

        // ── Tour hot11: Quảng Bình – Chinh phục kỳ quan hang động
        allReviews.add(createReview("rv_hot11_01", "hot11", "Quảng Bình – Chinh phục kỳ quan", "kh013", "Lý Gia Hân", 5,
                "Động Thiên Đường và Hang Tối thực sự là kiệt tác thiên nhiên! Trải nghiệm đu dây zipline và tắm bùn tự nhiên cực kỳ sảng khoái.",
                5, 5, 5, 5, 5, "HDV hỗ trợ khách vượt suối và tắm bùn rất an toàn, nhiệt tình.", "2026-10-21"));
        allReviews.add(createReview("rv_hot11_02", "hot11", "Quảng Bình – Chinh phục kỳ quan", "kh014", "Trương Quốc Bảo", 5,
                "Tour mạo hiểm nhưng rất an toàn, hướng dẫn viên chuyên nghiệp và trang thiết bị đầy đủ. Đồ ăn đặc sản Quảng Bình rất ngon.",
                5, 5, 5, 4, 5, "HDV am hiểu địa hình, hướng dẫn an toàn kỹ lưỡng.", "2026-10-15"));
        allReviews.add(createReview("rv_hot11_03", "hot11", "Quảng Bình – Chinh phục kỳ quan", "kh015", "Cao Thị Ngọc", 4,
                "Chuyến đi khám phá hang động đầy ấn tượng, cảnh quan hoang sơ tráng lệ. Rất đáng thử một lần trong đời.",
                4, 4, 4, 4, 5, "HDV vui tính, chu đáo với mọi thành viên.", "2026-10-09"));

        // Ghi vào dbDir/reviews.json
        File revDbFile = dbDir.resolve("reviews.json").toFile();
        mapper.writeValue(revDbFile, allReviews);
        System.out.println("Written " + allReviews.size() + " rich reviews to storage/db/reviews.json");

        // Ghi vào frontDataDir/reviews-seed.json
        File revSeedFile = frontDataDir.resolve("reviews-seed.json").toFile();
        Map<String, Object> seedRevWrapper = new LinkedHashMap<>();
        seedRevWrapper.put("_note", "BÌNH LUẬN VÀ ĐÁNH GIÁ CHẤT LƯỢNG CAO CHO TOÀN BỘ CÁC TOUR TRONG HỆ THỐNG.");
        seedRevWrapper.put("reviews", allReviews);
        mapper.writeValue(revSeedFile, seedRevWrapper);
        System.out.println("Written " + allReviews.size() + " rich reviews to frontend/data/reviews-seed.json");
    }
}
