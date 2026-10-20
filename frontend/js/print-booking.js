/**
 * js/print-booking.js – Giai đoạn 10.8/10.9: print.html?bookingId=TRAVEL123  → dựng bố cục A4 từ booking + breakdown, nút "Tải PDF" = window.print().
 * CHỈNH 3 hằng dưới cho khớp API thật. API có thể trả { booking, breakdown } hoặc booking có sẵn field breakdown.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./format-breakdown.js"));
  else factory(root.TravelFormat, root);
})(typeof self !== "undefined" ? self : this, function (F, root) {
  const BOOKING_API = "/api/bookings/";        // GET /api/bookings/<id>
  const TOKEN_KEY = "token";                   // khoá localStorage đang lưu token đăng nhập
  const STATUS = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã huỷ" };

  /** Hàm thuần (test được trong Node): trả HTML bên trong .sheet. */
  function buildPrintHtml(booking, breakdown) {
    const i = F.bookingInfo(booking), esc = F.escapeHtml;
    const row = (k, v) => (v ? `<tr><td>${k}</td><td>${esc(v)}</td></tr>` : "");
    const money = F.breakdownRows(breakdown).map((r) => `<tr class="${/^(Giá cuối|Đặt cọc)/.test(r.label) ? "strong" : ""}"><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`).join("");
    return `<div class="head"><div><h1>Travel</h1><div>Xác nhận đặt tour</div></div><div class="code">Mã đơn<b>${esc(i.id)}</b></div></div>`
      + `<h2>Thông tin khách hàng</h2><table>${row("Họ tên", i.name)}${row("Điện thoại", i.phone)}${row("Email", i.email)}</table>`
      + `<h2>Chi tiết tour</h2><table>${row("Tour", i.tour)}${row("Khởi hành", i.date)}${row("Số người", i.people)}${row("Trạng thái", STATUS[i.status] || i.status)}</table>`
      + (money ? `<h2>Thanh toán</h2><table class="money">${money}</table>` : "")
      + `<p class="foot">Vui lòng giữ mã đơn ${esc(i.id)} khi chuyển khoản. Tài liệu được tạo tự động.</p>`;
  }

  if (root && root.document) {
    const sheet = root.document.getElementById("sheet");
    const id = new URLSearchParams(root.location.search).get("bookingId");
    root.document.getElementById("btn-pdf").addEventListener("click", () => root.print());
    if (!id) sheet.innerHTML = '<p class="error">Thiếu tham số bookingId.</p>';
    else {
      const token = (function () { try { return root.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } })();
      root.fetch(BOOKING_API + encodeURIComponent(id), { headers: token ? { Authorization: "Bearer " + token } : {} })
        .then((r) => { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Bạn cần đăng nhập để xem đơn này." : "Không tìm thấy đơn " + id); return r.json(); })
        .then((d) => { const b = d.booking || d; sheet.innerHTML = buildPrintHtml(b, d.breakdown || b.breakdown); root.document.title = "Xác nhận " + id; })
        .catch((e) => { sheet.innerHTML = '<p class="error">' + F.escapeHtml(e.message) + "</p>"; });
    }
  }
  return { buildPrintHtml };
});
