/**
 * js/format-breakdown.js – định dạng breakdown giá + đọc field của booking. Chạy được cả Node (require) lẫn trình duyệt (window.TravelFormat),
 * nên email, trang in print.html cùng dùng MỘT nguồn. server/format-breakdown.js chỉ re-export file này.
 * Các tên field chấp nhận vài alias — chỉnh FIELDS / bookingInfo cho khớp calcPriceBreakdown và booking thật.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TravelFormat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FIELDS = {
    base:        ["basePrice", "originalPrice", "base", "subtotal"],
    discount:    ["discount", "discountAmount"],
    voucherCode: ["voucherCode", "voucher"],
    final:       ["finalPrice", "total", "final"],
    deposit:     ["deposit", "depositAmount"],
    depositRate: ["depositRate", "depositPct"],   // [MERGE] shared/pricing.js của A trả depositPct (20)
    remaining:   ["remaining", "balance"],
  };

  const pick = (b, names) => { for (const n of names) if (b[n] !== undefined && b[n] !== null && b[n] !== "") return b[n]; return undefined; };
  const money = (n) => Number(n).toLocaleString("vi-VN") + "đ";
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** [{ label, value }] — mọi kênh (text, bảng HTML, PDF…) dựng từ đây. */
  function breakdownRows(breakdown) {
    const b = breakdown || {}, v = {};
    Object.keys(FIELDS).forEach((k) => { v[k] = pick(b, FIELDS[k]); });
    const rows = [];
    if (v.base !== undefined) rows.push({ label: "Giá gốc", value: money(v.base) });
    if (Number(v.discount) > 0) rows.push({ label: "Giảm giá" + (v.voucherCode ? ` (${v.voucherCode})` : ""), value: "-" + money(v.discount) });
    if (v.final !== undefined) rows.push({ label: "Giá cuối", value: money(v.final) });
    if (v.deposit !== undefined) {
      const rate = v.depositRate !== undefined ? Math.round(Number(v.depositRate) * (Number(v.depositRate) <= 1 ? 100 : 1)) : null;
      rows.push({ label: "Đặt cọc" + (rate ? ` ${rate}%` : ""), value: money(v.deposit) });
      const rest = v.remaining !== undefined ? v.remaining : (v.final !== undefined ? Number(v.final) - Number(v.deposit) : undefined);
      if (rest !== undefined && Number(rest) > 0) rows.push({ label: "Còn lại", value: money(rest) });
    }
    return rows;
  }

  const formatBreakdownText = (breakdown) => breakdownRows(breakdown).map((r) => `${r.label}: ${r.value}`).join("\n");

  /** Đọc thông tin booking (chỉnh alias cho khớp dữ liệu thật). */
  function bookingInfo(b) {
    b = b || {};
    return {
      id: b.id || b.bookingId || "?", tour: b.tourName || b.tour || (b.tourId ? "Tour " + b.tourId : "?"),
      name: b.customerName || b.name || "", phone: b.phone || "", email: b.email || b.userEmail || "",   // [MERGE] booking của A dùng userEmail people: b.travelers || b.people || b.quantity || b.pax,   // [MERGE] booking của A dùng pax
      date: b.startDate || b.date || "", status: b.status || "pending",
    };
  }

  return { FIELDS, money, escapeHtml, breakdownRows, formatBreakdownText, bookingInfo };
});
