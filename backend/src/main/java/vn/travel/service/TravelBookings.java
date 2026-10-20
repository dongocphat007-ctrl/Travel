package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.time.Clock;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Đặt chuyến bay / khách sạn: lưu chung vào bookings.json (kind = "flight" | "hotel") để dùng lại toàn bộ luồng sẵn có:
 * mã chuyển khoản (payCode), webhook ngân hàng, xác nhận tay, hủy, thông báo, trang "Đơn của tôi" và Admin.
 * Giá do server tính từ danh mục; thanh toán một lần 100% (deposit = price, payChoice = "full").
 */
@Service
public class TravelBookings {
    private static final Pattern PHONE = Pattern.compile("^(0|\\+84)(3|5|7|8|9)[0-9]{8}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final Db db;
    private final Inventory inventory;
    private final Notifications noti;
    private final Clock clock;
    private final String payPrefix;

    public TravelBookings(Db db, Inventory inventory, Notifications noti, Clock clock, TravelProperties props) {
        this.db = db;
        this.inventory = inventory;
        this.noti = noti;
        this.clock = clock;
        this.payPrefix = props.prefix();
    }

    private record Contact(String name, String phone, String email, String note) { }

    private static Contact contact(Map<String, Object> in) {
        String name = Maps.str(in, "customerName").trim();
        if (name.length() < 2 || name.length() > 100) throw HttpError.bad("Vui lòng nhập họ tên", "customerName");
        String phone = Maps.str(in, "phone").replaceAll("[\\s.\\-]", "");
        if (!PHONE.matcher(phone).matches()) throw HttpError.bad("Số điện thoại không hợp lệ", "phone");
        String email = Maps.str(in, "email").trim();
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) throw HttpError.bad("Email không hợp lệ", "email");
        String note = Maps.str(in, "note").trim();
        return new Contact(name, phone, email, note.length() > 1000 ? note.substring(0, 1000) : note);
    }

    public Map<String, Object> bookFlight(Map<String, Object> user, Map<String, Object> in) {
        Contact c = contact(in);
        Map<String, Object> o = inventory.flightOffer(Maps.str(in, "flightId"), Maps.str(in, "date"), in.get("pax"), in.get("cabin"));
        int pax = (int) Maps.lng(o, "pax");
        List<String> names = new ArrayList<>();
        for (Object n : Maps.list(in.get("passengers"))) { String s = String.valueOf(n).trim(); if (!s.isEmpty()) names.add(s.length() > 100 ? s.substring(0, 100) : s); }
        if (names.size() > pax) throw HttpError.bad("Số tên hành khách nhiều hơn số vé", "passengers");
        String title = "Vé máy bay " + o.get("flightNo") + " " + o.get("fromCity") + " → " + o.get("toCity");
        long price = Maps.lng(o, "price");
        return save(user, c, "flight", title, Maps.str(o, "toCity"), Maps.str(o, "date"), pax, price, Maps.of("flight", o, "passengers", names, "base", price, "final", price, "deposit", price, "depositPct", 100));
    }

    public Map<String, Object> bookHotel(Map<String, Object> user, Map<String, Object> in) {
        Contact c = contact(in);
        Map<String, Object> r = inventory.hotelQuote(Maps.str(in, "hotelId"), Maps.str(in, "roomType"), Maps.str(in, "checkin"), Maps.str(in, "checkout"), in.get("guests"), in.get("rooms"));
        Map<String, Object> h = Maps.map(r.get("hotel")), q = Maps.map(r.get("quote"));
        long price = Maps.lng(q, "total");
        int guests = vn.travel.util.TravelInventory.intIn(in.get("guests"), 2, 1, 20);
        String title = "Khách sạn " + h.get("name") + " – " + q.get("type") + " × " + q.get("rooms") + " phòng, " + q.get("nights") + " đêm";
        Map<String, Object> detail = Maps.of("hotelId", h.get("id"), "hotelName", h.get("name"), "stars", h.get("stars"), "address", h.get("address"), "refundable", h.get("refundable"),
                "checkin", r.get("checkin"), "checkout", r.get("checkout"), "guests", guests, "quote", q, "base", price, "final", price, "deposit", price, "depositPct", 100);
        return save(user, c, "hotel", title, Maps.str(h, "city"), Maps.str(r, "checkin"), guests, price, Map.of("hotel", detail));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> save(Map<String, Object> user, Contact c, String kind, String title, String dest, String date, int pax, long price, Map<String, Object> detail) {
        Map<String, Object>[] out = new Map[1];
        String uid = Maps.str(user, "id");
        db.edit("bookings", all -> {
            Set<String> ids = new HashSet<>();
            all.forEach(x -> ids.add(Maps.str(x, "id")));
            long seq = clock.millis();
            while (ids.contains("bk_" + seq)) seq++;
            String id = "bk_" + seq;
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("id", id);
            b.put("payCode", payPrefix + id.replaceAll("\\D", ""));
            b.put("kind", kind);
            b.put("depositPaid", false);
            b.put("tourId", null);
            b.put("tourName", title);
            b.put("tourDest", dest);
            b.put("userId", uid);
            b.put("userEmail", Maps.str(user, "email"));
            b.put("customerName", c.name());
            b.put("phone", c.phone());
            b.put("email", c.email());
            b.put("date", date);
            b.put("pax", pax);
            b.put("note", c.note());
            b.put("price", price);
            b.put("deposit", price);
            b.put("depositPercent", 100);
            b.put("payChoice", "full");
            b.put("priceBreakdown", Maps.of("base", price, "final", price, "deposit", price, "depositPct", 100, "pax", pax));
            b.putAll(detail);
            b.put("status", "pending");
            b.put("createdAt", Times.iso(clock.millis()));
            all.add(b);
            out[0] = b;
        });
        Map<String, Object> b = out[0];
        noti.add(uid, "booking", "🧳 Đã nhận yêu cầu đặt " + ("flight".equals(kind) ? "vé máy bay" : "phòng"),
                "Đơn " + b.get("id") + " – " + title + ". Vui lòng chuyển khoản " + price + " ₫ với nội dung " + b.get("payCode") + ".", "profile", "bk-" + b.get("id"));
        return b;
    }
}
