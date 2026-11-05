/**
 * banner.js – Banner động ở trang chủ (A6)
 *   - lấy banner ĐANG CHẠY từ /api/banners/active (server tự tính active theo startAt/endAt + công tắc bật/tắt)
 *   - có banner → hiện carousel; không có banner / không có server → carousel slide mặc định (viết sẵn trong html/page-home.html)
 *   - tự tải lại đúng lúc có banner bắt đầu/hết hạn (nextChange) và định kỳ 60 giây
 */
const BannerUI = (() => {
  const root = () => document.getElementById("bannerCarousel");
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let sig = "", idx = 0, timer = null, nextTimer = null, count = 0;

  let defaultHTML = "";   // slide mặc định lấy từ page-home.html
  let serverMode = false; // true khi đang hiện banner từ server (server tự xếp theo thứ hạng tour)

  function go(i, user) {
    const el = root(); if (!el || !count) return;
    idx = (i + count) % count;
    el.querySelector(".bn-track").style.transform = "translateX(" + (-100 * idx) + "%)";
    el.querySelectorAll(".bn-slide").forEach((s, k) => { s.setAttribute("aria-hidden", k === idx ? "false" : "true"); s.querySelectorAll("a,button").forEach(x => { x.tabIndex = k === idx ? 0 : -1; }); });
    el.querySelectorAll(".bn-dot").forEach((d, k) => { d.classList.toggle("on", k === idx); d.setAttribute("aria-current", k === idx ? "true" : "false"); });
    if (user) play();
  }
  function play() {
    clearInterval(timer);
    if (count > 1 && !reduce) timer = setInterval(() => go(idx + 1), 5000);
  }

  function openLink(link) {
    if (!link) return;
    if (link === "action:login") { (document.getElementById("nav-login-btn") || document.querySelector("#nav-auth-area button"))?.click(); return; }
    if (link.charAt(0) === "#" && link.indexOf("#/") !== 0) {          // "#sec-tours" → cuộn tới mục
      const t = document.getElementById(link.slice(1));
      if (t) { t.scrollIntoView({ behavior: "smooth" }); return; }
    }
    if (/^https?:\/\//i.test(link)) window.open(link, "_blank", "noopener");
    else location.href = link;
  }

  function controls() {
    const el = root();
    el.querySelectorAll(".bn-nav,.bn-dots").forEach(x => x.remove());
    el.querySelectorAll(".bn-slide").forEach((s, k) => s.setAttribute("aria-label", (k + 1) + " / " + count));
    if (count > 1) el.insertAdjacentHTML("beforeend",
      '<button type="button" class="bn-nav prev" aria-label="Banner trước">‹</button><button type="button" class="bn-nav next" aria-label="Banner sau">›</button>'
      + '<div class="bn-dots">' + Array.from({ length: count }, (_, k) => '<button type="button" class="bn-dot" aria-label="Tới banner ' + (k + 1) + '"></button>').join("") + "</div>");
    el.querySelectorAll(".bn-cta[data-link]").forEach(b => b.addEventListener("click", () => openLink(b.dataset.link)));
    el.querySelectorAll(".bn-cover").forEach(a => a.addEventListener("click", e => { const h = a.getAttribute("href") || ""; if (h.indexOf("#/tour/") === 0) { e.preventDefault(); location.hash = h; } }));
    el.querySelector(".bn-nav.prev")?.addEventListener("click", () => go(idx - 1, true));
    el.querySelector(".bn-nav.next")?.addEventListener("click", () => go(idx + 1, true));
    el.querySelectorAll(".bn-dot").forEach((d, k) => d.addEventListener("click", () => go(k, true)));
    el.onmouseenter = () => clearInterval(timer); el.onmouseleave = play;
    el.onfocusin = () => clearInterval(timer); el.onfocusout = play;
    let x0 = null;   // vuốt trên điện thoại
    el.ontouchstart = e => { x0 = e.touches[0].clientX; };
    el.ontouchend = e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1), true); };
    idx = Math.min(idx, count - 1); go(idx); play();
  }

  // list rỗng → dùng slide mặc định viết sẵn trong HTML
  function render(list) {
    const el = root(); if (!el) return;
    clearInterval(timer);
    serverMode = !!(list && list.length);
    if (!list || !list.length) {
      el.innerHTML = defaultHTML;
      el.querySelector("#hero-create-btn")?.addEventListener("click", () => document.getElementById("nav-create-trip-btn")?.click());
    } else {
      el.innerHTML = '<div class="bn-track">' + list.map(b => {
        if (b.imageOnly && b.image) {   // banner ảnh nguyên tấm (chữ đã nằm trong ảnh): bấm vào → trang tour
          return '<article class="bn-slide bn-img" role="group" aria-roledescription="slide"><a class="bn-cover" href="' + esc(b.link || "#sec-tours") + '" aria-label="' + esc(b.title) + '"><img data-eager src="' + esc(b.image) + '" alt="' + esc(b.title) + '" width="1024" height="338"></a></article>';
        }
        const bg = b.image
          ? "linear-gradient(90deg,rgba(7,22,39,.78),rgba(7,22,39,.25)),url('" + esc(b.image) + "') center/cover"
          : "linear-gradient(135deg," + esc(b.bgFrom) + "," + esc(b.bgTo) + ")";
        return '<article class="bn-slide" role="group" aria-roledescription="slide" style="background:' + bg + '">'
          + '<div class="bn-inner">'
          + (b.badge ? '<span class="badge" style="display:inline-block;background:rgba(234,179,8,0.25);color:#fde047;border:1px solid rgba(234,179,8,0.5);margin-bottom:8px;padding:3px 10px;font-size:12px;font-weight:700;border-radius:999px">' + esc(b.badge) + '</span>' : '')
          + '<h2>' + esc(b.title) + "</h2>" + (b.subtitle ? "<p>" + esc(b.subtitle) + "</p>" : "")
          + (b.link && b.ctaText ? '<button type="button" class="bn-cta" data-link="' + esc(b.link) + '">' + esc(b.ctaText) + " →</button>" : "") + "</div></article>";
      }).join("") + "</div>";
    }
    count = el.querySelectorAll(".bn-slide").length;
    controls();
  }

  async function load() {
    clearTimeout(nextTimer);
    let data = null;
    try { const r = await Api.get("/api/banners/active"); if (r.ok) data = r.data; } catch (e) { /* không có server → hero mặc định */ }
    if (data) {
      const s = JSON.stringify(data.banners.map(b => [b.id, b.title, b.subtitle, b.image, b.bgFrom, b.bgTo, b.link, b.ctaText, b.imageOnly, b.tourId]));
      if (s !== sig) { sig = s; render(data.banners); }
      // hẹn giờ đúng lúc banner kế tiếp bắt đầu/hết hạn (tính theo đồng hồ server để không lệch giờ máy khách)
      if (data.nextChange) {
        const wait = Date.parse(data.nextChange) - Date.parse(data.serverTime) + 500;
        nextTimer = setTimeout(load, Math.min(Math.max(wait, 1000), 60000));
      }
    }
  }
  // Không có server: tự đổi chỗ 5 banner mặc định theo thứ hạng (Featured phát sự kiện travel:ranking)
  function reorderDefault(order) {
    const el = root(); if (!el || serverMode || !order || !order.length) return;
    const track = el.querySelector(".bn-track"); if (!track) return;
    const pos = id => { const i = order.indexOf(String(id)); return i < 0 ? 999 : i; };
    const slides = [...track.querySelectorAll(".bn-slide[data-tour]")];
    const sorted = slides.slice().sort((a, b) => pos(a.dataset.tour) - pos(b.dataset.tour));
    if (sorted.every((s, i) => s === slides[i])) return;
    sorted.forEach(s => track.appendChild(s));
    defaultHTML = '<div class="bn-track">' + track.innerHTML + "</div>";   // nhớ thứ tự mới
    idx = 0; controls();
  }
  document.addEventListener("travel:ranking", e => reorderDefault(e.detail && e.detail.order));
  document.addEventListener("travel:bookings", () => { if (typeof BannerUI !== "undefined") BannerUI.reload(); });
  function init() { if (!root()) return; defaultHTML = root().innerHTML; render(); load(); setInterval(load, 60000); document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { reload: () => { sig = ""; return load(); } };
})();
window.BannerUI = BannerUI;

;
/**
 * featured.js – Bảng xếp hạng "Tour được yêu thích nhất"
 *   - /api/tours/featured: server xếp theo LƯỢT DÙNG tour (số liệu mẫu khởi điểm + đơn thật không hủy),
 *     tối đa TOP_N tour; kèm điểm đánh giá, lượt đánh giá (luôn nhỏ hơn lượt dùng) và số hạng
 *   - Tour được mua nhiều hơn tự lên hạng; phát sự kiện "travel:ranking" để banner đổi chỗ theo
 *   - Không có server: đọc data/tour-stats.json (chỉ số liệu mẫu, chưa cộng đơn thật)
 * Phụ thuộc: home.js (TOUR_SAMPLES, tourCardHtml, loadHomeData, viewTourSample)
 */
const Featured = (() => {
  let busy = false, last = [];
  const TOP_N = 11;
  const nf = n => new Intl.NumberFormat("vi-VN").format(n);

  async function fromStaticSeed() {
    try {
      const d = await (await fetch("data/tour-stats.json", { cache: "no-cache" })).json();
      return (d.tours || []).map(x => ({ tourId: String(x.tourId), count: x.used, used: x.used, reviews: x.reviews, rating: x.rating }))
        .sort((a, b) => b.used - a.used || b.reviews - a.reviews).slice(0, TOP_N).map((x, i) => Object.assign(x, { rank: i + 1 }));
    } catch (e) { return []; }
  }

  async function load() {
    try { const r = await Api.get("/api/tours/featured"); if (r.ok && (r.data.tours || []).length) return r.data.tours; } catch (e) { /* không có server */ }
    return fromStaticSeed();
  }

  async function refresh() {
    const wrap = document.getElementById("featuredWrap"), box = document.getElementById("featuredList");
    if (!wrap || !box || busy) return;
    busy = true;
    try {
      const items = await load();
      if (items.length && typeof loadHomeData === "function") await loadHomeData().catch(() => {});
      const byId = new Map((window.TOUR_SAMPLES || []).map(t => [String(t.id), t]));
      const shown = items.filter(i => byId.has(String(i.tourId)));
      const cards = shown.map(i => {
        const t = byId.get(String(i.tourId));
        const statParts = [];
        if (i.rating) statParts.push('<span class="tc-fact tc-rate">★ ' + i.rating.toFixed(1) + "</span>");
        if (i.reviews != null && i.reviews > 0) statParts.push('<span class="tc-fact">(' + nf(i.reviews) + " đánh giá)</span>");
        if (i.count != null && i.count > 0) statParts.push('<span class="tc-fact" title="Số lượt dùng tour (không tính đơn đã hủy)">' + nf(i.count) + " lượt dùng</span>");
        const stats = statParts.join(" ");
        const html = tourCardHtml(Object.assign({}, t, { displayPrice: t.price, _stats: stats }));
        return '<div class="ft-item"><span class="ft-rank' + (i.rank <= 3 ? " is-top" : "") + '" role="img" aria-label="Hạng ' + i.rank + '" title="Thứ hạng hiện tại">' + i.rank + "</span>" + html + "</div>";
      });
      wrap.hidden = !cards.length;
      box.innerHTML = cards.join("");
      last = items.map(i => String(i.tourId));
      document.dispatchEvent(new CustomEvent("travel:ranking", { detail: { order: last, items } }));
    } finally { busy = false; }
  }
  const box = document.getElementById("featuredList");
  box?.addEventListener("click", e => {
    const el = e.target.closest("[data-tour-id]");
    if (el && typeof viewTourSample === "function") viewTourSample(el.dataset.tourId);
  });
  const start = () => setTimeout(refresh, 400);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  document.addEventListener("travel:bookings", refresh);   // đơn đổi (hủy/khôi phục/đặt mới) → xếp hạng lại, banner đổi chỗ
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  return { refresh, order: () => last.slice() };
})();
window.Featured = Featured;
