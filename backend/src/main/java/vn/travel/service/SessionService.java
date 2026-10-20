package vn.travel.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Ids;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Base64;

/**
 * Phiên đăng nhập = cookie HttpOnly "travel_sid" = base64url(uid|hạn).HMAC-SHA256.
 * Khóa ký: SESSION_SECRET (env); nếu trống thì tự sinh một lần và lưu trong storage/db/.secret (không nằm trong thư mục tĩnh).
 */
@Service
public class SessionService {
    public static final String COOKIE = "travel_sid";
    public static final long TTL_SECONDS = 30L * 24 * 3600;

    private final byte[] secret;
    private final Clock clock;

    @Autowired
    public SessionService(TravelProperties props, Clock clock) {
        this.clock = clock;
        this.secret = loadSecret(props).getBytes(StandardCharsets.UTF_8);
    }

    /** Dùng cho test. */
    public SessionService(String secret, Clock clock) {
        this.clock = clock;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    private static String loadSecret(TravelProperties p) {
        if (!TravelProperties.blank(p.sessionSecret())) return p.sessionSecret();
        Path f = Paths.get(p.dbDir()).toAbsolutePath().normalize().resolve(".secret");
        try {
            Files.createDirectories(f.getParent());
            if (Files.exists(f)) {
                String s = Files.readString(f, StandardCharsets.UTF_8).trim();
                if (s.length() >= 32) return s;
            }
            String s = Ids.hex(32);
            Files.writeString(f, s, StandardCharsets.UTF_8);
            try { Files.setPosixFilePermissions(f, PosixFilePermissions.fromString("rw-------")); } catch (UnsupportedOperationException ignored) { }
            return s;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public String create(String userId) {
        long exp = clock.millis() / 1000 + TTL_SECONDS;
        String body = Base64.getUrlEncoder().withoutPadding().encodeToString((userId + "|" + exp).getBytes(StandardCharsets.UTF_8));
        return body + "." + sign(body);
    }

    /** userId nếu token hợp lệ và chưa hết hạn, ngược lại null. */
    public String verify(String token) {
        if (token == null) return null;
        int dot = token.indexOf('.');
        if (dot <= 0) return null;
        String body = token.substring(0, dot);
        if (!MessageDigest.isEqual(sign(body).getBytes(StandardCharsets.UTF_8), token.substring(dot + 1).getBytes(StandardCharsets.UTF_8)))
            return null;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(body), StandardCharsets.UTF_8);
            int bar = raw.lastIndexOf('|');
            if (bar < 0 || Long.parseLong(raw.substring(bar + 1)) < clock.millis() / 1000) return null;
            return raw.substring(0, bar);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Ký chuỗi bất kỳ (dùng thêm cho vé OTP). */
    public String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
