package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.Inventory;
import vn.travel.service.TravelBookings;
import vn.travel.util.Maps;

import java.util.List;
import java.util.Map;

/** Chuyến bay & khách sạn: tìm kiếm công khai (giá do server tính); đặt chỗ cần đăng nhập; Admin thay danh mục. */
@RestController
public class TravelController {
    private final Inventory inventory;
    private final TravelBookings travel;
    private final CurrentUser current;

    public TravelController(Inventory inventory, TravelBookings travel, CurrentUser current) {
        this.inventory = inventory;
        this.travel = travel;
        this.current = current;
    }

    private static Map<String, Object> b(Map<String, Object> body) { return body == null ? Map.of() : body; }

    @GetMapping("/api/travel/airports")
    public Map<String, Object> airports() {
        return Maps.of("ok", true, "airports", inventory.airports(), "cities", inventory.cities());
    }

    @GetMapping("/api/flights/search")
    public Map<String, Object> flights(@RequestParam(required = false) String from, @RequestParam(required = false) String to, @RequestParam(required = false) String date,
                                       @RequestParam(required = false) String pax, @RequestParam(required = false) String cabin) {
        return inventory.searchFlights(from, to, date, pax, cabin);
    }

    @GetMapping("/api/hotels/search")
    public Map<String, Object> hotels(@RequestParam(required = false) String dest, @RequestParam(required = false) String checkin, @RequestParam(required = false) String checkout,
                                      @RequestParam(required = false) String guests, @RequestParam(required = false) String stars) {
        return inventory.searchHotels(dest, checkin, checkout, guests, stars);
    }

    @PostMapping("/api/bookings/flight")
    public Map<String, Object> bookFlight(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", travel.bookFlight(current.require(req), b(body)));
    }

    @PostMapping("/api/bookings/hotel")
    public Map<String, Object> bookHotel(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "booking", travel.bookHotel(current.require(req), b(body)));
    }

    /** Thay toàn bộ danh mục: name = airports | flights | hotels; body { items: [...] }. */
    @PostMapping("/api/admin/inventory/{name}/sync")
    public Map<String, Object> sync(@PathVariable String name, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        current.requireAdmin(req);
        List<?> items = b(body).get("items") instanceof List<?> l ? l : List.of();
        return Maps.of("ok", true, "count", inventory.replace(name, items));
    }
}
