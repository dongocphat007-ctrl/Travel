/**
 * main.js – Router, Auth UI, Actions, Seed Data, Init
 * Phụ thuộc: tất cả file js khác
 */

// Promise + Async/Await (ES6+)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadAppData() {
  const grid = $id("trips-grid");
  if (grid) grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
    <div class="empty-icon">✈️</div>
    <div class="empty-title" style="font-size:16px">Đang tải...</div>
  </div>`;
  await delay(300);
  renderHome();
}

// Auth UI
function updateNavAuth() {
  try { window.Chatbot?.refresh?.(); } catch (e) { console.warn("Chatbot.refresh:", e); } // đổi tài khoản → nạp đoạn chat tương ứng
  const user    = Auth.getUser();
  const area    = $id("nav-auth-area");
  const banner  = $id("guest-banner");
  const dashBtn = $id("nav-dash");

  if (user) {
    const avatarHTML = user.picture
      ? `<div class="user-avatar" style="background:${user.bg};padding:0;overflow:hidden"><img loading="lazy" decoding="async" src="${user.picture}" alt="${esc(user.initials)}" referrerpolicy="no-referrer"></div>`
      : `<div class="user-avatar" style="background:${user.bg}">${user.initials}</div>`;
    area.innerHTML = `
      <div class="user-chip" id="user-chip-btn">
        ${avatarHTML}
        <span class="user-name">${esc(user.name.split(" ").pop())}</span>
      </div>`;
    $id("user-chip-btn")?.addEventListener("click", () => navigate("profile"));
    if (dashBtn) dashBtn.style.display = "flex";
    const profBtn = $id("nav-profile");
    if (profBtn) profBtn.style.display = "none"; // Gộp vào user-chip, không hiện nút riêng
    if (banner)  banner.style.display  = "none";
    // Hiện nút Admin nếu user có role='admin'
    const adminBtn = $id("nav-admin");
    if (adminBtn) adminBtn.style.display = user.role === "admin" ? "flex" : "none";
  } else {
    area.innerHTML = `<button class="nav-btn nav-btn-login" id="nav-login-btn">Đăng nhập</button>`;
    $id("nav-login-btn")?.addEventListener("click", () => showLoginModal());
    if (dashBtn) dashBtn.style.display = "none";
    const adminBtn = $id("nav-admin");
    if (adminBtn) adminBtn.style.display = "none";
    if (banner)  banner.style.display  = "flex";
  }
}

// FIX: Dùng custom modal thay vì confirm() (bị sandbox chặn)
function showLogoutModal() {
  const user = Auth.getUser();
  if (!user) return;
  $id("logout-msg").textContent = `Bạn có muốn đăng xuất khỏi tài khoản "${user.name}"?`;
  $id("modal-logout").classList.add("open");
}

function closeLogoutModal() {
  $id("modal-logout").classList.remove("open");
}

// PROFILE ACTIONS
// Đọc file ảnh → cắt vuông ở giữa → thu về size×size → data URL (JPEG) để lưu localStorage
function fileToAvatarDataUrl(file, size = 512) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth  - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";                       // nền trắng cho ảnh PNG trong suốt
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) { reject(e); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
    img.src = url;
  });
}

function initProfileActions() {
  // Nút chỉnh sửa tên
  $id("pf-edit-btn")?.addEventListener("click", () => {
    $id("pf-edit-form").style.display = "block";
    $id("pf-edit-btn").style.display  = "none";
    $id("pf-name-input").focus();
  });

  // Hủy chỉnh sửa
  $id("pf-cancel-btn")?.addEventListener("click", () => {
    $id("pf-edit-form").style.display = "none";
    $id("pf-edit-btn").style.display  = "";
    const errEl = $id("err-pf-name");
    if (errEl) errEl.textContent = "";
  });

  // Lưu tên mới
  $id("pf-save-btn")?.addEventListener("click", () => {
    const newName = ($id("pf-name-input")?.value || "").trim();
    const errEl   = $id("err-pf-name");
    if (errEl) errEl.textContent = "";

    if (!newName || newName.length < 2) {
      if (errEl) { errEl.textContent = "Tên ít nhất 2 ký tự"; errEl.classList.add("show"); }
      return;
    }

    // Cập nhật session
    const user = Auth.getUser();
    if (!user) return;
    user.name     = newName;
    user.initials = newName.trim().split(/\s+/).reduce((acc, w, i, arr) =>
      i === 0 || i === arr.length - 1 ? acc + w[0].toUpperCase() : acc, "");
    localStorage.setItem("travel_auth_v1", JSON.stringify(user));

    // Cập nhật users store (mọi loại tài khoản: email, Google...) — khớp theo email
    const users = JSON.parse(localStorage.getItem("travel_users_v1") || "[]");
    const mail  = String(user.email || "").trim().toLowerCase();
    users.forEach(u => {
      if (String(u.email || "").trim().toLowerCase() === mail) { u.name = newName; u.initials = user.initials; }
    });
    localStorage.setItem("travel_users_v1", JSON.stringify(users));

    // Cập nhật UI
    $id("pf-edit-form").style.display = "none";
    $id("pf-edit-btn").style.display  = "";
    Auth.saveProfile({ name: newName });   // đồng bộ tên lên server (không chờ)
    updateNavAuth();
    renderProfile();
    showToast("Đã cập nhật tên hiển thị ✅", "success");
  });

  // Enter trong input tên
  $id("pf-name-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") $id("pf-save-btn")?.click();
    if (e.key === "Escape") $id("pf-cancel-btn")?.click();
  });

  // Đổi avatar
  const avatarInput = $id("pf-avatar-input");
  const avatarErr   = $id("err-pf-avatar");
  const setAvatarErr = msg => {
    if (!avatarErr) return;
    avatarErr.textContent = msg || "";
    avatarErr.classList.toggle("show", !!msg);
  };

  // Bấm avatar (hoặc nút 📷) → menu: Xem ảnh đại diện / Đổi ảnh đại diện
  const avatarEl = $id("pf-avatar");
  if (avatarEl) { avatarEl.setAttribute("role", "button"); avatarEl.setAttribute("tabindex", "0"); avatarEl.setAttribute("aria-haspopup", "menu"); }
  const showMenu = e => { e.stopPropagation(); openAvatarMenu(avatarEl, () => avatarInput?.click()); };
  $id("pf-avatar-btn")?.addEventListener("click", showMenu);
  avatarEl?.addEventListener("click", showMenu);
  avatarEl?.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showMenu(e); } });

  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files && avatarInput.files[0];
    avatarInput.value = "";                           // cho phép chọn lại cùng một file
    if (!file) return;
    setAvatarErr("");
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { setAvatarErr("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF"); return; }
    if (file.size > 5 * 1024 * 1024)                      { setAvatarErr("Ảnh quá lớn (tối đa 5MB)"); return; }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const r = Auth.updateAvatar(dataUrl);
      if (!r.ok) { setAvatarErr(r.msg); return; }
      updateNavAuth();
      renderProfile();
      showToast("Đã cập nhật ảnh đại diện ✅", "success");
    } catch (e) {
      setAvatarErr("Không đọc được ảnh này, hãy thử ảnh khác");
    }
  });

  $id("pf-avatar-remove")?.addEventListener("click", () => {
    setAvatarErr("");
    const r = Auth.updateAvatar(null);
    if (!r.ok) { setAvatarErr(r.msg); return; }
    updateNavAuth();
    renderProfile();
    showToast("Đã xóa ảnh đại diện", "info");
  });

  // Nút đăng xuất từ trang profile
  $id("pf-logout-btn")?.addEventListener("click", showLogoutModal);
}

/* ===== Avatar: menu lựa chọn + xem ảnh phóng to (kiểu Facebook) ===== */
function closeAvatarMenu() {
  document.getElementById("pf-avatar-menu")?.remove();
  document.removeEventListener("click", closeAvatarMenu);
  document.removeEventListener("keydown", _avatarMenuKey);
  window.removeEventListener("scroll", closeAvatarMenu, true);
  window.removeEventListener("resize", closeAvatarMenu);
}
function _avatarMenuKey(e) { if (e.key === "Escape") closeAvatarMenu(); }

function openAvatarMenu(anchor, onChange) {
  closeAvatarMenu();
  if (!anchor) return;
  const menu = document.createElement("div");
  menu.id = "pf-avatar-menu";
  menu.className = "avatar-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <button type="button" role="menuitem" data-act="view"><span>🖼️</span> Xem ảnh đại diện</button>
    <button type="button" role="menuitem" data-act="change"><span>📷</span> Đổi ảnh đại diện</button>`;
  document.body.appendChild(menu);

  // Đặt ngay dưới avatar, canh giữa, không tràn màn hình
  const r  = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const left = Math.max(12, Math.min(window.innerWidth - mw - 12, r.left + r.width / 2 - mw / 2));
  menu.style.left = left + "px";
  menu.style.top  = (r.bottom + 10) + "px";

  menu.addEventListener("click", e => {
    e.stopPropagation();
    const act = e.target.closest("button")?.dataset.act;
    if (!act) return;
    closeAvatarMenu();
    if (act === "view")   openAvatarViewer();
    if (act === "change") onChange && onChange();
  });
  menu.querySelector("button")?.focus();

  setTimeout(() => {
    document.addEventListener("click", closeAvatarMenu);
    document.addEventListener("keydown", _avatarMenuKey);
    window.addEventListener("scroll", closeAvatarMenu, true);
    window.addEventListener("resize", closeAvatarMenu);
  }, 0);
}

function closeAvatarViewer() {
  const v = document.getElementById("pf-avatar-viewer");
  if (!v) return;
  document.removeEventListener("keydown", _avatarViewerKey);
  v.classList.remove("show");
  setTimeout(() => v.remove(), 180);
  document.body.style.overflow = "";
}
function _avatarViewerKey(e) { if (e.key === "Escape") closeAvatarViewer(); }

function openAvatarViewer() {
  const user = Auth.getUser();
  if (!user) return;
  document.getElementById("pf-avatar-viewer")?.remove();

  const v = document.createElement("div");
  v.id = "pf-avatar-viewer";
  v.className = "avatar-viewer";
  v.setAttribute("role", "dialog");
  v.setAttribute("aria-modal", "true");
  v.setAttribute("aria-label", "Ảnh đại diện");

  const close = document.createElement("button");
  close.type = "button"; close.className = "avatar-viewer-close"; close.setAttribute("aria-label", "Đóng"); close.textContent = "✕";
  close.addEventListener("click", closeAvatarViewer);

  const stage = document.createElement("div");
  stage.className = "avatar-viewer-stage";
  if (user.picture) {
    const img = document.createElement("img");
    img.className = "avatar-viewer-img";
    img.alt = user.name || "Ảnh đại diện";
    img.referrerPolicy = "no-referrer";
    // Ảnh Google mặc định nhỏ (=s96-c) -> xin bản lớn hơn để phóng to không bị mờ
    img.src = /googleusercontent\.com/.test(user.picture)
      ? user.picture.replace(/=s\d+(-c)?(?=$|\?)/, "=s1024-c")
      : user.picture;
    stage.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "avatar-viewer-initials";
    ph.style.background = user.bg || "#4F46E5";
    ph.textContent = user.initials || "?";
    stage.appendChild(ph);
  }
  const cap = document.createElement("div");
  cap.className = "avatar-viewer-caption";
  cap.textContent = user.name || "";
  stage.appendChild(cap);

  v.appendChild(close);
  v.appendChild(stage);
  // Bấm ra ngoài ảnh để đóng (giống Facebook)
  v.addEventListener("click", e => { if (!e.target.closest(".avatar-viewer-img, .avatar-viewer-initials, .avatar-viewer-caption")) closeAvatarViewer(); });
  document.body.appendChild(v);
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", _avatarViewerKey);
  requestAnimationFrame(() => v.classList.add("show"));
  close.focus();
}

// Chuyển tab Đăng nhập ↔ Đăng ký trong modal
function switchAuthTab(tab) {
  const isLogin = tab === "login";
  $id("tab-login-btn").classList.toggle("active", isLogin);
  $id("tab-register-btn").classList.toggle("active", !isLogin);
  $id("panel-login").style.display    = isLogin ? "block" : "none";
  $id("panel-register").style.display = isLogin ? "none"  : "block";
  // Reset OTP nếu đang ở bước 2
  if ($id("panel-otp")) { $id("panel-otp").style.display = "none"; OTPService.cancel(); clearInterval(_cdTimer); }
  // Reset lỗi khi đổi tab
  ["err-li-email","err-li-pass","err-li-general",
   "err-reg-name","err-reg-email","err-reg-pass","err-reg-pass2","err-reg-general"].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });
}

let afterLoginCallback = null;

function showLoginModal(callback = null) {
  afterLoginCallback = callback;
  $id("modal-login").classList.add("open");
  // Re-render GSI after the modal is visible so its button can use the
  // available mobile width. OAuth settings and callback remain unchanged.
  requestAnimationFrame(initGoogleSignInBtn);
}

/**
 * GOOGLE OAUTH – GSI (Google Identity Services)
 * Client ID: 480770803476-s834au6ab8go1uasl0cm7akar6ge8n1e.apps.googleusercontent.com
 */
const GOOGLE_CLIENT_ID = "480770803476-s834au6ab8go1uasl0cm7akar6ge8n1e.apps.googleusercontent.com";

// Callback toàn cục — Google GSI gọi hàm này khi user chọn tài khoản
async function handleGoogleCredential(response) {
  if (!response?.credential) {
    showToast("Đăng nhập Google thất bại — thử lại sau", "error");
    return;
  }
  const user = await Auth.loginWithGoogle(response.credential);
  if (!user) {
    showToast("Không đọc được thông tin từ Google", "error");
    return;
  }
  $id("modal-login").classList.remove("open");
  updateNavAuth();
  showToast(`Chào mừng, ${user.name.split(" ").pop()}! 👋`, "success");
  window.AccountExtras?.onLoggedIn();   // xác thực hồ sơ + tải thông báo
  if (afterLoginCallback) { afterLoginCallback(); afterLoginCallback = null; }
  else renderHome();
}

// Khởi tạo Google GSI button trong modal khi thư viện sẵn sàng
let _gsiInitialized = false;
let _gsiButtonWidth = null;
function initGoogleSignInBtn() {
  if (typeof google === "undefined" || !google.accounts) return;
  // Chỉ initialize 1 lần (gọi nhiều lần sẽ báo warning và chỉ lần cuối có hiệu lực)
  if (!_gsiInitialized) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback:  handleGoogleCredential,
      ux_mode:   "popup"
    });
    _gsiInitialized = true;
  }
  const container = $id("g_id_signin_btn");
  if (container) {
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    const availableWidth = container.parentElement?.clientWidth || window.innerWidth - 64;
    const width = isMobile ? Math.max(120, Math.min(340, availableWidth)) : 340;
    if (_gsiButtonWidth === width && container.childElementCount) return;
    container.replaceChildren();
    google.accounts.id.renderButton(container, {
      type:  "standard",
      theme: "outline",
      size:  "large",
      text:  "continue_with",
      locale: "vi",
      width
    });
    _gsiButtonWidth = width;
  }
}

// Facebook – vẫn chờ App ID
function showFbPending() {
  showToast("Đăng nhập bằng Facebook đang chờ tích hợp App ID", "warn", 4000);
}

// Xử lý đăng nhập bằng email + mật khẩu
async function doEmailLogin() {
  const email    = ($id("li-email")?.value  || "").trim();
  const password = ($id("li-pass")?.value   || "");

  // Xóa lỗi cũ
  ["err-li-email","err-li-pass","err-li-general"].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });
  ["li-email","li-pass"].forEach(id => $id(id)?.classList.remove("err"));

  const result = await Auth.login({ email, password });

  if (!result.ok) {
    const errEl = $id("err-" + result.field);
    if (errEl) { errEl.textContent = result.msg; errEl.classList.add("show"); }
    $id(result.field)?.classList.add("err");
    if (!errEl) {
      const gen = $id("err-li-general");
      if (gen) { gen.textContent = result.msg; gen.classList.add("show"); }
    }
    return;
  }

  $id("modal-login").classList.remove("open");
  updateNavAuth();
  showToast(`Chào mừng, ${result.user.name.split(" ").pop()}! 👋`, "success");
  window.AccountExtras?.onLoggedIn();   // xác thực hồ sơ + tải thông báo
  if (afterLoginCallback) { afterLoginCallback(); afterLoginCallback = null; }
  else renderHome();
}

// Xử lý đăng ký tài khoản mới
// ĐĂNG KÝ – Bước 1: Validate form → Gửi OTP
async function doRegister() {
  const name  = ($id("reg-name")?.value  || "").trim();
  const email = ($id("reg-email")?.value || "").trim();
  const pass  = ($id("reg-pass")?.value  || "");
  const pass2 = ($id("reg-pass2")?.value || "");

  // Xóa lỗi cũ
  ["err-reg-name","err-reg-email","err-reg-pass","err-reg-pass2","err-reg-general"].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });
  ["reg-name","reg-email","reg-pass","reg-pass2"].forEach(id => $id(id)?.classList.remove("err"));

  // Validate phía client trước khi gửi email
  if (!name || name.length < 2) {
    showRegErr("reg-name", "err-reg-name", "Họ tên ít nhất 2 ký tự"); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegErr("reg-email", "err-reg-email", "Email không đúng định dạng"); return;
  }
  if (pass.length < 6) {
    showRegErr("reg-pass", "err-reg-pass", "Mật khẩu ít nhất 6 ký tự"); return;
  }
  if (pass !== pass2) {
    showRegErr("reg-pass2", "err-reg-pass2", "Mật khẩu xác nhận không khớp"); return;
  }

  // Kiểm tra email đã đăng ký chưa
  const preCheck = await Auth.register({ name, email, password: pass, dryRun: true });
  if (preCheck && !preCheck.ok) {
    const errEl = $id("err-" + preCheck.field);
    if (errEl) { errEl.textContent = preCheck.msg; errEl.classList.add("show"); }
    $id(preCheck.field)?.classList.add("err");
    return;
  }

  // Gửi OTP
  const btn = $id("btn-do-register");
  btn.dataset.loading = "true";
  btn.textContent = "⏳ Đang gửi mã...";

  const res = await OTPService.send({ name, email });

  btn.dataset.loading = "false";
  btn.innerHTML = "📧 Gửi mã xác nhận";

  if (!res.ok) {
    const el = $id("err-reg-general");
    if (el) { el.textContent = res.msg; el.classList.add("show"); }
    return;
  }

  // Chuyển sang panel OTP
  $id("panel-register").style.display = "none";
  const otpPanel = $id("panel-otp");
  otpPanel.style.display = "block";
  $id("otp-email-display").textContent = email;
  $id("otp-input").value = "";
  $id("otp-input").focus();

  // Đếm ngược 60s trước khi cho phép gửi lại
  startOtpCountdown();
}

function showRegErr(fieldId, errId, msg) {
  const errEl = $id(errId);
  if (errEl) { errEl.textContent = msg; errEl.classList.add("show"); }
  $id(fieldId)?.classList.add("err");
}

// Đếm ngược nút "Gửi lại"
let _cdTimer = null;
function startOtpCountdown(seconds = 60) {
  const btn = $id("btn-resend-otp");
  const span = $id("otp-countdown");
  if (!btn || !span) return;
  btn.disabled = true;
  let s = seconds;
  span.textContent = s;
  clearInterval(_cdTimer);
  _cdTimer = setInterval(() => {
    s--;
    span.textContent = s;
    if (s <= 0) {
      clearInterval(_cdTimer);
      btn.disabled = false;
      btn.textContent = "Gửi lại";
    }
  }, 1000);
}

// Gửi lại OTP
async function resendOtp() {
  const email = ($id("otp-email-display")?.textContent || "").trim();
  const name  = ($id("reg-name")?.value || "").trim();
  const btn   = $id("btn-resend-otp");
  if (!email || !btn) return;

  btn.disabled = true;
  btn.textContent = "⏳ Đang gửi...";

  const res = await OTPService.send({ name, email });
  if (!res.ok) {
    const el = $id("err-otp-general");
    if (el) { el.textContent = res.msg; el.classList.add("show"); }
    btn.disabled = false;
    btn.textContent = "Gửi lại";
    return;
  }
  showToast("Đã gửi lại mã OTP 📬", "success", 3000);
  $id("otp-input").value = "";
  $id("otp-input").focus();
  startOtpCountdown();
}

// Xác nhận OTP → Hoàn tất đăng ký
async function verifyOtpAndRegister() {
  const code  = ($id("otp-input")?.value || "").trim();
  const email = ($id("reg-email")?.value || "").trim();
  const name  = ($id("reg-name")?.value  || "").trim();
  const pass  = ($id("reg-pass")?.value  || "");

  // Xóa lỗi cũ
  ["err-otp","err-otp-general"].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });

  if (!code || code.length !== 6) {
    const el = $id("err-otp");
    if (el) { el.textContent = "Vui lòng nhập đủ 6 chữ số"; el.classList.add("show"); }
    return;
  }

  const check = await OTPService.verify(code, email);
  if (!check.ok) {
    const el = $id("err-otp");
    if (el) { el.textContent = check.msg; el.classList.add("show"); }
    $id("otp-input")?.classList.add("err");
    setTimeout(() => $id("otp-input")?.classList.remove("err"), 600);
    return;
  }

  // OTP đúng → thực sự tạo tài khoản
  const result = await Auth.register({ name, email, password: pass });
  if (!result.ok) {
    const el = $id("err-otp-general");
    if (el) { el.textContent = result.msg; el.classList.add("show"); }
    return;
  }

  clearInterval(_cdTimer);
  $id("modal-login").classList.remove("open");
  resetRegisterPanel();
  updateNavAuth();
  showToast(`Đăng ký thành công! Chào mừng ${result.user.name.split(" ").pop()} 🎉`, "success", 4000);
  window.AccountExtras?.onLoggedIn(result.welcomeVoucher);   // xác thực hồ sơ + tải thông báo
  if (afterLoginCallback) { afterLoginCallback(); afterLoginCallback = null; }
  else renderHome();
}

// Reset về bước 1
function resetRegisterPanel() {
  OTPService.cancel();
  clearInterval(_cdTimer);
  $id("panel-otp").style.display      = "none";
  $id("panel-register").style.display = "block";
  ["reg-name","reg-email","reg-pass","reg-pass2","otp-input"].forEach(id => {
    const el = $id(id);
    if (el) { el.value = ""; el.classList.remove("err"); }
  });
  ["err-reg-name","err-reg-email","err-reg-pass","err-reg-pass2",
   "err-reg-general","err-otp","err-otp-general"].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });
}

// Guard: yêu cầu đăng nhập trước khi thực hiện thao tác
function requireAuth(callback) {
  if (Auth.isLoggedIn()) { callback(); return; }
  showLoginModal(callback);
}

// ROUTER – Điều hướng trang
function navigate(page, opts = {}) { // Default parameter (ES6+)
  PAGES.forEach(p => $id(`page-${p}`)?.classList.toggle("active", p === page));

  // forEach() – cập nhật nav active
  [
    { id: "nav-home",         page: "home"         },
    { id: "nav-dash",         page: "dashboard"    },
    { id: "nav-about",        page: "about"        },
    { id: "nav-profile",      page: "profile"      },
    { id: "nav-world-map",    page: "world-map"    },
    { id: "nav-tour-finder",  page: "tour-finder"  },
    { id: "nav-hotel-search", page: "hotel-search" },
    { id: "nav-food",         page: "food"         },
    { id: "nav-guides",       page: "guides"       },
    { id: "nav-admin",        page: "admin"        },
  ].forEach(({ id, page: p }) => $id(id)?.classList.toggle("active", p === page));

  // Highlight user-chip khi đang ở trang profile
  $id("user-chip-btn")?.classList.toggle("active", page === "profile");

  if (opts.tripId) AppState.tripId = opts.tripId;
  AppState.page = page;

  if (page === "home")        loadAppData();
  if (page === "trip-detail") renderDetail(AppState.tripId);
  if (page === "dashboard")   renderDashboard();
  if (page === "profile")     renderProfile();
  if (page === "food" && !document.getElementById("food-root").innerHTML) FoodModule.render("food-root");
  if (page === "admin") Admin.render();
  if (page === "guides" && typeof GuidesPage !== "undefined") GuidesPage.render();
  if (page === "policy") PolicyPage.render(opts.tab);
  if (page === "about") {
    $id("contact-success").classList.remove("show");
    $id("form-contact").style.display = "";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ACTIONS: Trip
function openDetail(tripId) {
  AppState.tripId       = tripId;
  AppState.activeTab    = "itinerary";
  AppState.locCatFilter = "";
  navigate("trip-detail", { tripId });
}

function openNewTripForm() {
  $id("form-trip").reset();
  $id("f-edit-id").value              = "";
  $id("form-trip-title").textContent  = "Tạo chuyến đi mới";
  $id("f-submit-btn").textContent     = "Tạo chuyến đi";

  // FIX 2: Set min date = today, hiển thị ngày hôm nay định dạng dd/mm/yyyy
  const today = todayStr();
  $id("f-start").min = today;
  $id("f-end").min   = today;
  $id("f-start-hint").textContent = `📅 Phải từ ngày ${fmtToday()} trở đi`;

  AppState.emoji = "✈️";
  renderEmojiPicker();
  resetCoverUpload();           // Task 3.1
  updateGuideCost();
  navigate("create-trip");
}

// Thuê HDV: hiện/ẩn tuỳ chọn và tính phí theo số ngày + số tiếng/ngày
function updateGuideCost() {
  const on = $id("f-guide")?.checked;
  const opts = $id("guide-opts");
  if (opts) opts.style.display = on ? "" : "none";
  const out = $id("f-guide-cost");
  if (!out || !on) return;
  const s = $id("f-start").value, e = $id("f-end").value;
  const days = (s && e && e >= s) ? Math.round((new Date(e) - new Date(s)) / 864e5) + 1 : 0;
  const hours = +$id("f-guide-hours").value || GUIDE_DAY_HOURS;
  out.textContent = days
    ? `💰 Phí HDV: ${new Intl.NumberFormat("vi-VN").format(tinhPhiHDV(days, hours))} ₫ (${days} ngày × ${hours} tiếng)`
    : "💰 Chọn ngày khởi hành và kết thúc để tính phí HDV";
}

function getGuideHireFromForm() {
  if (!$id("f-guide")?.checked) return { enabled: false };
  const s = $id("f-start").value, e = $id("f-end").value;
  const days = (s && e && e >= s) ? Math.round((new Date(e) - new Date(s)) / 864e5) + 1 : 0;
  const hoursPerDay = +$id("f-guide-hours").value || GUIDE_DAY_HOURS;
  return { enabled: true, hoursPerDay, days, cost: tinhPhiHDV(days, hoursPerDay), type: "domestic" };
}

function openEditTripForm(tripId) {
  const t = TripManager.getById(tripId);
  if (!t) return;

  // Destructuring (ES6+)
  const { name, destination, startDate, endDate, budget, members, description, emoji } = t;

  $id("f-name").value    = name;
  $id("f-dest").value    = destination;
  $id("f-start").value   = startDate;
  $id("f-end").value     = endDate;
  // FIX 4: Format số khi load vào form
  $id("f-budget").value  = budget > 0 ? budget.toLocaleString("vi-VN") : "";
  $id("f-members").value = members || 1;
  $id("f-desc").value    = description || "";
  $id("f-edit-id").value = tripId;
  $id("form-trip-title").textContent = "Chỉnh sửa chuyến đi";
  $id("f-submit-btn").textContent    = "Lưu thay đổi";

  // FIX 2: Set min date
  const today = todayStr();
  $id("f-start").min = today;
  $id("f-end").min   = today;
  $id("f-start-hint").textContent = `📅 Phải từ ngày ${fmtToday()} trở đi`;

  AppState.emoji = emoji || "✈️";
  renderEmojiPicker();
  resetCoverUpload(t.coverImage || "");  // Task 3.1
  $id("f-guide").checked = !!t.guideHire?.enabled;
  $id("f-guide-hours").value = String(t.guideHire?.hoursPerDay || GUIDE_DAY_HOURS);
  updateGuideCost();
  navigate("create-trip");
}

function handleTripSubmit(e) {
  e.preventDefault();
  // FIX 4: Lấy số thực từ ô input đã format
  const d = {
    name:        $id("f-name").value,
    destination: $id("f-dest").value,
    startDate:   $id("f-start").value,
    endDate:     $id("f-end").value,
    budget:      rawNum("f-budget"),
    members:     rawNum("f-members") || 1,
    description: $id("f-desc").value,
    emoji:       AppState.emoji,
    coverImage:  $id("f-cover-image").value,  // Task 3.1
    guideHire:   getGuideHireFromForm()
  };

  if (!Validator.validateTrip(d)) return;

  const editId = $id("f-edit-id").value;
  if (editId) {
    TripManager.update(editId, d);
    showToast("Đã cập nhật chuyến đi!", "success");
    AppState.tripId = editId;
    navigate("trip-detail", { tripId: editId });
  } else {
    const t = TripManager.create(d);
    if (!t) { showToast("Tạo chuyến đi thất bại!", "error"); return; }
    showToast("Đã tạo chuyến đi mới! 🎉", "success");
    AppState.tripId = t.id;
    navigate("trip-detail", { tripId: t.id });
  }
}

function askDeleteTrip(id, name) {
  $id("mc-title").textContent = "Xóa chuyến đi";
  $id("mc-msg").textContent   = `Bạn có chắc muốn xóa "${name}"? Hành động này không thể hoàn tác.`;
  AppState.confirmCb = () => {
    TripManager.remove(id);
    showToast("Đã xóa chuyến đi.", "success");
    renderHome();
  };
  $id("modal-confirm").classList.add("open");
}

// ACTIONS: Location
function openAddLocForm(tripId, dayId) {
  AppState.tripId = tripId;
  $id("form-loc").reset();
  $id("lf-trip-id").value         = tripId;
  $id("lf-day-id").value          = dayId;
  $id("lf-loc-id").value          = "";
  $id("loc-form-title").textContent = "Thêm địa điểm";
  $id("lf-submit").textContent      = "Thêm địa điểm";

  const t   = TripManager.getById(tripId);
  const day = t?.days.find(d => d.id === dayId);
  $id("loc-form-sub").textContent = day
    ? `${t.name} · ${day.label} (${fmtDate(day.date)})`
    : "";
  navigate("add-loc");
}

function openEditLocForm(tripId, dayId, locId) {
  AppState.tripId = tripId;
  const t   = TripManager.getById(tripId);
  const day = t?.days.find(d => d.id === dayId);
  const l   = day?.locations.find(loc => loc.id === locId);
  if (!l) return;

  // Destructuring (ES6+)
  const { name, category, time, note, plannedCost, actualCost } = l;

  $id("lf-name").value    = name;
  $id("lf-cat").value     = category;
  $id("lf-time").value    = time || "";
  $id("lf-note").value    = note || "";
  // FIX 4: Format số khi load
  $id("lf-planned").value = plannedCost > 0 ? plannedCost.toLocaleString("vi-VN") : "";
  $id("lf-actual").value  = actualCost  > 0 ? actualCost.toLocaleString("vi-VN")  : "";
  $id("lf-trip-id").value = tripId;
  $id("lf-day-id").value  = dayId;
  $id("lf-loc-id").value  = locId;
  $id("loc-form-title").textContent = "Sửa địa điểm";
  $id("lf-submit").textContent      = "Lưu thay đổi";
  $id("loc-form-sub").textContent   = day ? `${t.name} · ${day.label}` : "";
  navigate("add-loc");
}

function handleLocSubmit(e) {
  e.preventDefault();
  // FIX 4: Lấy số thực
  const d = {
    name:        $id("lf-name").value,
    category:    $id("lf-cat").value,
    time:        $id("lf-time").value,
    note:        $id("lf-note").value,
    plannedCost: rawNum("lf-planned"),
    actualCost:  rawNum("lf-actual")
  };

  if (!Validator.validateLoc(d)) return;

  const tripId = $id("lf-trip-id").value;
  const dayId  = $id("lf-day-id").value;
  const locId  = $id("lf-loc-id").value;

  if (locId) {
    TripManager.updateLoc(tripId, dayId, locId, d);
    showToast("Đã cập nhật địa điểm!", "success");
  } else {
    TripManager.addLoc(tripId, dayId, d);
    showToast("Đã thêm địa điểm!", "success");
  }
  AppState.tripId = tripId;
  navigate("trip-detail", { tripId });
}

function askDeleteLoc(tripId, dayId, locId, name) {
  $id("mc-title").textContent = "Xóa địa điểm";
  $id("mc-msg").textContent   = `Bạn có chắc muốn xóa địa điểm "${name}"?`;
  AppState.confirmCb = () => {
    TripManager.removeLoc(tripId, dayId, locId);
    showToast("Đã xóa địa điểm.", "success");
    renderDetail(tripId);
  };
  $id("modal-confirm").classList.add("open");
}

function closeConfirmModal() {
  $id("modal-confirm").classList.remove("open");
  AppState.confirmCb = null;
}


// TASK 5.1 — SAMPLE TOURS DATA (Tour mẫu của website)
const SAMPLE_TOURS = [
  // CÓ HƯỚNG DẪN VIÊN
  {
    id: "g1", type: "guided",
    name: "Hội An – Đà Nẵng trọn gói",
    destination: "Đà Nẵng · Hội An", duration: "5 ngày 4 đêm",
    price: 4990000, currency: "VND", groupSize: "10–20 người",
    difficulty: "Dễ", highlight: "Phố cổ · Bà Nà Hills · Cầu Rồng",
    tags: ["Văn hoá", "Ẩm thực", "Gia đình"], coverEmoji: "🏮",
  },
  {
    id: "g2", type: "guided",
    name: "Sapa chinh phục Fansipan",
    destination: "Sapa, Lào Cai", duration: "3 ngày 2 đêm",
    price: 3200000, currency: "VND", groupSize: "8–12 người",
    difficulty: "Trung bình", highlight: "Fansipan · Bản Cát Cát · Ruộng bậc thang",
    tags: ["Trekking", "Thiên nhiên", "Cặp đôi"], coverEmoji: "⛰️",
  },
  {
    id: "g3", type: "guided",
    name: "Mũi Né & Phan Thiết biển xanh",
    destination: "Bình Thuận", duration: "3 ngày 2 đêm",
    price: 2800000, currency: "VND", groupSize: "15–25 người",
    difficulty: "Dễ", highlight: "Đồi cát · Làng chài · Bãi biển",
    tags: ["Biển", "Nghỉ dưỡng", "Gia đình"], coverEmoji: "🏖️",
  },
  {
    id: "g4", type: "guided",
    name: "Tây Bắc vòng cung",
    destination: "Điện Biên · Lai Châu · Hà Giang", duration: "7 ngày 6 đêm",
    price: 7500000, currency: "VND", groupSize: "6–10 người",
    difficulty: "Khó", highlight: "Đèo Ô Quy Hồ · Mù Cang Chải · Đồng Văn",
    tags: ["Phượt", "Thiên nhiên", "Nhiếp ảnh"], coverEmoji: "🏔️",
  },
  // TỰ TÚC (THAM KHẢO)
  {
    id: "s1", type: "self",
    name: "Lịch trình Hà Nội 4 ngày tự túc",
    destination: "Hà Nội", duration: "4 ngày",
    price: 1800000, guideFee: 2500000, currency: "VND", groupSize: "1–6 người",
    difficulty: "Dễ", highlight: "Hồ Hoàn Kiếm · Văn Miếu · Bún chả Obama",
    tags: ["Lịch sử", "Ẩm thực", "Đi bộ"], coverEmoji: "🏛️",
    itinerary: [
      { day: 1, title: "Hồ Gươm & Phố Cổ", items: [
        { time: "08:00", desc: "Bún chả Hàng Mành – ăn sáng đặc sản Hà Nội (50.000 ₫)" },
        { time: "09:30", desc: "Đi bộ quanh Hồ Hoàn Kiếm · Tháp Rùa · Cầu Thê Húc (miễn phí)" },
        { time: "10:30", desc: "Đền Ngọc Sơn – vé vào cửa 30.000 ₫/người" },
        { time: "12:00", desc: "Phở Thìn Bờ Hồ – trưa (80.000 ₫)" },
        { time: "14:00", desc: "Dạo phố cổ 36 phường – Hàng Bạc, Hàng Đào, Hàng Ngang" },
        { time: "17:00", desc: "Check-in khách sạn khu vực Hoàn Kiếm (700.000–1.200.000 ₫/đêm)" },
        { time: "19:00", desc: "Phố đi bộ Hồ Gươm cuối tuần & ẩm thực đường phố" },
      ]},
      { day: 2, title: "Văn Miếu & Hồ Tây", items: [
        { time: "08:00", desc: "Bánh cuốn Thanh Vân – điểm tâm sáng (40.000 ₫)" },
        { time: "09:00", desc: "Văn Miếu – Quốc Tử Giám – vé 30.000 ₫/người" },
        { time: "11:00", desc: "Hoàng thành Thăng Long – vé 30.000 ₫/người" },
        { time: "13:00", desc: "Bún bò Nam Bộ Hàng Điếu – trưa (60.000 ₫)" },
        { time: "15:00", desc: "Hồ Tây – thuê xe đạp đôi đạp quanh hồ (50.000 ₫/giờ)" },
        { time: "17:00", desc: "Chùa Trấn Quốc – miễn phí, ngắm hoàng hôn trên hồ" },
        { time: "19:30", desc: "Bún chả Obama Hương Liên (120.000 ₫)" },
      ]},
      { day: 3, title: "Lăng Bác & Bảo tàng", items: [
        { time: "07:30", desc: "Xếp hàng vào Lăng Hồ Chí Minh (miễn phí, mở cửa 8h–11h30)" },
        { time: "09:30", desc: "Bảo tàng Hồ Chí Minh – vé 40.000 ₫" },
        { time: "11:00", desc: "Chùa Một Cột – tham quan tự do (miễn phí)" },
        { time: "12:30", desc: "Cơm tấm phố Đinh Tiên Hoàng – trưa (70.000 ₫)" },
        { time: "14:30", desc: "Bảo tàng Dân tộc học Việt Nam – vé 40.000 ₫, rất đáng xem" },
        { time: "17:30", desc: "Cà phê trứng Giảng – thưởng thức đặc sản Hà Nội (35.000 ₫)" },
        { time: "19:00", desc: "Lẩu nấm Đường Thành – tụ họp ăn tối (150.000 ₫/người)" },
      ]},
      { day: 4, title: "Chợ Đồng Xuân & Ra về", items: [
        { time: "07:30", desc: "Xôi Yến Nguyễn Hữu Huân – điểm tâm (30.000 ₫)" },
        { time: "08:30", desc: "Chợ Đồng Xuân – mua sắm đặc sản, quà lưu niệm" },
        { time: "10:30", desc: "Nhà thờ Lớn Hà Nội – chụp ảnh, tham quan khu Tràng Tiền" },
        { time: "12:00", desc: "Chả cá Lã Vọng – bữa trưa đặc sản (200.000 ₫/người)" },
        { time: "14:00", desc: "Mua sắm phố Hàng Gai – lụa tơ tằm, áo dài truyền thống" },
        { time: "16:00", desc: "Check-out & trở về / ra sân bay" },
      ]},
    ],
  },
  {
    id: "s2", type: "self",
    name: "Khám phá Cần Thơ cuối tuần",
    destination: "Cần Thơ, Đồng bằng SCL", duration: "2 ngày 1 đêm",
    price: 900000, guideFee: 1400000, currency: "VND", groupSize: "Mọi quy mô",
    difficulty: "Dễ", highlight: "Chợ nổi Cái Răng · Vườn trái cây · Lò hủ tiếu",
    tags: ["Ẩm thực", "Sông nước", "Gia đình"], coverEmoji: "⛵",
    itinerary: [
      { day: 1, title: "Chợ nổi & Bến Ninh Kiều", items: [
        { time: "05:00", desc: "Khởi hành sớm ra bến thuyền – thuê ghe máy đi chợ nổi Cái Răng (150.000 ₫/người, 2 giờ)" },
        { time: "05:30", desc: "Chợ nổi Cái Răng – trải nghiệm mua trái cây, ăn hủ tiếu ghe nóng hổi (30.000–50.000 ₫)" },
        { time: "08:00", desc: "Trở về bờ – ăn sáng bánh mì Cần Thơ tại bến Ninh Kiều (25.000 ₫)" },
        { time: "09:30", desc: "Check-in khách sạn ven sông (500.000–900.000 ₫/đêm)" },
        { time: "11:00", desc: "Vườn trái cây Mỹ Khánh – tham quan, thưởng thức trái cây tươi (50.000 ₫/người)" },
        { time: "13:00", desc: "Cơm tấm sườn bì chả tại vườn hoặc nhà hàng địa phương (80.000 ₫)" },
        { time: "15:00", desc: "Tham quan làng lò hủ tiếu thủ công Bến Ninh Kiều" },
        { time: "17:30", desc: "Dạo bến Ninh Kiều – ngắm hoàng hôn trên sông Hậu" },
        { time: "19:00", desc: "Lẩu mắm miền Tây đặc sản – bữa tối (180.000 ₫/người)" },
      ]},
      { day: 2, title: "Vườn cò & Ra về", items: [
        { time: "07:00", desc: "Cháo lòng sáng – đặc sản Cần Thơ (40.000 ₫)" },
        { time: "08:30", desc: "Vườn cò Bằng Lăng – tham quan hàng nghìn con cò (30.000 ₫/người)" },
        { time: "10:30", desc: "Chùa Ông – kiến trúc người Hoa độc đáo (miễn phí)" },
        { time: "12:00", desc: "Bún cá Cần Thơ – bữa trưa trước khi rời (60.000 ₫)" },
        { time: "13:30", desc: "Mua đặc sản về: mắm thái, cốm dẹp, bánh tét lá cẩm" },
        { time: "15:00", desc: "Trở về TP.HCM hoặc ra sân bay Cần Thơ" },
      ]},
    ],
  },
  {
    id: "s3", type: "self",
    name: "Ninh Bình – Tràng An 2 ngày",
    destination: "Ninh Bình", duration: "2 ngày 1 đêm",
    price: 1200000, guideFee: 1900000, currency: "VND", groupSize: "Cặp đôi / Nhóm nhỏ",
    difficulty: "Dễ", highlight: "Tràng An · Tam Cốc · Cố đô Hoa Lư",
    tags: ["Di sản", "Thiên nhiên", "Thuyền"], coverEmoji: "🛶",
    itinerary: [
      { day: 1, title: "Tràng An & Hang Múa", items: [
        { time: "07:00", desc: "Xuất phát từ Hà Nội (xe khách/xe tự thuê ~2 giờ)" },
        { time: "09:00", desc: "Đến Ninh Bình – ăn sáng cơm cháy Ninh Bình (60.000 ₫)" },
        { time: "10:00", desc: "Chèo thuyền Tràng An – Di sản UNESCO, vé 250.000 ₫/người (bao gồm thuyền 3–4 hang)" },
        { time: "13:30", desc: "Cơm niêu đặc sản Ninh Bình – trưa (120.000 ₫/người)" },
        { time: "15:00", desc: "Leo Hang Múa – 500 bậc thang, toàn cảnh đồng lúa ngoạn mục (vé 100.000 ₫)" },
        { time: "17:00", desc: "Check-in homestay/resort ven đồng lúa (600.000–1.500.000 ₫/đêm)" },
        { time: "19:00", desc: "Dê núi Ninh Bình nướng – đặc sản không thể bỏ qua (200.000 ₫/người)" },
      ]},
      { day: 2, title: "Tam Cốc & Hoa Lư", items: [
        { time: "07:30", desc: "Bún bò Ninh Bình sáng (50.000 ₫)" },
        { time: "08:30", desc: "Chèo thuyền Tam Cốc – 3 hang động trên sông Ngô Đồng (vé 200.000 ₫ gồm thuyền)" },
        { time: "11:00", desc: "Thuê xe đạp dạo làng quê (50.000 ₫/2 giờ)" },
        { time: "12:30", desc: "Cơm trưa tại nhà hàng địa phương (100.000 ₫)" },
        { time: "14:00", desc: "Cố đô Hoa Lư – kinh đô đầu tiên của Đại Cồ Việt (vé 20.000 ₫)" },
        { time: "15:30", desc: 'Chùa Bích Động – "Nam thiên đệ nhị động" (miễn phí)' },
        { time: "17:00", desc: "Mua đặc sản: cơm cháy, rượu Kim Sơn, thêu tay Ninh Bình" },
        { time: "17:30", desc: "Trở về Hà Nội hoặc điểm tiếp theo" },
      ]},
    ],
  },
  {
    id: "s4", type: "self",
    name: "Đà Lạt cà phê & hoa tự lên lịch",
    destination: "Đà Lạt, Lâm Đồng", duration: "3 ngày 2 đêm",
    price: 1500000, guideFee: 2200000, currency: "VND", groupSize: "Bất kỳ",
    difficulty: "Dễ", highlight: "Cà phê đặc sản · Vườn hoa · Thác Datanla",
    tags: ["Cà phê", "Lãng mạn", "Nhiếp ảnh"], coverEmoji: "🌸",
    itinerary: [
      { day: 1, title: "Chợ Đà Lạt & Vườn Hoa", items: [
        { time: "09:00", desc: "Đến Đà Lạt (bay hoặc xe từ TP.HCM ~7 giờ) – check-in khách sạn/homestay (600.000–1.200.000 ₫/đêm)" },
        { time: "11:00", desc: "Bánh mì xíu mại Đà Lạt – trưa đặc sản (25.000 ₫)" },
        { time: "13:00", desc: "Vườn Hoa Đà Lạt – hơn 300 loài hoa, chụp ảnh sống ảo (vé 50.000 ₫)" },
        { time: "15:00", desc: "Đồi chè Cầu Đất – cánh đồng trà xanh mút mắt (thuê xe ôm 100.000 ₫/chiều)" },
        { time: "17:30", desc: "Hoàng hôn tại hồ Xuân Hương – dạo bộ miễn phí" },
        { time: "19:00", desc: "Chợ đêm Đà Lạt – bánh tráng nướng, sữa đậu nành, bắp nướng (50.000–100.000 ₫)" },
      ]},
      { day: 2, title: "Cà phê & Thác Datanla", items: [
        { time: "08:00", desc: "Cà phê trứng Đà Lạt hoặc cà phê chồn – thưởng thức buổi sáng (50.000–200.000 ₫)" },
        { time: "09:30", desc: "Thác Datanla – cáp trượt mạo hiểm xuống thác, cảnh đẹp hùng vĩ (vé cáp + vào cửa 120.000 ₫)" },
        { time: "11:30", desc: "Quán ăn quanh thác – bò nướng Đà Lạt (150.000 ₫/người)" },
        { time: "13:30", desc: "Đồi Robin – cánh đồng hoa dã quỳ / lavender theo mùa (vé 30.000 ₫)" },
        { time: "15:30", desc: "Làng Cù Lần – khám phá văn hóa K'Ho (vé 100.000 ₫ gồm trải nghiệm)" },
        { time: "19:00", desc: "Lẩu bò Đà Lạt – ấm lòng trong cái lạnh (180.000 ₫/người)" },
      ]},
      { day: 3, title: "Thung lũng Tình Yêu & Ra về", items: [
        { time: "08:30", desc: "Sữa chua trân châu Đà Lạt sáng (20.000 ₫)" },
        { time: "09:30", desc: "Thung lũng Tình Yêu – hồ và vườn hoa lãng mạn (vé 80.000 ₫)" },
        { time: "11:30", desc: "Trại Mát – Thiền viện Trúc Lâm (cáp treo 90.000 ₫ khứ hồi)" },
        { time: "13:30", desc: "Bánh căn + cháo Đà Lạt – trưa trước khi về (60.000 ₫)" },
        { time: "15:00", desc: "Mua đặc sản: trà atiso, mứt dâu, rượu vang Đà Lạt, hoa khô" },
        { time: "16:00", desc: "Ra sân bay / trạm xe – kết thúc chuyến đi" },
      ]},
    ],
  },
];

// SEED DATA
/**
 * KHÔNG còn tạo tài khoản Admin có mật khẩu gắn cứng trong JS công khai.
 * Admin thật do Spring Boot tạo từ biến môi trường ADMIN_EMAIL / ADMIN_PASSWORD (hoặc SUPER_ADMIN_EMAIL + đăng nhập Google).
 * Hàm này chỉ dọn tài khoản admin mặc định cũ (mật khẩu đã lộ trong mã nguồn) còn sót trong localStorage của trình duyệt.
 */
function seedAdminAccount() {
  const USERS_KEY = "travel_users_v1";
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    const clean = users.filter(u => u.id !== "admin_default" || u.provider !== "local" || u.passHash !== "-g10hvh");
    if (clean.length !== users.length) localStorage.setItem(USERS_KEY, JSON.stringify(clean));
  } catch (e) { /* không cản init app */ }
}

function seedData() {
  /**
   * FIX: Chỉ seed dữ liệu mẫu khi đang dùng tài khoản demo hoặc chưa đăng nhập lần đầu.
   *     Tài khoản mới đăng ký sẽ KHÔNG tự động có chuyến đi mẫu.
   */
  const currentUser = Auth.getUser();
  const DEMO_EMAIL  = "demo@travel.vn"; // email demo duy nhất được seed
  if (currentUser && currentUser.email !== DEMO_EMAIL) return; // user thật → bỏ qua
  if (StorageManager.load().length) return;
  const mk = (id, lbl, date, locs = []) => ({ id, label: lbl, date, locations: locs });
  const trips = [
    {
      id:"d1", name:"Đà Nẵng mùa hè 2026", destination:"Đà Nẵng, Hội An",
      startDate:"2026-07-15", endDate:"2026-07-18", budget:9000000, members:2,
      description:"Nghỉ hè cùng bạn bè, khám phá biển và phố cổ.", emoji:"🏖️",
      createdAt: new Date(Date.now()-864e5*3).toISOString(),
      days:[
        mk("dy1","Ngày 1","2026-07-15",[
          {id:"l1",name:"Sân bay Đà Nẵng",     category:"transport",time:"08:30",note:"Chuyến VN205 từ Hà Nội", plannedCost:1400000,actualCost:1400000,createdAt:""},
          {id:"l2",name:"Khách sạn Fusion Suites",category:"hotel",  time:"14:00",note:"Check-in, view biển",   plannedCost:1200000,actualCost:1200000,createdAt:""},
          {id:"l3",name:"Bãi biển Mỹ Khê",     category:"landmark", time:"16:00",note:"",                        plannedCost:0,      actualCost:0,      createdAt:""},
        ]),
        mk("dy2","Ngày 2","2026-07-16",[
          {id:"l4",name:"Bà Nà Hills – Cầu Vàng",category:"activity",time:"08:00",note:"Mua vé online -10%", plannedCost:900000,actualCost:810000,createdAt:""},
          {id:"l5",name:"Buffet Fantasy Park",   category:"food",    time:"12:00",note:"",                     plannedCost:200000,actualCost:175000,createdAt:""},
        ]),
        mk("dy3","Ngày 3","2026-07-17",[
          {id:"l6",name:"Phố cổ Hội An",     category:"landmark",time:"09:00",note:"Thuê xe máy 80k",     plannedCost:80000, actualCost:80000, createdAt:""},
          {id:"l7",name:"Cao Lầu Hội An",    category:"food",    time:"12:30",note:"Đặc sản Hội An",     plannedCost:120000,actualCost:95000, createdAt:""},
          {id:"l8",name:"Làng gốm Thanh Hà", category:"activity",time:"15:00",note:"Trải nghiệm nặn gốm",plannedCost:100000,actualCost:120000,createdAt:""},
        ]),
        mk("dy4","Ngày 4","2026-07-18"),
      ]
    },
    {
      id:"d2", name:"Sapa chinh phục Fansipan", destination:"Sapa, Lào Cai",
      startDate:"2026-10-01", endDate:"2026-10-04", budget:6000000, members:4,
      description:"Trekking cùng nhóm bạn đại học.", emoji:"⛰️",
      createdAt: new Date(Date.now()-864e5*7).toISOString(),
      days: ["2026-10-01","2026-10-02","2026-10-03","2026-10-04"]
        .map((d, i) => mk(`d2d${i}`, `Ngày ${i+1}`, d))
    },
    {
      id:"d3", name:"Hà Nội 36 phố phường", destination:"Hà Nội",
      startDate:"2025-12-20", endDate:"2025-12-22", budget:3500000, members:1,
      description:"Khám phá phố cổ dịp Giáng sinh.", emoji:"🏙️",
      createdAt: new Date(Date.now()-864e5*30).toISOString(),
      days:[
        mk("d3d0","Ngày 1","2025-12-20",[
          {id:"l9", name:"Hồ Hoàn Kiếm",          category:"landmark",time:"08:00",note:"",            plannedCost:0,    actualCost:0,    createdAt:""},
          {id:"l10",name:"Bún chả Hương Liên",     category:"food",   time:"11:00",note:"Bún chả Obama",plannedCost:80000,actualCost:75000,createdAt:""},
        ]),
        mk("d3d1","Ngày 2","2025-12-21",[
          {id:"l11",name:"Văn Miếu Quốc Tử Giám", category:"landmark",time:"09:00",note:"",              plannedCost:30000,actualCost:30000,createdAt:""},
          {id:"l12",name:"Phở Thìn Lò Đúc",       category:"food",   time:"07:00",note:"Phở bò nổi tiếng",plannedCost:60000,actualCost:65000,createdAt:""},
        ]),
        mk("d3d2","Ngày 3","2025-12-22"),
      ]
    }
  ];
  StorageManager.save(trips);
}

// Task 3.1 – Cover Image Upload helpers

/**
 * setCoverPreview(dataUrl)  — hiển thị ảnh đã chọn
 * setCoverPreview('')       — về trạng thái trống
 */
function setCoverPreview(dataUrl) {
  const preview = $id("cup-preview");
  const empty   = $id("cup-empty");
  const img     = $id("cup-img");
  const hidden  = $id("f-cover-image");
  if (!preview || !empty || !img || !hidden) return;

  if (dataUrl) {
    img.src              = dataUrl;
    hidden.value         = dataUrl;
    preview.style.display = "";
    empty.style.display   = "none";
  } else {
    img.src               = "";
    hidden.value          = "";
    preview.style.display = "none";
    empty.style.display   = "";
  }
}

// Đặt lại upload area — gọi khi mở form mới/edit
function resetCoverUpload(existingDataUrl = "") {
  const fileInput = $id("f-cover-file");
  if (fileInput) fileInput.value = "";
  setCoverPreview(existingDataUrl);
}

// Đọc file từ input/drop và hiển thị preview
function handleCoverFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("⚠️ Vui lòng chọn file ảnh (JPG, PNG, GIF, WebP)", "warn");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("⚠️ Ảnh quá lớn — tối đa 5MB", "warn");
    return;
  }
  const reader = new FileReader();
  reader.onload = e => setCoverPreview(e.target.result);
  reader.readAsDataURL(file);
}

// Khởi tạo toàn bộ events cho cover upload area
function initCoverUpload() {
  const area      = $id("cover-upload-area");
  const fileInput = $id("f-cover-file");
  const changeBtn = $id("cup-change-btn");
  const removeBtn = $id("cup-remove-btn");
  const emptyArea = $id("cup-empty");
  if (!area || !fileInput) return;

  // Click vùng empty → mở file picker
  emptyArea?.addEventListener("click", e => {
    if (e.target.closest(".cup-file-label")) return; // label tự xử lý
    fileInput.click();
  });

  // File picker change
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleCoverFile(fileInput.files[0]);
  });

  // Nút "Đổi ảnh"
  changeBtn?.addEventListener("click", () => fileInput.click());

  // Nút "Xóa ảnh"
  removeBtn?.addEventListener("click", () => {
    resetCoverUpload("");
    showToast("Đã xóa ảnh bìa", "info");
  });

  // Drag & drop
  area.addEventListener("dragover", e => {
    e.preventDefault();
    area.classList.add("cup-drag");
  });
  area.addEventListener("dragleave", () => area.classList.remove("cup-drag"));
  area.addEventListener("drop", e => {
    e.preventDefault();
    area.classList.remove("cup-drag");
    const file = e.dataTransfer.files[0];
    if (file) handleCoverFile(file);
  });
}

// INIT – Khởi động, gắn toàn bộ event listeners
document.addEventListener("DOMContentLoaded", () => {
  /**
   * FIX: Migration — xóa dữ liệu seed cũ trong key global (travel_v2) nếu có.
   *     Dữ liệu cũ đó thuộc về account demo, không phải user mới.
   */
  const OLD_KEY = "travel_v2";
  const oldRaw  = localStorage.getItem(OLD_KEY);
  if (oldRaw) {
    // Nếu có user đang login, chuyển data sang key của user đó (nếu key mới chưa có gì)
    try {
      const currentUser = Auth.getUser();
      if (currentUser) {
        const userKey   = `${OLD_KEY}__${currentUser.id}`;
        const userRaw   = localStorage.getItem(userKey);
        if (!userRaw) {
          // Chỉ migrate nếu data cũ không phải seed mẫu (có thể là data user thật đã tạo trước khi patch)
          const oldData = JSON.parse(oldRaw);
          const hasSeed = oldData.some(t => ["d1","d2","d3"].includes(t.id));
          if (!hasSeed) {
            // Data thật → migrate sang key mới
            localStorage.setItem(userKey, oldRaw);
          }
          // Dù có seed hay không, xóa key cũ
          localStorage.removeItem(OLD_KEY);
        } else {
          localStorage.removeItem(OLD_KEY);
        }
      } else {
        // Chưa login → giữ nguyên để demo account dùng
      }
    } catch(e) { /* Lỗi migration không cản init app */ }
  }
  seedData();
  seedAdminAccount();
  renderEmojiPicker();
  updateNavAuth();
  initCoverUpload();  // Task 3.1

  // ---- TASK 5.1: Khởi tạo TabLayout ----
  TabLayout.init({
    container:      "#mainTabContainer",
    personalTrips:  TripManager.getAll(),
    myBookings:     BookingManager.mine(),
    sampleTours:    SAMPLE_TOURS,
    onCreateTrip:   () => requireAuth(openNewTripForm),
    onEditTrip:     (trip) => requireAuth(() => openEditTripForm(trip.id)),
    onDeleteTrip:   (trip) => requireAuth(() => askDeleteTrip(trip.id, trip.name)),
    onBookTour:     (tour) => requireAuth(() => {
      openTourDetail(tour);
    }),
    onCloneTour:    (tour) => requireAuth(() => {
      const today = new Date().toISOString().slice(0, 10);
      const newTrip = TripManager.create({
        name:        `[Tour mẫu] ${tour.name}`,
        destination: tour.destination,
        startDate:   today,
        endDate:     today,
        budget:      tour.price || 0,
        members:     1,
        description: `Lịch trình tham khảo: ${tour.highlight || ""}`,
        emoji:        tour.coverEmoji || "🗺️",
        coverImage:  "",
      });
      showToast(`✅ Đã sao chép "${tour.name}" vào chuyến đi của bạn!`, "success");
      navigate("trip-detail", { tripId: newTrip.id });
    }),
  });

  // ---- NAV ----
  $id("nav-logo").addEventListener("click",  () => navigate("home"));
  $id("nav-home").addEventListener("click",  () => navigate("home"));
  $id("nav-dash").addEventListener("click",  () => requireAuth(() => navigate("dashboard")));
  // nav-about hidden (Task 5.3 – content moved to footer)
  // $id('nav-about').addEventListener('click', () => navigate('about'));
  $id("nav-profile").addEventListener("click", () => requireAuth(() => navigate("profile")));
  initProfileActions();
  $id("btn-new-trip").addEventListener("click", () => requireAuth(openNewTripForm));
  $id("banner-login-btn")?.addEventListener("click", () => showLoginModal());
  $id("btn-refresh-dash")?.addEventListener("click", renderDashboard);

  // ---- Form tạo / sửa chuyến đi ----
  $id("form-trip").addEventListener("submit", handleTripSubmit);
  ["f-guide", "f-guide-hours", "f-start", "f-end"].forEach(id => $id(id)?.addEventListener("change", updateGuideCost));
  $id("back-from-form").addEventListener("click",   () => navigate("home"));
  $id("cancel-trip-form").addEventListener("click", () => navigate("home"));

  // FIX 2: Sync ngày kết thúc min khi thay đổi ngày khởi hành
  $id("f-start").addEventListener("change", e => {
    $id("f-end").min = e.target.value || todayStr();
  });

  // ---- Emoji picker ----
  $id("emoji-grid").addEventListener("click", e => {
    const opt = e.target.closest(".emoji-opt");
    if (!opt) return;
    AppState.emoji = opt.dataset.emoji;
    $id("f-emoji").value = AppState.emoji;
    document.querySelectorAll(".emoji-opt").forEach(el =>
      el.classList.toggle("sel", el.dataset.emoji === AppState.emoji)
    );
  });

  // ---- Tabs ----
  $id("tab-it").addEventListener("click",  () => switchTab("itinerary"));
  $id("tab-bud").addEventListener("click", () => switchTab("budget"));

  // ---- Back buttons ----
  $id("back-to-home").addEventListener("click",   () => navigate("home"));
  $id("back-to-detail").addEventListener("click", () => navigate("trip-detail"));

  // ---- Form thêm / sửa địa điểm ----
  $id("form-loc").addEventListener("submit", handleLocSubmit);
  $id("cancel-loc-form").addEventListener("click", () => navigate("trip-detail"));

  // TASK 1.3: Setup number formatters – truyền errId để tự xóa lỗi khi người dùng sửa
  setupNumInput("f-budget",   { errId: "e-budget"   });
  setupNumInput("f-members",  {});
  setupNumInput("lf-planned", { errId: "le-planned" });
  setupNumInput("lf-actual",  { errId: "le-actual"  });

  // ---- Search / filter ----
  $id("search-q").addEventListener("input",       renderHome);
  $id("filter-status").addEventListener("change", renderHome);
  $id("sort-by").addEventListener("change",       renderHome);

  // ---- Keyboard events (ES6+) ----
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeConfirmModal();
      closeLogoutModal();
      $id("modal-login").classList.remove("open");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (AppState.page === "home") { $id("search-q").focus(); $id("search-q").select(); }
    }
    if (e.key === "Enter" && document.activeElement === $id("search-q")) renderHome();
  });

  // ---- Confirm (xóa) modal ----
  $id("mc-ok").addEventListener("click", () => { AppState.confirmCb?.(); closeConfirmModal(); });
  $id("mc-cancel").addEventListener("click", closeConfirmModal);
  $id("mc-close").addEventListener("click",  closeConfirmModal);
  $id("modal-confirm").addEventListener("click", e => { if (e.target === e.currentTarget) closeConfirmModal(); });

  // ---- FIX: Logout modal (thay confirm() bị sandbox chặn) ----
  $id("logout-confirm-btn").addEventListener("click", () => {
    Auth.logout();
    closeLogoutModal();
    updateNavAuth();
    navigate("home");
    showToast("Đã đăng xuất!", "info");
  });
  $id("logout-cancel").addEventListener("click",  closeLogoutModal);
  $id("logout-close").addEventListener("click",   closeLogoutModal);
  $id("modal-logout").addEventListener("click", e => { if (e.target === e.currentTarget) closeLogoutModal(); });

  // ---- Login modal ----
  // Google Sign-In: init button khi GSI script load xong
  if (typeof google !== "undefined" && google.accounts) {
    initGoogleSignInBtn();
  } else {
    // Chờ script GSI load xong (async)
    window.addEventListener("load", () => {
      // Thêm timeout nhỏ để GSI kịp parse
      setTimeout(initGoogleSignInBtn, 300);
    });
  }
  window.addEventListener("resize", () => {
    if ($id("modal-login")?.classList.contains("open")) requestAnimationFrame(initGoogleSignInBtn);
  });

  // Facebook – vẫn chờ App ID
  $id("btn-fb-login").setAttribute("data-tooltip", "Chờ tích hợp Facebook App ID");
  $id("btn-fb-login").addEventListener("click", showFbPending);

  // Đăng nhập + đăng ký bằng email
  $id("btn-do-login").addEventListener("click",    doEmailLogin);
  $id("btn-do-register").addEventListener("click", doRegister);
  $id("btn-verify-otp")?.addEventListener("click", verifyOtpAndRegister);
  $id("btn-resend-otp")?.addEventListener("click", resendOtp);
  $id("btn-back-to-register")?.addEventListener("click", resetRegisterPanel);
  // Enter trong ô OTP → xác nhận luôn
  $id("otp-input")?.addEventListener("keydown", e => { if (e.key === "Enter") verifyOtpAndRegister(); });
  // Chỉ cho nhập số vào ô OTP
  $id("otp-input")?.addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  });

  // Enter trong form đăng nhập
  ["li-email","li-pass"].forEach(id =>
    $id(id)?.addEventListener("keydown", e => { if (e.key === "Enter") doEmailLogin(); })
  );
  // Enter trong form đăng ký
  ["reg-name","reg-email","reg-pass","reg-pass2"].forEach(id =>
    $id(id)?.addEventListener("keydown", e => { if (e.key === "Enter") doRegister(); })
  );

  // Tab chuyển giữa Đăng nhập / Đăng ký
  $id("tab-login-btn").addEventListener("click", () => switchAuthTab("login"));
  $id("tab-register-btn").addEventListener("click", () => switchAuthTab("register"));

  // Toggle hiện/ẩn mật khẩu
  document.querySelectorAll(".pass-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = $id(btn.dataset.target);
      if (!target) return;
      target.type = target.type === "password" ? "text" : "password";
      btn.textContent = target.type === "password" ? "👁" : "🙈";
    });
  });

  // Đóng modal khi click nền mờ hoặc nút ✕
  $id("login-close-btn")?.addEventListener("click", () => $id("modal-login").classList.remove("open"));
  $id("modal-login").addEventListener("click", e => { if (e.target === e.currentTarget) $id("modal-login").classList.remove("open"); });

  // ---- Form liên hệ ----
  $id("form-contact").addEventListener("submit", e => {
    e.preventDefault();
    const d = {
      name:    $id("cf-name").value,
      email:   $id("cf-email").value,
      phone:   $id("cf-phone").value,
      message: $id("cf-msg").value
    };
    if (!Validator.validateContact(d)) return;

    // Lưu phản hồi để Admin xem ở tab "Phản hồi"
    try {
      const FB_KEY = "travel_feedback_v1";
      const list   = JSON.parse(localStorage.getItem(FB_KEY) || "[]");
      const u      = (typeof Auth !== "undefined" && Auth.getUser) ? Auth.getUser() : null;
      list.unshift({
        id:        "fb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        name:      d.name.trim(),
        email:     d.email.trim(),
        phone:     (d.phone || "").trim(),
        topic:     $id("cf-topic")?.value || "feedback",
        message:   d.message.trim(),
        status:    "new",
        userId:    u?.id || null,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(FB_KEY, JSON.stringify(list));
    } catch (err) { console.error("Lưu phản hồi lỗi:", err); }
    ["cf-name","cf-email","cf-phone","cf-msg"].forEach(id => { const el = $id(id); if (el) el.value = ""; });

    $id("form-contact").style.display = "none";
    $id("contact-success").classList.add("show");
    showToast("Phản hồi đã được gửi!", "success");
  });

  navigate("home");

  // NAV: Trang mới (Tasks 4.2, 4.3, 4.4, 5.2)
  let _wmInited = false;

  function _initWMSafe() {
    // Đợi browser paint xong rồi mới init Leaflet để tránh 0×0 size
    requestAnimationFrame(() => {
      setTimeout(() => {
        const container = $id("wm-map-container");
        if (!container) return;

        if (!_wmInited) {
          WorldMap.initWorldMap("wm-map-container");
          initWorldMapSearch();
          if (window.WorldTours) WorldTours.init();   // 8.6–8.8: dropdown quốc gia + danh sách tour
          _wmInited = true;

          // invalidateSize sau 200ms để chắc chắn layout đã tính xong
          setTimeout(() => {
            const inst = WorldMap.getMapInstance();
            if (inst) inst.invalidateSize();
          }, 200);

          // Mặc định zoom vào Việt Nam
          const vietnam = WorldMap.countries.find(c => c.name === "Việt Nam");
          if (vietnam) {
            setTimeout(() => WorldMap.focusCountry(vietnam), 400);
          }
        } else {
          // Đã init: invalidate 2 lần để chắc chắn tile re-render
          const inst = WorldMap.getMapInstance();
          if (inst) {
            inst.invalidateSize();
            setTimeout(() => inst.invalidateSize(), 200);
          }
        }
      }, 50);
    });
  }

  $id("nav-world-map")?.addEventListener("click", () => {
    navigate("world-map");
    _initWMSafe();
  });

  let _tfMapInited = false;
  $id("nav-tour-finder")?.addEventListener("click", () => {
    navigate("tour-finder");
    // FIX: Khởi tạo bản đồ Việt Nam ngay khi mở trang, không cần chờ search
    setTimeout(() => {
      if (!_tfMapInited) {
        TourMap.initMap("tf-map-container");
        _tfMapInited = true;
        // Ẩn placeholder vì đã có bản đồ thật
        const ph = $id("tf-map-placeholder");
        if (ph) ph.style.display = "none";
      } else {
        const inst = TourMap.getMapInstance ? TourMap.getMapInstance() : null;
        if (inst) inst.invalidateSize();
      }
    }, 120);
  });

  $id("nav-hotel-search")?.addEventListener("click", () => {
    navigate("hotel-search");
    // Đặt ngày mặc định
    const today = new Date();
    const fmt = d => d.toISOString().split("T")[0];
    const plus = n => { const d = new Date(today); d.setDate(d.getDate()+n); return d; };
    const flD = $id("hfs-fl-depart"); if (flD && !flD.value) flD.value = fmt(plus(7));
    const htCI = $id("hfs-ht-checkin"); if (htCI && !htCI.value) htCI.value = fmt(plus(7));
    const htCO = $id("hfs-ht-checkout"); if (htCO && !htCO.value) htCO.value = fmt(plus(10));
  });

  $id("nav-food")?.addEventListener("click", () => {
    navigate("food");
    if (!document.getElementById("food-root").innerHTML) FoodModule.render("food-root");
  });

  $id("nav-admin")?.addEventListener("click", () => navigate("admin"));

  // Sync tour data từ localStorage về SAMPLE_TOURS runtime khi app khởi động
  Admin.ensureToursSeeded();
  Admin._syncToursRuntime();
  // Tour mẫu mặc định lấy từ data/tours/*.json → khi nạp xong thì gộp vào và vẽ lại tab Tour mẫu
  Admin.toursReady.then(() => {
    Admin.ensureToursSeeded();
    Admin._syncToursRuntime();
    if (typeof TabLayout !== "undefined") TabLayout.refresh({});
  });

  // TOUR FINDER events: do js/tour-finder.js (TourFinder) đảm nhiệm, gọi TourSearch.find

  // HOTEL & FLIGHT events
  $id("hfs-fl-btn")?.addEventListener("click", async () => {
    const from = $id("hfs-fl-from")?.value.trim();
    const to   = $id("hfs-fl-to")?.value.trim();
    const depart = $id("hfs-fl-depart")?.value;
    if (!from || !to) { showToast("Vui lòng nhập điểm đi và điểm đến.", "warn"); return; }
    if (!depart) { showToast("Vui lòng chọn ngày đi.", "warn"); return; }
    $id("hfs-loading").style.display = "block";
    $id("hfs-results").innerHTML = "";
    try {
      await HotelFlightSearch.searchFlights({ from, to, depart, pax: $id("hfs-fl-pax")?.value||"1", cabin: $id("hfs-fl-class")?.value||"economy" }, "hfs-results");
    } catch { showToast("❌ Lỗi tìm kiếm. Vui lòng thử lại.", "error"); }
    $id("hfs-loading").style.display = "none";
  });

  $id("hfs-ht-btn")?.addEventListener("click", async () => {
    const dest = $id("hfs-ht-dest")?.value.trim();
    const checkin = $id("hfs-ht-checkin")?.value;
    const checkout = $id("hfs-ht-checkout")?.value;
    if (!dest) { showToast("Vui lòng nhập điểm đến.", "warn"); return; }
    if (!checkin || !checkout) { showToast("Vui lòng chọn ngày nhận và trả phòng.", "warn"); return; }
    if (new Date(checkout) <= new Date(checkin)) { showToast("Ngày trả phòng phải sau ngày nhận phòng.", "warn"); return; }
    $id("hfs-loading").style.display = "block";
    $id("hfs-results").innerHTML = "";
    try {
      await HotelFlightSearch.searchHotels({ dest, checkin, checkout, guests: $id("hfs-ht-guests")?.value||"1", stars: $id("hfs-ht-stars")?.value||"any" }, "hfs-results");
    } catch { showToast("❌ Lỗi tìm kiếm. Vui lòng thử lại.", "error"); }
    $id("hfs-loading").style.display = "none";
  });

  // IMPORT module integration
  if (window.ImportModule) {
    ImportModule.onImportSuccess = function(tripData) {
      navigate("create-trip");
      setTimeout(() => {
        // Map tripData keys -> actual form field IDs in Travel
        const fieldMap = [
          { key: "name",        id: "f-name" },
          { key: "destination", id: "f-dest" },
          { key: "startDate",   id: "f-start" },
          { key: "endDate",     id: "f-end" },
          { key: "budget",      id: "f-budget" },
          { key: "notes",       id: "f-desc" },
        ];
        fieldMap.forEach(({ key, id }) => {
          const el = document.getElementById(id);
          const val = tripData[key];
          if (el && val != null) {
            el.value = String(key === "budget" ? Number(val).toLocaleString("vi-VN") : val);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        // Highlight fields còn thiếu
        const required = [
          { key:"name", id:"f-name", label:"Tên chuyến đi" },
          { key:"destination", id:"f-dest", label:"Điểm đến" },
          { key:"startDate", id:"f-start", label:"Ngày khởi hành" },
          { key:"endDate", id:"f-end", label:"Ngày kết thúc" },
          { key:"budget", id:"f-budget", label:"Ngân sách" },
        ];
        const missing = required.filter(f => {
          const v = tripData[f.key];
          return v === null || v === undefined || String(v).trim() === "";
        });
        missing.forEach(({ id, label }) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.style.borderColor = "#f97316";
          el.style.boxShadow = "0 0 0 3px rgba(249,115,22,0.2)";
          let hint = el.nextElementSibling;
          if (hint && hint.classList.contains("import-hint")) hint.remove();
          const h = document.createElement("div");
          h.className = "import-hint";
          h.style.cssText = "font-size:.78rem;color:#c2410c;margin-top:3px;padding:3px 8px;background:#fff7ed;border-radius:5px;";
          h.textContent = `⚠ Thiếu ${label} — vui lòng bổ sung`;
          el.parentNode.insertBefore(h, el.nextSibling);
          el.addEventListener("input", function() {
            el.style.borderColor = ""; el.style.boxShadow = "";
            document.querySelectorAll(".import-hint").forEach(n => n.remove());
          }, { once: true });
        });
        if (missing.length === 0) showToast("✅ Import thành công! Kiểm tra và tạo chuyến đi.", "success");
        else showToast(`⚠ Import xong. Còn thiếu ${missing.length} trường — vui lòng bổ sung.`, "warn");
      }, 300);
    };
  }

  // CHATBOT
  Chatbot.init();
});

// WORLD MAP SEARCH helper
function initWorldMapSearch() {
  const input = $id("wm-search");
  const dd = $id("wm-dropdown");
  if (!input || !dd) return;
  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) { dd.innerHTML = ""; dd.style.display = "none"; return; }
    const results = WorldMap.searchCountry(q);
    if (!results.length) { dd.innerHTML = '<div style="padding:10px;color:#94a3b8;font-size:.85rem;">Không tìm thấy</div>'; dd.style.display = "block"; return; }
    dd.innerHTML = results.map(c => `<div class="wm-dd-item" onclick="WorldMap.focusCountry(WorldMap.countries.find(x=>x.name==='${c.name}'));document.getElementById('wm-search').value='${c.flag} ${c.name}';document.getElementById('wm-dropdown').style.display='none'">${c.flag} ${c.name} <small style="color:#64748b">${c.capital}</small></div>`).join("");
    dd.style.display = "block";
  });
  document.addEventListener("click", e => { if (!$id("wm-search-wrap")?.contains(e.target)) { dd.style.display = "none"; } });
}

// HOTEL/FLIGHT TAB SWITCH
function switchHFSTab(tab) {
  $id("hfs-form-flight").style.display = tab === "flight" ? "" : "none";
  $id("hfs-form-hotel").style.display  = tab === "hotel"  ? "" : "none";
  $id("hfs-tab-flight").classList.toggle("active", tab === "flight");
  $id("hfs-tab-hotel").classList.toggle("active",  tab === "hotel");
  $id("hfs-results").innerHTML = "";
  $id("hfs-loading").style.display = "none";
}

/**
 * TOUR DETAIL MODAL + BOOKING FORM
 * FIX: Thay thế toast "sắp ra mắt" bằng modal chi tiết + đặt tour thật
 */

function ensureTdmStyles() {
  if (!$id("tdm-styles")) {
    const st = document.createElement("style");
    st.id = "tdm-styles";
    st.textContent = `
      #tour-detail-modal { position:fixed;inset:0;z-index:9000;display:flex;align-items:flex-end;justify-content:center; }
      .tdm-backdrop { position:absolute;inset:0;background:rgba(13,33,55,.62); }
      .tdm-sheet { position:relative;background:#f5f3ee;color:#0d2137;border:1px solid rgba(13,33,55,.18);border-top:4px dotted rgba(13,33,55,.3);border-radius:2px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;padding:28px 24px 32px;box-shadow:0 16px 42px rgba(13,33,55,.24); }
      .tdm-close { position:absolute;top:16px;right:16px;background:#e9e5dc;border:1px solid rgba(13,33,55,.24);color:#0d2137;font-size:1rem;width:36px;height:36px;border-radius:2px;cursor:pointer;display:flex;align-items:center;justify-content:center; }
      .tdm-header { display:flex;gap:16px;align-items:flex-start;margin-bottom:20px;padding-bottom:18px;border-bottom:1px dotted rgba(13,33,55,.35); }
      .tdm-emoji { font-size:3rem;line-height:1; }
      .tdm-dest { font-size:.78rem;color:#596575;font-weight:700;letter-spacing:.5px;text-transform:uppercase; }
      .tdm-name { font-size:1.3rem;font-weight:700;color:#0d2137;margin:4px 0 8px; }
      .tdm-meta { display:flex;flex-wrap:wrap;gap:10px;font-size:.8rem;color:#435267; }
      .tdm-tags { display:flex;flex-wrap:wrap;gap:6px;margin-top:8px; }
      .tdm-tag { background:#e4e8eb;color:#0d2137;font-size:.72rem;padding:3px 8px;border-radius:2px;border:1px solid rgba(13,33,55,.18); }
      .tdm-section { margin-bottom:18px; }
      .tdm-section-title { font-size:.78rem;font-weight:700;color:#596575;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px; }
      .tdm-highlight { font-size:.9rem;color:#26384d;line-height:1.6; }
      .tdm-itinerary { display:flex;flex-direction:column;gap:8px; }
      .tdm-itin-toggle-wrap { margin:18px 0 0;padding-top:16px;border-top:1px dotted rgba(13,33,55,.35); }
      .tdm-itin-toggle { width:100%;display:flex;justify-content:space-between;align-items:center;background:#e9e5dc;color:#0d2137;border:1px solid rgba(13,33,55,.24);border-radius:2px;padding:12px 16px;font-size:.92rem;font-weight:700;cursor:pointer; }
      .tdm-itin-toggle[aria-expanded="true"] .tdm-itin-arrow { transform:rotate(180deg); }
      .tdm-itin-arrow { transition:transform .2s; }
      .tdm-hdv-box { background:#efede6;border:1px solid rgba(13,33,55,.2);border-radius:2px;padding:10px 12px;font-size:.85rem;color:#26384d; }
      .tdm-summary { background:#efede6;border-left:3px solid #b3261e;border-radius:2px;padding:12px 14px;font-size:.85rem;color:#26384d;line-height:1.8;margin-bottom:14px; }
      .tdm-summary b { color:#a3221c; }
      .tdm-itin-day { background:#efede6;border-left:2px dotted rgba(13,33,55,.4);border-radius:2px;padding:10px 14px;font-size:.85rem;color:#26384d; }
      .tdm-itin-day b { color:#0d2137; }
      .tdm-includes-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
      .tdm-list { list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px;font-size:.83rem;color:#435267; }
      .tdm-list li::before { content:'✔ ';color:#286244; }
      .tdm-list--no li::before { color:#b3261e;content:'✘ '; }
      .tdm-footer { display:flex;align-items:center;justify-content:space-between;padding:18px 0 0;border-top:1px dotted rgba(13,33,55,.35);margin-top:4px;flex-wrap:wrap;gap:12px; }
      .tdm-price-block { display:flex;align-items:baseline;gap:6px; }
      .tdm-price-label { font-size:.78rem;color:#596575; }
      .tdm-price-value { font-size:1.5rem;font-weight:800;color:#0d2137; }
      .tdm-price-unit { font-size:.78rem;color:#596575; }
      .tdm-btn-book { background:#0d2137;color:#f5f3ee;border:1px solid #0d2137;padding:12px 28px;border-radius:2px;font-size:.95rem;font-weight:700;cursor:pointer; }
      .tdm-btn-book:hover { background:#26384d; }
      .tdm-booking-form { background:#efede6;border:1px solid rgba(13,33,55,.18);border-top:3px dotted rgba(13,33,55,.3);border-radius:2px;padding:20px;margin-top:18px; }
      .tdm-form-row { display:flex;flex-direction:column;gap:5px;margin-bottom:14px; }
      .tdm-form-row label { font-size:.8rem;color:#435267;font-weight:600; }
      .tdm-input { background:#fbfaf6;border:1px solid rgba(13,33,55,.28);border-radius:2px;padding:9px 12px;color:#0d2137;font-size:.9rem;outline:none; }
      .tdm-input:focus { border-color:#0d2137;box-shadow:0 0 0 2px rgba(13,33,55,.1); }
      .tdm-textarea { resize:vertical;min-height:70px; }
      .tdm-booking-actions { display:flex;gap:10px;justify-content:flex-end;margin-top:8px; }
      .tdm-btn-cancel { background:transparent;color:#26384d;border:1px solid rgba(13,33,55,.28);padding:10px 20px;border-radius:2px;cursor:pointer;font-size:.88rem; }
      .tdm-btn-confirm { background:#b3261e;color:#fff;border:1px solid #b3261e;padding:10px 24px;border-radius:2px;font-size:.88rem;font-weight:700;cursor:pointer; }
      .tdm-btn-confirm:hover { background:#921d18; }
      /* Rich itinerary for self tours */
      .tdm-itin-day--rich { background:#efede6;border-left:2px dotted rgba(13,33,55,.4);border-radius:2px;padding:12px 14px;margin-bottom:8px; }
      .tdm-itin-day-title { font-size:.85rem;font-weight:700;color:#0d2137;margin-bottom:8px; }
      .tdm-itin-items { display:flex;flex-direction:column;gap:6px; }
      .tdm-itin-item { display:flex;gap:10px;font-size:.82rem;color:#26384d;line-height:1.5; }
      .tdm-itin-time { color:#a3221c;font-weight:700;min-width:44px;flex-shrink:0; }
      /* Price block for self tours */
      .tdm-price-self-block { display:flex;flex-direction:column;gap:4px; }
      .tdm-price-row { display:flex;align-items:baseline;gap:6px;flex-wrap:wrap; }
      .tdm-guide-fee-hint { font-size:.8rem;color:#596575;margin-top:2px; }
      /* Footer buttons */
      .tdm-footer-btns { display:flex;gap:10px;flex-wrap:wrap;align-items:center; }
      .tdm-btn-guide { background:#b3261e;color:#fff;border:1px solid #b3261e;padding:12px 20px;border-radius:2px;font-size:.9rem;font-weight:700;cursor:pointer; }
      .tdm-btn-guide:hover { background:#921d18; }
      @media(max-width:480px){.tdm-includes-grid{grid-template-columns:1fr}.tdm-footer{flex-direction:column;align-items:stretch;text-align:center}.tdm-footer-btns{flex-direction:column}.tdm-btn-book,.tdm-btn-guide{width:100%;text-align:center}}`;

    document.head.appendChild(st);
  }
}

function openTourDetail(tour, opts) {
  // Xóa modal cũ nếu có
  const old = $id("tour-detail-modal");
  if (old) old.remove();

  const fmt = n => n ? new Intl.NumberFormat("vi-VN").format(n) + " ₫" : "Miễn phí";
  const tags = (tour.tags || []).map(t => `<span class="tdm-tag">${t}</span>`).join("");

  // Lịch trình mẫu theo điểm đến
  const itinerary = buildSampleItinerary(tour);

  const modal = document.createElement("div");
  modal.id = "tour-detail-modal";
  modal.innerHTML = `
    <div class="tdm-backdrop"></div>
    <div class="tdm-sheet" role="dialog" aria-label="Chi tiết tour">
      <button class="tdm-close" aria-label="Đóng">✕</button>

      <!-- Ảnh bìa -->
      <div class="tdm-hero" id="tdm-hero" data-tour-img data-tour-id="${tour.id}"><span class="tdm-hero-credit">Ảnh: Wikipedia</span></div>

      <!-- Header -->
      <div class="tdm-header">
        <div class="tdm-emoji">${tour.coverEmoji || "🗺️"}</div>
        <div>
          <div class="tdm-dest">${tour.destination}</div>
          <h2 class="tdm-name">${tour.name}</h2>
          <div class="tdm-meta">
            <span>⏱ ${tour.duration}</span>
            <span>👥 ${tour.groupSize}</span>
            <span>⚡ ${tour.difficulty}</span>
          </div>
          ${tags ? `<div class="tdm-tags">${tags}</div>` : ""}
        </div>
      </div>

      <!-- Highlights -->
      <div class="tdm-section">
        <div class="tdm-section-title">✨ Điểm nổi bật</div>
        <div class="tdm-highlight">${tour.highlight || ""}</div>
      </div>

      <!-- Thời tiết điểm đến (Open-Meteo) -->
      <div class="tdm-section">
        <div class="tdm-section-title">🌤️ Thời tiết điểm đến</div>
        <div class="wx-box" id="tdm-weather" aria-live="polite"></div>
      </div>

      <!-- Vị trí điểm đến (Leaflet) -->
      <div class="tdm-section">
        <div class="tdm-section-title">📍 Vị trí trên bản đồ</div>
        <div class="tlm-map" id="tdm-map" role="region" aria-label="Bản đồ vị trí tour"></div>
        <div class="tlm-note" id="tdm-map-note"></div>
      </div>

      <!-- Bao gồm -->
      <div class="tdm-section tdm-includes-grid">
        <div>
          <div class="tdm-section-title">✅ Bao gồm</div>
          <ul class="tdm-list">
            ${(tour.includes && tour.includes.length) ? tour.includes.map(x => `<li>${x}</li>`).join("") : tour.type !== "self"
              ? `<li>Xe đưa đón sân bay</li>
                 <li>Khách sạn tiêu chuẩn</li>
                 <li>Hướng dẫn viên tiếng Việt</li>
                 <li>Bảo hiểm du lịch</li>
                 <li>Bữa ăn theo chương trình</li>`
              : `<li>Lịch trình chi tiết theo ngày</li>
                 <li>Gợi ý ăn uống & tham quan</li>
                 <li>Ước tính chi phí từng điểm</li>
                 <li>Linh hoạt sắp xếp theo ý thích</li>`
            }
          </ul>
        </div>
        <div>
          <div class="tdm-section-title">❌ Không bao gồm</div>
          <ul class="tdm-list tdm-list--no">
            ${(tour.excludes && tour.excludes.length) ? tour.excludes.map(x => `<li>${x}</li>`).join("") : tour.type !== "self"
              ? `<li>Vé máy bay (nếu cần)</li>
                 <li>Chi phí cá nhân</li>
                 <li>Đồ uống trong bữa ăn</li>`
              : `<li>Vé máy bay / xe khách</li>
                 <li>Khách sạn (tự đặt)</li>
                 <li>Hướng dẫn viên (có thể thuê thêm)</li>
                 <li>Bảo hiểm du lịch</li>`
            }
          </ul>
        </div>
      </div>

      <!-- Footer: giá + nút đặt -->
      <div class="tdm-footer">
        ${tour.type === "self"
          ? `<div class="tdm-price-self-block">
               <div class="tdm-price-row">
                 <span class="tdm-price-label">💰 Chi phí tự túc ước tính</span>
                 <span class="tdm-price-value" style="color:#10b981">${fmt(tour.price)}</span>
                 <span class="tdm-price-unit">/người</span>
               </div>
               <div class="tdm-guide-fee-hint">🧑‍✈️ Thuê HDV nội địa: <b style="color:#f59e0b">${fmt(GUIDE_DAY_FEE)}</b>/ngày (8 tiếng), thêm giờ phụ thu</div>
             </div>`
          : `<div class="tdm-price-block">
               <span class="tdm-price-label">Giá từ</span>
               <span class="tdm-price-value">${fmt(tour.price)}</span>
               <span class="tdm-price-unit">/người</span>
             </div>`
        }
        <div class="tdm-footer-btns">
          <button class="tdm-btn-book" id="tdm-btn-open-booking">
            ${tour.type !== "self" ? "📋 Đặt tour ngay" : "📋 Đặt tour"}
          </button>

        </div>
      </div>

      <!-- Form đặt tour (ẩn ban đầu) -->
      <div class="tdm-booking-form" id="tdm-booking-form" style="display:none">
        <div class="tdm-section-title" style="margin-bottom:12px">📋 Thông tin đặt tour</div>
        <div class="tdm-form-row">
          <label>Họ và tên *</label>
          <input id="tdm-f-name" type="text" placeholder="Nguyễn Văn An" class="tdm-input">
        </div>
        <div class="tdm-form-row">
          <label>Số điện thoại *</label>
          <input id="tdm-f-phone" type="tel" placeholder="0901 234 567" maxlength="13" inputmode="tel" class="tdm-input">
        </div>
        <div class="tdm-form-row">
          <label>Email</label>
          <input id="tdm-f-email" type="email" placeholder="tenban@gmail.com" class="tdm-input">
        </div>
        <div class="tdm-form-row">
          <label>Ngày khởi hành *</label>
          <input id="tdm-f-date" type="date" class="tdm-input" min="${ngaySomNhatDangKy()}">
          <span style="font-size:.74rem;color:#94a3b8">Phải đăng ký trước ngày đi ít nhất ${BOOKING_MIN_DAYS} ngày (từ ${ngaySomNhatDangKy().split("-").reverse().join("/")} trở đi)</span>
        </div>
        <div class="tdm-form-row">
          <label>Số người lớn (từ ${CHILD_HALF_UNDER} tuổi)</label>
          <input id="tdm-f-pax" type="number" min="1" max="50" value="2" class="tdm-input">
        </div>
        <div class="tdm-form-row">
          <label>Trẻ em ${CHILD_FREE_UNDER}–${CHILD_HALF_UNDER - 1} tuổi (tính ${CHILD_HALF_RATE * 100}% giá tour)</label>
          <input id="tdm-f-kids" type="number" min="0" max="50" value="0" class="tdm-input">
        </div>
        <div class="tdm-form-row">
          <label>Trẻ dưới ${CHILD_FREE_UNDER} tuổi (miễn phí, ngủ chung với bố mẹ)</label>
          <input id="tdm-f-infants" type="number" min="0" max="50" value="0" class="tdm-input">
          <span style="font-size:.74rem;color:#94a3b8">Miễn phí tối đa 1 bé/người lớn. Bé thứ 2 trở lên của cùng người lớn tính như trẻ ${CHILD_FREE_UNDER}–${CHILD_HALF_UNDER - 1} tuổi.</span>
        </div>
        ${tour.type === "self" ? `
        <div class="tdm-form-row">
          <label class="tdm-hdv-box" style="display:flex;gap:8px;align-items:center;cursor:pointer">
            <input type="checkbox" id="tdm-f-hdv"> 🧑‍✈️ Thuê HDV nội địa (1.500.000 ₫/ngày – 8 tiếng)
          </label>
          <select id="tdm-f-hdv-hours" class="tdm-input" style="display:none">
            <option value="8">8 tiếng/ngày (giá chuẩn)</option><option value="9">9 tiếng/ngày (+200.000 ₫/ngày)</option>
            <option value="10">10 tiếng/ngày (+400.000 ₫/ngày)</option><option value="11">11 tiếng/ngày (+600.000 ₫/ngày)</option>
            <option value="12">12 tiếng/ngày (+800.000 ₫/ngày)</option>
          </select>
        </div>` : ""}
        <div class="tdm-form-row" id="tdm-guide-row" style="display:none">
          <label for="tdm-f-guide">🧑‍✈️ Chọn hướng dẫn viên</label>
          <select id="tdm-f-guide" class="tdm-input"><option value="">— Để công ty sắp xếp giúp —</option></select>
          <span id="tdm-guide-msg" style="font-size:.74rem;color:#94a3b8"></span>
        </div>
        <div class="tdm-form-row" id="tdm-voucher-row">
          <label>🎟️ Mã giảm giá (voucher)</label>
          <div class="vc-apply">
            <input id="tdm-f-voucher" type="text" class="tdm-input" placeholder="Nhập mã hoặc chọn voucher bên dưới" autocomplete="off" spellcheck="false">
            <button type="button" class="tdm-btn-cancel" id="tdm-voucher-apply">Áp dụng</button>
          </div>
          <div class="vc-chips" id="tdm-voucher-list"></div>
          <span class="vc-msg" id="tdm-voucher-msg"></span>
        </div>
        <div class="tdm-summary" id="tdm-summary"></div>
        <div class="tdm-form-row">
          <label>Ghi chú thêm</label>
          <textarea id="tdm-f-note" class="tdm-input tdm-textarea" placeholder="Yêu cầu đặc biệt, dị ứng thức ăn..."></textarea>
        </div>
        <div class="tdm-booking-actions">
          <button class="tdm-btn-cancel" id="tdm-btn-cancel-booking">Huỷ</button>
          <button class="tdm-btn-confirm" id="tdm-btn-confirm-booking">✅ Xác nhận đặt tour</button>
        </div>
      </div>

      <!-- Xem lịch trình (dưới cùng): bấm để mở toàn bộ lịch trình trước khi đặt -->
      <div class="tdm-section tdm-itin-toggle-wrap">
        <button type="button" class="tdm-itin-toggle" id="tdm-itin-toggle" aria-expanded="false">
          <span>🗓️ Xem lịch trình</span><span class="tdm-itin-arrow">▾</span>
        </button>
        <div class="tdm-itinerary" id="tdm-itin-panel" style="display:none;margin-top:10px">${itinerary}</div>
      </div>
    </div>`;

  ensureTdmStyles();

  document.body.appendChild(modal);
  if (typeof TourImages !== "undefined") TourImages.attach(modal.querySelector("#tdm-hero"), tour);
  if (window.Weather) Weather.renderWeather(modal.querySelector("#tdm-weather"), tour.id);
  else modal.querySelector("#tdm-weather").textContent = "Chưa có dữ liệu thời tiết";
  if (window.TourLocationMap) TourLocationMap.renderMap(modal.querySelector("#tdm-map"), tour.id);

  // Events
  modal.querySelector(".tdm-backdrop").addEventListener("click", () => modal.remove());
  modal.querySelector(".tdm-close").addEventListener("click", () => modal.remove());

  // Xem lịch trình (dưới cùng)
  $id("tdm-itin-toggle").addEventListener("click", () => {
    const panel = $id("tdm-itin-panel"), btn = $id("tdm-itin-toggle");
    const open = panel.style.display === "none";
    panel.style.display = open ? "" : "none";
    btn.setAttribute("aria-expanded", String(open));
  });

  // Tính tiền: giá tour × số người (+ HDV nếu thuê) và tiền đặt cọc (DEPOSIT_PCT%)
  const tourDays = parseInt(tour.duration) || 1;
  let appliedVoucher = null;                                // voucher đã áp (kết quả /api/vouchers/validate)
  const calcBooking = () => {
    const adultsIn = $id("tdm-f-pax")?.value, kidsIn = $id("tdm-f-kids")?.value, infIn = $id("tdm-f-infants")?.value;
    const hdvOn = !!$id("tdm-f-hdv")?.checked;
    const hours = +($id("tdm-f-hdv-hours")?.value) || GUIDE_DAY_HOURS;
    // Công thức giá nằm ở shared/pricing.js — cùng file server dùng để tính giá thật khi tạo đơn
    const r = Pricing.compute({ price: tour.price, adults: adultsIn, kids: kidsIn, infants: infIn, hdvOn, hdvHours: hours, days: tourDays, voucher: appliedVoucher });
    return { pax: r.pax, adults: r.adults, kids: r.kids, infants: r.infants, hdvOn, hours, hdv: r.hdv, base: r.base,
             subtotal: r.subtotal, discount: r.discount, total: r.final, deposit: r.deposit, bd: r };
  };
  const refreshSummary = () => {
    const c = calcBooking();
    const hdvInc = tour.type !== "self" ? " (đã gồm HDV)" : "";
    $id("tdm-summary").innerHTML =
      `Giá tour${hdvInc}: ${fmt(c.base)} (${c.adults} người lớn${c.kids ? `, ${c.kids} trẻ ${CHILD_FREE_UNDER}–${CHILD_HALF_UNDER - 1} tuổi × 50%` : ""}${c.infants ? `, ${c.infants} bé dưới ${CHILD_FREE_UNDER} tuổi miễn phí` : ""})<br>` +
      (c.hdvOn ? `🧑‍✈️ Phí HDV nội địa: ${fmt(c.hdv)} (${tourDays} ngày × ${c.hours} tiếng)<br>` : "") +
      (c.discount ? `Tạm tính: ${fmt(c.subtotal)}<br>🎟️ Voucher ${appliedVoucher.code}: <b style="color:#10b981">−${fmt(c.discount)}</b><br>` : "") +
      `${c.discount ? "Giá cuối" : "Tổng cộng"}: <b>${fmt(c.total)}</b><br>Đặt cọc chuyển khoản ${DEPOSIT_PCT}%: <b>${fmt(c.deposit)}</b>`;
  };
  ["tdm-f-pax", "tdm-f-kids", "tdm-f-infants", "tdm-f-hdv", "tdm-f-hdv-hours"].forEach(id => $id(id)?.addEventListener("input", () => {
    const sel = $id("tdm-f-hdv-hours"); if (sel) sel.style.display = $id("tdm-f-hdv").checked ? "" : "none";
    refreshSummary();
  }));
  refreshSummary();
  // Dropdown Guide (5.8): hiện khi tour có HDV (hoặc tour tự túc đã bật thuê HDV); khoá guide không rảnh đủ tourDays ngày từ ngày đi
  const guidePicker = GuidePicker.attach({
    select: $id("tdm-f-guide"), row: $id("tdm-guide-row"), msg: $id("tdm-guide-msg"),
    getDate: () => $id("tdm-f-date")?.value, getDays: () => tourDays,
    isNeeded: () => tour.type !== "self" || !!$id("tdm-f-hdv")?.checked
  });
  ["tdm-f-date", "tdm-f-hdv"].forEach(id => $id(id)?.addEventListener("change", () => guidePicker.refresh()));
  guidePicker.refresh(true);   // mở form = tải lại lịch guide từ server (đơn mới đặt / vừa hủy đều được tính)
  // Voucher: nhập mã / chọn trong "Voucher của tôi" → server kiểm tra (đúng tài khoản, còn hạn, chưa dùng)
  if (window.VoucherUI) VoucherUI.attach({
    getVoucher: () => appliedVoucher,
    setVoucher: v => { appliedVoucher = v; refreshSummary(); },
    getSubtotal: () => calcBooking().subtotal,
    getTourId: () => tour.id,
    preselect: opts && opts.voucherCode
  });

  $id("tdm-btn-open-booking").addEventListener("click", () => {
    $id("tdm-booking-form").style.display = "";
    $id("tdm-btn-open-booking").style.display = "none";
    // Điền sẵn thông tin user
    const u = Auth.getUser();
    if (u) {
      const nameEl = $id("tdm-f-name"); if (nameEl && !nameEl.value) nameEl.value = u.name || "";
      const emailEl = $id("tdm-f-email"); if (emailEl && !emailEl.value) emailEl.value = u.email || "";
    }
  });

  $id("tdm-btn-cancel-booking").addEventListener("click", () => {
    $id("tdm-booking-form").style.display = "none";
    $id("tdm-btn-open-booking").style.display = "";
  });

  $id("tdm-btn-confirm-booking").addEventListener("click", async () => {
    const name  = $id("tdm-f-name")?.value.trim();
    const phone = $id("tdm-f-phone")?.value.trim();
    if (!name) { showToast("⚠️ Vui lòng nhập họ tên", "warn"); return; }
    const emailVal = $id("tdm-f-email")?.value.trim();
    if (emailVal && !isGmail(emailVal)) { showToast("⚠️ " + GMAIL_MSG, "warn"); return; }
    if (!isValidVNPhone(phone)) { showToast("⚠️ Số điện thoại không hợp lệ: cần 10 số, bắt đầu bằng 0 (hoặc +84), VD 0901234567", "warn"); return; }

    const calc = calcBooking();
    const pax  = calc.pax;
    const date = $id("tdm-f-date")?.value;
    const note = $id("tdm-f-note")?.value.trim();

    // Ràng buộc: bắt buộc chọn ngày đi và phải đăng ký trước ít nhất 3 ngày
    if (!date) { showToast("⚠️ Vui lòng chọn ngày khởi hành", "warn"); return; }
    if (soNgayConLai(date) < BOOKING_MIN_DAYS) {
      showToast(`⚠️ Phải đăng ký trước ngày đi ít nhất ${BOOKING_MIN_DAYS} ngày (chọn từ ${ngaySomNhatDangKy().split("-").reverse().join("/")} trở đi)`, "warn");
      return;
    }

    // Guide đã chọn phải rảnh đủ tourDays ngày (server kiểm tra lại lần nữa, đây chỉ để báo sớm)
    const guideId = guidePicker.getValue();
    if (guideId) {
      const g = guidePicker.getGuides().find(x => x.id === guideId);
      if (g && !GuideAvailability.isFreeRange(g, date, tourDays)) {
        showToast(`⚠️ ${g.name} không rảnh đủ ${tourDays} ngày từ ${date.split("-").reverse().join("/")} — vui lòng chọn người khác hoặc đổi ngày`, "warn");
        guidePicker.refresh();
        return;
      }
    }

    // Gửi lên SERVER: server tự tính giá (giá gốc → voucher → giá cuối → cọc 20%) và đánh dấu voucher đã dùng
    const confirmBtn = $id("tdm-btn-confirm-booking");
    const payPrefix = window.Payment ? Payment.config.prefix : "TRAVEL";
    let newBooking = null, viaServer = false;
    confirmBtn.disabled = true;
    try {
      const r = await Api.post("/api/bookings", {
        tourId: tour.id, customerName: name, phone, email: emailVal, date, note, payPrefix,
        adults: calc.adults, kids: calc.kids, infants: calc.infants, hdvOn: calc.hdvOn, hdvHours: calc.hours, guideId,
        voucherCode: appliedVoucher ? appliedVoucher.code : ""
      });
      if (r.ok) { newBooking = r.data.booking; viaServer = true; }
      else if (r.status === 401) {
        confirmBtn.disabled = false;
        showToast("⚠️ Phiên đăng nhập trên máy chủ đã hết — vui lòng đăng nhập lại để đặt tour", "warn");
        if (typeof showLoginModal === "function") showLoginModal();
        return;
      } else {
        confirmBtn.disabled = false;
        showToast("⚠️ " + (r.data.msg || "Không đặt được tour"), "warn");
        if (r.data.field === "voucher") { appliedVoucher = null; refreshSummary(); }
        if (r.data.field === "guide") { GuidePicker.load(true).then(() => guidePicker.refresh()); }   // lịch guide vừa đổi → tải lại
        return;
      }
    } catch (e) { /* không có server → chế độ localStorage cũ bên dưới */ }

    if (viaServer) {
      Api.cacheBooking(newBooking);
    } else {
      // Chế độ dự phòng (mở bằng máy chủ tĩnh): tính giá ở client, voucher không áp dụng được
      const bookings = JSON.parse(localStorage.getItem("travel_bookings") || "[]");
      const bkId = "bk_" + Date.now();
      newBooking = {
        id: bkId, payCode: payPrefix + bkId.replace(/\D/g, ""), depositPaid: false,
        tourId: tour.id, tourName: tour.name, tourDest: tour.destination,
        userId: Auth.getUser()?.id || "", userEmail: Auth.getUser()?.email || "", guideId: guideId || null,
        customerName: name, phone, date: date || "", pax, adults: calc.adults, children: calc.kids, infants: calc.infants, note,
        price: calc.total, deposit: calc.deposit, depositPercent: DEPOSIT_PCT, priceBreakdown: calc.bd,
        guideHire: calc.hdvOn ? { enabled: true, hoursPerDay: calc.hours, days: tourDays, cost: calc.hdv } : { enabled: false },
        itinerary: tour.itinerary || [], tourDuration: tour.duration || "", tourHighlight: tour.highlight || "", guideType: tour.type || "",
        status: "pending", createdAt: new Date().toISOString()
      };
      bookings.push(newBooking);
      localStorage.setItem("travel_bookings", JSON.stringify(bookings));
    }
    window.OrderStats?.autoWrite(false);   // cập nhật file orders.json (nếu đã liên kết). khoản chuyển chỉ được ghi nhận khi webhook ngân hàng khớp hoặc Admin xác nhận
    window.VoucherUI?.invalidate();        // danh sách "Voucher của tôi" phải tải lại (mã vừa dùng)

    modal.remove();
    showToast(`✅ Đã gửi yêu cầu đặt tour "${tour.name}". Cần chuyển cọc ${DEPOSIT_PCT}% (${fmt(newBooking.deposit)}). Tour đang chờ Travel xác nhận; khoản chuyển chỉ được ghi nhận sau khi admin đối chiếu.`, "success");
    if (window.Payment) Payment.open(newBooking);   // hiện QR chuyển khoản SePay
    // Cập nhật mọi nơi có dữ liệu đăng ký: tab "Chuyến đi của tôi", Hồ sơ, Thống kê
    renderHome();
    if (AppState.page === "profile")   renderProfile();
    if (AppState.page === "dashboard") renderDashboard();
  });

  // Mở thẳng form đặt tour (dùng từ trang riêng của tour)
  if (opts && opts.openBooking) {
    $id("tdm-btn-open-booking").click();
    if (opts.date && $id("tdm-f-date")) { $id("tdm-f-date").value = opts.date; guidePicker.refresh(); }
    setTimeout(() => $id("tdm-booking-form")?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
  }
}

function buildSampleItinerary(tour) {
  // Nếu tour tự túc có lịch trình chi tiết → render đầy đủ
  if (tour.itinerary && tour.itinerary.length) {
    return tour.itinerary.map(day => {
      const items = (day.items || []).map(it =>
        `<div class="tdm-itin-item"><span class="tdm-itin-time">${it.time}</span><span>${it.desc}</span></div>`
      ).join("");
      return `<div class="tdm-itin-day tdm-itin-day--rich">
        <div class="tdm-itin-day-title"><b>Ngày ${day.day}: ${day.title}</b></div>
        <div class="tdm-itin-items">${items}</div>
      </div>`;
    }).join("");
  }
  // Fallback cho guided tours (không có itinerary object)
  const durationDays = parseInt(tour.duration) || 2;
  const highlights = (tour.highlight || "").split("·").map(h => h.trim()).filter(Boolean);
  const days = [];
  for (let i = 0; i < Math.min(durationDays, 4); i++) {
    const hl = highlights[i % highlights.length] || tour.destination;
    const activities = i === 0
      ? `Di chuyển đến ${tour.destination} · Check-in khách sạn · Tham quan ${hl}`
      : i === durationDays - 1
        ? `Tham quan buổi sáng · Mua sắm đặc sản · Trở về`
        : `Tham quan ${hl} · Ẩm thực địa phương · Nghỉ ngơi`;
    days.push(`<div class="tdm-itin-day"><b>Ngày ${i+1}:</b> ${activities}</div>`);
  }
  if (durationDays > 4) days.push(`<div class="tdm-itin-day" style="color:#64748b">... và ${durationDays - 4} ngày tiếp theo</div>`);
  return days.join("");
}


/**
 * XEM LỊCH TRÌNH TOUR ĐÃ ĐẶT – chỉ mở được khi admin đã nhận tour (status "confirmed"),
 * áp dụng cho cả tour có HDV lẫn tour tự túc.
 */
function openBookingItinerary(bookingId) {
  const all = JSON.parse(localStorage.getItem("travel_bookings") || "[]");
  const b = all.find(x => x.id === bookingId);
  if (!b) return;
  if (b.status !== "confirmed") { showToast("⏳ Tour chưa được admin nhận nên chưa xem được lịch trình", "warn"); return; }

  // Ưu tiên dữ liệu gốc của tour, sau đó tới bản lưu lúc đặt
  const src = (typeof TOUR_SAMPLES !== "undefined" ? TOUR_SAMPLES : []).find(t => String(t.id) === String(b.tourId));
  const tour = {
    id: b.tourId, name: b.tourName, destination: b.tourDest || (src && src.dest) || "",
    duration: (src && src.duration) || b.tourDuration || "",
    highlight: (src && src.highlight) || b.tourHighlight || "",
    itinerary: (src && src.itinerary && src.itinerary.length) ? src.itinerary : (b.itinerary || [])
  };
  const old = $id("tour-detail-modal"); if (old) old.remove();
  ensureTdmStyles();
  const ngayDi = b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("vi-VN") : "—";
  const modal = document.createElement("div");
  modal.id = "tour-detail-modal";
  modal.innerHTML = `
    <div class="tdm-backdrop"></div>
    <div class="tdm-sheet" role="dialog" aria-label="Lịch trình tour đã đặt">
      <button class="tdm-close" aria-label="Đóng">✕</button>
      <div class="tdm-header">
        <div class="tdm-emoji">✅</div>
        <div>
          <div class="tdm-dest">${tour.destination}</div>
          <h2 class="tdm-name">${tour.name}</h2>
          <div class="tdm-meta"><span>📅 Ngày đi ${ngayDi}</span><span>👥 ${b.pax || 1} người</span>${tour.duration ? `<span>⏱ ${tour.duration}</span>` : ""}</div>
        </div>
      </div>
      <div class="tdm-section">
        <div class="tdm-section-title">📅 Lịch trình tour</div>
        <div class="tdm-itinerary">${buildSampleItinerary(tour)}</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".tdm-backdrop").addEventListener("click", () => modal.remove());
  modal.querySelector(".tdm-close").addEventListener("click", () => modal.remove());
}
