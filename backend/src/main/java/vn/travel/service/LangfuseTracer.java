package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Logger;

/**
 * Trình theo dõi LLM Observability & Tracing qua Langfuse Cloud (V2 Ingestion API).
 * Chạy bất đồng bộ trong background thread, hoàn toàn không chặn hay làm chậm luồng gọi Gemini của người dùng.
 * Khi chưa cấu hình key hoặc có sự cố mạng, âm thầm bỏ qua, tuyệt đối không ảnh hưởng đến nghiệp vụ web.
 */
@Service
public class LangfuseTracer {
    private static final Logger LOG = Logger.getLogger("travel.langfuse");
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private HttpClient http;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "langfuse-worker");
        t.setDaemon(true);
        return t;
    });

    private synchronized HttpClient client() {
        if (http == null) http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        return http;
    }

    public LangfuseTracer(TravelProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public boolean enabled() {
        return !TravelProperties.blank(props.langfusePublicKey()) && !TravelProperties.blank(props.langfuseSecretKey());
    }

    public String host() {
        String h = props.langfuseBaseUrl();
        if (TravelProperties.blank(h)) h = "https://cloud.langfuse.com";
        return h.endsWith("/") ? h.substring(0, h.length() - 1) : h;
    }

    /**
     * Ghi nhận 1 Trace + Generation lên Langfuse Cloud.
     */
    public void recordGeneration(String traceId, String name, String userId, String sessionId,
                                 Instant startTime, Instant endTime,
                                 String model, Map<String, Object> modelParams,
                                 Object input, Object output,
                                 long promptTokens, long candidateTokens, long totalTokens,
                                 Map<String, Object> metadata, String errorMsg) {
        if (!enabled()) return;
        executor.submit(() -> {
            try {
                String now = Instant.now().toString();
                String traceEventId = UUID.randomUUID().toString();
                String genEventId = UUID.randomUUID().toString();
                String tid = (traceId == null || traceId.isBlank()) ? "tr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16) : traceId;
                String gid = "gen_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

                Map<String, Object> traceBody = new LinkedHashMap<>();
                traceBody.put("id", tid);
                traceBody.put("name", name == null || name.isBlank() ? "travel-ai" : name);
                if (userId != null && !userId.isBlank()) traceBody.put("userId", userId);
                if (sessionId != null && !sessionId.isBlank()) traceBody.put("sessionId", sessionId);
                traceBody.put("input", input);
                traceBody.put("output", output);
                traceBody.put("tags", List.of("travel", model == null ? "gemini" : model));

                long total = totalTokens > 0 ? totalTokens : (promptTokens + candidateTokens);
                // Đơn giá chuẩn Gemini Flash: $0.075 / 1M input tokens, $0.30 / 1M output tokens
                double inputCost = (Math.max(0, promptTokens) * 0.075) / 1_000_000.0;
                double outputCost = (Math.max(0, candidateTokens) * 0.30) / 1_000_000.0;
                double totalCost = inputCost + outputCost;
                if (totalCost == 0 && total > 0) totalCost = (total * 0.15) / 1_000_000.0;

                Map<String, Object> meta = metadata != null ? new LinkedHashMap<>(metadata) : new LinkedHashMap<>();
                meta.put("totalTokens", total);
                if (totalCost > 0) meta.put("estimatedCostUsd", String.format("%.6f", totalCost));
                traceBody.put("metadata", meta);

                Map<String, Object> genBody = new LinkedHashMap<>();
                genBody.put("id", gid);
                genBody.put("traceId", tid);
                genBody.put("name", "gemini-generate");
                genBody.put("startTime", startTime.toString());
                genBody.put("endTime", endTime.toString());
                genBody.put("model", model == null || model.isBlank() ? "gemini-1.5-flash" : model);
                if (modelParams != null) genBody.put("modelParameters", modelParams);
                genBody.put("input", input);
                genBody.put("output", output);

                Map<String, Object> usage = new LinkedHashMap<>();
                usage.put("input", Math.max(0, promptTokens));
                usage.put("output", Math.max(0, candidateTokens));
                usage.put("total", total);
                usage.put("unit", "TOKENS");
                if (totalCost > 0) {
                    usage.put("inputCost", inputCost);
                    usage.put("outputCost", outputCost);
                    usage.put("totalCost", totalCost);
                }
                genBody.put("usage", usage);
                genBody.put("usageDetails", Maps.of("input", promptTokens, "output", candidateTokens, "total", total));
                if (totalCost > 0) {
                    genBody.put("calculatedTotalCost", totalCost);
                    genBody.put("calculatedInputCost", inputCost);
                    genBody.put("calculatedOutputCost", outputCost);
                }

                if (errorMsg != null && !errorMsg.isBlank()) {
                    genBody.put("level", "ERROR");
                    genBody.put("statusMessage", errorMsg);
                } else {
                    genBody.put("level", "DEFAULT");
                }

                List<Map<String, Object>> batch = List.of(
                        Maps.of("id", traceEventId, "type", "trace-create", "timestamp", now, "body", traceBody),
                        Maps.of("id", genEventId, "type", "generation-create", "timestamp", now, "body", genBody)
                );

                sendBatch(batch);
                LOG.info("Langfuse: recorded trace " + tid + " (" + (totalTokens > 0 ? totalTokens : (promptTokens + candidateTokens)) + " tokens)");
            } catch (Exception e) {
                LOG.fine("Langfuse trace failed: " + e.getMessage());
            }
        });
    }

    /**
     * Ghi nhận phản hồi người dùng (thumbs up: 1.0, thumbs down: 0.0) lên Score của Trace.
     */
    public void recordScore(String traceId, String name, double value, String comment) {
        if (!enabled() || traceId == null || traceId.isBlank()) return;
        executor.submit(() -> {
            try {
                String eventId = UUID.randomUUID().toString();
                String scoreId = "sc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("id", scoreId);
                body.put("traceId", traceId);
                body.put("name", name == null || name.isBlank() ? "user-feedback" : name);
                body.put("value", value);
                if (comment != null && !comment.isBlank()) body.put("comment", comment);

                List<Map<String, Object>> batch = List.of(
                        Maps.of("id", eventId, "type", "score-create", "timestamp", Instant.now().toString(), "body", body)
                );
                sendBatch(batch);
                LOG.info("Langfuse: recorded score " + value + " on trace " + traceId);
            } catch (Exception e) {
                LOG.fine("Langfuse score failed: " + e.getMessage());
            }
        });
    }

    /**
     * Gửi một trace kiểm thử mẫu lên Langfuse Cloud để kích hoạt project và kiểm tra kết nối ngay lập tức.
     */
    public Map<String, Object> sendTestTrace() {
        return sendTestTrace(null, null);
    }

    public Map<String, Object> sendTestTrace(String prompt, String reply) {
        if (!enabled()) {
            return Maps.of("ok", false, "message", "Langfuse chưa được cấu hình (thiếu public key hoặc secret key)");
        }
        try {
            String now = Instant.now().toString();
            String tid = "tr_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            String gid = "gen_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);

            String inText = (prompt == null || prompt.isBlank()) ? "Kiểm tra kết nối Langfuse từ Travel App" : prompt.trim();
            String outText = (reply == null || reply.isBlank()) ? "Kết nối thành công! Langfuse đã sẵn sàng ghi nhận trace." : reply.trim();

            Map<String, Object> traceBody = new LinkedHashMap<>();
            traceBody.put("id", tid);
            traceBody.put("name", "langfuse-test-ping");
            traceBody.put("input", inText);
            traceBody.put("output", outText);
            traceBody.put("tags", List.of("travel", "test-connection"));

            Map<String, Object> genBody = new LinkedHashMap<>();
            genBody.put("id", gid);
            genBody.put("traceId", tid);
            genBody.put("name", "gemini-test-generation");
            genBody.put("startTime", now);
            genBody.put("endTime", now);
            genBody.put("model", "gemini-1.5-flash");
            genBody.put("input", inText);
            genBody.put("output", outText);
            genBody.put("level", "DEFAULT");

            List<Map<String, Object>> batch = List.of(
                    Maps.of("id", UUID.randomUUID().toString(), "type", "trace-create", "timestamp", now, "body", traceBody),
                    Maps.of("id", UUID.randomUUID().toString(), "type", "generation-create", "timestamp", now, "body", genBody)
            );

            String auth = Base64.getEncoder().encodeToString(
                    (props.langfusePublicKey().trim() + ":" + props.langfuseSecretKey().trim()).getBytes(StandardCharsets.UTF_8));
            String json = mapper.writeValueAsString(Map.of("batch", batch));
            HttpRequest req = HttpRequest.newBuilder(URI.create(host() + "/api/public/ingestion"))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Basic " + auth)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> resp = client().send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 == 2) {
                return Maps.of("ok", true, "status", resp.statusCode(), "traceId", tid, "message", "Đã gửi trace kiểm tra thành công lên Langfuse Cloud! Hãy F5 lại trang Langfuse.");
            } else {
                return Maps.of("ok", false, "status", resp.statusCode(), "body", resp.body(), "message", "Langfuse từ chối yêu cầu (HTTP " + resp.statusCode() + "). Kiểm tra lại API key hoặc Base URL.");
            }
        } catch (Exception e) {
            return Maps.of("ok", false, "message", "Lỗi kết nối tới Langfuse: " + e.getMessage());
        }
    }

    private void sendBatch(List<Map<String, Object>> batch) throws Exception {
        String auth = Base64.getEncoder().encodeToString(
                (props.langfusePublicKey().trim() + ":" + props.langfuseSecretKey().trim()).getBytes(StandardCharsets.UTF_8));
        String json = mapper.writeValueAsString(Map.of("batch", batch));
        HttpRequest req = HttpRequest.newBuilder(URI.create(host() + "/api/public/ingestion"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .header("Authorization", "Basic " + auth)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<String> resp = client().send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) {
            LOG.warning("Langfuse ingestion returned HTTP " + resp.statusCode() + ": " + resp.body());
        }
    }
}

