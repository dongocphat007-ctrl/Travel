/**
 * TourFinder — trang "Tìm Tour": LỚP GIAO DIỆN MỎNG trên TourSearch.find (cùng lõi với chatbot).
 *   Việc của file này: gọi TourSearch.find → vẽ thẻ tour THẬT + marker bản đồ + bộ lọc/sắp xếp trên kết quả,
 *   và nút "Hỏi chatbot để tinh chỉnh" (Chatbot.continueFrom).
 *   Không tự gọi AI, không tự chọn tour.
 * Phụ thuộc: tour-search.js, tour-map.js (TourMap), home.js (BUDGETS, DAYS, daysMatch, daysOf), chatbot.js, utils.js (showToast).
 */
const TourFinder = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";
  const isIntl = (t) => t.src === "intl" || t.region === "Quốc tế" || t.international === true;

  let result = null;       // kết quả TourSearch.find gần nhất
  let shown = [];          // tour đang hiển thị sau lọc/sắp xếp
  let seq = 0;             // bỏ qua kết quả cũ khi tìm liên tiếp
  let locs = null;         // Map tourId → { lat, lng, precision }

  async function loadLocations() {
    if (locs) return locs;
    let list = [];
    try { const r = await fetch("/api/locations"); if (r.ok) list = (await r.json()).locations || []; } catch (e) { /* thử file */ }
    if (!list.length) { try { list = (await (await fetch("data/locations.json")).json()).locations || []; } catch (e) { list = []; } }
    locs = new Map(list.map((l) => [String(l.tourId), l]));
    return locs;
  }

  // ───────── Bộ lọc / sắp xếp (chỉ thao tác trên kết quả đã có, không gọi lại AI) ─────────
  function fillFilters() {
    const b = $("tf-f-budget"), d = $("tf-f-days");
    if (b && !b.options.length && typeof BUDGETS !== "undefined") b.innerHTML = BUDGETS.map((x) => `<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("");
    if (d && !d.options.length && typeof DAYS !== "undefined") d.innerHTML = DAYS.map((x) => `<option value="${esc(x[0])}">${esc(x[1])}</option>`).join("");
  }

  function applyFilters() {
    if (!result) return [];
    const budget = $("tf-f-budget")?.value || "all", days = $("tf-f-days")?.value || "all";
    const guide = $("tf-f-guide")?.value || "all", scope = $("tf-f-scope")?.value || "all", sort = $("tf-f-sort")?.value || "rel";
    const range = (typeof BUDGETS !== "undefined" ? BUDGETS.find((x) => x[0] === budget) : null) || ["all", "", 0, Infinity];
    const dOf = (t) => (typeof daysOf === "function" ? daysOf(t) : 1);
    let list = result.tours.map((t, i) => ({ t, i })).filter(({ t }) => {
      const p = Number(t.price) || 0;
      if (p < range[2] || p >= range[3]) return false;
      if (days !== "all" && typeof daysMatch === "function" && !daysMatch(dOf(t), days)) return false;
      if (guide !== "all" && (t.guide === "guided" ? "guided" : "self") !== guide) return false;
      if (scope === "dom" && isIntl(t)) return false;
      if (scope === "intl" && !isIntl(t)) return false;
      return true;
    });
    const by = { "price-asc": (a, b) => a.t.price - b.t.price, "price-desc": (a, b) => b.t.price - a.t.price, "days-asc": (a, b) => dOf(a.t) - dOf(b.t) };
    if (by[sort]) list.sort(by[sort]);          // "rel" giữ thứ tự TourSearch trả về
    return list.map((x) => x.t);
  }

  // ───────── Vẽ ─────────
  function cardHtml(t, n) {
    const facts = [t.duration, t.guide === "guided" ? "Có hướng dẫn viên" : "Tự túc", isIntl(t) ? "Quốc tế" : ""].filter(Boolean);
    return `<article class="tm-tour-card" data-tour-id="${esc(t.id)}" tabindex="0">
      <div class="tm-card-top"><div class="tm-card-name"><span class="tf-n">${n}</span>${esc(t.emoji || "")} ${esc(t.name)}</div>
        <div class="tm-card-price">${money(t.price)}<small> /người</small></div></div>
      <div class="tm-card-meta">${[t.dest || t.destination || t.region, t.cat].filter(Boolean).map((x) => `<span>📍 ${esc(x)}</span>`).join("")}</div>
      <div class="tm-card-meta">${facts.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      ${t.desc ? `<div class="tm-card-desc">${esc(t.desc)}</div>` : ""}
      <div class="tf-card-actions"><button type="button" class="tm-btn-map" data-act="map">🗺️ Xem trên bản đồ</button>
        <button type="button" class="tf-btn-detail" data-act="detail">Xem chi tiết</button></div></article>`;
  }

  async function render() {
    const box = $("tf-cards");
    shown = applyFilters();
    const total = result ? result.tours.length : 0;
    $("tf-count").textContent = result ? `Hiển thị ${shown.length}/${total} tour` : "";
    if (!result) { box.innerHTML = ""; return; }
    if (!total) {
      box.innerHTML = `<div class="tf-empty"><p><strong>Chưa có hành trình nào khớp.</strong></p><p>Thử bỏ bớt điều kiện hoặc gõ tên điểm đến khác (VD: “Đà Lạt”, “Nhật Bản”).</p></div>`;
    } else if (!shown.length) {
      box.innerHTML = `<div class="tf-empty"><p>Không tour nào trong ${total} kết quả khớp bộ lọc. Hãy nới bộ lọc ở trên.</p></div>`;
    } else {
      box.innerHTML = shown.map((t, i) => cardHtml(t, i + 1)).join("");
    }
    const my = seq;
    const map = await loadLocations();
    if (my !== seq) return;
    TourMap.showTours(shown, map, (id) => highlight(id));
  }

  function highlight(id) {
    document.querySelectorAll("#tf-cards .tm-tour-card").forEach((c) => c.classList.toggle("is-active", c.dataset.tourId === String(id)));
    const el = document.querySelector(`#tf-cards .tm-tour-card[data-tour-id="${CSS.escape(String(id))}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ───────── Tìm ─────────
  async function search(q) {
    q = String(q == null ? $("tf-search")?.value : q).trim();
    if (!q) return;
    const my = ++seq;
    $("tf-search").value = q;
    $("tf-loading").style.display = "block";
    $("tf-result").hidden = true;
    $("tf-cards").innerHTML = "";
    $("tf-map-placeholder").style.display = "none";
    try {
      const r = await TourSearch.find(q);
      if (my !== seq) return;
      result = r;
      ["tf-f-budget", "tf-f-days", "tf-f-guide", "tf-f-scope"].forEach((id) => { const s = $(id); if (s) s.value = "all"; });
      if ($("tf-f-sort")) $("tf-f-sort").value = "rel";
      $("tf-summary").textContent = r.summary;
      $("tf-result").hidden = false;
      if (!TourMap.getMapInstance()) TourMap.initMap("tf-map-container");
      await render();
    } catch (e) {
      console.error("[TourFinder]", e);
      if (my !== seq) return;
      if (typeof showToast === "function") showToast("Chưa thể tìm hành trình lúc này. Kiểm tra kết nối rồi thử lại nhé.", "error");
      $("tf-map-placeholder").style.display = "flex";
    }
    if (my === seq) $("tf-loading").style.display = "none";
  }

  /** Mở trang Tìm Tour và chạy luôn câu tìm (dùng từ chatbot). */
  function open(q) {
    $("nav-tour-finder")?.click();
    if (q) setTimeout(() => search(q), 150);
  }

  function init() {
    if (!$("page-tour-finder")) return;
    fillFilters();
    $("tf-search-btn")?.addEventListener("click", () => search());
    $("tf-search")?.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
    ["tf-f-budget", "tf-f-days", "tf-f-guide", "tf-f-scope", "tf-f-sort"].forEach((id) => $(id)?.addEventListener("change", render));
    $("tf-ask-chat")?.addEventListener("click", () => {
      if (result && typeof Chatbot !== "undefined") Chatbot.continueFrom({ query: result.query, summary: result.summary, tours: result.tours });
    });
    $("tf-cards")?.addEventListener("click", (e) => {
      const card = e.target.closest(".tm-tour-card");
      if (!card) return;
      const id = card.dataset.tourId;
      if (e.target.closest('[data-act="detail"]')) return TourSearch.open(id);
      highlight(id);
      TourMap.focusTour(id);
    });
    $("tf-cards")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.target.closest("button")) return;
      const card = e.target.closest(".tm-tour-card");
      if (card) { highlight(card.dataset.tourId); TourMap.focusTour(card.dataset.tourId); }
    });
  }
  init();
  return { search, open };
})();
window.TourFinder = TourFinder;
