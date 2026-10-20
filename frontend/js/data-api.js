/**
 * data-api.js – Cầu nối giữa giao diện và server (Spring Boot /api)
 *   - Api.get/post/put/del : gọi /api/* kèm cookie phiên
 *   - đồng bộ ĐƠN: giao diện cũ vẫn ghi localStorage "travel_bookings"; mọi thay đổi (trạng thái, thanh toán…)
 *     được tự gửi lên server qua /api/bookings/sync (server KHÔNG nhận giá từ client)
 *   - đồng bộ TOUR do Admin tạo ("travel_tours_v1") lên server để server tính giá được
 *   - Api.refreshBookings(): kéo đơn từ server về localStorage (Admin thấy mọi đơn, khách thấy đơn của mình)
 * Nếu mở bằng máy chủ tĩnh (không có backend) thì mọi lời gọi thất bại êm và giao diện chạy chế độ localStorage cũ.
 */
const Api = (() => {
  const BK = "travel_bookings", TOURS = "travel_tours_v1";
  const MUTABLE = ["status", "depositPaid", "depositPaidAt", "fullPaid", "finalPaid", "finalPaidAt", "payChoice", "claims", "overtimeHours", "adminNote", "payCode"];
  const rawSet = Storage.prototype.setItem;            // bản gốc, không kích hoạt đồng bộ
  let online = null;                                   // null = chưa biết, true/false sau lần gọi đầu

  async function call(method, url, body) {
    let r;
    try {
      r = await fetch(url, {
        method, credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (e) { online = false; throw e; }
    let data = null;
    try { data = await r.json(); } catch (e) { /* không phải JSON → không có server */ }
    if (data === null && r.status === 404) { online = false; throw new Error("Không có máy chủ API"); }
    online = true;
    return { status: r.status, ok: r.ok, data: data || {} };
  }
  const get = u => call("GET", u);
  const post = (u, b) => call("POST", u, b || {});
  const put = (u, b) => call("PUT", u, b || {});
  const del = u => call("DELETE", u);

  // ───────── Đồng bộ đơn (diff theo từng trường thay đổi được) ─────────
  const pick = b => { const o = {}; MUTABLE.forEach(k => { if (k in b) o[k] = b[k]; }); return o; };
  let snap = {};                                        // id → JSON các trường thay đổi được lần cuối đã đồng bộ
  const readLocal = k => { try { return JSON.parse(localStorage.getItem(k) || "[]") || []; } catch (e) { return []; } };
  const takeSnap = list => { snap = {}; list.forEach(b => { snap[b.id] = JSON.stringify(pick(b)); }); };
  takeSnap(readLocal(BK));

  let pushTimer = null, dirty = false;                  // dirty: có thay đổi chưa gửi → chưa được kéo đơn về (tránh ghi đè)
  function pushBookings() {
    clearTimeout(pushTimer); dirty = true;
    pushTimer = setTimeout(async () => {
      const list = readLocal(BK);
      const changed = list.filter(b => String(b.id).indexOf("bk_") === 0 && snap[b.id] !== undefined && snap[b.id] !== JSON.stringify(pick(b)));
      const have = new Set(list.map(b => b.id));
      const removed = Object.keys(snap).filter(id => !have.has(id) && id.indexOf("bk_") === 0);   // Admin vừa xóa đơn
      if (!changed.length && !removed.length) { dirty = false; return; }
      try {
        if (removed.length) { const d = await post("/api/bookings/delete", { ids: removed }); if (d.ok) removed.forEach(id => { delete snap[id]; }); }
        if (changed.length) {
          const r = await post("/api/bookings/sync", { bookings: changed.map(b => Object.assign({ id: b.id }, pick(b))) });
          if (r.ok) changed.forEach(b => { snap[b.id] = JSON.stringify(pick(b)); });
        }
        document.dispatchEvent(new CustomEvent("travel:bookings"));
      } catch (e) { /* offline: lần sau thử lại */ }
      dirty = false;
    }, 250);
  }

  let toursTimer = null;
  function pushAdminTours() {
    clearTimeout(toursTimer);
    toursTimer = setTimeout(async () => {
      let list = []; try { list = JSON.parse(localStorage.getItem(TOURS) || "[]") || []; } catch (e) {}
      try { await post("/api/admin/tours/sync", { tours: list }); } catch (e) { /* chỉ Admin đăng nhập mới đồng bộ được */ }
    }, 600);
  }

  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (this === window.localStorage) {
      if (k === BK) pushBookings();
      else if (k === TOURS) pushAdminTours();
    }
  };

  // ───────── Kéo đơn từ server về ─────────
  let lastRefresh = 0;
  async function refreshBookings(force) {
    if (dirty) return false;
    if (!force && Date.now() - lastRefresh < 15000) return false;
    lastRefresh = Date.now();
    let r;
    try { r = await get("/api/bookings"); } catch (e) { return false; }
    if (!r.ok) return false;
    const server = r.data.bookings || [], ids = new Set(server.map(b => b.id));
    const legacy = readLocal(BK).filter(b => !ids.has(b.id) && String(b.id).indexOf("bk_") === 0 && !b._server && !b.priceBreakdown);
    const merged = server.map(b => Object.assign({}, b, { _server: true })).concat(legacy);
    const before = localStorage.getItem(BK);
    const after = JSON.stringify(merged);
    takeSnap(merged);
    if (before === after) return false;
    rawSet.call(localStorage, BK, after);
    document.dispatchEvent(new CustomEvent("travel:bookings"));
    return true;
  }

  // Thêm đơn vừa tạo trên server vào localStorage (không kích hoạt đồng bộ)
  function cacheBooking(b) {
    const list = readLocal(BK).filter(x => x.id !== b.id);
    list.push(Object.assign({}, b, { _server: true }));
    snap[b.id] = JSON.stringify(pick(b));
    rawSet.call(localStorage, BK, JSON.stringify(list));
    document.dispatchEvent(new CustomEvent("travel:bookings"));
  }

  // Đồng bộ lần đầu + khi quay lại tab
  const boot = () => { refreshBookings(true); if (localStorage.getItem(TOURS)) pushAdminTours(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshBookings(); });

  // Đơn đổi (từ server) → vẽ lại màn hình đang mở; không vẽ lại khi Admin đang gõ ở tab khác
  document.addEventListener("travel:bookings", () => {
    if (typeof AppState === "undefined") return;
    try {
      if (AppState.page === "home" && typeof renderHome === "function") renderHome();
      else if (AppState.page === "profile" && typeof renderProfile === "function") renderProfile();
      else if (AppState.page === "dashboard" && typeof renderDashboard === "function") renderDashboard();
      else if (AppState.page === "admin" && window.Admin && /'(bookings|stats)'/.test((document.querySelector(".adm-tab.active") || {}).getAttribute?.("onclick") || "")) Admin.render();
    } catch (e) { console.warn("[api] vẽ lại sau khi đồng bộ đơn:", e); }
  });

  return { get, post, put, del, call, refreshBookings, cacheBooking, isOnline: () => online };
})();
window.Api = Api;
