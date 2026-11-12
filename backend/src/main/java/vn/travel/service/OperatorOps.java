package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.*;
import vn.travel.web.HttpError;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Điều hành tour (TASKS giai đoạn 5, 9): gán / đổi / gỡ HDV có kiểm tra lịch bận + ngày nghỉ + loại HDV + khu vực,
 * xử lý đơn quá hạn / bị từ chối, chuyến khởi hành (sức chứa, số khách tối thiểu), sự cố, đề xuất hủy tour.
 */
@Service
@SuppressWarnings("unchecked")
public class OperatorOps {
    private final Db db;
    private final OpsCore core;

    public OperatorOps(Db db, OpsCore core) {
        this.db = db;
        this.core = core;
    }

    // ───────────────────────── hàng đợi ─────────────────────────
    public Map<String, Object> queue() {
        List<Map<String, Object>> unassigned = new ArrayList<>(), pending = new ArrayList<>(), accepted = new ArrayList<>(), rejected = new ArrayList<>(), running = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (!core.needsGuide(b)) continue;
            Map<String, Object> v = core.view(b, Role.OPERATOR);
            if (Flow.CONFIRMED.equals(st)) {
                (Maps.map(b.get("assignment")) != null && Maps.list(Maps.map(b.get("assignment")).get("rejected")).size() > 0 ? rejected : unassigned).add(v);
            } else if (Flow.GUIDE_PENDING.equals(st)) pending.add(v);
            else if (Flow.GUIDE_ACCEPTED.equals(st)) accepted.add(v);
            else if (Flow.IN_PROGRESS.equals(st)) running.add(v);
        }
        Comparator<Map<String, Object>> byDate = (a, b) -> Maps.str(a, "date").compareTo(Maps.str(b, "date"));
        unassigned.sort(byDate);
        pending.sort(byDate);
        accepted.sort(byDate);
        rejected.sort(byDate);
        return Maps.of("ok", true, "unassigned", unassigned, "pending", pending, "accepted", accepted, "rejected", rejected, "running", running,
                "departures", departures(), "incidents", incidents("open"), "proposals", proposals("pending"));
    }

    /**
     * Danh sách chuyến khởi hành: số khách, sức chứa, đủ/thiếu khách tối thiểu, HDV (9.1–9.4). Gồm chuyến đã có đơn VÀ chuyến Điều hành
     * đã mở sẵn (departures.json) dù chưa ai đặt. {@code state}: open | closed | cancelled; {@code left} = 0 khi chuyến đóng/hủy.
     */
    public List<Map<String, Object>> departures() {
        Map<String, Map<String, Object>> map = new TreeMap<>();
        Map<String, String> state = new HashMap<>();
        for (Map<String, Object> sd : db.list("departures")) state.put(Maps.str(sd, "id"), Maps.str(sd, "status").isEmpty() ? "open" : Maps.str(sd, "status"));
        int defMin = core.config.i("departure", "defaultMinGuests");
        Map<String, Map<String, Object>> toursById = new HashMap<>();
        for (Map<String, Object> t : core.tours.list()) toursById.put(Maps.str(t, "id"), t);

        for (Map<String, Object> b : core.bookings()) {
            if (Flow.inactive(b.get("status")) || Flow.COMPLETED.equals(Flow.norm(b.get("status")))) continue;
            String tid = Maps.str(b, "tourId");
            String key = Capacity.depKey(tid, b.get("date"));
            Map<String, Object> d = map.computeIfAbsent(key, k -> {
                Map<String, Object> t = toursById.get(tid);
                int max = core.depCapacityRaw(t, tid, b.get("date")), min = Capacity.minGuests(t, defMin);
                return Maps.of("key", k, "tourId", tid, "tourName", b.get("tourName"), "date", b.get("date"), "pax", 0, "capacity", max, "minGuests", min,
                        "orders", 0, "guides", new TreeSet<String>());
            });
            d.put("pax", (int) Maps.lng(d, "pax") + (int) Maps.lng(b, "pax"));
            d.put("orders", (int) Maps.lng(d, "orders") + 1);
            String g = core.canonGuide(Maps.str(b, "guideId"));
            if (!g.isEmpty()) ((Set<String>) d.get("guides")).add(g);
        }
        LocalDate today = core.today();
        for (Map<String, Object> sd : db.list("departures")) {   // chuyến Điều hành đã mở sẵn nhưng chưa có đơn
            String key = Maps.str(sd, "id");
            LocalDate dt = GuideAvailability.parse(sd.get("date"));
            String tid = Maps.str(sd, "tourId");
            Map<String, Object> t = toursById.get(tid);
            if (map.containsKey(key) || t == null || dt == null || dt.isBefore(today) || "cancelled".equals(sd.get("status"))) continue;
            map.put(key, Maps.of("key", key, "tourId", tid, "tourName", t.get("name"), "date", Maps.str(sd, "date"), "pax", 0,
                    "capacity", core.depCapacityRaw(t, tid, sd.get("date")), "minGuests", Capacity.minGuests(t, defMin), "orders", 0, "guides", new TreeSet<String>()));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        int cutoff = core.config.i("departure", "cutoffDaysBeforeTrip");
        for (Map<String, Object> d : map.values()) {
            LocalDate dt = GuideAvailability.parse(d.get("date"));
            long left = dt == null ? 0 : ChronoUnit.DAYS.between(today, dt);
            String st = state.getOrDefault(Maps.str(d, "key"), "open");
            d.put("daysLeft", left);
            d.put("guides", new ArrayList<>((Set<String>) d.get("guides")));
            d.put("state", st);
            d.put("left", "open".equals(st) ? Math.max(0, (int) Maps.lng(d, "capacity") - (int) Maps.lng(d, "pax")) : 0);
            boolean low = Maps.lng(d, "pax") < Maps.lng(d, "minGuests");
            d.put("belowMin", low);
            d.put("atRisk", low && Maps.lng(d, "pax") > 0 && left <= cutoff && !"cancelled".equals(st));   // chuyến trống chưa có khách nào thì chưa có ai bị ảnh hưởng
            d.put("cancelled", "cancelled".equals(st));
            out.add(d);
        }
        out.sort((a, b) -> Maps.str(a, "date").compareTo(Maps.str(b, "date")));
        return out;
    }

    // ───────────────────────── gợi ý HDV ─────────────────────────
    /** Danh sách HDV cho một đơn: rảnh/bận, vì sao, phù hợp loại/khu vực, số tour trong tháng (ít việc xếp trước). */
    public List<Map<String, Object>> candidates(String bookingId) {
        Map<String, Object> b = core.require(bookingId);
        String month = Maps.str(b, "date").length() >= 7 ? Maps.str(b, "date").substring(0, 7) : "";
        int n = core.daysOf(b);
        String from = Maps.str(b, "date");
        if (Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")))) {   // thay HDV giữa chừng: chỉ cần rảnh các ngày còn lại
            from = remainingFrom(b);
            n = remainingDays(b);
        }
        final String start = from;
        final int nd = n;
        List<Map<String, Object>> out = new ArrayList<>();
        List<Map<String, Object>> allBookings = core.bookings();
        Map<String, List<Map<String, Object>>> bookingsByGuide = new HashMap<>();
        for (Map<String, Object> bk : allBookings) {
            if (Flow.inactive(bk.get("status"))) continue;
            String gid = core.canonGuide(Maps.str(bk, "guideId"));
            if (!gid.isEmpty()) bookingsByGuide.computeIfAbsent(gid, k -> new ArrayList<>()).add(bk);
        }
        for (Map<String, Object> g : core.guideProfiles()) {
            String gid = Maps.str(g, "id");
            List<Map<String, Object>> gBookings = bookingsByGuide.getOrDefault(gid, Collections.emptyList());
            List<String> conflicts = core.guideConflicts(g, bookingId, start, nd, gBookings);
            String fit = core.fitProblem(g, b);
            int workload = 0;
            for (Map<String, Object> gbk : gBookings) {
                if (Flow.active(gbk.get("status")) && Maps.str(gbk, "date").startsWith(month)) workload++;
            }
            Map<String, Object> row = Maps.of("id", g.get("id"), "name", g.get("name"), "guideType", OpsCore.guideTypeOf(g), "employmentType", Maps.str(g, "employmentType").isEmpty() ? "staff" : g.get("employmentType"),
                    "regions", g.get("regions") == null ? List.of() : g.get("regions"), "rating", g.get("rating") == null ? 0 : g.get("rating"), "phone", g.get("phone") == null ? "" : g.get("phone"),
                    "workload", workload, "available", conflicts.isEmpty() && fit.isEmpty(), "reasons", conflicts, "fitProblem", fit);
            out.add(row);
        }
        out.sort((a, c) -> {
            int x = Boolean.compare(Maps.bool(c, "available"), Maps.bool(a, "available"));
            return x != 0 ? x : Integer.compare((int) Maps.lng(a, "workload"), (int) Maps.lng(c, "workload"));
        });
        return out;
    }

    // ───────────────────────── gán / đổi / gỡ ─────────────────────────
    public Map<String, Object> assign(Actor op, String bookingId, String guideRaw) {
        Map<String, Object> g = core.guide(guideRaw);
        if (g == null) throw HttpError.notFound("Không tìm thấy hướng dẫn viên");
        Map<String, Object> cur = core.require(bookingId);
        if (!core.needsGuide(cur)) throw HttpError.conflict("Tour tự túc không cần gán HDV", null);
        String gid = Maps.str(g, "id");
        List<String> conflicts = core.guideConflicts(g, bookingId, Maps.str(cur, "date"), core.daysOf(cur));
        if (!conflicts.isEmpty()) throw new HttpError(409, "HDV không nhận được tour này: " + String.join("; ", conflicts), "guide_busy");
        String fit = core.fitProblem(g, cur);
        if (!fit.isEmpty()) throw new HttpError(409, fit, "guide_unfit");
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            Map<String, Object> old = Maps.map(b.get("assignment"));
            List<Object> rejected = old == null ? new ArrayList<>() : new ArrayList<>(Maps.list(old.get("rejected")));
            if (Flow.GUIDE_PENDING.equals(st) || Flow.GUIDE_ACCEPTED.equals(st)) {
                if (gid.equals(core.canonGuide(Maps.str(b, "guideId")))) throw HttpError.conflict("Đơn đã được gán cho HDV này", null);
                core.note(b, "assign", op, "Đổi HDV: " + b.get("guideName") + " → " + g.get("name"));
                if (Flow.GUIDE_ACCEPTED.equals(st)) core.changeStatus(b, Flow.GUIDE_PENDING, op, "Đổi HDV sau khi đã nhận");
            } else if (Flow.CONFIRMED.equals(st)) {
                core.changeStatus(b, Flow.GUIDE_PENDING, op, "Gán HDV " + g.get("name"));
            } else throw HttpError.conflict("Chỉ gán HDV cho đơn đã được admin xác nhận", "status");
            b.remove("guideIssue");
            b.put("guideId", gid);
            b.put("guideName", g.get("name"));
            b.put("assignment", Maps.of("guideId", gid, "status", "pending", "assignedAt", Times.iso(core.now()), "assignedBy", op.id(),
                    "deadline", Times.iso(core.now() + core.config.i("guideResponseHours") * 3_600_000L), "rejected", rejected));
        });
        core.audit.log(op.id(), op.name(), op.role(), "guide.assign", Maps.str(out, "payCode"), Maps.str(g, "name"));
        notifyGuide(g, "📌 Bạn được giao một tour", "Đơn " + out.get("payCode") + " – " + out.get("tourName") + " (" + out.get("date") + "). Vui lòng nhận hoặc từ chối.", "guide.html#tours", "ga-" + out.get("id") + "-" + gid);
        return core.view(out, Role.OPERATOR);
    }

    public Map<String, Object> unassign(Actor op, String bookingId, String reason) {
        Map<String, Object> out = core.edit(bookingId, b -> {
            String st = Flow.norm(b.get("status"));
            if (!Flow.GUIDE_PENDING.equals(st) && !Flow.GUIDE_ACCEPTED.equals(st)) throw HttpError.conflict("Đơn chưa gán HDV", "status");
            String old = Maps.str(b, "guideName");
            core.changeStatus(b, Flow.CONFIRMED, op, "Gỡ HDV " + old + (reason == null || reason.isBlank() ? "" : " – " + reason.trim()));
            b.remove("guideId");
            b.remove("guideName");
            b.remove("assignment");
            b.put("guideIssue", "manual");   // điều hành tự chọn người khác, hệ thống không tự gán
        });
        core.audit.log(op.id(), op.name(), op.role(), "guide.unassign", Maps.str(out, "payCode"), reason == null ? "" : reason);
        return core.view(out, Role.OPERATOR);
    }

    // ───────────────────────── thay HDV giữa chừng (6.6) ─────────────────────────
    private String remainingFrom(Map<String, Object> b) {
        LocalDate start = GuideAvailability.parse(b.get("date"));
        LocalDate t = core.today();
        return (start != null && t.isBefore(start) ? start : t).toString();
    }

    private int remainingDays(Map<String, Object> b) {
        LocalDate end = core.endDate(b), from = GuideAvailability.parse(remainingFrom(b));
        if (end == null || from == null) return 1;
        return (int) Math.max(1, ChronoUnit.DAYS.between(from, end) + 1);
    }

    /**
     * HDV gặp sự cố (ốm, tai nạn...) khi đang đi tour: Điều hành gán người thay. Trạng thái đơn giữ nguyên in_progress,
     * HDV mới nhận tour ngay (có thể bấm kết thúc chuyến), ghi lịch sử và báo khách + HDV mới + HDV cũ.
     */
    public Map<String, Object> replaceGuide(Actor op, String bookingId, String guideRaw, String reason) {
        Map<String, Object> cur = core.require(bookingId);
        if (!Flow.IN_PROGRESS.equals(Flow.norm(cur.get("status")))) throw HttpError.conflict("Chỉ thay HDV giữa chừng cho đơn đang đi tour (đơn khác dùng chức năng gán / đổi HDV)", "status");
        if (reason == null || reason.trim().length() < 2) throw HttpError.bad("Bắt buộc nhập lý do thay HDV", "reason");
        Map<String, Object> g = core.guide(guideRaw);
        if (g == null) throw HttpError.notFound("Không tìm thấy hướng dẫn viên");
        String gid = Maps.str(g, "id"), oldId = core.canonGuide(Maps.str(cur, "guideId"));
        if (gid.equals(oldId)) throw HttpError.conflict("Đơn đang do HDV này dẫn", null);
        List<String> conflicts = core.guideConflicts(g, bookingId, remainingFrom(cur), remainingDays(cur));
        if (!conflicts.isEmpty()) throw new HttpError(409, "HDV không nhận được phần còn lại của tour: " + String.join("; ", conflicts), "guide_busy");
        String fit = core.fitProblem(g, cur);
        if (!fit.isEmpty()) throw new HttpError(409, fit, "guide_unfit");
        String oldName = Maps.str(cur, "guideName");
        Map<String, Object> out = core.edit(bookingId, b -> {
            if (!Flow.IN_PROGRESS.equals(Flow.norm(b.get("status")))) throw HttpError.conflict("Chỉ thay HDV giữa chừng cho đơn đang đi tour", "status");
            List<Object> hist = new ArrayList<>(Maps.list(b.get("guideHistory")));
            hist.add(Maps.of("guideId", oldId, "guideName", oldName, "replacedAt", Times.iso(core.now()), "reason", reason.trim(), "by", op.id()));
            b.put("guideHistory", hist);
            b.put("guideId", gid);
            b.put("guideName", g.get("name"));
            b.put("assignment", Maps.of("guideId", gid, "status", "accepted", "assignedAt", Times.iso(core.now()), "assignedBy", op.id(), "respondedAt", Times.iso(core.now()),
                    "replacedFrom", oldId, "rejected", List.of()));
            core.note(b, "assign", op, "Thay HDV giữa chừng: " + oldName + " → " + g.get("name") + " – " + reason.trim());
        });
        core.audit.log(op.id(), op.name(), op.role(), "guide.replace", Maps.str(out, "payCode"), oldName + " → " + Maps.str(g, "name") + ": " + reason.trim());
        notifyGuide(g, "📌 Bạn được giao dẫn tiếp một tour đang đi", "Đơn " + out.get("payCode") + " – " + out.get("tourName") + ". Lý do thay HDV: " + reason.trim(), "guide.html#tours", "gr-" + out.get("id") + "-" + gid);
        Map<String, Object> oldG = oldId.isEmpty() ? null : core.guide(oldId);
        if (oldG != null) notifyGuide(oldG, "ℹ️ Tour đã được giao cho HDV khác", "Đơn " + out.get("payCode") + " do " + g.get("name") + " dẫn tiếp.", "guide.html#tours", "gro-" + out.get("id") + "-" + oldId);
        String phone = Maps.str(g, "phone");
        core.notifyUser(Maps.str(out, "userId"), "🔄 Đổi hướng dẫn viên", "Đơn " + out.get("payCode") + ": HDV " + g.get("name") + " sẽ dẫn tiếp chuyến đi của bạn" + (phone.isEmpty() ? "." : ". Liên hệ: " + phone + "."), "profile", "grc-" + out.get("id") + "-" + gid);
        return core.view(out, Role.OPERATOR);
    }

    /** Quá hạn HDV trả lời → gỡ gán, đưa về hàng đợi, báo điều hành (5.8). Trả số đơn xử lý. Gọi bởi OpsSweeper. */
    public int expireAssignments() {
        int n = 0;
        for (Map<String, Object> b : core.bookings()) {
            if (!Flow.GUIDE_PENDING.equals(Flow.norm(b.get("status")))) continue;
            Map<String, Object> as = Maps.map(b.get("assignment"));
            Long dl = as == null ? null : Times.parse(as.get("deadline"));
            if (dl == null || dl > core.now()) continue;
            String id = Maps.str(b, "id");
            Map<String, Object> out = core.edit(id, x -> {
                if (!Flow.GUIDE_PENDING.equals(Flow.norm(x.get("status")))) return;
                Map<String, Object> a = Maps.map(x.get("assignment"));
                List<Object> rej = new ArrayList<>(a == null ? List.of() : Maps.list(a.get("rejected")));
                rej.add(Maps.of("guideId", Maps.str(x, "guideId"), "reason", "Quá hạn không trả lời", "at", Times.iso(core.now())));
                core.changeStatus(x, Flow.CONFIRMED, Actor.system(), "HDV không trả lời đúng hạn – gỡ gán");
                x.remove("guideId");
                x.remove("guideName");
                x.put("assignment", Maps.of("status", "expired", "rejected", rej));
            });
            core.notifyRoles("⏰ HDV không trả lời đúng hạn", "Đơn " + out.get("payCode") + " cần gán lại HDV.", "operator.html#assign", "gx-" + id + "-" + Maps.list(Maps.map(out.get("assignment")).get("rejected")).size(), Role.OPERATOR);
            n++;
        }
        return n;
    }

    // ───────────────────────── tự gán HDV (5.4, 5.5, 5.8, 5.9) ─────────────────────────
    /**
     * Đơn đã được admin xác nhận mà chưa có HDV (hoặc HDV cũ từ chối / quá hạn) → hệ thống tự gán rồi báo điều hành:
     *  • khách CÓ chọn HDV: chỉ gán đúng người đó nếu rảnh; bận / đã từ chối thì báo điều hành + CSKH liên hệ khách chọn lại, KHÔNG tự đổi người (5.4);
     *  • khách không chọn: lọc theo loại + khu vực + lịch rảnh (kể cả ngày nghỉ), bỏ người đã từ chối, chọn người ít tour tháng này, bằng nhau thì chọn ngẫu nhiên (5.5, 5.8);
     *  • không còn ai rảnh: báo điều hành + admin, đơn cần xử lý tay (đổi ngày hoặc hoàn tiền) (5.9).
     * Đơn đã được báo (guideIssue) thì bỏ qua cho tới khi điều hành tự gán. Gọi bởi OpsSweeper. Trả số đơn đã tự gán.
     */
    public int autoAssignPending() {
        int n = 0;
        for (Map<String, Object> b : core.bookings()) {
            if (!Flow.CONFIRMED.equals(Flow.norm(b.get("status"))) || !core.needsGuide(b)) continue;
            if (!Maps.str(b, "guideIssue").isEmpty()) continue;
            if (autoAssign(Maps.str(b, "id"))) n++;
        }
        return n;
    }

    boolean autoAssign(String bookingId) {
        Map<String, Object> b = core.require(bookingId);
        if (!Flow.CONFIRMED.equals(Flow.norm(b.get("status"))) || !core.needsGuide(b)) return false;
        String date = Maps.str(b, "date");
        int days = core.daysOf(b);
        String chosen = core.canonGuide(Maps.str(b, "guideId"));
        if (Maps.bool(b, "guideChosen")) {
            Map<String, Object> g = chosen.isEmpty() ? null : core.guide(chosen);
            if (g == null) { flagGuideIssue(b, "chosen_declined", "HDV khách đã chọn đã từ chối hoặc quá hạn trả lời – liên hệ khách chọn lại HDV"); return false; }
            List<String> conflicts = core.guideConflicts(g, bookingId, date, days);
            String fit = core.fitProblem(g, b);
            if (!conflicts.isEmpty() || !fit.isEmpty()) {
                flagGuideIssue(b, "chosen_busy", "HDV khách chọn (" + g.get("name") + ") không nhận được: " + String.join("; ", conflicts) + (fit.isEmpty() ? "" : " " + fit) + " – liên hệ khách chọn lại");
                return false;
            }
            return tryAssign(b, chosen);
        }
        Set<String> declined = new HashSet<>();
        Map<String, Object> as = Maps.map(b.get("assignment"));
        if (as != null) for (Object o : Maps.list(as.get("rejected"))) { Map<String, Object> r = Maps.map(o); if (r != null) declined.add(core.canonGuide(Maps.str(r, "guideId"))); }
        String month = date.length() >= 7 ? date.substring(0, 7) : "";
        List<Map<String, Object>> pool = new ArrayList<>();
        for (Map<String, Object> g : core.guideProfiles()) {
            if (declined.contains(Maps.str(g, "id"))) continue;
            if (!core.guideConflicts(g, bookingId, date, days).isEmpty() || !core.fitProblem(g, b).isEmpty()) continue;
            pool.add(g);
        }
        if (pool.isEmpty()) {
            flagGuideIssue(b, "none_free", "Không còn HDV nào rảnh và phù hợp – cần xử lý tay (đổi ngày hoặc hoàn tiền)");
            return false;
        }
        int min = Integer.MAX_VALUE;
        for (Map<String, Object> g : pool) min = Math.min(min, core.workload(Maps.str(g, "id"), month));
        List<Map<String, Object>> least = new ArrayList<>();
        for (Map<String, Object> g : pool) if (core.workload(Maps.str(g, "id"), month) == min) least.add(g);
        Map<String, Object> pick = least.get(java.util.concurrent.ThreadLocalRandom.current().nextInt(least.size()));
        return tryAssign(b, Maps.str(pick, "id"));
    }

    private boolean tryAssign(Map<String, Object> b, String guideId) {
        try {
            assign(Actor.system(), Maps.str(b, "id"), guideId);
            return true;
        } catch (HttpError e) {
            flagGuideIssue(b, "none_free", "Không tự gán được HDV: " + e.getMessage());
            return false;
        }
    }

    private void flagGuideIssue(Map<String, Object> b, String code, String text) {
        String id = Maps.str(b, "id");
        core.edit(id, x -> {
            x.put("guideIssue", code);
            core.note(x, "guide_issue", Actor.system(), text);
        });
        String title = "none_free".equals(code) ? "🚨 Không còn HDV rảnh" : "📞 Cần liên hệ khách chọn lại HDV";
        String body = "Đơn " + b.get("payCode") + " – " + b.get("tourName") + " (" + b.get("date") + "): " + text;
        if ("none_free".equals(code)) core.notifyRoles(title, body, "operator.html#assign", "gi-" + id + "-" + code, Role.OPERATOR, Role.ADMIN);
        else core.notifyRoles(title, body, "operator.html#assign", "gi-" + id + "-" + code, Role.OPERATOR, Role.SUPPORT);
    }

    // ───────────────────────── lịch HDV theo tháng (5.14) ─────────────────────────
    /** Lịch tháng của từng HDV: ngày bận (lịch riêng), ngày có tour (kèm mã đơn), ngày nghỉ sau tour. month = "yyyy-MM". */
    public Map<String, Object> guideCalendar(String month) {
        LocalDate first = GuideAvailability.parse((month == null ? "" : month) + "-01");
        if (first == null) first = core.today().withDayOfMonth(1);
        String ym = first.toString().substring(0, 7);
        int len = first.lengthOfMonth();
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, List<Map<String, Object>>> bookingsByGuide = new HashMap<>();
        for (Map<String, Object> b : core.bookings()) {
            if (Flow.inactive(b.get("status"))) continue;
            String gid = core.canonGuide(Maps.str(b, "guideId"));
            if (!gid.isEmpty()) bookingsByGuide.computeIfAbsent(gid, k -> new ArrayList<>()).add(b);
        }
        for (Map<String, Object> g : core.guideProfiles()) {
            Map<String, Object> days = new TreeMap<>();
            for (Object d : Maps.list(g.get("busyDates"))) if (String.valueOf(d).startsWith(ym)) days.put(String.valueOf(d), Maps.of("kind", "busy", "label", "Bận"));
            String gid = Maps.str(g, "id");
            List<Map<String, Object>> gBookings = bookingsByGuide.getOrDefault(gid, Collections.emptyList());
            for (Map<String, Object> b : gBookings) {
                int n = core.daysOf(b);
                List<String> range = GuideAvailability.rangeDays(b.get("date"), n);
                for (String d : range) if (d.startsWith(ym)) days.put(d, Maps.of("kind", "tour", "label", Maps.str(b, "payCode") + " – " + Maps.str(b, "tourName"), "bookingId", b.get("id"), "status", Flow.norm(b.get("status"))));
                int rest = core.restAfter(g, n);
                if (!range.isEmpty() && rest > 0) {
                    LocalDate last = LocalDate.parse(range.get(range.size() - 1));
                    for (int i = 1; i <= rest; i++) { String d = last.plusDays(i).toString(); if (d.startsWith(ym) && !days.containsKey(d)) days.put(d, Maps.of("kind", "rest", "label", "Nghỉ sau tour")); }
                }
            }
            rows.add(Maps.of("id", gid, "name", g.get("name"), "guideType", OpsCore.guideTypeOf(g), "employmentType", Maps.str(g, "employmentType").isEmpty() ? "staff" : g.get("employmentType"), "off", "off".equals(g.get("status")), "days", days));
        }
        return Maps.of("month", ym, "length", len, "guides", rows);
    }

    private void notifyGuide(Map<String, Object> g, String title, String body, String link, String key) {
        for (Map<String, Object> a : core.accounts.all())
            if (Maps.str(g, "id").equals(Maps.str(a, "guideId")) && Accounts.isActive(a)) core.notifyUser(Maps.str(a, "id"), title, body, link, key);
    }

    // ───────────────────────── sự cố ─────────────────────────
    public List<Map<String, Object>> incidents(String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> i : db.list("incidents")) if (status == null || status.isEmpty() || status.equals(Maps.str(i, "status"))) out.add(i);
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    /** status: acknowledged | resolved; resolved bắt buộc ghi cách xử lý. */
    public Map<String, Object> handleIncident(Actor op, String id, String status, String note) {
        if (!Set.of("acknowledged", "resolved").contains(status == null ? "" : status)) throw HttpError.bad("Trạng thái phải là acknowledged hoặc resolved", "status");
        if ("resolved".equals(status) && (note == null || note.isBlank())) throw HttpError.bad("Vui lòng ghi cách xử lý", "note");
        Map<String, Object>[] out = new Map[1];
        db.edit("incidents", all -> {
            for (Map<String, Object> i : all) {
                if (!id.equals(Maps.str(i, "id"))) continue;
                if ("resolved".equals(i.get("status"))) throw HttpError.conflict("Sự cố đã xử lý xong", null);
                i.put("status", status);
                i.put("handledBy", op.id());
                i.put("handledByName", op.name());
                i.put("handledAt", Times.iso(core.now()));
                if (note != null && !note.isBlank()) i.put("resolution", note.trim());
                out[0] = i;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy sự cố");
        core.audit.log(op.id(), op.name(), op.role(), "incident." + status, Maps.str(out[0], "payCode"), note == null ? "" : note);
        return out[0];
    }

    // ───────────────────────── đề xuất hủy / dồn tour ─────────────────────────
    public List<Map<String, Object>> proposals(String status) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> p : db.list("cancelproposals")) if (status == null || status.isEmpty() || status.equals(Maps.str(p, "status"))) out.add(p);
        out.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        return out;
    }

    public Map<String, Object> proposeCancel(Actor op, String tourId, String date, String reason) {
        if (reason == null || reason.isBlank()) throw HttpError.bad("Bắt buộc nhập lý do đề xuất", "reason");
        Map<String, Object> dep = null;
        for (Map<String, Object> d : departures()) if (tourId.equals(Maps.str(d, "tourId")) && date.equals(Maps.str(d, "date"))) dep = d;
        if (dep == null) throw HttpError.notFound("Không có chuyến khởi hành này");
        for (Map<String, Object> p : proposals("pending"))
            if (tourId.equals(Maps.str(p, "tourId")) && date.equals(Maps.str(p, "date"))) throw HttpError.conflict("Đã có đề xuất đang chờ duyệt cho chuyến này", null);
        Map<String, Object> p = Maps.of("id", Ids.newId("cp"), "tourId", tourId, "tourName", dep.get("tourName"), "date", date, "pax", dep.get("pax"), "minGuests", dep.get("minGuests"),
                "reason", reason.trim(), "status", "pending", "proposedBy", op.id(), "proposedByName", op.name(), "createdAt", Times.iso(core.now()));
        db.edit("cancelproposals", all -> all.add(p));
        core.audit.log(op.id(), op.name(), op.role(), "tour.cancel_propose", tourId + "@" + date, reason.trim());
        core.notifyRoles("📝 Đề xuất hủy chuyến", dep.get("tourName") + " ngày " + date + ": " + reason.trim(), "admin.html#company-cancel", "cp-" + p.get("id"), Role.ADMIN);
        return p;
    }

    /** Admin chốt đề xuất (gọi từ controller sau khi companyCancel chạy hoặc khi bác bỏ). */
    public Map<String, Object> decideProposal(Actor admin, String id, boolean approved, String note) {
        Map<String, Object>[] out = new Map[1];
        db.edit("cancelproposals", all -> {
            for (Map<String, Object> p : all) {
                if (!id.equals(Maps.str(p, "id"))) continue;
                if (!"pending".equals(p.get("status"))) throw HttpError.conflict("Đề xuất đã được xử lý", null);
                p.put("status", approved ? "approved" : "rejected");
                p.put("decidedBy", admin.id());
                p.put("decidedAt", Times.iso(core.now()));
                p.put("decisionNote", note == null ? "" : note.trim());
                out[0] = p;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy đề xuất");
        return out[0];
    }


    /** 9.1: Điều hành đặt sức chứa riêng cho một chuyến (không vượt sức chứa tối đa của tour, không thấp hơn số khách đã đặt) và mở/đóng đặt chỗ. */
    public Map<String, Object> setDeparture(Actor op, String tourId, String date, Integer capacity, String status) {
        Map<String, Object> tour = core.tourOf(Maps.of("tourId", tourId));
        if (tour == null) throw HttpError.notFound("Không tìm thấy tour");
        LocalDate d = GuideAvailability.parse(date);
        if (d == null) throw HttpError.bad("Ngày không hợp lệ", "date");
        if (status != null && !Set.of("open", "closed").contains(status)) throw HttpError.bad("Trạng thái phải là open hoặc closed", "status");
        int tourMax = Capacity.maxGuests(tour, core.config.i("departure", "defaultCapacity"));
        int booked = 0;
        for (Map<String, Object> b : core.bookings())
            if (tourId.equals(Maps.str(b, "tourId")) && date.equals(Maps.str(b, "date")) && Flow.active(b.get("status"))) booked += (int) Maps.lng(b, "pax");
        if (d.isBefore(core.today()) && booked == 0) throw HttpError.bad("Không mở chuyến ở ngày đã qua", "date");
        if (capacity != null) {
            if (capacity < 1) throw HttpError.bad("Sức chứa phải từ 1", "capacity");
            if (capacity > tourMax) throw HttpError.bad("Không vượt sức chứa tối đa của tour (" + tourMax + "); chỉ Admin được nâng sức chứa tour", "capacity");
            if (capacity < booked) throw HttpError.conflict("Đã có " + booked + " khách đặt, không đặt sức chứa thấp hơn", "capacity");
        }
        String key = Capacity.depKey(tourId, date);
        Map<String, Object>[] out = new Map[1];
        db.edit("departures", all -> {
            Map<String, Object> dep = null;
            for (Map<String, Object> x : all) if (key.equals(Maps.str(x, "id"))) dep = x;
            if (dep == null) { dep = Maps.of("id", key, "tourId", tourId, "date", date, "status", "open"); all.add(dep); }
            if (capacity != null) dep.put("capacity", capacity);
            if (status != null) dep.put("status", status);
            dep.put("updatedBy", op.id());
            dep.put("updatedAt", Times.iso(core.now()));
            out[0] = dep;
        });
        core.audit.log(op.id(), op.name(), op.role(), "departure.update", key, (capacity == null ? "" : "capacity=" + capacity + " ") + (status == null ? "" : "status=" + status));
        return out[0];
    }

    /** 10.6: danh sách khách của một chuyến (đầy đủ CCCD, chỉ vai trò được phép gọi). */
    public List<Map<String, Object>> manifest(String tourId, String date) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : core.bookings()) {
            if (!tourId.equals(Maps.str(b, "tourId")) || !date.equals(Maps.str(b, "date")) || Flow.inactive(b.get("status")) || Flow.PENDING_PAYMENT.equals(Flow.norm(b.get("status")))) continue;
            for (Map<String, Object> p : OpsCore.passengers(b, false))
                out.add(Maps.of("payCode", b.get("payCode"), "contact", b.get("customerName"), "phone", b.get("phone"), "name", p.get("name"), "dob", p.get("dob"), "gender", p.get("gender"),
                        "idNumber", p.get("idNumber"), "note", Maps.str(b, "specialRequest")));
        }
        return out;
    }

    /** Số liệu cho điều hành (15.x): đơn, chuyến sắp đi, tình trạng phân bổ HDV. */
    public Map<String, Object> stats() {
        int unassigned = 0, pending = 0, accepted = 0, upcoming = 0;
        LocalDate today = core.today();
        for (Map<String, Object> b : core.bookings()) {
            String st = Flow.norm(b.get("status"));
            if (!core.needsGuide(b)) continue;
            if (Flow.CONFIRMED.equals(st)) unassigned++;
            else if (Flow.GUIDE_PENDING.equals(st)) pending++;
            else if (Flow.GUIDE_ACCEPTED.equals(st)) accepted++;
            LocalDate d = GuideAvailability.parse(b.get("date"));
            if (Flow.active(st) && d != null && !d.isBefore(today) && d.isBefore(today.plusDays(8))) upcoming++;
        }
        return Maps.of("unassigned", unassigned, "guidePending", pending, "guideAccepted", accepted, "upcoming7d", upcoming,
                "openIncidents", incidents("open").size(), "atRiskDepartures", departures().stream().filter(d -> Maps.bool(d, "atRisk")).count());
    }
}