/**
 * shared/review-schema.js – NGUỒN DUY NHẤT về cấu trúc + kiểm tra hợp lệ của Review (mục 6.1, 6.3)
 * Dùng chung cho Server (require) và Trình duyệt (window.ReviewSchema), giống shared/pricing.js.
 *
 * Review công khai (GET /api/reviews) có dạng:
 *   { id, tourId, name, rating(1–5), content, date("YYYY-MM-DD"),
 *     criteria?: { guide|transport|food|hotel|value: 1–5 },   // điểm thành phần, tuỳ chọn
 *     image?: "https://… hoặc img/…",                          // ảnh minh hoạ, tuỳ chọn
 *     source: "verified" | "admin" | "demo",                    // NGUỒN (6.12) – do server đặt, client không gửi được
 *     createdAt (ISO, dùng để sắp xếp), sample? (bình luận mẫu) }
 * Nguồn: verified = khách đã hoàn thành tour viết qua POST /api/reviews · admin = Admin gửi thử (không phải khách thật)
 *        · demo = bình luận mẫu trong data/reviews-seed.json (KHÔNG phải khách thật, UI luôn ghi rõ "mẫu").
 * Server lưu thêm userId (nội bộ, KHÔNG trả ra ngoài).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ReviewSchema = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var LIMITS = { ratingMin: 1, ratingMax: 5, contentMin: 5, contentMax: 1000, imageMax: 500 };
  var CRITERIA = { guide: "Hướng dẫn viên", transport: "Di chuyển", food: "Ăn uống", hotel: "Lưu trú", value: "Đáng tiền" };

  // Số nguyên 1–5 THẬT: chấp nhận 4 hoặc "4"; từ chối 4.5, true, null, [], "", "abc", NaN
  function toRating(v) {
    if (typeof v === "boolean" || v === null || v === undefined) return NaN;
    if (typeof v === "string" && !/^\s*\d+\s*$/.test(v)) return NaN;
    if (typeof v !== "number" && typeof v !== "string") return NaN;
    var n = +v;
    return Number.isInteger(n) && n >= LIMITS.ratingMin && n <= LIMITS.ratingMax ? n : NaN;
  }

  // Chỉ cho https/http hoặc đường dẫn nội bộ img/… (chặn javascript:, data:, ../)
  function safeImage(s) {
    if (typeof s !== "string" || !s || s.length > LIMITS.imageMax) return false;
    if (/^https?:\/\/[^\s<>"'`]+$/i.test(s)) return true;
    return /^img\/[A-Za-z0-9_\-.\/]+$/.test(s) && s.indexOf("..") < 0;
  }

  /**
   * Kiểm tra dữ liệu người dùng gửi (chỉ rating/content/criteria/image).
   * @return { ok:true, value:{rating,content,criteria?,image?} } | { ok:false, msg, field }
   */
  function validateInput(b) {
    b = b || {};
    var fail = function (field, msg) { return { ok: false, field: field, msg: msg }; };
    var rating = toRating(b.rating);
    if (isNaN(rating)) return fail("rating", "Điểm đánh giá phải là số nguyên từ 1 đến 5 sao");
    if (typeof b.content !== "string") return fail("content", "Vui lòng nhập nội dung đánh giá");
    var content = b.content.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!content) return fail("content", "Nội dung đánh giá không được để trống");
    if (content.length < LIMITS.contentMin) return fail("content", "Nội dung ít nhất " + LIMITS.contentMin + " ký tự");
    if (content.length > LIMITS.contentMax) return fail("content", "Nội dung tối đa " + LIMITS.contentMax + " ký tự (hiện " + content.length + ")");
    var value = { rating: rating, content: content };

    if (b.criteria !== undefined && b.criteria !== null) {
      if (typeof b.criteria !== "object" || Array.isArray(b.criteria)) return fail("criteria", "Điểm thành phần không hợp lệ");
      var c = {};
      for (var k in b.criteria) {
        if (!Object.prototype.hasOwnProperty.call(b.criteria, k)) continue;
        if (!Object.prototype.hasOwnProperty.call(CRITERIA, k)) return fail("criteria", "Tiêu chí không hợp lệ: " + k);
        var s = toRating(b.criteria[k]);
        if (isNaN(s)) return fail("criteria", "Điểm \"" + CRITERIA[k] + "\" phải từ 1 đến 5");
        c[k] = s;
      }
      if (Object.keys(c).length) value.criteria = c;
    }
    if (b.image !== undefined && b.image !== null && b.image !== "") {
      if (!safeImage(b.image)) return fail("image", "Ảnh phải là liên kết https hoặc đường dẫn img/… hợp lệ (tối đa " + LIMITS.imageMax + " ký tự)");
      value.image = b.image;
    }
    return { ok: true, value: value };
  }

  // Dạng công khai của 1 review đã lưu: bỏ userId, bổ sung date cho dữ liệu cũ/mẫu chưa có
  function toPublic(r) {
    var created = String(r.createdAt || "");
    var o = {
      id: r.id, tourId: String(r.tourId), name: r.name || "Khách", rating: r.rating, content: r.content,
      date: r.date || created.slice(0, 10), createdAt: r.createdAt
    };
    if (r.criteria) o.criteria = r.criteria;
    if (r.image && safeImage(r.image)) o.image = r.image;
    if (r.sample) o.sample = true;
    o.source = r.sample ? "demo" : (r.source === "admin" ? "admin" : "verified");
    return o;
  }

  // Chỉ lấy điểm hợp lệ (số nguyên 1–5) của danh sách review; phần tử rác bị bỏ qua
  function ratingsOf(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var n = toRating(r && r.rating);
      if (!isNaN(n)) out.push(n);
    });
    return out;
  }

  /**
   * 6.4 Điểm trung bình, làm tròn 1 chữ số thập phân (nửa làm tròn lên). Không có review → 0.
   * Làm tròn bằng số nguyên (round(tổng*10 / n)) để tránh lỗi số thực kiểu 3.25 → 3.2.
   */
  function average(list) {
    var r = ratingsOf(list);
    if (!r.length) return 0;
    var sum = r.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum * 10 / r.length) / 10;
  }

  /**
   * 6.5 Phân bố theo sao: { counts:{5,4,3,2,1}, percent:{5,4,3,2,1}, total }
   * percent là số nguyên, tổng luôn = 100 khi có review (chia phần dư theo phương pháp "phần dư lớn nhất"); total = 0 → toàn 0.
   */
  function distribution(list) {
    var r = ratingsOf(list), counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, percent = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    r.forEach(function (n) { counts[n]++; });
    var total = r.length;
    if (total) {
      var used = 0, rem = [];
      [5, 4, 3, 2, 1].forEach(function (k) {
        var exact = counts[k] * 100 / total, fl = Math.floor(exact);
        percent[k] = fl; used += fl; rem.push({ k: k, frac: exact - fl });
      });
      rem.sort(function (a, b) { return b.frac - a.frac || b.k - a.k; });
      for (var i = 0; i < 100 - used; i++) percent[rem[i].k]++;
    }
    return { counts: counts, percent: percent, total: total };
  }

  /**
   * 6.11 Điểm TB từng tiêu chí: { guide:{avg,n}, … } — CHỈ có khoá của tiêu chí có ít nhất 1 điểm (không bịa số cho tiêu chí chưa ai chấm)
   */
  function criteriaAverages(list) {
    var acc = {};
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var c = r && r.criteria;
      if (!c || typeof c !== "object") return;
      Object.keys(CRITERIA).forEach(function (k) {
        if (!Object.prototype.hasOwnProperty.call(c, k)) return;
        var n = toRating(c[k]);
        if (isNaN(n)) return;
        (acc[k] = acc[k] || []).push(n);
      });
    });
    var out = {};
    Object.keys(acc).forEach(function (k) { out[k] = { avg: average(acc[k].map(function (v) { return { rating: v }; })), n: acc[k].length }; });
    return out;
  }

  return { average: average, criteriaAverages: criteriaAverages, distribution: distribution, LIMITS: LIMITS, CRITERIA: CRITERIA, toRating: toRating, safeImage: safeImage, validateInput: validateInput, toPublic: toPublic };
});
