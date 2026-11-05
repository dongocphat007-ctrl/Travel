package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Giai đoạn 9: lịch khởi hành, chỗ còn lại, chống đặt trùng chỗ cuối, hành khách theo độ tuổi, danh sách chờ. */
@SuppressWarnings("unchecked")
class DepartureRulesTest {
    static final Actor ADMIN = new Actor("ad001", "Quản trị", "ADMIN");
    static final Actor OPERATOR = new Actor("dh001", "Điều hành", "OPERATOR");
    static final String DAY = "2026-11-10";   // đồng hồ giả của Fixture: 01/11/2026

    private static Map<String, Object> req(String date, int adults, int kids, int infants) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tourId", "101"); m.put("customerName", "Nguyễn Văn A"); m.put("phone", "0901234567"); m.put("email", "");
        m.put("date", date); m.put("adults", adults); m.put("kids", kids); m.put("infants", infants);
        return m;
    }

    private static Map<String, Object> p(String name, String dob) {
        return Maps.of("name", name, "dob", dob, "gender", "female", "idNumber", "079090123456");
    }

    private static int code(Runnable r) { return assertThrows(HttpError.class, r::run).status(); }

    // ───────── 9.4, 9.5: hành khách và độ tuổi ─────────
    @Test void passengersMustMatchCountsAndBirthDates(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");

        Map<String, Object> ok = req(DAY, 1, 1, 1);
        ok.put("passengers", List.of(p("Mẹ", "1990-03-03"), p("Bé lớn", "2018-05-05"), p("Bé nhỏ", "2024-02-02")));   // 36 / 8 / 2 tuổi tại 10/11/2026
        Map<String, Object> b = f.bookings.create(user, ok);
        assertEquals(3, Maps.list(b.get("passengers")).size());
        assertEquals(1L, Maps.lng(b, "infants"));

        Map<String, Object> wrongAge = req(DAY, 2, 0, 0);   // khai 2 người lớn nhưng một người sinh 2018
        wrongAge.put("passengers", List.of(p("A", "1990-03-03"), p("B", "2018-05-05")));
        HttpError e = assertThrows(HttpError.class, () -> f.bookings.create(user, wrongAge));
        assertEquals(400, e.status());
        assertEquals("passengers", e.field());

        Map<String, Object> missing = req(DAY, 2, 0, 0);    // khai 2 người nhưng chỉ có 1 hành khách
        missing.put("passengers", List.of(p("A", "1990-03-03")));
        assertEquals(400, code(() -> f.bookings.create(user, missing)));

        Map<String, Object> noDob = req(DAY, 1, 0, 0);
        noDob.put("passengers", List.of(p("A", "")));
        assertEquals(400, code(() -> f.bookings.create(user, noDob)), "thiếu ngày sinh");

        Map<String, Object> future = req(DAY, 1, 0, 0);
        future.put("passengers", List.of(p("A", "2030-01-01")));
        assertEquals(400, code(() -> f.bookings.create(user, future)), "sinh sau ngày khởi hành");

        Map<String, Object> noName = req(DAY, 1, 0, 0);
        noName.put("passengers", List.of(p("", "1990-03-03")));
        assertEquals(400, code(() -> f.bookings.create(user, noName)), "thiếu họ tên");
    }

    @Test void ageIsMeasuredOnDepartureDateNotBookingDate(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        // sinh 11/11/2015: ngày 10/11/2026 vẫn 10 tuổi (trẻ em), đến 11/11/2026 mới tròn 11 tuổi (người lớn)
        Map<String, Object> child = req(DAY, 1, 1, 0);
        child.put("passengers", List.of(p("Mẹ", "1990-03-03"), p("Bé", "2015-11-11")));
        assertNotNull(f.bookings.create(user, child));
        Map<String, Object> adult = req("2026-11-11", 2, 0, 0);
        adult.put("passengers", List.of(p("Mẹ", "1990-03-03"), p("Bé", "2015-11-11")));
        assertNotNull(f.bookings.create(user, adult));
    }

    @Test void secondBabyOfSameAdultCountsAsChildLikePricing(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        Map<String, Object> in = req(DAY, 1, 0, 2);   // 1 người lớn + 2 em bé → Pricing: 1 bé miễn phí, bé thứ hai tính trẻ em
        in.put("passengers", List.of(p("Mẹ", "1990-03-03"), p("Bé 1", "2024-02-02"), p("Bé 2", "2025-03-03")));
        Map<String, Object> b = f.bookings.create(user, in);
        assertEquals(1L, Maps.lng(b, "children"));
        assertEquals(1L, Maps.lng(b, "infants"));
    }

    @Test void bookingWithoutPassengerListStillWorks(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), req(DAY, 2, 0, 0));
        assertTrue(Maps.list(b.get("passengers")).isEmpty());
    }

    @Test void customerSeesOwnPassengerIdsMasked(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> in = req(DAY, 1, 0, 0);
        in.put("passengers", List.of(p("Khách A", "1990-03-03")));
        Map<String, Object> b = f.bookings.create(f.newUser("a@gmail.com"), in);
        String idNo = Maps.str(Maps.map(Maps.list(f.core.customerView(b).get("passengers")).get(0)), "idNumber");
        assertEquals("*********456", idNo);
        assertEquals("079090123456", Maps.str(Maps.map(Maps.list(f.core.view(b, Role.OPERATOR).get("passengers")).get(0)), "idNumber"));
    }

    // ───────── 9.1: chỗ còn lại ─────────
    @Test void availabilityShowsCapacityBookedLeftAndState(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        f.operator.setDeparture(OPERATOR, "101", DAY, 4, null);
        f.bookings.create(user, req(DAY, 2, 0, 0));
        Map<String, Object> a = f.customerOps.availability("101", DAY);
        assertEquals("open", a.get("status"));
        assertEquals(4, ((Number) a.get("capacity")).intValue());
        assertEquals(2, ((Number) a.get("booked")).intValue());
        assertEquals(2, ((Number) a.get("left")).intValue());

        f.bookings.create(user, req(DAY, 2, 0, 0));
        assertEquals("full", f.customerOps.availability("101", DAY).get("status"));

        f.operator.setDeparture(OPERATOR, "101", DAY, null, "closed");
        Map<String, Object> closed = f.customerOps.availability("101", DAY);
        assertEquals("closed", closed.get("status"));
        assertEquals(0, ((Number) closed.get("left")).intValue());

        assertEquals(404, code(() -> f.customerOps.availability("nope", DAY)));
        assertEquals(400, code(() -> f.customerOps.availability("101", "10/11/2026")));
    }

    @Test void adminDefaultCapacityAppliesToBookingToo(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> user = f.newUser("a@gmail.com");
        f.config.update(Maps.of("id", "ad001", "role", "admin", "name", "A"),
                Maps.of("departure", Maps.of("defaultCapacity", 3, "defaultMinGuests", 2, "cutoffDaysBeforeTrip", 3)));
        f.bookings.create(user, req(DAY, 3, 0, 0));
        assertEquals(409, code(() -> f.bookings.create(user, req(DAY, 1, 0, 0))), "đặt chỗ phải theo cùng sức chứa mặc định mà trang xem chỗ hiển thị");
        assertEquals(0, ((Number) f.customerOps.availability("101", DAY).get("left")).intValue());
    }

    // ───────── 9.2: chỗ cuối cùng ─────────
    @Test void onlyTwoOfEightConcurrentBookingsGetTheLastTwoSeats(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.operator.setDeparture(OPERATOR, "101", DAY, 2, null);
        int n = 8;
        List<Map<String, Object>> users = new ArrayList<>();
        for (int i = 0; i < n; i++) users.add(f.newUser("u" + i + "@gmail.com"));
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger ok = new AtomicInteger(), full = new AtomicInteger(), other = new AtomicInteger();
        List<Future<?>> fs = new ArrayList<>();
        for (Map<String, Object> u : users) fs.add(pool.submit(() -> {
            go.await();
            try { f.bookings.create(u, req(DAY, 1, 0, 0)); ok.incrementAndGet(); }
            catch (HttpError e) { if (e.status() == 409) full.incrementAndGet(); else other.incrementAndGet(); }
            return null;
        }));
        go.countDown();
        for (Future<?> x : fs) x.get(30, TimeUnit.SECONDS);
        pool.shutdown();
        assertEquals(2, ok.get(), "đúng 2 người giữ được 2 chỗ cuối");
        assertEquals(n - 2, full.get());
        assertEquals(0, other.get());
        assertEquals(0, ((Number) f.customerOps.availability("101", DAY).get("left")).intValue());
    }

    // ───────── 9.3: thiếu khách tối thiểu ─────────
    @Test void sweeperWarnsOperatorOnceUntilProposalIsFiled(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        String near = "2026-11-04";   // còn 3 ngày = đúng hạn chốt mặc định; chỉ 1 khách < tối thiểu 2
        f.bookings.create(f.newUser("a@gmail.com"), req(near, 1, 0, 0));
        assertTrue(f.operator.departures().stream().anyMatch(d -> Maps.bool(d, "atRisk")));
        assertEquals((Integer) 1, f.sweeper.sweep().get("alerts"));
        f.operator.proposeCancel(OPERATOR, "101", near, "Chưa đủ khách tối thiểu");
        assertEquals((Integer) 0, f.sweeper.sweep().get("alerts"), "đã có đề xuất chờ Admin duyệt thì thôi nhắc");
    }

    // ───────── 9.7: danh sách chờ ─────────
    @Test void cannotJoinWaitlistWhileSeatsRemain(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u1 = f.newUser("a@gmail.com"), u2 = f.newUser("b@gmail.com");
        f.operator.setDeparture(OPERATOR, "101", DAY, 4, null);
        f.bookings.create(u1, req(DAY, 2, 0, 0));
        assertEquals(409, code(() -> f.support.joinWaitlist(u2, "101", DAY, 2, "0907654321")), "còn 2 chỗ: đặt thẳng, không cần chờ");
        assertNotNull(f.support.joinWaitlist(u2, "101", DAY, 3, "0907654321"), "cần 3 chỗ mà chỉ còn 2: được vào hàng chờ");
    }

    @Test void waitlistNotifiesInArrivalOrderWithoutDoubleBookingTheSeats(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        Map<String, Object> u1 = f.newUser("a@gmail.com"), u2 = f.newUser("b@gmail.com"), u3 = f.newUser("c@gmail.com");
        f.operator.setDeparture(OPERATOR, "101", DAY, 2, null);
        String b1 = Maps.str(f.bookings.create(u1, req(DAY, 2, 0, 0)), "id");
        Map<String, Object> w2 = f.support.joinWaitlist(u2, "101", DAY, 2, "0907654321");
        f.clock.now += 5_000;
        Map<String, Object> w3 = f.support.joinWaitlist(u3, "101", DAY, 2, "0907654322");
        f.customerOps.cancel(u1, b1, "");   // trả lại 2 chỗ: chỉ đủ cho MỘT trong hai khách đang chờ
        assertEquals((Integer) 1, f.sweeper.sweep().get("waitlist"));
        Map<String, String> status = new HashMap<>();
        for (Map<String, Object> w : f.support.waitlist(null)) status.put(Maps.str(w, "id"), Maps.str(w, "status"));
        assertEquals("notified", status.get(Maps.str(w2, "id")), "người vào hàng chờ trước được báo trước");
        assertEquals("waiting", status.get(Maps.str(w3, "id")));
    }

    // ───────── 9.1: Điều hành mở sẵn chuyến ─────────
    @Test void operatorCanOpenDepartureBeforeAnyBookingAndSeesRealCapacityWhenClosed(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);
        f.operator.setDeparture(OPERATOR, "101", "2026-12-20", 6, null);
        Map<String, Object> d = f.operator.departures().stream().filter(x -> "2026-12-20".equals(x.get("date"))).findFirst().orElseThrow();
        assertEquals(0, ((Number) d.get("pax")).intValue());
        assertEquals(6, ((Number) d.get("capacity")).intValue());
        assertEquals(6, ((Number) d.get("left")).intValue());
        assertEquals("open", d.get("state"));
        assertFalse(Maps.bool(d, "atRisk"), "chuyến chưa có khách nào thì chưa có ai bị ảnh hưởng");

        f.operator.setDeparture(OPERATOR, "101", "2026-12-20", null, "closed");
        Map<String, Object> closed = f.operator.departures().stream().filter(x -> "2026-12-20".equals(x.get("date"))).findFirst().orElseThrow();
        assertEquals("closed", closed.get("state"));
        assertEquals(6, ((Number) closed.get("capacity")).intValue(), "đóng bán không làm mất sức chứa đã đặt");
        assertEquals(0, ((Number) closed.get("left")).intValue());

        assertEquals(400, code(() -> f.operator.setDeparture(OPERATOR, "101", "2026-10-01", 5, null)), "không mở chuyến ở ngày đã qua");
        assertEquals(400, code(() -> f.operator.setDeparture(OPERATOR, "101", "2026-12-21", 999, null)), "không vượt sức chứa tối đa của tour");
    }
}
