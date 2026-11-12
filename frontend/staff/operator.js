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
    const availCount = (r.guides || []).filter(g => g.available).length;
    const warnNoGuide = availCount === 0
      ? `<div class="note bad" style="margin-bottom:12px"><b>⚠️ Không có HDV khả dụng:</b> Tất cả ${r.guides.length} HDV đều bận, đang nghỉ hoặc không phụ trách khu vực này. Bạn có thể bấm nút <b>"🚫 Không có HDV – Đề xuất hủy tour"</b> bên dưới để gửi Admin duyệt hủy tour và hoàn tiền cho khách.</div>`
      : "";
    const body = warnNoGuide + `<p class="muted">Đơn <b>${esc(b.payCode)}</b> – ${esc(b.tourName)} – đi ${day(b.date)} (cần HDV ${esc(GT[b.requiredGuideType] || "phù hợp")}). HDV không rảnh / không phù hợp bị khóa và hiện lý do.</p>` +
      table([{ t: "HDV", html: g => `<b>${esc(g.name)}</b><div class="small muted">${esc(GT[g.guideType] || g.guideType)} · ${esc(ET[g.employmentType] || g.employmentType)}</div>` }, { t: "Khu vực", html: g => esc((g.regions || []).join(", ")) }, { t: "Đánh giá", num: true, html: g => g.rating ? esc(g.rating) + " ★" : "—" }, { t: "Số tour tháng", num: true, k: "workload" },
        { t: "", html: g => g.available ? `<button class="btn ok sm" data-g="${esc(g.id)}">Chọn</button>` : `<span class="small" style="color:var(--bad)">${esc([g.fitProblem].concat(g.reasons || []).filter(Boolean).join("; "))}</span>` }], r.guides, { empty: "Chưa có HDV" });

    const modalBtns = [{ label: "Đóng" }];
    if (!replace) {
      modalBtns.push({ label: "🚫 Không có HDV – Đề xuất hủy tour", kind: "bad", value: "cancel_dep" });
    }

    await Staff.modal("Chọn hướng dẫn viên – " + b.payCode, body, modalBtns, { wide: true, onOpen: (ov, close) => {
      $$("[data-g]", ov).forEach(btn => btn.onclick = async () => {
        if (replace) {   // 6.6: thay HDV giữa chừng – bắt buộc lý do, HDV mới dẫn tiếp ngay
          const v = await ask("Thay HDV giữa chừng", [{ name: "reason", label: "Lý do thay HDV (ốm, tai nạn...)", type: "textarea", required: true }], { kind: "bad", submit: "Thay HDV" }); if (!v) return;
          const lock = $$("[data-g]", ov); lock.forEach(x => x.disabled = true);   // chặn bấm hai lần khi máy chủ đang xử lý
          const ok = await act(null, () => post(`/api/operator/bookings/${b.id}/replace-guide`, { guideId: btn.dataset.g, reason: v.reason }), "Đã thay HDV, khách và HDV mới đã được báo.");
          if (ok) { close(true); if (after) after().catch(fail); } else lock.forEach(x => x.disabled = false); return;
        }
        const lock = $$("[data-g]", ov); lock.forEach(x => x.disabled = true);   // chặn bấm hai lần khi máy chủ đang xử lý
        const ok = await act(null, () => post(`/api/operator/bookings/${b.id}/assign`, { guideId: btn.dataset.g }), "Đã gán HDV, chờ HDV trả lời.");
        if (ok) { close(true); if (after) after().catch(fail); } else lock.forEach(x => x.disabled = false);
      });

      const cancelBtn = $$(".acts button", ov).find(btn => btn.textContent.includes("Đề xuất hủy tour"));
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          const v = await ask("Đề xuất hủy tour do thiếu HDV", [
            { name: "reason", label: "Lý do đề xuất hủy tour (gửi Admin duyệt)", type: "textarea", value: `Không thể bố trí HDV phù hợp cho chuyến khởi hành ngày ${day(b.date)} (đơn ${b.payCode}).`, required: true }
          ], { kind: "bad", intro: `Chuyến <b>${esc(b.tourName)}</b> – ngày <b>${day(b.date)}</b>. Đề xuất sẽ gửi đến Admin phê duyệt hủy và hoàn tiền 100% cho khách hàng.`, submit: "Gửi Admin duyệt hủy" });
          if (!v) return;
          const ok = await act(cancelBtn, () => post("/api/operator/cancel-proposals", { tourId: b.tourId, date: b.date, reason: v.reason }), "Đã gửi đề xuất hủy tour do thiếu HDV cho Admin.");
          if (ok) { close(true); if (after) after().catch(fail); }
        };
      }
    } });
  }
  const orderCols = (extra) => [{ t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono">${esc(b.payCode)}</a>` }, { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">${b.pax} khách</div>` }, { t: "Ngày đi", html: b => day(b.date), sort: b => b.date }, ...extra];
  const bindView = el => $$("[data-view]", el).forEach(a => a.onclick = e => { e.preventDefault(); Parts.showOrder(`/api/operator/bookings/${a.dataset.view}`, "Chi tiết đơn").catch(fail); });

  const sections = [
    { id: "home", label: "Tổng quan", icon: "📈", perm: "stats:view_operator", async render(el) {
      const s = (await get("/api/operator/stats")).stats;
      const k = (l, v, c, href) => `<a href="${href || '#'}" class="kpi ${v && c ? c : ""}" style="text-decoration:none;cursor:pointer"><div class="l">${l}</div><div class="v">${v}</div></a>`;
      el.innerHTML = `<div class="grid g3">${k("Đơn chưa có HDV", s.unassigned, "warn", "#assign")}${k("Chờ HDV trả lời", s.guidePending, "", "#assign")}${k("HDV đã nhận", s.guideAccepted, "ok", "#assign")}${k("Chuyến đi trong 7 ngày", s.upcoming7d, "", "#departures")}${k("Sự cố đang mở", s.openIncidents, "bad", "#incidents")}${k("Chuyến có nguy cơ thiếu khách", s.atRiskDepartures, "warn", "#departures")}</div>
        <div class="note info">Trang này không hiển thị số tiền. Việc thanh toán do Thu ngân và Admin phụ trách.</div>`;
    } },
    { id: "assign", label: "Gán HDV", icon: "🧭", perm: "tour:assign_guide", async badge() {
        const q = await get("/api/operator/queue");
        return (q.unassigned.length || 0) + (q.rejected.length || 0);
      }, async render(el) {
      async function reload() {
        const q = await get("/api/operator/queue");
        const allList = [
          ...q.unassigned.map(x => ({ ...x, _tab: "u" })),
          ...q.rejected.map(x => ({ ...x, _tab: "r" })),
          ...q.pending.map(x => ({ ...x, _tab: "p" })),
          ...q.accepted.map(x => ({ ...x, _tab: "a" })),
          ...(q.running || []).map(x => ({ ...x, _tab: "g" }))
        ];
        allList.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        const tabItems = [
          { id: "u", label: "Chưa có HDV", n: q.unassigned.length },
          { id: "r", label: "HDV đã từ chối / quá hạn", n: q.rejected.length },
          { id: "p", label: "Chờ HDV trả lời", n: q.pending.length },
          { id: "a", label: "HDV đã nhận", n: q.accepted.length },
          { id: "g", label: "Đang đi tour", n: (q.running || []).length },
          { id: "all", label: "Tất cả đơn", n: allList.length }
        ];

        tabs(el, tabItems, (id, box) => {
          const list = id === "all" ? allList : { u: q.unassigned, r: q.rejected, p: q.pending, a: q.accepted, g: q.running || [] }[id];
          const actCol = { t: "Thao tác", nowrap: true, html: b => {
            const curState = id === "all" ? (b._tab || "u") : id;
            if (curState === "g") return `<button class="btn bad sm" data-rp="${esc(b.id)}">Thay HDV</button>`;
            if (curState === "a") return `<button class="btn sm" data-un="${esc(b.id)}">Gỡ / đổi</button>`;
            if (curState === "p") return `<button class="btn sm" data-un="${esc(b.id)}">Gỡ</button>`;
            return `<div class="row" style="gap:4px"><button class="btn primary sm" data-as="${esc(b.id)}">Chọn HDV</button><button class="btn bad sm" data-cancel-dep="${esc(b.id)}" title="Đề xuất hủy tour nếu thiếu HDV">🚫 Hủy tour</button></div>`;
          }};
          const stBadge = b => {
            const curState = id === "all" ? (b._tab || "u") : id;
            if (curState === "u") return `<span class="badge warn">Chưa có HDV</span>`;
            if (curState === "r") return `<span class="badge bad">Từ chối / quá hạn</span>`;
            if (curState === "p") return `<span class="badge info">Chờ HDV duyệt</span>`;
            if (curState === "a") return `<span class="badge ok">HDV đã nhận</span>`;
            if (curState === "g") return `<span class="badge">Đang đi</span>`;
            return "";
          };
          const extraCols = id === "all" ? [{ t: "Trạng thái", html: stBadge }] : [];

          let alertHtml = "";
          if (id === "u" && q.unassigned.length === 0 && q.pending.length > 0) {
            alertHtml = `<div class="note info" style="margin-bottom:12px">💡 <b>Hệ thống tự động điều phối:</b> Hiện không có đơn nào chưa có HDV. Có <b>${q.pending.length} đơn</b> vừa được hệ thống tự động gán HDV phù hợp nhất và đang ở tab <b>"Chờ HDV trả lời"</b> (hoặc bấm xem ở tab <b>"Tất cả đơn"</b>).</div>`;
          }

          box.innerHTML = alertHtml + table(orderCols([...extraCols, { t: "HDV", html: b => esc(b.guideName || "—") + issueBadge(b) + (b.assignment && b.assignment.deadline && (id === "p" || b._tab === "p") ? `<div class="small muted">Hạn trả lời ${dt(b.assignment.deadline)}</div>` : "") + (b.assignment && (b.assignment.rejected || []).length ? `<div class="small" style="color:var(--bad)">${b.assignment.rejected.map(r => esc(r.reason)).join("; ")}</div>` : "") }, actCol]), list, { sortable: true, empty: "Không có đơn nào" });
          bindView(box);
          $$("[data-rp]", box).forEach(btn => btn.onclick = () => pick(list.find(x => x.id === btn.dataset.rp), reload, true).catch(fail));
          $$("[data-as]", box).forEach(btn => btn.onclick = () => pick(list.find(x => x.id === btn.dataset.as), reload).catch(fail));
          $$("[data-un]", box).forEach(btn => btn.onclick = async () => { const v = await ask("Gỡ HDV khỏi đơn", [{ name: "reason", label: "Lý do", type: "textarea", required: true }], { kind: "bad", submit: "Gỡ HDV" }); if (v) act(null, () => post(`/api/operator/bookings/${btn.dataset.un}/unassign`, { reason: v.reason }), "Đã gỡ HDV.", reload); });
          $$("[data-cancel-dep]", box).forEach(btn => btn.onclick = async () => {
            const b = list.find(x => x.id === btn.dataset.cancelDep);
            if (!b) return;
            const v = await ask("Đề xuất hủy tour do thiếu HDV", [
              { name: "reason", label: "Lý do đề xuất hủy tour (gửi Admin duyệt)", type: "textarea", value: `Không thể bố trí HDV phù hợp cho chuyến khởi hành ngày ${day(b.date)} (đơn ${b.payCode}).`, required: true }
            ], { kind: "bad", intro: `Chuyến <b>${esc(b.tourName)}</b> – ngày <b>${day(b.date)}</b>. Đề xuất sẽ gửi đến Admin phê duyệt hủy và hoàn tiền 100% cho khách hàng.`, submit: "Gửi Admin duyệt hủy" });
            if (v) act(null, () => post("/api/operator/cancel-proposals", { tourId: b.tourId, date: b.date, reason: v.reason }), "Đã gửi đề xuất hủy tour do thiếu HDV cho Admin.", reload);
          });
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
          { t: "Thao tác", nowrap: true, cls: "actions", html: d => `<div class="act-btns"><button class="btn sm" data-s="${esc(d.key)}">Chỉnh chỗ/đóng bán</button><button class="btn sm" data-m="${esc(d.key)}">Danh sách đoàn</button>${d.cancelled ? "" : `<button class="btn sm" data-p="${esc(d.key)}">Đề xuất hủy</button>`}</div>` }], list, { sortable: true, empty: "Chưa có chuyến nào" });
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

    { id: "tour-pool", label: "Ghép tour & Gom đoàn", icon: "🤝", perm: "tour:schedule_manage", async render(el) {
      el.innerHTML = `
        <div class="card">
          <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <h2 style="margin:0">🤝 Ghép Tour & Gom Đoàn Điều Hành</h2>
              <div class="muted small" style="margin-top:4px">Quét AI & RAG ghép các đoàn khách nhỏ lẻ, gom đủ số lượng tối thiểu để khởi hành hoặc ghép tay trực tiếp.</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ok" id="op-btn-ai-scan">🤖 AI Quét & Gợi ý ghép (RAG)</button>
              <button class="btn" id="op-btn-manual-merge">✋ Ghép đoàn bằng tay</button>
            </div>
          </div>
        </div>
        <div id="op-pool-ai-box" style="display:none;margin-bottom:16px"></div>
        <div id="op-pool-list-box"></div>
      `;

      const aiBox = $("#op-pool-ai-box", el);
      const listBox = $("#op-pool-list-box", el);

      async function reload() {
        const [poolsRes, bookingsRes] = await Promise.all([
          get("/api/admin/tours/pool").catch(() => ({ pools: [] })),
          get("/api/operator/queue").catch(() => ({ unassigned: [], accepted: [] }))
        ]);
        const pools = poolsRes.pools || [];

        listBox.innerHTML = `
          <div class="card">
            <h3 style="margin:0 0 12px">Danh sách các đoàn đang gom khách (${pools.length})</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:14px">
              ${pools.map(p => {
                const cur = p.currentPax || 0, min = p.minPax || 10, max = p.maxPax || 16;
                const isReady = cur >= min;
                const pct = Math.min(100, Math.round((cur / min) * 100));
                return `
                <div class="card" style="border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--surface)">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span class="badge ${p.status === 'open' ? 'ok' : 'info'}">${p.status === 'open' ? 'Đang gom' : 'Chờ đi'}</span>
                    <span class="badge amber">Ưu đãi -${p.discountPercent || 10}%</span>
                  </div>
                  <h4 style="margin:0 0 4px">${esc(p.tourName)}</h4>
                  <div class="small muted" style="margin-bottom:8px">📍 ${esc(p.destination)} · Ngày: <b>${day(p.date)}</b></div>
                  <div style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                      <span>Tiến độ: <b>${cur}/${min} khách</b></span>
                      <b style="color:${isReady ? 'var(--ok)' : 'var(--accent)'}">${pct}%</b>
                    </div>
                    <div style="width:100%;height:8px;background:var(--border);border-radius:99px;overflow:hidden">
                      <div style="width:${pct}%;height:100%;background:${isReady ? 'var(--ok)' : 'var(--accent)'};border-radius:99px"></div>
                    </div>
                  </div>
                  <button class="btn sm ok" style="width:100%" data-op-merge-to="${esc(p.id)}">➕ Chọn đơn ghép vào đoàn này</button>
                </div>`;
              }).join("")}
            </div>
          </div>
        `;

        $("#op-btn-ai-scan", el).onclick = async () => {
          aiBox.style.display = "block";
          aiBox.innerHTML = `<div class="note info">🤖 AI & RAG đang quét đối chiếu các đơn tour lẻ và gợi ý tuyến ghép...</div>`;
          const aiRes = await post("/api/admin/tours/pool/ai-match", {});
          const sugs = aiRes.smartSuggestions || [];
          aiBox.innerHTML = `
            <div class="card" style="border:2px solid var(--primary);background:#f0fdf4">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <b style="color:var(--ok)">🤖 Đề xuất ghép từ AI & RAG (${sugs.length} cặp ghép):</b>
                <button class="btn sm" id="op-close-ai">Đóng</button>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:12px">
                ${sugs.map(s => `
                  <div class="card" style="background:#fff;border:1px solid #bbf7d0;padding:12px;border-radius:8px">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
                      <span class="badge ok">Độ khớp: ${s.confidence}%</span>
                      <span class="badge info">${esc(s.targetVehicle)}</span>
                    </div>
                    <div style="font-weight:700;margin-bottom:4px">${esc(s.destination)} · Ngày ${day(s.suggestedDate)}</div>
                    <div class="small muted" style="margin-bottom:8px">Ghép Đơn <b>${esc(s.booking1.code)}</b> (${s.booking1.pax}k) + Đơn <b>${esc(s.booking2.code)}</b> (${s.booking2.pax}k) ➔ Đoàn <b>${s.combinedPax} khách</b>.</div>
                    <div class="small" style="color:#166534;margin-bottom:8px">${esc(s.aiReason)}</div>
                    <button class="btn ok sm" style="width:100%" data-op-ai-act="${esc(s.booking1.id)},${esc(s.booking2.id)}">⚡ Duyệt ghép ngay</button>
                  </div>
                `).join("")}
              </div>
            </div>`;
          $("#op-close-ai", aiBox).onclick = () => aiBox.style.display = "none";
          $$("[data-op-ai-act]", aiBox).forEach(b => b.onclick = async () => {
            const bids = b.dataset.opAiAct.split(",");
            if (await confirmBox("Xác nhận ghép đoàn", `Điều hành xác nhận ghép 2 đơn ${bids.join(" & ")} thành chuyến đi chung?`)) {
              act(null, () => post("/api/admin/tours/pool/merge", { poolId: "pool_dn_2026", bookingIds: bids, note: "Điều hành duyệt ghép đoàn theo gợi ý AI" }), "Đã ghép đoàn thành công!", reload);
              aiBox.style.display = "none";
            }
          });
        };

        $("#op-btn-manual-merge", el).onclick = async () => {
          const bks = (await get("/api/admin/bookings?status=")).bookings || [];
          const eligible = bks.filter(b => !['cancelled','refunded'].includes(b.status));
          const pOpts = pools.map(p => [p.id, `${p.tourName} (${day(p.date)})`]);
          const bOpts = eligible.map(b => [b.id, `${b.payCode} – ${b.customerName} (${b.pax}k - ${b.tourName})`]);

          const v = await ask("✋ Ghép đoàn bằng tay", [
            { name: "poolId", label: "Đoàn ghép đích", type: "select", options: pOpts },
            { name: "b1", label: "Đơn tour 1", type: "select", options: bOpts },
            { name: "b2", label: "Đơn tour 2", type: "select", options: bOpts },
            { name: "note", label: "Ghi chú điều hành", type: "textarea" }
          ]);
          if (v && v.b1 !== v.b2) {
            act(null, () => post("/api/admin/tours/pool/merge", { poolId: v.poolId, bookingIds: [v.b1, v.b2], note: v.note }), "Đã ghép đoàn.", reload);
          }
        };

        $$("[data-op-merge-to]", listBox).forEach(btn => btn.onclick = async () => {
          const pid = btn.dataset.opMergeTo;
          const bks = (await get("/api/admin/bookings?status=")).bookings || [];
          const eligible = bks.filter(b => !['cancelled','refunded'].includes(b.status));
          const v = await ask("Ghép thêm đơn vào đoàn", [
            { name: "bid", label: "Chọn đơn cần ghép", type: "select", options: eligible.map(b => [b.id, `${b.payCode} – ${b.customerName} (${b.pax}k)`]) },
            { name: "note", label: "Ghi chú", type: "text" }
          ]);
          if (v) act(null, () => post("/api/admin/tours/pool/merge", { poolId: pid, bookingIds: [v.bid], note: v.note }), "Đã ghép đơn.", reload);
        });
      }

      await reload();
    } },
    { id: "reschedule", label: "Đổi ngày", icon: "📅", perm: "tour:schedule_manage", async badge() { return (await get("/api/operator/reschedule")).requests.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/operator/reschedule")).requests;
        el.innerHTML = `<div class="note">Kiểm tra chỗ và lịch HDV (kể cả ngày nghỉ) của ngày mới trước khi chốt.</div>` + table(orderCols([{ t: "Đổi sang", html: b => `<b>${day(b.reschedule.to)}</b><div class="small muted">${esc(b.reschedule.reason || "")}</div>` },
          { t: "Kiểm tra", html: b => `${b.check.seatsOk ? pill("Đủ chỗ (" + b.check.seatsLeft + ")", "ok") : pill("Hết chỗ", "bad")} ${b.check.guideOk ? pill("HDV rảnh", "ok") : pill("HDV bận", "bad")}${(b.check.guideProblems || []).map(p => `<div class="small">${esc(p)}</div>`).join("")}` },
          { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn ok sm" data-y="${esc(b.id)}" ${b.check.seatsOk && b.check.guideOk ? "" : "disabled"}>Chốt</button><button class="btn bad sm" data-n="${esc(b.id)}">Từ chối</button></div>` }]), list, { empty: "Không có yêu cầu đổi ngày" });
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
          { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn ok sm" data-y="${esc(b.id)}|${b.extension.no}" ${(b.problems || []).length ? "disabled" : ""}>Duyệt</button><button class="btn bad sm" data-n="${esc(b.id)}|${b.extension.no}">Từ chối</button></div>` }]), list, { empty: "Không có yêu cầu" });
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
            { t: "Thao tác", nowrap: true, cls: "actions", html: i => i.status === "resolved" ? "" : `<div class="act-btns">${i.status === "open" ? `<button class="btn sm" data-a="${esc(i.id)}">Tiếp nhận</button>` : ""}<button class="btn ok sm" data-r="${esc(i.id)}">Đã xử lý</button></div>` }], rows, { empty: "Không có sự cố" });
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
