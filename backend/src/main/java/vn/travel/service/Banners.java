package vn.travel.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Clock;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Banner động (A6): đọc /api/banners/active (server tự tính "active" theo startAt/endAt + công tắc + ưu tiên, giờ server);
 * ghi (Admin) qua SB. Ảnh Admin tải lên lưu vào frontend/img/banners/ (thư mục công khai, kiểm tra loại ảnh bằng magic bytes).
 */
@Service
@SuppressWarnings("unchecked")
public class Banners {
    static final long MAX_IMG = (long) (3.5 * 1024 * 1024);
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern LINK = Pattern.compile("^(#[\\w\\-/]*|/[^\\s]*|https?://[^\\s\"'<>]+)$");
    private static final Pattern IMG = Pattern.compile("^(img/[A-Za-z0-9_\\-./]+|https?://[^\\s\"'<>]+)$");

    private final Db db;
    private final Stats stats;
    private final Clock clock;
    private final Path imgDir;

    @Autowired
    public Banners(Db db, Stats stats, Clock clock, TravelProperties props) {
        this(db, stats, clock, Paths.get(props.webRoot(), "img", "banners"));
        seedIfMissing();
    }

    public Banners(Db db, Stats stats, Clock clock, Path imgDir) {
        this.db = db;
        this.stats = stats;
        this.clock = clock;
        this.imgDir = imgDir.toAbsolutePath().normalize();
    }

    /** Lần chạy đầu (chưa có banners.json): nạp 5 banner tour hot mặc định từ resource seed/banners.json. */
    void seedIfMissing() {
        if (java.nio.file.Files.exists(db.store().dir().resolve("banners.json"))) return;
        try (java.io.InputStream in = Banners.class.getResourceAsStream("/seed/banners.json")) {
            if (in == null) return;
            List<Map<String, Object>> seed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(in, Db.LIST);
            db.edit("banners", all -> all.addAll(seed));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** running | upcoming | expired | off */
    public String status(Map<String, Object> b) {
        if (!Maps.bool(b, "enabled")) return "off";
        long now = clock.millis();
        Long s = Times.parse(b.get("startAt")), e = Times.parse(b.get("endAt"));
        if (s != null && now < s) return "upcoming";
        if (e != null && now >= e) return "expired";
        return "running";
    }

    public Map<String, Object> active() {
        List<Map<String, Object>> run = new ArrayList<>();
        Map<String, Long> rank = new HashMap<>();
        stats.ranking().forEach(r -> rank.put(Maps.str(r, "tourId"), Maps.lng(r, "rank")));
        long now = clock.millis();
        Long next = null;
        for (Map<String, Object> b : db.list("banners")) {
            if (Maps.bool(b, "enabled")) {
                Long s = Times.parse(b.get("startAt")), e = Times.parse(b.get("endAt"));
                if (s != null && s > now && (next == null || s < next)) next = s;
                if (e != null && e > now && (next == null || e < next)) next = e;
            }
            if ("running".equals(status(b))) run.add(b);
        }
        // ưu tiên giảm dần; cùng ưu tiên: banner tour xếp theo hạng tour, rồi theo ngày tạo
        run.sort((a, b) -> {
            int c = Long.compare(Maps.lng(b, "priority"), Maps.lng(a, "priority"));
            if (c != 0) return c;
            c = Long.compare(rank.getOrDefault(Maps.str(a, "tourId"), 9999L), rank.getOrDefault(Maps.str(b, "tourId"), 9999L));
            return c != 0 ? c : Maps.str(a, "createdAt").compareTo(Maps.str(b, "createdAt"));
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("banners", run);
        out.put("serverTime", Times.iso(now));
        out.put("nextChange", next == null ? null : Times.iso(next));
        return out;
    }

    public List<Map<String, Object>> adminList() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : db.list("banners")) {
            Map<String, Object> o = new LinkedHashMap<>(b);
            o.put("status", status(b));
            out.add(o);
        }
        out.sort((a, b) -> Long.compare(Maps.lng(b, "priority"), Maps.lng(a, "priority")));
        return out;
    }

    private Map<String, Object> clean(Map<String, Object> in, Map<String, Object> base) {
        Map<String, Object> b = base == null ? new LinkedHashMap<>() : new LinkedHashMap<>(base);
        String title = Maps.str(in, "title").trim();
        if (title.isEmpty() || title.length() > 90) throw HttpError.bad("Tiêu đề bắt buộc, tối đa 90 ký tự", "title");
        String sub = Maps.str(in, "subtitle").trim();
        if (sub.length() > 220) throw HttpError.bad("Mô tả tối đa 220 ký tự", "subtitle");
        String image = Maps.str(in, "image").trim();
        if (!image.isEmpty() && (!IMG.matcher(image).matches() || image.contains(".."))) throw HttpError.bad("Đường dẫn ảnh không hợp lệ", "image");
        String from = Maps.str(in, "bgFrom").isEmpty() ? "#0f766e" : Maps.str(in, "bgFrom"), to = Maps.str(in, "bgTo").isEmpty() ? "#0ea5e9" : Maps.str(in, "bgTo");
        if (!COLOR.matcher(from).matches() || !COLOR.matcher(to).matches()) throw HttpError.bad("Màu nền không hợp lệ");
        String link = Maps.str(in, "link").trim();
        if (!link.isEmpty() && !LINK.matcher(link).matches() && !"action:login".equals(link)) throw HttpError.bad("Liên kết không hợp lệ (chỉ #mục, /đường-dẫn hoặc https://…)", "link");
        String cta = Maps.str(in, "ctaText").trim();
        if (cta.length() > 30) throw HttpError.bad("Chữ nút tối đa 30 ký tự", "ctaText");
        Long s = Times.parse(in.get("startAt")), e = Times.parse(in.get("endAt"));
        if (s != null && e != null && e <= s) throw HttpError.bad("Hết hạn phải sau thời gian bắt đầu", "endAt");
        double pr = Pricing_num(in.get("priority"));
        b.put("title", title);
        b.put("subtitle", sub);
        b.put("image", image);
        b.put("bgFrom", from);
        b.put("bgTo", to);
        b.put("link", link);
        b.put("ctaText", cta);
        b.put("startAt", s == null ? null : Times.iso(s));
        b.put("endAt", e == null ? null : Times.iso(e));
        b.put("priority", (long) pr);
        b.put("enabled", !Boolean.FALSE.equals(in.get("enabled")) && !"false".equals(in.get("enabled")));
        if (in.get("imageOnly") != null) b.put("imageOnly", Boolean.TRUE.equals(in.get("imageOnly")));
        return b;
    }

    private static double Pricing_num(Object o) {
        return vn.travel.util.Pricing.num(o);
    }

    public Map<String, Object> create(Map<String, Object> in) {
        Map<String, Object> b = clean(in, null);
        b.put("id", Ids.newId("bn"));
        b.put("createdAt", Times.iso(clock.millis()));
        db.edit("banners", all -> all.add(b));
        return b;
    }

    public Map<String, Object> update(String id, Map<String, Object> in) {
        Map<String, Object>[] out = new Map[1];
        db.edit("banners", all -> {
            for (int i = 0; i < all.size(); i++) {
                if (!Maps.str(all.get(i), "id").equals(id)) continue;
                Map<String, Object> b = clean(in, all.get(i));
                all.set(i, b);
                out[0] = b;
                return;
            }
            throw HttpError.notFound("Không tìm thấy banner");
        });
        return out[0];
    }

    public void delete(String id) {
        boolean[] hit = {false};
        db.edit("banners", all -> hit[0] = all.removeIf(b -> Maps.str(b, "id").equals(id)));
        if (!hit[0]) throw HttpError.notFound("Không tìm thấy banner");
    }

    /** POST /api/admin/upload { dataUrl } → { url: "img/banners/up-xxxx.png" } */
    public String upload(String dataUrl) {
        if (dataUrl == null) throw HttpError.bad("Thiếu ảnh");
        int comma = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:image/") || comma < 0 || !dataUrl.substring(0, comma).endsWith(";base64")) throw HttpError.bad("Ảnh không hợp lệ");
        if (dataUrl.length() > MAX_IMG * 4 / 3 + 200) throw HttpError.bad("Ảnh tối đa 3.5MB");
        byte[] raw;
        try { raw = Base64.getDecoder().decode(dataUrl.substring(comma + 1)); } catch (IllegalArgumentException e) { throw HttpError.bad("Ảnh không hợp lệ"); }
        if (raw.length > MAX_IMG) throw HttpError.bad("Ảnh tối đa 3.5MB");
        String ext = sniff(raw);
        if (ext == null) throw HttpError.bad("Chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF");
        String name = "up-" + Ids.hex(6) + "." + ext;
        try {
            Files.createDirectories(imgDir);
            Files.write(imgDir.resolve(name), raw);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return "img/banners/" + name;
    }

    static String sniff(byte[] b) {
        if (b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        if (b.length > 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "gif";
        return null;
    }
}
