package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

/**
 * E1: gửi email từ Spring Boot qua API email dạng Resend/Brevo-compatible (HTTPS, không cần SMTP/thư viện).
 * Khóa API chỉ ở biến môi trường (EMAIL_API_KEY); trống = tắt gửi (ghi log, không lỗi).
 */
@Service
public class Mailer {
    private static final Logger LOG = Logger.getLogger("travel.mail");
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public Mailer(TravelProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public boolean enabled() {
        return !TravelProperties.blank(props.emailApiKey()) && !TravelProperties.blank(props.emailFrom());
    }

    /** true nếu nhà cung cấp nhận thư. Không ném lỗi: đặt tour không được thất bại vì email. */
    public boolean send(String to, String subject, String html) {
        if (!enabled()) {
            LOG.warning("EMAIL_API_KEY/EMAIL_FROM chưa cấu hình — bỏ qua gửi thư tới " + to);
            return false;
        }
        try {
            String url = TravelProperties.blank(props.emailApiUrl()) ? "https://api.resend.com/emails" : props.emailApiUrl();
            String body = mapper.writeValueAsString(Maps.of("from", props.emailFrom(), "to", List.of(to), "subject", subject, "html", html));
            HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + props.emailApiKey()).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) LOG.warning("Gửi thư lỗi HTTP " + r.statusCode());
            return r.statusCode() / 100 == 2;
        } catch (Exception e) {
            LOG.warning("Gửi thư lỗi: " + e.getMessage());
            return false;
        }
    }

    public static String esc(Object s) {
        return String.valueOf(s == null ? "" : s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static String money(Object n) {
        return String.format("%,d", Maps.lng(Maps.of("v", n), "v")).replace(',', '.') + " ₫";
    }

    /** E1/E5: email xác nhận dùng CHÍNH price breakdown đã lưu trong đơn (giá gốc → giảm → giá cuối → cọc 20%). */
    public String bookingHtml(Map<String, Object> b) {
        Map<String, Object> p = Maps.map(b.get("priceBreakdown"));
        StringBuilder sb = new StringBuilder("<h2>Travel – Xác nhận đặt tour</h2>")
                .append("<p>Xin chào <b>").append(esc(b.get("customerName"))).append("</b>, chúng tôi đã nhận yêu cầu đặt tour của bạn.</p>")
                .append("<table cellpadding=\"6\" style=\"border-collapse:collapse\">")
                .append(row("Mã đơn", b.get("id"))).append(row("Tour", b.get("tourName"))).append(row("Ngày đi", b.get("date")))
                .append(row("Số khách", b.get("pax")));
        if (p != null) {
            sb.append(row("Giá tour", money(p.get("base"))));
            if (Maps.lng(p, "hdv") > 0) sb.append(row("Phí HDV", money(p.get("hdv"))));
            if (Maps.lng(p, "discount") > 0) sb.append(row("Voucher " + esc(p.get("voucherCode")), "−" + money(p.get("discount"))));
            sb.append(row("Giá cuối", "<b>" + money(p.get("final")) + "</b>")).append(row("Đặt cọc " + p.get("depositPct") + "%", "<b>" + money(p.get("deposit")) + "</b>"));
        }
        sb.append(row("Nội dung chuyển khoản", "<b>" + esc(b.get("payCode")) + "</b>")).append("</table>")
                .append("<p>Vui lòng chuyển khoản đúng số tiền cọc và đúng nội dung để đơn được xác nhận tự động.</p>");
        return sb.toString();
    }

    private static String row(String k, Object v) {
        return "<tr><td style=\"border:1px solid #ddd\">" + k + "</td><td style=\"border:1px solid #ddd\">" + (v instanceof String s && s.startsWith("<b>") ? s : esc(v)) + "</td></tr>";
    }
}
