/* CSKH: khiếu nại, danh sách chờ, sai lệch thanh toán (liên hệ khách), hỗ trợ đổi ngày. CCCD luôn bị che; không thu tiền, không duyệt hoàn (chỉ đề xuất). */
(() => {
  const { esc, money, dt, day, pill, h, $, $$, get, post, ask, act, table, fail, tabs } = Staff;
  const ST = { open: ["Mới", "bad"], in_progress: ["Đang xử lý", "warn"], resolved: ["Đã giải quyết", "ok"], closed: ["Đã đóng", ""] };
  const viewOrder = id => Parts.showOrder(`/api/support/bookings/${encodeURIComponent(id)}`, "Chi tiết đơn").catch(fail);

  async function openComplaint(c, after, ctx) {
    const msgs = (c.messages || []).map(m => `<div class="msg ${m.internal ? "internal" : ""}" style="margin:6px 0;padding:8px 10px;border-radius:8px;background:${m.internal ? "#fff7e0" : m.from === "support" ? "#e8f4ff" : "#f2f2f2"};color:#1b2430"><div class="small muted">${m.from === "support" ? esc(m.byName || "CSKH") : "Khách"} · ${dt(m.at)}${m.internal ? " · <b>nội bộ</b>" : ""}</div>${esc(m.text)}</div>`).join("");
    const closed = c.status === "resolved" || c.status === "closed";
    const body = `<dl class="kv"><dt>Đơn</dt><dd><a href="#" id="vo" class="mono">${esc(c.payCode)}</a> – ${esc(c.tourName)}</dd><dt>Khách</dt><dd>${esc(c.customerName)} · ${esc(c.phone)} · ${esc(c.email)}</dd><dt>Tiêu đề</dt><dd><b>${esc(c.title)}</b></dd><dt>Nội dung</dt><dd>${esc(c.content)}</dd>
      <dt>Hạn phản hồi</dt><dd>${dt(c.dueAt)}${c.overdue ? ' <span class="badge bad">quá hạn</span>' : ""}</dd><dt>Trạng thái</dt><dd>${pill(...(ST[c.status] || [c.status, ""]))}${c.assigneeName ? " · " + esc(c.assigneeName) : ""}</dd></dl><h3>Trao đổi</h3>${msgs || '<div class="muted">Chưa có trao đổi.</div>'}
      ${closed ? "" : `<label>Nội dung trả lời</label><textarea id="rt" rows="3"></textarea><label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" id="ri" style="width:auto"> Ghi chú nội bộ (khách không thấy)</label>`}`;
    const buttons = [{ label: "Đóng" }];
    if (!closed) {
      if (c.status === "open") buttons.push({ label: "Nhận xử lý", value: "take" });
      buttons.push({ label: "Gửi", kind: "primary", value: "reply" });
      if (ctx.has("complaint:refund_propose")) buttons.push({ label: "Đề xuất hoàn tiền", value: "refund" });
      buttons.push({ label: "Giải quyết xong", kind: "ok", value: "resolve" });
    }
    const r = await Staff.modal("Khiếu nại", body, buttons, { wide: true, sticky: true, onOpen: ov => { const a = $("#vo", ov); if (a) a.onclick = e => { e.preventDefault(); viewOrder(c.bookingId); }; } });
    if (!r || r === true) return;
    const txt = () => (($("#rt") || {}).value || "").trim();
    if (r === "take") return act(null, () => post(`/api/support/complaints/${c.id}/take`), "Đã nhận xử lý.", after);
    if (r === "reply") { const t = txt(); if (!t) return Staff.toast("Hãy nhập nội dung trả lời", "bad"); return act(null, () => post(`/api/support/complaints/${c.id}/reply`, { text: t, internal: !!($("#ri") || {}).checked }), "Đã gửi.", after); }
    if (r === "refund") { const v = await ask("Đề xuất hoàn tiền đền bù", [{ name: "amount", label: "Số tiền đề xuất (₫)", type: "number", required: true, hint: "Admin sẽ duyệt, Thu ngân chuyển tiền. Không đổi trạng thái đơn." }, { name: "reason", label: "Lý do", type: "textarea", required: true }]); if (v) act(null, () => post(`/api/support/complaints/${c.id}/propose-refund`, { amount: Number(v.amount), reason: v.reason }), "Đã gửi đề xuất cho Admin.", after); return; }
    if (r === "resolve") { const v = await ask("Giải quyết khiếu nại", [{ name: "note", label: "Kết quả xử lý (gửi khách)", type: "textarea", required: true }], { kind: "ok" }); if (v) act(null, () => post(`/api/support/complaints/${c.id}/resolve`, { note: v.note }), "Đã đóng khiếu nại.", after); }
  }

  const sections = [
    { id: "home", label: "Tổng quan", icon: "📈", perm: "stats:view_support", async render(el) {
      const s = (await get("/api/support/stats")).stats, k = (l, v, c, sub) => `<div class="kpi ${v && c ? c : ""}"><div class="l">${l}</div><div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
      el.innerHTML = `<div class="grid g4">${k("Khiếu nại mới", s.open, "bad")}${k("Đang xử lý", s.inProgress, "warn")}${k("Đã giải quyết", s.resolved, "ok")}${k("Quá hạn phản hồi", s.overdue, "bad")}${k("Thời gian xử lý TB", s.avgResolveHours + " giờ")}${k("Khách chờ chỗ", s.waitlist)}${k("Sai lệch thanh toán", s.paymentIssues, "warn")}</div>`;
    } },
    Customers.section(),
    { id: "complaints", label: "Khiếu nại", icon: "📣", perm: "complaint:process", async badge() { const res = await get("/api/support/complaints?status=open"); const list = Array.isArray(res) ? res : (res && res.complaints) || []; return list.length; }, async render(el, ctx) {
      async function reload() {
        const res = await get("/api/support/complaints");
        const all = Array.isArray(res) ? res : (res && res.complaints) || [];
        tabs(el, [{ id: "open", label: "Mới", n: all.filter(c => c.status === "open").length }, { id: "in_progress", label: "Đang xử lý", n: all.filter(c => c.status === "in_progress").length }, { id: "resolved", label: "Đã giải quyết" }], (id, box) => {
          const list = all.filter(c => c.status === id || (id === "resolved" && c.status === "closed"));
          box.innerHTML = table([{ t: "Gửi lúc", html: c => dt(c.createdAt), sort: c => c.createdAt }, { t: "Đơn", html: c => `<b class="mono">${esc(c.payCode)}</b><div class="small muted">${esc(c.tourName)}</div>` }, { t: "Khách", k: "customerName" }, { t: "Tiêu đề", k: "title" }, { t: "Hạn", html: c => dt(c.dueAt) + (c.overdue ? ' <span class="badge bad">quá hạn</span>' : "") }, { t: "Phụ trách", html: c => esc(c.assigneeName || "—") },
            { t: "", html: c => `<button class="btn sm" data-o="${esc(c.id)}">Mở</button>` }], list, { sortable: true, empty: "Không có khiếu nại" });
          $$("[data-o]", box).forEach(b => b.onclick = () => openComplaint(list.find(x => x.id === b.dataset.o), reload, ctx));
        }, "open");
      }
      await reload();
    } },
    { id: "waitlist", label: "Danh sách chờ", icon: "⏳", perm: "waitlist:manage", async badge() { return (await get("/api/support/waitlist?status=waiting")).waitlist.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/support/waitlist")).waitlist;
        el.innerHTML = `<div class="note">Khi chuyến có chỗ trống, hệ thống tự báo khách; CSKH cũng có thể báo tay hoặc đóng mục.</div>` + table([{ t: "Khách", html: w => esc(w.name) + `<div class="small muted">${esc(w.phone)} · ${esc(w.email)}</div>` }, { t: "Tour", html: w => `${esc(w.tourName)}<div class="small muted">Đi ${day(w.date)}</div>` }, { t: "Số khách", num: true, k: "pax" }, { t: "Đăng ký", html: w => dt(w.createdAt) },
          { t: "Trạng thái", html: w => pill({ waiting: "Đang chờ", notified: "Đã báo", closed: "Đã đóng" }[w.status] || w.status, w.status === "waiting" ? "warn" : w.status === "notified" ? "ok" : "") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: w => w.status === "closed" ? "" : `<div class="act-btns">${w.status === "waiting" ? `<button class="btn ok sm" data-n="${esc(w.id)}">Báo có chỗ</button>` : ""}<button class="btn sm" data-c="${esc(w.id)}">Đóng</button></div>` }], list, { empty: "Danh sách chờ trống" });
        $$("[data-n]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/support/waitlist/${b.dataset.n}`, { action: "notify" }), "Đã báo khách.", reload));
        $$("[data-c]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/support/waitlist/${b.dataset.c}`, { action: "close" }), "Đã đóng.", reload));
      }
      await reload();
    } },
    { id: "payment-issues", label: "Sai lệch thanh toán", icon: "💳", perm: "support:assist_customer", async badge() { return (await get("/api/support/payment-issues")).issues.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/support/payment-issues")).issues;
        el.innerHTML = `<div class="note">Thu ngân chuyển sang đây các giao dịch lệch để liên hệ khách. CSKH không ghi nhận tiền; ghi lại kết quả liên hệ để Thu ngân xử lý.</div>` + table([{ t: "Mã đơn", html: p => `<b class="mono">${esc(p.payCode || "—")}</b>` }, { t: "Số tiền", num: true, html: p => money(p.amount) }, { t: "Vấn đề", html: p => esc(p.reason || p.problem) }, { t: "Lúc", html: p => dt(p.createdAt) }, { t: "Đã liên hệ", html: p => esc(p.contactNote) || "—" },
          { t: "Thao tác", nowrap: true, cls: "actions", html: p => `<div class="act-btns">${p.bookingId ? `<button class="btn sm" data-v="${esc(p.bookingId)}">Xem đơn</button>` : ""}<button class="btn primary sm" data-c="${esc(p.id)}">Ghi kết quả liên hệ</button></div>` }], list, { empty: "Không có sai lệch cần liên hệ" });
        $$("[data-v]", el).forEach(b => b.onclick = () => viewOrder(b.dataset.v));
        $$("[data-c]", el).forEach(b => b.onclick = async () => { const v = await ask("Kết quả liên hệ khách", [{ name: "note", label: "Đã trao đổi gì / khách cam kết gì", type: "textarea", required: true }]); if (v) act(null, () => post(`/api/support/payment-issues/${b.dataset.c}/contact`, { note: v.note }), "Đã ghi nhận.", reload); });
      }
      await reload();
    } },
    { id: "reschedule", label: "Đổi ngày giúp khách", icon: "📅", perm: "support:assist_customer", async badge() { return (await get("/api/support/reschedule")).requests.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/support/reschedule")).requests;
        el.innerHTML = table([{ t: "Mã đơn", html: b => `<a href="#" data-v="${esc(b.id)}" class="mono">${esc(b.payCode)}</a>` }, { t: "Khách", k: "customerName" }, { t: "Tour", k: "tourName" }, { t: "Ngày hiện tại → mới", html: b => `${day(b.date)} → <b>${day(b.reschedule.to)}</b><div class="small muted">${esc(b.reschedule.reason || "")}</div>` },
          { t: "Kiểm tra", html: b => `${b.check.seatsOk ? pill("Đủ chỗ", "ok") : pill("Hết chỗ", "bad")} ${b.check.guideOk ? pill("HDV rảnh", "ok") : pill("HDV bận", "bad")}` },
          { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn ok sm" data-y="${esc(b.id)}" ${b.check.seatsOk && b.check.guideOk ? "" : "disabled"}>Đồng ý</button><button class="btn bad sm" data-n="${esc(b.id)}">Từ chối</button></div>` }], list, { empty: "Không có yêu cầu đổi ngày" });
        $$("[data-v]", el).forEach(a => a.onclick = e => { e.preventDefault(); viewOrder(a.dataset.v); });
        $$("[data-y]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/support/reschedule/${b.dataset.y}`, { approve: true }), "Đã đổi ngày.", reload));
        $$("[data-n]", el).forEach(b => b.onclick = async () => { const v = await ask("Từ chối đổi ngày", [{ name: "note", label: "Lý do", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/support/reschedule/${b.dataset.n}`, { approve: false, note: v.note }), "Đã từ chối.", reload); });
      }
      await reload();
    } }
  ];
  Staff.boot({ roles: ["support"], title: "Chăm sóc khách hàng", sections });
})();
