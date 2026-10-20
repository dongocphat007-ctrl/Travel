/**
 * HOTEL & FLIGHT — dữ liệu và GIÁ do backend cung cấp, đặt chỗ đi qua cùng luồng đơn + chuyển khoản như đặt tour.
 *   GET  /api/travel/airports            danh sách sân bay + thành phố (gợi ý ô nhập)
 *   GET  /api/flights/search             tìm chuyến bay   (from, to, date, pax, cabin)
 *   GET  /api/hotels/search              tìm khách sạn    (dest, checkin, checkout, guests, stars)
 *   POST /api/bookings/flight | hotel    đặt chỗ (cần đăng nhập; server tự tính giá từ danh mục, client không gửi giá)
 * Sau khi đặt: Api.cacheBooking(booking) → Payment.open(booking) (QR chuyển khoản 100%).
 * Phụ thuộc: data-api.js (Api), payment.js (Payment), auth.js (Auth), utils.js (showToast), main.js (showLoginModal)
 */
const HotelFlightSearch = (() => {
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const vnd = n => Math.round(+n || 0).toLocaleString("vi-VN") + " ₫";
  const fmtDate = s => (s ? String(s).split("-").reverse().join("/") : "");
  const toast = (m, t) => (typeof showToast === "function" ? showToast(m, t || "info") : alert(m));
  const banner = (html, tone) => `<div class="hfs-ai-banner" ${tone === "err" ? 'style="background:#fee2e2;border-color:#ef4444;color:#991b1b"' : ""}>${html}</div>`;

  let _ctx = {};        // tham số lần tìm gần nhất
  let _results = [];    // kết quả lần tìm gần nhất (chuyến bay hoặc khách sạn)
  let _listsLoaded = false;

  // ───────── gợi ý sân bay / thành phố từ backend ─────────
  async function ensureLists() {
    if (_listsLoaded) return;
    _listsLoaded = true;
    try {
      const r = await Api.get("/api/travel/airports");
      if (!r.ok) { _listsLoaded = false; return; }
      const mk = (id, opts) => {
        let dl = document.getElementById(id);
        if (!dl) { dl = document.createElement("datalist"); dl.id = id; document.body.appendChild(dl); }
        dl.innerHTML = opts.map(o => `<option value="${esc(o)}">`).join("");
      };
      mk("hfs-airports", (r.data.airports || []).map(a => `${a.city} (${a.code})`));
      mk("hfs-cities", r.data.cities || []);
      ["hfs-fl-from", "hfs-fl-to"].forEach(id => document.getElementById(id)?.setAttribute("list", "hfs-airports"));
      document.getElementById("hfs-ht-dest")?.setAttribute("list", "hfs-cities");
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      ["hfs-fl-depart", "hfs-ht-checkin", "hfs-ht-checkout"].forEach(id => document.getElementById(id)?.setAttribute("min", today));
    } catch (e) { _listsLoaded = false; }
  }
  document.addEventListener("focusin", e => { if (e.target && /^hfs-/.test(e.target.id || "")) ensureLists(); });

  async function fetchJson(url) {
    let r;
    try { r = await Api.get(url); } catch (e) { return { ok: false, msg: "Không kết nối được máy chủ. Hãy chạy backend (mvn spring-boot:run) rồi thử lại." }; }
    if (!r.ok) return { ok: false, msg: r.data.msg || "Không tìm được dữ liệu" };
    return r.data;
  }

  // ───────── chuyến bay ─────────
  function renderFlightCard(f, i) {
    const next = f.arriveDayOffset > 0 ? `<sup style="color:#f59e0b">+${f.arriveDayOffset}</sup>` : "";
    return `<div class="hfs-card" id="fl-${i}">
      <div class="hfs-card-main">
        <div class="hfs-airline">
          <div class="hfs-airline-logo" style="background:${esc(f.color)}">${esc(f.code)}</div>
          <div class="hfs-airline-name">${esc(f.airline)}</div>
          <div style="font-size:.72rem;color:#94a3b8;">${esc(f.flightNo)}</div>
        </div>
        <div class="hfs-route">
          <div class="hfs-time-block"><div class="hfs-time">${esc(f.depart)}</div><div class="hfs-iata">${esc(f.from)}</div></div>
          <div class="hfs-route-mid">
            <div style="font-size:.75rem;color:#64748b;text-align:center;">${esc(f.duration)}</div>
            <div class="hfs-route-line">──${f.stops > 0 ? "●──" : "────"}──</div>
            <div style="font-size:.72rem;color:${f.stops === 0 ? "#22c55e" : "#f59e0b"};text-align:center;">${f.stops === 0 ? "Bay thẳng" : f.stops + " điểm dừng"}</div>
          </div>
          <div class="hfs-time-block"><div class="hfs-time">${esc(f.arrive)}${next}</div><div class="hfs-iata">${esc(f.to)}</div></div>
        </div>
        <div class="hfs-price-col">
          <div class="hfs-price">${vnd(f.price)}</div>
          <div style="font-size:.72rem;color:#94a3b8;">${vnd(f.farePerPax)}/người × ${f.pax}</div>
          ${f.refundable ? '<div style="color:#22c55e;font-size:.7rem;margin-top:3px;">✓ Hoàn tiền</div>' : '<div style="color:#94a3b8;font-size:.7rem;margin-top:3px;">Không hoàn tiền</div>'}
          <button class="hfs-book-btn" onclick="HotelFlightSearch.bookFlight(${i})">Đặt ngay</button>
        </div>
      </div>
      <div class="hfs-card-footer">${esc(f.cabinLabel)} · 🧳 ${esc(f.baggage)} · ${esc(f.fromCity)} → ${esc(f.toCity)} · ${fmtDate(f.date)}</div>
    </div>`;
  }

  async function searchFlights(params, containerId) {
    await ensureLists();
    const box = document.getElementById(containerId);
    const q = new URLSearchParams({ from: params.from, to: params.to, date: params.depart, pax: params.pax || 1, cabin: params.cabin || "economy" });
    const d = await fetchJson("/api/flights/search?" + q);
    if (!d.ok) { _results = []; if (box) box.innerHTML = banner("⚠️ " + esc(d.msg), "err"); return _results; }
    _ctx = { type: "flight", ...d };
    _results = d.flights || [];
    if (box) box.innerHTML = banner(`✈️ ${esc(d.from)} → ${esc(d.to)} · ${fmtDate(d.date)} · ${d.pax} khách · ${_results.length} chuyến. ${esc(d.note || "")}`)
      + (_results.length ? _results.map(renderFlightCard).join("") : '<p style="text-align:center;color:var(--muted);padding:24px">Chưa có chuyến bay nào cho tuyến/ngày này. Thử ngày khác hoặc sân bay lân cận.</p>');
    return _results;
  }

  // ───────── khách sạn ─────────
  function renderHotelCard(h, i) {
    const rooms = (h.rooms || []).map((r, j) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-top:1px dashed rgba(100,116,139,.35)">
        <div style="font-size:.8rem;color:#475569">🛏 <b>${esc(r.type)}</b> · tối đa ${r.capacity} khách/phòng · ${r.rooms} phòng × ${r.nights} đêm
          <div style="font-size:.72rem;color:#94a3b8">TB ${vnd(r.avgNight)}/phòng/đêm</div></div>
        <div style="text-align:right"><div class="hfs-price" style="font-size:1rem">${vnd(r.total)}</div>
          <button class="hfs-book-btn" onclick="HotelFlightSearch.bookHotel(${i},${j})">Đặt phòng</button></div>
      </div>`).join("");
    return `<div class="hfs-card hfs-hotel-card" id="ht-${i}">
      <div class="hfs-hotel-thumb">🏨<div class="hfs-stars-ovl">${"★".repeat(h.stars || 0)}</div></div>
      <div class="hfs-hotel-body">
        <div class="hfs-hotel-top">
          <div>
            <div class="hfs-hotel-name">${esc(h.name)}</div>
            <div style="font-size:.75rem;color:#94a3b8;">📍 ${esc(h.address)} · ${h.distCenter} km từ TT · ${esc(h.kind || "")}</div>
          </div>
          <div style="text-align:center;"><div class="hfs-rating-badge">${h.rating}</div><div style="font-size:.7rem;color:#94a3b8;">${(+h.reviews || 0).toLocaleString("vi-VN")} đánh giá</div></div>
        </div>
        <div style="font-size:.74rem;color:#64748b;margin:6px 0">${(h.amenities || []).map(esc).join(" · ")}${h.refundable ? ' · <span style="color:#22c55e">✓ Hủy miễn phí</span>' : ""}</div>
        ${rooms}
      </div>
    </div>`;
  }

  async function searchHotels(params, containerId) {
    await ensureLists();
    const box = document.getElementById(containerId);
    const q = new URLSearchParams({ dest: params.dest, checkin: params.checkin, checkout: params.checkout, guests: params.guests || 2, stars: params.stars || "any" });
    const d = await fetchJson("/api/hotels/search?" + q);
    if (!d.ok) { _results = []; if (box) box.innerHTML = banner("⚠️ " + esc(d.msg), "err"); return _results; }
    _ctx = { type: "hotel", ...d };
    _results = d.hotels || [];
    if (box) box.innerHTML = banner(`🏨 ${esc(d.dest)} · ${fmtDate(d.checkin)} → ${fmtDate(d.checkout)} · ${d.guests} khách · ${_results.length} khách sạn. ${esc(d.note || "")}`)
      + (_results.length ? _results.map(renderHotelCard).join("") : '<p style="text-align:center;color:var(--muted);padding:24px">Chưa có khách sạn phù hợp. Thử thành phố khác (gợi ý trong ô nhập) hoặc bỏ lọc hạng sao.</p>');
    return _results;
  }

  // ───────── hộp thoại đặt chỗ ─────────
  let _styled = false;
  function ensureStyles() {
    if (_styled) return; _styled = true;
    const s = document.createElement("style");
    s.textContent = `
      #hfs-book-modal{position:fixed;inset:0;z-index:8900;display:flex;align-items:center;justify-content:center;padding:16px}
      #hfs-book-modal .bk-bd{position:absolute;inset:0;background:rgba(15,23,42,.6)}
      #hfs-book-modal .bk-sheet{position:relative;background:var(--paper,#f5f3ee);color:var(--ink,#0d2137);border:1px solid rgba(13,33,55,.2);border-top:4px dotted rgba(13,33,55,.32);max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 16px 42px rgba(13,33,55,.24)}
      #hfs-book-modal h3{margin:0 0 4px;font-size:1.15rem}
      #hfs-book-modal .bk-sum{background:rgba(13,33,55,.06);padding:10px 12px;margin:10px 0 14px;font-size:.86rem;line-height:1.55}
      #hfs-book-modal label{display:block;font-size:.8rem;font-weight:600;margin:10px 0 4px}
      #hfs-book-modal input,#hfs-book-modal textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid rgba(13,33,55,.3);background:#fff;font:inherit;border-radius:2px}
      #hfs-book-modal .bk-err{color:#b3261e;font-size:.8rem;min-height:1.1em;margin-top:8px}
      #hfs-book-modal .bk-act{display:flex;gap:8px;margin-top:14px}
      #hfs-book-modal .bk-act button{flex:1;min-height:44px;font-weight:600;cursor:pointer;border:1px solid rgba(13,33,55,.28);background:#e9e5dc;color:#0d2137}
      #hfs-book-modal .bk-act .bk-ok{background:#0d2137;color:#f5f3ee;border-color:#0d2137}
      #hfs-book-modal .bk-total{display:flex;justify-content:space-between;font-weight:700;font-size:1.05rem;margin-top:8px}`;
    document.head.appendChild(s);
  }

  function needLogin() {
    if (window.Auth && Auth.isLoggedIn()) return false;
    toast("Vui lòng đăng nhập để đặt chỗ.", "warn");
    if (typeof showLoginModal === "function") showLoginModal();
    return true;
  }

  function openForm({ title, summaryHtml, total, extraHtml, endpoint, payload }) {
    if (needLogin()) return;
    ensureStyles();
    document.getElementById("hfs-book-modal")?.remove();
    const u = (window.Auth && Auth.getUser()) || {};
    const m = document.createElement("div");
    m.id = "hfs-book-modal";
    m.innerHTML = `<div class="bk-bd"></div>
      <form class="bk-sheet" role="dialog" aria-label="${esc(title)}" novalidate>
        <h3>${esc(title)}</h3>
        <div class="bk-sum">${summaryHtml}<div class="bk-total"><span>Tổng thanh toán</span><span>${vnd(total)}</span></div>
          <div style="font-size:.74rem;color:#64748b;margin-top:4px">Giá cuối do máy chủ tính lại khi xác nhận. Thanh toán chuyển khoản 1 lần (100%).</div></div>
        <label for="bk-name">Họ tên người đặt *</label><input id="bk-name" autocomplete="name" value="${esc(u.name || "")}" maxlength="100">
        <label for="bk-phone">Số điện thoại *</label><input id="bk-phone" type="tel" autocomplete="tel" placeholder="0901234567" maxlength="15">
        <label for="bk-email">Email (nhận xác nhận)</label><input id="bk-email" type="email" autocomplete="email" value="${esc(u.email || "")}">
        ${extraHtml || ""}
        <label for="bk-note">Ghi chú</label><textarea id="bk-note" rows="2" maxlength="1000"></textarea>
        <div class="bk-err" role="alert"></div>
        <div class="bk-act"><button type="button" class="bk-cancel">Hủy</button><button type="submit" class="bk-ok">Xác nhận & thanh toán</button></div>
      </form>`;
    document.body.appendChild(m);
    const err = m.querySelector(".bk-err"), ok = m.querySelector(".bk-ok");
    const close = () => m.remove();
    m.querySelector(".bk-bd").addEventListener("click", close);
    m.querySelector(".bk-cancel").addEventListener("click", close);
    m.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      err.textContent = ""; ok.disabled = true;
      const body = Object.assign({}, payload(m), {
        customerName: m.querySelector("#bk-name").value.trim(), phone: m.querySelector("#bk-phone").value.trim(),
        email: m.querySelector("#bk-email").value.trim(), note: m.querySelector("#bk-note").value.trim()
      });
      let r;
      try { r = await Api.post(endpoint, body); }
      catch (e) { err.textContent = "Không kết nối được máy chủ. Vui lòng thử lại."; ok.disabled = false; return; }
      if (r.status === 401) { close(); toast("Phiên đăng nhập đã hết — vui lòng đăng nhập lại.", "warn"); if (typeof showLoginModal === "function") showLoginModal(); return; }
      if (!r.ok) { err.textContent = r.data.msg || "Không đặt được. Vui lòng thử lại."; m.querySelector("#bk-" + ({ customerName: "name", phone: "phone", email: "email" }[r.data.field] || "note"))?.focus(); ok.disabled = false; return; }
      close();
      const b = r.data.booking;
      Api.cacheBooking(b);
      document.dispatchEvent(new CustomEvent("travel:bookings"));
      toast("✅ Đã tạo đơn " + b.id + ". Vui lòng chuyển khoản để hoàn tất.", "success");
      if (window.Payment) Payment.open(b);
    });
    m.querySelector("#bk-name").focus();
  }

  function bookFlight(i) {
    const f = _results[i];
    if (!f || _ctx.type !== "flight") return;
    openForm({
      title: "Đặt vé máy bay", total: f.price, endpoint: "/api/bookings/flight",
      summaryHtml: `<b>${esc(f.airline)} ${esc(f.flightNo)}</b><br>${esc(f.fromCity)} (${esc(f.from)}) → ${esc(f.toCity)} (${esc(f.to)})<br>${fmtDate(f.date)} · ${esc(f.depart)} → ${esc(f.arrive)}${f.arriveDayOffset > 0 ? " (+" + f.arriveDayOffset + ")" : ""} · ${esc(f.cabinLabel)} · ${f.pax} khách`,
      extraHtml: `<label for="bk-pax">Họ tên hành khách (mỗi dòng 1 người, đúng như giấy tờ)</label><textarea id="bk-pax" rows="${Math.min(f.pax, 4)}" placeholder="NGUYEN VAN A"></textarea>`,
      payload: m => ({ flightId: f.id, date: f.date, pax: f.pax, cabin: f.cabin, passengers: m.querySelector("#bk-pax").value.split("\n").map(x => x.trim()).filter(Boolean) })
    });
  }

  function bookHotel(i, j) {
    const h = _results[i], r = h && h.rooms[j];
    if (!r || _ctx.type !== "hotel") return;
    openForm({
      title: "Đặt phòng khách sạn", total: r.total, endpoint: "/api/bookings/hotel",
      summaryHtml: `<b>${esc(h.name)}</b> ${"★".repeat(h.stars || 0)}<br>${esc(h.address)}<br>${fmtDate(_ctx.checkin)} → ${fmtDate(_ctx.checkout)} (${r.nights} đêm) · ${esc(r.type)} × ${r.rooms} phòng · ${h.guests} khách${h.refundable ? "<br>✓ Hủy miễn phí" : ""}`,
      payload: () => ({ hotelId: h.id, roomType: r.type, checkin: _ctx.checkin, checkout: _ctx.checkout, guests: h.guests, rooms: r.rooms })
    });
  }

  return { searchFlights, searchHotels, bookFlight, bookHotel, ensureLists };
})();
window.HotelFlightSearch = HotelFlightSearch;
