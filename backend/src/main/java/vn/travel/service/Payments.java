package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Pricing;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Thanh toán chuyển khoản (E3, E4, E4b, E4c) — KHÔNG Telegram.
 *   khách chuyển khoản → dịch vụ theo dõi ngân hàng (SePay/Casso/PayOS) gọi POST /api/payments/webhook
 *   → xác thực secret → tách mã đơn trong nội dung → đối chiếu số tiền (server tính) → chống trùng theo mã giao dịch
 *   → ghi storage/db/payments.json → đơn pending → confirmed.
 */
@Service
@SuppressWarnings("unchecked")
public class Payments {
    private static final Map<String, String> BIN = Map.ofEntries(
            Map.entry("vietcombank", "970436"), Map.entry("vcb", "970436"), Map.entry("mbbank", "970422"), Map.entry("mb", "970422"),
            Map.entry("acb", "970416"), Map.entry("tpbank", "970423"), Map.entry("bidv", "970418"), Map.entry("techcombank", "970407"),
            Map.entry("tcb", "970407"), Map.entry("vietinbank", "970415"), Map.entry("agribank", "970405"), Map.entry("vpbank", "970432"),
            Map.entry("sacombank", "970403"));

    private final Db db;
    private final Bookings bookings;
    private final Notifications noti;
    private final Clock clock;
    private final TravelProperties props;
    private final Pattern codePattern;

    public Payments(Db db, Bookings bookings, Notifications noti, Clock clock, TravelProperties props) {
        this.db = db;
        this.bookings = bookings;
        this.noti = noti;
        this.clock = clock;
        this.props = props;
        this.codePattern = Pattern.compile(Pattern.quote(props.prefix()) + "(\\d{13})");
    }

    // ───────── thông tin cho khách ─────────
    public boolean configured() {
        return !TravelProperties.blank(props.paymentBank()) && !TravelProperties.blank(props.paymentAccount());
    }

    /** Thông tin tài khoản nhận tiền (công khai: khách vẫn phải thấy để chuyển khoản) — lấy từ biến môi trường, không nằm trong JS. */
    public Map<String, Object> publicConfig() {
        return Maps.of("ok", true, "configured", configured(), "bank", nz(props.paymentBank()), "account", nz(props.paymentAccount()),
                "accountName", nz(props.paymentAccountName()), "prefix", props.prefix());
    }

    private static String nz(String s) { return s == null ? "" : s; }

    /** Số tiền khách cần chuyển ở bước hiện tại — server tính, không tin client. */
    public static long amountDue(Map<String, Object> b) {
        long total = Maps.lng(b, "price"), deposit = Maps.lng(b, "deposit");
        if (Maps.bool(b, "fullPaid")) deposit = total;
        if (Maps.bool(b, "depositPaid")) return Math.max(0, total - deposit) + overtimeFee(b);
        return "full".equals(b.get("payChoice")) ? total : deposit;
    }

    private static long overtimeFee(Map<String, Object> b) {
        return (long) (Math.max(0, Pricing.num(b.get("overtimeHours"))) * Pricing.GUIDE_EXTRA_HOUR_FEE);
    }

    public Map<String, Object> info(String bookingId, Map<String, Object> user) {
        Map<String, Object> b = bookings.getFor(bookingId, user);
        long amount = amountDue(b);
        String bank = nz(props.paymentBank()), acc = nz(props.paymentAccount()), name = nz(props.paymentAccountName());
        String qr = "";
        if (configured()) {
            String bin = BIN.getOrDefault(bank.toLowerCase().replaceAll("\\s", ""), bank);
            qr = "https://img.vietqr.io/image/" + bin + "-" + acc + "-compact2.png?amount=" + amount + "&addInfo=" + enc(Maps.str(b, "payCode")) + "&accountName=" + enc(name);
        }
        return Maps.of("ok", true, "configured", configured(), "bookingId", b.get("id"), "bank", bank, "account", acc, "accountName", name,
                "content", b.get("payCode"), "amount", amount, "qrUrl", qr);
    }

    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }

    // ───────── webhook ─────────
    /** Xác thực secret (E4): "Authorization: Apikey <KEY>" của SePay hoặc header X-Webhook-Secret; so sánh thời gian hằng. */
    public void authenticate(String authorization, String xSecret) {
        String secret = props.paymentWebhookSecret();
        if (TravelProperties.blank(secret)) throw new HttpError(503, "Webhook thanh toán chưa được cấu hình");
        String given = null;
        if (authorization != null && authorization.regionMatches(true, 0, "Apikey ", 0, 7)) given = authorization.substring(7).trim();
        else if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) given = authorization.substring(7).trim();
        else if (xSecret != null) given = xSecret.trim();
        if (given == null || !MessageDigest.isEqual(given.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8)))
            throw new HttpError(401, "Sai khóa xác thực webhook");
    }

    /** Body dạng SePay: { id, transferType, transferAmount, content|code, referenceCode }. Trả bản ghi giao dịch. */
    public Map<String, Object> webhook(Map<String, Object> body) {
        String txId = Maps.str(body, "id");
        if (txId.isEmpty()) txId = Maps.str(body, "referenceCode");
        if (txId.isEmpty()) throw HttpError.bad("Thiếu mã giao dịch");
        String type = Maps.str(body, "transferType");
        if (!type.isEmpty() && !"in".equalsIgnoreCase(type)) return Maps.of("ignored", true, "reason", "Không phải giao dịch tiền vào");
        long amount = (long) Pricing.num(body.get("transferAmount"));
        String content = Maps.str(body, "content");
        if (content.isEmpty()) content = Maps.str(body, "description");
        String codeField = Maps.str(body, "code");
        String normalized = (codeField + " " + content).toUpperCase().replaceAll("[^A-Z0-9]", "");
        Matcher m = codePattern.matcher(normalized);
        String payCode = m.find() ? props.prefix() + m.group(1) : "";

        String tx = txId, cnt = content, pc = payCode;
        Map<String, Object>[] out = new Map[1];
        db.edit("payments", all -> {
            for (Map<String, Object> p : all)
                if (tx.equals(Maps.str(p, "txId"))) { out[0] = Maps.of("duplicate", true, "payment", p); return; }
            Map<String, Object> rec = baseRecord("webhook", tx, amount, cnt, pc);
            all.add(rec);
            out[0] = Maps.of("payment", rec);
            if (pc.isEmpty()) { fail(rec, "unmatched", "Không tìm thấy mã đơn trong nội dung chuyển khoản"); return; }
            Map<String, Object> b = null;
            for (Map<String, Object> x : db.list("bookings")) if (pc.equalsIgnoreCase(Maps.str(x, "payCode"))) b = x;
            if (b == null) { fail(rec, "unmatched", "Không có đơn nào có mã " + pc); return; }
            rec.put("bookingId", b.get("id"));
            String[] res = applyAuto(Maps.str(b, "id"), amount);
            if (res[0] == null) { rec.put("status", "matched"); rec.put("kind", res[1]); }
            else fail(rec, "mismatch", res[0]);
        });
        return out[0];
    }

    private Map<String, Object> baseRecord(String source, String txId, long amount, String content, String payCode) {
        return Maps.of("id", Ids.newId("pay"), "txId", txId, "source", source, "bookingId", "", "payCode", payCode, "amount", amount,
                "content", content, "status", "pending", "reason", "", "kind", "", "createdAt", Times.iso(clock.millis()));
    }

    private static void fail(Map<String, Object> rec, String status, String reason) {
        rec.put("status", status);
        rec.put("reason", reason);
    }

    /** {lỗi|null, loại}: lỗi null = đã ghi nhận; ngược lại là lý do lệch (để Admin xử lý tay). */
    private String[] applyAuto(String bookingId, long amount) {
        String[] result = {null, ""};
        bookings.mutate(bookingId, b -> {
            if ("cancelled".equals(b.get("status"))) { result[0] = "Đơn đã hủy"; return; }
            long total = Maps.lng(b, "price"), deposit = Maps.lng(b, "deposit");
            if (!Maps.bool(b, "depositPaid")) {
                if (amount >= total) { markDeposit(b, true); result[1] = "full"; }
                else if (amount >= deposit) { markDeposit(b, false); result[1] = "deposit"; }
                else result[0] = "Thiếu tiền cọc: nhận " + amount + ", cần " + deposit;
            } else if (!Maps.bool(b, "finalPaid") && !Maps.bool(b, "fullPaid")) {
                long due = amountDue(b);
                if (amount >= due) { markFinal(b); result[1] = "final"; }
                else result[0] = "Thiếu tiền phần còn lại: nhận " + amount + ", cần " + due;
            } else result[0] = "Đơn đã thanh toán đủ";
        });
        return result;
    }

    private void markDeposit(Map<String, Object> b, boolean full) {
        b.put("depositPaid", true);
        b.put("depositPaidAt", Times.iso(clock.millis()));
        if (full) b.put("fullPaid", true);
        if ("pending".equals(b.get("status"))) b.put("status", "confirmed");
        noti.add(Maps.str(b, "userId"), "booking", "💰 Đã nhận tiền cọc", "Đơn " + b.get("id") + " – " + b.get("tourName") + " đã được xác nhận.", "profile", "paid-" + b.get("id"));
    }

    private void markFinal(Map<String, Object> b) {
        b.put("finalPaid", true);
        b.put("finalPaidAt", Times.iso(clock.millis()));
    }

    // ───────── xác nhận tay (E4b) ─────────
    /** body: { bookingId, kind: deposit|full|final, amount?, note?, paymentId? } — Admin quyết định khi lệch tiền / không khớp mã. */
    public Map<String, Object> manual(Map<String, Object> admin, Map<String, Object> body) {
        String bookingId = Maps.str(body, "bookingId"), kind = Maps.str(body, "kind");
        if (!Set.of("deposit", "full", "final").contains(kind)) throw HttpError.bad("kind phải là deposit, full hoặc final", "kind");
        if (bookings.find(bookingId) == null) throw HttpError.notFound("Không tìm thấy đơn");
        String paymentId = Maps.str(body, "paymentId");
        long amount = (long) Pricing.num(body.get("amount"));
        String note = Maps.str(body, "note");
        String[] err = {null};
        bookings.mutate(bookingId, b -> {
            if ("cancelled".equals(b.get("status"))) { err[0] = "Đơn đã hủy"; return; }
            if (kind.equals("final") && !Maps.bool(b, "depositPaid")) { err[0] = "Đơn chưa đặt cọc"; return; }
            if (!kind.equals("final") && Maps.bool(b, "depositPaid")) { err[0] = "Đơn đã ghi nhận đặt cọc"; return; }
            if (kind.equals("final")) markFinal(b); else markDeposit(b, kind.equals("full"));
        });
        if (err[0] != null) throw HttpError.conflict(err[0], null);
        Map<String, Object>[] out = new Map[1];
        db.edit("payments", all -> {
            Map<String, Object> rec = null;
            if (!paymentId.isEmpty()) for (Map<String, Object> p : all) if (paymentId.equals(Maps.str(p, "id"))) rec = p;
            if (rec == null) { rec = baseRecord("manual", "manual-" + Ids.hex(5), amount, note, ""); all.add(rec); }
            rec.put("bookingId", bookingId);
            rec.put("status", "matched");
            rec.put("kind", kind);
            rec.put("reason", note.isEmpty() ? "Admin xác nhận tay" : note);
            rec.put("handledBy", Maps.str(admin, "email"));
            rec.put("handledAt", Times.iso(clock.millis()));
            out[0] = rec;
        });
        return out[0];
    }

    // ───────── thống kê (E4c) ─────────
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> l = new ArrayList<>(db.list("payments"));
        l.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return l;
    }

    /** Số liệu tổng hợp: doanh thu theo ngày/tháng, đơn đã cọc, đơn chờ thanh toán, giao dịch lệch. Không lộ thông tin khách. */
    public Map<String, Object> stats() {
        TreeMap<String, long[]> day = new TreeMap<>(), month = new TreeMap<>();
        long received = 0, mismatch = 0;
        List<Map<String, Object>> bad = new ArrayList<>();
        for (Map<String, Object> p : db.list("payments")) {
            String st = Maps.str(p, "status");
            if ("matched".equals(st)) {
                long a = Maps.lng(p, "amount");
                received += a;
                String d = Times.todayVN(Times.parse(p.get("createdAt")) == null ? clock.millis() : Times.parse(p.get("createdAt"))).toString();
                day.computeIfAbsent(d, k -> new long[2]);
                day.get(d)[0] += a; day.get(d)[1]++;
                String mth = d.substring(0, 7);
                month.computeIfAbsent(mth, k -> new long[2]);
                month.get(mth)[0] += a; month.get(mth)[1]++;
            } else if ("mismatch".equals(st) || "unmatched".equals(st)) {
                mismatch++;
                bad.add(p);
            }
        }
        long deposited = 0, pending = 0, cancelled = 0;
        for (Map<String, Object> b : db.list("bookings")) {
            if ("cancelled".equals(b.get("status"))) cancelled++;
            else if (Maps.bool(b, "depositPaid")) deposited++;
            else pending++;
        }
        List<Map<String, Object>> byDay = new ArrayList<>(), byMonth = new ArrayList<>();
        day.forEach((k, v) -> byDay.add(Maps.of("date", k, "amount", v[0], "count", v[1])));
        month.forEach((k, v) -> byMonth.add(Maps.of("month", k, "amount", v[0], "count", v[1])));
        return Maps.of("ok", true, "received", received, "byDay", byDay, "byMonth", byMonth, "bookings",
                Maps.of("deposited", deposited, "pendingPayment", pending, "cancelled", cancelled), "mismatchCount", mismatch, "mismatches", bad);
    }
}
