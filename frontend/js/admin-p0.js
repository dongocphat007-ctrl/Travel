/**
 * admin-p0.js – Hai tab Admin mới: 🎟️ Voucher và 🖼️ Banner (gọi API server, chỉ tài khoản Admin dùng được)
 * Được admin.js gọi qua AdminP0.mount(tab) sau mỗi lần vẽ lại trang Admin.
 */
const AdminP0 = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => new Intl.NumberFormat("vi-VN").format(Math.round(+n || 0)) + " ₫";
  const toast = (m, t) => (typeof showToast === "function" ? showToast(m, t || "info") : alert(m));
  const root = () => document.getElementById("adm-p0-root");
  const fmt = iso => iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
  const toLocalInput = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const toIso = v => v ? new Date(v).toISOString() : null;
  const field = (label, inner, cls) => '<label class="p0-f ' + (cls || "") + '"><span>' + label + "</span>" + inner + "</label>";
  const unauth = r => r.status === 401 || r.status === 403;
  const needLogin = '<div class="p0-note">⚠️ Cần đăng nhập bằng tài khoản Admin <b>trên máy chủ</b> (đăng xuất rồi đăng nhập lại) để quản lý mục này.</div>';
  const noServer = '<div class="p0-note">⚠️ Không kết nối được máy chủ. Hãy chạy backend (<code>mvn spring-boot:run</code>) và mở website qua địa chỉ của máy chủ.</div>';

  async function api(fn) {
    try { return await fn(); } catch (e) { return { status: 0, ok: false, data: {}, offline: true }; }
  }

  // ───────────────────────── VOUCHER ─────────────────────────
  const VSTAT = { active: ["Đang hiệu lực", "adm-status-confirmed"], upcoming: ["Chưa tới giờ", "adm-status-pending"], expired: ["Hết hạn", "adm-status-cancelled"], disabled: ["Đã tắt", "adm-status-cancelled"] };

  async function mountVouchers() {
    const el = root(); el.innerHTML = '<p class="p0-load">Đang tải voucher…</p>';
    const r = await api(() => Api.get("/api/admin/vouchers"));
    if (!r.ok) { el.innerHTML = r.offline ? noServer : unauth(r) ? needLogin : '<div class="p0-note">' + esc(r.data.msg || "Lỗi") + "</div>"; return; }
    const list = (r.data.vouchers || []).slice().reverse();
    el.innerHTML = `
      <div class="adm-section-bar"><div class="adm-section-title">🎟️ Voucher (${list.length})</div>
        <button class="btn btn-accent btn-sm" id="p0-v-toggle">＋ Tạo voucher</button></div>
      <form class="p0-form" id="p0-v-form" hidden>
        ${field("Mã *", '<input name="code" class="adm-input" placeholder="VD: HE2026" maxlength="24" required style="text-transform:uppercase">')}
        ${field("Tên hiển thị", '<input name="title" class="adm-input" maxlength="80" placeholder="VD: Ưu đãi mùa hè">')}
        ${field("Loại giảm", '<select name="type" class="adm-input"><option value="percent">Theo % </option><option value="fixed">Số tiền cố định (₫)</option></select>')}
        ${field("Giá trị *", '<input name="value" type="number" min="1" class="adm-input" required placeholder="10 hoặc 200000">')}
        ${field("Giảm tối đa (₫, 0 = không giới hạn)", '<input name="maxDiscount" type="number" min="0" class="adm-input" value="0">')}
        ${field("Bắt đầu", '<input name="startAt" type="datetime-local" class="adm-input">')}
        ${field("Hết hạn", '<input name="endAt" type="datetime-local" class="adm-input">')}
        ${field("Gắn tài khoản (email, để trống = ai cũng dùng được, mỗi người 1 lần)", '<input name="ownerEmail" type="email" class="adm-input" placeholder="khach@gmail.com">')}
        ${field("Tổng số lượt (0 = không giới hạn)", '<input name="maxUses" type="number" min="0" class="adm-input" value="0">')}
        <div class="p0-actions"><button class="btn btn-accent" type="submit">Tạo voucher</button><span class="p0-err" id="p0-v-err"></span></div>
      </form>
      <div class="adm-table-wrap"><table class="adm-table"><thead><tr>
        <th class="adm-th">Mã</th><th class="adm-th">Giảm</th><th class="adm-th">Áp dụng cho</th><th class="adm-th">Hiệu lực</th>
        <th class="adm-th adm-td-center">Đã dùng</th><th class="adm-th">Trạng thái</th><th class="adm-th"></th></tr></thead><tbody>
      ${list.length ? list.map(v => {
        const st = VSTAT[v.status] || ["", ""];
        return `<tr class="adm-tr"><td class="adm-td"><b>${esc(v.code)}</b><div class="adm-tour-dest">${esc(v.title || (v.source === "welcome" ? "Tự cấp: thành viên mới" : ""))}</div></td>
          <td class="adm-td">${v.type === "percent" ? "−" + v.value + "%" + (v.maxDiscount ? " (tối đa " + money(v.maxDiscount) + ")" : "") : "−" + money(v.value)}</td>
          <td class="adm-td">${v.ownerEmail ? esc(v.ownerEmail) : "Mọi tài khoản"}</td>
          <td class="adm-td"><small>${fmt(v.startAt)}<br>→ ${fmt(v.endAt)}</small></td>
          <td class="adm-td adm-td-center">${(v.usedBy || []).length}${v.maxUses ? " / " + v.maxUses : ""}</td>
          <td class="adm-td"><span class="adm-status ${st[1]}">${st[0]}</span></td>
          <td class="adm-td adm-td-actions"><button class="adm-btn-sm ${v.disabled ? "adm-btn-confirm" : "adm-btn-undo"}" data-act="toggle" data-code="${esc(v.code)}" data-dis="${v.disabled ? 1 : 0}">${v.disabled ? "Bật lại" : "Vô hiệu"}</button>
            <button class="adm-btn-icon adm-btn-danger" data-act="del" data-code="${esc(v.code)}" title="Xóa">🗑️</button></td></tr>`;
      }).join("") : '<tr><td class="adm-td" colspan="7" style="text-align:center;color:var(--muted)">Chưa có voucher nào.</td></tr>'}
      </tbody></table></div>`;
    const form = el.querySelector("#p0-v-form");
    el.querySelector("#p0-v-toggle").onclick = () => { form.hidden = !form.hidden; };
    form.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(form), err = el.querySelector("#p0-v-err"); err.textContent = "";
      const body = Object.fromEntries(f.entries());
      body.startAt = toIso(body.startAt); body.endAt = toIso(body.endAt);
      if (body.startAt && body.endAt && Date.parse(body.endAt) <= Date.parse(body.startAt)) { err.textContent = "Hết hạn phải sau thời gian bắt đầu"; return; }
      const res = await api(() => Api.post("/api/admin/vouchers", body));
      if (!res.ok) { err.textContent = res.data.msg || "Không tạo được"; return; }
      toast("✅ Đã tạo voucher " + res.data.voucher.code, "success"); mountVouchers();
    };
    el.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
      if (b.dataset.act === "del") {
        if (!confirm("Xóa voucher " + b.dataset.code + "?")) return;
        const res = await api(() => Api.del("/api/admin/vouchers/" + encodeURIComponent(b.dataset.code)));
        if (!res.ok) return toast("⚠️ " + (res.data.msg || "Không xóa được"), "warn");
      } else {
        const res = await api(() => Api.put("/api/admin/vouchers/" + encodeURIComponent(b.dataset.code), { disabled: b.dataset.dis !== "1" }));
        if (!res.ok) return toast("⚠️ " + (res.data.msg || "Không cập nhật được"), "warn");
      }
      mountVouchers();
    });
  }

  // ───────────────────────── BANNER ─────────────────────────
  const BSTAT = { running: ["Đang chạy", "adm-status-confirmed"], upcoming: ["Chưa tới giờ", "adm-status-pending"], expired: ["Đã hết hạn", "adm-status-cancelled"], off: ["Đang tắt", "adm-status-cancelled"] };
  let editing = null;   // banner đang sửa (null = tạo mới)

  async function mountBanners() {
    const el = root(); el.innerHTML = '<p class="p0-load">Đang tải banner…</p>';
    const r = await api(() => Api.get("/api/admin/banners"));
    if (!r.ok) { el.innerHTML = r.offline ? noServer : unauth(r) ? needLogin : '<div class="p0-note">' + esc(r.data.msg || "Lỗi") + "</div>"; return; }
    const list = r.data.banners || [];
    const b = editing || { title: "", subtitle: "", image: "", bgFrom: "#0f766e", bgTo: "#0ea5e9", link: "#sec-tours", ctaText: "Xem tour mẫu", priority: 0, enabled: true, startAt: new Date().toISOString(), endAt: "" };
    el.innerHTML = `
      <div class="adm-section-bar"><div class="adm-section-title">🖼️ Banner trang chủ (${list.length})</div>
        <span class="p0-hint">Banner hiện khi: đang bật <b>và</b> trong khoảng bắt đầu → kết thúc. Nhiều banner xếp theo ưu tiên (số lớn hiện trước). Không banner nào chạy → hiện hero mặc định.</span></div>
      <form class="p0-form" id="p0-b-form">
        <div class="p0-form-title">${editing ? "✏️ Sửa banner" : "＋ Thêm banner"}</div>
        ${field("Tiêu đề *", `<input name="title" class="adm-input" maxlength="90" required value="${esc(b.title)}">`, "wide")}
        ${field("Mô tả ngắn", `<input name="subtitle" class="adm-input" maxlength="220" value="${esc(b.subtitle)}">`, "wide")}
        ${field("Ảnh nền (đường dẫn hoặc tải lên; để trống = nền màu)", `<div class="p0-img"><input name="image" class="adm-input" placeholder="img/banners/ten-anh.jpg" value="${esc(b.image)}"><input type="file" id="p0-b-file" accept="image/png,image/jpeg,image/webp,image/gif"></div>`, "wide")}
        ${field("Màu nền từ", `<input name="bgFrom" type="color" class="p0-color" value="${esc(b.bgFrom)}">`)}
        ${field("Màu nền đến", `<input name="bgTo" type="color" class="p0-color" value="${esc(b.bgTo)}">`)}
        ${field("Chữ nút", `<input name="ctaText" class="adm-input" maxlength="30" value="${esc(b.ctaText)}">`)}
        ${field("Liên kết (#mục, /đường-dẫn hoặc https://…)", `<input name="link" class="adm-input" value="${esc(b.link)}">`)}
        ${field("Bắt đầu", `<input name="startAt" type="datetime-local" class="adm-input" value="${toLocalInput(b.startAt)}">`)}
        ${field("Kết thúc", `<input name="endAt" type="datetime-local" class="adm-input" value="${toLocalInput(b.endAt)}">`)}
        ${field("Ưu tiên", `<input name="priority" type="number" class="adm-input" value="${+b.priority || 0}">`)}
        ${field("Bật", `<span class="adm-toggle"><input type="checkbox" name="enabled" ${b.enabled !== false ? "checked" : ""}><span class="adm-toggle-slider"></span></span>`)}
        <div class="p0-actions"><button class="btn btn-accent" type="submit">${editing ? "Lưu thay đổi" : "Thêm banner"}</button>
          ${editing ? '<button type="button" class="btn btn-ghost" id="p0-b-cancel">Hủy sửa</button>' : ""}<span class="p0-err" id="p0-b-err"></span></div>
      </form>
      <div class="p0-bn-list">${list.length ? list.map(x => {
        const st = BSTAT[x.status] || ["", ""];
        const bg = x.image ? `url('${esc(x.image)}') center/cover` : `linear-gradient(135deg,${esc(x.bgFrom)},${esc(x.bgTo)})`;
        return `<div class="p0-bn-card"><div class="p0-bn-thumb" style="background:${bg}"><b>${esc(x.title)}</b></div>
          <div class="p0-bn-info"><div><span class="adm-status ${st[1]}">${st[0]}</span> <small>ưu tiên ${+x.priority || 0}</small></div>
            <div class="adm-tour-dest">${fmt(x.startAt)} → ${fmt(x.endAt)}</div><div class="adm-tour-dest">${esc(x.subtitle || "")}</div></div>
          <div class="p0-bn-act"><label class="adm-toggle" title="Bật/tắt thủ công"><input type="checkbox" data-act="on" data-id="${esc(x.id)}" ${x.enabled ? "checked" : ""}><span class="adm-toggle-slider"></span></label>
            <button class="adm-btn-icon" data-act="edit" data-id="${esc(x.id)}" title="Sửa">✏️</button>
            <button class="adm-btn-icon adm-btn-danger" data-act="del" data-id="${esc(x.id)}" title="Xóa">🗑️</button></div></div>`;
      }).join("") : '<p class="p0-load">Chưa có banner nào.</p>'}</div>`;

    const form = el.querySelector("#p0-b-form");
    el.querySelector("#p0-b-cancel")?.addEventListener("click", () => { editing = null; mountBanners(); });
    el.querySelector("#p0-b-file").onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 3.5 * 1024 * 1024) return toast("⚠️ Ảnh tối đa 3.5MB", "warn");
      const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
      const res = await api(() => Api.post("/api/admin/upload", { dataUrl }));
      if (!res.ok) return toast("⚠️ " + (res.data.msg || "Không tải được ảnh"), "warn");
      form.elements.image.value = res.data.url; toast("✅ Đã tải ảnh lên", "success");
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const f = form.elements, err = el.querySelector("#p0-b-err"); err.textContent = "";
      const body = { title: f.title.value, subtitle: f.subtitle.value, image: f.image.value.trim(), bgFrom: f.bgFrom.value, bgTo: f.bgTo.value,
        ctaText: f.ctaText.value, link: f.link.value.trim(), startAt: toIso(f.startAt.value), endAt: toIso(f.endAt.value), priority: f.priority.value, enabled: f.enabled.checked };
      const res = await api(() => editing ? Api.put("/api/admin/banners/" + editing.id, body) : Api.post("/api/admin/banners", body));
      if (!res.ok) { err.textContent = res.data.msg || "Không lưu được"; return; }
      toast(editing ? "✅ Đã lưu banner" : "✅ Đã thêm banner", "success"); editing = null; mountBanners(); window.BannerUI?.reload();
    };
    el.querySelectorAll("[data-act]").forEach(c => {
      const id = c.dataset.id, item = list.find(x => x.id === id);
      if (c.dataset.act === "on") c.onchange = async () => {
        const res = await api(() => Api.put("/api/admin/banners/" + id, Object.assign({}, item, { enabled: c.checked })));
        if (!res.ok) toast("⚠️ " + (res.data.msg || "Không cập nhật được"), "warn");
        mountBanners(); window.BannerUI?.reload();
      };
      else if (c.dataset.act === "edit") c.onclick = () => { editing = item; mountBanners(); root().scrollIntoView({ behavior: "smooth" }); };
      else c.onclick = async () => {
        if (!confirm("Xóa banner “" + item.title + "”?")) return;
        const res = await api(() => Api.del("/api/admin/banners/" + id));
        if (!res.ok) return toast("⚠️ " + (res.data.msg || "Không xóa được"), "warn");
        if (editing && editing.id === id) editing = null;
        mountBanners(); window.BannerUI?.reload();
      };
    });
  }

  const mount = tab => { if (!root()) return; if (tab === "vouchers") mountVouchers(); else if (tab === "banners") mountBanners(); };
  return { mount };
})();
window.AdminP0 = AdminP0;
