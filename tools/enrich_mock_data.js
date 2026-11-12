/**
 * Enrich mock data for:
 * 1. Guide accounts linking (root guideId: g1..g16)
 * 2. Today (2026-11-10) and Tomorrow (2026-11-11) pending bookings & balance due bookings for Cashier
 * 3. Daily revenues for 2026-11-01 to 2026-11-10 (including today morning transactions)
 * 4. Active reschedule requests for CSKH and Operator
 * 5. Realistic complaints for CSKH
 * 6. Payment discrepancies handed off to CSKH
 * 7. Cancel proposals for Operator and Admin
 * 8. Reconciliations for Cashier and Admin
 * 9. HDV003 (g3) active tour offers, upcoming, running, and completed tours with fees
 */

const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, '../backend/storage'),
  path.join(__dirname, '../backend/storage/db'),
  path.join(__dirname, '../storage/db'),
  path.join(__dirname, '../frontend/data/mock')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJson(name) {
  const p = path.join(__dirname, '../storage/db', name);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return [];
}

function saveJson(name, data) {
  const content = JSON.stringify(data, null, 2);
  for (const dir of targetDirs) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8');
  }
  console.log(`[SAVED] ${name}: ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
}

const TODAY_STR = "2026-11-10";
const TOMORROW_STR = "2026-11-11";

// 1. UPDATE ACCOUNTS
const accounts = loadJson('accounts.json');
accounts.forEach(a => {
  if (a.role === 'guide') {
    const num = parseInt(a.id.replace('hdv', ''), 10);
    const gid = (a.guideProfile && a.guideProfile.guideId) || ('g' + num);
    a.guideId = gid;
    if (!a.guideProfile) {
      a.guideProfile = { guideId: gid, guideType: "all", employmentType: "permanent", rating: 4.8, toursCount: 20 };
    } else {
      a.guideProfile.guideId = gid;
    }
    if (a.id === 'hdv003') {
      a.balance = 12500000;
      a.totalEarned = 58500000;
    } else if (!a.balance || a.balance === 0) {
      a.balance = 6500000;
      a.totalEarned = 35000000;
    }
  }
});
saveJson('accounts.json', accounts);

// 2. UPDATE BOOKINGS
const bookings = loadJson('bookings.json');

// Ensure all existing bookings have normalized guideId
bookings.forEach(b => {
  if (b.guideId && b.guideId.startsWith('hdv')) {
    const num = parseInt(b.guideId.replace('hdv', ''), 10);
    b.guideId = 'g' + num;
  }
});

// Remove previously generated test bookings if any
const cleanBookings = bookings.filter(b => !['bk_1060', 'bk_1061', 'bk_1062', 'bk_1063', 'bk_1064', 'bk_1070', 'bk_1071', 'bk_1072', 'bk_1073', 'bk_1080', 'bk_1081', 'bk_1082', 'bk_1084', 'bk_1085', 'bk_1086'].includes(b.id));

const newBookings = [
  // ── TODAY (2026-11-10): Chờ thu tiền (pending_payment) ──
  {
    id: "bk_1060",
    payCode: "TV1060",
    tourId: "101",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    tourDest: "Hạ Long",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus001",
    userEmail: "an.nguyen@gmail.com",
    customerName: "Nguyễn Văn Tuấn",
    phone: "0912345001",
    date: "2026-11-18",
    adults: 3,
    kids: 0,
    pax: 3,
    price: 5400000,
    deposit: 1620000,
    status: "pending_payment",
    note: "[Hôm nay 10/11] Khách hẹn chuyển khoản Vietcombank trong ngày",
    createdAt: "2026-11-10T08:30:00Z",
    payments: [],
    history: [{ status: "pending_payment", at: "2026-11-10T08:30:00Z", by: "Nguyễn Văn Tuấn", role: "CUSTOMER", note: "Đặt tour trực tuyến" }]
  },
  {
    id: "bk_1061",
    payCode: "TV1061",
    tourId: "105",
    tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ",
    tourDest: "Phú Quốc",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Nam",
    userId: "cus002",
    userEmail: "bich.tran@gmail.com",
    customerName: "Trần Thị Mai",
    phone: "0912345002",
    date: "2026-11-20",
    adults: 2,
    kids: 0,
    pax: 2,
    price: 8200000,
    deposit: 2460000,
    status: "pending_payment",
    note: "[Hôm nay 10/11] Khách thanh toán tại quầy chi nhánh",
    createdAt: "2026-11-10T09:15:00Z",
    payments: [],
    history: [{ status: "pending_payment", at: "2026-11-10T09:15:00Z", by: "Trần Thị Mai", role: "CUSTOMER", note: "Đặt tour tại quầy" }]
  },
  {
    id: "bk_1062",
    payCode: "TV1062",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    tourDest: "Đà Nẵng",
    tourDuration: "4 ngày 3 đêm",
    tourDays: 4,
    tourRegion: "Miền Trung",
    userId: "cus003",
    userEmail: "cuong.le@gmail.com",
    customerName: "Lê Hoàng Quân",
    phone: "0912345003",
    date: "2026-11-22",
    adults: 4,
    kids: 0,
    pax: 4,
    price: 9900000,
    deposit: 2970000,
    status: "pending_payment",
    note: "[Hôm nay 10/11] Khách chuyển khoản Techcombank qua mã QR",
    createdAt: "2026-11-10T10:00:00Z",
    payments: [],
    history: [{ status: "pending_payment", at: "2026-11-10T10:00:00Z", by: "Lê Hoàng Quân", role: "CUSTOMER", note: "Đặt tour trực tuyến" }]
  },

  // ── TODAY (2026-11-10): Chờ thu nốt (balance due today) ──
  {
    id: "bk_1063",
    payCode: "TV1063",
    tourId: "106",
    tourName: "TP.HCM – Miền Tây Sông Nước 2N1Đ",
    tourDest: "Cần Thơ",
    tourDuration: "2 ngày 1 đêm",
    tourDays: 2,
    tourRegion: "Miền Nam",
    userId: "cus004",
    userEmail: "linh.pham@gmail.com",
    customerName: "Phạm Thu Hằng",
    phone: "0912345004",
    date: "2026-11-15",
    adults: 2,
    kids: 0,
    pax: 2,
    price: 4000000,
    deposit: 1200000,
    depositPaid: true,
    fullPaid: false,
    finalPaid: false,
    balanceDueDate: "2026-11-10",
    status: "confirmed",
    confirmedAt: "2026-11-06T10:00:00Z",
    note: "[Hôm nay 10/11 - Hạn chót thu nốt] Cần thu phần còn lại 2.800.000 ₫",
    createdAt: "2026-11-05T09:00:00Z",
    payments: [
      { id: "pay_1063_dep", kind: "deposit", amount: 1200000, at: "2026-11-05T10:00:00Z", by: "tn001", byName: "Lê Thu Ngân", method: "bank" }
    ],
    history: [
      { status: "pending_payment", at: "2026-11-05T09:00:00Z", by: "Phạm Thu Hằng", role: "CUSTOMER", note: "Đặt tour" },
      { status: "paid_deposit", at: "2026-11-05T10:00:00Z", by: "Lê Thu Ngân", role: "CASHIER", note: "Thu ngân nhận cọc 1.200.000 ₫" },
      { status: "confirmed", at: "2026-11-06T10:00:00Z", by: "Quản Trị Viên", role: "ADMIN", note: "Admin duyệt đơn" }
    ]
  },
  {
    id: "bk_1064",
    payCode: "TV1064",
    tourId: "102",
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    tourDest: "Sa Pa",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus005",
    userEmail: "kiet.hoang@gmail.com",
    customerName: "Vũ Đức Thắng",
    phone: "0912345005",
    date: "2026-11-16",
    adults: 4,
    kids: 0,
    pax: 4,
    price: 6500000,
    deposit: 2000000,
    depositPaid: true,
    fullPaid: false,
    finalPaid: false,
    balanceDueDate: "2026-11-10",
    status: "confirmed",
    confirmedAt: "2026-11-06T11:00:00Z",
    note: "[Hôm nay 10/11 - Hạn chót thu nốt] Cần thu phần còn lại 4.500.000 ₫",
    createdAt: "2026-11-05T11:00:00Z",
    payments: [
      { id: "pay_1064_dep", kind: "deposit", amount: 2000000, at: "2026-11-05T11:30:00Z", by: "tn001", byName: "Lê Thu Ngân", method: "bank" }
    ],
    history: [
      { status: "pending_payment", at: "2026-11-05T11:00:00Z", by: "Vũ Đức Thắng", role: "CUSTOMER", note: "Đặt tour" },
      { status: "paid_deposit", at: "2026-11-05T11:30:00Z", by: "Lê Thu Ngân", role: "CASHIER", note: "Thu ngân nhận cọc 2.000.000 ₫" },
      { status: "confirmed", at: "2026-11-06T11:00:00Z", by: "Quản Trị Viên", role: "ADMIN", note: "Admin duyệt đơn" }
    ]
  },

  // ── TOMORROW (2026-11-11): Chờ thu tiền (Test ngày mai) ──
  {
    id: "bk_1070",
    payCode: "TV1070",
    tourId: "104",
    tourName: "Đà Lạt – Thành Phố Ngàn Hoa 3N2Đ",
    tourDest: "Đà Lạt",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Tây Nguyên",
    userId: "cus006",
    userEmail: "hanh.dang@gmail.com",
    customerName: "Đặng Văn Lâm",
    phone: "0912345006",
    date: "2026-11-25",
    adults: 2,
    kids: 0,
    pax: 2,
    price: 6800000,
    deposit: 2040000,
    status: "pending_payment",
    note: "[Ngày mai 11/11 TEST] Khách hẹn chuyển khoản sáng mai",
    createdAt: "2026-11-11T08:00:00Z",
    payments: [],
    history: [{ status: "pending_payment", at: "2026-11-11T08:00:00Z", by: "Đặng Văn Lâm", role: "CUSTOMER", note: "Đặt tour" }]
  },
  {
    id: "bk_1071",
    payCode: "TV1071",
    tourId: "101",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    tourDest: "Hạ Long",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus007",
    userEmail: "bao.vu@gmail.com",
    customerName: "Bùi Tiến Dũng",
    phone: "0912345007",
    date: "2026-11-26",
    adults: 3,
    kids: 0,
    pax: 3,
    price: 3200000,
    deposit: 960000,
    status: "pending_payment",
    note: "[Ngày mai 11/11 TEST] Thu đủ 100% tại quầy vé",
    createdAt: "2026-11-11T09:00:00Z",
    payments: [],
    history: [{ status: "pending_payment", at: "2026-11-11T09:00:00Z", by: "Bùi Tiến Dũng", role: "CUSTOMER", note: "Đặt tour" }]
  },

  // ── TOMORROW (2026-11-11): Chờ thu nốt (balance due tomorrow) ──
  {
    id: "bk_1072",
    payCode: "TV1072",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    tourDest: "Đà Nẵng",
    tourDuration: "4 ngày 3 đêm",
    tourDays: 4,
    tourRegion: "Miền Trung",
    userId: "cus008",
    userEmail: "khang.ngo@gmail.com",
    customerName: "Nguyễn Quang Hải",
    phone: "0912345008",
    date: "2026-11-17",
    adults: 3,
    kids: 0,
    pax: 3,
    price: 8000000,
    deposit: 2400000,
    depositPaid: true,
    fullPaid: false,
    finalPaid: false,
    balanceDueDate: "2026-11-11",
    status: "confirmed",
    confirmedAt: "2026-11-07T10:00:00Z",
    note: "[Ngày mai 11/11 TEST] Chờ thu nốt 5.600.000 ₫",
    createdAt: "2026-11-06T10:00:00Z",
    payments: [
      { id: "pay_1072_dep", kind: "deposit", amount: 2400000, at: "2026-11-06T10:30:00Z", by: "tn001", byName: "Lê Thu Ngân", method: "bank" }
    ],
    history: [
      { status: "pending_payment", at: "2026-11-06T10:00:00Z", by: "Nguyễn Quang Hải", role: "CUSTOMER", note: "Đặt tour" },
      { status: "paid_deposit", at: "2026-11-06T10:30:00Z", by: "Lê Thu Ngân", role: "CASHIER", note: "Nhận cọc 2.400.000 ₫" },
      { status: "confirmed", at: "2026-11-07T10:00:00Z", by: "Quản Trị Viên", role: "ADMIN", note: "Duyệt đơn" }
    ]
  },
  {
    id: "bk_1073",
    payCode: "TV1073",
    tourId: "105",
    tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ",
    tourDest: "Phú Quốc",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Nam",
    userId: "cus009",
    userEmail: "mai.bui@gmail.com",
    customerName: "Đoàn Văn Hậu",
    phone: "0912345009",
    date: "2026-11-18",
    adults: 2,
    kids: 0,
    pax: 2,
    price: 5300000,
    deposit: 1600000,
    depositPaid: true,
    fullPaid: false,
    finalPaid: false,
    balanceDueDate: "2026-11-11",
    status: "confirmed",
    confirmedAt: "2026-11-07T14:00:00Z",
    note: "[Ngày mai 11/11 TEST] Chờ thu nốt 3.700.000 ₫",
    createdAt: "2026-11-06T14:00:00Z",
    payments: [
      { id: "pay_1073_dep", kind: "deposit", amount: 1600000, at: "2026-11-06T14:30:00Z", by: "tn001", byName: "Lê Thu Ngân", method: "bank" }
    ],
    history: [
      { status: "pending_payment", at: "2026-11-06T14:00:00Z", by: "Đoàn Văn Hậu", role: "CUSTOMER", note: "Đặt tour" },
      { status: "paid_deposit", at: "2026-11-06T14:30:00Z", by: "Lê Thu Ngân", role: "CASHIER", note: "Nhận cọc 1.600.000 ₫" },
      { status: "confirmed", at: "2026-11-07T14:00:00Z", by: "Quản Trị Viên", role: "ADMIN", note: "Duyệt đơn" }
    ]
  },

  // ── RESCHEDULE REQUESTS (Cho CSKH & Điều hành duyệt đổi ngày) ──
  {
    id: "bk_1080",
    payCode: "TV1080",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    tourDest: "Đà Nẵng",
    tourDuration: "4 ngày 3 đêm",
    tourDays: 4,
    tourRegion: "Miền Trung",
    userId: "cus001",
    userEmail: "an.nguyen@gmail.com",
    customerName: "Trần Minh Tâm",
    phone: "0912345001",
    date: "2026-11-15",
    adults: 3,
    kids: 0,
    pax: 3,
    price: 7500000,
    deposit: 2250000,
    depositPaid: true,
    fullPaid: true,
    status: "paid_full",
    guideId: "g4",
    guideName: "Phạm Minh Đức",
    reschedule: {
      to: "2026-12-05",
      reason: "Gia đình có việc bận đột xuất muốn dời sang đầu tháng 12",
      status: "requested",
      requestedAt: "2026-11-10T09:00:00Z"
    },
    note: "Khách xin đổi ngày đi sang 05/12",
    createdAt: "2026-11-01T10:00:00Z",
    payments: [{ id: "pay_1080_full", kind: "full", amount: 7500000, at: "2026-11-01T10:30:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  },
  {
    id: "bk_1081",
    payCode: "TV1081",
    tourId: "105",
    tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ",
    tourDest: "Phú Quốc",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Nam",
    userId: "cus002",
    userEmail: "bich.tran@gmail.com",
    customerName: "Lê Thúy Nga",
    phone: "0912345002",
    date: "2026-11-18",
    adults: 2,
    kids: 0,
    pax: 2,
    price: 8400000,
    deposit: 2520000,
    depositPaid: true,
    fullPaid: true,
    status: "paid_full",
    guideId: "g6",
    guideName: "Đặng Hữu Phúc",
    reschedule: {
      to: "2026-11-28",
      reason: "Chuyến bay từ nước ngoài về bị hoãn 3 ngày",
      status: "requested",
      requestedAt: "2026-11-10T10:30:00Z"
    },
    note: "Khách xin lùi lịch 10 ngày do delay chuyến bay",
    createdAt: "2026-11-02T11:00:00Z",
    payments: [{ id: "pay_1081_full", kind: "full", amount: 8400000, at: "2026-11-02T11:30:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  },
  {
    id: "bk_1082",
    payCode: "TV1082",
    tourId: "102",
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    tourDest: "Sa Pa",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus003",
    userEmail: "cuong.le@gmail.com",
    customerName: "Hoàng Kim Oanh",
    phone: "0912345003",
    date: "2026-11-20",
    adults: 4,
    kids: 0,
    pax: 4,
    price: 6600000,
    deposit: 1980000,
    depositPaid: true,
    fullPaid: true,
    status: "paid_full",
    guideId: "g1",
    guideName: "Trần Văn Quân",
    reschedule: {
      to: "2026-12-10",
      reason: "Trùng kỳ thi học kỳ của con",
      status: "requested",
      requestedAt: "2026-11-11T08:15:00Z"
    },
    note: "Khách xin đổi lịch sang giữa tháng 12",
    createdAt: "2026-11-03T09:00:00Z",
    payments: [{ id: "pay_1082_full", kind: "full", amount: 6600000, at: "2026-11-03T09:30:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  },

  // ── TOURS FOR HDV003 (g3 - Lê Hoàng Long) ──
  {
    id: "bk_1084",
    payCode: "TV1084",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    tourDest: "Đà Nẵng",
    tourDuration: "4 ngày 3 đêm",
    tourDays: 4,
    tourRegion: "Miền Trung",
    userId: "cus004",
    customerName: "Lê Hoàng Long (Đoàn)",
    phone: "0912345004",
    date: "2026-11-14",
    pax: 15,
    adults: 15,
    price: 35000000,
    status: "guide_pending",
    guideId: "g3",
    guideName: "Lê Hoàng Long",
    assignment: {
      guideId: "g3",
      status: "pending",
      assignedAt: "2026-11-10T08:00:00Z",
      assignedBy: "dh001",
      deadline: "2026-11-11T18:00:00Z"
    },
    createdAt: "2026-11-08T09:00:00Z",
    payments: [{ id: "pay_1084", kind: "full", amount: 35000000, at: "2026-11-08T10:00:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  },
  {
    id: "bk_1085",
    payCode: "TV1085",
    tourId: "102",
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    tourDest: "Sa Pa",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus005",
    customerName: "Phạm Diệu Linh (Đoàn)",
    phone: "0912345005",
    date: "2026-11-12",
    pax: 12,
    adults: 12,
    price: 28000000,
    status: "guide_accepted",
    guideId: "g3",
    guideName: "Lê Hoàng Long",
    assignment: {
      guideId: "g3",
      status: "accepted",
      assignedAt: "2026-11-08T10:00:00Z",
      respondedAt: "2026-11-08T11:00:00Z",
      assignedBy: "dh001"
    },
    createdAt: "2026-11-07T09:00:00Z",
    payments: [{ id: "pay_1085", kind: "full", amount: 28000000, at: "2026-11-07T10:00:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  },
  {
    id: "bk_1086",
    payCode: "TV1086",
    tourId: "101",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    tourDest: "Hạ Long",
    tourDuration: "3 ngày 2 đêm",
    tourDays: 3,
    tourRegion: "Miền Bắc",
    userId: "cus006",
    customerName: "Đặng Mỹ Hạnh (Đoàn)",
    phone: "0912345006",
    date: "2026-11-10",
    pax: 18,
    adults: 18,
    price: 32400000,
    status: "in_progress",
    guideId: "g3",
    guideName: "Lê Hoàng Long",
    assignment: {
      guideId: "g3",
      status: "accepted",
      assignedAt: "2026-11-06T10:00:00Z",
      respondedAt: "2026-11-06T11:00:00Z",
      assignedBy: "dh001"
    },
    createdAt: "2026-11-05T09:00:00Z",
    payments: [{ id: "pay_1086", kind: "full", amount: 32400000, at: "2026-11-05T10:00:00Z", by: "tn001", byName: "Lê Thu Ngân" }]
  }
];

cleanBookings.push(...newBookings);
saveJson('bookings.json', cleanBookings);

// 3. UPDATE DAILY REVENUES (Add Nov 1 - Nov 10, 2026)
const dailyRevenues = loadJson('daily_revenues.json');
const cleanDailyRev = dailyRevenues.filter(r => !r.date || !r.date.startsWith('2026-11'));

const novDailyRevs = [
  { id: "dr_20261101_1", date: "2026-11-01", amount: 24500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Khách đoàn vãng lai", tourName: "Bán vé & tour quầy", payCode: "TVQ_202611_01", note: "Bán vé và tour quầy đầu tháng", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-01T10:00:00Z", at: "2026-11-01T10:00:00Z" },
  { id: "dr_20261102_1", date: "2026-11-02", amount: 18200000, kind: "service", kindLabel: "Vé & Khách sạn", customerName: "Đại lý vé máy bay", tourName: "Hoa hồng dịch vụ phòng", payCode: "DL_202611_02", note: "Quyết toán hoa hồng phòng resort", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-02T11:30:00Z", at: "2026-11-02T11:30:00Z" },
  { id: "dr_20261103_1", date: "2026-11-03", amount: 15400000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Đoàn khách gia đình", tourName: "Tour ghép Đà Lạt", payCode: "TVQ_202611_03", note: "Thu trực tiếp tại quầy", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-03T14:15:00Z", at: "2026-11-03T14:15:00Z" },
  { id: "dr_20261104_1", date: "2026-11-04", amount: 48000000, kind: "counter", kindLabel: "Hợp đồng doanh nghiệp", customerName: "Công ty Cổ phần May 10", tourName: "Hợp đồng Teambuilding Hạ Long", payCode: "HD_202611_04", note: "Thanh toán hợp đồng du lịch DN", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-04T15:00:00Z", at: "2026-11-04T15:00:00Z" },
  { id: "dr_20261105_1", date: "2026-11-05", amount: 21500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Khách lẻ tham quan", tourName: "Vé cáp treo & buffet Fansipan", payCode: "TVQ_202611_05", note: "Bán vé combo cáp treo", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-05T09:30:00Z", at: "2026-11-05T09:30:00Z" },
  { id: "dr_20261106_1", date: "2026-11-06", amount: 32000000, kind: "service", kindLabel: "Vé & Khách sạn", customerName: "Chuỗi Vinpearl Resort", tourName: "Quyết toán voucher phòng khách", payCode: "DL_202611_06", note: "Hoa hồng chuỗi resort 5 sao", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-06T14:00:00Z", at: "2026-11-06T14:00:00Z" },
  { id: "dr_20261107_1", date: "2026-11-07", amount: 19800000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Đoàn khách trường học", tourName: "Tour học tập Củ Chi – Bến Tre", payCode: "TVQ_202611_07", note: "Thu tiền đoàn ngoại khóa", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-07T11:00:00Z", at: "2026-11-07T11:00:00Z" },
  { id: "dr_20261108_1", date: "2026-11-08", amount: 26500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Khách tour biển đảo", tourName: "Phụ thu cano & lặn ngắm san hô", payCode: "TVQ_202611_08", note: "Phụ thu tour cano Phú Quốc", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-08T15:20:00Z", at: "2026-11-08T15:20:00Z" },
  { id: "dr_20261109_1", date: "2026-11-09", amount: 38200000, kind: "counter", kindLabel: "Hợp đồng doanh nghiệp", customerName: "Công ty Dược Hậu Giang", tourName: "Hội thảo & Tour Cần Thơ 3N2Đ", payCode: "HD_202611_09", note: "Hợp đồng hội thảo kết hợp du lịch", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-09T10:30:00Z", at: "2026-11-09T10:30:00Z" },

  // ── TODAY (2026-11-10): 3 giao dịch thực thu sáng nay ──
  { id: "dr_20261110_1", date: "2026-11-10", amount: 16500000, kind: "counter", kindLabel: "Thu tại quầy", customerName: "Khách mua tour tại văn phòng", tourName: "Tour Đà Lạt Ngàn Hoa 3N2Đ", payCode: "TVQ_20261110_01", note: "[Hôm nay 10/11] Bán vé quầy sáng cho đoàn 5 người", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-10T08:30:00Z", at: "2026-11-10T08:30:00Z" },
  { id: "dr_20261110_2", date: "2026-11-10", amount: 8900000, kind: "service", kindLabel: "Vé & Khách sạn", customerName: "Đại lý vé máy bay Bamboo", tourName: "Hoa hồng xuất vé đoàn", payCode: "DL_20261110_02", note: "[Hôm nay 10/11] Hoa hồng xuất vé máy bay chặng HN - ĐN", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-10T09:45:00Z", at: "2026-11-10T09:45:00Z" },
  { id: "dr_20261110_3", date: "2026-11-10", amount: 5200000, kind: "counter", kindLabel: "Dịch vụ phát sinh", customerName: "Trần Văn An", tourName: "Nâng hạng phòng Vinpearl 5 sao", payCode: "PS_20261110_03", note: "[Hôm nay 10/11] Phụ thu nâng hạng phòng hướng biển", by: "tn001", byName: "Lê Thu Ngân", createdAt: "2026-11-10T10:15:00Z", at: "2026-11-10T10:15:00Z" }
];

cleanDailyRev.push(...novDailyRevs);
cleanDailyRev.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
saveJson('daily_revenues.json', cleanDailyRev);

// 4. UPDATE COMPLAINTS (Cho CSKH & Admin)
const complaintsData = [
  {
    id: "cmp_001",
    bookingId: "bk_1043",
    payCode: "TV1043",
    userId: "cus008",
    customerName: "Ngô Gia Khang",
    email: "khang.ngo@gmail.com",
    phone: "0918776655",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    title: "Xe đưa đón đến trễ 45 phút",
    content: "Sáng ngày 05/11 xe đón tại phố cổ trễ 45 phút không báo trước làm đoàn bị lỡ chuyến tàu ra vịnh.",
    status: "resolved",
    solution: "refund",
    refundAmount: 500000,
    supportNote: "Đã xin lỗi khách hàng và hoàn 500.000 ₫ tiền bồi thường dịch vụ.",
    createdAt: "2026-11-06T10:00:00Z",
    updatedAt: "2026-11-08T11:00:00Z"
  },
  {
    id: "cmp_002",
    bookingId: "bk_1048",
    payCode: "TV1048",
    userId: "cus002",
    customerName: "Trần Thị Bích",
    email: "bich.tran@gmail.com",
    phone: "0902345678",
    tourName: "Đà Nẵng – Hội An 4N3Đ",
    title: "Phòng khách sạn không đúng hạng đặt",
    content: "Gia đình tôi đặt phòng Deluxe hướng biển nhưng khách sạn lại bố trí phòng Superior tầng thấp.",
    status: "in_progress",
    supportNote: "CSKH đang làm việc với quản lý khách sạn để đổi phòng tầng cao và tặng bữa tối buffet bù đắp.",
    createdAt: "2026-11-09T14:00:00Z",
    updatedAt: "2026-11-10T09:00:00Z"
  },
  {
    id: "cmp_003",
    bookingId: "bk_1052",
    payCode: "TV1052",
    userId: "cus004",
    customerName: "Phạm Diệu Linh",
    email: "linh.pham@gmail.com",
    phone: "0934567890",
    tourName: "Sa Pa – Fansipan 3N2Đ",
    title: "Đề nghị thực đơn có thêm món chay",
    content: "Đoàn có 2 người ăn chay nhưng các bữa nhà hàng món chay rất nghèo nàn, chỉ có đậu phụ luộc.",
    status: "open",
    supportNote: "Mới tiếp nhận, CSKH chuẩn bị gọi điện liên hệ khách.",
    createdAt: "2026-11-10T08:30:00Z",
    updatedAt: "2026-11-10T08:30:00Z"
  },
  {
    id: "cmp_004",
    bookingId: "bk_1055",
    payCode: "TV1055",
    userId: "cus005",
    customerName: "Hoàng Tuấn Kiệt",
    email: "kiet.hoang@gmail.com",
    phone: "0912345005",
    tourName: "Đà Lạt – Thành Phố Ngàn Hoa 3N2Đ",
    title: "HDV không nhiệt tình giới thiệu điểm tham quan",
    content: "HDV chỉ dẫn vào điểm rồi ngồi bấm điện thoại, không thuyết minh lịch sử Dinh Bảo Đại.",
    status: "open",
    supportNote: "Cần chuyển cho Điều hành kiểm tra phản hồi từ HDV phụ trách chuyến đi.",
    createdAt: "2026-11-10T09:15:00Z",
    updatedAt: "2026-11-10T09:15:00Z"
  },
  {
    id: "cmp_005",
    bookingId: "bk_1056",
    payCode: "TV1056",
    userId: "cus006",
    customerName: "Đặng Mỹ Hạnh",
    email: "hanh.dang@gmail.com",
    phone: "0912345006",
    tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ",
    title: "Bữa ăn trưa tại nhà hàng hải sản có mùi lạ",
    content: "Món tôm nướng bị ươn, có mùi khó chịu. Gia đình không dám ăn phải gọi món ngoài.",
    status: "in_progress",
    solution: "refund_proposal",
    refundAmount: 600000,
    supportNote: "Đã xin biên lai thanh toán ngoài của khách, đề xuất hoàn 600.000 ₫ tiền bữa ăn.",
    createdAt: "2026-11-09T18:00:00Z",
    updatedAt: "2026-11-10T09:40:00Z"
  },
  {
    id: "cmp_006",
    bookingId: "bk_1057",
    payCode: "TV1057",
    userId: "cus007",
    customerName: "Vũ Quốc Bảo",
    email: "bao.vu@gmail.com",
    phone: "0912345007",
    tourName: "Quy Nhơn – Eo Gió – Kỳ Co 3N2Đ",
    title: "Cano trung chuyển ra đảo bị hỏng máy giữa biển",
    content: "Đoàn bị trôi dạt 30 phút dưới trời nắng gắt trước khi có cano cứu hộ tới, nhiều phụ nữ hoảng loạn.",
    status: "open",
    supportNote: "Sự cố nghiêm trọng, chuyển khẩn cấp lên Quản trị viên và Điều hành xử lý bồi thường.",
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z"
  },
  {
    id: "cmp_007",
    bookingId: "bk_1058",
    payCode: "TV1058",
    userId: "cus009",
    customerName: "Bùi Tuyết Mai",
    email: "mai.bui@gmail.com",
    phone: "0912345009",
    tourName: "Hà Nội – Ninh Bình – Tràng An 2N1Đ",
    title: "Thất lạc 1 vali ký gửi trên xe 45 chỗ",
    content: "Sau khi về khách sạn phát hiện thiếu 1 vali màu hồng của con gái.",
    status: "in_progress",
    supportNote: "Bác tài đã tìm thấy vali để quên ở khoang hành lý số 3, đang cho xe ôm công nghệ giao tới KS.",
    createdAt: "2026-11-09T16:00:00Z",
    updatedAt: "2026-11-10T08:45:00Z"
  },
  {
    id: "cmp_008",
    bookingId: "bk_1059",
    payCode: "TV1059",
    userId: "cus010",
    customerName: "Đỗ Minh Quân",
    email: "quan.do@gmail.com",
    phone: "0912345010",
    tourName: "Huế – Di Sản Cố Đô 3N2Đ",
    title: "Tính thêm phụ thu phòng đơn vô lý",
    content: "Tôi đi cùng bạn nhưng khách sạn tự ý tách 2 phòng rồi đòi phụ thu thêm 800.000 ₫.",
    status: "resolved",
    solution: "refund",
    refundAmount: 800000,
    supportNote: "Lỗi do lễ tân khách sạn phân nhầm phòng. Đã hoàn 800.000 ₫ và tặng voucher 200.000 ₫ cho tour sau.",
    createdAt: "2026-11-07T14:00:00Z",
    updatedAt: "2026-11-09T15:00:00Z"
  }
];
saveJson('complaints.json', complaintsData);

// 5. UPDATE DISCREPANCIES (payments.json)
const discrepanciesData = [
  {
    id: "pay_disc_01",
    txId: "cashier-vc01",
    bookingId: "bk_1060",
    payCode: "TV1060",
    amount: 1570000,
    problem: "short",
    status: "mismatch",
    handoff: true,
    reason: "Chuyển thiếu: nhận 1.570.000 ₫, cần 1.620.000 ₫ (thiếu 50.000 ₫ phí CK)",
    handoffNote: "CSKH gọi điện nhắc khách nộp bổ sung 50.000 ₫ lúc khởi hành",
    source: "cashier",
    createdAt: "2026-11-10T09:00:00Z"
  },
  {
    id: "pay_disc_02",
    txId: "cashier-tc02",
    bookingId: "bk_1061",
    payCode: "TV1061",
    amount: 3000000,
    problem: "excess",
    status: "mismatch",
    handoff: true,
    reason: "Chuyển thừa: nhận 3.000.000 ₫, cần 2.460.000 ₫ (thừa 540.000 ₫)",
    handoffNote: "Khách đồng ý cấn trừ 540.000 ₫ vào khoản thu nốt trước ngày đi",
    source: "cashier",
    createdAt: "2026-11-10T09:30:00Z"
  },
  {
    id: "pay_disc_03",
    txId: "cashier-mb03",
    bookingId: "",
    payCode: "",
    amount: 2500000,
    problem: "wrong_content",
    status: "unmatched",
    handoff: true,
    reason: "Sai nội dung: 'Nguyen Van B ck tien tour' không có mã TVxxxx",
    handoffNote: "CSKH đang tra cứu số điện thoại người chuyển để xác định đúng đơn",
    source: "bank",
    createdAt: "2026-11-10T10:00:00Z"
  },
  {
    id: "pay_disc_04",
    txId: "cashier-ac04",
    bookingId: "bk_1062",
    payCode: "TV1062",
    amount: 2970000,
    problem: "double",
    status: "mismatch",
    handoff: true,
    reason: "Chuyển hai lần: Khách bấm 2 lần chuyển 2.970.000 ₫ trên App ngân hàng",
    handoffNote: "Đã liên hệ khách xin số tài khoản để làm thủ tục hoàn trả lệnh thứ 2",
    source: "bank",
    createdAt: "2026-11-10T10:30:00Z"
  }
];
saveJson('payments.json', discrepanciesData);

// 6. UPDATE REFUNDS (refunds.json)
const refundsData = [
  {
    id: "rf_001",
    bookingId: "bk_1054",
    payCode: "TV1054",
    customerName: "Vũ Quốc Bảo",
    userId: "cus007",
    amount: 1920000,
    source: "customer_cancel",
    status: "approved",
    reason: "Khách bận việc đột xuất xin hủy trước 15 ngày, hoàn 100% theo chính sách",
    requestedById: "cus007",
    requestedByName: "Vũ Quốc Bảo",
    requestedRole: "CUSTOMER",
    requestedAt: "2026-11-08T10:00:00Z",
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: "2026-11-09T14:00:00Z",
    note: "Admin đã duyệt, chờ Thu ngân chuyển khoản hoàn trả"
  },
  {
    id: "rf_002",
    bookingId: "bk_1045",
    payCode: "TV1045",
    customerName: "Trần Thị Bích",
    userId: "cus002",
    amount: 3200000,
    source: "customer_cancel",
    status: "pending_approval",
    reason: "Khách hủy chuyến đi Sa Pa do sức khỏe, yêu cầu hoàn cọc",
    requestedById: "cus002",
    requestedByName: "Trần Thị Bích",
    requestedRole: "CUSTOMER",
    requestedAt: "2026-11-09T16:30:00Z",
    note: "Chờ Admin xét duyệt tỷ lệ hoàn cọc"
  },
  {
    id: "rf_003",
    bookingId: "bk_1043",
    payCode: "TV1043",
    customerName: "Ngô Gia Khang",
    userId: "cus008",
    amount: 500000,
    source: "complaint",
    complaintId: "cmp_001",
    status: "approved",
    reason: "Bồi thường chậm xe đón sân bay",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "SUPPORT",
    requestedAt: "2026-11-08T11:00:00Z",
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: "2026-11-09T09:30:00Z",
    note: "Đã duyệt, chuyển thu ngân chi trả"
  },
  {
    id: "rf_004",
    bookingId: "bk_1056",
    payCode: "TV1056",
    customerName: "Đặng Mỹ Hạnh",
    userId: "cus006",
    amount: 600000,
    source: "complaint",
    complaintId: "cmp_005",
    status: "pending_approval",
    reason: "CSKH đề xuất hoàn tiền bữa ăn có mùi lạ tại Phú Quốc",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "SUPPORT",
    requestedAt: "2026-11-10T09:40:00Z",
    note: "Chờ Admin xét duyệt đền bù"
  },
  {
    id: "rf_005",
    bookingId: "bk_1059",
    payCode: "TV1059",
    customerName: "Đỗ Minh Quân",
    userId: "cus010",
    amount: 800000,
    source: "complaint",
    complaintId: "cmp_008",
    status: "approved",
    reason: "Hoàn phụ thu phòng đơn vô lý do khách sạn tính nhầm",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "SUPPORT",
    requestedAt: "2026-11-09T15:00:00Z",
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: "2026-11-10T08:00:00Z",
    note: "Chờ Thu ngân thực hiện lệnh chuyển khoản"
  }
];
saveJson('refunds.json', refundsData);

// 7. UPDATE CANCEL PROPOSALS (cancelproposals.json)
const cancelProposalsData = [
  {
    id: "cp_001",
    tourId: "101",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    date: "2026-11-14",
    pax: 3,
    minGuests: 10,
    reason: "Không đủ số lượng khách tối thiểu để khởi hành chuyến riêng (3/10 khách).",
    status: "pending",
    proposedBy: "dh001",
    proposedByName: "Trần Điều Hành",
    createdAt: "2026-11-09T10:00:00Z"
  },
  {
    id: "cp_002",
    tourId: "105",
    tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ",
    date: "2026-11-15",
    pax: 8,
    minGuests: 10,
    reason: "Không thể bố trí HDV phù hợp do tất cả HDV biển đảo đều kẹt lịch tour quốc tế.",
    status: "pending",
    proposedBy: "dh001",
    proposedByName: "Trần Điều Hành",
    createdAt: "2026-11-10T08:45:00Z"
  },
  {
    id: "cp_003",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    date: "2026-11-16",
    pax: 4,
    minGuests: 10,
    reason: "Dự báo thời tiết áp thấp nhiệt đới gây mưa bão lớn tại miền Trung.",
    status: "pending",
    proposedBy: "dh001",
    proposedByName: "Trần Điều Hành",
    createdAt: "2026-11-10T09:30:00Z"
  },
  {
    id: "cp_004",
    tourId: "102",
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    date: "2026-11-18",
    pax: 5,
    minGuests: 10,
    reason: "Bảo trì định kỳ tuyến cáp treo Fansipan trùng ngày khởi hành của đoàn.",
    status: "pending",
    proposedBy: "dh001",
    proposedByName: "Trần Điều Hành",
    createdAt: "2026-11-10T10:15:00Z"
  }
];
saveJson('cancelproposals.json', cancelProposalsData);

// 8. UPDATE RECONCILIATIONS (reconciliations.json)
const reconciliationsData = [];
for (let d = -15; d <= -1; d++) {
  const dt = new Date("2026-11-10T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + d);
  const dateStr = dt.toISOString().slice(0, 10);
  const isLastDay = (d === -1); // 2026-11-09
  reconciliationsData.push({
    id: `rec_${dateStr.replace(/-/g, '')}`,
    date: dateStr,
    cashierId: "tn001",
    cashierName: "Lê Thu Ngân",
    openingBalance: 35000000,
    totalIn: 38200000,
    totalOut: 12000000,
    closingBalance: 61200000,
    actualCash: 61200000,
    bankStatementTotal: 61200000,
    netTotal: 26200000,
    discrepancy: 0,
    status: isLastDay ? "pending_approval" : "approved",
    approvedById: isLastDay ? null : "ad001",
    approvedByName: isLastDay ? null : "Quản Trị Viên",
    approvedAt: isLastDay ? null : `${dateStr}T18:30:00Z`,
    note: isLastDay
      ? "Bản đóng sổ ngày hôm qua (09/11) – Đã đối soát 100% khớp sao kê ngân hàng, chờ Admin xét duyệt."
      : `Đóng sổ ngày ${dateStr} – Khớp 100% sao kê ngân hàng Vietcombank.`
  });
}
saveJson('reconciliations.json', reconciliationsData);

// 9. UPDATE WAITLIST (waitlist.json)
const waitlistData = [
  { id: "wl_001", tourId: "101", tourName: "Hà Nội – Hạ Long 3N2Đ", date: "2026-11-15", name: "Nguyễn Thị Thu Trang", phone: "0908123456", email: "trang.nguyen@gmail.com", pax: 2, status: "waiting", createdAt: "2026-11-08T09:00:00Z" },
  { id: "wl_002", tourId: "102", tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ", date: "2026-11-16", name: "Trần Hữu Nam", phone: "0908234567", email: "nam.tran@gmail.com", pax: 4, status: "waiting", createdAt: "2026-11-08T11:30:00Z" },
  { id: "wl_003", tourId: "103", tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", date: "2026-11-17", name: "Lê Hồng Ánh", phone: "0908345678", email: "anh.le@gmail.com", pax: 3, status: "waiting", createdAt: "2026-11-09T14:00:00Z" },
  { id: "wl_004", tourId: "105", tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ", date: "2026-11-18", name: "Phạm Gia Huy", phone: "0908456789", email: "huy.pham@gmail.com", pax: 2, status: "waiting", createdAt: "2026-11-09T16:15:00Z" },
  { id: "wl_005", tourId: "104", tourName: "Đà Lạt – Thành Phố Ngàn Hoa 3N2Đ", date: "2026-11-20", name: "Vũ Bảo Ngọc", phone: "0908567890", email: "ngoc.vu@gmail.com", pax: 5, status: "waiting", createdAt: "2026-11-10T08:30:00Z" },
  { id: "wl_006", tourId: "106", tourName: "TP.HCM – Miền Tây Sông Nước 2N1Đ", date: "2026-11-22", name: "Hoàng Minh Trí", phone: "0908678901", email: "tri.hoang@gmail.com", pax: 2, status: "waiting", createdAt: "2026-11-10T09:45:00Z" }
];
saveJson('waitlist.json', waitlistData);

// 10. UPDATE INCIDENTS (incidents.json)
const incidentsData = [
  {
    id: "inc_001",
    bookingId: "bk_1086",
    payCode: "TV1086",
    guideId: "g3",
    guideName: "Lê Hoàng Long",
    tourName: "Hà Nội – Hạ Long 3N2Đ",
    type: "delay",
    severity: "low",
    description: "Tắc đường tại ngã tư cầu Bãi Cháy, đoàn đến cảng tàu muộn 15 phút. Đã chủ động liên hệ tàu lùi giờ xuất bến.",
    status: "open",
    createdAt: "2026-11-10T09:30:00Z"
  },
  {
    id: "inc_002",
    bookingId: "bk_1059",
    payCode: "TV1059",
    guideId: "g6",
    guideName: "Đặng Hữu Phúc",
    tourName: "TP.HCM – Miền Tây Sông Nước 2N1Đ",
    type: "health",
    severity: "medium",
    description: "Một khách nữ bị tụt huyết áp do nắng gắt tại cồn Phụng. Đã đưa vào trạm y tế sơ cứu, sức khỏe đã ổn định.",
    status: "in_progress",
    note: "Khách đang nghỉ ngơi, tiếp tục đi tour bằng xe trung chuyển có máy lạnh.",
    createdAt: "2026-11-09T11:20:00Z"
  },
  {
    id: "inc_003",
    bookingId: "bk_1055",
    payCode: "TV1055",
    guideId: "g1",
    guideName: "Trần Văn Quân",
    tourName: "Sa Pa – Fansipan 3N2Đ",
    type: "lost",
    severity: "low",
    description: "Khách để quên máy ảnh tại quán cà phê bản Cát Cát. HDV đã liên hệ chủ quán lấy lại cho khách.",
    status: "resolved",
    note: "Đã trao trả máy ảnh nguyên vẹn cho khách.",
    createdAt: "2026-11-08T15:00:00Z"
  },
  {
    id: "inc_004",
    bookingId: "bk_1057",
    payCode: "TV1057",
    guideId: "g2",
    guideName: "Nguyễn Thu Hà",
    tourName: "Đà Nẵng – Hội An 4N3Đ",
    type: "vehicle",
    severity: "medium",
    description: "Xe 29 chỗ bị nổ lốp trên đường đi Bà Nà. Đã điều xe dự phòng tới đón sau 20 phút.",
    status: "resolved",
    note: "Đoàn chuyển sang xe mới an toàn, không ai bị thương.",
    createdAt: "2026-11-07T08:30:00Z"
  }
];
saveJson('incidents.json', incidentsData);

// 11. UPDATE DEPARTURES (departures.json)
const departuresData = [
  { id: "101@2026-11-14", tourId: "101", tourName: "Hà Nội – Hạ Long 3N2Đ", date: "2026-11-14", capacity: 25, status: "open" },
  { id: "102@2026-11-15", tourId: "102", tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ", date: "2026-11-15", capacity: 20, status: "open" },
  { id: "103@2026-11-16", tourId: "103", tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", date: "2026-11-16", capacity: 30, status: "open" },
  { id: "105@2026-11-18", tourId: "105", tourName: "Phú Quốc – Thiên Đường Đảo Ngọc 3N2Đ", date: "2026-11-18", capacity: 25, status: "open" },
  { id: "104@2026-11-20", tourId: "104", tourName: "Đà Lạt – Thành Phố Ngàn Hoa 3N2Đ", date: "2026-11-20", capacity: 25, status: "open" },
  { id: "106@2026-11-22", tourId: "106", tourName: "TP.HCM – Miền Tây Sông Nước 2N1Đ", date: "2026-11-22", capacity: 30, status: "open" }
];
saveJson('departures.json', departuresData);

console.log("Mock data enrichment completed successfully!");

