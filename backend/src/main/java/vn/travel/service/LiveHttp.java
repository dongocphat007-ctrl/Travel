package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/** Gọi HTTP tới các nguồn dữ liệu ngoài. Khóa chỉ đi trong header/query phía máy chủ, không bao giờ vào thông báo lỗi. */
@Component
public class LiveHttp {
    public record Bytes(byte[] data, String contentType) { }

    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NORMAL).build();

    public LiveHttp(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    static String friendly(int status) {
        return switch (status) {
            case 400, 422 -> "Nguồn dữ liệu không nhận yêu cầu này (kiểm tra sân bay/ngày/điểm đến)";
            case 401, 403 -> "Khóa API của nguồn dữ liệu không hợp lệ hoặc chưa được kích hoạt";
            case 402 -> "Tài khoản nguồn dữ liệu chưa kích hoạt thanh toán";
            case 404 -> "Nguồn dữ liệu không có kết quả";
            case 429 -> "Nguồn dữ liệu đang giới hạn tốc độ, vui lòng thử lại sau ít phút";
            default -> "Nguồn dữ liệu đang lỗi (HTTP " + status + ")";
        };
    }

    private RuntimeException fail(Exception e) {
        if (e instanceof LiveException le) return le;
        if (e instanceof java.net.http.HttpTimeoutException) return new LiveException(504, "Nguồn dữ liệu phản hồi quá chậm");
        if (e instanceof InterruptedException) Thread.currentThread().interrupt();
        return new LiveException(502, "Không kết nối được nguồn dữ liệu");
    }

    /** Trả về Map/List đã parse từ JSON. body = null → không gửi nội dung. */
    public Object json(String method, String url, Map<String, String> headers, Object body, int timeoutSec) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(timeoutSec)).header("Accept", "application/json");
            headers.forEach(b::header);
            if (body != null) b.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            else b.method(method, HttpRequest.BodyPublishers.noBody());
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) throw new LiveException(r.statusCode(), friendly(r.statusCode()));
            return mapper.readValue(r.body(), Object.class);
        } catch (Exception e) {
            throw fail(e);
        }
    }

    public Bytes bytes(String url, Map<String, String> headers, int timeoutSec) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(timeoutSec)).GET();
            headers.forEach(b::header);
            HttpResponse<byte[]> r = http.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (r.statusCode() / 100 != 2) throw new LiveException(r.statusCode(), friendly(r.statusCode()));
            return new Bytes(r.body(), r.headers().firstValue("Content-Type").orElse("image/jpeg"));
        } catch (Exception e) {
            throw fail(e);
        }
    }
}
