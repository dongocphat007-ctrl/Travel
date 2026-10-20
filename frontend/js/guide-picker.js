/**
 * guide-picker.js – Dropdown "Chọn hướng dẫn viên" trong form đặt tour (mục 5.8)
 *   GuidePicker.attach({ select, row, msg, getDate, getDays, isNeeded }) → { refresh, getValue }
 * Guide bận (trùng ngày trong khoảng [ngày đi, ngày đi + số ngày tour)) hoặc "Tạm nghỉ" bị khoá (disabled).
 * Việc kiểm tra thật nằm ở SERVER (POST /api/bookings); ở đây chỉ để người dùng thấy trước.
 * Phụ thuộc: shared/guide-availability.js (GuideAvailability), data-api.js (Api)
 */
const GuidePicker = (() => {
  let cache = null, loading = null;
  const dmy = d => d.split("-").reverse().join("/");

  // Lấy danh sách guide: server trước, không có server thì đọc file mẫu (giống trang Hướng dẫn viên)
  async function load(force) {
    if (!force && cache) return cache;
    if (loading && !force) return loading;
    loading = (async () => {
      let list = null;
      try {
        const r = await Api.get("/api/guides");
        if (r.ok && Array.isArray(r.data.guides)) list = r.data.guides;
      } catch (e) { /* thử file mẫu */ }
      if (!list) {
        try {
          const res = await fetch("data/guides-seed.json");
          const j = res.ok ? await res.json() : [];
          list = Array.isArray(j) ? j : [];
        } catch (e) { list = []; }
      }
      cache = list; loading = null;
      return list;
    })();
    return loading;
  }

  function attach(ctx) {
    const sel = ctx.select, row = ctx.row, msg = ctx.msg;
    if (!sel) return null;

    async function refresh(force) {
      const needed = !!ctx.isNeeded();
      if (row) row.style.display = needed ? "" : "none";
      if (!needed) { sel.value = ""; if (msg) msg.textContent = ""; return; }

      const guides = await load(force);
      const date = ctx.getDate() || "";
      const days = ctx.getDays();
      const keep = sel.value;
      let freeCount = 0, droppedName = "";

      sel.innerHTML = "";
      const none = document.createElement("option");
      none.value = ""; none.textContent = "— Để công ty sắp xếp giúp —";
      sel.appendChild(none);

      guides.forEach(g => {
        const o = document.createElement("option");
        o.value = g.id;
        let label = g.name + " · " + (g.experience || 0) + " năm · " + (g.languages || []).join("/");
        if (g.status === "off") { o.disabled = true; label += " — tạm nghỉ"; }
        else if (date && !GuideAvailability.isFreeRange(g, date, days)) {
          o.disabled = true;
          const clash = GuideAvailability.busyInRange(g, date, days);
          label += " — bận " + (clash.length ? clash.map(dmy).join(", ") : "");
        } else freeCount++;
        o.textContent = label;
        sel.appendChild(o);
      });

      // đang chọn mà giờ không còn rảnh (đổi ngày) → trả về "Để công ty sắp xếp"
      const still = Array.from(sel.options).find(o => o.value === keep && !o.disabled);
      if (still) sel.value = keep;
      else if (keep) droppedName = (guides.find(g => g.id === keep) || {}).name || "Hướng dẫn viên đã chọn";

      if (!msg) return;
      if (droppedName) msg.textContent = "⚠️ " + droppedName + " không rảnh đủ " + days + " ngày từ " + dmy(date) + " nên đã bỏ chọn.";
      else if (!date) msg.textContent = "Chọn ngày khởi hành để xem hướng dẫn viên còn rảnh.";
      else if (!guides.length) msg.textContent = "Chưa tải được danh sách hướng dẫn viên – công ty sẽ sắp xếp giúp bạn.";
      else msg.textContent = freeCount + "/" + guides.length + " hướng dẫn viên rảnh " + days + " ngày từ " + dmy(date) + ".";
    }

    return { refresh, getValue: () => (sel.disabled || (row && row.style.display === "none")) ? "" : sel.value, getGuides: () => cache || [] };
  }

  return { attach, load };
})();
window.GuidePicker = GuidePicker;
