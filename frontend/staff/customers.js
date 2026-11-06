/* Màn hình "Khách hàng" dùng chung: CSKH và Admin cùng xem (tra cứu theo email / SĐT / mã đơn / tên; thông tin khách; lịch sử đặt tour;
 * khiếu nại – hỗ trợ). Chỉ Admin (quyền customer:lock) thấy nút Khóa / Mở khóa; chỉ vai trò có quyền xem thanh toán (Admin) nhận tab "Thanh toán".
 * Quyền thật nằm ở server; ở đây chỉ ẩn những gì vai trò không có. Dùng: Customers.section() trong danh sách sections của support.js / admin.js. */
const Customers = (() => {
  "use strict";
  const { esc, money, dt, day, pill, badge, h, $, $$, get, post, del, ask, act, table, fail, tabs } = Staff;
  const CMP = { open: ["Mới", "bad"], in_progress: ["Đang xử lý", "warn"], resolved: ["Đã giải quyết", "ok"], closed: ["Đã đóng", ""] };
  const WL = { waiting: ["Đang chờ", "warn"], notified: ["Đã báo có chỗ", "ok"], closed: ["Đã đóng", ""] };
  const SRC = { cashier: "Thu ngân", bank: "Ngân hàng", legacy: "Dữ liệu cũ", manual: "Xác nhận tay" };
  const KIND = { deposit: "Cọc", full: "Thanh toán đủ", final: "Thu nốt", refund: "Hoàn tiền" };
  const stateOf = (map, k) => pill(...(map[k] || [k, ""]));

  /** Chi tiết một đơn: đúng API của vai trò đang đăng nhập (server vẫn cắt dữ liệu theo vai trò). */
  const orderUrl = (ctx, id) => (ctx.user.role === "admin" ? "/api/admin/bookings/" : "/api/support/bookings/") + encodeURIComponent(id);
  const viewOrder = (ctx, id) => Parts.showOrder(orderUrl(ctx, id), "Chi tiết đơn").catch(fail);

  function infoBlock(c) {
    const kv = [];
    const add = (k, v) => { if (v !== undefined && v !== null && v !== "") kv.push(`<dt>${k}</dt><dd>${v}</dd>`); };
    add("Mã khách", `<b class="mono">${esc(c.id)}</b> ${c.locked ? pill("Đã khóa", "bad") : pill("Hoạt động", "ok")}`);
    add("Họ tên", esc(c.name)); add("Email", esc(c.email)); add("Điện thoại", esc(c.phone));
    add("Đăng ký lúc", dt(c.createdAt)); add("Đăng ký bằng", esc({ local: "Email + mật khẩu", google: "Google" }[c.provider] || c.provider));
    const lock = c.locked ? `<div class="note bad">Tài khoản đang bị khóa${c.lockedAt ? " từ " + dt(c.lockedAt) : ""}${c.lockedByName ? " bởi " + esc(c.lockedByName) : ""}.${c.lockReason ? " Lý do: " + esc(c.lockReason) : ""}</div>` : "";
    return `${lock}<dl class="kv">${kv.join("")}</dl>`;
  }

  function kpis(s) {
    const k = (l, v, c) => `<div class="kpi ${v && c ? c : ""}"><div class="l">${l}</div><div class="v">${v}</div></div>`;
    return `<div class="grid g4" style="margin:12px 0">${k("Số đơn tour", s.bookingCount)}${k("Đơn đang hiệu lực", s.activeCount)}${k("Đã hoàn thành", s.completedCount, "ok")}${k("Đã thanh toán", money(s.totalPaid))}${k("Khiếu nại đang mở", s.openComplaints, "bad")}</div>`;
  }

  /** Hồ sơ khách (hộp thoại). Trả "changed" nếu vừa khóa / mở khóa để danh sách tải lại. */
  async function openCustomer(ctx, id) {
    const d = await get(`/api/staff/customers/${encodeURIComponent(id)}`);
    const c = d.customer, canLock = ctx.has("customer:lock");
    const items = [
      { id: "orders", label: "Đơn tour", n: d.bookings.length },
      ...(d.payments ? [{ id: "pay", label: "Thanh toán", n: d.payments.length }] : []),
      { id: "cmp", label: "Khiếu nại / hỗ trợ", n: d.complaints.length },
      { id: "wl", label: "Danh sách chờ", n: d.waitlist.length }
    ];
    const render = (tid, box) => {
      if (tid === "orders") {
        box.innerHTML = table([
          { t: "Mã đơn", html: b => `<a href="#" data-o="${esc(b.id)}" class="mono">${esc(b.payCode || b.id)}</a>` }, { t: "Tour", k: "tourName" }, { t: "Ngày đi", html: b => day(b.date) },
          { t: "Số khách", num: true, k: "pax" }, { t: "Trạng thái", html: b => badge(b.status, b.statusLabel) }, { t: "Tổng tiền", num: true, html: b => money(b.price) },
          { t: "Đã trả", num: true, html: b => money(b.paidAmount) }, { t: "Đặt lúc", html: b => dt(b.createdAt) }
        ], d.bookings, { empty: "Khách chưa đặt tour nào" });
        $$("[data-o]", box).forEach(a => a.onclick = e => { e.preventDefault(); viewOrder(ctx, a.dataset.o); });
      } else if (tid === "pay") {
        box.innerHTML = table([
          { t: "Lúc", html: p => dt(p.at) }, { t: "Mã đơn", html: p => `<b class="mono">${esc(p.payCode)}</b>` }, { t: "Loại", html: p => esc(KIND[p.kind] || p.kind) },
          { t: "Số tiền", num: true, html: p => `<span style="${p.undone ? "text-decoration:line-through;opacity:.5" : ""}">${p.kind === "refund" ? "−" : ""}${money(p.amount)}</span>` },
          { t: "Người ghi", html: p => esc(p.byName || SRC[p.source] || p.source) }, { t: "Ghi chú", html: p => esc(p.note) + (p.undone ? ' <span class="small muted">(đã hoàn tác)</span>' : "") }
        ], d.payments, { empty: "Chưa có giao dịch" });
      } else if (tid === "cmp") {
        box.innerHTML = table([
          { t: "Gửi lúc", html: x => dt(x.createdAt) }, { t: "Đơn", html: x => `<b class="mono">${esc(x.payCode)}</b><div class="small muted">${esc(x.tourName)}</div>` }, { t: "Tiêu đề", k: "title" },
          { t: "Trạng thái", html: x => stateOf(CMP, x.status) + (x.overdue ? ' <span class="badge bad">quá hạn</span>' : "") }, { t: "Phụ trách", html: x => esc(x.assigneeName || "—") },
          { t: "Kết quả", html: x => esc(x.supportNote || "") + (x.proposedRefund ? `<div class="small muted">Đề xuất đền bù ${money(x.proposedRefund)}</div>` : "") }
        ], d.complaints, { empty: "Khách chưa có khiếu nại" });
      } else {
        box.innerHTML = table([
          { t: "Tour", k: "tourName" }, { t: "Ngày đi", html: w => day(w.date) }, { t: "Số khách", num: true, k: "pax" }, { t: "Trạng thái", html: w => stateOf(WL, w.status) }, { t: "Đăng ký", html: w => dt(w.createdAt) }
        ], d.waitlist, { empty: "Khách không trong danh sách chờ nào" });
      }
    };
    const body = `${infoBlock(c)}${kpis(d.summary)}<div id="cd-tabs"></div>`;
    const buttons = [{ label: "Đóng" }];
    const canNotify = ctx.has("notification:customer_send");
    if (canNotify) buttons.push({ label: "✉️ Gửi thông báo", kind: "ok", value: "notify" });
    if (canLock) {
      buttons.push({ label: c.locked ? "Mở khóa tài khoản" : "Khóa tài khoản", kind: c.locked ? "ok" : "bad", value: "toggle" });
      buttons.push({ label: "🗑️ Xóa tài khoản", kind: "bad", value: "delete" });
    }
    const r = await Staff.modal(`Khách hàng: ${c.name}`, body, buttons, { wide: true, onOpen: ov => tabs($("#cd-tabs", ov), items, render, "orders") });
    if (r === "notify") {
      const v = await ask(`Gửi thông báo tới ${c.name}`, [
        { name: "title", label: "Tiêu đề thông báo", required: true, placeholder: "VD: Cập nhật thông tin tour hoặc ưu đãi..." },
        { name: "body", label: "Nội dung", type: "textarea", required: true, placeholder: "Nội dung thông báo gửi đến chuông của khách hàng..." },
        { name: "link", label: "Liên kết đính kèm (tùy chọn)", placeholder: "profile hoặc tours.html" }
      ], { submit: "Gửi thông báo", kind: "ok" });
      if (v) await act(null, () => post("/api/notifications/customer", { customerId: c.id, title: v.title, body: v.body, link: v.link }), "Đã gửi thông báo cho khách hàng.");
      return false;
    }
    if (r === "delete") {
      const ok = await Staff.confirmBox("Xóa tài khoản khách hàng", `Bạn có chắc chắn muốn xóa tài khoản của khách hàng <b>${esc(c.name)}</b> (${esc(c.email)})?<br><span class="bad">Khách hàng sẽ bị đăng xuất và không thể đăng nhập lại.</span>`, "bad");
      if (!ok) return false;
      await act(null, () => del(`/api/staff/customers/${encodeURIComponent(c.id)}`), "Đã xóa tài khoản khách hàng.");
      return true;
    }
    if (r !== "toggle") return false;

    if (c.locked) {
      const v = await Staff.confirmBox("Mở khóa tài khoản", `Cho phép <b>${esc(c.name)}</b> đăng nhập lại?`, "ok");
      if (!v) return false;
      await act(null, () => post(`/api/staff/customers/${encodeURIComponent(c.id)}/lock`, { lock: false }), "Đã mở khóa tài khoản.");
      return true;
    }
    const v = await ask("Khóa tài khoản khách", [{ name: "reason", label: "Lý do khóa", type: "textarea", required: true, hint: "Khách sẽ bị đăng xuất và không đăng nhập được. Các đơn đã đặt vẫn giữ nguyên. Lý do được ghi vào nhật ký hệ thống." }], { kind: "bad", submit: "Khóa tài khoản" });
    if (!v) return false;
    await act(null, () => post(`/api/staff/customers/${encodeURIComponent(c.id)}/lock`, { lock: true, reason: v.reason }), "Đã khóa tài khoản.");
    return true;
  }

  async function render(el, ctx) {
    const canNotify = ctx.has("notification:customer_send");
    const canDelete = ctx.has("customer:lock") || ctx.has("account:delete");
    const bar = Parts.search(() => reload(), "Tìm theo email, số điện thoại, mã đơn, tên…",
      `<select id="cs-st" aria-label="Trạng thái tài khoản"><option value="">Mọi trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select>` +
      (canNotify ? `<button class="btn ok sm" id="cs-bc" style="margin-left:8px">📢 Gửi thông báo cho khách hàng</button>` : ""));
    const body = h("<div></div>");
    el.append(bar, body);

    const bcBtn = $("#cs-bc", bar);
    if (bcBtn) {
      bcBtn.onclick = async () => {
        const v = await ask("Gửi thông báo tới TẤT CẢ khách hàng", [
          { name: "title", label: "Tiêu đề thông báo", required: true, placeholder: "VD: Khuyến mãi mùa du lịch mới..." },
          { name: "body", label: "Nội dung", type: "textarea", required: true, placeholder: "Nội dung gửi vào chuông thông báo của tất cả khách hàng..." },
          { name: "link", label: "Liên kết đính kèm (tùy chọn)", placeholder: "profile hoặc tours.html" }
        ], { submit: "Gửi tới tất cả khách hàng", kind: "ok", intro: "Thông báo này sẽ xuất hiện trên chuông của toàn bộ khách hàng đang hoạt động trong hệ thống." });
        if (v) act(null, () => post("/api/notifications/customer", { target: "all", title: v.title, body: v.body, link: v.link }), "Đã gửi thông báo tới tất cả khách hàng.");
      };
    }

    async function reload() {
      const q = encodeURIComponent($("input", bar).value.trim()), st = $("#cs-st", bar).value;
      const r = await get(`/api/staff/customers?q=${q}&status=${st}`);
      const list = r.customers || [];
      const note = `<div class="small muted" style="margin-bottom:8px">${list.length < r.total ? `Hiển thị ${list.length} / ${r.total} khách – gõ thêm từ khóa để thu hẹp.` : `${r.total} khách.`}</div>`;
      body.innerHTML = note + table([
        { t: "Khách", sort: x => x.name, html: x => `<b>${esc(x.name)}</b><div class="small muted mono">${esc(x.id)}</div>` },
        { t: "Liên hệ", html: x => esc(x.email) + `<div class="small muted">${esc(x.phone || "—")}</div>` },
        { t: "Đăng ký", sort: x => x.createdAt, html: x => dt(x.createdAt) },
        { t: "Số đơn", num: true, sort: x => x.bookingCount, k: "bookingCount" },
        { t: "Đã thanh toán", num: true, sort: x => x.totalPaid, html: x => money(x.totalPaid) },
        { t: "Khiếu nại", html: x => x.openComplaints ? pill(x.openComplaints + " đang mở", "bad") : "—" },
        { t: "Trạng thái", html: x => x.locked ? pill("Đã khóa", "bad") : pill("Hoạt động", "ok") },
        { t: "Thao tác", nowrap: true, cls: "actions", html: x => `<div class="act-btns"><button class="btn sm" data-c="${esc(x.id)}">Xem</button>${canDelete ? `<button class="btn bad sm" data-del="${esc(x.id)}">Xóa</button>` : ""}</div>` }
      ], list, { empty: "Không tìm thấy khách phù hợp" });
      $$("[data-c]", body).forEach(b => b.onclick = async () => {
        try { if (await openCustomer(ctx, b.dataset.c)) await reload(); } catch (e) { fail(e); }
      });
      $$("[data-del]", body).forEach(b => b.onclick = async () => {
        const c = list.find(item => item.id === b.dataset.del);
        if (await Staff.confirmBox("Xóa tài khoản", `Xóa tài khoản khách hàng <b>${esc(c.name)}</b> (${esc(c.email)})?<br><span class="bad">Khách hàng sẽ bị đăng xuất và không thể đăng nhập lại.</span>`, "bad")) {
          await act(null, () => del(`/api/staff/customers/${encodeURIComponent(c.id)}`), "Đã xóa tài khoản.");
          await reload();
        }
      });
    }
    $("#cs-st", bar).onchange = reload;
    await reload();
  }

  function section(group) {
    return { id: "customers", label: "Khách hàng", icon: "🧑‍🤝‍🧑", group: group || "Khách hàng", perm: "customer:view", render };
  }
  return { section };
})();
window.Customers = Customers;
