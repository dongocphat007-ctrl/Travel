const fs = require('fs');
const path = require('path');

const storageDir = path.join(__dirname, '../backend/storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Fixed PBKDF2 hash for password "Travel@2026"
const PASS_HASH = "pbkdf2$210000$R7NtBFaJljypzYKjd7A5iA==$LhnwO1XyKzZygnDA8uZMumR5IRABrdPDWfiREdikhyY=";

// Helper dates
const now = new Date();
const todayStr = now.toISOString().slice(0, 10);
const nowIso = now.toISOString();

function daysOffset(dStr, days) {
  const d = new Date(dStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function timeOffsetHours(hours) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString();
}

function timeOffsetDays(days) {
  const d = new Date(Date.now() + days * 86400 * 1000);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────
// 1. GUIDES (guides.json)
// ─────────────────────────────────────────────────────────────
const guidesSeedPath = path.join(__dirname, '../frontend/data/guides-seed.json');
let guidesData = [];
if (fs.existsSync(guidesSeedPath)) {
  const rawGuides = fs.readFileSync(guidesSeedPath, 'utf8').replace(/^\uFEFF/, '');
  guidesData = JSON.parse(rawGuides);
}
fs.writeFileSync(path.join(storageDir, 'guides.json'), JSON.stringify(guidesData, null, 2), 'utf8');
console.log(`[1] Saved guides.json: ${guidesData.length} guides`);

// ─────────────────────────────────────────────────────────────
// 2. ACCOUNTS (accounts.json)
// ─────────────────────────────────────────────────────────────
const existingAccountsPath = path.join(storageDir, 'accounts.json');
let existingAccounts = [];
if (fs.existsSync(existingAccountsPath)) {
  const rawAccounts = fs.readFileSync(existingAccountsPath, 'utf8').replace(/^\uFEFF/, '');
  existingAccounts = JSON.parse(rawAccounts);
}

// Update staff with salaries and balances
const guideIdMap = {
  hdv001: "g_hn01",
  hdv002: "g_hn02",
  hdv003: "g_hn03",
  hdv004: "g_hn04",
  hdv005: "g_hn05",
  hdv006: "g_mt01",
  hdv007: "g_mt02",
  hdv008: "g_mt03",
  hdv009: "g_mt04",
  hdv010: "g_mn01",
  hdv011: "g_mn02",
  hdv012: "g_mn03",
  hdv013: "g_mn04",
  hdv014: "g_qt01",
  hdv015: "g_qt02",
  hdv016: "g_qt03"
};

for (const a of existingAccounts) {
  if (a.id === "tn001") {
    a.baseSalary = 15000000;
    a.balance = 3500000;
    a.totalEarned = 45000000;
    a.strikes = 0;
    a.lastPaidAt = timeOffsetDays(-25);
  } else if (a.id === "dh001") {
    a.baseSalary = 18000000;
    a.balance = 5200000;
    a.totalEarned = 54000000;
    a.strikes = 1;
    a.lastPaidAt = timeOffsetDays(-25);
  } else if (a.id === "cs001") {
    a.baseSalary = 14000000;
    a.balance = 2100000;
    a.totalEarned = 42000000;
    a.strikes = 0;
    a.lastPaidAt = timeOffsetDays(-25);
  } else if (a.id === "nd001") {
    a.baseSalary = 16000000;
    a.balance = 4000000;
    a.totalEarned = 48000000;
    a.strikes = 0;
    a.lastPaidAt = timeOffsetDays(-25);
  } else if (guideIdMap[a.id]) {
    a.guideId = guideIdMap[a.id];
    a.balance = a.balance || 8500000;
    a.totalEarned = a.totalEarned || 26000000;
  }
}

// 10 mock customers
const mockCustomers = [
  { id: "cus001", name: "Nguyễn Văn An", email: "an.nguyen@gmail.com", phone: "0912345678", role: "customer", balance: 1200000, points: 500, totalEarned: 1200000 },
  { id: "cus002", name: "Trần Thị Bình", email: "binh.tran@gmail.com", phone: "0987654321", role: "customer", balance: 500000, points: 250, totalEarned: 500000 },
  { id: "cus003", name: "Lê Hoàng Cường", email: "cuong.le@gmail.com", phone: "0903123456", role: "customer", balance: 0, points: 100, totalEarned: 0 },
  { id: "cus004", name: "Phạm Thùy Dung", email: "dung.pham@gmail.com", phone: "0938999888", role: "customer", balance: 800000, points: 300, totalEarned: 800000 },
  { id: "cus005", name: "Võ Hoàng Em", email: "em.vo@gmail.com", phone: "0977112233", role: "customer", balance: 0, points: 0, totalEarned: 0 },
  { id: "cus006", name: "Đỗ Hương Giang", email: "giang.do@gmail.com", phone: "0945667788", role: "customer", balance: 1500000, points: 450, totalEarned: 1500000 },
  { id: "cus007", name: "Bùi Tuấn Hùng", email: "hung.bui@gmail.com", phone: "0966554433", role: "customer", balance: 2000000, points: 800, totalEarned: 2000000 },
  { id: "cus008", name: "Ngô Gia Khang", email: "khang.ngo@gmail.com", phone: "0918776655", role: "customer", balance: 300000, points: 150, totalEarned: 300000 },
  { id: "cus009", name: "Đinh Thảo Linh", email: "linh.dinh@gmail.com", phone: "0922334455", role: "customer", balance: 650000, points: 200, totalEarned: 650000 },
  { id: "cus010", name: "Vũ Trọng Nam", email: "nam.vu@gmail.com", phone: "0933445566", role: "customer", balance: 0, points: 50, totalEarned: 0 }
];

for (const mc of mockCustomers) {
  const existing = existingAccounts.find(a => a.id === mc.id || a.email === mc.email);
  if (existing) {
    existing.passHash = PASS_HASH;
    existing.role = "user";
    existing.provider = "local";
    existing.balance = mc.balance;
    existing.points = mc.points;
    existing.totalEarned = mc.totalEarned;
  } else {
    existingAccounts.push({
      ...mc,
      role: "user",
      passHash: PASS_HASH,
      provider: "local",
      createdAt: timeOffsetDays(-60),
      mustChangePassword: false,
      roleName: "Khách hàng",
      rolePrefix: "cus",
      permissions: []
    });
  }
}

fs.writeFileSync(existingAccountsPath, JSON.stringify(existingAccounts, null, 2), 'utf8');
console.log(`[2] Saved accounts.json: ${existingAccounts.length} accounts`);

// ─────────────────────────────────────────────────────────────
// 3. BOOKINGS (bookings.json)
// ─────────────────────────────────────────────────────────────
// Let's create ~32 rich bookings covering all statuses!
const tourList = [
  { id: 101, name: "Hà Nội – Hạ Long 3N2Đ", dest: "Hạ Long", price: 2500000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Bắc" },
  { id: 102, name: "Đà Nẵng – Hội An 4N3Đ", dest: "Đà Nẵng", price: 3800000, duration: "4 ngày 3 đêm", days: 4, region: "Miền Trung" },
  { id: 103, name: "Sapa – Fansipan 3N2Đ", dest: "Lào Cai", price: 2800000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Bắc" },
  { id: 104, name: "Cần Thơ – Miền Tây 2N1Đ", dest: "Cần Thơ", price: 1500000, duration: "2 ngày 1 đêm", days: 2, region: "Miền Nam" },
  { id: 105, name: "Phú Quốc 4N3Đ", dest: "Kiên Giang", price: 5500000, duration: "4 ngày 3 đêm", days: 4, region: "Miền Nam" },
  { id: 106, name: "Quy Nhơn – Phú Yên 4N3Đ", dest: "Bình Định", price: 4200000, duration: "4 ngày 3 đêm", days: 4, region: "Miền Trung" },
  { id: 107, name: "Đà Lạt – Ngàn Hoa 3N2Đ", dest: "Lâm Đồng", price: 2900000, duration: "3 ngày 2 đêm", days: 3, region: "Tây Nguyên" },
  { id: 108, name: "Nha Trang Biển Gọi 3N2Đ", dest: "Khánh Hòa", price: 3200000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Trung" }
];

function buildPassengerList(leadName, leadPhone, count) {
  const pList = [{
    name: leadName,
    phone: leadPhone,
    dob: "1988-05-15",
    gender: "male",
    idNumber: "001088012345",
    checkin: "present"
  }];
  const extraNames = ["Trần Thu Thảo", "Nguyễn Minh Đức", "Lê Bảo Trân", "Hoàng Kim Oanh"];
  for (let i = 1; i < count; i++) {
    pList.push({
      name: extraNames[(i - 1) % extraNames.length] + ` (${i})`,
      phone: leadPhone,
      dob: "1992-09-20",
      gender: i % 2 === 0 ? "male" : "female",
      idNumber: `00109200000${i}`,
      checkin: i === 1 ? "present" : (i === 2 ? "late" : "")
    });
  }
  return pList;
}

const bookings = [];

function makeBooking(opts) {
  const t = tourList.find(x => x.id === opts.tourId) || tourList[0];
  const c = mockCustomers.find(x => x.id === opts.userId) || mockCustomers[0];
  const pax = opts.pax || 2;
  const rawPrice = t.price * pax;
  const deposit = Math.round(rawPrice * 0.3);
  const remaining = rawPrice - deposit;

  const b = {
    id: opts.id,
    payCode: `TV${opts.id.replace(/\D/g, '')}`,
    tourId: t.id,
    tourName: t.name,
    tourDest: t.dest,
    tourDuration: t.duration,
    tourDays: t.days,
    tourRegion: t.region,
    tourGuideType: "domestic",
    guideType: "guided",
    userId: c.id,
    userEmail: c.email,
    customerName: c.name,
    phone: c.phone,
    email: c.email,
    date: opts.date,
    pax: pax,
    adults: pax,
    children: 0,
    infants: 0,
    price: rawPrice,
    deposit: deposit,
    depositPercent: 30,
    depositPaid: opts.depositPaid ?? (opts.status !== 'pending_payment'),
    priceBreakdown: {
      adults: pax,
      kids: 0,
      infants: 0,
      adultPrice: t.price,
      total: rawPrice,
      discount: 0,
      voucherDiscount: 0,
      final: rawPrice,
      deposit: deposit,
      remaining: remaining
    },
    voucherCode: "",
    status: opts.status,
    guideId: opts.guideId || null,
    guideName: opts.guideName || null,
    createdAt: opts.createdAt || timeOffsetDays(-5),
    note: opts.note || "",
    passengers: buildPassengerList(c.name, c.phone, pax),
    history: [
      { action: "create", from: "", to: "pending_payment", by: c.id, byName: c.name, role: "CUSTOMER", text: "Khách đặt tour", at: opts.createdAt || timeOffsetDays(-5) }
    ],
    payments: []
  };

  if (opts.depositPaid || ["paid_deposit", "confirmed", "guide_pending", "guide_accepted", "in_progress", "completed"].includes(opts.status)) {
    b.payments.push({
      id: `pay_${opts.id}_dep`,
      kind: "deposit",
      amount: deposit,
      at: timeOffsetDays(-4),
      by: "tn001",
      byName: "Lê Thu Ngân",
      method: "bank",
      note: `Thu tiền cọc đơn ${b.payCode}`
    });
  }

  if (["paid_full", "confirmed", "guide_pending", "guide_accepted", "in_progress", "completed"].includes(opts.status)) {
    b.payments.push({
      id: `pay_${opts.id}_fin`,
      kind: "final",
      amount: remaining,
      at: timeOffsetDays(-3),
      by: "tn001",
      byName: "Lê Thu Ngân",
      method: "bank",
      note: `Thu nốt phần còn lại đơn ${b.payCode}`
    });
  }

  if (opts.guideId) {
    b.assignment = {
      guideId: opts.guideId,
      status: ["guide_accepted", "in_progress", "completed"].includes(opts.status) ? "accepted" : "assigned",
      assignedBy: "dh001",
      assignedByName: "Trần Điều Hành",
      assignedAt: timeOffsetDays(-3),
      deadline: timeOffsetDays(-1)
    };
  }

  if (opts.reschedule) {
    b.reschedule = opts.reschedule;
  }

  if (opts.extensions) {
    b.extensions = opts.extensions;
  }

  if (opts.status === "completed") {
    b.completedAt = timeOffsetDays(-1);
    b.guidePayout = {
      amount: Math.round(rawPrice * 0.2),
      status: "pending",
      guideId: opts.guideId
    };
  }

  bookings.push(b);
  return b;
}

// A. 4 Bookings PENDING_PAYMENT
makeBooking({ id: "bk_1001", tourId: 101, userId: "cus001", pax: 2, date: daysOffset(todayStr, 7), status: "pending_payment", depositPaid: false, note: "Thanh toán chuyển khoản sau giờ làm" });
makeBooking({ id: "bk_1002", tourId: 102, userId: "cus002", pax: 4, date: daysOffset(todayStr, 10), status: "pending_payment", depositPaid: false, note: "Cần hỗ trợ xuất hóa đơn VAT công ty" });
makeBooking({ id: "bk_1003", tourId: 103, userId: "cus003", pax: 2, date: daysOffset(todayStr, 5), status: "pending_payment", depositPaid: false });
makeBooking({ id: "bk_1004", tourId: 105, userId: "cus004", pax: 3, date: daysOffset(todayStr, 12), status: "pending_payment", depositPaid: false });

// B. 4 Bookings PAID_DEPOSIT (Chờ Admin duyệt đơn)
makeBooking({ id: "bk_1005", tourId: 101, userId: "cus005", pax: 2, date: daysOffset(todayStr, 6), status: "paid_deposit", depositPaid: true, note: "Đã cọc 30% qua Vietcombank" });
makeBooking({ id: "bk_1006", tourId: 102, userId: "cus006", pax: 3, date: daysOffset(todayStr, 8), status: "paid_deposit", depositPaid: true });
makeBooking({ id: "bk_1007", tourId: 106, userId: "cus007", pax: 2, date: daysOffset(todayStr, 9), status: "paid_deposit", depositPaid: true });
makeBooking({ id: "bk_1008", tourId: 107, userId: "cus008", pax: 4, date: daysOffset(todayStr, 14), status: "paid_deposit", depositPaid: true });

// C. 3 Bookings PAID_FULL (Chờ Admin duyệt đơn)
makeBooking({ id: "bk_1009", tourId: 103, userId: "cus009", pax: 2, date: daysOffset(todayStr, 7), status: "paid_full", depositPaid: true, note: "Thanh toán 100% bằng thẻ tín dụng" });
makeBooking({ id: "bk_1010", tourId: 105, userId: "cus010", pax: 2, date: daysOffset(todayStr, 11), status: "paid_full", depositPaid: true });
makeBooking({ id: "bk_1011", tourId: 108, userId: "cus001", pax: 3, date: daysOffset(todayStr, 15), status: "paid_full", depositPaid: true });

// D. 5 Bookings CONFIRMED (Admin đã duyệt, chờ Điều hành phân công HDV / Đổi ngày)
makeBooking({ id: "bk_1012", tourId: 101, userId: "cus002", pax: 2, date: daysOffset(todayStr, 4), status: "confirmed", note: "Chờ phân công HDV kinh nghiệm miền Bắc" });
makeBooking({ id: "bk_1013", tourId: 102, userId: "cus003", pax: 4, date: daysOffset(todayStr, 5), status: "confirmed" });
makeBooking({
  id: "bk_1014", tourId: 103, userId: "cus004", pax: 2, date: daysOffset(todayStr, 6), status: "confirmed",
  reschedule: { status: "requested", from: daysOffset(todayStr, 6), to: daysOffset(todayStr, 16), reason: "Khách bận lịch công tác đột xuất", requestedAt: timeOffsetHours(-4), companyOffer: false }
});
makeBooking({
  id: "bk_1015", tourId: 104, userId: "cus005", pax: 2, date: daysOffset(todayStr, 3), status: "confirmed",
  reschedule: { status: "requested", from: daysOffset(todayStr, 3), to: daysOffset(todayStr, 10), reason: "Gia đình có việc gia đình, xin đổi ngày", requestedAt: timeOffsetHours(-8), companyOffer: false }
});
makeBooking({ id: "bk_1016", tourId: 107, userId: "cus006", pax: 2, date: daysOffset(todayStr, 2), status: "confirmed", note: "Cận ngày đi - cần phân công HDV gấp" });

// E. 4 Bookings GUIDE_PENDING (Điều hành đã giao HDV, HDV chưa bấm Nhận)
makeBooking({ id: "bk_1017", tourId: 101, userId: "cus007", pax: 3, date: daysOffset(todayStr, 3), status: "guide_pending", guideId: "g_hn01", guideName: "Nguyễn Minh Quân", note: "HDV Quân đang xem xét nhận tour" });
makeBooking({ id: "bk_1018", tourId: 102, userId: "cus008", pax: 2, date: daysOffset(todayStr, 4), status: "guide_pending", guideId: "g_hn02", guideName: "Trần Thu Hà" });
makeBooking({ id: "bk_1019", tourId: 104, userId: "cus009", pax: 4, date: daysOffset(todayStr, 5), status: "guide_pending", guideId: "g_mn01", guideName: "Võ Anh Tuấn" });
makeBooking({ id: "bk_1020", tourId: 106, userId: "cus010", pax: 2, date: daysOffset(todayStr, 4), status: "guide_pending", guideId: "g_mt01", guideName: "Lê Hoàng Phúc" });

// F. 4 Bookings GUIDE_ACCEPTED (HDV đã nhận, chuẩn bị đi)
makeBooking({ id: "bk_1021", tourId: 101, userId: "cus001", pax: 2, date: daysOffset(todayStr, 2), status: "guide_accepted", guideId: "g_hn01", guideName: "Nguyễn Minh Quân" });
makeBooking({ id: "bk_1022", tourId: 103, userId: "cus002", pax: 3, date: daysOffset(todayStr, 2), status: "guide_accepted", guideId: "g_hn02", guideName: "Trần Thu Hà" });
makeBooking({ id: "bk_1023", tourId: 105, userId: "cus003", pax: 4, date: daysOffset(todayStr, 3), status: "guide_accepted", guideId: "g_mn02", guideName: "Châu Ngọc Diệp" });
makeBooking({ id: "bk_1024", tourId: 102, userId: "cus004", pax: 2, date: daysOffset(todayStr, 1), status: "guide_accepted", guideId: "g_mt02", guideName: "Nguyễn Thị Mai" });

// G. 3 Bookings IN_PROGRESS (Tour đang đi, test điểm danh & sự cố & gia hạn)
makeBooking({
  id: "bk_1025", tourId: 101, userId: "cus005", pax: 3, date: todayStr, status: "in_progress", guideId: "g_hn01", guideName: "Nguyễn Minh Quân",
  note: "Đoàn đang tham quan Vịnh Hạ Long, đã điểm danh 3/3 khách"
});
makeBooking({
  id: "bk_1026", tourId: 102, userId: "cus006", pax: 4, date: todayStr, status: "in_progress", guideId: "g_mt01", guideName: "Lê Hoàng Phúc",
  extensions: [
    {
      no: 1,
      days: 1,
      amount: 950000,
      status: "requested",
      paymentCode: "EX1026_1",
      requestedAt: timeOffsetHours(-2),
      reason: "Đoàn muốn ở lại Hội An thêm 1 đêm tham quan phố đèn lồng"
    }
  ]
});
makeBooking({
  id: "bk_1027", tourId: 103, userId: "cus007", pax: 2, date: todayStr, status: "in_progress", guideId: "g_hn02", guideName: "Trần Thu Hà",
  note: "Đoàn đang trekking Fansipan"
});

// H. 6 Bookings COMPLETED (Tạo doanh thu thống kê và thù lao HDV)
makeBooking({ id: "bk_1028", tourId: 101, userId: "cus008", pax: 4, date: daysOffset(todayStr, -6), status: "completed", guideId: "g_hn01", guideName: "Nguyễn Minh Quân", createdAt: timeOffsetDays(-12) });
makeBooking({ id: "bk_1029", tourId: 102, userId: "cus009", pax: 3, date: daysOffset(todayStr, -8), status: "completed", guideId: "g_mt01", guideName: "Lê Hoàng Phúc", createdAt: timeOffsetDays(-15) });
makeBooking({ id: "bk_1030", tourId: 103, userId: "cus010", pax: 2, date: daysOffset(todayStr, -10), status: "completed", guideId: "g_hn02", guideName: "Trần Thu Hà", createdAt: timeOffsetDays(-18) });
makeBooking({ id: "bk_1031", tourId: 104, userId: "cus001", pax: 6, date: daysOffset(todayStr, -14), status: "completed", guideId: "g_mn01", guideName: "Võ Anh Tuấn", createdAt: timeOffsetDays(-20) });
makeBooking({ id: "bk_1032", tourId: 105, userId: "cus002", pax: 4, date: daysOffset(todayStr, -20), status: "completed", guideId: "g_mn02", guideName: "Châu Ngọc Diệp", createdAt: timeOffsetDays(-28) });
makeBooking({ id: "bk_1033", tourId: 106, userId: "cus003", pax: 2, date: daysOffset(todayStr, -25), status: "completed", guideId: "g_mt02", guideName: "Nguyễn Thị Mai", createdAt: timeOffsetDays(-35) });

// I. 2 Bookings REFUND_PENDING / CANCELLED
makeBooking({ id: "bk_1034", tourId: 107, userId: "cus004", pax: 2, date: daysOffset(todayStr, -3), status: "refund_pending", note: "Khách hủy do lý do sức khỏe trước 5 ngày, chờ duyệt hoàn 70%" });
makeBooking({ id: "bk_1035", tourId: 108, userId: "cus005", pax: 2, date: daysOffset(todayStr, -15), status: "cancelled", note: "Đã hủy đơn và hoàn tiền" });

fs.writeFileSync(path.join(storageDir, 'bookings.json'), JSON.stringify(bookings, null, 2), 'utf8');
console.log(`[3] Saved bookings.json: ${bookings.length} bookings`);

// ─────────────────────────────────────────────────────────────
// 4. DAILY REVENUES (daily_revenues.json)
// ─────────────────────────────────────────────────────────────
const dailyRevenues = [
  { id: "dr_001", date: daysOffset(todayStr, 0), amount: 4500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Vũ Văn Minh", tourName: "Hà Nội City Tour", payCode: "TVQ001", note: "Khách đăng ký và nộp tiền mặt tại quầy", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetHours(-2), at: timeOffsetHours(-2) },
  { id: "dr_002", date: daysOffset(todayStr, 0), amount: 1200000, kind: "service", kindLabel: "Dịch vụ phát sinh", customerName: "Nguyễn Thị Hoa", tourName: "Đà Nẵng – Hội An", payCode: "TVQ002", note: "Thu thêm tiền nâng cấp phòng khách sạn 5 sao", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetHours(-4), at: timeOffsetHours(-4) },
  { id: "dr_003", date: daysOffset(todayStr, -1), amount: 7600000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Trịnh Bá Thắng", tourName: "Sapa – Fansipan 3N2Đ", payCode: "TVQ003", note: "Thu đủ tiền tour 2 khách thanh toán tiền mặt", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-1), at: timeOffsetDays(-1) },
  { id: "dr_004", date: daysOffset(todayStr, -1), amount: -800000, kind: "refund", kindLabel: "Hoàn tiền", customerName: "Lê Bảo Nam", tourName: "Hà Nội – Hạ Long 3N2Đ", payCode: "TVQ004", note: "Hoàn lại phí vé tàu do bảo trì", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-1), at: timeOffsetDays(-1) },
  { id: "dr_005", date: daysOffset(todayStr, -2), amount: 5500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Phan Quốc Dũng", tourName: "Phú Quốc 4N3Đ", payCode: "TVQ005", note: "Đặt cọc tiền mặt tại văn phòng", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-2), at: timeOffsetDays(-2) },
  { id: "dr_006", date: daysOffset(todayStr, -3), amount: 3800000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Bùi Thị Mai", tourName: "Cần Thơ – Miền Tây", payCode: "TVQ006", note: "Khách lẻ đăng ký ghép đoàn", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-3), at: timeOffsetDays(-3) },
  { id: "dr_007", date: daysOffset(todayStr, -4), amount: 9200000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Công ty TNHH Ánh Dương", tourName: "Đà Lạt 3N2Đ", payCode: "TVQ007", note: "Tạm ứng tour teambuilding 10 người", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-4), at: timeOffsetDays(-4) },
  { id: "dr_008", date: daysOffset(todayStr, -5), amount: 6400000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Nguyễn Hoàng Long", tourName: "Nha Trang Biển Gọi", payCode: "TVQ008", note: "Thu tiền vé máy bay và tour", source: "manual", by: "tn001", byName: "Lê Thu Ngân", byRole: "CASHIER", createdAt: timeOffsetDays(-5), at: timeOffsetDays(-5) }
];
fs.writeFileSync(path.join(storageDir, 'daily_revenues.json'), JSON.stringify(dailyRevenues, null, 2), 'utf8');
console.log(`[4] Saved daily_revenues.json: ${dailyRevenues.length} records`);

// ─────────────────────────────────────────────────────────────
// 5. RECONCILIATIONS (reconciliations.json - Đóng sổ cuối ngày)
// ─────────────────────────────────────────────────────────────
const reconciliations = [
  {
    id: "rec_" + daysOffset(todayStr, -2).replace(/-/g, ""),
    date: daysOffset(todayStr, -2),
    cashierId: "tn001",
    cashierName: "Lê Thu Ngân",
    totalCollected: 12500000,
    totalRefunded: 0,
    netTotal: 12500000,
    bankStatementTotal: 12500000,
    discrepancy: 0,
    transactionCount: 4,
    status: "approved",
    approvedBy: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1),
    note: "Đã khớp sao kê tài khoản Vietcombank và tiền mặt quầy",
    createdAt: timeOffsetDays(-2)
  },
  {
    id: "rec_" + daysOffset(todayStr, -1).replace(/-/g, ""),
    date: daysOffset(todayStr, -1),
    cashierId: "tn001",
    cashierName: "Lê Thu Ngân",
    totalCollected: 18400000,
    totalRefunded: 800000,
    netTotal: 17600000,
    bankStatementTotal: 17600000,
    discrepancy: 0,
    transactionCount: 6,
    status: "pending_approval",
    note: "Khớp sao kê, chờ Admin duyệt đóng sổ ngày hôm qua",
    createdAt: timeOffsetDays(-1)
  }
];
fs.writeFileSync(path.join(storageDir, 'reconciliations.json'), JSON.stringify(reconciliations, null, 2), 'utf8');
console.log(`[5] Saved reconciliations.json: ${reconciliations.length} records`);

// ─────────────────────────────────────────────────────────────
// 6. PAYMENTS (payments.json - Chênh lệch thanh toán / Discrepancies)
// ─────────────────────────────────────────────────────────────
const paymentsDiscrepancies = [
  {
    id: "pay_disc_001",
    bookingId: "bk_1001",
    payCode: "TV1001",
    amount: 1000000,
    content: "Nguyen Van An chuyen tien TV1001",
    status: "mismatch",
    problem: "Thiếu 500.000 ₫",
    reason: "Khách chuyển cọc thiếu: nhận 1.000.000 ₫, tiền cọc cần là 1.500.000 ₫",
    createdAt: timeOffsetHours(-5),
    flaggedBy: "tn001",
    flaggedByName: "Lê Thu Ngân",
    handoff: true,
    dismissed: false
  },
  {
    id: "pay_disc_002",
    bookingId: "",
    payCode: "",
    amount: 2500000,
    content: "CK TIEN TOUR HA LONG KHONG DE MA",
    status: "unmatched",
    problem: "Sai / thiếu mã đặt tour",
    reason: "Giao dịch ngân hàng không ghi rõ mã TV... cần CSKH đối soát người gửi",
    createdAt: timeOffsetHours(-12),
    flaggedBy: "tn001",
    flaggedByName: "Lê Thu Ngân",
    handoff: true,
    dismissed: false
  },
  {
    id: "pay_disc_003",
    bookingId: "bk_1003",
    payCode: "TV1003",
    amount: 2000000,
    content: "Thanh toan du TV1003",
    status: "waiting",
    problem: "Chờ xác nhận phụ phí",
    reason: "Khách chuyển dư 320.000 ₫, đang chờ CSKH liên hệ hoàn lại hoặc quy đổi voucher",
    createdAt: timeOffsetHours(-24),
    flaggedBy: "tn001",
    flaggedByName: "Lê Thu Ngân",
    handoff: true,
    dismissed: false
  }
];
fs.writeFileSync(path.join(storageDir, 'payments.json'), JSON.stringify(paymentsDiscrepancies, null, 2), 'utf8');
console.log(`[6] Saved payments.json: ${paymentsDiscrepancies.length} discrepancy records`);

// ─────────────────────────────────────────────────────────────
// 7. COMPLAINTS (complaints.json - Khiếu nại khách hàng)
// ─────────────────────────────────────────────────────────────
const complaints = [
  {
    id: "cmp_001",
    bookingId: "bk_1028",
    payCode: "TV1028",
    userId: "cus008",
    customerName: "Ngô Gia Khang",
    email: "khang.ngo@gmail.com",
    phone: "0918776655",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    title: "Xe đưa đón đến trễ 45 phút ngày khởi hành",
    content: "Gia đình tôi phải chờ xe đón tại điểm hẹn phố cổ gần 45 phút mà không nhận được thông báo trước, làm ảnh hưởng lịch trình sáng ngày đầu.",
    status: "open",
    createdAt: timeOffsetHours(-6),
    dueAt: timeOffsetHours(18),
    messages: [
      { sender: "customer", senderName: "Ngô Gia Khang", content: "Đề nghị công ty giải thích lý do xe đón muộn.", at: timeOffsetHours(-6) }
    ],
    images: []
  },
  {
    id: "cmp_002",
    bookingId: "bk_1029",
    payCode: "TV1029",
    userId: "cus009",
    customerName: "Đinh Thảo Linh",
    email: "linh.dinh@gmail.com",
    phone: "0922334455",
    tourName: "Đà Nẵng – Hội An 4N3Đ",
    title: "Phòng khách sạn tại Hội An bị ồn do công trình bên cạnh",
    content: "Đêm thứ hai khách sạn gần công trình sửa chữa rất ồn, đoàn mất ngủ. Hướng dẫn viên đã hỗ trợ đổi phòng nhưng CSKH cần có chính sách đền bù thỏa đáng.",
    status: "in_progress",
    createdAt: timeOffsetDays(-2),
    dueAt: timeOffsetHours(4),
    messages: [
      { sender: "customer", senderName: "Đinh Thảo Linh", content: "Đề nghị hoàn một phần tiền phòng đêm đó.", at: timeOffsetDays(-2) },
      { sender: "support", senderName: "Phạm Chăm Sóc", content: "Chào chị Linh, Travel chân thành xin lỗi vì sự bất tiện này. Bên em đang đề xuất Ban Giám Đốc voucher đền bù 500.000₫ cho chuyến đi tiếp theo.", at: timeOffsetDays(-1) }
    ],
    proposedRefund: 500000,
    images: []
  },
  {
    id: "cmp_003",
    bookingId: "bk_1030",
    payCode: "TV1030",
    userId: "cus010",
    customerName: "Vũ Trọng Nam",
    email: "nam.vu@gmail.com",
    phone: "0933445566",
    tourName: "Sapa – Fansipan 3N2Đ",
    title: "Chất lượng bữa ăn ngày 2 chưa tương xứng",
    content: "Bữa trưa tại nhà hàng Sapa ngày 2 các món ra nguội và thiếu món đặc sản cá hồi như cam kết trong lịch trình.",
    status: "resolved",
    createdAt: timeOffsetDays(-7),
    dueAt: timeOffsetDays(-5),
    resolvedAt: timeOffsetDays(-6),
    resolution: "Đã tặng voucher ẩm thực 300.000₫ và khách đã hài lòng chấp nhận.",
    messages: [
      { sender: "customer", senderName: "Vũ Trọng Nam", content: "Bữa ăn ngày 2 không đúng thực đơn cam kết.", at: timeOffsetDays(-7) },
      { sender: "support", senderName: "Phạm Chăm Sóc", content: "Travel đã kiểm tra với nhà hàng và gửi tặng quý khách voucher 300.000₫ kèm lời xin lỗi.", at: timeOffsetDays(-6) }
    ],
    images: []
  }
];
fs.writeFileSync(path.join(storageDir, 'complaints.json'), JSON.stringify(complaints, null, 2), 'utf8');
console.log(`[7] Saved complaints.json: ${complaints.length} complaints`);

// ─────────────────────────────────────────────────────────────
// 8. WAITLIST (waitlist.json - Danh sách chờ tour)
// ─────────────────────────────────────────────────────────────
const waitlist = [
  {
    id: "wl_001",
    tourId: 103,
    tourName: "Sapa – Fansipan 3N2Đ",
    date: daysOffset(todayStr, 8),
    pax: 2,
    userId: "cus001",
    name: "Nguyễn Văn An",
    email: "an.nguyen@gmail.com",
    phone: "0912345678",
    status: "waiting",
    createdAt: timeOffsetDays(-1)
  },
  {
    id: "wl_002",
    tourId: 105,
    tourName: "Phú Quốc 4N3Đ",
    date: daysOffset(todayStr, 12),
    pax: 4,
    userId: "cus002",
    name: "Trần Thị Bình",
    email: "binh.tran@gmail.com",
    phone: "0987654321",
    status: "waiting",
    createdAt: timeOffsetDays(-2)
  },
  {
    id: "wl_003",
    tourId: 101,
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    date: daysOffset(todayStr, 15),
    pax: 2,
    userId: "cus003",
    name: "Lê Hoàng Cường",
    email: "cuong.le@gmail.com",
    phone: "0903123456",
    status: "notified",
    notifiedAt: timeOffsetHours(-3),
    createdAt: timeOffsetDays(-3)
  }
];
fs.writeFileSync(path.join(storageDir, 'waitlist.json'), JSON.stringify(waitlist, null, 2), 'utf8');
console.log(`[8] Saved waitlist.json: ${waitlist.length} waitlist records`);

// ─────────────────────────────────────────────────────────────
// 9. WITHDRAWALS (withdrawals.json - Yêu cầu rút tiền ví)
// ─────────────────────────────────────────────────────────────
const withdrawals = [
  {
    id: "wd_001",
    userId: "cus007",
    userName: "Bùi Tuấn Hùng",
    userRole: "customer",
    amount: 1000000,
    bankName: "Vietcombank",
    accountNumber: "0011004567890",
    accountHolder: "BUI TUAN HUNG",
    note: "Rút tiền hoàn từ tour bị hủy",
    status: "pending",
    createdAt: timeOffsetHours(-4)
  },
  {
    id: "wd_002",
    userId: "hdv001",
    userName: "Nguyễn Minh Quân",
    userRole: "guide",
    amount: 5000000,
    bankName: "Techcombank",
    accountNumber: "19034567899012",
    accountHolder: "NGUYEN MINH QUAN",
    note: "Rút thù lao dẫn tour tháng 10",
    status: "pending",
    createdAt: timeOffsetHours(-8)
  },
  {
    id: "wd_003",
    userId: "cus006",
    userName: "Đỗ Hương Giang",
    userRole: "customer",
    amount: 800000,
    bankName: "MB Bank",
    accountNumber: "0945667788",
    accountHolder: "DO HUONG GIANG",
    note: "Rút tiền tích lũy điểm thưởng",
    status: "approved",
    handledBy: "tn001",
    handledByName: "Lê Thu Ngân",
    handledAt: timeOffsetDays(-1),
    adminNote: "Đã chuyển khoản thành công qua mã GD MB89912",
    createdAt: timeOffsetDays(-2)
  }
];
fs.writeFileSync(path.join(storageDir, 'withdrawals.json'), JSON.stringify(withdrawals, null, 2), 'utf8');
console.log(`[9] Saved withdrawals.json: ${withdrawals.length} withdrawals`);

// ─────────────────────────────────────────────────────────────
// 10. TOUR DRAFTS (tour-drafts.json - Bản nháp tour của Biên tập viên)
// ─────────────────────────────────────────────────────────────
const tourDrafts = [
  {
    id: "td_001",
    tourId: "tour_lan_ha",
    isNew: true,
    fields: {
      name: "Khám Phá Vịnh Lan Hạ – Đảo Cát Bà 2N1Đ",
      region: "Miền Bắc",
      destination: "Cát Bà, Hải Phòng",
      duration: "2 ngày 1 đêm",
      price: 2190000,
      highlight: "Chèo thuyền kayak qua hang Sáng Tối, ngắm hoàng hôn trên vịnh Lan Hạ, tắm biển bãi Cát Cò",
      description: "Tour trải nghiệm biển đảo hoang sơ tuyệt đẹp của vịnh Lan Hạ kết hợp khám phá Vườn quốc gia Cát Bà.",
      itinerary: [
        { day: 1, title: "Hà Nội – Bến Bèo – Vịnh Lan Hạ", desc: "Đón khách tại Hà Nội, khởi hành đi Hải Phòng, lên tàu thăm vịnh Lan Hạ, chèo thuyền kayak." },
        { day: 2, title: "Làng chài Việt Hải – Hà Nội", desc: "Đạp xe thăm làng chài cổ Việt Hải, thưởng thức bữa trưa hải sản rồi trở về Hà Nội." }
      ]
    },
    createdBy: "nd001",
    createdByName: "Hoàng Biên Tập",
    createdAt: timeOffsetDays(-3),
    updatedAt: timeOffsetHours(-5),
    status: "pending" // Chờ Admin duyệt xuất bản
  },
  {
    id: "td_002",
    tourId: 101,
    isNew: false,
    fields: {
      name: "Hà Nội – Hạ Long 3N2Đ (Cập nhật mùa đông 2026)",
      highlight: "Bổ sung tắm suối khoáng nóng Quang Hanh Yoko Onsen và tiệc nướng BBQ trên du thuyền 5 sao"
    },
    createdBy: "nd001",
    createdByName: "Hoàng Biên Tập",
    createdAt: timeOffsetDays(-1),
    updatedAt: timeOffsetHours(-2),
    status: "draft"
  }
];
fs.writeFileSync(path.join(storageDir, 'tour-drafts.json'), JSON.stringify(tourDrafts, null, 2), 'utf8');
console.log(`[10] Saved tour-drafts.json: ${tourDrafts.length} drafts`);

// ─────────────────────────────────────────────────────────────
// 11. INCIDENTS (incidents.json - Sự cố đoàn tour)
// ─────────────────────────────────────────────────────────────
const incidents = [
  {
    id: "inc_001",
    bookingId: "bk_1025",
    payCode: "TV1025",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    date: todayStr,
    type: "vehicle",
    severity: "high",
    description: "Xe 29 chỗ bị hỏng điều hòa trên cao tốc Hà Nội - Hải Phòng, thời tiết nóng bức khách phàn nàn, cần xe thay thế tại trạm dừng chân.",
    status: "open",
    reportedBy: "hdv001",
    reportedByName: "Nguyễn Minh Quân",
    guideId: "g_hn01",
    createdAt: timeOffsetHours(-2)
  },
  {
    id: "inc_002",
    bookingId: "bk_1027",
    payCode: "TV1027",
    tourName: "Sapa – Fansipan 3N2Đ",
    date: todayStr,
    type: "health",
    severity: "medium",
    description: "1 du khách bị say xe và đau đầu nhẹ khi lên đèo Ô Quy Hồ, HDV đã cho uống trà gừng và nghỉ ngơi tại quán dừng chân.",
    status: "acknowledged",
    handledBy: "dh001",
    handledByName: "Trần Điều Hành",
    handledAt: timeOffsetHours(-1),
    resolution: "Điều hành đã gọi điện hỏi thăm khách, HDV theo dõi sát sao.",
    reportedBy: "hdv002",
    reportedByName: "Trần Thu Hà",
    guideId: "g_hn02",
    createdAt: timeOffsetHours(-3)
  },
  {
    id: "inc_003",
    bookingId: "bk_1028",
    payCode: "TV1028",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    date: daysOffset(todayStr, -6),
    type: "weather",
    severity: "low",
    description: "Mưa lớn bất chợt tại cảng Tuần Châu làm hoãn giờ xuất bến 30 phút.",
    status: "resolved",
    handledBy: "dh001",
    handledByName: "Trần Điều Hành",
    handledAt: daysOffset(todayStr, -6),
    resolution: "Cảng vụ cho phép xuất bến lúc 12h45, tour hoàn thành trọn vẹn đúng lịch trình.",
    reportedBy: "hdv001",
    reportedByName: "Nguyễn Minh Quân",
    guideId: "g_hn01",
    createdAt: daysOffset(todayStr, -6)
  }
];
fs.writeFileSync(path.join(storageDir, 'incidents.json'), JSON.stringify(incidents, null, 2), 'utf8');
console.log(`[11] Saved incidents.json: ${incidents.length} incidents`);

// ─────────────────────────────────────────────────────────────
// 12. CANCEL PROPOSALS (cancelproposals.json - Đề xuất hủy chuyến)
// ─────────────────────────────────────────────────────────────
const cancelproposals = [
  {
    id: "cp_001",
    tourId: "104",
    tourName: "Cần Thơ – Miền Tây 2N1Đ",
    date: daysOffset(todayStr, 5),
    pax: 2,
    minGuests: 10,
    reason: "Chuyến chỉ có 2 khách đăng ký (tối thiểu 10 khách để khởi hành). Điều hành đề xuất hủy chuyến để tư vấn khách đổi sang tuần sau hoặc hoàn tiền 100%.",
    status: "pending",
    proposedBy: "dh001",
    proposedByName: "Trần Điều Hành",
    createdAt: timeOffsetHours(-5)
  }
];
fs.writeFileSync(path.join(storageDir, 'cancelproposals.json'), JSON.stringify(cancelproposals, null, 2), 'utf8');
console.log(`[12] Saved cancelproposals.json: ${cancelproposals.length} proposals`);

// ─────────────────────────────────────────────────────────────
// 13. SALARY LOGS (salary_logs.json - Lịch sử phát lương / thưởng / phạt)
// ─────────────────────────────────────────────────────────────
const salaryLogs = [
  {
    id: "sal_log_001",
    type: "pay",
    staffId: "tn001",
    staffName: "Lê Thu Ngân",
    role: "cashier",
    amount: 15000000,
    note: "Phát lương định kỳ tháng 10/2026",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-25)
  },
  {
    id: "sal_log_002",
    type: "pay",
    staffId: "dh001",
    staffName: "Trần Điều Hành",
    role: "operator",
    amount: 18000000,
    note: "Phát lương định kỳ tháng 10/2026",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-25)
  },
  {
    id: "sal_log_003",
    type: "pay",
    staffId: "cs001",
    staffName: "Phạm Chăm Sóc",
    role: "support",
    amount: 14000000,
    note: "Phát lương định kỳ tháng 10/2026",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-25)
  },
  {
    id: "sal_log_004",
    type: "pay",
    staffId: "nd001",
    staffName: "Hoàng Biên Tập",
    role: "content",
    amount: 16000000,
    note: "Phát lương định kỳ tháng 10/2026",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-25)
  },
  {
    id: "sal_log_005",
    type: "bonus",
    staffId: "cs001",
    staffName: "Phạm Chăm Sóc",
    role: "support",
    amount: 1000000,
    note: "Thưởng nóng xử lý xuất sắc khiếu nại khách quốc tế",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-10)
  },
  {
    id: "sal_log_006",
    type: "penalty",
    staffId: "dh001",
    staffName: "Trần Điều Hành",
    role: "operator",
    amount: 200000,
    note: "Trừ 200k do chậm phân công HDV cận giờ khởi hành",
    by: "ad001",
    byName: "Quản Trị Viên",
    at: timeOffsetDays(-8)
  }
];
fs.writeFileSync(path.join(storageDir, 'salary_logs.json'), JSON.stringify(salaryLogs, null, 2), 'utf8');
console.log(`[13] Saved salary_logs.json: ${salaryLogs.length} logs`);

// ─────────────────────────────────────────────────────────────
// 14. DEPARTURES (departures.json - Lịch khởi hành mở sẵn)
// ─────────────────────────────────────────────────────────────
const departures = [
  { id: `101@${daysOffset(todayStr, 7)}`, tourId: "101", date: daysOffset(todayStr, 7), status: "open", capacity: 25, updatedBy: "dh001", updatedAt: timeOffsetDays(-2) },
  { id: `102@${daysOffset(todayStr, 10)}`, tourId: "102", date: daysOffset(todayStr, 10), status: "open", capacity: 20, updatedBy: "dh001", updatedAt: timeOffsetDays(-2) },
  { id: `103@${daysOffset(todayStr, 6)}`, tourId: "103", date: daysOffset(todayStr, 6), status: "open", capacity: 22, updatedBy: "dh001", updatedAt: timeOffsetDays(-2) },
  { id: `104@${daysOffset(todayStr, 5)}`, tourId: "104", date: daysOffset(todayStr, 5), status: "open", capacity: 25, updatedBy: "dh001", updatedAt: timeOffsetDays(-3) },
  { id: `105@${daysOffset(todayStr, 12)}`, tourId: "105", date: daysOffset(todayStr, 12), status: "open", capacity: 18, updatedBy: "dh001", updatedAt: timeOffsetDays(-1) },
  { id: `107@${daysOffset(todayStr, 14)}`, tourId: "107", date: daysOffset(todayStr, 14), status: "open", capacity: 25, updatedBy: "dh001", updatedAt: timeOffsetDays(-1) }
];
fs.writeFileSync(path.join(storageDir, 'departures.json'), JSON.stringify(departures, null, 2), 'utf8');
console.log(`[14] Saved departures.json: ${departures.length} departures`);

// ─────────────────────────────────────────────────────────────
// 15. REFUNDS (refunds.json - Quản lý hồ sơ hoàn tiền)
// ─────────────────────────────────────────────────────────────
const refunds = [
  {
    id: "rf_001",
    bookingId: "bk_1034",
    payCode: "TV1034",
    source: "customer_cancel",
    amount: 3500000,
    status: "pending_approval", // Admin chờ duyệt
    reason: "Khách hủy trước 5 ngày do ốm đau, hoàn 70% giá trị tour",
    requestedById: "cus004",
    requestedByName: "Phạm Thùy Dung",
    requestedRole: "customer",
    requestedAt: timeOffsetHours(-10),
    full: true
  },
  {
    id: "rf_002",
    bookingId: "bk_1035",
    payCode: "TV1035",
    source: "company_cancel",
    amount: 6400000,
    status: "approved", // Admin đã duyệt, chờ Thu ngân chi
    reason: "Công ty hủy tour do bão, hoàn lại 100% cho khách",
    requestedById: "dh001",
    requestedByName: "Trần Điều Hành",
    requestedRole: "operator",
    requestedAt: timeOffsetDays(-2),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1),
    full: true
  },
  {
    id: "rf_003",
    bookingId: "bk_1029",
    payCode: "TV1029",
    source: "complaint",
    amount: 500000,
    status: "paid", // Thu ngân đã chi
    reason: "Đền bù khiếu nại phòng khách sạn ồn",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "support",
    requestedAt: timeOffsetDays(-3),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-2),
    paidById: "tn001",
    paidByName: "Lê Thu Ngân",
    paidAt: timeOffsetDays(-1),
    full: false
  }
];
fs.writeFileSync(path.join(storageDir, 'refunds.json'), JSON.stringify(refunds, null, 2), 'utf8');
console.log(`[15] Saved refunds.json: ${refunds.length} refund records`);

console.log("\n✅ All mock data generated successfully in backend/storage/!");
