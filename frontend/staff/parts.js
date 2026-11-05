/* Thành phần dùng chung cho các trang vai trò: chi tiết đơn, lịch sử, tìm kiếm. Chỉ hiển thị phần dữ liệu server đã cắt theo vai trò. */
const Parts = (() => {
  const { esc, money, dt, day, badge, h } = Staff;
  const SRC = { cashier: "Thu ngân", bank: "Ngân hàng", legacy: "Dữ liệu cũ", manual: "Xác nhận tay" };
  const KIND = { deposit: "Cọc", full: "Thanh toán đủ", final: "Thu nốt", refund: "Hoàn tiền" };
  const ACT = { create: "Tạo đơn", status: "Đổi trạng thái", payment: "Thanh toán", assign: "Gán HDV", undo: "Hoàn tác", refund: "Hoàn tiền", checkin: "Điểm danh", reschedule: "Đổi ngày", report: "Báo cáo tour", guide_fee: "Chi thù lao HDV", no_show: "Vắng toàn đoàn" };

  function history(b) {
    const hs = b.history || [];
    if (!hs.length) return "";
    return `<h3>Lịch sử đơn</h3><ul class="timeline">${hs.slice().reverse().map(x => `<li><b>${esc(ACT[x.action] || x.action)}</b>${x.from !== x.to && x.to ? ` · ${badge(x.from)} → ${badge(x.to)}` : ""}<br><span class="small muted">${dt(x.at)} · ${esc(x.byName || x.byId || "Hệ thống")} (${esc(x.role || "")})${x.note ? " · " + esc(x.note) : ""}</span></li>`).join("")}</ul>`;
  }
  function payments(b, opts) {
    const ps = b.payments || [];
    if (!ps.length) return "";
    return `<h3>Sổ thanh toán</h3><div class="tbl-wrap"><table><thead><tr><th>Loại</th><th class="num">Số tiền</th><th>Lúc</th><th>Người ghi</th><th>Ghi chú</th>${opts && opts.undo ? "<th></th>" : ""}</tr></thead><tbody>${ps.map(p => `<tr style="${p.undone ? "opacity:.5;text-decoration:line-through" : ""}"><td>${esc(KIND[p.kind] || p.kind)}</td><td class="num">${money(p.amount)}</td><td>${dt(p.at)}</td><td>${esc(p.byName || SRC[p.source] || p.source)}</td><td>${esc(p.note || "")}${p.undone ? ` <span class="small">(đã hoàn tác: ${esc(p.undoReason || "")})</span>` : ""}</td>${opts && opts.undo ? `<td>${!p.undone && p.kind !== "refund" && p.source !== "bank" && opts.undo(p) ? `<button class="btn sm" data-undo="${esc(p.id)}">Hoàn tác</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }
  function passengers(b) {
    const ps = b.passengers || [];
    if (!ps.length) return "";
    const G = { male: "Nam", female: "Nữ", other: "Khác" };
    return `<h3>Hành khách (${ps.length})</h3><div class="tbl-wrap"><table><thead><tr><th>Họ tên</th><th>Ngày sinh</th><th>Giới tính</th><th>CCCD / Hộ chiếu</th><th>Điểm danh</th></tr></thead><tbody>${ps.map(p => `<tr><td>${esc(p.name)}</td><td>${day(p.dob)}</td><td>${esc(G[p.gender] || "")}</td><td class="mono">${esc(p.idNumber || "")}</td><td>${p.checkin === "present" ? '<span class="badge ok">Có mặt</span>' : p.checkin === "late" ? '<span class="badge warn">Đến trễ</span>' : p.checkin === "absent" ? '<span class="badge bad">Vắng</span>' : "—"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  /** Thẻ chi tiết đơn: chỉ in ra trường có trong dữ liệu (server đã cắt theo vai trò). */
  function order(b, opts) {
    opts = opts || {};
    const kv = [];
    const add = (k, v) => { if (v !== undefined && v !== null && v !== "") kv.push(`<dt>${k}</dt><dd>${v}</dd>`); };
    add("Mã đơn", `<b class="mono">${esc(b.payCode || b.id)}</b> ${badge(b.status, b.statusLabel)}`);
    add("Tour", esc(b.tourName)); add("Ngày đi", day(b.date) + (b.extraDays ? ` (+${b.extraDays} ngày gia hạn)` : ""));
    add("Số khách", b.pax !== undefined ? `${esc(b.pax)} (NL ${esc(b.adults || 0)}, TE ${esc(b.children || 0)}, EB ${esc(b.infants || 0)})` : "");
    add("Khách đặt", esc(b.customerName)); add("Điện thoại", esc(b.phone)); add("Email", esc(b.email));
    if (b.price !== undefined) { add("Tổng tiền", money(b.price)); add("Đã nhận", money(b.paidAmount)); add("Còn lại", money(b.remaining)); if (b.balanceDueDate) add("Hạn thu nốt", day(b.balanceDueDate) + (b.balanceOverdue ? ' <span class="badge bad">quá hạn</span>' : "")); }
    add("Hướng dẫn viên", esc(b.guideName)); add("Điểm đón", esc(b.pickup)); add("Yêu cầu đặc biệt", esc(b.specialRequest)); add("Ghi chú", esc(b.note));
    if (b.assignment && b.assignment.deadline && b.status === "guide_pending") add("Hạn HDV trả lời", dt(b.assignment.deadline));
    if (b.assignment && (b.assignment.rejected || []).length) add("HDV từ chối", b.assignment.rejected.map(r => esc(r.reason)).join("; "));
    if (b.needsAttention) add("Cần xử lý", '<span class="badge warn">Chuyển khoản lệch</span>');

    const expBar = `<div class="toolbar" style="margin-bottom:14px;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
      <span class="small muted" style="margin-right:auto;font-weight:600;">Xuất hóa đơn / chứng từ:</span>
      <button type="button" class="btn sm" data-exp-pdf="${esc(b.id)}">🖨️ In / Tải PDF</button>
      <button type="button" class="btn sm" data-exp-word="${esc(b.id)}">📝 Xuất Word (.doc)</button>
      <button type="button" class="btn sm" data-exp-excel="${esc(b.id)}">📊 Xuất Excel (.xls)</button>
    </div>`;

    const rp = b.tourReport ? `<h3>Báo cáo tour của HDV</h3><dl class="kv"><dt>Điểm danh</dt><dd>Có mặt ${esc(b.tourReport.present)}/${esc(b.tourReport.total)}${b.tourReport.late ? ` (đến trễ ${esc(b.tourReport.late)})` : ""}, vắng ${esc(b.tourReport.absent)}, sự cố ${esc(b.tourReport.incidentCount)}</dd><dt>Ghi chú</dt><dd>${b.tourReport.note ? esc(b.tourReport.note).replace(/\n/g, "<br>") : '<span class="muted">Không có</span>'}</dd><dt>Nộp lúc</dt><dd>${dt(b.tourReport.updatedAt)} · ${esc(b.tourReport.byName || "")}</dd></dl>` : "";
    return `${expBar}<dl class="kv">${kv.join("")}</dl>${rp}${passengers(b)}${payments(b, opts)}${history(b)}`;
  }
  async function showOrder(fetchUrl, title, opts) {
    const r = await Staff.get(fetchUrl); const b = r.booking;
    return Staff.modal(title || "Chi tiết đơn", order(b, opts), [{ label: "Đóng" }], {
      wide: true,
      onOpen: (ov, close) => {
        const expPdf = ov.querySelector(`[data-exp-pdf]`);
        if (expPdf) expPdf.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(b, "pdf");
        const expWord = ov.querySelector(`[data-exp-word]`);
        if (expWord) expWord.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(b, "word");
        const expExcel = ov.querySelector(`[data-exp-excel]`);
        if (expExcel) expExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportBookingInvoice(b, "excel");
        if (opts && opts.onOpen) opts.onOpen(ov, close);
      }
    });
  }
  function search(onChange, placeholder, extra) {
    const el = h(`<div class="toolbar"><input type="search" placeholder="${esc(placeholder || "Tìm mã đơn, tên khách…")}" aria-label="Tìm kiếm">${extra || ""}</div>`);
    let t; Staff.$("input", el).addEventListener("input", () => { clearTimeout(t); t = setTimeout(onChange, 250); });
    return el;
  }
  return { order, history, payments, passengers, showOrder, search, SRC, KIND };
})();
window.Parts = Parts;
