package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Thông báo theo từng tài khoản (tối đa 100/tài khoản) — notifications.json. */
@Service
public class Notifications {
    static final int MAX_PER_USER = 100;
    private final Db db;
    private final Clock clock;

    public Notifications(Db db, Clock clock) {
        this.db = db;
        this.clock = clock;
    }

    /** key != null → mỗi (userId,key) chỉ tạo một lần. */
    public void add(String userId, String type, String title, String body, String link, String key) {
        if (userId == null || userId.isEmpty()) return;
        db.edit("notifications", all -> {
            if (key != null && all.stream().anyMatch(n -> userId.equals(n.get("userId")) && key.equals(n.get("key")))) return;
            all.add(Maps.of("id", Ids.newId("nt"), "userId", userId, "type", type, "title", title, "body", body,
                    "link", link == null ? "" : link, "key", key == null ? "" : key, "read", false,
                    "createdAt", Times.iso(clock.millis())));
            List<Map<String, Object>> mine = all.stream().filter(n -> userId.equals(n.get("userId"))).collect(Collectors.toList());
            if (mine.size() > MAX_PER_USER) {
                Set<Object> drop = new HashSet<>();
                for (int i = 0; i < mine.size() - MAX_PER_USER; i++) drop.add(mine.get(i).get("id"));
                all.removeIf(n -> drop.contains(n.get("id")));
            }
        });
    }

    public Map<String, Object> list(String userId) {
        List<Map<String, Object>> mine = new ArrayList<>();
        for (Map<String, Object> n : db.list("notifications")) if (userId.equals(n.get("userId"))) mine.add(n);
        mine.sort((a, b) -> Maps.str(b, "createdAt").compareTo(Maps.str(a, "createdAt")));
        long unread = mine.stream().filter(n -> !Maps.bool(n, "read")).count();
        return Maps.of("ok", true, "notifications", mine, "unread", unread);
    }

    /** ids == null/rỗng → tất cả. */
    public void markRead(String userId, List<?> ids) {
        Set<String> s = idSet(ids);
        db.edit("notifications", all -> all.forEach(n -> {
            if (userId.equals(n.get("userId")) && (s == null || s.contains(Maps.str(n, "id")))) n.put("read", true);
        }));
    }

    public void delete(String userId, List<?> ids) {
        Set<String> s = idSet(ids);
        db.edit("notifications", all -> all.removeIf(n -> userId.equals(n.get("userId")) && (s == null || s.contains(Maps.str(n, "id")))));
    }

    private static Set<String> idSet(List<?> ids) {
        if (ids == null || ids.isEmpty()) return null;
        Set<String> s = new HashSet<>();
        for (Object o : ids) s.add(String.valueOf(o));
        return s;
    }
}
