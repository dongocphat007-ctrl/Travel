/**
 * otp.js – Xác thực OTP qua email, do SPRING BOOT sinh mã, gửi email và kiểm tra
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
