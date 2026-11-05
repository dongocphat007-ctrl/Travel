package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import vn.travel.security.Permission;
import vn.travel.service.Accounts;
import vn.travel.service.ImageStore;
import vn.travel.util.Maps;

import java.util.Map;

/**
 * Tải ảnh lên: máy chủ ghi file vào frontend/img/ rồi trả đường dẫn để lưu vào tài khoản / tour / banner / món ăn.
 * Thân yêu cầu JSON: { dataUrl: "data:image/jpeg;base64,..." } (trình duyệt đã thu nhỏ ảnh trước khi gửi).
 */
@RestController
public class UploadController {
    private final CurrentUser current;
    private final ImageStore images;
    private final Accounts accounts;

    public UploadController(CurrentUser current, ImageStore images, Accounts accounts) {
        this.current = current;
        this.images = images;
        this.accounts = accounts;
    }

    /** Ảnh đại diện của CHÍNH người đang đăng nhập. { dataUrl } để đổi, { remove: true } để xóa. */
    @PostMapping("/api/upload/avatar")
    public Map<String, Object> avatar(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        String uid = Maps.str(u, "id");
        Map<String, Object> b = Api.body(body);
        if (Maps.bool(b, "remove")) {
            images.deleteAvatar(uid);
            accounts.setAvatar(uid, null);
            return Maps.of("ok", true, "picture", "");
        }
        String path = images.saveAvatar(uid, ImageStore.decode(Maps.str(b, "dataUrl")));
        accounts.setAvatar(uid, path);
        return Maps.of("ok", true, "picture", path);
    }

    /** Ảnh bài viết/bình luận cộng đồng; gắn với tài khoản tải lên. */
    @PostMapping("/api/upload/review")
    public Map<String, Object> reviewImage(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> b = Api.body(body);
        return Maps.of("ok", true, "path", images.saveReview(Maps.str(u, "id"), ImageStore.decode(Maps.str(b, "dataUrl"))));
    }

    /** Ảnh cho tour / banner / món ăn: kind = tour | banner | food. Cần quyền quản lý đúng loại nội dung. */
    @PostMapping("/api/upload/{kind}")
    public Map<String, Object> content(@PathVariable String kind, @RequestBody(required = false) Map<String, Object> body,
                                       HttpServletRequest req) {
        Map<String, Object> b = Api.body(body);
        String path;
        switch (kind) {
            case "tour" -> {
                current.require(req);
                if (!current.hasPermission(req, Permission.CONTENT_MANAGE_TOUR)
                        && !current.hasPermission(req, Permission.TOUR_MANAGE_SENSITIVE)) throw HttpError.forbidden();
                path = images.saveTour(Maps.str(b, "region"), Maps.str(b, "destination"), Maps.str(b, "name"),
                        ImageStore.decode(Maps.str(b, "dataUrl")));
            }
            case "banner" -> {
                current.requirePermission(req, Permission.CONTENT_MANAGE_BANNER);
                path = images.saveBanner(Maps.str(b, "name"), ImageStore.decode(Maps.str(b, "dataUrl")));
            }
            case "food" -> {
                current.requirePermission(req, Permission.CONTENT_MANAGE_FOOD);
                path = images.saveFood(Maps.str(b, "name"), ImageStore.decode(Maps.str(b, "dataUrl")));
            }
            default -> throw HttpError.notFound("Không có loại ảnh này");
        }
        return Maps.of("ok", true, "path", path);
    }
}
