/**
 * js/favorites.js – Giai đoạn 11 (P2): Yêu thích + So sánh (LocalStorage). Tự gắn vào trang khi nạp (cần css/favorites.css), không phụ thuộc file JS khác.
 *   11.1  nút ♡ trên card tour           11.2  lưu/xóa tourId trong LocalStorage (travel_favorites)
 *   11.3  trang "Yêu thích" (#/favorites) 11.4  nút "So sánh" + tối đa 3 tour (travel_compare), vượt thì báo
 *   11.5  bảng so sánh (#/compare?ids=a,b,c): giá, ngày, rating, địa điểm…
 *   11.6  nút "Chia sẻ" tạo URL  <trang>?tour=ID      11.8  nút sao chép link + thông báo "Đã sao chép"
 *   11.7  mở trang với ?tour=ID → chuyển tới đúng tour (config.openTour; mặc định đổi hash sang config.tourUrl(id))
 * Gắn vào card: thêm vào phần tử gốc của card tour trong template   data-tour-card="<tourId>"
 *   (hoặc đổi TravelFav.config.cardSelector / getTourId cho khớp markup có sẵn).  Dữ liệu tour cho trang Yêu thích: config.getTours (mặc định GET /api/tours).
 * Phần thuần (createListStore, renderFavoriteCards…) chạy được trong Node:  node scripts/test-favorites.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.TravelFav = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  var KEY_FAV = "travel_favorites", KEY_CMP = "travel_compare", MAX_COMPARE = 3;
  var config = {
    cardSelector: "[data-tour-card]",
    getTourId: function (card) { return card.getAttribute("data-tour-card") || card.getAttribute("data-tour-id"); },
    tourUrl: function (id) { return "#/tour/" + encodeURIComponent(id); },          // ← khớp router của website
    homeHash: "#/",
    toursApi: "/api/tours",
    getTours: null,                                                                 // () => Promise<mảng tour>; để null = dùng toursApi
    openTour: null,                                                                 // (id) => … ; mặc định đổi hash sang config.tourUrl(id) (11.7)
    shareParam: "tour",
    onCompare: null,                                                                // (ids) => … ; mặc định đổi hash sang #/compare?ids=a,b,c
    notify: null                                                                    // (msg) => … ; mặc định hiện toast riêng (đổi sang toast của website nếu muốn)
  };
  var MSG = {
    limit: "Chỉ so sánh tối đa " + MAX_COMPARE + " tour cùng lúc. Hãy bỏ bớt một tour rồi chọn lại.",
    needMore: "Chọn thêm ít nhất 1 tour nữa để so sánh.",
    favOn: "Đã thêm vào Yêu thích", favOff: "Đã bỏ khỏi Yêu thích",
    copied: "Đã sao chép", copyFail: "Không sao chép được, hãy chọn link và sao chép thủ công."
  };

  // ───────────── Phần thuần ─────────────
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function memoryStorage() { var d = {}; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } }; }
  function pickStorage(w) { try { var s = w && w.localStorage; if (s) { s.setItem("__fv", "1"); s.removeItem("__fv"); return s; } } catch (e) { /* chế độ riêng tư… */ } return memoryStorage(); }

  /** Danh sách id lưu trong 1 khoá storage. max (tuỳ chọn) = số phần tử tối đa. id luôn được chuẩn hoá về chuỗi. */
  function createListStore(key, storage, max) {
    var subs = [];
    function read() {
      try {
        var a = JSON.parse(storage.getItem(key) || "[]"), seen = {};
        if (!Array.isArray(a)) return [];
        return a.filter(function (x) { return x != null; }).map(String).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
      } catch (e) { return []; }                                                    // dữ liệu hỏng → coi như rỗng
    }
    function emit() { subs.forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } }); }
    function write(list) { try { storage.setItem(key, JSON.stringify(list)); } catch (e) { /* hết dung lượng… */ } emit(); }
    var api = {
      list: read, has: function (id) { return read().indexOf(String(id)) !== -1; }, subscribe: function (f) { subs.push(f); }, emit: emit,
      remove: function (id) { write(read().filter(function (x) { return x !== String(id); })); },
      clear: function () { write([]); },
      /** → { ok, active } hoặc { ok:false, reason:"limit", max } khi đã đủ max mà còn thêm. */
      toggle: function (id) {
        id = String(id); var list = read();
        if (list.indexOf(id) !== -1) { write(list.filter(function (x) { return x !== id; })); return { ok: true, active: false }; }
        if (max && list.length >= max) return { ok: false, reason: "limit", max: max };
        list.push(id); write(list); return { ok: true, active: true };
      }
    };
    return api;
  }

  /** Chuẩn hoá 1 tour từ API về { id, name, image, price, duration } (chỉnh alias cho khớp dữ liệu thật). */
  function tourView(t) {
    t = t || {};
    var dur = t.duration != null ? t.duration : t.days;
    var rt = t.rating != null ? t.rating : (t.avgRating != null ? t.avgRating : t.stars);
    return {
      id: String(t.tourId != null ? t.tourId : t.id), name: t.name || t.title || "",
      image: t.image || t.img || t.thumbnail || (Array.isArray(t.images) ? t.images[0] : "") || "",
      price: typeof t.price === "number" && t.price > 0 ? t.price.toLocaleString("vi-VN") + " ₫" : "",
      priceNum: typeof t.price === "number" && t.price > 0 ? t.price : null,
      duration: typeof dur === "number" ? dur + " ngày" : (dur || ""),
      ratingNum: isFinite(parseFloat(rt)) && parseFloat(rt) > 0 ? parseFloat(rt) : null,
      reviews: t.reviewCount != null ? t.reviewCount : (t.reviews != null && typeof t.reviews !== "object" ? t.reviews : null),
      location: [t.location, t.destination, t.place, t.region, t.city].filter(function (x) { return typeof x === "string" && x; })[0] || "",
      departure: t.departure || t.startDate || t.date || "",
      transport: t.transport || t.vehicle || "",
      groupSize: t.groupSize != null ? t.groupSize : (t.maxPeople != null ? t.maxPeople : "")
    };
  }

  function heartBtn(id, on, name) { var lb = "Yêu thích" + (name ? ": " + name : ""); return '<button type="button" class="fv-heart' + (on ? " is-on" : "") + '" data-fav-id="' + escapeHtml(id) + '"' + (name ? ' data-fv-name="' + escapeHtml(name) + '"' : "") + ' aria-pressed="' + !!on + '" aria-label="' + escapeHtml(lb) + '" title="' + (on ? "Bỏ khỏi Yêu thích" : "Thêm vào Yêu thích") + '"><span aria-hidden="true">' + (on ? "♥" : "♡") + "</span></button>"; }
  function cmpBtn(id, on) { return '<button type="button" class="fv-cmp' + (on ? " is-on" : "") + '" data-cmp-id="' + escapeHtml(id) + '" aria-pressed="' + !!on + '">' + (on ? "✓ Đã chọn" : "So sánh") + "</button>"; }

  /** HTML lưới card cho trang Yêu thích. byId: { id → tour }. state: { fav:[ids], cmp:[ids] }. */
  function renderFavoriteCards(ids, byId, state, cfg) {
    cfg = cfg || config; state = state || { fav: ids, cmp: [] };
    return ids.map(function (id) {
      var raw = byId && byId[id];
      if (!raw) return '<article class="fv-card fv-card--gone"><div class="fv-card__body"><p class="fv-card__name">Tour ' + escapeHtml(id) + ' không còn tồn tại</p><div class="fv-card__actions">' + heartBtn(id, true, "Tour " + id) + "</div></div></article>";
      var t = tourView(raw), url = escapeHtml(cfg.tourUrl(t.id));
      return '<article class="fv-card"><a class="fv-card__img" href="' + url + '" tabindex="-1"' + (t.image ? "" : ' aria-hidden="true"') + ">" + (t.image ? '<img loading="lazy" src="' + escapeHtml(t.image) + '" alt="' + escapeHtml(t.name) + '">' : "") + "</a>"
        + '<div class="fv-card__body"><a class="fv-card__name" href="' + url + '">' + escapeHtml(t.name || "Tour " + t.id) + "</a>"
        + '<div class="fv-card__meta">' + [t.duration, t.price].filter(Boolean).map(escapeHtml).join(" · ") + "</div>"
        + '<div class="fv-card__actions">' + heartBtn(t.id, state.fav.indexOf(t.id) !== -1, t.name) + shareBtn(t.id, t.name) + cmpBtn(t.id, state.cmp.indexOf(t.id) !== -1) + "</div></div></article>";
    }).join("");
  }

  // ── 11.6 / 11.7 URL chia sẻ  ?tour=ID ──
  /** loc: { origin, pathname } (vd. window.location). Kết quả: origin + pathname + "?tour=ID" (bỏ query/hash khác). */
  function buildShareUrl(loc, id, param) { return String(loc.origin || "") + String(loc.pathname || "/") + "?" + (param || config.shareParam) + "=" + encodeURIComponent(String(id)); }
  /** "?tour=abc" → "abc"; không có / rỗng → null. */
  function parseTourParam(search, param) {
    try { var v = new URLSearchParams(search || "").get(param || config.shareParam); v = v == null ? "" : v.trim(); return v ? v : null; } catch (e) { return null; }
  }
  /** "#/compare?ids=a,b,c" → ["a","b","c"] (bỏ trùng, tối đa MAX_COMPARE). */
  function parseCompareIds(hash) {
    var q = String(hash || "").split("?")[1] || "", m = /(?:^|&)ids=([^&]*)/.exec(q), out = [];
    if (!m) return out;
    m[1].split(",").forEach(function (x) { var id; try { id = decodeURIComponent(x).trim(); } catch (e) { id = x.trim(); } if (id && out.indexOf(id) === -1 && out.length < MAX_COMPARE) out.push(id); });
    return out;
  }

  // ── 11.5 bảng so sánh ──
  function shareBtn(id, name) { return '<button type="button" class="fv-share" data-share-id="' + escapeHtml(id) + '" aria-label="Chia sẻ tour' + (name ? ": " + escapeHtml(name) : "") + '" title="Chia sẻ"><span aria-hidden="true">⤴</span></button>'; }
  /** Các hàng của bảng: [{ label, cells:[text…], best:index|-1 }]. Hàng không tour nào có dữ liệu thì bỏ. */
  function compareRows(views) {
    function best(key, dir) {                                                       // vị trí tour tốt nhất; -1 nếu không có dữ liệu hoặc tất cả bằng nhau
      var bi = -1, bv = null, vals = [];
      views.forEach(function (v, i) { var n = v[key]; if (n == null) return; vals.push(n); if (bv == null || (dir < 0 ? n < bv : n > bv)) { bv = n; bi = i; } });
      return vals.length > 1 && vals.some(function (n) { return n !== bv; }) ? bi : -1;
    }
    var defs = [
      { label: "Giá", get: function (v) { return v.price; }, best: best("priceNum", -1) },
      { label: "Thời gian", get: function (v) { return v.duration; } },
      { label: "Đánh giá", get: function (v) { return v.ratingNum != null ? v.ratingNum.toFixed(1) + " ★" + (v.reviews != null ? " (" + v.reviews + ")" : "") : ""; }, best: best("ratingNum", 1) },
      { label: "Địa điểm", get: function (v) { return v.location; } },
      { label: "Khởi hành", get: function (v) { return v.departure; } },
      { label: "Phương tiện", get: function (v) { return v.transport; } },
      { label: "Số khách", get: function (v) { return v.groupSize === "" ? "" : String(v.groupSize); } }
    ];
    return defs.map(function (d) { return { label: d.label, cells: views.map(d.get), best: d.best == null ? -1 : d.best }; })
      .filter(function (r) { return r.cells.some(function (c) { return c !== ""; }); });
  }
  /** HTML bảng so sánh. ids: tối đa 3 id; byId: { id → tour }. */
  function renderCompareTable(ids, byId, cfg) {
    cfg = cfg || config;
    var views = ids.map(function (id) { return byId && byId[id] ? tourView(byId[id]) : null; });
    var present = views.map(function (v, i) { return v || { id: ids[i], name: "", gone: true, priceNum: null, ratingNum: null, price: "", duration: "", reviews: null, location: "", departure: "", transport: "", groupSize: "", image: "" }; });
    var head = present.map(function (v) {
      if (v.gone) return '<th scope="col" class="fv-cmp-col fv-cmp-col--gone"><p class="fv-card__name">Tour ' + escapeHtml(v.id) + ' không còn tồn tại</p><button type="button" class="fv-cmp is-on" data-cmp-id="' + escapeHtml(v.id) + '" aria-pressed="true">✓ Đã chọn</button></th>';
      var url = escapeHtml(cfg.tourUrl(v.id));
      return '<th scope="col" class="fv-cmp-col"><a class="fv-cmp-col__img" href="' + url + '" tabindex="-1"' + (v.image ? "" : ' aria-hidden="true"') + '>' + (v.image ? '<img loading="lazy" src="' + escapeHtml(v.image) + '" alt="' + escapeHtml(v.name) + '">' : "") + '</a>'
        + '<a class="fv-card__name" href="' + url + '">' + escapeHtml(v.name || "Tour " + v.id) + "</a>"
        + '<div class="fv-card__actions">' + shareBtn(v.id, v.name) + '<button type="button" class="fv-cmp is-on" data-cmp-id="' + escapeHtml(v.id) + '" aria-label="Bỏ khỏi so sánh' + (v.name ? ": " + escapeHtml(v.name) : "") + '">Bỏ</button></div></th>';
    }).join("");
    var rows = compareRows(present).map(function (r) {
      return "<tr><th scope=\"row\">" + escapeHtml(r.label) + "</th>" + r.cells.map(function (c, i) { return "<td" + (r.best === i ? ' class="is-best"' : "") + ">" + (c === "" ? '<span class="fv-na">—</span>' : escapeHtml(c)) + "</td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="fv-table-wrap" tabindex="0" role="region" aria-label="Bảng so sánh tour (cuộn ngang bằng phím mũi tên)"><table class="fv-table"><caption class="fv-sr">So sánh ' + present.length + ' tour</caption><thead><tr><td><span class="fv-sr">Tiêu chí</span></td>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  var pure = { buildShareUrl: buildShareUrl, parseTourParam: parseTourParam, parseCompareIds: parseCompareIds, compareRows: compareRows, renderCompareTable: renderCompareTable, shareBtn: shareBtn, KEY_FAV: KEY_FAV, KEY_CMP: KEY_CMP, MAX_COMPARE: MAX_COMPARE, MSG: MSG, config: config, createListStore: createListStore, tourView: tourView, renderFavoriteCards: renderFavoriteCards, escapeHtml: escapeHtml, heartBtn: heartBtn, cmpBtn: cmpBtn };
  if (!win || !win.document) return pure;

  // ───────────── Phần giao diện (trình duyệt) ─────────────
  var doc = win.document, storage = pickStorage(win);
  var favs = createListStore(KEY_FAV, storage), cmp = createListStore(KEY_CMP, storage, MAX_COMPARE);
  var toursCache = null, pageEl = null, cmpEl = null, shareEl = null, pill = null, tray = null, toastEl = null, toastTimer = null, raf = 0;
  pure.favs = favs; pure.cmp = cmp;

  function notify(msg) {
    if (config.notify) return config.notify(msg);
    if (!toastEl) { toastEl = doc.createElement("div"); toastEl.className = "fv-toast"; toastEl.setAttribute("role", "status"); doc.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("is-show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("is-show"); }, 3200);
  }

  function cardName(card) { var h = card.querySelector("h1,h2,h3,h4,h5,[class*='name'],[class*='title']"); return h ? (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100) : ""; }
  function decorate() {
    raf = 0;
    Array.prototype.forEach.call(doc.querySelectorAll(config.cardSelector), function (card) {
      if (card.getAttribute("data-fv-ready")) return;
      var id = config.getTourId(card); if (!id) return;
      card.setAttribute("data-fv-ready", "1"); card.classList.add("fv-host");
      var nm = cardName(card);
      card.insertAdjacentHTML("beforeend", '<div class="fv-actions"><span class="fv-actions__l">' + heartBtn(id, favs.has(id), nm) + shareBtn(id, nm) + "</span>" + cmpBtn(id, cmp.has(id)) + "</div>");
    });
  }
  function scheduleDecorate() { if (!raf) raf = win.requestAnimationFrame ? win.requestAnimationFrame(decorate) : setTimeout(decorate, 16); }

  function refresh() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-fav-id]"), function (b) {
      var on = favs.has(b.getAttribute("data-fav-id"));
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); b.innerHTML = '<span aria-hidden="true">' + (on ? "♥" : "♡") + "</span>";
      b.title = on ? "Bỏ khỏi Yêu thích" : "Thêm vào Yêu thích";
    });
    Array.prototype.forEach.call(doc.querySelectorAll("[data-cmp-id]"), function (b) {
      var on = cmp.has(b.getAttribute("data-cmp-id"));
      b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "✓ Đã chọn" : "So sánh";
    });
    if (!pill) { pill = doc.createElement("a"); pill.className = "fv-pill"; pill.href = "#/favorites"; pill.setAttribute("aria-label", "Tour yêu thích"); doc.body.appendChild(pill); }
    pill.innerHTML = '<span aria-hidden="true">♡</span> Yêu thích <b>' + favs.list().length + "</b>"; pill.setAttribute("aria-label", "Tour yêu thích: " + favs.list().length); pill.hidden = !favs.list().length;
    var c = cmp.list();
    if (!tray) { tray = doc.createElement("div"); tray.className = "fv-tray"; tray.setAttribute("role", "region"); tray.setAttribute("aria-label", "Tour đang chọn để so sánh"); doc.body.appendChild(tray); }
    tray.hidden = !c.length;
    tray.innerHTML = '<span>So sánh: <b>' + c.length + "/" + MAX_COMPARE + '</b> tour</span><button type="button" data-fv-act="go">So sánh ngay</button><button type="button" data-fv-act="clear" class="fv-tray__ghost">Bỏ chọn</button>';
    if (pageEl) renderPage();
    if (cmpEl) renderComparePage();
  }

  doc.addEventListener("click", function (e) {                                       // pha capture: chặn click lọt xuống card (card thường là link / có sự kiện mở tour)
    var el = e.target && e.target.closest ? e.target : null; if (!el) return;
    var f = el.closest("[data-fav-id]"), c = el.closest("[data-cmp-id]"), a = el.closest("[data-fv-act]"), sh = el.closest("[data-share-id]");
    if (!f && !c && !a && !sh) return;
    e.preventDefault(); e.stopPropagation();
    if (sh) openShare(sh.getAttribute("data-share-id"));
    else if (f) { var r = favs.toggle(f.getAttribute("data-fav-id")); notify(r.active ? MSG.favOn : MSG.favOff); }
    else if (c) { var r2 = cmp.toggle(c.getAttribute("data-cmp-id")); if (!r2.ok) notify(MSG.limit); }
    else if (a.getAttribute("data-fv-act") === "clear") cmp.clear();
    else if (a.getAttribute("data-fv-act") === "copy") copyShareLink();
    else if (a.getAttribute("data-fv-act") === "close-share") closeShare();
    else if (a.getAttribute("data-fv-act") === "go") {
      var ids = cmp.list(); if (ids.length < 2) return notify(MSG.needMore);
      if (config.onCompare) config.onCompare(ids); else win.location.hash = "#/compare?ids=" + ids.map(encodeURIComponent).join(",");
    }
  }, true);

  // ── 11.3 trang Yêu thích (lớp phủ toàn màn hình, không phụ thuộc router sẵn có) ──
  function loadTours() {
    if (toursCache) return Promise.resolve(toursCache);
    var p = config.getTours ? config.getTours() : win.fetch(config.toursApi).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) { return Array.isArray(d) ? d : (d.tours || []); });
    return p.then(function (list) { toursCache = {}; list.forEach(function (t) { toursCache[tourView(t).id] = t; }); return toursCache; });
  }
  function renderPage() {
    var ids = favs.list(), body = pageEl.querySelector(".fv-page__body");
    pageEl.querySelector(".fv-page__count").textContent = ids.length ? "(" + ids.length + ")" : "";
    if (!ids.length) { body.innerHTML = '<div class="fv-empty"><p>Chưa có tour yêu thích nào.</p><p>Bấm ♡ trên tour bạn thích để lưu lại ở đây.</p><a class="fv-btn" href="' + escapeHtml(config.homeHash) + '">Khám phá tour</a></div>'; return; }
    if (!toursCache) return;
    body.innerHTML = '<div class="fv-grid">' + renderFavoriteCards(ids, toursCache, { fav: ids, cmp: cmp.list() }, config) + "</div>";
  }
  function openPage() {
    if (pageEl) return;
    pageEl = doc.createElement("section"); pageEl.className = "fv-page"; pageEl.setAttribute("role", "dialog"); pageEl.setAttribute("aria-modal", "true"); pageEl.setAttribute("aria-label", "Tour yêu thích");
    pageEl.innerHTML = '<header class="fv-page__head"><a class="fv-btn fv-btn--ghost" href="' + escapeHtml(config.homeHash) + '">← Quay lại</a><h2>Tour yêu thích <span class="fv-page__count"></span></h2></header><div class="fv-page__body"><p class="fv-loading">Đang tải…</p></div>';
    doc.body.appendChild(pageEl); doc.body.style.overflow = "hidden";
    function load() {
      loadTours().then(renderPage, function () {
        pageEl.querySelector(".fv-page__body").innerHTML = '<div class="fv-empty"><p>Không tải được danh sách tour.</p><button type="button" class="fv-btn" id="fv-retry">Thử lại</button></div>';
        pageEl.querySelector("#fv-retry").onclick = load;
      });
    }
    load();
    refresh();
  }
  function closePage() { if (!pageEl) return; pageEl.parentNode.removeChild(pageEl); pageEl = null; if (!cmpEl) doc.body.style.overflow = ""; }
  // ── 11.5 trang So sánh (#/compare?ids=a,b,c; không có ids thì dùng danh sách đang chọn) ──
  function compareIds() { var ids = parseCompareIds(win.location.hash); return ids.length ? ids : cmp.list(); }
  function renderComparePage() {
    var body = cmpEl.querySelector(".fv-page__body"), ids = compareIds();
    if (ids.length < 2) { body.innerHTML = '<div class="fv-empty"><p>' + escapeHtml(MSG.needMore) + '</p><a class="fv-btn" href="' + escapeHtml(config.homeHash) + '">Khám phá tour</a></div>'; return; }
    if (!toursCache) return;
    body.innerHTML = renderCompareTable(ids, toursCache, config);
  }
  function openComparePage() {
    if (cmpEl) { renderComparePage(); return; }
    cmpEl = doc.createElement("section"); cmpEl.className = "fv-page"; cmpEl.setAttribute("role", "dialog"); cmpEl.setAttribute("aria-modal", "true"); cmpEl.setAttribute("aria-label", "So sánh tour");
    cmpEl.innerHTML = '<header class="fv-page__head"><a class="fv-btn fv-btn--ghost" href="' + escapeHtml(config.homeHash) + '">← Quay lại</a><h2>So sánh tour</h2></header><div class="fv-page__body"><p class="fv-loading">Đang tải…</p></div>';
    doc.body.appendChild(cmpEl); doc.body.style.overflow = "hidden";
    function load() {
      loadTours().then(renderComparePage, function () {
        cmpEl.querySelector(".fv-page__body").innerHTML = '<div class="fv-empty"><p>Không tải được danh sách tour.</p><button type="button" class="fv-btn" id="fv-retry-cmp">Thử lại</button></div>';
        cmpEl.querySelector("#fv-retry-cmp").onclick = load;
      });
    }
    load(); renderComparePage();
  }
  function closeComparePage() { if (!cmpEl) return; cmpEl.parentNode.removeChild(cmpEl); cmpEl = null; if (!pageEl) doc.body.style.overflow = ""; }

  // ── 11.6 / 11.8 chia sẻ: tạo URL ?tour=ID, hộp thoại có nút sao chép ──
  function closeShare() { if (shareEl) { shareEl.parentNode.removeChild(shareEl); shareEl = null; } }
  function openShare(id) {
    closeShare();
    var url = buildShareUrl(win.location, id);
    shareEl = doc.createElement("div"); shareEl.className = "fv-modal"; shareEl.setAttribute("role", "dialog"); shareEl.setAttribute("aria-modal", "true"); shareEl.setAttribute("aria-label", "Chia sẻ tour");
    shareEl.innerHTML = '<div class="fv-modal__box"><h2>Chia sẻ tour</h2><div class="fv-modal__row"><label class="fv-sr" for="fv-share-url">Link chia sẻ tour</label><input id="fv-share-url" class="fv-modal__input" type="text" readonly value="' + escapeHtml(url) + '">'
      + '<button type="button" class="fv-btn" data-fv-act="copy">Sao chép link</button></div><button type="button" class="fv-btn fv-btn--ghost" data-fv-act="close-share">Đóng</button></div>';
    shareEl.addEventListener("click", function (e) { if (e.target === shareEl) closeShare(); });
    doc.body.appendChild(shareEl);
    var inp = shareEl.querySelector("input"); inp.focus(); inp.select();
  }
  function copyShareLink() {
    if (!shareEl) return;
    var inp = shareEl.querySelector("input"), url = inp.value;
    function legacy() { try { inp.focus(); inp.select(); inp.setSelectionRange(0, url.length); if (doc.execCommand("copy")) return notify(MSG.copied); } catch (e) { /* rơi xuống báo lỗi */ } notify(MSG.copyFail); }
    if (win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText) win.navigator.clipboard.writeText(url).then(function () { notify(MSG.copied); }, legacy); else legacy();
  }

  function route() {
    var h = win.location.hash;
    if (h === "#/favorites") { closeComparePage(); openPage(); }
    else if (/^#\/compare(\?|$)/.test(h)) { closePage(); openComparePage(); }
    else { closePage(); closeComparePage(); }
  }
  // 11.7 mở URL có ?tour=ID → mở đúng tour rồi bỏ tham số khỏi thanh địa chỉ
  function openSharedTour() {
    var id = parseTourParam(win.location.search); if (!id) return;
    try {
      var u = new URL(win.location.href); u.searchParams.delete(config.shareParam);
      win.history.replaceState(null, "", u.pathname + (u.search || "") + (u.hash || ""));
    } catch (e) { /* bỏ qua */ }
    if (config.openTour) config.openTour(id); else win.location.hash = config.tourUrl(id);
  }

  function init() {
    openSharedTour(); decorate(); refresh(); route();
    new win.MutationObserver(scheduleDecorate).observe(doc.body, { childList: true, subtree: true });
    win.addEventListener("hashchange", route);
    win.addEventListener("storage", function (e) { if (e.key === KEY_FAV || e.key === KEY_CMP || e.key === null) { favs.emit(); } });   // đồng bộ giữa các tab
    favs.subscribe(refresh); cmp.subscribe(refresh);
    doc.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (shareEl) closeShare(); else if (pageEl || cmpEl) win.location.hash = config.homeHash;
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
  return pure;
});
