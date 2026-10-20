/**
 * shared/guide-availability.js – NGUỒN DUY NHẤT kiểm tra lịch rảnh của hướng dẫn viên (mục 5.6)
 * Dùng chung cho Server (require) và Trình duyệt (window.GuideAvailability), giống shared/pricing.js.
 *
 * Quy ước: ngày là chuỗi "YYYY-MM-DD". Mọi phép cộng ngày làm theo UTC thuần → không lệch
 * do múi giờ / giờ mùa hè của máy người dùng (new Date("2026-11-02") cục bộ có thể ra ngày 1 hoặc 2).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GuideAvailability = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_DAYS = 366;   // chặn vòng lặp vô hạn nếu truyền nDays quá lớn

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // "YYYY-MM-DD" hợp lệ thật (từ chối 2026-02-30, 2026-13-01…) → timestamp UTC 00:00, ngược lại NaN
  function toUTC(s) {
    if (typeof s !== "string" || !DATE_RE.test(s)) return NaN;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    var t = Date.UTC(y, m - 1, d);
    var back = new Date(t);
    return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? t : NaN;
  }

  function fromUTC(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  // Danh sách n ngày liên tiếp bắt đầu từ startDate (gồm cả ngày đầu). Đầu vào sai → []
  function rangeDays(startDate, nDays) {
    var t0 = toUTC(startDate), n = Math.floor(+nDays);
    if (isNaN(t0) || !(n >= 1) || n > MAX_DAYS) return [];
    var out = [];
    for (var i = 0; i < n; i++) out.push(fromUTC(t0 + i * 86400000));
    return out;
  }

  // Ngày bận hợp lệ của guide (bỏ phần tử sai định dạng / không phải ngày thật)
  function busySet(guide) {
    var list = guide && Array.isArray(guide.busyDates) ? guide.busyDates : [];
    var set = {};
    list.forEach(function (d) { if (!isNaN(toUTC(d))) set[d] = true; });
    return set;
  }

  /**
   * true  ⇔ CẢ nDays ngày liên tiếp (từ startDate, gồm startDate) đều không nằm trong guide.busyDates
   * false ⇔ có ít nhất 1 ngày bận, HOẶC đầu vào không hợp lệ (không có guide, ngày sai, nDays < 1…)
   * (không chắc chắn thì coi là "không rảnh" → không bao giờ cho đặt nhầm)
   */
  function isFreeRange(guide, startDate, nDays) {
    if (!guide || typeof guide !== "object") return false;
    var days = rangeDays(startDate, nDays);
    if (days.length === 0) return false;
    var busy = busySet(guide);
    for (var i = 0; i < days.length; i++) if (busy[days[i]]) return false;
    return true;
  }

  // Các ngày bận nằm trong khoảng (để báo lý do cho người dùng)
  function busyInRange(guide, startDate, nDays) {
    var busy = busySet(guide);
    return rangeDays(startDate, nDays).filter(function (d) { return busy[d]; });
  }

  return { isFreeRange: isFreeRange, busyInRange: busyInRange, rangeDays: rangeDays, toUTC: toUTC };
});
