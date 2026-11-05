package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.security.Role;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Nhật ký thao tác (audit.json): ai – vai trò gì – lúc nào – làm gì (TASKS 10.7, 12.7, 14.12, 17.23, 17.25).
 * KHÔNG BAO GIỜ ghi mật khẩu hay token vào đây.
 */
@Service
public class Audit {
    static final int MAX = 5000;
    private final Db db;
    private final Clock clock;

    public Audit(Db db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    public void log(Map<String, Object> actor, String action, String target, String detail) {
        String id = actor == null ? "" : Maps.str(actor, "id");
        String name = actor == null ? "hệ thống" : Maps.str(actor, "name");
        String role = actor == null ? "SYSTEM" : Role.from(actor.get("role")).name();
        log(id, name, role, action, target, detail);
    }

    public void log(String actorId, String actorName, String role, String action, String target, String detail) {
        Map<String, Object> e = Maps.of("id", Ids.newId("au"), "at", Times.iso(clock.millis()), "actorId", actorId == null ? "" : actorId,
                "actorName", actorName == null ? "" : actorName, "role", role == null ? "" : role, "action", action,
                "target", target == null ? "" : target, "detail", detail == null ? "" : detail,
                "by", (actorId == null || actorId.isEmpty() ? "hệ thống" : actorId) + " – " + (role == null ? "" : role));
        db.edit("audit", all -> {
            all.add(e);
            if (all.size() > MAX) all.subList(0, all.size() - MAX).clear();
        });
    }

    /** Nhóm hành động của Điều hành tour: id → (nhãn, các tiền tố action). */
    public static final Map<String, Object[]> OPERATOR_GROUPS = new java.util.LinkedHashMap<>();
    static {
        OPERATOR_GROUPS.put("tour", new Object[]{"Thay đổi tour", List.of("departure.", "tour.", "booking.company_", "booking.cancel")});
        OPERATOR_GROUPS.put("assign", new Object[]{"Phân công HDV", List.of("guide.assign", "guide.replace", "guide.unassign")});
        OPERATOR_GROUPS.put("schedule", new Object[]{"Cập nhật lịch trình", List.of("booking.reschedule", "extension.")});
        OPERATOR_GROUPS.put("incident", new Object[]{"Xử lý sự cố", List.of("incident.")});
        OPERATOR_GROUPS.put("dispatch", new Object[]{"Điều phối chuyến đi", List.of("guide.accept", "guide.reject", "trip.")});
    }

    /** Nhóm của một action (rỗng nếu không thuộc nhóm nào). */
    public static String operatorGroup(String action) {
        for (Map.Entry<String, Object[]> g : OPERATOR_GROUPS.entrySet())
            for (Object p : (List<?>) g.getValue()[1]) if (action.startsWith((String) p)) return g.getKey();
        return "";
    }

    /** Lịch sử hoạt động điều hành: chỉ các action thuộc nhóm {@code group} (rỗng = mọi nhóm), mới nhất trước, mỗi dòng kèm {@code group}. */
    public List<Map<String, Object>> operatorActivity(String group, String q, int limit) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Map<String, Object>> all = db.list("audit"), out = new ArrayList<>();
        for (int i = all.size() - 1; i >= 0 && out.size() < Math.max(1, Math.min(limit, 1000)); i--) {
            Map<String, Object> e = all.get(i);
            String g = operatorGroup(Maps.str(e, "action"));
            if (g.isEmpty() || (group != null && !group.isEmpty() && !group.equals(g))) continue;
            if (!needle.isEmpty() && !(Maps.str(e, "action") + " " + Maps.str(e, "target") + " " + Maps.str(e, "detail") + " " + Maps.str(e, "actorName")).toLowerCase().contains(needle)) continue;
            Map<String, Object> o = new java.util.LinkedHashMap<>(e);
            o.put("group", g);
            out.add(o);
        }
        return out;
    }

    /** Mới nhất trước; lọc theo từ khóa (action/target/detail/người làm) và tiền tố action. */
    public List<Map<String, Object>> list(String q, String actionPrefix, int limit) {
        String needle = q == null ? "" : q.trim().toLowerCase();
        List<Map<String, Object>> all = db.list("audit");
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = all.size() - 1; i >= 0 && out.size() < Math.max(1, Math.min(limit, 1000)); i--) {
            Map<String, Object> e = all.get(i);
            if (actionPrefix != null && !actionPrefix.isEmpty() && !Maps.str(e, "action").startsWith(actionPrefix)) continue;
            if (!needle.isEmpty()) {
                String hay = (Maps.str(e, "action") + " " + Maps.str(e, "target") + " " + Maps.str(e, "detail") + " " + Maps.str(e, "actorId") + " "
                        + Maps.str(e, "actorName")).toLowerCase();
                if (!hay.contains(needle)) continue;
            }
            out.add(e);
        }
        return out;
    }
}
