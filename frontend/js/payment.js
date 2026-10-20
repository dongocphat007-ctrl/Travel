/**
 * payment.js – Chuyển khoản VietQR (SePay/Casso/PayOS → webhook về Spring Boot)
 *
 * Cách hoạt động:
 *   1. Sau khi khách đặt tour, hiện QR chuyển khoản số tiền đặt cọc (20%) kèm NỘI DUNG CK duy nhất (mã đơn, vd TRAVEL1760000000000).
 *   2. Khách quét QR bằng app ngân hàng → dịch vụ theo dõi tài khoản gọi POST /api/payments/webhook (có xác thực secret).
 *   3. Server tách mã đơn, đối chiếu số tiền, chống ghi trùng, ghi payments.json và đổi đơn pending → confirmed.
 *      Giao dịch lệch tiền / không khớp mã: Admin xác nhận tay (POST /api/admin/payments/manual).
 *
 * Tài khoản nhận tiền KHÔNG nằm trong file JS này: lấy từ server (GET /api/payments/config, biến môi trường
 * PAYMENT_BANK / PAYMENT_ACCOUNT / PAYMENT_ACCOUNT_NAME / PAYMENT_PREFIX). Không có server → chưa hiện QR.
 * Nút "Tôi đã chuyển khoản" chỉ ghi nhận khách đã báo; KHÔNG phải xác nhận đã nhận tiền.
 *
 * Phụ thuộc: utils.js (esc, $id, showToast), constants.js (quyetToanBooking)
 */
const Payment = (() => {

  /**
   * Thông tin tài khoản NHẬN TIỀN — được nạp từ server (load()), để trống cho tới khi nạp xong.
   *   prefix: tiền tố mã thanh toán (khớp cấu hình "nhận diện mã thanh toán" của dịch vụ webhook)
   */
  const SEPAY_CONFIG = { bank: "", account: "", accountName: "", prefix: "TRAVEL" };

  // Nạp cấu hình từ server (một lần). Lỗi/không có server → giữ trống, giao diện báo "chưa cấu hình".
  let _loading = null;
  const load = () => _loading || (_loading = (async () => {
    try {
      const r = await fetch("/api/payments/config", { credentials: "same-origin" });
      if (r.ok) {
        const d = await r.json();
        ["bank", "account", "accountName", "prefix"].forEach(k => { if (d[k]) SEPAY_CONFIG[k] = String(d[k]); });
      }
    } catch (e) { /* không có server */ }
    return SEPAY_CONFIG;
  })());
  load();

  const isConfigured = () => !!(SEPAY_CONFIG.bank && SEPAY_CONFIG.account);

  // Nội dung chuyển khoản: chỉ chữ + số, không dấu/khoảng trắng (ngân hàng hay cắt/biến đổi ký tự lạ)
  const payCodeOf = (b) => {
    if (b.payCode) return b.payCode;
    return SEPAY_CONFIG.prefix + String(b.id || "").replace(/\D/g, "");
  };

  const money = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(+n || 0)) + " ₫";

  // Mã BIN VietQR của các ngân hàng phổ biến (dùng cho nguồn QR dự phòng img.vietqr.io)
  const BANK_BIN = { vietcombank:"970436", vcb:"970436", mbbank:"970422", mb:"970422", acb:"970416", tpbank:"970423",
    bidv:"970418", techcombank:"970407", tcb:"970407", vietinbank:"970415", agribank:"970405", vpbank:"970432", sacombank:"970403" };
  const binOf = () => BANK_BIN[String(SEPAY_CONFIG.bank).toLowerCase().replace(/\s/g, "")] || SEPAY_CONFIG.bank;

  // ── Tạo mã VietQR ngay trên trình duyệt (chuẩn NAPAS 247, không cần mạng/dịch vụ ngoài) ──
  const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
  const crc16 = (str) => {
    let c = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      c ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return c.toString(16).toUpperCase().padStart(4, "0");
  };
  const vietQrPayload = (amount, code) => {
    const bin = binOf();
    if (!/^\d{6}$/.test(bin)) return "";
    const acct = tlv("00", bin) + tlv("01", String(SEPAY_CONFIG.account));
    const info = tlv("00", "A000000727") + tlv("01", acct) + tlv("02", "QRIBFTTA");
    const body = tlv("00", "01") + tlv("01", "12") + tlv("38", info) + tlv("52", "0000") + tlv("53", "704") +
      tlv("54", String(Math.round(+amount || 0))) + tlv("58", "VN") + tlv("62", tlv("08", code)) + "6304";
    return body + crc16(body);
  };
  const localQr = (amount, code) => {
    try {
      const payload = vietQrPayload(amount, code);
      if (!payload || typeof qrcode !== "function") return "";
      const q = qrcode(0, "M");
      q.addData(payload); q.make();
      return q.createDataURL(8, 4);
    } catch { return ""; }
  };

  // Danh sách nguồn QR, thử lần lượt: nếu nguồn trước lỗi/không tải được thì tự chuyển sang nguồn sau
  const qrSources = (amount, code) => {
    const amt = String(Math.round(+amount || 0));
    return [
      localQr(amount, code),
      "https://qr.sepay.vn/img?" + new URLSearchParams({ acc: SEPAY_CONFIG.account, bank: SEPAY_CONFIG.bank, amount: amt, des: code }),
      "https://img.vietqr.io/image/" + binOf() + "-" + SEPAY_CONFIG.account + "-compact2.png?" +
        new URLSearchParams({ amount: amt, addInfo: code, accountName: SEPAY_CONFIG.accountName })
    ].filter(Boolean);
  };

  const loadAll = () => { try { return JSON.parse(localStorage.getItem("travel_bookings") || "[]") || []; } catch { return []; } };

  // Lần thanh toán đầu (chưa nhận tiền gì): khách chọn cọc DEPOSIT_PCT% hoặc trả đủ 100%
  const isFirstPayment = (b) => !b.depositPaid && !b.finalPaid && !!b.deposit;

  // Số tiền cần chuyển: lần đầu theo lựa chọn (cọc / trả đủ); sau cọc là phần còn lại (+ phụ thu HDV nếu admin đã nhập)
  const amountDue = (b, mode) => {
    const q = quyetToanBooking(b);
    if (b.depositPaid) return q.finalDue;
    return (mode || b.payChoice) === "full" ? q.total : q.deposit;
  };

  // Ghi lại lựa chọn của khách để admin biết đang chờ số tiền nào
  // explicit = true khi khách tự bấm chọn; lần gán mặc định lúc mở QR thì chỉ lưu
  const saveChoice = (b, mode, explicit) => {
    b.payChoice = mode;
    const all = loadAll(), r = all.find(x => x.id === b.id);
    if (r) { r.payChoice = mode; try { localStorage.setItem("travel_bookings", JSON.stringify(all)); } catch {} }
  };

  let _styled = false;
  const ensureStyles = () => {
    if (_styled) return; _styled = true;
    const s = document.createElement("style");
    s.textContent = `
      #pay-modal{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
      #pay-modal .pay-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.6)}
      #pay-modal .pay-sheet{position:relative;background:#f5f3ee;color:#0d2137;border:1px solid rgba(13,33,55,.2);border-top:4px dotted rgba(13,33,55,.32);border-radius:2px;max-width:440px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 16px 42px rgba(13,33,55,.24)}
      #pay-modal h3{margin:0 0 4px;font-size:1.15rem;color:#0d2137}
      #pay-modal .pay-sub{color:#435267;font-size:.85rem;margin-bottom:14px}
      #pay-modal .pay-qr{display:block;margin:0 auto 14px;width:240px;max-width:100%;border-radius:2px;border:1px solid rgba(13,33,55,.25);background:#fff}
      #pay-modal .pay-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(13,33,55,.28);font-size:.9rem;align-items:center}
      #pay-modal .pay-row b{word-break:break-all;text-align:right}
      #pay-modal .pay-copy{border:1px solid rgba(13,33,55,.3);background:#fbfaf6;border-radius:2px;padding:4px 9px;font-size:.75rem;cursor:pointer;margin-left:6px;color:#0d2137;min-height:32px}
      #pay-modal .pay-warn{background:#f2ded9;color:#5a1713;border:1px solid rgba(179,38,30,.35);border-left:4px solid #b3261e;border-radius:2px;padding:12px 13px;font-size:.9rem;line-height:1.5;margin:12px 0}
      #pay-modal .pay-err{background:#f2ded9;color:#5a1713;border:1px solid rgba(179,38,30,.35);border-radius:2px;padding:10px 12px;font-size:.88rem;margin-bottom:12px}
      #pay-modal .pay-actions{display:flex;gap:8px;margin-top:14px}
      #pay-modal .pay-actions button{flex:1;min-height:44px;padding:10px;border-radius:2px;border:1px solid rgba(13,33,55,.28);font-weight:600;cursor:pointer}
      #pay-modal .pay-actions #pay-pdf,#pay-modal .pay-actions #pay-close{background:#e9e5dc!important;color:#0d2137!important;border:1px solid rgba(13,33,55,.28)!important}
      #pay-modal .pay-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
      #pay-modal .pay-opt{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 12px;border-radius:2px;border:1px solid rgba(13,33,55,.28);background:#fbfaf6;color:#0d2137;cursor:pointer;font-size:.82rem}
      #pay-modal .pay-opt b{font-size:1rem}
      #pay-modal .pay-opt small{color:#596575;font-size:.72rem}
      #pay-modal .pay-opt.on{border:2px solid #b3261e;background:#f2ded9}
      #pay-modal .pay-ok{background:#0d2137;color:#f5f3ee;border-color:#0d2137}
      #pay-modal .pay-actions button:focus-visible,#pay-modal .pay-opt:focus-visible,#pay-modal .pay-copy:focus-visible{outline:3px solid rgba(179,38,30,.45);outline-offset:2px}
      @media(max-width:520px){#pay-modal{padding:10px}#pay-modal .pay-sheet{padding:18px 16px}#pay-modal .pay-actions{flex-direction:column}}
    `;
    document.head.appendChild(s);
  };

  const copy = (text, btn) => {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "✓"; setTimeout(() => (btn.textContent = o), 1200); } };
    try { navigator.clipboard.writeText(text).then(done, done); } catch { done(); }
  };

  /**
   * Mở cửa sổ thanh toán cho 1 booking.
   * Lần đầu: khách chọn "Đặt cọc 20%" hoặc "Thanh toán toàn bộ"; QR đổi theo lựa chọn.
   * @param {object|string} booking  object booking hoặc id booking
   */
  async function open(booking) {
    await load();
    const b = typeof booking === "string" ? loadAll().find(x => x.id === booking) : booking;
    if (!b) return;
    ensureStyles();
    document.getElementById("pay-modal")?.remove();

    const svc = !!b.kind;                               // vé máy bay / khách sạn: thanh toán 1 lần 100%, không có cọc
    const first = isFirstPayment(b) && !svc;
    const pct   = depositPctOf(b);
    let mode    = svc ? "full" : first ? (b.payChoice === "full" ? "full" : "deposit") : "deposit";
    const code  = payCodeOf(b);
    const copyable = new Set(["Số tài khoản", "Nội dung CK"]);

    const modal = document.createElement("div");
    modal.id = "pay-modal";
    document.body.appendChild(modal);

    function paint() {
      const amount = amountDue(b, mode);
      const stage  = svc ? (b.depositPaid ? "Đã nhận thanh toán" : "Thanh toán toàn bộ") : b.depositPaid ? `Thanh toán ${100 - pct}% còn lại`
                   : mode === "full" ? "Thanh toán toàn bộ" : `Đặt cọc ${pct}%`;
      const rows = [
        ["Ngân hàng", SEPAY_CONFIG.bank],
        ["Số tài khoản", SEPAY_CONFIG.account],
        ["Chủ tài khoản", SEPAY_CONFIG.accountName],
        ["Số tiền", money(amount)],
        ["Nội dung CK", code]
      ].filter(r => r[1]);
      const q = quyetToanBooking(b);
      const claimKey = b.depositPaid ? "final" : mode;               // đang báo chuyển khoản cho lần nào
      const claimedAt = (loadAll().find(x => x.id === b.id) || b).claims?.[claimKey];
      const claimedTxt = claimedAt ? new Date(claimedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
      const paymentStatus = b.finalPaid || b.fullPaid ? "Đã xác nhận thanh toán đủ"
        : claimedAt && b.depositPaid ? "Đã xác nhận cọc · phần còn lại đang chờ admin đối chiếu"
        : claimedAt ? "Đã gửi thông báo chuyển khoản · đang chờ admin đối chiếu"
        : b.depositPaid ? "Admin đã đối chiếu và xác nhận đã nhận cọc"
        : "Chưa ghi nhận chuyển khoản";
      modal.innerHTML = `
        <div class="pay-backdrop"></div>
        <div class="pay-sheet" role="dialog" aria-label="Thanh toán chuyển khoản">
          <h3>💳 ${stage}</h3>
          <div class="pay-sub">${svc ? (b.kind === "flight" ? "Vé máy bay" : "Khách sạn") : "Tour"}: ${esc(b.tourName || "")}${b.date ? (b.kind === "hotel" ? " · Nhận phòng " : " · Ngày đi ") + esc(b.date.split("-").reverse().join("/")) : ""}</div>
          <div class="pay-status" role="status">${esc(paymentStatus)}</div>
          ${first ? `
            <div class="pay-opts" role="radiogroup" aria-label="Chọn hình thức thanh toán">
              <button type="button" class="pay-opt ${mode === "deposit" ? "on" : ""}" data-mode="deposit" role="radio" aria-checked="${mode === "deposit"}">
                <span>Đặt cọc ${pct}%</span><b>${money(q.deposit)}</b><small>Còn lại ${money(q.total - q.deposit)} chuyển sau tour</small>
              </button>
              <button type="button" class="pay-opt ${mode === "full" ? "on" : ""}" data-mode="full" role="radio" aria-checked="${mode === "full"}">
                <span>Thanh toán toàn bộ</span><b>${money(q.total)}</b><small>Không phải chuyển thêm sau tour</small>
              </button>
            </div>` : ""}
          ${isConfigured()
            ? `<img data-eager class="pay-qr" alt="Mã QR chuyển khoản ${esc(money(amount))}" referrerpolicy="no-referrer" data-qr="${esc(JSON.stringify(qrSources(amount, code)))}" src="${esc(qrSources(amount, code)[0])}">
               <div class="pay-qr-fail" style="display:none;text-align:center;font-size:.85rem;color:#b45309;margin:-4px 0 12px">⚠️ Không tải được mã QR. Vui lòng chuyển khoản thủ công theo thông tin bên dưới.</div>`
            : `<div class="pay-err">⚠️ Chưa cấu hình tài khoản nhận tiền. Admin cấu hình PAYMENT_BANK / PAYMENT_ACCOUNT trên máy chủ.</div>`}
          ${rows.map(([k, v]) => `
            <div class="pay-row"><span>${k}</span><span><b>${esc(v)}</b>${copyable.has(k) ? `<button class="pay-copy" data-copy="${esc(v)}">Chép</button>` : ""}</span></div>`).join("")}
          ${b.depositPaid ? `<div class="pay-sub" style="margin-top:8px">Gồm phần còn lại sau cọc${b.overtimeHours ? ` và phụ thu HDV làm thêm ${esc(b.overtimeHours)} tiếng` : ""}. Nếu HDV có làm thêm giờ, admin sẽ báo số tiền chính xác.</div>` : ""}
          ${window.BUSINESS?.demoMode ? `<div class="pay-err" style="margin:8px 0">🎓 <b>Bản demo học tập</b> — đây chỉ là minh họa quy trình, vui lòng <b>KHÔNG chuyển tiền thật</b>.</div>` : ""}
          <div class="pay-sub" style="margin:8px 0">Đọc <a href="#" data-policy="refund" id="pay-policy-link" style="color:#0891B2;font-weight:600">chính sách hủy & hoàn cọc</a> trước khi chuyển tiền.</div>
          <div class="pay-warn">⚠️ Giữ <b>nguyên nội dung chuyển khoản</b> <b>${esc(code)}</b> để hệ thống đối soát đúng đơn. Sau khi chuyển, bấm <b>"Tôi đã chuyển khoản"</b> để gửi thông báo. Đơn sẽ chờ admin đối chiếu; thao tác này chưa xác nhận Travel đã nhận tiền.</div>
          <div class="pay-actions">
            <button class="pay-ok" id="pay-claim" ${claimedAt ? "disabled style=\"opacity:.7;cursor:default\"" : ""}>${claimedAt ? "✅ Đã gửi lúc " + claimedTxt : "✅ Tôi đã chuyển khoản"}</button>
            ${svc ? "" : '<button id="pay-pdf" style="background:#e2e8f0;color:#0f172a">📄 Tải PDF</button>'}
            <button id="pay-close" style="background:#e2e8f0;color:#0f172a">Đóng</button>
          </div>
        </div>`;
      const qrImg = modal.querySelector("img.pay-qr");
      if (qrImg) {
        const srcs = JSON.parse(qrImg.dataset.qr || "[]");
        let i = 0;
        qrImg.addEventListener("error", () => {
          if (++i < srcs.length) qrImg.src = srcs[i];
          else { qrImg.style.display = "none"; modal.querySelector(".pay-qr-fail").style.display = "block"; }
        });
      }
      modal.querySelector(".pay-backdrop").addEventListener("click", () => modal.remove());
      modal.querySelector("#pay-close").addEventListener("click", () => modal.remove());
      modal.querySelector("#pay-pdf")?.addEventListener("click", () => {
        const fresh = loadAll().find(x => x.id === b.id) || b;   // lấy bản mới nhất (đã chọn cọc/trả đủ, đã báo CK…)
        window.BookingPDF?.download(fresh);
      });
      modal.querySelector("#pay-policy-link")?.addEventListener("click", () => modal.remove());   // đóng hộp thanh toán rồi mở trang chính sách
      modal.querySelector("#pay-claim")?.addEventListener("click", () => {
        const all = loadAll(), r = all.find(x => x.id === b.id), target = r || b;
        target.claims = target.claims || {};
        if (target.claims[claimKey]) return;                       // mỗi lần chỉ báo 1 lần
        target.claims[claimKey] = new Date().toISOString();
        b.claims = target.claims;
        if (r) { try { localStorage.setItem("travel_bookings", JSON.stringify(all)); } catch {} }
        window.OrderStats?.autoWrite(true);
        window.showToast?.("✅ Đã gửi thông báo chuyển khoản. Đơn đang chờ admin đối chiếu; đây chưa phải xác nhận đã nhận tiền.", "success");
        paint();
      });
      modal.querySelectorAll("[data-copy]").forEach(btn =>
        btn.addEventListener("click", () => copy(btn.dataset.copy, btn)));
      modal.querySelectorAll(".pay-opt").forEach(btn =>
        btn.addEventListener("click", () => {
          mode = btn.dataset.mode;
          saveChoice(b, mode, true);
          paint();
          window.renderHome?.();   // cập nhật thẻ tour phía sau
        }));
    }
    if (first) saveChoice(b, mode);
    paint();
  }

  return { open, payCodeOf, amountDue, isConfigured, load, config: SEPAY_CONFIG };
})();
window.Payment = Payment;
