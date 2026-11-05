package vn.travel.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.service.OpsCore.Actor;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TourCreateAndPermissionsTest {

    private static final Actor ADMIN = new Actor("adm_1", "Quản trị viên", "ADMIN");
    private static final Actor CONTENT = new Actor("st_cnt_1", "Biên tập viên", "CONTENT");

    @Test
    @DisplayName("Nhân viên không được tạo tour mới: saveDraft bị chặn 403 khi tourId trống")
    void staffCannotCreateTour(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);

        // Nhân viên Content cố gắng tạo tour mới (tourId rỗng) -> Bị chặn 403
        HttpError err = assertThrows(HttpError.class, () ->
                f.content.saveDraft(CONTENT, null, "", Map.of("name", "Tour Trái Phép", "destination", "Đà Nẵng"))
        );
        assertEquals(403, err.status());
        assertTrue(err.getMessage().contains("Nhân viên không có quyền tạo tour mới"));

        // Nhân viên biên tập tour có sẵn ("101") -> Thành công
        Map<String, Object> draft = f.content.saveDraft(CONTENT, null, "101", Map.of("name", "Hạ Long cập nhật"));
        assertNotNull(draft);
        assertEquals("101", draft.get("tourId"));
    }

    @Test
    @DisplayName("Admin tạo tour mới thành công, tour xuất hiện đầu tiên và gắn mác new")
    void adminCreatesTourAppearsFirstWithNewBadge(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);

        // Admin tạo tour mới
        Map<String, Object> res = f.content.adminSaveTour(ADMIN, null, Map.of(
                "name", "Tour Quy Nhơn Kỳ Co 3N2Đ",
                "price", 3_500_000,
                "destination", "Quy Nhơn",
                "region", "Miền Trung",
                "duration", "3 ngày 2 đêm",
                "guideType", "domestic",
                "capacity", 25,
                "minGuests", 8,
                "active", true
        ));
        assertTrue(Maps.bool(res, "ok"));
        String newTourId = Maps.str(res, "tourId");
        assertTrue(newTourId.startsWith("tour_"));

        // 1. Kiểm tra trong adminList: Tour mới phải nằm ở ĐẦU TIÊN (index 0) và có cờ isNew, badge new
        List<Map<String, Object>> adminTours = f.tours.adminList();
        assertFalse(adminTours.isEmpty());
        Map<String, Object> firstAdminTour = adminTours.get(0);
        assertEquals(newTourId, firstAdminTour.get("id"));
        assertEquals("Tour Quy Nhơn Kỳ Co 3N2Đ", firstAdminTour.get("name"));
        assertTrue(Boolean.TRUE.equals(firstAdminTour.get("isNew")));
        assertEquals("new", firstAdminTour.get("badge"));

        // 2. Kiểm tra trong danh sách trang chủ (group "core"): Tour mới phải xuất hiện ở ĐẦU TIÊN
        List<Map<String, Object>> coreTours = f.tours.list("core");
        assertFalse(coreTours.isEmpty());
        Map<String, Object> firstCoreTour = coreTours.get(0);
        assertEquals(newTourId, firstCoreTour.get("id"));
        assertTrue(Boolean.TRUE.equals(firstCoreTour.get("isNew")));
        assertEquals("new", firstCoreTour.get("badge"));

        // 3. Kiểm tra trong danh sách tất cả tour (group "all"): Tour mới ở ĐẦU TIÊN
        List<Map<String, Object>> allTours = f.tours.list("all");
        assertFalse(allTours.isEmpty());
        assertEquals(newTourId, allTours.get(0).get("id"));
        assertTrue(Boolean.TRUE.equals(allTours.get(0).get("isNew")));
    }

    @Test
    @DisplayName("Tour tự túc xóa thuê HDV: không tính phụ phí HDV và chặn chọn HDV")
    void selfGuidedTourHasNoGuideHire(@TempDir Path tmp) throws Exception {
        Fixture f = new Fixture(tmp);

        // Admin tạo tour tự túc
        Map<String, Object> res = f.content.adminSaveTour(ADMIN, null, Map.of(
                "name", "Phượt Đà Lạt Tự Túc 2N1Đ",
                "price", 1_200_000,
                "destination", "Đà Lạt",
                "region", "Miền Nam",
                "duration", "2 ngày 1 đêm",
                "guideType", "self",
                "active", true
        ));
        String selfTourId = Maps.str(res, "tourId");

        // Tour phải có guide = self
        Map<String, Object> pubTour = f.tours.publicTour(selfTourId);
        assertNotNull(pubTour);
        assertEquals("self", pubTour.get("guide"));
        assertFalse(TourCatalog.hasGuide(pubTour));

        // Đặt tour tự túc: dù client có gửi hdvOn = true thì server vẫn ép hdvOn = false (không tính phí HDV)
        f.clock.now = 1793400000000L; // Mock thời gian
        String date = "2026-11-20";
        Map<String, Object> cusAcc = f.accounts.byId("cus_1");
        Map<String, Object> inData = Maps.of(
                "tourId", selfTourId,
                "customerName", "Nguyễn Văn A",
                "phone", "0901234567",
                "email", "a@gmail.com",
                "date", date,
                "note", "Ghi chú",
                "adults", 2, "kids", 0, "infants", 0,
                "hdvOn", true, // Khách cố gửi hdvOn
                "hdvHours", 8
        );
        Map<String, Object> created = f.bookings.create(cusAcc, inData);

        assertNotNull(created);
        // guideHire phải là enabled: false
        Map<String, Object> guideHire = Maps.map(created.get("guideHire"));
        assertNotNull(guideHire);
        assertFalse(Boolean.TRUE.equals(guideHire.get("enabled")));

        // Tổng tiền chỉ bằng 2 vé người lớn: 2 * 1.200.000 = 2.400.000 (không có 1.500.000 phí HDV)
        assertEquals(2_400_000L, Maps.lng(created, "price"));

        // Khách cố chọn guideId cho tour tự túc -> Bị chặn
        Map<String, Object> inWithGuide = Maps.of(
                "tourId", selfTourId,
                "customerName", "Nguyễn Văn A",
                "phone", "0901234567",
                "email", "a@gmail.com",
                "date", date,
                "adults", 2,
                "guideId", "g_1"
        );
        HttpError err = assertThrows(HttpError.class, () -> f.bookings.create(cusAcc, inWithGuide));
        assertEquals(400, err.status());
        assertTrue(err.getMessage().contains("Tour tự túc không hỗ trợ thuê hoặc chọn hướng dẫn viên"));
    }
}
