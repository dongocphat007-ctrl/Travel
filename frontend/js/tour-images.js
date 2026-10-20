/**
 * tour-images.js – Ảnh bìa đúng điểm đến cho Tour mẫu
 * Thứ tự ưu tiên:
 *   1. tour.image        → ảnh Admin tự đặt (link hoặc ảnh tải lên)
 *   2. Ảnh tự động       → lấy từ Wikipedia/Wikimedia Commons theo địa danh của tour
 *   3. tour.coverEmoji   → dự phòng khi không có ảnh / mất mạng
 * Kết quả tra cứu được cache trong localStorage → chỉ tải một lần.
 * Phụ thuộc: không có
 */

const TourImages = (() => {
  const CACHE_KEY = "travel_tour_img_v1";
  const NEG_TTL   = 7 * 24 * 3600 * 1000;      // nhớ "không có ảnh" trong 7 ngày
  const API       = "https://vi.wikipedia.org/w/api.php";
  const MAX_PARALLEL = 3;

  // Từ khoá địa danh (id tour → truy vấn ảnh) – đã kiểm theo từng tour
  const QUERY_BY_ID = {"gv1":"Hồ Hoàn Kiếm","gv2":"Hồ Hoàn Kiếm","gv3":"Sa Pa","gv4":"Sa Pa","gv5":"Vịnh Hạ Long","gv6":"Vịnh Hạ Long","gv7":"Tràng An","gv8":"Tràng An","gv9":"Đèo Mã Pí Lèng","gv10":"Đèo Mã Pí Lèng","gv11":"Mộc Châu","gv12":"Mộc Châu","gv13":"Thác Bản Giốc","gv14":"Thác Bản Giốc","gv15":"Điện Biên Phủ","gv16":"Điện Biên Phủ","gv17":"Y Tý","gv18":"Y Tý","gv19":"Mù Cang Chải","gv20":"Mù Cang Chải","gv21":"Mai Châu","gv22":"Mai Châu","gv23":"Lạng Sơn","gv24":"Lạng Sơn","gv25":"Cát Bà","gv26":"Cát Bà","gv27":"Đồ Sơn","gv28":"Đồ Sơn","gv29":"Sầm Sơn","gv30":"Sầm Sơn","gv31":"Pù Luông","gv32":"Pù Luông","gv33":"Cửa Lò","gv34":"Cửa Lò","gv35":"Hà Tĩnh","gv36":"Hà Tĩnh","gv37":"Vườn quốc gia Phong Nha - Kẻ Bàng","gv38":"Vườn quốc gia Phong Nha - Kẻ Bàng","gv39":"Thành cổ Quảng Trị","gv40":"Thành cổ Quảng Trị","gv41":"Đại Nội Huế","gv42":"Đại Nội Huế","gv43":"Cầu Rồng","gv44":"Cầu Rồng","gv45":"Hội An","gv46":"Hội An","gv47":"Thánh địa Mỹ Sơn","gv48":"Thánh địa Mỹ Sơn","gv49":"Cù Lao Chàm","gv50":"Cù Lao Chàm","gv51":"Lý Sơn","gv52":"Lý Sơn","gv53":"Quy Nhơn","gv54":"Quy Nhơn","gv55":"Gành Đá Đĩa","gv56":"Gành Đá Đĩa","gv57":"Nha Trang","gv58":"Nha Trang","gv59":"Vịnh Vân Phong","gv60":"Vịnh Vân Phong","gv61":"Vịnh Vĩnh Hy","gv62":"Vịnh Vĩnh Hy","gv63":"Mũi Né","gv64":"Mũi Né","gv65":"Đà Lạt","gv66":"Đà Lạt","gv67":"Bảo Lộc","gv68":"Bảo Lộc","gv69":"Buôn Ma Thuột","gv70":"Buôn Ma Thuột","gv71":"Nhà thờ gỗ Kon Tum","gv72":"Nhà thờ gỗ Kon Tum","gv73":"Biển Hồ","gv74":"Biển Hồ","gv75":"Công viên địa chất Đắk Nông","gv76":"Công viên địa chất Đắk Nông","gv77":"Núi Bà Đen","gv78":"Núi Bà Đen","gv79":"Tượng Chúa Kitô Vua","gv80":"Tượng Chúa Kitô Vua","gv81":"Côn Đảo","gv82":"Côn Đảo","gv83":"Hải đăng Kê Gà","gv84":"Hải đăng Kê Gà","gv85":"Dinh Độc Lập","gv86":"Dinh Độc Lập","gv87":"Cần Giờ","gv88":"Cần Giờ","gv89":"Vườn quốc gia Cát Tiên","gv90":"Vườn quốc gia Cát Tiên","gv91":"Vườn quốc gia Bù Gia Mập","gv92":"Vườn quốc gia Bù Gia Mập","gv93":"Đồng Tháp Mười","gv94":"Đồng Tháp Mười","gv95":"Bến Tre","gv96":"Bến Tre","gv97":"Vĩnh Long","gv98":"Vĩnh Long","gv99":"Chợ nổi Cái Răng","gv100":"Chợ nổi Cái Răng","gv101":"Chùa Dơi","gv102":"Chùa Dơi","gv103":"Mũi Cà Mau","gv104":"Mũi Cà Mau","gv105":"Hà Tiên","gv106":"Hà Tiên","gv107":"Phú Quốc","gv108":"Phú Quốc","gv109":"Núi Sam","gv110":"Núi Sam","gv111":"Sa Đéc","gv112":"Sa Đéc","gv113":"Trà Vinh","gv114":"Trà Vinh","gv115":"Nam Định","gv116":"Nam Định","gv117":"Chùa Bút Tháp","gv118":"Chùa Bút Tháp","gv119":"Yên Tử","gv120":"Yên Tử","gv121":"Cô Tô","gv122":"Cô Tô","gv123":"Tam Đảo","gv124":"Tam Đảo","gv125":"Vườn quốc gia Ba Vì","gv126":"Vườn quốc gia Ba Vì","gv127":"Chùa Hương","gv128":"Chùa Hương","gi1":"Tháp đôi Petronas","gi2":"Langkawi","gi3":"Tanah Lot","gi4":"Borobudur","gi5":"Boracay","gi6":"Bohol","gi7":"Bagan","gi8":"Wat Phou","gi9":"Hoàng cung Phnom Penh","gi10":"Đỉnh Victoria","gi11":"Bến Thượng Hải","gi12":"Vạn Lý Trường Thành","gi13":"Trương Gia Giới","gi14":"Cửu Trại Câu","gi15":"Lệ Giang","gi16":"Quế Lâm","gi17":"Taipei 101","gi18":"Sapporo","gi19":"Fushimi Inari-taisha","gi20":"Bulguksa","gi21":"Ulaanbaatar","gi22":"Taj Mahal","gi23":"Kathmandu","gi24":"Tu viện Paro Taktsang","gi25":"Maldives","gi26":"Sigiriya","gi27":"Burj Khalifa","gi28":"Cappadocia","gi29":"Kim tự tháp Giza","gi30":"Petra","gi31":"Marrakech","gi32":"Tháp Eiffel","gi33":"Cung điện Versailles","gi34":"Đấu trường La Mã","gi35":"Sagrada Família","gi36":"Cổng Brandenburg","gi37":"Keukenhof","gi38":"Jungfrau","gi39":"Geirangerfjord","gi40":"Skógafoss","gi41":"Rovaniemi","gi42":"Big Ben","gi43":"Santorini","gi44":"Dubrovnik","gi45":"Quảng trường Đỏ","gi46":"Cầu Cổng Vàng","gi47":"Thác Niagara","gi48":"Nhà hát Opera Sydney","gi49":"Milford Sound","gi50":"Table Mountain","g29":"Angkor Wat","g30":"Wat Arun","g31":"Marina Bay Sands","g32":"Núi Phú Sĩ","g33":"Gyeongbokgung","g34":"Luang Prabang"};

  // Địa danh nổi tiếng xuất hiện trong TÊN tour (dùng cho tour cũ / tour Admin tự thêm)
  const PLACES = [
    ["fansipan","Fansipan"],["sơn đoòng","Hang Sơn Đoòng"],["phong nha","Vườn quốc gia Phong Nha - Kẻ Bàng"],
    ["bản giốc","Thác Bản Giốc"],["tràng an","Tràng An"],["tam cốc","Tam Cốc - Bích Động"],["mỹ sơn","Thánh địa Mỹ Sơn"],
    ["bà nà","Bà Nà Hills"],["cúc phương","Vườn quốc gia Cúc Phương"],["ngọc linh","Ngọc Linh"],["lan hạ","Vịnh Lan Hạ"],
    ["cù lao chàm","Cù Lao Chàm"],["lý sơn","Lý Sơn"],["hồ trị an","Hồ Trị An"],["núi bà đen","Núi Bà Đen"],["yên tử","Yên Tử"],
    ["trà sư","Rừng tràm Trà Sư"],["tân lập","Làng nổi Tân Lập"],["tam chúc","Chùa Tam Chúc"],["bạch mộc lương tử","Bạch Mộc Lương Tử"],
    ["đồng bằng sông cửu long","Đồng bằng sông Cửu Long"],["mekong","Đồng bằng sông Cửu Long"],["tây bắc","Tây Bắc (Việt Nam)"],
    ["chợ lớn","Chợ Lớn"],["hạ long","Vịnh Hạ Long"],["điện biên phủ","Điện Biên Phủ"],["lăng tẩm","Lăng Khải Định"],
    ["hoàng thành","Hoàng thành Thăng Long"],["chợ nổi","Chợ nổi Cái Răng"],["cát tiên","Vườn quốc gia Cát Tiên"],
    ["mũi cà mau","Mũi Cà Mau"],["cà mau – mũi đất","Mũi Cà Mau"]
  ];

  // Tên "địa danh đầu" trong điểm đến cần đổi cho Wikipedia hiểu
  const DEST_ALIAS = {
    "sapa":"Sa Pa","xuyên việt":"Quốc lộ 1","hà tây cũ":"Bắc Ninh","quận 5":"Chợ Lớn",
    "thừa thiên huế":"Huế","tp. hồ chí minh":"Thành phố Hồ Chí Minh","tp.hcm":"Thành phố Hồ Chí Minh",
    "đồng bằng scl":"Đồng bằng sông Cửu Long"
  };

  // Bỏ các ảnh không phải ảnh phong cảnh (cờ, bản đồ, logo, huy hiệu…)
  const BAD = /flag_of|locator|location|map|coat_of_arms|seal_of|logo|emblem|blank|symbol|\.svg/i;

  // Cache
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch { cache = {}; }
  const persist = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} };
  const fromCache = q => {
    const c = cache[q];
    if (!c) return undefined;
    if (c.u) return c.u;                                   // có ảnh
    return (Date.now() - (c.t || 0) < NEG_TTL) ? "" : undefined; // đã thử, không có ảnh
  };

  // Hàng đợi giới hạn song song
  let active = 0; const waiting = [];
  const schedule = fn => new Promise((res, rej) => {
    const run = () => { active++; fn().then(res, rej).finally(() => { active--; if (waiting.length) waiting.shift()(); }); };
    active < MAX_PARALLEL ? run() : waiting.push(run);
  });

  // Tra cứu 1 truy vấn trên Wikipedia
  const inflight = {};
  function lookup(q) {
    const hit = fromCache(q);
    if (hit !== undefined) return Promise.resolve(hit);
    if (inflight[q]) return inflight[q];
    inflight[q] = schedule(async () => {
      let url = "";
      try {
        const api = API + "?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=3"
                  + "&gsrsearch=" + encodeURIComponent(q)
                  + "&prop=pageimages&piprop=thumbnail&pithumbsize=640";
        const r = await fetch(api);
        const j = await r.json();
        const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
        for (const p of pages) {
          const u = p.thumbnail && p.thumbnail.source;
          let dec = u || ""; try { dec = decodeURIComponent(dec); } catch {}
          if (u && !BAD.test(dec.split("/").pop())) { url = u; break; }
        }
        cache[q] = url ? { u: url } : { u: "", t: Date.now() };
        persist();
      } catch (err) {
        // Lỗi mạng: không ghi cache để lần sau thử lại
        delete inflight[q];
        return "";
      }
      delete inflight[q];
      return url;
    });
    return inflight[q];
  }

  // Danh sách truy vấn theo thứ tự ưu tiên cho 1 tour
  function queriesFor(tour) {
    const out = [];
    const add = q => { q = (q || "").trim(); if (q && !out.includes(q)) out.push(q); };
    add(tour.imageQuery);
    add(QUERY_BY_ID[tour.id]);
    const name = (tour.name || "").toLowerCase();
    for (const [k, q] of PLACES) if (name.includes(k)) { add(q); break; }
    const first = (tour.destination || "").split(/[·,–]/)[0].trim();
    add(DEST_ALIAS[first.toLowerCase()] || first);
    return out.slice(0, 3);
  }

  async function resolve(tour) {
    // Ảnh riêng của tour (đường dẫn file hoặc link). Bỏ qua nếu chỉ là thư mục (kết thúc bằng "/") để dùng ảnh tự động
    if (tour.image && !/\/\s*$/.test(tour.image)) return tour.image;
    for (const q of queriesFor(tour)) {
      const u = await lookup(q);
      if (u) return u;
    }
    return "";
  }

  // Gắn ảnh vào 1 phần tử (giữ emoji nếu không có ảnh)
  function attach(el, tour) {
    if (!el || el.dataset.tiDone) return;
    el.dataset.tiDone = "1";
    resolve(tour).then(url => {
      if (!url || !el.isConnected) return;
      const img = new Image();
      img.className = "ti-img";
      img.alt = tour.name || "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onload  = () => { el.dataset.tiSrc = tour.image ? "custom" : "wiki"; el.classList.add("ti-has"); };
      img.onerror = () => { img.remove(); };
      img.src = url;
      el.appendChild(img);
    });
  }

  // Quét container, chỉ tải ảnh khi thẻ sắp vào màn hình
  function hydrate(root, tours) {
    if (!root) return;
    const byId = {}; (tours || []).forEach(t => { byId[t.id] = t; });
    const els = root.querySelectorAll("[data-tour-img]");
    const go = el => { const t = byId[el.dataset.tourId]; if (t) attach(el, t); };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); go(en.target); } });
      }, { rootMargin: "300px" });
      els.forEach(el => io.observe(el));
    } else els.forEach(go);
  }

  const clearCache = () => { cache = {}; try { localStorage.removeItem(CACHE_KEY); } catch {} };

  // CSS
  if (!document.getElementById("ti-style")) {
    const st = document.createElement("style");
    st.id = "ti-style";
    st.textContent = `
      [data-tour-img]{position:relative;overflow:hidden}
      .ti-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
      [data-tour-img].ti-has > :not(.ti-img){position:relative;z-index:1}
      [data-tour-img].ti-has .tl-tour-card-emoji{display:none}
      [data-tour-img].ti-has::after{content:"";position:absolute;inset:0;z-index:0;
        background:linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.28) 100%);pointer-events:none}
      [data-tour-img].ti-has .tl-tour-type-pill{position:absolute;z-index:2}
      .tdm-hero{display:none;height:190px;border-radius:14px;margin-bottom:16px;background:#0f172a}
      .tdm-hero.ti-has{display:block}
      .tdm-close{z-index:5}
      .tdm-hero-credit{display:none}
      .tdm-hero[data-ti-src="wiki"] .tdm-hero-credit{display:block}
      .tdm-hero-credit{position:absolute;right:8px;bottom:6px;z-index:2;font-size:.62rem;color:rgba(255,255,255,.85);
        background:rgba(0,0,0,.35);padding:1px 7px;border-radius:99px}
    `;
    document.head.appendChild(st);
  }

  return { attach, hydrate, resolve, queriesFor, clearCache };
})();
