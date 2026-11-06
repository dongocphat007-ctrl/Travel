/* Thu ngân: xác nhận tiền cọc / đủ / thu nốt, chuyển khoản lệch, hoàn tiền, đóng sổ cuối ngày. Không có duyệt đơn, không có cấu hình, không có quản lý nhân viên. */
(() => {
  const { esc, money, dt, day, badge, pill, h, $, $$, get, post, ask, confirmBox, act, table, toast, fail, tabs } = Staff;
  let QUEUE = null;
  // 3.1: lọc theo mã đơn / khách (q), ngày đặt (date) và loại thanh toán (kind: deposit | full | final)
  const loadQueue = async (q, date, kind) => { QUEUE = await get("/api/cashier/queue" + (q || date || kind ? `?q=${encodeURIComponent(q || "")}&date=${encodeURIComponent(date || "")}&kind=${encodeURIComponent(kind || "")}` : "")); return QUEUE; };
  const KIND_LABEL = { deposit: "Nhận cọc 20%", full: "Nhận đủ 100%", final: "Thu nốt" };
  const PROBLEMS = [["short", "Chuyển thiếu"], ["excess", "Chuyển thừa"], ["wrong_content", "Sai nội dung chuyển khoản"], ["double", "Chuyển hai lần"]];

  async function confirmPayment(b, after) {
    const v = await ask(KIND_LABEL[b.dueKind] + " – " + b.payCode, [
      { name: "amount", label: "Số tiền thực nhận (₫)", type: "number", value: b.due, required: true, hint: `Số tiền cần thu: ${money(b.due)}. Phải nhập đúng số này; nếu khách chuyển lệch hãy bấm "Chuyển lệch".` },
      { name: "note", label: "Ghi chú (không bắt buộc)", type: "text" }], { submit: "Xác nhận đã nhận tiền", kind: "ok" });
    if (!v) return;
    await act(null, () => post(`/api/cashier/bookings/${b.id}/confirm`, { kind: b.dueKind, amount: Number(v.amount), note: v.note }), "Đã ghi nhận tiền. Đơn chuyển sang chờ admin duyệt.", after);
  }
  async function flag(b, after) {
    const v = await ask("Ghi nhận chuyển khoản lệch – " + b.payCode, [
      { name: "amount", label: "Số tiền thực nhận (₫)", type: "number", required: true, hint: `Cần thu ${money(b.due)}` },
      { name: "problem", label: "Loại sai lệch", type: "select", options: PROBLEMS },
      { name: "note", label: "Ghi chú / nội dung chuyển khoản", type: "textarea" },
      { name: "handoff", label: "Chuyển CSKH liên hệ khách", type: "checkbox", value: true }], { submit: "Ghi nhận" });
    if (!v) return;
    await act(null, () => post(`/api/cashier/bookings/${b.id}/discrepancy`, { amount: Number(v.amount), problem: v.problem, note: v.note, handoff: v.handoff }), "Đã ghi nhận, đơn chờ xử lý lệch.", after);
  }
  async function detail(b, after) {
    const r = await get(`/api/cashier/bookings/${b.id}`);
    const win = (QUEUE && QUEUE.undoMinutes ? QUEUE.undoMinutes : 15) * 60000;
    const canUndo = p => Date.now() - new Date(p.at).getTime() < win;
    await Staff.modal("Chi tiết đơn " + b.payCode, Parts.order(r.booking, { undo: canUndo }), [{ label: "Đóng" }], { wide: true, onOpen: ov => {
      const expPdf = ov.querySelector(`[data-exp-pdf]`);
      if (expPdf) expPdf.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(r.booking, "pdf");
      const expWord = ov.querySelector(`[data-exp-word]`);
      if (expWord) expWord.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(r.booking, "word");
      const expExcel = ov.querySelector(`[data-exp-excel]`);
      if (expExcel) expExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(r.booking, "excel");
      $$("[data-undo]", ov).forEach(btn => btn.onclick = async () => {
        const v = await ask("Hoàn tác khoản thu", [{ name: "reason", label: "Lý do hoàn tác", type: "textarea", required: true }], { kind: "bad", submit: "Hoàn tác" });
        if (!v) return;
        const ok = await act(null, () => post(`/api/cashier/bookings/${b.id}/undo`, { paymentId: btn.dataset.undo, reason: v.reason }), "Đã hoàn tác.", after);
        if (ok) ov.remove();
      });
    } });
  }

  function orderRows(list, el, reload, opts) {
    el.innerHTML = table([
      { t: "Mã đơn", html: b => `<b class="mono">${esc(b.payCode)}</b>`, sort: b => b.payCode },
      { t: "Khách", html: b => esc(b.customerName) + (b.needsAttention ? ' <span class="badge warn">lệch</span>' : "") },
      { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">Đi ${day(b.date)}</div>` },
      { t: "Cần thu", num: true, html: b => `<b>${money(b.due)}</b><div class="small muted">${esc(KIND_LABEL[b.dueKind])}</div>`, sort: b => b.due },
      { t: opts.dateLabel, html: b => opts.date(b) },
      { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn ok sm" data-a="ok" data-id="${esc(b.id)}">Đã nhận</button><button class="btn sm" data-a="flag" data-id="${esc(b.id)}">Chuyển lệch</button><button class="btn sm" data-a="view" data-id="${esc(b.id)}">Chi tiết</button></div>` }
    ], list, { empty: opts.empty, sortable: true });
    $$("button[data-a]", el).forEach(btn => btn.onclick = () => { const b = list.find(x => x.id === btn.dataset.id); ({ ok: confirmPayment, flag, view: detail })[btn.dataset.a](b, reload); });
  }

  const sections = [
    { id: "home", label: "Doanh thu theo ngày", icon: "💰", perm: "stats:view_cashier", async render(el) {
      let curDate = new Date().toISOString().slice(0, 10);
      async function loadDate(targetDate) {
        if (targetDate) curDate = targetDate;
        const res = await get(`/api/cashier/daily-stats?date=${encodeURIComponent(curDate)}`);
        const s = res.stats || {};
        const items = s.items || [];
        const recent = s.recentDays || [];

        el.innerHTML = `
          <div class="toolbar" style="gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
            <div class="row" style="gap:6px;align-items:center">
              <label for="cs-day" style="font-weight:600">📅 Chọn ngày:</label>
              <input type="date" id="cs-day" value="${esc(curDate)}" style="padding:6px 10px;font-weight:700">
              <button class="btn sm" id="cs-today">Hôm nay</button>
            </div>
            <div class="grow"></div>
            <div class="row" style="gap:6px;flex-wrap:wrap">
              <button class="btn ok sm" id="cs-add-rev">➕ Thêm doanh thu quầy</button>
              <button class="btn sm" id="cs-import">📥 Nhập Excel/CSV</button>
              <button class="btn sm" id="cs-exp-excel">📊 Xuất Excel</button>
              <button class="btn sm" id="cs-exp-word">📝 Xuất Word</button>
              <button class="btn sm" id="cs-exp-pdf">🖨️ In / PDF</button>
            </div>
          </div>

          ${recent.length ? `
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">
            ${recent.map(d => `
              <button class="pill-btn ${d.date === curDate ? "active" : ""}" data-pick-date="${esc(d.date)}" style="flex-shrink:0">
                ${day(d.date)}: <b>${money(d.net)}</b> (${d.transactionCount} GD)
              </button>
            `).join("")}
          </div>` : ""}

          <div class="note info">Số liệu ngày <b>${day(s.date || curDate)}</b> (giờ Việt Nam): gồm các giao dịch thanh toán trong hệ thống và doanh thu thu nhận tại quầy.</div>
          <div class="grid g4">
            <div class="kpi ok"><div class="l">Tổng đã thu</div><div class="v">${money(s.totalCollected)}</div><div class="s">${s.transactionCount || 0} giao dịch</div></div>
            <div class="kpi"><div class="l">Đã hoàn</div><div class="v">${money(s.totalRefunded)}</div></div>
            <div class="kpi"><div class="l">Thực thu (thu − hoàn)</div><div class="v">${money(s.net)}</div></div>
            <div class="kpi ${s.awaiting ? "warn" : ""}"><div class="l">Đơn chờ thu</div><div class="v">${s.awaiting || 0}</div></div>
            <div class="kpi ${s.balanceDue ? "warn" : ""}"><div class="l">Chờ thu nốt</div><div class="v">${s.balanceDue || 0}</div></div>
            <div class="kpi ${s.discrepancies ? "bad" : ""}"><div class="l">Chuyển khoản lệch</div><div class="v">${s.discrepancies || 0}</div></div>
            <div class="kpi ${s.refundsDue ? "warn" : ""}"><div class="l">Khoản hoàn cần chuyển</div><div class="v">${s.refundsDue || 0}</div></div>
          </div>

          <h3 style="margin:20px 0 10px;font-size:1.1rem;display:flex;align-items:center;justify-content:space-between">
            <span>Chi tiết các giao dịch trong ngày (${items.length})</span>
          </h3>
          <div id="cs-table-box"></div>
        `;

        const tblBox = $("#cs-table-box", el);
        tblBox.innerHTML = table([
          { t: "Mã GD / Đơn", html: r => `<b class="mono">${esc(r.payCode || r.id)}</b>` },
          { t: "Khách hàng", k: "customerName" },
          { t: "Tour / Dịch vụ", k: "tourName" },
          { t: "Loại thu", html: r => `<span class="badge ${r.isRefund ? "bad" : "ok"}">${esc(r.kindLabel || r.kind)}</span>` },
          { t: "Số tiền", num: true, html: r => `<b style="color:${r.isRefund ? "var(--bad)" : "var(--ok)"}">${r.isRefund ? "-" : "+"}${money(r.amount)}</b>` },
          { t: "Thời gian", html: r => dt(r.at) },
          { t: "Người thu", k: "byName" },
          { t: "Ghi chú", html: r => esc(r.note || "—") }
        ], items, { empty: "Chưa có giao dịch nào trong ngày này" });

        // Event listeners
        $("#cs-day", el).onchange = e => loadDate(e.target.value);
        $("#cs-today", el).onclick = () => loadDate(new Date().toISOString().slice(0, 10));
        $$("[data-pick-date]", el).forEach(btn => btn.onclick = () => loadDate(btn.dataset.pickDate));

        // Xuất file
        $("#cs-exp-excel", el).onclick = () => window.DataExportImport && window.DataExportImport.exportDailyRevenueReport({ date: curDate, rows: items, totals: s }, "excel");
        $("#cs-exp-word", el).onclick = () => window.DataExportImport && window.DataExportImport.exportDailyRevenueReport({ date: curDate, rows: items, totals: s }, "word");
        $("#cs-exp-pdf", el).onclick = () => window.DataExportImport && window.DataExportImport.exportDailyRevenueReport({ date: curDate, rows: items, totals: s }, "pdf");

        // Thêm doanh thu quầy
        $("#cs-add-rev", el).onclick = async () => {
          const v = await ask("Thêm khoản thu tại quầy ngày " + curDate, [
            { name: "amount", label: "Số tiền thu (₫)", type: "number", required: true },
            { name: "customerName", label: "Tên khách hàng / Tổ chức", type: "text", value: "Khách tại quầy" },
            { name: "tourName", label: "Tour / Dịch vụ", type: "text", value: "Bán vé / Thu trực tiếp" },
            { name: "kind", label: "Loại thu", type: "select", options: [["counter", "Thu trực tiếp tại quầy"], ["ticket", "Bán vé tại quầy"], ["service", "Dịch vụ phát sinh"], ["manual", "Thu thủ công khác"]] },
            { name: "payCode", label: "Mã phiếu thu / GD (để trống tự tạo)", type: "text" },
            { name: "note", label: "Ghi chú", type: "textarea" }
          ], { submit: "Ghi nhận doanh thu", kind: "ok" });
          if (!v) return;
          await act(null, () => post("/api/cashier/daily-revenue", { date: curDate, amount: Number(v.amount), customerName: v.customerName, tourName: v.tourName, kind: v.kind, payCode: v.payCode, note: v.note }), "Đã ghi nhận doanh thu.", () => loadDate(curDate));
        };

        // Nhập Excel/CSV
        $("#cs-import", el).onclick = () => {
          if (!window.DataExportImport) return;
          window.DataExportImport.importData({
            title: "Nhập danh sách giao dịch / sao kê ngày " + curDate,
            sampleHeaders: ["Số tiền", "Khách hàng", "Tour", "Loại", "Mã GD", "Ghi chú"],
            onConfirm: async (parsed) => {
              const rows = parsed.rows || [];
              const itemsToImport = rows.map(r => {
                let amt = 0;
                for (let i = 0; i < r.length; i++) {
                  const cleaned = String(r[i]).replace(/[^\d]/g, "");
                  if (cleaned && Number(cleaned) > 1000) { amt = Number(cleaned); break; }
                }
                return {
                  date: curDate,
                  amount: amt || 100000,
                  customerName: r[1] || r[0] || "Khách nhập file",
                  tourName: r[2] || "Tour du lịch",
                  kind: "imported",
                  payCode: r[4] || "",
                  note: r[5] || "Nhập từ tệp sao kê"
                };
              });
              await act(null, () => post("/api/cashier/daily-revenue/import", { items: itemsToImport }), `Đã nạp thành công ${itemsToImport.length} giao dịch.`, () => loadDate(curDate));
            }
          });
        };
      }
      await loadDate(curDate);
    } },
    { id: "collect", label: "Thu tiền", icon: "🧾", perm: "payment:view", async badge() { const q = await get("/api/cashier/queue"); return q.awaiting.length + q.balance.length; }, async render(el, ctx) {
      const filters = Parts.search(() => reload(), "Tìm mã đơn (TRAVEL…), tên khách", '<input type="date" id="fd" aria-label="Lọc theo ngày đặt" title="Ngày đặt"><select id="fk" aria-label="Lọc theo loại thanh toán" title="Loại thanh toán"><option value="">Mọi loại thanh toán</option><option value="deposit">Cọc 20%</option><option value="full">Đủ 100%</option><option value="final">Thu nốt</option></select>');
      const body = h("<div></div>"); el.append(filters, body);
      $$("#fd, #fk", filters).forEach(x => x.addEventListener("change", () => reload())); // ô ngày / loại thanh toán lọc ngay khi đổi
      async function reload() {
        const q = await loadQueue($("input", filters).value, $("#fd", filters).value, $("#fk", filters).value);
        const note = `<div class="note">Chỉ bấm <b>Đã nhận</b> khi tiền đã về tài khoản và <b>khớp mã đơn + đúng số tiền</b>. Sai lệch thì bấm <b>Chuyển lệch</b>. Bấm nhầm có thể <b>hoàn tác trong ${q.undoMinutes} phút</b> (mở Chi tiết).</div>`;
        const sel = tabs(body, [{ id: "a", label: "Chờ thu cọc / thu đủ", n: q.awaiting.length }, { id: "b", label: "Chờ thu nốt", n: q.balance.length }, { id: "r", label: "Vừa ghi nhận (hoàn tác được)", n: q.recent.length }], (id, box) => {
          box.innerHTML = note; const inner = h("<div></div>"); box.appendChild(inner);
          if (id === "a") orderRows(q.awaiting, inner, reload, { dateLabel: "Đặt lúc", date: b => dt(b.createdAt), empty: "Không có đơn nào chờ thanh toán" });
          else if (id === "b") orderRows(q.balance, inner, reload, { dateLabel: "Hạn thu nốt", date: b => day(b.balanceDueDate) + (b.balanceOverdue ? ' <span class="badge bad">quá hạn</span>' : ""), empty: "Không có đơn nào chờ thu nốt" });
          else inner.innerHTML = table([{ t: "Mã đơn", html: r => `<b class="mono">${esc(r.payCode)}</b>` }, { t: "Khách", k: "customerName" }, { t: "Loại", html: r => esc(Parts.KIND[r.kind] || r.kind) }, { t: "Số tiền", num: true, html: r => money(r.amount) }, { t: "Lúc", html: r => dt(r.at) },
            { t: "", html: r => `<button class="btn sm" data-undo="${esc(r.bookingId)}" data-p="${esc(r.paymentId)}">Hoàn tác</button>` }], q.recent, { empty: "Không có khoản nào trong thời gian còn hoàn tác" });
          $$("[data-undo]", inner).forEach(btn => btn.onclick = async () => { const v = await ask("Hoàn tác khoản thu", [{ name: "reason", label: "Lý do hoàn tác", type: "textarea", required: true }], { kind: "bad", submit: "Hoàn tác" }); if (v) act(null, () => post(`/api/cashier/bookings/${btn.dataset.undo}/undo`, { paymentId: btn.dataset.p, reason: v.reason }), "Đã hoàn tác.", reload); });
        }, body.dataset.tab); body.dataset.tab = "a";
      }
      await reload();
    } },
    { id: "discrepancy", label: "Chuyển khoản lệch", icon: "⚠️", perm: "payment:resolve_discrepancy", async badge() { return (await get("/api/cashier/queue")).discrepancies.length; }, async render(el) {
      async function reload() {
        const q = await loadQueue();
        el.innerHTML = `<div class="note">Các giao dịch sai lệch (thiếu / thừa / sai nội dung / chuyển hai lần). Số tiền chỉ được cộng vào đơn khi bạn chọn cách xử lý và ghi chú lý do.</div>` + table([
          { t: "Mã đơn", html: p => `<b class="mono">${esc(p.payCode || "—")}</b>` }, { t: "Số tiền", num: true, html: p => money(p.amount) }, { t: "Lý do", html: p => esc(p.reason || p.problem) + (p.contactNote ? `<div class="small" style="color:var(--ok)">CSKH: ${esc(p.contactNote)}</div>` : "") },
          { t: "Trạng thái", html: p => p.handoff ? pill("Đã chuyển CSKH", "info") : pill("Chờ xử lý", "warn") }, { t: "Lúc", html: p => dt(p.createdAt) },
          { t: "Thao tác", nowrap: true, cls: "actions", html: p => `<div class="act-btns"><button class="btn ok sm" data-a="acc" data-id="${esc(p.id)}">Ghi nhận tiền</button><button class="btn sm" data-a="hand" data-id="${esc(p.id)}">Chuyển CSKH</button><button class="btn sm" data-a="dis" data-id="${esc(p.id)}">Bỏ qua</button></div>` }], q.discrepancies, { empty: "Không có giao dịch lệch nào 🎉" });
        $$("button[data-a]", el).forEach(btn => btn.onclick = async () => {
          const p = q.discrepancies.find(x => x.id === btn.dataset.id), a = btn.dataset.a;
          if (a === "acc") {
            const v = await ask("Ghi nhận tiền cho đơn " + (p.payCode || ""), [
              p.bookingId ? null : { name: "bookingId", label: "Gắn vào đơn (mã đơn nội bộ bk_…)", required: true },
              { name: "kind", label: "Ghi nhận như", type: "select", options: [["deposit", "Tiền cọc 20%"], ["full", "Thanh toán đủ 100%"], ["final", "Thu nốt"]] },
              { name: "note", label: "Cách xử lý / lý do", type: "textarea", required: true }].filter(Boolean), { submit: "Ghi nhận", kind: "ok", intro: `Số tiền ghi nhận: <b>${money(p.amount)}</b> (đúng số thực nhận).` });
            if (!v) return;
            if (v.bookingId) await post(`/api/cashier/payments/${p.id}/attach`, { bookingId: v.bookingId }).catch(fail);
            act(null, () => post(`/api/cashier/payments/${p.id}/resolve`, { action: "accept_" + v.kind, note: v.note }), "Đã ghi nhận.", reload);
          } else if (a === "hand") { act(null, () => post(`/api/cashier/payments/${p.id}/resolve`, { action: "handoff" }), "Đã chuyển CSKH liên hệ khách.", reload); }
          else { const v = await ask("Bỏ qua giao dịch", [{ name: "note", label: "Lý do bỏ qua", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/cashier/payments/${p.id}/resolve`, { action: "dismiss", note: v.note }), "Đã bỏ qua.", reload); }
        });
      }
      await reload();
    } },
    { id: "extensions", label: "Thu gia hạn", icon: "➕", perm: "payment:confirm", async badge() { return (await get("/api/cashier/extensions")).items.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/cashier/extensions")).items;
        el.innerHTML = `<div class="note">Tiền gia hạn thu <b>riêng</b>, đủ 100%, theo mã <span class="mono">TRAVEL…-EXT1</span>. Không gộp vào tiền cọc hay tiền thu nốt của đơn gốc.</div>` + table([
          { t: "Mã chuyển khoản", html: b => `<b class="mono">${esc(b.extension.paymentCode)}</b>` }, { t: "Khách", k: "customerName" }, { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">${day(b.date)}</div>` },
          { t: "Thêm", html: b => esc(b.extension.days) + " ngày" }, { t: "Cần thu", num: true, html: b => `<b>${money(b.extension.amount)}</b>` },
          { t: "", html: b => `<button class="btn ok sm" data-c="${esc(b.id)}|${b.extension.no}|${b.extension.amount}">Đã nhận tiền</button>` }], list, { empty: "Không có khoản gia hạn nào chờ thu" });
        $$("[data-c]", el).forEach(btn => btn.onclick = async () => { const [id, no, amt] = btn.dataset.c.split("|"); if (await confirmBox("Xác nhận đã nhận " + money(Number(amt)), "Chỉ xác nhận khi tiền gia hạn đã về tài khoản.")) act(btn, () => post(`/api/cashier/extensions/${id}/${no}/confirm`, { amount: Number(amt) }), "Đã ghi nhận gia hạn.", reload); });
      }
      await reload();
    } },
    { id: "refunds", label: "Hoàn tiền", icon: "💸", perm: "payment:refund", async badge() { const q = await get("/api/cashier/queue"); return q && q.refunds ? q.refunds.length : 0; }, async render(el) {
      async function reload() {
        const res = await get("/api/cashier/refunds");
        const all = Array.isArray(res) ? res : (res && res.refunds) || [];
        tabs(el, [{ id: "approved", label: "Cần chuyển tiền", n: all.filter(r => r.status === "approved").length }, { id: "pending_approval", label: "Chờ admin duyệt", n: all.filter(r => r.status === "pending_approval").length }, { id: "paid", label: "Đã hoàn" }], (id, box) => {
          const list = all.filter(r => r.status === id);
          box.innerHTML = (id === "approved" ? '<div class="note">Chỉ chuyển tiền các khoản <b>admin đã duyệt</b>. Chuyển xong bấm <b>Đã hoàn tiền</b> để ghi sổ.</div>' : "") + table([
            { t: "Mã đơn", html: r => `<b class="mono">${esc(r.payCode)}</b>` }, { t: "Khách", k: "customerName" }, { t: "Nguồn", html: r => esc({ customer_cancel: "Khách hủy", admin_reject: "Admin từ chối", company_cancel: "Công ty hủy", complaint: "Đền bù khiếu nại", balance_overdue: "Quá hạn thu nốt" }[r.source] || r.source) },
            { t: "Số tiền hoàn", num: true, html: r => `<b>${money(r.amount)}</b>` }, { t: "Duyệt bởi", html: r => esc(r.approvedByName || r.approvedById || "—") }, { t: id === "paid" ? "Hoàn lúc" : "Yêu cầu lúc", html: r => dt(id === "paid" ? r.paidAt : r.requestedAt) },
            { t: "", html: r => id === "approved" ? `<button class="btn ok sm" data-pay="${esc(r.id)}">Đã hoàn tiền</button>` : "" }], list, { empty: "Không có khoản nào" });
          $$("[data-pay]", box).forEach(btn => btn.onclick = async () => { const r = list.find(x => x.id === btn.dataset.pay); const v = await ask("Xác nhận đã hoàn " + money(r.amount), [{ name: "note", label: "Mã giao dịch / ghi chú", type: "text" }], { submit: "Đã hoàn tiền", kind: "ok" }); if (v) act(null, () => post(`/api/cashier/refunds/${r.id}/pay`, { note: v.note }), "Đã ghi sổ hoàn tiền.", reload); });
        }, "approved");
      }
      await reload();
    } },
    { id: "guide-fees", label: "Thù lao HDV", icon: "🧑‍✈️", perm: "guide_fee:pay", async badge() { return (await get("/api/cashier/guide-fees")).pending.reduce((n, g) => n + g.items.length, 0); }, async render(el) {
      async function reload() {
        const r = await get("/api/cashier/guide-fees");
        const cnt = r.pending.reduce((n, g) => n + g.items.length, 0);
        tabs(el, [{ id: "p", label: "Chờ chi", n: cnt }, { id: "d", label: "Đã chi" }], (id, box) => {
          if (id === "d") { box.innerHTML = table([{ t: "Chi lúc", html: i => dt(i.paidAt), sort: i => i.paidAt }, { t: "HDV", k: "guideName" }, { t: "Tour", k: "tourName" }, { t: "Mã", html: i => `<span class="mono">${esc(i.payCode)}</span>` }, { t: "Số tiền", num: true, html: i => money(i.fee) }, { t: "Người chi", html: i => esc(i.paidByName || "—") }], r.paid, { sortable: true, empty: "Chưa chi khoản nào" }); return; }
          box.innerHTML = `<div class="note">Chi thù lao cho HDV sau khi tour <b>đã hoàn thành</b>. Chuyển tiền xong bấm <b>Đã chi</b> để ghi sổ; HDV sẽ thấy khoản này ở mục Thu nhập. Tổng đang chờ: <b>${money(r.pendingTotal)}</b>.</div>` + (r.pending.length ? r.pending.map(g => `<div class="card"><div class="card-header-acts"><h2>${esc(g.guideName)} <span class="muted small">· ${g.items.length} tour · ${money(g.total)}</span></h2><button class="btn ok sm" data-all="${esc(g.guideId)}">Đã chi tất cả (${money(g.total)})</button></div>`
            + table([{ t: "Hoàn thành", html: i => day(i.completedAt) }, { t: "Tour", k: "tourName" }, { t: "Mã", html: i => `<span class="mono">${esc(i.payCode)}</span>` }, { t: "Giá tour", num: true, html: i => money(i.price || 0) }, { t: "Thù lao (20%)", num: true, html: i => `<b>${money(i.fee)}</b>` }, { t: "", html: i => `<button class="btn sm" data-one="${esc(i.id)}">Đã chi</button>` }], g.items) + "</div>").join("") : '<div class="empty">Không có khoản thù lao nào đang chờ chi.</div>');
          const pay = async (ids, label) => { if (await confirmBox("Xác nhận đã chi thù lao", label)) act(null, () => post("/api/cashier/guide-fees/pay", { ids }), "Đã ghi sổ chi thù lao.", reload); };
          $$("[data-one]", box).forEach(b => b.onclick = () => { const it = r.pending.flatMap(g => g.items).find(x => x.id === b.dataset.one); pay([it.id], `Đã chuyển <b>${money(it.fee)}</b> cho ${esc(it.guideName)} (đơn ${esc(it.payCode)})?`); });
          $$("[data-all]", box).forEach(b => b.onclick = () => { const g = r.pending.find(x => x.guideId === b.dataset.all); pay(g.items.map(x => x.id), `Đã chuyển tổng <b>${money(g.total)}</b> (${g.items.length} tour) cho ${esc(g.guideName)}?`); });
        }, "p");
      }
      await reload();
    } },
    { id: "withdrawals", label: "Duyệt rút tiền", icon: "💳", perm: "payment:confirm", async badge() { const res = await get("/api/cashier/withdrawals?status=pending"); const list = Array.isArray(res) ? res : (res && res.withdrawals) || []; return list.length; }, async render(el) {
      async function reload() {
        const res = await get("/api/cashier/withdrawals");
        const all = Array.isArray(res) ? res : (res && res.withdrawals) || [];
        tabs(el, [
          { id: "pending", label: "Chờ duyệt chi", n: all.filter(w => w.status === "pending").length },
          { id: "approved", label: "Đã chuyển tiền", n: all.filter(w => w.status === "approved").length },
          { id: "rejected", label: "Bị từ chối", n: all.filter(w => w.status === "rejected").length }
        ], (statusId, box) => {
          const list = all.filter(w => w.status === statusId);
          box.innerHTML = (statusId === "pending" ? '<div class="note">Kiểm tra thông tin tài khoản ngân hàng và chuyển khoản cho người nhận. Sau khi chuyển xong bấm <b>Đã chuyển tiền</b> để hoàn tất và thông báo cho người dùng.</div>' : "")
            + table([
              { t: "Thời gian", html: w => dt(w.createdAt), sort: w => w.createdAt },
              { t: "Người rút", html: w => `<b>${esc(w.userName)}</b><div class="small muted">${esc(w.userEmail)}</div>` },
              { t: "Số tiền", num: true, html: w => `<b>${money(w.amount)}</b>` },
              { t: "Ngân hàng", html: w => `<b>${esc(w.bankName)}</b>` },
              { t: "Số tài khoản", html: w => `<span class="mono">${esc(w.accountNumber)}</span>` },
              { t: "Chủ thẻ", html: w => `<b>${esc(w.accountHolder)}</b>` },
              { t: "Ghi chú", html: w => esc(w.note || "—") + (w.rejectReason ? `<div class="small bad">Từ chối: ${esc(w.rejectReason)}</div>` : "") + (w.adminNote ? `<div class="small ok">Ghi chú: ${esc(w.adminNote)}</div>` : "") },
              { t: "Thao tác", nowrap: true, cls: "actions", html: w => statusId === "pending" ? `<div class="act-btns"><button class="btn ok sm" data-appr="${esc(w.id)}">Đã chuyển tiền</button><button class="btn bad sm" data-rej="${esc(w.id)}">Từ chối</button></div>` : `<span class="muted small">${esc(w.handledByName || "—")}</span>` }
            ], list, { empty: "Không có yêu cầu rút tiền nào" });

          $$("[data-appr]", box).forEach(btn => btn.onclick = async () => {
            const w = list.find(x => x.id === btn.dataset.appr);
            const v = await ask("Xác nhận đã chuyển " + money(w.amount), [{ name: "note", label: "Mã giao dịch / Ghi chú chuyển tiền", type: "text" }], { submit: "Duyệt chi", kind: "ok" });
            if (v) act(null, () => post(`/api/cashier/withdrawals/${w.id}/approve`, { note: v.note }), "Đã duyệt chuyển tiền.", reload);
          });

          $$("[data-rej]", box).forEach(btn => btn.onclick = async () => {
            const w = list.find(x => x.id === btn.dataset.rej);
            const v = await ask("Từ chối yêu cầu rút tiền", [{ name: "reason", label: "Lý do từ chối (hoàn lại tiền vào ví)", type: "textarea", required: true }], { submit: "Từ chối", kind: "bad" });
            if (v) act(null, () => post(`/api/cashier/withdrawals/${w.id}/reject`, { reason: v.reason }), "Đã từ chối và hoàn tiền.", reload);
          });
        }, "pending");
      }
      await reload();
    } },
    { id: "reconcile", label: "Đóng sổ cuối ngày", icon: "📒", perm: "reconcile:create", async render(el) {
      async function reload() {
        const r = await get("/api/cashier/reconcile"), t = r.today;
        el.innerHTML = `<div class="card"><h2>Đóng sổ ngày ${day(t.date)}</h2><div class="grid g4"><div class="kpi"><div class="l">Tổng thu hệ thống ghi nhận</div><div class="v">${money(t.totalCollected)}</div></div><div class="kpi"><div class="l">Đã hoàn</div><div class="v">${money(t.totalRefunded)}</div></div><div class="kpi ok"><div class="l">Thực thu</div><div class="v">${money(t.net)}</div><div class="s">${t.transactionCount} giao dịch</div></div></div>
          <p class="muted small">Đối chiếu với sao kê ngân hàng. Nếu lệch bắt buộc giải trình; admin sẽ duyệt – bạn không tự duyệt được bản của mình.</p>
          <div class="row"><div style="min-width:200px"><label>Ngày</label><input type="date" id="rd" value="${t.date}" max="${t.date}"></div><div style="min-width:220px"><label>Tổng trên sao kê (₫)</label><input type="number" id="rb" min="0"></div><div class="grow"><label>Ghi chú / giải trình chênh lệch</label><input id="rn"></div></div>
          <div id="rdiff" class="small" style="margin:8px 0"></div><button class="btn primary" id="rs">Gửi bản đóng sổ</button></div>
          <div class="card"><h2>Các bản đã tạo</h2>${table([{ t: "Ngày", html: x => day(x.date), sort: x => x.date }, { t: "Thực thu", num: true, html: x => money(x.netTotal) }, { t: "Sao kê", num: true, html: x => money(x.bankStatementTotal) }, { t: "Chênh lệch", num: true, html: x => x.discrepancy ? `<b style="color:var(--bad)">${money(x.discrepancy)}</b>` : "0 ₫" },
            { t: "Trạng thái", html: x => pill({ pending_approval: "Chờ admin duyệt", approved: "Đã duyệt", rejected: "Bị từ chối" }[x.status] || x.status, x.status === "approved" ? "ok" : x.status === "rejected" ? "bad" : "warn") }, { t: "Ghi chú", html: x => esc(x.note) + (x.approveNote ? `<div class="small muted">Admin: ${esc(x.approveNote)}</div>` : "") }], r.reconciliations, { empty: "Chưa có bản đóng sổ" })}</div>`;
        const upd = async () => { const d = $("#rd", el).value; if (!d) return; const tt = (await get("/api/cashier/reconcile?date=" + d)).today; const b = $("#rb", el).value; $("#rdiff", el).innerHTML = b === "" ? "" : `Thực thu hệ thống: <b>${money(tt.net)}</b> · Chênh lệch so với sao kê: <b style="color:${Number(b) === tt.net ? "var(--ok)" : "var(--bad)"}">${money(Number(b) - tt.net)}</b>`; };
        $("#rb", el).oninput = upd; $("#rd", el).onchange = upd;
        $("#rs", el).onclick = e => act(e.target, () => post("/api/cashier/reconcile", { date: $("#rd", el).value, bankStatementTotal: Number($("#rb", el).value), note: $("#rn", el).value }), "Đã gửi bản đóng sổ chờ admin duyệt.", reload);
      }
      await reload();
    } }
  ];
  Staff.boot({ roles: ["cashier"], title: "Thu ngân", sections });
})();
