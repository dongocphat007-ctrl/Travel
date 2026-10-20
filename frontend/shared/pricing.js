/**
 * shared/pricing.js – NGUỒN DUY NHẤT tính giá đơn đặt tour (price breakdown)
 * Dùng chung cho Server (require) và Trình duyệt (window.Pricing).
 *   giá gốc → (+ phí HDV) → tạm tính → − voucher → GIÁ CUỐI → cọc 20% của giá cuối
 * Quy tắc trẻ em / HDV / cọc khớp với js/constants.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var CFG = {
    depositPct: 20,
    childFreeUnder: 5, childHalfUnder: 11, childHalfRate: 0.5,
    guideDayFee: 1500000, guideDayHours: 8, guideExtraHourFee: 200000
  };

  function int(v, min, max) {
    v = Math.floor(+v || 0);
    return Math.min(max, Math.max(min, v));
  }

  // Phí thuê HDV: days ngày, hours tiếng/ngày (vượt 8 tiếng phụ thu)
  function guideFee(days, hours) {
    days = Math.max(0, +days || 0);
    var extra = Math.max(0, (+hours || CFG.guideDayHours) - CFG.guideDayHours);
    return days * CFG.guideDayFee + days * extra * CFG.guideExtraHourFee;
  }

  // Giảm giá của 1 voucher trên tạm tính. v: { type: "percent"|"fixed", value, maxDiscount? }
  function voucherDiscount(v, subtotal) {
    if (!v || !(subtotal > 0)) return 0;
    var d = 0;
    if (v.type === "percent") d = Math.round(subtotal * (+v.value || 0) / 100);
    else if (v.type === "fixed") d = Math.round(+v.value || 0);
    if (+v.maxDiscount > 0) d = Math.min(d, Math.round(+v.maxDiscount));
    return Math.max(0, Math.min(d, subtotal));
  }

  /**
   * @param o { price, adults, kids, infants, hdvOn, hdvHours, days, voucher }
   * @return breakdown { adults, kids, infants, pax, base, hdv, subtotal, discount, voucherCode,
   *                     final, depositPct, deposit, remaining }
   */
  function compute(o) {
    o = o || {};
    var price = Math.max(0, Math.round(+o.price || 0));
    var adults = int(o.adults, 1, 50);
    var kids = int(o.kids, 0, 50);
    var infIn = int(o.infants, 0, 50);
    var infants = Math.min(infIn, adults);       // miễn phí tối đa 1 bé / người lớn
    kids += infIn - infants;                     // bé dư tính như trẻ 5–11 tuổi
    var base = price * adults + Math.round(price * kids * CFG.childHalfRate);
    var hdv = o.hdvOn ? guideFee(o.days || 1, o.hdvHours) : 0;
    var subtotal = base + hdv;
    var discount = voucherDiscount(o.voucher, subtotal);
    var final = subtotal - discount;
    var deposit = Math.round(final * CFG.depositPct / 100);
    return {
      adults: adults, kids: kids, infants: infants, pax: adults + kids + infants,
      base: base, hdv: hdv, subtotal: subtotal,
      discount: discount, voucherCode: discount > 0 && o.voucher ? String(o.voucher.code || "") : "",
      final: final, depositPct: CFG.depositPct, deposit: deposit, remaining: final - deposit
    };
  }

  // Các dòng hiển thị chung cho PDF / Admin / Email: [[nhãn, số tiền], ...]
  function rows(b) {
    var p = b && b.priceBreakdown;
    if (!p) return [["Tổng tiền", +b.price || 0], ["Đặt cọc " + (b.depositPercent || CFG.depositPct) + "%", +b.deposit || 0]];
    var r = [["Giá tour", p.base]];
    if (p.hdv) r.push(["Phí HDV", p.hdv]);
    if (p.discount) r.push(["Voucher" + (p.voucherCode ? " " + p.voucherCode : ""), -p.discount]);
    r.push(["Giá cuối", p.final], ["Đặt cọc " + p.depositPct + "%", p.deposit]);
    return r;
  }

  return { CFG: CFG, guideFee: guideFee, voucherDiscount: voucherDiscount, compute: compute, rows: rows };
});
