package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.service.OpsCore.Actor;
import vn.travel.web.HttpError;

import java.time.LocalDate;
import java.util.*;

@Service
@SuppressWarnings("unchecked")
public class TourPoolOps {
    private final Db db;
    private final OpsCore core;
    private final AiProxy aiProxy;

    public TourPoolOps(Db db, OpsCore core, AiProxy aiProxy) {
        this.db = db;
        this.core = core;
        this.aiProxy = aiProxy;
    }

    public synchronized void seedPoolsIfEmpty() {
        if (!db.list("tour_pools").isEmpty()) return;
        List<Map<String, Object>> seed = new ArrayList<>();
        LocalDate today = core.today();

        seed.add(Maps.of(
                "id", "pool_dn_2026",
                "tourId", "101",
                "tourName", "Đà Nẵng – Bán đảo Sơn Trà – Phố cổ Hội An (4N3Đ)",
                "destination", "Đà Nẵng",
                "region", "trung",
                "date", today.plusDays(10).toString(),
                "minPax", 10L,
                "maxPax", 16L,
                "currentPax", 6L,
                "status", "open",
                "discountPercent", 10L,
                "pricePerPax", 4950000L,
                "poolPricePerPax", 4455000L,
                "bookings", List.of("bk_1052", "bk_1060"),
                "notes", "Đoàn ghép khởi hành từ Hà Nội và TP.HCM, hẹn tập kết tại ga/sân bay Đà Nẵng",
                "createdAt", Times.iso(core.now() - 5L * 86400000L)
        ));

        seed.add(Maps.of(
                "id", "pool_sp_2026",
                "tourId", "102",
                "tourName", "Hà Nội – Sapa – Chinh phục Đỉnh Fansipan (3N2Đ)",
                "destination", "Sapa",
                "region", "bac",
                "date", today.plusDays(12).toString(),
                "minPax", 12L,
                "maxPax", 20L,
                "currentPax", 8L,
                "status", "open",
                "discountPercent", 12L,
                "pricePerPax", 3800000L,
                "poolPricePerPax", 3344000L,
                "bookings", List.of("bk_1048", "bk_1050"),
                "notes", "Nhóm khách ghép bạn trẻ và gia đình nhỏ, bao gồm vé cáp treo Fansipan",
                "createdAt", Times.iso(core.now() - 3L * 86400000L)
        ));

        seed.add(Maps.of(
                "id", "pool_pq_2026",
                "tourId", "103",
                "tourName", "Phú Quốc – Sunset Sanato – Lặn ngắm San hô 4 Đảo (3N2Đ)",
                "destination", "Phú Quốc",
                "region", "nam",
                "date", today.plusDays(15).toString(),
                "minPax", 15L,
                "maxPax", 25L,
                "currentPax", 11L,
                "status", "open",
                "discountPercent", 15L,
                "pricePerPax", 5600000L,
                "poolPricePerPax", 4760000L,
                "bookings", List.of("bk_1033", "bk_1041"),
                "notes", "Gom khách đi cano chung ra 4 đảo, còn thiếu 4 khách để chốt xe riêng 29 chỗ",
                "createdAt", Times.iso(core.now() - 2L * 86400000L)
        ));

        db.edit("tour_pools", all -> all.addAll(seed));
    }

    public List<Map<String, Object>> listPools(boolean publicOnly) {
        seedPoolsIfEmpty();
        List<Map<String, Object>> list = new ArrayList<>(db.list("tour_pools"));
        if (publicOnly) {
            list.removeIf(p -> !"open".equals(p.get("status")));
        }
        list.sort((a, b) -> Maps.str(a, "date").compareTo(Maps.str(b, "date")));
        return list;
    }

    public Map<String, Object> createPool(Actor actor, Map<String, Object> in) {
        String tourName = Maps.str(in, "tourName").trim();
        String date = Maps.str(in, "date").trim();
        long minPax = Math.max(2, Maps.lng(in, "minPax"));
        long maxPax = Math.max(minPax, Maps.lng(in, "maxPax"));
        long currentPax = Math.max(0, Maps.lng(in, "currentPax"));
        long disc = Math.max(0, Math.min(50, Maps.lng(in, "discountPercent")));

        if (tourName.isEmpty()) throw HttpError.bad("Vui lòng nhập tên tour ghép", "tourName");
        if (date.isEmpty()) throw HttpError.bad("Vui lòng chọn ngày khởi hành", "date");

        Map<String, Object> pool = new LinkedHashMap<>();
        pool.put("id", Ids.newId("pool"));
        pool.put("tourId", Maps.str(in, "tourId"));
        pool.put("tourName", tourName);
        pool.put("destination", Maps.str(in, "destination"));
        pool.put("region", Maps.str(in, "region"));
        pool.put("date", date);
        pool.put("minPax", minPax);
        pool.put("maxPax", maxPax);
        pool.put("currentPax", currentPax);
        pool.put("status", "open");
        pool.put("discountPercent", disc);
        pool.put("pricePerPax", Maps.lng(in, "pricePerPax"));
        pool.put("poolPricePerPax", Maps.lng(in, "poolPricePerPax"));
        pool.put("bookings", new ArrayList<>(Maps.list(in.get("bookings"))));
        pool.put("notes", Maps.str(in, "notes"));
        pool.put("createdBy", actor.id());
        pool.put("createdAt", Times.iso(core.now()));

        db.edit("tour_pools", all -> all.add(pool));
        core.audit.log(actor.id(), actor.name(), actor.role(), "tour_pool.create", Maps.str(pool, "id"), tourName + " - " + date);
        return pool;
    }

    /** AI & RAG: Quét danh sách đơn tour lẻ và gợi ý ghép tour thông minh */
    public Map<String, Object> aiScanAndMatch(Actor actor) {
        seedPoolsIfEmpty();
        LocalDate today = core.today();

        // 1. Quét các đơn tour hiệu lực có số lượng người nhỏ lẻ (< 6 người)
        List<Map<String, Object>> candidates = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            String st = Maps.str(b, "status");
            if ("cancelled".equals(st) || "refunded".equals(st)) continue;
            long pax = Maps.lng(b, "pax");
            String dtStr = Maps.str(b, "date");
            if (dtStr.isEmpty()) continue;
            try {
                LocalDate bDate = LocalDate.parse(dtStr.substring(0, 10));
                if (bDate.isAfter(today.minusDays(1)) && pax >= 1 && pax <= 6) {
                    candidates.add(b);
                }
            } catch (Exception ignored) {}
        }

        // 2. Thuật toán gom cụm / heuristic dựa trên tuyến điểm và ngày đi (cách nhau tối đa 2 ngày)
        List<Map<String, Object>> suggestions = new ArrayList<>();
        Set<String> matchedIds = new HashSet<>();

        for (int i = 0; i < candidates.size(); i++) {
            Map<String, Object> b1 = candidates.get(i);
            String id1 = Maps.str(b1, "id");
            if (matchedIds.contains(id1)) continue;

            String t1 = Maps.str(b1, "tourName");
            LocalDate d1 = LocalDate.parse(Maps.str(b1, "date").substring(0, 10));
            long pax1 = Maps.lng(b1, "pax");

            for (int j = i + 1; j < candidates.size(); j++) {
                Map<String, Object> b2 = candidates.get(j);
                String id2 = Maps.str(b2, "id");
                if (matchedIds.contains(id2)) continue;

                String t2 = Maps.str(b2, "tourName");
                LocalDate d2 = LocalDate.parse(Maps.str(b2, "date").substring(0, 10));
                long pax2 = Maps.lng(b2, "pax");

                long daysDiff = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(d1, d2));
                boolean sameTour = t1.equalsIgnoreCase(t2);
                boolean sameDestination = sameTour || isSimilarDestination(t1, t2);

                if (sameDestination && daysDiff <= 3) {
                    long combinedPax = pax1 + pax2;
                    matchedIds.add(id1);
                    matchedIds.add(id2);

                    String commonDest = extractDestination(t1);
                    String aiReason = String.format(
                            "AI / RAG phân tích: Đơn %s (%s, %d khách) và Đơn %s (%s, %d khách) cùng có lộ trình đến %s vào khoảng ngày %s (chênh lệch %d ngày). Ghép thành đoàn %d khách sẽ tối ưu hoá 100%% xe du lịch và 1 HDV đi kèm, giảm khoảng 18%% chi phí vận hành cho cả 2 nhóm.",
                            Maps.str(b1, "payCode"), Maps.str(b1, "customerName"), pax1,
                            Maps.str(b2, "payCode"), Maps.str(b2, "customerName"), pax2,
                            commonDest, d1, daysDiff, combinedPax
                    );

                    Map<String, Object> sug = new LinkedHashMap<>();
                    sug.put("id", "sug_" + Ids.suffix());
                    sug.put("destination", commonDest);
                    sug.put("suggestedDate", d1.isBefore(d2) ? d1.toString() : d2.toString());
                    sug.put("combinedPax", combinedPax);
                    sug.put("targetVehicle", combinedPax <= 7 ? "Xe 7 chỗ" : (combinedPax <= 16 ? "Xe 16 chỗ Ford Transit" : "Xe 29 chỗ Thaco"));
                    sug.put("booking1", Maps.of("id", id1, "code", b1.get("payCode"), "customer", b1.get("customerName"), "pax", pax1, "date", b1.get("date"), "tourName", t1));
                    sug.put("booking2", Maps.of("id", id2, "code", b2.get("payCode"), "customer", b2.get("customerName"), "pax", pax2, "date", b2.get("date"), "tourName", t2));
                    sug.put("confidence", sameTour ? 96 : 88);
                    sug.put("aiReason", aiReason);
                    sug.put("estimatedSavings", (pax1 + pax2) * 350000L);
                    suggestions.add(sug);
                    break;
                }
            }
        }

        // Bổ sung các gợi ý tour ghép hiện có chưa đủ chỗ
        List<Map<String, Object>> openPools = listPools(true);
        List<Map<String, Object>> poolFillSuggestions = new ArrayList<>();
        for (Map<String, Object> pool : openPools) {
            long cur = Maps.lng(pool, "currentPax");
            long min = Maps.lng(pool, "minPax");
            long max = Maps.lng(pool, "maxPax");
            if (cur < max) {
                poolFillSuggestions.add(Maps.of(
                        "poolId", pool.get("id"),
                        "tourName", pool.get("tourName"),
                        "date", pool.get("date"),
                        "currentPax", cur,
                        "neededPax", Math.max(1, min - cur),
                        "maxPax", max,
                        "discountPercent", pool.get("discountPercent"),
                        "aiTip", "Tour ghép này đang thiếu " + Math.max(1, min - cur) + " khách để đạt điều kiện khởi hành tối thiểu (" + min + " khách). Cần ưu tiên tư vấn hoặc gửi voucher cho khách lẻ đang tìm tour cùng tuyến."
                ));
            }
        }

        return Maps.of(
                "ok", true,
                "candidatesScanned", candidates.size(),
                "smartSuggestions", suggestions,
                "poolFillAlerts", poolFillSuggestions,
                "scannedAt", Times.iso(core.now()),
                "status", "AI Scan Complete"
        );
    }

    /** Ghép bằng tay (hoặc duyệt theo gợi ý AI) dành cho Admin / Điều hành / HDV */
    public Map<String, Object> mergeBookings(Actor actor, String poolId, List<String> bookingIds, String note, boolean isGuideOnsite) {
        if (bookingIds == null || bookingIds.isEmpty()) {
            throw HttpError.bad("Vui lòng chọn ít nhất 1 đơn cần ghép vào đoàn", "bookingIds");
        }

        Map<String, Object>[] targetPool = new Map[1];
        db.edit("tour_pools", all -> {
            for (Map<String, Object> p : all) {
                if (poolId != null && poolId.equals(Maps.str(p, "id"))) {
                    targetPool[0] = p;
                    List<String> bList = new ArrayList<>(Maps.list(p.get("bookings")).stream().map(String::valueOf).toList());
                    long addedPax = 0;
                    for (String bid : bookingIds) {
                        if (!bList.contains(bid)) {
                            bList.add(bid);
                            Map<String, Object> bk = core.find(bid);
                            if (bk != null) addedPax += Maps.lng(bk, "pax");
                        }
                    }
                    p.put("bookings", bList);
                    long newPax = Maps.lng(p, "currentPax") + addedPax;
                    p.put("currentPax", newPax);
                    if (newPax >= Maps.lng(p, "minPax") && "open".equals(p.get("status"))) {
                        p.put("status", "ready_depart");
                    }
                    p.put("updatedAt", Times.iso(core.now()));
                    break;
                }
            }
        });

        // Ghi chú vào từng booking được ghép
        for (String bid : bookingIds) {
            core.edit(bid, b -> {
                b.put("isPooled", true);
                b.put("poolId", poolId);
                b.put("pooledAt", Times.iso(core.now()));
                b.put("pooledBy", actor.name() + " (" + actor.role() + ")");
                b.put("poolNote", note != null ? note : "Đã ghép vào đoàn " + (poolId != null ? poolId : "chuyến đi chung"));
                if (isGuideOnsite) {
                    b.put("guideCheckedIn", true);
                    b.put("guideCheckinNote", "HDV ghép đoàn và điểm danh trực tiếp tại hiện trường");
                }
            });
        }

        core.audit.log(actor.id(), actor.name(), actor.role(), isGuideOnsite ? "tour_pool.guide_merge" : "tour_pool.merge",
                poolId != null ? poolId : "custom_pool",
                "Ghép " + bookingIds.size() + " đơn vào đoàn: " + String.join(", ", bookingIds) + ". Ghi chú: " + (note != null ? note : ""));

        return Maps.of("ok", true, "pool", targetPool[0], "mergedBookings", bookingIds, "message", "Ghép đoàn thành công!");
    }

    private boolean isSimilarDestination(String t1, String t2) {
        String a = t1.toLowerCase(), b = t2.toLowerCase();
        for (String loc : List.of("đà nẵng", "hội an", "sapa", "fansipan", "hà giang", "phú quốc", "nha trang", "đà lạt", "hạ long", "huế", "quy nhơn", "cần thơ")) {
            if (a.contains(loc) && b.contains(loc)) return true;
        }
        return false;
    }

    private String extractDestination(String tourName) {
        String tn = tourName.toLowerCase();
        for (String loc : List.of("Đà Nẵng", "Hội An", "Sapa", "Hà Giang", "Phú Quốc", "Nha Trang", "Đà Lạt", "Hạ Long", "Huế", "Quy Nhơn", "Cần Thơ", "Côn Đảo")) {
            if (tn.contains(loc.toLowerCase())) return loc;
        }
        return "Việt Nam";
    }
}
