/**
 * order-stats.js – Tab "📊 Thống kê" trong Admin: tính từ JSON đơn đang lưu (localStorage "travel_bookings"),
 * và nút tải về orders.json. Không cần server.
 */
const OrderStats = (() => {
  const money = n => new Intl.NumberFormat("vi-VN").format(Math.round(+n || 0)) + " ₫";
  const e = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Số tiền admin đã xác nhận thu
  const collected = b => {
    if (b.status === "cancelled") return 0;
    if (b.finalPaid) return (+b.price || 0) + Math.round((+b.overtimeHours || 0) * (window.GUIDE_EXTRA_HOUR_FEE || 0));
    if (b.depositPaid) return b.fullPaid ? (+b.price || 0) : (+b.deposit || 0);
    return 0;
  };

  function compute(list) {
    const live = list.filter(b => b.status !== "cancelled");
    const group = (arr, keyFn) => {
      const m = {};
      for (const b of arr) {
        const k = keyFn(b) || "(không rõ)";
        m[k] = m[k] || { orders: 0, revenue: 0, collected: 0 };
        m[k].orders++; m[k].revenue += +b.price || 0; m[k].collected += collected(b);
      }
      return m;
    };
    return {
      total: list.length,
      pending: list.filter(b => b.status === "pending").length,
      confirmed: list.filter(b => b.status === "confirmed").length,
      cancelled: list.filter(b => b.status === "cancelled").length,
      revenue: live.reduce((s, b) => s + (+b.price || 0), 0),
      collected: list.reduce((s, b) => s + collected(b), 0),
      awaiting: live.filter(b => !b.depositPaid).length,
      claimed: live.filter(b => b.claims && Object.keys(b.claims).length && !b.depositPaid).length,
      deposit: live.filter(b => b.payChoice === "deposit").length,
      full: live.filter(b => b.payChoice === "full").length,
      pax: live.reduce((s, b) => s + (+b.pax || 0), 0),
      byTour: group(live, b => b.tourName),
      byMonth: group(live, b => (b.date || "").slice(0, 7)),
      byDay: group(list, b => (b.createdAt || "").slice(0, 10))
    };
  }

  const table = (title, obj, sortKey) => {
    const rows = Object.entries(obj).sort((a, b) => sortKey ? b[0].localeCompare(a[0]) : b[1].orders - a[1].orders);
    return `<h3 style="margin:18px 0 8px">${title}</h3>
      <div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Mục</th><th>Số đơn</th><th>Doanh thu dự kiến</th><th>Đã thu</th></tr></thead>
        <tbody>${rows.map(([k, v]) => `<tr><td>${e(k)}</td><td>${v.orders}</td><td>${money(v.revenue)}</td><td>${money(v.collected)}</td></tr>`).join("") || `<tr><td colspan="4">Chưa có dữ liệu</td></tr>`}</tbody>
      </table></div>`;
  };

  function renderTab(bookings) {
    const s = compute(bookings || []);
    const card = (icon, num, lbl, sub) => `<div class="adm-stat-card"><div class="adm-stat-icon" style="background:#e0f2f9">${icon}</div>
      <div class="adm-stat-body"><div class="adm-stat-num" style="font-size:1.2rem">${num}</div><div class="adm-stat-lbl">${lbl}</div><div class="adm-stat-sub">${sub}</div></div></div>`;
    return `
      <div class="adm-stats" style="margin-bottom:8px">
        ${card("📋", s.total, "Tổng đơn", `${s.pending} chờ · ${s.confirmed} đã nhận · ${s.cancelled} hủy`)}
        ${card("💰", money(s.revenue), "Doanh thu dự kiến", "không tính đơn hủy")}
        ${card("✅", money(s.collected), "Đã thu", `${s.claimed} đơn khách báo đã chuyển, chờ đối chiếu`)}
        ${card("💳", `${s.deposit} cọc / ${s.full} đủ`, "Khách chọn", `${s.pax} khách`)}
      </div>
      <div id="adm-pay-root"></div>
      <button class="btn btn-ghost" onclick="OrderStats.linkFile()">📁 ${localStorage.getItem("travel_order_file_name") ? "Đổi file orders.json (đang ghi: " + e(localStorage.getItem("travel_order_file_name")) + ")" : "Liên kết file orders.json (tự cập nhật)"}</button>
      <button class="btn btn-ghost" onclick="OrderStats.exportJson()">⬇️ Tải orders.json</button>
      ${table("Theo tour", s.byTour)}
      ${table("Theo tháng khởi hành", s.byMonth, true)}
      ${table("Theo ngày đặt", s.byDay, true)}`;
  }

  const readOrders = () => { try { return JSON.parse(localStorage.getItem("travel_bookings") || "[]") || []; } catch { return []; } };
  const payload = () => { const list = readOrders(); return JSON.stringify({ exportedAt: new Date().toISOString(), stats: compute(list), orders: list }, null, 2); };

  // Tải file orders.json về máy (thủ công)
  function exportJson() {
    const blob = new Blob([payload()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "orders.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ── Liên kết 1 file orders.json trên máy: chọn 1 lần, sau đó mỗi thay đổi đơn tự ghi vào file (Chrome / Edge) ──
  const FILE_NAME_KEY = "travel_order_file_name";
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open("travel_file_db", 1); r.onupgradeneeded = () => r.result.createObjectStore("h"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const getHandle = async () => { try { const db = await idb(); return await new Promise(res => { const q = db.transaction("h").objectStore("h").get("orders"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } };
  const setHandle = async h => { const db = await idb(); return new Promise(res => { const t = db.transaction("h", "readwrite"); t.objectStore("h").put(h, "orders"); t.oncomplete = () => res(); }); };

  // interactive=true: được phép hỏi quyền ghi (khi đang trong thao tác bấm nút của người dùng)
  async function autoWrite(interactive) {
    try {
      const h = await getHandle(); if (!h) return false;
      let perm = await h.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        if (!interactive) return false;
        perm = await h.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") return false;
      }
      const w = await h.createWritable(); await w.write(payload()); await w.close();
      return true;
    } catch (e) { console.warn("Ghi orders.json lỗi:", e.message); return false; }
  }

  async function linkFile() {
    if (!("showSaveFilePicker" in window)) { alert("Trình duyệt này chưa hỗ trợ ghi file tự động. Hãy dùng Chrome hoặc Edge, hoặc bấm \"Tải orders.json\"."); return; }
    try {
      const h = await window.showSaveFilePicker({ suggestedName: "orders.json", types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
      await setHandle(h);
      localStorage.setItem(FILE_NAME_KEY, h.name);
      await autoWrite(true);
      window.Admin?.render?.();
    } catch (e) { if (e.name !== "AbortError") alert("Không liên kết được file: " + e.message); }
  }


  // ───────── Thanh toán thật từ server (webhook ngân hàng): GET /api/admin/payments, /stats; POST /manual ─────────
  const PSTATUS = { matched: ["Đã khớp", "adm-status-confirmed"], mismatch: ["Lệch tiền", "adm-status-pending"], unmatched: ["Không khớp mã", "adm-status-pending"], pending: ["Chờ xử lý", "adm-status-pending"] };
  const fmtTime = iso => iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
  const payNote = m => `<div class="p0-note">${m}</div>`;
  const pToast = (m, t) => (typeof showToast === "function" ? showToast(m, t || "info") : alert(m));

  async function mountPayments() {
    const el = document.getElementById("adm-pay-root");
    if (!el || !window.Api) return;
    el.innerHTML = '<p class="p0-load">Đang tải thanh toán từ máy chủ…</p>';
    let st, ls;
    try { [st, ls] = await Promise.all([Api.get("/api/admin/payments/stats"), Api.get("/api/admin/payments")]); }
    catch (err) { el.innerHTML = payNote("⚠️ Không kết nối được máy chủ nên chưa có số liệu tiền thật. Bảng bên dưới đang tính từ dữ liệu trên trình duyệt."); return; }
    if (st.status === 401 || st.status === 403) { el.innerHTML = payNote("⚠️ Cần đăng nhập bằng tài khoản Admin <b>trên máy chủ</b> (đăng xuất rồi đăng nhập lại) để xem tiền thật từ ngân hàng."); return; }
    if (!st.ok) { el.innerHTML = payNote(e(st.data.msg || "Không tải được thống kê thanh toán")); return; }

    const s = st.data, payments = ls.data.payments || [], bk = s.bookings || {};
    const bad = payments.filter(p => p.status === "mismatch" || p.status === "unmatched");
    const card = (icon, num, lbl, sub) => `<div class="adm-stat-card"><div class="adm-stat-icon" style="background:#e0f2f9">${icon}</div>
      <div class="adm-stat-body"><div class="adm-stat-num" style="font-size:1.2rem">${num}</div><div class="adm-stat-lbl">${lbl}</div><div class="adm-stat-sub">${sub}</div></div></div>`;
    const rowsOf = (arr, key) => arr.slice().reverse().map(r => `<tr><td>${e(r[key])}</td><td>${r.count}</td><td>${money(r.amount)}</td></tr>`).join("") || '<tr><td colspan="3">Chưa có giao dịch khớp</td></tr>';
    const simple = (title, arr, key, head) => `<h3 style="margin:18px 0 8px">${title}</h3><div class="adm-table-wrap"><table class="adm-table">
      <thead><tr><th>${head}</th><th>Số giao dịch</th><th>Tiền thực nhận</th></tr></thead><tbody>${rowsOf(arr || [], key)}</tbody></table></div>`;

    const openIds = readOrders().filter(b => b.status !== "cancelled").map(b => b.id);
    const mismatchRows = bad.map(p => `<tr data-pid="${e(p.id)}">
        <td>${fmtTime(p.createdAt)}</td><td>${money(p.amount)}</td>
        <td><small>${e(p.content || "—")}</small></td>
        <td><span class="adm-status ${(PSTATUS[p.status] || ["", ""])[1]}">${(PSTATUS[p.status] || [p.status, ""])[0]}</span><div class="adm-tour-dest">${e(p.reason || "")}</div></td>
        <td><input class="adm-input" list="adm-pay-bk" data-f="bookingId" value="${e(p.bookingId || "")}" placeholder="Mã đơn (bk_…)" style="min-width:130px"></td>
        <td><select class="adm-input" data-f="kind"><option value="deposit">Tiền cọc</option><option value="full">Trả đủ</option><option value="final">Phần còn lại</option></select></td>
        <td><button class="adm-btn-sm adm-btn-confirm" data-act="manual">Xác nhận tay</button></td></tr>`).join("");

    el.innerHTML = `
      <div class="adm-stats" style="margin-bottom:8px">
        ${card("🏦", money(s.received), "Thực nhận từ ngân hàng", "tổng giao dịch đã khớp đơn (webhook + xác nhận tay)")}
        ${card("⚠️", s.mismatchCount || 0, "Giao dịch lệch", s.mismatchCount ? "cần Admin xác nhận tay bên dưới" : "không có giao dịch cần xử lý")}
        ${card("🧾", `${bk.deposited || 0} đã cọc / ${bk.pendingPayment || 0} chờ`, "Đơn theo thanh toán", `${bk.cancelled || 0} đơn đã hủy`)}
      </div>
      ${bad.length ? `<h3 style="margin:18px 0 8px">⚠️ Giao dịch lệch / không khớp mã (${bad.length})</h3>
        <datalist id="adm-pay-bk">${openIds.map(i => `<option value="${e(i)}">`).join("")}</datalist>
        <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Nội dung CK</th><th>Lý do</th><th>Gắn vào đơn</th><th>Loại</th><th></th></tr></thead><tbody>${mismatchRows}</tbody></table></div>` : ""}
      ${simple("Tiền thực nhận theo ngày", s.byDay, "date", "Ngày")}
      ${simple("Tiền thực nhận theo tháng", s.byMonth, "month", "Tháng")}`;

    el.querySelectorAll('[data-act="manual"]').forEach(btn => btn.addEventListener("click", async () => {
      const tr = btn.closest("tr"), p = bad.find(x => x.id === tr.dataset.pid);
      const bookingId = tr.querySelector('[data-f="bookingId"]').value.trim(), kind = tr.querySelector('[data-f="kind"]').value;
      if (!bookingId) { pToast("Nhập mã đơn cần gắn giao dịch này", "error"); return; }
      if (!confirm(`Xác nhận giao dịch ${money(p.amount)} cho đơn ${bookingId} (${kind})?`)) return;
      btn.disabled = true;
      try {
        const r = await Api.post("/api/admin/payments/manual", { bookingId, kind, amount: p.amount, paymentId: p.id, note: "Admin xác nhận tay giao dịch " + (p.status === "unmatched" ? "không khớp mã" : "lệch tiền") });
        if (!r.ok) { pToast(r.data.msg || r.data.message || "Xác nhận thất bại", "error"); btn.disabled = false; return; }
        pToast("✅ Đã xác nhận giao dịch", "success");
        await Api.refreshBookings?.(true);
        window.Admin?.render?.();
      } catch (err) { pToast("Không kết nối được máy chủ", "error"); btn.disabled = false; }
    }));
  }

  return { renderTab, exportJson, compute, autoWrite, linkFile, mountPayments };
})();
window.OrderStats = OrderStats;
