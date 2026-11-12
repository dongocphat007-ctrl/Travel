/**
 * data-export-import.js – Tiện ích xuất nhập dữ liệu toàn diện (Excel, Word, PDF, CSV)
 * Hỗ trợ: Hóa đơn, Doanh thu, Khách hàng, Điểm danh đoàn trước xuất phát, Ẩm thực, Nhân viên.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DataExportImport = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COMPANY = {
    name: "TRAVEL VIỆT NAM",
    title: "CÔNG TY DU LỊCH & LỮ HÀNH VIỆT NAM",
    hotline: "1900 6868",
    email: "support@travel.vn",
    website: "https://travel.vn",
    address: "Tòa nhà Travel Building, Hà Nội & TP. Hồ Chí Minh"
  };

  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = n => Number(n || 0).toLocaleString("vi-VN") + " ₫";
  const nowStr = () => new Date().toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1. XUẤT EXCEL (.xls – Excel XML Spreadsheet chuẩn UTF-8, tự động co giãn cột và hàng theo chữ)
  // ═══════════════════════════════════════════════════════════════════
  function exportExcel({ filename = "du-lieu.xls", sheetName = "Dữ liệu", title = "", headers = [], rows = [], summary = [] }) {
    if (!filename.endsWith(".xls") && !filename.endsWith(".xlsx")) filename += ".xls";

    // 1. Tính toán độ rộng từng cột (Column Width) tự động theo độ dài nội dung chữ
    const colWidths = (headers || []).map((h, colIdx) => {
      const hText = typeof h === "object" ? h.title || h.name || "" : String(h || "");
      let maxLen = hText.length;
      (rows || []).forEach(r => {
        const cells = Array.isArray(r) ? r : headers.map(hd => {
          const k = typeof hd === "object" ? hd.key || hd.name : hd;
          return r[k];
        });
        const val = cells[colIdx];
        if (val != null) {
          const str = String(val);
          str.split(/\r?\n/).forEach(l => { maxLen = Math.max(maxLen, l.length); });
        }
      });
      // Hệ số ~7.5pt/ký tự cho tiếng Việt có dấu; tối thiểu 65pt, tối đa 320pt để văn bản dài tự xuống dòng
      return Math.min(Math.max(Math.round(maxLen * 7.5 + 26), 65), 320);
    });

    const columnsXml = colWidths.map((w, idx) => `<Column ss:Index="${idx + 1}" ss:Width="${w}" ss:AutoFitWidth="1"/>`).join("\n   ");

    let rowsXml = "";

    // Tiêu đề bảng nếu có
    if (title) {
      rowsXml += `<Row ss:Height="30" ss:AutoFitHeight="1">
        <Cell ss:MergeAcross="${Math.max(headers.length - 1, 0)}" ss:StyleID="Title">
          <Data ss:Type="String">${esc(title)}</Data>
        </Cell>
      </Row>`;
      rowsXml += `<Row ss:Height="20" ss:AutoFitHeight="1">
        <Cell ss:MergeAcross="${Math.max(headers.length - 1, 0)}" ss:StyleID="SubTitle">
          <Data ss:Type="String">Đơn vị: ${esc(COMPANY.title)} | Ngày xuất: ${esc(nowStr())}</Data>
        </Cell>
      </Row>`;
      rowsXml += `<Row ss:Height="8"></Row>`;
    }

    // Tóm tắt / Metadata nếu có
    if (summary && summary.length) {
      summary.forEach(s => {
        rowsXml += `<Row ss:Height="20">
          <Cell ss:StyleID="MetaLabel"><Data ss:Type="String">${esc(s[0])}</Data></Cell>
          <Cell ss:MergeAcross="${Math.max(headers.length - 2, 0)}" ss:StyleID="MetaVal"><Data ss:Type="String">${esc(s[1])}</Data></Cell>
        </Row>`;
      });
      rowsXml += `<Row ss:Height="8"></Row>`;
    }

    // Tiêu đề cột
    if (headers && headers.length) {
      rowsXml += `<Row ss:Height="26">` + headers.map(h => {
        const t = typeof h === "object" ? h.title || h.name : h;
        return `<Cell ss:StyleID="Header"><Data ss:Type="String">${esc(t)}</Data></Cell>`;
      }).join("") + `</Row>`;
    }

    // Các dòng dữ liệu (tự động căn chỉnh chiều cao hàng theo độ dài chữ và màu xen kẽ zebra)
    (rows || []).forEach((r, rowIdx) => {
      const cells = Array.isArray(r) ? r : headers.map(h => {
        const k = typeof h === "object" ? h.key || h.name : h;
        return r[k];
      });

      const isEven = (rowIdx % 2 === 1);
      const firstStr = String(cells[0] || "").toUpperCase();
      const secondStr = String(cells[1] || "").toUpperCase();
      const isTotalRow = firstStr.includes("TỔNG") || secondStr.includes("TỔNG");

      // Tính chiều cao hàng theo nội dung chữ nếu có xuống dòng
      let maxLines = 1;
      cells.forEach(v => {
        if (v != null) {
          const l = String(v).split(/\r?\n/).length;
          if (l > maxLines) maxLines = l;
        }
      });
      const rowHeight = isTotalRow ? 24 : (maxLines > 1 ? Math.max(22, maxLines * 18 + 6) : 22);

      rowsXml += `<Row ss:Height="${rowHeight}" ss:AutoFitHeight="1">` + cells.map((v, cIdx) => {
        const isNum = typeof v === "number" && !isNaN(v);
        const type = isNum ? "Number" : "String";
        let style = "Cell";
        if (isTotalRow) {
          style = isNum ? "TotalNum" : "TotalRow";
        } else if (isNum) {
          style = isEven ? "NumEven" : "Num";
        } else {
          const hName = typeof headers[cIdx] === "object" ? headers[cIdx].title || headers[cIdx].name || "" : String(headers[cIdx] || "");
          const isCenter = /^(STT|Mã|Ngày|Thời gian|Trạng thái|Loại)/i.test(hName) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(String(v));
          style = isCenter ? (isEven ? "CenterEven" : "Center") : (isEven ? "CellEven" : "Cell");
        }
        return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${esc(v)}</Data></Cell>`;
      }).join("") + `</Row>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1C2B3A"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0D2137"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Italic="1" ss:Color="#64748B"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#334155"/>
   <Alignment ss:Vertical="Center"/>
   <Borders><Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="MetaVal">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
   <Alignment ss:Vertical="Center"/>
   <Borders><Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D2137" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D2137"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D2137"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E3050"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E3050"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="CellEven">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="Center">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="CenterEven">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="Num">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="NumEven">
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRow">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0D2137"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0D2137"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0D2137"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalNum">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0D2137"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Top ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0D2137"/>
    <Bottom ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0D2137"/>
    <Left ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Right ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${esc(sheetName.slice(0, 31))}">
  <Table>
   ${columnsXml}
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(["\uFEFF" + xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. XUẤT CSV (Chuẩn UTF-8 có BOM chống lỗi font tiếng Việt)
  // ═══════════════════════════════════════════════════════════════════
  function exportCsv({ filename = "du-lieu.csv", headers = [], rows = [] }) {
    if (!filename.endsWith(".csv")) filename += ".csv";
    const q = v => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // chống CSV injection
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const headRow = headers.map(h => typeof h === "object" ? h.title || h.name : h).map(q).join(",");
    const bodyRows = rows.map(r => {
      const cells = Array.isArray(r) ? r : headers.map(h => {
        const k = typeof h === "object" ? h.key || h.name : h;
        return r[k];
      });
      return cells.map(q).join(",");
    }).join("\r\n");

    const blob = new Blob(["\uFEFF" + headRow + "\r\n" + bodyRows], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. XUẤT WORD (.doc – Microsoft Word HTML Document chuẩn định dạng)
  // ═══════════════════════════════════════════════════════════════════
  function exportWord({ filename = "tai-lieu.doc", title = "TÀI LIỆU", subtitle = "", summary = [], headers = [], rows = [], contentHtml = "" }) {
    if (!filename.endsWith(".doc") && !filename.endsWith(".docx")) filename += ".doc";

    let tableHtml = "";
    if (headers.length && rows.length) {
      tableHtml = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:10pt;">
        <thead>
          <tr style="background:#0d2137;color:#ffffff;text-align:left;">
            ${headers.map(h => `<th style="padding:8px 10px;border:1px solid #334155;">${esc(typeof h === "object" ? h.title || h.name : h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, idx) => {
            const cells = Array.isArray(r) ? r : headers.map(h => r[typeof h === "object" ? h.key || h.name : h]);
            const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            return `<tr style="background:${bg};">` + cells.map(v => `<td style="padding:7px 10px;border:1px solid #cbd5e1;">${esc(v)}</td>`).join("") + `</tr>`;
          }).join("")}
        </tbody>
      </table>`;
    }

    let summaryHtml = "";
    if (summary && summary.length) {
      summaryHtml = `<div style="background:#f1f5f9;border:1px solid #cbd5e1;padding:12px 16px;border-radius:6px;margin:14px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:10pt;">
          ${summary.map(s => `<tr><td style="width:28%;font-weight:bold;padding:4px 0;color:#334155;">${esc(s[0])}:</td><td style="padding:4px 0;color:#0f172a;">${esc(s[1])}</td></tr>`).join("")}
        </table>
      </div>`;
    }

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${esc(title)}</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page WordSection1 {
    size: 21.0cm 29.7cm; /* Khổ giấy chuẩn A4 */
    margin: 2.0cm 2.0cm 2.0cm 2.0cm; /* Căn lề chuẩn 2cm 4 phía */
    mso-page-orientation: portrait;
    mso-header-margin: 1.0cm;
    mso-footer-margin: 1.0cm;
  }
  div.WordSection1 {
    page: WordSection1;
  }
  body { font-family: 'Times New Roman', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1c2b3a; line-height: 1.5; padding: 0; }
  .header-box { border-bottom: 2px solid #0d2137; padding-bottom: 12px; margin-bottom: 18px; }
  .co-name { font-size: 15pt; font-weight: 800; color: #0d2137; text-transform: uppercase; margin: 0; }
  .co-info { font-size: 9.5pt; color: #64748b; margin: 4px 0 0; }
  .doc-title { font-size: 18pt; font-weight: bold; color: #0891b2; margin: 18px 0 4px; text-transform: uppercase; text-align: center; }
  .doc-sub { font-size: 10.5pt; color: #64748b; text-align: center; margin: 0 0 16px; font-style: italic; }
  .footer-box { margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 9.5pt; color: #64748b; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="WordSection1">
  <div class="header-box">
    <div class="co-name">${esc(COMPANY.title)}</div>
    <div class="co-info">Hotline: ${esc(COMPANY.hotline)} | Email: ${esc(COMPANY.email)} | Website: ${esc(COMPANY.website)}</div>
    <div class="co-info">Địa chỉ: ${esc(COMPANY.address)}</div>
  </div>

  <div class="doc-title">${esc(title)}</div>
  ${subtitle ? `<div class="doc-sub">${esc(subtitle)}</div>` : ""}

  ${summaryHtml}
  ${contentHtml}
  ${tableHtml}

  <div class="footer-box">
    <div>Thời gian xuất tài liệu: <b>${esc(nowStr())}</b></div>
    <div>Travel Management System — Hệ thống chứng từ & danh sách điện tử</div>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/msword;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. XUẤT PDF / IN (Print View trực quan chuẩn A4)
  // ═══════════════════════════════════════════════════════════════════
  function printDocument({ title = "TÀI LIỆU", subtitle = "", summary = [], headers = [], rows = [], contentHtml = "" }) {
    let summaryHtml = "";
    if (summary && summary.length) {
      summaryHtml = `<div class="print-meta-grid">
        ${summary.map(s => `<div class="print-meta-item"><span class="k">${esc(s[0])}:</span> <span class="v">${esc(s[1])}</span></div>`).join("")}
      </div>`;
    }

    let tableHtml = "";
    if (headers.length && rows.length) {
      tableHtml = `<table class="print-table">
        <thead>
          <tr>${headers.map(h => `<th>${esc(typeof h === "object" ? h.title || h.name : h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const cells = Array.isArray(r) ? r : headers.map(h => r[typeof h === "object" ? h.key || h.name : h]);
            return `<tr>` + cells.map(v => `<td>${esc(v)}</td>`).join("") + `</tr>`;
          }).join("")}
        </tbody>
      </table>`;
    }

    const printWin = window.open("", "_blank", "width=900,height=750");
    if (!printWin) {
      if (typeof showToast === "function") showToast("Vui lòng cho phép popup để in/tải PDF", "warn");
      return;
    }

    const doc = printWin.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${esc(title)} – Travel</title>
<style>
  @page { size: A4; margin: 16mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 24px;
    font-size: 13px;
    line-height: 1.5;
  }
  .print-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0d2137;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .print-logo-title {
    font-size: 20px;
    font-weight: 800;
    color: #0d2137;
    letter-spacing: -0.5px;
    margin: 0;
  }
  .print-co-sub {
    font-size: 11px;
    color: #64748b;
    margin-top: 3px;
  }
  .print-h1 {
    font-size: 20px;
    font-weight: 700;
    color: #0891b2;
    text-align: center;
    margin: 16px 0 4px;
    text-transform: uppercase;
  }
  .print-subtitle {
    text-align: center;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 16px;
  }
  .print-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .print-meta-item .k { font-weight: 600; color: #475569; }
  .print-meta-item .v { font-weight: 500; color: #0f172a; }
  .print-table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 12px;
    page-break-inside: auto;
  }
  .print-table thead {
    display: table-header-group;
  }
  .print-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  .print-table th, .print-table td {
    border: 1px solid #cbd5e1;
    padding: 7px 10px;
    text-align: left;
  }
  .print-table th {
    background: #0d2137;
    color: #ffffff;
    font-weight: 600;
  }
  .print-table tr:nth-child(even) { background: #f8fafc; }
  .print-foot {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #94a3b8;
  }
  .print-actions {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 1000;
  }
  .print-btn {
    background: #0d2137;
    color: #fff;
    border: none;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .print-btn:hover { background: #16324f; }
  @media print {
    .print-actions { display: none !important; }
    body { padding: 0 !important; }
  }
</style>
</head>
<body>
  <div class="print-actions">
    <button class="print-btn" onclick="window.print()">🖨️ In / Lưu PDF</button>
  </div>

  <div class="print-head">
    <div>
      <h1 class="print-logo-title">TRAVEL VIỆT NAM</h1>
      <div class="print-co-sub">${esc(COMPANY.title)}</div>
      <div class="print-co-sub">Hotline: ${esc(COMPANY.hotline)} · Email: ${esc(COMPANY.email)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#64748b;">Thời gian lập:</div>
      <div style="font-weight:600;color:#0d2137;">${esc(nowStr())}</div>
    </div>
  </div>

  <div class="print-h1">${esc(title)}</div>
  ${subtitle ? `<div class="print-subtitle">${esc(subtitle)}</div>` : ""}

  ${summaryHtml}
  ${contentHtml}
  ${tableHtml}

  <div class="print-foot">
    <div>Travel Management System — Chứng từ điện tử có giá trị lưu hành nội bộ</div>
    <div>Trang 1/1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>`);
    doc.close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. NHẬP DỮ LIỆU TỪ EXCEL / CSV (File Dialog + Parse + Preview Modal)
  // ═══════════════════════════════════════════════════════════════════
  function importData({ title = "Nhập dữ liệu", templateName = "mau-nhap-lieu.csv", templateCsv = "", sampleHeaders = [], onConfirm }) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.tsv,.txt,.xls,.xlsx";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;

      const text = await file.text();
      const parsed = parseDelimited(text);
      if (!parsed.rows.length) {
        alert("Tệp không có dữ liệu hoặc định dạng không đúng.");
        return;
      }

      showImportModal({
        title,
        filename: file.name,
        parsed,
        sampleHeaders,
        onConfirm
      });
    };

    input.click();
  }

  function parseDelimited(text) {
    // Tự động nhận diện dấu phẩy, chấm phẩy hoặc tab
    const clean = text.replace(/^\uFEFF/, "").trim();
    const firstLine = clean.split(/\r?\n/)[0] || "";
    let delim = ",";
    if (firstLine.includes("\t")) delim = "\t";
    else if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ";";

    const lines = clean.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };

    const parseLine = line => {
      const row = [];
      let cur = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (c === delim && !inQuotes) {
          row.push(cur.trim());
          cur = "";
        } else {
          cur += c;
        }
      }
      row.push(cur.trim());
      return row;
    };

    const headers = parseLine(lines[0]).map(h => h.replace(/^["']|["']$/g, "").trim());
    const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c !== ""));
    return { headers, rows };
  }

  function showImportModal({ title, filename, parsed, sampleHeaders, onConfirm }) {
    const ov = document.createElement("div");
    ov.className = "modal-overlay active";
    ov.style.zIndex = "99999";

    const previewRows = parsed.rows.slice(0, 5);
    const tableHtml = `<div style="max-height:220px;overflow:auto;border:1px solid #cbd5e1;border-radius:6px;margin:12px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#0d2137;color:#fff;position:sticky;top:0;">
            ${parsed.headers.map(h => `<th style="padding:6px 8px;border:1px solid #334155;text-align:left;">${esc(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${previewRows.map(r => `<tr>` + r.map(c => `<td style="padding:5px 8px;border:1px solid #e2e8f0;">${esc(c)}</td>`).join("") + `</tr>`).join("")}
        </tbody>
      </table>
    </div>`;

    ov.innerHTML = `
      <div class="modal" style="max-width:680px;background:#fff;border-radius:12px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
          <h2 style="margin:0;font-size:18px;color:#0d2137;">📥 ${esc(title)}</h2>
          <button type="button" id="close-modal" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
        </div>
        <p style="margin:0 0 8px;font-size:14px;color:#334155;">Tệp: <b>${esc(filename)}</b> · Tìm thấy <b>${parsed.rows.length}</b> dòng dữ liệu hợp lệ.</p>
        <div style="font-size:12px;color:#64748b;">Xem trước 5 dòng đầu tiên:</div>
        ${tableHtml}
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
          <button type="button" id="btn-cancel" class="btn" style="padding:8px 16px;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;">Hủy bỏ</button>
          <button type="button" id="btn-submit" class="btn primary" style="padding:8px 20px;border-radius:6px;border:none;background:#0d2137;color:#fff;font-weight:600;cursor:pointer;">Xác nhận nhập (${parsed.rows.length} dòng)</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector("#close-modal").onclick = close;
    ov.querySelector("#btn-cancel").onclick = close;

    ov.querySelector("#btn-submit").onclick = async () => {
      const btn = ov.querySelector("#btn-submit");
      btn.disabled = true;
      btn.textContent = "Đang xử lý...";
      try {
        if (onConfirm) await onConfirm(parsed);
        close();
      } catch (err) {
        alert("Lỗi khi nhập: " + (err.message || err));
        btn.disabled = false;
        btn.textContent = "Thử lại";
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // CÁC HÀM XUẤT CHUYÊN DỤNG CHO TỪNG PHÂN HỆ
  // ═══════════════════════════════════════════════════════════════════

  /** Xuất Hóa đơn / Chi tiết đơn đặt tour */
  function exportBookingInvoice(b, format = "pdf") {
    const code = b.payCode || b.id || "TRAVEL";
    const title = "HÓA ĐƠN XÁC NHẬN ĐẶT TOUR";
    const subtitle = `Mã đơn: ${code} · Trạng thái: ${b.statusLabel || b.status || "Đã xác nhận"}`;

    const summary = [
      ["Mã đơn hàng", code],
      ["Tên tour du lịch", b.tourName || "—"],
      ["Khách hàng đặt tour", b.customerName || "—"],
      ["Số điện thoại", b.phone || "—"],
      ["Email liên hệ", b.email || "—"],
      ["Ngày khởi hành", b.date || "—"],
      ["Số lượng khách", `${b.pax || 1} khách (NL ${b.adults || 0}, TE ${b.children || 0}, EB ${b.infants || 0})`],
      ["Điểm đón khách", b.pickup || "Trung tâm thành phố"],
      ["Tổng giá trị tour", money(b.price)],
      ["Đã thanh toán", money(b.paidAmount)],
      ["Số tiền còn lại", money(b.remaining || 0)]
    ];

    const ps = b.passengers || [];
    const headers = ["STT", "Họ tên hành khách", "Ngày sinh", "Giới tính", "CCCD / Hộ chiếu", "Ghi chú"];
    const rows = ps.map((p, i) => [
      i + 1,
      p.name || "—",
      p.dob || "—",
      p.gender === "male" ? "Nam" : p.gender === "female" ? "Nữ" : "Khác",
      p.idNumber || "—",
      p.note || ""
    ]);

    if (format === "excel") {
      exportExcel({
        filename: `hoa-don-${code}.xls`,
        sheetName: `HoaDon-${code}`,
        title,
        summary,
        headers,
        rows
      });
    } else if (format === "word") {
      exportWord({
        filename: `hop-dong-tour-${code}.doc`,
        title,
        subtitle,
        summary,
        headers,
        rows
      });
    } else {
      printDocument({
        title,
        subtitle,
        summary,
        headers,
        rows
      });
    }
  }

  /** Xuất Báo cáo Doanh thu */
  function exportRevenueReport({ year, period, rows, totals }, format = "excel") {
    const isQ = period === "quarter";
    const title = `BÁO CÁO DOANH THU DU LỊCH ${isQ ? "THEO QUÝ" : "THEO THÁNG"} – NĂM ${year}`;
    const subtitle = `Kỳ thống kê: ${isQ ? "4 Quý" : "12 Tháng"} năm ${year}`;

    const headers = ["Kỳ", "Doanh thu thuần", "Thực thu", "Đã hoàn", "Số đơn hiệu lực", "Số đơn hủy", "Lượt khách"];
    const dataRows = (rows || []).map(r => [
      isQ ? "Quý " + r.quarter : "Tháng " + r.month + "/" + year,
      money(r.revenue),
      money(r.collected),
      money(r.refunded),
      r.orders || 0,
      r.cancelled || 0,
      r.guests || 0
    ]);

    if (totals) {
      dataRows.push([
        "TỔNG CỘNG",
        money(totals.revenue),
        money(totals.collected),
        money(totals.refunded),
        totals.orders || 0,
        totals.cancelled || 0,
        totals.guests || 0
      ]);
    }

    if (format === "excel") {
      exportExcel({
        filename: `bao-cao-doanh-thu-${year}-${period}.xls`,
        sheetName: `DoanhThu-${year}`,
        title,
        headers,
        rows: dataRows
      });
    } else if (format === "word") {
      exportWord({
        filename: `bao-cao-doanh-thu-${year}-${period}.doc`,
        title,
        subtitle,
        headers,
        rows: dataRows
      });
    } else {
      printDocument({
        title,
        subtitle,
        headers,
        rows: dataRows
      });
    }
  }

  /** Xuất Danh sách điểm danh đoàn trước khi xuất phát (Pax Manifest) */
  function exportDepartureManifest({ tourName, date, payCode, guideName, passengers = [] }, format = "pdf") {
    const title = "DANH SÁCH ĐOÀN & PHIẾU ĐIỂM DANH XUẤT PHÁT";
    const subtitle = `Chuyến: ${tourName} | Khởi hành: ${date} | HDV: ${guideName || "—"}`;

    const summary = [
      ["Tên tour", tourName || "—"],
      ["Ngày khởi hành", date || "—"],
      ["Mã đoàn / Mã đơn", payCode || "—"],
      ["Hướng dẫn viên phụ trách", guideName || "—"],
      ["Tổng số hành khách", `${passengers.length} người`]
    ];

    const headers = ["STT", "Họ và tên", "Ngày sinh", "Giới tính", "CCCD / Hộ chiếu", "SĐT", "Điểm danh", "Chữ ký"];
    const rows = passengers.map((p, i) => [
      i + 1,
      p.name || p.customerName || "—",
      p.dob || "—",
      p.gender === "male" ? "Nam" : p.gender === "female" ? "Nữ" : "Khác",
      p.idNumber || "—",
      p.phone || "—",
      p.checkin === "present" ? "Có mặt" : p.checkin === "late" ? "Đến trễ" : p.checkin === "absent" ? "Vắng" : "[  ] Có   [  ] Vắng",
      ""
    ]);

    if (format === "excel") {
      exportExcel({
        filename: `diem-danh-${date}-${payCode || "doan"}.xls`,
        sheetName: "DiemDanh",
        title,
        summary,
        headers,
        rows
      });
    } else if (format === "word") {
      exportWord({
        filename: `diem-danh-${date}-${payCode || "doan"}.doc`,
        title,
        subtitle,
        summary,
        headers,
        rows
      });
    } else {
      printDocument({
        title,
        subtitle,
        summary,
        headers,
        rows
      });
    }
  }

  /** Xuất Danh sách nhân viên */
  function exportStaffList(staffList = [], format = "excel") {
    const title = "DANH SÁCH NHÂN SỰ & HƯỚNG DẪN VIÊN";
    const ROLE_NAME = {
      admin: "Quản trị viên",
      cashier: "Thu ngân",
      operator: "Điều hành tour",
      guide: "Hướng dẫn viên",
      content: "Biên tập nội dung",
      support: "Chăm sóc khách hàng"
    };

    const headers = ["STT", "Tên tài khoản", "Họ và tên", "Chức vụ", "Email", "Số điện thoại", "Trạng thái"];
    const rows = staffList.map((u, i) => [
      i + 1,
      u.username || "—",
      u.name || "—",
      ROLE_NAME[u.role] || u.role || "—",
      u.email || "—",
      u.phone || "—",
      u.locked ? "Đã khóa" : "Hoạt động"
    ]);

    if (format === "excel") {
      exportExcel({
        filename: `danh-sach-nhan-vien-${new Date().toISOString().slice(0, 10)}.xls`,
        sheetName: "NhanVien",
        title,
        headers,
        rows
      });
    } else if (format === "word") {
      exportWord({
        filename: `danh-sach-nhan-vien.doc`,
        title,
        subtitle: `Tổng số: ${staffList.length} nhân sự`,
        headers,
        rows
      });
    } else {
      printDocument({
        title,
        subtitle: `Tổng số: ${staffList.length} nhân sự`,
        headers,
        rows
      });
    }
  }

  /** Xuất Danh mục Ẩm thực & Món đặc sản */
  function exportFoodsList(foodList = [], format = "excel") {
    const title = "DANH MỤC ẨM THỰC & MÓN ĐẶC SẢN VIỆT NAM";
    const REG_MAP = { bac: "Miền Bắc", trung: "Miền Trung", nam: "Miền Nam" };

    const headers = ["STT", "Tên món đặc sản", "Vùng miền", "Tỉnh / Thành", "Mô tả", "Trạng thái"];
    const rows = foodList.map((f, i) => [
      i + 1,
      f.name || "—",
      REG_MAP[f.region] || f.region || "—",
      f.province || "—",
      f.description || "—",
      f.active === false ? "Ẩn" : "Hiển thị"
    ]);

    if (format === "excel") {
      exportExcel({
        filename: `danh-sach-mon-dac-san.xls`,
        sheetName: "AmThuc",
        title,
        headers,
        rows
      });
    } else if (format === "word") {
      exportWord({
        filename: `danh-sach-mon-dac-san.doc`,
        title,
        subtitle: `Tổng số: ${foodList.length} món`,
        headers,
        rows
      });
    } else {
      printDocument({
        title,
        subtitle: `Tổng số: ${foodList.length} món`,
        headers,
        rows
      });
    }
  }

  /** Xuất Báo cáo Doanh thu theo Ngày (Excel, Word, PDF) */
  function exportDailyRevenueReport({ date, rows = [], totals = {} }, format = "excel") {
    const dStr = date || new Date().toISOString().slice(0, 10);
    const title = `BÁO CÁO DOANH THU THEO NGÀY – ${dStr}`;
    const subtitle = `Ngày thực hiện: ${dStr} | Xuất lúc: ${nowStr()}`;

    const summary = [
      ["Ngày báo cáo", dStr],
      ["Tổng tiền đã thu", money(totals.totalCollected || 0)],
      ["Tổng tiền đã hoàn", money(totals.totalRefunded || 0)],
      ["Thực thu (Thu − Hoàn)", money(totals.net != null ? totals.net : ((totals.totalCollected || 0) - (totals.totalRefunded || 0)))],
      ["Tổng số giao dịch", `${rows.length || totals.transactionCount || 0} giao dịch`]
    ];

    const headers = [
      "STT",
      "Mã giao dịch / Đơn",
      "Khách hàng",
      "Tour / Dịch vụ",
      "Loại thu",
      "Số tiền (₫)",
      "Thời gian",
      "Người thu",
      "Ghi chú"
    ];

    const dataRows = (rows || []).map((r, i) => [
      i + 1,
      r.payCode || r.id || "—",
      r.customerName || "—",
      r.tourName || "—",
      r.kindLabel || r.kind || "—",
      (r.isRefund ? "-" : "+") + money(r.amount),
      r.at ? new Date(r.at).toLocaleString("vi-VN") : "—",
      r.byName || "—",
      r.note || ""
    ]);

    if (totals && (totals.totalCollected || totals.net)) {
      dataRows.push([
        "",
        "TỔNG THỰC THU",
        "",
        "",
        "",
        money(totals.net != null ? totals.net : ((totals.totalCollected || 0) - (totals.totalRefunded || 0))),
        "",
        "",
        `Đã thu: ${money(totals.totalCollected || 0)} | Đã hoàn: ${money(totals.totalRefunded || 0)}`
      ]);
    }

    if (format === "excel") {
      exportExcel({
        filename: `bao-cao-doanh-thu-ngay-${dStr}.xls`,
        sheetName: `DoanhThu-${dStr}`,
        title,
        summary,
        headers,
        rows: dataRows
      });
    } else if (format === "word") {
      exportWord({
        filename: `bao-cao-doanh-thu-ngay-${dStr}.doc`,
        title,
        subtitle,
        summary,
        headers,
        rows: dataRows
      });
    } else {
      printDocument({
        title,
        subtitle,
        summary,
        headers,
        rows: dataRows
      });
    }
  }

  /** Xuất Báo cáo Danh sách Ý kiến & Bình luận Đánh giá (Excel, Word, PDF) */
  function exportReviewsList(reviewsList = [], format = "excel") {
    const title = "BÁO CÁO TỔNG HỢP Ý KIẾN ĐÁNH GIÁ & BÌNH LUẬN KHÁCH HÀNG";
    const subtitle = `Tổng số: ${reviewsList.length} bình luận | Xuất lúc: ${nowStr()}`;
    const headers = [
      "STT",
      "Thời gian",
      "Khách hàng",
      "Email / ĐT",
      "Tour / Dịch vụ",
      "Số sao",
      "Phân loại",
      "Nội dung bình luận",
      "Trạng thái",
      "Phản hồi từ công ty",
      "Người trả lời"
    ];
    const rows = reviewsList.map((r, i) => [
      i + 1,
      r.createdAt || r.at || "—",
      r.userName || r.author || r.name || "Khách hàng",
      r.userEmail || r.email || r.phone || "—",
      r.tourName || r.targetName || r.targetId || "Tour du lịch",
      r.rating != null ? `${r.rating} ⭐` : "—",
      r.categoryLabel || r.category || "Đánh giá",
      r.content || r.comment || r.text || "",
      r.statusLabel || r.status || "Hoạt động",
      r.reply || r.response || "Chưa phản hồi",
      r.repliedByName || r.repliedBy || "—"
    ]);

    if (format === "excel") {
      exportExcel({
        filename: "danh-sach-binh-luan-danh-gia.xls",
        sheetName: "BinhLuan",
        title,
        headers,
        rows
      });
    } else if (format === "word") {
      exportWord({
        filename: "danh-sach-binh-luan-danh-gia.doc",
        title,
        subtitle,
        headers,
        rows
      });
    } else {
      printDocument({
        title,
        subtitle,
        headers,
        rows
      });
    }
  }

  return {
    exportExcel,
    exportCsv,
    exportWord,
    exportPdf: printDocument,
    printDocument,
    importData,
    exportBookingInvoice,
    exportRevenueReport,
    exportDailyRevenueReport,
    exportDepartureManifest,
    exportStaffList,
    exportFoodsList,
    exportReviewsList
  };
});
