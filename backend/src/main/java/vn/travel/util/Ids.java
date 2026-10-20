package vn.travel.util;

import java.security.SecureRandom;
import java.util.HexFormat;

public final class Ids {
    private Ids() { }

    private static final SecureRandom RND = new SecureRandom();

    public static String hex(int bytes) {
        byte[] b = new byte[bytes];
        RND.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    /** 4 ký tự hoa/số, dùng làm đuôi mã voucher. */
    public static String suffix() {
        return hex(2).toUpperCase();
    }

    public static String newId(String prefix) {
        return prefix + "_" + Long.toString(System.currentTimeMillis(), 36) + hex(3);
    }

    public static int sixDigits() {
        return 100000 + RND.nextInt(900000);
    }
}
