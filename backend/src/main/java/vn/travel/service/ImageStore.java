package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.web.HttpError;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ghi ảnh người dùng/nhân viên tải lên vào thư mục img/ của frontend (web-root).
 * Chỉ nhận PNG/JPEG/WEBP/GIF (kiểm tra cả "chữ ký" đầu file, không tin phần khai báo), tối đa {@link #MAX_BYTES}.
 * Tên file do máy chủ tự đặt (slug ASCII) nên không thể thoát khỏi thư mục img/.
 */
@Service
public class ImageStore {
    public static final int MAX_BYTES = 3 * 1024 * 1024;
    private static final Pattern DATA_URL = Pattern.compile("^data:image/(png|jpeg|webp|gif);base64,(.+)$", Pattern.DOTALL);

    /** Ảnh đã giải mã và kiểm tra: ext là png | jpg | webp | gif. */
    public record Image(byte[] bytes, String ext) { }

    private final Path imgRoot;

    public ImageStore(TravelProperties props) {
        this.imgRoot = Paths.get(props.webRoot()).toAbsolutePath().normalize().resolve("img");
    }

    // ───────── giải mã + kiểm tra ─────────
    public static Image decode(String dataUrl) {
        Matcher m = DATA_URL.matcher(dataUrl == null ? "" : dataUrl.trim());
        if (!m.matches()) throw HttpError.bad("Ảnh không hợp lệ (chỉ nhận PNG, JPG, WEBP, GIF)");
        byte[] b;
        try {
            b = Base64.getMimeDecoder().decode(m.group(2));
        } catch (IllegalArgumentException e) {
            throw HttpError.bad("Ảnh không hợp lệ");
        }
        if (b.length == 0) throw HttpError.bad("Ảnh rỗng");
        if (b.length > MAX_BYTES) throw HttpError.bad("Ảnh quá lớn (tối đa " + (MAX_BYTES / 1024 / 1024) + "MB)");
        String ext = sniff(b);
        if (ext == null) throw HttpError.bad("Nội dung file không phải ảnh PNG, JPG, WEBP hoặc GIF");
        return new Image(b, ext);
    }

    static String sniff(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "jpg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "png";
        if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "gif";
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
        return null;
    }

    // ───────── tên thư mục / file ─────────
    /** "Đà Nẵng – Bà Nà" → "da-nang-ba-na" (ASCII, a-z0-9 và dấu gạch, tối đa 60 ký tự). */
    public static String slug(String s) {
        String t = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        return t.length() > 60 ? t.substring(0, 60).replaceAll("-+$", "") : t;
    }

    /** Vùng (nhãn tiếng Việt, mã "bac|trung|nam" hoặc slug) → tên thư mục img/tours_mau/<vùng>. */
    static String regionDir(String region) {
        String s = slug(region);
        if (s.contains("quoc") || s.contains("te") || s.contains("world")) return "quoc-te";
        if (s.contains("bac")) return "mien-bac";
        if (s.contains("trung")) return "mien-trung";
        if (s.contains("nam")) return "mien-nam";
        return "khac";
    }

    private static String hash8(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ───────── ghi file ─────────
    private String write(String subdir, String baseName, Image img, boolean replaceSameBase) {
        Path dir = imgRoot.resolve(subdir).normalize();
        if (!dir.startsWith(imgRoot)) throw HttpError.bad("Đường dẫn không hợp lệ");
        try {
            Files.createDirectories(dir);
            if (replaceSameBase) removeByBase(dir, baseName);
            Path target = dir.resolve(baseName + "." + img.ext());
            Path tmp = Files.createTempFile(dir, ".up-", ".tmp");
            try {
                Files.write(tmp, img.bytes());
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Không ghi được ảnh vào " + dir, e);
        }
        return "img/" + subdir + "/" + baseName + "." + img.ext();
    }

    private static void removeByBase(Path dir, String base) throws IOException {
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, base + ".*")) {
            for (Path p : ds) Files.deleteIfExists(p);
        }
    }

    private static String avatarBase(String uid) {
        String s = slug(uid);
        if (s.isEmpty()) throw HttpError.bad("Tài khoản không hợp lệ");
        return "u-" + s + "-" + hash8(uid);
    }

    /** img/avatars/u-<id>-<hash>.<ext>; ảnh cũ của tài khoản bị thay. Trả về đường dẫn tuyệt đối từ gốc site: /img/... */
    public String saveAvatar(String uid, Image img) {
        return "/" + write("avatars", avatarBase(uid), img, true);
    }

    public void deleteAvatar(String uid) {
        Path dir = imgRoot.resolve("avatars");
        if (!Files.isDirectory(dir)) return;
        try {
            removeByBase(dir, avatarBase(uid));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String staffAvatarBase(String uid) {
        String s = slug(uid);
        if (s.isEmpty()) throw HttpError.bad("Mã nhân viên không hợp lệ");
        return "staff_" + s + "_" + System.currentTimeMillis();
    }

    /**
     * Ảnh đại diện riêng cho nhân viên: lưu vào thư mục riêng frontend/img/avatars/staff/
     * Tên file có định dạng: staff_<mã-nhân-viên>_<thời-gian>.<ext> để không nhầm lẫn với nhân viên khác.
     * Khi nhân viên cập nhật ảnh mới, ảnh cũ của nhân viên đó trong thư mục staff/ được dọn dẹp tự động.
     */
    public String saveStaffAvatar(String uid, Image img) {
        deleteStaffAvatar(uid);
        return "/" + write("avatars/staff", staffAvatarBase(uid), img, false);
    }

    public void deleteStaffAvatar(String uid) {
        Path dir = imgRoot.resolve("avatars/staff");
        if (!Files.isDirectory(dir)) return;
        String prefix = "staff_" + slug(uid) + "_";
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, prefix + "*")) {
            for (Path p : ds) Files.deleteIfExists(p);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Ảnh tour: img/tours_mau/<vùng>/[<tỉnh>/]<tên-tour>-<mã>.<ext>. Tỉnh lấy từ "điểm đến" nếu đã có thư mục tỉnh đó.
     * Trả về đường dẫn tương đối "img/..." (đúng quy ước trường image của tour).
     */
    public String saveTour(String region, String destination, String name, Image img) {
        String r = regionDir(region);
        String sub = "tours_mau/" + r;
        Path regionPath = imgRoot.resolve(sub);
        for (String part : (destination == null ? "" : destination).split("[,;|–—]| - ")) {
            String p = slug(part);
            if (!p.isEmpty() && Files.isDirectory(regionPath.resolve(p))) { sub += "/" + p; break; }
        }
        return write(sub, uniqueName(name, "tour"), img, false);
    }

    /** Ảnh banner trang chủ: img/banners/<tên>-<mã>.<ext>. */
    public String saveBanner(String title, Image img) { return write("banners", uniqueName(title, "banner"), img, false); }

    /** Ảnh món ăn: img/foods/<tên>-<mã>.<ext>. */
    public String saveFood(String name, Image img) { return write("foods", uniqueName(name, "mon-an"), img, false); }

    /** Ảnh đính kèm review/comment được lưu tách theo tài khoản tải lên. */
    public String saveReview(String userId, Image img) {
        return write(reviewSubdir(userId), "review-" + UUID.randomUUID().toString().replace("-", ""), img, false);
    }

    public static String reviewSubdir(String userId) {
        String s = slug(userId);
        if (s.isEmpty()) throw HttpError.bad("Tài khoản không hợp lệ");
        return "reviews/" + s + "-" + hash8(userId);
    }

    /** Ảnh nội bộ phải được chính tài khoản tải lên mới được gắn vào bài viết. */
    public static boolean ownsReviewImage(String userId, String path) {
        return path != null && path.startsWith("img/" + reviewSubdir(userId) + "/")
                && path.matches("img/reviews/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+\\.(png|jpg|webp|gif)");
    }

    private static String uniqueName(String label, String fallback) {
        String s = slug(label);
        if (s.length() > 40) s = s.substring(0, 40).replaceAll("-+$", "");
        return (s.isEmpty() ? fallback : s) + "-" + Long.toString(System.currentTimeMillis(), 36);
    }
}
