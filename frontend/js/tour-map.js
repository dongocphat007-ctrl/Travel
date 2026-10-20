/**
 * TOUR FINDER + MAP — Task 4.2
 * Bản đồ Leaflet cho trang Tìm Tour (việc chọn tour do TourSearch.find làm, file này chỉ vẽ)
 */
const TourMap = (() => {
  let mapInstance = null;
  let markersLayer = null;

  function makeIcon(label, color, size = 28) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size+8}" viewBox="0 0 28 36"><circle cx="14" cy="14" r="13" fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/><text x="14" y="19" text-anchor="middle" font-family="Inter,sans-serif" font-size="${label.length>2?8:11}" font-weight="700" fill="#fff">${label}</text><path d="M14 27 L10 22 Q5 18 5 14 A9 9 0 0 1 23 14 Q23 18 18 22 Z" fill="${color}" opacity="0.5"/></svg>`;
    return L.divIcon({ html: svg, className: "", iconSize: [size, size+8], iconAnchor: [size/2, size+8], popupAnchor: [0, -(size+8)] });
  }

  const COLORS = ["#3b82f6","#f59e0b","#2dd4bf","#f43f5e","#a855f7","#22c55e","#fb923c"];

  function plotTour(tour) {
    if (!mapInstance) return;
    markersLayer.clearLayers();
    const coords = [];
    tour.stops.forEach((stop, i) => {
      const color = i === 0 ? "#3b82f6" : COLORS[i % COLORS.length];
      const icon = makeIcon(i === 0 ? "🚀" : String(i+1), color);
      L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px"><strong style="color:#1e293b">${stop.name}</strong><br><small style="color:#64748b">${stop.desc||""}</small><br><span style="color:#4f46e5;font-size:.75rem">${stop.day||""}</span></div>`, { maxWidth: 220 })
        .addTo(markersLayer);
      coords.push([stop.lat, stop.lng]);
    });
    if (coords.length > 1) L.polyline(coords, { color: "#3b82f6", weight: 2, opacity: .45, dashArray: "6 5" }).addTo(markersLayer);
    if (coords.length > 0) mapInstance.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 10 });
  }

  function initMap(containerId) {
    if (!window.L) { console.error("[TourMap] Leaflet chưa được tải"); return false; }
    const container = document.getElementById(containerId);
    if (!container) { console.error("[TourMap] Không tìm thấy container:", containerId); return false; }
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    // FIX: center mặc định là Việt Nam (16°N, 106°E), zoom 5
    mapInstance = L.map(containerId, { center: [16, 106], zoom: 5, zoomControl: true });
    TravelMapTiles.createLayer(L).addTo(mapInstance);
    markersLayer = L.layerGroup().addTo(mapInstance);
    // FIX: invalidateSize sau 200ms để bản đồ render đúng khi container vừa được hiển thị
    setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 200);
    return true;
  }

  // ───────── Tour THẬT trên bản đồ: mỗi tour một marker đánh số theo thứ tự đang hiển thị ─────────
  let tourMarkers = new Map();   // tourId → { marker }

  const esc = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /**
   * tours: mảng tour thật; locs: Map tourId → {lat,lng,precision}; onPick(id) gọi khi bấm marker.
   * Tour chưa có toạ độ thì bỏ qua (không bịa vị trí). Nhiều tour cùng toạ độ được xê dịch nhẹ để không chồng lên nhau.
   */
  function showTours(tours, locs, onPick) {
    if (!mapInstance || !markersLayer) return { plotted: 0 };
    markersLayer.clearLayers();
    tourMarkers = new Map();
    const used = new Map(), coords = [];
    tours.forEach((t, i) => {
      const l = locs && locs.get(String(t.id));
      const lat = l ? Number(l.lat) : NaN, lng = l ? Number(l.lng) : NaN;
      if (!isFinite(lat) || !isFinite(lng)) return;
      const key = lat.toFixed(2) + "," + lng.toFixed(2);
      const k = used.get(key) || 0; used.set(key, k + 1);
      const ang = k * 2.4, r = k ? 0.04 * Math.sqrt(k) : 0;                    // xoắn ốc quanh điểm gốc
      const pt = [lat + r * Math.sin(ang), lng + r * Math.cos(ang)];
      const note = l.precision === "country" ? "Vị trí đại diện của quốc gia" : l.precision === "province" ? "Vị trí đại diện của tỉnh/thành" : "";
      const marker = L.marker(pt, { icon: makeIcon(String(i + 1), COLORS[i % COLORS.length]) })
        .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px"><strong style="color:#1e293b">${esc(t.name)}</strong><br>` +
          `<small style="color:#64748b">${esc(t.duration || "")} · ${Number(t.price || 0).toLocaleString("vi-VN")}₫/người</small>` +
          (note ? `<br><small style="color:#94a3b8">${note}</small>` : "") +
          `<br><a href="#/tour/${encodeURIComponent(t.id)}" style="font-size:.78rem">Xem chi tiết →</a></div>`, { maxWidth: 240 })
        .on("click", () => onPick && onPick(t.id))
        .addTo(markersLayer);
      tourMarkers.set(String(t.id), { marker, pt });
      coords.push(pt);
    });
    if (coords.length) mapInstance.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 9 });
    else mapInstance.setView([16, 106], 5);
    setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 120);
    return { plotted: coords.length };
  }

  function focusTour(id) {
    const m = tourMarkers.get(String(id));
    if (!m || !mapInstance) return false;
    mapInstance.flyTo(m.pt, Math.max(mapInstance.getZoom(), 8), { duration: 0.6 });
    m.marker.openPopup();
    return true;
  }

  function getMapInstance() { return mapInstance; }

  return { initMap, plotTour, showTours, focusTour, getMapInstance };
})();
window.TourMap = TourMap;
