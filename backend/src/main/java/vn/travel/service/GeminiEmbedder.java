package vn.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
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

/** Embedding bằng Gemini (cùng GEMINI_API_KEY ở server, gửi qua header x-goog-api-key). 256 chiều để vectors.json gọn. */
@Service
public class GeminiEmbedder implements Embedder {
    static final String MODEL = "gemini-embedding-001";
    static final int DIMS = 256, BATCH = 64;
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public GeminiEmbedder(TravelProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    @Override public boolean enabled() { return !TravelProperties.blank(props.geminiApiKey()); }
    @Override public String model() { return MODEL; }
    @Override public int dims() { return DIMS; }

    @Override
    public List<float[]> embed(List<String> texts, boolean query) {
        if (!enabled()) throw new HttpError(503, "AI chưa được cấu hình trên máy chủ");
        List<float[]> out = new ArrayList<>();
        for (int i = 0; i < texts.size(); i += BATCH) {
            List<Map<String, Object>> reqs = new ArrayList<>();
            for (String t : texts.subList(i, Math.min(texts.size(), i + BATCH)))
                reqs.add(Maps.of("model", "models/" + MODEL, "content", Maps.of("parts", List.of(Maps.of("text", t))),
                        "taskType", query ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", "outputDimensionality", DIMS));
            try {
                HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":batchEmbedContents"))
                        .timeout(Duration.ofSeconds(60)).header("Content-Type", "application/json").header("x-goog-api-key", props.geminiApiKey())
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Maps.of("requests", reqs)))).build(), HttpResponse.BodyHandlers.ofString());
                if (r.statusCode() / 100 != 2) throw new HttpError(502, "Dịch vụ embedding đang lỗi (HTTP " + r.statusCode() + ")");
                Map<String, Object> body = mapper.readValue(r.body(), new TypeReference<Map<String, Object>>() { });
                List<Object> embs = Maps.list(body.get("embeddings"));
                if (embs.size() != reqs.size()) throw new HttpError(502, "Dịch vụ embedding trả thiếu vector");
                for (Object e : embs) {
                    List<Object> vals = Maps.list(Maps.map(e) == null ? null : Maps.map(e).get("values"));
                    if (vals.size() != DIMS) throw new HttpError(502, "Vector embedding sai kích thước");
                    float[] v = new float[DIMS];
                    for (int k = 0; k < DIMS; k++) v[k] = ((Number) vals.get(k)).floatValue();
                    out.add(Rag.normalize(v));
                }
            } catch (HttpError e) {
                throw e;
            } catch (Exception e) {
                throw new HttpError(502, "Không kết nối được dịch vụ embedding");
            }
        }
        return out;
    }
}
