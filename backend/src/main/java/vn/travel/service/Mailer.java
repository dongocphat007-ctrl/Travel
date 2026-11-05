package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
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
import java.util.Properties;
import java.util.logging.Logger;

/**
 * Gửi email từ Spring Boot qua:
 * 1. Gmail SMTP (JavaMailSender) nếu có cấu hình EMAIL_USER & EMAIL_PASS (gửi được cho bất kỳ ai).
 * 2. Resend API (HTTPS) nếu có EMAIL_API_KEY.
 */
@Service
public class Mailer {
    private static final Logger LOG = Logger.getLogger("travel.mail");
    private final TravelProperties props;
    private final ObjectMapper mapper;
    private JavaMailSender mailSender;
    private HttpClient http;

    private synchronized HttpClient getHttp() {
        if (http == null) {
            http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        }
        return http;
    }

    @Value("${spring.mail.host:${EMAIL_HOST:smtp.gmail.com}}")
    private String smtpHost;

    @Value("${spring.mail.port:${EMAIL_PORT:587}}")
    private int smtpPort = 587;

    @Value("${spring.mail.username:${EMAIL_USER:}}")
    private String smtpUser;

    @Value("${spring.mail.password:${EMAIL_PASS:}}")
    private String smtpPass;

    public Mailer(TravelProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.mailSender = null;
    }

    @Autowired
    public Mailer(TravelProperties props, ObjectMapper mapper, org.springframework.beans.factory.ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.props = props;
        this.mapper = mapper;
        this.mailSender = mailSenderProvider != null ? mailSenderProvider.getIfAvailable() : null;
    }

    public String smtpUser() {
        if (smtpUser != null && !smtpUser.isBlank()) return smtpUser.trim();
        String env = System.getenv("EMAIL_USER");
        if (env != null && !env.isBlank()) return env.trim();
        return "";
    }

    public String smtpPass() {
        if (smtpPass != null && !smtpPass.isBlank()) return smtpPass.trim();
        String env = System.getenv("EMAIL_PASS");
        if (env != null && !env.isBlank()) return env.trim();
        return "";
    }

    private static Map<String, String> dotEnv() {
        Map<String, String> map = new java.util.HashMap<>();
        List<java.nio.file.Path> paths = List.of(
                java.nio.file.Path.of(".env"),
                java.nio.file.Path.of("backend/.env"),
                java.nio.file.Path.of("../.env"),
                java.nio.file.Path.of("../backend/.env")
        );
        for (java.nio.file.Path p : paths) {
            if (java.nio.file.Files.exists(p) && java.nio.file.Files.isRegularFile(p)) {
                try {
                    for (String line : java.nio.file.Files.readAllLines(p, java.nio.charset.StandardCharsets.UTF_8)) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                        int eq = trimmed.indexOf('=');
                        if (eq > 0) {
                            String k = trimmed.substring(0, eq).trim();
                            String v = trimmed.substring(eq + 1).trim();
                            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                                v = v.substring(1, v.length() - 1);
                            }
                            map.putIfAbsent(k, v);
                        }
                    }
                    if (!map.isEmpty()) break;
                } catch (Exception ignored) {}
            }
        }
        return map;
    }

    public synchronized JavaMailSender getMailSender() {
        String user = smtpUser();
        String pass = smtpPass();
        if (!user.isEmpty() && !pass.isEmpty()) {
            JavaMailSenderImpl impl = new JavaMailSenderImpl();
            impl.setHost(smtpHost != null && !smtpHost.isBlank() ? smtpHost.trim() : "smtp.gmail.com");
            impl.setPort(smtpPort > 0 ? smtpPort : 587);
            impl.setUsername(user);
            impl.setPassword(pass);
            Properties p = impl.getJavaMailProperties();
            p.put("mail.smtp.auth", "true");
            p.put("mail.smtp.starttls.enable", "true");
            p.put("mail.smtp.starttls.required", "true");
            p.put("mail.smtp.ssl.trust", impl.getHost());
            p.put("mail.smtp.localhost", "localhost");
            p.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
            p.put("mail.smtp.connectiontimeout", "7000");
            p.put("mail.smtp.timeout", "7000");
            p.put("mail.smtp.writetimeout", "7000");
            this.mailSender = impl;
            return this.mailSender;
        }
        if (this.mailSender != null) return this.mailSender;
        return null;
    }

    public boolean isSmtpEnabled() {
        return getMailSender() != null && !smtpUser().isEmpty() && !smtpPass().isEmpty();
    }

    public boolean isResendEnabled() {
        return !TravelProperties.blank(props.emailApiKey()) && !TravelProperties.blank(props.emailFrom());
    }

    public boolean enabled() {
        return isSmtpEnabled() || isResendEnabled();
    }

    /** Gui email qua SMTP (uu tien) hoac Resend API. */
    public boolean send(String to, String subject, String html) {
        boolean smtpOk = isSmtpEnabled();
        boolean resendOk = isResendEnabled();
        System.out.println("[EMAIL] Bat dau gui email toi: " + to + " (SMTP=" + smtpOk + ", Resend=" + resendOk + ")");
        if (smtpOk) {
            return sendViaSmtp(to, subject, html);
        }
        if (resendOk) {
            return sendViaResend(to, subject, html);
        }
        System.out.println("[EMAIL WARN] Chua cau hinh Gmail SMTP hoac Resend API - bo qua gui thu toi: " + to);
        return false;
    }

    private boolean sendViaSmtp(String to, String subject, String html) {
        JavaMailSender sender = getMailSender();
        if (sender == null) {
            System.out.println("[EMAIL ERROR] JavaMailSender khong kha dung (kiem tra EMAIL_USER, EMAIL_PASS trong .env)");
            return false;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            String user = smtpUser();
            helper.setFrom(new InternetAddress(user, "Travel App", "UTF-8"));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            System.out.println("[EMAIL] Dang ket noi smtp.gmail.com:587 voi tai khoan: " + user + "...");
            sender.send(message);
            System.out.println("[EMAIL SUCCESS] Da gui email thanh cong qua Gmail SMTP toi: " + to);
            return true;
        } catch (Exception e) {
            System.out.println("[EMAIL ERROR] Gui email SMTP that bai toi " + to + ": " + e.getMessage());
            e.printStackTrace();
            if (isResendEnabled()) {
                System.out.println("[EMAIL] Dang thu lai gui qua Resend API...");
                return sendViaResend(to, subject, html);
            }
            return false;
        }
    }

    private boolean sendViaResend(String to, String subject, String html) {
        try {
            String url = TravelProperties.blank(props.emailApiUrl()) ? "https://api.resend.com/emails" : props.emailApiUrl();
            String from = props.emailFrom();
            if (from == null || from.isBlank() || from.contains("@gmail.com")) {
                from = "Travel <onboarding@resend.dev>";
            }
            String body = mapper.writeValueAsString(Maps.of("from", from, "to", List.of(to), "subject", subject, "html", html));
            HttpResponse<String> r = getHttp().send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10))
                    .header("Authorization", "Bearer " + props.emailApiKey()).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) LOG.warning("Gui thu Resend loi HTTP " + r.statusCode() + ": " + r.body());
            return r.statusCode() / 100 == 2;
        } catch (Exception e) {
            LOG.warning("Gui thu Resend loi: " + e.getMessage());
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

    /** Hóa đơn điện tử thanh toán tour. */
    public String invoiceHtml(Map<String, Object> b, String kind, long paidAmount, String note) {
        String kindName = switch (kind == null ? "" : kind) {
            case "deposit" -> "Tiền đặt cọc (20%)";
            case "full" -> "Thanh toán đủ 100%";
            case "final" -> "Thanh toán nốt phần còn lại";
            default -> "Thanh toán dịch vụ";
        };
        long totalPrice = Maps.lng(b, "price");
        long paidTotal = vn.travel.util.Flow.paidIn(b);
        long due = Math.max(0, totalPrice - paidTotal);
        String invNo = "HD-" + (b.get("payCode") != null ? b.get("payCode") : b.get("id"));

        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff\">");
        sb.append("<div style=\"border-bottom:2px solid #0284c7;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center\">");
        sb.append("<div><h2 style=\"margin:0;color:#0369a1\">TRAVEL VIỆT NAM</h2><div style=\"font-size:12px;color:#64748b\">CÔNG TY DU LỊCH & LỮ HÀNH VIỆT NAM</div></div>");
        sb.append("<div style=\"text-align:right\"><div style=\"font-weight:bold;color:#0f172a;font-size:14px\">HÓA ĐƠN ĐIỆN TỬ</div><div style=\"font-size:12px;color:#64748b\">Số: ").append(esc(invNo)).append("</div></div>");
        sb.append("</div>");

        sb.append("<p style=\"color:#334155;font-size:14px\">Kính gửi Quý khách <b>").append(esc(b.get("customerName"))).append("</b>,</p>");
        sb.append("<p style=\"color:#334155;font-size:14px\">Hệ thống Travel đã xác nhận nhận thành công khoản thanh toán của Quý khách cho tour du lịch dưới đây:</p>");

        sb.append("<table cellpadding=\"8\" style=\"width:100%;border-collapse:collapse;margin:16px 0;font-size:13px\">");
        sb.append(row("Mã đơn hàng", esc(b.get("payCode"))));
        sb.append(row("Tên tour", "<b>" + esc(b.get("tourName")) + "</b>"));
        sb.append(row("Ngày khởi hành", esc(b.get("date"))));
        sb.append(row("Số lượng khách", b.get("pax") + " người"));
        sb.append(row("Đợt thanh toán", "<b>" + esc(kindName) + "</b>"));
        sb.append(row("Số tiền vừa thanh toán", "<b style=\"color:#16a34a;font-size:15px\">+" + money(paidAmount) + "</b>"));
        sb.append(row("Tổng giá trị tour", money(totalPrice)));
        sb.append(row("Tổng tiền đã thanh toán", "<b>" + money(paidTotal) + "</b>"));
        sb.append(row("Số tiền còn lại", due <= 0 ? "<span style=\"color:#16a34a;font-weight:bold\">Đã hoàn tất 100%</span>" : "<b style=\"color:#ea580c\">" + money(due) + "</b>"));
        if (note != null && !note.isBlank()) {
            sb.append(row("Ghi chú", esc(note)));
        }
        sb.append("</table>");

        sb.append("<div style=\"background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:6px;margin:18px 0;font-size:13px;color:#166534\">");
        sb.append("✅ <b>Xác thực thanh toán:</b> Hóa đơn điện tử có giá trị pháp lý và đã được lưu trữ an toàn trên máy chủ Travel. ");
        sb.append("Quý khách có thể xem và tải bản hóa đơn định dạng <b>PDF</b> hoặc <b>Excel</b> trong trang Hồ sơ / Chuyến đi của tôi.");
        sb.append("</div>");

        sb.append("<div style=\"font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:12px;margin-top:20px;text-align:center\">");
        sb.append("Hotline hỗ trợ: 1900 6868 | Email: support@travel.vn | Website: https://travel.vn<br>");
        sb.append("Cảm ơn Quý khách đã tin tưởng và đồng hành cùng Travel Việt Nam!");
        sb.append("</div>");
        sb.append("</div>");

        return sb.toString();
    }
}
