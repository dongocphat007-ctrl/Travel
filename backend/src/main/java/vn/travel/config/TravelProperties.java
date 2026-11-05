package vn.travel.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Cấu hình ứng dụng (prefix "travel"). Secret chỉ đến từ biến môi trường, không có giá trị thật trong mã nguồn. */
@ConfigurationProperties(prefix = "travel")
public record TravelProperties(
        String webRoot,
        String dbDir,
        String adminEmail,
        String adminPassword,
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
        boolean trustProxy,
        boolean sampleData,
        boolean hideSampleReviews,
        String langfusePublicKey,
        String langfuseSecretKey,
        String langfuseBaseUrl) {

    public String prefix() {
        String p = paymentPrefix == null ? "" : paymentPrefix.replaceAll("[^A-Za-z0-9]", "");
        return p.isEmpty() ? "TRAVEL" : p.toUpperCase();
    }

    /** Có hiển thị dữ liệu MẪU (tour mẫu, lượt dùng/đánh giá mẫu, HDV demo, banner mẫu) cùng dữ liệu thật không. SAMPLE_DATA=false → chỉ dữ liệu thật. */
    public boolean showSample() { return sampleData; }

    /** Có ẩn review mẫu không (SAMPLE_DATA=false hoặc HIDE_SAMPLE_REVIEWS=true/1). */
    public boolean hideSampleReviewsEffective() { return !sampleData || hideSampleReviews; }

    public static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
