/**
 * IMPORT MODULE — Task 3.3
 * Nhập từ file Word (.docx) / PDF → tự động điền form tạo chuyến đi
 *
 *
 * THƯ VIỆN CẦN THÊM VÀO <head> của HTML chính:
 *
 *   <!-- PDF.js (Mozilla) — đọc PDF trong browser -->
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
 *
 *   <!-- Mammoth.js — đọc .docx trong browser -->
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
 *
 * CÁCH TÍCH HỢP:
 *   1. Copy file này vào project và thêm:
 *      <script src="import-module.js"></script>
 *   2. Gắn nút import:
 *      <button onclick="ImportModule.openImportDialog()">📂 Nhập file</button>
 *   3. Implement callback khi parse xong (xem cuối file):
 *      ImportModule.onImportSuccess = (tripData) => { /* điền vào form của bạn *\/ };
 *
 * FIELDS ĐƯỢC PARSE TỰ ĐỘNG:
 *   - name          (tên chuyến đi) — bắt buộc
 *   - destination   (điểm đến) — bắt buộc
 *   - startDate     (ngày bắt đầu YYYY-MM-DD) — bắt buộc
 *   - endDate       (ngày kết thúc YYYY-MM-DD) — bắt buộc
 *   - budget        (ngân sách, số) — bắt buộc
 *   - currency      (VND/USD/EUR...) — tuỳ chọn
 *   - notes         (ghi chú chung) — tuỳ chọn
 *   - days[]        (mảng ngày với activities[]) — tuỳ chọn
 */

const ImportModule = (() => {

  // Cấu hình
  const REQUIRED_FIELDS = [
    { key: "name",        label: "Tên chuyến đi" },
    { key: "destination", label: "Điểm đến" },
    { key: "startDate",   label: "Ngày bắt đầu" },
    { key: "endDate",     label: "Ngày kết thúc" },
    { key: "budget",      label: "Ngân sách" },
  ];

  const OPTIONAL_FIELDS = ["currency", "notes", "days"];

  // Callback để app chính nhận dữ liệu sau khi parse
  // Override từ bên ngoài: ImportModule.onImportSuccess = (data) => { ... }
  let onImportSuccess = (data) => {
    console.log("[ImportModule] Trip data parsed:", data);
    alert("Import thành công!\n" + JSON.stringify(data, null, 2));
  };

  //  PHẦN 1 — DIALOG CHỌN FILE

  function openImportDialog() {
    const existing = document.getElementById("importDialog");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "importDialog";
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; font-family:'Segoe UI',Arial,sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background:#fff; border-radius:14px; padding:30px 32px;
        width:480px; max-width:95vw; max-height:90vh; overflow-y:auto;
        box-shadow:0 8px 40px rgba(0,0,0,0.22);
      ">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <h2 style="margin:0;font-size:1.15rem;color:#1a1a2e;">📂 Nhập lịch trình từ file</h2>
          <button id="btnCloseImport" style="border:none;background:none;cursor:pointer;font-size:1.3rem;color:#9ca3af;line-height:1;">×</button>
        </div>
        <p style="margin:0 0 20px;color:#6b7280;font-size:.85rem;">
          Hỗ trợ file <strong>.xlsx</strong> (Excel), <strong>.docx</strong> (Word) và <strong>.pdf</strong>.<br>
          Hệ thống sẽ tự động đọc nội dung và điền vào form tạo chuyến đi.
        </p>

        <!-- Drop zone -->
        <div id="importDropZone" style="
          border:2px dashed #c7d2fe; border-radius:10px; padding:36px 20px;
          text-align:center; cursor:pointer; transition:all .2s; background:#f5f3ff;
          margin-bottom:16px;
        ">
          <div style="font-size:2.5rem;margin-bottom:8px;">📄</div>
          <div style="font-weight:600;color:#4f46e5;margin-bottom:4px;">Kéo thả file vào đây</div>
          <div style="color:#9ca3af;font-size:.85rem;">hoặc</div>
          <button id="btnBrowseFile" style="
            margin-top:10px; padding:8px 20px; background:#4f46e5; color:#fff;
            border:none; border-radius:8px; cursor:pointer; font-size:.875rem; font-weight:600;
          ">Chọn file từ máy tính</button>
          <input type="file" id="importFileInput" accept=".pdf,.docx,.xlsx,.xls"
            style="display:none;">
          <div style="color:#9ca3af;font-size:.8rem;margin-top:10px;">XLSX, DOCX, PDF • Tối đa 20MB</div>
        </div>

        <!-- File info -->
        <div id="importFileInfo" style="display:none; padding:12px 14px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; margin-bottom:16px; font-size:.875rem; color:#166534; display:none; align-items:center; gap:10px;">
          <span style="font-size:1.3rem;" id="importFileIcon">📄</span>
          <div>
            <div id="importFileName" style="font-weight:600;"></div>
            <div id="importFileSize" style="color:#4ade80; font-size:.8rem;"></div>
          </div>
        </div>

        <!-- Progress -->
        <div id="importProgress" style="display:none; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:.85rem;">
            <span id="importProgressLabel" style="color:#4f46e5; font-weight:600;">Đang xử lý…</span>
            <span id="importProgressPct" style="color:#9ca3af;">0%</span>
          </div>
          <div style="height:6px; background:#e0e7ff; border-radius:3px; overflow:hidden;">
            <div id="importProgressBar" style="height:100%; background:#4f46e5; border-radius:3px; transition:width .3s; width:0%;"></div>
          </div>
          <div id="importProgressStep" style="color:#9ca3af; font-size:.8rem; margin-top:4px;"></div>
        </div>

        <!-- Lỗi / validation -->
        <div id="importErrors" style="display:none;"></div>

        <!-- Preview kết quả -->
        <div id="importPreview" style="display:none;"></div>

        <!-- Actions -->
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:4px;">
          <button id="btnCancelImport" style="
            padding:9px 20px; border:1.5px solid #d1d5db; background:#fff;
            border-radius:8px; cursor:pointer; font-size:.875rem; color:#555;
          ">Huỷ</button>
          <button id="btnConfirmImport" disabled style="
            padding:9px 22px; background:#d1d5db; color:#9ca3af; border:none;
            border-radius:8px; cursor:not-allowed; font-size:.875rem; font-weight:600;
          ">✓ Điền vào form</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    bindDialogEvents(overlay);
  }

  //  PHẦN 2 — SỰ KIỆN DIALOG

  let parsedTripData = null;

  function bindDialogEvents(overlay) {
    // Đóng
    overlay.querySelector("#btnCloseImport").onclick  = () => overlay.remove();
    overlay.querySelector("#btnCancelImport").onclick = () => overlay.remove();
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    // Browse
    const fileInput = overlay.querySelector("#importFileInput");
    overlay.querySelector("#btnBrowseFile").onclick = () => fileInput.click();
    fileInput.onchange = e => handleFile(e.target.files[0], overlay);

    // Drag & drop
    const dropZone = overlay.querySelector("#importDropZone");
    dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.style.borderColor = "#4f46e5"; dropZone.style.background = "#eef2ff"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "#c7d2fe"; dropZone.style.background = "#f5f3ff"; });
    dropZone.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.style.borderColor = "#c7d2fe";
      dropZone.style.background = "#f5f3ff";
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file, overlay);
    });

    // Confirm
    overlay.querySelector("#btnConfirmImport").onclick = () => {
      if (!parsedTripData) return;
      overlay.remove();
      onImportSuccess(parsedTripData);
      showFormValidation(parsedTripData);
    };
  }

  //  PHẦN 3 — XỬ LÝ FILE

  async function handleFile(file, overlay) {
    if (!file) return;

    // Validate loại file
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "xlsx", "xls"].includes(ext)) {
      showError(overlay, [{ field: null, message: "Chỉ hỗ trợ file .xlsx, .docx hoặc .pdf." }]);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showError(overlay, [{ field: null, message: "File quá lớn. Vui lòng chọn file dưới 20MB." }]);
      return;
    }

    // Hiển thị thông tin file
    showFileInfo(overlay, file, ext);
    showProgress(overlay, true);
    parsedTripData = null;
    enableConfirmBtn(overlay, false);
    hidePreview(overlay);
    hideErrors(overlay);

    try {
      // Bước 1: Đọc text từ file
      updateProgress(overlay, 20, "Đọc nội dung file…", "Bước 1/3");
      let rawText = "";
      if (ext === "pdf") {
        rawText = await extractTextFromPDF(file, overlay);
      } else if (ext === "docx") {
        rawText = await extractTextFromDOCX(file);
      } else {
        rawText = await extractTextFromXLSX(file);
      }

      if (!rawText || rawText.trim().length < 10) {
        throw new Error("Không đọc được nội dung từ file. Vui lòng kiểm tra file có chứa text không.");
      }

      // Bước 2: Gửi Gemini API để parse
      updateProgress(overlay, 55, "Phân tích nội dung…", "Bước 2/3");
      let tripData = parseLocally(rawText);
      // Nếu file không theo mẫu → thử nhờ AI (cần API), lỗi thì dùng kết quả cục bộ
      if (!tripData.name && !tripData.startDate) {
        try { tripData = await parseWithAI(rawText); } catch (e) { console.warn("[ImportModule] AI parse failed:", e.message); }
      }

      // Bước 3: Validate fields
      updateProgress(overlay, 85, "Kiểm tra thông tin…", "Bước 3/3");
      const { missing, filled } = validateTripData(tripData);

      parsedTripData = tripData;

      updateProgress(overlay, 100, "Hoàn thành!", "");
      setTimeout(() => {
        showProgress(overlay, false);
        showPreview(overlay, tripData, missing);
        if (missing.length === 0) {
          enableConfirmBtn(overlay, true);
        } else {
          // Vẫn cho phép confirm nhưng highlight lỗi
          enableConfirmBtn(overlay, true, `Điền vào form (${missing.length} trường thiếu)`);
        }
      }, 500);

    } catch (err) {
      console.error("[ImportModule]", err);
      showProgress(overlay, false);
      showError(overlay, [{ field: null, message: err.message }]);
    }
  }

  //  PHẦN 4 — EXTRACT TEXT

  async function extractTextFromPDF(file, overlay) {
    await LazyLibs.load("pdfjs");

    // Set worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfDoc.numPages;

    let fullText = "";
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      // Gom chữ theo dòng (cùng toạ độ y) để giữ cấu trúc từng dòng
      let lastY = null, line = "";
      content.items.forEach(item => {
        const yy = item.transform ? Math.round(item.transform[5]) : 0;
        if (lastY !== null && Math.abs(yy - lastY) > 2) { fullText += line.trim() + "\n"; line = ""; }
        line += item.str; lastY = yy;
      });
      fullText += line.trim() + "\n";
      updateProgress(overlay, 10 + Math.round((i / numPages) * 40),
        `Đọc trang ${i}/${numPages}…`, "Bước 1/3");
    }
    return fullText;
  }

  async function extractTextFromDOCX(file) {
    await LazyLibs.load("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  async function extractTextFromXLSX(file) {
    await LazyLibs.load("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const KEYS = /^(tên chuyến đi|tên|điểm đến|ngày bắt đầu|ngày khởi hành|ngày kết thúc|ngân sách|tiền tệ|ghi chú)$/i;
    let out = "";
    wb.SheetNames.forEach(name => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" })
        .map(r => r.map(c => String(c).trim()));
      const hi = rows.findIndex(r => r.some(c => /^hoạt động$/i.test(c)));
      if (hi >= 0) {
        // Bảng lịch trình: Ngày | Ngày tháng | Giờ | Hoạt động | Ghi chú
        const h = rows[hi].map(c => c.toLowerCase());
        const col = (re) => h.findIndex(c => re.test(c));
        const cDay = col(/^ngày$|^ngày thứ/), cDate = col(/ngày tháng|^date/), cTime = col(/^giờ|^time/),
              cAct = col(/hoạt động/), cNote = col(/ghi chú/);
        let lastDay = "";
        rows.slice(hi + 1).forEach(r => {
          if (!r[cAct]) return;
          const key = (r[cDay] || "") + "|" + (r[cDate] || "");
          if (key !== lastDay) { out += `Ngày ${r[cDay] || ""} - ${r[cDate] || ""}\n`; lastDay = key; }
          out += `${r[cTime] || ""} - ${r[cAct]}${r[cNote] ? " | " + r[cNote] : ""}\n`;
        });
      } else {
        rows.forEach(r => { if (r[0] && KEYS.test(r[0].replace(/[:：]$/, "")) && r[1]) out += `${r[0].replace(/[:：]$/, "")}: ${r[1]}\n`; });
      }
    });
    return out;
  }

  // Phân tích cục bộ theo mẫu "Tên trường: giá trị" + "Ngày N - dd/mm/yyyy" + "HH:MM - Hoạt động | ghi chú"
  function toISODate(str) {
    if (!str) return null;
    const t = String(str).trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return null;
  }

  function parseLocally(text) {
    const data = { name: null, destination: null, startDate: null, endDate: null, budget: null, currency: "VND", notes: null, days: [] };
    const MAP = { "tên chuyến đi": "name", "tên": "name", "điểm đến": "destination", "ngày bắt đầu": "startDate",
      "ngày khởi hành": "startDate", "ngày kết thúc": "endDate", "ngân sách": "budget", "tiền tệ": "currency", "ghi chú": "notes" };
    let day = null;
    text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
      let m = line.match(/^(tên chuyến đi|tên|điểm đến|ngày bắt đầu|ngày khởi hành|ngày kết thúc|ngân sách|tiền tệ|ghi chú)\s*[:：]\s*(.+)$/i);
      if (m) {
        const key = MAP[m[1].toLowerCase()], val = m[2].trim();
        if (key === "startDate" || key === "endDate") data[key] = toISODate(val);
        else if (key === "budget") {
          const n = Number(val.replace(/[^\d]/g, ""));
          data.budget = n || null;
          if (/usd|\$/i.test(val)) data.currency = "USD"; else if (/eur|€/i.test(val)) data.currency = "EUR";
        } else data[key] = val;
        return;
      }
      m = line.match(/^ngày\s*(\d+)\s*(?:[-–:|]\s*(\S+))?/i);
      if (m) { day = { label: `Ngày ${m[1]}`, date: toISODate(m[2]), activities: [] }; data.days.push(day); return; }
      m = line.match(/^(\d{1,2})\s*[:h]\s*(\d{2})\s*[-–|]\s*(.+)$/i);
      if (m && day) {
        const [title, ...rest] = m[3].split("|");
        day.activities.push({ time: `${m[1].padStart(2, "0")}:${m[2]}`, title: title.trim(), note: rest.join("|").trim() });
      }
    });
    return data;
  }

  //  PHẦN 5 — PARSE VỚI CLAUDE API

  async function parseWithAI(rawText) {
    const systemPrompt = `Bạn là trợ lý trích xuất thông tin lịch trình du lịch từ văn bản.
Luôn trả về JSON hợp lệ, KHÔNG có markdown, KHÔNG có preamble.
Chỉ trả về object JSON theo đúng schema được yêu cầu.`;

    const userPrompt = `Phân tích đoạn văn bản sau và trích xuất thông tin lịch trình du lịch.

VĂN BẢN:
"""
${rawText.slice(0, 6000)}
"""

Trả về JSON với schema sau (null nếu không tìm thấy):
{
  "name": "string — tên chuyến đi (ví dụ: Du lịch Đà Lạt, Hành trình Hà Nội)",
  "destination": "string — điểm đến chính",
  "startDate": "string — YYYY-MM-DD, ngày bắt đầu",
  "endDate": "string — YYYY-MM-DD, ngày kết thúc",
  "budget": number_or_null,
  "currency": "VND | USD | EUR | ... (mặc định VND nếu không rõ)",
  "notes": "string — ghi chú chung, mô tả chuyến đi",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "label": "Ngày 1",
      "activities": [
        {
          "time": "HH:MM",
          "title": "Tên hoạt động",
          "note": "Ghi chú thêm"
        }
      ]
    }
  ]
}

QUY TẮC:
- Nếu thấy "ngày 1", "day 1" → tạo entry trong days[]
- Nếu thấy giờ như "8:00", "08h00", "8 giờ sáng" → parse thành HH:MM
- Ngân sách: chỉ lấy số, bỏ đơn vị tiền tệ (VND, đồng, USD)
- Ngày tháng: chuyển về YYYY-MM-DD dù ở dạng dd/mm/yyyy hay dd-mm-yyyy hay "20 tháng 12 2024"
- Nếu không có thông tin → để null, ĐỪNG bịa
- days[] có thể là mảng rỗng [] nếu không tìm thấy`;

    let cleaned;
    try {
      cleaned = await GeminiAI.generate(userPrompt, { system: systemPrompt, maxTokens: 4000, temperature: 0.2, json: true });
    } catch (e) {
      throw new Error(`Gemini API lỗi: ${e.message}`);
    }
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("[ImportModule] JSON parse error:", cleaned);
      throw new Error("AI trả về dữ liệu không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.");
    }
  }

  //  PHẦN 6 — VALIDATE

  function validateTripData(tripData) {
    const missing = [];
    const filled  = [];

    REQUIRED_FIELDS.forEach(({ key, label }) => {
      const val = tripData[key];
      const isEmpty = val === null || val === undefined || String(val).trim() === "";
      if (isEmpty) {
        missing.push({ key, label });
      } else {
        filled.push({ key, label, value: val });
      }
    });

    // Validate ngày hợp lệ
    if (tripData.startDate && tripData.endDate) {
      const s = new Date(tripData.startDate);
      const e = new Date(tripData.endDate);
      if (!isNaN(s) && !isNaN(e) && s > e) {
        missing.push({ key: "endDate", label: "Ngày kết thúc", extra: "phải sau ngày bắt đầu" });
      }
    }

    return { missing, filled };
  }

  //  PHẦN 7 — UI HELPERS

  function showFileInfo(overlay, file, ext) {
    const el = overlay.querySelector("#importFileInfo");
    overlay.querySelector("#importFileName").textContent = file.name;
    overlay.querySelector("#importFileSize").textContent = formatBytes(file.size);
    overlay.querySelector("#importFileIcon").textContent = ext === "pdf" ? "📕" : (ext === "docx" ? "📘" : "📗");
    el.style.display = "flex";
  }

  function showProgress(overlay, show) {
    overlay.querySelector("#importProgress").style.display = show ? "block" : "none";
  }

  function updateProgress(overlay, pct, label, step) {
    overlay.querySelector("#importProgressBar").style.width   = pct + "%";
    overlay.querySelector("#importProgressPct").textContent   = pct + "%";
    overlay.querySelector("#importProgressLabel").textContent = label;
    overlay.querySelector("#importProgressStep").textContent  = step;
  }

  function enableConfirmBtn(overlay, enable, label = "✓ Điền vào form") {
    const btn = overlay.querySelector("#btnConfirmImport");
    btn.disabled = !enable;
    btn.textContent = label;
    btn.style.background = enable ? "#4f46e5" : "#d1d5db";
    btn.style.color      = enable ? "#fff"    : "#9ca3af";
    btn.style.cursor     = enable ? "pointer" : "not-allowed";
  }

  function showError(overlay, errors) {
    const el = overlay.querySelector("#importErrors");
    el.style.display = "block";
    el.innerHTML = errors.map(e => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 12px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;margin-bottom:8px;font-size:.875rem;color:#991b1b;">
        <span>⚠</span>
        <span>${e.message}</span>
      </div>
    `).join("");
  }

  function hideErrors(overlay) {
    overlay.querySelector("#importErrors").style.display = "none";
    overlay.querySelector("#importErrors").innerHTML = "";
  }

  function hidePreview(overlay) {
    overlay.querySelector("#importPreview").style.display = "none";
    overlay.querySelector("#importPreview").innerHTML = "";
  }

  function showPreview(overlay, tripData, missing) {
    const el = overlay.querySelector("#importPreview");
    el.style.display = "block";

    const missingHTML = missing.length === 0 ? "" : `
      <div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:8px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-weight:600;color:#9a3412;margin-bottom:8px;font-size:.875rem;">⚠ Thiếu thông tin bắt buộc:</div>
        ${missing.map(m => `
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:.85rem;color:#c2410c;">
            <span>•</span>
            <span>Thiếu <strong>${m.label}</strong>${m.extra ? " (" + m.extra + ")" : ""} — vui lòng bổ sung sau khi import</span>
          </div>
        `).join("")}
      </div>
    `;

    const fieldRow = (icon, label, value) => value
      ? `<div style="display:flex;gap:8px;padding:5px 0;font-size:.85rem;border-bottom:1px solid #f1f5f9;">
           <span style="color:#9ca3af;width:18px;">${icon}</span>
           <span style="color:#6b7280;min-width:80px;">${label}</span>
           <span style="color:#1f2937;font-weight:500;flex:1;">${value}</span>
         </div>`
      : `<div style="display:flex;gap:8px;padding:5px 0;font-size:.85rem;border-bottom:1px solid #f1f5f9;">
           <span style="color:#fca5a5;width:18px;">${icon}</span>
           <span style="color:#9ca3af;min-width:80px;">${label}</span>
           <span style="color:#fca5a5;font-style:italic;">Chưa tìm thấy</span>
         </div>`;

    const daysCount = (tripData.days || []).length;
    const actsCount = (tripData.days || []).reduce((s, d) => s + (d.activities || []).length, 0);

    el.innerHTML = `
      <div style="border:1.5px solid #e0e7ff;border-radius:10px;overflow:hidden;margin-bottom:14px;">
        <div style="background:#4f46e5;padding:10px 14px;color:#fff;font-weight:600;font-size:.875rem;">
          📋 Kết quả phân tích
          ${daysCount > 0 ? `<span style="float:right;font-weight:400;opacity:.8;">${daysCount} ngày • ${actsCount} hoạt động</span>` : ""}
        </div>
        <div style="padding:10px 14px;background:#fff;">
          ${fieldRow("✈", "Chuyến đi",   tripData.name)}
          ${fieldRow("📍", "Điểm đến",   tripData.destination)}
          ${fieldRow("🗓", "Bắt đầu",    tripData.startDate)}
          ${fieldRow("🗓", "Kết thúc",   tripData.endDate)}
          ${fieldRow("💰", "Ngân sách",  tripData.budget
            ? `${Number(tripData.budget).toLocaleString("vi-VN")} ${tripData.currency || "VND"}`
            : null)}
          ${tripData.notes ? fieldRow("📝", "Ghi chú", tripData.notes.slice(0, 80) + (tripData.notes.length > 80 ? "…" : "")) : ""}
        </div>
      </div>
      ${missingHTML}
      ${missing.length === 0
        ? '<div style="text-align:center;color:#16a34a;font-size:.85rem;font-weight:600;">✅ Đầy đủ thông tin — sẵn sàng điền vào form!</div>'
        : ""}
    `;
  }

  //  PHẦN 8 — ĐIỀN VÀO FORM & HIGHLIGHT LỖI

  /**
   * Gọi hàm này sau khi dialog đóng để điền data vào form và highlight fields thiếu.
   *
   * MAP CÁC FIELD SELECTOR — Thay các selector bên dưới bằng
   * id/class thực tế trong form của app bạn:
   */
  const FIELD_SELECTORS = {
    name:        '#tripName,      [name="tripName"],      [data-field="name"]',
    destination: '#destination,   [name="destination"],   [data-field="destination"]',
    startDate:   '#startDate,     [name="startDate"],     [data-field="startDate"]',
    endDate:     '#endDate,       [name="endDate"],       [data-field="endDate"]',
    budget:      '#budget,        [name="budget"],        [data-field="budget"]',
    currency:    '#currency,      [name="currency"],      [data-field="currency"]',
    notes:       '#notes,         [name="notes"],         [data-field="notes"]',
  };

  function fillForm(tripData) {
    const { missing } = validateTripData(tripData);
    const missingKeys = new Set(missing.map(m => m.key));

    // Điền các field tìm thấy
    Object.entries(FIELD_SELECTORS).forEach(([key, selector]) => {
      const value = tripData[key];
      if (value === null || value === undefined) return;

      document.querySelectorAll(selector).forEach(el => {
        if (el.tagName === "SELECT") {
          // Tìm option khớp
          const opt = Array.from(el.options).find(o =>
            o.value.toLowerCase() === String(value).toLowerCase() ||
            o.text.toLowerCase()  === String(value).toLowerCase()
          );
          if (opt) el.value = opt.value;
        } else {
          el.value = String(value);
        }
        // Trigger change event để Vue/React/jQuery nhận biết
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    // Highlight fields thiếu
    clearHighlights();
    missing.forEach(({ key, label, extra }) => {
      highlightField(key, label, extra);
    });

    // Scroll đến field lỗi đầu tiên
    if (missing.length > 0) {
      const firstKey = missing[0].key;
      const selectors = FIELD_SELECTORS[firstKey];
      if (selectors) {
        const firstEl = document.querySelector(selectors);
        if (firstEl) {
          setTimeout(() => firstEl.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
        }
      }
    }

    return missing;
  }

  function highlightField(key, label, extra) {
    const selector = FIELD_SELECTORS[key];
    if (!selector) return;

    document.querySelectorAll(selector).forEach(el => {
      // Style
      el.style.borderColor = "#f97316";
      el.style.boxShadow   = "0 0 0 3px rgba(249,115,22,0.2)";
      el.style.outline     = "none";
      el.dataset.importHighlight = "true";

      // Thông báo bên dưới field
      clearFieldError(el);
      const msg = document.createElement("div");
      msg.className = "import-field-error";
      msg.dataset.importError = key;
      const text = extra
        ? `Thiếu <strong>${label}</strong> (${extra}) — vui lòng bổ sung`
        : `Thiếu <strong>${label}</strong> — vui lòng bổ sung`;
      msg.innerHTML = `
        <div style="
          display:flex; align-items:center; gap:5px; margin-top:4px;
          padding:5px 10px; background:#fff7ed; border:1px solid #fed7aa;
          border-radius:6px; font-size:.8rem; color:#c2410c;
        ">
          <span>⚠</span>
          <span>${text}</span>
        </div>`;
      el.parentNode.insertBefore(msg, el.nextSibling);

      // Xóa highlight khi user bắt đầu nhập
      el.addEventListener("input", function onInput() {
        el.style.borderColor = "";
        el.style.boxShadow   = "";
        delete el.dataset.importHighlight;
        clearFieldError(el);
        el.removeEventListener("input", onInput);
      }, { once: true });
    });
  }

  function clearFieldError(el) {
    let next = el.nextSibling;
    while (next && next.classList && next.classList.contains("import-field-error")) {
      const toRemove = next;
      next = next.nextSibling;
      toRemove.remove();
    }
  }

  function clearHighlights() {
    document.querySelectorAll("[data-import-highlight]").forEach(el => {
      el.style.borderColor = "";
      el.style.boxShadow   = "";
      delete el.dataset.importHighlight;
    });
    document.querySelectorAll(".import-field-error").forEach(el => el.remove());
  }

  //  PHẦN 9 — SHOW FORM VALIDATION SAU KHI DIALOG ĐÓNG

  function showFormValidation(tripData) {
    const missing = fillForm(tripData);

    if (missing.length === 0) {
      showToast("✅ Import thành công! Đã điền đầy đủ thông tin.", "success");
    } else {
      const names = missing.map(m => m.label).join(", ");
      showToast(`⚠ Import xong. Còn thiếu: ${names}. Vui lòng bổ sung các trường được đánh dấu.`, "warning");
    }
  }

  function showToast(message, type = "info") {
    const existing = document.getElementById("importToast");
    if (existing) existing.remove();

    const colors = {
      success: { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
      warning: { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" },
      error:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
      info:    { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" },
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement("div");
    toast.id = "importToast";
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:${c.bg}; border:1.5px solid ${c.border}; color:${c.text};
      padding:12px 20px; border-radius:10px; font-size:.875rem;
      box-shadow:0 4px 20px rgba(0,0,0,0.12); z-index:10000;
      max-width:90vw; font-family:'Segoe UI',Arial,sans-serif;
      animation:importSlideUp .3s ease;
    `;
    toast.innerHTML = `<style>@keyframes importSlideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>` + message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  //  PHẦN 10 — UTILS

  function formatBytes(bytes) {
    if (bytes < 1024)       return bytes + " B";
    if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + " KB";
    return (bytes/1024/1024).toFixed(1) + " MB";
  }

  // Public API
  return {
    openImportDialog,
    fillForm,
    clearHighlights,
    showToast,
    get onImportSuccess() { return onImportSuccess; },
    set onImportSuccess(fn) { onImportSuccess = fn; },
    // Expose để test thủ công
    _parseWithAI: parseWithAI,
    _validateTripData: validateTripData,
  };

})();

// Expose global
window.ImportModule = ImportModule;

/**
 * HƯỚNG DẪN TÍCH HỢP VÀO FORM CHÍNH
 *
 *
 * Ví dụ: form của bạn có các field như sau:
 *
 *   <input id="tripName"    placeholder="Tên chuyến đi">
 *   <input id="destination" placeholder="Điểm đến">
 *   <input id="startDate"   type="date">
 *   <input id="endDate"     type="date">
 *   <input id="budget"      type="number">
 *   <select id="currency">...</select>
 *   <textarea id="notes"></textarea>
 *
 * Thêm nút import:
 *   <button onclick="ImportModule.openImportDialog()">📂 Nhập từ file</button>
 *
 * Override callback để xử lý dữ liệu sau khi parse:
 *
 *   ImportModule.onImportSuccess = function(tripData) {
 *     // tripData đã được tự động điền vào form qua fillForm()
 *     // tripData.days[] chứa lịch từng ngày — xử lý theo app:
 *     if (tripData.days && tripData.days.length > 0) {
 *       renderDaysToUI(tripData.days);
 *     }
 *   };
 *
 * Nếu form dùng data-attribute thay vì id:
 *   Chỉnh FIELD_SELECTORS trong module, ví dụ:
 *   name: '[data-field="tripName"]'
 */
