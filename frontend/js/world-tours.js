/**
 * js/world-tours.js – Bản đồ thế giới: dropdown quốc gia + danh sách tour bên cạnh (mục 8.5 → 8.8)
 * 8.5 Map lớn giữ NGUYÊN chức năng cũ (tìm quốc gia, nút châu lục, bảng thông tin, chấm quốc gia); module này chỉ lắng nghe qua WorldMap.onFocus.
 * 8.6 Dropdown quốc gia: gộp 30 nước trong WorldMap.countries + mọi nước có tour trong data/locations.json (kèm số tour).
 * 8.7 Chọn quốc gia → lọc danh sách tour (và map bay tới nước đó). Chọn/bấm nước bằng cách khác (ô tìm kiếm, chấm trên map, nút châu lục) cũng đồng bộ dropdown + danh sách.
 * 8.8 Bấm tour trong danh sách → map flyTo đúng toạ độ tour (lat/lng trong locations.json) + ghim popup.
 * Phần logic (buildIndex, filterTours, createController…) thuần, test được trong Node: node scripts/test-world-tours.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WorldTours = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var PAGE = 20;                                         // số tour hiện mỗi lần (Việt Nam có hơn 500 tour)
  var ALIAS = { "Morocco": "Maroc" };                    // bảng WorldMap viết "Morocco", dữ liệu tour viết "Maroc"
  var ZOOM = { city: 11, province: 9, country: 6 };      // theo độ chính xác của toạ độ (data/locations.json)
  var HOME = "Việt Nam";

  function canon(n) { return ALIAS[n] || n; }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function validCoord(a, b) { return typeof a === "number" && typeof b === "number" && isFinite(a) && isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180; }
  function zoomFor(precision) { return ZOOM[precision] || 9; }
  function money(v) { return typeof v === "number" && v > 0 ? new Intl.NumberFormat("vi-VN").format(v) + " ₫" : "Liên hệ"; }

  /**
   * Gộp dữ liệu tour + toạ độ → [{ id, name, price, duration, country, city, lat, lng, precision, hasCoords }].
   * Quốc gia lấy từ locations.json; không có thì từ tour.country; tour trong nước (region khác "Quốc tế") coi là Việt Nam; còn lại bỏ qua.
   */
  function buildTours(tours, locations) {
    var locMap = new Map();
    (locations || []).forEach(function (l) { if (l) locMap.set(String(l.tourId), l); });
    var out = [];
    (tours || []).forEach(function (t) {
      if (!t || t.id == null) return;
      var l = locMap.get(String(t.id)) || null;
      var country = canon((l && l.country) || t.country || (t.region && t.region !== "Quốc tế" ? HOME : ""));
      if (!country) return;
      var lat = l ? +l.lat : NaN, lng = l ? +l.lng : NaN, ok = validCoord(lat, lng);
      out.push({ id: String(t.id), name: t.name || ("Tour " + t.id), price: t.price, duration: t.duration || "", country: country,
        city: (l && l.city) || "", lat: ok ? lat : null, lng: ok ? lng : null, precision: (l && l.precision) || "", hasCoords: ok });
    });
    return out;
  }

  /** Danh sách quốc gia cho dropdown: Việt Nam đứng đầu, còn lại theo A→Z tiếng Việt; mỗi nước kèm số tour, cờ và meta (nếu có trong WorldMap). */
  function buildCountries(tourList, meta) {
    var map = new Map();
    function get(name) { if (!map.has(name)) map.set(name, { name: name, flag: "", count: 0, meta: null }); return map.get(name); }
    (meta || []).forEach(function (m) { var r = get(canon(m.name)); r.flag = m.flag || ""; r.meta = m; });
    (tourList || []).forEach(function (t) { get(t.country).count++; });
    var arr = Array.from(map.values());
    arr.sort(function (a, b) { return a.name === HOME ? -1 : b.name === HOME ? 1 : a.name.localeCompare(b.name, "vi"); });
    return arr;
  }

  function filterTours(tourList, country) {
    return country ? tourList.filter(function (t) { return t.country === country; }) : tourList.slice();
  }

  /**
   * Bộ điều khiển (không đụng DOM): giữ quốc gia đang chọn + số tour đang hiện; gọi ra ngoài qua `world` và `view`.
   *   world: { focusCountry(meta), fitPoints([[lat,lng]…]), flyToTour({name,lat,lng,zoom,note}), clearTourMarker() }
   *   view:  { render(state) , notify(msg) }
   */
  function createController(deps) {
    var tours = [], countries = [], country = "", shown = PAGE, activeId = null;
    var world = deps.world || {}, view = deps.view || {};
    function state() {
      var list = filterTours(tours, country);
      return { country: country, total: list.length, items: list.slice(0, shown), more: Math.max(0, list.length - shown), activeId: activeId, countries: countries, loaded: tours.length > 0 || countries.length > 0 };
    }
    function draw() { if (view.render) view.render(state()); }
    function setData(t, c) { tours = t || []; countries = c || []; draw(); }
    // Người dùng chọn ở dropdown (focus = true → map bay tới nước đó)
    function selectCountry(name, focus) {
      country = name || ""; shown = PAGE; activeId = null;
      if (focus) {
        if (!country) { if (world.clearTourMarker) world.clearTourMarker(); }
        else {
          var row = countries.filter(function (c) { return c.name === country; })[0];
          if (row && row.meta && world.focusCountry) { sync = true; try { world.focusCountry(row.meta); } finally { sync = false; } }   // focusCountry sẽ phát onFocus → bỏ qua vòng lặp
          else if (world.fitPoints) {
            var pts = filterTours(tours, country).filter(function (t) { return t.hasCoords; }).map(function (t) { return [t.lat, t.lng]; });
            if (pts.length) world.fitPoints(pts); else if (view.notify) view.notify("Chưa có toạ độ tour của " + country);
          }
        }
      }
      draw();
    }
    var sync = false;
    // WorldMap báo người dùng vừa chọn quốc gia bằng cách khác (null = "Tất cả châu lục")
    function onWorldFocus(meta) { if (sync) return; selectCountry(meta ? canon(meta.name) : "", false); }
    function more() { shown += PAGE; draw(); }
    function pickTour(id) {
      var t = tours.filter(function (x) { return x.id === String(id); })[0];
      if (!t) return false;
      activeId = t.id; draw();
      if (!t.hasCoords) { if (view.notify) view.notify("Tour này chưa có toạ độ trên bản đồ"); return false; }
      return !!(world.flyToTour && world.flyToTour({ name: t.name, lat: t.lat, lng: t.lng, zoom: zoomFor(t.precision),
        note: (t.city ? t.city + ", " : "") + t.country + (t.precision === "city" ? "" : " · vị trí đại diện, không phải địa chỉ chính xác") }));
    }
    return { setData: setData, selectCountry: selectCountry, onWorldFocus: onWorldFocus, more: more, pickTour: pickTour, state: state };
  }

  // ---------------- Giao diện (DOM) ----------------
  function itemHtml(t, active) {
    return '<div class="wm-tour' + (active ? " on" : "") + '" data-id="' + esc(t.id) + '"><button type="button" class="wm-tour-main" data-act="fly" aria-pressed="' + (active ? "true" : "false") + '">' +
      '<span class="wm-tour-name">' + esc(t.name) + '</span>' +
      '<span class="wm-tour-meta">' + (t.duration ? "⏱ " + esc(t.duration) + " · " : "") + esc(money(t.price)) + (t.city ? " · 📍 " + esc(t.city) : "") + (t.hasCoords ? "" : " · chưa có toạ độ") + '</span></button>' +
      '<a class="wm-tour-link" href="#/tour/' + encodeURIComponent(t.id) + '" title="Xem chi tiết tour" aria-label="Xem chi tiết ' + esc(t.name) + '">Chi tiết →</a></div>';
  }
  function optionsHtml(countries, total) {
    return '<option value="">Tất cả quốc gia (' + total + ' tour)</option>' + countries.map(function (c) {
      return '<option value="' + esc(c.name) + '">' + (c.flag ? esc(c.flag) + " " : "") + esc(c.name) + " (" + c.count + ")</option>";
    }).join("");
  }

  var ctl = null, inited = false;
  async function loadData() {
    var tours = [], locs = [];
    try { if (typeof loadHomeData === "function") await loadHomeData(); } catch (e) { /* dùng dữ liệu đã có */ }
    tours = (typeof window !== "undefined" && window.TOUR_SAMPLES) || [];
    try { var r = await fetch("/api/locations"); if (r.ok) locs = (await r.json()).locations || []; } catch (e) { /* thử file */ }
    if (!locs.length) { try { locs = (await (await fetch("data/locations.json")).json()).locations || []; } catch (e) { locs = []; } }
    return { tours: tours, locs: locs };
  }

  function init() {
    if (inited || typeof document === "undefined") return ctl;
    var sel = document.getElementById("wm-country-select"), box = document.getElementById("wm-tours-list"),
        cnt = document.getElementById("wm-tours-count"), ttl = document.getElementById("wm-tours-title");
    if (!sel || !box || !window.WorldMap) return null;
    inited = true;
    var lastOptions = "";
    ctl = createController({
      world: window.WorldMap,
      view: {
        notify: function (m) { if (typeof showToast === "function") showToast(m, "info"); },
        render: function (s) {
          if (!s.loaded) { box.innerHTML = '<div class="wm-tours-empty">Đang xếp các hành trình theo điểm đến…</div>'; return; }
          var tourTotal = s.countries.reduce(function (a, c) { return a + c.count; }, 0);
          var opts = optionsHtml(s.countries, tourTotal);
          if (opts !== lastOptions) { sel.innerHTML = opts; lastOptions = opts; }
          sel.value = s.countries.some(function (c) { return c.name === s.country; }) ? s.country : "";
          ttl.textContent = s.country ? "Tour tại " + s.country : "Tất cả tour";
          cnt.textContent = s.total + " tour";
          box.innerHTML = s.total ? s.items.map(function (t) { return itemHtml(t, t.id === s.activeId); }).join("") +
            (s.more ? '<button type="button" class="wm-tours-more" data-act="more">Xem thêm (' + s.more + ' tour nữa)</button>' : "")
            : '<div class="wm-tours-empty">' + (s.country ? "Chưa có tour tại " + esc(s.country) + ". Thử chọn điểm đến khác nhé." : "Chưa có tour để hiển thị. Bạn có thể chọn một điểm đến trên bản đồ.") + '</div>';
        }
      }
    });
    sel.addEventListener("change", function () { ctl.selectCountry(sel.value, true); });
    box.addEventListener("click", function (e) {
      var more = e.target.closest && e.target.closest("[data-act=more]");
      if (more) { ctl.more(); return; }
      var link = e.target.closest && e.target.closest(".wm-tour-link");
      if (link) {                                         // "Chi tiết →": đi qua TourPage.open để nút Quay lại hoạt động đúng
        if (typeof TourPage !== "undefined" && TourPage.open) { e.preventDefault(); TourPage.open(link.closest(".wm-tour").dataset.id); }
        return;
      }
      var fly = e.target.closest && e.target.closest("[data-act=fly]");
      if (!fly) return;
      var row = fly.closest(".wm-tour");
      if (ctl.pickTour(row.dataset.id) && window.innerWidth <= 768) {          // màn nhỏ: map nằm dưới/trên danh sách → cuộn tới map
        var m = document.getElementById("wm-map-container"); if (m && m.scrollIntoView) m.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    window.WorldMap.onFocus(ctl.onWorldFocus);
    ctl.setData([], []);
    loadData().then(function (d) {
      var tours = buildTours(d.tours, d.locs);
      ctl.setData(tours, buildCountries(tours, window.WorldMap.countries));
    }).catch(function () { box.innerHTML = '<div class="wm-tours-empty">Chưa tải được danh sách tour. Thử tải lại trang để xem các hành trình nhé.</div>'; });
    return ctl;
  }

  return { init: init, buildTours: buildTours, buildCountries: buildCountries, filterTours: filterTours, createController: createController,
           canon: canon, zoomFor: zoomFor, itemHtml: itemHtml, PAGE: PAGE };
});
