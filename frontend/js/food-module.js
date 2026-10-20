/**
 * FOOD MODULE — Task 5.2 (mở rộng dữ liệu 3 miền - đầy đủ)
 * Ẩm thực Việt Nam theo vùng: Bắc, Trung, Nam
 */
const FoodModule = (() => {
  let REGIONS = {};   // toàn bộ dữ liệu 3 vùng nạp từ data/foods.json

  /**
   * FOOD IMAGES — gắn ảnh đúng món cho từng thẻ ẩm thực
   * Thứ tự ưu tiên:
   *   1. food.image      → ảnh Admin tự đặt (link / ảnh tải lên)
   *   2. Ảnh tự động     → Wikipedia / Wikimedia Commons theo đúng tên món
   *   3. food.emoji      → dự phòng khi không có ảnh / mất mạng
   * Kết quả tra cứu được cache trong localStorage → chỉ tải một lần.
   */
  const FOOD_IMG_CACHE_KEY = "travel_food_img_v1";
  const FOOD_IMG_NEG_TTL   = 7 * 24 * 3600 * 1000;
  const FOOD_IMG_PARALLEL  = 3;

  // Truy vấn ảnh theo từng món: thử lần lượt từ cụ thể → khái quát
  const FOOD_IMG_QUERIES = {
    // Miền Bắc
    "Phở Hà Nội":["Phở Hà Nội","Phở"],
    "Bún chả":["Bún chả"],
    "Chả cá Lã Vọng":["Chả cá Lã Vọng","Chả cá"],
    "Bánh cuốn":["Bánh cuốn"],
    "Xôi Hà Nội":["Xôi xéo","Xôi"],
    "Bún thang":["Bún thang"],
    "Nem cuốn Hà Nội":["Nem cuốn","Gỏi cuốn"],
    "Bún riêu cua":["Bún riêu cua","Bún riêu"],
    "Bánh mì Hà Nội":["Bánh mì"],
    "Canh bún":["Canh bún","Bún riêu"],
    "Bún cá Hải Phòng":["Bún cá Hải Phòng","Bún cá"],
    "Thắng cố Sapa":["Thắng cố"],
    "Bánh đúc nóng":["Bánh đúc"],
    "Bánh trôi bánh chay":["Bánh trôi","Bánh chay"],
    "Bún bạch tuộc":["Bún bạch tuộc","Bún"],
    "Mắm tôm Hà Nội":["Mắm tôm"],
    "Cơm rang Hà Nội":["Cơm rang","Cơm chiên"],
    "Bánh cốm":["Bánh cốm","Cốm"],
    "Chả mực Hạ Long":["Chả mực Hạ Long","Chả mực"],
    "Phở khô Hà Giang":["Phở khô","Phở"],
    "Nộm bò khô":["Nộm bò khô","Nộm"],
    // Miền Trung
    "Bún bò Huế":["Bún bò Huế"],
    "Mì Quảng":["Mì Quảng"],
    "Cao lầu":["Cao lầu"],
    "Cơm hến":["Cơm hến"],
    "Bánh xèo miền Trung":["Bánh xèo"],
    "Bánh bèo Huế":["Bánh bèo"],
    "Bánh tráng cuốn thịt heo":["Bánh tráng cuốn thịt heo","Bánh tráng"],
    "Cơm bình dân Huế":["Ẩm thực Huế","Cơm Huế"],
    "Bánh căn Nha Trang":["Bánh căn"],
    "Lẩu bò Huế":["Lẩu bò","Bún bò Huế"],
    "Nem lụi Nha Trang":["Nem lụi"],
    "Cháo lươn xứ Nghệ":["Cháo lươn","Cháo"],
    "Bún sứa Nha Trang":["Bún sứa","Bún"],
    "Bánh mì Hội An":["Bánh mì Phượng","Bánh mì"],
    "Gỏi cá Nam Ô":["Gỏi cá Nam Ô","Gỏi cá"],
    "Bánh ướt thịt nướng":["Bánh ướt"],
    "Bánh đập Đà Nẵng":["Bánh đập","Bánh tráng"],
    "Tôm chua Huế":["Tôm chua"],
    "Chả bò Đà Nẵng":["Chả bò","Giò chả"],
    "Cá ngừ đại dương Phú Yên":["Cá ngừ đại dương","Cá ngừ"],
    "Bánh ít lá gai":["Bánh ít lá gai","Bánh ít"],
    // Miền Nam
    "Cơm tấm Sài Gòn":["Cơm tấm"],
    "Phở Nam":["Phở"],
    "Hủ tiếu":["Hủ tiếu"],
    "Bánh mì Sài Gòn":["Bánh mì"],
    "Lẩu mắm":["Lẩu mắm"],
    "Bún nước lèo":["Bún nước lèo","Bún mắm"],
    "Bánh tằm bì":["Bánh tằm bì","Bánh tằm"],
    "Bánh canh Trảng Bàng":["Bánh canh Trảng Bàng","Bánh canh"],
    "Lẩu cua đồng":["Lẩu cua đồng","Cua đồng"],
    "Bánh xèo miền Nam":["Bánh xèo"],
    "Chè ba màu":["Chè ba màu","Chè"],
    "Bún riêu cua Sài Gòn":["Bún riêu"],
    "Cá kho tộ":["Cá kho tộ","Cá kho"],
    "Bún mắm":["Bún mắm"],
    "Hủ tiếu Nam Vang":["Hủ tiếu Nam Vang","Hủ tiếu"],
    "Bánh tét miền Nam":["Bánh tét"],
    "Bánh khọt Vũng Tàu":["Bánh khọt"],
    "Cơm lam ống tre":["Cơm lam"],
    "Chè chuối nước cốt dừa":["Chè chuối","Chè"],
    "Đặc sản cá sấu":["Thịt cá sấu","Cá sấu"],
    "Gỏi cuốn tôm thịt":["Gỏi cuốn"]
  };

  // Bỏ ảnh không phải ảnh món ăn (cờ, bản đồ, logo, svg…)
  const FOOD_IMG_BAD = /flag_of|locator|location|map|coat_of_arms|seal_of|logo|emblem|blank|symbol|\.svg/i;
  // Từ chung chung, không dùng để đối chiếu tên bài viết
  const FOOD_IMG_STOP = new Set(["banh","bun","com","che","lau","goi","mam","mon","an","ha","noi","hue","da","nang","sai","gon","nam","bac","trung","mien","dac","san","viet","cua"]);

  const foodNorm = t => String(t || "").toLowerCase().replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const foodTokens = t => foodNorm(t).split(/[^a-z0-9]+/).filter(w => w && !FOOD_IMG_STOP.has(w));

  // Bài viết trả về phải liên quan tới truy vấn (tránh gắn nhầm ảnh)
  function foodTitleMatches(title, query) {
    const q = foodTokens(query);
    if (!q.length) return foodNorm(title).includes(foodNorm(query));
    const t = new Set(foodTokens(title));
    return q.some(w => t.has(w));
  }

  let foodImgCache = {};
  try { foodImgCache = JSON.parse(localStorage.getItem(FOOD_IMG_CACHE_KEY) || "{}") || {}; } catch { foodImgCache = {}; }
  const foodImgPersist = () => { try { localStorage.setItem(FOOD_IMG_CACHE_KEY, JSON.stringify(foodImgCache)); } catch {} };
  const foodImgFromCache = k => {
    const c = foodImgCache[k];
    if (!c) return undefined;
    if (c.u) return c.u;
    return (Date.now() - (c.t || 0) < FOOD_IMG_NEG_TTL) ? "" : undefined;
  };

  // Hàng đợi giới hạn song song
  let foodImgActive = 0; const foodImgWaiting = [];
  const foodImgSchedule = fn => new Promise((res, rej) => {
    const run = () => { foodImgActive++; fn().then(res, rej).finally(() => { foodImgActive--; if (foodImgWaiting.length) foodImgWaiting.shift()(); }); };
    foodImgActive < FOOD_IMG_PARALLEL ? run() : foodImgWaiting.push(run);
  });

  function foodPickThumb(pages, query, checkTitle) {
    for (const p of pages) {
      const u = p.thumbnail && p.thumbnail.source;
      if (!u) continue;
      let dec = u; try { dec = decodeURIComponent(u); } catch {}
      if (FOOD_IMG_BAD.test(dec.split("/").pop())) continue;
      if (checkTitle && !foodTitleMatches(p.title, query)) continue;
      return u;
    }
    return "";
  }

  // Tra 1 truy vấn trên 1 ngôn ngữ Wikipedia: tên bài chính xác → tìm kiếm
  async function foodWikiFetch(lang, q) {
    const api = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=640`;
    // a) đúng tên bài viết (có theo dõi redirect)
    let r = await fetch(api + "&redirects=1&titles=" + encodeURIComponent(q));
    let j = await r.json();
    let pages = Object.values((j.query && j.query.pages) || {});
    let url = foodPickThumb(pages, q, false);
    if (url) return url;
    // b) tìm kiếm, chỉ nhận bài có tên liên quan
    r = await fetch(api + "&generator=search&gsrnamespace=0&gsrlimit=5&gsrsearch=" + encodeURIComponent(q));
    j = await r.json();
    pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    return foodPickThumb(pages, q, true);
  }

  const foodImgInflight = {};
  function foodLookup(q) {
    const hit = foodImgFromCache(q);
    if (hit !== undefined) return Promise.resolve(hit);
    if (foodImgInflight[q]) return foodImgInflight[q];
    foodImgInflight[q] = foodImgSchedule(async () => {
      let url = "";
      try {
        url = await foodWikiFetch("vi", q);
        if (!url) url = await foodWikiFetch("en", q);
        foodImgCache[q] = url ? { u: url } : { u: "", t: Date.now() };
        foodImgPersist();
      } catch (err) {
        delete foodImgInflight[q];   // lỗi mạng: không ghi cache, lần sau thử lại
        return "";
      }
      delete foodImgInflight[q];
      return url;
    });
    return foodImgInflight[q];
  }

  async function foodImgResolve(food) {
    if (food.image) return food.image;                          // Admin đã đặt ảnh riêng
    const qs = (FOOD_IMG_QUERIES[food.name] || [food.name]).slice();
    if (food.imageQuery) qs.unshift(...[].concat(food.imageQuery));   // chuỗi hoặc mảng từ khóa trong JSON
    for (const q of qs) {
      const u = await foodLookup(q);
      if (u) return u;
    }
    return "";
  }

  // Gắn ảnh vào 1 phần tử (giữ emoji nếu không có ảnh)
  function foodImgAttach(el, food) {
    if (!el || el.dataset.fiDone) return;
    el.dataset.fiDone = "1";
    foodImgResolve(food).then(url => {
      if (!url || !el.isConnected) return;
      const img = new Image();
      img.className = "fi-img";
      img.alt = food.name || "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onload  = () => el.classList.add("fi-has");
      img.onerror = () => img.remove();
      img.src = url;
      el.insertBefore(img, el.firstChild);
    });
  }

  // Chỉ tải ảnh khi thẻ sắp vào màn hình
  function foodImgHydrate(root, items) {
    if (!root) return;
    const els = root.querySelectorAll("[data-food-img]");
    const go = el => { const f = items[el.dataset.foodImg]; if (f) foodImgAttach(el, f); };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); go(en.target); } });
      }, { rootMargin: "300px" });
      els.forEach(el => io.observe(el));
    } else els.forEach(go);
  }

  const FOOD_KEY = "travel_food_v1";
  const foodTotal = () => Object.values(getRegions()).reduce((n, r) => n + r.foods.length, 0);

  // Export default data để admin dùng
  const FOOD_SEED_KEY = "travel_food_seed_v";   // phiên bản data/foods.json đã gộp vào dữ liệu Admin
  const FOOD_SEED_VER = "2";
  const cloneRegions = () => JSON.parse(JSON.stringify(REGIONS));

  // Thêm các món (theo tên, không trùng) từ nguồn JSON vào regions
  function addFoods(regions, source) {
    Object.keys(source).forEach(key => {
      if (!regions[key]) return;
      regions[key].foods = regions[key].foods || [];
      const have = new Set(regions[key].foods.map(f => f.name));
      ((source[key] && source[key].foods) || []).forEach(f => { if (!have.has(f.name)) regions[key].foods.push(f); });
    });
  }

  // Dữ liệu Admin đã lưu từ trước: gộp món mới từ JSON đúng 1 lần (món Admin đã xóa sau đó không bị thêm lại)
  function mergeSeedIntoSaved() {
    try {
      const raw = localStorage.getItem(FOOD_KEY);
      if (!raw || localStorage.getItem(FOOD_SEED_KEY) === FOOD_SEED_VER) return;
      const saved = JSON.parse(raw);
      addFoods(saved, REGIONS);
      localStorage.setItem(FOOD_KEY, JSON.stringify(saved));
      localStorage.setItem(FOOD_SEED_KEY, FOOD_SEED_VER);
    } catch {}
  }

  // Nạp ngay khi trang tải (chatbot/admin cũng dùng window._FoodDefaultRegions)
  const ready = fetch("data/foods.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      REGIONS = data;
      window._FoodDefaultRegions = cloneRegions();
      mergeSeedIntoSaved();
    })
    .catch(err => console.error("[food] Không đọc được data/foods.json:", err));

  // Lấy dữ liệu: ưu tiên localStorage, fallback về default
  function getRegions() {
    try {
      const r = localStorage.getItem(FOOD_KEY);
      if (r) {
        const saved = JSON.parse(r);
        // Merge: giữ label/icon/color/tags/desc/featured từ default
        Object.keys(REGIONS).forEach(key => {
          if (saved[key]) {
            saved[key].label    = REGIONS[key].label;
            saved[key].icon     = REGIONS[key].icon;
            saved[key].color    = REGIONS[key].color;
            saved[key].tags     = REGIONS[key].tags;
            saved[key].desc     = REGIONS[key].desc;
            saved[key].featured = REGIONS[key].featured;
          }
        });
        return saved;
      }
    } catch {}
    return REGIONS;
  }

  // Reload khi admin cập nhật
  function reload() {
    renderRegion(currentRegion);
  }

  let currentRegion = "north";

  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p style="padding:24px;color:var(--muted)">Đang tải dữ liệu ẩm thực…</p>';
    ready.then(() => draw(container));
  }

  function draw(container) {
    if (!Object.keys(REGIONS).length) {
      container.innerHTML = '<p style="padding:24px;color:var(--muted)">Không đọc được data/foods.json. Hãy chạy bằng web server (Live Server hoặc python -m http.server).</p>';
      return;
    }
    container.innerHTML = `
      <div class="food-hero">
        <div class="food-hero-badge">Hành trình vị giác</div>
        <h2 class="food-hero-title">Ẩm thực Việt Nam theo vùng</h2>
        <p class="food-hero-sub">Mỗi vùng đất một phong vị riêng — từ cái đậm đà giản dị của miền Bắc, cái cay nồng sắc sảo của miền Trung đến cái ngọt ngào phóng khoáng của miền Nam.</p>
        <div class="food-hero-stats">
          <div class="food-hero-stat"><strong>3</strong><span>Vùng ẩm thực</span></div>
          <div class="food-hero-stat"><strong id="foodTotal">${foodTotal()}+</strong><span>Món đặc trưng</span></div>
          <div class="food-hero-stat"><strong>54</strong><span>Dân tộc, 54 hương vị</span></div>
        </div>
      </div>
      <div class="food-region-nav" id="foodRegionNav">
        <button class="food-region-tab active" data-region="north" onclick="FoodModule.switchRegion('north',this)"><span class="food-dot food-dot-north"></span>Miền Bắc</button>
        <button class="food-region-tab" data-region="center" onclick="FoodModule.switchRegion('center',this)"><span class="food-dot food-dot-center"></span>Miền Trung</button>
        <button class="food-region-tab" data-region="south" onclick="FoodModule.switchRegion('south',this)"><span class="food-dot food-dot-south"></span>Miền Nam</button>
      </div>
      <div id="foodContent"></div>`;
    renderRegion("north");
  }

  function switchRegion(region, btn) {
    currentRegion = region;
    document.querySelectorAll(".food-region-tab").forEach(t => t.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderRegion(region);
  }

  function renderRegion(region) {
    const r = getRegions()[region];
    const content = document.getElementById("foodContent");
    if (!content || !r) return;
    content.innerHTML = `
      <div class="food-region-header" style="background:linear-gradient(135deg,${r.color},${r.color}aa);">
        <div class="food-region-icon">${r.icon}</div>
        <div>
          <h3>${r.label}</h3>
          <p>${r.desc}</p>
          <div class="food-rtags">${r.tags.map(t=>`<span class="food-rtag food-rtag-${region}">${t}</span>`).join("")}</div>
        </div>
      </div>
      <div class="food-featured">
        <div class="food-fd-visual" data-food-img="featured" style="background:linear-gradient(135deg,${r.color},${r.color}99)"><span class="fi-emoji">${r.featured.emoji}</span></div>
        <div>
          <div class="food-fd-eyebrow food-fd-ey-${region}">Món tiêu biểu nhất</div>
          <h4>${r.featured.name}</h4>
          <p>${r.featured.desc}</p>
        </div>
      </div>
      <div class="food-section-label">Các món đặc trưng (${r.foods.length} món)</div>
      <div class="food-grid">
        ${r.foods.map((f, i) => `
          <div class="food-card">
            <div class="food-card-img food-img-bg" data-food-img="${i}"><span class="fi-emoji" style="font-size:2.5rem">${f.emoji}</span><span class="food-img-label">${f.region}</span></div>
            <div class="food-card-body">
              <div class="food-card-name">${f.name}</div>
              <div class="food-card-desc">${f.desc}</div>
              <div class="food-card-tags">${f.tags.map(t=>`<span class="food-tag food-tag-${region}">${t}</span>`).join("")}</div>
            </div>
          </div>`).join("")}
      </div>
      <p class="food-img-credit">Ảnh minh hoạ lấy từ Wikipedia / Wikimedia Commons</p>`;
    foodImgHydrate(content, Object.assign({ featured: r.featured }, r.foods));
  }

  return { render, switchRegion, reload, ready };
})();
window.FoodModule = FoodModule;
