/**
 * account-extras.js – Thông báo theo từng tài khoản + xác thực hồ sơ (tên, email, giới tính, ngày sinh)
 *   - Chuông 🔔 trên thanh điều hướng: số thông báo chưa đọc, danh sách, đánh dấu đã đọc, xóa
 *   - Sau khi đăng nhập / đăng ký: nếu hồ sơ chưa xác thực → hiện form xác thực (có thể "Để sau")
 *   - Trang Hồ sơ: hiện giới tính, ngày sinh, trạng thái xác thực và mục "Thông báo"
 * Mọi dữ liệu do SERVER giữ (Spring Boot: /api/notifications/*, /api/auth/profile); ở đây chỉ hiển thị.
 * Khi mở bằng máy chủ tĩnh (không có server) thì ẩn chuông; form xác thực vẫn lưu tạm vào localStorage.
 * Phụ thuộc: api-client.js (Api), auth.js (Auth), utils.js (showToast, $id, esc), trip-views.js (renderProfile), main.js (navigate)
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

;
/**
 * Khách: hủy tour (xem trước tiền hoàn theo chính sách), xin đổi ngày, gửi khiếu nại.
 * Mọi quyết định do server làm; trang này chỉ hỏi và hiển thị kết quả. Bắt sự kiện ủy quyền trên document nên chạy cho mọi thẻ đơn.
 */
(() => {
  const fmt = n => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const toast = (m, k) => (typeof showToast === "function" ? showToast(m, k || "info") : alert(m));

  function dialog(title, html, okLabel, okClass) {
    return new Promise(res => {
      const ov = document.createElement("div");
      ov.className = "overlay open"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = `<div class="login-card" style="max-width:460px;text-align:left"><h2 class="login-title" style="font-size:20px">${esc(title)}</h2><div class="co-body">${html}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn" data-x>Đóng</button>${okLabel ? `<button class="btn ${okClass || "btn-accent"}" data-ok>${esc(okLabel)}</button>` : ""}</div></div>`;
      const close = v => { ov.remove(); res(v); };
      ov.querySelector("[data-x]").onclick = () => close(null);
      const ok = ov.querySelector("[data-ok]"); if (ok) ok.onclick = () => close(ov);
      document.body.appendChild(ov);
      ov.addEventListener("keydown", e => { if (e.key === "Escape") close(null); });
    });
  }
  const refresh = async () => { try { await window.Api?.refreshBookings?.(true); } catch (e) { /* bỏ qua */ } try { if (typeof renderProfile === "function") renderProfile(); } catch (e) { /* bỏ qua */ } };
  const fail = r => toast((r && r.data && (r.data.msg || r.data.error || r.data.message)) || "Không thực hiện được, vui lòng thử lại", "error");

  async function cancel(id) {
    const p = await Api.get(`/api/bookings/${encodeURIComponent(id)}/cancel-preview`);
    if (!p.ok) return fail(p);
    const d = p.data;
    if (!d.canCancel) return void (await dialog("Không hủy được", `<p>${esc(d.reason || "Đơn này không thể hủy.")}</p>`));
    const tiers = (d.policy || []).slice().sort((a, b) => b.minDaysBefore - a.minDaysBefore).map(t => `<li>Hủy trước ngày đi từ ${t.minDaysBefore} ngày: hoàn ${t.pct}%</li>`).join("");
    const body = `<p>Còn <b>${d.daysBefore}</b> ngày đến ngày khởi hành.</p>${d.paid > 0 ? `<p>Bạn đã thanh toán <b>${fmt(d.paid)}</b>. Theo chính sách bạn được hoàn <b>${d.refundPct}%</b> = <b style="color:#166534">${fmt(d.refundAmount)}</b>.</p>` : "<p>Bạn chưa thanh toán nên đơn sẽ được hủy ngay, không phát sinh hoàn tiền.</p>"}
      <ul class="small" style="margin:8px 0 10px 18px">${tiers}</ul><label class="form-label" for="co-reason">Lý do (không bắt buộc)</label><textarea id="co-reason" class="form-input" rows="2"></textarea>`;
    const ov = await dialog("Hủy tour", body, "Xác nhận hủy tour", "btn-danger"); if (!ov) return;
    const r = await Api.post(`/api/bookings/${encodeURIComponent(id)}/cancel`, { reason: ov.querySelector("#co-reason").value });
    if (!r.ok) return fail(r);
    toast(d.paid > 0 ? "Đã gửi yêu cầu hủy. Tiền hoàn sẽ được duyệt và chuyển sau." : "Đã hủy đơn.", "success");
    await refresh();
  }

  async function resched(id) {
    const ov = await dialog("Xin đổi ngày khởi hành", `<p class="small">Mỗi đơn đổi ngày được một lần. Điều hành sẽ kiểm tra chỗ trống và lịch hướng dẫn viên.</p><label class="form-label" for="co-date">Ngày mới</label><input type="date" id="co-date" class="form-input" min="${new Date().toISOString().slice(0, 10)}"><label class="form-label" for="co-why" style="margin-top:8px">Lý do</label><textarea id="co-why" class="form-input" rows="2"></textarea>`, "Gửi yêu cầu");
    if (!ov) return;
    const date = ov.querySelector("#co-date").value; if (!date) return toast("Hãy chọn ngày mới", "error");
    const r = await Api.post(`/api/bookings/${encodeURIComponent(id)}/reschedule`, { date, reason: ov.querySelector("#co-why").value });
    if (!r.ok) return fail(r); toast("Đã gửi yêu cầu đổi ngày. Chúng tôi sẽ phản hồi sớm.", "success"); await refresh();
  }

  // 8.7–8.16: gia hạn thêm ngày
  async function extend(id) {
    const base = `/api/bookings/${encodeURIComponent(id)}/extensions`;
    const first = await Api.get(base + "/preview?days=1");
    if (!first.ok) return fail(first);
    if (!first.data.canExtend) return toast((first.data.problems || ["Đơn này chưa gia hạn được"])[0], "error");
    const max = first.data.maxDays || 2, one = first.data.quote || {};
    const ov = await dialog("Gia hạn thêm ngày", `<p class="small">Tối đa ${max} ngày, phần ngày thêm thu đủ 100% (không đặt cọc), xin trước ngày cuối ít nhất 24 giờ.</p><label class="form-label" for="co-xd">Số ngày thêm</label><select id="co-xd" class="form-input">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1} ngày</option>`).join("")}</select><div class="small" style="margin-top:8px">Khoảng <b>${Number(one.perDay || 0).toLocaleString("vi-VN")} ₫</b>/ngày thêm (thành tiền 1 ngày: ${Number(one.amount || 0).toLocaleString("vi-VN")} ₫, đã tính voucher nếu còn hạn). Hệ thống tính lại khi gửi.</div><label class="form-label" for="co-xn" style="margin-top:8px">Ghi chú</label><textarea id="co-xn" class="form-input" rows="2"></textarea>`, "Gửi yêu cầu");
    if (!ov) return;
    const r = await Api.post(base, { days: Number(ov.querySelector("#co-xd").value), note: ov.querySelector("#co-xn").value });
    if (!r.ok) return fail(r);
    toast(r.data.extension.status === "requested" ? "Đã gửi yêu cầu, chờ Điều hành duyệt." : "Đã tạo yêu cầu. Hãy chuyển khoản theo mã " + r.data.extension.paymentCode, "success");
    await refresh();
  }

  async function extCancel(v) {
    const [id, no] = v.split("|");
    if (!window.confirm("Hủy phần gia hạn này? Tiền đã thanh toán (nếu có) được hoàn theo bảng hoàn tiền, đơn gốc không bị ảnh hưởng.")) return;
    const r = await Api.post(`/api/bookings/${encodeURIComponent(id)}/extensions/${no}/cancel`, {});
    if (!r.ok) return fail(r); toast("Đã hủy phần gia hạn.", "success"); await refresh();
  }

  // 8.5: công ty hủy chuyến – khách chọn hoàn 100% hoặc đổi ngày
  async function offer(id) {
    const ov = await dialog("Công ty hủy chuyến đi", `<p class="small">Bạn có thể nhận hoàn 100% hoặc đổi sang ngày khác, không mất phí.</p><label class="form-label" for="co-oc">Lựa chọn</label><select id="co-oc" class="form-input"><option value="refund">Nhận hoàn 100%</option><option value="reschedule">Đổi sang ngày khác</option></select><label class="form-label" for="co-od" style="margin-top:8px">Ngày mới (nếu đổi ngày)</label><input type="date" id="co-od" class="form-input" min="${new Date().toISOString().slice(0, 10)}">`, "Xác nhận");
    if (!ov) return;
    const choice = ov.querySelector("#co-oc").value, date = ov.querySelector("#co-od").value;
    if (choice === "reschedule" && !date) return toast("Hãy chọn ngày mới", "error");
    const r = await Api.post(`/api/bookings/${encodeURIComponent(id)}/company-offer`, { choice, date });
    if (!r.ok) return fail(r); toast(choice === "refund" ? "Đã ghi nhận, khoản hoàn sẽ được chuyển cho bạn." : "Đã gửi yêu cầu đổi ngày.", "success"); await refresh();
  }

  // 6.7: thu nhỏ ảnh minh chứng (cạnh dài ≤ 1280px, JPEG) trước khi gửi để nhẹ và dưới giới hạn server
  function shrink(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error("Không đọc được ảnh"));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error("Tệp không phải ảnh hợp lệ"));
        img.onload = () => {
          const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL("image/jpeg", 0.8);
          url.length > 880000 ? rej(new Error("Ảnh quá lớn, hãy chọn ảnh nhỏ hơn")) : res(url);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function readImages(files) {
    const list = Array.from(files || []);
    if (list.length > 3) throw new Error("Chỉ đính kèm tối đa 3 ảnh");
    return Promise.all(list.map(shrink));
  }

  async function complain(id) {
    const ov = await dialog("Gửi khiếu nại / phản hồi", `<label class="form-label" for="co-t">Tiêu đề</label><input id="co-t" class="form-input" maxlength="120"><label class="form-label" for="co-c" style="margin-top:8px">Nội dung</label><textarea id="co-c" class="form-input" rows="4"></textarea><label class="form-label" for="co-i" style="margin-top:8px">Ảnh minh chứng (tối đa 3 ảnh, không bắt buộc)</label><input id="co-i" type="file" accept="image/png,image/jpeg,image/webp" multiple class="form-input">`, "Gửi");
    if (!ov) return;
    const title = ov.querySelector("#co-t").value.trim(), content = ov.querySelector("#co-c").value.trim();
    if (title.length < 3 || content.length < 5) return toast("Vui lòng nhập tiêu đề và nội dung", "error");
    let images;
    try { images = await readImages(ov.querySelector("#co-i").files); } catch (e) { return toast(e.message || "Không đọc được ảnh", "error"); }
    const r = await Api.post("/api/complaints", { bookingId: id, title, content, images });
    if (!r.ok) return fail(r); toast("Đã gửi. Bộ phận CSKH sẽ phản hồi trong thời gian sớm nhất.", "success");
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-bk-cancel],[data-bk-resched],[data-bk-complain],[data-bk-extend],[data-bk-extcancel],[data-bk-offer]"); if (!t) return;
    e.preventDefault();
    const run = t.dataset.bkCancel ? cancel(t.dataset.bkCancel) : t.dataset.bkResched ? resched(t.dataset.bkResched) : t.dataset.bkExtend ? extend(t.dataset.bkExtend)
      : t.dataset.bkExtcancel ? extCancel(t.dataset.bkExtcancel) : t.dataset.bkOffer ? offer(t.dataset.bkOffer) : complain(t.dataset.bkComplain);
    run.catch(() => toast("Có lỗi xảy ra, vui lòng thử lại", "error"));
  });
})();
