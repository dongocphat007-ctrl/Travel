package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Cầu nối AI (VĐ1/AI-13/AI-14): khóa Gemini chỉ ở máy chủ (GEMINI_API_KEY), gửi qua header x-goog-api-key.
 * Tích hợp Langfuse Tracing & Observability (bất đồng bộ, an toàn, không lộ khóa xuống trình duyệt).
 * Trình duyệt chỉ gọi POST /api/ai/generate. Giới hạn độ dài, timeout, lỗi rõ ràng; rate limit ở RateLimitFilter.
 */
@Service
public class AiProxy {
    static final int MAX_CHARS = 150_000, MAX_TURNS = 40;
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private final LangfuseTracer tracer;
    private HttpClient http;

    private synchronized HttpClient client() {
        if (http == null) http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        return http;
    }

    public AiProxy(TravelProperties props, ObjectMapper mapper) {
        this(props, mapper, null);
    }

    @Autowired
    public AiProxy(TravelProperties props, ObjectMapper mapper, @Autowired(required = false) LangfuseTracer tracer) {
        this.props = props;
        this.mapper = mapper;
        this.tracer = tracer;
    }

    public boolean enabled() { return !TravelProperties.blank(props.geminiApiKey()); }

    public boolean langfuseEnabled() { return tracer != null && tracer.enabled(); }

    public String host() { return tracer != null ? tracer.host() : "https://cloud.langfuse.com"; }

    public Map<String, Object> testLangfuse() {
        return testLangfuse(null, null);
    }

    public Map<String, Object> testLangfuse(String prompt, String reply) {
        if (tracer == null) return Maps.of("ok", false, "message", "LangfuseTracer chưa được khởi tạo");
        return tracer.sendTestTrace(prompt, reply);
    }

    public void feedback(String traceId, double value, String comment) {
        if (tracer != null) tracer.recordScore(traceId, "user-feedback", value, comment);
    }

    private String model() {
        String m = props.geminiModel();
        return TravelProperties.blank(m) || !m.matches("[A-Za-z0-9._-]{1,60}") ? "gemini-1.5-flash" : m;
    }

    public record GenerateResult(String text, String traceId) { }

    /** in: { prompt? | contents:[{role,text}], system?, maxTokens?, temperature?, json? } → text */
    public String generate(Map<String, Object> in) {
        return generateWithTrace(in).text();
    }

    public GenerateResult generateWithTrace(Map<String, Object> in) {
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
                String role = "assistant".equals(m.get("role")) || "model".equals(m.get("role")) ? "model" : "user";
                if (!contents.isEmpty() && role.equals(contents.get(contents.size() - 1).get("role"))) {
                    // Gộp nhiều lượt liên tiếp cùng role để đảm bảo Gemini không báo lỗi 400
                    Map<String, Object> prev = contents.get(contents.size() - 1);
                    List<Map<String, Object>> parts = new ArrayList<>();
                    for (Object p : Maps.list(prev.get("parts"))) if (Maps.map(p) != null) parts.add(Maps.map(p));
                    parts.add(Maps.of("text", text));
                    contents.set(contents.size() - 1, Maps.of("role", role, "parts", parts));
                } else {
                    contents.add(Maps.of("role", role, "parts", List.of(Maps.of("text", text))));
                }
            }
            // Gemini yêu cầu lượt đầu tiên phải là user
            while (!contents.isEmpty() && "model".equals(contents.get(0).get("role"))) {
                contents.remove(0);
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
        if (model().contains("thinking") || model().contains("2.5")) {
            gen.put("thinkingConfig", Maps.of("thinkingBudget", 0));
        }
        if (Boolean.TRUE.equals(in.get("json"))) gen.put("responseMimeType", "application/json");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", contents);
        body.put("generationConfig", gen);
        if (!system.isEmpty()) body.put("system_instruction", Maps.of("parts", List.of(Maps.of("text", system))));

        String traceId = Maps.str(in, "traceId");
        if (traceId.isEmpty()) traceId = "tr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String feature = Maps.str(in, "feature");
        if (feature.isEmpty()) feature = "travel-ai";
        String userId = Maps.str(in, "userId");
        String sessionId = Maps.str(in, "sessionId");
        Instant start = Instant.now();

        try {
            HttpResponse<String> r = client().send(HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model() + ":generateContent"))
                    .timeout(Duration.ofSeconds(40)).header("Content-Type", "application/json").header("x-goog-api-key", props.geminiApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
            Instant end = Instant.now();
            if (r.statusCode() / 100 != 2) {
                if (tracer != null) {
                    tracer.recordGeneration(traceId, feature, userId, sessionId, start, end, model(), gen,
                            contents, null, 0, 0, 0, Maps.of("status", r.statusCode(), "system", system), "HTTP " + r.statusCode());
                }
                throw new HttpError(502, "Dịch vụ AI đang lỗi (HTTP " + r.statusCode() + "), vui lòng thử lại sau");
            }
            Map<String, Object> out = mapper.readValue(r.body(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
            StringBuilder sb = new StringBuilder();
            for (Object cand : Maps.list(out.get("candidates"))) {
                Map<String, Object> content = Maps.map(Maps.map(cand) == null ? null : Maps.map(cand).get("content"));
                if (content != null) {
                    for (Object part : Maps.list(content.get("parts"))) {
                        Map<String, Object> pm = Maps.map(part);
                        if (pm != null && !Boolean.TRUE.equals(pm.get("thought"))) {
                            sb.append(Maps.str(pm, "text"));
                        }
                    }
                }
                break;
            }
            String text = sb.toString().trim();
            if (text.isEmpty()) throw new HttpError(502, "AI không có phản hồi");

            // Trích xuất usage token từ Gemini
            Map<String, Object> usage = Maps.map(out.get("usageMetadata"));
            long promptTokens = usage != null ? Maps.lng(usage, "promptTokenCount") : 0;
            long candidateTokens = usage != null ? Maps.lng(usage, "candidatesTokenCount") : 0;
            long totalTokens = usage != null ? Maps.lng(usage, "totalTokenCount") : 0;

            if (tracer != null) {
                tracer.recordGeneration(traceId, feature, userId, sessionId, start, end, model(), gen,
                        contents, text, promptTokens, candidateTokens, totalTokens,
                        Maps.of("chars", chars, "turns", contents.size(), "system", system), null);
            }

            return new GenerateResult(text, traceId);
        } catch (HttpError e) {
            throw e;
        } catch (java.net.http.HttpTimeoutException e) {
            if (tracer != null) {
                tracer.recordGeneration(traceId, feature, userId, sessionId, start, Instant.now(), model(), gen,
                        contents, null, 0, 0, 0, Maps.of("timeout", true), "Timeout");
            }
            throw new HttpError(504, "Dịch vụ AI phản hồi quá chậm, vui lòng thử lại");
        } catch (Exception e) {
            if (tracer != null) {
                tracer.recordGeneration(traceId, feature, userId, sessionId, start, Instant.now(), model(), gen,
                        contents, null, 0, 0, 0, Maps.of("error", e.getMessage() == null ? "unknown" : e.getMessage()), e.getMessage());
            }
            throw new HttpError(502, "Không kết nối được dịch vụ AI");
        }
    }
}
