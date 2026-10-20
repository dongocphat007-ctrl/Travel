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
        const stats = (i.rating ? '<span class="tc-fact tc-rate">★ ' + i.rating.toFixed(1) + "</span>" : "")
          + '<span class="tc-fact">' + nf(i.reviews) + " đánh giá</span>"
          + '<span class="tc-fact" title="Số lượt dùng tour (không tính đơn đã hủy)">' + nf(i.count) + " lượt dùng</span>";
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
