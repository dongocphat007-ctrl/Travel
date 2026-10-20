/**
 * business-info.js — THÔNG TIN DOANH NGHIỆP (sửa MỘT chỗ, cả website đổi theo).
 *
 * Trang "Chính sách & Liên hệ", footer và hộp thanh toán đều đọc từ đây.
 * Ô nào để rỗng ("") sẽ hiện "Đang cập nhật" — hãy điền đủ TRƯỚC KHI nhận tiền của khách,
 * vì đây chính là thông tin khách dùng để kiểm tra độ tin cậy.
 */
const BUSINESS = {
  brand: "Travel",

  // ---- CHẾ ĐỘ DEMO ----
  // true  = website học tập/đồ án, KHÔNG nhận thanh toán thật: hiện thông báo demo, ẩn ô pháp lý, hotline ghi là số minh họa.
  // false = website kinh doanh thật: BẮT BUỘC điền đủ thông tin pháp lý bên dưới.
  demoMode: true,
  demoNotice: "Travel là website demo phục vụ học tập, không phải đơn vị kinh doanh du lịch. Mọi tour, giá, thanh toán và chính sách trên trang chỉ mang tính minh họa — vui lòng KHÔNG chuyển tiền thật.",

  // ---- Pháp lý (ĐIỀN THÔNG TIN THẬT, đúng như trên giấy tờ) ----
  legalName: "",          // Tên pháp nhân / hộ kinh doanh, vd "CÔNG TY TNHH DU LỊCH ABC"
  representative: "",     // Người đại diện theo pháp luật / chủ hộ kinh doanh
  taxCode: "",            // Mã số thuế
  businessLicense: "",    // Số GCN đăng ký doanh nghiệp / hộ kinh doanh + nơi cấp + ngày cấp
  travelLicense: "",      // Giấy phép kinh doanh lữ hành (nội địa / quốc tế) — bắt buộc nếu bán tour
  mocTradeNotice: "",     // Mã/URL đã thông báo website TMĐT với Bộ Công Thương (online.gov.vn), nếu có

  // ---- Liên hệ ----
  address: "TP. Hồ Chí Minh, Việt Nam",   // ⚠ Ghi địa chỉ đầy đủ: số nhà, đường, phường/xã, quận/huyện, tỉnh/thành
  hotline: "1800 1234",
  zalo: "",               // Số điện thoại Zalo, vd "0901234567" (tạo link zalo.me/…)
  email: "hello@travel.vn",
  workingHours: "Thứ 2 – Thứ 6, 8:00 – 17:00",
  facebook: "https://www.facebook.com/phat.nguyen.914332",
  messenger: "",          // Username trang/Facebook cho Messenger, vd "travel.vn" (tạo link m.me/…). Để rỗng = lấy từ link facebook ở trên

  // ---- Chính sách hủy & hoàn cọc ----
  // Tính theo số ngày từ lúc khách báo hủy đến ngày khởi hành. Duyệt từ trên xuống, gặp mốc đầu tiên khớp thì dùng.
  // refundPct = % tiền cọc được hoàn lại.
  cancelTiers: [
    { minDays: 15, refundPct: 100 },
    { minDays: 7,  refundPct: 50 },
    { minDays: 0,  refundPct: 0 },
  ],
  refundWorkingDays: 7,   // số ngày làm việc để hoàn tiền sau khi duyệt yêu cầu

  policyUpdated: "13/10/2026",
};

BUSINESS.digits = (s) => String(s || "").replace(/\D/g, "");
BUSINESS.telHref = () => "tel:" + BUSINESS.digits(BUSINESS.hotline);
BUSINESS.zaloHref = () => BUSINESS.zalo ? "https://zalo.me/" + BUSINESS.digits(BUSINESS.zalo) : "";
BUSINESS.messengerHref = () => {
  let u = BUSINESS.messenger;
  if (!u && BUSINESS.facebook) { const m = /facebook\.com\/([A-Za-z0-9.\-_]+)\/?(?:[?#].*)?$/.exec(BUSINESS.facebook); if (m && m[1] !== "profile.php") u = m[1]; }
  return u ? "https://m.me/" + encodeURIComponent(u) : "";
};
BUSINESS.missing = () => BUSINESS.demoMode ? [] : ["legalName","representative","taxCode","businessLicense","travelLicense","zalo"].filter(k => !BUSINESS[k]);
if (BUSINESS.missing().length) console.warn("[BUSINESS] Còn thiếu thông tin pháp lý/liên hệ trong js/business-info.js:", BUSINESS.missing().join(", "));
window.BUSINESS = BUSINESS;
