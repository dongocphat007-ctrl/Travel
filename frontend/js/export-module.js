/**
 * EXPORT MODULE — Task 3.2
 * Xuất file Word (.docx) & PDF cho ứng dụng lịch trình du lịch
 */
const ExportModule = (() => {
  function getTrips() {
    if (window.StorageManager) return StorageManager.load();
    return window.tripsData || [];
  }
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function formatDateRange(start, end) { return `${formatDate(start)} – ${formatDate(end)}`; }
  function countDays(trip) { return trip.days ? trip.days.length : 0; }

  function openExportDialog() {
    const existing = document.getElementById("exportDialog");
    if (existing) existing.remove();
    const trips = getTrips();
    const tripOptions = trips.map(t =>
      `<option value="${t.id}">${t.name} (${formatDateRange(t.startDate, t.endDate)})</option>`
    ).join("");
    const dayOptionsMap = {};
    trips.forEach(t => {
      dayOptionsMap[t.id] = (t.days || []).map((d, i) =>
        `<option value="${i}">${d.label || "Ngày " + (i + 1)} — ${formatDate(d.date)}</option>`
      ).join("");
    });
    const overlay = document.createElement("div");
    overlay.id = "exportDialog";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:'Inter',sans-serif;`;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px 32px;width:460px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25);">
        <h2 style="margin:0 0 6px;font-size:1.2rem;color:#1a1a2e;">📤 Xuất lịch trình</h2>
        <p style="margin:0 0 20px;color:#666;font-size:.875rem;">Chọn nội dung và định dạng file xuất</p>
        <div style="margin-bottom:16px;">
          <label style="font-weight:600;font-size:.9rem;color:#333;display:block;margin-bottom:8px;">Nội dung xuất</label>
          ${[
            ["A","Tổng quan tất cả chuyến đi","Danh sách toàn bộ chuyến, không có chi tiết từng ngày"],
            ["B","Chi tiết từng ngày — Tất cả chuyến","Đầy đủ hoạt động mỗi ngày của mọi chuyến"],
            ["C","Tổng quan một chuyến cụ thể","Thông tin tổng hợp của chuyến được chọn"],
            ["D","Chi tiết từng ngày — Một chuyến","Đầy đủ hoạt động mỗi ngày của chuyến được chọn"],
            ["E","Chi tiết một ngày cụ thể","Chỉ xuất hoạt động của một ngày được chọn"],
          ].map(([v,t,s]) => `
            <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;margin-bottom:8px;cursor:pointer;">
              <input type="radio" name="exportType" value="${v}" style="margin-top:2px;accent-color:#4f46e5;">
              <span><strong>${v} — ${t}</strong><br><small style="color:#888;">${s}</small></span>
            </label>`).join("")}
        </div>
        <div id="tripSelectGroup" style="display:none;margin-bottom:12px;">
          <label style="font-size:.875rem;font-weight:600;color:#333;display:block;margin-bottom:4px;">Chọn chuyến đi</label>
          <select id="tripSelect" style="width:100%;padding:8px 10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:.9rem;">${tripOptions}</select>
        </div>
        <div id="daySelectGroup" style="display:none;margin-bottom:12px;">
          <label style="font-size:.875rem;font-weight:600;color:#333;display:block;margin-bottom:4px;">Chọn ngày</label>
          <select id="daySelect" style="width:100%;padding:8px 10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:.9rem;"></select>
        </div>
        <div style="margin-bottom:24px;">
          <label style="font-weight:600;font-size:.9rem;color:#333;display:block;margin-bottom:8px;">Định dạng file</label>
          <div style="display:flex;gap:12px;">
            <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;">
              <input type="radio" name="exportFormat" value="pdf" checked style="accent-color:#4f46e5;"> <span>📄 PDF</span>
            </label>
            <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;">
              <input type="radio" name="exportFormat" value="docx" style="accent-color:#4f46e5;"> <span>📝 Word (.docx)</span>
            </label>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="btnCancelExport" style="padding:9px 20px;border:1.5px solid #d1d5db;background:#fff;border-radius:8px;cursor:pointer;font-size:.9rem;color:#555;">Huỷ</button>
          <button id="btnConfirmExport" style="padding:9px 22px;background:#4f46e5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;">⬇ Xuất file</button>
        </div>
        <div id="exportStatus" style="margin-top:14px;font-size:.85rem;color:#4f46e5;min-height:20px;text-align:center;"></div>
      </div>`;
    document.body.appendChild(overlay);
    const dayOptionsMapStr = JSON.stringify(dayOptionsMap);
    overlay.querySelectorAll('input[name="exportType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        const type = radio.value;
        document.getElementById("tripSelectGroup").style.display = ["C","D","E"].includes(type) ? "block" : "none";
        document.getElementById("daySelectGroup").style.display  = type === "E" ? "block" : "none";
        if (type === "E") updateDayOptions();
        overlay.querySelectorAll('input[name="exportType"]').forEach(r => {
          r.closest("label").style.borderColor = r.checked ? "#4f46e5" : "#e2e8f0";
          r.closest("label").style.background  = r.checked ? "#f5f3ff" : "#fff";
        });
      });
    });
    overlay.querySelectorAll('input[name="exportFormat"]').forEach(radio => {
      radio.addEventListener("change", () => {
        overlay.querySelectorAll('input[name="exportFormat"]').forEach(r => {
          r.closest("label").style.borderColor = r.checked ? "#4f46e5" : "#e2e8f0";
          r.closest("label").style.background  = r.checked ? "#f5f3ff" : "#fff";
        });
      });
    });
    function updateDayOptions() {
      const tripId = parseInt(document.getElementById("tripSelect").value);
      const dayMap = JSON.parse(dayOptionsMapStr);
      document.getElementById("daySelect").innerHTML = dayMap[tripId] || "<option>Không có ngày</option>";
    }
    document.getElementById("tripSelect").addEventListener("change", updateDayOptions);
    document.getElementById("btnCancelExport").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("btnConfirmExport").addEventListener("click", () => {
      const type   = (overlay.querySelector('input[name="exportType"]:checked') || {}).value;
      const format = (overlay.querySelector('input[name="exportFormat"]:checked') || {}).value;
      if (!type) { document.getElementById("exportStatus").textContent = "⚠ Vui lòng chọn nội dung xuất."; return; }
      const tripId = parseInt((document.getElementById("tripSelect") || {}).value);
      const dayIdx = parseInt((document.getElementById("daySelect")  || {}).value);
      document.getElementById("exportStatus").textContent = "⏳ Đang tạo file…";
      document.getElementById("btnConfirmExport").disabled = true;
      setTimeout(() => {
        try { runExport(type, format, tripId, dayIdx); overlay.remove(); }
        catch(err) { document.getElementById("exportStatus").textContent = "❌ Lỗi: " + err.message; document.getElementById("btnConfirmExport").disabled = false; }
      }, 100);
    });
  }

  function runExport(type, format, tripId, dayIdx) {
    const trips = getTrips();
    let data = {};
    switch (type) {
      case "A": data = { mode: "A", trips }; break;
      case "B": data = { mode: "B", trips }; break;
      case "C": { const trip = trips.find(t => t.id === tripId) || trips[0]; data = { mode: "C", trip }; break; }
      case "D": { const trip = trips.find(t => t.id === tripId) || trips[0]; data = { mode: "D", trip }; break; }
      case "E": { const trip = trips.find(t => t.id === tripId) || trips[0]; const day = (trip.days || [])[dayIdx] || (trip.days || [])[0]; data = { mode: "E", trip, day }; break; }
    }
    if (format === "pdf") exportPDF(data); else exportDOCX(data);
  }

  async function exportPDF(data) {
    try { await LazyLibs.load("jspdf", "pdffont"); }
    catch { showToast("⚠ Không tải được thư viện PDF. Kiểm tra kết nối mạng.", "warning"); return; }
    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const MARGIN = 18, PAGE_W = 210, CONTENT_W = PAGE_W - MARGIN * 2;
    let y = MARGIN;
    // Nhúng font hỗ trợ tiếng Việt (helvetica mặc định không có dấu → lỗi font)
    const FONT = "DejaVu";
    if (window.PDF_FONTS) {
      doc.addFileToVFS("DejaVuSans.ttf", window.PDF_FONTS.normal);
      doc.addFont("DejaVuSans.ttf", FONT, "normal");
      doc.addFileToVFS("DejaVuSans-Bold.ttf", window.PDF_FONTS.bold);
      doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");
      doc.addFileToVFS("DejaVuSans-Oblique.ttf", window.PDF_FONTS.italic);
      doc.addFont("DejaVuSans-Oblique.ttf", FONT, "italic");
    }
    const COLOR_PRIMARY = [0, 0, 0], COLOR_ACCENT = [0, 0, 0], COLOR_DARK = [0, 0, 0];
    const COLOR_GRAY = [60, 60, 60], COLOR_LIGHT_BG = [243, 243, 243], COLOR_LINE = [160, 160, 160];
    function checkNewPage(needed = 10) { if (y + needed > 282) { doc.addPage(); y = MARGIN; drawPageHeader(); } }
    function drawPageHeader() { doc.setFillColor(...COLOR_PRIMARY); doc.rect(0, 0, PAGE_W, 4, "F"); }
    function setFont(style, size, color) { doc.setFontSize(size || 10); doc.setTextColor(...(color || COLOR_DARK)); doc.setFont(FONT, style || "normal"); }
    function drawLine() { doc.setDrawColor(...COLOR_LINE); doc.setLineWidth(0.3); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 3; }
    function writeText(text, x, opts = {}) {
      const { maxWidth, align, lineHeight = 5 } = opts;
      if (maxWidth) { const lines = doc.splitTextToSize(String(text), maxWidth); doc.text(lines, x, y, { align }); y += lines.length * lineHeight; }
      else { doc.text(String(text), x, y, { align }); y += lineHeight; }
    }
    function drawTripCard(trip) {
      checkNewPage(28);
      doc.setFillColor(...COLOR_LIGHT_BG); doc.roundedRect(MARGIN, y, CONTENT_W, 26, 2, 2, "F");
      doc.setFillColor(...COLOR_PRIMARY); doc.roundedRect(MARGIN, y, 4, 26, 1, 1, "F");
      setFont("bold", 12, COLOR_PRIMARY); doc.text(trip.name || "Chuyến đi", MARGIN + 8, y + 8);
      setFont("normal", 9, COLOR_GRAY); doc.text(`Thời gian: ${formatDateRange(trip.startDate, trip.endDate)}`, MARGIN + 8, y + 15);
      doc.text(`Điểm đến: ${trip.destination || ""}`, MARGIN + 8, y + 21);
      setFont("bold", 14, COLOR_ACCENT); doc.text(`${countDays(trip)}`, PAGE_W - MARGIN - 18, y + 12, { align: "center" });
      setFont("normal", 8, COLOR_GRAY); doc.text("ngày", PAGE_W - MARGIN - 18, y + 18, { align: "center" });
      y += 31;
    }
    function drawDayDetail(day, dayIndex) {
      checkNewPage(20);
      doc.setFillColor(...COLOR_ACCENT); doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, "F");
      setFont("bold", 10, [255, 255, 255]);
      doc.text(`${day.label || "Ngày " + (dayIndex + 1)}  —  ${formatDate(day.date)}`, MARGIN + 4, y + 6);
      y += 12;
      const items = day.locations || day.activities || [];
      if (items.length === 0) { setFont("italic", 9, COLOR_GRAY); writeText("Chưa có hoạt động.", MARGIN + 4, { lineHeight: 6 }); return; }
      items.forEach((act) => {
        checkNewPage(16);
        doc.setFillColor(...COLOR_PRIMARY); doc.circle(MARGIN + 4, y + 1, 1.2, "F");
        const nameLbl = act.name || act.title || "";
        const costLbl = act.estimatedCost ? `  ~${Number(act.estimatedCost).toLocaleString("vi-VN")} ₫` : "";
        const noteLbl = act.note || act.notes || "";
        setFont("bold", 10, COLOR_DARK); doc.text(nameLbl + costLbl, MARGIN + 8, y + 3);
        y += 7;
        if (noteLbl) { setFont("normal", 8.5, COLOR_GRAY); writeText(noteLbl, MARGIN + 8, { maxWidth: CONTENT_W - 12, lineHeight: 4.5 }); }
        y += 3;
      });
      y += 3;
    }
    drawPageHeader();
    doc.setFillColor(...COLOR_PRIMARY); doc.rect(0, 4, PAGE_W, 38, "F");
    setFont("bold", 20, [255, 255, 255]); doc.text("Lịch Trình Du Lịch", PAGE_W / 2, 22, { align: "center" });
    setFont("normal", 9, [230, 230, 230]);
    const subtitle = { A:"Tổng quan tất cả chuyến đi", B:"Chi tiết từng ngày — Tất cả chuyến", C:`Tổng quan: ${data.trip?.name||""}`, D:`Chi tiết: ${data.trip?.name||""}`, E:`Chi tiết: ${data.day?.label||""} — ${data.trip?.name||""}` }[data.mode];
    doc.text(subtitle, PAGE_W / 2, 32, { align: "center" });
    setFont("normal", 8, [200, 200, 200]); doc.text(`Xuất ngày ${new Date().toLocaleDateString("vi-VN")}`, PAGE_W / 2, 39, { align: "center" });
    y = 52;
    switch (data.mode) {
      case "A": setFont("bold", 13, COLOR_PRIMARY); writeText("Danh sách chuyến đi", MARGIN, { lineHeight: 8 }); drawLine(); (data.trips || []).forEach(t => drawTripCard(t)); break;
      case "B": (data.trips || []).forEach((trip, ti) => { if (ti > 0) { doc.addPage(); y = MARGIN; drawPageHeader(); } setFont("bold", 14, COLOR_PRIMARY); writeText(trip.name, MARGIN, { lineHeight: 8 }); setFont("normal", 9, COLOR_GRAY); writeText(`${formatDateRange(trip.startDate, trip.endDate)}  •  ${trip.destination || ""}`, MARGIN, { lineHeight: 6 }); drawLine(); y += 2; (trip.days || []).forEach((day, di) => drawDayDetail(day, di)); }); break;
      case "C": drawTripCard(data.trip); drawLine(); setFont("bold", 11, COLOR_DARK); writeText("Các ngày trong chuyến:", MARGIN, { lineHeight: 7 }); (data.trip.days || []).forEach((day, i) => { checkNewPage(12); setFont("bold", 10, COLOR_ACCENT); doc.text(`${day.label || "Ngày "+(i+1)}`, MARGIN + 4, y + 3); setFont("normal", 9, COLOR_GRAY); doc.text(`${formatDate(day.date)}`, MARGIN + 40, y + 3); y += 7; }); break;
      case "D": setFont("bold", 14, COLOR_PRIMARY); writeText(data.trip.name, MARGIN, { lineHeight: 8 }); drawLine(); y += 2; (data.trip.days || []).forEach((day, di) => drawDayDetail(day, di)); break;
      case "E": setFont("bold", 11, COLOR_GRAY); writeText(data.trip.name, MARGIN, { lineHeight: 6 }); y += 2; drawDayDetail(data.day, 0); break;
    }
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p); doc.setFillColor(...COLOR_PRIMARY); doc.rect(0, 291, PAGE_W, 6, "F");
      setFont("normal", 7, [230, 230, 230]); doc.text(`Trang ${p} / ${pageCount}`, PAGE_W / 2, 295.5, { align: "center" });
    }
    const today = new Date().toISOString().slice(0, 10);
    doc.save(`LichTrinh_${data.mode}_${today}.pdf`);
  }

  async function exportDOCX(data) {
    try { await LazyLibs.load("docx"); }
    catch { showToast("⚠ Không tải được thư viện Word. Kiểm tra kết nối mạng.", "warning"); return; }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType, PageBreak } = window.docx;
    const INDIGO = "000000", INDIGO_LT = "EEEEEE", GRAY = "444444";
    const h1 = text => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 }, shading: { type: ShadingType.CLEAR, fill: INDIGO_LT }, indent: { left: 240 } });
    const h2 = text => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } });
    const para = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text: String(text || ""), ...opts })], spacing: { after: 60 } });
    const label = (key, value) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: key + ": ", bold: true, color: INDIGO }), new TextRun({ text: String(value || "—"), color: "000000" })] });
    const separator = () => new Paragraph({ spacing: { before: 80, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } } });
    const tripHeader = trip => [h1(trip.name || "Chuyến đi"), label("Điểm đến", trip.destination), label("Thời gian", formatDateRange(trip.startDate, trip.endDate)), label("Số ngày", countDays(trip) + " ngày"), separator()];
    const activityRow = act => new Paragraph({ spacing: { after: 60 }, indent: { left: 720 }, children: [new TextRun({ text: (act.name || act.title || ""), bold: true, color: INDIGO }), ...((act.estimatedCost) ? [new TextRun({ text: `  ~${Number(act.estimatedCost).toLocaleString("vi-VN")} ₫`, color: GRAY })] : []), ...((act.note || act.notes) ? [new TextRun({ text: "\n" + (act.note || act.notes), color: GRAY, break: 1 })] : [])] });
    const dayBlock = (day, index) => { const acts = day.locations || day.activities || []; return [h2(`${day.label || "Ngày " + (index + 1)} — ${formatDate(day.date)}`), ...(acts.length ? acts.map(activityRow) : [para("Chưa có hoạt động.", { italics: true, color: GRAY })])]; };
    const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
    let children = [
      new Paragraph({ children: [new TextRun({ text: "Lịch Trình Du Lịch", bold: true, size: 36, color: INDIGO })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: `Xuất ngày ${new Date().toLocaleDateString("vi-VN")}`, size: 18, color: GRAY, italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    ];
    switch (data.mode) {
      case "A": (data.trips || []).forEach((trip, i) => { if (i > 0) children.push(separator()); children.push(...tripHeader(trip)); }); break;
      case "B": (data.trips || []).forEach((trip, ti) => { if (ti > 0) children.push(pageBreak()); children.push(...tripHeader(trip)); (trip.days || []).forEach((day, di) => children.push(...dayBlock(day, di))); }); break;
      case "C": children.push(...tripHeader(data.trip)); break;
      case "D": children.push(...tripHeader(data.trip)); (data.trip.days || []).forEach((day, di) => children.push(...dayBlock(day, di))); break;
      case "E": children.push(label("Chuyến đi", data.trip.name), label("Điểm đến", data.trip.destination), separator(), ...dayBlock(data.day, 0)); break;
    }
    const document = new Document({ styles: { default: { document: { run: { font: "Arial", color: "000000" } } }, paragraphStyles: [ { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 30, bold: true, color: "000000" } }, { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { font: "Arial", size: 26, bold: true, color: "000000" } } ] }, sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }] });
    Packer.toBlob(document).then(blob => {
      const link = window.document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      link.download = `LichTrinh_${data.mode}_${today}.docx`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  function showToast(msg, type = "info") {
    if (typeof window.showToast === "function") window.showToast(msg, type === "warning" ? "warn" : type);
    else alert(msg);
  }

  return { openExportDialog };
})();
window.openExportDialog = ExportModule.openExportDialog;
