/* Quản trị viên: duyệt đơn, hoàn tiền, đóng sổ, hủy tour, nội dung tour, nhân viên, cấu hình, nhật ký, thống kê. KHÔNG có xác nhận tiền / chuyển tiền hoàn (tách quyền với Thu ngân). */
(() => {
  const { esc, money, compactMoney, dt, day, badge, pill, h, $, $$, get, post, put, del, ask, confirmBox, act, table, toast, fail, tabs, barChart, lineChart, donut, csv } = Staff;
  const SRC = { customer_cancel: "Khách hủy", admin_reject: "Admin từ chối", company_cancel: "Công ty hủy", complaint: "Đền bù khiếu nại", balance_overdue: "Quá hạn thu nốt" };
  const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  async function viewOrder(id) { await Parts.showOrder(`/api/admin/bookings/${encodeURIComponent(id)}`, "Chi tiết đơn"); }
  const bindView = (el) => $$("[data-view]", el).forEach(b => b.onclick = () => viewOrder(b.dataset.view).catch(fail));

  // ── Modal Chi tiết Hồ sơ Nhân viên & Nghiệp vụ Lương, KPI, Xét tăng lương (Dùng chung) ──
  async function openStaffProfileModal(staffId, onUpdate) {
    async function fetchAndRender() {
      const res = await get(`/api/admin/staff/${encodeURIComponent(staffId)}/salary-profile`);
      if (!res || !res.profile) {
        Staff.toast("Không tải được hồ sơ nhân viên", "bad");
        return;
      }
      const p = res.profile;
      const hist = res.history || [];

      let dueBadge = '';
      if (p.isDue) {
        dueBadge = '<span class="badge bad" style="font-size:0.85rem">🔔 Đã đến hạn xét tăng lương</span>';
      } else if (p.isUpcoming) {
        dueBadge = `<span class="badge warn" style="font-size:0.85rem">⚠️ Sắp đến hạn xét (${p.daysUntilReview} ngày nữa)</span>`;
      } else {
        dueBadge = `<span class="badge info" style="font-size:0.85rem">Còn ${p.daysUntilReview} ngày tới hạn</span>`;
      }

      const kpiVal = p.kpiRecent != null ? p.kpiRecent : p.kpi;
      const kpiRating = p.kpiRating || (kpiVal != null ? (kpiVal >= 90 ? 'Xuất sắc' : (kpiVal >= 80 ? 'Tốt' : 'Khá')) : null);
      const kpiBadge = kpiVal != null
        ? `<span class="badge ${kpiVal >= 80 ? 'ok' : (kpiVal >= 60 ? 'info' : 'bad')}">${kpiVal}% (${esc(kpiRating)})</span>`
        : '<span class="muted">Chưa đánh giá KPI</span>';

      const statusBadge = p.locked ? pill("Đã khóa", "bad") : pill({ active: "Đang làm việc", probation: "Thử việc", suspended: "Tạm hoãn", resigned: "Đã nghỉ việc" }[p.workingStatus] || "Đang làm việc", "ok");

      const contentHtml = `
        <div style="width:100%;box-sizing:border-box">
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.2rem">${esc(p.initials || "NV")}</div>
              <div>
                <h3 style="margin:0;font-size:1.2rem">${esc(p.name)} <span class="mono muted" style="font-size:0.85rem">(${esc(p.id)})</span></h3>
                <div class="muted small">${esc(p.email)} · ${esc(Staff.ROLE_NAME[p.role] || p.role)} · ${statusBadge}</div>
              </div>
            </div>
            <div>
              ${dueBadge}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:12px;margin-bottom:16px;width:100%;box-sizing:border-box">
            <div class="kpi" style="padding:12px;margin:0">
              <div class="l">Ngày vào làm</div>
              <div class="v" style="font-size:1.05rem">${day(p.startDate)}</div>
              <div class="s">Hợp đồng lao động</div>
            </div>
            <div class="kpi ok" style="padding:12px;margin:0">
              <div class="l">Lương cơ bản hiện tại</div>
              <div class="v" style="font-size:1.15rem;color:var(--ok)">${money(p.baseSalary)}</div>
              <div class="s">${p.role === "guide" ? (p.baseSalary > 0 ? "Lương cứng + thù lao tour (3–7%)" : "Thù lao tour (7–12% theo quy chế)") : "Chưa gồm phụ cấp & thưởng"}</div>
            </div>
            <div class="kpi ${p.isDue ? 'bad' : (p.isUpcoming ? 'warn' : '')}" style="padding:12px;margin:0">
              <div class="l">Hạn xét tăng lương</div>
              <div class="v" style="font-size:1.05rem">${day(p.nextReviewDate)}</div>
              <div class="s">${p.isDue ? 'Đủ 12 tháng – Cần xét ngay' : (p.isUpcoming ? 'Sắp đến hạn xét định kỳ' : 'Chu kỳ xét 12 tháng')}</div>
            </div>
            <div class="kpi" style="padding:12px;margin:0">
              <div class="l">KPI gần nhất</div>
              <div class="v" style="font-size:1.05rem">${kpiBadge}</div>
              <div class="s">${esc(p.kpiPeriod || "Kỳ đánh giá 2026")}</div>
            </div>
          </div>

          <!-- Thẻ dự báo xét tăng lương -->
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:16px;width:100%;box-sizing:border-box">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
              <div style="flex:1;min-width:240px">
                <b style="font-size:0.95rem">📊 Thông tin & Dự kiến xét tăng lương:</b>
                <div class="small muted" style="margin-top:4px">
                  Tỷ lệ tăng lương theo kết quả KPI: <b>+${p.expectedRaisePercent}%</b> 
                  ${kpiRating ? `(Xếp loại: <b>${esc(kpiRating)}</b>)` : ''} 
                  → Lương mới dự kiến: <b style="color:var(--ok);font-size:1rem">${money(p.expectedNewSalary)} / tháng</b>
                  ${p.expectedRaisePercent > 0 ? ` (+${money(p.expectedNewSalary - p.baseSalary)})` : ''}
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn sm" id="m-kpi-btn" title="Chấm điểm KPI cho nhân viên">📝 Đánh giá KPI</button>
                <button class="btn ok sm" id="m-rev-btn" title="Xét tăng lương định kỳ 12 tháng dựa trên KPI">📈 Xét tăng lương</button>
                <button class="btn primary sm" id="m-early-btn" title="Tăng lương trước hạn do thăng chức hoặc thành tích">⚡ Tăng trước hạn</button>
              </div>
            </div>
            ${p.kpiNote ? `<div class="small muted" style="margin-top:8px;font-style:italic">Ghi chú đánh giá KPI: "${esc(p.kpiNote)}"</div>` : ''}
          </div>

          <!-- Bảng lịch sử thay đổi lương -->
          <div style="width:100%;box-sizing:border-box">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <h4 style="margin:0">📜 Lịch sử thay đổi lương (${hist.length} bản ghi)</h4>
              <span class="small muted">Lưu trữ vĩnh viễn, không ghi đè dữ liệu cũ</span>
            </div>
            <div class="tbl-wrap" style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;width:100%;box-sizing:border-box;margin-bottom:0">
              <table style="width:100%;min-width:620px;font-size:0.85rem;margin:0">
                <thead>
                  <tr>
                    <th>Ngày áp dụng</th>
                    <th>Lương cũ</th>
                    <th>Lương mới</th>
                    <th>% Tăng</th>
                    <th>KPI</th>
                    <th>Xếp loại</th>
                    <th>Lý do / Căn cứ</th>
                    <th>Người duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  ${hist.length === 0 ? '<tr><td colspan="8" class="muted center" style="padding:16px">Chưa có lịch sử thay đổi lương</td></tr>' : hist.map(h => `
                    <tr>
                      <td>${day(h.effectiveDate)}</td>
                      <td>${h.oldSalary > 0 ? money(h.oldSalary) : '—'}</td>
                      <td><b>${money(h.newSalary)}</b></td>
                      <td>${h.increasePercent > 0 ? `<b style="color:var(--ok)">+${h.increasePercent}%</b>` : '<span class="muted">0%</span>'}</td>
                      <td>${h.kpi != null ? `${h.kpi}%` : '—'}</td>
                      <td>${h.kpiRating ? `<span class="badge ${h.kpi >= 80 ? 'ok' : 'info'}">${esc(h.kpiRating)}</span>` : '—'}</td>
                      <td>${esc(h.reason || '—')}</td>
                      <td>${esc(h.approvedByName || h.approvedBy || 'Admin')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      let closeProfileModal = null;
      Staff.modal(`Hồ sơ & Quản lý Lương: ${p.name}`, contentHtml, [
        { label: "Đóng", kind: "ghost" }
      ], {
        wide: true,
        onOpen: (ov, close) => {
          closeProfileModal = close;
          const modalBox = $(".modal", ov);
          if (modalBox) {
            modalBox.style.maxWidth = "960px";
            modalBox.style.width = "95vw";
          }

          // Sự kiện Đánh giá KPI
          const kpiBtn = $("#m-kpi-btn", ov);
          if (kpiBtn) kpiBtn.onclick = async () => {
            const v = await ask(`Đánh giá KPI cho ${p.name}`, [
              { name: "kpi", label: "Điểm KPI (0 - 100%)", type: "number", value: kpiVal != null ? kpiVal : 85, required: true, hint: ">=90%: Xuất sắc (+10%) | 80-89%: Tốt (+7%) | 70-79%: Khá (+5%) | 60-69%: Đạt (+3%) | <60%: Không đạt (0%)" },
              { name: "period", label: "Kỳ đánh giá", type: "text", value: "Kỳ đánh giá " + new Date().getFullYear(), required: true },
              { name: "note", label: "Nhận xét / Đánh giá chi tiết", type: "textarea", placeholder: "Ghi nhận đóng góp, hiệu quả công việc và thái độ..." }
            ], { kind: "ok", submit: "Lưu kết quả KPI" });
            if (v) {
              await post(`/api/admin/staff/${p.id}/kpi-evaluate`, { kpi: Number(v.kpi), period: v.period, note: v.note });
              Staff.toast("Đã lưu kết quả đánh giá KPI thành công.", "ok");
              if (closeProfileModal) closeProfileModal();
              if (onUpdate) onUpdate();
              openStaffProfileModal(staffId, onUpdate);
            }
          };

          // Sự kiện Xét tăng lương định kỳ
          const revBtn = $("#m-rev-btn", ov);
          if (revBtn) revBtn.onclick = async () => {
            if (kpiVal == null) {
              Staff.toast("Nhân viên chưa có kết quả đánh giá KPI. Vui lòng bấm 'Đánh giá KPI' trước khi xét tăng lương.", "bad");
              return;
            }
            const confirmMsg = `
              <div style="font-size:0.95rem;line-height:1.6">
                <div>Nhân viên: <b>${esc(p.name)}</b> (${esc(p.id)})</div>
                <div>Lương cơ bản hiện tại: <b>${money(p.baseSalary)}</b></div>
                <div>Kết quả KPI: <b class="badge ${kpiVal >= 80 ? 'ok' : 'info'}">${kpiVal}% (${esc(kpiRating || 'Tốt')})</b></div>
                <div>Tỷ lệ tăng theo quy chế: <b style="color:var(--ok)">+${p.expectedRaisePercent}%</b></div>
                <div>Mức lương mới sau xét duyệt: <b style="color:var(--ok);font-size:1.1rem">${money(p.expectedNewSalary)} / tháng</b></div>
                <div class="note info" style="margin-top:10px">Kỳ xét tăng lương tiếp theo sẽ tự động được gia hạn thêm <b>12 tháng</b>.</div>
              </div>
            `;
            const v = await ask("Xác nhận xét tăng lương định kỳ 12 tháng", [
              { name: "note", label: "Ghi chú phê duyệt", type: "text", value: `Xét định kỳ 12 tháng theo KPI ${kpiVal}% (${kpiRating || 'Tốt'})` }
            ], {
              intro: confirmMsg,
              kind: "ok",
              submit: "Phê duyệt tăng lương"
            });
            if (v) {
              await post(`/api/admin/staff/${p.id}/salary-review`, { note: v.note });
              Staff.toast("Đã phê duyệt điều chỉnh lương định kỳ thành công.", "ok");
              if (closeProfileModal) closeProfileModal();
              if (onUpdate) onUpdate();
              openStaffProfileModal(staffId, onUpdate);
            }
          };

          // Sự kiện Tăng lương trước hạn
          const earlyBtn = $("#m-early-btn", ov);
          if (earlyBtn) earlyBtn.onclick = async () => {
            const v = await ask(`Tăng lương trước hạn cho ${p.name}`, [
              {
                name: "reasonType",
                label: "Lý do tăng trước hạn",
                type: "select",
                options: [
                  ["promotion", "Thăng chức (Áp dụng khung lương chức danh mới)"],
                  ["outstanding", "Thành tích nổi bật / Dự án xuất sắc"],
                  ["responsibility", "Đảm nhận thêm phạm vi trách nhiệm mới"],
                  ["position_adjustment", "Điều chỉnh theo vị trí công việc"],
                  ["other", "Lý do đặc biệt khác"]
                ]
              },
              { name: "newSalary", label: "Mức lương mới (₫ / tháng)", type: "number", value: Math.round(p.baseSalary * 1.15 / 1000) * 1000, required: true, hint: `Mức lương hiện tại: ${money(p.baseSalary)}. Không bị giới hạn 3–10% khi thăng chức.` },
              { name: "effectiveDate", label: "Ngày bắt đầu áp dụng", type: "date", value: new Date().toISOString().slice(0, 10), required: true },
              { name: "reason", label: "Quyết định & Căn cứ chi tiết", type: "textarea", required: true, placeholder: "Mô tả lý do thăng chức, thành tích nổi bật hoặc quyết định bổ nhiệm..." }
            ], {
              kind: "ok",
              submit: "Phê duyệt tăng trước hạn",
              intro: `<div class="note info">Trường hợp thăng chức hoặc thành tích nổi bật, Ban Giám Đốc có thể chỉ định mức lương mới vượt khung 10% của xét định kỳ. Ngày xét lương tiếp theo sẽ được tính 12 tháng kể từ ngày áp dụng này.</div>`
            });
            if (v) {
              await post(`/api/admin/staff/${p.id}/salary-early-raise`, {
                newSalary: Number(v.newSalary),
                reasonType: v.reasonType,
                reason: v.reason,
                effectiveDate: v.effectiveDate
              });
              Staff.toast("Đã phê duyệt tăng lương trước hạn thành công.", "ok");
              if (closeProfileModal) closeProfileModal();
              if (onUpdate) onUpdate();
              openStaffProfileModal(staffId, onUpdate);
            }
          };
        }
      });
    }

    await fetchAndRender();
  }
  window.__openStaffProfileModal = openStaffProfileModal;

  const sections = [

    { id: "stats", label: "Tổng quan & thống kê", icon: "📊", group: "Tổng quan", perm: "stats:view_full", async render(el) {
      const now = new Date();
      const savedView = localStorage.getItem("travel_admin_stats_view");
      const st = {
        period: "year",
        year: now.getFullYear(),
        quarter: Math.floor(now.getMonth() / 3) + 1,
        month: now.getMonth() + 1,
        day: now.toISOString().slice(0, 10),
        view: savedView === "table" ? "table" : "chart",
        chartType: "bar"
      };

      const bar = h(`<div class="toolbar" style="gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
        <div class="seg-group" id="p-seg" title="Chọn kỳ thống kê">
          <button data-p="year" class="${st.period === "year" ? "active" : ""}">📅 Năm</button>
          <button data-p="quarter" class="${st.period === "quarter" ? "active" : ""}">📊 Quý</button>
          <button data-p="month" class="${st.period === "month" ? "active" : ""}">🗓️ Tháng</button>
          <button data-p="day" class="${st.period === "day" ? "active" : ""}">📆 Ngày</button>
        </div>
        <div class="row ${st.period === "day" ? "hidden" : ""}" id="y-ctrls" style="gap:4px">
          <button class="btn sm" id="y-prev" title="Năm trước">◀</button>
          <input type="number" id="sy" style="width:85px;text-align:center;font-weight:700" value="${st.year}" min="1986" max="2100" aria-label="Năm">
          <button class="btn sm" id="y-next" title="Năm sau">▶</button>
        </div>
        <div class="pills-group ${st.period === "quarter" ? "" : "hidden"}" id="q-pills">
          ${[1, 2, 3, 4].map(q => `<button class="pill-btn ${st.quarter === q ? "active" : ""}" data-q="${q}">Quý ${q}</button>`).join("")}
        </div>
        <div class="pills-group ${st.period === "month" ? "" : "hidden"}" id="m-pills">
          ${MONTHS.map((m, i) => `<button class="pill-btn ${st.month === i + 1 ? "active" : ""}" data-m="${i + 1}">Tháng ${i + 1}</button>`).join("")}
        </div>
        <div class="row ${st.period === "day" ? "" : "hidden"}" id="d-ctrls" style="gap:6px;align-items:center;flex-wrap:wrap">
          <input type="date" id="sd" value="${st.day}" style="padding:4px 8px;font-weight:700">
          <button class="btn sm" id="d-today">Hôm nay</button>
          <button class="btn ok sm" id="btn-admin-add-rev">➕ Thêm doanh thu ngày</button>
          <button class="btn sm" id="btn-admin-import-rev">📥 Nhập Excel/CSV</button>
        </div>
        <div class="grow"></div>
        <div class="seg-group ${st.period === "day" ? "hidden" : ""}" id="v-seg" title="Chế độ hiển thị">
          <button data-v="chart" class="${st.view === "chart" ? "active" : ""}">📊 Biểu đồ</button>
          <button data-v="table" class="${st.view === "table" ? "active" : ""}">📋 Bảng số liệu</button>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn sm" id="sc-excel" title="Xuất file Excel (.xls)">📊 Excel</button>
          <button class="btn sm" id="sc-word" title="Xuất tài liệu Word (.doc)">📝 Word</button>
          <button class="btn sm" id="sc-pdf" title="In hoặc lưu PDF">🖨️ PDF</button>
          <button class="btn sm" id="sc" title="Tải file CSV">⬇️ CSV</button>
        </div>
      </div>`);

      const breadcrumb = h(`<div class="drill-nav"></div>`);
      const body = h("<div></div>");
      el.append(bar, breadcrumb, body);

      let data = null;

      const updateNav = () => {
        let bc = `<a data-drill-p="year">Năm ${st.year}</a>`;
        if (st.period === "quarter") {
          bc += ` <span style="color:var(--muted)">›</span> <b>Quý ${st.quarter}</b>`;
        } else if (st.period === "month") {
          const qOfM = Math.floor((st.month - 1) / 3) + 1;
          bc += ` <span style="color:var(--muted)">›</span> <a data-drill-p="quarter" data-drill-q="${qOfM}">Quý ${qOfM}</a> <span style="color:var(--muted)">›</span> <b>Tháng ${st.month}</b>`;
        }
        breadcrumb.innerHTML = `<span>📍 Đang xem:</span> ${bc} ${st.period !== "year" ? `<button class="btn sm" id="btn-back-year" style="margin-left:auto;padding:2px 8px;font-size:12px">← Quay lại cả năm</button>` : ""}`;
        $$("[data-drill-p]", breadcrumb).forEach(a => a.onclick = () => {
          st.period = a.dataset.drillP;
          if (a.dataset.drillQ) st.quarter = +a.dataset.drillQ;
          load().catch(fail);
        });
        const backBtn = $("#btn-back-year", breadcrumb);
        if (backBtn) backBtn.onclick = () => { st.period = "year"; load().catch(fail); };
      };

      const drawDay = () => {
        const s = (data && data.stats) || {};
        const items = s.items || [];
        const recent = s.recentDays || [];

        // Cập nhật toolbar visual states
        $$("#p-seg button", bar).forEach(b => b.classList.toggle("active", b.dataset.p === st.period));
        $("#y-ctrls", bar)?.classList.add("hidden");
        $("#q-pills", bar)?.classList.add("hidden");
        $("#m-pills", bar)?.classList.add("hidden");
        $("#d-ctrls", bar)?.classList.remove("hidden");
        $("#v-seg", bar)?.classList.add("hidden");
        if ($("#sd", bar)) $("#sd", bar).value = st.day;

        breadcrumb.innerHTML = `<span>📍 Đang xem:</span> <b>Doanh thu ngày ${day(st.day)}</b> <button class="btn sm" id="btn-back-year" style="margin-left:auto;padding:2px 8px;font-size:12px">← Quay lại thống kê năm</button>`;
        const backBtn = $("#btn-back-year", breadcrumb);
        if (backBtn) backBtn.onclick = () => { st.period = "year"; load().catch(fail); };

        body.innerHTML = `
          ${recent.length ? `
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">
            ${recent.map(d => `
              <button class="pill-btn ${d.date === st.day ? "active" : ""}" data-pick-date="${esc(d.date)}" style="flex-shrink:0">
                ${day(d.date)}: <b>${money(d.net)}</b> (${d.transactionCount} GD)
              </button>
            `).join("")}
          </div>` : ""}

          <div class="note info">Số liệu ngày <b>${day(s.date || st.day)}</b> (giờ Việt Nam): gồm các giao dịch từ đơn tour và các khoản ghi nhận thêm tại quầy / thủ công.</div>
          <div class="grid g4" style="margin-bottom:18px">
            <div class="kpi ok"><div class="l">Tổng đã thu</div><div class="v">${money(s.totalCollected)}</div><div class="s">${s.transactionCount || 0} giao dịch</div></div>
            <div class="kpi"><div class="l">Đã hoàn</div><div class="v">${money(s.totalRefunded)}</div></div>
            <div class="kpi"><div class="l">Thực thu (thu − hoàn)</div><div class="v">${money(s.net)}</div></div>
            <div class="kpi ${s.awaiting ? "warn" : ""}"><div class="l">Đơn chờ thu tiền</div><div class="v">${s.awaiting || 0}</div></div>
          </div>

          <div class="card">
            <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <h2 style="margin:0">Danh sách giao dịch trong ngày (${items.length})</h2>
              <div class="row" style="gap:6px">
                <button class="btn ok sm" id="btn-day-add">➕ Thêm doanh thu ngày</button>
                <button class="btn sm" id="btn-day-import">📥 Nhập Excel/CSV</button>
              </div>
            </div>
            <div id="day-tbl-box"></div>
          </div>
        `;

        const tblBox = $("#day-tbl-box", body);
        tblBox.innerHTML = table([
          { t: "Mã GD / Đơn", html: r => `<b class="mono">${esc(r.payCode || r.id)}</b>` },
          { t: "Khách hàng", k: "customerName" },
          { t: "Tour / Dịch vụ", k: "tourName" },
          { t: "Loại thu", html: r => `<span class="badge ${r.isRefund ? "bad" : "ok"}">${esc(r.kindLabel || r.kind)}</span>` },
          { t: "Số tiền", num: true, html: r => `<b style="color:${r.isRefund ? "var(--bad)" : "var(--ok)"}">${r.isRefund ? "-" : "+"}${money(r.amount)}</b>` },
          { t: "Thời gian", html: r => dt(r.at) },
          { t: "Người ghi nhận", k: "byName" },
          { t: "Ghi chú", html: r => esc(r.note || "—") },
          { t: "Thao tác", html: r => {
            if (r.id && r.id.startsWith("dr_")) {
              return `<button class="btn bad sm" data-del-dr="${esc(r.id)}">Xóa</button>`;
            }
            if (r.bookingId) {
              return `<button class="btn sm" data-view="${esc(r.bookingId)}">Xem đơn</button>`;
            }
            return "";
          }}
        ], items, { empty: "Chưa có giao dịch nào trong ngày này" });

        $$("[data-pick-date]", body).forEach(btn => btn.onclick = () => {
          st.day = btn.dataset.pickDate;
          load().catch(fail);
        });

        $$("[data-del-dr]", body).forEach(btn => btn.onclick = async () => {
          const ok = await confirmBox("Xác nhận xóa khoản doanh thu này?", "Xóa", "Hủy");
          if (!ok) return;
          await act(btn, () => del(`/api/admin/daily-revenue/${btn.dataset.delDr}`), "Đã xóa khoản doanh thu.", () => load().catch(fail));
        });

        bindView(body);

        const addBtn = $("#btn-day-add", body);
        if (addBtn) addBtn.onclick = () => $("#btn-admin-add-rev", bar)?.click();
        const impBtn = $("#btn-day-import", body);
        if (impBtn) impBtn.onclick = () => $("#btn-admin-import-rev", bar)?.click();
      };

      const draw = () => {
        if (st.period === "day") {
          drawDay();
          return;
        }
        $("#y-ctrls", bar)?.classList.remove("hidden");
        $("#d-ctrls", bar)?.classList.add("hidden");
        $("#v-seg", bar)?.classList.remove("hidden");
        const d = data, k = d.kpi;
        const ch = v => v == null ? "" : `<div class="s" style="color:${v >= 0 ? "var(--ok)" : "var(--bad)"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% so với kỳ trước</div>`;
        const useQ = st.period === "quarter";
        const labels = useQ ? d.quarters.map(q => "Q" + q.quarter) : d.months.map(m => MONTHS[m.month - 1]);
        const rows = useQ ? d.quarters : d.months;

        updateNav();

        // Cập nhật toolbar visual states
        $$("#p-seg button", bar).forEach(b => b.classList.toggle("active", b.dataset.p === st.period));
        $$("#v-seg button", bar).forEach(b => b.classList.toggle("active", b.dataset.v === st.view));
        $("#q-pills", bar).classList.toggle("hidden", st.period !== "quarter");
        $$("#q-pills button", bar).forEach(b => b.classList.toggle("active", +b.dataset.q === st.quarter));
        $("#m-pills", bar).classList.toggle("hidden", st.period !== "month");
        $$("#m-pills button", bar).forEach(b => b.classList.toggle("active", +b.dataset.m === st.month));
        $("#sy", bar).value = st.year;

        const wc = d.wc;
        const curWcNet = wc ? wc.netBalance : (k.collected - (k.refunded || 0));
        const curWcSpent = wc ? wc.totalSpent : (k.refunded || 0);

        // KPI cards
        const kpiHtml = `
          <div class="note info" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>${esc(d.note)} · Kỳ báo cáo: <b>${esc(d.label)}</b></div>
            ${d.reconciled ? `<span class="badge ok">✓ Số liệu đối chiếu chuẩn khớp</span>` : ""}
          </div>
          ${d.warnings && d.warnings.length ? `<div class="note warn"><b>Cảnh báo chênh lệch:</b><ul>${d.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
          <div class="grid g4" style="margin-bottom:14px">
            <div class="kpi ok" style="border-left:4px solid var(--teal,#0F766E)">
              <div class="l">Doanh thu từ tour du lịch</div>
              <div class="v" style="color:var(--teal,#0F766E)">${money(k.tourRevenue || k.bookedRevenue || k.revenue)}</div>
              <div class="s" style="margin-top:4px">Chỉ doanh thu tour (Đã thu: <b>${money(k.collected || k.revenue)}</b>)</div>
            </div>
            <div class="kpi" style="border-left:4px solid #059669;background:#f0fdf4">
              <div class="l" style="color:#047857;font-weight:700">🏦 Số tiền lưu động hiện có</div>
              <div class="v" style="color:#059669;font-weight:800">${money(curWcNet)}</div>
              <div class="s" style="margin-top:4px;color:#047857"><b>= Doanh thu tour − Lương NV − Tiền tiêu</b></div>
            </div>
            <div class="kpi" style="border-left:4px solid #e11d48">
              <div class="l">Tổng tiền tiêu & Chi phí</div>
              <div class="v" style="color:#e11d48">-${money(curWcSpent)}</div>
              <div class="s" style="margin-top:4px">Lương NV, dụng cụ mang đi cho khách, cọc, hoàn tiền...</div>
            </div>
            <div class="kpi ${k.cancelRate > 15 ? "warn" : ""}">
              <div class="l">Đơn tour & Lượng khách</div>
              <div class="v">${k.orders.toLocaleString("vi-VN")} đơn · ${k.guests.toLocaleString("vi-VN")} khách</div>
              <div class="s" style="margin-top:4px">Đã duyệt: <b>${(k.confirmedOrders || k.orders).toLocaleString("vi-VN")}</b> đơn chốt (Hủy: ${k.cancelRate}%)</div>
            </div>
          </div>

          <!-- BẢNG GIÁM SÁT SỐ TIỀN LƯU ĐỘNG CÔNG TY RÕ RÀNG TRỰC TIẾP TRÊN DASHBOARD -->
          <div class="card" style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
              <div>
                <h2 style="margin:0;display:flex;align-items:center;gap:8px">
                  <span>🏦 Quỹ Tiền Lưu Động Công Ty (Năm ${d.year})</span>
                  <span class="badge ok">Đồng bộ 100% với Thu Ngân</span>
                </h2>
                <div class="muted small" style="margin-top:4px">
                  <b>Công thức kiểm soát dòng tiền:</b> <span class="mono" style="font-weight:700;color:var(--navy)">Số tiền lưu động = Doanh thu từ tour du lịch − Lương nhân viên − Tiền tiêu (mua dụng cụ cho khách mang đi, hoàn tiền, cọc đối tác, thù lao HDV...)</span>
                </div>
              </div>
              <button class="btn ok sm" id="btn-goto-wc" style="font-weight:700">🔍 Mở Sổ Quỹ Tiền Lưu Động & Toàn Bộ Lịch Sử Vào/Ra →</button>
            </div>

            <div class="grid g3" style="gap:14px;margin-bottom:14px">
              <div class="kpi" style="border-left:4px solid var(--teal);padding:14px">
                <div class="small muted" style="font-weight:600">1. Tổng thu từ tour du lịch (Dòng tiền Vào)</div>
                <div style="font-size:1.45rem;font-weight:800;color:var(--teal);margin-top:4px">+${money(wc ? wc.totalCollected : k.collected)}</div>
                <div class="small muted" style="margin-top:4px">Thu cọc, đủ 100%, thu nốt & quầy (+${wc ? (wc.incomes || []).length : k.orders} GD)</div>
              </div>
              <div class="kpi bad" style="border-left:4px solid var(--bad);padding:14px">
                <div class="small muted" style="font-weight:600">2. Tổng tiền tiêu & Chi phí đã chi (Dòng tiền Ra)</div>
                <div style="font-size:1.45rem;font-weight:800;color:var(--bad);margin-top:4px">-${money(curWcSpent)}</div>
                <div class="small muted" style="margin-top:4px">Lương NV, dụng cụ mang đi, cọc, thù lao, hoàn (-${wc ? (wc.expenses || []).length : 0} GD)</div>
              </div>
              <div class="kpi ok" style="border-left:4px solid var(--ok);background:#ecfdf5;padding:14px">
                <div class="small" style="color:#047857;font-weight:700">3. Số tiền lưu động ròng hiện tại (1 − 2)</div>
                <div style="font-size:1.6rem;font-weight:900;color:#047857;margin-top:4px">${money(curWcNet)}</div>
                <div class="small" style="color:#047857;margin-top:4px;font-weight:600">✓ Quỹ tiền mặt thực tế sẵn sàng hoạt động</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:0.86rem;background:var(--bg);padding:10px 14px;border-radius:8px;border:1px solid var(--border);align-items:center;margin-bottom:14px">
              <span style="font-weight:700;color:var(--text)">Chi tiết các khoản tiền tiêu & chi phí:</span>
              <span class="badge" style="background:var(--surface);border:1px solid var(--border);color:var(--text)">💼 Lương nhân viên: <b>${money(wc?.summary?.salary || 0)}</b></span>
              <span class="badge info">🎒 Dụng cụ mang đi cho khách: <b>${money(wc?.summary?.supplies || 0)}</b></span>
              <span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a">🧭 Thù lao HDV: <b>${money(wc?.summary?.guide_fee || 0)}</b></span>
              <span class="badge" style="background:#f3e8ff;color:#6b21a8;border:1px solid #e9d5ff">🤝 Cọc đối tác: <b>${money(wc?.summary?.partner_deposit || 0)}</b></span>
              <span class="badge bad">💸 Hoàn tiền hủy tour: <b>${money(wc?.summary?.refund || 0)}</b></span>
              <span class="badge" style="background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe">💳 Rút tiền ví: <b>${money(wc?.summary?.wallet_withdrawal || 0)}</b></span>
            </div>

            <!-- BẢNG XEM TRỰC TIẾP LỊCH SỬ THU CHI TIỀN LƯU ĐỘNG GẦN NHẤT -->
            <div style="border-top:1px solid var(--border);padding-top:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
                <div style="font-weight:700;font-size:13.5px;color:var(--navy);display:flex;align-items:center;gap:6px">
                  <span>📜 Lịch sử biến động tiền lưu động gần nhất:</span>
                </div>
                <div style="display:flex;gap:6px" id="wc-quick-filter-btns">
                  <button type="button" class="btn sm active" data-qwc="all" style="font-size:11.5px">Toàn bộ gần đây</button>
                  <button type="button" class="btn sm" data-qwc="in" style="font-size:11.5px">📥 Tiền vào (+)</button>
                  <button type="button" class="btn sm" data-qwc="out" style="font-size:11.5px">📤 Tiền ra (-)</button>
                </div>
              </div>
              <div id="wc-quick-preview-box">
                ${renderWcQuickPreview(wc, "all")}
              </div>
            </div>
          </div>
        `;

        if (st.view === "chart") {
          // ── CHẾ ĐỘ BIỂU ĐỒ (DASHBOARD) ──
          body.innerHTML = kpiHtml + `
            <div class="card">
              <div class="card-header-acts">
                <h2>Doanh thu ${useQ ? "theo 4 quý" : "12 tháng"} năm ${d.year}</h2>
                <div class="seg-group" id="c-type-seg">
                  <button data-ct="bar" class="${st.chartType === "bar" ? "active" : ""}">📊 Cột</button>
                  <button data-ct="line" class="${st.chartType === "line" ? "active" : ""}">📈 Đường</button>
                </div>
              </div>
              <div id="chart-container"></div>
            </div>
            <div class="grid g2">
              <div class="card">
                <h2>Cơ cấu trạng thái đơn hàng</h2>
                <div id="dn-chart"></div>
              </div>
              <div class="card">
                <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <h2 style="margin:0">Top 5 Tour bán chạy nhất</h2>
                  <button class="btn sm primary" id="btn-promote-top" title="Đẩy các tour bán chạy nhất này lên slider và mục tour hot trang chủ">🚀 Đẩy lên trang chủ</button>
                </div>
                ${table([
                  { t: "STT", html: (r, i) => `<span class="badge ${i === 0 ? "amber" : "info"}">${i + 1}</span>` },
                  { t: "Tour", html: r => `<b>${esc(r.name)}</b>` },
                  { t: "Số đơn", num: true, k: "orders" },
                  { t: "Doanh thu", num: true, html: r => `<b>${money(r.revenue)}</b>` }
                ], d.topTours, { empty: "Chưa có dữ liệu" })}
              </div>
            </div>
            <div class="card">
              <div class="card-header-acts">
                <h2>Bấm vào ${useQ ? "quý" : "tháng"} để kiểm tra chi tiết (Drill-down)</h2>
                <span class="small muted">Bấm "Xem chi tiết →" để lọc sâu</span>
              </div>
              ${table([
                { t: useQ ? "Quý" : "Tháng", html: r => `<b>${useQ ? "Quý " + r.quarter : "Tháng " + r.month}</b>` },
                { t: "Doanh thu", num: true, html: r => `<b style="color:var(--accent,#D97706)">${money(r.bookedRevenue || r.revenue || 0)}</b>` },
                { t: "Đã thu", num: true, html: r => money(r.collected) },
                { t: "Đã hoàn", num: true, html: r => money(r.refunded) },
                { t: "Số đơn", num: true, k: "orders" },
                { t: "Đã duyệt", num: true, html: r => `<b>${(r.confirmedOrders || 0).toLocaleString("vi-VN")}</b>` },
                { t: "Hủy", num: true, html: r => r.cancelled ? `<span style="color:var(--bad)">${r.cancelled}</span>` : "0" },
                { t: "Số khách", num: true, k: "guests" },
                { t: "", html: r => `<button class="btn sm" data-drill="${useQ ? "q_" + r.quarter : "m_" + r.month}">Xem chi tiết →</button>` }
              ], rows)}
            </div>
            ${renderOrdersList(d.orders)}
          `;

          const isCurYear = (st.period === "year" && d.year === 2026);
          const chartRows = isCurYear ? rows.slice(0, 11) : rows;
          const chartLabels = isCurYear ? labels.slice(0, 11) : labels;
          const chartSeries = [
            { name: "Doanh thu", values: chartRows.map(r => r.bookedRevenue || r.revenue || 0), color: "var(--accent,#D97706)" }
          ];

          const cc = $("#chart-container", body);
          if (st.chartType === "line") {
            cc.innerHTML = lineChart(chartLabels, chartSeries, { fmt: v => money(Math.round(v)), axisFmt: compactMoney, label: "Doanh thu" });
          } else {
            cc.innerHTML = barChart(chartLabels, chartSeries, { fmt: v => money(Math.round(v)), axisFmt: compactMoney, label: "Doanh thu" });
          }

          $("#dn-chart", body).innerHTML = donut(Object.entries(d.byStatus || {}).map(([s, n]) => ({ label: (Staff.STATUS[s] || [s])[0], value: n })));

          $$("#c-type-seg button", body).forEach(b => b.onclick = () => {
            st.chartType = b.dataset.ct;
            draw();
          });

          const btnPromote = $("#btn-promote-top", body);
          if (btnPromote) {
            btnPromote.onclick = async () => {
              if (await confirmBox("Đẩy lên trang chủ", "Bạn có chắc muốn đẩy các tour bán chạy nhất này lên slider chính và thay thế mục tour hot trên trang chủ không?", "ok")) {
                await act(btnPromote, () => post("/api/admin/promote-top-tours", {}), "Đã đẩy Top tour bán chạy lên trang chủ thành công!", () => {
                  load().catch(fail);
                });
              }
            };
          }

        } else {
          // ── CHẾ ĐỘ BẢNG SỐ LIỆU TOÀN DIỆN (TABLE) ──
          let sumRev = 0, sumCol = 0, sumRef = 0, sumOrd = 0, sumCan = 0, sumPax = 0, sumBk = 0, sumConf = 0;
          rows.forEach(r => {
            sumRev += r.revenue || 0;
            sumBk += r.bookedRevenue || 0;
            sumCol += r.collected || 0;
            sumRef += r.refunded || 0;
            sumOrd += r.orders || 0;
            sumConf += r.confirmedOrders || 0;
            sumCan += r.cancelled || 0;
            sumPax += r.guests || 0;
          });
          const avgRevPax = sumPax > 0 ? Math.round(sumRev / sumPax) : 0;
          const avgCancel = (sumOrd + sumCan) > 0 ? Math.round(sumCan * 1000.0 / (sumOrd + sumCan)) / 10.0 : 0;

          body.innerHTML = kpiHtml + `
            <div class="card">
              <div class="card-header-acts">
                <h2>Bảng thống kê doanh thu tài chính chi tiết</h2>
                <button class="btn sm primary" id="btn-quick-csv">⬇️ Xuất bảng này ra CSV</button>
              </div>
              <div class="tbl-wrap">
                <table id="tbl-finance">
                  <thead>
                    <tr>
                      <th class="sortable">Kỳ (${useQ ? "Quý" : "Tháng"})</th>
                      <th class="num sortable">Doanh thu</th>
                      <th class="num sortable">Thực thu (In)</th>
                      <th class="num sortable">Đã hoàn (Out)</th>
                      <th class="num sortable">Số đơn hiệu lực</th>
                      <th class="num sortable">Đã duyệt</th>
                      <th class="num sortable">Số đơn hủy</th>
                      <th class="num sortable">Số khách</th>
                      <th class="num">Tỷ lệ hủy</th>
                      <th class="num">Doanh thu TB / khách</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.map(r => {
                      const cRate = (r.orders + r.cancelled) > 0 ? Math.round(r.cancelled * 1000.0 / (r.orders + r.cancelled)) / 10.0 : 0;
                      const avgP = r.guests > 0 ? Math.round(r.revenue / r.guests) : 0;
                      return `<tr class="clickable-row" data-drill="${useQ ? "q_" + r.quarter : "m_" + r.month}">
                        <td><b>${useQ ? "Quý " + r.quarter : "Tháng " + r.month + "/" + d.year}</b></td>
                        <td class="num" style="color:var(--accent,#D97706)"><b>${money(r.bookedRevenue || r.revenue || 0)}</b></td>
                        <td class="num" style="color:var(--ok)">${money(r.collected)}</td>
                        <td class="num" style="color:var(--bad)">${money(r.refunded)}</td>
                        <td class="num">${r.orders}</td>
                        <td class="num"><b>${r.confirmedOrders || 0}</b></td>
                        <td class="num">${r.cancelled ? `<span style="color:var(--bad)">${r.cancelled}</span>` : "0"}</td>
                        <td class="num">${r.guests}</td>
                        <td class="num">${cRate}%</td>
                        <td class="num">${money(avgP)}</td>
                        <td><button class="btn sm" data-drill="${useQ ? "q_" + r.quarter : "m_" + r.month}">Chi tiết →</button></td>
                      </tr>`;
                    }).join("")}
                  </tbody>
                  <tfoot>
                    <tr class="summary-row">
                      <td><b>TỔNG CỘNG (${rows.length} ${useQ ? "quý" : "tháng"})</b></td>
                      <td class="num"><b style="font-size:15px;color:var(--ok)">${money(sumRev)}</b></td>
                      <td class="num"><b style="font-size:15px;color:var(--accent,#D97706)">${money(sumBk)}</b></td>
                      <td class="num"><b>${money(sumCol)}</b></td>
                      <td class="num"><b>${money(sumRef)}</b></td>
                      <td class="num"><b>${sumOrd}</b></td>
                      <td class="num"><b>${sumConf}</b></td>
                      <td class="num"><b>${sumCan}</b></td>
                      <td class="num"><b>${sumPax}</b></td>
                      <td class="num"><b>${avgCancel}%</b></td>
                      <td class="num"><b>${money(avgRevPax)}</b></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            ${renderOrdersList(d.orders)}
          `;

          const qcsv = $("#btn-quick-csv", body);
          if (qcsv) qcsv.onclick = () => $("#sc", bar).click();
        }

        // Bắt sự kiện drill-down
        $$("[data-drill]", body).forEach(btn => btn.onclick = (e) => {
          e.stopPropagation();
          const target = btn.dataset.drill;
          if (target.startsWith("q_")) {
            st.period = "quarter";
            st.quarter = +target.slice(2);
          } else if (target.startsWith("m_")) {
            st.period = "month";
            st.month = +target.slice(2);
          }
          load().catch(fail);
        });

        $$("[data-view]", body).forEach(a => a.onclick = e => {
          e.preventDefault();
          viewOrder(a.dataset.view).catch(fail);
        });

        const btnGotoWc = $("#btn-goto-wc", body);
        if (btnGotoWc) {
          btnGotoWc.onclick = () => {
            const wcTab = document.querySelector('.nav a[data-id="working-capital"]') || document.querySelector('[data-section="working-capital"]');
            if (wcTab) wcTab.click();
            else window.location.hash = "#working-capital";
          };
        }

        $$("[data-qwc]", body).forEach(btn => {
          btn.onclick = () => {
            const q = btn.dataset.qwc;
            $$("[data-qwc]", body).forEach(b => b.classList.toggle("active", b.dataset.qwc === q));
            const box = $("#wc-quick-preview-box", body);
            if (box) box.innerHTML = renderWcQuickPreview(wc, q);
          };
        });

        $$("#ord-filter-seg button", body).forEach(btn => btn.onclick = () => {
          orderFilter = btn.dataset.of;
          draw();
        });
      };

      function renderWcQuickPreview(wcData, filter) {
        if (!wcData) return '<div class="empty" style="padding:14px">Đang cập nhật dòng tiền lưu động...</div>';
        const inc = (wcData.incomes || []).map(x => ({ ...x, flowType: "in" }));
        const exp = (wcData.expenses || []).map(x => ({ ...x, flowType: "out" }));
        let list = [];
        if (filter === "in") list = inc;
        else if (filter === "out") list = exp;
        else list = [...inc, ...exp].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
        list = list.slice(0, 8);
        if (!list.length) return '<div class="empty" style="padding:14px">Chưa có giao dịch dòng tiền nào được ghi nhận.</div>';
        return `
          <div class="tbl-wrap" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
            <table class="tbl" style="margin:0;font-size:12.5px">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Khoản mục / Nguồn thu</th>
                  <th>Đối tượng / Khách hàng</th>
                  <th style="text-align:right">Số tiền</th>
                  <th>Ghi chú / Tham chiếu</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(r => {
                  const isIn = r.flowType === "in";
                  return `
                    <tr>
                      <td style="white-space:nowrap">${dt(r.at)}</td>
                      <td><span class="badge ${isIn ? 'ok' : 'bad'}" style="font-size:11px">${isIn ? '📥 Tiền vào' : '📤 Tiền ra'}</span></td>
                      <td><b>${esc(r.category || (isIn ? 'Thu tiền tour' : 'Chi phí'))}</b></td>
                      <td>${esc(r.customerName || r.recipient || '—')}</td>
                      <td style="text-align:right;white-space:nowrap;font-weight:700;color:${isIn ? 'var(--ok)' : 'var(--bad)'}">${isIn ? '+' : '-'}${money(r.amount)}</td>
                      <td class="small muted">${esc(r.note || r.ref || '—')}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      let orderFilter = "all";
      function renderOrdersList(orders) {
        if (!orders || !orders.length) {
          if (st.period === "month") return `<div class="card"><div class="empty">Không có đơn hàng nào trong tháng ${st.month}/${st.year}.</div></div>`;
          return "";
        }
        const confCount = orders.filter(o => !o.isFinancial && (o.isConfirmed || ["confirmed", "in_progress", "completed", "guide_accepted", "departed"].includes(o.status))).length;
        const debtCount = orders.filter(o => !o.isFinancial && (o.remaining > 0 || (o.amount > o.paid && !["cancelled", "refunded"].includes(o.status)))).length;
        const finCount = orders.filter(o => o.isFinancial).length;

        let displayList = orders;
        if (orderFilter === "confirmed") {
          displayList = orders.filter(o => !o.isFinancial && (o.isConfirmed || ["confirmed", "in_progress", "completed", "guide_accepted", "departed"].includes(o.status)));
        } else if (orderFilter === "debt") {
          displayList = orders.filter(o => !o.isFinancial && (o.remaining > 0 || (o.amount > o.paid && !["cancelled", "refunded"].includes(o.status))));
        } else if (orderFilter === "financial") {
          displayList = orders.filter(o => o.isFinancial);
        }

        const title = st.period === "month" ? `Danh sách giao dịch & đơn hàng Tháng ${st.month}/${st.year} (${displayList.length}/${orders.length})` :
                      st.period === "quarter" ? `Danh sách giao dịch & đơn hàng Quý ${st.quarter}/${st.year} (${displayList.length}/${orders.length})` :
                      `Danh sách giao dịch & đơn hàng năm ${st.year} (${displayList.length}/${orders.length})`;

        const sumAmt = displayList.reduce((s, x) => s + (x.amount || 0), 0);
        const sumPaid = displayList.reduce((s, x) => s + (x.paid || 0), 0);
        const sumRem = displayList.reduce((s, x) => s + (x.remaining || 0), 0);

        return `
          <div class="card">
            <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
              <div>
                <h2 style="margin:0">${title}</h2>
                <div class="small muted" style="margin-top:2px">
                  ${orderFilter === "confirmed" ? `Tổng giá trị chốt: <b>${money(sumAmt)}</b> · Còn phải thu: <b style="color:var(--bad)">${money(sumRem)}</b>` :
                    orderFilter === "debt" ? `Tổng công nợ còn phải thu: <b style="color:var(--bad)">${money(sumRem)}</b>` :
                    orderFilter === "financial" ? `Tổng dòng tiền tài chính: <b>${money(sumPaid)}</b>` :
                    `Tổng tiền: <b>${money(sumAmt)}</b> · Thực thu thuần: <b>${money(sumPaid)}</b> · Công nợ: <b style="color:var(--bad)">${money(sumRem)}</b>`}
                </div>
              </div>
              <div class="seg-group" id="ord-filter-seg">
                <button class="pill-btn ${orderFilter === "all" ? "active" : ""}" data-of="all">Tất cả (${orders.length})</button>
                <button class="pill-btn ${orderFilter === "confirmed" ? "active" : ""}" data-of="confirmed">Đơn chốt duyệt (${confCount})</button>
                <button class="pill-btn ${orderFilter === "debt" ? "active" : ""}" data-of="debt">Đơn còn nợ (${debtCount})</button>
                ${finCount ? `<button class="pill-btn ${orderFilter === "financial" ? "active" : ""}" data-of="financial">Lương & Thu quầy (${finCount})</button>` : ""}
              </div>
            </div>
            ${table([
              { t: "Mã GD / Đơn", html: o => o.isFinancial ? `<span class="mono">${esc(o.payCode || o.id)}</span>` : `<a href="#" data-view="${esc(o.id)}" class="mono" style="font-weight:700">${esc(o.payCode)}</a>` },
              { t: "Khách hàng / Đối tượng", html: o => `<b>${esc(o.customerName)}</b>${o.phone ? `<div class="small muted">${esc(o.phone)}</div>` : ""}` },
              { t: "Tour & Nghiệp vụ", html: o => `${esc(o.tourName)}${o.date ? `<div class="small muted">${o.isFinancial ? "Ngày: " : "Khởi hành: "}${day(o.date)}</div>` : ""}` },
              { t: "Số khách", num: true, html: o => o.isFinancial ? "—" : (o.pax || "—") + " khách" },
              { t: "Tổng tiền", num: true, html: o => money(o.amount) },
              { t: "Đã thu (Thực thu)", num: true, html: o => `<b style="color:${o.paid < 0 ? "var(--bad)" : "var(--ok)"}">${o.paid < 0 ? "-" : "+"}${money(Math.abs(o.paid))}</b>` },
              { t: "Còn nợ", num: true, html: o => (o.remaining > 0 ? `<b style="color:var(--bad)">${money(o.remaining)}</b>` : `<span class="muted">0 đ</span>`) },
              { t: "Trạng thái", html: o => o.isFinancial ? `<span class="badge ${o.paid < 0 ? "bad" : "ok"}">${esc(o.statusLabel)}</span>` : badge(o.status) },
              { t: "Thời gian", html: o => dt(o.createdAt) },
              { t: "", html: o => o.isFinancial ? "" : `<button class="btn sm" data-view="${esc(o.id)}">Xem</button>` }
            ], displayList.slice(0, 300))}
          </div>
        `;
      }

      const load = async () => {
        if (st.period === "day") {
          data = await get(`/api/admin/daily-stats?date=${encodeURIComponent(st.day)}`);
        } else {
          const [statsData, wcData] = await Promise.all([
            get(`/api/stats?period=${st.period}&year=${st.year}&quarter=${st.quarter}&month=${st.month}`),
            get(`/api/finance/working-capital?year=${st.year}`).catch(() => null)
          ]);
          data = statsData;
          if (data) data.wc = wcData;
        }
        draw();
      };

      // Events for bar toolbar
      $$("#p-seg button", bar).forEach(b => b.onclick = () => {
        st.period = b.dataset.p;
        load().catch(fail);
      });
      $$("#v-seg button", bar).forEach(b => b.onclick = () => {
        st.view = b.dataset.v;
        localStorage.setItem("travel_admin_stats_view", st.view);
        draw();
      });
      $$("#q-pills button", bar).forEach(b => b.onclick = () => {
        st.quarter = +b.dataset.q;
        load().catch(fail);
      });
      $$("#m-pills button", bar).forEach(b => b.onclick = () => {
        st.month = +b.dataset.m;
        load().catch(fail);
      });
      $("#sy", bar).onchange = () => {
        st.year = +$("#sy", bar).value || st.year;
        load().catch(fail);
      };
      $("#y-prev", bar).onclick = () => {
        if (st.year > 1986) {
          st.year--;
          $("#sy", bar).value = st.year;
          load().catch(fail);
        }
      };
      $("#y-next", bar).onclick = () => {
        st.year++;
        $("#sy", bar).value = st.year;
        load().catch(fail);
      };

      $("#sd", bar).onchange = (e) => {
        st.day = e.target.value;
        load().catch(fail);
      };
      $("#d-today", bar).onclick = () => {
        st.day = new Date().toISOString().slice(0, 10);
        $("#sd", bar).value = st.day;
        load().catch(fail);
      };

      $("#btn-admin-add-rev", bar).onclick = async () => {
        const v = await ask("Thêm khoản doanh thu ngày " + st.day, [
          { name: "amount", label: "Số tiền thu (₫)", type: "number", required: true },
          { name: "customerName", label: "Tên khách hàng / Tổ chức", type: "text", value: "Khách trực tiếp" },
          { name: "tourName", label: "Tour / Dịch vụ", type: "text", value: "Bán vé / Dịch vụ tour" },
          { name: "kind", label: "Loại thu", type: "select", options: [["counter", "Thu trực tiếp tại quầy"], ["ticket", "Bán vé tại quầy"], ["service", "Dịch vụ phát sinh"], ["manual", "Thu thủ công khác"]] },
          { name: "payCode", label: "Mã phiếu thu / GD (để trống tự tạo)", type: "text" },
          { name: "note", label: "Ghi chú", type: "textarea" }
        ], { submit: "Ghi nhận doanh thu", kind: "ok" });
        if (!v) return;
        await act(null, () => post("/api/admin/daily-revenue", { date: st.day, amount: Number(v.amount), customerName: v.customerName, tourName: v.tourName, kind: v.kind, payCode: v.payCode, note: v.note }), "Đã ghi nhận doanh thu ngày.", () => load().catch(fail));
      };

      $("#btn-admin-import-rev", bar).onclick = () => {
        if (!window.DataExportImport) return;
        window.DataExportImport.importData({
          title: "Nhập danh sách giao dịch / sao kê ngày " + st.day,
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
                date: st.day,
                amount: amt || 100000,
                customerName: r[1] || r[0] || "Khách nhập file",
                tourName: r[2] || "Tour du lịch",
                kind: "imported",
                payCode: r[4] || "",
                note: r[5] || "Nhập từ tệp sao kê"
              };
            });
            await act(null, () => post("/api/admin/daily-revenue/import", { items: itemsToImport }), `Đã nạp thành công ${itemsToImport.length} giao dịch.`, () => load().catch(fail));
          }
        });
      };

      const getRevExportData = () => {
        if (!data) return null;
        const useQ = st.period === "quarter";
        const rows = useQ ? data.quarters : data.months;
        let totRev = 0, totCol = 0, totRef = 0, totOrd = 0, totCan = 0, totPax = 0;
        rows.forEach(r => { totRev += r.revenue; totCol += r.collected; totRef += r.refunded; totOrd += r.orders; totCan += r.cancelled; totPax += r.guests; });
        return {
          year: data.year,
          period: st.period,
          rows,
          totals: { revenue: totRev, collected: totCol, refunded: totRef, orders: totOrd, cancelled: totCan, guests: totPax }
        };
      };

      const scExcel = $("#sc-excel", bar);
      if (scExcel) scExcel.onclick = () => {
        if (st.period === "day") {
          const s = (data && data.stats) || {};
          if (window.DataExportImport) window.DataExportImport.exportDailyRevenueReport({ date: st.day, rows: s.items, totals: s }, "excel");
          return;
        }
        const d = getRevExportData();
        if (d && window.DataExportImport) window.DataExportImport.exportRevenueReport(d, "excel");
      };
      const scWord = $("#sc-word", bar);
      if (scWord) scWord.onclick = () => {
        if (st.period === "day") {
          const s = (data && data.stats) || {};
          if (window.DataExportImport) window.DataExportImport.exportDailyRevenueReport({ date: st.day, rows: s.items, totals: s }, "word");
          return;
        }
        const d = getRevExportData();
        if (d && window.DataExportImport) window.DataExportImport.exportRevenueReport(d, "word");
      };
      const scPdf = $("#sc-pdf", bar);
      if (scPdf) scPdf.onclick = () => {
        if (st.period === "day") {
          const s = (data && data.stats) || {};
          if (window.DataExportImport) window.DataExportImport.exportDailyRevenueReport({ date: st.day, rows: s.items, totals: s }, "pdf");
          return;
        }
        const d = getRevExportData();
        if (d && window.DataExportImport) window.DataExportImport.exportRevenueReport(d, "pdf");
      };

      $("#sc", bar).onclick = () => {
        if (!data) return;
        if (st.period === "day") {
          const s = (data && data.stats) || {};
          const items = s.items || [];
          const header = ["Mã GD / Đơn", "Khách hàng", "Tour / Dịch vụ", "Loại thu", "Số tiền (₫)", "Thời gian", "Người ghi nhận", "Ghi chú"];
          const exportRows = items.map(r => [r.payCode || r.id, r.customerName, r.tourName, r.kindLabel || r.kind, r.amount, r.at, r.byName, r.note]);
          exportRows.push(["TỔNG THỰC THU", "", "", "", s.net, "", "", `Đã thu: ${s.totalCollected} | Đã hoàn: ${s.totalRefunded}`]);
          csv(`doanh-thu-ngay-${st.day}.csv`, header, exportRows);
          return;
        }
        const useQ = st.period === "quarter";
        const rows = useQ ? data.quarters : data.months;
        const header = ["Kỳ", "Doanh thu thuần", "Thực thu", "Đã hoàn", "Số đơn hiệu lực", "Số đơn hủy", "Số lượng khách"];
        const exportRows = rows.map(r => [
          useQ ? "Quý " + r.quarter : "Tháng " + r.month + "/" + data.year,
          r.revenue, r.collected, r.refunded, r.orders, r.cancelled, r.guests
        ]);
        let totRev = 0, totCol = 0, totRef = 0, totOrd = 0, totCan = 0, totPax = 0;
        rows.forEach(r => { totRev += r.revenue; totCol += r.collected; totRef += r.refunded; totOrd += r.orders; totCan += r.cancelled; totPax += r.guests; });
        exportRows.push(["TỔNG CỘNG", totRev, totCol, totRef, totOrd, totCan, totPax]);
        csv(`thong-ke-doanh-thu-${st.period}-${data.year}.csv`, header, exportRows);
      };

      await load();
    } },

    { id: "confirm", label: "Duyệt đơn", icon: "✅", group: "Đơn tour", perm: "booking:confirm", async badge() { return (await get("/api/admin/queue")).confirm.length; }, async render(el) {
      async function reload() {
        const q = await get("/api/admin/queue");
        el.innerHTML = `<div class="note">Đơn Thu ngân đã xác nhận nhận tiền. Admin duyệt để giữ chỗ chính thức, hoặc từ chối (kèm lý do) để hoàn tiền 100%. Admin không xác nhận tiền.</div>` +
          table([{ t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono">${esc(b.payCode)}</a>` }, { t: "Khách", k: "customerName" }, { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">Đi ${day(b.date)} · ${b.pax} khách</div>` },
            { t: "Đã nhận", num: true, html: b => money(b.paidAmount) }, { t: "Trạng thái", html: b => badge(b.status) },
            { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn ok sm" data-c="${esc(b.id)}">Duyệt</button><button class="btn bad sm" data-r="${esc(b.id)}">Từ chối</button></div>` }], q.confirm, { empty: "Không có đơn chờ duyệt" });
        bindView(el); $$("[data-view]", el).forEach(a => a.addEventListener("click", e => e.preventDefault()));
        $$("[data-c]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/admin/bookings/${b.dataset.c}/confirm`, {}), "Đã duyệt đơn.", reload));
        $$("[data-r]", el).forEach(b => b.onclick = async () => { const v = await ask("Từ chối đơn", [{ name: "reason", label: "Lý do từ chối", type: "textarea", required: true }], { kind: "bad", submit: "Từ chối & hoàn tiền" }); if (v) act(null, () => post(`/api/admin/bookings/${b.dataset.r}/reject`, { reason: v.reason }), "Đã từ chối, tạo yêu cầu hoàn tiền.", reload); });
      }
      await reload();
    } },

    { id: "orders", label: "Tất cả đơn", icon: "📋", group: "Đơn tour", perm: "booking:manage", async render(el) {
      const bar = Parts.search(() => reload(), "Tìm mã đơn, tên khách, tour…", `<select id="os"><option value="">Mọi trạng thái</option>${Object.entries(Staff.STATUS).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join("")}</select>
        <div class="row" style="gap:6px;margin-left:auto">
          <button class="btn ok sm" id="bo-import" title="Nhập danh sách đơn hàng / booking từ Excel hoặc CSV">📥 Nhập file đơn hàng</button>
          <button class="btn sm" id="bo-excel" title="Xuất danh sách khách & đơn ra Excel (.xls)">📊 Xuất Excel</button>
          <button class="btn sm" id="bo-word" title="Xuất danh sách khách & đơn ra Word (.doc)">📝 Xuất Word</button>
          <button class="btn sm" id="bo-pdf" title="In / Lưu PDF">🖨️ In / PDF</button>
        </div>`);
      const body = h("<div></div>"); el.append(bar, body);
      let currentBookings = [];
      $("#os", bar).onchange = () => reload();

      const getOrdersExport = () => {
        const headers = ["STT", "Mã đơn", "Khách hàng", "Điện thoại", "Email", "Tour", "Khởi hành", "Số khách", "Tổng tiền", "Đã thu", "Còn lại", "Trạng thái"];
        const rows = currentBookings.map((b, i) => [
          i + 1,
          b.payCode || b.id,
          b.customerName || "—",
          b.phone || "—",
          b.email || "—",
          b.tourName || "—",
          b.date || "—",
          b.pax || 1,
          b.price || 0,
          b.paidAmount || 0,
          b.remaining || 0,
          b.statusLabel || b.status || "—"
        ]);
        return { title: "DANH SÁCH ĐƠN HÀNG & KHÁCH HÀNG", headers, rows };
      };

      const boImport = $("#bo-import", bar);
      if (boImport) boImport.onclick = () => {
        if (!window.DataExportImport) return;
        window.DataExportImport.importData({
          title: "Nhập danh sách đơn hàng / bookings từ tệp Excel hoặc CSV",
          sampleHeaders: ["Mã đơn", "Khách hàng", "Số điện thoại", "Email", "Tour", "Ngày khởi hành", "Số khách", "Tổng tiền", "Đã thanh toán", "Trạng thái"],
          onConfirm: async (parsed) => {
            const rows = parsed.rows || [];
            const itemsToImport = rows.map(r => {
              let price = 0;
              let paid = 0;
              for (let i = 0; i < r.length; i++) {
                const val = String(r[i]).replace(/[^\d]/g, "");
                if (val && Number(val) >= 500000) {
                  if (price === 0) price = Number(val);
                  else if (paid === 0) paid = Number(val);
                }
              }
              return {
                payCode: r[0] && String(r[0]).startsWith("TRAVEL") ? String(r[0]).trim() : "",
                customerName: r[1] || r[0] || "Khách nhập file",
                phone: r[2] || "",
                email: r[3] || "",
                tourName: r[4] || "Tour du lịch",
                date: r[5] || "",
                pax: Number(r[6]) || 2,
                price: price || 3500000,
                paidAmount: paid || price || 0,
                status: r[9] || (paid > 0 ? "confirmed" : "pending_payment")
              };
            });
            await act(null, () => post("/api/admin/bookings/import", { items: itemsToImport }), `Đã nạp thành công ${itemsToImport.length} đơn hàng vào hệ thống.`, reload);
          }
        });
      };

      const boExcel = $("#bo-excel", bar);
      if (boExcel) boExcel.onclick = () => {
        const d = getOrdersExport();
        if (window.DataExportImport) window.DataExportImport.exportExcel({ filename: "danh-sach-khach-hang-va-don.xls", sheetName: "KhachHang", title: d.title, headers: d.headers, rows: d.rows });
      };
      const boWord = $("#bo-word", bar);
      if (boWord) boWord.onclick = () => {
        const d = getOrdersExport();
        if (window.DataExportImport) window.DataExportImport.exportWord({ filename: "danh-sach-khach-hang-va-don.doc", title: d.title, headers: d.headers, rows: d.rows });
      };
      const boPdf = $("#bo-pdf", bar);
      if (boPdf) boPdf.onclick = () => {
        const d = getOrdersExport();
        if (window.DataExportImport) window.DataExportImport.exportPdf({ title: d.title, headers: d.headers, rows: d.rows });
      };

      async function reload() {
        const r = await get(`/api/admin/bookings?status=${encodeURIComponent($("#os", bar).value)}&q=${encodeURIComponent($("input", bar).value)}`);
        currentBookings = r.bookings || [];
        body.innerHTML = table([{ t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono">${esc(b.payCode)}</a>`, sort: b => b.payCode }, { t: "Khách", k: "customerName" }, { t: "Tour", k: "tourName" }, { t: "Ngày đi", html: b => day(b.date), sort: b => b.date },
          { t: "Tổng", num: true, html: b => money(b.price), sort: b => b.price }, { t: "Đã nhận", num: true, html: b => money(b.paidAmount) }, { t: "Trạng thái", html: b => badge(b.status) }], currentBookings.slice(0, 500), { sortable: true, empty: "Không có đơn nào" });
        $$("[data-view]", body).forEach(a => a.onclick = e => { e.preventDefault(); viewOrder(a.dataset.view).catch(fail); });
      }
      await reload();
    } },

    { id: "company-cancel", label: "Hủy tour (công ty)", icon: "🚫", group: "Đơn tour", perm: "company_cancel:approve", async badge() { return (await get("/api/admin/cancel-proposals?status=pending")).proposals.length; }, async render(el) {
      async function reload() {
        const r = await get("/api/admin/cancel-proposals"), pend = r.proposals.filter(p => p.status === "pending");
        const doCancel = async (tourId, date, name, pid) => { const v = await ask(`Hủy tour ${name} ngày ${day(date)}`, [{ name: "reason", label: "Lý do (gửi cho khách)", type: "textarea", required: true }, { name: "mode", label: "Cách xử lý", type: "select", value: "refund", options: [["refund", "Hủy hết và hoàn 100% ngay"], ["offer", "Để khách chọn: hoàn 100% hoặc đổi sang ngày khác"]] }], { kind: "bad", submit: "Hủy chuyến", intro: "Chuyến này sẽ đóng đặt chỗ. CSKH được báo để liên hệ khách. Không tính phí hủy." }); if (v) act(null, () => post("/api/admin/company-cancel", { tourId, date, reason: v.reason, mode: v.mode, proposalId: pid }), v.mode === "offer" ? "Đã gửi đề nghị cho khách." : "Đã hủy chuyến, các khoản hoàn đã được tạo.", reload); };
        el.innerHTML = `<div class="card"><h2>Đề xuất hủy / dồn tour từ Điều hành</h2><div id="p"></div></div><div class="card"><h2>Các chuyến sắp đi</h2><div id="d"></div></div>`;
        $("#p", el).innerHTML = table([{ t: "Tour", html: p => `${esc(p.tourName)}<div class="small muted">Ngày ${day(p.date)} · ${p.pax}/${p.minGuests} khách tối thiểu</div>` }, { t: "Lý do", html: p => esc(p.reason) }, { t: "Đề xuất bởi", html: p => esc(p.proposedByName || p.proposedBy) }, { t: "Trạng thái", html: p => pill({ pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }[p.status] || p.status, p.status === "pending" ? "warn" : p.status === "approved" ? "ok" : "bad") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: p => p.status === "pending" ? `<div class="act-btns"><button class="btn bad sm" data-ok="${esc(p.id)}">Duyệt hủy</button><button class="btn sm" data-no="${esc(p.id)}">Từ chối</button></div>` : "" }], r.proposals, { empty: "Chưa có đề xuất" });
        $("#d", el).innerHTML = table([{ t: "Tour", k: "tourName" }, { t: "Ngày", html: d => day(d.date), sort: d => d.date }, { t: "Khách", num: true, html: d => `${d.pax}/${d.capacity}` }, { t: "Tình trạng", html: d => d.cancelled ? pill("Đã hủy", "bad") : d.atRisk ? pill("Có nguy cơ", "warn") : pill("Bình thường", "ok") }, { t: "Thao tác", nowrap: true, cls: "actions", html: d => d.cancelled ? "" : `<button class="btn sm" data-c="${esc(d.key)}">Hủy chuyến</button>` }], r.departures, { empty: "Không có chuyến" });
        $$("[data-ok]", el).forEach(b => b.onclick = () => { const p = pend.find(x => x.id === b.dataset.ok); doCancel(p.tourId, p.date, p.tourName, p.id); });
        $$("[data-no]", el).forEach(b => b.onclick = async () => { const v = await ask("Từ chối đề xuất", [{ name: "note", label: "Lý do", type: "textarea", required: true }]); if (v) act(null, () => post(`/api/admin/cancel-proposals/${b.dataset.no}/reject`, { note: v.note }), "Đã từ chối đề xuất.", reload); });
        $$("[data-c]", el).forEach(b => b.onclick = () => { const d = r.departures.find(x => x.key === b.dataset.c); doCancel(d.tourId, d.date, d.tourName, ""); });
      }
      await reload();
    } },

    { id: "tours", label: "Quản lý tour", icon: "🗺️", group: "Tour", perm: "tour:manage_sensitive", async render(el) {
      const bar = Parts.search(() => reload(), "Tìm tên tour, điểm đến, mã…", `
        <select id="t-reg">
          <option value="">Mọi vùng miền</option>
          <option value="Miền Bắc">Miền Bắc</option>
          <option value="Miền Trung">Miền Trung</option>
          <option value="Miền Nam">Miền Nam</option>
          <option value="Quốc tế">Quốc tế</option>
        </select>
        <select id="t-st">
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang mở bán</option>
          <option value="hidden">Đang ẩn</option>
        </select>
        <button class="btn primary" id="btn-create-tour">+ Tạo tour mới</button>
      `);
      const body = h("<div></div>");
      el.append(bar, body);

      let allTours = [];

      function toLines(v) {
        if (!v) return "";
        if (Array.isArray(v)) {
          return v.map(x => typeof x === "string" ? x : (x.title || x.desc || x.name || JSON.stringify(x))).join("\n");
        }
        return String(v);
      }

      async function openTourForm(t) {
        const isEdit = !!t;
        const v = await ask(isEdit ? "Sửa tour: " + t.name : "Tạo & xuất bản tour mới", [
          { name: "name", label: "Tên tour", value: t?.name || "", required: true, placeholder: "VD: Đà Nẵng – Bà Nà Hills 4N3Đ" },
          { name: "price", label: "Giá tour (₫)", type: "number", value: t?.price || "", required: true, placeholder: "VD: 3500000" },
          { name: "destination", label: "Điểm đến", value: t?.dest || t?.destination || "", placeholder: "VD: Đà Nẵng, Quảng Nam" },
          { name: "region", label: "Vùng miền", type: "select", value: t?.region || "Miền Bắc", options: [["Miền Bắc", "Miền Bắc"], ["Miền Trung", "Miền Trung"], ["Miền Nam", "Miền Nam"], ["Quốc tế", "Quốc tế"]] },
          { name: "duration", label: "Thời lượng", value: t?.duration || "", placeholder: "VD: 3 ngày 2 đêm" },
          { name: "guideType", label: "Loại hình / HDV", type: "select", value: t?.guideType || (t?.guide === "self" ? "self" : "domestic"), options: [["domestic", "Có HDV nội địa"], ["international", "Có HDV quốc tế"], ["self", "Tour tự túc (không HDV)"]] },
          { name: "capacity", label: "Sức chứa tối đa (khách)", type: "number", value: t?.capacity || 30 },
          { name: "minGuests", label: "Khách tối thiểu để khởi hành", type: "number", value: t?.minGuests || 10 },
          { name: "allowExtension", label: "Cho phép khách gia hạn tour", type: "checkbox", value: t ? t.allowExtension !== false : true },
          { name: "newUntil", label: "Hạn gắn mác 'MỚI' (để trống = 30 ngày kể từ khi tạo)", type: "date", value: t?.newUntil ? t.newUntil.slice(0, 10) : new Date(Date.now() + 30*86400000).toISOString().slice(0, 10) },
          { name: "active", label: "Mở bán ngay (Hiển thị trên website)", type: "checkbox", value: t ? t.active !== false : true },
          { name: "image", label: "Ảnh đại diện (đường dẫn, hoặc bấm chọn ảnh để tải lên)", upload: "tour", value: t?.image || "", placeholder: "VD: img/tours/da-nang.jpg hoặc URL ảnh" },
          { name: "subtitle", label: "Mô tả ngắn / Giới thiệu", type: "textarea", value: t?.desc || t?.description || t?.subtitle || "" },
          { name: "highlights", label: "Điểm nổi bật (mỗi dòng một ý)", type: "textarea", value: toLines(t?.highlights || (t?.highlight ? t.highlight.split(" · ") : "")) },
          { name: "itinerary", label: "Lịch trình tóm tắt (mỗi dòng một ngày)", type: "textarea", value: toLines(t?.itinerary) }
        ], { wide: true, submit: isEdit ? "Lưu thay đổi" : "Xuất bản tour" });

        if (!v) return;

        const priceNum = Number(String(v.price || "").replace(/[^\d]/g, ""));
        if (!priceNum || priceNum <= 0) {
          fail("Vui lòng nhập giá tour hợp lệ (> 0 ₫)");
          return;
        }

        const payload = {
          name: v.name,
          price: priceNum,
          destination: v.destination,
          region: v.region,
          duration: v.duration,
          guideType: v.guideType,
          capacity: Number(v.capacity) || 30,
          minGuests: Number(v.minGuests) || 10,
          allowExtension: v.allowExtension,
          newUntil: v.newUntil,
          isNew: !isEdit || t.isNew,
          badge: "new",
          active: v.active,
          image: v.image,
          subtitle: v.subtitle,
          highlights: v.highlights,
          itinerary: v.itinerary
        };

        if (isEdit) {
          act(null, () => put(`/api/admin/tours/${encodeURIComponent(t.id)}`, payload), "Đã cập nhật tour.", reload);
        } else {
          act(null, () => post("/api/admin/tours", payload), "Đã tạo và xuất bản tour mới.", reload);
        }
      }

      async function reload() {
        const q = $("input", bar).value.toLowerCase().trim();
        const reg = $("#t-reg", bar).value;
        const st = $("#t-st", bar).value;

        const res = await get("/api/admin/tours");
        allTours = res.tours || [];

        // Đảm bảo tour tự tạo mới luôn xuất hiện ĐẦU TIÊN
        allTours.sort((a, b) => {
          const aNew = (a.isNew || String(a.id).startsWith("tour_")) ? 1 : 0;
          const bNew = (b.isNew || String(b.id).startsWith("tour_")) ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew;
          return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
        });

        let filtered = allTours.filter(t => {
          if (q && !String(t.name || "").toLowerCase().includes(q) && !String(t.id || "").toLowerCase().includes(q) && !String(t.dest || t.destination || "").toLowerCase().includes(q)) return false;
          if (reg && t.region !== reg) return false;
          if (st === "active" && t.active === false) return false;
          if (st === "hidden" && t.active !== false) return false;
          return true;
        });

        body.innerHTML = `
          <div class="note" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>Quản lý toàn bộ danh mục tour: tạo mới trực tiếp, cập nhật nội dung, giá tiền, sức chứa, ẩn/hiện hoặc xóa tour.</div>
            <span class="badge info">Tổng: ${allTours.length} tour · Hiển thị: ${filtered.length} tour</span>
          </div>` +
          table([
            { t: "Tour", html: t => {
              const today = new Date().toISOString().slice(0, 10);
              const isNewT = t.newUntil ? t.newUntil >= today : (t.isNew || String(t.id).startsWith("tour_"));
              const expBadge = (isNewT && t.newUntil) ? ` <span class="badge" style="background:#ef4444;color:#fff;font-size:11px" title="Hạn mác MỚI đến ${t.newUntil}">MỚI (đến ${day(t.newUntil)})</span>` : (isNewT ? ' <span class="badge" style="background:#ef4444;color:#fff;font-size:11px">MỚI</span>' : '');
              return `<b>${esc(t.name)}</b>${expBadge}<div class="small muted"><span class="mono">${esc(t.id)}</span> · Điểm đến: ${esc(t.dest || t.destination || "—")}</div>`;
            } },
            { t: "Vùng", html: t => pill(t.region || "Khác", t.region === "Miền Bắc" ? "info" : t.region === "Miền Trung" ? "warn" : t.region === "Quốc tế" ? "amber" : "ok") },
            { t: "Thời lượng", html: t => esc(t.duration || "—") },
            { t: "Giá niêm yết", num: true, html: t => `<b>${money(t.price)}</b>` },
            { t: "Loại HDV", html: t => t.guideType === "self" || t.guide === "self" ? "Tự túc" : t.guideType === "international" ? "Quốc tế" : "Nội địa" },
            { t: "Sức chứa", num: true, html: t => `${t.capacity ?? 30} khách<div class="small muted">Tối thiểu: ${t.minGuests ?? 1}</div>` },
            { t: "Trạng thái", html: t => t.active !== false ? pill("Đang mở bán", "ok") : pill("Đang ẩn", "bad") },
            { t: "Thao tác", nowrap: true, cls: "actions", html: t => `
              <div class="act-btns">
                <button class="btn sm" data-edit="${esc(t.id)}">Sửa</button>
                <button class="btn sm ${t.active !== false ? "bad" : "ok"}" data-toggle="${esc(t.id)}">${t.active !== false ? "Ẩn" : "Hiện"}</button>
                <button class="btn bad sm" data-del="${esc(t.id)}" title="Xóa tour">Xóa</button>
              </div>` }
          ], filtered, { empty: "Không tìm thấy tour phù hợp" });

        $$("[data-edit]", body).forEach(b => b.onclick = () => {
          const t = allTours.find(x => String(x.id) === b.dataset.edit);
          if (t) openTourForm(t);
        });

        $$("[data-toggle]", body).forEach(b => b.onclick = () => {
          act(b, () => post(`/api/admin/tours/${encodeURIComponent(b.dataset.toggle)}/toggle`), "Đã đổi trạng thái tour.", reload);
        });

        $$("[data-del]", body).forEach(b => b.onclick = async () => {
          const t = allTours.find(x => String(x.id) === b.dataset.del);
          if (!t) return;
          if (await confirmBox("Xóa tour", `Bạn có chắc muốn xóa hoặc ẩn hoàn toàn tour "${t.name}" (${t.id}) khỏi hệ thống?`, "bad")) {
            act(null, () => del(`/api/admin/tours/${encodeURIComponent(t.id)}`), "Đã xóa tour thành công.", reload);
          }
        });
      }

      $("#t-reg", bar).onchange = reload;
      $("#t-st", bar).onchange = reload;
      $("#btn-create-tour", bar).onclick = () => openTourForm(null);

      await reload();
    } },

    { id: "tour-pool", label: "Ghép tour & Gom đoàn", icon: "🤝", group: "Tour", perm: "tour:manage_sensitive", async render(el) {
      el.innerHTML = `
        <div class="card">
          <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <h2 style="margin:0">🤝 Quản lý Ghép Tour & Gom Đoàn Khởi Hành</h2>
              <div class="muted small" style="margin-top:4px">Dùng AI & RAG để quét các đơn lẻ, ghép nhóm khách đủ điều kiện xe và HDV, hoặc chủ động ghép tay khi điều phối tour.</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ok" id="btn-ai-scan">🤖 AI Quét & Đề xuất ghép (RAG)</button>
              <button class="btn" id="btn-manual-merge">✋ Ghép đoàn bằng tay</button>
              <button class="btn primary" id="btn-create-pool">+ Mở đợt gom tour mới</button>
            </div>
          </div>
        </div>

        <div id="pool-ai-results" style="display:none;margin-bottom:16px"></div>
        <div id="pool-list-view"></div>
      `;

      const aiBox = $("#pool-ai-results", el);
      const listView = $("#pool-list-view", el);

      async function reload() {
        const [poolsRes, bookingsRes] = await Promise.all([
          get("/api/admin/tours/pool").catch(() => ({ pools: [] })),
          get("/api/admin/bookings?status=").catch(() => ({ bookings: [] }))
        ]);
        const pools = poolsRes.pools || [];
        const bookings = bookingsRes.bookings || [];

        listView.innerHTML = `
          <div class="grid g3" style="margin-bottom:16px">
            <div class="kpi ok"><div class="l">Đợt ghép đang mở</div><div class="v">${pools.filter(p => p.status === 'open').length} đợt</div><div class="s">Đang nhận thêm khách</div></div>
            <div class="kpi"><div class="l">Tổng khách đã ghép</div><div class="v">${pools.reduce((s, p) => s + (p.currentPax || 0), 0)} khách</div><div class="s">Gom từ nhiều đoàn lẻ</div></div>
            <div class="kpi warn"><div class="l">Đơn đủ điều kiện ghép</div><div class="v">${bookings.filter(b => (b.pax || 0) <= 5 && !['cancelled','refunded'].includes(b.status)).length} đơn</div><div class="s">Khách lẻ & gia đình nhỏ</div></div>
          </div>

          <div class="card">
            <h2 style="margin:0 0 14px">Danh sách các đợt Gom tour & Ghép đoàn (${pools.length})</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px">
              ${pools.map(p => {
                const cur = p.currentPax || 0;
                const min = p.minPax || 10;
                const max = p.maxPax || 16;
                const pct = Math.min(100, Math.round((cur / min) * 100));
                const isReady = cur >= min;
                const needed = Math.max(0, min - cur);
                return `
                <div class="card" style="border:1px solid var(--border);border-radius:10px;padding:16px;background:var(--surface);display:flex;flex-direction:column;justify-content:space-between">
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                      <span class="badge ${p.status === 'open' ? 'ok' : 'info'}">${p.status === 'open' ? '🟢 Đang mở gom' : 'Chờ khởi hành'}</span>
                      <span class="badge amber">Ưu đãi ghép -${p.discountPercent || 10}%</span>
                    </div>
                    <h3 style="margin:0 0 6px;font-size:1.05rem">${esc(p.tourName)}</h3>
                    <div class="small muted" style="margin-bottom:10px">📍 ${esc(p.destination || 'Việt Nam')} · Khởi hành: <b>${day(p.date)}</b></div>

                    <div style="margin-bottom:12px">
                      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                        <span>Tiến độ gom: <b>${cur}/${min} khách</b> (Tối đa: ${max})</span>
                        <b style="color:${isReady ? 'var(--ok)' : 'var(--accent)'}">${pct}%</b>
                      </div>
                      <div style="width:100%;height:8px;background:var(--border);border-radius:99px;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:${isReady ? 'var(--ok)' : 'var(--accent)'};border-radius:99px;transition:width .3s"></div>
                      </div>
                      <div class="small" style="margin-top:4px;color:${isReady ? 'var(--ok)' : 'var(--bad)'}">
                        ${isReady ? '✓ Đã đủ đoàn tối thiểu để khởi hành xe riêng!' : `⚠️ Còn thiếu <b>${needed} khách</b> nữa để chốt đoàn.`}
                      </div>
                    </div>

                    <div class="small muted" style="background:var(--bg);padding:8px 10px;border-radius:6px;margin-bottom:12px">
                      📝 ${esc(p.notes || 'Đoàn ghép khởi hành theo lịch trình chung')}
                    </div>
                  </div>

                  <div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:10px;margin-top:10px">
                    <button class="btn sm" data-pool-add="${esc(p.id)}">➕ Ghép thêm đơn</button>
                    <button class="btn ok sm" data-pool-detail="${esc(p.id)}">👁️ Chi tiết đoàn</button>
                  </div>
                </div>`;
              }).join("")}
            </div>
          </div>
        `;

        // Sự kiện AI Quét & Đề xuất
        $("#btn-ai-scan", el).onclick = async () => {
          aiBox.style.display = "block";
          aiBox.innerHTML = `
            <div class="card" style="border:2px solid var(--primary);background:var(--bg-subtle,#f8fafc)">
              <div style="display:flex;align-items:center;gap:10px;color:var(--primary);font-weight:700">
                <span class="spinner" style="display:inline-block;width:18px;height:18px;border:2px solid var(--primary);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite"></span>
                Đang kích hoạt AI & RAG quét dữ liệu hành trình, điểm đến và số lượng khách...
              </div>
            </div>`;

          try {
            const aiRes = await post("/api/admin/tours/pool/ai-match", {});
            const sugs = aiRes.smartSuggestions || [];
            const alerts = aiRes.poolFillAlerts || [];

            aiBox.innerHTML = `
              <div class="card" style="border:2px solid var(--primary);background:#f0fdf4">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
                  <div>
                    <h3 style="margin:0;color:var(--ok);font-size:1.15rem">🤖 Kết quả AI & RAG Đề xuất Ghép Tour Thông Minh</h3>
                    <div class="small muted">Quét ${aiRes.candidatesScanned || 0} đơn khách lẻ · Tìm thấy ${sugs.length} cặp ghép tối ưu</div>
                  </div>
                  <button class="btn sm" id="btn-close-ai" style="padding:4px 10px">Đóng gợi ý</button>
                </div>

                ${alerts.length ? `
                  <div class="note warn" style="margin-bottom:14px">
                    <b>⚠️ Cảnh báo tour ghép sắp đến ngày nhưng chưa đủ khách:</b>
                    <ul style="margin:6px 0 0;padding-left:20px">
                      ${alerts.map(a => `<li><b>${esc(a.tourName)}</b> (${day(a.date)}): ${esc(a.aiTip)}</li>`).join("")}
                    </ul>
                  </div>` : ""}

                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:14px">
                  ${sugs.map(s => `
                    <div class="card" style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:14px">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span class="badge ok">Độ tương thích ${s.confidence}%</span>
                        <span class="badge info">${esc(s.targetVehicle)}</span>
                      </div>
                      <div style="font-weight:700;color:var(--navy);margin-bottom:6px">Điểm đến: ${esc(s.destination)} · Ngày dự kiến: ${day(s.suggestedDate)}</div>
                      <div style="background:var(--bg);padding:8px 10px;border-radius:6px;font-size:12.5px;margin-bottom:8px">
                        <div><b>Đơn 1:</b> ${esc(s.booking1.code)} – ${esc(s.booking1.customer)} (${s.booking1.pax} khách)</div>
                        <div><b>Đơn 2:</b> ${esc(s.booking2.code)} – ${esc(s.booking2.customer)} (${s.booking2.pax} khách)</div>
                        <div style="margin-top:4px;color:var(--ok);font-weight:700">➜ Tổng đoàn sau ghép: ${s.combinedPax} khách (Tiết kiệm ~${money(s.estimatedSavings)})</div>
                      </div>
                      <div class="small" style="color:#166534;line-height:1.45;margin-bottom:10px">${esc(s.aiReason)}</div>
                      <button class="btn ok sm" style="width:100%" data-ai-merge="${esc(s.booking1.id)},${esc(s.booking2.id)}" data-dest="${esc(s.destination)}">⚡ Duyệt ghép tự động 2 đơn này</button>
                    </div>
                  `).join("")}
                </div>
              </div>
            `;

            $("#btn-close-ai", aiBox).onclick = () => { aiBox.style.display = "none"; };
            $$("[data-ai-merge]", aiBox).forEach(b => b.onclick = async () => {
              const bids = b.dataset.aiMerge.split(",");
              if (await confirmBox("Xác nhận ghép đoàn tự động", `Ghép 2 đơn ${bids.join(" & ")} thành đoàn chung đi ${b.dataset.dest}? Hệ thống sẽ thông báo đến Điều hành và HDV.`)) {
                act(null, () => post("/api/admin/tours/pool/merge", { poolId: "pool_dn_2026", bookingIds: bids, note: "AI & RAG tự động đề xuất ghép đoàn tối ưu chi phí" }), "Đã ghép 2 đơn vào đoàn thành công!", reload);
                aiBox.style.display = "none";
              }
            });
          } catch (e) {
            aiBox.innerHTML = `<div class="note bad">Không thể quét AI: ${esc(e.message)}</div>`;
          }
        };

        // Ghép đoàn bằng tay
        $("#btn-manual-merge", el).onclick = async () => {
          const eligible = bookings.filter(b => !['cancelled','refunded'].includes(b.status));
          const pOpts = pools.map(p => [p.id, `${p.tourName} (${day(p.date)} - ${p.currentPax}/${p.minPax} khách)`]);
          const bOpts = eligible.map(b => [b.id, `${b.payCode} – ${b.customerName} (${b.pax} khách - ${b.tourName})`]);

          const v = await ask("✋ Ghép đoàn bằng tay (Manual Merge)", [
            { name: "poolId", label: "Chọn đoàn ghép đích", type: "select", options: pOpts },
            { name: "booking1", label: "Đơn tour thứ nhất", type: "select", options: bOpts },
            { name: "booking2", label: "Đơn tour thứ hai cần gộp cùng", type: "select", options: bOpts },
            { name: "note", label: "Ghi chú điều phối ghép đoàn", type: "textarea", placeholder: "Ví dụ: Ghép xe 16 chỗ đón tại sân bay, thống nhất cùng ăn trưa..." }
          ], { submit: "Xác nhận ghép đoàn", kind: "ok" });

          if (!v) return;
          if (v.booking1 === v.booking2) {
            Staff.toast("Vui lòng chọn 2 đơn tour khác nhau để ghép!", "bad");
            return;
          }
          act(null, () => post("/api/admin/tours/pool/merge", { poolId: v.poolId, bookingIds: [v.booking1, v.booking2], note: v.note }), "Đã ghép 2 đơn vào đoàn thành công!", reload);
        };

        // Mở đợt gom tour mới
        $("#btn-create-pool", el).onclick = async () => {
          const v = await ask("Mở đợt gom tour ghép mới", [
            { name: "tourName", label: "Tên tour ghép", required: true, placeholder: "VD: Tour Đà Nẵng – Hội An ghép đoàn 4N3Đ" },
            { name: "destination", label: "Điểm đến", required: true, placeholder: "VD: Đà Nẵng" },
            { name: "date", label: "Ngày khởi hành dự kiến", type: "date", value: new Date(Date.now() + 7*86400000).toISOString().slice(0, 10), required: true },
            { name: "minPax", label: "Số khách tối thiểu để chốt đoàn", type: "number", value: 10, required: true },
            { name: "maxPax", label: "Số khách tối đa", type: "number", value: 16, required: true },
            { name: "discountPercent", label: "Mức giảm giá ưu đãi ghép đoàn (%)", type: "number", value: 10 },
            { name: "notes", label: "Ghi chú cho khách và HDV", type: "textarea", placeholder: "Thông tin tập kết, tiêu chuẩn xe, HDV đi cùng..." }
          ], { submit: "Tạo đợt ghép", kind: "ok" });

          if (v) act(null, () => post("/api/admin/tours/pool", v), "Đã mở đợt ghép tour mới.", reload);
        };

        // Xem chi tiết đoàn
        $$("[data-pool-detail]", listView).forEach(btn => btn.onclick = () => {
          const p = pools.find(x => x.id === btn.dataset.poolDetail);
          if (!p) return;
          modal(`Chi tiết đợt ghép: ${p.tourName}`, `
            <div style="font-size:13.5px">
              <div class="note info" style="margin-bottom:12px">
                Điểm đến: <b>${esc(p.destination)}</b> · Khởi hành: <b>${day(p.date)}</b> · Đã có <b>${p.currentPax}/${p.minPax} khách</b>.
              </div>
              <h4 style="margin:0 0 8px">Các đơn tour trong đoàn này:</h4>
              <ul style="padding-left:20px;margin-bottom:14px">
                ${(p.bookings || []).map(bid => {
                  const b = bookings.find(x => x.id === bid);
                  return b ? `<li><b>${esc(b.payCode)}</b>: ${esc(b.customerName)} (${b.pax} khách - SĐT: ${esc(b.phone || '—')})</li>` : `<li>Mã đơn: <b>${esc(bid)}</b></li>`;
                }).join("")}
              </ul>
              <div class="small muted">Ghi chú điều hành: ${esc(p.notes || 'Không có')}</div>
            </div>
          `);
        });

        // Ghép thêm đơn vào pool
        $$("[data-pool-add]", listView).forEach(btn => btn.onclick = async () => {
          const p = pools.find(x => x.id === btn.dataset.poolAdd);
          if (!p) return;
          const eligible = bookings.filter(b => !['cancelled','refunded'].includes(b.status) && !(p.bookings || []).includes(b.id));
          const v = await ask(`Ghép thêm đơn vào: ${p.tourName}`, [
            { name: "bookingId", label: "Chọn đơn cần ghép thêm", type: "select", options: eligible.map(b => [b.id, `${b.payCode} – ${b.customerName} (${b.pax} khách)`]) },
            { name: "note", label: "Ghi chú ghép", type: "text", placeholder: "Lý do / thỏa thuận ghép" }
          ], { submit: "Ghép vào đoàn", kind: "ok" });
          if (v) act(null, () => post("/api/admin/tours/pool/merge", { poolId: p.id, bookingIds: [v.bookingId], note: v.note }), "Đã ghép đơn vào đoàn.", reload);
        });
      }

      await reload();
    } },

    { id: "foods", label: "Món đặc sản", icon: "🍜", group: "Tour", perm: "content:manage_food", async render(el) {
      let currentFilter = "all";
      let searchKw = "";

      async function reload() {
        const res = await get("/api/content/foods");
        const list = Array.isArray(res) ? res : (res && res.foods) || [];
        const REG = { bac: "Miền Bắc", trung: "Miền Trung", nam: "Miền Nam" };

        const filtered = list.filter(f => {
          if (currentFilter !== "all" && f.region !== currentFilter) return false;
          if (searchKw) {
            const kw = searchKw.toLowerCase();
            const n = (f.name || "").toLowerCase();
            const p = (f.province || f.dest || "").toLowerCase();
            const d = (f.description || f.desc || "").toLowerCase();
            if (!n.includes(kw) && !p.includes(kw) && !d.includes(kw)) return false;
          }
          return true;
        });

        el.innerHTML = `
          <div class="toolbar" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="note info" style="margin:0;flex:1">Quản lý các món ăn đặc sản vùng miền (${list.length} món) hiển thị tới du khách trên trang Ẩm thực.</div>
            <button class="btn sm" id="food-exp-excel">📊 Xuất Excel</button>
            <button class="btn sm" id="food-exp-word">📝 Xuất Word</button>
            <button class="btn sm" id="food-exp-pdf">🖨️ In / PDF</button>
            <button class="btn sm" id="food-imp">📥 Nhập Excel/CSV</button>
            ${list.length === 0 ? '<button class="btn ok sm" id="food-seed-btn">🌱 Nạp 153 món mẫu</button>' : ""}
            <button class="btn primary" id="btn-add-food">+ Thêm món</button>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
            <input type="text" id="food-search-kw" value="${esc(searchKw)}" placeholder="🔍 Tìm kiếm món ăn theo tên, tỉnh thành hoặc mô tả..." style="flex:1;min-width:260px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.875rem">
            <select id="food-filter-reg" style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:0.875rem">
              <option value="all" ${currentFilter === "all" ? "selected" : ""}>Tất cả vùng miền (${list.length})</option>
              <option value="bac" ${currentFilter === "bac" ? "selected" : ""}>Miền Bắc (${list.filter(x => x.region === "bac").length})</option>
              <option value="trung" ${currentFilter === "trung" ? "selected" : ""}>Miền Trung (${list.filter(x => x.region === "trung").length})</option>
              <option value="nam" ${currentFilter === "nam" ? "selected" : ""}>Miền Nam (${list.filter(x => x.region === "nam").length})</option>
            </select>
          </div>` +
          table([
            { t: "Món ăn", html: f => {
              const src = f.image ? (/^(https?:|\/|data:)/.test(f.image) ? f.image : "/" + f.image) : "";
              const img = src ? `<img src="${esc(src)}" style="width:44px;height:44px;border-radius:6px;object-fit:cover" onerror="this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:6px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px\\'>${esc(f.emoji || "🍜")}</div>'">` : `<div style="width:44px;height:44px;border-radius:6px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:22px">${esc(f.emoji || "🍜")}</div>`;
              const isProt = ["phở hà nội", "bún bò huế", "cơm tấm sài gòn"].includes(String(f.name || "").trim().toLowerCase()) || f.featured || f.isProtected;
              const isNewF = !isProt && (f.isNew || f.badge === "new" || f.badge === "MỚI" || (f.newUntil && f.newUntil >= new Date().toISOString().slice(0, 10)));
              const badgeHtml = isProt ? '<span class="badge amber" style="margin-left:6px;font-size:11px">⭐ Tiêu biểu 3 miền</span>' : (isNewF ? '<span class="badge ok" style="margin-left:6px;font-size:11px">MỚI</span>' : '');
              return `<div style="display:flex;align-items:center;gap:10px">${img}<div><b>${esc(f.name)}</b>${badgeHtml}${(f.province || f.dest) ? `<div class="small muted">📍 ${esc(f.province || f.dest)}</div>` : ""}</div></div>`;
            } },
            { t: "Vùng miền", html: f => pill(REG[f.region] || f.region, f.region === "bac" ? "info" : f.region === "trung" ? "warn" : "ok") },
            { t: "Mô tả", html: f => `<div style="max-width:420px;font-size:0.85rem;line-height:1.45;color:var(--muted)">${esc(f.description || f.desc || "—")}</div>` },
            { t: "Trạng thái", html: f => f.active !== false ? pill("Đang hiện", "ok") : pill("Đang ẩn", "bad") },
            { t: "Thao tác", nowrap: true, cls: "actions", html: f => {
              const isProt = ["phở hà nội", "bún bò huế", "cơm tấm sài gòn"].includes(String(f.name || "").trim().toLowerCase()) || f.featured || f.isProtected;
              return `
              <div class="act-btns">
                <button class="btn sm" data-f-edit="${esc(f.id)}">Sửa</button>
                <button class="btn sm ${f.active !== false ? "bad" : "ok"}" data-f-toggle="${esc(f.id)}">${f.active !== false ? "Ẩn" : "Hiện"}</button>
                ${isProt ? `<button class="btn sm" disabled title="Món tiêu biểu 3 miền được bảo vệ, không thể xóa">🔒 Khóa</button>` : `<button class="btn bad sm" data-f-del="${esc(f.id)}">Xóa</button>`}
              </div>`;
            } }
          ], filtered, { empty: searchKw || currentFilter !== "all" ? "Không tìm thấy món ăn phù hợp với bộ lọc." : "Chưa có món đặc sản nào." });

        const searchInp = $("#food-search-kw", el);
        if (searchInp) {
          searchInp.oninput = (e) => {
            searchKw = e.target.value;
            reload();
          };
        }

        const regSel = $("#food-filter-reg", el);
        if (regSel) {
          regSel.onchange = (e) => {
            currentFilter = e.target.value;
            reload();
          };
        }

        const feExcel = $("#food-exp-excel", el);
        if (feExcel) feExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(filtered, "excel");
        const feWord = $("#food-exp-word", el);
        if (feWord) feWord.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(filtered, "word");
        const fePdf = $("#food-exp-pdf", el);
        if (fePdf) fePdf.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(filtered, "pdf");
        const feImp = $("#food-imp", el);
        const feSeed = $("#food-seed-btn", el);
        if (feSeed) {
          feSeed.onclick = async () => {
            await act(feSeed, async () => {
              const res = await fetch("/data/foods.json").then(r => r.json());
              const regMap = { north: "bac", center: "trung", south: "nam" };
              for (const [rk, rv] of Object.entries(res)) {
                const reg = regMap[rk] || "bac";
                const all = [rv.featured, ...(rv.foods || [])].filter(Boolean);
                for (const f of all) {
                  await post("/api/content/foods", {
                    name: f.name,
                    region: reg,
                    province: f.region || rv.label || "",
                    description: f.desc || f.description || "",
                    active: true
                  });
                }
              }
            }, "Đã nạp 153 món đặc sản mẫu thành công.", reload);
          };
        }
        if (feImp) feImp.onclick = () => {
          if (!window.DataExportImport) return;
          window.DataExportImport.importData({
            title: "Nhập món ăn đặc sản từ file Excel / CSV",
            onConfirm: async (parsed) => {
              let count = 0;
              for (const r of parsed.rows) {
                const name = r[1] || r[0];
                if (!name) continue;
                const regStr = (r[2] || "").toLowerCase();
                const region = regStr.includes("trung") ? "trung" : regStr.includes("nam") ? "nam" : "bac";
                const province = r[3] || "";
                const description = r[4] || "";
                await post("/api/content/foods", { name, region, province, description, active: true });
                count++;
              }
              Staff.toast(`Đã nhập thành công ${count} món đặc sản.`, "ok");
              reload();
            }
          });
        };

        async function openFoodModal(f) {
          const isEdit = !!f;
          const isProt = isEdit && (["phở hà nội", "bún bò huế", "cơm tấm sài gòn"].includes(String(f.name || "").trim().toLowerCase()) || f.featured || f.isProtected);
          const v = await ask(isEdit ? "Sửa món: " + f.name : "Thêm món đặc sản mới", [
            { name: "name", label: "Tên món đặc sản", value: f?.name || "", required: true, placeholder: "VD: Phở Bát Đàn, Mì Quảng, Bún chả..." },
            { name: "region", label: "Vùng miền", type: "select", value: f?.region || "bac", options: [["bac", "Miền Bắc"], ["trung", "Miền Trung"], ["nam", "Miền Nam"]] },
            { name: "province", label: "Tỉnh / Thành phố nổi tiếng", value: f?.province || f?.dest || "", placeholder: "VD: Hà Nội, Quảng Nam, Đà Nẵng..." },
            { name: "image", label: "Ảnh (đường dẫn hoặc tải lên)", upload: "food", value: f?.image || "", placeholder: "VD: img/foods/pho.jpg hoặc URL ảnh" },
            { name: "desc", label: "Giới thiệu món ăn", type: "textarea", value: f?.description || f?.desc || "" },
            { name: "newUntil", label: "Hạn gắn nhãn 'MỚI'", type: "date", value: f?.newUntil ? f.newUntil.slice(0, 10) : new Date(Date.now() + 30*86400000).toISOString().slice(0, 10) },
            { name: "active", label: "Hiển thị trên trang Ẩm thực", type: "checkbox", value: f ? f.active !== false : true }
          ], {
            submit: isEdit ? "Lưu món" : "Thêm món",
            intro: isProt ? '<div class="note warn"><b>Lưu ý:</b> Đây là 1 trong 3 món đặc sản tiêu biểu của 3 vùng miền, không được đổi tên hoặc thay thế bằng món khác.</div>' : ''
          });

          if (!v) return;
          if (isProt && v.name.trim().toLowerCase() !== f.name.trim().toLowerCase()) {
            Staff.toast("Không được phép thay đổi tên 3 món tiêu biểu của 3 vùng miền!", "bad");
            return;
          }
          const payload = {
            name: v.name,
            region: v.region,
            province: v.province,
            image: v.image,
            description: v.desc,
            desc: v.desc,
            newUntil: v.newUntil,
            isNew: !isEdit || f.isNew,
            badge: "MỚI",
            active: v.active
          };

          if (isEdit) {
            act(null, () => put(`/api/content/foods/${encodeURIComponent(f.id)}`, payload), "Đã lưu món ăn.", reload);
          } else {
            act(null, () => post("/api/content/foods", payload), "Đã thêm món đặc sản (đã gắn nhãn MỚI).", reload);
          }
        }

        $("#btn-add-food", el).onclick = () => openFoodModal(null);

        $$("[data-f-edit]", el).forEach(btn => btn.onclick = () => {
          const f = list.find(x => x.id === btn.dataset.fEdit);
          if (f) openFoodModal(f);
        });

        $$("[data-f-toggle]", el).forEach(btn => btn.onclick = () => {
          const f = list.find(x => x.id === btn.dataset.fToggle);
          if (!f) return;
          act(btn, () => put(`/api/content/foods/${encodeURIComponent(f.id)}`, { ...f, active: f.active === false }), "Đã đổi trạng thái món.", reload);
        });

        $$("[data-f-del]", el).forEach(btn => btn.onclick = async () => {
          const f = list.find(x => x.id === btn.dataset.fDel);
          if (!f) return;
          const isProt = ["phở hà nội", "bún bò huế", "cơm tấm sài gòn"].includes(String(f.name || "").trim().toLowerCase()) || f.featured || f.isProtected;
          if (isProt) {
            Staff.toast(`Món "${f.name}" là 1 trong 3 món ăn tiêu biểu của 3 miền, không thể xóa hoặc thay thế!`, "bad");
            return;
          }
          if (await confirmBox("Xóa món đặc sản", `Xóa món "${f.name}"?`, "bad")) {
            act(null, () => del(`/api/content/foods/${encodeURIComponent(f.id)}`), "Đã xóa món ăn.", reload);
          }
        });
      }
      await reload();
    } },

    Customers.section("Khách hàng"),

    { id: "staff", label: "Nhân viên", icon: "👥", group: "Nhân sự", perm: "staff:manage", async render(el) {
      const bar = Parts.search(() => reload(), "Tìm tên, email, mã…", `<select id="sr"><option value="">Mọi vai trò</option></select><select id="ss"><option value="">Mọi trạng thái</option><option value="active">Hoạt động</option><option value="locked">Đã khóa</option></select>
        <div class="row" style="gap:6px">
          <button class="btn sm" id="st-exp-excel" title="Xuất Excel danh sách nhân viên">📊 Xuất Excel</button>
          <button class="btn sm" id="st-exp-word" title="Xuất Word danh sách nhân viên">📝 Xuất Word</button>
          <button class="btn sm" id="st-exp-pdf" title="In / PDF">🖨️ In / PDF</button>
          <button class="btn sm" id="st-imp" title="Nhập danh sách nhân viên từ Excel/CSV">📥 Nhập Excel/CSV</button>
          <button class="btn primary" id="ns">+ Thêm nhân viên</button>
        </div>`);
      const body = h("<div></div>"); el.append(bar, body); let roles = [];
      let currentStaffList = [];
      const showPw = (r) => r.password ? Staff.modal("Tài khoản đã tạo", `<p>Mã đăng nhập: <b class="mono">${esc(r.loginId)}</b></p><p>Mật khẩu: <b class="mono">${esc(r.password)}</b></p><div class="note warn">Chỉ hiển thị một lần. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu.</div>`, [{ label: "Đã ghi lại" }], { sticky: true }) : null;

      const stExcel = $("#st-exp-excel", bar);
      if (stExcel) stExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportStaffList(currentStaffList, "excel");
      const stWord = $("#st-exp-word", bar);
      if (stWord) stWord.onclick = () => window.DataExportImport && window.DataExportImport.exportStaffList(currentStaffList, "word");
      const stPdf = $("#st-exp-pdf", bar);
      if (stPdf) stPdf.onclick = () => window.DataExportImport && window.DataExportImport.exportStaffList(currentStaffList, "pdf");
      const stImp = $("#st-imp", bar);
      if (stImp) stImp.onclick = () => {
        if (!window.DataExportImport) return;
        window.DataExportImport.importData({
          title: "Nhập nhân sự từ file Excel / CSV",
          onConfirm: async (parsed) => {
            let count = 0;
            for (const row of parsed.rows) {
              const name = row[2] || row[1] || row[0];
              if (!name) continue;
              const roleStr = (row[3] || "").toLowerCase();
              let role = "guide";
              if (roleStr.includes("admin") || roleStr.includes("quản trị")) role = "admin";
              else if (roleStr.includes("cashier") || roleStr.includes("thu ngân")) role = "cashier";
              else if (roleStr.includes("operator") || roleStr.includes("điều hành")) role = "operator";
              else if (roleStr.includes("content") || roleStr.includes("nội dung")) role = "content";
              else if (roleStr.includes("support") || roleStr.includes("cskh")) role = "support";
              const email = row[4] || "";
              const phone = row[5] || "";
              await post("/api/admin/staff", { name, role, email, phone, auto: true });
              count++;
            }
            Staff.toast(`Đã nhập thành công ${count} nhân viên mới.`, "ok");
            reload();
          }
        });
      };

      async function reload() {
        const r = await get(`/api/admin/staff?q=${encodeURIComponent($("input", bar).value)}&role=${$("#sr", bar).value}&status=${$("#ss", bar).value}`);
        currentStaffList = r.staff || [];
        if (!roles.length) { roles = r.roles; $("#sr", bar).innerHTML += roles.map(x => `<option value="${esc(x.key)}">${esc(x.name)}</option>`).join(""); }
        body.innerHTML = table([
          { t: "Mã", html: s => `<b class="mono">${esc(s.id)}</b>` },
          { t: "Họ tên", k: "name" },
          { t: "Vai trò", html: s => esc((Staff.ROLE_NAME[s.role] || s.role)) },
          { t: "Email / SĐT", html: s => esc(s.email) + `<div class="small muted">${esc(s.phone || "")}</div>` },
          { t: "Ngày vào làm", html: s => day(s.startDate) },
          { t: "Lương cơ bản", num: true, html: s => `<b>${money(s.baseSalary)}</b>` },
          { t: "Hạn xét lương", html: s => {
            let badge = '';
            if (s.isDue) badge = '<br><span class="badge bad" style="font-size:0.75rem">🔔 Đến hạn xét</span>';
            else if (s.isUpcoming) badge = `<br><span class="badge warn" style="font-size:0.75rem">⚠️ Sắp đến hạn (${s.daysUntilReview}d)</span>`;
            return `<span>${day(s.nextReviewDate)}</span>${badge}`;
          } },
          { t: "KPI gần nhất", html: s => s.kpiRecent != null ? `<span class="badge ${s.kpiRecent >= 80 ? 'ok' : (s.kpiRecent >= 60 ? 'info' : 'bad')}">${s.kpiRecent}% (${esc(s.kpiRating)})</span>` : '<span class="muted">Chưa có</span>' },
          { t: "Trạng thái", html: s => s.locked ? pill("Đã khóa", "bad") : pill({ active: "Đang làm việc", probation: "Thử việc", suspended: "Tạm hoãn", resigned: "Đã nghỉ việc" }[s.workingStatus] || "Đang làm việc", "ok") },
          { t: "Hành động", nowrap: true, cls: "actions", minWidth: "440px", html: s => `<div class="act-btns">
            <button class="btn ok sm" data-prof="${esc(s.id)}" title="Xem chi tiết hồ sơ, lịch sử lương, đánh giá KPI và xét tăng lương">👁️ Hồ sơ & Lương</button>
            <button class="btn sm" data-e="${esc(s.id)}">Sửa</button>
            <button class="btn sm" data-l="${esc(s.id)}" data-v="${s.locked ? 0 : 1}">${s.locked ? "Mở khóa" : "Khóa"}</button>
            <button class="btn sm" data-p="${esc(s.id)}">Cấp lại MK</button>
            <button class="btn sm" data-r="${esc(s.id)}">Đổi vai trò</button>
            ${s.id !== (Staff.user && Staff.user.id) ? `<button class="btn bad sm" data-rem="${esc(s.id)}" title="Ghi 1 lỗi vi phạm & tự động trừ 200k tiền lương">⚠️ Phạt (-200k)</button>` : ""}
            ${s.id !== (Staff.user && Staff.user.id) ? `<button class="btn bad sm" data-x="${esc(s.id)}">Xóa</button>` : ""}
          </div>` }
        ], r.staff, { empty: "Không có nhân viên" });
        const find = id => r.staff.find(s => s.id === id), ro = roles.map(x => [x.key, x.name]);
        $$("[data-prof]", body).forEach(b => b.onclick = () => openStaffProfileModal(b.dataset.prof, reload));
        $$("[data-e]", body).forEach(b => b.onclick = async () => {
          const s = find(b.dataset.e);
          const v = await ask("Sửa thông tin nhân viên: " + s.name + " (" + s.id + ")", [
            { name: "name", label: "Họ tên", value: s.name, required: true },
            { name: "email", label: "Email", value: s.email },
            { name: "phone", label: "Điện thoại", value: s.phone },
            { name: "startDate", label: "Ngày vào làm", type: "date", value: s.startDate || "2025-11-06" },
            { name: "baseSalary", label: "Lương cơ bản (₫)", type: "number", value: s.baseSalary || 8500000 },
            { name: "workingStatus", label: "Trạng thái làm việc", type: "select", value: s.workingStatus || "active", options: [["active", "Đang làm việc"], ["probation", "Thử việc"], ["suspended", "Tạm hoãn"], ["resigned", "Đã nghỉ việc"]] }
          ]);
          if (v) act(null, () => put(`/api/admin/staff/${s.id}`, { ...v, baseSalary: Number(v.baseSalary) }), "Đã lưu thông tin nhân viên.", reload);
        });
        $$("[data-l]", body).forEach(b => b.onclick = () => act(b, () => post(`/api/admin/staff/${b.dataset.l}/lock`, { lock: b.dataset.v === "1" }), "Đã cập nhật.", reload));
        $$("[data-p]", body).forEach(b => b.onclick = async () => { const v = await ask("Cấp lại mật khẩu", [{ name: "mode", label: "Cách cấp", type: "select", options: [["auto", "Tự sinh mật khẩu ngẫu nhiên"], ["manual", "Tự đặt"]] }, { name: "password", label: "Mật khẩu mới (nếu tự đặt)", type: "password" }, { name: "confirm", label: "Nhập lại", type: "password" }]); if (v) act(null, () => post(`/api/admin/staff/${b.dataset.p}/reset-password`, v.mode === "auto" ? {} : { password: v.password, confirm: v.confirm }), "", async x => { await showPw(x); reload(); }); });
        $$("[data-r]", body).forEach(b => b.onclick = async () => { const s = find(b.dataset.r); const v = await ask("Đổi vai trò " + s.id, [{ name: "role", label: "Vai trò mới", type: "select", value: s.role, options: ro }], { intro: "Không đổi được khi nhân viên còn việc đang xử lý." }); if (v) act(null, () => post(`/api/admin/staff/${s.id}/role`, v), "Đã đổi vai trò.", reload); });
        $$("[data-rem]", body).forEach(b => b.onclick = async () => {
          const s = find(b.dataset.rem);
          const v = await ask(`Nhắc nhở vi phạm: ${s.name} (${s.id})`, [
            { name: "title", label: "Tiêu đề nhắc nhở", required: true, placeholder: "VD: Đi muộn, chưa hoàn tất công việc, vi phạm quy định..." },
            { name: "reason", label: "Lý do / Hành vi vi phạm", type: "textarea", required: true, placeholder: "Mô tả chi tiết vi phạm của nhân viên..." }
          ], {
            submit: "Gửi nhắc nhở & Trừ 200k",
            kind: "bad",
            intro: `<div class="note warn"><b>Cảnh báo:</b> Khi gửi thông báo nhắc nhở, hệ thống sẽ <b>ghi nhận 1 lỗi vi phạm</b> vào hồ sơ và <b>tự động trừ 200.000 ₫</b> tiền lương/ví thu nhập của nhân viên theo quy chế công ty.</div>`
          });
          if (v) act(null, () => post("/api/admin/salaries/remind", { staffId: s.id, title: v.title, reason: v.reason }), "Đã gửi thông báo nhắc nhở, ghi 1 lỗi và trừ 200.000 ₫ tiền lương.", reload);
        });
        $$("[data-x]", body).forEach(b => b.onclick = async () => { if (await confirmBox("Xóa tài khoản nhân viên", "Xóa tài khoản " + esc(b.dataset.x) + "?<br><span class='bad'>Nhân viên sẽ bị thu hồi quyền và đăng xuất. Không xóa được khi còn việc đang xử lý.</span>", "bad")) act(null, () => del(`/api/admin/staff/${b.dataset.x}`), "Đã xóa.", reload); });
      }
      $("#sr", bar).onchange = reload; $("#ss", bar).onchange = reload;
      $("#ns", bar).onclick = async () => {
        if (!roles.length) await reload();
        const v = await ask("Thêm nhân viên", [
          { name: "name", label: "Họ tên", required: true },
          { name: "role", label: "Vai trò", type: "select", options: roles.map(x => [x.key, x.name]) },
          { name: "email", label: "Email công ty" },
          { name: "phone", label: "Điện thoại" },
          { name: "startDate", label: "Ngày vào làm", type: "date", value: new Date().toISOString().slice(0, 10) },
          { name: "baseSalary", label: "Lương cơ bản (₫ - để trống = theo chuẩn vai trò)", type: "number" },
          { name: "auto", label: "Tự sinh mật khẩu", type: "checkbox", value: true },
          { name: "password", label: "Mật khẩu (nếu tự đặt)", type: "password" },
          { name: "confirm", label: "Nhập lại", type: "password" },
          { name: "guideType", label: "Nếu là HDV – loại", type: "select", options: [["domestic", "Nội địa"], ["international", "Quốc tế"]] },
          { name: "employmentType", label: "Nếu là HDV – hình thức", type: "select", options: [["staff", "Chính thức"], ["freelance", "Cộng tác viên"]] },
          { name: "regions", label: "Nếu là HDV – khu vực (ngăn cách bằng dấu phẩy)", placeholder: "north,central,south" }
        ]);
        if (!v) return;
        const body = { name: v.name, role: v.role, email: v.email, phone: v.phone, startDate: v.startDate, baseSalary: v.baseSalary ? Number(v.baseSalary) : null, auto: v.auto, password: v.password, confirm: v.confirm };
        if (v.role === "guide") body.guide = { guideType: v.guideType, employmentType: v.employmentType, regions: v.regions.split(",").map(x => x.trim()).filter(Boolean) };
        act(null, () => post("/api/admin/staff", body), "Đã tạo nhân viên.", async x => { await showPw(x); reload(); });
      };
      await reload();
    } },

    { id: "rbac", label: "Phân quyền RBAC", icon: "🛡️", group: "Nhân sự", perm: "staff:manage", async render(el) {
      el.innerHTML = `
        <div class="card">
          <h2>🛡️ Chuẩn hóa Phân quyền RBAC (7 Vai trò Chuẩn)</h2>
          <div class="note info">
            Hệ thống áp dụng mô hình phân quyền chặt chẽ theo <b>Separation of Duties (SoD)</b>:
            <b>ADMIN</b> quản trị & giám sát cấp cao; <b>CASHIER</b> độc lập thu chi và xác nhận tiền; <b>OPERATOR</b> điều hành tour & phân công HDV;
            <b>SUPPORT</b> chăm sóc khách hàng & xử lý khiếu nại; <b>CONTENT</b> biên tập nội dung; <b>GUIDE</b> tác nghiệp hiện trường tour; <b>CUSTOMER</b> mua tour và đánh giá cá nhân.
          </div>
          <div class="grid g3" style="margin-top:14px">
            <div class="kpi ok"><div class="l">Mô hình phân quyền</div><div class="v" style="font-size:18px">7 Vai trò độc lập</div><div class="s">Không kiêm nhiệm SoD</div></div>
            <div class="kpi"><div class="l">Tổng quyền hạn (Permissions)</div><div class="v" style="font-size:18px">38 Quyền hạn</div><div class="s">Kiểm tra đa tầng (BE & FE)</div></div>
            <div class="kpi"><div class="l">Nguyên tắc bảo vệ</div><div class="v" style="font-size:18px">Chống leo quyền</div><div class="s">Admin không giả lập Customer</div></div>
          </div>
        </div>

        <div class="card">
          <h2>Bảng tổng hợp 7 Vai trò & Trách nhiệm</h2>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã vai trò</th>
                  <th>Tên vai trò</th>
                  <th>Phạm vi trách nhiệm chính</th>
                  <th>Quyền đặc thù & Giới hạn bắt buộc</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b class="badge" style="background:#7c3aed;color:#fff">ADMIN</b></td>
                  <td><b>Quản trị viên</b></td>
                  <td>Quản trị hệ thống, quản lý nhân viên, duyệt đơn cọc, duyệt hoàn tiền, duyệt đóng sổ, báo cáo toàn diện.</td>
                  <td><span class="bad">KHÔNG xác nhận nhận tiền (việc của Cashier); KHÔNG có quyền đặt tour/hủy tour cá nhân như Customer.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#059669;color:#fff">CASHIER</b></td>
                  <td><b>Thu ngân</b></td>
                  <td>Xác nhận thanh toán, hoàn tiền đã duyệt, chi thù lao HDV, duyệt chi rút tiền ví, lập bảng đóng sổ hàng ngày.</td>
                  <td><span class="ok">Độc quyền xác nhận tiền (payment:confirm).</span> <span class="bad">KHÔNG duyệt đơn, KHÔNG quản lý nhân sự.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#0369a1;color:#fff">OPERATOR</b></td>
                  <td><b>Điều hành tour</b></td>
                  <td>Lịch khởi hành, phân công & đổi HDV, theo dõi danh sách khách đoàn, xử lý sự cố, đề xuất hủy/dồn tour.</td>
                  <td><span class="ok">Xem CCCD unmasked để làm danh sách đoàn.</span> <span class="bad">KHÔNG duyệt hoàn tiền hay thu tiền.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#db2777;color:#fff">SUPPORT</b></td>
                  <td><b>Chăm sóc KH</b></td>
                  <td>Tiếp nhận & xử lý khiếu nại, hỗ trợ đổi ngày (reschedule) theo chính sách, quản lý danh sách chờ (waitlist).</td>
                  <td><span class="ok">Xem CCCD masked (bảo vệ quyền riêng tư).</span> <span class="bad">Chỉ đề xuất hoàn tiền, Admin duyệt.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#ea580c;color:#fff">CONTENT</b></td>
                  <td><b>Biên tập viên</b></td>
                  <td>Biên tập nội dung tour, tạo bản nháp tour mới, quản lý ẩm thực đặc sản, banner trang chủ, duyệt đánh giá.</td>
                  <td><span class="bad">KHÔNG sửa trường nhạy cảm (giá, loại HDV, sức chứa) - Admin duyệt khi xuất bản.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#0d9488;color:#fff">GUIDE</b></td>
                  <td><b>Hướng dẫn viên</b></td>
                  <td>Tiếp nhận tour được phân công, điểm danh khách tại điểm đón, bắt đầu/kết thúc tour, báo cáo sự cố hiện trường.</td>
                  <td><span class="ok">Chỉ truy cập tour và khách của tour mình phụ trách.</span> <span class="bad">KHÔNG can thiệp tour khác.</span></td>
                </tr>
                <tr>
                  <td><b class="badge" style="background:#64748b;color:#fff">CUSTOMER</b></td>
                  <td><b>Khách hàng</b></td>
                  <td>Xem tour, đặt tour, thanh toán cọc/đủ, quản lý đơn của mình, hủy/đổi ngày theo chính sách, viết đánh giá.</td>
                  <td><span class="ok">Role DUY NHẤT được đặt tour mua dịch vụ.</span> <span class="bad">Không thể truy cập cổng Staff/Admin.</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } },

    { id: "salaries", label: "Quản lý Lương", icon: "💼", group: "Nhân sự", perm: "staff:manage", async render(el) {
      let roleTab = "all";
      let filterYear = "";
      let filterQuarter = "";
      let filterMonth = "";
      let filterRole = "";
      let filterType = "";
      let logPageLimit = 100;

      async function reload() {
        const res = await get("/api/admin/salaries");
        const list = res.staff || [];
        const logs = res.logs || [];
        const defSal = res.defaultSalary || 15000000;

        // Group counts by role
        const roleCounts = {
          all: list.length,
          operator: list.filter(x => (x.role || "").toLowerCase() === "operator").length,
          cashier: list.filter(x => (x.role || "").toLowerCase() === "cashier").length,
          support: list.filter(x => (x.role || "").toLowerCase() === "support").length,
          content: list.filter(x => (x.role || "").toLowerCase() === "content").length,
          guide: list.filter(x => (x.role || "").toLowerCase() === "guide").length,
          admin: list.filter(x => (x.role || "").toLowerCase() === "admin").length
        };

        const roleNames = {
          all: "Tất cả nhân viên",
          operator: "Điều hành tour",
          cashier: "Thu ngân",
          support: "Chăm sóc khách hàng",
          content: "Biên tập viên",
          guide: "Hướng dẫn viên",
          admin: "Quản trị viên"
        };

        const totalCompanyFund = list.reduce((s, x) => s + (x.baseSalary || defSal), 0);

        el.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <h2 style="margin:0">Quản lý Lương & Phát lương Nhân sự</h2>
                <div class="muted small" style="margin-top:4px">Bảng lương riêng biệt từng vai trò, xét tăng lương KPI định kỳ, phát lương trực tiếp và khấu trừ tự động vào Dashboard doanh thu.</div>
              </div>
              <div class="row" style="gap:8px;flex-wrap:wrap">
                <button class="btn primary" id="adm-pay-all-btn">💰 Phát lương toàn công ty (${list.length} người)</button>
              </div>
            </div>

            <div class="grid g3" style="margin-top:16px">
              <div class="kpi"><div class="l">Tổng nhân sự nội bộ</div><div class="v">${list.length} người</div><div class="s">6 vai trò phòng ban</div></div>
              <div class="kpi ok"><div class="l">Tổng quỹ lương công ty / đợt</div><div class="v">${money(totalCompanyFund)}</div><div class="s">Tự động trừ thực thu Dashboard</div></div>
              <div class="kpi"><div class="l">Lương cơ bản bình quân</div><div class="v">${money(list.length ? Math.round(totalCompanyFund / list.length) : defSal)}</div><div class="s">Định mức: ${money(defSal)}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              <div>
                <h2 style="margin:0" id="role-table-title">Bảng lương theo từng vai trò</h2>
                <div class="muted small" style="margin-top:2px">Bấm vào từng vai trò bên dưới để quản lý bảng lương riêng của phòng ban đó</div>
              </div>
            </div>

            <!-- Tab chọn vai trò riêng biệt -->
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:14px;border-bottom:1px solid var(--border)">
              <button class="pill-btn ${roleTab === 'all' ? 'active' : ''}" data-role-tab="all">👥 Tất cả (${roleCounts.all})</button>
              <button class="pill-btn ${roleTab === 'operator' ? 'active' : ''}" data-role-tab="operator">🧭 Điều hành (${roleCounts.operator})</button>
              <button class="pill-btn ${roleTab === 'cashier' ? 'active' : ''}" data-role-tab="cashier">🧾 Thu ngân (${roleCounts.cashier})</button>
              <button class="pill-btn ${roleTab === 'support' ? 'active' : ''}" data-role-tab="support">🎧 CSKH (${roleCounts.support})</button>
              <button class="pill-btn ${roleTab === 'content' ? 'active' : ''}" data-role-tab="content">📝 Biên tập (${roleCounts.content})</button>
              <button class="pill-btn ${roleTab === 'guide' ? 'active' : ''}" data-role-tab="guide">🧑‍✈️ HDV (${roleCounts.guide})</button>
              <button class="pill-btn ${roleTab === 'admin' ? 'active' : ''}" data-role-tab="admin">🛡️ Quản trị (${roleCounts.admin})</button>
            </div>

            <!-- Thống kê nhanh vai trò đang chọn -->
            <div id="role-quick-stats" style="margin-bottom:12px"></div>

            <div id="adm-salary-table"></div>
          </div>

          <div class="card">
            <div class="card-header-acts" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              <div>
                <h2 style="margin:0">Lịch sử phát lương & Thống kê quỹ lương (${logs.length} bản ghi)</h2>
                <div class="muted small" style="margin-top:2px">Thống kê chi tiết quỹ lương chi trả theo từng Tháng, Quý, Năm và Vai trò</div>
              </div>
            </div>

            <!-- Bộ lọc thời gian & vai trò thống kê lương -->
            <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:14px;background:var(--bg);padding:10px 14px;border-radius:8px;border:1px solid var(--border);align-items:center">
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:4px">🔍 Lọc thống kê:</div>
              <select id="sal-flt-year" class="input sm" style="width:130px">
                <option value="">Tất cả các năm</option>
                ${Array.from({ length: 2026 - 1986 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}" ${filterYear === String(y) ? 'selected' : ''}>Năm ${y}</option>`).join('')}
              </select>

              <select id="sal-flt-quarter" class="input sm" style="width:120px">
                <option value="">Tất cả các quý</option>
                <option value="1" ${filterQuarter === '1' ? 'selected' : ''}>Quý 1 (T1-T3)</option>
                <option value="2" ${filterQuarter === '2' ? 'selected' : ''}>Quý 2 (T4-T6)</option>
                <option value="3" ${filterQuarter === '3' ? 'selected' : ''}>Quý 3 (T7-T9)</option>
                <option value="4" ${filterQuarter === '4' ? 'selected' : ''}>Quý 4 (T10-T12)</option>
              </select>

              <select id="sal-flt-month" class="input sm" style="width:120px">
                <option value="">Tất cả tháng</option>
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${filterMonth === String(m) ? 'selected' : ''}>Tháng ${m}</option>`).join('')}
              </select>

              <select id="sal-flt-role" class="input sm" style="width:140px">
                <option value="">Tất cả vai trò</option>
                <option value="operator" ${filterRole === 'operator' ? 'selected' : ''}>Điều hành tour</option>
                <option value="cashier" ${filterRole === 'cashier' ? 'selected' : ''}>Thu ngân</option>
                <option value="support" ${filterRole === 'support' ? 'selected' : ''}>CSKH</option>
                <option value="content" ${filterRole === 'content' ? 'selected' : ''}>Biên tập viên</option>
                <option value="guide" ${filterRole === 'guide' ? 'selected' : ''}>Hướng dẫn viên</option>
                <option value="admin" ${filterRole === 'admin' ? 'selected' : ''}>Quản trị viên</option>
              </select>

              <select id="sal-flt-type" class="input sm" style="width:130px">
                <option value="">Tất cả loại GD</option>
                <option value="pay" ${filterType === 'pay' ? 'selected' : ''}>Phát lương</option>
                <option value="bonus" ${filterType === 'bonus' ? 'selected' : ''}>Thưởng nóng</option>
                <option value="fine" ${filterType === 'fine' ? 'selected' : ''}>Trừ phạt (-200k)</option>
                <option value="increase" ${filterType === 'increase' ? 'selected' : ''}>Tăng lương</option>
                <option value="decrease" ${filterType === 'decrease' ? 'selected' : ''}>Giảm lương</option>
              </select>

              <button class="btn sm" id="sal-flt-reset" title="Đặt lại bộ lọc">🔄 Đặt lại</button>
            </div>

            <!-- KPI thống kê quỹ lương theo bộ lọc -->
            <div id="sal-stats-kpis" class="grid g4" style="margin-bottom:16px"></div>

            <div id="adm-salary-logs"></div>
          </div>
        `;

        // Hàm kiểm tra ngày phát lương (ngày 25 hàng tháng)
        async function checkPayDayWarning() {
          const PAY_DAY = 25;
          const now = new Date();
          const d = now.getDate();
          const m = now.getMonth() + 1;
          if (d !== PAY_DAY) {
            return await confirmBox(
              "⚠️ Chưa tới ngày phát lương định kỳ",
              `Hôm nay là <b>ngày ${d}/${m}</b>. Ngày phát lương định kỳ của công ty là <b>ngày ${PAY_DAY} hàng tháng</b>.<br><br>Bạn có chắc chắn muốn duyệt chi phát lương trước hạn không?`,
              "warn"
            );
          }
          return true;
        }

        // Render bảng lương theo vai trò đang chọn
        function renderStaffTable() {
          const filtered = roleTab === "all" ? list : list.filter(x => (x.role || "").toLowerCase() === roleTab);
          const roleFund = filtered.reduce((s, x) => s + (x.baseSalary || defSal), 0);

          $("#role-table-title", el).textContent = `Bảng lương: ${roleNames[roleTab]} (${filtered.length} nhân sự)`;
          $("#role-quick-stats", el).innerHTML = `
            <div class="note info" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>Phòng ban: <b>${roleNames[roleTab]}</b> · Số lượng: <b>${filtered.length}</b> người · Tổng quỹ lương đợt: <b style="color:var(--ok)">${money(roleFund)}</b></div>
              ${filtered.length ? `<span class="small muted">Lương TB: <b>${money(Math.round(roleFund / filtered.length))}</b> / người / tháng</span>` : ""}
            </div>
          `;

          const tbl = $("#adm-salary-table", el);
          tbl.innerHTML = table([
            { t: "Nhân viên & Vai trò", cls: "sticky-col", html: s => {
              const isG = s.role === "guide";
              const typeBadge = isG ? (s.baseSalary > 0 ? '<span class="badge ok" style="font-size:11px">HDV Biên chế</span>' : '<span class="badge" style="font-size:11px">HDV Cộng tác viên</span>') : `<span class="badge info" style="font-size:11px">${esc(s.roleName || s.role)}</span>`;
              return `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:14px;color:var(--text)">${esc(s.name)}</div>
                  <div class="small muted" style="margin-top:2px">${esc(s.id)} · ${typeBadge}</div>
                  <div class="small muted" style="font-size:11px">${esc(s.email)}</div>
                </div>
              `;
            } },
            { t: "Lương cơ bản", num: true, html: s => {
              if (s.role === "guide") {
                if (!s.baseSalary || s.baseSalary <= 0) {
                  return `<b style="color:var(--muted);font-size:0.95rem">0 ₫</b><div class="small muted">Hưởng thù lao tour (7–10% hoặc 10–12%)</div>`;
                }
                return `<b style="color:var(--navy);font-size:1.05rem">${money(s.baseSalary)}</b><div class="small ok">+ Thù lao tour (3–5% hoặc 5–7%)</div>`;
              }
              return `<b style="color:var(--navy);font-size:1.05rem">${money(s.baseSalary || defSal)}</b>`;
            } },
            { t: "KPI gần nhất", html: s => {
              const k = s.kpiRecent != null ? s.kpiRecent : s.kpi;
              if (k != null) {
                const rat = s.kpiRating || (k >= 90 ? 'Xuất sắc' : (k >= 80 ? 'Tốt' : (k >= 60 ? 'Khá' : 'Đạt')));
                return `<span class="badge ${k >= 80 ? 'ok' : (k >= 60 ? 'info' : 'bad')}">${k}% · ${esc(rat)}</span>`;
              }
              return '<span class="muted small">Chưa đánh giá</span>';
            } },
            { t: "Hạn xét lương", html: s => {
              let badge = '';
              if (s.isDue) badge = '<div class="badge bad" style="font-size:10px;margin-top:2px">🔔 Đến hạn</div>';
              else if (s.isUpcoming) badge = `<div class="badge warn" style="font-size:10px;margin-top:2px">⚠️ Sắp đến (${s.daysUntilReview}d)</div>`;
              return `<span style="font-size:13px">${day(s.nextReviewDate)}</span>${badge}`;
            } },
            { t: "Ví / Đã nhận", num: true, html: s => `
              <div>Ví: <b style="color:var(--ok)">${money(s.balance)}</b></div>
              <div class="small muted">Đã nhận: ${money(s.totalEarned)}</div>
            ` },
            { t: "Thao tác", nowrap: true, cls: "actions", html: s => `
              <div class="act-btns" style="display:flex;gap:4px;align-items:center;flex-wrap:nowrap">
                <button class="btn ok sm" data-prof="${esc(s.id)}" title="Xem chi tiết hồ sơ lương, đánh giá KPI và xét tăng lương">👁️ Xét lương & KPI</button>
                <button class="btn primary sm" data-pay="${esc(s.id)}" title="Phát lương cho nhân viên này">💵 Phát lương</button>
                <button class="btn sm" data-inc="${esc(s.id)}" title="Tăng lương cơ bản">➕</button>
                <button class="btn sm" data-dec="${esc(s.id)}" title="Giảm lương cơ bản">➖</button>
                <button class="btn sm" data-bon="${esc(s.id)}" title="Thưởng nóng">🎁</button>
                <button class="btn bad sm" data-rem="${esc(s.id)}" title="Ghi 1 lỗi & phạt 200k tiền lương">⚠️ Phạt (-200k)</button>
              </div>
            ` }
          ], filtered, { empty: `Chưa có nhân viên nào trong vai trò ${roleNames[roleTab]}` });

          const wrap = tbl.querySelector(".tbl-wrap");
          if (wrap) wrap.scrollLeft = 0;

          $$("[data-prof]", tbl).forEach(btn => btn.onclick = () => {
            openStaffProfileModal(btn.dataset.prof, reload);
          });

          $$("[data-pay]", tbl).forEach(btn => btn.onclick = async () => {
            if (!(await checkPayDayWarning())) return;
            const s = list.find(x => x.id === btn.dataset.pay);
            const v = await ask(`Phát lương cho ${s.name}`, [
              { name: "amount", label: "Số tiền phát lương (₫)", type: "number", value: s.baseSalary || defSal, required: true },
              { name: "note", label: "Ghi chú lời nhắn", type: "text", placeholder: "Ví dụ: Lương tháng " + (new Date().getMonth() + 1) }
            ], { submit: "Xác nhận phát lương", kind: "ok" });
            if (v) act(null, () => post("/api/admin/salaries/pay", { staffId: s.id, amount: Number(v.amount), note: v.note }), "Đã phát lương thành công (tiền đã trừ trực tiếp vào Dashboard).", reload);
          });

          $$("[data-inc]", tbl).forEach(btn => btn.onclick = async () => {
            const s = list.find(x => x.id === btn.dataset.inc);
            const v = await ask(`Tăng lương cơ bản cho ${s.name}`, [
              { name: "amount", label: "Số tiền tăng thêm mỗi tháng (₫)", type: "number", value: 1000000, required: true },
              { name: "reason", label: "Lý do tăng lương", type: "textarea", required: true, placeholder: "Hoàn thành xuất sắc nhiệm vụ..." }
            ], { submit: "Tăng lương", kind: "ok", intro: `Mức lương hiện tại: <b>${money(s.baseSalary || defSal)}</b>` });
            if (v) act(null, () => post("/api/admin/salaries/adjust", { staffId: s.id, action: "increase", amount: Number(v.amount), reason: v.reason }), "Đã tăng lương cơ bản.", reload);
          });

          $$("[data-dec]", tbl).forEach(btn => btn.onclick = async () => {
            const s = list.find(x => x.id === btn.dataset.dec);
            const v = await ask(`Giảm lương cơ bản của ${s.name}`, [
              { name: "amount", label: "Số tiền giảm bớt mỗi tháng (₫)", type: "number", value: 1000000, required: true },
              { name: "reason", label: "Lý do giảm lương", type: "textarea", required: true, placeholder: "Vi phạm quy chế hoặc điều chỉnh định mức..." }
            ], { submit: "Giảm lương", kind: "bad", intro: `Mức lương hiện tại: <b>${money(s.baseSalary || defSal)}</b>` });
            if (v) act(null, () => post("/api/admin/salaries/adjust", { staffId: s.id, action: "decrease", amount: Number(v.amount), reason: v.reason }), "Đã giảm lương cơ bản.", reload);
          });

          $$("[data-bon]", tbl).forEach(btn => btn.onclick = async () => {
            const s = list.find(x => x.id === btn.dataset.bon);
            const v = await ask(`Thưởng nóng vào ví của ${s.name}`, [
              { name: "amount", label: "Số tiền thưởng (₫)", type: "number", value: 1000000, required: true },
              { name: "reason", label: "Lý do khen thưởng", type: "textarea", required: true, placeholder: "Thưởng dự án, thưởng sáng kiến..." }
            ], { submit: "Thưởng nóng", kind: "ok" });
            if (v) act(null, () => post("/api/admin/salaries/adjust", { staffId: s.id, action: "bonus", amount: Number(v.amount), reason: v.reason }), "Đã thưởng tiền vào ví nhân viên.", reload);
          });

          $$("[data-rem]", tbl).forEach(btn => btn.onclick = async () => {
            const s = list.find(x => x.id === btn.dataset.rem);
            const v = await ask(`Nhắc nhở vi phạm: ${s.name}`, [
              { name: "title", label: "Tiêu đề nhắc nhở", required: true, placeholder: "VD: Đi muộn, chưa nộp báo cáo, vi phạm quy định..." },
              { name: "reason", label: "Lý do / Hành vi vi phạm", type: "textarea", required: true, placeholder: "Mô tả chi tiết vi phạm..." }
            ], {
              submit: "Gửi nhắc nhở & Trừ 200k",
              kind: "bad",
              intro: `<div class="note warn"><b>Cảnh báo:</b> Khi gửi thông báo nhắc nhở, hệ thống sẽ <b>ghi nhận 1 lỗi vi phạm</b> vào hồ sơ và <b>tự động trừ 200.000 ₫</b> tiền lương/ví thu nhập của nhân viên theo quy chế công ty.</div>`
            });
            if (v) act(null, () => post("/api/admin/salaries/remind", { staffId: s.id, title: v.title, reason: v.reason }), "Đã gửi thông báo nhắc nhở, ghi 1 lỗi và trừ 200.000 ₫ tiền lương.", reload);
          });
        }

        // Lọc và render lịch sử phát lương
        function renderSalaryLogs() {
          let filteredLogs = logs.filter(l => {
            if (!l.at) return true;
            const dt = new Date(l.at);
            const y = dt.getFullYear();
            const m = dt.getMonth() + 1;
            const q = Math.ceil(m / 3);

            if (filterYear && String(y) !== filterYear) return false;
            if (filterQuarter && String(q) !== filterQuarter) return false;
            if (filterMonth && String(m) !== filterMonth) return false;
            if (filterRole && (l.role || "").toLowerCase() !== filterRole.toLowerCase()) return false;
            if (filterType && (l.type || "").toLowerCase() !== filterType.toLowerCase()) return false;
            return true;
          });

          // Tính toán số liệu thống kê quỹ lương
          let sumPay = 0, sumBonus = 0, sumFine = 0, sumInc = 0;
          for (const l of filteredLogs) {
            const amt = Number(l.amount) || 0;
            if (l.type === "pay") sumPay += amt;
            else if (l.type === "bonus") sumBonus += amt;
            else if (l.type === "fine") sumFine += amt;
            else if (l.type === "increase") sumInc += amt;
          }
          const netSpent = sumPay + sumBonus - sumFine;

          let labelTime = [];
          if (filterYear) labelTime.push(`Năm ${filterYear}`);
          if (filterQuarter) labelTime.push(`Quý ${filterQuarter}`);
          if (filterMonth) labelTime.push(`Tháng ${filterMonth}`);
          if (filterRole) labelTime.push(`Vai trò: ${roleNames[filterRole] || filterRole}`);
          const filterDesc = labelTime.length ? labelTime.join(' · ') : 'Toàn bộ thời gian (2010–2026)';

          const kpiBox = $("#sal-stats-kpis", el);
          kpiBox.innerHTML = `
            <div class="kpi ok">
              <div class="l">Tổng chi quỹ lương (Thực chi)</div>
              <div class="v">${money(netSpent)}</div>
              <div class="s">${filterDesc}</div>
            </div>
            <div class="kpi">
              <div class="l">Lương định kỳ đã phát</div>
              <div class="v">${money(sumPay)}</div>
              <div class="s">${filteredLogs.filter(l => l.type === 'pay').length} đợt phát lương</div>
            </div>
            <div class="kpi" style="border-left:4px solid var(--ok)">
              <div class="l">Thưởng nóng / Khen thưởng</div>
              <div class="v" style="color:var(--ok)">+${money(sumBonus)}</div>
              <div class="s">${filteredLogs.filter(l => l.type === 'bonus').length} lần thưởng</div>
            </div>
            <div class="kpi ${sumFine > 0 ? 'bad' : ''}">
              <div class="l">Tiền phạt vi phạm thu hồi</div>
              <div class="v" style="color:var(--bad)">-${money(sumFine)}</div>
              <div class="s">${filteredLogs.filter(l => l.type === 'fine').length} lỗi vi phạm</div>
            </div>
          `;

          const logTbl = $("#adm-salary-logs", el);
          const displaySlice = filteredLogs.slice(0, logPageLimit);
          logTbl.innerHTML = `
            ${table([
              { t: "Thời gian", html: l => dt(l.at), sort: l => l.at },
              { t: "Nhân viên", html: l => `<b>${esc(l.staffName)}</b><div class="small muted">${esc(l.staffId || "")}</div>` },
              { t: "Vai trò", html: l => `<span class="badge info">${esc(roleNames[l.role] || l.role)}</span>` },
              { t: "Hành động", html: l => {
                const typeMap = {
                  pay: '<span class="badge ok">Phát lương</span>',
                  increase: '<span class="badge ok">Tăng lương</span>',
                  decrease: '<span class="badge bad">Trừ lương</span>',
                  bonus: '<span class="badge ok">Thưởng nóng</span>',
                  fine: '<span class="badge bad">Phạt lỗi (-200k)</span>'
                };
                return typeMap[l.type] || esc(l.type);
              } },
              { t: "Số tiền", num: true, html: l => {
                if (l.type === "fine" || l.type === "decrease") {
                  return `<b style="color:var(--bad)">-${money(l.amount)}</b>`;
                }
                return `<b>${money(l.amount)}</b>`;
              } },
              { t: "Lý do / Lời nhắn", html: l => esc(l.desc || l.reason || l.note || "—") },
              { t: "Người duyệt", html: l => esc(l.byName || "Admin") }
            ], displaySlice, { empty: "Không tìm thấy lịch sử phát lương nào phù hợp với bộ lọc" })}
            ${filteredLogs.length > displaySlice.length ? `
              <div style="text-align:center;padding:12px">
                <button class="btn sm" id="sal-logs-show-more">Hiển thị thêm ${Math.min(100, filteredLogs.length - displaySlice.length)} / ${filteredLogs.length - displaySlice.length} bản ghi còn lại</button>
              </div>
            ` : ""}
          `;

          const moreBtn = $("#sal-logs-show-more", logTbl);
          if (moreBtn) {
            moreBtn.onclick = () => {
              logPageLimit += 100;
              renderSalaryLogs();
            };
          }
        }

        // Bắt sự kiện tab vai trò
        $$("[data-role-tab]", el).forEach(btn => {
          btn.onclick = () => {
            roleTab = btn.dataset.roleTab;
            $$("[data-role-tab]", el).forEach(b => b.classList.toggle("active", b.dataset.roleTab === roleTab));
            renderStaffTable();
          };
        });

        // Bắt sự kiện bộ lọc thống kê lương
        $("#sal-flt-year", el).onchange = e => { filterYear = e.target.value; renderSalaryLogs(); };
        $("#sal-flt-quarter", el).onchange = e => { filterQuarter = e.target.value; renderSalaryLogs(); };
        $("#sal-flt-month", el).onchange = e => { filterMonth = e.target.value; renderSalaryLogs(); };
        $("#sal-flt-role", el).onchange = e => { filterRole = e.target.value; renderSalaryLogs(); };
        $("#sal-flt-type", el).onchange = e => { filterType = e.target.value; renderSalaryLogs(); };

        $("#sal-flt-reset", el).onclick = () => {
          filterYear = "";
          filterQuarter = "";
          filterMonth = "";
          filterRole = "";
          filterType = "";
          $("#sal-flt-year", el).value = "";
          $("#sal-flt-quarter", el).value = "";
          $("#sal-flt-month", el).value = "";
          $("#sal-flt-role", el).value = "";
          $("#sal-flt-type", el).value = "";
          renderSalaryLogs();
        };

        // Bắt sự kiện nút phát lương toàn bộ
        $("#adm-pay-all-btn", el).onclick = async () => {
          if (!(await checkPayDayWarning())) return;
          const totalQ = list.reduce((s, x) => s + (x.baseSalary || defSal), 0);
          if (await confirmBox("Xác nhận phát lương toàn công ty", `Bạn có chắc muốn phát lương cho toàn bộ ${list.length} nhân viên? Tổng chi: ${money(totalQ)}. Số tiền này sẽ tự động trừ vào thực thu của Dashboard doanh thu.`)) {
            const note = prompt("Nhập ghi chú đợt phát lương (ví dụ: Lương tháng " + (new Date().getMonth() + 1) + "):", "Phát lương định kỳ toàn công ty từ Ban Giám Đốc");
            if (note != null) {
              act(null, () => post("/api/admin/salaries/pay-all", { note }), "Đã phát lương thành công cho tất cả nhân viên. Doanh thu Dashboard đã được tự động khấu trừ.", reload);
            }
          }
        };

        renderStaffTable();
        renderSalaryLogs();
      }
      await reload();
    } },

    { id: "payments", label: "Giám sát thanh toán", icon: "💳", group: "Tài chính", perm: "payment:view", async render(el) {
      const bar = h(`<div class="toolbar">
        <input type="search" id="pm-q" placeholder="Tìm mã đơn, tên khách, số tiền…" style="min-width:220px">
        <select id="pm-status">
          <option value="all">Tất cả trạng thái</option>
          <option value="debt">Đơn còn nợ (công nợ)</option>
          <option value="confirmed_debt">Đơn chốt duyệt còn nợ</option>
          <option value="deposit">Đã cọc</option>
          <option value="pending">Chờ xác nhận tiền</option>
          <option value="paid">Đã thanh toán đủ</option>
          <option value="refunded">Đã hoàn tiền / hủy</option>
        </select>
        <select id="pm-year">
          <option value="all">Mọi năm (1986–2026)</option>
          ${Array.from({ length: 2026 - 1986 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === 2026 ? "selected" : ""}>Năm ${y}</option>`).join('')}
        </select>
        <button class="btn sm" id="pm-refresh">🔄 Làm mới</button>
      </div>`);
      const summaryBox = h(`<div class="grid g4" style="margin-bottom:14px"></div>`);
      const body = h("<div></div>");
      el.append(bar, summaryBox, body);

      async function reload() {
        const [qData, bookingsData, statsData] = await Promise.all([
          get("/api/cashier/queue").catch(() => ({ queue: [] })),
          get("/api/admin/bookings?status=").catch(() => ({ bookings: [] })),
          get("/api/stats?period=year&year=" + ($("#pm-year", bar).value === "all" ? 2026 : $("#pm-year", bar).value)).catch(() => ({ kpi: {} }))
        ]);
        const list = bookingsData.bookings || [];
        const filterVal = $("#pm-status", bar).value;
        const yearVal = $("#pm-year", bar).value;
        const qVal = ($("#pm-q", bar).value || "").toLowerCase().trim();

        const yearList = (yearVal === "all") ? list : list.filter(b => {
          const y1 = b.createdAt ? b.createdAt.slice(0, 4) : "";
          const y2 = b.date ? b.date.slice(0, 4) : "";
          return y1 === yearVal || y2 === yearVal;
        });

        const filtered = yearList.filter(b => {
          const isCancelled = b.status === "cancelled" || b.status === "refunded";
          const remaining = Math.max(0, (b.price || 0) - (b.paidAmount || 0));
          if (filterVal === "debt" && (isCancelled || remaining <= 0)) return false;
          if (filterVal === "confirmed_debt" && (isCancelled || remaining <= 0 || !["confirmed", "in_progress", "completed", "guide_accepted", "departed"].includes(b.status))) return false;
          if (filterVal === "pending" && b.paymentStatus !== "pending" && b.status !== "awaiting_payment") return false;
          if (filterVal === "paid" && b.paidAmount < b.price) return false;
          if (filterVal === "deposit" && (b.paidAmount <= 0 || b.paidAmount >= b.price)) return false;
          if (filterVal === "refunded" && !isCancelled) return false;
          if (qVal) {
            const str = `${b.payCode} ${b.customerName} ${b.tourName} ${b.phone || ""}`.toLowerCase();
            if (!str.includes(qVal)) return false;
          }
          return true;
        });

        const totalExpected = yearList.reduce((s, x) => s + (x.price || 0), 0);
        const totalCollected = yearList.reduce((s, x) => s + (x.paidAmount || 0), 0);
        const totalSysCollected = Math.max(totalCollected, statsData.kpi?.collected || totalCollected);
        const counterExtra = Math.max(0, totalSysCollected - totalCollected);
        const activeDebts = yearList.filter(x => x.status !== "cancelled" && x.status !== "refunded" && (x.price || 0) > (x.paidAmount || 0));
        const totalPending = activeDebts.reduce((s, x) => s + ((x.price || 0) - (x.paidAmount || 0)), 0);
        const confirmedDebts = yearList.filter(x => ["confirmed", "in_progress", "completed", "guide_accepted", "departed"].includes(x.status) && (x.price || 0) > (x.paidAmount || 0));
        const totalConfirmedPending = confirmedDebts.reduce((s, x) => s + ((x.price || 0) - (x.paidAmount || 0)), 0);

        summaryBox.innerHTML = `
          <div class="kpi ok">
            <div class="l">Tổng thực thu hệ thống</div>
            <div class="v">${money(totalSysCollected)}</div>
            <div class="s">Thu đơn tour: <b>${money(totalCollected)}</b> · Thu quầy: <b>${money(counterExtra)}</b></div>
          </div>
          <div class="kpi">
            <div class="l">Tổng giá trị đơn tour</div>
            <div class="v">${money(totalExpected)}</div>
            <div class="s">${yearList.length} đơn tour phát sinh</div>
          </div>
          <div class="kpi warn">
            <div class="l">Công nợ còn phải thu</div>
            <div class="v">${money(totalConfirmedPending)}</div>
            <div class="s">Từ các đơn tour đã chốt duyệt</div>
          </div>
          <div class="kpi">
            <div class="l">Đơn chờ đối soát / quầy</div>
            <div class="v">${(qData.queue || []).length}</div>
            <div class="s">Giao dịch thu ngân đang chờ</div>
          </div>
        `;

        body.innerHTML = `
          <div class="note info" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <b>Đối chiếu dòng tiền chuẩn khớp:</b> Tổng thu trên Dashboard đạt <b>${money(totalSysCollected)}</b> (gồm <b>${money(totalCollected)}</b> từ ${yearList.length} đơn tour bên dưới và <b>${money(counterExtra)}</b> từ phiếu thu quầy / dịch vụ bổ sung). Khớp 100% với Dashboard doanh thu.
            </div>
            <span class="badge ok">✓ Đối chiếu chuẩn 100%</span>
          </div>
          ${table([
            { t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono"><b>${esc(b.payCode)}</b></a>`, sort: b => b.payCode },
            { t: "Khách hàng", html: b => `<b>${esc(b.customerName)}</b><div class="small muted">${esc(b.phone || "")}</div>` },
            { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">Ngày đi: ${day(b.date)}</div>` },
            { t: "Tổng đơn", num: true, html: b => `<b>${money(b.price)}</b>`, sort: b => b.price },
            { t: "Đã thu", num: true, html: b => `<b style="color:var(--ok)">${money(b.paidAmount)}</b>`, sort: b => b.paidAmount },
            { t: "Còn thiếu", num: true, html: b => (b.status === "cancelled" || b.status === "refunded") ? `<span class="muted">0 đ</span>` : `<b style="color:${(b.price || 0) > (b.paidAmount || 0) ? "var(--bad)" : "inherit"}">${money(Math.max(0, (b.price || 0) - (b.paidAmount || 0)))}</b>` },
            { t: "Trạng thái", html: b => badge(b.status) },
            { t: "Thao tác", html: b => `<button class="btn sm" data-view="${esc(b.id)}">Chi tiết</button>` }
          ], filtered, { sortable: true, empty: "Không tìm thấy giao dịch nào" })}
        `;
        $$("[data-view]", body).forEach(b => b.onclick = (e) => { e.preventDefault(); viewOrder(b.dataset.view).catch(fail); });
      }

      $("#pm-q", bar).oninput = () => { clearTimeout(window.__pm_t); window.__pm_t = setTimeout(reload, 300); };
      $("#pm-status", bar).onchange = reload;
      $("#pm-year", bar).onchange = reload;
      $("#pm-refresh", bar).onclick = reload;
      await reload();
    } },

    { id: "working-capital", label: "Tiền lưu động", icon: "🏦", group: "Tài chính", perm: "stats:view_full", async render(el) {
      let curYear = 2026;
      let curTab = "in"; // "in", "out", "all"
      let curCat = "all";

      async function reload() {
        const res = await get(`/api/finance/working-capital?year=${curYear}`);
        const totalCollected = res.totalCollected || 0;
        const totalSpent = res.totalSpent || 0;
        const netBalance = res.netBalance || 0;
        const summary = res.summary || {};
        const incomes = res.incomes || [];
        const expenses = res.expenses || [];

        const filteredExpenses = curCat === "all" ? expenses : expenses.filter(x => x.categoryCode === curCat);

        // Ghép dòng tiền tổng hợp
        const allFlows = [
          ...incomes.map(x => ({ ...x, flowType: "in" })),
          ...expenses.map(x => ({ ...x, flowType: "out" }))
        ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

        el.innerHTML = `
          <div class="card" style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
              <div>
                <h2 style="margin:0">Quỹ tiền lưu động & Quản trị dòng tiền công ty</h2>
                <div class="muted small" style="margin-top:4px">Số tiền lưu động = Doanh thu từ tour du lịch − Lương nhân viên − Tiền tiêu (mua dụng cụ cho khách mang đi, hoàn tiền, thù lao HDV, cọc...). Đồng bộ 100% với Thu ngân.</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-weight:600;margin:0">Chọn năm:</label>
                <select id="wc-year" class="input sm" style="width:130px;font-weight:700">
                  ${Array.from({ length: 2026 - 1986 + 1 }, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                </select>
                <button class="btn sm" id="wc-refresh">🔄 Tải lại</button>
                <button class="btn ok sm" id="wc-csv">📊 Xuất Excel/CSV</button>
              </div>
            </div>

            <!-- 3 KPI đối soát chuẩn khớp 100% với Thu ngân -->
            <div class="grid g3" style="gap:14px;margin-bottom:18px">
              <div class="kpi" style="border-left:4px solid var(--teal)">
                <div class="l">Tổng thu từ tour (Dòng tiền vào)</div>
                <div class="v" style="color:var(--teal)">+${money(totalCollected)}</div>
                <div class="s">Thu tiền cọc, đủ 100%, thu nốt & quầy (+${incomes.length} GD)</div>
              </div>
              <div class="kpi bad" style="border-left:4px solid var(--bad)">
                <div class="l">Tổng tiền tiêu & chi phí (Dòng tiền ra)</div>
                <div class="v" style="color:var(--bad)">-${money(totalSpent)}</div>
                <div class="s">Lương NV, thù lao HDV, mua dụng cụ khách, hoàn tiền...</div>
              </div>
              <div class="kpi ok" style="border-left:4px solid var(--ok);background:rgba(5,150,105,0.04)">
                <div class="l">Số tiền lưu động hiện có (Quỹ khả dụng)</div>
                <div class="v" style="color:var(--ok);font-size:28px">${money(netBalance)}</div>
                <div class="s">Khi thu tiền tour, số tiền lưu động tăng lên ngay lập tức</div>
              </div>
            </div>

            <!-- Phân bổ các khoản chi & tiền tiêu -->
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:16px">
              <div style="font-weight:700;font-size:13px;margin-bottom:8px">📊 Chi tiết cơ cấu tiền tiêu & chi phí từ quỹ lưu động:</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
                <div style="font-size:13px">💼 Chi lương nhân sự: <b style="color:var(--navy)">${money(summary.salarySpent || 0)}</b></div>
                <div style="font-size:13px">🧑‍✈️ Thù lao HDV (3–12%): <b style="color:var(--navy)">${money(summary.guideFeeSpent || 0)}</b></div>
                <div style="font-size:13px">🎒 Mua dụng cụ đoàn cho khách: <b style="color:var(--navy)">${money(summary.suppliesSpent || 0)}</b></div>
                <div style="font-size:13px">💸 Hoàn tiền cho khách: <b style="color:var(--navy)">${money(summary.refundSpent || 0)}</b></div>
                <div style="font-size:13px">💳 Giải ngân rút tiền ví: <b style="color:var(--navy)">${money(summary.withdrawalSpent || 0)}</b></div>
                <div style="font-size:13px">🏨 Cọc xe & khách sạn: <b style="color:var(--navy)">${money(summary.opsSpent || 0)}</b></div>
              </div>
            </div>

            <!-- TAB LỰA CHỌN: LỊCH SỬ VÀO / LỊCH SỬ RA / DÒNG TIỀN TỔNG HỢP -->
            <div style="display:flex;gap:8px;border-bottom:2px solid var(--border);padding-bottom:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
              <button class="pill-btn ${curTab === 'in' ? 'active' : ''}" data-tab="in" style="font-weight:700">
                📥 Lịch sử tiền vào (Thu tiền tour) <span class="badge ok">${incomes.length}</span>
              </button>
              <button class="pill-btn ${curTab === 'out' ? 'active' : ''}" data-tab="out" style="font-weight:700">
                📤 Lịch sử tiền ra (Tiền tiêu & Chi phí) <span class="badge bad">${expenses.length}</span>
              </button>
              <button class="pill-btn ${curTab === 'all' ? 'active' : ''}" data-tab="all" style="font-weight:700">
                🔄 Tất cả dòng tiền (${allFlows.length})
              </button>
            </div>

            <div id="wc-tab-content"></div>
          </div>
        `;

        const contentBox = $("#wc-tab-content", el);

        if (curTab === "in") {
          // BẢNG LỊCH SỬ TIỀN VÀO
          contentBox.innerHTML = `
            <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
              <span class="small muted">Toàn bộ các khoản thu từ khách hàng qua đặt tour trực tuyến, thanh toán quầy, thu nốt. Khi ghi nhận khoản mới, quỹ lưu động tăng tức thì.</span>
              <span class="badge ok" style="font-size:13px">Tổng dòng vào: +${money(totalCollected)}</span>
            </div>
            ${table([
              { t: "Thời gian", html: x => `<b>${dt(x.at)}</b>`, sort: x => x.at },
              { t: "Nguồn thu / Khoản mục", html: x => `<span class="badge ok">${esc(x.category)}</span>` },
              { t: "Khách hàng", html: x => `<b>${esc(x.customerName || "—")}</b>` },
              { t: "Tour / Dịch vụ", html: x => esc(x.tourName || "—") },
              { t: "Số tiền thu (+)", num: true, html: x => `<b style="color:var(--ok)">+${money(x.amount)}</b>`, sort: x => x.amount },
              { t: "Mã đơn / Mã GD", html: x => `<span class="mono small">${esc(x.ref || "—")}</span>` },
              { t: "Người thu", html: x => `<span class="small">${esc(x.actorName || "Thu ngân")}</span>` },
              { t: "Ghi chú", html: x => `<span class="small muted">${esc(x.note || "—")}</span>` }
            ], incomes, { empty: `Chưa có giao dịch thu tiền tour nào trong năm ${curYear}` })}
          `;
        } else if (curTab === "out") {
          // BẢNG LỊCH SỬ TIỀN RA (TIÊU TIỀN, LƯƠNG, VẬT TƯ, HOÀN TIỀN...)
          contentBox.innerHTML = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
              <span class="small muted" style="font-weight:600">Lọc danh mục chi:</span>
              <button class="pill-btn ${curCat === 'all' ? 'active' : ''}" data-cat="all">Tất cả (${expenses.length})</button>
              <button class="pill-btn ${curCat === 'salary' ? 'active' : ''}" data-cat="salary">💼 Chi lương</button>
              <button class="pill-btn ${curCat === 'guide_fee' ? 'active' : ''}" data-cat="guide_fee">🧑‍✈️ Thù lao HDV</button>
              <button class="pill-btn ${curCat === 'supplies' ? 'active' : ''}" data-cat="supplies">🎒 Dụng cụ cho khách</button>
              <button class="pill-btn ${curCat === 'refund' ? 'active' : ''}" data-cat="refund">💸 Hoàn tiền</button>
              <button class="pill-btn ${curCat === 'withdrawal' ? 'active' : ''}" data-cat="withdrawal">💳 Rút tiền ví</button>
              <button class="pill-btn ${curCat === 'ops' ? 'active' : ''}" data-cat="ops">🏨 Cọc xe & KS</button>
            </div>
            ${table([
              { t: "Thời gian", html: x => `<b>${dt(x.at)}</b>`, sort: x => x.at },
              { t: "Khoản mục chi / Tiền tiêu", html: x => {
                const colors = { salary: "primary", guide_fee: "ok", supplies: "amber", refund: "bad", withdrawal: "warn", ops: "info" };
                return `<span class="badge ${colors[x.categoryCode] || ''}">${esc(x.category)}</span>`;
              } },
              { t: "Người nhận / Đối tượng", html: x => `<b>${esc(x.recipient || "—")}</b>` },
              { t: "Số tiền chi (-)", num: true, html: x => `<b style="color:var(--bad)">-${money(x.amount)}</b>`, sort: x => x.amount },
              { t: "Mã / Số tham chiếu", html: x => `<span class="mono small">${esc(x.ref || "—")}</span>` },
              { t: "Người duyệt chi", html: x => `<span class="small">${esc(x.actorName || "Kế toán")}</span>` },
              { t: "Ghi chú giải trình", html: x => `<span class="small muted">${esc(x.note || "—")}</span>` }
            ], filteredExpenses, { empty: `Không có khoản chi nào trong danh mục này của năm ${curYear}` })}
          `;

          $$("[data-cat]", contentBox).forEach(btn => btn.onclick = () => {
            curCat = btn.dataset.cat;
            reload();
          });
        } else {
          // BẢNG DÒNG TIỀN TỔNG HỢP (CẢ THU VÀO VÀ CHI RA)
          contentBox.innerHTML = `
            <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
              <span class="small muted">Lịch sử toàn bộ các biến động dòng tiền của quỹ lưu động năm ${curYear}.</span>
              <span class="badge ${netBalance >= 0 ? 'ok' : 'bad'}" style="font-size:13px">Số dư lưu động: ${money(netBalance)}</span>
            </div>
            ${table([
              { t: "Thời gian", html: x => `<b>${dt(x.at)}</b>`, sort: x => x.at },
              { t: "Dòng tiền", html: x => x.flowType === "in" ? `<span class="badge ok">📥 Tiền vào (+)</span>` : `<span class="badge bad">📤 Tiền ra (−)</span>` },
              { t: "Khoản mục", html: x => esc(x.category) },
              { t: "Đối tượng / Khách hàng", html: x => `<b>${esc(x.customerName || x.recipient || "—")}</b>` },
              { t: "Biến động", num: true, html: x => x.flowType === "in" ? `<b style="color:var(--ok)">+${money(x.amount)}</b>` : `<b style="color:var(--bad)">-${money(x.amount)}</b>`, sort: x => x.amount },
              { t: "Mã tham chiếu", html: x => `<span class="mono small">${esc(x.ref || "—")}</span>` },
              { t: "Người thực hiện", html: x => `<span class="small">${esc(x.actorName || "Kế toán / Thu ngân")}</span>` },
              { t: "Ghi chú", html: x => `<span class="small muted">${esc(x.note || "—")}</span>` }
            ], allFlows, { empty: `Không có biến động dòng tiền nào trong năm ${curYear}` })}
          `;
        }

        $("#wc-year", el).onchange = e => { curYear = Number(e.target.value); reload(); };
        $("#wc-refresh", el).onclick = () => reload();
        $("#wc-csv", el).onclick = () => {
          if (window.DataExportImport) {
            window.DataExportImport.exportExcel({
              filename: `so-quy-tien-luu-dong-${curYear}.xls`,
              sheetName: "TienLuuDong",
              title: `BÁO CÁO DÒNG TIỀN & SỔ QUỸ LƯU ĐỘNG CÔNG TY NĂM ${curYear}`,
              headers: ["Thời gian", "Loại dòng tiền", "Khoản mục", "Đối tượng / Khách hàng", "Số tiền (₫)", "Mã tham chiếu", "Người thực hiện", "Ghi chú giải trình"],
              summary: [
                ["Năm tài chính", String(curYear)],
                ["Tổng thu từ tour (Dòng tiền Vào)", "+" + money(totalCollected)],
                ["Tổng tiền tiêu & Chi phí (Dòng tiền Ra)", "-" + money(totalSpent)],
                ["Số tiền lưu động ròng hiện có", money(netBalance)]
              ],
              rows: allFlows.map(x => [
                dt(x.at),
                x.flowType === "in" ? "Vào (+)" : "Ra (-)",
                x.category,
                x.customerName || x.recipient || "—",
                x.amount,
                x.ref || "—",
                x.actorName || "—",
                x.note || "—"
              ])
            });
          } else {
            csv(`tien-luu-dong-${curYear}.csv`, ["Thời gian", "Loại dòng tiền", "Khoản mục", "Khách/Người nhận", "Số tiền (₫)", "Mã tham chiếu", "Người thực hiện", "Ghi chú"],
              allFlows.map(x => [dt(x.at), x.flowType === "in" ? "Vào (+)" : "Ra (-)", x.category, x.customerName || x.recipient, x.amount, x.ref, x.actorName, x.note]));
          }
        };
        $$("[data-tab]", el).forEach(btn => btn.onclick = () => {
          curTab = btn.dataset.tab;
          reload();
        });
      }
      await reload();
    } },

    { id: "refunds", label: "Duyệt hoàn tiền", icon: "💸", group: "Tài chính", perm: "refund:approve", async badge() { const q = await get("/api/admin/queue"); return q && q.refunds ? q.refunds.length : 0; }, async render(el) {
      async function reload() {
        const res = await get("/api/admin/refunds");
        const all = Array.isArray(res) ? res : (res && res.refunds) || [];
        tabs(el, [{ id: "pending_approval", label: "Chờ duyệt", n: all.filter(r => r.status === "pending_approval").length }, { id: "approved", label: "Đã duyệt – chờ Thu ngân chuyển" }, { id: "paid", label: "Đã hoàn" }, { id: "rejected", label: "Từ chối" }], (id, box) => {
          const list = all.filter(r => r.status === id);
          box.innerHTML = table([{ t: "Mã đơn", html: r => `<b class="mono">${esc(r.payCode)}</b>` }, { t: "Khách", k: "customerName" }, { t: "Nguồn", html: r => esc(SRC[r.source] || r.source) }, { t: "Số tiền", num: true, html: r => `<b>${money(r.amount)}</b>` }, { t: "Lý do", html: r => esc(r.reason || "") },
            { t: "Yêu cầu bởi", html: r => esc(r.requestedByName || r.requestedBy || "—") }, { t: "Thao tác", nowrap: true, cls: "actions", html: r => id === "pending_approval" ? `<div class="act-btns"><button class="btn ok sm" data-a="${esc(r.id)}">Duyệt</button><button class="btn bad sm" data-x="${esc(r.id)}">Từ chối</button></div>` : (id === "approved" ? `<div class="act-btns"><button class="btn ok sm" data-p="${esc(r.id)}">💵 Hoàn tiền ngay</button></div>` : "") }], list, { empty: "Không có khoản nào" });
          $$("[data-a]", box).forEach(b => b.onclick = async () => { const r = list.find(x => x.id === b.dataset.a); const v = await ask("Duyệt hoàn " + money(r.amount), [{ name: "amount", label: "Số tiền hoàn (để trống = giữ nguyên)", type: "number", value: r.amount, hint: "Không được vượt số tiền khách đã trả." }, { name: "note", label: "Ghi chú", type: "text" }], { kind: "ok", submit: "Duyệt" }); if (v) act(null, () => post(`/api/admin/refunds/${r.id}/approve`, { amount: v.amount === "" ? null : Number(v.amount), note: v.note }), "Đã duyệt. Thu ngân sẽ chuyển tiền.", reload); });
          $$("[data-x]", box).forEach(b => b.onclick = async () => { const v = await ask("Từ chối hoàn tiền", [{ name: "note", label: "Lý do", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/admin/refunds/${b.dataset.x}/reject`, { note: v.note }), "Đã từ chối.", reload); });
          $$("[data-p]", box).forEach(b => b.onclick = async () => { const r = list.find(x => x.id === b.dataset.p); const v = await ask("Xác nhận đã hoàn " + money(r.amount) + " cho khách", [{ name: "note", label: "Ghi chú hoàn tiền", type: "text", value: "Admin thực hiện hoàn tiền" }], { kind: "ok", submit: "Xác nhận hoàn tiền" }); if (v) act(null, () => post(`/api/admin/refunds/${r.id}/pay`, { note: v.note }), "Đã ghi nhận hoàn tiền thành công.", reload); });
        }, "pending_approval");
      }
      await reload();
    } },

    { id: "reconcile", label: "Duyệt đóng sổ", icon: "📒", group: "Tài chính", perm: "reconcile:approve", async badge() { const q = await get("/api/admin/queue"); return q && q.reconciliations ? q.reconciliations.length : 0; }, async render(el) {
      async function reload() {
        const res = await get("/api/admin/reconcile");
        const list = res.reconciliations || [];
        el.innerHTML = `<div class="note info">Kiểm tra và duyệt bản đóng sổ hàng ngày của Thu ngân. Bản có chênh lệch cần kiểm tra kỹ sao kê và biên bản kiểm quỹ tiền mặt.</div>` + table([
          { t: "Ngày đóng sổ", html: x => `<b>${day(x.date)}</b><div class="small muted mono">${esc(x.id)}</div>`, sort: x => x.date },
          { t: "Thu ngân lập sổ", html: x => `<b>${esc(x.cashierName || x.createdByName || x.createdBy || "Lê Thu Ngân")}</b><div class="small muted">${esc(x.cashierId || "tn001")}</div>` },
          { t: "Số dư đầu ca", num: true, html: x => money(x.openingBalance || 0) },
          { t: "Tổng thu (+)", num: true, html: x => `<b style="color:var(--ok)">+${money(x.totalIn || x.netTotal || 0)}</b>` },
          { t: "Tổng chi (-)", num: true, html: x => `<span style="color:var(--bad)">-${money(x.totalOut || 0)}</span>` },
          { t: "Số dư cuối ca", num: true, html: x => `<b>${money(x.closingBalance || x.bankStatementTotal || 0)}</b>` },
          { t: "Chênh lệch", num: true, html: x => x.discrepancy ? `<b style="color:var(--bad)">${money(x.discrepancy)}</b>` : '<span class="badge ok">0 ₫ (Khớp sao kê)</span>' },
          { t: "Ghi chú giải trình", html: x => esc(x.note || "—") + (x.approveNote ? `<div class="small muted" style="margin-top:3px">Ghi chú duyệt: <i>${esc(x.approveNote)}</i></div>` : "") },
          { t: "Trạng thái", html: x => pill({ pending_approval: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }[x.status] || x.status, x.status === "approved" ? "ok" : x.status === "rejected" ? "bad" : "warn") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: x => x.status === "pending_approval" ? `<div class="act-btns"><button class="btn ok sm" data-y="${esc(x.id)}">✅ Duyệt</button><button class="btn bad sm" data-n="${esc(x.id)}">❌ Từ chối</button></div>` : `<span class="muted small">${x.status === "approved" ? "Đã duyệt" : "Bị từ chối"}</span>` }
        ], list, { empty: "Chưa có bản đóng sổ nào" });
        const dec = (id, approve) => async () => {
          const v = await ask(approve ? "Duyệt bản đóng sổ cuối ngày" : "Từ chối bản đóng sổ", [
            { name: "note", label: approve ? "Ghi chú phê duyệt (không bắt buộc)" : "Lý do từ chối bản đóng sổ (bắt buộc nhập) *", type: "textarea", required: !approve, placeholder: approve ? "Ghi chú thêm nếu cần..." : "Vui lòng nhập lý do từ chối để thu ngân điều chỉnh..." }
          ], { kind: approve ? "ok" : "bad", submit: approve ? "Xác nhận duyệt" : "Xác nhận từ chối" });
          if (v) act(null, () => post(`/api/admin/reconcile/${id}/decision`, { approve, note: v.note }), approve ? "Đã duyệt bản đóng sổ thành công." : "Đã từ chối bản đóng sổ.", reload);
        };
        $$("[data-y]", el).forEach(b => b.onclick = dec(b.dataset.y, true));
        $$("[data-n]", el).forEach(b => b.onclick = dec(b.dataset.n, false));
      }
      await reload();
    } },

    { id: "vouchers", label: "Voucher", icon: "🎟️", group: "Tài chính", perm: "voucher:manage", async render(el) {
      async function reload() {
        const r = await get("/api/admin/vouchers");
        const vList = r.vouchers || [];
        el.innerHTML = `
          <div class="toolbar" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <button class="btn primary" id="nv">+ Tạo voucher ưu đãi mới</button>
            <div class="small muted">Quản lý mã giảm giá áp dụng cho Khách hàng hoặc Nhân viên</div>
          </div>` +
          table([
            { t: "Mã voucher", html: v => `<b class="mono" style="font-size:14px;color:var(--primary)">${esc(v.code)}</b>` },
            { t: "Tiêu đề / Ưu đãi", html: v => `<b>${esc(v.title || v.code)}</b>` },
            { t: "Mức giảm", num: true, html: v => `<span class="badge ${v.type === 'percent' ? 'info' : 'ok'}">${esc(v.type === "percent" ? v.value + "%" : money(v.value))}</span>` },
            { t: "Đối tượng áp dụng", html: v => {
              if (v.targetLabel) return `<span class="badge ${v.targetType === 'staff' ? 'ok' : 'info'}">${esc(v.targetLabel)}</span>`;
              if (v.ownerEmail) return `<span class="badge info">👤 ${esc(v.ownerEmail)}</span>`;
              return '<span class="badge">🌐 Tất cả người dùng</span>';
            } },
            { t: "Hạn dùng", html: v => esc(v.endAt ? dt(v.endAt) : (v.expiresAt || v.expires || "Vô thời hạn")) },
            { t: "Trạng thái", html: v => v.disabled ? pill("Tạm tắt", "bad") : pill("Đang dùng", "ok") },
            { t: "Thao tác", nowrap: true, cls: "actions", html: v => `<div class="act-btns"><button class="btn sm" data-t="${esc(v.code)}" data-d="${v.disabled ? 0 : 1}">${v.disabled ? "Bật" : "Tắt"}</button><button class="btn bad sm" data-x="${esc(v.code)}">Xóa</button></div>` }
          ], vList, { empty: "Chưa có voucher nào trong hệ thống" });

        $("#nv", el).onclick = () => openCreateVoucherModal();

        $$("[data-t]", el).forEach(b => b.onclick = () => act(b, () => put(`/api/admin/vouchers/${encodeURIComponent(b.dataset.t)}`, { disabled: b.dataset.d === "1" }), "Đã cập nhật trạng thái voucher.", reload));
        $$("[data-x]", el).forEach(b => b.onclick = async () => { if (await confirmBox("Xóa voucher", "Bạn có chắc muốn xóa voucher " + esc(b.dataset.x) + "?", "bad")) act(null, () => del(`/api/admin/vouchers/${encodeURIComponent(b.dataset.x)}`), "Đã xóa voucher.", reload); });

        async function openCreateVoucherModal() {
          const [customersRes, staffRes] = await Promise.all([
            get("/api/admin/customers").catch(() => ({ customers: [] })),
            get("/api/admin/staff").catch(() => ({ staff: [] }))
          ]);
          const customers = customersRes.customers || [];
          const staffMembers = staffRes.staff || [];

          let targetType = "customer";
          let customerMode = "all";
          let staffMode = "all";

          const formHtml = `
            <div style="display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box">
              <div class="grid g2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label for="vc-code" style="font-weight:600">Mã voucher <span style="color:var(--bad)">*</span></label>
                  <input id="vc-code" placeholder="VD: TRIAN2026, HE2026" style="text-transform:uppercase;font-weight:700" maxlength="24">
                </div>
                <div>
                  <label for="vc-title" style="font-weight:600">Tiêu đề / Tên ưu đãi <span style="color:var(--bad)">*</span></label>
                  <input id="vc-title" placeholder="VD: Tri ân khách hàng thân thiết">
                </div>
              </div>

              <div class="grid g3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
                <div>
                  <label for="vc-type" style="font-weight:600">Loại giảm <span style="color:var(--bad)">*</span></label>
                  <select id="vc-type">
                    <option value="percent">Giảm % giá trị</option>
                    <option value="amount">Giảm tiền trực tiếp (₫)</option>
                  </select>
                </div>
                <div>
                  <label for="vc-val" style="font-weight:600">Giá trị giảm <span style="color:var(--bad)">*</span></label>
                  <input id="vc-val" type="number" min="1" placeholder="VD: 10 (%) hoặc 500000 (₫)">
                </div>
                <div>
                  <label for="vc-max" style="font-weight:600">Giảm tối đa (₫)</label>
                  <input id="vc-max" type="number" min="0" placeholder="Tùy chọn cho giảm %">
                </div>
              </div>

              <div class="grid g2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label for="vc-exp" style="font-weight:600">Hạn sử dụng</label>
                  <input id="vc-exp" type="date">
                </div>
                <div>
                  <label for="vc-uses" style="font-weight:600">Số lượt dùng tối đa</label>
                  <input id="vc-uses" type="number" min="1" placeholder="Để trống = không giới hạn">
                </div>
              </div>

              <!-- Khu vực lựa chọn Khách hàng hoặc Nhân viên -->
              <div style="background:var(--bg-subtle,#f8fafc);border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:4px">
                <label style="margin:0 0 8px;font-weight:700">🎯 Đối tượng áp dụng Voucher:</label>
                <div class="seg-group" id="vc-target-type-seg" style="display:flex;gap:4px;margin-bottom:12px">
                  <button type="button" class="pill-btn active" data-tt="customer">👥 Khách hàng</button>
                  <button type="button" class="pill-btn" data-tt="staff">💼 Nhân viên</button>
                  <button type="button" class="pill-btn" data-tt="all">🌐 Tất cả</button>
                </div>

                <!-- Lựa chọn Khách hàng -->
                <div id="vc-customer-wrap">
                  <div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">
                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
                      <input type="radio" name="vc_cus_mode" value="all" checked style="width:auto"> Tất cả khách hàng
                    </label>
                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
                      <input type="radio" name="vc_cus_mode" value="custom" style="width:auto"> Chọn từng khách hàng cụ thể
                    </label>
                  </div>
                  <div id="vc-customer-picker" style="display:none">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
                      <input type="text" id="vc-cus-search" placeholder="🔍 Gõ tên, email hoặc SĐT để lọc khách hàng..." style="font-size:12.5px;padding:4px 8px">
                      <div style="display:flex;gap:4px;flex-shrink:0">
                        <button type="button" class="btn sm" id="vc-cus-sel-all" style="font-size:11px;padding:2px 8px">Chọn tất cả</button>
                        <button type="button" class="btn sm" id="vc-cus-desel-all" style="font-size:11px;padding:2px 8px">Bỏ chọn</button>
                      </div>
                    </div>
                    <div id="vc-cus-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;background:var(--surface);display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px">
                      ${customers.map(c => `
                        <label class="vc-card" data-txt="${esc((c.name + ' ' + (c.email||'') + ' ' + (c.phone||'')).toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;margin:0;font-size:12px;background:var(--surface)">
                          <input type="checkbox" class="vc-cus-cb" value="${esc(c.id)}" style="width:16px;height:16px;margin:0;cursor:pointer">
                          <div style="flex:1;overflow:hidden">
                            <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</b>
                            <span class="muted small">${esc(c.phone || c.email || c.id)}</span>
                          </div>
                        </label>
                      `).join("")}
                    </div>
                    <div class="small muted" style="margin-top:4px">Đã chọn: <b id="vc-cus-count">0</b> khách hàng.</div>
                  </div>
                </div>

                <!-- Lựa chọn Nhân viên -->
                <div id="vc-staff-wrap" style="display:none">
                  <div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">
                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
                      <input type="radio" name="vc_st_mode" value="all" checked style="width:auto"> Tất cả nhân viên
                    </label>
                    <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
                      <input type="radio" name="vc_st_mode" value="custom" style="width:auto"> Chọn từng nhân viên cụ thể
                    </label>
                  </div>
                  <div id="vc-staff-picker" style="display:none">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
                      <input type="text" id="vc-st-search" placeholder="🔍 Gõ tên, email hoặc vai trò nhân viên..." style="font-size:12.5px;padding:4px 8px">
                      <div style="display:flex;gap:4px;flex-shrink:0">
                        <button type="button" class="btn sm" id="vc-st-sel-all" style="font-size:11px;padding:2px 8px">Chọn tất cả</button>
                        <button type="button" class="btn sm" id="vc-st-desel-all" style="font-size:11px;padding:2px 8px">Bỏ chọn</button>
                      </div>
                    </div>
                    <div id="vc-st-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;background:var(--surface);display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px">
                      ${staffMembers.map(s => `
                        <label class="vc-card" data-txt="${esc((s.name + ' ' + (s.roleName||s.role||'') + ' ' + (s.email||'')).toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;margin:0;font-size:12px;background:var(--surface)">
                          <input type="checkbox" class="vc-st-cb" value="${esc(s.id)}" style="width:16px;height:16px;margin:0;cursor:pointer">
                          <div style="flex:1;overflow:hidden">
                            <b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.name)}</b>
                            <span class="badge info" style="font-size:10px">${esc(s.roleName || s.role)}</span>
                          </div>
                        </label>
                      `).join("")}
                    </div>
                    <div class="small muted" style="margin-top:4px">Đã chọn: <b id="vc-st-count">0</b> nhân viên.</div>
                  </div>
                </div>

                <!-- Lựa chọn Tất cả -->
                <div id="vc-all-wrap" style="display:none">
                  <div class="small muted">Voucher sẽ áp dụng chung cho tất cả khách hàng và nhân viên.</div>
                </div>
              </div>

              <div class="field-err" id="vc-err" style="color:var(--bad);font-weight:600"></div>
            </div>
          `;

          let closeFn = null;
          Staff.modal("Tạo voucher ưu đãi", formHtml, [
            { label: "Hủy", value: null },
            { label: "Tạo voucher", kind: "primary", value: "ok", validate: ov => {
              const err = $("#vc-err", ov);
              err.textContent = "";

              const code = $("#vc-code", ov).value.trim().toUpperCase();
              if (!code || !/^[A-Z0-9_-]{3,24}$/.test(code)) {
                err.textContent = "Mã voucher chỉ gồm chữ/số/gạch, từ 3 đến 24 ký tự.";
                return false;
              }
              const title = $("#vc-title", ov).value.trim();
              if (!title) {
                err.textContent = "Vui lòng nhập tiêu đề / tên ưu đãi.";
                return false;
              }
              const type = $("#vc-type", ov).value;
              const value = Number($("#vc-val", ov).value);
              if (!(value > 0)) {
                err.textContent = "Vui lòng nhập giá trị giảm hợp lệ (> 0).";
                return false;
              }
              if (type === "percent" && value > 100) {
                err.textContent = "Tỷ lệ giảm theo % không được vượt quá 100%.";
                return false;
              }

              const maxDiscount = Number($("#vc-max", ov).value) || 0;
              const expiresAt = $("#vc-exp", ov).value;
              const maxUses = Number($("#vc-uses", ov).value) || 0;

              let targetIds = [];
              let targetLabel = "";

              if (targetType === "customer") {
                if (customerMode === "custom") {
                  targetIds = $$(".vc-cus-cb:checked", ov).map(cb => cb.value);
                  if (!targetIds.length) {
                    err.textContent = "Vui lòng tick chọn ít nhất 1 khách hàng (hoặc chọn 'Tất cả khách hàng').";
                    return false;
                  }
                  targetLabel = `${targetIds.length} khách hàng đã chọn`;
                } else {
                  targetLabel = "Tất cả khách hàng";
                }
              } else if (targetType === "staff") {
                if (staffMode === "custom") {
                  targetIds = $$(".vc-st-cb:checked", ov).map(cb => cb.value);
                  if (!targetIds.length) {
                    err.textContent = "Vui lòng tick chọn ít nhất 1 nhân viên (hoặc chọn 'Tất cả nhân viên').";
                    return false;
                  }
                  targetLabel = `${targetIds.length} nhân viên đã chọn`;
                } else {
                  targetLabel = "Tất cả nhân viên";
                }
              } else {
                targetLabel = "Tất cả mọi người";
              }

              const payload = {
                code,
                title,
                type,
                value,
                maxDiscount,
                endAt: expiresAt ? expiresAt + "T23:59:59Z" : null,
                maxUses,
                targetType,
                targetMode: targetType === "customer" ? customerMode : (targetType === "staff" ? staffMode : "all"),
                targetIds,
                targetLabel
              };

              const btn = $(".acts .primary", ov);
              if (btn) btn.disabled = true;

              post("/api/admin/vouchers", payload)
                .then(() => {
                  Staff.toast(`Đã tạo voucher ${code} thành công.`, "ok");
                  if (closeFn) closeFn(null);
                  reload();
                })
                .catch(e => {
                  err.textContent = e.message || "Lỗi tạo voucher.";
                  if (btn) btn.disabled = false;
                });

              return false;
            } }
          ], {
            wide: true,
            sticky: true,
            onOpen: (ov, close) => {
              closeFn = close;
              const cusWrap = $("#vc-customer-wrap", ov);
              const stWrap = $("#vc-staff-wrap", ov);
              const allWrap = $("#vc-all-wrap", ov);
              const cusPicker = $("#vc-customer-picker", ov);
              const stPicker = $("#vc-staff-picker", ov);

              const updateAudienceUI = () => {
                $$("#vc-target-type-seg button", ov).forEach(b => b.classList.toggle("active", b.dataset.tt === targetType));
                cusWrap.style.display = targetType === "customer" ? "block" : "none";
                stWrap.style.display = targetType === "staff" ? "block" : "none";
                allWrap.style.display = targetType === "all" ? "block" : "none";
              };

              $$("#vc-target-type-seg button", ov).forEach(b => {
                b.onclick = () => {
                  targetType = b.dataset.tt;
                  updateAudienceUI();
                };
              });

              $$("input[name='vc_cus_mode']", ov).forEach(r => {
                r.onchange = () => {
                  customerMode = r.value;
                  cusPicker.style.display = customerMode === "custom" ? "block" : "none";
                };
              });

              $$("input[name='vc_st_mode']", ov).forEach(r => {
                r.onchange = () => {
                  staffMode = r.value;
                  stPicker.style.display = staffMode === "custom" ? "block" : "none";
                };
              });

              // Search & Selection for customers
              const updateCusCount = () => {
                const count = $$(".vc-cus-cb:checked", ov).length;
                const el = $("#vc-cus-count", ov);
                if (el) el.textContent = count;
              };
              $$(".vc-cus-cb", ov).forEach(cb => cb.onchange = updateCusCount);

              const cusSearch = $("#vc-cus-search", ov);
              if (cusSearch) {
                cusSearch.oninput = () => {
                  const q = cusSearch.value.trim().toLowerCase();
                  $$("#vc-cus-list .vc-card", ov).forEach(card => {
                    card.style.display = (!q || (card.dataset.txt && card.dataset.txt.includes(q))) ? "flex" : "none";
                  });
                };
              }
              const cusSelAll = $("#vc-cus-sel-all", ov);
              if (cusSelAll) {
                cusSelAll.onclick = () => {
                  $$("#vc-cus-list .vc-card", ov).forEach(c => {
                    if (c.style.display !== "none") {
                      const cb = $("input[type='checkbox']", c);
                      if (cb) cb.checked = true;
                    }
                  });
                  updateCusCount();
                };
              }
              const cusDeselAll = $("#vc-cus-desel-all", ov);
              if (cusDeselAll) {
                cusDeselAll.onclick = () => {
                  $$(".vc-cus-cb", ov).forEach(cb => cb.checked = false);
                  updateCusCount();
                };
              }

              // Search & Selection for staff
              const updateStCount = () => {
                const count = $$(".vc-st-cb:checked", ov).length;
                const el = $("#vc-st-count", ov);
                if (el) el.textContent = count;
              };
              $$(".vc-st-cb", ov).forEach(cb => cb.onchange = updateStCount);

              const stSearch = $("#vc-st-search", ov);
              if (stSearch) {
                stSearch.oninput = () => {
                  const q = stSearch.value.trim().toLowerCase();
                  $$("#vc-st-list .vc-card", ov).forEach(card => {
                    card.style.display = (!q || (card.dataset.txt && card.dataset.txt.includes(q))) ? "flex" : "none";
                  });
                };
              }
              const stSelAll = $("#vc-st-sel-all", ov);
              if (stSelAll) {
                stSelAll.onclick = () => {
                  $$("#vc-st-list .vc-card", ov).forEach(c => {
                    if (c.style.display !== "none") {
                      const cb = $("input[type='checkbox']", c);
                      if (cb) cb.checked = true;
                    }
                  });
                  updateStCount();
                };
              }
              const stDeselAll = $("#vc-st-desel-all", ov);
              if (stDeselAll) {
                stDeselAll.onclick = () => {
                  $$(".vc-st-cb", ov).forEach(cb => cb.checked = false);
                  updateStCount();
                };
              }
            }
          });
        }
      }
      await reload();
    } },

    { id: "withdrawals", label: "Theo dõi rút tiền", icon: "💳", group: "Tài chính", perm: "payment:view", async badge() { const res = await get("/api/cashier/withdrawals?status=pending"); const list = Array.isArray(res) ? res : (res && res.withdrawals) || []; return list.length; }, async render(el) {
      async function reload() {
        const res = await get("/api/cashier/withdrawals");
        const all = Array.isArray(res) ? res : (res && res.withdrawals) || [];
        tabs(el, [
          { id: "pending", label: "Chờ duyệt chi", n: all.filter(w => w.status === "pending").length },
          { id: "approved", label: "Đã chuyển tiền", n: all.filter(w => w.status === "approved").length },
          { id: "rejected", label: "Bị từ chối", n: all.filter(w => w.status === "rejected").length }
        ], (statusId, box) => {
          const list = all.filter(w => w.status === statusId);
          box.innerHTML = (statusId === "pending" ? '<div class="note info">Danh sách yêu cầu rút tiền do Thu ngân (CASHIER) trực tiếp thực hiện xác nhận chuyển khoản theo quy chế phân lập quyền.</div>' : "")
            + table([
              { t: "Thời gian", html: w => dt(w.createdAt), sort: w => w.createdAt },
              { t: "Người rút", html: w => `<b>${esc(w.userName)}</b><div class="small muted">${esc(w.userEmail)}</div>` },
              { t: "Số tiền", num: true, html: w => `<b>${money(w.amount)}</b>` },
              { t: "Ngân hàng", html: w => `<b>${esc(w.bankName)}</b>` },
              { t: "Số tài khoản", html: w => `<span class="mono">${esc(w.accountNumber)}</span>` },
              { t: "Chủ thẻ", html: w => `<b>${esc(w.accountHolder)}</b>` },
              { t: "Ghi chú", html: w => esc(w.note || "—") + (w.rejectReason ? `<div class="small bad">Từ chối: ${esc(w.rejectReason)}</div>` : "") + (w.adminNote ? `<div class="small ok">Ghi chú: ${esc(w.adminNote)}</div>` : "") },
              { t: "Trạng thái", html: w => w.status === "pending" ? '<span class="badge warn">Chờ Thu ngân chi</span>' : (w.status === "approved" ? '<span class="badge ok">Đã chi tiền</span>' : '<span class="badge bad">Từ chối</span>') },
              { t: "Người xử lý", html: w => `<span class="muted small">${esc(w.handledByName || "—")}</span>` }
            ], list, { empty: "Không có yêu cầu rút tiền nào" });
        }, "pending");
      }
      await reload();
    } },

    { id: "drafts", label: "Duyệt nội dung tour", icon: "📝", group: "Nội dung", perm: "tour:approve_content", async badge() { return (await get("/api/content/drafts?status=pending")).drafts.length; }, async render(el) {
      async function reload() {
        const r = await get("/api/content/drafts?status=pending");
        el.innerHTML = `<div class="note">Bản nháp do Biên tập gửi. Giá, loại HDV, gia hạn, sức chứa chỉ Admin chỉnh khi duyệt.</div>` + table([{ t: "Tour", html: d => esc((d.fields && (d.fields.name || d.fields.title)) || d.tourId) + (d.isNew ? " " + pill("Tour mới", "info") : "") }, { t: "Người soạn", html: d => esc(d.createdByName) }, { t: "Trường đã sửa", html: d => esc(Object.keys(d.fields || {}).join(", ")) }, { t: "Gửi lúc", html: d => dt(d.submittedAt || d.updatedAt) },
          { t: "Thao tác", nowrap: true, cls: "actions", html: d => `<div class="act-btns"><button class="btn sm" data-v="${esc(d.id)}">Xem</button><button class="btn ok sm" data-a="${esc(d.id)}">Duyệt</button><button class="btn bad sm" data-x="${esc(d.id)}">Trả lại</button></div>` }], r.drafts, { empty: "Không có bản nháp chờ duyệt" });
        const find = id => r.drafts.find(d => d.id === id);
        $$("[data-v]", el).forEach(b => b.onclick = () => Staff.modal("Nội dung bản nháp", `<dl class="kv">${Object.entries(find(b.dataset.v).fields || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd>`).join("")}</dl>`, [{ label: "Đóng" }], { wide: true }));
        $$("[data-a]", el).forEach(b => b.onclick = async () => {
          const d = find(b.dataset.a);
          const isNew = d && d.isNew;
          const v = await ask(isNew ? "Duyệt & xuất bản tour mới" : "Duyệt & xuất bản", [
            { name: "price", label: isNew ? "Giá tour (₫) *" : "Giá (₫) – tuỳ chọn, để trống nếu không đổi", type: "number", required: isNew },
            { name: "guideType", label: isNew ? "Loại HDV *" : "Loại HDV", type: "select", options: [["", isNew ? "-- Chọn loại HDV --" : "— giữ nguyên —"], ["domestic", "Nội địa"], ["international", "Quốc tế"]], required: isNew }
          ], { kind: "ok", submit: "Duyệt & xuất bản" });
          if (!v) return;
          const sens = {};
          if (v.price) sens.price = Number(v.price);
          if (v.guideType) sens.guideType = v.guideType;
          act(null, () => post(`/api/admin/drafts/${b.dataset.a}/approve`, { sensitive: sens }), "Đã xuất bản.", reload);
        });
        $$("[data-x]", el).forEach(b => b.onclick = async () => { const v = await ask("Trả lại bản nháp", [{ name: "note", label: "Cần sửa gì", type: "textarea", required: true }], { kind: "bad" }); if (v) act(null, () => post(`/api/admin/drafts/${b.dataset.x}/reject`, { note: v.note }), "Đã trả lại.", reload); });
      }
      await reload();
    } },

    { id: "banners", label: "Banner trang chủ", icon: "🖼️", group: "Nội dung", perm: "content:manage_banner", async render(el) {
      async function reload() {
        const r = await get("/api/admin/banners");
        const list = r.banners || [];

        el.innerHTML = `
          <div class="toolbar" style="margin-bottom:12px">
            <div class="note info" style="margin:0;flex:1">Banner hiển thị nổi bật trên slider trang chủ. Nhiều banner sẽ hiển thị theo độ ưu tiên (số lớn đứng trước).</div>
            <button class="btn primary" id="btn-add-banner">+ Thêm banner</button>
          </div>` +
          table([
            { t: "Banner", html: b => {
              const bg = b.image ? `background:url('${esc(b.image)}') center/cover` : `background:linear-gradient(135deg,${esc(b.bgFrom || "#0f766e")},${esc(b.bgTo || "#0ea5e9")})`;
              return `<div style="display:flex;align-items:center;gap:12px">
                <div style="width:70px;height:42px;border-radius:6px;${bg};box-shadow:0 1px 3px rgba(0,0,0,.2);flex-shrink:0"></div>
                <div><b>${esc(b.title)}</b>${b.subtitle ? `<div class="small muted">${esc(b.subtitle)}</div>` : ""}</div>
              </div>`;
            } },
            { t: "Liên kết & Nút", html: b => `<div>${esc(b.ctaText || "Xem ngay")}</div><div class="small muted mono">${esc(b.link || "#")}</div>` },
            { t: "Ưu tiên", num: true, html: b => `<b>${b.priority || 0}</b>` },
            { t: "Thời gian chạy", html: b => `<div class="small">${dt(b.startAt)}<br>→ ${b.endAt ? dt(b.endAt) : "Không giới hạn"}</div>` },
            { t: "Trạng thái", html: b => b.enabled !== false ? pill("Đang bật", "ok") : pill("Đang tắt", "bad") },
            { t: "Thao tác", nowrap: true, cls: "actions", html: b => `
              <div class="act-btns">
                <button class="btn sm" data-b-edit="${esc(b.id)}">Sửa</button>
                <button class="btn sm ${b.enabled !== false ? "bad" : "ok"}" data-b-toggle="${esc(b.id)}" data-en="${b.enabled !== false ? 0 : 1}">${b.enabled !== false ? "Tắt" : "Bật"}</button>
                <button class="btn bad sm" data-b-del="${esc(b.id)}">Xóa</button>
              </div>` }
          ], list, { empty: "Chưa có banner nào." });

        async function openBannerModal(b) {
          const isEdit = !!b;
          const v = await ask(isEdit ? "Sửa banner: " + b.title : "Thêm banner mới", [
            { name: "title", label: "Tiêu đề banner", value: b?.title || "", required: true, placeholder: "VD: Khám phá mùa thu Hà Nội" },
            { name: "subtitle", label: "Mô tả ngắn", value: b?.subtitle || "", placeholder: "VD: Giảm tới 20% cho tour miền Bắc" },
            { name: "image", label: "Ảnh nền (đường dẫn hoặc tải lên; để trống nếu dùng màu nền)", upload: "banner", value: b?.image || "", placeholder: "VD: img/banners/banner1.jpg" },
            { name: "ctaText", label: "Chữ trên nút kêu gọi", value: b?.ctaText || "Khám phá ngay" },
            { name: "link", label: "Liên kết khi bấm", value: b?.link || "#sec-tours", placeholder: "VD: #sec-tours hoặc /tour?id=101" },
            { name: "priority", label: "Độ ưu tiên hiển thị (số lớn hiện trước)", type: "number", value: b?.priority || 1 },
            { name: "enabled", label: "Kích hoạt hiển thị ngay", type: "checkbox", value: b ? b.enabled !== false : true }
          ], { submit: isEdit ? "Lưu banner" : "Tạo banner" });

          if (!v) return;
          const payload = {
            title: v.title,
            subtitle: v.subtitle,
            image: v.image,
            ctaText: v.ctaText,
            link: v.link,
            priority: Number(v.priority) || 0,
            enabled: v.enabled
          };

          if (isEdit) {
            act(null, () => put(`/api/admin/banners/${encodeURIComponent(b.id)}`, payload), "Đã lưu banner.", reload);
          } else {
            act(null, () => post("/api/admin/banners", payload), "Đã thêm banner mới.", reload);
          }
        }

        $("#btn-add-banner", el).onclick = () => openBannerModal(null);

        $$("[data-b-edit]", el).forEach(btn => btn.onclick = () => {
          const b = list.find(x => x.id === btn.dataset.bEdit);
          if (b) openBannerModal(b);
        });

        $$("[data-b-toggle]", el).forEach(btn => btn.onclick = () => {
          const b = list.find(x => x.id === btn.dataset.bToggle);
          if (!b) return;
          act(btn, () => put(`/api/admin/banners/${encodeURIComponent(b.id)}`, { ...b, enabled: btn.dataset.en === "1" }), "Đã đổi trạng thái banner.", reload);
        });

        $$("[data-b-del]", el).forEach(btn => btn.onclick = async () => {
          const b = list.find(x => x.id === btn.dataset.bDel);
          if (!b) return;
          if (await confirmBox("Xóa banner", `Xóa banner "${b.title}"?`, "bad")) {
            act(null, () => del(`/api/admin/banners/${encodeURIComponent(b.id)}`), "Đã xóa banner.", reload);
          }
        });
      }
      await reload();
    } },

    { id: "reviews", label: "Kiểm duyệt & Trả lời bình luận", icon: "⭐", group: "Nội dung", perm: "review:moderate", async render(el) {
      let curStatus = "unreplied"; // Mặc định là Cần xử lý ngay (Chưa trả lời)
      let curCat = "";
      let curTarget = "";
      let list = [];

      el.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
            <div>
              <h2 style="margin:0">Quản trị & Kiểm duyệt Bình luận, Đánh giá</h2>
              <div class="muted small" style="margin-top:2px">Phân quyền xử lý: Trả lời công khai, Gắn loại, Chuyển bộ phận, Ẩn vi phạm và Xóa vĩnh viễn (Admin).</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn ok" id="btn-admin-ai-sentiment" style="font-size:0.85rem">✨ AI Phân tích cảm xúc & Tóm tắt</button>
              <button type="button" class="btn sm" id="btn-admin-mod-rules">🛡️ Quy tắc lọc tự động</button>
              <button type="button" class="btn sm" id="rv-exp-excel" title="Xuất danh sách bình luận ra Excel">📊 Xuất Excel</button>
              <button type="button" class="btn sm" id="rv-exp-word" title="Xuất danh sách bình luận ra Word">📝 Xuất Word</button>
              <button type="button" class="btn sm" id="rv-exp-pdf" title="In / Lưu PDF bình luận">🖨️ In / PDF</button>
            </div>
          </div>

          <div id="admin-ai-sentiment-box" style="display:none;margin-bottom:16px;background:linear-gradient(135deg,#f0fdf4 0%,#f0f9ff 100%);border:1.5px solid #0284c7;border-radius:12px;padding:16px 20px"></div>

          <!-- BỘ LỌC CHÍNH: TRẠNG THÁI CẦN XỬ LÝ (QUAN TRỌNG VỚI CSKH / BIÊN TẬP) -->
          <div style="margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--text)">🎯 Trạng thái cần xử lý (Bộ lọc chính):</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="rv-status-seg">
              <button type="button" class="pill-btn ${curStatus === 'unreplied' ? 'active' : ''}" data-st="unreplied">🚨 Cần xử lý ngay (Chưa trả lời) <span class="badge bad" id="cnt-unrep" style="margin-left:4px">0</span></button>
              <button type="button" class="pill-btn ${curStatus === 'replied' ? 'active' : ''}" data-st="replied">💬 Đã trả lời</button>
              <button type="button" class="pill-btn ${curStatus === 'forwarded' ? 'active' : ''}" data-st="forwarded">🔄 Đã chuyển bộ phận</button>
              <button type="button" class="pill-btn ${curStatus === 'hidden' ? 'active' : ''}" data-st="hidden">👁️‍🗨️ Đã ẩn vi phạm</button>
              <button type="button" class="pill-btn ${curStatus === 'all' ? 'active' : ''}" data-st="all">📑 Tất cả</button>
            </div>
          </div>

          <!-- Bộ lọc phụ: Từ khóa, Phân loại, Mục, Sao -->
          <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
            <input type="text" id="rv-search" placeholder="🔍 Tìm tác giả, tour, nội dung, phản hồi..." style="flex:1;min-width:220px;padding:7px 10px;font-size:13px">
            <select id="rv-cat" class="input sm" style="width:160px">
              <option value="">Tất cả phân loại</option>
              <option value="inquiry">❓ Hỏi thông tin</option>
              <option value="review">⭐ Đánh giá trải nghiệm</option>
              <option value="complaint">⚠️ Khiếu nại dịch vụ</option>
              <option value="feedback">💡 Góp ý / Đóng góp</option>
            </select>
            <select id="rv-target" class="input sm" style="width:160px">
              <option value="">Mọi mục hiển thị</option>
              <option value="tour">Chuyến đi / Tour</option>
              <option value="food">Ẩm thực 3 miền</option>
              <option value="contact">Phản hồi Footer</option>
            </select>
            <button class="btn sm" id="rv-reset">🔄 Đặt lại</button>
          </div>

          <div id="adm-reviews-table"></div>
        </div>
      `;

      const aiBox = $("#admin-ai-sentiment-box", el);

      $("#btn-admin-ai-sentiment", el).onclick = async () => {
        const btn = $("#btn-admin-ai-sentiment", el);
        const oldText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "⏳ AI đang phân tích dữ liệu...";
        try {
          const res = await get("/api/admin/reviews/ai-insights");
          if (!res || !res.ok) throw new Error((res && res.msg) || "Không lấy được phân tích");
          aiBox.style.display = "block";
          aiBox.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #bae6fd;padding-bottom:10px">
              <div style="font-weight:700;font-size:1.05rem;color:#0369a1;display:flex;align-items:center;gap:8px">
                <span>✨ Báo Cáo AI: Phân Tích Cảm Xúc & Chất Lượng Đánh Giá</span>
                <span class="badge ok" style="font-size:0.75rem">${esc(res.total)} đánh giá · ${esc(res.average)}/5.0 ⭐</span>
              </div>
              <button type="button" class="btn sm" id="btn-close-admin-ai-box" style="font-size:0.75rem">✕ Đóng</button>
            </div>
            <div class="grid g3" style="margin-bottom:14px;gap:12px">
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #86efac;text-align:center">
                <div style="font-size:1.5rem">😊</div>
                <div style="font-size:1.25rem;font-weight:800;color:#16a34a">${esc(res.positivePct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Hài lòng & Khen ngợi</div>
              </div>
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #fde047;text-align:center">
                <div style="font-size:1.5rem">😐</div>
                <div style="font-size:1.25rem;font-weight:800;color:#ca8a04">${esc(res.neutralPct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Bình thường / Tạm ổn</div>
              </div>
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #fca5a5;text-align:center">
                <div style="font-size:1.5rem">😞</div>
                <div style="font-size:1.25rem;font-weight:800;color:#dc2626">${esc(res.negativePct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Cần cải thiện / Phàn nàn</div>
              </div>
            </div>
            <div style="background:#fff;border-radius:8px;padding:14px 18px;border:1px solid #cbd5e1;line-height:1.6;font-size:0.875rem;color:#1e293b">
              ${(res.summary || "").replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}
            </div>
          `;
          $("#btn-close-admin-ai-box", aiBox).onclick = () => { aiBox.style.display = "none"; };
          aiBox.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
          Staff.toast("Lỗi khi phân tích AI: " + err.message, "bad");
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      };

      $("#btn-admin-mod-rules", el).onclick = async () => {
        const v = await ask("Quản lý quy tắc lọc bình luận tự động", [
          { name: "keywords", label: "Từ khóa nhạy cảm / spam (ngăn cách bằng dấu phẩy)", type: "textarea", value: "lừa đảo, chửi thề, đánh bạc, thô tục, spam, bot", required: true, hint: "Hệ thống sẽ tự động gắn cờ hoặc che dấu từ khóa khi khách đăng bài." },
          { name: "autoHide", label: "Tự động ẩn bình luận chứa từ khóa cấm", type: "checkbox", value: true }
        ], { submit: "Lưu quy tắc", kind: "ok" });
        if (v) Staff.toast("Đã cập nhật quy tắc lọc tự động.", "ok");
      };

      $("#rv-exp-excel", el).onclick = () => window.DataExportImport && window.DataExportImport.exportReviewsList(list, "excel");
      $("#rv-exp-word", el).onclick = () => window.DataExportImport && window.DataExportImport.exportReviewsList(list, "word");
      $("#rv-exp-pdf", el).onclick = () => window.DataExportImport && window.DataExportImport.exportReviewsList(list, "pdf");

      function draw() {
        const q = ($("#rv-search", el).value || "").toLowerCase();
        const unrepliedCount = list.filter(r => !r.reply || !r.reply.content).length;
        const unrepEl = $("#cnt-unrep", el);
        if (unrepEl) unrepEl.textContent = unrepliedCount;

        $$("#rv-status-seg button", el).forEach(b => b.classList.toggle("active", b.dataset.st === curStatus));

        const filtered = list.filter(r => {
          // Lọc theo trạng thái chính
          if (curStatus === "unreplied" && r.reply && r.reply.content) return false;
          if (curStatus === "replied" && (!r.reply || !r.reply.content)) return false;
          if (curStatus === "forwarded" && !r.forwardedTo) return false;
          if (curStatus === "hidden" && !r.hidden) return false;

          // Lọc theo phân loại phụ
          if (curCat && r.category !== curCat) return false;

          // Lọc theo mục
          if (curTarget) {
            const tt = r.targetType || "tour";
            if (tt !== curTarget) return false;
          }

          // Lọc theo từ khóa
          if (q) {
            const str = JSON.stringify([r.tourName, r.foodName, r.name, r.author, r.comment, r.content, r.text, (r.reply && r.reply.content) || "", r.forwardedNote || ""]).toLowerCase();
            if (!str.includes(q)) return false;
          }
          return true;
        });

        const tbl = $("#adm-reviews-table", el);
        tbl.innerHTML = table([
          { t: "Mục & Phân loại", html: r => {
            const catColors = { inquiry: "info", review: "ok", complaint: "bad", feedback: "warn" };
            const catIcons = { inquiry: "❓ Hỏi thông tin", review: "⭐ Đánh giá", complaint: "⚠️ Khiếu nại", feedback: "💡 Góp ý" };
            const targetBadge = r.targetType === "food" ? '<span class="badge info">Ẩm thực</span>' : (r.targetType === "contact" ? '<span class="badge warn">Footer Contact</span>' : '<span class="badge">Tour</span>');
            return `
              <div><b>${esc(r.tourName || r.foodName || (r.targetType === 'contact' ? 'Phản hồi khách hàng' : 'Tour du lịch'))}</b></div>
              <div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">
                ${targetBadge}
                <span class="badge ${catColors[r.category] || 'ok'}">${esc(catIcons[r.category] || r.categoryName || '⭐ Đánh giá')}</span>
              </div>
            `;
          } },
          { t: "Khách gửi", html: r => {
            const src = r.source === "verified" ? '<span class="badge ok" style="font-size:10px">Đã đi tour</span>' : (r.source === "member" ? '<span class="badge info" style="font-size:10px">Thành viên</span>' : '<span class="badge" style="font-size:10px">Khách vãng lai</span>');
            return `
              <b>${esc(r.name || r.author || "Khách hàng")}</b>
              <div class="small muted">${src}</div>
              <div class="small muted" style="font-size:11px">${dt(r.createdAt || r.date)}</div>
            `;
          } },
          { t: "Đánh giá & Nội dung", html: r => {
            const stars = r.rating > 0 ? `<b style="color:var(--amber)">${r.rating} ★</b> ` : "";
            let repBlock = "";
            if (r.reply && r.reply.content) {
              const handler = r.handledBy ? `<span class="badge info" style="font-size:11px">Xử lý bởi: ${esc(r.handledBy)} (${esc(r.handledRole || 'Admin')})</span>` : '';
              repBlock = `
                <div style="margin-top:6px;padding:8px 12px;background:#f0f9ff;border-left:3px solid #0284c7;border-radius:6px;font-size:13px;color:#0369a1">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                    <b>💬 Phản hồi Travel:</b> ${handler}
                  </div>
                  <div>${esc(r.reply.content)}</div>
                </div>
              `;
            }
            let fwdBlock = "";
            if (r.forwardedTo) {
              fwdBlock = `
                <div style="margin-top:6px;padding:6px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;font-size:12px;color:#92400e">
                  <b>🔄 Đã chuyển tới ${esc(r.forwardedToName || r.forwardedTo)}:</b> "${esc(r.forwardedNote || 'Vui lòng kiểm tra và hỗ trợ')}" <span class="muted">(${esc(r.forwardedByName || 'CSKH')} lúc ${dt(r.forwardedAt)})</span>
                </div>
              `;
            }
            let hideBlock = "";
            if (r.hidden) {
              hideBlock = `<div class="badge bad" style="margin-top:4px">👁️‍🗨️ Đã ẩn vi phạm: ${esc((r.hiddenInfo && r.hiddenInfo.reason) || 'Vi phạm tiêu chuẩn cộng đồng')}</div>`;
            }
            return `
              <div>${stars}${esc(r.content || r.comment || r.text || "")}</div>
              ${repBlock}
              ${fwdBlock}
              ${hideBlock}
            `;
          } },
          { t: "Thao tác (Admin)", nowrap: true, cls: "actions", html: r => `
            <div class="act-btns" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn sm primary" data-rep="${esc(r.id)}" title="Trả lời bình luận">${r.reply && r.reply.content ? "✏️ Sửa rep" : "💬 Trả lời"}</button>
              <button class="btn sm" data-tag="${esc(r.id)}" title="Gắn phân loại: Hỏi tin / Đánh giá / Khiếu nại / Góp ý">🏷️ Loại</button>
              <button class="btn sm" data-fwd="${esc(r.id)}" title="Chuyển vấn đề cho bộ phận Điều hành / Thu ngân / HDV">🔄 Chuyển</button>
              ${r.hidden ? `<button class="btn sm ok" data-s="${esc(r.id)}" title="Hiện lại trên website">Hiện</button>` : `<button class="btn sm bad" data-h="${esc(r.id)}" title="Ẩn do vi phạm">Ẩn</button>`}
              <button class="btn sm" data-audit="${esc(r.id)}" title="Xem lịch sử xử lý và người phụ trách">📜 Lịch sử</button>
              <button class="btn sm bad" data-del="${esc(r.id)}" title="Xóa vĩnh viễn khỏi hệ thống (Chỉ Admin)">🗑️ Xóa</button>
            </div>
          ` }
        ], filtered, { empty: "Không tìm thấy bình luận nào phù hợp bộ lọc" });

        // Sự kiện Trả lời
        $$("[data-rep]", tbl).forEach(b => b.onclick = async () => {
          const item = list.find(x => x.id === b.dataset.rep);
          const currentRep = (item && item.reply && item.reply.content) || "";
          const v = await ask(
            `Phản hồi công khai cho khách ${item ? (item.name || item.author || "") : ""}`,
            [
              { name: "reply", label: "Nội dung phản hồi (hiển thị công khai dưới bình luận và trên footer)", type: "textarea", value: currentRep, required: true }
            ],
            { submit: "Gửi phản hồi công khai", kind: "ok" }
          );
          if (v && v.reply) {
            act(b, () => post(`/api/content/reviews/${b.dataset.rep}/reply`, { reply: v.reply }), "Đã lưu phản hồi thành công.", reload);
          }
        });

        // Sự kiện Gắn phân loại
        $$("[data-tag]", tbl).forEach(b => b.onclick = async () => {
          const item = list.find(x => x.id === b.dataset.tag);
          const v = await ask(`Gắn loại cho bình luận #${item?.id}`, [
            { name: "category", label: "Chọn phân loại bình luận", type: "select", options: [
              ["inquiry", "❓ Hỏi thông tin dịch vụ"],
              ["review", "⭐ Đánh giá trải nghiệm"],
              ["complaint", "⚠️ Khiếu nại dịch vụ"],
              ["feedback", "💡 Góp ý / Đóng góp ý kiến"]
            ], value: item?.category || "inquiry", required: true }
          ], { submit: "Lưu phân loại", kind: "ok" });
          if (v && v.category) {
            act(b, () => post(`/api/content/reviews/${b.dataset.tag}/tag`, { category: v.category }), "Đã gắn phân loại bình luận.", reload);
          }
        });

        // Sự kiện Chuyển bộ phận
        $$("[data-fwd]", tbl).forEach(b => b.onclick = async () => {
          const item = list.find(x => x.id === b.dataset.fwd);
          const v = await ask(`Chuyển vấn đề bình luận cho phòng ban khác`, [
            { name: "to", label: "Chuyển tới bộ phận", type: "select", options: [
              ["operator", "🧭 Điều hành tour (Kiểm tra lịch, chỗ, xe)"],
              ["cashier", "🧾 Thu ngân / Kế toán (Kiểm tra tiền, hoàn tiền)"],
              ["guide", "🧑‍✈️ Hướng dẫn viên (Xác minh sự cố trên tour)"],
              ["tech", "💻 Kỹ thuật / Hệ thống (Lỗi web, voucher, đăng nhập)"]
            ], required: true },
            { name: "note", label: "Ghi chú giao việc / Yêu cầu xử lý", type: "textarea", placeholder: "Ví dụ: Khách hỏi chính sách dời tour, nhờ Điều hành tư vấn..." }
          ], { submit: "Chuyển vấn đề", kind: "ok" });
          if (v && v.to) {
            act(b, () => post(`/api/content/reviews/${b.dataset.fwd}/forward`, { to: v.to, note: v.note }), "Đã chuyển vấn đề cho phòng ban liên quan.", reload);
          }
        });

        // Sự kiện Ẩn / Hiện
        $$("[data-h]", tbl).forEach(b => b.onclick = async () => {
          const v = await ask("Ẩn bình luận vi phạm", [
            { name: "reason", label: "Lý do ẩn (bắt buộc ghi rõ vi phạm)", type: "textarea", required: true, placeholder: "VD: Chứa từ ngữ thô tục, spam, sai lệch sự thật..." }
          ], { kind: "bad", submit: "Xác nhận ẩn" });
          if (v && v.reason) {
            act(null, () => post(`/api/content/reviews/${b.dataset.h}/moderate`, { hide: true, reason: v.reason }), "Đã ẩn bình luận vi phạm.", reload);
          }
        });

        $$("[data-s]", tbl).forEach(b => b.onclick = () => {
          act(b, () => post(`/api/content/reviews/${b.dataset.s}/moderate`, { hide: false }), "Đã cho hiển thị lại bình luận.", reload);
        });

        // Sự kiện Xem lịch sử xử lý (Admin)
        $$("[data-audit]", tbl).forEach(b => b.onclick = async () => {
          const id = b.dataset.audit;
          const res = await get(`/api/content/reviews/${id}/history`).catch(() => ({ history: [] }));
          const hist = res.history || [];
          Staff.modal(`📜 Lịch sử xử lý bình luận #${id}`, `
            <div style="font-size:13px">
              ${hist.length === 0 ? '<div class="empty">Chưa có lịch sử xử lý nào trong nhật ký hệ thống.</div>' : table([
                { t: "Thời gian", html: h => dt(h.at) },
                { t: "Người thực hiện", html: h => `<b>${esc(h.actorName || "Hệ thống")}</b><div class="small muted">${esc(h.role || "")}</div>` },
                { t: "Thao tác", html: h => `<span class="badge info">${esc(h.action)}</span>` },
                { t: "Chi tiết", html: h => esc(h.detail || "—") }
              ], hist)}
            </div>
          `, [{ label: "Đóng" }], { wide: true });
        });

        // Sự kiện Xóa vĩnh viễn (Chỉ Admin)
        $$("[data-del]", tbl).forEach(b => b.onclick = async () => {
          const id = b.dataset.del;
          if (await confirmBox("Xóa vĩnh viễn", `Bạn có chắc chắn muốn XÓA VĨNH VIỄN bình luận #${id}? Thao tác này không thể hoàn tác.`, "bad")) {
            act(null, () => del(`/api/content/reviews/${id}`), "Đã xóa vĩnh viễn bình luận khỏi hệ thống.", reload);
          }
        });
      }

      async function reload() {
        const res = await get("/api/content/reviews");
        list = res.reviews || [];
        draw();
      }

      // Gắn sự kiện chuyển tab filter chính
      $$("#rv-status-seg button", el).forEach(btn => btn.onclick = () => {
        curStatus = btn.dataset.st;
        draw();
      });

      $("#rv-search", el).oninput = () => {
        clearTimeout(window.__rv_t);
        window.__rv_t = setTimeout(draw, 250);
      };
      $("#rv-cat", el).onchange = e => { curCat = e.target.value; draw(); };
      $("#rv-target", el).onchange = e => { curTarget = e.target.value; draw(); };
      $("#rv-reset", el).onclick = () => {
        curStatus = "unreplied";
        curCat = "";
        curTarget = "";
        $("#rv-search", el).value = "";
        $("#rv-cat", el).value = "";
        $("#rv-target", el).value = "";
        draw();
      };

      await reload();
    } },

    { id: "config", label: "Cấu hình hệ thống", icon: "⚙️", group: "Hệ thống", perm: "system:config", async render(el) {
      const r = await get("/api/admin/config"), c = r.config;
      const num = (k, label, sub) => `<div><label>${esc(label)}</label><input type="number" min="0" data-k="${k}" ${sub ? `data-s="${sub}"` : ""} value="${esc(sub ? c[k][sub] : c[k])}"></div>`;
      el.innerHTML = `<div class="note">Mọi thay đổi được ghi nhật ký (ai, lúc nào, giá trị cũ → mới).</div><div class="card"><h2>Tham số vận hành</h2><div class="grid g3">
        ${num("paymentHoldHours", "Giữ chỗ khi chưa thanh toán (giờ)")}${num("balanceDueDaysAfterTrip", "Hạn thu nốt sau ngày kết thúc tour (ngày)")}
        ${num("guideResponseHours", "HDV phải trả lời trong (giờ)")}${num("complaintResponseHours", "CSKH phản hồi khiếu nại trong (giờ)")}${num("undoMinutes", "Cho phép hoàn tác thu tiền (phút)")}
        ${num("departure", "Sức chứa mặc định", "defaultCapacity")}${num("departure", "Khách tối thiểu mặc định", "defaultMinGuests")}${num("departure", "Chốt hủy/dồn trước ngày đi (ngày)", "cutoffDaysBeforeTrip")}
        ${num("extension", "Gia hạn tối đa (ngày)", "maxDays")}${num("extension", "Báo trước gia hạn (giờ)", "noticeHours")}${num("extension", "Phụ thu gia hạn (%)", "surchargePct")}</div></div>
        <div class="card"><h2>Bảng hoàn tiền khi khách hủy</h2><p class="muted small">Mỗi dòng: hủy trước ngày đi ít nhất X ngày thì được hoàn Y%.</p><div id="rp"></div><button class="btn sm" id="ar">+ Thêm mốc</button></div>
        <div class="card"><h2>Ngày nghỉ sau tour (chỉ HDV chính thức)</h2><div id="rd"></div><button class="btn sm" id="ad">+ Thêm</button></div>
        <button class="btn primary" id="sv">Lưu cấu hình</button>`;
      const tierRow = (a, b, n1, n2) => `<div class="row tier" style="gap:8px;margin-bottom:6px"><input type="number" min="0" value="${a}" data-n="${n1}" style="width:140px"><span>→</span><input type="number" min="0" value="${b}" data-n="${n2}" style="width:140px"><button class="btn bad sm" data-rm>×</button></div>`;
      const rp = $("#rp", el), rd = $("#rd", el);
      c.refundPolicy.forEach(t => rp.insertAdjacentHTML("beforeend", tierRow(t.minDaysBefore, t.pct, "minDaysBefore", "pct")));
      c.restDays.forEach(t => rd.insertAdjacentHTML("beforeend", tierRow(t.minTourDays, t.rest, "minTourDays", "rest")));
      $("#ar", el).onclick = () => rp.insertAdjacentHTML("beforeend", tierRow(0, 0, "minDaysBefore", "pct")); $("#ad", el).onclick = () => rd.insertAdjacentHTML("beforeend", tierRow(1, 1, "minTourDays", "rest"));
      el.addEventListener("click", e => { if (e.target.matches("[data-rm]")) e.target.closest(".tier").remove(); });
      const readTiers = box => $$(".tier", box).map(r => { const o = {}; $$("input", r).forEach(i => o[i.dataset.n] = Number(i.value)); return o; });
      $("#sv", el).onclick = e => {
        const patch = {}; $$("input[data-k]", el).forEach(i => { const k = i.dataset.k, s = i.dataset.s; if (s) { patch[k] = patch[k] || { ...c[k] }; patch[k][s] = Number(i.value); } else patch[k] = Number(i.value); });
        patch.refundPolicy = readTiers(rp); patch.restDays = readTiers(rd);
        act(e.target, () => put("/api/admin/config", patch), "Đã lưu cấu hình.");
      };
    } },

    { id: "audit", label: "Nhật ký hệ thống", icon: "🕵️", group: "Hệ thống", perm: "audit:view", async render(el) {
      const ACTION_LABELS = {
        "tour.company_cancel": "Hủy tour (Công ty hủy)",
        "tour.create": "Tạo tour mới",
        "tour.update": "Cập nhật tour",
        "tour.delete": "Xóa tour",
        "tour.approve_draft": "Duyệt xuất bản tour",
        "tour.reject_draft": "Trả lại bản nháp tour",
        "booking.create": "Khách đặt tour",
        "booking.confirm": "Admin duyệt chốt đơn",
        "booking.cancel": "Hủy đơn tour",
        "booking.reject": "Từ chối đơn tour",
        "order.pay": "Thanh toán đơn hàng",
        "order.create": "Tạo đơn hàng",
        "payment.confirm": "Xác nhận nhận tiền",
        "payment.collect_full": "Thu nốt phần còn lại",
        "refund.request": "Yêu cầu hoàn tiền",
        "refund.approve": "Duyệt hoàn tiền",
        "refund.reject": "Từ chối hoàn tiền",
        "refund.pay": "Thu ngân chi tiền hoàn",
        "salary.pay": "Chi trả lương",
        "salary.pay_all": "Chi lương toàn công ty",
        "salary.adjust": "Điều chỉnh lương cơ bản",
        "salary.remind": "Nhắc nhở vi phạm (-200k)",
        "kpi.evaluate": "Đánh giá xếp loại KPI",
        "salary.regular_review": "Xét tăng lương định kỳ 12 tháng",
        "salary.early_raise": "Tăng lương trước hạn",
        "reconcile.create": "Thu ngân lập đóng sổ",
        "reconcile.approve": "Duyệt đóng sổ cuối ngày",
        "reconcile.reject": "Từ chối đóng sổ",
        "voucher.create": "Tạo voucher ưu đãi",
        "voucher.toggle": "Bật/Tắt voucher",
        "voucher.delete": "Xóa voucher",
        "banner.create": "Thêm banner trang chủ",
        "banner.update": "Sửa banner trang chủ",
        "banner.toggle": "Bật/Tắt banner",
        "banner.delete": "Xóa banner",
        "staff.create": "Thêm nhân viên mới",
        "staff.lock": "Khóa tài khoản",
        "staff.unlock": "Mở khóa tài khoản",
        "staff.update": "Cập nhật thông tin nhân viên",
        "auth.login": "Đăng nhập hệ thống",
        "auth.logout": "Đăng xuất",
        "config.update": "Cập nhật cấu hình hệ thống"
      };

      const bar = Parts.search(() => reload(), "Tìm người làm, mã đơn, nội dung…", '<input id="ap" placeholder="Lọc hành động (vd: booking, tour, salary, reconcile...)" style="max-width:280px"><button class="btn sm" id="ac">Xuất CSV</button>');
      const body = h("<div></div>"); el.append(bar, body); let rows = [];
      $("#ap", bar).oninput = () => { clearTimeout(window.__t); window.__t = setTimeout(reload, 300); };
      $("#ac", bar).onclick = () => csv("nhat-ky.csv", ["Lúc", "Người làm", "Vai trò", "Hành động", "Mã hành động", "Đối tượng", "Chi tiết"], rows.map(e => [e.at, e.actorName, e.role, ACTION_LABELS[e.action] || e.action, e.action, e.target, e.detail]));
      async function reload() {
        const r = await get(`/api/admin/audit?q=${encodeURIComponent($("input", bar).value)}&action=${encodeURIComponent($("#ap", bar).value)}&limit=300`); rows = r.entries;
        body.innerHTML = table([
          { t: "Thời gian", html: e => dt(e.at), sort: e => e.at },
          { t: "Người thực hiện", html: e => `<b>${esc(e.actorName || "Hệ thống")}</b><div class="small muted">${esc(e.actorId || "system")} · <span class="badge info">${esc(Staff.ROLE_NAME[e.role] || e.role)}</span></div>` },
          { t: "Hành động", html: e => {
            const friendly = ACTION_LABELS[e.action] || (e.action ? e.action.replace(/\./g, " → ") : "—");
            return `<b style="font-size:13px">${esc(friendly)}</b><div class="small muted mono">${esc(e.action)}</div>`;
          } },
          { t: "Đối tượng / Mã", html: e => `<b class="mono">${esc(e.target || "—")}</b>` },
          { t: "Chi tiết nội dung", html: e => esc(e.detail || "—") }
        ], rows, { sortable: true, empty: "Không có bản ghi nhật ký nào" });
      }
      await reload();
    } },
  ];

  Staff.boot({ roles: ["admin"], title: "Quản trị", sections });
})();
