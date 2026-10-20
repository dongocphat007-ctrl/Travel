/**
 * account-extras.js – Thông báo theo từng tài khoản + xác thực hồ sơ (tên, email, giới tính, ngày sinh)
 *   - Chuông 🔔 trên thanh điều hướng: số thông báo chưa đọc, danh sách, đánh dấu đã đọc, xóa
 *   - Sau khi đăng nhập / đăng ký: nếu hồ sơ chưa xác thực → hiện form xác thực (có thể "Để sau")
 *   - Trang Hồ sơ: hiện giới tính, ngày sinh, trạng thái xác thực và mục "Thông báo"
 * Mọi dữ liệu do SERVER giữ (Spring Boot: /api/notifications/*, /api/auth/profile); ở đây chỉ hiển thị.
 * Khi mở bằng máy chủ tĩnh (không có server) thì ẩn chuông; form xác thực vẫn lưu tạm vào localStorage.
 * Phụ thuộc: data-api.js (Api), auth.js (Auth), utils.js (showToast, $id, esc), render.js (renderProfile), main.js (navigate)
 */
const AccountExtras = (() => {
  const $ = id => document.getElementById(id);
  const e = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const GENDER = { male: "Nam", female: "Nữ", other: "Khác" };
  const POLL_MS = 60000;

  const st = { list: [], unread: 0, serverOn: false, loaded: false, open: false, timer: null, loading: null };

  const ago = iso => {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (!(s >= 0)) return "Vừa xong";
    if (s < 60) return "Vừa xong";
    if (s < 3600) return Math.floor(s / 60) + " phút trước";
    if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
    if (s < 7 * 86400) return Math.floor(s / 86400) + " ngày trước";
    return new Date(iso).toLocaleDateString("vi-VN");
  };
  const ymdToVN = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s.split("-").reverse().join("/") : "";
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  // ───────────── Thông báo: tải / đọc / xóa ─────────────
  function load(force) {
    if (!Auth.isLoggedIn()) { reset(); return Promise.resolve([]); }
    if (st.loading && !force) return st.loading;
    st.loading = (async () => {
      try {
        const r = await Api.get("/api/notifications");
        if (r.ok) { st.list = r.data.notifications || []; st.unread = r.data.unread || 0; st.serverOn = true; }
        else { st.serverOn = false; st.list = []; st.unread = 0; }   // 401 (phiên server hết hạn) hoặc không có server
      } catch (err) { st.serverOn = false; st.list = []; st.unread = 0; }
      st.loaded = true; st.loading = null;
      paintBell(); paintProfileNoti();
      return st.list;
    })();
    return st.loading;
  }
  function reset() {
    st.list = []; st.unread = 0; st.serverOn = false; st.loaded = false; st.open = false;
    clearInterval(st.timer); st.timer = null;
  }
  function startPolling() {
    if (st.timer) return;
    st.timer = setInterval(() => { if (!document.hidden && Auth.isLoggedIn() && st.serverOn) load(true); }, POLL_MS);
  }

  async function markRead(ids) {      // ids = mảng id; bỏ trống = đọc hết
    const mine = ids ? st.list.filter(n => ids.includes(n.id) && !n.read) : st.list.filter(n => !n.read);
    if (!mine.length) return;
    mine.forEach(n => { n.read = true; });
    st.unread = st.list.filter(n => !n.read).length;
    paintBell(); paintProfileNoti();
    try { await Api.post("/api/notifications/read", ids ? { ids } : {}); } catch (err) { /* lần tải sau sẽ đồng bộ lại */ }
  }
  async function remove(ids) {        // ids = mảng id; bỏ trống = xóa hết
    st.list = ids ? st.list.filter(n => !ids.includes(n.id)) : [];
    st.unread = st.list.filter(n => !n.read).length;
    paintBell(); paintProfileNoti();
    try { await Api.post("/api/notifications/delete", ids ? { ids } : {}); } catch (err) { load(true); }
  }

  const itemHTML = n =>
    '<div class="nb-item' + (n.read ? "" : " unread") + '" data-id="' + e(n.id) + '">'
    + '<div class="nb-main" role="button" tabindex="0" data-link="' + e(n.link || "") + '">'
    + '<div class="nb-title">' + e(n.title) + "</div>"
    + (n.body ? '<div class="nb-body">' + e(n.body) + "</div>" : "")
    + '<div class="nb-time">' + e(ago(n.createdAt)) + "</div></div>"
    + '<button type="button" class="nb-del" data-del="' + e(n.id) + '" aria-label="Xóa thông báo" title="Xóa">✕</button></div>';

  // Gắn xử lý bấm cho 1 khung danh sách (chuông hoặc trang Hồ sơ); onNavigate chạy sau khi bấm vào 1 thông báo
  function bindList(box, onNavigate) {
    box.querySelectorAll(".nb-main").forEach(el => {
      const go = () => {
        const id = el.parentElement.dataset.id, link = el.dataset.link;
        markRead([id]);
        if (onNavigate) onNavigate();
        if (link && typeof navigate === "function" && (typeof AppState === "undefined" || AppState.page !== link)) navigate(link);
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } });
    });
    box.querySelectorAll(".nb-del").forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); remove([b.dataset.del]); }));
  }

  // ───────────── Chuông trên thanh điều hướng ─────────────
  function paintBell() {
    const area = $("nav-auth-area");
    if (!area) return;
    let wrap = $("nb-wrap");
    if (!Auth.isLoggedIn() || !st.serverOn) { wrap?.remove(); return; }
    if (!wrap || !area.contains(wrap)) {
      wrap?.remove();
      wrap = document.createElement("div");
      wrap.id = "nb-wrap"; wrap.className = "nb-wrap";
      wrap.innerHTML = '<button type="button" class="nb-bell" id="nb-bell" aria-label="Thông báo" aria-haspopup="true" aria-expanded="false">🔔'
        + '<span class="nb-badge" id="nb-badge" hidden></span></button><div class="nb-panel" id="nb-panel" hidden></div>';
      area.prepend(wrap);
      st.open = false;
      $("nb-bell").addEventListener("click", ev => { ev.stopPropagation(); setOpen(!st.open); });
      $("nb-panel").addEventListener("click", ev => ev.stopPropagation());
    }
    const badge = $("nb-badge");
    badge.hidden = st.unread === 0;
    badge.textContent = st.unread > 99 ? "99+" : String(st.unread);
    $("nb-bell").setAttribute("aria-label", st.unread ? "Thông báo (" + st.unread + " chưa đọc)" : "Thông báo");
    if (st.open) paintPanel();
  }
  function setOpen(v) {
    st.open = v;
    const panel = $("nb-panel");
    if (!panel) return;
    panel.hidden = !v;
    $("nb-bell")?.setAttribute("aria-expanded", v ? "true" : "false");
    if (v) { paintPanel(); load(true); }
  }
  function paintPanel() {
    const panel = $("nb-panel");
    if (!panel) return;
    const shown = st.list.slice(0, 30);
    panel.innerHTML = '<div class="nb-head"><b>Thông báo</b>'
      + (st.unread ? '<button type="button" class="nb-link" id="nb-readall">Đánh dấu đã đọc</button>' : "") + "</div>"
      + '<div class="nb-list">' + (shown.length ? shown.map(itemHTML).join("") : '<p class="nb-empty">Chưa có thông báo nào.</p>') + "</div>"
      + '<div class="nb-foot"><button type="button" class="nb-link" id="nb-all">Xem tất cả trong Hồ sơ</button></div>';
    $("nb-readall")?.addEventListener("click", () => markRead());
    $("nb-all").addEventListener("click", () => { setOpen(false); navigate("profile"); });
    bindList(panel, () => setOpen(false));
  }
  document.addEventListener("click", () => { if (st.open) setOpen(false); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") { if (st.open) setOpen(false); closeVerify(); } });

  // ───────────── Hồ sơ: thông tin + mục Thông báo ─────────────
  function paintProfileInfo() {
    const u = Auth.getUser();
    if (!u || !$("pf-gender")) return;
    const admin = u.role === "admin";
    $("pf-gender").textContent = u.gender ? "Giới tính: " + (GENDER[u.gender] || u.gender) : "Giới tính: chưa cập nhật";
    $("pf-birthday").textContent = u.birthday ? "Ngày sinh: " + ymdToVN(u.birthday) : "Ngày sinh: chưa cập nhật";
    const row = $("pf-verify-row");
    if (row) row.style.display = admin ? "none" : "";
    const ok = !!u.profileVerified;
    $("pf-verify").innerHTML = ok
      ? '<span class="vf-ok">✅ Đã xác thực</span>' + (u.profileVerifiedAt ? " · " + e(new Date(u.profileVerifiedAt).toLocaleDateString("vi-VN")) : "")
      : '<span class="vf-no">⚠️ Chưa xác thực thông tin</span>';
    const btn = $("pf-verify-btn");
    if (btn) { btn.style.display = ok || admin ? "none" : ""; btn.onclick = () => openVerify(); }
  }
  function paintProfileNoti() {
    const page = $("page-profile");
    if (!page || !Auth.isLoggedIn()) return;
    let sec = $("pf-noti-section");
    if (!st.serverOn) { sec?.remove(); return; }
    if (!sec) {
      sec = document.createElement("div");
      sec.className = "profile-trips-section"; sec.id = "pf-noti-section";
      const anchor = $("pf-vouchers-section") || $("pf-stats");
      if (anchor) anchor.after(sec); else page.querySelector(".profile-wrap")?.appendChild(sec);
    }
    sec.innerHTML = '<div class="profile-section-header"><h3 class="profile-section-title">🔔 Thông báo'
      + (st.unread ? ' <span class="nb-count">' + st.unread + " mới</span>" : "") + "</h3>"
      + '<div class="nb-sec-act">' + (st.unread ? '<button type="button" class="nb-link" id="pf-noti-read">Đánh dấu đã đọc</button>' : "")
      + (st.list.length ? '<button type="button" class="nb-link" id="pf-noti-clear">Xóa tất cả</button>' : "") + "</div></div>"
      + '<div class="nb-list nb-list-pf">' + (st.list.length ? st.list.map(itemHTML).join("") : '<p class="nb-empty">Chưa có thông báo nào.</p>') + "</div>";
    $("pf-noti-read")?.addEventListener("click", () => markRead());
    $("pf-noti-clear")?.addEventListener("click", () => remove());
    bindList(sec);
  }

  // ───────────── Form xác thực hồ sơ ─────────────
  function buildVerify() {
    if ($("modal-verify")) return;
    const wrap = document.createElement("div");
    wrap.className = "overlay"; wrap.id = "modal-verify";
    wrap.innerHTML = `
      <div class="login-card vf-card" role="dialog" aria-modal="true" aria-labelledby="vf-title">
        <h2 class="login-title" id="vf-title">Xác thực thông tin</h2>
        <p class="login-sub">Vui lòng kiểm tra và xác nhận thông tin của bạn. Đến sinh nhật, Travel sẽ tặng bạn voucher giảm giá 🎂</p>
        <div class="form-group vf-row">
          <label class="form-label" for="vf-name">Họ và tên</label>
          <input type="text" id="vf-name" class="form-input" autocomplete="name" maxlength="60">
          <div class="form-err" id="err-vf-name"></div>
        </div>
        <div class="form-group vf-row">
          <label class="form-label" for="vf-email">Email</label>
          <input type="email" id="vf-email" class="form-input" readonly>
          <div class="form-err" id="err-vf-email"></div>
        </div>
        <div class="form-group vf-row">
          <span class="form-label">Giới tính</span>
          <div class="vf-radios" id="vf-gender" role="radiogroup" aria-label="Giới tính">
            <label class="vf-radio"><input type="radio" name="vf-gender" value="male"><span>Nam</span></label>
            <label class="vf-radio"><input type="radio" name="vf-gender" value="female"><span>Nữ</span></label>
            <label class="vf-radio"><input type="radio" name="vf-gender" value="other"><span>Khác</span></label>
          </div>
          <div class="form-err" id="err-vf-gender"></div>
        </div>
        <div class="form-group vf-row">
          <label class="form-label" for="vf-birthday">Ngày tháng năm sinh</label>
          <input type="date" id="vf-birthday" class="form-input" min="1900-01-01">
          <div class="form-err" id="err-vf-birthday"></div>
        </div>
        <p class="vf-note">⚠️ Giới tính và ngày sinh chỉ nhập một lần — sau khi xác thực sẽ không tự sửa được.</p>
        <label class="vf-check"><input type="checkbox" id="vf-confirm"><span>Tôi xác nhận các thông tin trên là chính xác</span></label>
        <div class="form-err" id="err-vf-confirm"></div>
        <div class="form-err auth-err" id="err-vf-general"></div>
        <button type="button" class="btn btn-accent vf-submit" id="vf-submit">✅ Xác thực</button>
        <button type="button" class="vf-later" id="vf-later">Để sau</button>
      </div>`;
    document.body.appendChild(wrap);
    $("vf-later").addEventListener("click", closeVerify);
    $("vf-submit").addEventListener("click", submitVerify);
  }
  function openVerify() {
    const u = Auth.getUser();
    if (!u || u.role === "admin" || u.profileVerified) return;
    buildVerify();
    $("vf-name").value = u.name || "";
    $("vf-email").value = u.email || "";
    document.querySelectorAll('input[name="vf-gender"]').forEach(r => { r.checked = r.value === u.gender; });
    $("vf-birthday").max = todayStr();
    $("vf-birthday").value = u.birthday || "";
    $("vf-confirm").checked = false;
    clearErrs();
    $("modal-verify").classList.add("open");
    setTimeout(() => $("vf-name")?.focus(), 50);
  }
  function closeVerify() { $("modal-verify")?.classList.remove("open"); }
  function clearErrs() {
    ["name", "email", "gender", "birthday", "confirm", "general"].forEach(k => { const el = $("err-vf-" + k); if (el) { el.textContent = ""; el.classList.remove("show"); } });
    ["vf-name", "vf-birthday"].forEach(id => $(id)?.classList.remove("err"));
  }
  function fieldErr(field, msg) {
    const el = $("err-" + field) || $("err-vf-general");
    if (el) { el.textContent = msg; el.classList.add("show"); }
    $(field)?.classList.add("err");
  }
  async function submitVerify() {
    clearErrs();
    const name = $("vf-name").value.trim().replace(/\s+/g, " ");
    const gender = (document.querySelector('input[name="vf-gender"]:checked') || {}).value || "";
    const birthday = $("vf-birthday").value;
    let bad = false;
    if (name.length < 2) { fieldErr("vf-name", "Họ tên ít nhất 2 ký tự"); bad = true; }
    if (!gender) { fieldErr("vf-gender", "Vui lòng chọn giới tính"); bad = true; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday < "1900-01-01" || birthday > todayStr()) { fieldErr("vf-birthday", "Ngày sinh không hợp lệ (từ năm 1900, không được là ngày tương lai)"); bad = true; }
    if (!$("vf-confirm").checked) { fieldErr("vf-confirm", "Vui lòng tích xác nhận thông tin chính xác"); bad = true; }
    if (bad) return;
    const btn = $("vf-submit");
    btn.disabled = true; btn.textContent = "⏳ Đang lưu…";
    const r = await Auth.saveProfile({ name, email: $("vf-email").value, gender, birthday, verify: true, confirm: true });
    btn.disabled = false; btn.textContent = "✅ Xác thực";
    if (!r.ok) { fieldErr(r.field || "vf-general", r.msg); return; }
    closeVerify();
    showToast("Đã xác thực thông tin cá nhân ✅", "success");
    if (r.birthdayVoucher) showToast("🎂 Chúc mừng sinh nhật! Bạn nhận được voucher " + r.birthdayVoucher.code, "success", 6000);
    try { window.VoucherUI?.invalidate(); } catch (err) { /* không có voucher UI */ }
    if (typeof updateNavAuth === "function") updateNavAuth();
    if (typeof AppState !== "undefined" && AppState.page === "profile" && typeof renderProfile === "function") renderProfile();
    load(true);
  }

  // ───────────── Gọi từ main.js sau khi đăng nhập / đăng ký thành công ─────────────
  async function onLoggedIn() {
    const u = Auth.getUser();
    if (!u) return;
    await load(true);
    startPolling();
    // Hôm nay là sinh nhật (server vừa tặng voucher) → chúc mừng bằng toast
    const bd = st.list.find(n => n.type === "birthday" && !n.read && Date.now() - Date.parse(n.createdAt) < 86400000);
    if (bd) showToast(bd.title, "success", 6000);
    if (u.role !== "admin" && !u.profileVerified) setTimeout(openVerify, 600);
  }

  // Mỗi lần vẽ lại thanh điều hướng / trang Hồ sơ thì vẽ thêm phần của mình
  const origNav = window.updateNavAuth;
  if (typeof origNav === "function") {
    window.updateNavAuth = function () {
      const r = origNav.apply(this, arguments);
      if (!Auth.isLoggedIn()) { reset(); $("nb-wrap")?.remove(); }
      else if (!st.loaded) { load(); startPolling(); }
      else paintBell();
      return r;
    };
  }
  const origProfile = window.renderProfile;
  if (typeof origProfile === "function") {
    window.renderProfile = function () {
      const r = origProfile.apply(this, arguments);
      try {
        if (Auth.isLoggedIn()) {
          paintProfileInfo();
          if (st.loaded) paintProfileNoti(); else load();
        }
      } catch (err) { console.warn("[account-extras] hồ sơ:", err); }
      return r;
    };
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Auth.isLoggedIn() && st.serverOn) load(true); });
  // Đã đăng nhập sẵn từ lần trước → tải thông báo ngay khi mở trang
  if (Auth.isLoggedIn()) { load(); startPolling(); }

  return { onLoggedIn, openVerify, load, markRead, remove };
})();
window.AccountExtras = AccountExtras;
