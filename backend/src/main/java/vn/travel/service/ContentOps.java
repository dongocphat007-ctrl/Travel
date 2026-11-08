package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.security.Role;
import vn.travel.service.OpsCore.Actor;
import vn.travel.store.Db;
import vn.travel.util.Ids;
import vn.travel.util.Maps;
import vn.travel.util.Times;
import vn.travel.web.HttpError;

import java.util.*;

/**
 * Biên tập nội dung (TASKS giai đoạn 12–13): CONTENT sửa tour ở BẢN NHÁP (chờ ADMIN duyệt mới lên trang), quản lý ẩm thực,
 * ẩn/hiện đánh giá vi phạm. CONTENT KHÔNG đụng được trường nhạy cảm (giá, loại HDV, cho phép gia hạn, sức chứa) – chỉ ADMIN.
 */
@Service
@SuppressWarnings("unchecked")
public class ContentOps {
    /** Trường biên tập viên được sửa trong bản nháp. */
    public static final Set<String> CONTENT_FIELDS = Set.of("name", "title", "subtitle", "description", "summary", "image", "images", "gallery", "itinerary", "highlights",
            "includes", "excludes", "notes", "tags", "destination", "dest", "region", "duration", "tourDays");
    /** Trường nhạy cảm: chỉ ADMIN (TOUR_MANAGE_SENSITIVE). */
    public static final Set<String> SENSITIVE_FIELDS = Set.of("price", "guideType", "allowExtension", "datePrices", "capacity", "minGuests", "active", "hidden", "deposit", "depositPercent");

    private final Db db;
    private final OpsCore core;
    private final Reviews reviews;
    private final TravelProperties props;
    private final ObjectMapper mapper;

    public ContentOps(Db db, OpsCore core, Reviews reviews) {
        this(db, core, reviews, null, null);
    }

    @Autowired
    public ContentOps(Db db, OpsCore core, Reviews reviews, TravelProperties props, ObjectMapper mapper) {
        this.db = db;
        this.core = core;
        this.reviews = reviews;
        this.props = props;
        this.mapper = mapper;
    }

    // ───────────────────────── tour (bản nháp) ─────────────────────────
    public List<Map<String, Object>> drafts(String status, String ownerId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> d : db.list("tour-drafts")) {
            if (status != null && !status.isEmpty() && !status.equals(Maps.str(d, "status"))) continue;
            if (ownerId != null && !ownerId.equals(Maps.str(d, "createdBy"))) continue;
            out.add(d);
        }
        out.sort((a, b) -> Maps.str(b, "updatedAt").compareTo(Maps.str(a, "updatedAt")));
        return out;
    }

    /** Tạo / cập nhật bản nháp. tourId rỗng = tour mới. Có trường nhạy cảm → 403. */
    public Map<String, Object> saveDraft(Actor by, String draftId, String tourId, Map<String, Object> fields) {
        if (fields == null || fields.isEmpty()) throw HttpError.bad("Chưa có nội dung nào để lưu", "fields");
        boolean admin = Role.ADMIN.name().equals(by.role());
        for (String k : fields.keySet()) {
            if (SENSITIVE_FIELDS.contains(k)) throw new HttpError(403, "Trường \"" + k + "\" chỉ Quản trị viên được sửa", "sensitive_field");
            if (!CONTENT_FIELDS.contains(k)) throw HttpError.bad("Trường không được phép: " + k, k);
        }
        String tid = tourId == null ? "" : tourId.trim();
        if (!admin && tid.isEmpty()) {
            throw new HttpError(403, "Nhân viên không có quyền tạo tour mới. Chỉ Quản trị viên mới có quyền tạo tour.", "role");
        }
        if (!tid.isEmpty() && core.tours.find(tid) == null && !adminHas(tid)) throw HttpError.notFound("Không tìm thấy tour");
        Map<String, Object>[] out = new Map[1];
        db.edit("tour-drafts", all -> {
            Map<String, Object> d = null;
            if (draftId != null && !draftId.isEmpty()) {
                for (Map<String, Object> x : all) if (draftId.equals(Maps.str(x, "id"))) d = x;
                if (d == null) throw HttpError.notFound("Không tìm thấy bản nháp");
                if (!admin && !by.id().equals(Maps.str(d, "createdBy"))) throw HttpError.notFound("Không tìm thấy bản nháp");
                if ("pending".equals(d.get("status")) || "published".equals(d.get("status"))) throw HttpError.conflict("Bản nháp đang chờ duyệt hoặc đã xuất bản, hãy tạo bản mới", "status");
                Map<String, Object> f = new LinkedHashMap<>(Maps.map(d.get("fields")));
                f.putAll(fields);
                d.put("fields", f);
            } else {
                d = Maps.of("id", Ids.newId("td"), "tourId", tid.isEmpty() ? "tour_" + Ids.hex(4) : tid, "isNew", tid.isEmpty(), "fields", new LinkedHashMap<>(fields),
                        "createdBy", by.id(), "createdByName", by.name(), "createdAt", Times.iso(core.now()));
                all.add(d);
            }
            d.put("status", "draft");
            d.put("updatedAt", Times.iso(core.now()));
            out[0] = d;
        });
        core.audit.log(by.id(), by.name(), by.role(), "tour.draft_save", Maps.str(out[0], "tourId"), String.join(",", fields.keySet()));
        return out[0];
    }

    private boolean adminHas(String id) {
        for (Map<String, Object> t : db.list("admin-tours")) if (id.equals(Maps.str(t, "id"))) return true;
        return false;
    }

    public Map<String, Object> submitDraft(Actor by, String id) {
        Map<String, Object>[] out = new Map[1];
        db.edit("tour-drafts", all -> {
            for (Map<String, Object> d : all) {
                if (!id.equals(Maps.str(d, "id"))) continue;
                if (!Role.ADMIN.name().equals(by.role()) && !by.id().equals(Maps.str(d, "createdBy"))) throw HttpError.notFound("Không tìm thấy bản nháp");
                if (!"draft".equals(d.get("status")) && !"rejected".equals(d.get("status"))) throw HttpError.conflict("Bản nháp không ở trạng thái có thể gửi duyệt", "status");
                d.put("status", "pending");
                d.put("submittedAt", Times.iso(core.now()));
                out[0] = d;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy bản nháp");
        core.audit.log(by.id(), by.name(), by.role(), "tour.draft_submit", Maps.str(out[0], "tourId"), "");
        core.notifyRoles("📝 Nội dung tour chờ duyệt", Maps.str(Maps.map(out[0].get("fields")), "name") + " – " + out[0].get("tourId"), "admin.html#drafts", "td-" + id, Role.ADMIN);
        return out[0];
    }

    /** ADMIN duyệt bản nháp → ghi vào tour công khai. Tour mới cần ADMIN nhập giá và loại HDV (trường nhạy cảm). */
    public Map<String, Object> approveDraft(Actor admin, String id, Map<String, Object> sensitive) {
        Map<String, Object> d = null;
        for (Map<String, Object> x : db.list("tour-drafts")) if (id.equals(Maps.str(x, "id"))) d = x;
        if (d == null) throw HttpError.notFound("Không tìm thấy bản nháp");
        if (!"pending".equals(d.get("status"))) throw HttpError.conflict("Bản nháp chưa gửi duyệt hoặc đã xử lý", "status");
        String tid = Maps.str(d, "tourId");
        Map<String, Object> fields = new LinkedHashMap<>(Maps.map(d.get("fields")));
        Map<String, Object> sens = cleanSensitive(sensitive == null ? Map.of() : sensitive);
        if (Maps.bool(d, "isNew")) {
            if (!sens.containsKey("price")) throw HttpError.bad("Tour mới cần Admin nhập giá", "price");
            if (!sens.containsKey("guideType") || sens.get("guideType") == null || String.valueOf(sens.get("guideType")).trim().isEmpty()) {
                throw HttpError.bad("Tour mới bắt buộc chọn loại HDV (Nội địa / Quốc tế)", "guideType");
            }
            String gt = String.valueOf(sens.get("guideType")).trim();
            if (!Set.of("domestic", "international").contains(gt)) {
                throw HttpError.bad("Loại HDV phải là domestic hoặc international", "guideType");
            }
            if (Maps.str(fields, "name").isEmpty()) throw HttpError.bad("Tour mới cần có tên", "name");
        }
        fields.putAll(sens);
        writeTour(tid, fields);
        db.edit("tour-drafts", all -> all.forEach(x -> {
            if (id.equals(Maps.str(x, "id"))) { x.put("status", "published"); x.put("approvedBy", admin.id()); x.put("approvedAt", Times.iso(core.now())); }
        }));
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.draft_approve", tid, "");
        core.notifyUser(Maps.str(d, "createdBy"), "✅ Nội dung tour đã được duyệt", Maps.str(Maps.map(d.get("fields")), "name") + " đã lên trang.", "content.html#drafts", "tda-" + id);
        return Maps.of("ok", true, "tourId", tid);
    }

    public Map<String, Object> rejectDraft(Actor admin, String id, String note) {
        if (note == null || note.isBlank()) throw HttpError.bad("Vui lòng ghi lý do từ chối", "note");
        Map<String, Object>[] out = new Map[1];
        db.edit("tour-drafts", all -> {
            for (Map<String, Object> d : all) {
                if (!id.equals(Maps.str(d, "id"))) continue;
                if (!"pending".equals(d.get("status"))) throw HttpError.conflict("Bản nháp chưa gửi duyệt hoặc đã xử lý", "status");
                d.put("status", "rejected");
                d.put("rejectNote", note.trim());
                d.put("decidedBy", admin.id());
                d.put("decidedAt", Times.iso(core.now()));
                out[0] = d;
            }
        });
        if (out[0] == null) throw HttpError.notFound("Không tìm thấy bản nháp");
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.draft_reject", Maps.str(out[0], "tourId"), note.trim());
        core.notifyUser(Maps.str(out[0], "createdBy"), "❌ Nội dung tour bị trả lại", note.trim(), "content.html#drafts", "tdr-" + id);
        return out[0];
    }

    /** ADMIN sửa trực tiếp trường nhạy cảm của một tour (giá, loại HDV, cho phép gia hạn, sức chứa...). */
    public Map<String, Object> setSensitive(Actor admin, String tourId, Map<String, Object> in) {
        if (core.tours.find(tourId) == null && !adminHas(tourId)) throw HttpError.notFound("Không tìm thấy tour");
        Map<String, Object> sens = cleanSensitive(in == null ? Map.of() : in);
        if (sens.isEmpty()) throw HttpError.bad("Không có trường nào để sửa", "fields");
        writeTour(tourId, sens);
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.sensitive", tourId, sens.toString());
        return Maps.of("ok", true, "tourId", tourId, "changed", sens);
    }

    private static Map<String, Object> cleanSensitive(Map<String, Object> in) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : in.entrySet()) {
            String k = e.getKey();
            Object v = e.getValue();
            if (!SENSITIVE_FIELDS.contains(k)) throw HttpError.bad("Không phải trường nhạy cảm: " + k, k);
            switch (k) {
                case "price", "deposit" -> {
                    double p = vn.travel.util.Pricing.num(v);
                    if (p < 0 || p > 1_000_000_000) throw HttpError.bad("Giá không hợp lệ", k);
                    out.put(k, Math.round(p));
                }
                case "capacity", "minGuests" -> {
                    double n = vn.travel.util.Pricing.num(v);
                    if (n < 1 || n > 500) throw HttpError.bad("Giá trị phải từ 1 đến 500", k);
                    out.put(k, (int) n);
                }
                case "depositPercent" -> {
                    double n = vn.travel.util.Pricing.num(v);
                    if (n < 0 || n > 100) throw HttpError.bad("Phần trăm phải từ 0 đến 100", k);
                    out.put(k, (int) n);
                }
                case "guideType" -> {
                    String g = String.valueOf(v);
                    if (!Set.of("company", "self", "domestic", "international").contains(g)) throw HttpError.bad("Loại HDV không hợp lệ", k);
                    out.put(k, g);
                }
                default -> out.put(k, Boolean.TRUE.equals(v) || "true".equals(String.valueOf(v)));
            }
        }
        return out;
    }

    private void writeTour(String tid, Map<String, Object> patch) {
        db.edit("admin-tours", all -> {
            Map<String, Object> t = null;
            int existingIdx = -1;
            for (int i = 0; i < all.size(); i++) {
                if (tid.equals(Maps.str(all.get(i), "id"))) {
                    t = all.get(i);
                    existingIdx = i;
                    break;
                }
            }
            if (t == null) {
                Map<String, Object> base = core.tours.find(tid);
                t = base == null ? new LinkedHashMap<>() : new LinkedHashMap<>(base);
                t.put("id", tid);
                t.put("createdAt", Times.iso(core.now()));
                t.put("isNew", true);
                t.put("badge", "new");
                t.put("active", true);
                t.putAll(patch);
                t.put("updatedAt", Times.iso(core.now()));
                all.add(0, t);
            } else {
                t.putAll(patch);
                t.put("updatedAt", Times.iso(core.now()));
                if (tid.startsWith("tour_") || Boolean.TRUE.equals(t.get("isNew"))) {
                    t.put("isNew", true);
                    t.put("badge", "new");
                    if (existingIdx > 0) {
                        all.remove(existingIdx);
                        all.add(0, t);
                    }
                }
            }
        });
    }

    // ───────────────────────── ADMIN QUẢN LÝ TOUR TRỰC TIẾP ─────────────────────────
    public Map<String, Object> adminSaveTour(Actor admin, String tourId, Map<String, Object> in) {
        if (in == null || in.isEmpty()) throw HttpError.bad("Dữ liệu tour không được rỗng", "fields");
        String name = Maps.str(in, "name").trim();
        if (name.isEmpty()) throw HttpError.bad("Tên tour là bắt buộc", "name");
        double price = vn.travel.util.Pricing.num(in.get("price"));
        if (price < 0 || price > 1_000_000_000) throw HttpError.bad("Giá tour không hợp lệ", "price");

        String tid = tourId == null || tourId.isBlank() ? "tour_" + Ids.hex(4) : tourId.trim();

        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("id", tid);
        patch.put("name", name);
        patch.put("price", Math.round(price));
        patch.put("isNew", true);
        patch.put("badge", "new");

        if (in.containsKey("subtitle")) patch.put("subtitle", in.get("subtitle"));
        if (in.containsKey("description")) patch.put("description", in.get("description"));
        if (in.containsKey("desc")) patch.put("desc", in.get("desc"));
        else if (in.containsKey("description")) patch.put("desc", in.get("description"));
        else if (in.containsKey("subtitle")) patch.put("desc", in.get("subtitle"));

        String dest = Maps.str(in, "destination").trim();
        if (dest.isEmpty()) dest = Maps.str(in, "dest").trim();
        patch.put("destination", dest);
        patch.put("dest", dest);

        String reg = Maps.str(in, "region").trim();
        if (!reg.isEmpty()) {
            if ("bac".equalsIgnoreCase(reg)) reg = "Miền Bắc";
            else if ("trung".equalsIgnoreCase(reg)) reg = "Miền Trung";
            else if ("nam".equalsIgnoreCase(reg)) reg = "Miền Nam";
            else if ("intl".equalsIgnoreCase(reg)) reg = "Quốc tế";
            patch.put("region", reg);
        }

        if (in.containsKey("duration")) patch.put("duration", Maps.str(in, "duration").trim());
        if (in.containsKey("image")) patch.put("image", Maps.str(in, "image").trim());
        if (in.containsKey("emoji")) patch.put("emoji", Maps.str(in, "emoji").trim());
        if (in.containsKey("coverEmoji")) patch.put("coverEmoji", Maps.str(in, "coverEmoji").trim());

        String guideType = Maps.str(in, "guideType").trim();
        if (guideType.isEmpty()) guideType = Maps.str(in, "guide").trim();
        if (!guideType.isEmpty()) {
            patch.put("guideType", guideType);
            patch.put("guide", "self".equalsIgnoreCase(guideType) ? "self" : "guided");
        }

        if (in.containsKey("capacity")) {
            double c = vn.travel.util.Pricing.num(in.get("capacity"));
            if (c > 0) patch.put("capacity", (int) c);
        }
        if (in.containsKey("minGuests")) {
            double m = vn.travel.util.Pricing.num(in.get("minGuests"));
            if (m > 0) patch.put("minGuests", (int) m);
        }
        if (in.containsKey("allowExtension")) {
            patch.put("allowExtension", !Boolean.FALSE.equals(in.get("allowExtension")));
        }
        if (in.containsKey("active")) {
            boolean act = !Boolean.FALSE.equals(in.get("active")) && !Boolean.TRUE.equals(in.get("hidden"));
            patch.put("active", act);
            patch.put("hidden", !act);
        }

        if (in.get("highlights") instanceof String hlStr) {
            List<String> list = Arrays.stream(hlStr.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            patch.put("highlights", list);
            patch.put("highlight", String.join(" · ", list));
        } else if (in.get("highlights") instanceof List<?> list) {
            patch.put("highlights", list);
            patch.put("highlight", list.stream().map(String::valueOf).reduce((a, b) -> a + " · " + b).orElse(""));
        } else if (in.get("highlight") != null) {
            patch.put("highlight", in.get("highlight"));
        }

        if (in.get("itinerary") instanceof String itinStr) {
            List<String> rawDays = Arrays.stream(itinStr.split("\n")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            List<Map<String, Object>> itinList = new ArrayList<>();
            for (int i = 0; i < rawDays.size(); i++) {
                itinList.add(Maps.of("day", i + 1, "title", rawDays.get(i), "items", List.of(Maps.of("time", "Cả ngày", "desc", rawDays.get(i)))));
            }
            patch.put("itinerary", itinList);
        } else if (in.get("itinerary") instanceof List<?> list) {
            patch.put("itinerary", list);
        }

        writeTour(tid, patch);
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.admin_save", tid, "name=" + name + ", price=" + price);
        return Maps.of("ok", true, "tourId", tid);
    }

    public Map<String, Object> adminToggleTour(Actor admin, String tourId) {
        if (tourId == null || tourId.isBlank()) throw HttpError.bad("Thiếu mã tour", "tourId");
        boolean[] newState = new boolean[1];
        db.edit("admin-tours", all -> {
            Map<String, Object> t = null;
            for (Map<String, Object> x : all) if (tourId.equals(Maps.str(x, "id"))) t = x;
            if (t == null) {
                Map<String, Object> base = core.tours.find(tourId);
                t = base == null ? new LinkedHashMap<>() : new LinkedHashMap<>(base);
                t.put("id", tourId);
                all.add(t);
            }
            boolean currentlyActive = !TourCatalog.isHidden(t);
            boolean act = !currentlyActive;
            t.put("active", act);
            t.put("hidden", !act);
            t.put("updatedAt", Times.iso(core.now()));
            newState[0] = act;
        });
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.toggle_active", tourId, "active=" + newState[0]);
        return Maps.of("ok", true, "tourId", tourId, "active", newState[0]);
    }

    public Map<String, Object> adminDeleteTour(Actor admin, String tourId) {
        if (tourId == null || tourId.isBlank()) throw HttpError.bad("Thiếu mã tour", "tourId");
        db.edit("admin-tours", all -> {
            if (tourId.startsWith("tour_")) {
                all.removeIf(x -> tourId.equals(Maps.str(x, "id")));
            } else {
                Map<String, Object> t = null;
                for (Map<String, Object> x : all) if (tourId.equals(Maps.str(x, "id"))) t = x;
                if (t == null) {
                    Map<String, Object> base = core.tours.find(tourId);
                    t = base == null ? new LinkedHashMap<>() : new LinkedHashMap<>(base);
                    t.put("id", tourId);
                    all.add(t);
                }
                t.put("active", false);
                t.put("hidden", true);
                t.put("updatedAt", Times.iso(core.now()));
            }
        });
        core.audit.log(admin.id(), admin.name(), admin.role(), "tour.delete", tourId, "");
        return Maps.of("ok", true, "tourId", tourId);
    }

    // ───────────────────────── ẩm thực ─────────────────────────
    public static final Set<String> REGIONS = Set.of("bac", "trung", "nam");

    public List<Map<String, Object>> foods(boolean publicOnly) {
        List<Map<String, Object>> list = db.list("foods");
        if (list.isEmpty() && props != null && mapper != null) {
            seedFoodsIfEmpty();
            list = db.list("foods");
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> f : list) if (!publicOnly || !Boolean.FALSE.equals(f.get("active"))) out.add(f);
        out.sort((a, b) -> Maps.str(a, "name").compareToIgnoreCase(Maps.str(b, "name")));
        return out;
    }

    private synchronized void seedFoodsIfEmpty() {
        if (!db.list("foods").isEmpty()) return;
        try {
            java.nio.file.Path file = java.nio.file.Paths.get(props.webRoot(), "data", "foods.json");
            if (!java.nio.file.Files.exists(file)) return;
            Map<String, Object> root = mapper.readValue(java.nio.file.Files.readString(file), Db.OBJ);
            Map<String, String> regMap = Map.of("north", "bac", "center", "trung", "south", "nam");
            List<Map<String, Object>> seeded = new ArrayList<>();
            int count = 1;
            for (Map.Entry<String, Object> entry : root.entrySet()) {
                String regKey = regMap.getOrDefault(entry.getKey(), "bac");
                if (entry.getValue() instanceof Map<?, ?> regObj) {
                    List<Object> allItems = new ArrayList<>();
                    if (regObj.get("featured") instanceof Map<?, ?> feat) allItems.add(feat);
                    if (regObj.get("foods") instanceof List<?> fList) allItems.addAll(fList);
                    for (Object item : allItems) {
                        if (item instanceof Map<?, ?> m) {
                            String name = Maps.str((Map<String, Object>) m, "name");
                            if (name.isEmpty()) continue;
                            Map<String, Object> f = new LinkedHashMap<>();
                            f.put("id", String.format("food_%04d", count++));
                            f.put("name", name);
                            f.put("region", regKey);
                            String prov = Maps.str((Map<String, Object>) m, "region");
                            if (prov.isEmpty()) prov = Maps.str((Map<String, Object>) regObj, "label");
                            f.put("province", prov);
                            String desc = Maps.str((Map<String, Object>) m, "desc");
                            f.put("description", desc);
                            f.put("desc", desc);
                            f.put("emoji", Maps.str((Map<String, Object>) m, "emoji"));
                            f.put("image", Maps.str((Map<String, Object>) m, "image"));
                            f.put("active", true);
                            f.put("createdAt", Times.iso(core.now()));
                            f.put("updatedAt", Times.iso(core.now()));
                            seeded.add(f);
                        }
                    }
                }
            }
            if (!seeded.isEmpty()) {
                db.edit("foods", all -> {
                    if (all.isEmpty()) all.addAll(seeded);
                });
            }
        } catch (Exception ignored) {
        }
    }

    public Map<String, Object> saveFood(Actor by, String id, Map<String, Object> in) {
        String name = Maps.str(in, "name").trim(), region = Maps.str(in, "region").trim();
        if (name.length() < 2 || name.length() > 80) throw HttpError.bad("Tên món 2–80 ký tự", "name");
        if (!REGIONS.contains(region)) throw HttpError.bad("Vùng phải là bac, trung hoặc nam", "region");
        String img = Maps.str(in, "image").trim();
        if (!img.isEmpty() && !img.matches("^(https://[^\\s\"'<>]+|/?[A-Za-z0-9_./-]+)$")) throw HttpError.bad("Ảnh phải là đường dẫn hợp lệ", "image");
        Map<String, Object>[] out = new Map[1];
        db.edit("foods", all -> {
            Map<String, Object> f = null;
            if (id != null && !id.isEmpty()) {
                for (Map<String, Object> x : all) if (id.equals(Maps.str(x, "id"))) f = x;
                if (f == null) throw HttpError.notFound("Không tìm thấy món");
            } else {
                f = Maps.of("id", Ids.newId("food"), "createdAt", Times.iso(core.now()));
                all.add(f);
            }
            f.put("name", name);
            f.put("region", region);
            String d = Maps.str(in, "description").trim();
            if (d.isEmpty()) d = Maps.str(in, "desc").trim();
            f.put("description", d);
            f.put("desc", d);
            f.put("province", Maps.str(in, "province").trim());
            f.put("image", img);
            f.put("active", !Boolean.FALSE.equals(in.get("active")));
            f.put("updatedBy", by.id());
            f.put("updatedAt", Times.iso(core.now()));
            out[0] = f;
        });
        core.audit.log(by.id(), by.name(), by.role(), id == null || id.isEmpty() ? "food.create" : "food.update", Maps.str(out[0], "id"), name);
        return out[0];
    }

    public void deleteFood(Actor by, String id) {
        boolean[] hit = {false};
        db.edit("foods", all -> hit[0] = all.removeIf(f -> id.equals(Maps.str(f, "id"))));
        if (!hit[0]) throw HttpError.notFound("Không tìm thấy món");
        core.audit.log(by.id(), by.name(), by.role(), "food.delete", id, "");
    }

    // ───────────────────────── kiểm duyệt đánh giá ─────────────────────────
    public List<Map<String, Object>> reviewList() { return reviews.moderationList(); }

    /** Ẩn (bắt buộc lý do) hoặc hiện lại một đánh giá. Ẩn khỏi mọi trang công khai và thống kê điểm. */
    public Map<String, Object> moderateReview(Actor by, String reviewId, boolean hide, String reason) {
        if (hide && (reason == null || reason.trim().length() < 3)) throw HttpError.bad("Bắt buộc ghi lý do ẩn", "reason");
        boolean known = false;
        for (Map<String, Object> r : reviews.moderationList()) if (reviewId.equals(Maps.str(r, "id"))) known = true;
        if (!known) throw HttpError.notFound("Không tìm thấy đánh giá");
        db.editObj("reviewmod", m -> {
            Map<String, Object> h = new LinkedHashMap<>(m.get("hidden") instanceof Map<?, ?> x ? (Map<String, Object>) x : Map.of());
            if (hide) h.put(reviewId, Maps.of("reason", reason.trim(), "by", by.id(), "byName", by.name(), "at", Times.iso(core.now())));
            else h.remove(reviewId);
            m.put("hidden", h);
        });
        core.audit.log(by.id(), by.name(), by.role(), hide ? "review.hide" : "review.show", reviewId, reason == null ? "" : reason.trim());
        return Maps.of("ok", true, "id", reviewId, "hidden", hide);
    }

    /** Trả lời (Rep) bình luận của khách từ ban quản trị / biên tập nội dung. */
    public Map<String, Object> replyReview(Actor by, String reviewId, String reply) {
        Map<String, Object> res = reviews.replyReview(by, reviewId, reply);
        core.audit.log(by.id(), by.name(), by.role(), "review.reply", reviewId, reply == null ? "" : reply.trim());
        return res;
    }

    // ───────────────────────── ghim tour nổi bật (7.5) ─────────────────────────

    public Map<String, Object> pinFeatured(Actor by, Stats stats, String tourId, boolean pinned) {
        if (core.tours.find(tourId) == null) throw HttpError.notFound("Không tìm thấy tour");
        if (pinned && stats.pins().size() >= Stats.TOP_N && !stats.pins().contains(tourId)) throw HttpError.conflict("Đã ghim tối đa " + Stats.TOP_N + " tour", "pinned");
        stats.setPin(tourId, pinned);
        core.audit.log(by.id(), by.name(), by.role(), pinned ? "featured.pin" : "featured.unpin", tourId, "");
        return Maps.of("ok", true, "tourId", tourId, "pinned", pinned, "pins", stats.pins());
    }

    // ───────────────────────── thống kê biên tập ─────────────────────────
    public Map<String, Object> stats() {
        List<Map<String, Object>> ranking = core.tours == null ? List.of() : List.of();
        int pending = 0, drafts = 0;
        for (Map<String, Object> d : db.list("tour-drafts")) {
            if ("pending".equals(d.get("status"))) pending++;
            else if ("draft".equals(d.get("status")) || "rejected".equals(d.get("status"))) drafts++;
        }
        int hidden = 0;
        for (Map<String, Object> r : reviews.moderationList()) if (Maps.bool(r, "hidden")) hidden++;
        Map<String, Integer> bookedByTour = new HashMap<>();
        for (Map<String, Object> b : core.bookings()) if (Flow_active(b)) bookedByTour.merge(Maps.str(b, "tourId"), 1, Integer::sum);
        List<Map<String, Object>> top = new ArrayList<>();
        bookedByTour.entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue()).limit(5)
                .forEach(e -> top.add(Maps.of("tourId", e.getKey(), "name", core.tours.name(e.getKey()), "orders", e.getValue())));
        double sum = 0;
        int n = 0;
        for (Map<String, Object> r : reviews.moderationList()) if (!Maps.bool(r, "hidden") && r.get("rating") instanceof Number num) { sum += num.doubleValue(); n++; }
        return Maps.of("pendingDrafts", pending, "myDrafts", drafts, "foods", foods(false).size(), "hiddenReviews", hidden, "reviews", n,
                "avgRating", n == 0 ? 0 : Math.round(sum / n * 10) / 10.0, "topTours", top);
    }

    private static boolean Flow_active(Map<String, Object> b) { return vn.travel.util.Flow.active(b.get("status")); }
}
