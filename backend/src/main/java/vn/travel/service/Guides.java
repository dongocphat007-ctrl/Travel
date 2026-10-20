package vn.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.GuideAvailability;
import vn.travel.util.Maps;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

/**
 * Guide (G5): đọc hồ sơ + lịch bận. Ngày bận trả ra = busyDates trong hồ sơ ∪ các ngày đang bị đơn (chưa hủy) giữ.
 * Hồ sơ gốc lấy từ data/guides-seed.json (công khai), đồng bộ vào storage/db/guides.json lúc khởi động
 * (guide demo:true theo file seed; guide không demo được giữ nguyên).
 */
@Service
public class Guides {
    private final Db db;

    @Autowired
    public Guides(Db db, TravelProperties props, ObjectMapper mapper) {
        this(db, Paths.get(props.webRoot(), "data", "guides-seed.json"), mapper);
    }

    public Guides(Db db, Path seedFile, ObjectMapper mapper) {
        this.db = db;
        try {
            if (Files.exists(seedFile)) {
                List<Map<String, Object>> seed = mapper.readValue(Files.readString(seedFile), Db.LIST);
                db.edit("guides", all -> {
                    all.removeIf(g -> Maps.bool(g, "demo"));
                    for (Map<String, Object> s : seed) {
                        Map<String, Object> g = new LinkedHashMap<>(s);
                        g.put("demo", true);
                        all.add(g);
                    }
                });
            }
        } catch (IOException ignored) {
            // không có file seed → dùng guides.json hiện có
        }
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> bookings = db.list("bookings");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> g : db.list("guides")) out.add(withBusy(g, bookings));
        return out;
    }

    public Map<String, Object> get(String id) {
        for (Map<String, Object> g : list()) if (Maps.str(g, "id").equals(id)) return g;
        return null;
    }

    private static Map<String, Object> withBusy(Map<String, Object> g, List<Map<String, Object>> bookings) {
        Set<String> busy = new TreeSet<>();
        for (Object d : Maps.list(g.get("busyDates"))) busy.add(String.valueOf(d));
        String id = Maps.str(g, "id");
        for (Map<String, Object> b : bookings) {
            if (!id.equals(Maps.str(b, "guideId")) || "cancelled".equals(b.get("status"))) continue;
            busy.addAll(GuideAvailability.rangeDays(b.get("date"), tourDays(b)));
        }
        Map<String, Object> o = new LinkedHashMap<>(g);
        o.put("busyDates", new ArrayList<>(busy));
        return o;
    }

    static int tourDays(Map<String, Object> b) {
        long d = Maps.lng(b, "tourDays");
        if (d >= 1) return (int) d;
        return Math.max(1, (int) Maps.lng(Maps.of("v", Maps.str(b, "tourDuration").replaceAll("^\\s*(\\d+).*$", "$1")), "v"));
    }
}
