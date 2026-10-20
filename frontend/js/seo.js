/**
 * js/seo.js – Giai đoạn 12 (P2): SEO cho website một trang (route dạng #/…). Không phụ thuộc file JS khác.
 *   12.7  mỗi route có <title> + <meta name="description"> riêng
 *   12.9  Open Graph / Twitter: og:title, og:description, og:url, og:type, og:image (+ <link rel="canonical">) cập nhật theo route
 *   Trang riêng tư (hồ sơ, admin, tạo/sửa chuyến đi…) → <meta name="robots" content="noindex, nofollow">
 * Route chưa khai báo trong ROUTES → tiêu đề lấy từ <h1> đang hiển thị; mô tả dùng mô tả mặc định.
 * Tên tour: ngoài ?tour=ID / #/tour/ID sẽ lấy từ GET /api/tours (hoặc config.getTours) rồi dùng làm title + description.
 * Phía máy chủ (crawler không chạy JS): server/seo.js chèn cùng bộ thẻ này vào index.html cho /?tour=ID.
 *   node scripts/test-seo.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.TravelSEO = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  var BRAND = "Travel";
  var DEFAULT_DESC = "Travel – lên kế hoạch và đặt tour du lịch Việt Nam: xem lịch trình, giá, đánh giá, so sánh tour, lưu tour yêu thích và nhận tư vấn từ trợ lý.";
  var config = {
    image: "img/og-cover.png",                  // đường dẫn tương đối tới ảnh chia sẻ 1200×630
    toursApi: "/api/tours", getTours: null,      // () => Promise<mảng tour>
    tourParam: "tour"
  };
  /** Khớp theo thứ tự; `re` thử trên path của hash (đã bỏ "#", bỏ query, chữ thường). Sửa regex cho khớp router thật. */
  var ROUTES = [
    { key: "home", re: /^\/?$/, title: "Travel – Khám phá Việt Nam", desc: DEFAULT_DESC },
    { key: "tour", re: /^\/tour\/(.+)$/, title: "Chi tiết tour", desc: "Lịch trình, giá, đánh giá và chính sách của tour. Đặt tour hoặc lưu vào danh sách yêu thích." },
    { key: "tours", re: /^\/(tours?|tour-finder|finder|search)\/?$/, title: "Tìm tour du lịch", desc: "Lọc tour theo điểm đến, ngân sách, thời gian và đánh giá để chọn chuyến đi phù hợp." },
    { key: "compare", re: /^\/compare$/, title: "So sánh tour", desc: "So sánh giá, thời gian, đánh giá và địa điểm của tối đa 3 tour cạnh nhau.", noindex: true },
    { key: "favorites", re: /^\/favorites$/, title: "Tour yêu thích", desc: "Danh sách tour bạn đã lưu để xem lại và so sánh.", noindex: true },
    { key: "guides", re: /^\/guides?/, title: "Hướng dẫn viên", desc: "Danh sách hướng dẫn viên địa phương, ngôn ngữ, kinh nghiệm và lịch rảnh." },
    { key: "hotels", re: /^\/(hotels?|hotel-search|flights?)/, title: "Tìm khách sạn & vé máy bay", desc: "Tra cứu khách sạn và chuyến bay cho hành trình của bạn." },
    { key: "food", re: /^\/(food|am-thuc)/, title: "Ẩm thực địa phương", desc: "Gợi ý món ngon và quán ăn theo từng điểm đến." },
    { key: "world", re: /^\/(world|world-map|map)/, title: "Bản đồ tour thế giới", desc: "Khám phá các tour trong và ngoài nước trên bản đồ." },
    { key: "about", re: /^\/about/, title: "Về chúng tôi", desc: "Giới thiệu Travel, đội ngũ và cam kết dịch vụ." },
    { key: "policy", re: /^\/(policy|terms|privacy)/, title: "Chính sách", desc: "Chính sách đặt tour, thanh toán, hoàn huỷ và bảo mật thông tin." },
    { key: "dashboard", re: /^\/(dashboard|trips?)\/?$/, title: "Chuyến đi của tôi", desc: "Quản lý các chuyến đi bạn đã lên kế hoạch.", noindex: true },
    { key: "trip", re: /^\/(trip|trips)\/.+/, title: "Chi tiết chuyến đi", desc: "Lịch trình và chi phí chuyến đi của bạn.", noindex: true },
    { key: "create", re: /^\/(create|create-trip|new)/, title: "Tạo chuyến đi", desc: "Tạo lịch trình mới: chọn điểm đến, ngày đi và ngân sách.", noindex: true },
    { key: "addloc", re: /^\/(add-?loc|add-location)/, title: "Thêm địa điểm", desc: "Thêm địa điểm vào chuyến đi của bạn.", noindex: true },
    { key: "profile", re: /^\/(profile|account)/, title: "Hồ sơ cá nhân", desc: "Thông tin tài khoản và thông báo của bạn.", noindex: true },
    { key: "admin", re: /^\/admin/, title: "Quản trị", desc: "Khu vực quản trị: quản lý tour, đơn đặt, đánh giá và nội dung website.", noindex: true }
  ];

  // ───────────── Phần thuần ─────────────
  function splitHash(hash) {
    var h = String(hash || "").replace(/^#/, ""), q = h.indexOf("?"), path = q === -1 ? h : h.slice(0, q), query = q === -1 ? "" : h.slice(q + 1);
    return { path: (path || "/").toLowerCase().replace(/\/+$/, "") || "/", query: query };
  }
  /** "#/tour/12" → route + params. Không khớp → null. */
  function matchRoute(hash) {
    var p = splitHash(hash).path;
    for (var i = 0; i < ROUTES.length; i++) { var m = ROUTES[i].re.exec(p); if (m) { var id = null; if (m[1] != null && ROUTES[i].key === "tour") { try { id = decodeURIComponent(m[1]); } catch (e) { id = m[1]; } } return { route: ROUTES[i], tourId: id }; } }
    return null;
  }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
  function pageTitle(t) { return /Travel/.test(t) ? t : t + " – " + BRAND; }
  /** Dựng bộ meta cho 1 route. ctx: { hash, search, origin, pathname, tour?, h1? }. */
  function buildMeta(ctx) {
    var hit = matchRoute(ctx.hash), tourId = hit && hit.tourId, shareId = null;
    try { shareId = new URLSearchParams(ctx.search || "").get(config.tourParam); } catch (e) { /* bỏ qua */ }
    var id = tourId || shareId, tour = ctx.tour || null, base = (ctx.origin || "") + (ctx.pathname || "/"), m = { robots: "index, follow" };
    if (id && tour) {
      var nm = tour.name || tour.title || "Tour " + id, parts = [typeof tour.days === "number" ? tour.days + " ngày" : tour.duration, tour.location || tour.destination, typeof tour.price === "number" && tour.price > 0 ? "giá từ " + tour.price.toLocaleString("vi-VN") + " ₫" : ""].filter(Boolean).join(" · ");
      m.title = pageTitle(nm); m.description = clip((tour.description || tour.summary || "") || (nm + (parts ? " – " + parts : "") + ". Xem lịch trình, đánh giá và đặt tour."), 160);
      m.image = tour.image || tour.img || tour.thumbnail || (Array.isArray(tour.images) ? tour.images[0] : "") || "";
      m.type = "article"; m.canonical = base + "?" + config.tourParam + "=" + encodeURIComponent(id);
    } else if (id) {
      m.title = pageTitle((ctx.h1 || "Chi tiết tour")); m.description = ROUTES[1].desc; m.type = "article"; m.canonical = base + "?" + config.tourParam + "=" + encodeURIComponent(id);
    } else if (hit) {
      m.title = pageTitle(hit.route.title); m.description = hit.route.desc; m.type = "website"; if (hit.route.noindex) m.robots = "noindex, nofollow";
      m.canonical = base + (hit.route.key === "home" ? "" : "#" + splitHash(ctx.hash).path);
    } else {
      m.title = ctx.h1 ? pageTitle(ctx.h1) : ROUTES[0].title; m.description = DEFAULT_DESC; m.type = "website"; m.canonical = base;
    }
    m.url = m.canonical; m.image = m.image || config.image;
    if (m.image && !/^(https?:)?\/\//i.test(m.image)) m.image = (ctx.origin || "") + (m.image.charAt(0) === "/" ? "" : (ctx.pathname || "/").replace(/[^/]*$/, "")) + m.image;
    m.description = clip(m.description, 200); m.title = clip(m.title, 70);
    return m;
  }

  var pure = { config: config, ROUTES: ROUTES, DEFAULT_DESC: DEFAULT_DESC, matchRoute: matchRoute, buildMeta: buildMeta, splitHash: splitHash, clip: clip };
  if (!win || !win.document) return pure;

  // ───────────── Phần giao diện (trình duyệt) ─────────────
  var doc = win.document, toursCache = null, loading = null, last = "";
  function head(sel, make) { var el = doc.head.querySelector(sel); if (!el) { el = doc.createElement(make[0]); Object.keys(make[1]).forEach(function (k) { el.setAttribute(k, make[1][k]); }); doc.head.appendChild(el); } return el; }
  function setMeta(attr, name, content) { head("meta[" + attr + '="' + name + '"]', ["meta", (function (o) { o[attr] = name; return o; })({})]).setAttribute("content", content); }
  function write(m) {
    doc.title = m.title;
    setMeta("name", "description", m.description); setMeta("name", "robots", m.robots);
    setMeta("property", "og:title", m.title); setMeta("property", "og:description", m.description); setMeta("property", "og:url", m.url); setMeta("property", "og:type", m.type);
    setMeta("property", "og:image", m.image); setMeta("property", "og:site_name", BRAND); setMeta("property", "og:locale", "vi_VN");
    setMeta("name", "twitter:card", "summary_large_image"); setMeta("name", "twitter:title", m.title); setMeta("name", "twitter:description", m.description); setMeta("name", "twitter:image", m.image);
    head('link[rel="canonical"]', ["link", { rel: "canonical" }]).setAttribute("href", m.canonical);
  }
  function loadTours() {
    if (toursCache) return Promise.resolve(toursCache);
    if (loading) return loading;
    var p = config.getTours ? config.getTours() : win.fetch(config.toursApi).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) { return Array.isArray(d) ? d : (d.tours || []); });
    loading = p.then(function (list) { toursCache = {}; list.forEach(function (t) { toursCache[String(t.tourId != null ? t.tourId : t.id)] = t; }); return toursCache; }, function () { toursCache = {}; return toursCache; });
    return loading;
  }
  function visibleH1() {
    var hs = doc.querySelectorAll("main h1, h1"); for (var i = 0; i < hs.length; i++) { var h = hs[i]; if ((h.offsetWidth || h.offsetHeight) && !h.hasAttribute("data-a11y-h1") && !h.closest("[aria-modal='true']") && h.textContent.trim()) return h.textContent.trim(); }
    return "";
  }
  function ctxNow(tour) { var l = win.location; return { hash: l.hash, search: l.search, origin: l.origin || (l.protocol + "//" + l.host), pathname: l.pathname, tour: tour, h1: visibleH1() }; }
  function apply() {
    var c = ctxNow(null), hit = matchRoute(c.hash), id = (hit && hit.tourId) || (function () { try { return new URLSearchParams(c.search).get(config.tourParam); } catch (e) { return null; } })();
    write(buildMeta(c));
    if (id) loadTours().then(function (by) { var t = by[String(id)]; if (t && (hit && hit.tourId ? win.location.hash === c.hash : true)) write(buildMeta(ctxNow(t))); });
    else if (!hit || hit.route.key !== "home") win.setTimeout(function () { if (win.location.hash === c.hash) { var h1 = visibleH1(); if (h1 && !hit) write(buildMeta(ctxNow(null))); } }, 400);   // route lạ: đợi trang vẽ xong rồi lấy h1
  }
  pure.apply = apply; pure.write = write;
  function init() { apply(); win.addEventListener("hashchange", apply); }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
  return pure;
});
