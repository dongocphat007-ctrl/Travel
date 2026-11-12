/**
 * email-otp.js – Xác thực OTP qua email, do SPRING BOOT sinh mã, gửi email và kiểm tra
 * (POST /api/otp/send, POST /api/otp/verify). Trình duyệt KHÔNG còn giữ mã OTP hay khóa dịch vụ email.
 * Verify đúng → server trả "vé" ký số gắn với email; Auth.register gửi kèm vé này để server cho phép tạo tài khoản.
 */
const OTPService = (() => {
  let _pending = null;   // { email, expiry }  (chỉ để hiện nút "Gửi lại")
  let _ticket = null;    // { email, ticket }

  async function call(url, body) {
    let r;
    try {
      r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { return { ok: false, msg: "Không kết nối được máy chủ. Vui lòng thử lại." }; }
    let d = {};
    try { d = await r.json(); } catch (e) { /* không phải JSON → không có máy chủ */ }
    if (!r.ok) return { ok: false, msg: d.msg || (r.status === 404 ? "Máy chủ chưa sẵn sàng để gửi mã xác nhận." : "Có lỗi xảy ra, vui lòng thử lại.") };
    return Object.assign({ ok: true }, d);
  }

  // Gửi OTP → Promise<{ ok, msg }>
  const send = async ({ name, email }) => {
    const r = await call("/api/otp/send", { name, email });
    if (r.ok) { _pending = { email: String(email).toLowerCase(), expiry: Date.now() + 5 * 60 * 1000 }; _ticket = null; }
    else _pending = null;
    return { ok: r.ok, msg: r.msg };
  };

  // Xác minh OTP → Promise<{ ok, msg }>
  const verify = async (inputCode, email) => {
    const r = await call("/api/otp/verify", { email, code: String(inputCode || "").trim() });
    if (!r.ok) return { ok: false, msg: r.msg };
    _pending = null;
    _ticket = { email: String(email).toLowerCase(), ticket: r.ticket };
    return { ok: true };
  };

  // Vé OTP cho email này (Auth.register dùng); null nếu chưa xác minh
  const ticketFor = email => (_ticket && _ticket.email === String(email || "").trim().toLowerCase()) ? _ticket.ticket : null;

  // Huỷ OTP đang chờ
  const cancel = () => { _pending = null; _ticket = null; };

  // Còn pending không (để hiện nút "Gửi lại")
  const hasPending = () => !!_pending && Date.now() < _pending.expiry;

  return { send, verify, ticketFor, cancel, hasPending };
})();

window.OTPService = OTPService;

;
/**
 * auth.js – Quản lý đăng nhập / đăng xuất
 * - Đăng ký / đăng nhập bằng email + password (localStorage)
 * - Google / Facebook: chờ tích hợp API key thực
 * Phụ thuộc: utils.js
 */

const Auth = (() => {
  const SESSION_KEY = "travel_auth_v1";   // user đang đăng nhập
  const USERS_KEY   = "travel_users_v1";  // danh sách tài khoản đã đăng ký

  // ---- Helpers ----
  // Sửa tên bị vỡ encoding UTF-8 (lỗi Latin-1 → UTF-8)
  const fixEncoding = str => {
    if (!str || typeof str !== "string") return str;
    try {
      // Thử decode lại nếu bị lỗi double-encoding
      const bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      // Chỉ dùng decoded nếu hợp lệ và khác với str
      return /[\u00C0-\u024F\u1E00-\u1EFF]/.test(decoded) ? decoded : str;
    } catch { return str; }
  };
  const getUser    = () => {
    try {
      const u = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!u) return null;
      // Sửa tên nếu bị vỡ encoding UTF-8
      if (u.name) u.name = fixEncoding(u.name);
      return u;
    } catch { return null; }
  };
  const isLoggedIn = () => !!getUser();

  // Lấy danh sách tất cả tài khoản đã đăng ký (tự nạp các tài khoản vai trò mẫu nếu chưa có)
  const getUsers = () => {
    try {
      let list = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      const sampleAccounts = [
        { id: "ad001", name: "Quản Trị Viên", email: "admin@travel.vn", role: "admin", provider: "local", initials: "QT", bg: "#DC2626", passHash: "-g10hvh", isSample: true },
        { id: "tn001", name: "Lê Thu Ngân", email: "thungan@travel.vn", role: "cashier", provider: "local", initials: "TN", bg: "#059669", passHash: "-g10hvh", isSample: true },
        { id: "dh001", name: "Trần Điều Hành", email: "dieuhanh@travel.vn", role: "operator", provider: "local", initials: "DH", bg: "#2563EB", passHash: "-g10hvh", isSample: true },
        { id: "cs001", name: "Phạm Chăm Sóc", email: "cskh@travel.vn", role: "support", provider: "local", initials: "CS", bg: "#D97706", passHash: "-g10hvh", isSample: true },
        { id: "nd001", name: "Hoàng Biên Tập", email: "bientap@travel.vn", role: "content", provider: "local", initials: "BT", bg: "#7C3AED", passHash: "-g10hvh", isSample: true },
        { id: "hdv001", name: "Nguyễn Minh Quân", email: "hdv.quan@travel.vn", role: "guide", guideId: "g_hn01", provider: "local", initials: "MQ", bg: "#0891B2", passHash: "-g10hvh", isSample: true },
        { id: "hdv002", name: "Trần Thu Hà", email: "hdv.ha@travel.vn", role: "guide", guideId: "g_hn02", provider: "local", initials: "TH", bg: "#DB2777", passHash: "-g10hvh", isSample: true },
        { id: "hdv003", name: "Hoàng Văn Sơn", email: "hdv.son@travel.vn", role: "guide", guideId: "g_hn03", provider: "local", initials: "VS", bg: "#059669", passHash: "-g10hvh", isSample: true },
        { id: "hdv004", name: "Phạm Thị Lan", email: "hdv.lan@travel.vn", role: "guide", guideId: "g_hn04", provider: "local", initials: "TL", bg: "#D97706", passHash: "-g10hvh", isSample: true },
        { id: "hdv005", name: "Bùi Đức Thắng", email: "hdv.thang@travel.vn", role: "guide", guideId: "g_hn05", provider: "local", initials: "DT", bg: "#4B5563", passHash: "-g10hvh", isSample: true },
        { id: "hdv006", name: "Lê Hoàng Phúc", email: "hdv.phuc@travel.vn", role: "guide", guideId: "g_mt01", provider: "local", initials: "HP", bg: "#2563EB", passHash: "-g10hvh", isSample: true },
        { id: "hdv007", name: "Nguyễn Thị Mai", email: "hdv.mai@travel.vn", role: "guide", guideId: "g_mt02", provider: "local", initials: "TM", bg: "#EA580C", passHash: "-g10hvh", isSample: true },
        { id: "hdv008", name: "Trương Quốc Bảo", email: "hdv.bao@travel.vn", role: "guide", guideId: "g_mt03", provider: "local", initials: "QB", bg: "#0D9488", passHash: "-g10hvh", isSample: true },
        { id: "hdv009", name: "Đinh Công Hiếu", email: "hdv.hieu@travel.vn", role: "guide", guideId: "g_mt04", provider: "local", initials: "CH", bg: "#854D0E", passHash: "-g10hvh", isSample: true },
        { id: "hdv010", name: "Võ Anh Tuấn", email: "hdv.tuan@travel.vn", role: "guide", guideId: "g_mn01", provider: "local", initials: "AT", bg: "#16A34A", passHash: "-g10hvh", isSample: true },
        { id: "hdv011", name: "Châu Ngọc Diệp", email: "hdv.diep@travel.vn", role: "guide", guideId: "g_mn02", provider: "local", initials: "ND", bg: "#9333EA", passHash: "-g10hvh", isSample: true },
        { id: "hdv012", name: "Lý Thanh Tùng", email: "hdv.tung@travel.vn", role: "guide", guideId: "g_mn03", provider: "local", initials: "TT", bg: "#0284C7", passHash: "-g10hvh", isSample: true },
        { id: "hdv013", name: "Huỳnh Kim Ngân", email: "hdv.ngan@travel.vn", role: "guide", guideId: "g_mn04", provider: "local", initials: "KN", bg: "#E11D48", passHash: "-g10hvh", isSample: true },
        { id: "hdv014", name: "Đặng Bảo Ngọc", email: "hdv.ngoc@travel.vn", role: "guide", guideId: "g_qt01", provider: "local", initials: "BN", bg: "#4338CA", passHash: "-g10hvh", isSample: true },
        { id: "hdv015", name: "Mai Anh Thư", email: "hdv.thu@travel.vn", role: "guide", guideId: "g_qt02", provider: "local", initials: "AT", bg: "#C026D3", passHash: "-g10hvh", isSample: true },
        { id: "hdv016", name: "Vũ Hải Đăng", email: "hdv.dang@travel.vn", role: "guide", guideId: "g_qt03", provider: "local", initials: "HD", bg: "#047857", passHash: "-g10hvh", isSample: true },
        { id: "hdv_test", name: "Nguyễn Văn Test (HDV Trống Lịch)", email: "hdv.test@travel.vn", role: "guide", guideId: "g_test", provider: "local", initials: "VT", bg: "#10B981", passHash: "-g10hvh", isSample: true },
        { id: "kh001", name: "Nguyễn Văn An", email: "khachhang@travel.vn", role: "user", provider: "local", initials: "VA", bg: "#4F46E5", passHash: "-g10hvh", isSample: true }
      ];
      let dirty = false;
      // Luôn loại bỏ mọi tài khoản admin cũ (admin_default, phatinformationtechnology@gmail.com, hoặc admin khác ad001)
      const prevLen = list.length;
      list = list.filter(u => u.id !== "admin_default" && u.email !== "phatinformationtechnology@gmail.com" && !(u.role === "admin" && u.id !== "ad001"));
      if (list.length !== prevLen) dirty = true;

      for (const sa of sampleAccounts) {
        const existingIdx = list.findIndex(u => u.id === sa.id || u.email === sa.email);
        if (existingIdx < 0) {
          list.push(sa);
          dirty = true;
        } else if (sa.id === "ad001") {
          // Đồng bộ lại thông tin admin duy nhất
          if (list[existingIdx].role !== "admin" || list[existingIdx].email !== sa.email) {
            list[existingIdx] = Object.assign({}, list[existingIdx], sa);
            dirty = true;
          }
        }
      }
      if (dirty) {
        localStorage.setItem(USERS_KEY, JSON.stringify(list));
      }
      return list;
    } catch { return []; }
  };
  const saveUsers = list => localStorage.setItem(USERS_KEY, JSON.stringify(list));

  /**
   * ---- RÀNG BUỘC: 1 email chỉ có 1 tài khoản ----
   *     Chuẩn hóa để các cách viết khác nhau của CÙNG một hộp thư bị coi là một:
   *       - bỏ khoảng trắng, đổi sang chữ thường
   *       - Gmail: bỏ dấu chấm và phần "+nhãn"  (a.b+x@gmail.com ≡ ab@gmail.com)
   */
  const normEmail = raw => {
    const e = String(raw || "").trim().toLowerCase();
    const at = e.lastIndexOf("@");
    if (at < 1) return e;
    let local = e.slice(0, at), domain = e.slice(at + 1);
    if (domain === "googlemail.com") domain = "gmail.com";
    if (domain === "gmail.com") local = local.split("+")[0].replace(/\./g, "");
    return local + "@" + domain;
  };
  const findByEmail = (users, email) => {
    const key = normEmail(email);
    return users.findIndex(u => normEmail(u.email) === key);
  };
  const emailExists = email => findByEmail(getUsers(), email) >= 0;

  // Tạo initials từ tên đầy đủ: "Nguyễn Văn An" → "NA"
  const makeInitials = name => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Màu avatar ngẫu nhiên từ bảng màu đẹp
  const AVATAR_COLORS = ["#4F46E5","#7C3AED","#059669","#D97706","#DC2626","#0891B2"];
  const pickColor = email => AVATAR_COLORS[email.length % AVATAR_COLORS.length];

  // Hash đơn giản (không dùng crypto API để tương thích mọi browser)
  // Chỉ dùng cho CHẾ ĐỘ DỰ PHÒNG khi không có server. Có server → KHÔNG lưu bất kỳ dấu vết mật khẩu nào ở trình duyệt.
  // PBKDF2-SHA256 (muối ngẫu nhiên, 150k vòng) qua Web Crypto; cần HTTPS hoặc localhost (secure context).
  const legacyHash = str => {   // băm 32-bit cũ — CHỈ để đọc tài khoản đời cũ rồi nâng cấp, không dùng để ghi mới
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return h.toString(36);
  };
  const hasCrypto = () => !!(window.crypto && crypto.subtle);
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const pbkdf2 = async (password, salt) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return "pbkdf2$" + b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, key, 256));
  };
  const makePass = async password => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { passSalt: b64(salt), passHash: await pbkdf2(password, salt) };
  };
  const checkPass = async (rec, password) => {
    if (!rec.passHash) return false;
    if (rec.isSample && password === "Travel@2026") return true;
    if (!String(rec.passHash).startsWith("pbkdf2$")) return rec.passHash === legacyHash(password);   // tài khoản đời cũ
    if (!hasCrypto() || !rec.passSalt) return false;
    const salt = Uint8Array.from(atob(rec.passSalt), c => c.charCodeAt(0));
    return (await pbkdf2(password, salt)) === rec.passHash;
  };

  // ---- ĐỒNG BỘ VỚI SERVER (Spring Boot): server là nơi xác thực chính, localStorage chỉ là bản sao/dự phòng ----
  const hasApi = () => typeof Api !== "undefined";
  // Gọi server; trả null nếu không có server (mở bằng máy chủ tĩnh) → dùng chế độ localStorage cũ
  const serverCall = async (url, body) => {
    if (!hasApi() || Api.isOnline() === false) return null;
    try { return await Api.post(url, body); } catch (e) { return null; }
  };
  // Ghi tài khoản từ server vào localStorage (users + phiên) để toàn bộ giao diện cũ chạy tiếp
  const mirrorUser = (srv, password) => {
    const users = getUsers();
    const idx = findByEmail(users, srv.email);
    const old = idx >= 0 ? users[idx] : {};
    const roleVal = srv.role || old.role || "user";
    const rec = { ...old, ...srv, role: roleVal };
    if (old.picture && old.avatarCustom && !srv.avatarCustom && String(old.picture).startsWith("data:")) rec.picture = old.picture;   // ảnh trên máy chủ (đã lưu ở img/avatars) được ưu tiên; ảnh chỉ có ở trình duyệt thì giữ lại
    delete rec.passHash; delete rec.passSalt;   // server xác thực: không giữ verifier mật khẩu ở trình duyệt (đồng thời xoá hash cũ sau khi đã migrate)
    if (idx >= 0) users[idx] = rec; else users.push(rec);
    saveUsers(users);
    const { passHash, passSalt, ...pub } = rec;
    const session = { ...pub, loginAt: new Date().toISOString() };
    if (typeof TravelRBAC !== "undefined") {
      session.roleMeta = TravelRBAC.getRoleMeta(session.role);
      session.permissions = srv.permissions || TravelRBAC.getPermissions(session.role);
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    try { localStorage.setItem("travel_session_v1", JSON.stringify({ user: session })); } catch (e) {}
    return session;
  };
  const syncSession = async () => {
    if (!hasApi()) return getUser();
    try {
      const res = await Api.get("/api/auth/me");
      if (res && res.ok && res.data && res.data.user) {
        return mirrorUser(res.data.user);
      }
    } catch (e) {
      // Offline hoặc mở tĩnh: giữ nguyên phiên đăng nhập localStorage
    }
    return getUser();
  };
  const afterAuth = () => { if (hasApi()) Api.refreshBookings(true); };

  const checkPassword = (p) => {
    if (!p || p.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (p.length > 200) return "Mật khẩu quá dài";
    if (!/[A-Z]/.test(p)) return "Mật khẩu phải có ít nhất 1 chữ in hoa (A-Z)";
    if (!/[a-z]/.test(p)) return "Mật khẩu phải có ít nhất 1 chữ thường (a-z)";
    if (!/[0-9]/.test(p)) return "Mật khẩu phải có ít nhất 1 chữ số (0-9)";
    if (!/[^A-Za-z0-9]/.test(p)) return "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)";
    return null;
  };

  // ---- ĐĂNG KÝ ----
  /**
   * Trả về { ok: true, user } hoặc { ok: false, field, msg }
   *     dryRun: true → chỉ kiểm tra email trùng, không tạo tài khoản
   */
  const register = async ({ name, email, password, birthday, dryRun = false }) => {
    name     = (name || "").trim();
    email    = (email || "").trim().toLowerCase();
    password = (password || "");
    birthday = (birthday || "").trim();

    if (!name || name.length < 2)
      return { ok: false, field: "reg-name",  msg: "Họ tên ít nhất 2 ký tự" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { ok: false, field: "reg-email", msg: "Email không đúng định dạng" };
    if (!isGmail(email))
      return { ok: false, field: "reg-email", msg: GMAIL_MSG };
    const pwErr = checkPassword(password);
    if (pwErr)
      return { ok: false, field: "reg-pass",  msg: pwErr };

    const users = getUsers();
    if (findByEmail(users, email) >= 0)
      return { ok: false, field: "reg-email", msg: "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản" };

    // Chỉ kiểm tra, không tạo tài khoản (hỏi thêm server vì tài khoản có thể chỉ tồn tại ở server)
    if (dryRun) {
      const c = await serverCall("/api/auth/check-email", { email });
      if (c && c.data && c.data.exists)
        return { ok: false, field: "reg-email", msg: "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản" };
      return { ok: true };
    }

    // Tạo trên server (createdAt do server đặt → hạn voucher WELCOME10 không phụ thuộc đồng hồ máy khách)
    const srv = await serverCall("/api/auth/register", { name, email, password, birthday, otpTicket: (typeof OTPService !== "undefined" ? OTPService.ticketFor(email) : null) });
    if (srv) {
      if (srv.ok) { const session = mirrorUser(srv.data.user, password); afterAuth(); return { ok: true, user: session, welcomeVoucher: srv.data.welcomeVoucher }; }
      return { ok: false, field: srv.data.field || "reg-email", msg: srv.data.msg || "Không đăng ký được" };
    }

    if (!hasCrypto())
      return { ok: false, field: "reg-pass", msg: "Không kết nối được máy chủ, và trình duyệt này không cho phép lưu mật khẩu an toàn (cần HTTPS). Vui lòng thử lại sau." };

    const user = {
      id:        uid("u"),
      name,
      email,
      birthday,
      initials:  makeInitials(name),
      bg:        pickColor(email),
      provider:  "local",
      createdAt: new Date().toISOString()
    };
    users.push({ ...user, ...(await makePass(password)) });
    saveUsers(users);

    // Tự động đăng nhập luôn sau khi đăng ký
    const session = { ...user, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };

  // ---- ĐĂNG NHẬP THƯỜNG ----
  const login = async ({ email, password }) => {
    email    = (email || "").trim().toLowerCase();
    password = (password || "");

    if (!email)    return { ok: false, field: "li-email", msg: "Vui lòng nhập email" };
    if (!password) return { ok: false, field: "li-pass",  msg: "Vui lòng nhập mật khẩu" };

    // 1) Server xác thực trước
    const srv = await serverCall("/api/auth/login", { email, password });
    if (srv && srv.ok) {
      const session = mirrorUser(srv.data.user, password);
      afterAuth();
      return { ok: true, user: session, welcomeVoucher: srv.data.welcomeVoucher, isFirstLogin: srv.data.isFirstLogin };
    }
    if (srv && srv.status !== 404) return { ok: false, field: srv.data.field || "li-pass", msg: srv.data.msg || "Đăng nhập thất bại" };

    // 2) Server chưa có tài khoản (tài khoản cũ chỉ ở localStorage) hoặc không có server → kiểm tra localStorage
    const local = await localLogin(email, password);
    if (local.ok && srv) {   // tài khoản cũ hợp lệ → chuyển lên server (giữ nguyên id để không mất chuyến đi đã lưu)
      const u = local.user;
      await serverCall("/api/auth/migrate", { id: u.id, name: u.name, email: u.email, password, createdAt: u.createdAt });
      afterAuth();
    }
    return local;
  };

  const localLogin = async (email, password) => {
    const users = getUsers();
    const found = users[findByEmail(users, email)];
    if (!found)
      return { ok: false, field: "li-email", msg: "Email chưa được đăng ký" };
    if (!found.passHash)
      return { ok: false, field: "li-pass", msg: 'Email này đã đăng ký bằng Google — hãy bấm "Đăng nhập bằng Google"' };
    if (!(await checkPass(found, password)))
      return { ok: false, field: "li-pass", msg: "Mật khẩu không đúng" };
    if (hasCrypto() && !String(found.passHash).startsWith("pbkdf2$")) {   // nâng cấp băm cũ → PBKDF2
      Object.assign(found, await makePass(password)); saveUsers(users);
    }

    const { passHash, passSalt, ...rest } = found;
    const session = { ...rest, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };


  // ---- QUÊN MẬT KHẨU ----
  const sendForgotOtp = async (email) => {
    email = (email || "").trim().toLowerCase();
    if (!email) return { ok: false, field: "fp-email", msg: "Vui lòng nhập email" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: "fp-email", msg: "Email không đúng định dạng" };

    const srv = await serverCall("/api/auth/forgot-password/send-otp", { email });
    if (srv) {
      if (srv.ok) return { ok: true, msg: srv.data.message || "Mã xác nhận đã được gửi đến email của bạn" };
      return { ok: false, field: srv.data.field || "fp-email", msg: srv.data.msg || "Không gửi được mã xác nhận" };
    }

    // Dự phòng khi không có server
    const users = getUsers();
    const idx = findByEmail(users, email);
    if (idx < 0) return { ok: false, field: "fp-email", msg: "Email chưa được đăng ký trong hệ thống" };
    return { ok: false, field: "fp-email", msg: "Cần kết nối máy chủ để nhận mã OTP qua email." };
  };

  const resetPassword = async ({ email, otpTicket, newPassword }) => {
    email = (email || "").trim().toLowerCase();
    newPassword = (newPassword || "");
    if (!email) return { ok: false, field: "fp-email", msg: "Vui lòng nhập email" };
    const pwErr = checkPassword(newPassword);
    if (pwErr) return { ok: false, field: "fp-new-pass", msg: pwErr };

    const srv = await serverCall("/api/auth/forgot-password/reset", { email, otpTicket, newPassword });
    if (srv) {
      if (srv.ok) {
        // Cập nhật lại hash trong localStorage nếu có
        const users = getUsers();
        const idx = findByEmail(users, email);
        if (idx >= 0 && hasCrypto()) {
          const p = await makePass(newPassword);
          users[idx].passHash = p.passHash;
          users[idx].passSalt = p.passSalt;
          saveUsers(users);
        }
        return { ok: true, msg: srv.data.message || "Đặt lại mật khẩu thành công" };
      }
      return { ok: false, field: srv.data.field || "fp-reset-general", msg: srv.data.msg || "Đặt lại mật khẩu thất bại" };
    }

    return { ok: false, field: "fp-reset-general", msg: "Không kết nối được máy chủ" };
  };

  /**
   * ---- ĐỔI / XÓA AVATAR ----
   *     dataUrl: chuỗi data:image/... để đặt ảnh, hoặc null để xóa ảnh tự chọn.
   *     Cập nhật cả phiên đăng nhập lẫn danh sách tài khoản (kể cả tài khoản Google).
   */
  const updateAvatar = async dataUrl => {
    const user = getUser();
    if (!user) return { ok: false, msg: "Bạn chưa đăng nhập" };
    if (dataUrl !== null && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(String(dataUrl)))
      return { ok: false, msg: "Ảnh không hợp lệ" };

    const store = patch => {
      const users = getUsers();
      const idx = findByEmail(users, user.email);
      if (idx >= 0) { users[idx] = { ...users[idx], ...patch }; saveUsers(users); }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...getUser(), ...patch }));
    };

    // 1) Máy chủ ghi file vào img/avatars/ và lưu đường dẫn vào tài khoản → ảnh dùng được ở mọi thiết bị.
    if (hasApi()) {
      try {
        const r = await Api.post("/api/upload/avatar", dataUrl ? { dataUrl } : { remove: true });
        if (r.ok && r.data.ok !== false) {
          store(dataUrl ? { picture: r.data.picture, avatarCustom: true } : { picture: null, avatarCustom: false });
          return { ok: true, saved: "server" };
        }
        if (r.status === 400 || r.status === 413) return { ok: false, msg: r.data.msg || "Ảnh không hợp lệ" };
        // 401/404/5xx: chưa đăng nhập máy chủ hoặc không có máy chủ → lưu tạm trong trình duyệt (bên dưới)
      } catch (e) { /* không kết nối được máy chủ → lưu tạm trong trình duyệt */ }
    }

    // 2) Dự phòng: chỉ lưu trong LocalStorage của trình duyệt này.
    try {
      store(dataUrl ? { picture: dataUrl, avatarCustom: true } : { picture: null, avatarCustom: false });
      return { ok: true, saved: "local" };
    } catch (e) {
      return { ok: false, msg: "Bộ nhớ trình duyệt đã đầy, hãy chọn ảnh nhỏ hơn" };
    }
  };

  // ---- ĐĂNG XUẤT ----
  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    try { localStorage.removeItem("travel_session_v1"); } catch (e) {}
    if (hasApi()) Api.post("/api/auth/logout").catch(() => {});
  };

  // ---- ĐĂNG NHẬP BẰNG GOOGLE (GSI credential JWT) ----
  /**
   * Decode phần payload của JWT từ Google (không cần verify phía client
   *     vì chạy trên trình duyệt, chỉ dùng để lấy thông tin hiển thị)
   */
  // parseJwt – decode JWT payload, handle UTF-8 (tên tiếng Việt) đúng cách
  const parseJwt = token => {
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      // TextDecoder xử lý UTF-8 đúng, tránh lỗi ký tự tiếng Việt với atob() thuần
      const bytes   = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    } catch { return null; }
  };

  const loginWithGoogle = async (credential) => {
    const srv = await serverCall("/api/auth/google", { credential });
    if (srv && srv.ok) {
      const session = mirrorUser(srv.data.user);
      session.isFirstLogin = srv.data.isFirstLogin;
      session.welcomeVoucher = srv.data.welcomeVoucher;
      afterAuth();
      return session;
    }
    if (srv) return null;   // server đã trả lời và từ chối token → không tự cho đăng nhập bằng token chưa xác minh
    const payload = parseJwt(credential);
    if (!payload || !payload.email) return null;
    if (payload.email_verified === false) return null;   // email Google chưa xác minh → từ chối

    const name     = payload.name || payload.email.split("@")[0];
    const initials = makeInitials(name);
    const loginAt  = new Date().toISOString();

    /**
     * 1 email = 1 tài khoản: nếu email đã có tài khoản (đăng ký thường HOẶC Google)
     *       thì dùng lại tài khoản đó, KHÔNG tạo thêm tài khoản thứ hai.
     */
    const users = getUsers();
    const idx   = findByEmail(users, payload.email);
    let user;
    if (idx >= 0) {
      const { passHash, ...old } = users[idx];
      // Ảnh người dùng tự chọn (avatarCustom) được ưu tiên hơn ảnh Google
      const pic = old.avatarCustom ? old.picture : (payload.picture || old.picture || null);
      user = { ...old, picture: pic, googleLinked: true, loginAt };
      users[idx] = { ...users[idx], picture: pic, googleLinked: true, loginAt };
    } else {
      user = {
        id:        "g_" + payload.sub,
        name,
        email:     String(payload.email).trim().toLowerCase(),
        picture:   payload.picture || null,
        initials,
        bg:        "#4285F4",
        provider:  "google",
        createdAt: loginAt,
        loginAt
      };
      users.push({ ...user });
    }
    saveUsers(users);

    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  };

  /**
   * ---- XÁC THỰC / CẬP NHẬT HỒ SƠ ----
   *     data: { name?, gender?, birthday?, email?, verify?, confirm? }  (xem POST /api/auth/profile)
   *     Có server → server kiểm tra + lưu (giới tính / ngày sinh khóa sau khi xác thực) rồi sao về localStorage.
   *     Không có server (mở bằng máy chủ tĩnh) → lưu tạm vào localStorage để hồ sơ vẫn hiển thị.
   *     Trả về { ok, user, birthdayVoucher } hoặc { ok:false, field, msg }
   */
  const saveProfile = async data => {
    const user = getUser();
    if (!user) return { ok: false, msg: "Bạn chưa đăng nhập" };
    const srv = await serverCall("/api/auth/profile", data);
    if (srv) {
      if (srv.ok) return { ok: true, user: mirrorUser(srv.data.user), birthdayVoucher: srv.data.birthdayVoucher || null };
      return { ok: false, field: srv.data.field, msg: srv.data.msg || "Không lưu được hồ sơ", status: srv.status };
    }
    if (user.profileVerified && (data.gender !== undefined || data.birthday !== undefined) &&
        ((data.gender || user.gender) !== user.gender || (data.birthday || user.birthday) !== user.birthday))
      return { ok: false, msg: "Giới tính và ngày sinh đã được xác thực nên không thể tự sửa" };
    const patch = {};
    if (data.name) patch.name = String(data.name).trim();
    if (data.verify && !user.profileVerified) {
      patch.gender = data.gender; patch.birthday = data.birthday;
      patch.profileVerified = true; patch.profileVerifiedAt = new Date().toISOString();
    }
    const users = getUsers();
    const idx = findByEmail(users, user.email);
    if (idx >= 0) { users[idx] = { ...users[idx], ...patch }; saveUsers(users); }
    const session = { ...user, ...patch };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session, birthdayVoucher: null };
  };

    return {
      getUser,
      currentUser: getUser,
      openLoginModal: (cb) => (typeof showLoginModal === "function" ? showLoginModal(cb) : null),
      syncSession,
      isLoggedIn,
      register,
      login,
      loginWithGoogle,
      logout,
      sendForgotOtp,
      resetPassword,
      checkPassword,
      normEmail,
      emailExists,
      updateAvatar,
      saveProfile,
      getRole: () => (typeof TravelRBAC !== "undefined" ? TravelRBAC.normalizeRole(getUser()) : (getUser() && getUser().role ? getUser().role : "CUSTOMER")),
      getRoleMeta: () => (typeof TravelRBAC !== "undefined" ? TravelRBAC.getRoleMeta(getUser()) : null),
      hasRole: (targetRole) => (typeof TravelRBAC !== "undefined" ? TravelRBAC.hasRole(getUser(), targetRole) : false),
      hasPermission: (permCode) => (typeof TravelRBAC !== "undefined" ? TravelRBAC.hasPermission(getUser(), permCode) : false),
      isAdmin: () => (typeof TravelRBAC !== "undefined" ? TravelRBAC.isAdmin(getUser()) : (getUser() && getUser().role === "admin")),
      isStaff: () => (typeof TravelRBAC !== "undefined" ? TravelRBAC.isStaff(getUser()) : (getUser() && getUser().role === "admin"))
    };
  })();
