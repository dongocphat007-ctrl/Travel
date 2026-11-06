/* Quản trị viên: duyệt đơn, hoàn tiền, đóng sổ, hủy tour, nội dung tour, nhân viên, cấu hình, nhật ký, thống kê. KHÔNG có xác nhận tiền / chuyển tiền hoàn (tách quyền với Thu ngân). */
(() => {
  const { esc, money, compactMoney, dt, day, badge, pill, h, $, $$, get, post, put, del, ask, confirmBox, act, table, toast, fail, tabs, barChart, lineChart, donut, csv } = Staff;
  const SRC = { customer_cancel: "Khách hủy", admin_reject: "Admin từ chối", company_cancel: "Công ty hủy", complaint: "Đền bù khiếu nại", balance_overdue: "Quá hạn thu nốt" };
  const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  async function viewOrder(id) { await Parts.showOrder(`/api/admin/bookings/${encodeURIComponent(id)}`, "Chi tiết đơn"); }
  const bindView = (el) => $$("[data-view]", el).forEach(b => b.onclick = () => viewOrder(b.dataset.view).catch(fail));

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
          <input type="number" id="sy" style="width:85px;text-align:center;font-weight:700" value="${st.year}" min="2020" max="2100" aria-label="Năm">
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

        // KPI cards
        const kpiHtml = `
          <div class="note info" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>${esc(d.note)} · Kỳ báo cáo: <b>${esc(d.label)}</b></div>
            ${d.reconciled ? `<span class="badge ok">✓ Số liệu đối chiếu chuẩn khớp</span>` : ""}
          </div>
          ${d.warnings && d.warnings.length ? `<div class="note warn"><b>Cảnh báo chênh lệch:</b><ul>${d.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
          <div class="grid g4" style="margin-bottom:18px">
            <div class="kpi ok">
              <div class="l">Doanh thu thuần (Thực thu)</div>
              <div class="v">${money(k.revenue)}</div>
              <div class="s" style="margin-top:4px">Đã thu: <b>${money(k.collected || k.revenue)}</b> · Hoàn: ${money(k.refunded || 0)}</div>
            </div>
            <div class="kpi" style="border-left:4px solid var(--accent,#D97706)">
              <div class="l">Doanh số tour chốt duyệt</div>
              <div class="v" style="color:var(--accent,#D97706)">${money(k.bookedRevenue || k.revenue)}</div>
              <div class="s" style="margin-top:4px">Công nợ còn phải thu: <b style="color:var(--bad,#DC2626)">${money(k.receivable || 0)}</b></div>
            </div>
            <div class="kpi">
              <div class="l">Số đơn tour hiệu lực</div>
              <div class="v">${k.orders.toLocaleString("vi-VN")} đơn</div>
              <div class="s" style="margin-top:4px">Đã duyệt: <b>${(k.confirmedOrders || k.orders).toLocaleString("vi-VN")}</b> đơn chốt</div>
            </div>
            <div class="kpi ${k.cancelRate > 15 ? "warn" : ""}">
              <div class="l">Lượng khách / Tỷ lệ hủy</div>
              <div class="v">${k.guests.toLocaleString("vi-VN")} khách</div>
              <div class="s" style="margin-top:4px">Tỷ lệ hủy: <b>${k.cancelRate}%</b> (${k.cancelRate <= 10 ? "An toàn" : "Cần theo dõi"})</div>
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
                { t: "Thực thu thuần", num: true, html: r => `<b>${money(r.revenue)}</b>` },
                { t: "Doanh số chốt duyệt", num: true, html: r => `<b style="color:var(--accent,#D97706)">${money(r.bookedRevenue || 0)}</b>` },
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

          const cc = $("#chart-container", body);
          if (st.chartType === "line") {
            cc.innerHTML = lineChart(labels, rows.map(r => r.revenue), { fmt: v => money(Math.round(v)), axisFmt: compactMoney, label: "Doanh thu thuần (Thực thu)" });
          } else {
            cc.innerHTML = barChart(labels, [
              { name: "Thực thu thuần", values: rows.map(r => r.revenue), color: "var(--teal,#0F766E)" },
              { name: "Doanh số chốt duyệt", values: rows.map(r => r.bookedRevenue || 0), color: "var(--accent,#D97706)" }
            ], { fmt: v => money(Math.round(v)), axisFmt: compactMoney, label: "Doanh thu & Doanh số" });
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
                      <th class="num sortable">Thực thu thuần</th>
                      <th class="num sortable">Doanh số chốt duyệt</th>
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
                        <td class="num"><b>${money(r.revenue)}</b></td>
                        <td class="num" style="color:var(--accent,#D97706)"><b>${money(r.bookedRevenue || 0)}</b></td>
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
      };

      function renderOrdersList(orders) {
        if (!orders || !orders.length) {
          if (st.period === "month") return `<div class="card"><div class="empty">Không có đơn hàng nào trong tháng ${st.month}/${st.year}.</div></div>`;
          return "";
        }
        const title = st.period === "month" ? `Danh sách đơn hàng trong Tháng ${st.month}/${st.year} (${orders.length} đơn)` :
                      st.period === "quarter" ? `Danh sách đơn hàng trong Quý ${st.quarter}/${st.year} (${orders.length} đơn)` :
                      `Danh sách đơn hàng năm ${st.year} (${orders.length} đơn)`;
        return `
          <div class="card">
            <div class="card-header-acts">
              <h2>${title}</h2>
              <span class="small muted">Bấm mã đơn để xem chi tiết nghiệp vụ</span>
            </div>
            ${table([
              { t: "Mã đơn", html: o => `<a href="#" data-view="${esc(o.id)}" class="mono" style="font-weight:700">${esc(o.payCode)}</a>` },
              { t: "Khách hàng", html: o => `<b>${esc(o.customerName)}</b>${o.phone ? `<div class="small muted">${esc(o.phone)}</div>` : ""}` },
              { t: "Tour & Ngày đi", html: o => `${esc(o.tourName)}${o.date ? `<div class="small muted">Khởi hành: ${day(o.date)}</div>` : ""}` },
              { t: "Số khách", num: true, html: o => (o.pax || "—") + " khách" },
              { t: "Tổng tiền", num: true, html: o => money(o.amount) },
              { t: "Đã thu", num: true, html: o => `<b style="color:var(--ok)">${money(o.paid)}</b>` },
              { t: "Trạng thái", html: o => badge(o.status) },
              { t: "Ngày đặt", html: o => dt(o.createdAt) },
              { t: "", html: o => `<button class="btn sm" data-view="${esc(o.id)}">Xem</button>` }
            ], orders.slice(0, 200))}
          </div>
        `;
      }

      const load = async () => {
        if (st.period === "day") {
          data = await get(`/api/admin/daily-stats?date=${encodeURIComponent(st.day)}`);
        } else {
          data = await get(`/api/stats?period=${st.period}&year=${st.year}&quarter=${st.quarter}&month=${st.month}`);
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
        st.year--;
        $("#sy", bar).value = st.year;
        load().catch(fail);
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
            { t: "Tour", html: t => `<b>${esc(t.name)}</b>${(t.isNew || String(t.id).startsWith("tour_")) ? ' <span class="badge" style="background:#ef4444;color:#fff;font-weight:700">MỚI</span>' : ''}<div class="small muted"><span class="mono">${esc(t.id)}</span> · Điểm đến: ${esc(t.dest || t.destination || "—")}</div>` },
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
              return `<div style="display:flex;align-items:center;gap:10px">${img}<div><b>${esc(f.name)}</b>${(f.province || f.dest) ? `<div class="small muted">📍 ${esc(f.province || f.dest)}</div>` : ""}</div></div>`;
            } },
            { t: "Vùng miền", html: f => pill(REG[f.region] || f.region, f.region === "bac" ? "info" : f.region === "trung" ? "warn" : "ok") },
            { t: "Mô tả", html: f => `<div style="max-width:420px;font-size:0.85rem;line-height:1.45;color:var(--muted)">${esc(f.description || f.desc || "—")}</div>` },
            { t: "Trạng thái", html: f => f.active !== false ? pill("Đang hiện", "ok") : pill("Đang ẩn", "bad") },
            { t: "Thao tác", nowrap: true, cls: "actions", html: f => `
              <div class="act-btns">
                <button class="btn sm" data-f-edit="${esc(f.id)}">Sửa</button>
                <button class="btn sm ${f.active !== false ? "bad" : "ok"}" data-f-toggle="${esc(f.id)}">${f.active !== false ? "Ẩn" : "Hiện"}</button>
                <button class="btn bad sm" data-f-del="${esc(f.id)}">Xóa</button>
              </div>` }
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
          const v = await ask(isEdit ? "Sửa món: " + f.name : "Thêm món đặc sản mới", [
            { name: "name", label: "Tên món đặc sản", value: f?.name || "", required: true, placeholder: "VD: Phở Bát Đàn, Mì Quảng, Bún chả..." },
            { name: "region", label: "Vùng miền", type: "select", value: f?.region || "bac", options: [["bac", "Miền Bắc"], ["trung", "Miền Trung"], ["nam", "Miền Nam"]] },
            { name: "province", label: "Tỉnh / Thành phố nổi tiếng", value: f?.province || f?.dest || "", placeholder: "VD: Hà Nội, Quảng Nam, Đà Nẵng..." },
            { name: "image", label: "Ảnh (đường dẫn hoặc tải lên)", upload: "food", value: f?.image || "", placeholder: "VD: img/foods/pho.jpg hoặc URL ảnh" },
            { name: "desc", label: "Giới thiệu món ăn", type: "textarea", value: f?.description || f?.desc || "" },
            { name: "active", label: "Hiển thị trên trang Ẩm thực", type: "checkbox", value: f ? f.active !== false : true }
          ], { submit: isEdit ? "Lưu món" : "Thêm món" });

          if (!v) return;
          const payload = {
            name: v.name,
            region: v.region,
            province: v.province,
            image: v.image,
            description: v.desc,
            desc: v.desc,
            active: v.active
          };

          if (isEdit) {
            act(null, () => put(`/api/content/foods/${encodeURIComponent(f.id)}`, payload), "Đã lưu món ăn.", reload);
          } else {
            act(null, () => post("/api/content/foods", payload), "Đã thêm món đặc sản.", reload);
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
        body.innerHTML = table([{ t: "Mã", html: s => `<b class="mono">${esc(s.id)}</b>` }, { t: "Họ tên", k: "name" }, { t: "Vai trò", html: s => esc((Staff.ROLE_NAME[s.role] || s.role)) }, { t: "Email / SĐT", html: s => esc(s.email) + `<div class="small muted">${esc(s.phone || "")}</div>` },
          { t: "Số lỗi", html: s => (s.strikes && s.strikes > 0) ? `<span class="badge bad">${s.strikes} lỗi</span>` : '<span class="muted">0</span>' },
          { t: "Trạng thái", html: s => s.locked ? pill("Đã khóa", "bad") : pill("Hoạt động", "ok") },
          { t: "Hành động", nowrap: true, cls: "actions", minWidth: "380px", html: s => `<div class="act-btns">
            <button class="btn sm" data-e="${esc(s.id)}">Sửa</button>
            <button class="btn sm" data-l="${esc(s.id)}" data-v="${s.locked ? 0 : 1}">${s.locked ? "Mở khóa" : "Khóa"}</button>
            <button class="btn sm" data-p="${esc(s.id)}">Cấp lại MK</button>
            <button class="btn sm" data-r="${esc(s.id)}">Đổi vai trò</button>
            ${s.id !== (Staff.user && Staff.user.id) ? `<button class="btn bad sm" data-rem="${esc(s.id)}" title="Ghi 1 lỗi vi phạm & tự động trừ 200k tiền lương">⚠️ Nhắc nhở (-200k)</button>` : ""}
            ${s.id !== (Staff.user && Staff.user.id) ? `<button class="btn bad sm" data-x="${esc(s.id)}">Xóa</button>` : ""}
          </div>` }], r.staff, { empty: "Không có nhân viên" });
        const find = id => r.staff.find(s => s.id === id), ro = roles.map(x => [x.key, x.name]);
        $$("[data-e]", body).forEach(b => b.onclick = async () => { const s = find(b.dataset.e); const v = await ask("Sửa " + s.id, [{ name: "name", label: "Họ tên", value: s.name, required: true }, { name: "email", label: "Email", value: s.email }, { name: "phone", label: "Điện thoại", value: s.phone }]); if (v) act(null, () => put(`/api/admin/staff/${s.id}`, v), "Đã lưu.", reload); });
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
        const v = await ask("Thêm nhân viên", [{ name: "name", label: "Họ tên", required: true }, { name: "role", label: "Vai trò", type: "select", options: roles.map(x => [x.key, x.name]) }, { name: "email", label: "Email" }, { name: "phone", label: "Điện thoại" },
          { name: "auto", label: "Tự sinh mật khẩu", type: "checkbox", value: true }, { name: "password", label: "Mật khẩu (nếu tự đặt)", type: "password" }, { name: "confirm", label: "Nhập lại", type: "password" },
          { name: "guideType", label: "Nếu là HDV – loại", type: "select", options: [["domestic", "Nội địa"], ["international", "Quốc tế"]] }, { name: "employmentType", label: "Nếu là HDV – hình thức", type: "select", options: [["staff", "Chính thức"], ["freelance", "Cộng tác viên"]] }, { name: "regions", label: "Nếu là HDV – khu vực (ngăn cách bằng dấu phẩy)", placeholder: "north,central,south" }]);
        if (!v) return;
        const body = { name: v.name, role: v.role, email: v.email, phone: v.phone, auto: v.auto, password: v.password, confirm: v.confirm };
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
      async function reload() {
        const res = await get("/api/admin/salaries");
        const list = res.staff || [];
        const logs = res.logs || [];
        const defSal = res.defaultSalary || 15000000;

        el.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <h2 style="margin:0">Quản lý Lương & Phát lương Nhân viên</h2>
                <div class="muted small" style="margin-top:4px">Áp dụng cho các vai trò văn phòng: Điều hành tour, Thu ngân, CSKH, Biên tập viên (HDV nhận theo 20% giá tour).</div>
              </div>
              <button class="btn ok" id="adm-pay-all-btn">💵 Phát lương toàn bộ nhân viên (${list.length} người)</button>
            </div>

            <div class="grid g3" style="margin-top:16px">
              <div class="kpi"><div class="l">Nhân viên văn phòng</div><div class="v">${list.length} người</div></div>
              <div class="kpi ok"><div class="l">Tổng quỹ lương / đợt</div><div class="v">${money(list.reduce((s, x) => s + (x.baseSalary || defSal), 0))}</div></div>
              <div class="kpi"><div class="l">Định mức mặc định</div><div class="v">${money(defSal)}</div></div>
            </div>
          </div>

          <div class="card">
            <h2>Bảng lương nhân viên văn phòng</h2>
            <div id="adm-salary-table"></div>
          </div>

          <div class="card">
            <h2>Lịch sử phát lương & Điều chỉnh gần đây (${logs.length})</h2>
            <div id="adm-salary-logs"></div>
          </div>
        `;

        $("#adm-pay-all-btn", el).onclick = async () => {
          const totalQ = list.reduce((s, x) => s + (x.baseSalary || defSal), 0);
          if (await confirmBox("Xác nhận phát lương tháng", `Bạn có chắc muốn phát lương cho toàn bộ ${list.length} nhân viên? Tổng chi: ${money(totalQ)}`)) {
            const note = prompt("Nhập ghi chú đợt phát lương (ví dụ: Lương tháng " + (new Date().getMonth() + 1) + "):", "Phát lương định kỳ từ Ban Giám Đốc");
            if (note != null) {
              act(null, () => post("/api/admin/salaries/pay-all", { note }), "Đã phát lương thành công cho tất cả nhân viên.", reload);
            }
          }
        };

        const tbl = $("#adm-salary-table", el);
        tbl.innerHTML = table([
          { t: "Nhân viên", html: s => `<b>${esc(s.name)}</b><div class="small muted">${esc(s.email)} · ${esc(s.id)}</div>` },
          { t: "Vai trò", html: s => `<span class="badge info">${esc(s.roleName || s.role)}</span><div class="small muted">${esc(s.incomeTitle || "")}</div>` },
          { t: "Lương định mức", num: true, html: s => `<b>${money(s.baseSalary || defSal)}</b>` },
          { t: "Số dư ví hiện tại", num: true, html: s => `<span style="color:var(--ok);font-weight:700">${money(s.balance)}</span>` },
          { t: "Tổng đã nhận", num: true, html: s => money(s.totalEarned) },
          { t: "Lỗi vi phạm", html: s => (s.strikes && s.strikes > 0) ? `<span class="badge bad">${s.strikes} lỗi</span>` : '<span class="muted">0</span>' },
          { t: "Lần phát gần nhất", html: s => s.lastPaidAt ? dt(s.lastPaidAt) : '<span class="muted">—</span>' },
          { t: "Hành động", nowrap: true, cls: "actions", minWidth: "360px", html: s => `
            <div class="act-btns">
              <button class="btn ok sm" data-pay="${esc(s.id)}" title="Phát lương">💵 Phát lương</button>
              <button class="btn sm" data-inc="${esc(s.id)}" title="Tăng lương cơ bản">➕ Tăng</button>
              <button class="btn sm" data-dec="${esc(s.id)}" title="Giảm lương cơ bản">➖ Trừ</button>
              <button class="btn sm" data-bon="${esc(s.id)}" title="Thưởng nóng">🎁 Thưởng</button>
              <button class="btn bad sm" data-rem="${esc(s.id)}" title="Ghi 1 lỗi & phạt 200k tiền lương">⚠️ Phạt (-200k)</button>
            </div>
          ` }
        ], list, { empty: "Chưa có nhân viên văn phòng nào" });

        // Gắn sự kiện các nút hành động
        $$("[data-pay]", tbl).forEach(btn => btn.onclick = async () => {
          const s = list.find(x => x.id === btn.dataset.pay);
          const v = await ask(`Phát lương cho ${s.name}`, [
            { name: "amount", label: "Số tiền phát lương (₫)", type: "number", value: s.baseSalary || defSal, required: true },
            { name: "note", label: "Ghi chú lời nhắn", type: "text", placeholder: "Ví dụ: Lương tháng " + (new Date().getMonth() + 1) }
          ], { submit: "Xác nhận phát lương", kind: "ok" });
          if (v) act(null, () => post("/api/admin/salaries/pay", { staffId: s.id, amount: Number(v.amount), note: v.note }), "Đã phát lương thành công.", reload);
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

        const logTbl = $("#adm-salary-logs", el);
        logTbl.innerHTML = table([
          { t: "Thời gian", html: l => dt(l.at), sort: l => l.at },
          { t: "Nhân viên", html: l => `<b>${esc(l.staffName)}</b>` },
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
        ], logs, { empty: "Chưa có lịch sử phát lương hay điều chỉnh nào" });
      }
      await reload();
    } },

    { id: "payments", label: "Giám sát thanh toán", icon: "💳", group: "Tài chính", perm: "payment:view", async render(el) {
      const bar = h(`<div class="toolbar">
        <input type="search" id="pm-q" placeholder="Tìm mã đơn, tên khách, số tiền…" style="min-width:240px">
        <select id="pm-status">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ xác nhận tiền</option>
          <option value="paid">Đã thanh toán đủ</option>
          <option value="deposit">Đã cọc</option>
          <option value="refunded">Đã hoàn tiền</option>
        </select>
        <button class="btn sm" id="pm-refresh">🔄 Làm mới</button>
      </div>`);
      const summaryBox = h(`<div class="grid g4" style="margin-bottom:14px"></div>`);
      const body = h("<div></div>");
      el.append(bar, summaryBox, body);

      async function reload() {
        const [qData, bookingsData] = await Promise.all([
          get("/api/cashier/queue").catch(() => ({ queue: [] })),
          get("/api/admin/bookings?status=").catch(() => ({ bookings: [] }))
        ]);
        const list = bookingsData.bookings || [];
        const filterVal = $("#pm-status", bar).value;
        const qVal = ($("#pm-q", bar).value || "").toLowerCase().trim();

        const filtered = list.filter(b => {
          if (filterVal === "pending" && b.paymentStatus !== "pending" && b.status !== "awaiting_payment") return false;
          if (filterVal === "paid" && b.paidAmount < b.price) return false;
          if (filterVal === "deposit" && (b.paidAmount <= 0 || b.paidAmount >= b.price)) return false;
          if (filterVal === "refunded" && b.status !== "refunded" && b.status !== "cancelled") return false;
          if (qVal) {
            const str = `${b.payCode} ${b.customerName} ${b.tourName} ${b.phone || ""}`.toLowerCase();
            if (!str.includes(qVal)) return false;
          }
          return true;
        });

        const totalExpected = list.reduce((s, x) => s + (x.price || 0), 0);
        const totalCollected = list.reduce((s, x) => s + (x.paidAmount || 0), 0);
        const totalPending = list.filter(x => (x.price || 0) > (x.paidAmount || 0)).reduce((s, x) => s + ((x.price || 0) - (x.paidAmount || 0)), 0);

        summaryBox.innerHTML = `
          <div class="kpi ok"><div class="l">Tổng tiền đã thu</div><div class="v">${money(totalCollected)}</div><div class="s">${list.filter(x => x.paidAmount > 0).length} đơn có phát sinh thu</div></div>
          <div class="kpi"><div class="l">Tổng giá trị đơn tour</div><div class="v">${money(totalExpected)}</div><div class="s">${list.length} đơn tour</div></div>
          <div class="kpi warn"><div class="l">Công nợ / Chờ thu nốt</div><div class="v">${money(totalPending)}</div><div class="s">Cọc hoặc chưa đóng đủ</div></div>
          <div class="kpi"><div class="l">Đơn cần đối soát</div><div class="v">${(qData.queue || []).length}</div><div class="s">Giao dịch quầy / chuyển khoản</div></div>
        `;

        body.innerHTML = `
          <div class="note info">
            <b>Giám sát dòng tiền:</b> Admin có quyền theo dõi tổng thể dòng tiền và hóa đơn. Việc xác nhận tiền thực tế được thực hiện độc lập bởi <b>Thu ngân (Cashier)</b> theo nguyên tắc Separation of Duties.
          </div>
          ${table([
            { t: "Mã đơn", html: b => `<a href="#" data-view="${esc(b.id)}" class="mono"><b>${esc(b.payCode)}</b></a>`, sort: b => b.payCode },
            { t: "Khách hàng", html: b => `<b>${esc(b.customerName)}</b><div class="small muted">${esc(b.phone || "")}</div>` },
            { t: "Tour", html: b => `${esc(b.tourName)}<div class="small muted">Ngày đi: ${day(b.date)}</div>` },
            { t: "Tổng đơn", num: true, html: b => `<b>${money(b.price)}</b>`, sort: b => b.price },
            { t: "Đã thu", num: true, html: b => `<b style="color:var(--ok)">${money(b.paidAmount)}</b>`, sort: b => b.paidAmount },
            { t: "Còn thiếu", num: true, html: b => money(Math.max(0, (b.price || 0) - (b.paidAmount || 0))) },
            { t: "Trạng thái", html: b => badge(b.status) },
            { t: "Thao tác", html: b => `<button class="btn sm" data-view="${esc(b.id)}">Chi tiết</button>` }
          ], filtered, { sortable: true, empty: "Không tìm thấy giao dịch nào" })}
        `;
        $$("[data-view]", body).forEach(b => b.onclick = (e) => { e.preventDefault(); viewOrder(b.dataset.view).catch(fail); });
      }

      $("#pm-q", bar).oninput = () => { clearTimeout(window.__pm_t); window.__pm_t = setTimeout(reload, 300); };
      $("#pm-status", bar).onchange = reload;
      $("#pm-refresh", bar).onclick = reload;
      await reload();
    } },

    { id: "refunds", label: "Duyệt hoàn tiền", icon: "💸", group: "Tài chính", perm: "refund:approve", async badge() { return (await get("/api/admin/queue")).refunds.length; }, async render(el) {
      async function reload() {
        const all = (await get("/api/admin/refunds")).refunds;
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

    { id: "reconcile", label: "Duyệt đóng sổ", icon: "📒", group: "Tài chính", perm: "reconcile:approve", async badge() { return (await get("/api/admin/queue")).reconciliations.length; }, async render(el) {
      async function reload() {
        const list = (await get("/api/admin/reconcile")).reconciliations;
        el.innerHTML = `<div class="note">Người tạo bản đóng sổ không được tự duyệt. Bản có chênh lệch cần xem kỹ giải trình.</div>` + table([{ t: "Ngày", html: x => day(x.date), sort: x => x.date }, { t: "Thu ngân", html: x => esc(x.createdByName || x.createdBy) }, { t: "Thực thu", num: true, html: x => money(x.netTotal) }, { t: "Sao kê", num: true, html: x => money(x.bankStatementTotal) },
          { t: "Chênh lệch", num: true, html: x => x.discrepancy ? `<b style="color:var(--bad)">${money(x.discrepancy)}</b>` : "0 ₫" }, { t: "Ghi chú", html: x => esc(x.note) }, { t: "Trạng thái", html: x => pill({ pending_approval: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" }[x.status] || x.status, x.status === "approved" ? "ok" : x.status === "rejected" ? "bad" : "warn") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: x => x.status === "pending_approval" ? `<div class="act-btns"><button class="btn ok sm" data-y="${esc(x.id)}">Duyệt</button><button class="btn bad sm" data-n="${esc(x.id)}">Từ chối</button></div>` : "" }], list, { empty: "Chưa có bản đóng sổ" });
        const dec = (id, approve) => async () => { const v = await ask(approve ? "Duyệt đóng sổ" : "Từ chối đóng sổ", [{ name: "note", label: "Ghi chú", type: "textarea", required: !approve }], { kind: approve ? "ok" : "bad" }); if (v) act(null, () => post(`/api/admin/reconcile/${id}/decision`, { approve, note: v.note }), "Đã xử lý.", reload); };
        $$("[data-y]", el).forEach(b => b.onclick = dec(b.dataset.y, true)); $$("[data-n]", el).forEach(b => b.onclick = dec(b.dataset.n, false));
      }
      await reload();
    } },

    { id: "vouchers", label: "Voucher", icon: "🎟️", group: "Tài chính", perm: "voucher:manage", async render(el) {
      async function reload() {
        const r = await get("/api/admin/vouchers");
        el.innerHTML = `<div class="toolbar"><button class="btn primary" id="nv">+ Tạo voucher</button></div>` + table([{ t: "Mã", html: v => `<b class="mono">${esc(v.code)}</b>` }, { t: "Giảm", html: v => esc(v.type === "percent" ? v.value + "%" : money(v.value)) }, { t: "Hạn", html: v => esc(v.expiresAt || v.expires || "—") }, { t: "Trạng thái", html: v => v.disabled ? pill("Tạm tắt", "bad") : pill("Đang dùng", "ok") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: v => `<div class="act-btns"><button class="btn sm" data-t="${esc(v.code)}" data-d="${v.disabled ? 0 : 1}">${v.disabled ? "Bật" : "Tắt"}</button><button class="btn bad sm" data-x="${esc(v.code)}">Xóa</button></div>` }], r.vouchers, { empty: "Chưa có voucher" });
        $("#nv", el).onclick = async () => { const v = await ask("Tạo voucher", [{ name: "code", label: "Mã", required: true }, { name: "type", label: "Loại", type: "select", options: [["percent", "Giảm %"], ["amount", "Giảm tiền"]] }, { name: "value", label: "Giá trị", type: "number", required: true }, { name: "expiresAt", label: "Hạn dùng", type: "date" }]); if (v) act(null, () => post("/api/admin/vouchers", { ...v, value: Number(v.value) }), "Đã tạo.", reload); };
        $$("[data-t]", el).forEach(b => b.onclick = () => act(b, () => put(`/api/admin/vouchers/${encodeURIComponent(b.dataset.t)}`, { disabled: b.dataset.d === "1" }), "Đã cập nhật.", reload));
        $$("[data-x]", el).forEach(b => b.onclick = async () => { if (await confirmBox("Xóa voucher", "Xóa " + esc(b.dataset.x) + "?", "bad")) act(null, () => del(`/api/admin/vouchers/${encodeURIComponent(b.dataset.x)}`), "Đã xóa.", reload); });
      }
      await reload();
    } },

    { id: "withdrawals", label: "Theo dõi rút tiền", icon: "💳", group: "Tài chính", perm: "payment:view", async badge() { const list = await get("/api/cashier/withdrawals?status=pending"); return list ? list.length : 0; }, async render(el) {
      async function reload() {
        const all = await get("/api/cashier/withdrawals") || [];
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

    { id: "reviews", label: "Đánh giá & AI Phân tích", icon: "⭐", group: "Nội dung", perm: "review:moderate", async render(el) {
      const bar = Parts.search(() => draw(), "Tìm theo tour, khách hàng, nội dung…", '<select id="rf"><option value="">Tất cả</option><option value="hidden">Đang ẩn</option><option value="shown">Đang hiện</option></select><button type="button" class="btn ok" id="btn-admin-ai-sentiment" style="margin-left:8px;font-size:0.82rem;white-space:nowrap">✨ AI Phân tích cảm xúc & Tóm tắt</button>');
      const aiBox = h('<div id="admin-ai-sentiment-box" style="display:none;margin-bottom:16px;background:linear-gradient(135deg,#f0fdf4 0%,#f0f9ff 100%);border:1.5px solid #0284c7;border-radius:12px;padding:16px 20px"></div>');
      const body = h("<div></div>"); el.append(bar, aiBox, body); let list = [];
      $("#rf", bar).onchange = () => draw();

      $("#btn-admin-ai-sentiment", bar).onclick = async () => {
        const btn = $("#btn-admin-ai-sentiment", bar);
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
          alert("Lỗi khi phân tích: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      };

      function draw() {
        const q = $("input", bar).value.toLowerCase(), f = $("#rf", bar).value;
        const rows = list.filter(r => (!f || (f === "hidden") === !!r.hidden) && (!q || JSON.stringify([r.tourName, r.foodName, r.author, r.name, r.comment, r.content, r.text, r.title, (r.reply && r.reply.content) || ""]).toLowerCase().includes(q)));
        body.innerHTML = table([
          { t: "Mục", html: r => esc(r.tourName || r.foodName || r.tourId || "Chung") },
          { t: "Tác giả", html: r => esc(r.author || r.name || "—") + (r.source === "verified" ? ` <span class="badge ok" style="font-size:0.75rem">Đã đi</span>` : (r.source === "member" ? ` <span class="badge info" style="font-size:0.75rem">Thành viên</span>` : "")) },
          { t: "Sao", num: true, html: r => esc(r.rating) + " ★" },
          {
            t: "Nội dung & Phản hồi",
            html: r => {
              let h = `<div>${esc(r.comment || r.content || r.text || r.title || "")}</div>`;
              if (r.reply && r.reply.content) {
                h += `<div style="margin-top:6px;padding:6px 10px;background:#e0f2fe;border-left:3px solid #0284c7;border-radius:4px;font-size:0.85rem;color:#0369a1">
                  <b>💬 Phản hồi (${esc(r.reply.byName || "Travel")}):</b> ${esc(r.reply.content)}
                </div>`;
              }
              if (r.hidden && r.hiddenInfo) {
                h += `<div class="small" style="color:var(--bad)">Đã ẩn: ${esc(r.hiddenInfo.reason || "")}</div>`;
              }
              return h;
            }
          },
          {
            t: "Thao tác",
            nowrap: true,
            cls: "actions",
            html: r => `
              <div class="act-btns">
                <button class="btn sm primary" data-rep="${esc(r.id)}" title="Trả lời / Phản hồi">${r.reply && r.reply.content ? "✏️ Sửa rep" : "💬 Rep"}</button>
                ${r.reply && r.reply.content ? `<button class="btn sm" data-delrep="${esc(r.id)}" title="Xóa phản hồi">🗑️</button>` : ""}
                ${r.hidden ? `<button class="btn sm" data-s="${esc(r.id)}">Hiện lại</button>` : `<button class="btn bad sm" data-h="${esc(r.id)}">Ẩn</button>`}
              </div>
            `
          }
        ], rows.slice(0, 300), { empty: "Không có đánh giá" });

        $$("[data-rep]", body).forEach(b => b.onclick = async () => {
          const item = list.find(x => x.id === b.dataset.rep);
          const currentRep = (item && item.reply && item.reply.content) || "";
          const v = await ask(
            `Phản hồi bình luận của ${item ? (item.name || item.author || "khách") : ""}`,
            [
              { name: "reply", label: "Nội dung phản hồi (hiển thị công khai dưới bình luận của khách)", type: "textarea", value: currentRep, required: true }
            ],
            { submit: "Gửi phản hồi" }
          );
          if (v && v.reply) {
            act(b, () => post(`/api/content/reviews/${b.dataset.rep}/reply`, { reply: v.reply }), "Đã lưu phản hồi.", load);
          }
        });

        $$("[data-delrep]", body).forEach(b => b.onclick = async () => {
          if (await confirmBox("Xóa phản hồi", "Bạn có chắc muốn xóa câu trả lời cho bình luận này?", "bad")) {
            act(b, () => post(`/api/content/reviews/${b.dataset.delrep}/reply`, { reply: "" }), "Đã xóa phản hồi.", load);
          }
        });

        $$("[data-h]", body).forEach(b => b.onclick = async () => { const v = await ask("Ẩn đánh giá", [{ name: "reason", label: "Lý do ẩn (vi phạm tiêu chuẩn cộng đồng)", type: "textarea", required: true }], { kind: "bad", submit: "Ẩn" }); if (v) act(null, () => post(`/api/content/reviews/${b.dataset.h}/moderate`, { hide: true, reason: v.reason }), "Đã ẩn.", load); });
        $$("[data-s]", body).forEach(b => b.onclick = () => act(b, () => post(`/api/content/reviews/${b.dataset.s}/moderate`, { hide: false }), "Đã hiện lại.", load));
      }
      async function load() { list = (await get("/api/content/reviews")).reviews; draw(); }
      await load();
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
      const bar = Parts.search(() => reload(), "Tìm người làm, mã đơn, nội dung…", '<input id="ap" placeholder="Tiền tố hành động (vd booking.)" style="max-width:240px"><button class="btn sm" id="ac">Xuất CSV</button>');
      const body = h("<div></div>"); el.append(bar, body); let rows = [];
      $("#ap", bar).oninput = () => { clearTimeout(window.__t); window.__t = setTimeout(reload, 300); };
      $("#ac", bar).onclick = () => csv("nhat-ky.csv", ["Lúc", "Người làm", "Vai trò", "Hành động", "Đối tượng", "Chi tiết"], rows.map(e => [e.at, e.actorName, e.role, e.action, e.target, e.detail]));
      async function reload() {
        const r = await get(`/api/admin/audit?q=${encodeURIComponent($("input", bar).value)}&action=${encodeURIComponent($("#ap", bar).value)}&limit=300`); rows = r.entries;
        body.innerHTML = table([{ t: "Lúc", html: e => dt(e.at), sort: e => e.at }, { t: "Người làm", html: e => esc(e.actorName || "hệ thống") + `<div class="small muted">${esc(e.actorId)} · ${esc(e.role)}</div>` }, { t: "Hành động", html: e => `<span class="mono">${esc(e.action)}</span>` }, { t: "Đối tượng", k: "target" }, { t: "Chi tiết", k: "detail" }], rows, { sortable: true, empty: "Không có bản ghi" });
      }
      await reload();
    } },
  ];

  Staff.boot({ roles: ["admin"], title: "Quản trị", sections });
})();
