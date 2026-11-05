/* Điều hành tour: gán HDV, chuyến khởi hành & sức chứa, đề xuất hủy/dồn, sự cố, đổi ngày. Không thấy tiền, không duyệt đơn, không hủy tour (chỉ đề xuất). */
(() => {
  const { esc, dt, day, badge, pill, h, $, $$, get, post, put, ask, confirmBox, act, table, fail, tabs, csv } = Staff;
  const GT = { domestic: "Nội địa", international: "Quốc tế" }, ET = { staff: "Chính thức", freelance: "Cộng tác viên" };
  const SEV = { low: ["Thấp", ""], medium: ["Trung bình", "warn"], high: ["Cao", "bad"] };
  // 5.4, 5.9: vì sao hệ thống chưa tự gán được HDV (đơn cần điều hành xử lý tay)
  const ISSUE = { chosen_busy: "HDV khách chọn đang bận – liên hệ khách chọn lại", chosen_declined: "HDV khách chọn đã từ chối – liên hệ khách chọn lại", none_free: "Không còn HDV rảnh – đổi ngày hoặc hoàn tiền" };
  const issueBadge = b => ISSUE[b.guideIssue] ? `<div><span class="badge ${b.guideIssue === "none_free" ? "bad" : "warn"}">${esc(ISSUE[b.guideIssue])}</span></div>` : "";
  const dl = url => { const a = document.createElement("a"); a.href = url; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); };

  async function pick(b, after, replace) {
    const r = await get(`/api/operator/bookings/${b.id}/candidates`);
    const body = `<p class="muted">Đơn <b>${esc(b.payCode)}</b> – ${esc(b.tourName)} – đi ${day(b.date)} (cần HDV ${esc(GT[b.requiredGuideType] || "phù hợp")}). HDV không rảnh / không phù hợp bị khóa và hiện lý do.</p>` +
      table([{ t: "HDV", html: g => `<b>${esc(g.name)}</b><div class="small muted">${esc(GT[g.guideType] || g.guideType)} · ${esc(ET[g.employmentType] || g.employmentType)}</div>` }, { t: "Khu vực", html: g => esc((g.regions || []).join(", ")) }, { t: "Đánh giá", num: true, html: g => g.rating ? esc(g.rating) + " ★" : "—" }, { t: "Số tour tháng", num: true, k: "workload" },
        { t: "", html: g => g.available ? `<button class="btn ok sm" data-g="${esc(g.id)}">Chọn</button>` : `<span class="small" style="color:var(--bad)">${esc([g.fitProblem].concat(g.reasons || []).filter(Boolean).join("; "))}</span>` }], r.guides, { empty: "Chưa có HDV" });
    await Staff.modal("Chọn hướng dẫn viên", body, [{ label: "Đóng" }], { wide: true, onOpen: (ov, close) => $$("[data-g]", ov).forEach(btn => btn.onclick = async () => {
      if (replace) {   // 6.6: thay HDV giữa chừng – bắt buộc lý do, HDV mới dẫn tiếp ngay
        const v = await ask("Thay HDV giữa chừng", [{ name: "reason", label: "Lý do thay HDV (ốm, tai nạn...)", type: "textarea", required: true }], { kind: "bad", submit: "Thay HDV" }); if (!v) return;
        const lock = $$("[data-g]", ov); lock.forEach(x => x.disabled = true);   // chặn bấm hai lần khi máy chủ đang xử lý
        const ok = await act(null, () => post(`/api/operator/bookings/${b.id}/replace-guide`, { guideId: btn.dataset.g, reason: v.reason }), "Đã thay HDV, khách và HDV mới đã được báo.");
        if (ok) { close(true); if (after) after().catch(fail); } else lock.forEach(x => x.disabled = false); return;
      }
      const lock = $$("[data-g]", ov); lock.forEach(x => x.disabled = true);   // chặn bấm hai lần khi máy chủ đang xử lý
      const ok = await act(null, () => post(`/api/operator/bookings/${b.id}/assign`, { guideId: btn.dataset.g }), "Đã gán HDV, chờ HDV trả lời.");
      if (ok) { close(true); if (after) after().catch(fail); } else lock.forEach(x => x.disabled = false); }) });
  }
  const orderCols = (extra) => [{ t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono">${esc(b.payCode)}</a>` }, { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">${b.pax} khách</div>` }, { t: "Ngày đi", html: b => day(b.date), sort: b => b.date }, ...extra];
  const bindView = el => $$("[data-view]", el).forEach(a => a.onclick = e => { e.preventDefault(); Parts.showOrder(`/api/operator/bookings/${a.dataset.view}`, "Chi tiết đơn").catch(fail); });

  const sections = [
    { id: "home", label: "Tổng quan", icon: "📈", perm: "stats:view_operator", async render(el) {
      const s = (await get("/api/operator/stats")).stats;
      const k = (l, v, c) => `<div class="kpi ${v && c ? c : ""}"><div class="l">${l}</div><div class="v">${v}</div></div>`;
      el.innerHTML = `<div class="grid g3">${k("Đơn chưa có HDV", s.unassigned, "warn")}${k("Chờ HDV trả lời", s.guidePending)}${k("HDV đã nhận", s.guideAccepted, "ok")}${k("Chuyến đi trong 7 ngày", s.upcoming7d)}${k("Sự cố đang mở", s.openIncidents, "bad")}${k("Chuyến có nguy cơ thiếu khách", s.atRiskDepartures, "warn")}</div>
        <div class="note info">Trang này không hiển thị số tiền. Việc thanh toán do Thu ngân và Admin phụ trách.</div>`;
    } },
    { id: "assign", label: "Gán HDV", icon: "🧭", perm: "tour:assign_guide", async badge() { return (await get("/api/operator/queue")).unassigned.length; }, async render(el) {
      async function reload() {
        const q = await get("/api/operator/queue");
        tabs(el, [{ id: "u", label: "Chưa có HDV", n: q.unassigned.length }, { id: "r", label: "HDV đã từ chối / quá hạn", n: q.rejected.length }, { id: "p", label: "Chờ HDV trả lời", n: q.pending.length }, { id: "a", label: "HDV đã nhận", n: q.accepted.length }, { id: "g", label: "Đang đi tour", n: (q.running || []).length }], (id, box) => {
          const list = { u: q.unassigned, r: q.rejected, p: q.pending, a: q.accepted, g: q.running || [] }[id];
          const actCol = { t: "", html: b => id === "g" ? `<button class="btn bad sm" data-rp="${esc(b.id)}">Thay HDV</button>` : id === "a" ? `<button class="btn sm" data-un="${esc(b.id)}">Gỡ / đổi</button>` : id === "p" ? `<button class="btn sm" data-un="${esc(b.id)}">Gỡ</button>` : `<button class="btn primary sm" data-as="${esc(b.id)}">Chọn HDV</button>` };
          box.innerHTML = table(orderCols([{ t: "HDV", html: b => esc(b.guideName || "—") + issueBadge(b) + (b.assignment && b.assignment.deadline && id === "p" ? `<div class="small muted">Hạn trả lời ${dt(b.assignment.deadline)}</div>` : "") + (b.assignment && (b.assignment.rejected || []).length ? `<div class="small" style="color:var(--bad)">${b.assignment.rejected.map(r => esc(r.reason)).join("; ")}</div>` : "") }, actCol]), list, { sortable: true, empty: "Không có đơn nào" });
          bindView(box);
          $$("[data-rp]", box).forEach(btn => btn.onclick = () => pick(list.find(x => x.id === btn.dataset.rp), reload, true).catch(fail));
          $$("[data-as]", box).forEach(btn => btn.onclick = () => pick(list.find(x => x.id === btn.dataset.as), reload).catch(fail));
          $$("[data-un]", box).forEach(btn => btn.onclick = async () => { const v = await ask("Gỡ HDV khỏi đơn", [{ name: "reason", label: "Lý do", type: "textarea", required: true }], { kind: "bad", submit: "Gỡ HDV" }); if (v) act(null, () => post(`/api/operator/bookings/${btn.dataset.un}/unassign`, { reason: v.reason }), "Đã gỡ HDV.", reload); });
        }, "u");
      }
      await reload();
    } },
    { id: "calendar", label: "Lịch HDV", icon: "🗓️", perm: "tour:assign_guide", async render(el) {
      // 5.14: lịch tháng của từng HDV – bận / có tour / nghỉ sau tour
      const now = new Date(), ym0 = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      const bar = h(`<div class="toolbar"><label for="cm" class="small muted">Tháng</label><input type="month" id="cm" value="${ym0}"><span class="small"><span class="badge info">Có tour</span> <span class="badge warn">Nghỉ sau tour</span> <span class="badge">Bận</span></span></div>`);
      const body = h("<div></div>"); el.append(bar, body);
      const COL = { tour: "#bfdbfe", rest: "#fde68a", busy: "#d1d5db" };
      async function reload() {
        const m = $("#cm", bar).value || ym0;
        const c = (await get("/api/operator/guide-calendar?month=" + encodeURIComponent(m))).calendar;
        const cols = Array.from({ length: c.length }, (_, i) => i + 1);
        const head = cols.map(d => `<th style="min-width:26px;text-align:center;padding:2px">${d}</th>`).join("");
        const rows = c.guides.map(g => `<tr><td style="white-space:nowrap"><b>${esc(g.name)}</b><div class="small muted">${esc(GT[g.guideType] || g.guideType)} · ${esc(ET[g.employmentType] || g.employmentType)}${g.off ? " · tạm nghỉ" : ""}</div></td>${cols.map(d => {
          const key = c.month + "-" + String(d).padStart(2, "0"), x = g.days[key];
          return `<td title="${x ? esc(key + ": " + x.label) : esc(key)}" style="min-width:26px;height:30px;padding:0;border:1px solid #e5e7eb;background:${x ? COL[x.kind] : "transparent"}"></td>`;
        }).join("")}</tr>`).join("");
        body.innerHTML = `<div class="tbl-wrap" style="overflow:auto"><table style="border-collapse:collapse"><thead><tr><th>HDV</th>${head}</tr></thead><tbody>${rows || `<tr><td>Chưa có HDV</td></tr>`}</tbody></table></div>
          <div class="small muted" style="margin-top:8px">Rê chuột vào ô màu để xem mã đơn / tour. Ngày nghỉ chỉ áp dụng cho HDV chính thức.</div>`;
      }
      $("#cm", bar).addEventListener("change", () => reload().catch(fail));
      await reload();
    } },
    { id: "departures", label: "Chuyến khởi hành", icon: "🚌", perm: "tour:schedule_manage", async render(el) {
      async function reload() {
        const list = (await get("/api/operator/departures")).departures;
        el.innerHTML = `<div class="note">Chuyến thiếu khách tối thiểu sát ngày chốt sẽ được đánh dấu <b>nguy cơ</b>. Điều hành chỉ <b>đề xuất</b> hủy/dồn; Admin mới quyết định hủy.</div>` + table([{ t: "Tour", k: "tourName" }, { t: "Ngày", html: d => day(d.date), sort: d => d.date }, { t: "Khách", num: true, html: d => `${d.pax}/${d.capacity} <span class="small muted">(tối thiểu ${d.minGuests})</span>` }, { t: "Còn chỗ", num: true, k: "left" },
          { t: "Tình trạng", html: d => d.cancelled ? pill("Đã hủy", "bad") : d.atRisk ? pill("Nguy cơ thiếu khách", "warn") : d.belowMin ? pill("Chưa đủ tối thiểu", "info") : pill("Ổn", "ok") }, { t: "HDV", html: d => esc((d.guides || []).join(", ") || "—") },
          { t: "", html: d => `<div class="row" style="gap:6px"><button class="btn sm" data-s="${esc(d.key)}">Chỉnh chỗ/đóng bán</button><button class="btn sm" data-m="${esc(d.key)}">Danh sách đoàn</button>${d.cancelled ? "" : `<button class="btn sm" data-p="${esc(d.key)}">Đề xuất hủy</button>`}</div>` }], list, { sortable: true, empty: "Chưa có chuyến nào" });
        const find = k => list.find(x => x.key === k);
        $$("[data-s]", el).forEach(b => b.onclick = async () => { const d = find(b.dataset.s); const v = await ask(`${d.tourName} – ${day(d.date)}`, [{ name: "capacity", label: "Sức chứa (chỗ)", type: "number", value: d.capacity, min: d.pax, hint: `Không thấp hơn số khách đã đặt (${d.pax}).` }, { name: "status", label: "Trạng thái bán", type: "select", options: [["open", "Đang mở bán"], ["closed", "Đóng bán"]] }]); if (v) act(null, () => put("/api/operator/departures", { tourId: d.tourId, date: d.date, capacity: Number(v.capacity), status: v.status }), "Đã cập nhật chuyến.", reload); });
        $$("[data-m]", el).forEach(b => b.onclick = async () => {
          const d = find(b.dataset.m);
          const modalBody = `<p>Chọn định dạng xuất tài liệu danh sách đoàn khởi hành ngày <b>${day(d.date)}</b>:</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
              <button class="btn" id="m-exp-pdf" style="padding:10px 16px;text-align:left;display:flex;align-items:center;gap:10px;"><span style="font-size:18px">🖨️</span> <div><b>In / Tải PDF phiếu điểm danh</b><div class="small muted">Bản in A4 có ô đánh dấu có mặt/vắng và chữ ký</div></div></button>
              <button class="btn" id="m-exp-word" style="padding:10px 16px;text-align:left;display:flex;align-items:center;gap:10px;"><span style="font-size:18px">📝</span> <div><b>Xuất Word (.doc)</b><div class="small muted">Tài liệu Microsoft Word kèm bảng thông tin hành khách</div></div></button>
              <button class="btn" id="m-exp-excel" style="padding:10px 16px;text-align:left;display:flex;align-items:center;gap:10px;"><span style="font-size:18px">📊</span> <div><b>Xuất Excel (.xls)</b><div class="small muted">Bảng tính Excel chuẩn UTF-8, cột số liệu rõ ràng</div></div></button>
              <button class="btn" id="m-exp-csv" style="padding:10px 16px;text-align:left;display:flex;align-items:center;gap:10px;"><span style="font-size:18px">📑</span> <div><b>Tải file CSV gốc</b><div class="small muted">Dành cho phần mềm hoặc máy quét mã vạch</div></div></button>
            </div>`;
          await Staff.modal("Xuất danh sách đoàn – " + d.tourName, modalBody, [{ label: "Đóng" }], {
            onOpen: (ov, close) => {
              const fetchManifestData = async () => {
                const res = await fetch(`/api/operator/departures/manifest.csv?tourId=${encodeURIComponent(d.tourId)}&date=${encodeURIComponent(d.date)}`);
                const txt = await res.text();
                const lines = txt.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
                const passengers = lines.slice(1).map(l => {
                  const parts = l.split(",").map(c => c.replace(/^["']|["']$/g, "").trim());
                  return { payCode: parts[0], customerName: parts[1], phone: parts[2], name: parts[3], dob: parts[4], gender: parts[5], idNumber: parts[6] };
                });
                return { tourName: d.tourName, date: d.date, guideName: (d.guides || []).join(", "), passengers };
              };
              ov.querySelector("#m-exp-pdf").onclick = async () => {
                const md = await fetchManifestData();
                if (window.DataExportImport) window.DataExportImport.exportDepartureManifest(md, "pdf");
                close();
              };
              ov.querySelector("#m-exp-word").onclick = async () => {
                const md = await fetchManifestData();
                if (window.DataExportImport) window.DataExportImport.exportDepartureManifest(md, "word");
                close();
              };
              ov.querySelector("#m-exp-excel").onclick = async () => {
                const md = await fetchManifestData();
                if (window.DataExportImport) window.DataExportImport.exportDepartureManifest(md, "excel");
                close();
              };
              ov.querySelector("#m-exp-csv").onclick = () => {
                dl(`/api/operator/departures/manifest.csv?tourId=${encodeURIComponent(d.tourId)}&date=${encodeURIComponent(d.date)}`);
                close();
              };
            }
          });
        });
        $$("[data-p]", el).forEach(b => b.onclick = async () => { const d = find(b.dataset.p); const v = await ask("Đề xuất hủy / dồn tour", [{ name: "reason", label: "Lý do đề xuất", type: "textarea", required: true }], { intro: `${esc(d.tourName)} – ${day(d.date)} – hiện ${d.pax}/${d.minGuests} khách tối thiểu. Đề xuất sẽ gửi Admin quyết định.`, submit: "Gửi Admin" }); if (v) act(null, () => post("/api/operator/cancel-proposals", { tourId: d.tourId, date: d.date, reason: v.reason }), "Đã gửi đề xuất cho Admin.", reload); });
      }
      await reload();
    } },
    { id: "reschedule", label: "Đổi ngày", icon: "📅", perm: "tour:schedule_manage", async badge() { return (await get("/api/operator/reschedule")).requests.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/operator/reschedule")).requests;
        el.innerHTML = `<div class="note">Kiểm tra chỗ và lịch HDV (kể cả ngày nghỉ) của ngày mới trước khi chốt.</div>` + table(orderCols([{ t: "Đổi sang", html: b => `<b>${day(b.reschedule.to)}</b><div class="small muted">${esc(b.reschedule.reason || "")}</div>` },
          { t: "Kiểm tra", html: b => `${b.check.seatsOk ? pill("Đủ chỗ (" + b.check.seatsLeft + ")", "ok") : pill("Hết chỗ", "bad")} ${b.check.guideOk ? pill("HDV rảnh", "ok") : pill("HDV bận", "bad")}${(b.check.guideProblems || []).map(p => `<div class="small">${esc(p)}</div>`).join("")}` },
          { t: "", html: b => `<div class="row" style="gap:6px"><button class="btn ok sm" data-y="${esc(b.id)}" ${b.check.seatsOk && b.check.guideOk ? "" : "disabled"}>Chốt</button><button class="btn bad sm" data-n="${esc(b.id)}">Từ chối</button></div>` }]), list, { empty: "Không có yêu cầu đổi ngày" });
        bindView(el);
        $$("[data-y]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/operator/reschedule/${b.dataset.y}`, { approve: true }), "Đã đổi ngày.", reload));
        $$("[data-n]", el).forEach(b => b.onclick = async () => { const v = await ask("Từ chối đổi ngày", [{ name: "note", label: "Lý do", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/operator/reschedule/${b.dataset.n}`, { approve: false, note: v.note }), "Đã từ chối.", reload); });
      }
      await reload();
    } },
    { id: "extensions", label: "Gia hạn đang đi", icon: "➕", perm: "tour:schedule_manage", async badge() { return (await get("/api/operator/extensions")).requests.length; }, async render(el) {
      const money = n => Number(n || 0).toLocaleString("vi-VN") + " ₫";
      async function reload() {
        const list = (await get("/api/operator/extensions")).requests;
        el.innerHTML = `<div class="note">Khách đang đi tour xin ở thêm. Kiểm tra HDV còn rảnh (kể cả ngày nghỉ sau tour), khách sạn và xe ngày mới trước khi duyệt. Duyệt xong khách mới thanh toán.</div>` + table(orderCols([
          { t: "Xin thêm", html: b => `<b>${esc(b.extension.days)} ngày</b><div class="small muted">${money(b.extension.amount)} · ${esc(b.extension.paymentCode)}</div>` },
          { t: "Kiểm tra", html: b => (b.problems || []).length ? (b.problems || []).map(p => pill(p, "bad")).join(" ") : pill("Đủ điều kiện", "ok") },
          { t: "", html: b => `<div class="row" style="gap:6px"><button class="btn ok sm" data-y="${esc(b.id)}|${b.extension.no}" ${(b.problems || []).length ? "disabled" : ""}>Duyệt</button><button class="btn bad sm" data-n="${esc(b.id)}|${b.extension.no}">Từ chối</button></div>` }]), list, { empty: "Không có yêu cầu" });
        bindView(el);
        $$("[data-y]", el).forEach(b => b.onclick = () => { const [id, no] = b.dataset.y.split("|"); act(b, () => post(`/api/operator/extensions/${id}/${no}`, { approve: true }), "Đã duyệt gia hạn.", reload); });
        $$("[data-n]", el).forEach(b => b.onclick = async () => { const [id, no] = b.dataset.n.split("|"); const v = await ask("Từ chối gia hạn", [{ name: "note", label: "Lý do", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/operator/extensions/${id}/${no}`, { approve: false, note: v.note }), "Đã từ chối.", reload); });
      }
      await reload();
    } },
    { id: "incidents", label: "Sự cố", icon: "🚨", perm: "incident:manage", async badge() { return (await get("/api/operator/incidents?status=open")).incidents.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/operator/incidents")).incidents;
        const open = list.filter(i => i.status !== "resolved");
        tabs(el, [{ id: "o", label: "Đang xử lý", n: open.length }, { id: "d", label: "Đã xử lý xong" }], (id, box) => {
          const rows = id === "o" ? open : list.filter(i => i.status === "resolved");
          box.innerHTML = table([{ t: "Lúc", html: i => dt(i.createdAt), sort: i => i.createdAt }, { t: "Đơn", html: i => `<b class="mono">${esc(i.payCode)}</b><div class="small muted">${esc(i.tourName)} · ${day(i.date)}</div>` }, { t: "Mức độ", html: i => pill(...(SEV[i.severity] || SEV.medium)) }, { t: "Mô tả", html: i => esc(i.description) + `<div class="small muted">HDV: ${esc(i.reportedByName)}</div>` },
            { t: "Xử lý", html: i => i.resolution ? esc(i.resolution) + `<div class="small muted">${esc(i.handledByName || "")} · ${dt(i.handledAt)}</div>` : (i.status === "acknowledged" ? pill("Đã tiếp nhận", "info") : pill("Mới", "bad")) },
            { t: "", html: i => i.status === "resolved" ? "" : `<div class="row" style="gap:6px">${i.status === "open" ? `<button class="btn sm" data-a="${esc(i.id)}">Tiếp nhận</button>` : ""}<button class="btn ok sm" data-r="${esc(i.id)}">Đã xử lý</button></div>` }], rows, { empty: "Không có sự cố" });
          $$("[data-a]", box).forEach(b => b.onclick = () => act(b, () => post(`/api/operator/incidents/${b.dataset.a}`, { status: "acknowledged" }), "Đã tiếp nhận.", reload));
          $$("[data-r]", box).forEach(b => b.onclick = async () => { const v = await ask("Đánh dấu đã xử lý", [{ name: "note", label: "Cách xử lý", type: "textarea", required: true }], { kind: "ok" }); if (v) act(null, () => post(`/api/operator/incidents/${b.dataset.r}`, { status: "resolved", note: v.note }), "Đã xử lý xong.", reload); });
        }, "o");
      }
      await reload();
    } },
    { id: "history", label: "Lịch sử hoạt động", icon: "🕘", perm: "activity:view_operator", async render(el) {
      const GROUP_CLS = { tour: "info", assign: "ok", schedule: "warn", incident: "bad", dispatch: "" };
      const bar = Parts.search(() => reload(), "Tìm mã đơn, người làm, nội dung…", '<button class="btn sm" id="hx">⬇️ CSV</button>');
      const tabsEl = h("<div></div>"), body = h("<div></div>"); el.append(bar, tabsEl, body);
      let rows = [], groups = [], cur = "";
      $("#hx", bar).onclick = () => csv("lich-su-dieu-hanh.csv", ["Lúc", "Nhóm", "Người làm", "Vai trò", "Hành động", "Đối tượng", "Chi tiết"], rows.map(e => [e.at, (groups.find(g => g.id === e.group) || {}).label || "", e.actorName, e.role, e.action, e.target, e.detail]));
      async function reload() {
        const r = await get(`/api/operator/activity?group=${encodeURIComponent(cur)}&q=${encodeURIComponent($("input", bar).value)}&limit=300`);
        rows = r.entries; groups = r.groups;
        tabsEl.innerHTML = `<div class="tabs">${[{ id: "", label: "Tất cả" }].concat(groups).map(g => `<button data-g="${esc(g.id)}" class="${g.id === cur ? "active" : ""}">${esc(g.label)}</button>`).join("")}</div>`;
        $$("[data-g]", tabsEl).forEach(b => b.onclick = () => { cur = b.dataset.g; reload().catch(fail); });
        body.innerHTML = table([{ t: "Lúc", html: e => dt(e.at), sort: e => e.at }, { t: "Nhóm", html: e => pill((groups.find(g => g.id === e.group) || {}).label || "", GROUP_CLS[e.group]) },
          { t: "Người làm", html: e => esc(e.actorName || "hệ thống") + `<div class="small muted">${esc(e.role || "")}</div>` }, { t: "Hành động", html: e => `<span class="mono">${esc(e.action)}</span>` }, { t: "Đơn / đối tượng", html: e => `<b class="mono">${esc(e.target)}</b>` }, { t: "Chi tiết", k: "detail" }], rows, { sortable: true, empty: "Chưa có hoạt động nào" });
      }
      await reload();
    } }
  ];
  Staff.boot({ roles: ["operator"], title: "Điều hành tour", sections });
})();
