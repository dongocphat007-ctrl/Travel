/**
 * auth.js – Quản lý đăng nhập / đăng xuất
 * - Đăng ký / đăng nhập bằng email + password (localStorage)
 * - Google / Facebook: chờ tích hợp API key thực
 * Phụ thuộc: utils.js
 */

const Auth = (() => {
  const SESSION_KEY = "travel_auth_v1"; // user đang đăng nhập
  const USERS_KEY = "travel_users_v1"; // danh sách tài khoản đã đăng ký

  // ---- Helpers ----
  // Sửa tên bị vỡ encoding UTF-8 (lỗi Latin-1 → UTF-8)
  const fixEncoding = (str) => {
    if (!str || typeof str !== "string") return str;
    try {
      // Thử decode lại nếu bị lỗi double-encoding
      const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0)));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      // Chỉ dùng decoded nếu hợp lệ và khác với str
      return /[\u00C0-\u024F\u1E00-\u1EFF]/.test(decoded) ? decoded : str;
    } catch {
      return str;
    }
  };
  const getUser = () => {
    try {
      const u = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!u) return null;
      // Sửa tên nếu bị vỡ encoding UTF-8
      if (u.name) u.name = fixEncoding(u.name);
      return u;
    } catch {
      return null;
    }
  };
  const isLoggedIn = () => !!getUser();

  // Lấy danh sách tất cả tài khoản đã đăng ký
  const getUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
      return [];
    }
  };
  const saveUsers = (list) =>
    localStorage.setItem(USERS_KEY, JSON.stringify(list));

  /**
   * ---- RÀNG BUỘC: 1 email chỉ có 1 tài khoản ----
   *     Chuẩn hóa để các cách viết khác nhau của CÙNG một hộp thư bị coi là một:
   *       - bỏ khoảng trắng, đổi sang chữ thường
   *       - Gmail: bỏ dấu chấm và phần "+nhãn"  (a.b+x@gmail.com ≡ ab@gmail.com)
   */
  const normEmail = (raw) => {
    const e = String(raw || "")
      .trim()
      .toLowerCase();
    const at = e.lastIndexOf("@");
    if (at < 1) return e;
    let local = e.slice(0, at),
      domain = e.slice(at + 1);
    if (domain === "googlemail.com") domain = "gmail.com";
    if (domain === "gmail.com") local = local.split("+")[0].replace(/\./g, "");
    return local + "@" + domain;
  };
  const findByEmail = (users, email) => {
    const key = normEmail(email);
    return users.findIndex((u) => normEmail(u.email) === key);
  };
  const emailExists = (email) => findByEmail(getUsers(), email) >= 0;

  // Tạo initials từ tên đầy đủ: "Nguyễn Văn An" → "NA"
  const makeInitials = (name) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Màu avatar ngẫu nhiên từ bảng màu đẹp
  const AVATAR_COLORS = [
    "#4F46E5",
    "#7C3AED",
    "#059669",
    "#D97706",
    "#DC2626",
    "#0891B2",
  ];
  const pickColor = (email) =>
    AVATAR_COLORS[email.length % AVATAR_COLORS.length];

  // Hash đơn giản (không dùng crypto API để tương thích mọi browser)
  // Chỉ dùng cho CHẾ ĐỘ DỰ PHÒNG khi không có server. Có server → KHÔNG lưu bất kỳ dấu vết mật khẩu nào ở trình duyệt.
  // PBKDF2-SHA256 (muối ngẫu nhiên, 150k vòng) qua Web Crypto; cần HTTPS hoặc localhost (secure context).
  const legacyHash = (str) => {
    // băm 32-bit cũ — CHỈ để đọc tài khoản đời cũ rồi nâng cấp, không dùng để ghi mới
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h.toString(36);
  };
  const hasCrypto = () => !!(window.crypto && crypto.subtle);
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const pbkdf2 = async (password, salt) => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    return (
      "pbkdf2$" +
      b64(
        await crypto.subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 },
          key,
          256,
        ),
      )
    );
  };
  const makePass = async (password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { passSalt: b64(salt), passHash: await pbkdf2(password, salt) };
  };
  const checkPass = async (rec, password) => {
    if (!rec.passHash) return false;
    if (!String(rec.passHash).startsWith("pbkdf2$"))
      return rec.passHash === legacyHash(password); // tài khoản đời cũ
    if (!hasCrypto() || !rec.passSalt) return false;
    const salt = Uint8Array.from(atob(rec.passSalt), (c) => c.charCodeAt(0));
    return (await pbkdf2(password, salt)) === rec.passHash;
  };

  // ---- ĐỒNG BỘ VỚI SERVER (Spring Boot): server là nơi xác thực chính, localStorage chỉ là bản sao/dự phòng ----
  const hasApi = () => typeof Api !== "undefined";
  // Gọi server; trả null nếu không có server (mở bằng máy chủ tĩnh) → dùng chế độ localStorage cũ
  const serverCall = async (url, body) => {
    if (!hasApi() || Api.isOnline() === false) return null;
    try {
      return await Api.post(url, body);
    } catch (e) {
      return null;
    }
  };
  // Ghi tài khoản từ server vào localStorage (users + phiên) để toàn bộ giao diện cũ chạy tiếp
  const mirrorUser = (srv, password) => {
    const users = getUsers();
    const idx = findByEmail(users, srv.email);
    const old = idx >= 0 ? users[idx] : {};
    const rec = {
      ...old,
      ...srv,
      role:
        srv.role === "admin" || old.role === "admin"
          ? "admin"
          : srv.role || old.role || "user",
    };
    if (old.picture && old.avatarCustom) rec.picture = old.picture;
    delete rec.passHash;
    delete rec.passSalt; // server xác thực: không giữ verifier mật khẩu ở trình duyệt (đồng thời xoá hash cũ sau khi đã migrate)
    if (idx >= 0) users[idx] = rec;
    else users.push(rec);
    saveUsers(users);
    const { passHash, passSalt, ...pub } = rec;
    const session = { ...pub, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  };
  const afterAuth = () => {
    if (hasApi()) Api.refreshBookings(true);
  };

  // ---- ĐĂNG KÝ ----
  /**
   * Trả về { ok: true, user } hoặc { ok: false, field, msg }
   *     dryRun: true → chỉ kiểm tra email trùng, không tạo tài khoản
   */
  const register = async ({ name, email, password, dryRun = false }) => {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    password = password || "";

    if (!name || name.length < 2)
      return { ok: false, field: "reg-name", msg: "Họ tên ít nhất 2 ký tự" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return {
        ok: false,
        field: "reg-email",
        msg: "Email không đúng định dạng",
      };
    if (!isGmail(email))
      return { ok: false, field: "reg-email", msg: GMAIL_MSG };
    if (password.length < 6)
      return { ok: false, field: "reg-pass", msg: "Mật khẩu ít nhất 6 ký tự" };

    const users = getUsers();
    if (findByEmail(users, email) >= 0)
      return {
        ok: false,
        field: "reg-email",
        msg: "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản",
      };

    // Chỉ kiểm tra, không tạo tài khoản (hỏi thêm server vì tài khoản có thể chỉ tồn tại ở server)
    if (dryRun) {
      const c = await serverCall("/api/auth/check-email", { email });
      if (c && c.data && c.data.exists)
        return {
          ok: false,
          field: "reg-email",
          msg: "Email này đã được đăng ký — mỗi email chỉ tạo được 1 tài khoản",
        };
      return { ok: true };
    }

    // Tạo trên server (createdAt do server đặt → hạn voucher WELCOME10 không phụ thuộc đồng hồ máy khách)
    const srv = await serverCall("/api/auth/register", {
      name,
      email,
      password,
      otpTicket: window.OTPService ? OTPService.ticketFor(email) : null,
    });
    if (srv) {
      if (srv.ok) {
        const session = mirrorUser(srv.data.user, password);
        afterAuth();
        return {
          ok: true,
          user: session,
          welcomeVoucher: srv.data.welcomeVoucher,
        };
      }
      return {
        ok: false,
        field: srv.data.field || "reg-email",
        msg: srv.data.msg || "Không đăng ký được",
      };
    }

    if (!hasCrypto())
      return {
        ok: false,
        field: "reg-pass",
        msg: "Không kết nối được máy chủ, và trình duyệt này không cho phép lưu mật khẩu an toàn (cần HTTPS). Vui lòng thử lại sau.",
      };

    const user = {
      id: uid("u"),
      name,
      email,
      initials: makeInitials(name),
      bg: pickColor(email),
      provider: "local",
      createdAt: new Date().toISOString(),
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
    email = (email || "").trim().toLowerCase();
    password = password || "";

    if (!email)
      return { ok: false, field: "li-email", msg: "Vui lòng nhập email" };
    if (!password)
      return { ok: false, field: "li-pass", msg: "Vui lòng nhập mật khẩu" };

    // 1) Server xác thực trước
    const srv = await serverCall("/api/auth/login", { email, password });
    if (srv && srv.ok) {
      const session = mirrorUser(srv.data.user, password);
      afterAuth();
      return { ok: true, user: session };
    }
    if (srv && srv.status !== 404)
      return {
        ok: false,
        field: srv.data.field || "li-pass",
        msg: srv.data.msg || "Đăng nhập thất bại",
      };

    // 2) Server chưa có tài khoản (tài khoản cũ chỉ ở localStorage) hoặc không có server → kiểm tra localStorage
    const local = await localLogin(email, password);
    if (local.ok && srv) {
      // tài khoản cũ hợp lệ → chuyển lên server (giữ nguyên id để không mất chuyến đi đã lưu)
      const u = local.user;
      await serverCall("/api/auth/migrate", {
        id: u.id,
        name: u.name,
        email: u.email,
        password,
        createdAt: u.createdAt,
      });
      afterAuth();
    }
    return local;
  };

  const localLogin = async (email, password) => {
    const users = getUsers();
    const found = users[findByEmail(users, email)];
    if (!found)
      return { ok: false, field: "li-email", msg: "Email chưa được đăng ký" };
    if (!found.passHash) {
      if (found.provider === "google" || found.googleLinked)
        return {
          ok: false,
          field: "li-pass",
          msg: 'Email này đã đăng ký bằng Google — hãy bấm "Đăng nhập bằng Google"',
        };
      // Bản sao cục bộ của tài khoản đã đăng ký trên máy chủ (không giữ mật khẩu) nhưng máy chủ nay không còn tài khoản này
      return {
        ok: false,
        field: "li-email",
        msg: "Tài khoản này không còn trên máy chủ (dữ liệu có thể đã bị đặt lại). Vui lòng đăng ký lại.",
      };
    }
    if (!(await checkPass(found, password)))
      return { ok: false, field: "li-pass", msg: "Mật khẩu không đúng" };
    if (hasCrypto() && !String(found.passHash).startsWith("pbkdf2$")) {
      // nâng cấp băm cũ → PBKDF2
      Object.assign(found, await makePass(password));
      saveUsers(users);
    }

    const { passHash, passSalt, ...rest } = found;
    const session = { ...rest, loginAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };

  /**
   * ---- ĐỔI / XÓA AVATAR ----
   *     dataUrl: chuỗi data:image/... để đặt ảnh, hoặc null để xóa ảnh tự chọn.
   *     Cập nhật cả phiên đăng nhập lẫn danh sách tài khoản (kể cả tài khoản Google).
   */
  const updateAvatar = (dataUrl) => {
    const user = getUser();
    if (!user) return { ok: false, msg: "Bạn chưa đăng nhập" };
    if (
      dataUrl !== null &&
      !/^data:image\/(png|jpeg|webp|gif);base64,/.test(String(dataUrl))
    )
      return { ok: false, msg: "Ảnh không hợp lệ" };

    const patch = dataUrl
      ? { picture: dataUrl, avatarCustom: true }
      : { picture: null, avatarCustom: false };

    try {
      const users = getUsers();
      const idx = findByEmail(users, user.email);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...patch };
        saveUsers(users);
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, ...patch }));
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        msg: "Bộ nhớ trình duyệt đã đầy, hãy chọn ảnh nhỏ hơn",
      };
    }
  };

  // ---- KIỂM TRA PHIÊN VỚI SERVER ----
  // Giao diện coi "đã đăng nhập" theo localStorage, còn server chỉ tin cookie phiên HttpOnly.
  // Hai thứ có thể lệch (cookie hết hạn/bị xoá, dữ liệu server bị đặt lại, đăng nhập khi server chưa chạy...)
  // → đặt đơn bị 401 dù giao diện hiện đã đăng nhập. Hàm này đồng bộ lại: server từ chối → xoá phiên cục bộ.
  // Trả true nếu phiên dùng được (hoặc không có server để hỏi), false nếu cần đăng nhập lại.
  let _verifying = null;
  const verifySession = () => {
    if (!isLoggedIn()) return Promise.resolve(false);
    if (!hasApi()) return Promise.resolve(true);
    if (_verifying) return _verifying;
    _verifying = (async () => {
      try {
        const r = await Api.get("/api/auth/me");
        if (r.status === 401) {
          localStorage.removeItem(SESSION_KEY);
          return false;
        }
        return true;
      } catch (e) {
        return true;
      } // không có server (mở bằng máy chủ tĩnh) → giữ chế độ localStorage
    })();
    _verifying.then(() => {
      _verifying = null;
    }); // chỉ gộp các lần gọi đồng thời
    return _verifying;
  };

  // ---- ĐĂNG XUẤT ----
  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    if (hasApi()) Api.post("/api/auth/logout").catch(() => {});
  };

  // ---- ĐĂNG NHẬP BẰNG GOOGLE (GSI credential JWT) ----
  /**
   * Decode phần payload của JWT từ Google (không cần verify phía client
   *     vì chạy trên trình duyệt, chỉ dùng để lấy thông tin hiển thị)
   */
  // parseJwt – decode JWT payload, handle UTF-8 (tên tiếng Việt) đúng cách
  const parseJwt = (token) => {
    try {
      const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      // TextDecoder xử lý UTF-8 đúng, tránh lỗi ký tự tiếng Việt với atob() thuần
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder("utf-8").decode(bytes));
    } catch {
      return null;
    }
  };

  const loginWithGoogle = async (credential) => {
    const srv = await serverCall("/api/auth/google", { credential });
    if (srv && srv.ok) {
      const session = mirrorUser(srv.data.user);
      afterAuth();
      return session;
    }
    if (srv) return null; // server đã trả lời và từ chối token → không tự cho đăng nhập bằng token chưa xác minh
    const payload = parseJwt(credential);
    if (!payload || !payload.email) return null;
    if (payload.email_verified === false) return null; // email Google chưa xác minh → từ chối

    const name = payload.name || payload.email.split("@")[0];
    const initials = makeInitials(name);
    const loginAt = new Date().toISOString();

    /**
     * 1 email = 1 tài khoản: nếu email đã có tài khoản (đăng ký thường HOẶC Google)
     *       thì dùng lại tài khoản đó, KHÔNG tạo thêm tài khoản thứ hai.
     */
    const users = getUsers();
    const idx = findByEmail(users, payload.email);
    let user;
    if (idx >= 0) {
      const { passHash, ...old } = users[idx];
      // Ảnh người dùng tự chọn (avatarCustom) được ưu tiên hơn ảnh Google
      const pic = old.avatarCustom
        ? old.picture
        : payload.picture || old.picture || null;
      user = { ...old, picture: pic, googleLinked: true, loginAt };
      users[idx] = { ...users[idx], picture: pic, googleLinked: true, loginAt };
    } else {
      user = {
        id: "g_" + payload.sub,
        name,
        email: String(payload.email).trim().toLowerCase(),
        picture: payload.picture || null,
        initials,
        bg: "#4285F4",
        provider: "google",
        createdAt: loginAt,
        loginAt,
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
  const saveProfile = async (data) => {
    const user = getUser();
    if (!user) return { ok: false, msg: "Bạn chưa đăng nhập" };
    const srv = await serverCall("/api/auth/profile", data);
    if (srv) {
      if (srv.ok)
        return {
          ok: true,
          user: mirrorUser(srv.data.user),
          birthdayVoucher: srv.data.birthdayVoucher || null,
        };
      return {
        ok: false,
        field: srv.data.field,
        msg: srv.data.msg || "Không lưu được hồ sơ",
        status: srv.status,
      };
    }
    if (
      user.profileVerified &&
      (data.gender !== undefined || data.birthday !== undefined) &&
      ((data.gender || user.gender) !== user.gender ||
        (data.birthday || user.birthday) !== user.birthday)
    )
      return {
        ok: false,
        msg: "Giới tính và ngày sinh đã được xác thực nên không thể tự sửa",
      };
    const patch = {};
    if (data.name) patch.name = String(data.name).trim();
    if (data.verify && !user.profileVerified) {
      patch.gender = data.gender;
      patch.birthday = data.birthday;
      patch.profileVerified = true;
      patch.profileVerifiedAt = new Date().toISOString();
    }
    const users = getUsers();
    const idx = findByEmail(users, user.email);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...patch };
      saveUsers(users);
    }
    const session = { ...user, ...patch };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session, birthdayVoucher: null };
  };

  // Khi tải trang: nếu giao diện nghĩ đã đăng nhập mà server không nhận → bỏ trạng thái "đã đăng nhập" giả
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      if (!isLoggedIn()) return;
      verifySession().then((ok) => {
        if (!ok && typeof updateNavAuth === "function") updateNavAuth();
      });
    });
  }

  return {
    getUser,
    isLoggedIn,
    verifySession,
    register,
    login,
    loginWithGoogle,
    logout,
    normEmail,
    emailExists,
    updateAvatar,
    saveProfile,
  };
})();
