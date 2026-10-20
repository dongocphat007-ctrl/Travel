/* Nền bản đồ dùng chung cho mọi bản đồ Leaflet (bản đồ thế giới, bản đồ tour, bản đồ chi tiết tour).
 *
 * Mặc định: Google Maps dạng đường phố (roadmap), nhãn tiếng Việt (language=vi, region=VN),
 * nạp qua Google Maps JavaScript API + plugin Leaflet.GoogleMutant → code Leaflet cũ giữ nguyên.
 *
 * Cần 1 API key, đặt ở backend: biến môi trường GOOGLE_MAPS_API_KEY → trình duyệt lấy qua GET /api/maps/config.
 * (Vẫn hỗ trợ điền thẳng googleMapsApiKey bên dưới khi chạy bằng server tĩnh.) Key này chạy ở trình duyệt nên
 * PHẢI giới hạn theo "HTTP referrers" trong Google Cloud Console và chỉ bật "Maps JavaScript API".
 * Chưa có key (hoặc Google không tải được) → tự dùng nền đường phố OpenStreetMap.
 */
(function (root, factory) {
  var api = factory();

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.TRAVEL_MAP_CONFIG = root.TRAVEL_MAP_CONFIG || {
      // Dán Google Maps API key (trình duyệt) vào đây. Để trống = dùng OpenStreetMap.
      googleMapsApiKey: "",
      // Tuỳ chọn: MapTiler (chỉ dùng khi KHÔNG có googleMapsApiKey)
      mapTilerApiKey: "",
      mapTilerStyleId: ""
    };
    root.TravelMapTiles = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  var GOOGLE_API = "https://maps.googleapis.com/maps/api/js";
  var GOOGLE_MUTANT = "https://cdn.jsdelivr.net/npm/leaflet.gridlayer.googlemutant@0.13.5/dist/Leaflet.GoogleMutant.js";
  var OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var CARTO_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";   // dự phòng khi tile.openstreetmap.org bị chặn/lỗi
  var CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
  var OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  var MAPTILER_ATTRIBUTION = '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>';

  var googleReady = null;   // Promise dùng chung: chỉ nạp Google 1 lần
  var keyReady = null;      // Promise dùng chung: chỉ hỏi backend 1 lần

  function resolveKey(settings) {
    if (settings.googleMapsApiKey) return Promise.resolve(settings.googleMapsApiKey);
    if (!keyReady) {
      keyReady = fetch("/api/maps/config", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return (j && j.googleMapsApiKey) || ""; })
        .catch(function () { return ""; });
    }
    return keyReady;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Không tải được " + src)); };
      document.head.appendChild(s);
    });
  }

  function loadGoogle(key) {
    if (googleReady) return googleReady;
    googleReady = new Promise(function (resolve, reject) {
      window.__travelGoogleMapsReady = function () { loadScript(GOOGLE_MUTANT).then(resolve, reject); };
      window.gm_authFailure = function () { console.warn("[Map] Google Maps từ chối API key (kiểm tra key, billing, HTTP referrer)"); };
      loadScript(GOOGLE_API + "?key=" + encodeURIComponent(key) + "&language=vi&region=VN&callback=__travelGoogleMapsReady").catch(reject);
    });
    return googleReady;
  }

  /** Quá 4 ô lỗi liên tiếp (chưa có ô nào tải được) → đổi sang nền CARTO. Chỉ chuyển 1 lần. */
  function withTileFallback(layer) {
    var bad = 0, ok = 0, switched = false;
    layer.on("tileload", function () { ok++; });
    layer.on("tileerror", function () {
      if (switched || ok > 0 || ++bad < 4) return;
      switched = true;
      console.warn("[Map] Không tải được ô bản đồ OpenStreetMap, chuyển sang nền CARTO");
      layer.options.subdomains = "abcd"; layer.options.attribution = CARTO_ATTRIBUTION;
      layer.setUrl(CARTO_URL);
      if (layer._map && layer._map.attributionControl) layer._map.attributionControl.addAttribution(CARTO_ATTRIBUTION);
    });
    return layer;
  }

  function createLayer(leaflet, config) {
    var L = leaflet || (typeof window !== "undefined" ? window.L : null);
    if (!L || typeof L.tileLayer !== "function") throw new Error("Leaflet must be available before creating a basemap layer.");
    var settings = config || (typeof window !== "undefined" ? window.TRAVEL_MAP_CONFIG : null) || {};
    var canLoadGoogle = typeof window !== "undefined" && typeof document !== "undefined";

    if (canLoadGoogle && !settings.mapTilerApiKey) {
      // Hiện nền OpenStreetMap ngay; có key thì khi Google nạp xong thay bằng Google (không bị trống trong lúc chờ).
      var base = withTileFallback(L.tileLayer(OSM_URL, { minZoom: 0, maxZoom: 19, attribution: OSM_ATTRIBUTION, referrerPolicy: "origin" }));   // OSM yêu cầu có Referer
      base.once("add", function () {
        resolveKey(settings).then(function (key) {
          if (!key) return;
          return loadGoogle(key).then(function () {
            var map = base._map;
            if (!map || !L.gridLayer || typeof L.gridLayer.googleMutant !== "function") return;
            var g = L.gridLayer.googleMutant({ type: "roadmap", maxZoom: 21 }).addTo(map);
            map.removeLayer(base);
            // Google từ chối key (sai key / chưa bật billing / sai referrer) → trả lại nền OSM thay vì để bản đồ trống
            window.gm_authFailure = function () { console.warn("[Map] Google Maps từ chối API key — dùng lại nền OpenStreetMap"); try { map.removeLayer(g); base.addTo(map); } catch (e) { /* bản đồ đã bị huỷ */ } };
          });
        }).catch(function (e) { console.warn("[Map] Dùng OpenStreetMap vì Google Maps không tải được:", e && e.message); });
      });
      return base;
    }

    if (settings.mapTilerApiKey && settings.mapTilerStyleId) {
      return L.tileLayer(
        "https://api.maptiler.com/maps/" + encodeURIComponent(settings.mapTilerStyleId) + "/{z}/{x}/{y}.png?key=" + encodeURIComponent(settings.mapTilerApiKey),
        { tileSize: 512, zoomOffset: -1, minZoom: 0, maxZoom: 22, attribution: MAPTILER_ATTRIBUTION }
      );
    }

    // Không key: nền đường phố OpenStreetMap (nhãn trong nước Việt Nam hiển thị tiếng Việt)
    return withTileFallback(L.tileLayer(OSM_URL, { minZoom: 0, maxZoom: 19, attribution: OSM_ATTRIBUTION, referrerPolicy: "origin" }));
  }

  return { createLayer: createLayer };
});
