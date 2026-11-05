package vn.travel.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.travel.config.TravelProperties;
import vn.travel.web.HttpError;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class ImageStoreTest {
    // 1x1 PNG
    static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F'};

    static String url(String mime, byte[] b) { return "data:image/" + mime + ";base64," + Base64.getEncoder().encodeToString(b); }

    private ImageStore store(Path web) {
        return new ImageStore(TestProps.withWebRoot(web.toString()));
    }

    @Test
    void decodeChecksMagicBytesNotDeclaredType() {
        assertEquals("png", ImageStore.decode(url("png", PNG)).ext());
        assertEquals("png", ImageStore.decode(url("jpeg", PNG)).ext());   // khai báo jpeg nhưng nội dung png → theo nội dung
        assertThrows(HttpError.class, () -> ImageStore.decode(url("png", "<?php echo 1;".getBytes())));
        assertThrows(HttpError.class, () -> ImageStore.decode("data:text/html;base64,PGI+"));
        assertThrows(HttpError.class, () -> ImageStore.decode(null));
        assertThrows(HttpError.class, () -> ImageStore.decode(url("png", new byte[ImageStore.MAX_BYTES + 1])));
    }

    @Test
    void slugAndRegion() {
        assertEquals("da-nang-ba-na-hills", ImageStore.slug("Đà Nẵng – Bà Nà Hills"));
        assertEquals("", ImageStore.slug("../.."));
        assertEquals("mien-bac", ImageStore.regionDir("Miền Bắc"));
        assertEquals("mien-trung", ImageStore.regionDir("trung"));
        assertEquals("mien-nam", ImageStore.regionDir("Miền Nam"));
        assertEquals("quoc-te", ImageStore.regionDir("Quốc tế"));
    }

    @Test
    void avatarIsWrittenUnderImgAndReplaced(@TempDir Path web) throws Exception {
        ImageStore s = store(web);
        String p1 = s.saveAvatar("u_123", ImageStore.decode(url("png", PNG)));
        assertTrue(p1.startsWith("/img/avatars/u-u-123-"), p1);
        assertTrue(Files.exists(web.resolve(p1.substring(1))));
        String p2 = s.saveAvatar("u_123", ImageStore.decode(url("jpeg", JPG)));
        assertTrue(p2.endsWith(".jpg"));
        assertFalse(Files.exists(web.resolve(p1.substring(1))), "ảnh cũ phải bị thay");
        s.deleteAvatar("u_123");
        assertFalse(Files.exists(web.resolve(p2.substring(1))));
    }

    @Test
    void hostileIdsCannotEscapeImgDir(@TempDir Path web) throws Exception {
        ImageStore s = store(web);
        String p = s.saveAvatar("../../etc/passwd", ImageStore.decode(url("png", PNG)));
        assertTrue(Files.exists(web.resolve(p.substring(1))));
        assertTrue(Files.list(web.resolve("img/avatars")).allMatch(f -> f.normalize().startsWith(web.resolve("img"))));
        assertThrows(HttpError.class, () -> s.saveAvatar("...", ImageStore.decode(url("png", PNG))));
    }

    @Test
    void tourImageGoesToProvinceFolderWhenItExists(@TempDir Path web) throws Exception {
        Files.createDirectories(web.resolve("img/tours_mau/mien-trung/da-nang"));
        ImageStore s = store(web);
        String p = s.saveTour("Miền Trung", "Đà Nẵng, Quảng Nam", "Đà Nẵng – Bà Nà 4N3Đ", ImageStore.decode(url("png", PNG)));
        assertTrue(p.startsWith("img/tours_mau/mien-trung/da-nang/da-nang-ba-na-4n3d-"), p);
        assertTrue(Files.exists(web.resolve(p)));
        String q = s.saveTour("bac", "Nơi chưa có thư mục", "", ImageStore.decode(url("png", PNG)));
        assertTrue(q.startsWith("img/tours_mau/mien-bac/tour-"), q);
    }
}
