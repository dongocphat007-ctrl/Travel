package vn.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Maps;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Đọc tour để server TỰ tính giá (client không gửi giá): data/tours-detail.json, data/tours/*.json (công khai)
 * và tour do Admin đồng bộ (storage/db/admin-tours.json, ghi qua /api/admin/tours/sync).
 */
@Service
public class TourCatalog {
    private static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() { };
    private static final String[] FILES = {"tours-detail.json", "tours/mien-bac.json", "tours/mien-trung.json", "tours/mien-nam.json", "tours/quoc-te.json"};

    private final Path dataDir;
    private final ObjectMapper mapper;
    private final Db db;
    private final Map<String, Object[]> cache = new HashMap<>();   // file → {lastModified, Map id→tour}

    @Autowired
    public TourCatalog(TravelProperties props, ObjectMapper mapper, Db db) {
        this(Paths.get(props.webRoot(), "data"), mapper, db);
    }

    public TourCatalog(Path dataDir, ObjectMapper mapper, Db db) {
        this.dataDir = dataDir.toAbsolutePath().normalize();
        this.mapper = mapper;
        this.db = db;
    }

    @SuppressWarnings("unchecked")
    private synchronized Map<String, Map<String, Object>> load(String rel) {
        Path f = dataDir.resolve(rel);
        try {
            if (!Files.exists(f)) return Map.of();
            long lm = Files.getLastModifiedTime(f).toMillis();
            Object[] c = cache.get(rel);
            if (c != null && (long) c[0] == lm) return (Map<String, Map<String, Object>>) c[1];
            Map<String, Object> root = mapper.readValue(Files.readString(f), OBJ);
            Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
            for (Object o : Maps.list(root.get("tours"))) {
                Map<String, Object> t = Maps.map(o);
                if (t != null && t.get("id") != null) byId.put(String.valueOf(t.get("id")), t);
            }
            cache.put(rel, new Object[]{lm, byId});
            return byId;
        } catch (IOException e) {
            return Map.of();
        }
    }

    /** Tour theo id (ưu tiên tour Admin tạo/sửa), hoặc null. */
    public Map<String, Object> find(Object id) {
        if (id == null) return null;
        String key = String.valueOf(id);
        for (Map<String, Object> t : db.list("admin-tours"))
            if (key.equals(String.valueOf(t.get("id"))) && !Maps.bool(t, "hidden")) return t;
        for (String rel : FILES) {
            Map<String, Object> t = load(rel).get(key);
            if (t != null) return t;
        }
        return null;
    }

    /** Mọi tour đang hiển thị (tour Admin ưu tiên hơn tour mẫu cùng id, bỏ tour bị ẩn) — dùng cho sitemap.xml và về sau cho RAG. */
    public List<Map<String, Object>> all() {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> t : db.list("admin-tours"))
            if (t.get("id") != null && !Maps.bool(t, "hidden")) byId.putIfAbsent(String.valueOf(t.get("id")), t);
        for (String rel : FILES)
            for (Map.Entry<String, Map<String, Object>> e : load(rel).entrySet()) byId.putIfAbsent(e.getKey(), e.getValue());
        return new ArrayList<>(byId.values());
    }

    public String name(String id) {
        Map<String, Object> t = find(id);
        return t == null ? id : Maps.str(t, "name");
    }

    /** Số ngày của tour ("3 ngày 2 đêm" → 3); không đọc được → 1. */
    public static int days(Map<String, Object> tour) {
        String d = Maps.str(tour, "duration").trim();
        int i = 0;
        while (i < d.length() && Character.isDigit(d.charAt(i))) i++;
        try { return Math.max(1, Integer.parseInt(d.substring(0, i))); } catch (NumberFormatException e) { return 1; }
    }

    /** Tour có hướng dẫn viên đi kèm? (tour "self" là tự túc, chỉ có HDV nếu khách thuê). */
    public static boolean hasGuide(Map<String, Object> tour) {
        String g = Maps.str(tour, "guide");
        String t = Maps.str(tour, "type");
        return !("self".equals(g) || "self".equals(t));
    }
}
