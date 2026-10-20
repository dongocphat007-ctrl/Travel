package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.store.JsonStore;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Dựng toàn bộ service trên thư mục JSON TẠM (không đụng dữ liệu thật) với đồng hồ giả. */
final class Fixture {
    static final class TestClock extends Clock {
        long now;
        TestClock(String iso) { now = Instant.parse(iso).toEpochMilli(); }
        void plusDays(long d) { now += d * 86_400_000L; }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId z) { return this; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now); }
        @Override public long millis() { return now; }
    }

    final Path root, db, web;
    final ObjectMapper mapper = new ObjectMapper();
    final TestClock clock = new TestClock("2026-11-01T03:00:00Z");
    final TravelProperties props;
    final Db dbs;
    final PasswordHasher hasher = new PasswordHasher();
    final SessionService sessions;
    final Notifications noti;
    final TourCatalog tours;
    final Vouchers vouchers;
    final GoogleVerifier google;
    final Accounts accounts;
    final Guides guides;
    final Mailer mailer;
    final PublicData data;
    final Stats stats;
    final Bookings bookings;
    final Payments payments;
    final Banners banners;
    final Reviews reviews;
    final Otp otp;

    Fixture(Path tmp) throws IOException {
        this(tmp, "WEBHOOK-SECRET", false);
    }

    Fixture(Path tmp, String webhookSecret, boolean otpDev) throws IOException {
        root = tmp;
        db = tmp.resolve("db");
        web = tmp.resolve("web");
        Files.createDirectories(web.resolve("data/tours"));
        Files.writeString(web.resolve("data/tours/mien-bac.json"), """
                {"tours":[
                 {"id":"101","name":"Hà Nội – Hạ Long 3N2Đ","price":2500000,"duration":"3 ngày 2 đêm","dest":"Hạ Long","guide":"guided","highlight":"Vịnh"},
                 {"id":"hot07","name":"Ninh Bình 2N1Đ","price":1990000,"duration":"2 ngày 1 đêm","dest":"Ninh Bình","guide":"guided"},
                 {"id":"s1","name":"Tự túc Đà Lạt","price":1000000,"duration":"2 ngày 1 đêm","dest":"Đà Lạt","guide":"self"}]}
                """);
        Files.writeString(web.resolve("data/guides-seed.json"), """
                [{"id":"g1","name":"Quân","status":"active","busyDates":["2026-12-10"]},
                 {"id":"g2","name":"Hà","status":"off","busyDates":[]}]
                """);
        Files.writeString(web.resolve("data/tour-stats.json"), """
                {"sample":true,"tours":[{"tourId":"101","used":100,"reviews":50,"rating":4.8},{"tourId":"hot07","used":0,"reviews":0,"rating":0}]}
                """);
        Files.writeString(web.resolve("data/reviews-seed.json"), """
                {"reviews":[{"id":"rv_seed_1","tourId":"101","name":"Mẫu","rating":5,"content":"Rất tuyệt vời","createdAt":"2026-10-01T00:00:00Z","source":"demo"}]}
                """);
        props = new TravelProperties(web.toString(), db.toString(), "", "", "boss@example.com", "test-session-secret-0123456789abcdef", "", "client-id",
                "", "gemini-2.5-flash", "", "", "", otpDev, webhookSecret, "Vietcombank", "123456789", "NGUYEN VAN A", "TRAVEL", "", false);
        JsonStore store = new JsonStore(db, mapper);
        dbs = new Db(store);
        sessions = new SessionService("test-session-secret-0123456789abcdef", clock);
        noti = new Notifications(dbs, clock);
        tours = new TourCatalog(web.resolve("data"), mapper, dbs);
        vouchers = new Vouchers(dbs, noti, tours, clock);
        google = new GoogleVerifier("client-id", mapper, clock, url -> { throw new IllegalStateException("offline"); });
        accounts = new Accounts(dbs, hasher, vouchers, noti, clock, google, props);
        guides = new Guides(dbs, web.resolve("data/guides-seed.json"), mapper);
        mailer = new Mailer(props, mapper);
        data = new PublicData(web.resolve("data"), mapper);
        stats = new Stats(dbs, data);
        bookings = new Bookings(dbs, tours, vouchers, guides, noti, mailer, accounts, clock, props);
        payments = new Payments(dbs, bookings, noti, clock, props);
        banners = new Banners(dbs, stats, clock, web.resolve("img/banners"));
        reviews = new Reviews(dbs, data, stats, accounts, clock);
        otp = new Otp(mailer, sessions, clock, props);
    }

    java.util.Map<String, Object> newUser(String email) {
        return (java.util.Map<String, Object>) accounts.register("Nguyễn Văn A", email, "matkhau123").get("user");
    }
}
