package vn.travel.service;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/** Băm mật khẩu bằng PBKDF2-HMAC-SHA256 của JDK (không thêm thư viện). Định dạng: pbkdf2$vòng$salt$hash (Base64). */
@Component
public class PasswordHasher {
    private static final int ITER = 210_000, KEY_BITS = 256;
    private final SecureRandom rnd = new SecureRandom();

    public String hash(String password) {
        byte[] salt = new byte[16];
        rnd.nextBytes(salt);
        return "pbkdf2$" + ITER + "$" + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(derive(password, salt, ITER));
    }

    public boolean verify(String password, String stored) {
        if (password == null || stored == null) return false;
        String[] p = stored.split("\\$");
        if (p.length != 4 || !p[0].equals("pbkdf2")) return false;
        try {
            byte[] expect = Base64.getDecoder().decode(p[3]);
            byte[] got = derive(password, Base64.getDecoder().decode(p[2]), Integer.parseInt(p[1]));
            return MessageDigest.isEqual(expect, got);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static byte[] derive(String password, byte[] salt, int iter) {
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(new PBEKeySpec(password.toCharArray(), salt, iter, KEY_BITS)).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
