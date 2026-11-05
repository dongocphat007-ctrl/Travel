package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Permission;
import vn.travel.security.Role;
import vn.travel.security.RolePermissions;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Trang "Thông báo" của khu vực nội bộ: hội thoại giữa các vai trò (threads.json).
 *
 * <ul>
 *   <li><b>announcement</b> – thông báo / nhắc nhở do ADMIN chủ động gửi cho một vai trò hoặc một người. Chỉ MỘT hội thoại cho cả đợt gửi;
 *       người nhận chỉ thấy tin của Admin và tin của chính mình (phản hồi là riêng tư với Admin, người nhận không thấy nhau).</li>
 *   <li><b>chat</b> – trò chuyện giữa các vai trò nội bộ (Admin ↔ Điều hành ↔ HDV ↔ CSKH ...), có thể gắn một mã đơn / tour.
 *       Mọi người tham gia đều thấy toàn bộ tin.</li>
 * </ul>
 * Mỗi tin mới tạo (hoặc thay) một thông báo trên chuông 🔔 của người nhận (key {@code thr-<id>}), nên chuông cũ vẫn hoạt động như trước.
 * Khách hàng không tham gia hội thoại nội bộ.
 */
@Service
@SuppressWarnings("unchecked")
public class Messages {
    static final int MAX_TEXT = 2000, MAX_SUBJECT = 120, MAX_MESSAGES = 500, MAX_RECIPIENTS = 100;
    public static final String ANNOUNCEMENT = "announcement", CHAT = "chat";

    private final Db db;
    private final OpsCore core;

    public Messages(Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    // ───────────────────────── tiện ích ─────────────────────────
    private static String id(Map<String, Object> a) { return Maps.str(a, "id"); }

    private static boolean internal(Map<String, Object> a) { return Role.from(a.get("role")).isInternal(); }

    private static Map<String, Object> person(Map<String, Object> a) {
        Role r = Role.from(a.get("role"));
        return Maps.of("id", id(a), "name", Maps.str(a, "name"), "role", r.getKey(), "roleName", r.getDisplayName());
    }

    private static long ms(Object iso) {
        Long v = Times.parse(iso);
        return v == null ? 0 : v;
    }

    private static String preview(String text) {
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() > 140 ? t.substring(0, 137) + "…" : t;
    }

    private static void requireInternal(Map<String, Object> me) {
        if (me == null || !internal(me)) throw HttpError.forbidden();
    }

    private static boolean isParticipant(Map<String, Object> t, String uid) {
        for (Object o : Maps.list(t.get("participants"))) if (uid.equals(Maps.str(Maps.map(o), "id"))) return true;
        return false;
    }

    private static boolean broadcast(Map<String, Object> t) { return ANNOUNCEMENT.equals(Maps.str(t, "kind")); }

    private Map<String, Object> findThread(List<Map<String, Object>> all, String threadId) {
        for (Map<String, Object> t : all) if (Maps.str(t, "id").equals(threadId)) return t;
        return null;
    }

    private static Role roleOf(Object key) {
        String k = String.valueOf(key).trim();
        for (Role r : Role.internalRoles()) if (r.getKey().equalsIgnoreCase(k) || r.name().equalsIgnoreCase(k)) return r;
        throw HttpError.bad("Vai trò người nhận không hợp lệ: " + k, "to");
    }

    /** Tin mà người dùng {@code uid} được thấy: tin gửi chung, tin gửi cho mình, tin của chính mình. */
    private static List<Map<String, Object>> visible(Map<String, Object> t, String uid) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : Maps.list(t.get("messages"))) {
            Map<String, Object> m = Maps.map(o);
            if (m == null) continue;
            String to = Maps.str(m, "to");
            if (to.isEmpty() || to.equals(uid) || Maps.str(Maps.map(m.get("from")), "id").equals(uid)) out.add(m);
        }
        return out;
    }

    private static void markN(Map<String, Object> t, String uid) {
        Map<String, Object> n = new LinkedHashMap<>();
        Map<String, Object> old = Maps.map(t.get("readN"));
        if (old != null) n.putAll(old);
        n.put(uid, Maps.list(t.get("messages")).size());
        t.put("readN", n);
    }

    private static String creatorName(Map<String, Object> t) {
        for (Object o : Maps.list(t.get("participants"))) {
            Map<String, Object> p = Maps.map(o);
            if (p != null && Maps.str(p, "id").equals(Maps.str(t, "createdBy"))) return Maps.str(p, "name");
        }
        return "";
    }

    private Map<String, Object> summary(Map<String, Object> t, String uid) {
        List<Map<String, Object>> vis = visible(t, uid);
        // chưa đọc = tin của người khác, người dùng được thấy, nằm sau số tin đã đọc lần cuối (đếm theo thứ tự, không phụ thuộc đồng hồ)
        long readN = Maps.lng(Maps.map(t.get("readN")), uid);
        int unread = 0, idx = 0;
        for (Object o : Maps.list(t.get("messages"))) {
            Map<String, Object> m = Maps.map(o);
            if (m != null && idx >= readN && vis.contains(m) && !uid.equals(Maps.str(Maps.map(m.get("from")), "id"))) unread++;
            idx++;
        }
        Map<String, Object> last = vis.isEmpty() ? null : vis.get(vis.size() - 1);
        boolean creator = uid.equals(Maps.str(t, "createdBy"));
        List<Object> who = new ArrayList<>();
        for (Object o : Maps.list(t.get("participants"))) {
            Map<String, Object> p = Maps.map(o);
            if (p == null || uid.equals(Maps.str(p, "id"))) continue;
            // người nhận thông báo chỉ biết người gửi, không biết những ai khác cũng nhận
            if (broadcast(t) && !creator && !Maps.str(p, "id").equals(Maps.str(t, "createdBy"))) continue;
            who.add(p);
        }
        return Maps.of("id", t.get("id"), "kind", Maps.str(t, "kind"), "subject", Maps.str(t, "subject"), "ref", t.get("ref"), "createdBy", t.get("createdBy"),
                "createdByName", creatorName(t),
                "others", who, "count", vis.size(), "unread", unread, "mine", creator,
                "lastText", last == null ? "" : preview(Maps.str(last, "text")), "lastAt", last == null ? Maps.str(t, "createdAt") : last.get("at"),
                "lastFrom", last == null ? "" : Maps.str(Maps.map(last.get("from")), "name"), "createdAt", t.get("createdAt"));
    }

    private Map<String, Object> detail(Map<String, Object> t, String uid) {
        Map<String, Object> o = new LinkedHashMap<>(summary(t, uid));
        boolean creator = uid.equals(Maps.str(t, "createdBy"));
        o.put("messages", visible(t, uid));
        o.put("broadcast", broadcast(t));
        List<Object> targets = new ArrayList<>();
        if (broadcast(t) && creator)
            for (Object p : Maps.list(t.get("participants"))) if (!uid.equals(Maps.str(Maps.map(p), "id"))) targets.add(p);
        o.put("replyTargets", targets);
        return o;
    }

    private String link(Map<String, Object> account, String threadId) {
        return Role.from(account.get("role")).getKey() + ".html#notifications/" + threadId;
    }

    private void tell(String threadId, String subject, boolean announcement, Map<String, Object> from, String text, List<String> userIds) {
        for (String uid : userIds) {
            Map<String, Object> a = core.accounts.byId(uid);
            if (a == null || !Accounts.isActive(a) || uid.equals(id(from))) continue;
            Role fr = Role.from(from.get("role"));
            core.noti.put(uid, announcement ? "announcement" : "message", (announcement ? "📢 " : "💬 ") + subject,
                    Maps.str(from, "name") + " (" + fr.getDisplayName() + "): " + preview(text), link(a, threadId), "thr-" + threadId,
                    Maps.of("threadId", threadId, "fromId", id(from), "fromName", Maps.str(from, "name"), "fromRole", fr.getKey()));
        }
    }

    // ───────────────────────── danh bạ người nhận ─────────────────────────
    public Map<String, Object> recipients(Map<String, Object> me) {
        requireInternal(me);
        String uid = id(me);
        List<Map<String, Object>> people = new ArrayList<>();
        Map<String, Integer> count = new LinkedHashMap<>();
        for (Map<String, Object> a : core.accounts.all()) {
            if (!Accounts.isActive(a) || !internal(a) || uid.equals(id(a))) continue;
            people.add(person(a));
            count.merge(Role.from(a.get("role")).getKey(), 1, Integer::sum);
        }
        people.sort((a, b) -> {
            int c = Maps.str(a, "roleName").compareTo(Maps.str(b, "roleName"));
            return c != 0 ? c : Maps.str(a, "name").compareTo(Maps.str(b, "name"));
        });
        List<Map<String, Object>> roles = new ArrayList<>();
        for (Role r : Role.internalRoles()) roles.add(Maps.of("key", r.getKey(), "name", r.getDisplayName(), "count", count.getOrDefault(r.getKey(), 0)));
        return Maps.of("ok", true, "roles", roles, "people", people,
                "canAnnounce", RolePermissions.hasPermission(Role.from(me.get("role")), Permission.NOTIFY_SEND));
    }

    // ───────────────────────── đọc ─────────────────────────
    public Map<String, Object> list(Map<String, Object> me) {
        requireInternal(me);
        String uid = id(me);
        List<Map<String, Object>> out = new ArrayList<>();
        int unread = 0;
        for (Map<String, Object> t : db.list("threads")) {
            if (!isParticipant(t, uid)) continue;
            Map<String, Object> s = summary(t, uid);
            if (Maps.lng(s, "unread") > 0) unread++;
            out.add(s);
        }
        out.sort((a, b) -> Long.compare(ms(b.get("lastAt")), ms(a.get("lastAt"))));
        return Maps.of("ok", true, "threads", out, "unread", unread);
    }

    /** Mở hội thoại: đánh dấu đã đọc (cả chấm chưa đọc trên chuông). */
    public Map<String, Object> open(Map<String, Object> me, String threadId) {
        requireInternal(me);
        String uid = id(me);
        Map<String, Object>[] out = new Map[1];
        db.edit("threads", all -> {
            Map<String, Object> t = findThread(all, threadId);
            if (t == null || !isParticipant(t, uid)) throw HttpError.notFound("Không tìm thấy hội thoại");
            Map<String, Object> read = new LinkedHashMap<>();
            Map<String, Object> old = Maps.map(t.get("readAt"));
            if (old != null) read.putAll(old);
            read.put(uid, Times.iso(core.now()));
            t.put("readAt", read);
            markN(t, uid);
            out[0] = detail(t, uid);
        });
        core.noti.markReadByKey(uid, "thr-" + threadId);
        return out[0];
    }

    // ───────────────────────── gửi ─────────────────────────
    private Map<String, Object> refOf(Map<String, Object> me, String code) {
        String c = code == null ? "" : code.trim();
        if (c.isEmpty()) return null;
        String myGuide = "";
        if (Role.from(me.get("role")) == Role.GUIDE) {
            myGuide = core.canonGuide(Maps.str(me, "guideId"));
            if (myGuide.isEmpty()) myGuide = core.canonGuide(id(me));
        }
        for (Map<String, Object> b : core.bookings()) {
            if (!c.equalsIgnoreCase(Maps.str(b, "payCode")) && !c.equals(Maps.str(b, "id"))) continue;
            if (!myGuide.isEmpty() && !myGuide.equals(core.canonGuide(Maps.str(b, "guideId")))) break;   // HDV chỉ gắn được tour của chính mình
            return Maps.of("bookingId", b.get("id"), "payCode", b.get("payCode"), "tourName", b.get("tourName"), "date", b.get("date"));
        }
        throw HttpError.bad("Không tìm thấy mã đơn / tour \"" + c + "\" (HDV chỉ gắn được tour của chính mình)", "ref");
    }

    /**
     * Tạo hội thoại / thông báo mới. kind = announcement (chỉ ADMIN, quyền {@code notify:send}) hoặc chat (mọi vai trò nội bộ).
     * Người nhận = các vai trò (toRoles, gồm mọi tài khoản đang hoạt động của vai trò đó) + từng người (toUsers).
     */
    public Map<String, Object> create(Map<String, Object> me, String kind, String subject, String text, List<?> toRoles, List<?> toUsers, String refCode) {
        requireInternal(me);
        String k = ANNOUNCEMENT.equals(kind) ? ANNOUNCEMENT : CHAT;
        if (ANNOUNCEMENT.equals(k) && !RolePermissions.hasPermission(Role.from(me.get("role")), Permission.NOTIFY_SEND)) throw HttpError.forbidden();
        String sub = subject == null ? "" : subject.trim();
        String body = text == null ? "" : text.trim();
        if (sub.isEmpty()) throw HttpError.bad("Vui lòng nhập tiêu đề", "subject");
        if (sub.length() > MAX_SUBJECT) throw HttpError.bad("Tiêu đề tối đa " + MAX_SUBJECT + " ký tự", "subject");
        if (body.isEmpty()) throw HttpError.bad("Vui lòng nhập nội dung", "text");
        if (body.length() > MAX_TEXT) throw HttpError.bad("Nội dung tối đa " + MAX_TEXT + " ký tự", "text");

        String uid = id(me);
        Map<String, Map<String, Object>> to = new LinkedHashMap<>();
        if (toRoles != null) {
            for (Object ro : toRoles) {
                Role r = roleOf(ro);
                for (Map<String, Object> a : core.accounts.all())
                    if (Accounts.isActive(a) && Role.from(a.get("role")) == r && !uid.equals(id(a))) to.put(id(a), a);
            }
        }
        if (toUsers != null) {
            for (Object uo : toUsers) {
                Map<String, Object> a = core.accounts.byId(String.valueOf(uo));
                if (a == null || !Accounts.isActive(a) || !internal(a)) throw HttpError.bad("Người nhận không hợp lệ", "to");
                if (!uid.equals(id(a))) to.put(id(a), a);
            }
        }
        if (to.isEmpty()) throw HttpError.bad("Hãy chọn ít nhất một người nhận (không tính chính bạn)", "to");
        if (to.size() > MAX_RECIPIENTS) throw HttpError.bad("Tối đa " + MAX_RECIPIENTS + " người nhận mỗi lần gửi", "to");
        Map<String, Object> ref = refOf(me, refCode);

        String now = Times.iso(core.now());
        String threadId = Ids.newId("th");
        List<Object> participants = new ArrayList<>();
        participants.add(person(me));
        for (Map<String, Object> a : to.values()) participants.add(person(a));
        List<Object> msgs = new ArrayList<>();
        msgs.add(Maps.of("id", Ids.newId("m"), "from", person(me), "to", "", "text", body, "at", now));
        Map<String, Object> t = Maps.of("id", threadId, "kind", k, "subject", sub, "ref", ref, "participants", participants, "createdBy", uid,
                "createdAt", now, "updatedAt", now, "messages", msgs, "readAt", Maps.of(uid, now), "readN", Maps.of(uid, 1));
        db.edit("threads", all -> all.add(t));
        tell(threadId, sub, ANNOUNCEMENT.equals(k), me, body, new ArrayList<>(to.keySet()));
        if (ANNOUNCEMENT.equals(k)) {
            Actor a = Actor.of(me);
            core.audit.log(a.id(), a.name(), a.role(), "notify.announce", threadId, sub + " → " + to.size() + " người");
        }
        return open(me, threadId);
    }

    /**
     * Trả lời trong hội thoại. Với thông báo của Admin: người nhận luôn trả lời RIÊNG cho Admin; Admin trả lời tất cả (to rỗng) hoặc riêng một người.
     */
    public Map<String, Object> reply(Map<String, Object> me, String threadId, String text, String to) {
        requireInternal(me);
        String body = text == null ? "" : text.trim();
        if (body.isEmpty()) throw HttpError.bad("Vui lòng nhập nội dung", "text");
        if (body.length() > MAX_TEXT) throw HttpError.bad("Nội dung tối đa " + MAX_TEXT + " ký tự", "text");
        String uid = id(me);
        String[] subject = new String[1];
        List<String> notify = new ArrayList<>();
        db.edit("threads", all -> {
            Map<String, Object> t = findThread(all, threadId);
            if (t == null || !isParticipant(t, uid)) throw HttpError.notFound("Không tìm thấy hội thoại");
            List<Object> msgs = new ArrayList<>(Maps.list(t.get("messages")));
            if (msgs.size() >= MAX_MESSAGES) throw HttpError.conflict("Hội thoại đã đạt giới hạn " + MAX_MESSAGES + " tin, hãy tạo hội thoại mới", null);
            String target = "";
            String creator = Maps.str(t, "createdBy");
            if (broadcast(t)) {
                if (uid.equals(creator)) {
                    String want = to == null ? "" : to.trim();
                    if (!want.isEmpty()) {
                        if (!isParticipant(t, want) || want.equals(creator)) throw HttpError.bad("Người nhận không thuộc thông báo này", "to");
                        target = want;
                    }
                } else target = creator;
            }
            String now = Times.iso(core.now());
            msgs.add(Maps.of("id", Ids.newId("m"), "from", person(me), "to", target, "text", body, "at", now));
            t.put("messages", msgs);
            t.put("updatedAt", now);
            Map<String, Object> read = new LinkedHashMap<>();
            Map<String, Object> old = Maps.map(t.get("readAt"));
            if (old != null) read.putAll(old);
            read.put(uid, now);
            t.put("readAt", read);
            markN(t, uid);
            subject[0] = Maps.str(t, "subject");
            if (!target.isEmpty()) notify.add(target);
            else for (Object p : Maps.list(t.get("participants"))) notify.add(Maps.str(Maps.map(p), "id"));
        });
        tell(threadId, subject[0], false, me, body, notify);
        return open(me, threadId);
    }

    public void markRead(Map<String, Object> me, String threadId) {
        open(me, threadId);
    }

    public void deleteThread(Map<String, Object> me, String threadId) {
        requireInternal(me);
        String uid = id(me);
        boolean admin = Role.from(me.get("role")) == Role.ADMIN;
        db.edit("threads", all -> all.removeIf(t -> Maps.str(t, "id").equals(threadId) && (admin || uid.equals(Maps.str(t, "createdBy")) || isParticipant(t, uid))));
        core.noti.markReadByKey(uid, "thr-" + threadId);
    }

    public void deleteThreads(Map<String, Object> me, List<?> ids) {
        requireInternal(me);
        String uid = id(me);
        boolean admin = Role.from(me.get("role")) == Role.ADMIN;
        if (ids == null || ids.isEmpty()) {
            db.edit("threads", all -> all.removeIf(t -> admin || uid.equals(Maps.str(t, "createdBy")) || isParticipant(t, uid)));
        } else {
            java.util.Set<String> s = new java.util.HashSet<>();
            for (Object o : ids) s.add(String.valueOf(o));
            db.edit("threads", all -> all.removeIf(t -> s.contains(Maps.str(t, "id")) && (admin || uid.equals(Maps.str(t, "createdBy")) || isParticipant(t, uid))));
        }
    }
}
