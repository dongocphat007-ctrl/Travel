package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Maps;
import vn.travel.util.Pricing;
import vn.travel.util.Times;
import vn.travel.util.TravelInventory;
import vn.travel.web.HttpError;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

/**
 * Danh mục chuyến bay / khách sạn nằm ở server (storage/db/{airports,flights,hotels}.json). Lần chạy đầu nạp từ resource seed/*.json;
 * sau đó Admin cập nhật qua /api/admin/inventory/{tên}/sync. Giá luôn do server tính (util.TravelInventory).
 */
@Service
public class Inventory {
    public static final Set<String> COLLECTIONS = Set.of("airports", "flights", "hotels");
    private final Db db;
    private final Clock clock;

    public Inventory(Db db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    private synchronized List<Map<String, Object>> coll(String name) {
        if (!Files.exists(db.store().dir().resolve(name + ".json"))) {
            try (java.io.InputStream in = Inventory.class.getResourceAsStream("/seed/" + name + ".json")) {
                if (in != null) {
                    List<Map<String, Object>> seed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(in, Db.LIST);
                    db.edit(name, all -> { if (all.isEmpty()) all.addAll(seed); });
                }
            } catch (IOException e) { throw new UncheckedIOException(e); }
        }
        return db.list(name);
    }

    public LocalDate today() { return Times.todayVN(clock.millis()); }
    public List<Map<String, Object>> airports() { return coll("airports"); }
    public List<Map<String, Object>> flights() { return coll("flights"); }
    public List<Map<String, Object>> hotels() { return coll("hotels"); }

    public List<String> cities() {
        TreeSet<String> s = new TreeSet<>();
        for (Map<String, Object> h : hotels()) if (!Maps.str(h, "city").isEmpty()) s.add(Maps.str(h, "city"));
        return new ArrayList<>(s);
    }

    // ───────── tìm kiếm ─────────
    public Map<String, Object> searchFlights(String from, String to, String date, Object pax, Object cabin) {
        List<Map<String, Object>> ap = airports();
        String f = TravelInventory.airportCode(ap, from), t = TravelInventory.airportCode(ap, to);
        if (f == null) throw HttpError.bad("Không tìm thấy sân bay khởi hành \"" + (from == null ? "" : from) + "\"", "from");
        if (t == null) throw HttpError.bad("Không tìm thấy sân bay đến \"" + (to == null ? "" : to) + "\"", "to");
        if (f.equals(t)) throw HttpError.bad("Điểm đi và điểm đến phải khác nhau", "to");
        LocalDate d = checkDate(date, 0, "date", "Vui lòng chọn ngày đi");
        int p = TravelInventory.intIn(pax, 1, 1, TravelInventory.MAX_PAX);
        String c = TravelInventory.cabin(cabin);
        List<Map<String, Object>> list = TravelInventory.searchFlights(ap, flights(), f, t, d, p, c, today());
        return Maps.of("ok", true, "from", f, "to", t, "date", d.toString(), "pax", p, "cabin", c, "flights", list,
                "source", "catalog", "note", "Giá niêm yết theo danh mục của Travel (đã gồm thuế phí); chỗ ngồi được xác nhận sau khi thanh toán.");
    }

    public Map<String, Object> searchHotels(String dest, String checkin, String checkout, Object guests, Object stars) {
        LocalDate in = checkDate(checkin, 0, "checkin", "Vui lòng chọn ngày nhận phòng"), out = checkDate(checkout, 0, "checkout", "Vui lòng chọn ngày trả phòng");
        checkStay(in, out);
        int g = TravelInventory.intIn(guests, 2, 1, 20);
        int s = "any".equals(String.valueOf(stars)) ? 0 : TravelInventory.intIn(stars, 0, 0, 5);
        List<Map<String, Object>> list = TravelInventory.searchHotels(hotels(), dest, in, out, g, s);
        return Maps.of("ok", true, "dest", dest == null ? "" : dest, "checkin", in.toString(), "checkout", out.toString(), "guests", g, "hotels", list,
                "source", "catalog", "note", "Giá phòng niêm yết theo danh mục của Travel; đêm thứ Sáu/Bảy phụ thu 15%.");
    }

    // ───────── định giá cho đặt chỗ (server tính, không tin client) ─────────
    public Map<String, Object> flightOffer(String flightId, String date, Object pax, Object cabin) {
        Map<String, Object> f = find(flights(), flightId);
        if (f == null) throw HttpError.notFound("Không tìm thấy chuyến bay");
        LocalDate d = checkDate(date, 1, "date", "Vui lòng chọn ngày bay");
        Map<String, Object> o = TravelInventory.flightOffer(airports(), f, d, TravelInventory.intIn(pax, 1, 1, TravelInventory.MAX_PAX), TravelInventory.cabin(cabin), today());
        if (o == null) throw HttpError.conflict("Chuyến bay này không khai thác vào ngày " + d, "date");
        return o;
    }

    public Map<String, Object> hotelQuote(String hotelId, String roomType, String checkin, String checkout, Object guests, Object rooms) {
        Map<String, Object> h = find(hotels(), hotelId);
        if (h == null) throw HttpError.notFound("Không tìm thấy khách sạn");
        LocalDate in = checkDate(checkin, 1, "checkin", "Vui lòng chọn ngày nhận phòng"), out = checkDate(checkout, 1, "checkout", "Vui lòng chọn ngày trả phòng");
        checkStay(in, out);
        Map<String, Object> q = TravelInventory.roomQuote(h, roomType, in, out, TravelInventory.intIn(guests, 2, 1, 20), TravelInventory.intIn(rooms, 1, 1, 10));
        if (q == null) throw HttpError.bad("Loại phòng không tồn tại", "roomType");
        return Maps.of("hotel", h, "quote", q, "checkin", in.toString(), "checkout", out.toString());
    }

    private static Map<String, Object> find(List<Map<String, Object>> l, String id) {
        for (Map<String, Object> m : l) if (Maps.str(m, "id").equals(id)) return m;
        return null;
    }

    private LocalDate checkDate(String s, int minDaysAhead, String field, String msg) {
        LocalDate d = TravelInventory.date(s);
        if (d == null) throw HttpError.bad(msg, field);
        LocalDate earliest = today().plusDays(minDaysAhead);
        if (d.isBefore(earliest)) throw HttpError.bad(minDaysAhead == 0 ? "Không chọn được ngày trong quá khứ" : "Phải đặt trước ít nhất " + minDaysAhead + " ngày (chọn từ " + earliest + " trở đi)", field);
        if (d.isAfter(today().plusDays(365))) throw HttpError.bad("Chỉ nhận đặt trong vòng 12 tháng tới", field);
        return d;
    }

    private static void checkStay(LocalDate in, LocalDate out) {
        if (!out.isAfter(in)) throw HttpError.bad("Ngày trả phòng phải sau ngày nhận phòng", "checkout");
        if (java.time.temporal.ChronoUnit.DAYS.between(in, out) > TravelInventory.MAX_NIGHTS) throw HttpError.bad("Tối đa " + TravelInventory.MAX_NIGHTS + " đêm mỗi lần đặt", "checkout");
    }

    // ───────── Admin: thay toàn bộ danh mục ─────────
    public int replace(String name, List<?> in) {
        if (!COLLECTIONS.contains(name)) throw HttpError.notFound("Danh mục không tồn tại");
        if (in.size() > 5000) throw HttpError.bad("Quá nhiều dòng");
        List<Map<String, Object>> clean = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (Object o : in) {
            Map<String, Object> m = Maps.map(o);
            if (m == null) continue;
            String key = "airports".equals(name) ? "code" : "id";
            if (Maps.str(m, key).isEmpty()) throw HttpError.bad("Thiếu trường " + key);
            if (!ids.add(Maps.str(m, key))) throw HttpError.bad("Trùng " + key + ": " + Maps.str(m, key));
            if ("flights".equals(name) && (Pricing.num(m.get("baseFare")) <= 0 || Maps.str(m, "from").isEmpty() || Maps.str(m, "to").isEmpty() || Maps.str(m, "depart").matches("\\d{2}:\\d{2}") == false))
                throw HttpError.bad("Chuyến bay " + Maps.str(m, "id") + " thiếu from/to/depart(HH:mm)/baseFare");
            if ("hotels".equals(name) && Maps.list(m.get("rooms")).isEmpty()) throw HttpError.bad("Khách sạn " + Maps.str(m, "id") + " chưa có loại phòng");
            clean.add(m);
        }
        db.update(name, old -> clean);
        return clean.size();
    }
}
