/* Lõi giao diện nội bộ Travel: đăng nhập, kiểm quyền, khung sidebar, tiện ích. Mỗi trang vai trò gọi Staff.boot({...}).
 * Quyền thật nằm ở server (401/403); ở đây chỉ ẩn những gì vai trò không có để giao diện đúng với phạm vi công việc. */
const Staff = (() => {
  "use strict";
  const ROLE_HOME = { admin: "admin.html", cashier: "cashier.html", operator: "operator.html", support: "support.html", content: "content.html", guide: "guide.html" };
  const ROLE_NAME = { admin: "Quản trị viên", cashier: "Thu ngân", operator: "Điều hành tour", support: "Chăm sóc khách hàng", content: "Biên tập nội dung", guide: "Hướng dẫn viên", user: "Khách hàng" };

  // ───────── tiện ích ─────────
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => (Number(n) || 0).toLocaleString("vi-VN") + " ₫";
  const num = n => (Number(n) || 0).toLocaleString("vi-VN");
  const compactMoney = n => {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e9) {
      const v = (n / 1e9).toFixed(2).replace(/\.?0+$/, "");
      return v + " tỷ ₫";
    }
    if (Math.abs(n) >= 1e6) {
      const v = (n / 1e6).toFixed(1).replace(/\.?0+$/, "");
      return v + " tr ₫";
    }
    if (Math.abs(n) >= 1e3) {
      return Math.round(n / 1e3).toLocaleString("vi-VN") + " k ₫";
    }
    return n.toLocaleString("vi-VN") + " ₫";
  };
  const TZ = "Asia/Ho_Chi_Minh";
  const dt = iso => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString("vi-VN", { timeZone: TZ, hour12: false, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const day = s => { if (!s) return "—"; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(s); };
  const todayVN = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const h = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const STATUS = {
    pending_payment: ["Chờ thanh toán", "warn"], paid_deposit: ["Đã nhận cọc – chờ duyệt", "info"], paid_full: ["Đã nhận đủ – chờ duyệt", "info"],
    confirmed: ["Đã xác nhận", "ok"], guide_pending: ["Chờ HDV nhận tour", "warn"], guide_accepted: ["HDV đã nhận tour", "ok"], in_progress: ["Đang đi tour", "info"],
    completed: ["Đã hoàn thành", "ok"], cancelled: ["Đã hủy", "mute"], refund_pending: ["Chờ hoàn tiền", "warn"], refunded: ["Đã hoàn tiền", "mute"]
  };
  const badge = (s, label) => { const m = STATUS[s]; return `<span class="badge ${m ? m[1] : ""}">${esc(label || (m ? m[0] : s))}</span>`; };
  const pill = (text, kind) => `<span class="badge ${kind || ""}">${esc(text)}</span>`;

  // ───────── gọi API ─────────
  let onUnauth = () => {};
  async function api(method, url, body) {
    let r;
    try {
      r = await fetch(url, { method, credentials: "same-origin", headers: body !== undefined ? { "Content-Type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { throw Object.assign(new Error("Không kết nối được máy chủ"), { status: 0 }); }
    let data = {};
    try { data = await r.json(); } catch (e) { /* không JSON */ }
    if (!r.ok || data.ok === false) {
      if (r.status === 401) onUnauth();
      throw Object.assign(new Error(data.msg || data.error || ("Lỗi " + r.status)), { status: r.status, field: data.field });
    }
    return data;
  }
  const get = u => api("GET", u), post = (u, b) => api("POST", u, b || {}), put = (u, b) => api("PUT", u, b || {}), del = u => api("DELETE", u);

  // ───────── thông báo nhỏ + hộp thoại ─────────
  function toast(msg, kind) {
    let box = $(".toasts"); if (!box) { box = h('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = h(`<div class="toast ${kind || ""}">${esc(msg)}</div>`); box.appendChild(t); setTimeout(() => t.remove(), kind === "bad" ? 6000 : 3500);
  }
  const fail = e => toast(e && e.message ? e.message : String(e), "bad");

  /** Hộp thoại tổng quát. buttons: [{label, kind, value}]; trả value của nút bấm (null khi đóng). */
  function modal(title, bodyHtml, buttons, opts) {
    return new Promise(res => {
      const ov = h(`<div class="overlay" role="dialog" aria-modal="true"><div class="modal ${opts && opts.wide ? "wide" : ""}"><h2>${esc(title)}</h2><div class="mb">${bodyHtml || ""}</div><div class="acts"></div></div></div>`);
      const acts = $(".acts", ov);
      const close = v => { ov.remove(); document.removeEventListener("keydown", onKey); res(v); };
      const onKey = e => { if (e.key === "Escape") close(null); };
      document.addEventListener("keydown", onKey);
      (buttons || [{ label: "Đóng", value: null }]).forEach(b => {
        const el = h(`<button class="btn ${b.kind || ""}">${esc(b.label)}</button>`);
        el.onclick = () => { if (b.validate && !b.validate(ov)) return; close(b.value === undefined ? true : b.value); };
        acts.appendChild(el);
      });
      ov.addEventListener("mousedown", e => { if (e.target === ov && !(opts && opts.sticky)) close(null); });
      document.body.appendChild(ov);
      const first = $("input,select,textarea", ov); if (first) first.focus();
      if (opts && opts.onOpen) opts.onOpen(ov, close);
    });
  }


  // ───────── tải ảnh lên máy chủ (ghi vào frontend/img/) ─────────
  /** Thu nhỏ ảnh (cạnh dài tối đa maxSide) → data URL JPEG; nhẹ hơn nhiều so với ảnh gốc từ điện thoại/máy ảnh. */
  function fileToJpegDataUrl(file, maxSide) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.85));
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được ảnh")); };
      img.src = url;
    });
  }
  // Một lần cho cả trang: chọn file ở ô ảnh trong biểu mẫu → gửi lên /api/upload/<loại> → điền đường dẫn trả về vào ô.
  document.addEventListener("change", async e => {
    const inp = e.target.closest && e.target.closest("input[data-up-kind]");
    if (!inp || !inp.files || !inp.files[0]) return;
    const file = inp.files[0]; inp.value = "";
    const box = inp.closest(".img-up"), status = box.querySelector("[data-up-status]"), prev = box.querySelector("[data-up-preview]");
    const target = document.getElementById(inp.dataset.upTarget), scope = box.closest(".modal, [role=dialog], form") || document;
    const val = id => { const el = scope.querySelector("#" + id) || document.getElementById(id); return el ? el.value.trim() : ""; };
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { status.textContent = "Chỉ nhận PNG, JPG, WEBP, GIF"; return; }
    status.textContent = "Đang tải lên…";
    try {
      const dataUrl = await fileToJpegDataUrl(file, 1600);
      const r = await post("/api/upload/" + inp.dataset.upKind, {
        dataUrl, region: val("f_region"), destination: val("f_destination") || val("f_province"), name: val("f_name") || val("f_title")
      });
      target.value = r.path; status.textContent = "✔ Đã lưu: " + r.path;
      prev.src = "/" + String(r.path).replace(/^\//, ""); prev.style.display = "block";
    } catch (err) { status.textContent = "Lỗi: " + (err.message || "không tải lên được"); }
  });

  /** Hỏi theo biểu mẫu: fields [{name,label,type:text|number|textarea|select|date|password|checkbox,options:[[v,l]],value,required,hint,placeholder,upload:"tour|banner|food" (thêm nút tải ảnh lên)}]. Trả object hoặc null. */
  async function ask(title, fields, opts) {
    opts = opts || {};
    const html = (opts.intro ? `<p class="muted">${opts.intro}</p>` : "") + fields.map(f => {
      const id = "f_" + f.name, req = f.required ? " *" : "";
      let ctl;
      if (f.type === "textarea") ctl = `<textarea id="${id}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`;
      else if (f.type === "select") ctl = `<select id="${id}">${(f.options || []).map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(f.value) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
      else if (f.type === "checkbox") return `<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input id="${id}" type="checkbox" style="width:auto" ${f.value ? "checked" : ""}> ${esc(f.label)}</label>`;
      else ctl = `<input id="${id}" type="${f.type || "text"}" value="${esc(f.value == null ? "" : f.value)}" placeholder="${esc(f.placeholder || "")}" ${f.min != null ? `min="${f.min}"` : ""} autocomplete="off">`;
      if (f.upload) ctl += `<div class="img-up" style="display:flex;gap:8px;align-items:center;margin-top:6px"><label class="btn" style="margin:0;cursor:pointer">📷 Chọn ảnh từ máy<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-up-kind="${esc(f.upload)}" data-up-target="${id}" hidden></label><span class="small muted" data-up-status></span><img data-up-preview alt="" style="display:${f.value ? "block" : "none"};width:44px;height:44px;border-radius:6px;object-fit:cover;margin-left:auto" ${f.value ? `src="${esc(/^(https?:|\/|data:)/.test(f.value) ? f.value : "/" + f.value)}"` : ""}></div>`;
      return `<label for="${id}">${esc(f.label)}${req}</label>${ctl}${f.hint ? `<div class="small muted">${esc(f.hint)}</div>` : ""}<div class="field-err" id="e_${f.name}"></div>`;
    }).join("");
    const read = ov => { const o = {}; fields.forEach(f => { const el = $("#f_" + f.name, ov); o[f.name] = f.type === "checkbox" ? el.checked : el.value.trim(); }); return o; };
    let out = null;
    const r = await modal(title, html, [{ label: "Hủy", value: null }, { label: opts.submit || "Xác nhận", kind: opts.kind || "primary", value: "ok", validate: ov => {
      const v = read(ov); let ok = true;
      fields.forEach(f => { const e = $("#e_" + f.name, ov); if (e) e.textContent = ""; if (f.required && f.type !== "checkbox" && !v[f.name]) { if (e) e.textContent = "Bắt buộc nhập"; ok = false; } });
      if (ok) out = v; return ok;
    } }], { sticky: true });
    return r === "ok" ? out : null;
  }
  const confirmBox = async (title, text, kind) => (await modal(title, `<p>${text}</p>`, [{ label: "Hủy", value: false }, { label: "Đồng ý", kind: kind || "primary", value: true }])) === true;

  /** Chạy một thao tác: khóa nút, báo lỗi, báo thành công, tải lại. */
  async function act(btn, fn, okMsg, after) {
    if (btn) btn.disabled = true;
    try { const r = await fn(); if (okMsg) toast(okMsg, "ok"); if (after) await after(r); return r; }
    catch (e) { fail(e); } finally { if (btn) btn.disabled = false; }
  }

  // ───────── bảng, tab, biểu đồ ─────────
  /** cols: [{k, t, num, html:(row)=>string, sort:(row)=>value}] */
  function table(cols, rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return `<div class="empty">${esc(opts.empty || "Không có dữ liệu")}</div>`;
    const id = "t" + Math.random().toString(36).slice(2, 8);
    const head = cols.map((c, i) => `<th class="${c.num ? "num" : ""} ${c.sort || opts.sortable ? "sortable" : ""}" data-i="${i}">${esc(c.t)}</th>`).join("");
    const body = rows.map((r, ri) => `<tr data-row="${ri}">${cols.map(c => `<td class="${c.num ? "num" : ""}">${c.html ? c.html(r, ri) : esc(r[c.k])}</td>`).join("")}</tr>`).join("");
    setTimeout(() => {
      const t = document.getElementById(id); if (!t) return;
      let dir = 1, last = -1;
      $$("th.sortable", t).forEach(th => th.onclick = () => {
        const c = cols[+th.dataset.i], key = r => c.sort ? c.sort(r) : r[c.k]; dir = last === +th.dataset.i ? -dir : 1; last = +th.dataset.i;
        const idx = rows.map((r, i) => i).sort((a, b) => { const x = key(rows[a]), y = key(rows[b]); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
        const tb = $("tbody", t), trs = $$("tr", tb); idx.forEach(i => tb.appendChild(trs[i]));
      });
    }, 0);
    return `<div class="tbl-wrap"><table id="${id}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function tabs(el, items, render, initial) {
    el.innerHTML = `<div class="tabs" role="tablist">${items.map(t => `<button role="tab" data-id="${t.id}">${esc(t.label)}${t.n ? `<span class="n">${t.n}</span>` : ""}</button>`).join("")}</div><div class="tab-body"></div>`;
    const body = $(".tab-body", el);
    const select = id => { $$(".tabs button", el).forEach(b => b.classList.toggle("active", b.dataset.id === id)); render(id, body); };
    $$(".tabs button", el).forEach(b => b.onclick = () => select(b.dataset.id));
    select(initial || items[0].id);
    return select;
  }

  const PALETTE = ["#0891b2", "#f59e0b", "#059669", "#7c3aed", "#dc2626", "#0369a1", "#db2777", "#65a30d", "#475569", "#ea580c", "#0d9488"];
  function barChart(labels, series, opts) {
    opts = opts || {}; const W = 640, H = 240, L = 72, B = 28, T = 12, R = 10;
    const max = Math.max(1, ...series.flatMap(s => s.values));
    const gw = (W - L - R) / labels.length, bw = Math.min(26, gw / (series.length + 0.6));
    const axisFmt = opts.axisFmt || (v => (max >= 1e5 ? compactMoney(v) : (opts.fmt ? opts.fmt(v) : Math.round(v).toLocaleString("vi-VN"))));
    let g = "";
    for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${axisFmt(max * i / 4)}</text>`; }
    labels.forEach((lb, i) => {
      series.forEach((s, j) => {
        const v = s.values[i] || 0, bh = (H - T - B) * (v / max), x = L + gw * i + (gw - bw * series.length) / 2 + bw * j;
        g += `<rect x="${x.toFixed(1)}" y="${(H - B - bh).toFixed(1)}" width="${bw}" height="${Math.max(0, bh).toFixed(1)}" rx="3" fill="${s.color || PALETTE[j]}"><title>${esc(lb)} – ${esc(s.name)}: ${opts.fmt ? opts.fmt(v) : v}</title></rect>`;
      });
      g += `<text x="${L + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map((s, j) => `<span><i style="background:${s.color || PALETTE[j]}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "Biểu đồ cột")}">${g}</svg>${legend}`;
  }
  function lineChart(labels, values, opts) {
    opts = opts || {}; const W = 640, H = 220, L = 72, B = 26, T = 12, R = 10;
    const max = Math.max(1, ...values), n = Math.max(1, labels.length - 1);
    const pts = values.map((v, i) => [L + (W - L - R) * i / n, T + (H - T - B) * (1 - v / max)]);
    const axisFmt = opts.axisFmt || (v => (max >= 1e5 ? compactMoney(v) : (opts.fmt ? opts.fmt(v) : Math.round(v).toLocaleString("vi-VN"))));
    let g = "";
    for (let i = 0; i <= 4; i++) { const y = T + (H - T - B) * (1 - i / 4); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity=".12"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${axisFmt(max * i / 4)}</text>`; }
    g += `<polyline fill="none" stroke="${PALETTE[0]}" stroke-width="2.5" points="${pts.map(p => p.join(",")).join(" ")}"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${PALETTE[0]}"><title>${esc(labels[i])}: ${opts.fmt ? opts.fmt(values[i]) : values[i]}</title></circle>`).join("");
    labels.forEach((lb, i) => { g += `<text x="${L + (W - L - R) * i / n}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`; });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "Biểu đồ đường")}">${g}</svg>`;
  }
  function donut(items, opts) {
    opts = opts || {}; const total = items.reduce((a, b) => a + b.value, 0), R = 70, C = 2 * Math.PI * R;
    if (!total) return '<div class="empty">Chưa có dữ liệu</div>';
    let off = 0, seg = "";
    items.forEach((it, i) => { const len = C * it.value / total; seg += `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${it.color || PALETTE[i % PALETTE.length]}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 90 90)"><title>${esc(it.label)}: ${it.value}</title></circle>`; off += len; });
    return `<div class="row"><svg viewBox="0 0 180 180" width="170" role="img" aria-label="${esc(opts.label || "Biểu đồ tròn")}">${seg}<text x="90" y="95" text-anchor="middle" style="font-size:20px;font-weight:700;fill:currentColor">${total}</text></svg><div class="legend" style="flex-direction:column">${items.map((it, i) => `<span><i style="background:${it.color || PALETTE[i % PALETTE.length]}"></i>${esc(it.label)}: <b>${it.value}</b> (${Math.round(it.value * 100 / total)}%)</span>`).join("")}</div></div>`;
  }

  function csv(filename, header, rows) {
    const q = v => { let s = String(v == null ? "" : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const blob = new Blob(["﻿" + [header].concat(rows).map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ───────── đăng nhập / từ chối / đổi mật khẩu ─────────
  function gate(inner) { document.body.innerHTML = `<div class="gate"><div class="box">${inner}</div></div>`; }

  function loginScreen(cfg, msg) {
    try {
      localStorage.removeItem("travel_auth_v1");
      localStorage.removeItem("travel_session_v1");
    } catch (e) {}
    // 1 chỗ đăng nhập duy nhất: chuyển hướng về modal đăng nhập trang chủ
    const target = encodeURIComponent(location.pathname + location.search + location.hash);
    location.href = `/?login=1&redirect=${target}`;
  }

  function deniedScreen(cfg, user) {
    const own = ROLE_HOME[user.role];
    gate(`<h1>Không có quyền truy cập</h1><p>Tài khoản <b>${esc(user.name)}</b> (${esc(ROLE_NAME[user.role] || user.role)}) không được vào khu vực <b>${esc(cfg.title)}</b>. Khu vực này chỉ dành cho nhân viên có thẩm quyền.</p>
      ${own ? `<a class="btn primary" style="display:block;text-align:center;text-decoration:none;margin-top:16px" href="${own}">Vào khu vực ${esc(ROLE_NAME[user.role])}</a>` : `<a class="btn primary" style="display:block;text-align:center;text-decoration:none;margin-top:16px" href="/">← Về trang khách hàng</a>`}
      <button class="btn" id="lo" style="margin-top:10px">Đăng xuất / Đổi tài khoản</button>`);
    $("#lo").onclick = async () => {
      try { await post("/api/auth/logout"); } catch (e) { /* ignore */ }
      localStorage.removeItem("travel_auth_v1");
      localStorage.removeItem("travel_session_v1");
      const target = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = `/?login=1&redirect=${target}`;
    };
  }

  function changePasswordScreen(user, forced) {
    gate(`<h1>${forced ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"}</h1><p class="muted">${forced ? "Mật khẩu của bạn do quản trị viên cấp. Hãy đặt mật khẩu mới (ít nhất 8 ký tự, gồm cả chữ hoa, chữ thường, số và ký tự đặc biệt) trước khi tiếp tục." : ""}</p>
      <form id="cf"><label>Mật khẩu hiện tại</label><input id="op" type="password" autocomplete="current-password" required>
      <label>Mật khẩu mới</label><input id="np" type="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự (hoa, thường, số, ký tự đặc biệt)" required>
      <label>Nhập lại mật khẩu mới</label><input id="cp" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu mới" required>
      <div class="field-err" id="ce"></div><button class="btn primary" type="submit">Đổi mật khẩu</button></form>`);
    $("#cf").onsubmit = async e => {
      e.preventDefault(); $("#ce").textContent = "";
      const np = $("#np").value;
      if (!np || np.length < 8) { $("#ce").textContent = "Mật khẩu phải có ít nhất 8 ký tự"; return; }
      if (!/[A-Z]/.test(np)) { $("#ce").textContent = "Mật khẩu phải có ít nhất 1 chữ in hoa (A-Z)"; return; }
      if (!/[a-z]/.test(np)) { $("#ce").textContent = "Mật khẩu phải có ít nhất 1 chữ thường (a-z)"; return; }
      if (!/[0-9]/.test(np)) { $("#ce").textContent = "Mật khẩu phải có ít nhất 1 chữ số (0-9)"; return; }
      if (!/[^A-Za-z0-9]/.test(np)) { $("#ce").textContent = "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)"; return; }
      if (np !== $("#cp").value) { $("#ce").textContent = "Mật khẩu xác nhận không khớp"; return; }
      try { await post("/api/auth/change-password", { oldPassword: $("#op").value, newPassword: np, confirm: $("#cp").value }); location.reload(); }
      catch (err) { $("#ce").textContent = err.message; }
    };
  }

  // ───────── khung chính ─────────
  /**
   * cfg: { roles:["cashier"], title, sections:[{id,label,icon,perm,badge:async()=>n,render:async(el,ctx)}], links:[{label,href,perm}] }
   * sections/links bị lọc theo quyền (user.permissions) – vai trò không có quyền thì KHÔNG thấy mục.
   */
  
  // Module Ví thu nhập cá nhân dùng chung cho mọi vai trò nhân viên (mặc định 15.000.000 ₫)
  function staffWalletSection() {
    return {
      id: "my-wallet",
      label: "Ví & Thu nhập",
      icon: "💳",
      async render(el, ctx) {
        async function reload() {
          const w = await get("/api/wallet/me");
          const curBal = w.balance || 0;
          const minW = w.minWithdraw || 50000;
          el.innerHTML = `
            <div class="card">
              <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                <div>
                  <h2 style="margin:0;display:flex;align-items:center;gap:8px">
                    <span>💳 Ví Thu Nhập Cá Nhân</span>
                    <span class="badge ok">${esc(w.roleName || ctx.user.role)}</span>
                  </h2>
                  <div class="muted small" style="margin-top:4px">
  ${w.role === "guide"
    ? `<b>Hướng dẫn viên</b> · Thù lao tính theo từng tour đã hoàn thành (Xác nhận tour & hoàn thành chuyến đi để lấy tiền thù lao)`
    : `${esc(w.incomeTitle || "Lương nhân viên")} · Định mức thu nhập mặc định: <b>${money(w.defaultIncome || 15000000)}</b>`}
</div>
                </div>
                <button class="btn ok" id="st-btn-withdraw">💸 Rút tiền về ngân hàng</button>
              </div>

              <div class="grid g3" style="margin-top:16px">
                <div class="kpi ok"><div class="l">Số dư khả dụng</div><div class="v">${money(curBal)}</div></div>
                <div class="kpi"><div class="l">Tổng thu nhập</div><div class="v">${money(w.totalEarned || 0)}</div></div>
                <div class="kpi"><div class="l">Đã rút thành công</div><div class="v">${money(w.totalWithdrawn || 0)}</div></div>
              </div>
            </div>

            <div class="card">
              <h2>Lịch sử yêu cầu rút tiền (${(w.withdrawals || []).length})</h2>
              ${table([
                { t: "Thời gian", html: r => dt(r.createdAt), sort: r => r.createdAt },
                { t: "Số tiền", num: true, html: r => `<b>${money(r.amount)}</b>` },
                { t: "Ngân hàng", html: r => `<b>${esc(r.bankName)}</b>` },
                { t: "Số tài khoản", html: r => `<span class="mono">${esc(r.accountNumber)}</span>` },
                { t: "Chủ thẻ", html: r => `<b>${esc(r.accountHolder)}</b>` },
                { t: "Trạng thái", html: r => pill({ pending: "Chờ duyệt chi", approved: "Đã chuyển tiền", rejected: "Bị từ chối" }[r.status] || r.status, r.status === "approved" ? "ok" : r.status === "rejected" ? "bad" : "warn") },
                { t: "Ghi chú", html: r => esc(r.note || "—") + (r.rejectReason ? `<div class="small bad">Từ chối: ${esc(r.rejectReason)}</div>` : "") + (r.adminNote ? `<div class="small ok">Ghi chú: ${esc(r.adminNote)}</div>` : "") }
              ], w.withdrawals || [], { empty: "Chưa có yêu cầu rút tiền nào" })}
            </div>
          `;

          $("#st-btn-withdraw", el).onclick = async () => {
            const v = await ask("Yêu cầu rút tiền thu nhập", [
              { name: "amount", label: "Số tiền muốn rút (₫)", type: "number", required: true, min: minW, max: curBal, value: Math.min(curBal, 15000000) },
              { name: "bankName", label: "Tên Ngân hàng / Ví nhận tiền", type: "text", required: true, placeholder: "Ví dụ: Vietcombank, MB Bank, MoMo..." },
              { name: "accountNumber", label: "Số tài khoản nhận tiền", type: "text", required: true },
              { name: "accountHolder", label: "Tên chủ tài khoản (Viết hoa không dấu)", type: "text", required: true, placeholder: "NGUYEN VAN A" },
              { name: "note", label: "Ghi chú (không bắt buộc)", type: "text" }
            ], { submit: "Gửi yêu cầu rút tiền", kind: "ok", intro: `Số dư khả dụng hiện có: <b>${money(curBal)}</b> (Rút tối thiểu ${money(minW)})` });

            if (v) {
              act(null, () => post("/api/wallet/withdraw", {
                amount: Number(v.amount),
                bankName: v.bankName,
                accountNumber: v.accountNumber,
                accountHolder: v.accountHolder.toUpperCase(),
                note: v.note
              }), "Đã gửi yêu cầu rút tiền thành công. Thu ngân sẽ duyệt chuyển tiền sớm nhất.", reload);
            }
          };
        }
        await reload();
      }
    };
  }

  async function boot(cfg) {
    onUnauth = () => loginScreen(cfg, "Phiên đăng nhập đã hết, vui lòng đăng nhập lại.");
    let user;
    try { user = (await get("/api/auth/me")).user; Staff.user = user; } catch (e) { if (e.status === 401) return loginScreen(cfg); document.body.innerHTML = `<div class="gate"><div class="box"><h1>Lỗi</h1><p>${esc(e.message)}</p></div></div>`; return; }
    if (user.mustChangePassword) return changePasswordScreen(user, true);
    if (!cfg.roles.includes(user.role)) return deniedScreen(cfg, user);
    const perms = new Set(user.permissions || []);
    const has = p => !p || perms.has(p);
    const extraSec = user.role !== "admin" ? [staffWalletSection()] : [];
    const sections = cfg.sections.concat(extraSec).concat(window.Inbox ? [window.Inbox.section()] : []).filter(s => has(s.perm));
    const links = (cfg.links || []).filter(l => has(l.perm));
    if (!sections.length) return deniedScreen(cfg, user);
    const ctx = { user, perms, has, refresh: () => show(current, true) };
    document.title = cfg.title + " – Travel";
    document.body.innerHTML = `<div class="app"><aside class="side" id="side"><div class="brand"><span style="display:inline-flex;align-items:center;gap:8px"><span class="dot">T</span>Travel</span></div><div class="role-tag">${esc(ROLE_NAME[user.role] || user.role)}</div>
      <nav class="nav" aria-label="Menu chức năng">${(() => {
        let lastGrp = "";
        return sections.map(s => {
          let g = "";
          if (s.group && s.group !== lastGrp) {
            lastGrp = s.group;
            g = `<div class="sep"></div><div class="grp">${esc(s.group)}</div>`;
          }
          return `${g}<a href="#${s.id}" data-id="${s.id}"><span class="ic">${s.icon || "•"}</span><span>${esc(s.label)}</span><span class="count hidden" data-badge="${s.id}"></span></a>`;
        }).join("");
      })()}
      ${links.length ? `<div class="sep"></div><div class="grp">Làm thay</div>${links.map(l => `<a href="${l.href}"><span class="ic">${l.icon || "↗"}</span><span>${esc(l.label)}</span></a>`).join("")}` : ""}</nav>
      <div class="side-foot"><a href="#" id="chpw" style="color:#9fc3e6">Đổi mật khẩu</a> · <a href="#" id="lout" style="color:#9fc3e6">Đăng xuất</a></div></aside>
      <div class="main"><header class="top"><button class="menu-btn" id="mb" aria-label="Mở menu">☰</button><h1 id="ttl" style="margin-right:auto"></h1>
      ${user.role !== "admin" ? `<a href="#my-wallet" class="btn sm" id="staff-wallet-pill" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-weight:700;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;margin-right:10px" title="Ví thu nhập cá nhân"><span>💳 <span id="staff-wallet-quick-lbl">Thu nhập:</span></span><span id="staff-wallet-quick-amt">15.000.000 ₫</span></a>` : ""}
      <button class="bell" id="bell" aria-label="Thông báo">🔔<span class="n hidden" id="bn"></span></button>
      <div class="who">
        ${(user.avatar || user.picture)
          ? `<img src="${esc(user.avatar || user.picture)}" alt="${esc(user.name)}" class="avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #f59e0b;padding:0">`
          : `<span class="avatar">${esc((user.initials || user.name || "?").slice(0, 2))}</span>`}
        <div><b>${esc(user.name)}</b> <span class="badge info" style="margin-left:4px;font-size:0.75rem">${esc(ROLE_NAME[user.role] || user.role)}</span><small style="display:block">${esc(user.id)}</small></div>
      </div></header>
      <main class="content" id="view" tabindex="-1"></main></div></div>`;
    $("#mb").onclick = () => $("#side").classList.toggle("open");
    $("#lout").onclick = async e => {
      e.preventDefault();
      try { await post("/api/auth/logout"); } catch (x) { /* ignore */ }
      localStorage.removeItem("travel_auth_v1");
      localStorage.removeItem("travel_session_v1");
      location.href = "/";
    };
    $("#chpw").onclick = e => { e.preventDefault(); changePasswordScreen(user, false); };
    let current = null, seq = 0;
    async function show(id, quiet) {
      const s = sections.find(x => x.id === id) || sections[0]; current = s.id; const my = ++seq;
      $$(".nav a[data-id]").forEach(a => a.classList.toggle("active", a.dataset.id === s.id));
      $("#ttl").textContent = s.label; $("#side").classList.remove("open");
      const view = $("#view"); if (!quiet) view.innerHTML = '<div class="empty">Đang tải…</div>';
      try { const el = h("<div></div>"); await s.render(el, ctx); if (my === seq) { view.replaceChildren(el); } } catch (e) { if (my === seq) view.innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
      refreshBadges();
    }
    async function refreshBadges() {
      for (const s of sections) if (s.badge) { try { const n = await s.badge(ctx); const el = $(`[data-badge="${s.id}"]`); if (el) { el.textContent = n; el.classList.toggle("hidden", !n); } } catch (e) { /* bỏ qua */ } }
    }
    window.addEventListener("hashchange", () => show(location.hash.slice(1).split("/")[0]));
    notifications(user);
    if (user.role !== "admin") {
      (async () => {
        try {
          const w = await get("/api/wallet/me");
          if (w && w.balance != null) {
            const el = $("#staff-wallet-quick-amt");
            if (el) el.textContent = money(w.balance);
            const lbl = $("#staff-wallet-quick-lbl");
            if (lbl && user.role === "guide") lbl.textContent = "Thù lao tour:";
          }
        } catch (e) {}
      })();
    }
    await show(location.hash.slice(1).split("/")[0]);
    setInterval(() => { if (!document.hidden) refreshBadges(); }, 45000);
  }

  // ───────── chuông thông báo ─────────
  function notifications(user) {
    let list = [], open = false;
    async function load() {
      try { const r = await get("/api/notifications"); list = r.notifications || []; const n = $("#bn"); if (n) { n.textContent = r.unread; n.classList.toggle("hidden", !r.unread); } } catch (e) { /* offline */ }
    }
    function render() {
      let dd = $("#dd"); if (dd) dd.remove(); if (!open) return;
      dd = h(`<div class="dropdown" id="dd"><div class="row" style="padding:8px 14px;border-bottom:1px solid var(--border)"><b class="grow">Thông báo</b><button class="btn sm" id="mr">Đã đọc hết</button></div><a class="dd-all" href="#notifications" id="dd-all">Xem tất cả trong trang Thông báo →</a>${list.length ? list.slice(0, 40).map(n => `<div class="it ${n.read ? "" : "unread"}" data-id="${esc(n.id)}" data-link="${esc(n.link || "")}"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><br><span class="small">${dt(n.createdAt)}</span></div>`).join("") : '<div class="empty">Chưa có thông báo</div>'}</div>`);
      document.body.appendChild(dd);
      $("#dd-all", dd).onclick = () => { open = false; render(); };
      $("#mr", dd).onclick = async () => { await post("/api/notifications/read", {}); await load(); render(); };
      $$(".it", dd).forEach(it => it.onclick = async () => {
        await post("/api/notifications/read", { ids: [it.dataset.id] }); const l = it.dataset.link; open = false; render(); load();
        const m = l.match(/^([a-z]+\.html)?#?(.*)$/); if (m && l.includes(".html")) { if (location.pathname.endsWith("/" + m[1])) location.hash = m[2]; else location.href = l; }
      });
    }
    $("#bell").onclick = e => { e.stopPropagation(); open = !open; render(); };
    document.addEventListener("click", e => { if (open && !e.target.closest("#dd")) { open = false; render(); } });
    load(); setInterval(() => { if (!document.hidden) load(); }, 30000);
  }

  return { boot, api, get, post, put, del, esc, money, compactMoney, num, dt, day, todayVN, $, $$, h, badge, pill, STATUS, toast, fail, modal, ask, confirmBox, act, table, tabs, barChart, lineChart, donut, csv, ROLE_HOME, ROLE_NAME, PALETTE };
})();
window.Staff = Staff;
