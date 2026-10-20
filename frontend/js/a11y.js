/**
 * js/a11y.js – Giai đoạn 12 (P2): Accessibility. Chạy lúc tải trang + mỗi khi DOM đổi (nội dung sinh động bằng JS cũng được xử lý). Không phụ thuộc file JS khác.
 *   12.1  mọi thẻ img có alt (suy ra từ figcaption / tiêu đề card / tên file; ảnh chỉ để trang trí → alt="")
 *   12.2  mọi input/select/textarea có <label> (nếu thiếu: tạo <label class="a11y-sr"> từ placeholder / title / name)
 *   12.3  nút chỉ có icon (♡ ✕ ☰ ⤴ svg…) có aria-label
 *   12.4  điều hướng Tab: phần tử bấm được nhưng không phải nút/link → role="button" + tabindex="0" + Enter/Space; không tabindex dương;
 *         nút "Bỏ qua tới nội dung chính"; hộp thoại [aria-modal] giữ focus bên trong, khoá nền (inert), trả focus khi đóng; thông báo khi đổi trang (#/…)
 *   12.5  :focus-visible rõ ràng → css/a11y.css
 *   12.6  contrast chữ ≥ 4.5:1 (chữ lớn ≥ 3:1): TravelA11y.contrast() quét trang đang mở; contrastRatio() dùng cho scripts/check-contrast.js
 *   12.8  đúng 1 <h1> hiển thị mỗi trang, không nhảy cấp (h1→h3): fixHeadings() tự sửa; thiếu h1 thì thêm <h1> ẩn lấy từ <title>
 * Kiểm tra nhanh trong console:  TravelA11y.audit()   → danh sách lỗi còn lại ([] = sạch)
 * Phần thuần (guessIconLabel, inputLabelText, humanizeFilename…) chạy được trong Node:  node scripts/test-a11y.js
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(null);
  else root.TravelA11y = factory(root);
})(typeof self !== "undefined" ? self : this, function (win) {
  var MSG = { skip: "Bỏ qua tới nội dung chính", nav: "Điều hướng", moved: "Đã chuyển tới: ", unnamed: "Không có tên" };

  // ───────────── Phần thuần ─────────────
  /** "img/tours/da-lat_01-1200x800.jpg?v=3" → "da lat" ; không ra chữ → "" */
  function humanizeFilename(src) {
    var s = String(src || "").split("#")[0].split("?")[0]; if (/^data:/i.test(s)) return "";
    s = s.split("/").pop() || ""; try { s = decodeURIComponent(s); } catch (e) { /* giữ nguyên */ }
    s = s.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_.]+/g, " ").replace(/(\s+\d+(x\d+)?)+\s*$/i, "").replace(/\s+/g, " ").trim();
    return /[A-Za-zÀ-ỹ]/.test(s) ? s : "";
  }
  /** Chuỗi chỉ gồm ký hiệu / emoji / khoảng trắng (không chữ, không số) → true. */
  function isIconOnly(text) { var t = String(text == null ? "" : text).replace(/\s+/g, ""); if (!t) return true; try { return !/[\p{L}\p{N}]/u.test(t); } catch (e) { return !/[A-Za-z0-9À-ỹ]/.test(t); } }

  var SYMBOLS = [
    [/^[♡♥❤❤️🤍💙🧡]+$/u, "Yêu thích"], [/^[✕✖✗×xX❌]+$/u, "Đóng"], [/^[☰≡☷]+$/u, "Mở menu"], [/^[⤴↗↑⇪📤]+$/u, "Chia sẻ"],
    [/^[‹◀◄<←«]+$/u, "Trước"], [/^[›▶►>→»]+$/u, "Tiếp theo"], [/^[＋+➕]+$/u, "Thêm"], [/^[−–—-➖]+$/u, "Bớt"],
    [/^[🔍🔎]+$/u, "Tìm kiếm"], [/^[🔔🔕]+$/u, "Thông báo"], [/^[🛒]+$/u, "Giỏ hàng"], [/^[👤]+$/u, "Tài khoản"], [/^[⚙⚙️]+$/u, "Cài đặt"],
    [/^[✓✔]+$/u, "Xác nhận"], [/^[⋮⋯…]+$/u, "Thêm tuỳ chọn"], [/^[🌐]+$/u, "Ngôn ngữ"], [/^[🗑]+$/u, "Xoá"], [/^[✎✏️]+$/u, "Chỉnh sửa"]
  ];
  var KEYWORDS = [
    [/close|dismiss|đóng|cancel/i, "Đóng"], [/menu|hamburger|burger|nav-?toggle/i, "Mở menu"], [/search|tim-?kiem|tìm/i, "Tìm kiếm"], [/share|chia-?se/i, "Chia sẻ"],
    [/fav|heart|wish|yeu-?thich/i, "Yêu thích"], [/prev|back|previous|left/i, "Trước"], [/next|forward|right/i, "Tiếp theo"], [/cart|basket|gio-?hang/i, "Giỏ hàng"],
    [/user|account|profile|avatar|login|tai-?khoan/i, "Tài khoản"], [/notif|bell|thong-?bao/i, "Thông báo"], [/delete|remove|trash|xoa/i, "Xoá"], [/edit|pencil|sua/i, "Chỉnh sửa"],
    [/play/i, "Phát"], [/pause/i, "Tạm dừng"], [/zoom-?in/i, "Phóng to"], [/zoom-?out/i, "Thu nhỏ"], [/plus|add|them/i, "Thêm"], [/minus|sub|bot/i, "Bớt"],
    [/chat|message|messenger/i, "Trò chuyện"], [/phone|call|hotline/i, "Gọi điện"], [/mail|email/i, "Gửi email"], [/top|scroll/i, "Lên đầu trang"], [/lang/i, "Ngôn ngữ"], [/setting/i, "Cài đặt"]
  ];
  /** Đoán tên cho nút/link chỉ có icon. info: { text, title, id, className, name, href, imgAlt }. Không đoán được → "". */
  function guessIconLabel(info) {
    info = info || {};
    var direct = [info.title, info.imgAlt].filter(function (x) { return x && String(x).trim(); })[0]; if (direct) return String(direct).trim();
    var txt = String(info.text || "").replace(/\s+/g, "");
    for (var i = 0; i < SYMBOLS.length; i++) if (txt && SYMBOLS[i][0].test(txt)) return SYMBOLS[i][1];
    var hay = [info.id, info.className, info.name, info.href].filter(Boolean).join(" ");
    for (var j = 0; j < KEYWORDS.length; j++) if (hay && KEYWORDS[j][0].test(hay)) return KEYWORDS[j][1];
    return "";
  }
  var TYPE_LABEL = { search: "Tìm kiếm", email: "Email", password: "Mật khẩu", tel: "Số điện thoại", date: "Ngày", number: "Số", file: "Chọn tệp", url: "Địa chỉ web", time: "Giờ", range: "Giá trị", checkbox: "Tuỳ chọn", radio: "Lựa chọn", color: "Màu", datetime: "Ngày giờ", "datetime-local": "Ngày giờ", month: "Tháng", week: "Tuần" };
  /** Các kiểu input không cần <label> (không hiển thị / nút có chữ riêng). */
  function needsLabel(type) { return !/^(hidden|submit|button|reset|image)$/i.test(type || "text"); }
  /** Nội dung <label> dự phòng: placeholder → title → name/id → mặc định theo kiểu. */
  function inputLabelText(info) {
    info = info || {};
    var t = [info.placeholder, info.title, humanizeFilename(info.name), humanizeFilename(info.id)].map(function (x) { return x && String(x).trim(); }).filter(Boolean)[0];
    return t || TYPE_LABEL[String(info.type || "").toLowerCase()] || (info.tag === "select" ? "Chọn" : "Nhập nội dung");
  }
  function truncate(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  // ── 12.6 contrast (WCAG 2.x) ──
  /** "#abc" | "#aabbcc" | "rgb(a)(…)" → [r,g,b,a] ; không hiểu → null */
  function parseColor(str) {
    str = String(str || "").trim().toLowerCase(); var m;
    if ((m = /^#([0-9a-f]{3})$/.exec(str))) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(str))) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
    if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(str))) { var a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
    if (str === "white") return [255, 255, 255, 1]; if (str === "black") return [0, 0, 0, 1]; if (str === "transparent") return [0, 0, 0, 0];
    return null;
  }
  /** Trộn màu fg (có alpha) lên nền bg đặc. */
  function blend(fg, bg) { var a = fg[3] == null ? 1 : fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; }
  function luminance(c) { var v = c.slice(0, 3).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  /** Tỉ lệ tương phản 1..21. fg có thể có alpha (trộn lên bg). */
  function contrastRatio(fg, bg) {
    fg = typeof fg === "string" ? parseColor(fg) : fg; bg = typeof bg === "string" ? parseColor(bg) : bg; if (!fg || !bg) return null;
    var f = blend(fg, bg), l1 = luminance(f), l2 = luminance(bg), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05);
  }
  /** Ngưỡng tối thiểu: chữ lớn (≥24px, hoặc ≥18.66px đậm) 3:1, còn lại 4.5:1. */
  function minContrast(px, weight) { return (px >= 24 || (px >= 18.66 && weight >= 700)) ? 3 : 4.5; }

  var pure = { parseColor: parseColor, blend: blend, luminance: luminance, contrastRatio: contrastRatio, minContrast: minContrast, MSG: MSG, humanizeFilename: humanizeFilename, isIconOnly: isIconOnly, guessIconLabel: guessIconLabel, inputLabelText: inputLabelText, needsLabel: needsLabel, truncate: truncate };
  if (!win || !win.document) return pure;

  // ───────────── Phần giao diện (trình duyệt) ─────────────
  var doc = win.document, seq = 0, raf = 0, announcer = null, skipBtn = null, prevFocus = null, openDialogs = [];
  var INTERACTIVE = "a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[role=button],[role=link],[role=tab],[role=menuitem],[contenteditable=true]";
  var FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex='-1']),[contenteditable=true]";
  var CLICKABLE_CLASS = "[class*='btn'],[class*='close'],[class*='toggle'],[class*='chip'],[class*='tab-'],[data-action],[data-href]";
  var NONINTERACTIVE_TAG = /^(div|span|li|i|p|td|th|img|svg|article|section|figure|em|b|strong|h[1-6])$/i;

  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)); }
  function text(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
  function uid(prefix) { seq += 1; return prefix + seq; }
  function describe(el) { var s = el.tagName.toLowerCase(); if (el.id) s += "#" + el.id; else if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/)[0]; return s; }

  // 12.1 ảnh
  function deriveAlt(img) {
    var own = img.getAttribute("aria-label") || img.getAttribute("title") || img.getAttribute("data-alt"); if (own && own.trim()) return truncate(own, 140);
    if (img.getAttribute("role") === "presentation" || img.getAttribute("role") === "none") return "";
    var fig = img.closest("figure"), cap = fig && fig.querySelector("figcaption"); if (cap && text(cap)) return truncate(text(cap), 140);
    var link = img.closest("a,button");                                             // ảnh nằm trong link/nút đã có chữ → trang trí
    if (link) { var clone = link.cloneNode(true); Array.prototype.forEach.call(clone.querySelectorAll("img,svg"), function (n) { n.remove(); }); if (text(clone)) return ""; }
    var node = img.parentElement;                                                   // tên tour: tiêu đề gần nhất trong card
    for (var d = 0; node && d < 4; d++, node = node.parentElement) {
      var h = node.querySelector("h1,h2,h3,h4,h5,h6,[class*='name'],[class*='title']");
      if (h && !h.contains(img) && text(h) && text(h).length <= 160) return truncate(text(h), 140);
    }
    return humanizeFilename(img.currentSrc || img.getAttribute("src") || "");
  }
  function fixImages(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("img:not([alt])"), function (img) { img.setAttribute("alt", deriveAlt(img)); img.setAttribute("data-a11y-alt", "auto"); });
    Array.prototype.forEach.call(scope.querySelectorAll("input[type=image]:not([alt])"), function (i) { i.setAttribute("alt", i.getAttribute("title") || i.value || "Gửi"); });
    Array.prototype.forEach.call(scope.querySelectorAll("area[href]:not([alt])"), function (a) { a.setAttribute("alt", a.getAttribute("title") || "Khu vực"); });
    Array.prototype.forEach.call(scope.querySelectorAll("svg:not([aria-hidden]):not([role]):not([aria-label]):not([aria-labelledby])"), function (s) { if (!s.querySelector("title")) { s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false"); } });
  }

  // 12.2 label
  function hasLabel(el) {
    if (el.getAttribute("aria-label") && el.getAttribute("aria-label").trim()) return true;
    var lb = el.getAttribute("aria-labelledby"); if (lb && doc.getElementById(lb.split(/\s+/)[0])) return true;
    return !!(el.labels && el.labels.length);
  }
  function fixLabels(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("input,select,textarea"), function (el) {
      var type = el.tagName === "INPUT" ? (el.getAttribute("type") || "text") : "text";
      if (el.tagName === "INPUT" && !needsLabel(type)) return;
      if (hasLabel(el)) return;
      if (!el.id) el.id = uid("a11y-f-");
      var lab = doc.createElement("label"); lab.className = "a11y-sr"; lab.setAttribute("for", el.id); lab.setAttribute("data-a11y-label", "auto");
      lab.textContent = inputLabelText({ placeholder: el.getAttribute("placeholder"), title: el.getAttribute("title"), name: el.getAttribute("name"), id: /^a11y-f-/.test(el.id) ? "" : el.id, type: type, tag: el.tagName.toLowerCase() });
      el.parentNode.insertBefore(lab, el);
    });
  }

  // 12.3 nút icon
  function accessibleName(el) {
    var a = el.getAttribute("aria-label"); if (a && a.trim()) return a.trim();
    var lb = el.getAttribute("aria-labelledby"); if (lb) { var r = doc.getElementById(lb.split(/\s+/)[0]); if (r && text(r)) return text(r); }
    if (el.tagName === "INPUT") return (el.value || el.getAttribute("title") || "").trim();
    var clone = el.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll("[aria-hidden=true],.a11y-sr-skip"), function (n) { n.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll("img[alt]"), function (im) { im.replaceWith(doc.createTextNode(" " + im.getAttribute("alt") + " ")); });
    var t = text(clone); if (t && !isIconOnly(t)) return t;
    var svgT = el.querySelector("svg title"); if (svgT && text(svgT)) return text(svgT);
    return "";
  }
  function nameButtons(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("button,[role=button],a[href],summary,[role=tab],[role=menuitem]"), function (el) {
      if (accessibleName(el)) return;
      var im = el.querySelector("img[alt]");
      var label = guessIconLabel({ text: text(el), title: el.getAttribute("title"), imgAlt: im && im.getAttribute("alt"), id: el.id, className: typeof el.className === "string" ? el.className : "", name: el.getAttribute("name"), href: el.tagName === "A" ? el.getAttribute("href") : "" });
      if (!label) { var inner = el.querySelector("[class],[id]"); if (inner) label = guessIconLabel({ id: inner.id, className: typeof inner.className === "string" ? inner.className : "" }); }
      if (label) { el.setAttribute("aria-label", label); el.setAttribute("data-a11y-name", "auto"); }
    });
  }

  // 12.4 bàn phím
  function fixKeyboard(scope) {
    var sel = "[onclick]," + CLICKABLE_CLASS + ",a:not([href])[onclick]";
    Array.prototype.forEach.call(scope.querySelectorAll(sel), function (el) {
      if (el.matches(INTERACTIVE) || el.closest("button,a[href],label,select")) return;
      if (!(NONINTERACTIVE_TAG.test(el.tagName) || el.tagName === "A")) return;
      if (!el.hasAttribute("onclick") && !el.matches("[data-action],[data-href]")) { var cur; try { cur = win.getComputedStyle(el).cursor; } catch (e) { cur = ""; } if (cur !== "pointer") return; }
      if (el.querySelector("a[href],button,input,select,textarea")) return;        // chứa sẵn phần tử tương tác → không bọc thêm
      el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.setAttribute("data-a11y-key", "1");
      if (!accessibleName(el)) { var l = guessIconLabel({ text: text(el), title: el.getAttribute("title"), id: el.id, className: typeof el.className === "string" ? el.className : "" }); if (l) el.setAttribute("aria-label", l); }
    });
    Array.prototype.forEach.call(scope.querySelectorAll("[tabindex]"), function (el) { if (parseInt(el.getAttribute("tabindex"), 10) > 0) el.setAttribute("tabindex", "0"); });   // tabindex dương làm lộn thứ tự Tab
  }
  doc.addEventListener("keydown", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-a11y-key]") : null;
    if (el && el === e.target && (e.key === "Enter" || e.key === " " || e.key === "Spacebar")) { e.preventDefault(); el.click(); }
  });

  // landmarks + nút bỏ qua
  function fixLandmarks() {
    var main = doc.querySelector("main"); if (main) { if (!main.id) main.id = "main-content"; if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1"); }
    Array.prototype.forEach.call(doc.querySelectorAll("nav:not([aria-label]):not([aria-labelledby])"), function (n, i) { n.setAttribute("aria-label", i === 0 ? MSG.nav + " chính" : MSG.nav + " " + (i + 1)); });
    Array.prototype.forEach.call(doc.querySelectorAll("[class*='toast']:not([role]):not([aria-live])"), function (t) { t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); });
    if (main && !skipBtn && !doc.querySelector(".skip-link")) {   // [MERGE] Source A đã có liên kết .skip-link (index.html) → không tạo nút thứ hai
      skipBtn = doc.createElement("button"); skipBtn.type = "button"; skipBtn.className = "a11y-skip"; skipBtn.textContent = MSG.skip;     // nút (không phải <a href="#…">) để không đụng router dùng hash
      skipBtn.addEventListener("click", function () { var m = doc.querySelector("main"); if (m) { m.focus(); if (m.scrollIntoView) m.scrollIntoView(); } });
      doc.body.insertBefore(skipBtn, doc.body.firstChild);
    }
  }

  // hộp thoại: giữ focus, khoá nền, trả focus
  function dialogs() { return Array.prototype.filter.call(doc.querySelectorAll("[aria-modal='true']"), visible); }
  function focusables(box) { return Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), visible); }
  function syncDialogs() {
    var now = dialogs(), top = now[now.length - 1];
    now.forEach(function (d) {
      if (!d.getAttribute("aria-label") && !d.getAttribute("aria-labelledby")) { var h = d.querySelector("h1,h2,h3"); if (h) { if (!h.id) h.id = uid("a11y-h-"); d.setAttribute("aria-labelledby", h.id); } }
      if (!d.hasAttribute("role")) d.setAttribute("role", "dialog");
      if (openDialogs.indexOf(d) === -1) {                                          // mới mở
        d._a11yOpener = (curFocus && !d.contains(curFocus)) ? curFocus : prevFocus;
        if (!d.contains(doc.activeElement)) { var f = focusables(d)[0]; if (!f) { d.setAttribute("tabindex", "-1"); f = d; } f.focus(); }
      }
    });
    var closed = openDialogs.filter(function (d) { return now.indexOf(d) === -1; });
    openDialogs = now;
    Array.prototype.forEach.call(doc.body.children, function (c) {                  // khoá nền khi có hộp thoại (inert = không Tab, không đọc được)
      var keep = !top || c === top || c.contains(top) || /^(SCRIPT|STYLE|LINK)$/.test(c.tagName) || c.matches("[role=status],[aria-live]") || c === announcer;
      if (keep) { if (c.hasAttribute("data-a11y-inert")) { c.removeAttribute("inert"); c.removeAttribute("data-a11y-inert"); } }
      else if (!c.hasAttribute("inert")) { c.setAttribute("inert", ""); c.setAttribute("data-a11y-inert", "1"); }
    });
    closed.forEach(function (d) {   // vừa đóng
      var o = d._a11yOpener; if (o && doc.contains(o) && visible(o) && !o.closest("[inert]") && (!doc.activeElement || doc.activeElement === doc.body || !doc.contains(doc.activeElement))) { try { o.focus(); } catch (e) { /* bỏ qua */ } }
    });
  }
  var curFocus = null;
  doc.addEventListener("focusin", function (e) { if (e.target !== curFocus) { prevFocus = curFocus; curFocus = e.target; } });
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var ds = dialogs(), d = ds[ds.length - 1]; if (!d) return;
    var f = focusables(d); if (!f.length) { e.preventDefault(); d.focus(); return; }
    var first = f[0], last = f[f.length - 1], act = doc.activeElement;
    if (!d.contains(act)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && (act === first || act === d)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
  }, true);

  // đổi trang kiểu SPA (#/…) → đọc tên trang cho người dùng trình đọc màn hình
  function announce(msg) {
    if (!announcer) { announcer = doc.createElement("div"); announcer.className = "a11y-sr"; announcer.id = "a11y-announcer"; announcer.setAttribute("role", "status"); announcer.setAttribute("aria-live", "polite"); doc.body.appendChild(announcer); }
    announcer.textContent = ""; setTimeout(function () { announcer.textContent = msg; }, 60);
  }
  function onRoute() {
    setTimeout(function () {
      var scope = doc.querySelector("[aria-modal='true']") || doc.querySelector("main") || doc.body, h = Array.prototype.filter.call(scope.querySelectorAll("h1,h2"), visible)[0];
      var name = (h && text(h)) || doc.title; if (name) announce(MSG.moved + name);
    }, 250);
  }

  function scan(scope) { scope = scope || doc; fixImages(scope); fixLabels(scope); nameButtons(scope); fixKeyboard(scope); }
  function run() { raf = 0; scan(doc); fixLandmarks(); fixHeadings(); syncDialogs(); }
  function schedule() { if (!raf) raf = win.requestAnimationFrame ? win.requestAnimationFrame(run) : setTimeout(run, 16); }

  /** Danh sách lỗi còn lại sau khi đã tự sửa. [] = sạch. */
  function audit() {
    var out = [];
    function add(type, el, msg) { out.push({ type: type, el: describe(el), msg: msg }); }
    if (!doc.documentElement.getAttribute("lang")) add("lang", doc.documentElement, "Thiếu thuộc tính lang");
    if (!doc.title) add("title", doc.documentElement, "Thiếu <title>");
    Array.prototype.forEach.call(doc.querySelectorAll("img:not([alt])"), function (el) { add("img-alt", el, "Ảnh thiếu alt"); });
    Array.prototype.forEach.call(doc.querySelectorAll("input,select,textarea"), function (el) {
      var type = el.tagName === "INPUT" ? (el.getAttribute("type") || "text") : "text";
      if (el.tagName === "INPUT" && !needsLabel(type)) return;
      if (!(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) add("label", el, "Input thiếu <label>");
    });
    Array.prototype.forEach.call(doc.querySelectorAll("button,[role=button],a[href]"), function (el) { if (!el.closest("[aria-hidden=true]") && !accessibleName(el)) add("name", el, "Nút/link không có tên"); });
    Array.prototype.forEach.call(doc.querySelectorAll("[tabindex]"), function (el) { if (parseInt(el.getAttribute("tabindex"), 10) > 0) add("tabindex", el, "tabindex dương"); });
    Array.prototype.forEach.call(doc.querySelectorAll("[onclick]"), function (el) { if (!el.matches(INTERACTIVE)) add("keyboard", el, "Bấm được nhưng không focus được bằng Tab"); });
    return out.concat(headingIssues());
  }

  // 12.8 heading: đúng 1 h1 hiển thị, không nhảy cấp
  function headingLevel(h) { var l = parseInt(h.getAttribute("aria-level") || "", 10); return l || parseInt(h.tagName.charAt(1), 10); }
  function fixHeadings() {
    var hs = Array.prototype.filter.call(doc.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]"), function (h) { return visible(h) && !h.closest("[aria-modal='true']") && !h.closest(".a11y-sr[data-a11y-h1]"); });
    var inj = doc.querySelector("[data-a11y-h1]"), real = hs.filter(function (h) { return h.tagName === "H1" && h.getAttribute("aria-level") !== "2" || h.getAttribute("aria-level") === "1"; });
    if (real.length && inj) inj.remove();
    if (!real.length) {
      var t = (doc.title || "").split(/\s[–|-]\s/)[0] || doc.title || "Trang";
      if (!inj) { inj = doc.createElement("h1"); inj.className = "a11y-sr"; inj.setAttribute("data-a11y-h1", "1"); var m = doc.querySelector("main"); (m || doc.body).insertBefore(inj, (m || doc.body).firstChild); }
      inj.textContent = t;
    }
    real.slice(1).forEach(function (h) { h.setAttribute("role", "heading"); h.setAttribute("aria-level", "2"); h.setAttribute("data-a11y-level", "auto"); });   // nhiều h1 → hạ các h1 sau xuống 2
    var prev = 1;
    hs.forEach(function (h) {
      if (h.tagName === "H1" && h.getAttribute("aria-level") !== "2") { prev = 1; return; }
      var lv = headingLevel(h);
      if (lv > prev + 1) { h.setAttribute("role", "heading"); h.setAttribute("aria-level", String(prev + 1)); h.setAttribute("data-a11y-level", "auto"); lv = prev + 1; }
      prev = lv;
    });
  }
  function headingIssues() {
    var out = [], hs = Array.prototype.filter.call(doc.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]"), function (h) { return visible(h) && !h.closest("[aria-modal='true']"); });
    var h1 = hs.filter(function (h) { return headingLevel(h) === 1; }); if (h1.length !== 1) out.push({ type: "h1", el: "body", msg: "Có " + h1.length + " tiêu đề cấp 1 đang hiển thị (cần đúng 1)" });
    var prev = 0; hs.forEach(function (h) { var l = headingLevel(h); if (prev && l > prev + 1) out.push({ type: "heading-level", el: describe(h), msg: "Nhảy cấp heading h" + prev + " → h" + l }); prev = l; });
    return out;
  }

  // 12.6 quét contrast trên trang đang mở: trả về các phần tử chữ có tỉ lệ dưới ngưỡng
  function effectiveBg(el) {
    var layers = [], n = el, unknown = false;
    while (n && n.nodeType === 1) {
      var cs = win.getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== "none") unknown = true;
      var c = parseColor(cs.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      n = n.parentElement;
    }
    var base = [255, 255, 255, 1]; for (var i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return { color: base, unknown: unknown };
  }
  function contrast(scope) {
    var out = [];
    Array.prototype.forEach.call((scope || doc.body).querySelectorAll("*"), function (el) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|OPTION|HEAD)$/i.test(el.tagName) || !visible(el) || el.closest("[inert],[aria-hidden=true],.a11y-sr,.fv-sr")) return;
      var own = Array.prototype.some.call(el.childNodes, function (c) { return c.nodeType === 3 && /\S/.test(c.nodeValue); }); if (!own) return;
      var cs = win.getComputedStyle(el); if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0 || el.disabled) return;
      var bg = effectiveBg(el); if (bg.unknown) return;                              // nền ảnh / gradient: cần kiểm tay
      var fg = parseColor(cs.color); if (!fg) return;
      var op = 1, n = el; while (n && n.nodeType === 1) { op *= parseFloat(win.getComputedStyle(n).opacity); n = n.parentElement; }
      fg = [fg[0], fg[1], fg[2], fg[3] * op];
      var r = contrastRatio(fg, bg.color), need = minContrast(parseFloat(cs.fontSize), parseInt(cs.fontWeight, 10) || 400);
      if (r != null && r + 0.005 < need) out.push({ type: "contrast", el: describe(el), msg: r.toFixed(2) + ":1 (cần ≥ " + need + ":1) " + cs.color + " trên " + "rgb(" + bg.color.slice(0, 3).map(Math.round).join(",") + ")", text: text(el).slice(0, 30) });
    });
    return out;
  }

  pure.fixHeadings = fixHeadings; pure.headingIssues = headingIssues; pure.contrast = contrast;
  pure.scan = scan; pure.audit = audit; pure.announce = announce; pure.run = run;
  function init() {
    run(); onRoute();
    new win.MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "aria-modal"] });
    win.addEventListener("hashchange", function () { schedule(); onRoute(); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
  return pure;
});
