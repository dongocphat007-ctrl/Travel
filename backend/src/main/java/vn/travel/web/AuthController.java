package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.Accounts;
import vn.travel.service.Otp;
import vn.travel.util.Maps;

import java.util.Map;

/**
 * Auth (BE-06): đăng ký, đăng nhập, Google, hồ sơ, OTP email. Hợp đồng giữ
 * nguyên với js/auth.js.
 */
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

    private static Map<String, Object> b(Map<String, Object> body) {
        return body == null ? Map.of() : body;
    }

    @PostMapping("/api/auth/check-email")
    public Map<String, Object> checkEmail(@RequestBody(required = false) Map<String, Object> body) {
        return Maps.of("ok", true, "exists", accounts.emailExists(Maps.str(b(body), "email")));
    }

    @PostMapping("/api/auth/register")
    public Map<String, Object> register(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req,
            HttpServletResponse res) {
        Map<String, Object> in = b(body);
        if (otp.required() && !otp.ticketValid(Maps.str(in, "email"), Maps.str(in, "otpTicket")))
            throw HttpError.bad("Vui lòng xác nhận email bằng mã OTP trước khi đăng ký", "reg-email");
        Map<String, Object> r = accounts.register(Maps.str(in, "name"), Maps.str(in, "email"), Maps.str(in, "password"),
                Maps.str(in, "birthday"));
        current.start(req, res, Maps.str(Maps.map(r.get("user")), "id"));
        return Maps.of("ok", true, "user", r.get("user"), "welcomeVoucher", r.get("welcomeVoucher"));
    }

    @PostMapping("/api/auth/login")
    public Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req,
            HttpServletResponse res) {
        Map<String, Object> u = accounts.login(Maps.str(b(body), "email"), Maps.str(b(body), "password"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @PostMapping("/api/auth/google")
    public Map<String, Object> google(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req,
            HttpServletResponse res) {
        Map<String, Object> u = accounts.google(Maps.str(b(body), "credential"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @RequestMapping(value = "/api/auth/logout", method = { RequestMethod.POST, RequestMethod.GET })
    public Map<String, Object> logout(HttpServletRequest req, HttpServletResponse res) {
        current.end(res);
        if ("GET".equalsIgnoreCase(req.getMethod())) {
            try {
                res.sendRedirect("/");
            } catch (Exception ignored) {
            }
            return null;
        }
        return Maps.of("ok", true);
    }

    @GetMapping("/api/auth/me")
    public Map<String, Object> me(HttpServletRequest req) {
        return Maps.of("ok", true, "user", Accounts.pub(current.require(req)));
    }

    @GetMapping("/api/auth/roles")
    public Map<String, Object> roles() {
        return Maps.of("ok", true, "roles", vn.travel.security.RolePermissions.getAllRolesMetadata());
    }

    @GetMapping("/api/auth/permissions")
    public Map<String, Object> permissions() {
        java.util.List<Map<String, Object>> allPerms = new java.util.ArrayList<>();
        for (vn.travel.security.Permission p : vn.travel.security.Permission.values()) {
            allPerms.add(Maps.of("code", p.getCode(), "name", p.name(), "description", p.getDescription()));
        }
        return Maps.of("ok", true, "matrix", vn.travel.security.RolePermissions.getMatrixMap(), "permissions",
                allPerms);
    }

    @PostMapping("/api/auth/profile")
    public Map<String, Object> profile(@RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> r = accounts.profile(Maps.str(u, "id"), b(body));
        return Maps.of("ok", true, "user", r.get("user"), "birthdayVoucher", r.get("birthdayVoucher"));
    }

    @PostMapping("/api/auth/migrate")
    public Map<String, Object> migrate(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req,
            HttpServletResponse res) {
        Map<String, Object> in = b(body);
        Map<String, Object> u = accounts.migrate(Maps.str(in, "id"), Maps.str(in, "name"), Maps.str(in, "email"),
                Maps.str(in, "password"));
        current.start(req, res, Maps.str(u, "id"));
        return Maps.of("ok", true, "user", u);
    }

    @GetMapping("/api/otp/status")
    public Map<String, Object> otpStatus() {
        return Maps.of("ok", true, "required", otp.required(), "mailEnabled", otp.mailEnabled());
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

    @PostMapping("/api/auth/forgot-password/send-otp")
    public Map<String, Object> forgotPasswordSendOtp(@RequestBody(required = false) Map<String, Object> body) {
        String email = Maps.str(b(body), "email").trim().toLowerCase();
        if (email.isEmpty()) throw HttpError.bad("Vui lòng nhập email", "fp-email");
        Map<String, Object> a = accounts.byEmail(email);
        if (a == null) throw new HttpError(404, "Email này chưa được đăng ký trong hệ thống", "fp-email");
        if (!Accounts.isActive(a)) throw new HttpError(403, "Tài khoản này đã bị khóa. Vui lòng liên hệ quản trị viên", "fp-email");
        if ("google".equalsIgnoreCase(Maps.str(a, "provider")) && Maps.str(a, "passHash").isEmpty()) {
            throw new HttpError(400, "Tài khoản này đăng nhập bằng Google, không có mật khẩu để đặt lại", "fp-email");
        }
        String name = Maps.str(a, "name");
        otp.send(name, email, "forgot");
        return Maps.of("ok", true, "message", "Mã xác nhận OTP đã được gửi đến email của bạn");
    }

    @PostMapping("/api/auth/forgot-password/reset")
    public Map<String, Object> forgotPasswordReset(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> in = b(body);
        String email = Maps.str(in, "email").trim().toLowerCase();
        String ticket = Maps.str(in, "otpTicket");
        String newPassword = Maps.str(in, "newPassword");

        if (otp.required() && !otp.ticketValid(email, ticket)) {
            throw HttpError.bad("Mã xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã OTP.", "fp-otp");
        }
        return accounts.resetPassword(email, newPassword);
    }
}
