package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.*;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Chăm sóc khách hàng (TASKS 6.8–6.9, 9.7, 17.x): khiếu nại (nhận → trao đổi → đề xuất đền bù → đóng), danh sách chờ,
 * giao dịch chuyển khoản lệch do thu ngân chuyển sang. SUPPORT chỉ thấy CCCD dạng che, không duyệt tiền.
 */
@Service
@SuppressWarnings("unchecked")
public class SupportOps {
    private final Db db;
    private final OpsCore core;
    private final Refunds refunds;

    public SupportOps(Db db, OpsCore core, Refunds refunds) {
        this.db = db;
        this.core = core;
        this.refunds = refunds;
    }

    // ───────────────────────── khách gửi khiếu nại ─────────────────────────
    private static final int MAX_EVIDENCE = 3, MAX_EVIDENCE_CHARS = 900_000;   // ≤ 3 ảnh, mỗi ảnh ≤ ~650 KB
    private static final java.util.regex.Pattern DATA_IMG = java.util.regex.Pattern.compile("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$");

    /** 6.7: ảnh minh chứng gửi dạng data URL (client đã thu nhỏ); chỉ nhận png/jpeg/webp, tối đa 3 ảnh. */
    static List<String> cleanEvidence(Object raw) {
        List<String> out = new ArrayList<>();
        if (!(raw instanceof List<?> l)) return out;
        if (l.size() > MAX_EVIDENCE) throw HttpError.bad("Chỉ đính kèm tối đa " + MAX_EVIDENCE + " ảnh", "images");
        for (Object o : l) {
            String s = o == null ? "" : String.valueOf(o);
            if (s.length() > MAX_EVIDENCE_CHARS || !DATA_IMG.matcher(s).matches()) throw HttpError.bad("Ảnh minh chứng phải là png/jpeg/webp và dưới 650 KB", "images");
            out.add(s);
        }
        return out;
    }

    public Map<String, Object> createComplaint(Map<String, Object> customer, String bookingId, String title, String content) {
        return createComplaint(customer, bookingId, title, content, List.of());
    }

    public Map<String, Object> createComplaint(Map<String, Object> customer, String bookingId, String title, String content, Object images) {
        if (title == null || title.trim().length() < 3) throw HttpError.bad("Vui lòng nhập tiêu đề", "title");
        if (content == null || content.trim().length() < 10) throw HttpError.bad("Vui lòng mô tả rõ hơn (ít nhất 10 ký tự)", "content");
        List<String> evidence = cleanEvidence(images);
        Map<String, Object> b = core.require(bookingId);
        if (!Maps.str(b, "userId").equals(Maps.str(customer, "id"))) throw HttpError.notFound("Không tìm thấy đơn");
        String st = Flow.norm(b.get("status"));
        if (Flow.PENDING_PAYMENT.equals(st) || Flow.inactive(st)) throw HttpError.conflict("Chỉ gửi khiếu nại cho đơn đang có hiệu lực", "status");
        Map<String, Object> c = Maps.of("id", Ids.newId("cmp"), "bookingId", b.get("id"), "payCode", b.get("payCode"), "userId", customer.get("id"),
                "customerName", b.get("customerName"), "email", b.get("email"), "phone", b.get("phone"), "tourName", b.get("tourName"),
                "title", title.trim(), "content", content.trim(), "status", "open", "createdAt", Times.iso(core.now()),
                "dueAt", Times.iso(core.now() + core.config.i("complaintResponseHours") * 3_600_000L), "messages", new ArrayList<>(), "images", evidence);
        db.edit("complaints", all -> all.add(c));
        core.notifyRoles("📣 Khiếu nại mới", title.trim() + " – đơn " + b.get("payCode"), "support.html#complaints", "cmpn-" + c.get("id"), Role.SUPPORT);
        return c;
    }

    public List<Map<String, Object>> myComplaints(String userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> c : db.list("complaints")) if (userId.equals(Maps.str(c, "userId"))) out.add(customerView(c));
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    private static Map<String, Object> customerView(Map<String, Object> c) {
        Map<String, Object> o = new LinkedHashMap<>();
        for (String k : List.of("id", "bookingId", "payCode", "tourName", "title", "content", "status", "createdAt", "resolvedAt", "customerReply", "images"))
            if (c.containsKey(k)) o.put(k, c.get(k));
        List<Object> msgs = new ArrayList<>();
        for (Object m : Maps.list(c.get("messages"))) {
            Map<String, Object> x = Maps.map(m);
            if (x != null && !Maps.bool(x, "internal")) msgs.add(Maps.of("at", x.get("at"), "from", x.get("from"), "text", x.get("text")));
        }
        o.put("messages", msgs);
        return o;
    }

    // ───────────────────────── CSKH xử lý ─────────────────────────
    public List<Map<String, Object>> complaints(String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        long now = core.now();
        for (Map<String, Object> c : db.list("complaints")) {
            if (status != null && !status.isEmpty() && !status.equals(Maps.str(c, "status"))) continue;
            Map<String, Object> o = new LinkedHashMap<>(c);
            Long due = Times.parse(c.get("dueAt"));
            o.put("overdue", due != null && due < now && !"resolved".equals(c.get("status")) && !"closed".equals(c.get("status")));
            Map<String, Object> b = c.get("bookingId") == null ? null : core.find(Maps.str(c, "bookingId"));
            if (b != null) o.put("order", core.view(b, Role.SUPPORT));
            out.add(o);
        }
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    private Map<String, Object> mutate(String id, java.util.function.Consumer<Map<String, Object>> fn) {
        Map<String, Object>[] out = new Map[1];
        db.edit("complaints", all -> {
            for (Map<String, Object> c : all) if (id.equals(Maps.str(c, "id"))) { fn.accept(c); out[0] = c; }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy khiếu nại");
        return out[0];
    }

    /** Nhận xử lý → in_progress. */
    public Map<String, Object> take(Actor cs, String id) {
        Map<String, Object> out = mutate(id, c -> {
            if (!"open".equals(c.get("status"))) throw HttpError.conflict("Khiếu nại này đã có người nhận hoặc đã đóng", "status");
            c.put("status", "in_progress");
            c.put("assignee", cs.id());
            c.put("assigneeName", cs.name());
            c.put("takenAt", Times.iso(core.now()));
        });
        core.audit.log(cs.id(), cs.name(), cs.role(), "complaint.take", id, "");
        return out;
    }

    /** Trả lời khách (internal = ghi chú nội bộ, khách không thấy). */
    public Map<String, Object> reply(Actor cs, String id, String text, boolean internal) {
        if (text == null || text.isBlank()) throw HttpError.bad("Nội dung không được để trống", "text");
        Map<String, Object> out = mutate(id, c -> {
            if ("resolved".equals(c.get("status")) || "closed".equals(c.get("status"))) throw HttpError.conflict("Khiếu nại đã đóng", "status");
            List<Object> msgs = new ArrayList<>(Maps.list(c.get("messages")));
            msgs.add(Maps.of("at", Times.iso(core.now()), "from", "support", "byId", cs.id(), "byName", cs.name(), "text", text.trim(), "internal", internal));
            c.put("messages", msgs);
            if ("open".equals(c.get("status"))) { c.put("status", "in_progress"); c.put("assignee", cs.id()); c.put("assigneeName", cs.name()); }
        });
        if (!internal) core.notifyUser(Maps.str(out, "userId"), "💬 CSKH đã phản hồi khiếu nại", Maps.str(out, "title"), "profile", "cr-" + id + "-" + Maps.list(out.get("messages")).size());
        return out;
    }

    /** Đề xuất đền bù bằng tiền: tạo hồ sơ hoàn tiền chờ ADMIN duyệt (không đổi trạng thái đơn). */
    public Map<String, Object> proposeRefund(Actor cs, String id, long amount, String reason) {
        if (amount <= 0) throw HttpError.bad("Số tiền phải lớn hơn 0", "amount");
        if (reason == null || reason.isBlank()) throw HttpError.bad("Vui lòng ghi lý do đền bù", "reason");
        Map<String, Object> c = null;
        for (Map<String, Object> x : db.list("complaints")) if (id.equals(Maps.str(x, "id"))) c = x;
        if (c == null) throw HttpError.notFound("Không tìm thấy khiếu nại");
        if (!Maps.str(c, "refundId").isEmpty()) throw HttpError.conflict("Khiếu nại này đã có đề xuất đền bù", null);
        Map<String, Object> b = core.require(Maps.str(c, "bookingId"));
        long cap = Math.max(0, Flow.paidIn(b) - Flow.refundedOut(b));
        if (amount > cap) throw HttpError.bad("Số tiền đền bù vượt số tiền khách đã trả (" + cap + " ₫)", "amount");
        Map<String, Object>[] rf = new Map[1];
        core.edit(Maps.str(b, "id"), x -> {
            rf[0] = refunds.create(x, Refunds.SRC_COMPLAINT, amount, reason.trim(), cs, false, id);
            core.note(x, "refund", cs, "CSKH đề xuất đền bù khiếu nại " + amount + " ₫ (chờ admin duyệt): " + reason.trim());   // 6.8
        });
        mutate(id, x -> { x.put("refundId", rf[0].get("id")); x.put("proposedRefund", amount); x.put("supportNote", reason.trim()); });
        core.audit.log(cs.id(), cs.name(), cs.role(), "complaint.propose_refund", Maps.str(b, "payCode"), amount + " ₫");
        return rf[0];
    }

    public Map<String, Object> resolve(Actor cs, String id, String note) {
        if (note == null || note.isBlank()) throw HttpError.bad("Vui lòng ghi kết quả xử lý", "note");
        Map<String, Object> out = mutate(id, c -> {
            if ("resolved".equals(c.get("status"))) throw HttpError.conflict("Khiếu nại đã đóng", "status");
            c.put("status", "resolved");
            c.put("resolvedAt", Times.iso(core.now()));
            c.put("resolvedBy", cs.id());
            c.put("supportNote", note.trim());
        });
        core.audit.log(cs.id(), cs.name(), cs.role(), "complaint.resolve", id, note.trim());
        core.notifyUser(Maps.str(out, "userId"), "✅ Khiếu nại đã được xử lý", Maps.str(out, "title") + ": " + note.trim(), "profile", "crs-" + id);
        return out;
    }

    // ───────────────────────── danh sách chờ ─────────────────────────
    public Map<String, Object> joinWaitlist(Map<String, Object> customer, String tourId, String date, int pax, String phone) {
        Map<String, Object> t = core.tours.find(tourId);
        if (t == null) throw HttpError.notFound("Không tìm thấy tour");
        if (pax < 1 || pax > 20) throw HttpError.bad("Số khách không hợp lệ", "pax");
        if (GuideAvailability.parse(date) == null || GuideAvailability.parse(date).isBefore(core.today())) throw HttpError.bad("Ngày đi không hợp lệ", "date");
        // 9.7: chỉ vào danh sách chờ khi chuyến thật sự không đủ chỗ cho số khách này (còn chỗ thì đặt thẳng); chuyến đã bị công ty hủy thì không có gì để chờ
        Map<String, Object> seat = core.seatInfo(tourId, date);
        if (seat != null && "cancelled".equals(seat.get("status"))) throw HttpError.conflict("Chuyến ngày " + date + " đã bị hủy", "date");
        if (seat != null && "open".equals(seat.get("status")) && Maps.lng(seat, "left") >= pax)
            throw HttpError.conflict("Chuyến này còn " + seat.get("left") + " chỗ, bạn có thể đặt ngay", "date");
        Map<String, Object> w = Maps.of("id", Ids.newId("wl"), "tourId", tourId, "tourName", t.get("name"), "date", date, "pax", pax, "userId", customer.get("id"),
                "name", customer.get("name"), "email", customer.get("email"), "phone", phone == null || phone.isBlank() ? Maps.str(customer, "phone") : phone, "status", "waiting", "createdAt", Times.iso(core.now()));
        db.edit("waitlist", all -> {
            for (Map<String, Object> x : all)
                if (customer.get("id").equals(x.get("userId")) && tourId.equals(x.get("tourId")) && date.equals(x.get("date")) && "waiting".equals(x.get("status")))
                    throw HttpError.conflict("Bạn đã trong danh sách chờ của chuyến này", null);
            all.add(w);
        });
        core.notifyRoles("⏳ Khách vào danh sách chờ", w.get("name") + " – " + w.get("tourName") + " (" + date + ", " + pax + " khách)", "support.html#waitlist", "wl-" + w.get("id"), Role.SUPPORT);
        return w;
    }

    /** Danh sách chờ, kèm số chỗ trống hiện tại để CSKH biết khi nào liên hệ được. */
    public List<Map<String, Object>> waitlist(String status) {
        Map<String, Integer> pax = new HashMap<>();
        for (Map<String, Object> b : core.bookings())
            if (Flow.active(b.get("status"))) pax.merge(Capacity.depKey(b.get("tourId"), b.get("date")), (int) Maps.lng(b, "pax"), Integer::sum);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> w : db.list("waitlist")) {
            if (status != null && !status.isEmpty() && !status.equals(Maps.str(w, "status"))) continue;
            Map<String, Object> o = new LinkedHashMap<>(w);
            int cap = core.depCapacity(core.tours.find(w.get("tourId")), w.get("tourId"), w.get("date"));
            int left = Math.max(0, cap - pax.getOrDefault(Capacity.depKey(w.get("tourId"), w.get("date")), 0));
            o.put("seatsLeft", left);
            o.put("canNotify", left >= Maps.lng(w, "pax"));
            out.add(o);
        }
        out.sort((a, b) -> Maps.str(a, "createdAt").compareTo(Maps.str(b, "createdAt")));
        return out;
    }

    /** CSKH báo khách có chỗ (hoặc đóng mục). action: notify | close. */
    public Map<String, Object> waitlistAct(Actor cs, String id, String action, String note) {
        Map<String, Object>[] out = new Map[1];
        db.edit("waitlist", all -> {
            for (Map<String, Object> w : all) {
                if (!id.equals(Maps.str(w, "id"))) continue;
                if (!"waiting".equals(w.get("status")) && !"notified".equals(w.get("status"))) throw HttpError.conflict("Mục này đã đóng", null);
                if ("notify".equals(action)) { w.put("status", "notified"); w.put("notifiedAt", Times.iso(core.now())); }
                else if ("close".equals(action)) w.put("status", "closed");
                else throw HttpError.bad("Hành động phải là notify hoặc close", "action");
                w.put("handledBy", cs.id());
                if (note != null) w.put("note", note.trim());
                out[0] = w;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy mục chờ");
        if ("notify".equals(action))
            core.notifyUser(Maps.str(out[0], "userId"), "🎉 Tour đã có chỗ", Maps.str(out[0], "tourName") + " ngày " + out[0].get("date") + " vừa có chỗ trống. Đặt ngay kẻo hết!", "tour/" + out[0].get("tourId"), "wln-" + id);
        core.audit.log(cs.id(), cs.name(), cs.role(), "waitlist." + action, id, note == null ? "" : note);
        return out[0];
    }

    /** Tự động: mỗi khi có chỗ → báo khách đầu hàng chờ (gọi từ OpsSweeper). */
    public int autoNotifyWaitlist() {
        int n = 0;
        // Theo thứ tự đến trước được báo trước (waitlist() đã sắp theo createdAt); mỗi khách được báo "chiếm" số chỗ của mình
        // để hai khách không cùng được báo cho cùng một chỗ trống
        Map<String, Long> left = new HashMap<>();
        for (Map<String, Object> w : waitlist("waiting")) {
            String key = Capacity.depKey(w.get("tourId"), w.get("date"));
            long avail = left.computeIfAbsent(key, k -> Maps.lng(w, "seatsLeft"));
            if (avail < Maps.lng(w, "pax")) continue;
            left.put(key, avail - Maps.lng(w, "pax"));
            db.edit("waitlist", all -> all.forEach(x -> { if (Maps.str(w, "id").equals(Maps.str(x, "id")) && "waiting".equals(x.get("status"))) { x.put("status", "notified"); x.put("notifiedAt", Times.iso(core.now())); } }));
            core.notifyUser(Maps.str(w, "userId"), "🎉 Tour đã có chỗ", Maps.str(w, "tourName") + " ngày " + w.get("date") + " vừa có chỗ trống.", "tour/" + w.get("tourId"), "wln-" + w.get("id"));
            n++;
        }
        return n;
    }

    // ───────────────────────── đơn quá hạn thu nốt (4.5) ────────────────────
    /** Đơn đã cọc nhưng quá hạn thu nốt: CSKH xem để liên hệ nhắc khách (CSKH không ghi nhận tiền). Hạn gần nhất lên đầu. */
    public List<Map<String, Object>> balanceOverdue() {
        List<Map<String, Object>> out = new ArrayList<>();
        java.time.LocalDate today = core.today();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (Flow.inactive(st) || Flow.PENDING_PAYMENT.equals(st) || !Maps.bool(b, "depositPaid") || Flow.fullyPaid(b)) continue;
            java.time.LocalDate due = GuideAvailability.parse(b.get("balanceDueDate"));
            if (!Maps.bool(b, "balanceOverdue") && (due == null || due.isAfter(today))) continue;
            out.add(Maps.of("id", b.get("id"), "payCode", b.get("payCode"), "customerName", b.get("customerName"), "phone", b.get("phone"), "email", b.get("email"),
                    "tourName", b.get("tourName"), "date", b.get("date"), "status", st, "balanceDueDate", b.get("balanceDueDate") == null ? "" : b.get("balanceDueDate"),
                    "remaining", OpsCore.remaining(b), "overdueDays", due == null ? 0 : Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(due, today))));
        }
        out.sort((x, y) -> Maps.str(x, "balanceDueDate").compareTo(Maps.str(y, "balanceDueDate")));
        return out;
    }

    // ───────────────────────── chuyển khoản lệch (do thu ngân chuyển sang) ─────────────────────────
    public List<Map<String, Object>> paymentIssues() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> p : db.list("payments")) {
            if (!Maps.bool(p, "handoff") || Maps.bool(p, "dismissed")) continue;
            if (!"mismatch".equals(p.get("status")) && !"unmatched".equals(p.get("status")) && !"waiting".equals(p.get("status"))) continue;
            out.add(Maps.of("id", p.get("id"), "bookingId", p.get("bookingId"), "payCode", p.get("payCode"), "amount", p.get("amount"), "reason", p.get("reason"),
                    "problem", p.get("problem"), "createdAt", p.get("createdAt"), "contactNote", p.get("contactNote") == null ? "" : p.get("contactNote")));
        }
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    /** CSKH ghi lại đã liên hệ khách thế nào; thu ngân sẽ xử lý tiếp. */
    public Map<String, Object> contactPaymentIssue(Actor cs, String paymentId, String note) {
        if (note == null || note.isBlank()) throw HttpError.bad("Vui lòng ghi nội dung đã trao đổi với khách", "note");
        boolean[] hit = {false};
        db.edit("payments", all -> all.forEach(p -> {
            if (paymentId.equals(Maps.str(p, "id")) && Maps.bool(p, "handoff")) { p.put("contactNote", note.trim()); p.put("contactedBy", cs.id()); p.put("contactedAt", Times.iso(core.now())); hit[0] = true; }
        }));
        if (!hit[0]) throw HttpError.notFound("Không tìm thấy giao dịch được chuyển sang CSKH");
        core.notifyRoles("📞 CSKH đã liên hệ khách", "Giao dịch " + paymentId + ": " + note.trim(), "cashier.html#discrepancy", "pc-" + paymentId, Role.CASHIER);
        core.audit.log(cs.id(), cs.name(), cs.role(), "payment.contact", paymentId, note.trim());
        return Maps.of("ok", true);
    }

    // ───────────────────────── thống kê ─────────────────────────
    public Map<String, Object> stats() {
        int open = 0, inProg = 0, resolved = 0, overdue = 0;
        long totalMs = 0;
        int timed = 0;
        for (Map<String, Object> c : complaints(null)) {
            String s = Maps.str(c, "status");
            if ("open".equals(s)) open++;
            else if ("in_progress".equals(s)) inProg++;
            else if ("resolved".equals(s)) {
                resolved++;
                Long a = Times.parse(c.get("createdAt")), b = Times.parse(c.get("resolvedAt"));
                if (a != null && b != null && b >= a) { totalMs += b - a; timed++; }
            }
            if (Maps.bool(c, "overdue")) overdue++;
        }
        return Maps.of("open", open, "inProgress", inProg, "resolved", resolved, "overdue", overdue,
                "avgResolveHours", timed == 0 ? 0 : Math.round(totalMs / (double) timed / 360_000.0) / 10.0,
                "waitlist", waitlist("waiting").size(), "paymentIssues", paymentIssues().size());
    }
}
