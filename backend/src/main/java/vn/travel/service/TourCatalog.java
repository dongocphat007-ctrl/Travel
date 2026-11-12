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
import java.time.LocalDate;
import java.util.*;

/**
 * Danh mục tour phía server — NGUỒN DUY NHẤT cho cả khách lẫn server tính giá:
 *   • tour mẫu công khai: data/tours-detail.json (nhóm "core") và data/tours/{mien-bac,mien-trung,mien-nam,quoc-te}.json
 *   • tour do Admin tạo/sửa: storage/db/admin-tours.json (ghi qua /api/admin/tours/sync) — ghi đè tour mẫu cùng id,
 *     tour Admin ẩn (active=false / hidden=true) biến mất ở mọi nơi, kể cả bản mẫu cùng id.
 * SAMPLE_DATA=false → bỏ toàn bộ tour có id thuộc file mẫu; chỉ còn tour Admin tự tạo (id không trùng tour mẫu).
 */
@Service
public class TourCatalog {
    private static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() { };
    /** group → file. Thứ tự = thứ tự trả về khi không chỉ định nhóm. */
    private static final Map<String, String> GROUP_FILES = new LinkedHashMap<>();
    static {
        GROUP_FILES.put("core", "tours-detail.json");
        GROUP_FILES.put("bac", "tours/mien-bac.json");
        GROUP_FILES.put("trung", "tours/mien-trung.json");
        GROUP_FILES.put("nam", "tours/mien-nam.json");
        GROUP_FILES.put("intl", "tours/quoc-te.json");
    }
    private static final Map<String, String> REGION_GROUP = new LinkedHashMap<>();
    private static final Map<String, String> REGION_RC = new LinkedHashMap<>();
    static {
        REGION_GROUP.put("Miền Bắc", "bac"); REGION_GROUP.put("bac", "bac");
        REGION_GROUP.put("Miền Trung", "trung"); REGION_GROUP.put("trung", "trung");
        REGION_GROUP.put("Miền Nam", "nam"); REGION_GROUP.put("nam", "nam");
        REGION_GROUP.put("Quốc tế", "intl"); REGION_GROUP.put("intl", "intl");

        REGION_RC.put("Miền Bắc", "north"); REGION_RC.put("bac", "north");
        REGION_RC.put("Miền Trung", "central"); REGION_RC.put("trung", "central");
        REGION_RC.put("Miền Nam", "south"); REGION_RC.put("nam", "south");
        REGION_RC.put("Quốc tế", "intl"); REGION_RC.put("intl", "intl");
    }

    private final Path dataDir;
    private final ObjectMapper mapper;
    private final Db db;
    private final boolean sampleData;
    private final Map<String, Object[]> cache = new HashMap<>();   // file → {lastModified, Map root}

    @Autowired
    public TourCatalog(TravelProperties props, ObjectMapper mapper, Db db) {
        this(Paths.get(props.webRoot(), "data"), mapper, db, props.showSample());
    }

    public TourCatalog(Path dataDir, ObjectMapper mapper, Db db) {
        this(dataDir, mapper, db, true);
    }

    public TourCatalog(Path dataDir, ObjectMapper mapper, Db db, boolean sampleData) {
        this.dataDir = dataDir.toAbsolutePath().normalize();
        this.mapper = mapper;
        this.db = db;
        this.sampleData = sampleData;
    }

    @SuppressWarnings("unchecked")
    private synchronized Map<String, Object> root(String rel) {
        Path f = dataDir.resolve(rel);
        try {
            if (!Files.exists(f)) return Map.of();
            long lm = Files.getLastModifiedTime(f).toMillis();
            Object[] c = cache.get(rel);
            if (c != null && (long) c[0] == lm) return (Map<String, Object>) c[1];
            Map<String, Object> root = mapper.readValue(Files.readString(f), OBJ);
            cache.put(rel, new Object[]{lm, root});
            return root;
        } catch (IOException e) {
            return Map.of();
        }
    }

    /** Tour của một file mẫu, theo id (giữ thứ tự file). */
    private Map<String, Map<String, Object>> load(String rel) {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Object o : Maps.list(root(rel).get("tours"))) {
            Map<String, Object> t = Maps.map(o);
            if (t != null && t.get("id") != null) byId.put(String.valueOf(t.get("id")), t);
        }
        return byId;
    }

    /** Tour Admin đã đồng bộ, theo id (trùng id → bản đầu tiên). */
    private Map<String, Map<String, Object>> adminById() {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> t : db.list("admin-tours"))
            if (t.get("id") != null) byId.putIfAbsent(String.valueOf(t.get("id")), t);
        return byId;
    }

    private Set<String> sampleIds() {
        Set<String> ids = new HashSet<>();
        for (String rel : GROUP_FILES.values()) ids.addAll(load(rel).keySet());
        return ids;
    }

    /** Tour Admin bị ẩn: active=false (công tắc trong Admin) hoặc hidden=true. */
    static boolean isHidden(Map<String, Object> t) {
        return Maps.bool(t, "hidden") || Boolean.FALSE.equals(t.get("active"));
    }

    /** Tour theo id (tour Admin ghi đè tour mẫu), hoặc null nếu không có / đang ẩn. */
    public Map<String, Object> find(Object id) {
        if (id == null) return null;
        String key = String.valueOf(id);
        Map<String, Object> a = adminById().get(key);
        if (a != null) return isHidden(a) || (!sampleData && sampleIds().contains(key)) ? null : a;
        if (!sampleData) return null;
        for (String rel : GROUP_FILES.values()) {
            Map<String, Object> t = load(rel).get(key);
            if (t != null) return t;
        }
        return null;
    }

    /** Mọi tour đang hiển thị (đã gộp, bỏ tour ẩn) — dùng cho sitemap.xml, RAG. */
    public List<Map<String, Object>> all() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String g : GROUP_FILES.keySet()) out.addAll(group(g, false));
        return out;
    }

    /** Nhóm của tour Admin tự tạo (id không có trong file mẫu): theo vùng; thiếu vùng → Miền Nam như giao diện cũ. */
    private static String groupOfAdmin(Map<String, Object> t) {
        if (Maps.bool(t, "international") || "Quốc tế".equals(Maps.str(t, "region"))) return "intl";
        return REGION_GROUP.getOrDefault(Maps.str(t, "region"), "nam");
    }

    /**
     * Tour của một nhóm (core|bac|trung|nam|intl): tour Admin tự tạo (mới) được đưa lên ĐẦU TIÊN,
     * sau đó đến tour mẫu theo thứ tự file (bản Admin thay vào đúng chỗ, bản ẩn bị bỏ).
     */
    private List<Map<String, Object>> group(String g, boolean forPublic) {
        Map<String, Map<String, Object>> admin = adminById();
        Set<String> sample = sampleIds();
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        // 1. CÁC TOUR ADMIN TỰ TẠO (isNew / tour mới) LUÔN ĐƯỢC ƯU TIÊN ĐẦU TIÊN
        int i = 0;
        for (Map<String, Object> a : admin.values()) {
            String id = String.valueOf(a.get("id"));
            if (isHidden(a) || sample.contains(id) || !seen.add(id)) continue;
            if ("core".equals(g) || g.equals(groupOfAdmin(a))) {
                Map<String, Object> pub = forPublic ? publicAdminTour(a, i++) : a;
                out.add(pub);
            }
        }

        // 2. CÁC TOUR MẪU THEO THỨ TỰ FILE
        if (sampleData && GROUP_FILES.containsKey(g)) {
            for (Map.Entry<String, Map<String, Object>> e : load(GROUP_FILES.get(g)).entrySet()) {
                String id = e.getKey();
                if (!seen.add(id)) continue;
                Map<String, Object> a = admin.get(id);
                if (a == null) { out.add(e.getValue()); continue; }
                if (!isHidden(a)) out.add(forPublic ? publicAdminTour(a, 100_000 + out.size()) : a);
            }
        }
        return out;
    }

    public List<Map<String, Object>> list() {
        return list(null);
    }

    /** GET /api/tours[?group=] — khóa nhóm không hợp lệ → null. group rỗng/"all" = mọi nhóm. */
    public List<Map<String, Object>> list(String group) {
        if (group == null || group.isBlank() || "all".equals(group)) {
            List<Map<String, Object>> out = new ArrayList<>();
            Map<String, Map<String, Object>> admin = adminById();
            Set<String> sample = sampleIds();
            Set<String> seen = new HashSet<>();
            // Admin tours lên đầu tiên
            for (Map<String, Object> a : admin.values()) {
                String id = String.valueOf(a.get("id"));
                if (isHidden(a) || sample.contains(id) || !seen.add(id)) continue;
                Map<String, Object> pub = publicAdminTour(a, out.size());
                out.add(pub);
            }
            for (String g : GROUP_FILES.keySet()) {
                for (Map<String, Object> t : group(g, true)) {
                    if (seen.add(String.valueOf(t.get("id")))) out.add(t);
                }
            }
            return out;
        }
        return GROUP_FILES.containsKey(group) ? group(group, true) : null;
    }

    /** GET /api/tours/{id} — dạng công khai của một tour đang hiển thị, hoặc null. */
    public Map<String, Object> publicTour(Object id) {
        Map<String, Object> t = find(id);
        if (t == null) return null;
        return adminById().containsKey(String.valueOf(id)) ? publicAdminTour(t, 100_000) : t;
    }

    /** Danh sách toàn bộ tour cho Quản trị viên: Tour tự tạo (mới) lên ĐẦU TIÊN, có cờ isNew và badge new. */
    public List<Map<String, Object>> adminList() {
        Map<String, Map<String, Object>> admin = adminById();
        Set<String> sample = sampleIds();
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        // 1. CÁC TOUR ADMIN TỰ TẠO (MỚI) LUÔN NẰM Ở ĐẦU TIÊN
        for (Map<String, Object> a : admin.values()) {
            String id = String.valueOf(a.get("id"));
            if (sample.contains(id) || !seen.add(id)) continue;
            Map<String, Object> base = new LinkedHashMap<>(a);
            boolean active = !isHidden(a);
            base.put("active", active);
            base.put("isSample", false);
            boolean isNew = isTourNew(a);
            base.put("isNew", isNew);
            if (isNew) base.put("badge", "new");
            else base.remove("badge");
            Map<String, Object> pub = publicAdminTour(base, out.size());
            pub.put("active", active);
            pub.put("isSample", false);
            pub.put("isNew", isNew);
            if (isNew) pub.put("badge", "new");
            else pub.remove("badge");
            out.add(pub);
        }

        // 2. TOUR MẪU
        if (sampleData) {
            for (String g : GROUP_FILES.keySet()) {
                for (Map.Entry<String, Map<String, Object>> e : load(GROUP_FILES.get(g)).entrySet()) {
                    String id = e.getKey();
                    if (!seen.add(id)) continue;
                    Map<String, Object> a = admin.get(id);
                    Map<String, Object> base = a != null ? new LinkedHashMap<>(a) : new LinkedHashMap<>(e.getValue());
                    boolean active = !isHidden(a != null ? a : e.getValue());
                    base.put("active", active);
                    base.put("isSample", true);
                    Map<String, Object> pub = publicAdminTour(base, out.size());
                    pub.put("active", active);
                    pub.put("isSample", true);
                    out.add(pub);
                }
            }
        }
        return out;
    }

    /**
     * Tour Admin (dạng lưu trong trình duyệt Admin: destination, coverEmoji, type, region, international…) → dạng giao diện đọc
     * (dest, emoji, guide, rc, desc…). Các trường Admin sửa được luôn thắng giá trị cũ copy từ tour mẫu.
     */
    static Map<String, Object> publicAdminTour(Map<String, Object> a, int ord) {
        Map<String, Object> t = new LinkedHashMap<>(a);
        boolean intl = Maps.bool(a, "international") || "Quốc tế".equals(Maps.str(a, "region")) || "intl".equalsIgnoreCase(Maps.str(a, "region"));
        String region = intl ? "Quốc tế" : Maps.str(a, "region");
        if ("bac".equalsIgnoreCase(region)) region = "Miền Bắc";
        else if ("trung".equalsIgnoreCase(region)) region = "Miền Trung";
        else if ("nam".equalsIgnoreCase(region)) region = "Miền Nam";
        if (!REGION_GROUP.containsKey(region)) region = "Miền Nam";
        String dest = !Maps.str(a, "destination").isEmpty() ? Maps.str(a, "destination") : Maps.str(a, "dest");
        t.put("price", vn.travel.util.Pricing.num(a.get("price")));
        t.put("region", region);
        t.put("rc", REGION_RC.get(region));
        t.put("dest", dest);
        if (!Maps.str(a, "coverEmoji").isEmpty()) t.put("emoji", a.get("coverEmoji"));
        t.putIfAbsent("emoji", "🧳");
        t.put("guide", "self".equals(Maps.str(a, "type")) || "self".equals(Maps.str(a, "guide")) || "self".equals(Maps.str(a, "guideType")) ? "self" : "guided");
        t.put("type", "self".equals(t.get("guide")) ? "self" : "guided");
        t.putIfAbsent("cat", a.get("tags") instanceof List<?> l && !l.isEmpty() ? String.valueOf(l.get(0)) : "Tour tự tạo");
        if (Maps.str(t, "desc").isEmpty()) t.put("desc", !Maps.str(a, "highlight").isEmpty() ? a.get("highlight") : "Tour " + (dest.isEmpty() ? Maps.str(a, "name") : dest));
        t.putIfAbsent("difficulty", "Dễ");
        t.putIfAbsent("tags", List.of());
        t.putIfAbsent("itinerary", List.of());
        t.putIfAbsent("ord", ord);
        t.put("adminTour", true);
        boolean isNew = isTourNew(a);
        t.put("isNew", isNew);
        if (isNew) {
            t.put("badge", "new");
        } else {
            t.remove("badge");
        }
        if (a.containsKey("newUntil")) {
            t.put("newUntil", a.get("newUntil"));
        } else if (isNew) {
            String cr = Maps.str(a, "createdAt");
            if (!cr.isEmpty()) {
                try {
                    t.put("newUntil", LocalDate.parse(cr.substring(0, 10)).plusDays(30).toString());
                } catch (Exception e) {}
            }
        }
        return t;
    }

    /** Kiểm tra xem tour còn trong thời hạn gắn mác MỚI hay không (mặc định 30 ngày từ khi tạo hoặc theo hạn newUntil). */
    public static boolean isTourNew(Map<String, Object> a) {
        if (a == null) return false;
        String newUntil = Maps.str(a, "newUntil").trim();
        String today = LocalDate.now().toString();
        if (!newUntil.isEmpty()) {
            return newUntil.compareTo(today) >= 0;
        }
        if (Boolean.TRUE.equals(a.get("isNew")) || "new".equals(a.get("badge")) || String.valueOf(a.get("id")).startsWith("tour_")) {
            String created = Maps.str(a, "createdAt");
            if (!created.isEmpty()) {
                try {
                    LocalDate createdDate = LocalDate.parse(created.substring(0, 10));
                    return !createdDate.plusDays(30).isBefore(LocalDate.now());
                } catch (Exception e) {}
            }
            return true;
        }
        return false;
    }

    /** GET /api/locations — toạ độ tour (data/locations.json) cho các tour đang hiển thị, kèm toạ độ do Admin nhập (lat/lng) nếu có. */
    public List<Map<String, Object>> locations() {
        Set<String> visible = new HashSet<>();
        for (Map<String, Object> t : all()) visible.add(String.valueOf(t.get("id")));
        Set<String> known = sampleIds();
        known.addAll(adminById().keySet());
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> have = new HashSet<>();
        for (Object o : Maps.list(root("locations.json").get("locations"))) {
            Map<String, Object> l = Maps.map(o);
            if (l == null) continue;
            String id = Maps.str(l, "tourId");
            if (known.contains(id) && !visible.contains(id)) continue;
            have.add(id);
            out.add(l);
        }
        for (Map<String, Object> a : adminById().values()) {
            String id = String.valueOf(a.get("id"));
            if (have.contains(id) || !visible.contains(id) || !(a.get("lat") instanceof Number la) || !(a.get("lng") instanceof Number lo)) continue;
            if (Math.abs(la.doubleValue()) > 90 || Math.abs(lo.doubleValue()) > 180) continue;
            Map<String, Object> l = new LinkedHashMap<>();
            l.put("tourId", id);
            l.put("country", Maps.str(a, "country").isEmpty() ? "Việt Nam" : a.get("country"));
            l.put("city", Maps.str(a, "city").isEmpty() ? a.get("destination") : a.get("city"));
            l.put("lat", la);
            l.put("lng", lo);
            l.put("approx", true);
            l.put("precision", "city");
            out.add(l);
        }
        return out;
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
