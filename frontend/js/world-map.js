/**
 * WORLD MAP — Task 4.3
 * Bản đồ thế giới với dropdown chọn quốc gia
 */
const WorldMap = (() => {
  const COUNTRIES = [
    ["Việt Nam","🇻🇳",16.047,108.206,6,"Asia","Hà Nội","98.2 triệu","331,210 km²","VND","Tiếng Việt",["Vịnh Hạ Long","Phố cổ Hội An","Đà Lạt","TP. HCM","Sa Pa"]],
    ["Nhật Bản","🇯🇵",36.204,138.252,5,"Asia","Tokyo","125.7 triệu","377,975 km²","JPY","Tiếng Nhật",["Núi Fuji","Fushimi Inari","Tokyo Skytree","Kyoto","Osaka"]],
    ["Hàn Quốc","🇰🇷",35.908,127.768,6,"Asia","Seoul","51.7 triệu","100,410 km²","KRW","Tiếng Hàn",["Gyeongbokgung","Đảo Jeju","Bukchon Hanok","Namsan Tower","Busan"]],
    ["Trung Quốc","🇨🇳",35.861,104.195,4,"Asia","Bắc Kinh","1.4 tỷ","9,596,960 km²","CNY","Tiếng Trung",["Vạn Lý Trường Thành","Tử Cấm Thành","Thượng Hải","Tây Tạng","Lệ Giang"]],
    ["Thái Lan","🇹🇭",15.87,100.993,6,"Asia","Bangkok","71.8 triệu","513,120 km²","THB","Tiếng Thái",["Wat Arun","Phuket","Chiang Mai","Koh Samui","Grand Palace"]],
    ["Singapore","🇸🇬",1.352,103.82,11,"Asia","Singapore","5.9 triệu","728 km²","SGD","Tiếng Anh",["Marina Bay Sands","Gardens by the Bay","Orchard Road","Sentosa","Chinatown"]],
    ["Indonesia","🇮🇩",-0.789,113.921,5,"Asia","Jakarta","277 triệu","1,904,569 km²","IDR","Tiếng Indonesia",["Bali","Borobudur","Komodo","Yogyakarta","Raja Ampat"]],
    ["Malaysia","🇲🇾",4.21,108.096,6,"Asia","Kuala Lumpur","33.6 triệu","329,847 km²","MYR","Tiếng Mã Lai",["Tháp Petronas","Langkawi","Penang","Kinabalu","Malacca"]],
    ["Ấn Độ","🇮🇳",20.594,78.963,5,"Asia","New Delhi","1.43 tỷ","3,287,263 km²","INR","Hindi/Tiếng Anh",["Taj Mahal","Jaipur","Varanasi","Kerala","Goa"]],
    ["UAE","🇦🇪",23.424,53.848,7,"Asia","Abu Dhabi","10 triệu","83,600 km²","AED","Tiếng Ả Rập",["Burj Khalifa","Palm Jumeirah","Sheikh Zayed Mosque","Desert Safari","Dubai Mall"]],
    ["Nepal","🇳🇵",28.394,84.124,7,"Asia","Kathmandu","30 triệu","147,181 km²","NPR","Tiếng Nepal",["Everest Base Camp","Kathmandu Valley","Pokhara","Chitwan","Lumbini"]],
    ["Campuchia","🇰🇭",12.565,104.991,7,"Asia","Phnom Penh","17 triệu","181,035 km²","KHR","Tiếng Khmer",["Angkor Wat","Phnom Penh","Siem Reap","Sihanoukville","Koh Rong"]],
    ["Pháp","🇫🇷",46.227,2.213,6,"Europe","Paris","68.4 triệu","551,695 km²","EUR","Tiếng Pháp",["Tháp Eiffel","Louvre","Versailles","Côte d'Azur","Mont-Saint-Michel"]],
    ["Ý","🇮🇹",41.872,12.567,6,"Europe","Rome","60 triệu","301,340 km²","EUR","Tiếng Ý",["Colosseum","Venice","Florence","Amalfi","Sicily"]],
    ["Tây Ban Nha","🇪🇸",40.463,-3.749,6,"Europe","Madrid","47.4 triệu","505,990 km²","EUR","Tiếng TBN",["Sagrada Família","Alhambra","Park Güell","Ibiza","San Sebastián"]],
    ["Đức","🇩🇪",51.165,10.451,6,"Europe","Berlin","83.8 triệu","357,114 km²","EUR","Tiếng Đức",["Neuschwanstein","Brandenburg Gate","Cologne Cathedral","Bavaria","Rhine Valley"]],
    ["Anh","🇬🇧",55.378,-3.436,6,"Europe","London","67.7 triệu","242,495 km²","GBP","Tiếng Anh",["Big Ben","Stonehenge","Edinburgh","Lake District","Oxford"]],
    ["Hy Lạp","🇬🇷",39.074,21.824,7,"Europe","Athens","10.7 triệu","131,957 km²","EUR","Tiếng Hy Lạp",["Santorini","Acropolis","Mykonos","Crete","Meteora"]],
    ["Thụy Sĩ","🇨🇭",46.818,8.228,8,"Europe","Bern","8.7 triệu","41,285 km²","CHF","Tiếng Đức/Pháp",["Jungfraujoch","Lucerne","Zürich","Zermatt","Geneva"]],
    ["Bồ Đào Nha","🇵🇹",39.399,-8.224,7,"Europe","Lisbon","10.3 triệu","92,212 km²","EUR","Tiếng BĐN",["Sintra","Algarve","Porto","Belem Tower","Douro Valley"]],
    ["Na Uy","🇳🇴",60.472,8.469,5,"Europe","Oslo","5.4 triệu","385,207 km²","NOK","Tiếng Na Uy",["Fjord Geiranger","Aurora Borealis","Bergen","Lofoten","Oslo Opera"]],
    ["Iceland","🇮🇸",64.963,-19.021,6,"Europe","Reykjavik","376 nghìn","103,000 km²","ISK","Tiếng Iceland",["Northern Lights","Blue Lagoon","Geysir","Skógafoss","Jokulsarlon"]],
    ["Mỹ","🇺🇸",37.09,-95.713,4,"Americas","Washington D.C.","335 triệu","9,833,520 km²","USD","Tiếng Anh",["Grand Canyon","Nữ Thần Tự Do","Times Square","Yellowstone","Disney World"]],
    ["Brazil","🇧🇷",-14.235,-51.925,4,"Americas","Brasília","215 triệu","8,515,767 km²","BRL","Tiếng BĐN",["Christ the Redeemer","Amazon","Iguazu Falls","Carnival Rio","Pantanal"]],
    ["Canada","🇨🇦",56.13,-106.347,4,"Americas","Ottawa","38.2 triệu","9,984,670 km²","CAD","Tiếng Anh/Pháp",["Niagara Falls","Banff","Vancouver","Quebec City","Northern Lights"]],
    ["Ai Cập","🇪🇬",26.82,30.802,6,"Africa","Cairo","105 triệu","1,001,449 km²","EGP","Tiếng Ả Rập",["Kim tự tháp Giza","Sông Nile","Luxor","Aswan","Biển Đỏ"]],
    ["Nam Phi","🇿🇦",-30.559,22.938,5,"Africa","Cape Town","60 triệu","1,219,090 km²","ZAR","Tiếng Anh",["Kruger National Park","Table Mountain","Garden Route","Cape Point","Robben Island"]],
    ["Morocco","🇲🇦",31.792,-7.092,6,"Africa","Rabat","37.5 triệu","446,550 km²","MAD","Tiếng Ả Rập",["Medina Fez","Marrakech","Sahara Desert","Casablanca","Chefchaouen"]],
    ["Úc","🇦🇺",-25.274,133.775,4,"Oceania","Canberra","26.5 triệu","7,692,024 km²","AUD","Tiếng Anh",["Opera House","Great Barrier Reef","Uluru","Gold Coast","Melbourne"]],
    ["New Zealand","🇳🇿",-40.9,174.886,5,"Oceania","Wellington","5.1 triệu","268,021 km²","NZD","Tiếng Anh/Māori",["Fiordland","Hobbiton","Rotorua","Milford Sound","Queenstown"]],
  ];

  const countries = COUNTRIES.map(c => ({ name:c[0], flag:c[1], lat:c[2], lng:c[3], zoom:c[4], region:c[5], capital:c[6], population:c[7], area:c[8], currency:c[9], languages:c[10], attractions:c[11] }));

  let mapInst = null;
  let activeMarker = null;
  let currentFilter = "all";
  let tourMarker = null;            // 8.8: ghim của tour đang chọn trong danh sách
  const listeners = [];             // 8.7: nơi khác (danh sách tour) muốn biết khi người dùng chọn quốc gia
  function onFocus(fn) { if (typeof fn === "function") listeners.push(fn); }
  function emit(c) { listeners.forEach(fn => { try { fn(c); } catch (e) { console.error("[WorldMap]", e); } }); }
  function clearTourMarker() { if (mapInst && tourMarker) mapInst.removeLayer(tourMarker); tourMarker = null; }

  function initWorldMap(containerId) {
    if (!window.L) { console.error("[WorldMap] Leaflet not loaded"); return; }
    if (mapInst) { mapInst.remove(); mapInst = null; }
    mapInst = L.map(containerId, { center: [20, 10], zoom: 2, minZoom: 2, worldCopyJump: true });

    TravelMapTiles.createLayer(L).addTo(mapInst);
    countries.forEach(c => {
      const dot = L.circleMarker([c.lat, c.lng], { radius: 5, color: "#F59E0B", fillColor: "#0D2137", fillOpacity: 0.7, weight: 1.5 }).addTo(mapInst);
      dot.bindTooltip(`${c.flag} ${c.name}`, { direction: "top", className: "wm-tooltip", offset: [0, -6] });
      dot.on("click", () => focusCountry(c));
    });
  }

  function focusCountry(c) {
    if (!mapInst) return;
    mapInst.flyTo([c.lat, c.lng], c.zoom, { duration: 1.4, easeLinearity: 0.3 });
    if (activeMarker) mapInst.removeLayer(activeMarker);
    const pulseHtml = `<div style="position:relative;width:36px;height:36px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(13,33,55,.3);animation:wmPulse 1.5s ease-out infinite;"></div><div style="position:absolute;inset:6px;border-radius:50%;background:#0D2137;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(13,33,55,.6);">${c.flag}</div></div><style>@keyframes wmPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.4);opacity:0}}</style>`;
    activeMarker = L.marker([c.lat, c.lng], { icon: L.divIcon({ html: pulseHtml, className: "", iconSize: [36,36], iconAnchor: [18,18] }), zIndexOffset: 1000 }).addTo(mapInst);
    showInfoPanel(c);
    clearTourMarker();
    emit(c);
  }

  function showInfoPanel(c) {
    const panel = document.getElementById("wm-info-panel");
    if (!panel) return;
    panel.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:8px;">${c.flag}</div>
      <div style="font-size:1.2rem;font-weight:700;color:#1C2B3A;margin-bottom:3px;">${c.name}</div>
      <div style="font-size:.8rem;color:#6B7280;margin-bottom:14px;">${c.region}</div>
      <div class="wm-stat"><span>🏛</span><span>Thủ đô</span><span>${c.capital}</span></div>
      <div class="wm-stat"><span>👥</span><span>Dân số</span><span>${c.population}</span></div>
      <div class="wm-stat"><span>📐</span><span>Diện tích</span><span>${c.area}</span></div>
      <div class="wm-stat"><span>💰</span><span>Tiền tệ</span><span>${c.currency}</span></div>
      <div class="wm-stat"><span>🗣</span><span>Ngôn ngữ</span><span>${c.languages}</span></div>
      <div style="margin-top:14px;font-size:.75rem;color:#0D2137;font-weight:700;margin-bottom:7px;letter-spacing:.4px">ĐỊA ĐIỂM NỔI TIẾNG</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        ${c.attractions.map(a => `<span style="background:#EEF2F7;border:1px solid #D1D9E6;color:#6B7280;padding:3px 8px;border-radius:6px;font-size:.72rem;">🏛 ${a}</span>`).join("")}
      </div>`;
    panel.style.display = "block";
  }

  function filterRegion(region) {
    currentFilter = region;
    if (region !== "all") {
      const first = countries.find(c => c.region === region);
      if (first) focusCountry(first);
    } else if (mapInst) {
      mapInst.flyTo([20, 10], 2, { duration: 1.4 });
      if (activeMarker) { mapInst.removeLayer(activeMarker); activeMarker = null; }
      const panel = document.getElementById("wm-info-panel");
      if (panel) panel.style.display = "none";
      clearTourMarker();
      emit(null);
    }
  }

  function searchCountry(q) {
    if (!q) return [];
    const ql = q.toLowerCase();
    const base = currentFilter === "all" ? countries : countries.filter(c => c.region === currentFilter);
    return base.filter(c => c.name.toLowerCase().includes(ql) || c.capital.toLowerCase().includes(ql)).slice(0, 10);
  }

  // 8.7: quốc gia chưa có trong bảng COUNTRIES → bay tới vùng chứa các tour của nước đó, ẩn bảng thông tin cũ (tránh hiện nhầm nước khác)
  function fitPoints(points) {
    if (!mapInst || !window.L || !points || !points.length) return;
    if (activeMarker) { mapInst.removeLayer(activeMarker); activeMarker = null; }
    clearTourMarker();
    const panel = document.getElementById("wm-info-panel"); if (panel) panel.style.display = "none";
    if (points.length === 1) mapInst.flyTo(points[0], 6, { duration: 1.2 });
    else mapInst.flyToBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 7, duration: 1.2 });
  }

  // 8.8: bấm tour trong danh sách → flyTo toạ độ tour + ghim popup. t = { name, lat, lng, zoom, note }
  function flyToTour(t) {
    if (!mapInst || !window.L || !t || typeof t.lat !== "number" || typeof t.lng !== "number") return false;
    mapInst.flyTo([t.lat, t.lng], t.zoom || 9, { duration: 1.2, easeLinearity: 0.3 });
    clearTourMarker();
    const esc = x => String(x == null ? "" : x).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    tourMarker = L.marker([t.lat, t.lng], { zIndexOffset: 1200 }).addTo(mapInst)
      .bindPopup(`<strong>${esc(t.name)}</strong>${t.note ? `<br><small>${esc(t.note)}</small>` : ""}`).openPopup();
    return true;
  }

  // FIX: expose instance để main.js gọi invalidateSize() khi tab được hiển thị lại
  function getMapInstance() { return mapInst; }

  return { initWorldMap, focusCountry, filterRegion, searchCountry, countries, getMapInstance, onFocus, fitPoints, flyToTour, clearTourMarker };
})();
window.WorldMap = WorldMap;
