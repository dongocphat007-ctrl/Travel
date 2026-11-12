package vn.travel.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.stereotype.Service;

import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Flow;
import vn.travel.util.GuideAvailability;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

/**
 * Hướng dẫn viên (TASKS giai đoạn 5.6–5.10, 6): chỉ thấy tour của CHÍNH MÌNH. Nhận / từ chối tour, điểm danh, bắt đầu / kết thúc chuyến,
 * báo sự cố, xem lịch bận + ngày nghỉ. Không thấy tiền, không thấy tour của HDV khác.
 */
@Service
@SuppressWarnings("unchecked")
public class GuideOps {
    private final Db db;
    private final OpsCore core;

    public GuideOps(Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    /** Id hồ sơ HDV của tài khoản đăng nhập. Tự động liên kết hoặc khởi tạo nếu thiếu để không bao giờ bị lỗi 403. */
    public String profileId(Map<String, Object> account) {
        if (account == null) throw new HttpError(401, "Chưa đăng nhập", "unauthorized");
        String g = Maps.str(account, "guideId");
        if (g.isEmpty()) {
            Map<String, Object> gp = Maps.map(account.get("guideProfile"));
            if (gp != null) g = Maps.str(gp, "guideId");
        }
        if (g.isEmpty()) g = Maps.str(account, "id");
        String canon = core.canonGuide(g);
        if (core.guide(canon) != null) return canon;

        // 1. Thử tìm theo email
        String email = Maps.str(account, "email");
        for (Map<String, Object> p : core.guideProfiles()) {
            if (!email.isEmpty() && email.equalsIgnoreCase(Maps.str(p, "email"))) {
                String gid = Maps.str(p, "id");
                account.put("guideId", gid);
                db.edit("accounts", all -> all.forEach(a -> {
                    if (Maps.str(account, "id").equals(a.get("id"))) a.put("guideId", gid);
                }));
                return gid;
            }
        }

        // 2. Thử tìm theo tên
        String name = Maps.str(account, "name");
        for (Map<String, Object> p : core.guideProfiles()) {
            if (!name.isEmpty() && name.equalsIgnoreCase(Maps.str(p, "name"))) {
                String gid = Maps.str(p, "id");
                account.put("guideId", gid);
                db.edit("accounts", all -> all.forEach(a -> {
                    if (Maps.str(account, "id").equals(a.get("id"))) a.put("guideId", gid);
                }));
                return gid;
            }
        }

        // 3. Thử tìm theo mã số (ví dụ hdv003 -> g3)
        String accId = Maps.str(account, "id");
        if (accId.toLowerCase().startsWith("hdv")) {
            try {
                int num = Integer.parseInt(accId.substring(3));
                String candidate = "g" + num;
                if (core.guide(candidate) != null) {
                    account.put("guideId", candidate);
                    db.edit("accounts", all -> all.forEach(a -> {
                        if (accId.equals(a.get("id"))) a.put("guideId", candidate);
                    }));
                    return candidate;
                }
            } catch (Exception ignored) {}
        }

        // 4. Nếu tài khoản có vai trò guide nhưng chưa có hồ sơ, tự động tạo hồ sơ để không bao giờ bị khoá ngoài
        if ("guide".equalsIgnoreCase(Maps.str(account, "role"))) {
            String gid = !canon.isEmpty() && canon.startsWith("g") ? canon : ("g_" + accId);
            String finalName = name.isEmpty() ? "Hướng dẫn viên" : name;
            Map<String, Object> newProfile = new LinkedHashMap<>();
            newProfile.put("id", gid);
            newProfile.put("name", finalName);
            newProfile.put("phone", Maps.str(account, "phone"));
            newProfile.put("email", email);
            newProfile.put("status", "active");
            newProfile.put("guideType", "all");
            newProfile.put("employmentType", "permanent");
            newProfile.put("languages", List.of("Tiếng Việt", "Tiếng Anh"));
            newProfile.put("regions", List.of("north", "central", "south"));
            newProfile.put("rating", 4.8);
            newProfile.put("toursCount", 0);
            newProfile.put("busyDates", new ArrayList<>());
            newProfile.put("bio", "Hướng dẫn viên nhiệt tình, tận tâm.");

            db.edit("guides", all -> all.add(newProfile));
            account.put("guideId", gid);
            db.edit("accounts", all -> all.forEach(a -> {
                if (accId.equals(a.get("id"))) a.put("guideId", gid);
            }));
            return gid;
        }

        throw new HttpError(403, "Tài khoản chưa được liên kết hồ sơ hướng dẫn viên", "no_guide_profile");
    }

    private Map<String, Object> own(String guideId, String bookingId) {
        Map<String, Object> b = core.find(bookingId);
        if (b == null || !guideId.equals(core.canonGuide(Maps.str(b, "guideId")))) throw HttpError.notFound("Không tìm thấy tour");   // không lộ tour của người khác
        return b;
    }

    public Map<String, Object> myTours(Map<String, Object> account) {
        String gid = profileId(account);
        List<Map<String, Object>> offers = new ArrayList<>(), upcoming = new ArrayList<>(), running = new ArrayList<>(), done = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            if (!gid.equals(core.canonGuide(Maps.str(b, "guideId"))) || Flow.inactive(b.get("status"))) continue;
            String st = Flow.norm(b.get("status"));
            Map<String, Object> v = core.view(b, Role.GUIDE);
            v.put("canStart", canStart(b));
            Map<String, Object> rp = Maps.map(b.get("tourReport"));
            v.put("hasReport", rp != null);
            v.put("reportAt", rp == null ? null : rp.get("updatedAt"));
            switch (st) {
                case Flow.GUIDE_PENDING -> offers.add(v);
                case Flow.GUIDE_ACCEPTED -> upcoming.add(v);
                case Flow.IN_PROGRESS -> running.add(v);
                case Flow.COMPLETED -> done.add(v);
                default -> { }
            }
        }
        Comparator<Map<String, Object>> byDate = (a, c) -> Maps.str(a, "date").compareTo(Maps.str(c, "date"));
        offers.sort(byDate);
        upcoming.sort(byDate);
        done.sort(byDate.reversed());
        return Maps.of("ok", true, "guideId", gid, "offers", offers, "upcoming", upcoming, "running", running, "done", done);
    }

    private boolean canStart(Map<String, Object> b) {
        if (!Flow.GUIDE_ACCEPTED.equals(Flow.norm(b.get("status")))) return false;
        LocalDate d = GuideAvailability.parse(b.get("date"));
        return d != null && !core.today().isBefore(d);
    }

    public Map<String, Object> detail(Map<String, Object> account, String bookingId) {
        return core.view(own(profileId(account), bookingId), Role.GUIDE);
    }

    public Map<String, Object> accept(Map<String, Object> account, String bookingId) {
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);
        Map<String, Object> out = core.edit(bookingId, b -> {
            if (!Flow.GUIDE_PENDING.equals(Flow.norm(b.get("status")))) throw HttpError.conflict("Tour này không còn chờ bạn nhận", "status");
            core.changeStatus(b, Flow.GUIDE_ACCEPTED, me, "HDV nhận tour");
            Map<String, Object> as = new LinkedHashMap<>(Maps.map(b.get("assignment")));
            as.put("status", "accepted");
            as.put("respondedAt", Times.iso(core.now()));
            b.put("assignment", as);
        });
        core.audit.log(me.id(), me.name(), me.role(), "guide.accept", Maps.str(out, "payCode"), "");
        core.notifyRoles("✅ HDV đã nhận tour", Maps.str(out, "guideName") + " nhận đơn " + out.get("payCode"), "operator.html#assign", "gac-" + out.get("id"), Role.OPERATOR);
        // 5.10: báo khách tên và thông tin liên hệ HDV sau khi HDV nhận
        Map<String, Object> gp = core.guide(gid);
        String phone = gp == null ? "" : Maps.str(gp, "phone");
        core.notifyUser(Maps.str(out, "userId"), "🧑‍✈️ Đã có hướng dẫn viên", "Đơn " + out.get("payCode") + ": HDV " + Maps.str(out, "guideName") + " sẽ đồng hành cùng bạn"
                + (phone.isEmpty() ? "." : ". Liên hệ: " + phone + "."), "profile", "gacc-" + out.get("id"));
        return core.view(out, Role.GUIDE);
    }

    public Map<String, Object> reject(Map<String, Object> account, String bookingId, String reason) {
        if (reason == null || reason.trim().length() < 3) throw HttpError.bad("Bắt buộc nhập lý do từ chối", "reason");
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            if (!Flow.GUIDE_PENDING.equals(st)) throw HttpError.conflict("Chỉ từ chối được tour đang chờ nhận (đã nhận rồi hãy báo điều hành)", "status");
            Map<String, Object> as = Maps.map(b.get("assignment"));
            List<Object> rej = new ArrayList<>(as == null ? List.of() : Maps.list(as.get("rejected")));
            rej.add(Maps.of("guideId", gid, "reason", reason.trim(), "at", Times.iso(core.now())));
            core.changeStatus(b, Flow.CONFIRMED, me, "HDV từ chối: " + reason.trim());
            b.remove("guideId");
            b.remove("guideName");
            b.put("assignment", Maps.of("status", "rejected", "rejectReason", reason.trim(), "rejected", rej));
        });
        core.audit.log(me.id(), me.name(), me.role(), "guide.reject", Maps.str(out, "payCode"), reason.trim());
        core.notifyRoles("❌ HDV từ chối tour", "Đơn " + out.get("payCode") + ": " + reason.trim(), "operator.html#assign", "grj-" + out.get("id") + "-" + Maps.list(Maps.map(out.get("assignment")).get("rejected")).size(), Role.OPERATOR);
        return core.view(out, Role.GUIDE);
    }

    public Map<String, Object> start(Map<String, Object> account, String bookingId) {
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);
        Map<String, Object> out = core.edit(bookingId, b -> {
            if (!canStart(b)) throw HttpError.conflict(Flow.GUIDE_ACCEPTED.equals(Flow.norm(b.get("status"))) ? "Chưa tới ngày khởi hành" : "Tour chưa ở trạng thái đã nhận", "status");
            core.changeStatus(b, Flow.IN_PROGRESS, me, "Bắt đầu chuyến đi");
        });
        core.audit.log(me.id(), me.name(), me.role(), "trip.start", Maps.str(out, "payCode"), "");
        core.notifyUser(Maps.str(out, "userId"), "🚌 Chuyến đi bắt đầu", "Tour " + out.get("tourName") + " đã khởi hành. Chúc bạn một chuyến đi vui vẻ!", "profile", "trs-" + out.get("id"));
        return core.view(out, Role.GUIDE);
    }

    public Map<String, Object> end(Map<String, Object> account, String bookingId) {
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);
        Map<String, Object> out = core.edit(bookingId, b -> {
            if (!Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")))) throw HttpError.conflict("Chuyến chưa bắt đầu", "status");
            core.changeStatus(b, Flow.COMPLETED, me, "Kết thúc chuyến đi");
            b.put("completedAt", Times.iso(core.now()));
        });
        core.audit.log(me.id(), me.name(), me.role(), "trip.end", Maps.str(out, "payCode"), "");
        core.rewards().onCompleted(bookingId);   // 7.8 / 7.9 / 7.10
        core.notifyUser(Maps.str(out, "userId"), "🏁 Chuyến đi đã hoàn thành", "Hãy đánh giá tour " + out.get("tourName") + " để giúp người sau.", "profile", "tre-" + out.get("id"));
        return core.view(out, Role.GUIDE);
    }

    /** 7.9: thù lao của chính HDV (chỉ đơn completed), lọc theo tháng yyyy-MM. */
    public Map<String, Object> earnings(Map<String, Object> account, String month) {
        return core.rewards().guideEarnings(profileId(account), month);
    }

    /** Điểm danh: mỗi hành khách present | late (đến trễ, vẫn tính có mặt) | absent (no-show). Chỉ khi đang đi tour hoặc đã nhận và tới ngày đi. */
    public Map<String, Object> checkin(Map<String, Object> account, String bookingId, List<Map<String, Object>> marks) {
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            if (!Flow.IN_PROGRESS.equals(st) && !canStart(b)) throw HttpError.conflict("Chỉ điểm danh được từ ngày khởi hành", "status");
            List<Object> ps = new ArrayList<>(Maps.list(b.get("passengers")));
            int absent = 0;
            for (Map<String, Object> m : marks) {
                int i = (int) Maps.lng(m, "index");
                String s = Maps.str(m, "state");
                if (i < 0 || i >= ps.size()) throw HttpError.bad("Hành khách không tồn tại", "index");
                if (!s.equals("present") && !s.equals("absent") && !s.equals("late")) throw HttpError.bad("Trạng thái điểm danh phải là present, late hoặc absent", "state");
                Map<String, Object> p = new LinkedHashMap<>(Maps.map(ps.get(i)));
                p.put("checkin", s);
                p.put("checkinAt", Times.iso(core.now()));
                ps.set(i, p);
            }
            int late = 0;
            for (Object o : ps) {
                String c = Maps.str(Maps.map(o), "checkin");
                if ("absent".equals(c)) absent++;
                else if ("late".equals(c)) late++;
            }
            b.put("passengers", ps);
            // 6.2: đơn là no_show khi KHÔNG ai có mặt (boolean, để Reviews chặn đánh giá); số người vắng lưu riêng
            boolean allAbsent = !ps.isEmpty() && absent == ps.size();
            b.put("noShow", allAbsent);
            b.put("noShowCount", absent);
            b.put("lateCount", late);
            core.note(b, allAbsent ? "no_show" : "checkin", me, "Điểm danh: vắng " + absent + "/" + ps.size() + (late > 0 ? ", đến trễ " + late : "") + (allAbsent ? " – đơn bị đánh dấu no_show, không được đánh giá" : ""));
        });
        core.audit.log(me.id(), me.name(), me.role(), "trip.checkin", Maps.str(out, "payCode"), "vắng " + out.get("noShowCount"));
        return core.view(out, Role.GUIDE);
    }

    public Map<String, Object> reportIncident(Map<String, Object> account, String bookingId, String type, String severity, String description) {
        if (description == null || description.trim().length() < 5) throw HttpError.bad("Vui lòng mô tả sự cố", "description");
        String gid = profileId(account);
        Actor me = Actor.of(account);
        Map<String, Object> b = own(gid, bookingId);
        String st = Flow.norm(b.get("status"));
        if (!Flow.IN_PROGRESS.equals(st) && !Flow.GUIDE_ACCEPTED.equals(st) && !Flow.COMPLETED.equals(st)) throw HttpError.conflict("Chỉ báo sự cố cho tour mình đã nhận", "status");
        Map<String, Object> i = Maps.of("id", Ids.newId("inc"), "bookingId", b.get("id"), "payCode", b.get("payCode"), "tourName", b.get("tourName"), "date", b.get("date"),
                "type", type == null || type.isBlank() ? "other" : type, "severity", "high".equals(severity) || "low".equals(severity) ? severity : "medium",
                "description", description.trim(), "status", "open", "reportedBy", me.id(), "reportedByName", me.name(), "guideId", gid, "createdAt", Times.iso(core.now()));
        db.edit("incidents", all -> all.add(i));
        core.audit.log(me.id(), me.name(), me.role(), "incident.report", Maps.str(b, "payCode"), description.trim());
        boolean severe = "high".equals(i.get("severity")) || "accident".equals(i.get("type"));
        if (severe) core.notifyRoles("🚨 Sự cố NGHIÊM TRỌNG trong chuyến đi", "Đơn " + b.get("payCode") + ": " + description.trim(), "operator.html#incidents", "inc-" + i.get("id"), Role.OPERATOR, Role.ADMIN);   // 6.5
        else core.notifyRoles("🚨 Sự cố trong chuyến đi", "Đơn " + b.get("payCode") + ": " + description.trim(), "operator.html#incidents", "inc-" + i.get("id"), Role.OPERATOR);
        return i;
    }

    public List<Map<String, Object>> myIncidents(Map<String, Object> account) {
        String gid = profileId(account);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> i : db.list("incidents")) if (gid.equals(Maps.str(i, "guideId"))) out.add(i);
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    // ───────────────────────── báo cáo tour (bản gọn) ─────────────────────────
    /** Số liệu báo cáo lấy từ dữ liệu có sẵn (điểm danh + sự cố) kèm ghi chú đã nộp (nếu có). */
    public Map<String, Object> report(Map<String, Object> account, String bookingId) {
        String gid = profileId(account);
        Map<String, Object> b = own(gid, bookingId);
        List<Object> ps = Maps.list(b.get("passengers"));
        int present = 0, late = 0, absent = 0;
        for (Object o : ps) {
            String c = Maps.str(Maps.map(o), "checkin");
            if ("present".equals(c)) present++;
            else if ("late".equals(c)) late++;
            else if ("absent".equals(c)) absent++;
        }
        List<Map<String, Object>> incidents = new ArrayList<>();
        for (Map<String, Object> i : db.list("incidents"))
            if (Maps.str(b, "id").equals(Maps.str(i, "bookingId")))
                incidents.add(Maps.of("id", i.get("id"), "type", i.get("type"), "severity", i.get("severity"), "description", i.get("description"), "status", i.get("status"), "createdAt", i.get("createdAt")));
        incidents.sort((x, y) -> Maps.str(x, "createdAt").compareTo(Maps.str(y, "createdAt")));
        Map<String, Object> saved = Maps.map(b.get("tourReport"));
        String st = Flow.norm(b.get("status"));
        return Maps.of("ok", true, "report", Maps.of("bookingId", b.get("id"), "payCode", b.get("payCode"), "tourName", b.get("tourName"), "date", b.get("date"),
                "status", st, "statusLabel", Flow.label(st), "total", ps.size(), "present", present + late, "late", late, "absent", absent, "unmarked", ps.size() - present - late - absent,
                "passengers", ps,
                "incidents", incidents, "note", saved == null ? "" : Maps.str(saved, "note"), "submittedAt", saved == null ? null : saved.get("submittedAt"),
                "updatedAt", saved == null ? null : saved.get("updatedAt"), "canSubmit", Flow.COMPLETED.equals(st)));
    }

    /** Nộp / sửa báo cáo sau khi kết thúc tour (hỗ trợ cả ghi chú và cập nhật danh sách điểm danh hành khách). */
    public Map<String, Object> submitReport(Map<String, Object> account, String bookingId, String note) {
        return submitReport(account, bookingId, Maps.of("note", note == null ? "" : note));
    }

    public Map<String, Object> submitReport(Map<String, Object> account, String bookingId, Map<String, Object> body) {
        String n = Maps.str(body, "note").trim();
        if (n.length() > 2000) throw HttpError.bad("Ghi chú tối đa 2000 ký tự", "note");
        String gid = profileId(account);
        Actor me = Actor.of(account);
        own(gid, bookingId);

        List<Object> rawMarks = Maps.list(body.get("marks"));

        Map<String, Object> out = core.edit(bookingId, b -> {
            if (!Flow.COMPLETED.equals(Flow.norm(b.get("status"))))
                throw HttpError.conflict("Chỉ nộp báo cáo sau khi đã kết thúc chuyến đi", "status");

            List<Object> ps = new ArrayList<>(Maps.list(b.get("passengers")));
            if (rawMarks != null && !rawMarks.isEmpty()) {
                for (Object o : rawMarks) {
                    Map<String, Object> m = Maps.map(o);
                    int i = (int) Maps.lng(m, "index");
                    String s = Maps.str(m, "state");
                    if (i >= 0 && i < ps.size()) {
                        Map<String, Object> p = new LinkedHashMap<>(Maps.map(ps.get(i)));
                        if (s.isEmpty()) {
                            p.remove("checkin");
                            p.remove("checkinAt");
                        } else {
                            p.put("checkin", s);
                            p.put("checkinAt", Times.iso(core.now()));
                        }
                        ps.set(i, p);
                    }
                }
                b.put("passengers", ps);
            }

            int present = 0, late = 0, absent = 0;
            for (Object o : ps) {
                String c = Maps.str(Maps.map(o), "checkin");
                if ("present".equals(c)) present++;
                else if ("late".equals(c)) late++;
                else if ("absent".equals(c)) absent++;
            }
            int total = ps.size();
            boolean allAbsent = !ps.isEmpty() && absent == total;
            b.put("noShow", allAbsent);
            b.put("noShowCount", absent);
            b.put("lateCount", late);

            Map<String, Object> old = Maps.map(b.get("tourReport"));
            String now = Times.iso(core.now());
            int incidentCount = 0;
            for (Map<String, Object> i : db.list("incidents")) {
                if (Maps.str(b, "id").equals(Maps.str(i, "bookingId"))) incidentCount++;
            }

            b.put("tourReport", Maps.of(
                "note", n,
                "total", total,
                "present", present + late,
                "late", late,
                "absent", absent,
                "incidentCount", incidentCount,
                "submittedAt", old == null ? now : old.get("submittedAt"),
                "updatedAt", now,
                "byId", me.id(),
                "byName", me.name()
            ));
            core.note(b, "report", me, (old == null ? "HDV nộp báo cáo tour" : "HDV cập nhật báo cáo tour")
                + " (Có mặt: " + (present + late) + "/" + total + ", vắng: " + absent + ")"
                + (n.isEmpty() ? "" : ": " + n));
        });

        Map<String, Object> rp = Maps.map(out.get("tourReport"));
        boolean first = rp.get("submittedAt").equals(rp.get("updatedAt"));
        core.audit.log(me.id(), me.name(), me.role(), "trip.report", Maps.str(out, "payCode"), n);
        if (first) {
            core.notifyRoles("📝 HDV đã nộp báo cáo tour",
                Maps.str(out, "guideName") + " – đơn " + out.get("payCode") + ": có mặt " + rp.get("present") + "/" + rp.get("total") + ", vắng " + rp.get("absent")
                + (n.isEmpty() ? "" : ". Ghi chú: " + (n.length() > 160 ? n.substring(0, 157) + "…" : n)),
                "operator.html#incidents", "rpt-" + out.get("id"), Role.OPERATOR);
        }
        return report(account, bookingId);
    }

    // ───────────────────────── hồ sơ (bản xem) ─────────────────────────
    private static final List<String> PROFILE_KEYS = List.of("id", "name", "avatar", "bio", "title", "languages", "experience", "regions", "provinces", "specialties",
            "certifications", "status", "employmentType", "guideType", "rating", "reviewCount", "toursLed");

    public Map<String, Object> profile(Map<String, Object> account) {
        String gid = profileId(account);
        Map<String, Object> g = core.guide(gid);
        Map<String, Object> p = new LinkedHashMap<>();
        for (String k : PROFILE_KEYS) if (g.containsKey(k)) p.put(k, g.get(k));
        p.put("employmentType", Maps.str(g, "employmentType").isEmpty() ? "staff" : g.get("employmentType"));
        p.put("guideType", OpsCore.guideTypeOf(g));
        int done = 0;
        for (Map<String, Object> b : core.bookings())
            if (gid.equals(core.canonGuide(Maps.str(b, "guideId"))) && Flow.COMPLETED.equals(Flow.norm(b.get("status")))) done++;
        p.put("toursCompleted", done);
        p.put("accountId", account.get("id"));
        p.put("email", Maps.str(account, "email"));
        p.put("phone", Maps.str(account, "phone").isEmpty() ? Maps.str(g, "phone") : Maps.str(account, "phone"));
        return Maps.of("ok", true, "profile", p);
    }

    /** Lịch cá nhân: ngày bận (tour) và ngày nghỉ bù sau tour (chỉ HDV chính thức). */
    public Map<String, Object> schedule(Map<String, Object> account) {
        String gid = profileId(account);
        Map<String, Object> g = core.guide(gid);
        List<Map<String, Object>> trips = new ArrayList<>();
        Set<String> rest = new TreeSet<>(), busy = new TreeSet<>();
        for (Map<String, Object> b : core.bookings()) {
            if (!gid.equals(core.canonGuide(Maps.str(b, "guideId"))) || Flow.inactive(b.get("status"))) continue;
            int n = core.daysOf(b);
            List<String> days = GuideAvailability.rangeDays(b.get("date"), n);
            busy.addAll(days);
            int r = core.restAfter(g, n);
            if (!days.isEmpty()) for (int i = 1; i <= r; i++) rest.add(LocalDate.parse(days.get(days.size() - 1)).plusDays(i).toString());
            trips.add(Maps.of("bookingId", b.get("id"), "payCode", b.get("payCode"), "tourName", b.get("tourName"), "date", b.get("date"), "days", n, "status", Flow.norm(b.get("status")),
                    "statusLabel", Flow.label(Flow.norm(b.get("status")))));
        }
        trips.sort((a, c) -> Maps.str(a, "date").compareTo(Maps.str(c, "date")));
        Set<String> own = new TreeSet<>();
        for (Object d : Maps.list(g.get("busyDates"))) own.add(String.valueOf(d));
        rest.removeAll(busy);
        return Maps.of("ok", true, "guideId", gid, "employmentType", Maps.str(g, "employmentType").isEmpty() ? "staff" : g.get("employmentType"), "trips", trips,
                "busyDays", busy, "restDays", rest, "personalBusy", own);
    }
}