package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Cầu nối AI (VĐ1/AI-13/AI-14): khóa Gemini chỉ ở máy chủ (GEMINI_API_KEY), gửi qua header x-goog-api-key.
 * Trình duyệt chỉ gọi POST /api/ai/generate. Giới hạn độ dài, timeout, lỗi rõ ràng; rate limit ở RateLimitFilter.
 */
@Service
public class AiProxy {
    static final int MAX_CHARS = 150_000, MAX_TURNS = 40;
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public AiProxy(TravelProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public boolean enabled() { return !TravelProperties.blank(props.geminiApiKey()); }

    private String model() {
        String m = props.geminiModel();
        return TravelProperties.blank(m) || !m.matches("[A-Za-z0-9._-]{1,60}") ? "gemini-2.5-flash" : m;
    }

    /** in: { prompt? | contents:[{role,text}], system?, maxTokens?, temperature?, json? } → text */
    public String generate(Map<String, Object> in) {
        if (!enabled()) throw new HttpError(503, "AI chưa được cấu hình trên máy chủ");
        List<Map<String, Object>> contents = new ArrayList<>();
        int chars = 0;
        Object c = in.get("contents");
        if (c instanceof List<?> l && !l.isEmpty()) {
            if (l.size() > MAX_TURNS) throw HttpError.bad("Hội thoại quá dài");
            for (Object o : l) {
                Map<String, Object> m = Maps.map(o);
                String text = m == null ? "" : Maps.str(m, "text");
                if (text.isEmpty()) continue;
                chars += text.length();
                contents.add(Maps.of("role", "assistant".equals(m.get("role")) || "model".equals(m.get("role")) ? "model" : "user", "parts", List.of(Maps.of("text", text))));
            }
        } else {
            String p = Maps.str(in, "prompt");
            chars += p.length();
            if (!p.isEmpty()) contents.add(Maps.of("role", "user", "parts", List.of(Maps.of("text", p))));
        }
        String system = Maps.str(in, "system");
        chars += system.length();
        if (contents.isEmpty()) throw HttpError.bad("Thiếu nội dung câu hỏi");
        if (chars > MAX_CHARS) throw HttpError.bad("Nội dung gửi lên quá dài");

        Map<String, Object> gen = new LinkedHashMap<>();
        gen.put("maxOutputTokens", (int) Math.min(4000, Math.max(50, Maps.lng(in, "maxTokens") == 0 ? 1000 : Maps.lng(in, "maxTokens"))));
        double t = in.get("temperature") == null ? 0.5 : vn.travel.util.Pricing.num(in.get("temperature"));
        gen.put("temperature", Math.min(1.5, Math.max(0, t)));
        gen.put("thinkingConfig", Maps.of("thinkingBudget", 0));
        if (Boolean.TRUE.equals(in.get("json"))) gen.put("responseMimeType", "application/json");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", contents);
        body.put("generationConfig", gen);
        if (!system.isEmpty()) body.put("system_instruction", Maps.of("parts", List.of(Maps.of("text", system))));
        try {
            HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model() + ":generateContent"))
                    .timeout(Duration.ofSeconds(40)).header("Content-Type", "application/json").header("x-goog-api-key", props.geminiApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) throw new HttpError(502, "Dịch vụ AI đang lỗi (HTTP " + r.statusCode() + "), vui lòng thử lại sau");
            Map<String, Object> out = mapper.readValue(r.body(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
            StringBuilder sb = new StringBuilder();
            for (Object cand : Maps.list(out.get("candidates"))) {
                Map<String, Object> content = Maps.map(Maps.map(cand) == null ? null : Maps.map(cand).get("content"));
                if (content != null) for (Object part : Maps.list(content.get("parts"))) if (Maps.map(part) != null) sb.append(Maps.str(Maps.map(part), "text"));
                break;
            }
            String text = sb.toString().trim();
            if (text.isEmpty()) throw new HttpError(502, "AI không có phản hồi");
            return text;
        } catch (HttpError e) {
            throw e;
        } catch (java.net.http.HttpTimeoutException e) {
            throw new HttpError(504, "Dịch vụ AI phản hồi quá chậm, vui lòng thử lại");
        } catch (Exception e) {
            throw new HttpError(502, "Không kết nối được dịch vụ AI");
        }
    }
}
