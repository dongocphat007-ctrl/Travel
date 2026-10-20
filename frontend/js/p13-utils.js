/**
 * js/p13-utils.js – Giai đoạn 13 (Hoàn thiện). Nạp SỚM (trước include.js) để bắt được lỗi ảnh từ đầu.
 *   13.2   createCache / loadWithCache: server là nguồn chính, localStorage chỉ là cache (server chết → dùng bản cache cũ); auditStorage()
 *   13.7   ảnh lỗi → ảnh thay thế (bắt sự kiện error ở pha capture, không cần sửa từng chỗ render)
 *   13.8   hasCoords/getCoords (không tọa độ), emptyStateHtml (không thời tiết/bản đồ), createSafeStorage (LocalStorage trống/hỏng/bị chặn),
 *          apiFetch (timeout, thử lại, không bao giờ ném lỗi) + showServerDown (banner "Thử lại")
 *   13.10  debounce + installSearchDebounce: ô tìm kiếm chỉ chạy handler sau khi người dùng ngừng gõ 300ms (không cần sửa handler cũ)
 *   13.11  optimizeImg: tự thêm loading="lazy" decoding="async" (ảnh trong carousel/hero/banner giữ eager). Sửa tận gốc: node scripts/lazy-img.js --write
 *   13.12  renderInBatches: render danh sách dài theo lô, mỗi lô ghi DOM đúng 1 lần
 * Tắt tự cài đặt:  <html data-p13-manual>   rồi gọi TravelP13.init() khi muốn.
 * Phần thuần chạy được trong Node:  node scripts/test-p13.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.TravelP13 = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  "use strict";
  var doc = win && win.document;
  var MSG = {
    weatherEmpty: "Chưa có dữ liệu thời tiết", mapEmpty: "Chưa có tọa độ cho tour này", serverDown: "Không kết nối được máy chủ. Dữ liệu hiển thị có thể chưa mới nhất.",
    retry: "Thử lại", imgFallbackAlt: "Ảnh không tải được", listEmpty: "Chưa có dữ liệu"
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ───────────── 13.10 debounce ─────────────
  function debounce(fn, ms) {
    var t = null;
    function d() { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { t = null; fn.apply(self, a); }, ms == null ? 300 : ms); }
    d.cancel = function () { clearTimeout(t); t = null; };
    return d;
  }
  var SEARCH_HINT = /tìm|tim[-_ ]?kiem|search/i;
  function isSearchInput(el) {
    if (!el || el.tagName !== "INPUT" || (el.hasAttribute && el.hasAttribute("data-no-debounce"))) return false;
    var type = String((el.getAttribute && el.getAttribute("type")) || "text").toLowerCase();
    if (type === "search" || (el.hasAttribute && el.hasAttribute("data-debounce"))) return true;
    if (type !== "text") return false;
    return SEARCH_HINT.test([el.getAttribute("placeholder"), el.id, el.name].join(" "));
  }
  /** Chặn sự kiện "input" gốc ở pha capture rồi bắn lại 1 sự kiện "input" sau ms ms → mọi handler có sẵn tự được debounce. */
  function installSearchDebounce(ms) {
    if (!doc || doc.__p13Debounce) return; doc.__p13Debounce = true;
    var passed = new WeakSet(), timers = new WeakMap(); ms = ms == null ? 300 : ms;
    doc.addEventListener("input", function (e) {
      var el = e.target;
      if (passed.has(e) || e.isComposing || !isSearchInput(el)) return;           // đang gõ tiếng Việt (IME) → để nguyên
      e.stopImmediatePropagation();
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(function () { var ev = new win.Event("input", { bubbles: true }); passed.add(ev); el.dispatchEvent(ev); }, ms));
    }, true);
  }

  // ───────────── 13.7 + 13.11 ảnh ─────────────
  var PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#e9eef2"/>' +
    '<g fill="none" stroke="#9aa9b5" stroke-width="14" stroke-linejoin="round"><rect x="250" y="170" width="300" height="190" rx="18"/><circle cx="330" cy="235" r="22"/><path d="M262 345l95-85 70 60 45-40 66 65"/></g>' +
    '<text x="400" y="430" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#6b7c89">Chưa có ảnh</text></svg>');
  var MAP_SEL = ".leaflet-container,.gm-style,[data-no-img-fallback]";
  function inMap(img) { return !!(img && img.closest && img.closest(MAP_SEL)); }   // ô nền bản đồ lỗi thì để bản đồ tự xử lý (tileerror), không thay bằng ảnh 800x520
  function applyFallback(img) {
    if (!img || img.tagName !== "IMG" || inMap(img) || (img.dataset && img.dataset.p13Fallback)) return false;     // chỉ thử 1 lần → không lặp vô hạn nếu placeholder cũng lỗi
    if (img.dataset) img.dataset.p13Fallback = "1";
    img.removeAttribute("srcset"); img.src = PLACEHOLDER; img.classList.add("img-fallback");
    if (!img.getAttribute("alt") && img.getAttribute("role") !== "presentation") img.setAttribute("alt", MSG.imgFallbackAlt);
    return true;
  }
  function isBrokenNow(img) { var s = img.getAttribute("src"); return !s || (img.complete && img.naturalWidth === 0 && !/^data:/i.test(s)); }
  var EAGER_SEL = '[data-eager],.carousel,.hero,.banner,[class*="carousel"],[class*="hero"],[class*="banner"]';
  function optimizeImg(img) {
    if (!img || img.tagName !== "IMG" || inMap(img)) return;
    if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
    if (img.hasAttribute("loading")) return;
    img.setAttribute("loading", (img.hasAttribute("data-eager") || (img.closest && img.closest(EAGER_SEL))) ? "eager" : "lazy");
  }
  function scanImages(rootEl) {
    Array.prototype.forEach.call((rootEl || doc).querySelectorAll("img"), function (img) { optimizeImg(img); if (img.getAttribute("src") === "" || (img.complete && img.getAttribute("src") && img.naturalWidth === 0)) applyFallback(img); });
  }
  function installImages() {
    if (!doc || doc.__p13Img) return; doc.__p13Img = true;
    doc.addEventListener("error", function (e) { if (e.target && e.target.tagName === "IMG") applyFallback(e.target); }, true);
    function run() {
      scanImages(doc);
      if (win.MutationObserver) new win.MutationObserver(function (list) {
        list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.tagName === "IMG") { optimizeImg(n); if (isBrokenNow(n) && !n.getAttribute("src")) applyFallback(n); } else if (n.querySelectorAll) scanImages(n); }); });
      }).observe(doc.documentElement, { childList: true, subtree: true });
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run); else run();
  }

  // ───────────── 13.8 LocalStorage an toàn ─────────────
  function createSafeStorage(w) {
    var mem = {}, store = null;
    try { var s = w && w.localStorage; if (s) { s.setItem("__p13", "1"); s.removeItem("__p13"); store = s; } } catch (e) { store = null; }   // chế độ riêng tư / bị chặn
    function getRaw(k) { try { if (store) { var v = store.getItem(k); if (v !== null) return v; } } catch (e) { /* rơi xuống bộ nhớ */ } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }   // đầy dung lượng → giá trị vừa ghi nằm ở bộ nhớ
    function setRaw(k, v) { v = String(v); try { if (store) { store.setItem(k, v); return true; } } catch (e) { /* đầy dung lượng */ } mem[k] = v; return false; }
    function remove(k) { try { if (store) store.removeItem(k); } catch (e) { /* bỏ qua */ } delete mem[k]; }
    return {
      available: !!store, getRaw: getRaw, setRaw: setRaw, remove: remove,
      getJSON: function (k, fallback) { var raw = getRaw(k); if (raw == null || raw === "") return fallback; try { var v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; } },   // trống/hỏng → giá trị mặc định
      setJSON: function (k, v) { return setRaw(k, JSON.stringify(v)); }
    };
  }

  // ───────────── 13.2 server là nguồn chính, localStorage chỉ cache ─────────────
  function createCache(storage, prefix, now) {
    prefix = prefix || "travel_cache_"; now = now || Date.now;
    function read(key) { var e = storage.getJSON(prefix + key, null); return e && typeof e === "object" && "data" in e ? e : null; }
    return {
      get: function (key, ttlMs) { var e = read(key); return e && (ttlMs == null || now() - e.t <= ttlMs) ? e.data : null; },
      getStale: function (key) { var e = read(key); return e ? { data: e.data, ageMs: now() - e.t } : null; },
      set: function (key, data) { return storage.setJSON(prefix + key, { t: now(), data: data }); },
      remove: function (key) { storage.remove(prefix + key); }
    };
  }
  /** Luôn hỏi server trước. Thành công → ghi cache. Server chết → trả cache cũ (stale:true); không có cache → ok:false. Không bao giờ ném lỗi. */
  function loadWithCache(cache, key, fetcher) {
    return Promise.resolve().then(fetcher).then(function (data) { cache.set(key, data); return { ok: true, data: data, source: "server", stale: false }; })
      .catch(function (err) { var s = cache.getStale(key); return s ? { ok: true, data: s.data, source: "cache", stale: true, ageMs: s.ageMs, error: err } : { ok: false, data: null, source: "none", stale: false, error: err }; });
  }
  /** Phân loại khoá localStorage: ui (được phép), cache, suspicious (trông như dữ liệu nghiệp vụ → nên chuyển về server). Dùng: TravelP13.auditStorage(localStorage) */
  var UI_KEY = /^(travel_(favorites|compare|ui_|lang|theme|chat_draft|chat_session)|token|__p13)/, DATA_KEY = /(tour|account|user|booking|voucher|banner|guide|review|location|order|password)/i;
  function auditStorage(ls) {
    var out = { ui: [], cache: [], suspicious: [], other: [] }, i, k;
    for (i = 0; i < (ls ? ls.length : 0); i++) {
      k = ls.key(i);
      if (/^travel_cache_/.test(k)) out.cache.push(k); else if (UI_KEY.test(k)) out.ui.push(k); else if (DATA_KEY.test(k)) out.suspicious.push(k); else out.other.push(k);
    }
    return out;
  }

  // ───────────── 13.8 server chết / không tọa độ / không thời tiết ─────────────
  /** Không bao giờ ném lỗi. Trả { ok, status, data, error: null|"network"|"timeout"|"http"|"parse" }. GET tự thử lại (mặc định 2 lần) khi mạng lỗi/timeout/5xx. */
  function apiFetch(url, opts, deps) {
    opts = opts || {}; deps = deps || {};
    var f = deps.fetch || (win && win.fetch && win.fetch.bind(win)) || (typeof fetch !== "undefined" ? fetch : null);
    if (!f) return Promise.resolve({ ok: false, status: 0, data: null, error: "network" });
    var method = String(opts.method || "GET").toUpperCase(), retries = opts.retries != null ? opts.retries : (method === "GET" ? 2 : 0), timeout = opts.timeout || 8000, delay = opts.retryDelay != null ? opts.retryDelay : 400;
    var headers = Object.assign({}, opts.headers || {}), body = opts.body;
    if (opts.token) headers.Authorization = "Bearer " + opts.token;
    if (body && typeof body === "object" && !(typeof FormData !== "undefined" && body instanceof FormData)) { body = JSON.stringify(body); if (!headers["Content-Type"]) headers["Content-Type"] = "application/json"; }
    function attempt(n) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null, timedOut = false, timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, timeout);
      return Promise.resolve().then(function () { return f(url, { method: method, headers: headers, body: body, signal: ctrl ? ctrl.signal : undefined }); })
        .then(function (res) {
          return res.text().then(function (t) {
            var data = null, parseErr = false;
            if (t) { try { data = JSON.parse(t); } catch (e) { parseErr = true; } }
            if (!res.ok) return { ok: false, status: res.status, data: data, error: "http" };
            return parseErr ? { ok: false, status: res.status, data: null, error: "parse" } : { ok: true, status: res.status, data: data, error: null };
          });
        }, function () { return { ok: false, status: 0, data: null, error: timedOut ? "timeout" : "network" }; })
        .then(function (r) {
          clearTimeout(timer);
          var again = (r.error === "network" || r.error === "timeout" || (r.error === "http" && r.status >= 500)) && n < retries;
          return again ? new Promise(function (ok) { setTimeout(ok, delay * (n + 1)); }).then(function () { return attempt(n + 1); }) : r;
        });
    }
    return attempt(0);
  }
  function showServerDown(onRetry, message) {
    if (!doc) return null;
    var el = doc.getElementById("p13-offline");
    if (!el) {
      el = doc.createElement("div"); el.id = "p13-offline"; el.className = "p13-offline"; el.setAttribute("role", "alert");
      el.innerHTML = '<span class="p13-offline__msg"></span><button type="button" class="p13-offline__btn">' + esc(MSG.retry) + "</button>";
      doc.body.insertBefore(el, doc.body.firstChild);
      el.querySelector("button").addEventListener("click", function () { var cb = el.__retry; hideServerDown(); if (cb) cb(); });
    }
    el.querySelector(".p13-offline__msg").textContent = message || MSG.serverDown; el.__retry = onRetry; el.hidden = false; return el;
  }
  function hideServerDown() { var el = doc && doc.getElementById("p13-offline"); if (el) el.hidden = true; }

  function toNum(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /** { lat, lng } hợp lệ (trong phạm vi, khác (0,0)) hoặc null. Dùng chung cho Map và Weather. */
  function getCoords(o) {
    if (!o) return null;
    var lat = toNum(o.latitude != null ? o.latitude : o.lat), lng = toNum(o.longitude != null ? o.longitude : (o.lng != null ? o.lng : o.lon));
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
    return { lat: lat, lng: lng };
  }
  function hasCoords(o) { return getCoords(o) !== null; }
  function emptyStateHtml(kind, extra) {
    var m = kind === "weather" ? MSG.weatherEmpty : kind === "map" ? MSG.mapEmpty : (typeof kind === "string" && kind.indexOf(" ") > -1 ? kind : MSG.listEmpty);
    return '<div class="p13-empty" role="status">' + esc(m) + (extra ? "<small>" + esc(extra) + "</small>" : "") + "</div>";
  }

  // ───────────── 13.12 render theo lô ─────────────
  /** renderItem(item, index) → chuỗi HTML. Mỗi lô ghi DOM 1 lần (insertAdjacentHTML). Trả { cancel(), done: Promise<số mục đã vẽ> }. Lô đầu chạy ngay (đồng bộ). */
  function renderInBatches(items, renderItem, opts) {
    opts = opts || {}; items = items || [];
    var size = opts.batchSize || 20, i = 0, cancelled = false;
    var schedule = opts.schedule || (win && win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (f) { return setTimeout(f, 16); });
    var append = opts.append || function (html) { opts.container.insertAdjacentHTML("beforeend", html); };
    var done = new Promise(function (resolve) {
      (function step() {
        if (cancelled) return resolve(i);
        var end = Math.min(i + size, items.length), html = "";
        for (; i < end; i++) html += renderItem(items[i], i);
        if (html) append(html);
        if (opts.onBatch) opts.onBatch(i, items.length);
        if (i >= items.length) return resolve(i);
        schedule(step);
      })();
    });
    return { cancel: function () { cancelled = true; }, done: done };
  }

  function init() { installImages(); installSearchDebounce(300); }
  var api = {
    MSG: MSG, PLACEHOLDER: PLACEHOLDER, esc: esc, debounce: debounce, isSearchInput: isSearchInput, installSearchDebounce: installSearchDebounce,
    applyFallback: applyFallback, optimizeImg: optimizeImg, installImages: installImages, createSafeStorage: createSafeStorage, createCache: createCache, loadWithCache: loadWithCache,
    auditStorage: auditStorage, apiFetch: apiFetch, showServerDown: showServerDown, hideServerDown: hideServerDown, getCoords: getCoords, hasCoords: hasCoords,
    emptyStateHtml: emptyStateHtml, renderInBatches: renderInBatches, init: init
  };
  if (win && doc && !doc.documentElement.hasAttribute("data-p13-manual")) init();
  return api;
});
