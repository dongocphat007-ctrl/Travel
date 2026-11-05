/**
 * js/tour-popup.js – NEW-13: popup chung cho mọi marker tour trên bản đồ (bản đồ thế giới, trang Tìm Tour).
 * Nội dung: ảnh · tên · thời lượng/điểm đến · giá · ★ điểm đánh giá · số đánh giá · lượt đặt · nút "Xem chi tiết".
 *   • Ảnh: TourImages.attach (ảnh Admin đặt, hoặc ảnh Wikipedia theo địa danh; lỗi/không có → emoji của tour).
 *   • Điểm đánh giá + lượt đặt: GET /api/tours/stats (đơn thật không hủy + số liệu mẫu); không có server → data/tour-stats.json.
 *     Tour chưa có số liệu → "Chưa có đánh giá" / "Chưa có lượt đặt" (không bịa số).
 *   • "Xem chi tiết" đi qua TourPage.open để nút Quay lại hoạt động; không có thì dùng href #/tour/ID.
 * Phần thuần (html, statsText, money…) chạy được trong Node bằng require().
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.TourPopup = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  var TTL = 60000;                                      // nhớ số liệu 60 giây
  var NOTE = { country: "Vị trí đại diện của quốc gia", province: "Vị trí đại diện của tỉnh/thành", place: "Vị trí gần đúng của điểm đến" };

  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nf(n) { return new Intl.NumberFormat("vi-VN").format(n); }
  function money(v) { v = Number(v); return v > 0 ? "Từ " + nf(v) + " ₫/người" : "Liên hệ để báo giá"; }
  function noteFor(precision) { return NOTE[precision] || ""; }

  /** stat: { used, reviews, rating } hoặc undefined (chưa tải) / null (tour không có số liệu). */
  function statsText(stat) {
    if (stat === undefined) return { rating: "", booked: "" };
    var rating = stat && stat.rating > 0
      ? "★ " + Number(stat.rating).toFixed(1) + (stat.reviews > 0 ? " (" + nf(stat.reviews) + " đánh giá)" : "")
      : "Chưa có đánh giá";
    var booked = stat && stat.used > 0 ? nf(stat.used) + " lượt đặt" : "Chưa có lượt đặt";
    return { rating: rating, booked: booked };
  }

  /**
   * t: { id, name, price, duration, city|place, emoji, image, imageQuery, dest, note?, precision? }
   * stat tuỳ chọn: có sẵn thì điền luôn, không thì để trống để hydrate() điền sau khi tải số liệu.
   */
  function html(t, stat) {
    var id = esc(t.id), s = statsText(stat), place = t.place || t.city || "";
    var meta = [t.duration, place].filter(Boolean).map(esc).join(" · ");
    var note = t.note != null ? t.note : noteFor(t.precision);
    return '<div class="tpop" data-tour-id="' + id + '">' +
      '<div class="tpop-img" data-tour-img data-tour-id="' + id + '" data-name="' + esc(t.name) + '" data-image="' + esc(t.image || "") + '"' +
        ' data-query="' + esc(t.imageQuery || "") + '" data-dest="' + esc(t.dest || place) + '"><span class="tpop-emoji" aria-hidden="true">' + esc(t.emoji || "🧳") + '</span></div>' +
      '<div class="tpop-body">' +
        '<strong class="tpop-name">' + esc(t.name) + '</strong>' +
        (meta ? '<div class="tpop-meta">' + meta + '</div>' : "") +
        '<div class="tpop-price">' + esc(money(t.price)) + '</div>' +
        '<div class="tpop-stats"><span class="tpop-rate" data-slot="rating">' + esc(s.rating) + '</span><span class="tpop-booked" data-slot="booked">' + esc(s.booked) + '</span></div>' +
        (note ? '<div class="tpop-note">' + esc(note) + '</div>' : "") +
        '<a class="tpop-btn" href="#/tour/' + encodeURIComponent(t.id) + '" data-tpop-open="' + id + '">Xem chi tiết →</a>' +
      '</div></div>';
  }

  var pure = { html: html, statsText: statsText, money: money, noteFor: noteFor, esc: esc };
  if (!win || !win.document) return pure;

  // ───────────── Phần trình duyệt ─────────────
  var doc = win.document, cache = null, cacheAt = 0, inflight = null;

  function toMap(list) {
    var m = new Map();
    (list || []).forEach(function (x) { m.set(String(x.tourId), { used: Number(x.used || x.count || 0), reviews: Number(x.reviews || 0), rating: Number(x.rating || 0) }); });
    return m;
  }
  function loadStats() {
    if (cache && Date.now() - cacheAt < TTL) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = win.fetch("/api/tours/stats").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { return toMap(d.stats); })
      .catch(function () { return win.fetch("data/tour-stats.json").then(function (r) { return r.json(); }).then(function (d) { return toMap(d.tours); }); })
      .catch(function () { return new Map(); })
      .then(function (m) { cache = m; cacheAt = Date.now(); inflight = null; return m; });
    return inflight;
  }

  /** Điền ảnh + số liệu cho popup vừa mở. el = phần tử gốc của popup (Leaflet popup.getElement()). */
  function hydrate(el) {
    var box = el && el.querySelector && el.querySelector(".tpop");
    if (!box || box.dataset.tpopDone) return;
    box.dataset.tpopDone = "1";
    var img = box.querySelector("[data-tour-img]"), id = box.dataset.tourId;
    if (img && win.TourImages && win.TourImages.attach)
      win.TourImages.attach(img, { id: id, name: img.dataset.name, image: img.dataset.image, imageQuery: img.dataset.query, destination: img.dataset.dest });
    loadStats().then(function (m) {
      var s = statsText(m.get(String(id)) || null), r = box.querySelector('[data-slot="rating"]'), b = box.querySelector('[data-slot="booked"]');
      if (r) r.textContent = s.rating;
      if (b) b.textContent = s.booked;
    });
  }

  /** Gắn hydrate vào mọi popup của bản đồ Leaflet (gọi nhiều lần cũng chỉ gắn một lần). */
  function bindMap(map) {
    if (!map || map.__tpop) return;
    map.__tpop = true;
    map.on("popupopen", function (e) { hydrate(e.popup && e.popup.getElement && e.popup.getElement()); });
  }

  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-tpop-open]");
    if (!a) return;
    if (win.TourPage && win.TourPage.open) { e.preventDefault(); win.TourPage.open(a.dataset.tpopOpen); }
  });

  pure.loadStats = loadStats; pure.hydrate = hydrate; pure.bindMap = bindMap;
  return pure;
});
