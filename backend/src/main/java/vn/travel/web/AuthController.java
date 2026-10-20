package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.Accounts;
import vn.travel.service.Otp;
import vn.travel.util.Maps;

import java.util.Map;

/** Auth (BE-06): đăng ký, đăng nhập, Google, hồ sơ, OTP email. Hợp đồng giữ nguyên với js/auth.js. */
@RestController
public class AuthController {
    private final Accounts accounts;
    private final CurrentUser current;
    private final Otp otp;

    public AuthController(Accounts accounts, CurrentUser current, Otp otp) {
        this.accounts = accounts;
        this.current = current;
        this.otp = otp;
    }

    private static Map<String, Object> b(Map<String, Object> body) { return body == null ? Map.of() : body; }

    @PostMapping("/api/auth/check-email")
    public Map<String, Object> checkEmail(@RequestBody(required = false) Map<String, Object> body) {
        return Maps.of("ok", true, "exists", accounts.emailExists(Maps.str(b(body), "email")));
    }

    @PostMapping("/api/auth/register")
    public Map<String, Object> register(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req, HttpServletResponse res) {
        Map<String, Object> in = b(body);
        if (otp.required() && !otp.ticketValid(Maps.str(in, "email"), Maps.str(in, "otpTicket")))
            throw HttpError.bad("Vui lòng xác nhận email bằng mã OTP trước khi đăng ký", "reg-email");
        Map<String, Object> r = accounts.register(Maps.str(in, "name"), Maps.str(in, "email"), Maps.str(in, "password"));
        current.start(req, res, Maps.str(Maps.map(r.get("user")), "id"));
        return Maps.of("ok", true, "user", r.get("user"), "welcomeVoucher", r.get("welcomeVoucher"));
    }

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req, HttpServletResponse res) {
        Map<String, Object> u = accounts.login(Maps.str(b(body), "email"), Maps.str(b(body), "password"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @PostMapping("/api/auth/google")
    public Map<String, Object> google(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req, HttpServletResponse res) {
        Map<String, Object> u = accounts.google(Maps.str(b(body), "credential"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @PostMapping("/api/auth/logout")
    public Map<String, Object> logout(HttpServletResponse res) {
        current.end(res);
        return Maps.of("ok", true);
    }

    @GetMapping("/api/auth/me")
    public Map<String, Object> me(HttpServletRequest req) {
        return Maps.of("ok", true, "user", Accounts.pub(current.require(req)));
    }

    @PostMapping("/api/auth/profile")
    public Map<String, Object> profile(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> r = accounts.profile(Maps.str(u, "id"), b(body));
        return Maps.of("ok", true, "user", r.get("user"), "birthdayVoucher", r.get("birthdayVoucher"));
    }

    @PostMapping("/api/auth/migrate")
    public Map<String, Object> migrate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req, HttpServletResponse res) {
        Map<String, Object> in = b(body);
        Map<String, Object> u = accounts.migrate(Maps.str(in, "id"), Maps.str(in, "name"), Maps.str(in, "email"), Maps.str(in, "password"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @PostMapping("/api/otp/send")
    public Map<String, Object> otpSend(@RequestBody(required = false) Map<String, Object> body) {
        otp.send(Maps.str(b(body), "name"), Maps.str(b(body), "email"));
        return Maps.of("ok", true);
    }

    @PostMapping("/api/otp/verify")
    public Map<String, Object> otpVerify(@RequestBody(required = false) Map<String, Object> body) {
        String ticket = otp.verify(Maps.str(b(body), "email"), Maps.str(b(body), "code"));
        return Maps.of("ok", true, "ticket", ticket);
    }
}
