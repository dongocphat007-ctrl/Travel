/**
 * booking-pdf.js – Xuất PHIẾU XÁC NHẬN ĐẶT TOUR (PDF) cho khách.
 *   BookingPDF.download(bookingIdHoặcObject)
 * Dùng jsPDF + font DejaVu (nạp trễ qua LazyLibs, chỉ tải khi khách bấm nút).
 * Chạy hoàn toàn trên trình duyệt, không cần server.
 * ⚠ Đây là phiếu xác nhận/biên nhận của website, KHÔNG phải hóa đơn GTGT.
 */
window.BookingPDF = (() => {
  const money = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(+n || 0)) + " ₫";
  const fmtDate = (s) => {
    if (!s) return "—";
    const d = new Date(String(s).length <= 10 ? s + "T00:00:00" : s);
    return isNaN(d) ? "—" : d.toLocaleDateString("vi-VN");
  };
  const fmtDateTime = (s) => {
    const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleString("vi-VN", { hour12: false });
  };
  const loadAll = () => { try { return JSON.parse(localStorage.getItem("travel_bookings") || "[]") || []; } catch { return []; } };

  // Tính các khoản đã/chưa thanh toán từ trạng thái booking
  function summarize(b) {
    const q = quyetToanBooking(b);
    const fullNow = !!(b.fullPaid || b.finalPaid);
    const paid = fullNow ? q.total + (b.finalPaid ? q.otFee : 0) : (b.depositPaid ? q.deposit : 0);
    const due = Math.max(0, (q.total + (b.finalPaid ? q.otFee : 0)) - paid);
    let payState;
    if (b.status === "cancelled") payState = "Đơn đã hủy";
    else if (fullNow) payState = "Đã thanh toán đủ";
    else if (b.depositPaid) payState = "Đã nhận cọc " + depositPctOf(b) + "% – còn lại thanh toán sau tour";
    else if (b.claims && Object.keys(b.claims).length) payState = "Khách đã báo chuyển khoản – chờ admin đối chiếu";
    else payState = "Chưa thanh toán";
    const statusLbl = { pending: "Chờ xác nhận tour", confirmed: "Đã xác nhận tour", cancelled: "Đã hủy" }[b.status] || "Chờ xác nhận tour";
    return { q, paid, due, payState, statusLbl, fullNow };
  }

  async function download(ref) {
    const b = typeof ref === "string" ? loadAll().find((x) => x.id === ref) : ref;
    if (!b) { window.showToast?.("⚠ Không tìm thấy đơn đặt tour.", "warning"); return; }
    try { await LazyLibs.load("jspdf", "pdffont"); }
    catch { window.showToast?.("⚠ Không tải được thư viện PDF. Kiểm tra kết nối mạng.", "warning"); return; }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const FONT = "DejaVu";
    doc.addFileToVFS("DejaVuSans.ttf", window.PDF_FONTS.normal);        doc.addFont("DejaVuSans.ttf", FONT, "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", window.PDF_FONTS.bold);     doc.addFont("DejaVuSans-Bold.ttf", FONT, "bold");

    const BIZ = window.BUSINESS || {};
    const code = window.Payment ? Payment.payCodeOf(b) : (b.payCode || b.id);
    const S = summarize(b), q = S.q;
    const M = 16, W = 210, CW = W - M * 2;
    const NAVY = [13, 33, 55], GRAY = [90, 90, 90], LINE = [200, 205, 212], SOFT = [243, 246, 250];
    let y = 0;

    const font = (style, size, color) => { doc.setFont(FONT, style || "normal"); doc.setFontSize(size || 10); doc.setTextColor(...(color || [20, 20, 20])); };
    const need = (h) => { if (y + h > 280) { doc.addPage(); y = M; } };
    const hr = () => { doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(M, y, W - M, y); y += 4; };
    const section = (title) => {
      need(14); y += 2;
      doc.setFillColor(...SOFT); doc.rect(M, y - 4.5, CW, 7.5, "F");
      font("bold", 10.5, NAVY); doc.text(title, M + 2.5, y + 0.8); y += 8;
    };
    const row = (label, value, opts = {}) => {
      const lines = doc.splitTextToSize(String(value == null || value === "" ? "—" : value), CW - 52);
      need(lines.length * 5 + 2);
      font("normal", 9.5, GRAY); doc.text(label, M + 2.5, y);
      font(opts.bold ? "bold" : "normal", 9.5, opts.color); doc.text(lines, M + 50, y);
      y += lines.length * 5 + 1.2;
    };
    const moneyRow = (label, amount, bold, color) => {
      need(7);
      font(bold ? "bold" : "normal", bold ? 10.5 : 9.5, color || (bold ? NAVY : GRAY)); doc.text(label, M + 2.5, y);
      doc.text(money(amount), W - M - 2.5, y, { align: "right" }); y += bold ? 7 : 5.8;
    };

    // ── Đầu trang ──
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
    font("bold", 21, [255, 255, 255]); doc.text(BIZ.legalName || BIZ.brand || "Travel", M, 15);
    font("normal", 8.5, [215, 225, 235]);
    const head = [BIZ.address, [BIZ.hotline && "Hotline " + BIZ.hotline, BIZ.email].filter(Boolean).join("  ·  ")].filter(Boolean);
    if (BIZ.taxCode) head.push("MST: " + BIZ.taxCode);
    head.forEach((t, i) => doc.text(String(t), M, 21.5 + i * 4.6));
    font("bold", 9, [255, 255, 255]); doc.text("PHIẾU XÁC NHẬN ĐẶT TOUR", W - M, 14, { align: "right" });
    font("normal", 8.5, [215, 225, 235]);
    doc.text("Mã đơn: " + code, W - M, 20, { align: "right" });
    doc.text("Ngày lập: " + fmtDate(new Date().toISOString()), W - M, 25, { align: "right" });
    y = 44;

    // Trạng thái nổi bật
    const ok = S.fullNow || b.depositPaid;
    const col = b.status === "cancelled" ? [185, 28, 28] : ok ? [22, 101, 52] : [146, 64, 14];
    const bg  = b.status === "cancelled" ? [254, 226, 226] : ok ? [220, 252, 231] : [254, 243, 199];
    doc.setFillColor(...bg); doc.roundedRect(M, y - 5, CW, 11, 2, 2, "F");
    font("bold", 10, col); doc.text("Thanh toán: " + S.payState, M + 4, y + 1.8);
    font("normal", 9, col); doc.text("Tình trạng đơn: " + S.statusLbl, W - M - 4, y + 1.8, { align: "right" });
    y += 12;

    // ── Khách hàng ──
    section("Thông tin khách hàng");
    row("Họ tên", b.customerName, { bold: true });
    row("Số điện thoại", b.phone);
    row("Email", b.userEmail);
    row("Ngày đặt", fmtDateTime(b.createdAt));

    // ── Tour ──
    section("Thông tin tour");
    row("Tour", b.tourName, { bold: true });
    row("Điểm đến", b.tourDest);
    row("Thời gian", b.tourDuration);
    row("Ngày khởi hành", fmtDate(b.date), { bold: true });
    const end = typeof ngayKetThucTour === "function" ? ngayKetThucTour(b) : null;
    if (end) row("Ngày kết thúc (dự kiến)", fmtDate(end));
    const pax = [b.adults != null ? b.adults + " người lớn" : null, b.children ? b.children + " trẻ em" : null, b.infants ? b.infants + " em bé" : null].filter(Boolean).join(", ");
    row("Số khách", (b.pax || 1) + " người" + (pax ? " (" + pax + ")" : ""));
    row("Hướng dẫn viên", b.guideHire && b.guideHire.enabled
      ? "Có thuê riêng – " + b.guideHire.hoursPerDay + " giờ/ngày × " + b.guideHire.days + " ngày"
      : (b.guideType === "self" ? "Tour tự túc" : "Theo chương trình tour"));
    if (b.note) row("Ghi chú của khách", b.note);

    // ── Chi phí ──
    section("Chi phí & thanh toán");
    if (b.guideHire && b.guideHire.enabled && b.guideHire.cost) moneyRow("Phí thuê hướng dẫn viên (đã gồm trong tổng)", b.guideHire.cost);
    // Price breakdown dùng chung (shared/pricing.js, do server tính): tạm tính → voucher → giá cuối
    if (b.priceBreakdown && b.priceBreakdown.discount) {
      moneyRow("Tạm tính (giá tour" + (b.priceBreakdown.hdv ? " + HDV" : "") + ")", b.priceBreakdown.subtotal);
      moneyRow("Voucher " + (b.priceBreakdown.voucherCode || ""), -b.priceBreakdown.discount, false, [22, 101, 52]);
    }
    moneyRow(b.priceBreakdown && b.priceBreakdown.discount ? "Giá cuối (sau giảm)" : "Tổng giá trị đơn", q.total, true);
    moneyRow("Đặt cọc " + depositPctOf(b) + "%", q.deposit);
    moneyRow("Còn lại sau tour", q.remaining);
    if (q.otFee) moneyRow("Phụ thu HDV làm thêm " + q.otHours + " giờ", q.otFee);
    y += 1; hr();
    moneyRow("Đã thanh toán", S.paid, true, [22, 101, 52]);
    moneyRow("Còn phải thanh toán", S.due, true, S.due ? [146, 64, 14] : [22, 101, 52]);
    if (b.depositPaid || b.fullPaid || b.finalPaid) {
      font("normal", 8.5, GRAY);
      doc.text("Số tiền đã nhận do admin đối chiếu với tài khoản nhận tiền.", M + 2.5, y); y += 5;
    }

    // ── Hướng dẫn chuyển khoản (khi còn khoản chưa thanh toán) ──
    if (b.status !== "cancelled" && S.due > 0 && window.Payment && Payment.isConfigured()) {
      const c = Payment.config, next = Payment.amountDue(b);
      section("Thông tin chuyển khoản");
      row("Ngân hàng", c.bank);
      row("Số tài khoản", c.account, { bold: true });
      row("Chủ tài khoản", c.accountName);
      row("Số tiền cần chuyển", money(next), { bold: true });
      row("Nội dung chuyển khoản", code, { bold: true });
      font("normal", 8.5, [146, 64, 14]);
      const warn = doc.splitTextToSize("Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống đối soát đúng đơn.", CW - 5);
      doc.text(warn, M + 2.5, y); y += warn.length * 4.5 + 2;
    }

    // ── Điều khoản ngắn ──
    section("Lưu ý");
    const tiers = (BIZ.cancelTiers || []).map((t) => t.minDays > 0
      ? "hủy trước " + t.minDays + " ngày hoàn " + t.refundPct + "% tiền cọc"
      : "hủy sau đó " + (t.refundPct ? "hoàn " + t.refundPct + "% tiền cọc" : "không hoàn cọc")).join("; ");
    const notes = [
      "Phiếu này xác nhận thông tin đặt tour và tình trạng thanh toán tại thời điểm lập; không phải hóa đơn GTGT.",
      tiers ? "Chính sách hủy: " + tiers + ". Chi tiết xem mục Chính sách trên website." : null,
      BIZ.demoMode && BIZ.demoNotice ? BIZ.demoNotice : null,
    ].filter(Boolean);
    font("normal", 8.8, GRAY);
    notes.forEach((t) => { const ls = doc.splitTextToSize("• " + t, CW - 5); need(ls.length * 4.4 + 1); doc.text(ls, M + 2.5, y); y += ls.length * 4.4 + 1.5; });

    // ── Chân trang ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setDrawColor(...LINE); doc.line(M, 285, W - M, 285);
      font("normal", 8, GRAY);
      doc.text((BIZ.brand || "Travel") + (BIZ.hotline ? " · Hotline " + BIZ.hotline : "") + (BIZ.email ? " · " + BIZ.email : ""), M, 290);
      doc.text("Trang " + p + "/" + pages, W - M, 290, { align: "right" });
    }
    doc.save("XacNhanDatTour_" + code + ".pdf");
    window.showToast?.("📄 Đã tải phiếu xác nhận đặt tour.", "success");
  }

  return { download };
})();
