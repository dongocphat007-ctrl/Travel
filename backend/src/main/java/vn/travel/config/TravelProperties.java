package vn.travel.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Cấu hình ứng dụng (prefix "travel"). Secret chỉ đến từ biến môi trường, không có giá trị thật trong mã nguồn. */
@ConfigurationProperties(prefix = "travel")
public record TravelProperties(
        String webRoot,
        String dbDir,
        String adminEmail,
        String adminPassword,
        String superAdminEmail,
        String sessionSecret,
        String siteUrl,
        String googleClientId,
        String geminiApiKey,
        String geminiModel,
        String emailApiKey,
        String emailApiUrl,
        String emailFrom,
        boolean otpDevLog,
        String paymentWebhookSecret,
        String paymentBank,
        String paymentAccount,
        String paymentAccountName,
        String paymentPrefix,
        String googleMapsApiKey,
        boolean trustProxy) {

    public String prefix() {
        String p = paymentPrefix == null ? "" : paymentPrefix.replaceAll("[^A-Za-z0-9]", "");
        return p.isEmpty() ? "TRAVEL" : p.toUpperCase();
    }

    public static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
