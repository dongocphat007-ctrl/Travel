package vn.travel.service;

import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;
import vn.travel.util.Ids;
import vn.travel.web.HttpError;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * OTP đăng ký (thay EmailJS ở trình duyệt): mã sinh + kiểm ở server, gửi qua Mailer.
 * Verify thành công trả "vé" ký HMAC gắn với email (15 phút); /api/auth/register yêu cầu vé khi dịch vụ email đã bật.
 */
@Service
public class Otp {
    private static final Logger LOG = Logger.getLogger("travel.otp");
    static final long TTL = 5 * 60_000L, RESEND = 30_000L, TICKET_TTL = 15 * 60_000L;
    static final int MAX_TRIES = 5;

    private record Pending(String code, long expiry, long sentAt, int tries) { }

    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final Mailer mailer;
    private final SessionService sessions;
    private final Clock clock;
    private final boolean devLog;

    public Otp(Mailer mailer, SessionService sessions, Clock clock, TravelProperties props) {
        this.mailer = mailer;
        this.sessions = sessions;
        this.clock = clock;
        this.devLog = props.otpDevLog();
    }

    /** Có bắt buộc OTP khi đăng ký không: chỉ khi gửi được email (hoặc đang bật log dev). */
    public boolean required() { return mailer.enabled() || devLog; }

    public void send(String name, String email) {
        String e = email == null ? "" : email.trim().toLowerCase();
        if (!e.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw HttpError.bad("Email không hợp lệ");
        if (!required()) throw new HttpError(503, "Chưa cấu hình dịch vụ gửi email trên máy chủ");
        long now = clock.millis();
        Pending old = pending.get(e);
        if (old != null && now - old.sentAt < RESEND) throw new HttpError(429, "Vui lòng đợi " + ((RESEND - (now - old.sentAt)) / 1000 + 1) + " giây rồi gửi lại");
        String code = String.valueOf(Ids.sixDigits());
        pending.put(e, new Pending(code, now + TTL, now, 0));
        if (devLog && !mailer.enabled()) LOG.warning("[OTP DEV] " + e + " → " + code);
        else if (!mailer.send(e, "Travel – Mã xác nhận của bạn", "<p>Xin chào " + Mailer.esc(name) + ",</p><p>Mã xác nhận Travel của bạn là <b style=\"font-size:20px\">" + code
                + "</b>. Mã có hiệu lực trong 5 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>")) {
            pending.remove(e);
            throw new HttpError(502, "Gửi email thất bại. Vui lòng thử lại sau.");
        }
    }

    /** Trả vé OTP nếu đúng mã. */
    public String verify(String email, String code) {
        String e = email == null ? "" : email.trim().toLowerCase();
        Pending p = pending.get(e);
        long now = clock.millis();
        if (p == null) throw HttpError.bad("Chưa có mã OTP nào được gửi.");
        if (now > p.expiry) { pending.remove(e); throw HttpError.bad("Mã OTP đã hết hạn. Vui lòng gửi lại."); }
        if (p.tries + 1 > MAX_TRIES) { pending.remove(e); throw new HttpError(429, "Nhập sai quá nhiều lần. Vui lòng gửi lại mã."); }
        boolean ok = code != null && MessageDigest.isEqual(p.code.getBytes(StandardCharsets.UTF_8), code.trim().getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            pending.put(e, new Pending(p.code, p.expiry, p.sentAt, p.tries + 1));
            throw HttpError.bad("Mã OTP không đúng. Vui lòng thử lại.");
        }
        pending.remove(e);
        String body = e + "|" + (now + TICKET_TTL);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(body.getBytes(StandardCharsets.UTF_8)) + "." + sessions.sign("otp:" + body);
    }

    /** Vé hợp lệ cho email này? */
    public boolean ticketValid(String email, String ticket) {
        if (ticket == null || email == null) return false;
        int dot = ticket.indexOf('.');
        if (dot <= 0) return false;
        try {
            String body = new String(java.util.Base64.getUrlDecoder().decode(ticket.substring(0, dot)), StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(sessions.sign("otp:" + body).getBytes(StandardCharsets.UTF_8), ticket.substring(dot + 1).getBytes(StandardCharsets.UTF_8))) return false;
            int bar = body.lastIndexOf('|');
            return body.substring(0, bar).equals(email.trim().toLowerCase()) && Long.parseLong(body.substring(bar + 1)) >= clock.millis();
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
