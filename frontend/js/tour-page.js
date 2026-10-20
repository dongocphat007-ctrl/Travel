/**
 * tour-page.js – Trang riêng cho từng tour, định tuyến bằng hash: #/tour/<id>
 *   #/tour/101     → tour mẫu (chi tiết)  #/tour/gv12    → tour mẫu
 *   #/tour/g29     → tour quốc tế       #/tour/tour_.. → tour do Admin tạo
 * JS thuần, không thư viện. Phụ thuộc: home.js (TOUR_SAMPLES, loadHomeData, tourToModalData),
 * main.js (navigate, requireAuth, openTourDetail), tour-images.js (TourImages), utils.js (showToast).
 */
const TourPage = (() => {
  const ROUTE = /^#\/tour\/(.+)$/;
  const SITE_TITLE = document.title;
  let ready = false;        // true sau khi đã xử lý hash lúc tải trang
  let fromApp = false;      // true nếu người dùng vào trang tour từ giao diện (không phải link ngoài)
  let renderToken = 0;      // bỏ qua kết quả tải dữ liệu cũ khi đổi route nhanh

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => n ? new Intl.NumberFormat("vi-VN").format(n) + " ₫" : "Miễn phí";
  const root = () => document.getElementById("tour-page-root");
  const hrefOf = id => "#/tour/" + encodeURIComponent(id);
  const idFromHash = () => { const m = ROUTE.exec(location.hash); if (!m) return null; try { return decodeURIComponent(m[1]); } catch { return m[1]; } };

  const clearHash = () => { if (ROUTE.test(location.hash)) history.pushState(null, "", location.pathname + location.search); };

  // ---------- Dựng giao diện ----------
  function skeleton() {
    root().innerHTML = '<div class="tp-state"><div class="tp-spin"></div><p>Đang mở thông tin hành trình…</p></div>';
  }

  function notFound(id, failed) {
    root().innerHTML =
      '<div class="tp-state"><span class="tp-state-ico">' + (failed ? "" : "") + "</span>" +
      "<h2>" + (failed ? "Không tải được dữ liệu tour" : "Không tìm thấy tour") + "</h2>" +
      "<p>" + (failed ? "Chưa tải được thông tin tour. Kiểm tra kết nối rồi thử lại nhé." : "Tour <b>" + esc(id) + "</b> không còn trong danh sách hoặc hiện không thể truy cập.") + "</p>" +
      (failed ? '<button class="btn btn-primary" id="tp-retry-btn">Thử lại</button> ' : "") +
      '<button class="btn btn-primary" id="tp-home-btn">← Xem tất cả tour</button></div>';
    const rb = document.getElementById("tp-retry-btn");
    if (rb) rb.onclick = () => route();
    document.getElementById("tp-home-btn").onclick = () => goBack(true);
    document.title = "Không tìm thấy tour – " + SITE_TITLE;
  }

  function itineraryHtml(t) {
    if (t.itinerary && t.itinerary.length) {
      return t.itinerary.map(d =>
        '<div class="tp-day"><div class="tp-day-no">Ngày ' + esc(d.day) + "</div><div class=\"tp-day-body\">" +
        '<h3 class="tp-day-title">' + esc(d.title) + "</h3>" +
        (d.items || []).map(it => '<div class="tp-it"><span class="tp-it-time">' + esc(it.time) + "</span><span>" + esc(it.desc) + "</span></div>").join("") +
        "</div></div>").join("");
    }
    return '<p class="tp-muted">Lịch trình chi tiết sẽ được hướng dẫn viên gửi sau khi đặt tour.</p>';
  }

  // ----- Lịch khởi hành: tính các ngày sắp tới từ quy tắc trong JSON (không bị cũ theo thời gian) -----
  const WD = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  function upcomingDepartures(t, max) {
    const dep = t.departures;
    if (!dep || dep.mode !== "weekly" || !(dep.weekdays || []).length) return [];
    const minDays = typeof BOOKING_MIN_DAYS === "number" ? BOOKING_MIN_DAYS : 3;
    const every = Math.max(1, dep.everyWeeks || 1);
    const seed = String(t.id).split("").reduce((a, c) => a + c.charCodeAt(0), 0) % every;   // lệch tuần giữa các tour
    const anchor = new Date(2024, 0, 1);                                                      // thứ Hai
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + minDays);
    for (let i = 0; i < 150 && out.length < max; i++, d.setDate(d.getDate() + 1)) {
      if (!dep.weekdays.includes(d.getDay())) continue;
      const weekNo = Math.floor((d - anchor) / (7 * 864e5));
      if (weekNo % every === seed) out.push(new Date(d));
    }
    return out;
  }
  function departuresHtml(t) {
    const dep = t.departures;
    if (!dep) return "";
    if (dep.mode === "flexible") return '<section class="tp-sec"><h2 class="tp-h2">Lịch khởi hành</h2><p class="tp-muted">' + esc(dep.note || "Tự chọn ngày đi") + ".</p></section>";
    const list = upcomingDepartures(t, 6);
    if (!list.length) return "";
    const freq = (dep.everyWeeks || 1) > 1 ? "Khởi hành " + dep.everyWeeks + " tuần/lần" : "Khởi hành hằng tuần";
    return '<section class="tp-sec"><h2 class="tp-h2">Lịch khởi hành</h2>' +
      '<p class="tp-muted tp-dep-note">' + freq + (dep.time ? ", tập trung lúc " + esc(dep.time) : "") + ". Bấm một ngày để đặt tour.</p>" +
      '<div class="tp-deps">' + list.map(d => '<button type="button" class="tp-dep" data-date="' + ymd(d) + '"><b>' + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) +
        "</b><span>" + WD[d.getDay()] + "</span></button>").join("") + "</div></section>";
  }

  function cancelHtml(t) {
    const B = window.BUSINESS, tiers = (B && B.cancelTiers) || [];
    const pct = typeof DEPOSIT_PCT === "number" ? DEPOSIT_PCT : null;
    let rows = "";
    tiers.forEach((x, i) => {
      const upper = i === 0 ? null : tiers[i - 1].minDays - 1;
      const label = i === 0 ? "Từ " + x.minDays + " ngày trở lên trước ngày khởi hành"
        : x.minDays === 0 ? "Dưới " + (tiers[i - 1].minDays) + " ngày trước ngày khởi hành"
        : "Từ " + x.minDays + " đến " + upper + " ngày trước ngày khởi hành";
      rows += "<tr><td>" + label + '</td><td class="tp-ref tp-ref-' + (x.refundPct >= 100 ? "full" : x.refundPct > 0 ? "part" : "none") + '">' + (x.refundPct ? "Hoàn " + x.refundPct + "%" : "Không hoàn") + "</td></tr>";
    });
    return '<section class="tp-sec"><h2 class="tp-h2">Chính sách hủy tour</h2>' +
      (rows ? '<table class="tp-table"><thead><tr><th>Thời điểm báo hủy' + (pct ? " (đặt cọc " + pct + "%)" : "") + "</th><th>Tiền cọc</th></tr></thead><tbody>" + rows + "</tbody></table>" : "") +
      (t.cancelNote ? '<p class="tp-muted tp-note">' + esc(t.cancelNote) + "</p>" : "") +
      '<p class="tp-note"><a href="#" id="tp-policy-link">Xem chi tiết chính sách hủy & hoàn cọc →</a></p></section>';
  }

  // ----- Đánh giá & bình luận sau tour (dữ liệu từ /api/reviews; không có server → data/reviews-seed.json) -----
  const nf = n => new Intl.NumberFormat("vi-VN").format(n);
  const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  const fmtDay = iso => { const d = new Date(iso); return isNaN(d) ? "" : pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  async function fetchReviewData(id) {
    try { const r = await Api.get("/api/reviews?tourId=" + encodeURIComponent(id)); if (r.ok) return r.data; } catch (e) { /* không có server */ }
    try {
      const [rv, st] = await Promise.all([fetch("data/reviews-seed.json").then(x => x.json()), fetch("data/tour-stats.json").then(x => x.json())]);
      const list = (rv.reviews || []).filter(x => String(x.tourId) === String(id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const rows = (st.tours || []).slice().sort((a, b) => b.used - a.used || b.reviews - a.reviews);
      const i = rows.findIndex(x => String(x.tourId) === String(id));
      if (i < 0 && !list.length) return null;
      const s = rows[i] || {};
      return { reviews: list, count: list.length, total: s.reviews || list.length, rating: s.rating || 0, used: s.used || 0, rank: i >= 0 ? i + 1 : 0, offline: true };
    } catch (e) { return null; }
  }
  // Điểm thành phần + ảnh (nếu có). Ảnh chỉ hiện khi qua ReviewSchema.safeImage (chặn javascript:/data:)
  function reviewExtraHtml(r) {
    let h = "";
    if (r.criteria && window.ReviewSchema) {
      h += '<div class="rv-crit">' + Object.keys(r.criteria).filter(k => ReviewSchema.CRITERIA[k]).map(k => "<span>" + esc(ReviewSchema.CRITERIA[k]) + ": <b>" + esc(r.criteria[k]) + "/5</b></span>").join(" · ") + "</div>";
    }
    if (r.image && window.ReviewSchema && ReviewSchema.safeImage(r.image)) h += '<img class="rv-img" src="' + esc(r.image) + '" alt="Ảnh của ' + esc(r.name) + '" loading="lazy" style="max-width:220px;border-radius:8px;margin-top:6px">';
    return h;
  }
  // 6.6 Khối tổng quan: điểm TB + tổng review + phân bố 5→1 sao.
  // Điểm TB / tổng lấy từ số liệu tổng hợp của server (gồm cả lượt đánh giá khởi điểm); thanh phân bố tính trên các bình luận chi tiết đang có.
  function reviewSummaryHtml(data, list, total) {
    const RS = window.ReviewSchema;
    const avg = data.rating || (RS ? RS.average(list) : 0);
    const dist = (data && data.distribution) || (RS ? RS.distribution(list) : null);
    let h = '<div class="rv-sum" role="group" aria-label="Tổng quan đánh giá"><div class="rv-score"><span class="rv-big">' + (avg ? Number(avg).toFixed(1) : "–") + '</span>' +
      '<div class="rv-stars" aria-hidden="true">' + stars(avg || 0) + '</div><div class="tp-muted">' + nf(total) + " lượt đánh giá" + (data.used ? " · " + nf(data.used) + " lượt dùng tour" : "") + "</div></div>";
    if (dist && dist.total) {
      h += '<div class="rv-dist">';
      [5, 4, 3, 2, 1].forEach(k => {
        const n = dist.counts[k];
        h += '<button type="button" class="rv-dist-row" data-star="' + k + '" aria-pressed="false"' + (n ? "" : " disabled") + ' title="' + (n ? "Chỉ xem đánh giá " + k + " sao" : "Chưa có đánh giá " + k + " sao") + '">' +
          '<span class="rv-dist-lbl">' + k + ' ★</span>' +
          '<span class="rv-bar" role="img" aria-label="' + k + " sao: " + n + " bình luận, " + dist.percent[k] + '%"><span style="width:' + dist.percent[k] + '%"></span></span>' +
          '<span class="rv-dist-n">' + n + "</span></button>";
      });
      h += '<div class="tp-muted rv-dist-note">Phân bố theo ' + nf(dist.total) + " bình luận chi tiết bên dưới · bấm một mức sao để lọc</div></div>";
    }
    h += "</div>";
    // 6.11 Điểm TB từng tiêu chí — chỉ hiện tiêu chí đã có người chấm
    const ca = (data && data.criteriaAverages) || (RS ? RS.criteriaAverages(list) : {});
    const keys = RS ? Object.keys(RS.CRITERIA).filter(k => ca[k] && ca[k].n) : [];
    if (keys.length) {
      h = h.slice(0, -6) + '<div class="rv-crit-sum" aria-label="Điểm trung bình từng tiêu chí">' + keys.map(k =>
        '<span class="rv-crit-chip"><span>' + esc(RS.CRITERIA[k]) + '</span><b>' + Number(ca[k].avg).toFixed(1) + '</b><small>/5 · ' + ca[k].n + " lượt</small></span>").join("") + "</div></div>";
    }
    return h;
  }
  function reviewItemHtml(r) {
    return '<div class="rv-item"><div class="rv-head"><span><b>' + esc(r.name) + '</b> <span class="rv-stars" aria-label="' + r.rating + ' sao">' + stars(r.rating) + '</span></span>' +
      '<span class="rv-date">' + (r.source === "demo" ? '<span class="rv-badge rv-badge-demo" title="Bình luận mẫu để minh hoạ, không phải khách thật">Bình luận mẫu</span>' : r.source === "admin" ? '<span class="rv-badge">Quản trị viên (thử nghiệm)</span>' : "✔ Đã đi tour") + " · " + fmtDay(r.date || r.createdAt) + '</span></div><p class="rv-txt">' + esc(r.content) + "</p>" +
      reviewExtraHtml(r) + "</div>";
  }
  const PAGE = 5;   // số bình luận hiện mỗi lần
  async function loadReviews(t) {
    const box = document.getElementById("tp-reviews"), rate = document.getElementById("tp-rate");
    if (!box) return;
    const data = await fetchReviewData(t.id);
    if (!document.getElementById("tp-reviews") || document.getElementById("tp-reviews").dataset.tour !== String(t.id)) return;   // đã sang tour khác
    const list = (data && data.reviews) || [];
    const total = (data && data.total) || list.length;
    if (rate && data && (total || data.used)) {
      rate.innerHTML = (data.rating ? '<span class="tp-star">' + Number(data.rating).toFixed(1) + "</span>" : "") +
        "<span><b>" + nf(total) + "</b> lượt đánh giá</span>" + (data.used ? "<span><b>" + nf(data.used) + "</b> lượt dùng tour</span>" : "") +
        (data.rank && data.rank <= 11 ? '<span class="tp-rank">Top ' + data.rank + " yêu thích</span>" : "");
    }
    let h = '<h2 class="tp-h2">Đánh giá & bình luận sau tour</h2>';
    if (!list.length && !total) h += '<p class="tp-muted">Hành trình này chưa có đánh giá. Nếu đã hoàn thành tour, bạn có thể gửi nhận xét bên dưới.</p>';
    else {
      h += reviewSummaryHtml(data, list, total);
      h += '<div class="rv-filter" id="rv-filter" hidden></div><div class="rv-list" id="rv-list" aria-live="polite"></div><button type="button" class="btn btn-outline rv-more" id="rv-more" hidden></button>';
    }
    h += '<div id="rv-form-box"></div>';
    box.innerHTML = h;

    // 6.8 Danh sách: lọc theo sao (bấm thanh phân bố), "Xem thêm" từng 5 bình luận
    if (list.length) {
      let star = 0, shown = PAGE;
      const listEl = document.getElementById("rv-list"), moreEl = document.getElementById("rv-more"), filterEl = document.getElementById("rv-filter");
      const paint = () => {
        const rows = star ? list.filter(r => r.rating === star) : list;
        listEl.innerHTML = rows.length ? rows.slice(0, shown).map(reviewItemHtml).join("") : '<p class="tp-muted">Chưa có nhận xét ' + star + ' sao. Chọn “Xem tất cả” để xem các đánh giá khác.</p>';
        const left = rows.length - shown;
        moreEl.hidden = left <= 0;
        if (left > 0) moreEl.textContent = "Xem thêm " + Math.min(PAGE, left) + " bình luận (còn " + left + ")";
        filterEl.hidden = !star;
        filterEl.innerHTML = star ? "Đang xem <b>" + star + " ★</b> (" + rows.length + ' bình luận) · <button type="button" class="rv-link" id="rv-clear">Xem tất cả</button>' : "";
        box.querySelectorAll(".rv-dist-row").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.star === star)));
        const clr = document.getElementById("rv-clear"); if (clr) clr.onclick = () => { star = 0; shown = PAGE; paint(); };
      };
      moreEl.onclick = () => { shown += PAGE; paint(); };
      box.querySelectorAll(".rv-dist-row").forEach(b => b.onclick = () => { const k = +b.dataset.star; star = star === k ? 0 : k; shown = PAGE; paint(); });
      paint();
    }
    renderReviewForm(t);
  }

  // 6.9 Form viết đánh giá: chọn sao (bàn phím được) + nội dung. Chỉ khách đã đi xong tour mới viết được (server kiểm tra lại khi gửi)
  const STAR_TXT = ["", "Tệ", "Chưa tốt", "Tạm ổn", "Tốt", "Tuyệt vời"];
  async function renderReviewForm(t) {
    const fb = document.getElementById("rv-form-box"); if (!fb) return;
    const lock = msg => { fb.innerHTML = '<p class="rv-lock">' + esc(msg) + "</p>"; };
    let el = null;
    try { const r = await Api.get("/api/reviews/eligible?tourId=" + encodeURIComponent(t.id)); el = r.ok ? r.data : { eligible: false, reason: r.status === 401 ? "Đăng nhập và hoàn thành tour để viết đánh giá" : (r.data && r.data.msg) }; } catch (e) { /* không có server */ }
    if (!el) return lock("Chỉ khách đã hoàn thành tour mới viết được đánh giá.");
    if (!el.eligible) return lock(el.reason || "Chỉ khách đã hoàn thành tour mới viết được đánh giá.");
    const L = (window.ReviewSchema && ReviewSchema.LIMITS) || { contentMin: 5, contentMax: 1000 };
    const CRIT = (window.ReviewSchema && ReviewSchema.CRITERIA) || {};
    fb.innerHTML = '<form class="rv-form" id="rv-form" novalidate><b>Chia sẻ trải nghiệm của bạn</b>' +
      '<div class="rv-pick" id="rv-pick" role="radiogroup" aria-label="Chọn số sao">' +
        [1, 2, 3, 4, 5].map(i => '<button type="button" class="rv-star" role="radio" aria-checked="false" data-v="' + i + '" aria-label="' + i + " sao – " + STAR_TXT[i] + '" tabindex="' + (i === 1 ? 0 : -1) + '">★</button>').join("") +
        '<span class="rv-pick-txt" id="rv-pick-txt">Bấm để chọn số sao</span></div>' +
      '<fieldset class="rv-crit-box"><legend>Chấm chi tiết <small>(không bắt buộc – bỏ trống nếu không muốn chấm)</small></legend>' +
        Object.keys(CRIT).map(k => '<div class="rv-crit-row" data-k="' + k + '" role="radiogroup" aria-label="' + esc(CRIT[k]) + '"><span class="rv-crit-name">' + esc(CRIT[k]) + "</span>" +
          [1, 2, 3, 4, 5].map(i => '<button type="button" class="rv-star rv-star-sm" role="radio" aria-checked="false" data-v="' + i + '" aria-label="' + esc(CRIT[k]) + " " + i + ' sao" tabindex="' + (i === 1 ? 0 : -1) + '">★</button>').join("") +
          '<button type="button" class="rv-link rv-crit-clear" hidden>Bỏ chấm</button></div>').join("") + "</fieldset>" +
      '<textarea id="rv-content" maxlength="' + L.contentMax + '" aria-label="Nội dung đánh giá" placeholder="Bạn thấy tour thế nào? (ít nhất ' + L.contentMin + ' ký tự)"></textarea>' +
      '<div class="rv-form-foot"><span class="rv-count" id="rv-count">0/' + L.contentMax + '</span><span class="rv-err" id="rv-err" role="alert"></span>' +
      '<button type="submit" class="btn btn-primary" id="rv-send">Gửi đánh giá</button></div></form>';

    let rating = 0;
    const pick = document.getElementById("rv-pick"), stars = [...pick.querySelectorAll(".rv-star")], txt = document.getElementById("rv-pick-txt");
    const errEl = document.getElementById("rv-err"), area = document.getElementById("rv-content"), count = document.getElementById("rv-count");
    const paintStars = hover => {
      const upto = hover || rating;
      stars.forEach(b => { const v = +b.dataset.v; b.classList.toggle("on", v <= upto); b.setAttribute("aria-checked", String(v === rating)); b.tabIndex = (rating ? v === rating : v === 1) ? 0 : -1; });
      txt.textContent = upto ? upto + " sao – " + STAR_TXT[upto] : "Bấm để chọn số sao";
    };
    const setRating = v => { rating = v; errEl.textContent = ""; paintStars(); };
    stars.forEach(b => {
      b.onclick = () => setRating(+b.dataset.v);
      b.onmouseenter = () => paintStars(+b.dataset.v);
      b.onfocus = () => paintStars(+b.dataset.v);
      b.onblur = () => paintStars();
      b.onkeydown = e => {
        const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const nv = Math.min(5, Math.max(1, (rating || 0) + d)); setRating(nv); stars[nv - 1].focus();
      };
    });
    pick.onmouseleave = () => paintStars();

    // 6.10 5 tiêu chí tuỳ chọn: bấm lại đúng mức đang chọn (hoặc "Bỏ chấm") để xoá; không chọn thì không gửi
    const crit = {};
    fb.querySelectorAll(".rv-crit-row").forEach(row => {
      const k = row.dataset.k, bs = [...row.querySelectorAll(".rv-star")], clr = row.querySelector(".rv-crit-clear");
      const paint = () => { bs.forEach(b => { const v = +b.dataset.v; b.classList.toggle("on", v <= (crit[k] || 0)); b.setAttribute("aria-checked", String(v === crit[k])); b.tabIndex = (crit[k] ? v === crit[k] : v === 1) ? 0 : -1; }); clr.hidden = !crit[k]; };
      const set = v => { if (v) crit[k] = v; else delete crit[k]; paint(); };
      bs.forEach(b => {
        b.onclick = () => set(crit[k] === +b.dataset.v ? 0 : +b.dataset.v);
        b.onkeydown = e => {
          const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!d) return;
          e.preventDefault(); const nv = Math.min(5, Math.max(1, (crit[k] || 0) + d)); set(nv); bs[nv - 1].focus();
        };
      });
      clr.onclick = () => set(0);
    });
    area.oninput = () => { count.textContent = area.value.length + "/" + L.contentMax; errEl.textContent = ""; };

    document.getElementById("rv-form").onsubmit = async ev => {
      ev.preventDefault();
      const btn = document.getElementById("rv-send");
      if (btn.disabled) return;   // chặn bấm đúp
      if (!rating) { errEl.textContent = "Vui lòng chọn số sao"; stars[0].focus(); return; }
      const chk = window.ReviewSchema ? ReviewSchema.validateInput({ rating, content: area.value, criteria: crit }) : { ok: area.value.trim().length >= 5, msg: "Nội dung ít nhất 5 ký tự" };
      if (!chk.ok) { errEl.textContent = chk.msg; area.focus(); return; }
      btn.disabled = true; btn.textContent = "Đang gửi…";
      try {
        const r = await Api.post("/api/reviews", Object.assign({ tourId: t.id, rating, content: area.value }, Object.keys(crit).length ? { criteria: crit } : {}));
        if (!r.ok) { errEl.textContent = (r.data && r.data.msg) || "Không gửi được đánh giá"; btn.disabled = false; btn.textContent = "Gửi đánh giá"; return; }
        showToast("Cảm ơn bạn đã đánh giá tour!", "success");
        loadReviews(t);
        document.dispatchEvent(new CustomEvent("travel:bookings"));   // cập nhật bảng xếp hạng
      } catch (e) { errEl.textContent = "Không gửi được đánh giá (không có máy chủ)"; btn.disabled = false; btn.textContent = "Gửi đánh giá"; }
    };
  }

  function relatedHtml(t) {
    const list = (window.TOUR_SAMPLES || []).filter(x => String(x.id) !== String(t.id) && x.region === t.region);
    const prov = (typeof provincesOf === "function") ? provincesOf(t) : [];
    list.sort((a, b) => {
      const sa = prov.length && (provincesOf(a) || []).some(p => prov.includes(p)) ? 0 : 1;
      const sb = prov.length && (provincesOf(b) || []).some(p => prov.includes(p)) ? 0 : 1;
      return sa - sb || Math.abs(a.price - t.price) - Math.abs(b.price - t.price);
    });
    const top = list.slice(0, 3);
    if (!top.length) return "";
    return '<section class="tp-sec"><h2 class="tp-h2">Tour tương tự</h2><div class="tp-related">' +
      top.map(x => '<a class="tp-rel-card" href="' + hrefOf(x.id) + '">' +
        '<span class="tp-rel-name">' + esc(x.name) + '</span><span class="tp-rel-meta">' + esc(x.duration || "") + "</span>" +
        '<span class="tp-rel-price">' + money(x.price) + "</span></a>").join("") + "</div></section>";
  }

  function render(t) {
    const guided = t.guide === "guided";
    const dest = (typeof destOf === "function") ? destOf(t) : (t.dest || t.name);
    const incl = (t.includes && t.includes.length) ? t.includes : guided
      ? ["Xe đưa đón sân bay", "Khách sạn tiêu chuẩn", "Hướng dẫn viên tiếng Việt", "Bảo hiểm du lịch", "Bữa ăn theo chương trình"]
      : ["Lịch trình chi tiết theo ngày", "Gợi ý ăn uống & tham quan", "Ước tính chi phí từng điểm", "Linh hoạt sắp xếp theo ý thích"];
    const excl = (t.excludes && t.excludes.length) ? t.excludes : guided
      ? ["Vé máy bay (nếu cần)", "Chi phí cá nhân", "Đồ uống trong bữa ăn"]
      : ["Vé máy bay / xe khách", "Khách sạn (tự đặt)", "Hướng dẫn viên (có thể thuê thêm)", "Bảo hiểm du lịch"];
    const li = a => a.map(x => "<li>" + esc(x) + "</li>").join("");
    const highlights = (t.highlight || "").split("·").map(h => h.trim()).filter(Boolean);
    const decisionRows = [];
    if (t.duration) decisionRows.push('<div><dt>Thời lượng</dt><dd>' + esc(t.duration) + '</dd></div>');
    if (highlights.length) decisionRows.push('<div><dt>Điểm nổi bật</dt><dd>' + highlights.slice(0, 2).map(esc).join(' · ') + '</dd></div>');
    const shortList = items => items.slice(0, 2).map(esc).join(' · ') + (items.length > 2 ? ' · +' + (items.length - 2) + ' mục' : '');
    if (t.includes && t.includes.length) decisionRows.push('<div><dt>Đã gồm</dt><dd>' + shortList(t.includes) + '</dd></div>');
    if (t.excludes && t.excludes.length) decisionRows.push('<div><dt>Chưa gồm</dt><dd>' + shortList(t.excludes) + '</dd></div>');
    decisionRows.push('<div><dt>Hủy & hoàn cọc</dt><dd>' + (t.cancelNote ? esc(t.cancelNote) : '<a href="#" class="tp-policy-shortcut">Xem chính sách</a>') + '</dd></div>');

    root().innerHTML =
      '<button class="back-btn" id="tp-back">← Tất cả tour</button>' +
      '<div class="tp-hero" id="tp-hero" data-tour-img data-tour-id="' + esc(t.id) + '">' +
        '<div class="tp-cover" aria-hidden="true"><span class="tp-cover-name">' + esc(dest) + '</span><span class="tp-cover-meta">' + esc([t.region, t.duration].filter(Boolean).join(" · ")) + "</span></div>" +
        '<span class="tp-hero-credit">Ảnh: Wikipedia</span></div>' +
      '<div class="tp-grid"><div class="tp-main">' +
        '<div class="tp-head"><div class="tp-dest">' + esc(dest) + "</div>" +
        '<h1 class="tp-title">' + esc(t.name) + "</h1>" +
        '<section class="tp-mobile-decision" aria-label="Tóm tắt trước khi đặt">' +
          '<div class="tp-mobile-decision-meta">' + esc([dest, t.duration].filter(Boolean).join(" · ")) + '</div>' +
          '<div class="tp-mobile-decision-price"><span>' + (guided ? "Giá từ" : "Chi phí tự túc ước tính") + '</span><strong>' + money(t.price) + ' <small>/ người</small></strong></div>' +
          '<div class="tp-mobile-decision-note">' + (guided ? "Đã gồm hướng dẫn viên" : "Thuê HDV nội địa tuỳ chọn khi đặt tour") + '</div>' +
          '<button class="btn btn-primary tp-book" id="tp-mobile-book" type="button">Đặt tour ngay</button>' +
        '</section>' +
        '<p class="tp-desc">' + esc(t.desc || "") + "</p>" +
        '<div class="tp-rate" id="tp-rate"></div>' +
        '<div class="tp-chips">' +
          (t.duration ? '<span class="tp-chip">' + esc(t.duration) + "</span>" : "") +
          (t.groupSize ? '<span class="tp-chip">' + esc(t.groupSize) + "</span>" : "") +
          (t.difficulty ? '<span class="tp-chip">' + esc(t.difficulty) + "</span>" : "") +
          '<span class="tp-chip ' + (guided ? "tp-chip-g" : "tp-chip-s") + '">' + (guided ? "Có hướng dẫn viên" : "Tự túc") + "</span>" +
          (t.region ? '<span class="tp-chip">' + esc(t.region) + "</span>" : "") +
        "</div>" +
        ((t.tags || []).length ? '<div class="tp-tags">' + t.tags.map(x => "<span>#" + esc(x) + "</span>").join("") + "</div>" : "") +
        "</div>" +
        (highlights.length ? '<section class="tp-sec"><h2 class="tp-h2">Điểm nổi bật</h2><ul class="tp-hl">' + highlights.map(h => "<li>" + esc(h) + "</li>").join("") + "</ul></section>" : "") +
        '<section class="tp-sec"><h2 class="tp-h2">Thời tiết điểm đến</h2><div class="wx-box" id="tp-weather" aria-live="polite"></div></section>' +
        '<section class="tp-sec"><h2 class="tp-h2">Vị trí trên bản đồ</h2><div class="tlm-map" id="tp-map" role="region" aria-label="Bản đồ vị trí tour"></div><div class="tlm-note"></div></section>' +
        '<section class="tp-sec"><h2 class="tp-h2">Lịch trình</h2>' + itineraryHtml(t) + "</section>" +
        '<section class="tp-sec tp-incl"><div><h2 class="tp-h2">Bao gồm</h2><ul class="tp-list">' + li(incl) + '</ul></div>' +
        '<div><h2 class="tp-h2">Không bao gồm</h2><ul class="tp-list tp-list-no">' + li(excl) + "</ul></div></section>" +
        departuresHtml(t) +
        (t.pickup ? '<section class="tp-sec"><h2 class="tp-h2">Điểm đón</h2><p class="tp-pickup">' + esc(t.pickup) + "</p></section>" : "") +
        cancelHtml(t) +
        '<section class="tp-sec" id="tp-reviews" data-tour="' + esc(t.id) + '"></section>' +
        relatedHtml(t) +
      '</div><aside class="tp-side"><div class="tp-card">' +
        '<section class="tp-decision" aria-label="Thông tin cần biết trước khi đặt"><h2>Mặt sau tấm vé</h2><dl>' + decisionRows.join("") + '</dl></section>' +
        '<div class="tp-price-label">' + (guided ? "Giá từ" : "Chi phí tự túc ước tính") + "</div>" +
        '<div class="tp-price">' + money(t.price) + ' <small>/ người</small></div>' +
        (guided ? '<div class="tp-price-note">Đã gồm hướng dẫn viên</div>' : '<div class="tp-price-note">Thuê HDV nội địa tuỳ chọn khi đặt tour</div>') +
        '<div class="tp-stub"><div class="tp-promo" id="tp-promo"></div>' +
        '<button class="btn btn-primary tp-book" id="tp-book">Đặt tour ngay</button>' +
        '<button class="btn btn-outline tp-share" id="tp-share">Chia sẻ tour</button>' +
        '<div class="tp-link" id="tp-link" title="Link chia sẻ"></div></div>' +
      "</div></aside></div>";

    const url = location.origin + location.pathname + hrefOf(t.id);
    document.getElementById("tp-link").textContent = url;
    document.title = t.name + " – " + SITE_TITLE;
    // Thời tiết (7.6–7.8) + map nhỏ (8.2–8.4): mở tour khác → render() chạy lại, map được tạo lại đúng vị trí tour mới
    if (window.Weather) Weather.renderWeather(document.getElementById("tp-weather"), t.id);
    if (window.TourLocationMap) TourLocationMap.renderMap(document.getElementById("tp-map"), t.id);

    document.getElementById("tp-back").onclick = () => goBack(false);
    const book = date => {
      const go = () => typeof openTourDetail === "function"
        ? openTourDetail(tourToModalData(t), { openBooking: true, date })
        : showToast("Chưa mở được form đặt tour", "warn");
      typeof requireAuth === "function" ? requireAuth(go) : go();
    };
    document.getElementById("tp-book").onclick = () => book();
    document.getElementById("tp-mobile-book").onclick = () => document.getElementById("tp-book").click();
    root().querySelectorAll(".tp-dep").forEach(b => b.onclick = () => book(b.dataset.date));
    const pl = document.getElementById("tp-policy-link");
    if (pl) pl.onclick = e => { e.preventDefault(); navigate("policy", { tab: "refund" }); };
    root().querySelector(".tp-policy-shortcut")?.addEventListener("click", e => { e.preventDefault(); navigate("policy", { tab: "refund" }); });
    document.getElementById("tp-share").onclick = () => share(t, url);
    if (typeof TourImages !== "undefined") TourImages.attach(document.getElementById("tp-hero"), t);
    loadReviews(t);
    paintPromo(t, book);
  }

  // Khung "Mã giảm 15% dành riêng cho bạn": mỗi tài khoản 1 mã riêng cho tour này, dùng 1 lần; bấm là áp dụng khi đặt tour
  async function paintPromo(t, book) {
    const box = document.getElementById("tp-promo"); if (!box || !window.VoucherUI) return;
    const logged = typeof Auth !== "undefined" && Auth.isLoggedIn();
    const open = code => {
      const go = () => typeof openTourDetail === "function"
        ? openTourDetail(tourToModalData(t), { openBooking: true, voucherCode: code })
        : showToast("Chưa mở được form đặt tour", "warn");
      typeof requireAuth === "function" ? requireAuth(go) : go();
    };
    if (!(t.id && /^hot\d+$/.test(String(t.id)))) return;      // chỉ 5 tour trên banner có mã riêng
    if (!logged) {
      box.innerHTML = '<div class="tp-promo-in"><b>Giảm 15%</b> tour này<small>Đăng nhập để nhận mã riêng cho tài khoản của bạn (dùng 1 lần)</small><button type="button" class="btn btn-outline" id="tp-promo-btn">Đăng nhập nhận mã</button></div>';
      document.getElementById("tp-promo-btn").onclick = () => { typeof requireAuth === "function" ? requireAuth(() => paintPromo(t, book)) : null; };
      return;
    }
    const v = await VoucherUI.forTour(t.id).catch(() => null);
    if (!document.getElementById("tp-promo")) return;
    if (!v) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="tp-promo-in">Mã <b>' + esc(v.code) + '</b> −' + esc(v.value) + '%<small>Dành riêng cho tài khoản của bạn · chỉ dùng 1 lần cho tour này</small><button type="button" class="btn btn-primary" id="tp-promo-btn">Bấm để giảm 15% & đặt tour</button></div>';
    document.getElementById("tp-promo-btn").onclick = () => open(v.code);
  }

  function share(t, url) {
    if (navigator.share) { navigator.share({ title: t.name, text: t.desc || t.name, url }).catch(() => {}); return; }
    const done = () => showToast("Đã sao chép link tour", "success");
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done)); }
    else fallbackCopy(url, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch { showToast("Hãy sao chép link trên thanh địa chỉ", "info"); }
    ta.remove();
  }

  // ---------- Điều hướng ----------
  function open(id) { fromApp = true; location.hash = hrefOf(id); }

  // Quay lại: nếu vào từ giao diện thì lùi lịch sử; nếu mở link trực tiếp thì về trang chủ
  function goBack(forceHome) {
    if (fromApp && !forceHome && history.length > 1) { history.back(); return; }
    clearHash();
    navigate("home");
    setTimeout(() => document.getElementById("sec-tours")?.scrollIntoView({ block: "start" }), 120);
  }

  async function route() {
    const id = idFromHash();
    if (id === null) {                       // rời khỏi route tour (nút Back của trình duyệt…)
      if (AppState.page === "tour") { navigate("home"); document.title = SITE_TITLE; }
      return;
    }
    const token = ++renderToken;
    navigate("tour");
    skeleton();
    window.scrollTo(0, 0);
    let failed = false;
    try { await loadHomeData(); if (typeof syncAdminTours === "function") syncAdminTours(); } catch { failed = true; }
    if (token !== renderToken) return;       // đã chuyển sang route khác
    const local = (window.TOUR_SAMPLES || []).find(x => String(x.id) === String(id));
    // Chi tiết tour lấy từ server (/api/tours/:id); dữ liệu cục bộ chỉ bổ sung trường phụ / dự phòng khi không có server
    let apiTour = null;
    try {
      const r = await fetch("/api/tours/" + encodeURIComponent(id), { credentials: "same-origin" });
      if (r.ok) apiTour = (await r.json()).tour || null;
    } catch {}
    if (token !== renderToken) return;
    const t = apiTour && !(local && local._admin) ? Object.assign({}, local || {}, apiTour) : local;
    if (!t) return notFound(id, failed || !(window.TOUR_SAMPLES || []).length);
    render(t);
  }

  // Khi điều hướng sang trang khác bằng navigate(), bỏ hash tour để F5 không bật lại trang tour
  const _nav = window.navigate;
  window.navigate = function (page, opts) {
    const r = _nav.apply(this, arguments);
    if (page !== "tour" && ready) { clearHash(); if (document.title !== SITE_TITLE) document.title = SITE_TITLE; }
    return r;
  };

  window.addEventListener("hashchange", () => { if (ready) route(); });
  // Các script khác (main.js) gọi navigate("home") khi khởi động → đợi sự kiện load rồi mới xử lý hash ban đầu
  window.addEventListener("load", () => { ready = true; route(); });

  return { open, route, hrefOf };
})();
