/**
 * route-map.js – Hero trang chủ: bản đồ "Tuyến Bắc–Nam" + bốn nút vùng.
 *   - Mỗi chấm là một tỉnh (tọa độ trung tâm tỉnh); bán kính theo số tour của tỉnh đó.
 *   - Bấm chấm / nút vùng = đổi bộ lọc có sẵn của trang chủ (regionMode, provMode) rồi cuộn tới danh sách.
 *   - Không có tile bản đồ ngoài: hình chữ S của đất nước hiện ra từ chính các chấm, chạy được khi offline.
 * Phụ thuộc: home.js (TOUR_SAMPLES, REGION_PROVINCES, provincesOf, regionMode, provMode, srcMode,
 *            renderAdvFilter, renderRegionFilter, renderTours)
 */
(function () {
  "use strict";

  // [vĩ độ, kinh độ] trung tâm tỉnh (gần đúng, chỉ dùng để vẽ)
  var COORDS = {
    "Hà Nội": [21.03, 105.85], "Hải Phòng": [20.84, 106.69], "Quảng Ninh": [21.01, 107.29], "Bắc Ninh": [21.19, 106.07],
    "Bắc Giang": [21.27, 106.19], "Hải Dương": [20.94, 106.33], "Hưng Yên": [20.65, 106.05], "Hà Nam": [20.54, 105.92],
    "Nam Định": [20.42, 106.17], "Thái Bình": [20.45, 106.34], "Ninh Bình": [20.25, 105.97], "Vĩnh Phúc": [21.31, 105.60],
    "Phú Thọ": [21.32, 105.40], "Thái Nguyên": [21.59, 105.84], "Bắc Kạn": [22.15, 105.83], "Cao Bằng": [22.67, 106.26],
    "Lạng Sơn": [21.85, 106.76], "Hà Giang": [22.82, 104.98], "Tuyên Quang": [21.82, 105.21], "Lào Cai": [22.48, 103.97],
    "Yên Bái": [21.72, 104.91], "Lai Châu": [22.40, 103.46], "Điện Biên": [21.39, 103.02], "Sơn La": [21.33, 103.91],
    "Hòa Bình": [20.81, 105.34],
    "Thanh Hóa": [19.81, 105.78], "Nghệ An": [19.23, 104.92], "Hà Tĩnh": [18.34, 105.91], "Quảng Bình": [17.47, 106.62],
    "Quảng Trị": [16.82, 107.10], "Thừa Thiên Huế": [16.46, 107.59], "Đà Nẵng": [16.05, 108.21], "Quảng Nam": [15.57, 108.47],
    "Quảng Ngãi": [15.12, 108.80], "Bình Định": [13.78, 109.22], "Phú Yên": [13.09, 109.31], "Khánh Hòa": [12.24, 109.19],
    "Ninh Thuận": [11.57, 108.99], "Kon Tum": [14.35, 108.00], "Gia Lai": [13.98, 108.00], "Đắk Lắk": [12.71, 108.24],
    "Đắk Nông": [12.00, 107.69], "Lâm Đồng": [11.94, 108.44],
    "TP. Hồ Chí Minh": [10.78, 106.70], "Bà Rịa – Vũng Tàu": [10.35, 107.08], "Bình Dương": [11.00, 106.65],
    "Bình Phước": [11.75, 106.72], "Đồng Nai": [10.95, 107.00], "Tây Ninh": [11.31, 106.10], "Bình Thuận": [11.09, 108.07],
    "Long An": [10.54, 106.41], "Tiền Giang": [10.36, 106.36], "Bến Tre": [10.24, 106.38], "Vĩnh Long": [10.25, 105.97],
    "Trà Vinh": [9.93, 106.34], "Đồng Tháp": [10.46, 105.63], "An Giang": [10.52, 105.13], "Kiên Giang": [10.01, 105.08],
    "Cần Thơ": [10.04, 105.78], "Hậu Giang": [9.78, 105.47], "Sóc Trăng": [9.60, 105.97], "Bạc Liêu": [9.29, 105.72],
    "Cà Mau": [9.18, 105.15]
  };
  var REGIONS = ["Miền Bắc", "Miền Trung", "Miền Nam"];
  var W = 330, H = 650;

  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var nf = function (n) { return Number(n).toLocaleString("vi-VN"); };
  var proj = function (c) { return [20 + (c[1] - 102.05) * 40, 16 + (23.6 - c[0]) * 40.4]; };

  function stats() {
    var byProv = {}, byRegion = { "Miền Bắc": 0, "Miền Trung": 0, "Miền Nam": 0, "Quốc tế": 0 };
    (window.TOUR_SAMPLES || []).forEach(function (t) {
      if (t.src === "intl" || t.region === "Quốc tế") { byRegion["Quốc tế"]++; return; }
      if (byRegion[t.region] != null) byRegion[t.region]++;
      (provincesOf(t) || []).forEach(function (p) { byProv[p] = (byProv[p] || 0) + 1; });
    });
    return { prov: byProv, region: byRegion };
  }

  function apply(region, prov) {
    regionMode = region; provMode = prov || "all";
    if (typeof renderAdvFilter === "function") renderAdvFilter();
    if (typeof renderRegionFilter === "function") renderRegionFilter();
    renderTours();
    var sec = el("sec-tours");
    if (sec) sec.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function drawRegions(st) {
    var box = el("hmRegions"); if (!box) return;
    var items = REGIONS.concat(["Quốc tế"]);
    box.innerHTML = items.map(function (r) {
      var on = regionMode === r;
      return '<button type="button" class="hm-reg' + (on ? " is-on" : "") + '" data-region="' + esc(r) + '" aria-pressed="' + on + '">'
        + '<span class="hm-reg-n">' + nf(st.region[r] || 0) + '</span><span class="hm-reg-l">' + esc(r) + "</span></button>";
    }).join("");
  }

  function drawMap(st) {
    var box = el("routeMap"); if (!box) return;
    var dots = [];
    REGIONS.forEach(function (r) {
      (REGION_PROVINCES[r] || []).forEach(function (p) {
        var c = COORDS[p]; if (!c) return;
        var xy = proj(c), n = st.prov[p] || 0;
        var rad = 3.5 + Math.sqrt(n) * 2.1;
        var cls = "rm-dot";
        if (regionMode !== "all" && regionMode !== r) cls += " is-dim";
        if (provMode === p) cls += " is-sel";
        var left = xy[0] > 215;
        dots.push('<g class="' + cls + '" data-region="' + esc(r) + '" data-prov="' + esc(p) + '" tabindex="0" role="button" aria-label="' + esc(p) + ", " + n + ' tour" transform="translate(' + xy[0].toFixed(1) + " " + xy[1].toFixed(1) + ')">'
          + '<circle class="rm-hit" r="' + Math.max(rad, 11).toFixed(1) + '"/><circle class="rm-c" r="' + rad.toFixed(1) + '"/>'
          + '<text class="rm-t" x="' + (left ? -(rad + 6) : rad + 6).toFixed(1) + '" y="4" text-anchor="' + (left ? "end" : "start") + '">' + esc(p) + " · " + n + "</text></g>");
      });
    });
    // chấm đang chọn vẽ sau cùng để nhãn nằm trên
    dots.sort(function (a, b) { return (a.indexOf("is-sel") > 0) - (b.indexOf("is-sel") > 0); });
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="group" aria-label="Số tour theo tỉnh, từ Bắc xuống Nam" focusable="false">' + dots.join("") + "</svg>";
  }

  function update() {
    var st = stats();
    drawRegions(st);
    drawMap(st);
  }

  function bind() {
    var regs = el("hmRegions"), map = el("routeMap");
    if (regs) regs.addEventListener("click", function (e) {
      var b = e.target.closest("[data-region]"); if (!b) return;
      var r = b.dataset.region;
      apply(regionMode === r && provMode === "all" ? "all" : r, "all");   // bấm lần nữa để bỏ lọc
    });
    if (map) {
      var pick = function (g) { if (g) apply(g.dataset.region, provMode === g.dataset.prov && regionMode === g.dataset.region ? "all" : g.dataset.prov); };
      map.addEventListener("click", function (e) { pick(e.target.closest("[data-prov]")); });
      map.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { var g = e.target.closest("[data-prov]"); if (g) { e.preventDefault(); pick(g); } }
      });
    }
    var cta = el("hm-cta"), mk = el("hm-create");
    if (cta) cta.addEventListener("click", function () { var s = el("sec-tours"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); });
    if (mk) mk.addEventListener("click", function () { var b = el("nav-create-trip-btn"); if (b) b.click(); });
  }

  function init() { bind(); update(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.RouteMap = { update: update };
})();
