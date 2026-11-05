package vn.travel.service;

import vn.travel.config.TravelProperties;

/** Dựng TravelProperties cho test mà không phụ thuộc thứ tự 23 tham số ở từng nơi. */
final class TestProps {
    private TestProps() { }

    static TravelProperties with(String geminiKey, String emailKey, String emailFrom, String emailUrl) {
        return new TravelProperties("web", "db", "", "", "test-session-secret-0123456789abcdef", "", "client-id",
                geminiKey, "gemini-1.5-flash", emailKey, emailUrl, emailFrom, false, "", "", "", "", "TRAVEL", "", false, true, false,
                "", "", "https://cloud.langfuse.com");
    }

    static TravelProperties withWebRoot(String webRoot) {
        return new TravelProperties(webRoot, "db", "", "", "test-session-secret-0123456789abcdef", "", "client-id",
                "", "gemini-1.5-flash", "", "", "", false, "", "", "", "", "TRAVEL", "", false, true, false,
                "", "", "https://cloud.langfuse.com");
    }
}
