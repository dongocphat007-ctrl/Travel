/* Hướng dẫn viên: chỉ thấy tour được giao cho CHÍNH mình (server trả 404 với tour người khác), chỉ thấy thù lao của chính mình, không thấy giá/doanh thu đơn. */
(() => {
  const { esc, dt, day, badge, pill, h, $, $$, get, post, ask, confirmBox, act, table, fail, tabs, money } = Staff;
  const TYPES = [["delay", "Chậm lịch trình"], ["health", "Sức khỏe khách"], ["accident", "Tai nạn"], ["lost", "Thất lạc"], ["complaint", "Khách phàn nàn"], ["vehicle", "Phương tiện"], ["other", "Khác"]];
  const SEV = { low: ["Thấp", ""], medium: ["Trung bình", "warn"], high: ["Cao", "bad"] };
  const dl = url => { const a = document.createElement("a"); a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); };
  const reportIncident = async (b, after) => {
    const v = await ask("Báo sự cố – " + b.payCode, [{ name: "type", label: "Loại sự cố", type: "select", options: TYPES }, { name: "severity", label: "Mức độ", type: "select", value: "medium", options: [["low", "Thấp"], ["medium", "Trung bình"], ["high", "Cao – cần xử lý ngay"]] }, { name: "description", label: "Mô tả sự việc", type: "textarea", required: true }], { kind: "bad", submit: "Gửi Điều hành" });
    if (v) act(null, () => post(`/api/guide/tours/${b.id}/incidents`, v), "Đã báo sự cố cho Điều hành.", after);
  };

  async function checkinDialog(b, after) {
    const d = (await get(`/api/guide/tours/${b.id}`)).booking, ps = d.passengers || [];
    if (!ps.length) return Staff.toast("Đơn chưa có danh sách hành khách", "bad");
    const expBar = `<div class="toolbar" style="margin-bottom:12px;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <span class="small muted" style="margin-right:auto;font-weight:600;">Phiếu điểm danh trước giờ xuất phát:</span>
      <button type="button" class="btn sm" id="ck-print">🖨️ In / Tải PDF</button>
      <button type="button" class="btn sm" id="ck-word">📝 Xuất Word</button>
      <button type="button" class="btn sm" id="ck-excel">📊 Xuất Excel</button>
      <button type="button" class="btn sm" id="ck-import">📥 Nhập từ Excel/CSV</button>
    </div>`;
    const body = expBar + `<p class="muted">Đánh dấu từng khách. Khách tới muộn chọn <b>Đến trễ</b> (vẫn tính có mặt); khách không có mặt chọn <b>Vắng</b>.</p>` + table([{ t: "Họ tên", k: "name" }, { t: "Ngày sinh", html: p => esc(p.dob || "") },
      { t: "Điểm danh", html: (p, i) => `<select data-i="${i}"><option value="">—</option><option value="present" ${p.checkin === "present" ? "selected" : ""}>Có mặt</option><option value="late" ${p.checkin === "late" ? "selected" : ""}>Đến trễ</option><option value="absent" ${p.checkin === "absent" ? "selected" : ""}>Vắng</option></select>` }], ps);
    await Staff.modal("Điểm danh – " + d.payCode, body, [{ label: "Hủy" }, { label: "Lưu điểm danh", kind: "primary", value: "ok" }], { wide: true, sticky: true, onOpen: ov => {
      const save = $(".acts .primary", ov); const orig = save.onclick;
      save.onclick = async () => { const marks = $$("select[data-i]", ov).filter(s => s.value).map(s => ({ index: +s.dataset.i, state: s.value })); if (!marks.length) return Staff.toast("Chưa chọn khách nào", "bad"); const ok = await act(save, () => post(`/api/guide/tours/${b.id}/checkin`, { marks }), "Đã lưu điểm danh.", after); if (ok) { ov.remove(); } void orig; };

      const mData = { tourName: d.tourName, date: d.date, payCode: d.payCode, guideName: d.guideName, passengers: ps };
      const ckPrint = $("#ck-print", ov); if (ckPrint) ckPrint.onclick = () => window.DataExportImport && window.DataExportImport.exportDepartureManifest(mData, "pdf");
      const ckWord = $("#ck-word", ov); if (ckWord) ckWord.onclick = () => window.DataExportImport && window.DataExportImport.exportDepartureManifest(mData, "word");
      const ckExcel = $("#ck-excel", ov); if (ckExcel) ckExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportDepartureManifest(mData, "excel");
      const ckImport = $("#ck-import", ov);
      if (ckImport) ckImport.onclick = () => {
        if (!window.DataExportImport) return;
        window.DataExportImport.importData({
          title: "Nhập điểm danh từ file Excel / CSV",
          onConfirm: async (parsed) => {
            const marks = [];
            parsed.rows.forEach(r => {
              const nameOrIdx = r[0] || r[1] || "";
              const stateStr = (r[6] || r[r.length - 1] || "").toLowerCase();
              const state = stateStr.includes("trễ") || stateStr.includes("late") ? "late" : stateStr.includes("có") || stateStr.includes("present") ? "present" : stateStr.includes("vắng") || stateStr.includes("absent") ? "absent" : null;
              if (state) {
                const foundIdx = ps.findIndex((p, idx) => String(idx + 1) === nameOrIdx || (p.name && p.name.toLowerCase().includes(nameOrIdx.toLowerCase())));
                if (foundIdx >= 0) marks.push({ index: foundIdx, state });
              }
            });
            if (!marks.length) throw new Error("Không khớp được dòng điểm danh nào với danh sách khách.");
            await post(`/api/guide/tours/${b.id}/checkin`, { marks });
            Staff.toast(`Đã cập nhật điểm danh ${marks.length} khách từ file.`, "ok");
            ov.remove();
            if (after) after();
          }
        });
      };
    } });
  }

  const stars = n => `<span class="stars" aria-label="${n} sao">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
  const MONTH_FMT = m => m.slice(5) + "/" + m.slice(2, 4);

  /** Báo cáo tour gọn: số liệu lấy từ điểm danh + sự cố có sẵn, HDV chỉ thêm ghi chú (gồm chi phí phát sinh nếu có). */
  async function reportDialog(id, after) {
    const r = (await get(`/api/guide/tours/${id}/report`)).report;
    const inc = r.incidents.length ? r.incidents.map(i => `<li>${pill(...(SEV[i.severity] || SEV.medium))} ${esc(i.description)} <span class="small muted">· ${dt(i.createdAt)}</span></li>`).join("") : '<li class="muted">Không có sự cố nào được báo.</li>';
    const body = `<div class="grid g4" style="margin-bottom:12px">
        <div class="kpi"><div class="l">Tổng khách</div><div class="v">${r.total}</div></div>
        <div class="kpi ok"><div class="l">Có mặt</div><div class="v">${r.present}</div>${r.late ? `<div class="s">trong đó đến trễ ${r.late}</div>` : ""}</div>
        <div class="kpi ${r.absent ? "bad" : ""}"><div class="l">Vắng</div><div class="v">${r.absent}</div></div>
        <div class="kpi ${r.unmarked ? "warn" : ""}"><div class="l">Chưa điểm danh</div><div class="v">${r.unmarked}</div></div></div>
      <h3>Sự cố trong chuyến</h3><ul style="margin:0 0 10px;padding-left:18px">${inc}</ul>
      ${r.canSubmit ? "" : '<div class="note">Chỉ nộp được báo cáo sau khi bạn kết thúc chuyến đi.</div>'}
      <label for="rp-note">Ghi chú</label><textarea id="rp-note" rows="5" maxlength="2000" ${r.canSubmit ? "" : "disabled"} placeholder="Diễn biến chuyến đi, góp ý, chi phí phát sinh nếu có (VD: vé gửi xe 150.000 ₫)…">${esc(r.note || "")}</textarea>
      ${r.submittedAt ? `<div class="small muted">Đã nộp ${dt(r.submittedAt)}${r.updatedAt !== r.submittedAt ? ", cập nhật " + dt(r.updatedAt) : ""}.</div>` : ""}`;
    let note = r.note || "";
    const btns = [{ label: "Đóng" }];
    if (r.canSubmit) btns.push({ label: r.submittedAt ? "Cập nhật báo cáo" : "Nộp báo cáo", kind: "primary", value: "ok", validate: ov => { note = $("#rp-note", ov).value.trim(); return true; } });
    const v = await Staff.modal(`Báo cáo tour – ${r.payCode}`, body, btns, { wide: true, sticky: true });
    if (v === "ok") await act(null, () => post(`/api/guide/tours/${id}/report`, { note }), "Đã lưu báo cáo tour.", after);
  }

  function card(b, kind, after) {
    const el = h(`<div class="card"><div class="row" style="justify-content:space-between;gap:12px"><div><h2 style="margin:0">${esc(b.tourName)}</h2><div class="muted small">Mã ${esc(b.payCode)} · Khởi hành <b>${day(b.date)}</b>${b.extraDays ? ` (+${b.extraDays} ngày)` : ""} · ${esc(b.pax)} khách</div></div><div>${badge(b.status, b.statusLabel)}</div></div>
      ${b.pickup ? `<div class="small" style="margin-top:6px">Điểm đón: ${esc(b.pickup)}</div>` : ""}${b.specialRequest ? `<div class="small">Yêu cầu đặc biệt: ${esc(b.specialRequest)}</div>` : ""}
      ${kind === "offers" && b.assignment && b.assignment.deadline ? `<div class="note warn" style="margin-top:8px">Vui lòng trả lời trước <b>${dt(b.assignment.deadline)}</b>, quá hạn tour sẽ trả về Điều hành.</div>` : ""}
      <div class="row" style="gap:8px;margin-top:10px" data-acts></div></div>`);
    const acts = $("[data-acts]", el);
    const btn = (label, cls, fn) => { const x = h(`<button class="btn ${cls || ""}">${esc(label)}</button>`); x.onclick = () => fn(x); acts.appendChild(x); };
    btn("Chi tiết & khách", "", () => Parts.showOrder(`/api/guide/tours/${b.id}`, "Tour " + b.payCode));
    btn("🖨️ Phiếu điểm danh (PDF)", "", async () => {
      const d = (await get(`/api/guide/tours/${b.id}`)).booking;
      if (window.DataExportImport) window.DataExportImport.exportDepartureManifest({ tourName: d.tourName, date: d.date, payCode: d.payCode, guideName: d.guideName, passengers: d.passengers || [] }, "pdf");
    });
    btn("📊 Xuất Excel đoàn", "", async () => {
      const d = (await get(`/api/guide/tours/${b.id}`)).booking;
      if (window.DataExportImport) window.DataExportImport.exportDepartureManifest({ tourName: d.tourName, date: d.date, payCode: d.payCode, guideName: d.guideName, passengers: d.passengers || [] }, "excel");
    });
    btn("📝 Xuất Word đoàn", "", async () => {
      const d = (await get(`/api/guide/tours/${b.id}`)).booking;
      if (window.DataExportImport) window.DataExportImport.exportDepartureManifest({ tourName: d.tourName, date: d.date, payCode: d.payCode, guideName: d.guideName, passengers: d.passengers || [] }, "word");
    });
    if (kind === "done") btn(b.hasReport ? "📝 Xem / sửa báo cáo" : "📝 Nộp báo cáo tour", b.hasReport ? "" : "primary", () => reportDialog(b.id, after).catch(fail));
    if (kind === "offers") {
      btn("Nhận tour", "ok", x => act(x, () => post(`/api/guide/tours/${b.id}/accept`), "Đã nhận tour.", after));
      btn("Từ chối", "bad", async () => { const v = await ask("Từ chối tour", [{ name: "reason", label: "Lý do (bắt buộc)", type: "textarea", required: true }], { kind: "bad", submit: "Từ chối" }); if (v) act(null, () => post(`/api/guide/tours/${b.id}/reject`, { reason: v.reason }), "Đã từ chối, Điều hành sẽ gán người khác.", after); });
    } else if (kind === "upcoming") {
      btn("Bắt đầu chuyến đi", "primary", async x => { if (!b.canStart) return Staff.toast("Chỉ bắt đầu được từ ngày khởi hành " + day(b.date), "bad"); if (await confirmBox("Bắt đầu chuyến đi", "Xác nhận bắt đầu tour " + esc(b.payCode) + "?")) act(x, () => post(`/api/guide/tours/${b.id}/start`), "Chuyến đi đã bắt đầu.", after); });
      if (b.canStart) btn("Điểm danh", "", () => checkinDialog(b, after));
    } else if (kind === "running") {
      btn("Điểm danh", "", () => checkinDialog(b, after));
      btn("Báo sự cố", "bad", () => reportIncident(b, after));
      btn("Kết thúc chuyến đi", "primary", async x => { if (await confirmBox("Kết thúc chuyến đi", "Xác nhận kết thúc tour " + esc(b.payCode) + "? Đơn chuyển sang hoàn thành.")) act(x, () => post(`/api/guide/tours/${b.id}/end`), "Đã kết thúc chuyến đi.", after); });
    }
    return el;
  }

  const sections = [
    { id: "home", label: "Tổng quan", icon: "🏠", perm: "guide:view_assigned", async render(el) {
      const [t, sc, e, g] = await Promise.all([get("/api/guide/tours"), get("/api/guide/schedule"), get("/api/guide/earnings?month=" + Staff.todayVN().slice(0, 7)), get("/api/guide/rating")]);
      const today = Staff.todayVN(), addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
      const span = b => { const days = (sc.trips.find(x => x.bookingId === b.id) || {}).days || 1; return [b.date, addDays(b.date, days - 1)]; };
      const todays = t.running.concat(t.upcoming.filter(b => { const s = span(b); return s[0] <= today && today <= s[1]; }));
      const soon = t.upcoming.filter(b => !todays.includes(b) && b.date > today && b.date <= addDays(today, 30)).slice(0, 6);
      const noRep = t.done.filter(b => !b.hasReport);
      const k = (l, v, c, sub, go) => `<div class="kpi ${c || ""}" ${go ? `style="cursor:pointer" data-go="${go}"` : ""}><div class="l">${l}</div><div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
      el.innerHTML = `<div class="grid g4">${k("Tour chờ tôi nhận", t.offers.length, t.offers.length ? "warn" : "", "bấm để xử lý", "tours")}${k("Tour sắp đi", t.upcoming.length, "", "đã nhận, chưa khởi hành", "tours")}${k("Chờ thanh toán", money(e.pendingTotal), e.pendingTotal ? "warn" : "", "tháng này: " + money(e.total), "earnings")}${k("Điểm đánh giá", g.count ? g.average.toFixed(1) + " ★" : "—", "", g.count + " lượt", "ratings")}</div>
        ${noRep.length ? `<div class="note" style="cursor:pointer" data-go="reports">📝 Bạn còn <b>${noRep.length}</b> tour đã kết thúc chưa nộp báo cáo. Bấm để nộp.</div>` : ""}
        <div class="card today-card"><h2>Hôm nay (${day(today)})</h2><div id="td"></div></div>
        ${t.offers.length ? `<div class="card"><h2>Tour đang chờ bạn nhận (${t.offers.length})</h2><div id="of"></div></div>` : ""}
        <div class="card"><h2>Sắp tới (30 ngày)</h2>${soon.length ? soon.map(b => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--border)"><b style="width:90px">${day(b.date)}</b><span class="grow">${esc(b.tourName)} <span class="mono small muted">${esc(b.payCode)}</span></span><span class="muted small">${esc(b.pax)} khách</span></div>`).join("") : '<div class="muted">Chưa có tour nào trong 30 ngày tới.</div>'}</div>`;
      const fill = (id, list, kind) => { const box = $(id, el); if (!box) return; if (!list.length) { box.innerHTML = '<div class="muted">Hôm nay bạn không có tour nào. Nghỉ ngơi thật tốt! 🌿</div>'; return; } list.forEach(b => box.appendChild(card(b, kind(b), () => location.reload()))); };
      fill("#td", todays, b => (b.status === "in_progress" ? "running" : "upcoming"));
      if (t.offers.length) { const box = $("#of", el); t.offers.forEach(b => box.appendChild(card(b, "offers", () => location.reload()))); }
      $$("[data-go]", el).forEach(x => x.onclick = () => { location.hash = x.dataset.go; });
    } },
    { id: "tours", label: "Tour của tôi", icon: "🧳", perm: "guide:view_assigned", async badge() { return (await get("/api/guide/tours")).offers.length; }, async render(el) {
      async function reload() {
        const r = await get("/api/guide/tours");
        tabs(el, [{ id: "offers", label: "Chờ tôi nhận", n: r.offers.length }, { id: "upcoming", label: "Sắp đi", n: r.upcoming.length }, { id: "running", label: "Đang đi", n: r.running.length }, { id: "done", label: "Đã hoàn thành" }], (id, box) => {
          const list = r[id]; box.innerHTML = "";
          if (!list.length) box.innerHTML = '<div class="empty">Không có tour nào</div>'; else list.forEach(b => box.appendChild(card(b, id, reload)));
        }, r.offers.length ? "offers" : r.running.length ? "running" : "upcoming");
      }
      await reload();
    } },
    { id: "schedule", label: "Lịch của tôi", icon: "🗓️", perm: "guide:view_schedule", async render(el) {
      const r = await get("/api/guide/schedule"), busy = new Set(r.busyDays), rest = new Set(r.restDays), per = new Set(r.personalBusy || []);
      const months = []; const now = new Date(); for (let i = 0; i < 3; i++) months.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
      const cal = m => {
        const y = m.getFullYear(), mo = m.getMonth(), first = (new Date(y, mo, 1).getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate(); let cells = "";
        for (let i = 0; i < first; i++) cells += "<span></span>";
        for (let d = 1; d <= n; d++) { const k = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; const c = busy.has(k) ? ["#fde2e2", "Bận (tour)"] : rest.has(k) ? ["#fff3cd", "Nghỉ bù"] : per.has(k) ? ["#e5e7eb", "Bận cá nhân"] : ["", ""];
          cells += `<span title="${c[1]}" style="text-align:center;padding:6px 0;border-radius:6px;${c[0] ? "background:" + c[0] + ";color:#1b2430;font-weight:600" : ""}">${d}</span>`; }
        return `<div class="card"><h2>Tháng ${mo + 1}/${y}</h2><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:13px">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(x => `<b style="text-align:center" class="muted">${x}</b>`).join("")}${cells}</div></div>`;
      };
      el.innerHTML = `<div class="row" style="gap:14px;margin-bottom:10px"><span class="badge" style="background:#fde2e2;color:#1b2430">Bận (tour)</span>${r.employmentType === "staff" ? '<span class="badge" style="background:#fff3cd;color:#1b2430">Nghỉ bù sau tour</span>' : ""}<span class="badge" style="background:#e5e7eb;color:#1b2430">Bận cá nhân</span></div><div class="grid g3">${months.map(cal).join("")}</div>
        <div class="card"><h2>Danh sách chuyến</h2>${table([{ t: "Ngày đi", html: t => day(t.date), sort: t => t.date }, { t: "Tour", k: "tourName" }, { t: "Mã", html: t => `<span class="mono">${esc(t.payCode)}</span>` }, { t: "Số ngày", num: true, k: "days" }, { t: "Trạng thái", html: t => badge(t.status, t.statusLabel) }], r.trips, { empty: "Chưa có chuyến" })}</div>`;
    } },
    { id: "earnings", label: "Thu nhập", icon: "💰", perm: "guide:view_schedule", async render(el) {
      const m = new Date(), cur = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      el.innerHTML = `<div class="toolbar"><label style="margin:0">Tháng <input type="month" id="em" value="${cur}"></label><button class="btn sm" id="em-all">Xem tất cả</button><div class="grow"></div><button class="btn sm" id="em-csv">⬇️ CSV</button></div><div id="eb"></div>`;
      let last = null;
      async function load(all) {
        const r = last = await get("/api/guide/earnings?month=" + (all ? "" : $("#em", el).value));
        const k = (l, v, c, sub) => `<div class="kpi ${c || ""}"><div class="l">${l}</div><div class="v">${v}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
        $("#eb", el).innerHTML = `<div class="grid g4">${k("Tour đã dẫn (tổng)", r.toursLed, "", "Thù lao: 20% giá tour")}${k("Phí HDV " + (all ? "(tất cả)" : "trong tháng"), money(r.total), "", r.count + " chuyến")}${k("Tiền đã nhận", money(r.paidTotal), "ok", "tổng cả đời: " + money(r.allPaid))}${k("Đang chờ thanh toán", money(r.pendingTotal), r.pendingTotal ? "warn" : "", "tổng cả đời: " + money(r.allPending))}</div>
          <div class="card"><h2>6 tháng gần nhất</h2>${Staff.barChart(r.monthly.map(x => MONTH_FMT(x.month)), [{ name: "Đã nhận", values: r.monthly.map(x => x.paid), color: "#059669" }, { name: "Chờ thanh toán", values: r.monthly.map(x => x.pending), color: "#f59e0b" }], { fmt: money, label: "Thu nhập 6 tháng" })}</div>`
          + `<div class="card"><h2>Các tour đã dẫn</h2>` + table([{ t: "Hoàn thành", html: i => day(i.completedAt), sort: i => i.completedAt }, { t: "Tour", k: "tourName" }, { t: "Mã", html: i => `<span class="mono">${esc(i.payCode)}</span>` }, { t: "Giá tour", num: true, html: i => money(i.price || 0) }, { t: "Thù lao HDV (20%)", num: true, html: i => `<b style="color:var(--ok)">${money(i.fee)}</b>`, sort: i => i.fee },
            { t: "Thanh toán", html: i => i.paid ? pill("Đã nhận", "ok") + `<div class="small muted">${dt(i.paidAt)}</div>` : pill("Đang chờ", "warn") }], r.items, { sortable: true, empty: "Chưa có chuyến hoàn thành" }) + "</div>";
      }
      $("#em", el).onchange = () => load(false);
      $("#em-all", el).onclick = () => load(true);
      $("#em-csv", el).onclick = () => { if (!last) return; Staff.csv("thu-nhap-hdv.csv", ["Hoàn thành", "Tour", "Mã đơn", "Số ngày", "Phí HDV", "Trạng thái"], last.items.map(i => [day(i.completedAt), i.tourName, i.payCode, i.days, i.fee, i.paid ? "Đã nhận " + day(i.paidAt) : "Đang chờ"])); };
      await load(false);
    } },
    { id: "ratings", label: "Đánh giá", icon: "⭐", perm: "guide:view_schedule", async render(el) {
      const g = await get("/api/guide/rating"), d = g.distribution || {};
      const max = Math.max(1, ...Object.values(d));
      el.innerHTML = `<div class="grid g2"><div class="card"><div class="muted">Điểm đánh giá HDV</div><div style="font-size:44px;font-weight:800;line-height:1.1">${g.count ? g.average.toFixed(1) : "—"}</div>${g.count ? stars(g.average) : ""}<div class="small muted">${g.count} lượt đánh giá từ khách</div></div>
        <div class="card"><h2>Phân bố sao</h2>${[5, 4, 3, 2, 1].map(n => `<div class="bar-row"><span style="width:34px">${n} ★</span><div class="bar"><i style="width:${(d[n] || 0) * 100 / max}%"></i></div><span style="width:28px;text-align:right">${d[n] || 0}</span></div>`).join("")}</div></div>
        <div class="card"><h2>Nhận xét từ khách</h2>${(g.items || []).length ? g.items.map(x => `<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div class="row" style="gap:8px">${stars(x.rating)} <b>${esc(x.reviewer)}</b><span class="small muted">· ${esc(x.tourName || "")} ${x.payCode ? `<span class="mono">${esc(x.payCode)}</span>` : ""} · ${day(x.createdAt)}</span></div>${x.comment ? `<p style="margin:4px 0 0">${esc(x.comment)}</p>` : '<p class="muted small" style="margin:4px 0 0">Không có nhận xét</p>'}</div>`).join("") : '<div class="empty">Chưa có đánh giá nào.</div>'}</div>`;
    } },
    { id: "reports", label: "Báo cáo tour", icon: "📝", perm: "trip:report", async badge() { return (await get("/api/guide/tours")).done.filter(b => !b.hasReport).length; }, async render(el) {
      async function reload() {
        const done = (await get("/api/guide/tours")).done;
        const todo = done.filter(b => !b.hasReport);
        el.innerHTML = `<div class="note ${todo.length ? "" : "ok"}">${todo.length ? `Bạn còn <b>${todo.length}</b> tour đã kết thúc chưa nộp báo cáo.` : "Bạn đã nộp báo cáo cho mọi tour đã hoàn thành."}</div><div id="rt"></div>`;
        $("#rt", el).innerHTML = table([{ t: "Ngày đi", html: b => day(b.date), sort: b => b.date }, { t: "Tour", html: b => esc(b.tourName) }, { t: "Mã", html: b => `<span class="mono">${esc(b.payCode)}</span>` }, { t: "Khách", num: true, k: "pax" },
          { t: "Báo cáo", html: b => b.hasReport ? pill("Đã nộp", "ok") + `<div class="small muted">${dt(b.reportAt)}</div>` : pill("Chưa nộp", "warn") }, { t: "", html: b => `<button class="btn sm ${b.hasReport ? "" : "primary"}" data-r="${esc(b.id)}">${b.hasReport ? "Xem / sửa" : "Nộp báo cáo"}</button>` }], done, { sortable: true, empty: "Chưa có tour nào hoàn thành" });
        $$("[data-r]", el).forEach(x => x.onclick = () => reportDialog(x.dataset.r, reload).catch(fail));
      }
      await reload();
    } },
    { id: "incidents", label: "Sự cố đã báo", icon: "🚨", perm: "incident:report", async render(el) {
      const list = (await get("/api/guide/incidents")).incidents;
      el.innerHTML = `<div class="note">Muốn báo sự cố mới, mở tour đang đi trong mục "Tour của tôi".</div>` + table([{ t: "Lúc", html: i => dt(i.createdAt), sort: i => i.createdAt }, { t: "Đơn", html: i => `<b class="mono">${esc(i.payCode)}</b><div class="small muted">${esc(i.tourName)}</div>` }, { t: "Mức độ", html: i => pill(...(SEV[i.severity] || SEV.medium)) }, { t: "Mô tả", k: "description" },
        { t: "Trạng thái", html: i => i.status === "resolved" ? pill("Đã xử lý", "ok") + `<div class="small muted">${esc(i.resolution || "")}</div>` : i.status === "acknowledged" ? pill("Đã tiếp nhận", "info") : pill("Chờ Điều hành", "warn") }], list, { sortable: true, empty: "Bạn chưa báo sự cố nào" });
    } },
    { id: "profile", label: "Hồ sơ của tôi", icon: "🪪", perm: "guide:view_profile", async render(el) {
      const p = (await get("/api/guide/profile")).profile, L = a => (a && a.length ? `<div class="tags">${a.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : '<span class="muted">Chưa cập nhật</span>');
      const ST = { active: ["Đang hoạt động", "ok"], off: ["Tạm nghỉ", "mute"] };
      el.innerHTML = `<div class="card"><div class="prof">${p.avatar ? `<img src="/${esc(String(p.avatar).replace(/^\//, ""))}" alt="${esc(p.name)}" onerror="this.outerHTML='<div class=ph>${esc((p.name || "?")[0])}</div>'">` : `<div class="ph">${esc((p.name || "?")[0])}</div>`}
        <div><h2 style="font-size:22px;margin:0">${esc(p.name)}</h2><div class="muted">${esc(p.title || "Hướng dẫn viên")} · mã ${esc(p.accountId)} ${pill(...(ST[p.status] || [p.status || "—", ""]))}</div>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}
        <dl class="kv"><dt>Kinh nghiệm</dt><dd>${p.experience != null ? esc(p.experience) + " năm" : "—"}</dd><dt>Hình thức</dt><dd>${p.employmentType === "freelance" ? "Cộng tác viên" : "Nhân viên chính thức"} · ${p.guideType === "international" ? "HDV quốc tế" : "HDV nội địa"}</dd>
        <dt>Tour đã hoàn thành</dt><dd>${esc(p.toursCompleted)}</dd><dt>Email</dt><dd>${esc(p.email || "—")}</dd><dt>Điện thoại</dt><dd>${esc(p.phone || "—")}</dd></dl></div></div></div>
        <div class="grid g2"><div class="card"><h3>Ngôn ngữ</h3>${L(p.languages)}</div><div class="card"><h3>Khu vực hoạt động</h3>${L([].concat(p.regions || [], p.provinces || []))}</div>
        <div class="card"><h3>Chuyên môn</h3>${L(p.specialties)}</div><div class="card"><h3>Chứng chỉ</h3>${L(p.certifications)}</div></div>
        <div class="note info">Hồ sơ do Quản trị viên quản lý. Cần chỉnh sửa thông tin, hãy dùng mục <b>Thông báo → Phản hồi Admin</b>.</div>`;
    } },
  ];
  Staff.boot({ roles: ["guide"], title: "Hướng dẫn viên", sections });
})();
