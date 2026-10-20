/**
 * constants.js – Hằng số, dữ liệu tĩnh, AppState
 * Phụ thuộc: không có
 */

const EMOJIS = ["✈️","🏖️","⛰️","🏙️","🌊","🏝️","🗺️","🎒","🚂","🚢","🌸","🦁"];

const STATUS_LBL = {
  upcoming:  "🔵 Sắp tới",
  ongoing:   "🟢 Đang diễn ra",
  completed: "⚫ Đã xong"
};

const STATUS_CLS = {
  upcoming:  "badge-upcoming",
  ongoing:   "badge-ongoing",
  completed: "badge-completed"
};

const CAT_ICON = {
  landmark:  "🏛️",
  food:      "🍜",
  hotel:     "🏨",
  transport: "🚌",
  activity:  "🎯",
  other:     "📌"
};

const CAT_LBL = {
  landmark:  "Địa danh",
  food:      "Ăn uống",
  hotel:     "Chỗ ở",
  transport: "Di chuyển",
  activity:  "Hoạt động",
  other:     "Khác"
};

// Tên tất cả page IDs
const PAGES = ["home","create-trip","trip-detail","add-loc","dashboard","about","profile","world-map","tour-finder","tour","guides","hotel-search","food","policy","admin"];

// App State – Quản lý trạng thái ứng dụng
const AppState = {
  page:         "home",
  tripId:       null,
  activeTab:    "itinerary",
  emoji:        "✈️",
  locCatFilter: "",
  confirmCb:    null
};

/**
 * QUY ĐỊNH ĐĂNG KÝ TOUR MẪU
 * - Phải đăng ký trước ngày khởi hành ít nhất BOOKING_MIN_DAYS ngày
 * - Admin xem mức ưu tiên dựa vào số ngày còn lại tới ngày đi:
 *     từ 3 đến 7 ngày  => khẩn cấp
 *     từ 8 ngày trở đi => chill chill
 */
const BOOKING_MIN_DAYS = 3;
const URGENT_MAX_DAYS = 7;

// Trạng thái đăng ký tour: pending (chờ nhận) -> confirmed (admin nhận) hoặc cancelled (admin hủy)
const BOOKING_STATUS_LBL = {
  pending: "⏳ Chờ xác nhận tour",
  confirmed: "✅ Đã xác nhận tour",
  cancelled: "❌ Đã hủy",
};

/**
 * THUÊ HƯỚNG DẪN VIÊN (HDV nội địa) khi tự tạo tour
 * - 1.500.000 ₫ / ngày, tính cho 8 tiếng
 * - Mỗi tiếng vượt quá 8 tiếng/ngày phụ thu thêm GUIDE_EXTRA_HOUR_FEE
 */
const GUIDE_DAY_FEE = 1500000;
const GUIDE_DAY_HOURS = 8;
const GUIDE_EXTRA_HOUR_FEE = 200000;

// Tính phí thuê HDV: days ngày, hoursPerDay tiếng mỗi ngày
function tinhPhiHDV(days, hoursPerDay) {
  days = Math.max(0, +days || 0);
  let extra = Math.max(0, (+hoursPerDay || GUIDE_DAY_HOURS) - GUIDE_DAY_HOURS);
  return days * GUIDE_DAY_FEE + days * extra * GUIDE_EXTRA_HOUR_FEE;
}

/**
 * CHÍNH SÁCH TRẺ EM
 * - Dưới 5 tuổi: miễn phí (ngủ chung giường với bố mẹ, tối đa 1 bé/người lớn)
 * - Từ 5 đến dưới 11 tuổi: tính 50% giá tour
 * - Từ 11 tuổi trở lên: tính như người lớn
 */
const CHILD_FREE_UNDER = 5;
const CHILD_HALF_UNDER = 11;
const CHILD_HALF_RATE = 0.5;

// Email bắt buộc là @gmail.com: phần tên 6–30 ký tự gồm chữ/số/dấu chấm (không đầu/cuối/liền kề dấu chấm), cho phép +nhãn
function isGmail(e) {
  e = String(e || "").trim().toLowerCase();
  let m = e.match(/^([^@\s]+)@gmail\.com$/);
  if (!m) return false;
  let base = m[1].split("+")[0];
  return base.length >= 6 && base.length <= 30 && /^[a-z0-9]+(\.[a-z0-9]+)*$/.test(base);
}
const GMAIL_MSG = "Email phải là Gmail hợp lệ, có đuôi @gmail.com (VD: tenban123@gmail.com)";

// Số điện thoại di động Việt Nam: 0 hoặc +84, theo sau là đầu số 3/5/7/8/9 và 8 chữ số (tổng 10 số)
function isValidVNPhone(p) {
  return /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(String(p || "").replace(/[\s.\-]/g, ""));
}

// Tiền đặt cọc khi đăng ký tour (% tổng tiền). Đổi 1 chỗ này là cả website đổi theo.
const DEPOSIT_PCT = 20;
const DEPOSIT_RATE = DEPOSIT_PCT / 100;
// % cọc của 1 booking (booking cũ có thể đã lưu mức khác, vd 50)
const depositPctOf = b => (b && b.fullPaid) ? 100 : (+(b && b.depositPercent) || DEPOSIT_PCT);

// Quyết toán sau tour: phần còn lại (100% - cọc) + phụ thu nếu HDV làm thêm giờ (overtimeHours = tổng số tiếng làm thêm)
function quyetToanBooking(b) {
  let total = +b.price || 0;
  let deposit = b.fullPaid ? total : (+b.deposit || Math.round(total * depositPctOf(b) / 100));   // fullPaid: khách đã trả đủ ngay lúc đặt
  let remaining = total - deposit;
  let otHours = +b.overtimeHours || 0;
  let otFee = otHours * GUIDE_EXTRA_HOUR_FEE;
  return { total, deposit, remaining, otHours, otFee, finalDue: remaining + otFee };
}

// Ngày kết thúc tour (yyyy-mm-dd) = ngày đi + số ngày - 1
function ngayKetThucTour(b) {
  if (!b.date) return null;
  let d = new Date(b.date + "T00:00:00");
  d.setDate(d.getDate() + Math.max(1, parseInt(b.tourDuration) || (b.guideHire && b.guideHire.days) || 1) - 1);
  return dateToStr(d);
}

// Đổi Date thành chuỗi yyyy-mm-dd theo GIỜ ĐỊA PHƯƠNG (toISOString bị lệch múi giờ)
function dateToStr(d) {
  let thang = String(d.getMonth() + 1).padStart(2, "0");
  let ngay = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + thang + "-" + ngay;
}

// Ngày sớm nhất được phép đăng ký tour = hôm nay + BOOKING_MIN_DAYS
function ngaySomNhatDangKy() {
  let d = new Date();
  d.setDate(d.getDate() + BOOKING_MIN_DAYS);
  return dateToStr(d);
}

// Số ngày còn lại từ hôm nay tới ngày đi (yyyy-mm-dd). Không có ngày => null
function soNgayConLai(dateStr) {
  if (!dateStr) return null;
  let di = new Date(dateStr + "T00:00:00");
  if (isNaN(di)) return null;
  let homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  return Math.round((di - homNay) / 86400000);
}

// Mức ưu tiên cho admin: trả về { cls, lbl, days } hoặc null nếu không có ngày đi
function mucUuTien(dateStr) {
  let days = soNgayConLai(dateStr);
  if (days === null) return null;
  if (days < 0) return { cls: "adm-prio-late", lbl: "⌛ Đã qua ngày đi", days: days };
  if (days < BOOKING_MIN_DAYS) return { cls: "adm-prio-late", lbl: "🚨 Sát ngày (còn " + days + " ngày)", days: days };
  if (days <= URGENT_MAX_DAYS) return { cls: "adm-prio-urgent", lbl: "🔥 Khẩn cấp (còn " + days + " ngày)", days: days };
  return { cls: "adm-prio-chill", lbl: "😎 Chill chill (còn " + days + " ngày)", days: days };
}
