/**
 * js/tour-location-map.js – Map nhỏ ở trang chi tiết tour (mục 8.1 → 8.4)
 * 8.1 Thư viện: Leaflet 1.9.4 qua cdnjs (đã nạp sẵn trong index.html).
 *     Basemap dùng chung trong js/map-basemap.js: Google Maps (tiếng Việt) nếu có key, không thì OpenStreetMap,
 *     hoặc MapTiler custom style khi cấu hình public browser key + style ID.
 *   TourLocationMap.show(el, loc, opts)   → vẽ/di chuyển marker theo loc.lat/lng (thuần, test được bằng Leaflet giả: opts.L)
 *   TourLocationMap.renderMap(el, tourId) → lấy toạ độ tour (Weather.locationOf → /api/locations) rồi show()
 *   TourLocationMap.destroy()             → gỡ map đang giữ
 * Dùng được cả trong Node để kiểm thử (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./map-basemap.js"));
  else root.TourLocationMap = factory(root.TravelMapTiles);
})(typeof self !== "undefined" ? self : this, function (mapTiles) {
  var NO_LOC = "Chưa có vị trí của tour trên bản đồ";
  var NO_LIB = "Chưa tải được bản đồ (kiểm tra kết nối mạng)";
  var ZOOM = { city: 10, province: 8, country: 5 };      // theo độ chính xác trong data/locations.json
  var inst = null;                                       // { el, map, marker } — chỉ giữ MỘT map nhỏ (modal chi tiết chỉ mở một cái)
  var seq = 0;                                           // chống "kết quả về trễ" khi mở tour khác liên tiếp

  function num(v) { return typeof v === "string" && v.trim() !== "" ? +v : v; }
  function pin(loc) {                                    // 8.3 toạ độ hợp lệ hoặc null (không bịa vị trí)
    if (!loc) return null;
    var lat = num(loc.lat !== undefined ? loc.lat : loc.latitude), lng = num(loc.lng !== undefined ? loc.lng : loc.longitude);
    if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }
  function zoomFor(loc) { return ZOOM[loc && loc.precision] || 8; }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function note(loc) {                                   // nói rõ khi chỉ là vị trí đại diện
    if (!loc || loc.precision === "city") return "";
    return loc.precision === "country" ? "Vị trí đại diện của quốc gia, không phải địa chỉ chính xác." : "Vị trí đại diện của tỉnh/thành, không phải địa chỉ chính xác.";
  }

  function destroy() {
    if (inst) { try { inst.map.remove(); } catch (e) { /* container đã bị gỡ */ } inst = null; }
  }

  /**
   * 8.2 + 8.3 + 8.4 Hiển thị map trong el, marker ở (lat,lng).
   * Cùng el → chỉ dời marker + setView (không tạo map mới). El khác (mở tour khác = modal mới) → gỡ map cũ rồi tạo lại.
   * Trả { ok, moved?, reason? }.
   */
  function show(el, loc, opts) {
    opts = opts || {};
    var L = opts.L || (typeof window !== "undefined" ? window.L : null);
    if (!el) return { ok: false, reason: "no-container" };
    var p = pin(loc);
    if (!p) { destroy(); el.innerHTML = '<div class="tlm-empty">' + NO_LOC + '</div>'; return { ok: false, reason: "no-coords" }; }
    if (!L || typeof L.map !== "function") { destroy(); el.innerHTML = '<div class="tlm-empty">' + NO_LIB + '</div>'; return { ok: false, reason: "no-leaflet" }; }
    var z = zoomFor(loc), popup = '<strong>' + esc(loc.name || loc.city || "Điểm đến") + '</strong>' + (loc.city && loc.name ? '<br><small>' + esc(loc.city) + (loc.country ? ", " + esc(loc.country) : "") + '</small>' : "");

    if (inst && inst.el === el) {                                       // 8.4 cùng khung: dời marker
      inst.marker.setLatLng([p.lat, p.lng]);
      if (inst.marker.setPopupContent) inst.marker.setPopupContent(popup);
      inst.map.setView([p.lat, p.lng], z);
      return { ok: true, moved: true };
    }
    destroy();
    el.innerHTML = "";
    var map = L.map(el, { center: [p.lat, p.lng], zoom: z, zoomControl: true, scrollWheelZoom: false });   // tắt zoom bằng cuộn để khỏi vướng cuộn modal
    mapTiles.createLayer(L).addTo(map);
    var icon = L.divIcon({ html: '<span style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">📍</span>', className: "tlm-pin", iconSize: [28, 34], iconAnchor: [14, 32], popupAnchor: [0, -30] });
    var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(popup);
    inst = { el: el, map: map, marker: marker };
    // Modal vừa hiện / đang cuộn: Leaflet cần tính lại kích thước để không bị xám/lệch
    if (typeof setTimeout === "function") setTimeout(function () { if (inst && inst.map === map) { try { map.invalidateSize(); } catch (e) {} } }, 250);
    return { ok: true, moved: false };
  }

  /** Lấy toạ độ của tour rồi vẽ. Lỗi/thiếu toạ độ → thông báo trong khung, không ném lỗi. Gọi lại cho tour khác → map chuyển vị trí. */
  async function renderMap(el, tourId, opts) {
    if (!el) return { ok: false, reason: "no-container" };
    var my = ++seq, loc = null;
    try {
      var W = (opts && opts.Weather) || (typeof window !== "undefined" ? window.Weather : null);
      loc = W && W.locationOf ? await W.locationOf(tourId) : null;
    } catch (e) { loc = null; }
    if (my !== seq || el.isConnected === false) return { ok: false, reason: "stale" };    // người dùng đã mở tour khác / đóng modal
    var r = show(el, loc, opts);
    var cap = el.parentNode && el.parentNode.querySelector ? el.parentNode.querySelector(".tlm-note") : null;
    if (cap) cap.textContent = r.ok ? note(loc) : "";
    return r;
  }

  return { show: show, renderMap: renderMap, destroy: destroy, pin: pin, zoomFor: zoomFor, note: note, NO_LOC: NO_LOC, NO_LIB: NO_LIB, _state: function () { return inst; } };
});
