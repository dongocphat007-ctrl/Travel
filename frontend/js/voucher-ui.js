/**
 * voucher-ui.js – Giao diện voucher (A1, A2)
 *   - VoucherUI.attach(ctx): ô nhập mã + chip "Voucher của tôi" trong form đặt tour
 *   - VoucherUI.renderProfile(): mục "Voucher của tôi" ở trang Hồ sơ
 * Mọi kiểm tra hợp lệ (đúng tài khoản, còn hạn, chưa dùng) do SERVER làm; ở đây chỉ hiển thị.
 * Phụ thuộc: data-api.js (Api), auth.js (Auth)
 */
const VoucherUI = (() => {
  let list = null, loading = null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => new Intl.NumberFormat("vi-VN").format(Math.round(+n || 0)) + " ₫";
  const valueLbl = v => v.type === "percent" ? "−" + v.value + "%" + (v.maxDiscount ? " (tối đa " + money(v.maxDiscount) + ")" : "") : "−" + money(v.value);
  const dateLbl = iso => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };
  const STATE = {
    active: ["Dùng được", "vc-st-ok"], used: ["Đã dùng", "vc-st-off"], expired: ["Hết hạn", "vc-st-off"],
    upcoming: ["Chưa tới hạn", "vc-st-wait"], exhausted: ["Hết lượt", "vc-st-off"], disabled: ["Đã tắt", "vc-st-off"]
  };
  const leftLbl = iso => {
    if (!iso) return "Không giới hạn thời gian";
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return "Đã hết hạn " + dateLbl(iso);
    const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000);
    return "Hết hạn " + dateLbl(iso) + " (còn " + (d ? d + " ngày " : "") + h + " giờ)";
  };

  async function load(force) {
    if (!force && list) return list;
    if (loading && !force) return loading;
    loading = (async () => {
      try {
        const r = await Api.get("/api/vouchers/mine");
        list = r.ok ? (r.data.vouchers || []) : [];
      } catch (e) { list = []; }
      loading = null;
      return list;
    })();
    return loading;
  }
  const invalidate = () => { list = null; };

  // ── Trong form đặt tour ──
  function attach(ctx) {
    const input = document.getElementById("tdm-f-voucher"), btn = document.getElementById("tdm-voucher-apply");
    const chips = document.getElementById("tdm-voucher-list"), msg = document.getElementById("tdm-voucher-msg");
    if (!input || !btn) return;
    const say = (t, ok) => { msg.textContent = t || ""; msg.className = "vc-msg" + (t ? (ok ? " vc-ok" : " vc-err") : ""); };

    const paintChips = () => {
      const cur = ctx.getVoucher();
      const tid = ctx.getTourId ? String(ctx.getTourId()) : "";
      const act = (list || []).filter(v => v.state === "active" && (!v.tourId || !tid || String(v.tourId) === tid));   // mã riêng của tour khác thì ẩn
      chips.innerHTML = act.length
        ? '<span class="vc-chips-lbl">Voucher của tôi:</span>' + act.map(v =>
          '<button type="button" class="vc-chip' + (cur && cur.code === v.code ? " on" : "") + '" data-code="' + esc(v.code) + '" title="' + esc(leftLbl(v.endAt)) + '">'
          + "🎟️ " + esc(v.code) + " <b>" + esc(valueLbl(v)) + "</b></button>").join("")
        : "";
      chips.querySelectorAll(".vc-chip").forEach(c => c.addEventListener("click", () => {
        if (ctx.getVoucher() && ctx.getVoucher().code === c.dataset.code) { clear(); return; }
        input.value = c.dataset.code; apply();
      }));
    };
    const clear = () => { ctx.setVoucher(null); input.value = ""; say(""); paintChips(); btn.textContent = "Áp dụng"; };

    async function apply() {
      const code = input.value.trim();
      if (!code) { clear(); return; }
      btn.disabled = true; say("Đang kiểm tra…");
      try {
        const r = await Api.post("/api/vouchers/validate", { code, tourId: ctx.getTourId ? ctx.getTourId() : undefined });
        if (r.ok) {
          ctx.setVoucher(r.data.voucher);
          const d = Pricing.voucherDiscount(r.data.voucher, ctx.getSubtotal());
          say("✓ Đã áp dụng " + r.data.voucher.code + " — giảm " + money(d), true);
          btn.textContent = "Bỏ mã";
        } else {
          ctx.setVoucher(null); btn.textContent = "Áp dụng";
          say(r.status === 401 ? "Vui lòng đăng nhập lại để dùng voucher" : (r.data.msg || "Mã không dùng được"), false);
        }
      } catch (e) { say("Không kết nối được máy chủ — chưa thể dùng voucher", false); }
      btn.disabled = false; paintChips();
    }
    btn.addEventListener("click", () => { if (ctx.getVoucher()) clear(); else apply(); });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
    input.addEventListener("input", () => { if (ctx.getVoucher() && input.value.trim().toLowerCase() !== ctx.getVoucher().code.toLowerCase()) { ctx.setVoucher(null); btn.textContent = "Áp dụng"; say(""); paintChips(); } });
    load(true).then(() => {
      paintChips();
      // Bấm "Dùng mã" từ trang tour → tự áp dụng mã giảm của tour này
      const pre = ctx.preselect && String(ctx.preselect).toUpperCase();
      if (pre) { input.value = pre; apply(); }
    });
  }

  // Mã giảm riêng của 1 tour dành cho tài khoản đang đăng nhập (null nếu chưa có / đã dùng)
  async function forTour(tourId) {
    const vs = await load(true);
    return vs.find(x => x.tourId && String(x.tourId) === String(tourId) && x.state === "active") || null;
  }

  // ── Trang Hồ sơ: "Voucher của tôi" ──
  async function renderProfile() {
    const page = document.getElementById("page-profile");
    if (!page || !Auth.isLoggedIn()) return;
    let sec = document.getElementById("pf-vouchers-section");
    if (!sec) {
      sec = document.createElement("div");
      sec.className = "profile-trips-section"; sec.id = "pf-vouchers-section";
      const anchor = document.getElementById("pf-stats");
      if (anchor) anchor.after(sec); else page.querySelector(".profile-wrap")?.appendChild(sec);
    }
    const vs = await load(true);
    if (!vs.length) { sec.innerHTML = '<div class="profile-section-header"><h3 class="profile-section-title">🎟️ Voucher của tôi</h3></div><p class="vc-empty">Bạn chưa có voucher nào.</p>'; return; }
    const order = { active: 0, upcoming: 1, used: 2, exhausted: 3, expired: 4, disabled: 5 };
    vs.sort((a, b) => (order[a.state] - order[b.state]) || (Date.parse(a.endAt) || 9e15) - (Date.parse(b.endAt) || 9e15));
    sec.innerHTML = '<div class="profile-section-header"><h3 class="profile-section-title">🎟️ Voucher của tôi</h3></div><div class="vc-grid">'
      + vs.map(v => {
        const st = STATE[v.state] || ["", ""];
        return '<div class="vc-card ' + (v.state === "active" ? "" : "dim") + '">'
          + '<div class="vc-card-val">' + esc(valueLbl(v)) + "</div>"
          + '<div class="vc-card-body"><div class="vc-card-code">' + esc(v.code) + ' <span class="vc-st ' + st[1] + '">' + st[0] + "</span></div>"
          + '<div class="vc-card-title">' + esc(v.title || (v.source === "welcome" ? "Chào mừng thành viên mới" : "Ưu đãi")) + (v.tourId ? " · chỉ dùng 1 lần" : "") + "</div>"
          + '<div class="vc-card-time">' + esc(v.state === "upcoming" ? "Bắt đầu " + dateLbl(v.startAt) : leftLbl(v.endAt)) + "</div></div>"
          + (v.state === "active" ? '<button type="button" class="vc-copy" data-code="' + esc(v.code) + '">Sao chép</button>' : "") + "</div>";
      }).join("") + "</div>";
    sec.querySelectorAll(".vc-copy").forEach(b => b.addEventListener("click", () => {
      const done = () => { b.textContent = "Đã chép ✓"; setTimeout(() => { b.textContent = "Sao chép"; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.code).then(done, done); else done();
    }));
  }

  // Mỗi lần vẽ lại trang Hồ sơ thì vẽ thêm mục voucher
  const origProfile = window.renderProfile;
  if (typeof origProfile === "function") {
    window.renderProfile = function () { const r = origProfile.apply(this, arguments); renderProfile(); return r; };
  }
  return { attach, renderProfile, load, invalidate, forTour, valueLbl, leftLbl };
})();
window.VoucherUI = VoucherUI;
