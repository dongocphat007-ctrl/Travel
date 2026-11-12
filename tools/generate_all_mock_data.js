/**
 * Comprehensive, High-Performance Mock Data Generator for Travel System
 * 
 * Fulfills all user requirements:
 * 1. Abundant mock data for every role and every function (Admin, Cashier, Operator, Support, Content, Guide, Customer).
 * 2. Real dashboard integration: salary payouts in daily_revenues deduct from revenue in Dashboard.
 * 3. Role-specific payroll tables & salary statistics by month, quarter, year.
 * 4. Year range: 2010 to 2026 (Historical data up to Month 10/2026, Month 11 active test workflows, Month 12 empty).
 * 5. Blazing fast (zero server lag): compact, high-efficiency JSON structure (300KB bookings instead of 14MB).
 * 6. Clean, pure UTF-8 Vietnamese (no mojibake).
 * 7. Multi-destination JSON storage: backend/storage/db, backend/storage, storage/db, frontend/data/mock.
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveJson(fileName, data) {
  const content = JSON.stringify(data, null, 2);
  for (const dir of targetDirs) {
    fs.writeFileSync(path.join(dir, fileName), content, 'utf8');
  }
}

// Fixed PBKDF2 hash for password "Travel@2026"
const PASS_HASH = "pbkdf2$210000$R7NtBFaJljypzYKjd7A5iA==$LhnwO1XyKzZygnDA8uZMumR5IRABrdPDWfiREdikhyY=";

// Simulated current time: November 10, 2026
const TODAY_STR = "2026-11-10";

function isoDate(y, m, d, h = 10, min = 0) {
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00Z`;
}

function ymd(y, m, d) {
  const pad = n => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysOffset(dStr, days) {
  const d = new Date(dStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function timeOffsetDays(days, h = 9, m = 0) {
  const d = new Date("2026-11-10T10:00:00Z");
  d.setDate(d.getDate() + days);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────
// 1. GUIDES (guides.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Guides...");
const guideSeedNames = [
  "Trần Văn Quân", "Nguyễn Thu Hà", "Lê Hoàng Long", "Phạm Minh Đức",
  "Võ Thị Mai", "Đặng Hữu Phúc", "Bùi Thanh Trúc", "Hoàng Gia Bảo",
  "Đỗ Thị Ngọc", "Ngô Quốc Tuấn", "Dương Cẩm Tú", "Lý Kiến Quốc",
  "Trương Vĩnh Ký", "Vũ Mai Phương", "Hồ Trọng Nghĩa", "Nguyễn Thị Kim Chi"
];

const guidesData = guideSeedNames.map((name, idx) => ({
  id: `g${idx + 1}`,
  name: name,
  phone: `098711${String(idx + 1).padStart(4, '0')}`,
  email: `hdv${idx + 1}@travel.vn`,
  status: idx === 1 ? "off" : (idx === 7 ? "busy" : "active"),
  guideType: idx % 3 === 0 ? "domestic" : (idx % 3 === 1 ? "outbound" : "all"),
  employmentType: idx < 6 ? "permanent" : "collaborator",
  languages: idx % 2 === 0 ? ["Tiếng Việt", "Tiếng Anh"] : ["Tiếng Việt", "Tiếng Pháp"],
  regions: idx % 3 === 0 ? ["north"] : (idx % 3 === 1 ? ["central", "south"] : ["north", "central", "south"]),
  rating: Number((4.5 + (idx % 5) * 0.1).toFixed(1)),
  toursCount: 15 + (idx % 20),
  balance: 3500000 + (idx % 10) * 1000000,
  busyDates: [
    daysOffset(TODAY_STR, 1),
    daysOffset(TODAY_STR, 2),
    daysOffset(TODAY_STR, 7),
    daysOffset(TODAY_STR, 8)
  ],
  bio: `Hướng dẫn viên kinh nghiệm ${5 + (idx % 10)} năm dẫn các đoàn khách trong và ngoài nước.`
}));

saveJson('guides.json', guidesData);
console.log(`[1] Saved guides.json: ${guidesData.length} guides`);

// ─────────────────────────────────────────────────────────────
// 2. ACCOUNTS (accounts.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Accounts...");
const staffList = [
  {
    id: "ad001",
    name: "Quản Trị Viên",
    email: "admin@travel.vn",
    phone: "0901000001",
    role: "admin",
    roleName: "Quản trị viên",
    baseSalary: 20000000,
    balance: 45000000,
    totalEarned: 350000000,
    startDate: "2010-01-15",
    nextReviewDate: "2027-01-15",
    kpi: 95
  },
  {
    id: "tn001",
    name: "Lê Thu Ngân",
    email: "thungan@travel.vn",
    phone: "0902000002",
    role: "cashier",
    roleName: "Thu ngân",
    baseSalary: 12000000,
    balance: 18000000,
    totalEarned: 180000000,
    startDate: "2012-03-01",
    nextReviewDate: "2027-03-01",
    kpi: 92
  },
  {
    id: "dh001",
    name: "Trần Điều Hành",
    email: "dieuhanh@travel.vn",
    phone: "0903000003",
    role: "operator",
    roleName: "Điều hành tour",
    baseSalary: 14000000,
    balance: 22000000,
    totalEarned: 210000000,
    startDate: "2013-05-10",
    nextReviewDate: "2027-05-10",
    kpi: 90
  },
  {
    id: "cs001",
    name: "Phạm Chăm Sóc",
    email: "cskh@travel.vn",
    phone: "0904000004",
    role: "support",
    roleName: "CSKH",
    baseSalary: 11000000,
    balance: 15000000,
    totalEarned: 155000000,
    startDate: "2015-08-20",
    nextReviewDate: "2027-08-20",
    kpi: 88
  },
  {
    id: "nd001",
    name: "Vũ Biên Tập",
    email: "bientap@travel.vn",
    phone: "0905000005",
    role: "content",
    roleName: "Biên tập nội dung",
    baseSalary: 11500000,
    balance: 16500000,
    totalEarned: 160000000,
    startDate: "2016-10-01",
    nextReviewDate: "2027-10-01",
    kpi: 91
  }
];

const guideAccounts = guidesData.map((g, idx) => ({
  id: `hdv${String(idx + 1).padStart(3, '0')}`,
  name: g.name,
  email: g.email,
  phone: g.phone,
  role: "guide",
  roleName: "Hướng dẫn viên",
  baseSalary: g.employmentType === "permanent" ? 10000000 : 0,
  balance: g.balance,
  totalEarned: (g.toursCount * 2500000),
  startDate: `201${idx % 7}-04-15`,
  nextReviewDate: "2027-04-15",
  kpi: 85 + (idx % 12),
  guideProfile: {
    guideId: g.id,
    guideType: g.guideType,
    employmentType: g.employmentType,
    rating: g.rating,
    toursCount: g.toursCount
  }
}));

const customerAccounts = [
  { id: "cus001", name: "Nguyễn Văn An", email: "an.nguyen@gmail.com", phone: "0912345001", balance: 5000000, rewardPoints: 1200 },
  { id: "cus002", name: "Trần Thị Bích", email: "bich.tran@gmail.com", phone: "0912345002", balance: 2500000, rewardPoints: 850 },
  { id: "cus003", name: "Lê Hoàng Cường", email: "cuong.le@gmail.com", phone: "0912345003", balance: 10000000, rewardPoints: 2300 },
  { id: "cus004", name: "Phạm Diệu Linh", email: "linh.pham@gmail.com", phone: "0912345004", balance: 1500000, rewardPoints: 400 },
  { id: "cus005", name: "Hoàng Tuấn Kiệt", email: "kiet.hoang@gmail.com", phone: "0912345005", balance: 0, rewardPoints: 150 },
  { id: "cus006", name: "Đặng Mỹ Hạnh", email: "hanh.dang@gmail.com", phone: "0912345006", balance: 4200000, rewardPoints: 950 },
  { id: "cus007", name: "Vũ Quốc Bảo", email: "bao.vu@gmail.com", phone: "0912345007", balance: 800000, rewardPoints: 310 },
  { id: "cus008", name: "Ngô Gia Khang", email: "khang.ngo@gmail.com", phone: "0912345008", balance: 7500000, rewardPoints: 1750 },
  { id: "cus009", name: "Bùi Tuyết Mai", email: "mai.bui@gmail.com", phone: "0912345009", balance: 3200000, rewardPoints: 620 },
  { id: "cus010", name: "Đỗ Minh Quân", email: "quan.do@gmail.com", phone: "0912345010", balance: 12000000, rewardPoints: 3100 }
];

const allAccounts = [
  ...staffList.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    roleName: s.roleName,
    baseSalary: s.baseSalary,
    balance: s.balance,
    totalEarned: s.totalEarned,
    startDate: s.startDate,
    nextReviewDate: s.nextReviewDate,
    kpi: s.kpi,
    kpiRecent: s.kpi,
    kpiRating: s.kpi >= 90 ? "Xuất sắc" : (s.kpi >= 80 ? "Tốt" : "Khá"),
    kpiPeriod: "Kỳ đánh giá 2026",
    passHash: PASS_HASH,
    active: true,
    provider: "local",
    createdAt: isoDate(2010, 1, 1)
  })),
  // Legacy username aliases for ease of test login
  {
    id: "ad001_alias",
    name: "Quản Trị Viên",
    email: "admin",
    phone: "0901000001",
    role: "admin",
    roleName: "Quản trị viên",
    baseSalary: 20000000,
    balance: 45000000,
    totalEarned: 350000000,
    startDate: "2010-01-15",
    nextReviewDate: "2027-01-15",
    kpi: 95,
    kpiRecent: 95,
    kpiRating: "Xuất sắc",
    kpiPeriod: "Kỳ đánh giá 2026",
    passHash: PASS_HASH,
    active: true,
    provider: "local",
    createdAt: isoDate(2010, 1, 1)
  },
  ...guideAccounts.map(g => ({
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    role: "guide",
    roleName: "Hướng dẫn viên",
    baseSalary: g.baseSalary,
    balance: g.balance,
    totalEarned: g.totalEarned,
    startDate: g.startDate,
    nextReviewDate: g.nextReviewDate,
    kpi: g.kpi,
    kpiRecent: g.kpi,
    kpiRating: g.kpi >= 90 ? "Xuất sắc" : (g.kpi >= 80 ? "Tốt" : "Khá"),
    kpiPeriod: "Kỳ đánh giá 2026",
    guideProfile: g.guideProfile,
    passHash: PASS_HASH,
    active: true,
    provider: "local",
    createdAt: isoDate(2015, 1, 1)
  })),
  ...customerAccounts.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: "customer",
    roleName: "Khách hàng",
    balance: c.balance,
    rewardPoints: c.rewardPoints,
    passHash: PASS_HASH,
    active: true,
    provider: "local",
    createdAt: isoDate(2015, 6, 1)
  }))
];

saveJson('accounts.json', allAccounts);
console.log(`[2] Saved accounts.json: ${allAccounts.length} accounts`);

// ─────────────────────────────────────────────────────────────
// 3. TOURS LIST
// ─────────────────────────────────────────────────────────────
const tourList = [
  { id: 101, name: "Hà Nội – Hạ Long 3N2Đ", dest: "Hạ Long", price: 2500000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Bắc" },
  { id: 102, name: "Hà Nội – Sa Pa – Fansipan 3N2Đ", dest: "Sa Pa", price: 3200000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Bắc" },
  { id: 103, name: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ", dest: "Đà Nẵng", price: 4500000, duration: "4 ngày 3 đêm", days: 4, region: "Miền Trung" },
  { id: 104, name: "Huế – Di Sản Cố Đô 3N2Đ", dest: "Huế", price: 2800000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Trung" },
  { id: 105, name: "TP.HCM – Phú Quốc Thiên Đường Biển 3N2Đ", dest: "Phú Quốc", price: 4800000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Nam" },
  { id: 106, name: "TP.HCM – Miền Tây Sông Nước 2N1Đ", dest: "Cần Thơ", price: 1800000, duration: "2 ngày 1 đêm", days: 2, region: "Miền Nam" },
  { id: 107, name: "Nha Trang – Vịnh Biển Xanh 4N3Đ", dest: "Nha Trang", price: 3900000, duration: "4 ngày 3 đêm", days: 4, region: "Miền Trung" },
  { id: 108, name: "Quy Nhơn – Eo Gió – Kỳ Co 3N2Đ", dest: "Quy Nhơn", price: 3500000, duration: "3 ngày 2 đêm", days: 3, region: "Miền Trung" }
];

// ─────────────────────────────────────────────────────────────
// 4. HISTORICAL BOOKINGS, DAILY REVENUES & SALARY LOGS (2010 - 2026)
// ─────────────────────────────────────────────────────────────
console.log("Generating Historical Bookings, Daily Revenues & Salary Logs (2010-2026)...");

const bookings = [];
const dailyRevenues = [];
const salaryLogs = [];
const salaryHistory = [];

let bookingSeq = 10000;
let revSeq = 10000;
let logSeq = 10000;

const paidStaff = [
  ...staffList,
  guideAccounts[0],
  guideAccounts[1],
  guideAccounts[5],
  guideAccounts[9]
];

// Mô hình lạm phát & quy mô doanh thu từ năm mở cửa giao thương 1986 đến 2026 (40 năm)
function getRevenueScale(y) {
  if (y <= 1986) return 0.00035;
  if (y === 1987) return 0.00065;
  if (y === 1988) return 0.00140;
  if (y === 1989) return 0.00280;
  if (y <= 1995) {
    const t = (y - 1990) / 5;
    return 0.0050 + t * (0.025 - 0.0050);
  }
  if (y <= 2000) {
    const t = (y - 1995) / 5;
    return 0.025 + t * (0.15 - 0.025);
  }
  if (y <= 2009) {
    const t = (y - 2000) / 9;
    return 0.15 + t * (0.50 - 0.15);
  }
  if (y <= 2019) {
    const t = (y - 2010) / 9;
    return 0.55 + t * (0.85 - 0.55);
  }
  if (y === 2020) return 0.78;
  if (y === 2021) return 0.82;
  if (y === 2022) return 0.88;
  if (y === 2023) return 0.92;
  if (y === 2024) return 0.96;
  return 1.0;
}

function getSalaryScale(y) {
  if (y <= 1986) return 0.0010;
  if (y === 1987) return 0.0016;
  if (y === 1988) return 0.0030;
  if (y === 1989) return 0.0050;
  if (y <= 1995) {
    const t = (y - 1990) / 5;
    return 0.008 + t * (0.025 - 0.008);
  }
  if (y <= 2000) {
    const t = (y - 1995) / 5;
    return 0.025 + t * (0.080 - 0.025);
  }
  if (y <= 2009) {
    const t = (y - 2000) / 9;
    return 0.080 + t * (0.350 - 0.080);
  }
  if (y <= 2019) {
    const t = (y - 2010) / 9;
    return 0.400 + t * (0.750 - 0.400);
  }
  if (y === 2020) return 0.78;
  if (y === 2021) return 0.82;
  if (y === 2022) return 0.88;
  if (y === 2023) return 0.92;
  if (y === 2024) return 0.96;
  return 1.0;
}

for (let y = 1986; y <= 2026; y++) {
  const revScale = getRevenueScale(y);
  const salScale = getSalaryScale(y);
  const maxMonth = (y === 2026) ? 10 : 12;
  const roundUnit = (y <= 1989) ? 100 : (y <= 1995 ? 500 : 1000);

  // Annual review in January of each year
  for (const st of paidStaff) {
    if ((y >= 2015 || y % 5 === 0) && y > 1986) {
      const prevSalScale = getSalaryScale(y - 1);
      const baseOld = Math.round((st.baseSalary * prevSalScale) / roundUnit) * roundUnit;
      const baseNew = Math.round((st.baseSalary * salScale) / roundUnit) * roundUnit;
      salaryHistory.push({
        id: `sh_${y}_${st.id}`,
        staffId: st.id,
        staffName: st.name,
        role: st.role,
        oldSalary: baseOld,
        newSalary: baseNew,
        increasePercent: Math.round(((baseNew - baseOld) / Math.max(1, baseOld)) * 1000) / 10,
        kpi: 88 + (y % 10),
        kpiRating: "Tốt",
        effectiveDate: ymd(y, 1, 15),
        reason: `Xét duyệt tăng lương định kỳ năm ${y} (KPI ${88 + (y % 10)}% - Tốt)`,
        type: "regular",
        approvedBy: "ad001",
        approvedByName: "Quản Trị Viên",
        approvedAt: isoDate(y, 1, 15)
      });
    }
  }

  for (let m = 1; m <= maxMonth; m++) {
    const salDateStr = ymd(y, m, 25);
    const salIso = isoDate(y, m, 25, 10, 0);

    // 1. Monthly salary payouts (Recorded in salaryLogs & deducted in daily_revenues)
    const currentPaidStaff = (y >= 2010)
      ? paidStaff
      : (y >= 2000 ? paidStaff.slice(0, 6) : (y >= 1990 ? paidStaff.slice(0, 4) : paidStaff.slice(0, 2)));
    for (const st of currentPaidStaff) {
      logSeq++;
      revSeq++;
      const curSal = Math.max(1000, Math.round((st.baseSalary * salScale) / roundUnit) * roundUnit);

      salaryLogs.push({
        id: `slog_${logSeq}`,
        type: "pay",
        staffId: st.id,
        staffName: st.name,
        role: st.role,
        amount: curSal,
        note: `Phát lương định kỳ tháng ${m}/${y}`,
        by: "ad001",
        byName: "Quản Trị Viên",
        at: salIso
      });

      dailyRevenues.push({
        id: `dr_${revSeq}`,
        date: salDateStr,
        amount: -curSal,
        kind: "salary",
        kindLabel: "Chi trả lương",
        customerName: st.name,
        tourName: `Lương ${st.roleName}`,
        payCode: `SAL-${st.id}-${y}${String(m).padStart(2, '0')}`,
        note: `Chi trả lương tháng ${m}/${y} cho ${st.name} (${st.roleName})`,
        source: "salary",
        by: "ad001",
        byName: "Quản Trị Viên",
        byRole: "ADMIN",
        createdAt: salIso,
        at: salIso
      });
    }

    // Occasional bonus in Jan (Tết) or Sep (Quốc khánh) for y >= 2010
    if ((m === 1 || m === 9) && y >= 2010) {
      for (const st of [staffList[1], staffList[2], staffList[3]]) {
        logSeq++;
        revSeq++;
        const bonusAmt = Math.round(1500000 * salScale);
        salaryLogs.push({
          id: `slog_${logSeq}`,
          type: "bonus",
          staffId: st.id,
          staffName: st.name,
          role: st.role,
          amount: bonusAmt,
          note: `Thưởng thành tích xuất sắc dịp ${m === 1 ? 'Tết Dương lịch' : 'Quốc khánh'} ${y}`,
          by: "ad001",
          byName: "Quản Trị Viên",
          at: isoDate(y, m, 28, 14, 0)
        });

        dailyRevenues.push({
          id: `dr_${revSeq}`,
          date: ymd(y, m, 28),
          amount: -bonusAmt,
          kind: "bonus",
          kindLabel: "Thưởng nhân viên",
          customerName: st.name,
          tourName: "Thưởng thành tích",
          payCode: `BON-${st.id}-${y}${m}`,
          note: `Thưởng thành tích cho ${st.name}`,
          source: "salary",
          by: "ad001",
          byName: "Quản Trị Viên",
          byRole: "ADMIN",
          createdAt: isoDate(y, m, 28, 14, 0),
          at: isoDate(y, m, 28, 14, 0)
        });
      }
    }

    // Doanh thu dịch vụ & hợp đồng doanh nghiệp (Hợp đồng lữ hành, đại lý vé & phòng, tour quầy)
    revSeq++;
    const hdAmt = Math.max(2000, Math.round(((y >= 2020 ? 95000000 : 75000000) + (y % 5) * 4000000) * revScale / roundUnit) * roundUnit);
    dailyRevenues.push({
      id: `dr_${revSeq}`,
      date: ymd(y, m, 5),
      amount: hdAmt,
      kind: "counter",
      kindLabel: "Hợp đồng doanh nghiệp",
      customerName: y < 2000 ? "Công ty Xuất Nhập Khẩu & Hợp tác Lữ hành" : "Tập đoàn Vingroup & Đối tác",
      tourName: y < 2000 ? "Hợp đồng lữ hành cán bộ công nhân viên" : "Hợp đồng lữ hành & Team Building trọn gói",
      payCode: `HD_${y}${String(m).padStart(2, '0')}_1`,
      note: "Thanh toán hợp đồng du lịch thường niên cho cán bộ nhân viên",
      source: "manual",
      by: "tn001",
      byName: "Lê Thu Ngân",
      byRole: "CASHIER",
      createdAt: isoDate(y, m, 5, 11, 0),
      at: isoDate(y, m, 5, 11, 0)
    });

    revSeq++;
    const dlAmt = Math.max(1000, Math.round(((y >= 2020 ? 55000000 : 45000000) + (m % 4) * 3000000) * revScale / roundUnit) * roundUnit);
    dailyRevenues.push({
      id: `dr_${revSeq}`,
      date: ymd(y, m, 12),
      amount: dlAmt,
      kind: "service",
      kindLabel: "Vé & Khách sạn đối tác",
      customerName: y < 2000 ? "Đại lý đường sắt & Hàng không liên tỉnh" : "Đại lý vé liên kết",
      tourName: y < 2000 ? "Hoa hồng đại lý vé tàu hỏa & lưu trú" : "Doanh thu đại lý vé máy bay & chuỗi resort 5 sao",
      payCode: `DL_${y}${String(m).padStart(2, '0')}_2`,
      note: "Quyết toán hoa hồng & tiền vé đối tác",
      source: "manual",
      by: "tn001",
      byName: "Lê Thu Ngân",
      byRole: "CASHIER",
      createdAt: isoDate(y, m, 12, 14, 0),
      at: isoDate(y, m, 12, 14, 0)
    });

    revSeq++;
    const tvqAmt = Math.max(1000, Math.round(((y >= 2020 ? 35000000 : 25000000) + (m % 3) * 2000000) * revScale / roundUnit) * roundUnit);
    dailyRevenues.push({
      id: `dr_${revSeq}`,
      date: ymd(y, m, 18),
      amount: tvqAmt,
      kind: "counter",
      kindLabel: "Thu tại quầy",
      customerName: "Khách đoàn vãng lai",
      tourName: "Phụ thu dịch vụ & vé tham quan tại quầy",
      payCode: `TVQ_${y}${String(m).padStart(2, '0')}_3`,
      note: "Thu trực tiếp tại quầy giao dịch chi nhánh",
      source: "manual",
      by: "tn001",
      byName: "Lê Thu Ngân",
      byRole: "CASHIER",
      createdAt: isoDate(y, m, 18, 15, 30),
      at: isoDate(y, m, 18, 15, 30)
    });

    // Số đơn tour trong tháng
    const bookingsInMonth = (y >= 2010) ? 6 : (y >= 1996 ? 2 : 1);
    const bookDays = (y >= 2010) ? [4, 9, 14, 19, 23, 27] : (y >= 1996 ? [10, 22] : [15]);
    const paxConfigs = [
      { min: 20, span: 10 },
      { min: 4,  span: 3  },
      { min: 8,  span: 6  },
      { min: 16, span: 8  },
      { min: 5,  span: 4  },
      { min: 12, span: 6  }
    ];

    for (let bIdx = 0; bIdx < bookingsInMonth; bIdx++) {
      bookingSeq++;
      const tour = tourList[(bookingSeq + bIdx) % tourList.length];
      const cus = customerAccounts[bookingSeq % customerAccounts.length];
      const guide = guideAccounts[bookingSeq % guideAccounts.length];
      const cfg = paxConfigs[bIdx % paxConfigs.length];
      const pax = cfg.min + ((bookingSeq * 3) % cfg.span);
      const rawPrice = Math.max(2000, Math.round((tour.price * pax * revScale) / roundUnit) * roundUnit);
      const deposit = Math.round(rawPrice * 0.3);
      const remaining = rawPrice - deposit;

      const bookDay = bookDays[bIdx];
      const tourDateStr = ymd(y, m, bookDay);
      const createdIso = isoDate(y, m, Math.max(1, bookDay - 3), 9, 30);
      const depPayIso = isoDate(y, m, Math.max(1, bookDay - 2), 10, 0);
      const finPayIso = isoDate(y, m, Math.max(1, bookDay - 1), 14, 0);

      const b = {
        id: `bk_${bookingSeq}`,
        payCode: `TV${bookingSeq}`,
        tourId: tour.id,
        tourName: tour.name,
        tourDest: tour.dest,
        tourDuration: tour.duration,
        tourDays: tour.days,
        tourRegion: tour.region,
        userId: cus.id,
        userEmail: cus.email,
        customerName: cus.name,
        phone: cus.phone,
        date: tourDateStr,
        adults: pax,
        kids: 0,
        infants: 0,
        price: rawPrice,
        deposit: deposit,
        status: "completed",
        guideId: guide.id,
        guideName: guide.name,
        assignedGuide: guide.name,
        assignedGuideId: guide.id,
        createdAt: createdIso,
        confirmedAt: depPayIso,
        completedAt: isoDate(y, m, bookDay, 18, 0),
        history: [
          { status: "pending_payment", at: createdIso, by: cus.name, role: "CUSTOMER", note: "Khách đặt tour trực tuyến" },
          { status: "paid_deposit", at: depPayIso, by: "Lê Thu Ngân", role: "CASHIER", note: `Đã thu cọc ${deposit.toLocaleString()} ₫` },
          { status: "confirmed", at: depPayIso, by: "Quản Trị Viên", role: "ADMIN", note: "Admin duyệt đơn" },
          { status: "paid_full", at: finPayIso, by: "Lê Thu Ngân", role: "CASHIER", note: `Đã thu nốt ${remaining.toLocaleString()} ₫` },
          { status: "completed", at: isoDate(y, m, bookDay, 18, 0), by: guide.name, role: "GUIDE", note: "Chuyến đi hoàn thành tốt đẹp" }
        ],
        payments: [
          { id: `pay_${bookingSeq}_dep`, kind: "deposit", amount: deposit, at: depPayIso, by: "tn001", byName: "Lê Thu Ngân", method: "bank" },
          { id: `pay_${bookingSeq}_fin`, kind: "final", amount: remaining, at: finPayIso, by: "tn001", byName: "Lê Thu Ngân", method: "bank" }
        ]
      };

      bookings.push(b);
    }
  }
}

console.log(`[Historical] Generated ${bookings.length} bookings, ${dailyRevenues.length} revenue rows, ${salaryLogs.length} salary logs across 1986-2026.`);

// ─────────────────────────────────────────────────────────────
// 5. LIVE WORKFLOW BOOKINGS FOR NOVEMBER 2026
// ─────────────────────────────────────────────────────────────
console.log("Generating Live Workflow Data for November 2026...");

function makeLiveBooking(opts) {
  const tour = tourList.find(t => t.id === opts.tourId) || tourList[0];
  const cus = customerAccounts.find(c => c.id === opts.userId) || customerAccounts[0];
  const rawPrice = tour.price * opts.pax;
  const deposit = Math.round(rawPrice * 0.3);
  const remaining = rawPrice - deposit;

  const b = {
    id: opts.id,
    payCode: opts.id.replace("bk_", "TV"),
    tourId: tour.id,
    tourName: tour.name,
    tourDest: tour.dest,
    tourDuration: tour.duration,
    tourDays: tour.days,
    tourRegion: tour.region,
    userId: cus.id,
    userEmail: cus.email,
    customerName: cus.name,
    phone: cus.phone,
    date: opts.date,
    adults: opts.pax,
    kids: opts.kids || 0,
    infants: 0,
    price: rawPrice,
    deposit: deposit,
    status: opts.status,
    note: opts.note || "",
    guideId: opts.guideId || "",
    guideName: opts.guideName || "",
    assignedGuide: opts.guideName || "",
    assignedGuideId: opts.guideId || "",
    createdAt: timeOffsetDays(-5, 9, 0),
    history: [
      { status: "pending_payment", at: timeOffsetDays(-5, 9, 0), by: cus.name, role: "CUSTOMER", note: "Khách đặt tour" }
    ],
    payments: []
  };

  if (opts.status !== "pending_payment") {
    b.payments.push({
      id: `${opts.id}_dep`,
      kind: "deposit",
      amount: deposit,
      at: timeOffsetDays(-4, 10, 0),
      by: "tn001",
      byName: "Lê Thu Ngân",
      method: "bank"
    });
    b.history.push({
      status: "paid_deposit",
      at: timeOffsetDays(-4, 10, 0),
      by: "Lê Thu Ngân",
      role: "CASHIER",
      note: "Xác nhận đã nhận tiền cọc"
    });
  }

  if (opts.status === "confirmed" || opts.status === "in_progress" || opts.status === "completed" || opts.status === "guide_accepted") {
    b.confirmedAt = timeOffsetDays(-3, 11, 0);
    b.history.push({
      status: "confirmed",
      at: timeOffsetDays(-3, 11, 0),
      by: "Quản Trị Viên",
      role: "ADMIN",
      note: "Duyệt đơn khởi hành"
    });
  }

  bookings.push(b);
  return b;
}

// 1. Pending payment (Chờ thu cọc - cho Thu ngân)
makeLiveBooking({ id: "bk_1050", tourId: 101, userId: "cus001", pax: 3, date: daysOffset(TODAY_STR, 5), status: "pending_payment", note: "Khách chuyển khoản Vietcombank" });
makeLiveBooking({ id: "bk_1051", tourId: 103, userId: "cus003", pax: 4, date: daysOffset(TODAY_STR, 8), status: "pending_payment", note: "Khách chọn thanh toán QR" });

// 2. Paid deposit (Chờ admin duyệt đơn)
makeLiveBooking({ id: "bk_1052", tourId: 102, userId: "cus002", pax: 2, date: daysOffset(TODAY_STR, 4), status: "paid_deposit", note: "Yêu cầu phòng 1 giường đôi lớn" });
makeLiveBooking({ id: "bk_1053", tourId: 105, userId: "cus004", pax: 3, date: daysOffset(TODAY_STR, 7), status: "paid_deposit", note: "Gia đình có 1 người lớn tuổi" });

// 3. Refund pending (Chờ thu ngân hoàn tiền)
makeLiveBooking({ id: "bk_1054", tourId: 102, userId: "cus007", pax: 2, date: daysOffset(TODAY_STR, -4), status: "refund_pending", note: "Trùng lịch phỏng vấn visa, xin hoàn cọc" });

// 4. Confirmed (Chờ điều hành phân công HDV)
makeLiveBooking({ id: "bk_1055", tourId: 104, userId: "cus005", pax: 4, date: daysOffset(TODAY_STR, 2), status: "confirmed", note: "Khách cần hướng dẫn viên thạo tiếng Anh" });
makeLiveBooking({ id: "bk_1056", tourId: 101, userId: "cus006", pax: 5, date: daysOffset(TODAY_STR, 3), status: "confirmed", note: "Cần xe đón tận khách sạn phố cổ" });

// 5. Guide assigned (Chờ HDV nhận tour)
makeLiveBooking({ id: "bk_1057", tourId: 103, userId: "cus008", pax: 2, date: daysOffset(TODAY_STR, 1), status: "confirmed", guideId: "g1", guideName: "Trần Văn Quân", note: "Đã phân công HDV Quân" });
makeLiveBooking({ id: "bk_1058", tourId: 105, userId: "cus009", pax: 4, date: daysOffset(TODAY_STR, 2), status: "confirmed", guideId: "g2", guideName: "Nguyễn Thu Hà", note: "Đã phân công HDV Hà" });

// 6. In progress (Đang diễn ra tour)
makeLiveBooking({ id: "bk_1059", tourId: 106, userId: "cus010", pax: 3, date: daysOffset(TODAY_STR, 0), status: "in_progress", guideId: "g6", guideName: "Đặng Hữu Phúc", note: "Đoàn đang tham quan Chợ nổi Cái Răng" });

saveJson('bookings.json', bookings);
console.log(`[3] Saved bookings.json: ${bookings.length} total bookings (2010-2026)`);

// ─────────────────────────────────────────────────────────────
// 6. SAVE DAILY REVENUES (daily_revenues.json)
// ─────────────────────────────────────────────────────────────
dailyRevenues.sort((a, b) => 
  a.date === b.date 
    ? (a.createdAt || '').localeCompare(b.createdAt || '')
    : a.date.localeCompare(b.date)
);

saveJson('daily_revenues.json', dailyRevenues);
console.log(`[4] Saved daily_revenues.json: ${dailyRevenues.length} rows`);

// ─────────────────────────────────────────────────────────────
// 7. SAVE SALARY LOGS (salary_logs.json)
// ─────────────────────────────────────────────────────────────
saveJson('salary_logs.json', salaryLogs);
console.log(`[5] Saved salary_logs.json: ${salaryLogs.length} logs`);

// ─────────────────────────────────────────────────────────────
// 8. SAVE SALARY HISTORY (salary_history.json)
// ─────────────────────────────────────────────────────────────
saveJson('salary_history.json', salaryHistory);
console.log(`[6] Saved salary_history.json: ${salaryHistory.length} review records`);

// ─────────────────────────────────────────────────────────────
// 9. RECONCILIATIONS (reconciliations.json - Cho Thu ngân & Admin)
// ─────────────────────────────────────────────────────────────
console.log("Generating Reconciliations (27 daily records with full balances & audit)...");
const reconciliations = [];
let prevClosing = 35000000;
for (let d = -26; d <= 0; d++) {
  const dateStr = daysOffset(TODAY_STR, d);
  const isPending = (d >= -1); // 2 bản đóng sổ gần nhất ở trạng thái chờ duyệt (pending_approval)
  const totalIn = 25000000 + ((Math.abs(d) * 7) % 30) * 1000000;
  const totalOut = 5000000 + ((Math.abs(d) * 3) % 15) * 1000000;
  const opening = prevClosing;
  const closing = opening + totalIn - totalOut;
  prevClosing = closing;
  const id = `rec_${dateStr.replace(/-/g, '')}`;

  reconciliations.push({
    id,
    date: dateStr,
    cashierId: "tn001",
    cashierName: "Lê Thu Ngân",
    openingBalance: opening,
    totalIn,
    totalOut,
    closingBalance: closing,
    actualCash: closing,
    bankStatementTotal: closing,
    netTotal: totalIn - totalOut,
    discrepancy: 0,
    status: isPending ? "pending_approval" : "approved",
    approvedById: isPending ? null : "ad001",
    approvedByName: isPending ? null : "Quản Trị Viên",
    approvedAt: isPending ? null : timeOffsetDays(d + 1, 8, 30),
    note: isPending
      ? (d === 0 ? "Đóng sổ ca hôm nay – Chờ Quản trị viên xét duyệt xác nhận cuối ngày." : "Đóng sổ ca hôm qua – Đã nộp tiền mặt vào két sắt, chờ admin duyệt.")
      : `Đóng sổ ngày ${dateStr} – Khớp 100% sao kê tài khoản ngân hàng Vietcombank.`
  });
}

saveJson('reconciliations.json', reconciliations);
console.log(`[7] Saved reconciliations.json: ${reconciliations.length} records`);

// ─────────────────────────────────────────────────────────────
// 10. PAYMENTS (payments.json - Lệch tiền chờ Thu ngân xử lý)
// ─────────────────────────────────────────────────────────────
console.log("Generating Payments Discrepancies...");
const paymentsDiscrepancies = [
  {
    id: "pay_disc_01",
    bookingId: "bk_1050",
    payCode: "TV1050",
    customerName: "Nguyễn Văn An",
    expectedAmount: 2250000,
    receivedAmount: 2200000,
    diffAmount: -50000,
    status: "discrepancy",
    kind: "deposit",
    source: "Vietcombank QR",
    note: "Khách chuyển thiếu 50.000 ₫ do trừ phí ngân hàng. Đã liên hệ khách hẹn nộp bổ sung.",
    createdAt: timeOffsetDays(-1, 14, 20)
  },
  {
    id: "pay_disc_02",
    bookingId: "bk_1051",
    payCode: "TV1051",
    customerName: "Lê Hoàng Cường",
    expectedAmount: 5400000,
    receivedAmount: 5500000,
    diffAmount: 100000,
    status: "discrepancy",
    kind: "deposit",
    source: "Techcombank",
    note: "Khách chuyển dư 100.000 ₫. Đã ghi nhận cấn trừ vào đợt thanh toán nốt trước khởi hành.",
    createdAt: timeOffsetDays(0, 10, 15)
  }
];

saveJson('payments.json', paymentsDiscrepancies);
console.log(`[8] Saved payments.json: ${paymentsDiscrepancies.length} discrepancy records`);

// ─────────────────────────────────────────────────────────────
// 11. REFUNDS (refunds.json - Cho Thu ngân & Admin)
// ─────────────────────────────────────────────────────────────
console.log("Generating Refunds...");
const refunds = [
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
    requestedAt: timeOffsetDays(-3, 10, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-2, 14, 0),
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
    reason: "Khách hủy chuyến đi Đà Lạt do sức khỏe, yêu cầu hoàn cọc",
    requestedById: "cus002",
    requestedByName: "Trần Thị Bích",
    requestedRole: "CUSTOMER",
    requestedAt: timeOffsetDays(-1, 16, 30),
    note: "Chờ Admin xét duyệt tỷ lệ hoàn cọc"
  },
  {
    id: "rf_003",
    bookingId: "bk_1030",
    payCode: "TV1030",
    customerName: "Ngô Gia Khang",
    userId: "cus008",
    amount: 500000,
    source: "complaint",
    complaintId: "cmp_001",
    status: "paid",
    reason: "Bồi thường chậm xe đón sân bay",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "SUPPORT",
    requestedAt: timeOffsetDays(-4, 11, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-3, 15, 0),
    paidById: "tn001",
    paidByName: "Lê Thu Ngân",
    paidAt: timeOffsetDays(-2, 9, 30),
    note: "Đã chi trả thành công vào tài khoản ví của khách hàng"
  },
  {
    id: "rf_004",
    bookingId: "bk_1025",
    payCode: "TV1025",
    customerName: "Đinh Văn Hùng",
    userId: "cus005",
    amount: 2500000,
    source: "company_cancel",
    status: "approved",
    reason: "Công ty hủy tour Huế do không đủ số lượng khởi hành tối thiểu, hoàn 100% tiền tour",
    requestedById: "dh001",
    requestedByName: "Trần Điều Hành",
    requestedRole: "OPERATOR",
    requestedAt: timeOffsetDays(-2, 10, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1, 16, 0),
    note: "Đã duyệt chi, chờ thu ngân thực hiện chuyển khoản"
  },
  {
    id: "rf_005",
    bookingId: "bk_1018",
    payCode: "TV1018",
    customerName: "Lê Minh Quân",
    userId: "cus003",
    amount: 4800000,
    source: "customer_cancel",
    status: "paid",
    reason: "Khách xin đổi lịch công tác, báo hủy trước 20 ngày",
    requestedById: "cus003",
    requestedByName: "Lê Minh Quân",
    requestedRole: "CUSTOMER",
    requestedAt: timeOffsetDays(-6, 9, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-5, 11, 0),
    paidById: "tn001",
    paidByName: "Lê Thu Ngân",
    paidAt: timeOffsetDays(-4, 14, 0),
    note: "Đã hoàn tất hoàn tiền về tài khoản ngân hàng"
  },
  {
    id: "rf_006",
    bookingId: "bk_1012",
    payCode: "TV1012",
    customerName: "Hoàng Thảo Vy",
    userId: "cus009",
    amount: 1500000,
    source: "customer_cancel",
    status: "rejected",
    reason: "Khách báo hủy sát giờ khởi hành dưới 12 tiếng không có lý do bất khả kháng",
    requestedById: "cus009",
    requestedByName: "Hoàng Thảo Vy",
    requestedRole: "CUSTOMER",
    requestedAt: timeOffsetDays(-5, 18, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-4, 9, 0),
    note: "Từ chối hoàn tiền theo điều khoản hợp đồng du lịch (hủy trong vòng 24h mất 100% cọc)"
  },
  {
    id: "rf_007",
    bookingId: "bk_1060",
    payCode: "TV1060",
    customerName: "Trương Đình Trọng",
    userId: "cus011",
    amount: 3600000,
    source: "company_cancel",
    status: "pending_approval",
    reason: "Tour Côn Đảo tàu biển bị cấm xuất bến do thời tiết gió cấp 7",
    requestedById: "dh001",
    requestedByName: "Trần Điều Hành",
    requestedRole: "OPERATOR",
    requestedAt: timeOffsetDays(-1, 14, 0),
    note: "Đề xuất hoàn 100% tiền hoặc hỗ trợ đổi vé máy bay"
  },
  {
    id: "rf_008",
    bookingId: "bk_1065",
    payCode: "TV1065",
    customerName: "Đỗ Thanh Hằng",
    userId: "cus004",
    amount: 800000,
    source: "complaint",
    status: "approved",
    reason: "Bồi hoàn chi phí nâng cấp phòng khách sạn do sự cố đặt phòng",
    requestedById: "cs001",
    requestedByName: "Phạm Chăm Sóc",
    requestedRole: "SUPPORT",
    requestedAt: timeOffsetDays(-2, 16, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1, 10, 0),
    note: "Duyệt bồi hoàn chênh lệch giá phòng"
  }
];

saveJson('refunds.json', refunds);
console.log(`[9] Saved refunds.json: ${refunds.length} refund records`);

// ─────────────────────────────────────────────────────────────
// 12. COMPLAINTS (complaints.json - Cho CSKH & Admin)
// ─────────────────────────────────────────────────────────────
console.log("Generating Complaints...");
const complaints = [
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
    createdAt: timeOffsetDays(-4, 10, 0),
    updatedAt: timeOffsetDays(-2, 11, 0)
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
    createdAt: timeOffsetDays(-1, 14, 0),
    updatedAt: timeOffsetDays(0, 9, 0)
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
    status: "pending",
    supportNote: "Mới tiếp nhận, CSKH chuẩn bị gọi điện liên hệ khách.",
    createdAt: timeOffsetDays(0, 8, 30),
    updatedAt: timeOffsetDays(0, 8, 30)
  }
];

saveJson('complaints.json', complaints);
console.log(`[10] Saved complaints.json: ${complaints.length} complaints`);

// ─────────────────────────────────────────────────────────────
// 13. INCIDENTS (incidents.json - Cho Hướng dẫn viên & Điều hành)
// ─────────────────────────────────────────────────────────────
console.log("Generating Incidents...");
const incidents = [
  {
    id: "inc_001",
    bookingId: "bk_1059",
    payCode: "TV1059",
    guideId: "g6",
    guideName: "Đặng Hữu Phúc",
    tourName: "TP.HCM – Miền Tây Sông Nước 2N1Đ",
    type: "health",
    typeLabel: "Sức khỏe khách",
    severity: "medium",
    severityLabel: "Trung bình",
    title: "Khách bị say sóng và tụt huyết áp",
    description: "Khách nữ lớn tuổi đi cano ra Cồn Phụng bị say sóng. Đã đưa vào trạm y tế địa phương truyền nước, hiện sức khỏe đã ổn định.",
    status: "resolved",
    reportedAt: timeOffsetDays(-1, 11, 20),
    resolvedAt: timeOffsetDays(-1, 14, 0),
    resolvedNote: "Khách đã hồi phục và tiếp tục ăn trưa cùng đoàn bình thường."
  },
  {
    id: "inc_002",
    bookingId: "bk_1057",
    payCode: "TV1057",
    guideId: "g1",
    guideName: "Trần Văn Quân",
    tourName: "Đà Nẵng – Hội An 4N3Đ",
    type: "weather",
    typeLabel: "Thời tiết / Thiên tai",
    severity: "high",
    severityLabel: "Nghiêm trọng",
    title: "Mưa to tại đỉnh Bà Nà Hills, cáp treo tạm ngừng 1 giờ",
    description: "Cáp treo tạm ngừng do gió giật. Đoàn 25 khách đang nghỉ an toàn tại Nhà hàng Morin.",
    status: "in_progress",
    reportedAt: timeOffsetDays(0, 9, 45),
    resolvedNote: "Điều hành đang theo dõi diễn biến thời tiết với ban quản lý cáp treo."
  }
];

saveJson('incidents.json', incidents);
console.log(`[11] Saved incidents.json: ${incidents.length} incidents`);

// ─────────────────────────────────────────────────────────────
// 14. CANCEL PROPOSALS (cancelproposals.json - Cho Điều hành & Admin)
// ─────────────────────────────────────────────────────────────
console.log("Generating Cancel Proposals...");
const cancelproposals = [
  {
    id: "cp_001",
    tourId: 104,
    tourName: "Huế – Di Sản Cố Đô 3N2Đ",
    date: daysOffset(TODAY_STR, 6),
    reason: "Đoàn chỉ có 4 khách, không đủ số lượng tối thiểu (yêu cầu ≥ 10 khách) để khởi hành xe lớn.",
    mode: "offer",
    status: "pending",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(-1, 15, 0),
    note: "Đề xuất Admin phê duyệt cho khách chọn: hoàn 100% hoặc đổi sang tour Đà Nẵng cùng ngày."
  },
  {
    id: "cp_002",
    tourId: 108,
    tourName: "Quy Nhơn – Kỳ Co 3N2Đ",
    date: daysOffset(TODAY_STR, 10),
    reason: "Dự báo áp thấp nhiệt đới gây biển động cấp 7 tại bãi biển Kỳ Co – Eo Gió.",
    mode: "refund",
    status: "approved",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(-2, 10, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1, 9, 30),
    note: "Admin đã duyệt hủy chuyến bảo đảm an toàn, toàn bộ khách được hoàn tiền 100%."
  },
  {
    id: "cp_003",
    tourId: 102,
    tourName: "Hà Giang – Mã Pí Lèng 3N2Đ",
    date: daysOffset(TODAY_STR, 5),
    reason: "Sạt lở cục bộ đoạn đèo Mã Pí Lèng sau đợt mưa lớn, cơ quan chức năng tạm cấm xe khách trên 16 chỗ.",
    mode: "offer",
    status: "pending",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(-1, 11, 0),
    note: "Đề xuất lùi ngày khởi hành 3 ngày hoặc đổi phương tiện xe nhỏ 7 chỗ."
  },
  {
    id: "cp_004",
    tourId: 110,
    tourName: "Côn Đảo – Tâm Linh Huyền Bí 3N2Đ",
    date: daysOffset(TODAY_STR, 8),
    reason: "Cảng vụ hàng hải tạm ngừng cấp phép tàu cao tốc Trần Đề – Côn Đảo do gió giật cấp 7.",
    mode: "refund",
    status: "approved",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(-3, 14, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-2, 10, 0),
    note: "Admin đã duyệt phương án hủy chuyến, hoàn tiền cọc cho 12 khách."
  },
  {
    id: "cp_005",
    tourId: 106,
    tourName: "Mộc Châu – Mùa Hoa Mận 2N1Đ",
    date: daysOffset(TODAY_STR, 12),
    reason: "Đoàn chỉ có 3 khách, không đủ số lượng tối thiểu khởi hành độc lập.",
    mode: "offer",
    status: "rejected",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(-2, 8, 30),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-1, 14, 0),
    note: "Admin từ chối hủy: Yêu cầu Điều hành sử dụng tính năng 'Ghép tour' để gộp 3 khách này vào tour Mai Châu – Mộc Châu đi cùng ngày."
  },
  {
    id: "cp_006",
    tourId: 103,
    tourName: "Sapa – Fansipan Huyền Thoại 3N2Đ",
    date: daysOffset(TODAY_STR, 7),
    reason: "Hệ thống cáp treo Sun World Fansipan bảo trì kỹ thuật định kỳ 2 ngày trùng lịch tham quan chính.",
    mode: "offer",
    status: "pending",
    proposedById: "dh001",
    proposedByName: "Trần Điều Hành",
    proposedRole: "OPERATOR",
    proposedAt: timeOffsetDays(0, 7, 30),
    note: "Đề xuất khách đổi sang lịch trình khám phá Bản Cát Cát - Tả Van hoặc dời sang tuần sau."
  }
];

saveJson('cancelproposals.json', cancelproposals);
console.log(`[12] Saved cancelproposals.json: ${cancelproposals.length} cancel proposals`);

// ─────────────────────────────────────────────────────────────
// 15. TOUR DRAFTS (tour-drafts.json - Cho Biên tập & Admin)
// ─────────────────────────────────────────────────────────────
console.log("Generating Tour Drafts...");
const tourDrafts = [
  {
    id: "td_001",
    name: "Hà Giang – Mùa Hoa Tam Giác Mạch 3N2Đ",
    dest: "Hà Giang",
    region: "Miền Bắc",
    price: 3650000,
    duration: "3 ngày 2 đêm",
    guide: "guided",
    status: "pending_review",
    submittedById: "nd001",
    submittedByName: "Vũ Biên Tập",
    submittedAt: timeOffsetDays(-2, 16, 0),
    desc: "Chinh phục đèo Mã Pí Lèng hùng vĩ, du thuyền sông Nho Quế và ngắm cánh đồng tam giác mạch nở rộ.",
    note: "Đã hoàn thiện lịch trình chi tiết và bảng giá, kính gửi Admin duyệt xuất bản lên website."
  },
  {
    id: "td_002",
    name: "Tây Ninh – Săn Mây Đỉnh Núi Bà Đen 1N",
    dest: "Tây Ninh",
    region: "Miền Nam",
    price: 990000,
    duration: "1 ngày",
    guide: "guided",
    status: "published",
    submittedById: "nd001",
    submittedByName: "Vũ Biên Tập",
    submittedAt: timeOffsetDays(-7, 10, 0),
    approvedById: "ad001",
    approvedByName: "Quản Trị Viên",
    approvedAt: timeOffsetDays(-5, 14, 0),
    desc: "Trải nghiệm hệ thống cáp treo hiện đại, chiêm bái tượng Phật Bà Tây Bổ Đà Sơn kỷ lục châu Á."
  }
];

saveJson('tour-drafts.json', tourDrafts);
console.log(`[13] Saved tour-drafts.json: ${tourDrafts.length} drafts`);

// ─────────────────────────────────────────────────────────────
// 16. DEPARTURES (departures.json - Cho Điều hành)
// ─────────────────────────────────────────────────────────────
console.log("Generating Departures...");
const departures = [
  { id: "dep_01", tourId: 101, tourName: "Hà Nội – Hạ Long 3N2Đ", date: daysOffset(TODAY_STR, 1), maxPax: 25, bookedPax: 22, guideId: "g1", guideName: "Trần Văn Quân", status: "open" },
  { id: "dep_02", tourId: 102, tourName: "Sa Pa – Fansipan 3N2Đ", date: daysOffset(TODAY_STR, 3), maxPax: 20, bookedPax: 20, guideId: "g3", guideName: "Lê Hoàng Long", status: "full" },
  { id: "dep_03", tourId: 103, tourName: "Đà Nẵng – Hội An 4N3Đ", date: daysOffset(TODAY_STR, 5), maxPax: 30, bookedPax: 18, guideId: "g4", guideName: "Phạm Minh Đức", status: "open" },
  { id: "dep_04", tourId: 105, tourName: "Phú Quốc Thiên Đường Biển 3N2Đ", date: daysOffset(TODAY_STR, 7), maxPax: 25, bookedPax: 15, guideId: "g6", guideName: "Đặng Hữu Phúc", status: "open" }
];

saveJson('departures.json', departures);
console.log(`[14] Saved departures.json: ${departures.length} departures`);

// ─────────────────────────────────────────────────────────────
// 17. WAITLIST (waitlist.json - Cho Điều hành)
// ─────────────────────────────────────────────────────────────
console.log("Generating Waitlist...");
const waitlist = [
  { id: "wl_01", tourId: 102, tourName: "Sa Pa – Fansipan 3N2Đ", date: daysOffset(TODAY_STR, 3), customerName: "Lê Thị Hồng", phone: "0908889991", pax: 2, createdAt: timeOffsetDays(-1, 10, 0), status: "waiting" },
  { id: "wl_02", tourId: 102, tourName: "Sa Pa – Fansipan 3N2Đ", date: daysOffset(TODAY_STR, 3), customerName: "Nguyễn Hải Đăng", phone: "0908889992", pax: 3, createdAt: timeOffsetDays(-1, 14, 30), status: "waiting" }
];

saveJson('waitlist.json', waitlist);
console.log(`[15] Saved waitlist.json: ${waitlist.length} waitlist records`);

// ─────────────────────────────────────────────────────────────
// 18. WITHDRAWALS (withdrawals.json - Cho Thu ngân)
// ─────────────────────────────────────────────────────────────
console.log("Generating Withdrawals...");
const withdrawals = [
  { id: "wd_001", userId: "hdv003", userName: "Lê Hoàng Long", role: "guide", amount: 5000000, bank: "Vietcombank", account: "001100223344", status: "pending", requestedAt: timeOffsetDays(0, 9, 0), note: "Rút tiền công tour tháng 10" },
  { id: "wd_002", userId: "cus003", userName: "Lê Hoàng Cường", role: "customer", amount: 2000000, bank: "Techcombank", account: "190334455667", status: "approved", requestedAt: timeOffsetDays(-1, 14, 0), approvedAt: timeOffsetDays(0, 8, 30), note: "Rút tiền thưởng hoàn tour" }
];

saveJson('withdrawals.json', withdrawals);
console.log(`[16] Saved withdrawals.json: ${withdrawals.length} withdrawals`);

// ─────────────────────────────────────────────────────────────
// 19. VOUCHERS (vouchers.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Vouchers...");
const vouchers = [
  { id: "vouch_01", code: "WELCOME2026", discountPercent: 10, maxDiscount: 500000, minOrder: 2000000, expiryDate: "2026-12-31", active: true, usageCount: 48, note: "Mã giảm giá chào đón thành viên mới" },
  { id: "vouch_02", code: "TRIAN500", discountAmount: 500000, minOrder: 5000000, expiryDate: "2026-11-30", active: true, usageCount: 25, note: "Tri ân khách hàng thân thiết mùa thu" },
  { id: "vouch_03", code: "HANOI200", discountAmount: 200000, minOrder: 2000000, expiryDate: "2026-12-15", active: true, usageCount: 62, note: "Ưu đãi tour miền Bắc" }
];

saveJson('vouchers.json', vouchers);
console.log(`[17] Saved vouchers.json: ${vouchers.length} vouchers`);

// ─────────────────────────────────────────────────────────────
// 20. BANNERS (banners.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Banners...");
// Giữ lại banner tùy chỉnh của người dùng nếu đã có, tránh bị ghi đè mất
let banners = [];
const bannerDbPath = path.join(dbDir, 'banners.json');
if (fs.existsSync(bannerDbPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(bannerDbPath, 'utf8'));
    if (Array.isArray(existing) && existing.length > 0) banners = existing;
  } catch (e) {}
}
if (!banners.length) {
  banners = [
    { id: "bn_user_01", tourId: "101", title: "Hà Nội – Vịnh Hạ Long 3N2Đ: Kỳ quan thiên nhiên thế giới", subtitle: "Du thuyền 4 sao cao cấp, thăm Đảo Titop & Hang Sửng Sốt kỳ vĩ", image: "img/banners/ha-noi-vinh-ha-long-3n2d-mwbdwuna.jpg", imageUrl: "/img/banners/ha-noi-vinh-ha-long-3n2d-mwbdwuna.jpg", badge: "⛵ KỲ QUAN THẾ GIỚI", bgFrom: "#064e3b", bgTo: "#047857", link: "#/tour/101", ctaText: "Đặt tour ngay", priority: 100, enabled: true, active: true, order: 1, startAt: "2026-01-01T00:00:00.000Z", endAt: "2036-12-31T23:59:59.000Z", createdAt: "2026-11-11T07:32:00.000Z" },
    { id: "bn_user_02", tourId: "108", title: "Phú Quốc – Sunset Sanato 3N2Đ: Thiên đường nghỉ dưỡng", subtitle: "Trải nghiệm cáp treo Hòn Thơm vượt biển, tắm biển Bãi Sao & Grand World", image: "img/banners/phu-quoc-sunset-sanato-3n2d-mwbdyc24.jpg", imageUrl: "/img/banners/phu-quoc-sunset-sanato-3n2d-mwbdyc24.jpg", badge: "🌴 THIÊN ĐƯỜNG BIỂN ĐẢO", bgFrom: "#701a75", bgTo: "#a21caf", link: "#/tour/108", ctaText: "Đặt tour ngay", priority: 95, enabled: true, active: true, order: 2, startAt: "2026-01-01T00:00:00.000Z", endAt: "2036-12-31T23:59:59.000Z", createdAt: "2026-11-11T07:33:00.000Z" },
    { id: "bn_user_03", tourId: "112", title: "Singapore – Malaysia 5N4Đ: Đẳng cấp quốc tế", subtitle: "Khám phá Gardens by the Bay, Marina Bay Sands & Tháp đôi Petronas", image: "img/banners/singapore-malaysia-5n4d-dang-cap-quoc-te-mwbdv1mq.jpg", imageUrl: "/img/banners/singapore-malaysia-5n4d-dang-cap-quoc-te-mwbdv1mq.jpg", badge: "🏆 TOP 1 BÁN CHẠY NHẤT", bgFrom: "#0f172a", bgTo: "#1e3a8a", link: "#/tour/112", ctaText: "Đặt tour ngay", priority: 90, enabled: true, active: true, order: 3, startAt: "2026-01-01T00:00:00.000Z", endAt: "2036-12-31T23:59:59.000Z", createdAt: "2026-11-11T07:30:00.000Z" },
    { id: "bn_user_04", tourId: "111", title: "Thái Lan – Bangkok – Pattaya 5N4Đ: Xứ sở Chùa Vàng", subtitle: "Chiêm ngưỡng Cung điện Hoàng Gia, tắm biển đảo San Hô Coral & Chợ nổi 4 miền", image: "img/banners/thai-lan-bangkok-pattaya-5n4d-mwbdvwrk.jpg", imageUrl: "/img/banners/thai-lan-bangkok-pattaya-5n4d-mwbdvwrk.jpg", badge: "🔥 TOP 2 DOANH THU", bgFrom: "#1e1b4b", bgTo: "#4338ca", link: "#/tour/111", ctaText: "Đặt tour ngay", priority: 85, enabled: true, active: true, order: 4, startAt: "2026-01-01T00:00:00.000Z", endAt: "2036-12-31T23:59:59.000Z", createdAt: "2026-11-11T07:31:00.000Z" }
  ];
}

saveJson('banners.json', banners);
console.log(`[18] Saved banners.json: ${banners.length} banners`);

// ─────────────────────────────────────────────────────────────
// 21. REVIEWS (reviews.json - Đánh giá cao và thấp, trong đó cao chiếm 95%)
// ─────────────────────────────────────────────────────────────
console.log("Generating Reviews (95% High Ratings 4-5★, 5% Low Ratings 1-3★ with Admin replies)...");

const reviewTours = [
  { id: "101", name: "Hà Nội – Vịnh Hạ Long 3N2Đ" },
  { id: "102", name: "Sa Pa – Fansipan Huyền Thoại 3N2Đ" },
  { id: "103", name: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ" },
  { id: "104", name: "Huế – Di Sản Cố Đô 3N2Đ" },
  { id: "105", name: "Đà Lạt – Thành Phố Ngàn Hoa 3N2Đ" },
  { id: "106", name: "Nha Trang – Vịnh Biển Xanh 4N3Đ" },
  { id: "107", name: "Cần Thơ – Miền Tây Sông Nước 2N1Đ" },
  { id: "108", name: "Phú Quốc – Sunset Sanato 3N2Đ" },
  { id: "109", name: "Hà Giang – Mã Pí Lèng – Sông Nho Quế 3N2Đ" },
  { id: "111", name: "Thái Lan – Bangkok – Pattaya 5N4Đ" },
  { id: "112", name: "Singapore – Malaysia 5N4Đ" }
];

const customerReviewers = [
  "Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Long", "Phạm Minh Đức", "Vũ Mai Phương",
  "Hoàng Gia Bảo", "Đỗ Thị Ngọc", "Ngô Quốc Tuấn", "Dương Cẩm Tú", "Bùi Thanh Trúc",
  "Lý Kiến Quốc", "Trương Vĩnh Ký", "Võ Thị Mai", "Đặng Hữu Phúc", "Hồ Trọng Nghĩa",
  "Nguyễn Thị Kim Chi", "Đoàn Quốc Cường", "Phan Thanh Thảo", "Lâm Mỹ Hạnh", "Huỳnh Tấn Phát",
  "Tạ Quang Bửu", "Cao Thị Bích", "Chu Đức Thắng", "Mai Phương Thúy", "Lương Triều Vĩ"
];

const praiseComments = [
  "Chuyến đi vô cùng tuyệt vời! Hướng dẫn viên chu đáo, am hiểu kiến thức và nhiệt tình chụp ảnh cho cả đoàn.",
  "Dịch vụ chuyên nghiệp vượt mong đợi. Xe đưa đón êm ái, khách sạn sạch đẹp ngay trung tâm, bữa ăn phong phú đậm đà bản sắc địa phương.",
  "Gia đình mình có người lớn tuổi và trẻ nhỏ nhưng lịch trình được sắp xếp rất hợp lý, không bị mệt mỏi.",
  "Cảnh đẹp xuất sắc, hướng dẫn viên dẫn đoàn rất có tâm và truyền cảm hứng. Chắc chắn sẽ tiếp tục ủng hộ công ty cho các chuyến đi sau!",
  "Khách sạn 4 sao view cực đỉnh, đồ ăn rất ngon miệng. Tour tổ chức rất đúng giờ và không phát sinh chi phí ẩn.",
  "Thủ tục đăng ký tour nhanh chóng, nhân viên tư vấn nhiệt tình. Chuyến đi mang lại nhiều kỷ niệm đáng nhớ cho hai vợ chồng.",
  "Điểm đến đẹp ngỡ ngàng, đoàn vui vẻ và đồ ăn địa phương ngon tuyệt. Rất hài lòng với dịch vụ của Travel!",
  "Lần đầu tiên đi tour mà cảm thấy thoải mái như đi tự túc vì HDV rất tôn trọng thời gian riêng của từng nhóm.",
  "Tài xế lái xe cẩn thận, an toàn trên suốt cung đường đèo. Hướng dẫn viên vui tính, hoạt náo cả đoàn suốt chuyến đi.",
  "Món ăn đặc sản ba miền được công ty chăm chút kỹ lưỡng, mỗi bữa là một trải nghiệm ẩm thực đáng giá."
];

let generatedReviews = [];

// 1. Tạo đúng 102 đánh giá 5 sao (78.5%)
for (let i = 1; i <= 102; i++) {
  const t = reviewTours[(i - 1) % reviewTours.length];
  const name = customerReviewers[(i - 1) % customerReviewers.length];
  const cmt = praiseComments[(i - 1) % praiseComments.length];
  const daysAgo = Math.floor((102 - i) * 2.5) + 1;
  generatedReviews.push({
    id: `rv_${t.id}_5s_${String(i).padStart(3, '0')}`,
    tourId: t.id,
    tourName: t.name,
    userId: `kh_${String((i % 25) + 1).padStart(3, '0')}`,
    name: name,
    rating: 5,
    content: `${cmt} (${t.name})`,
    criteria: { guide: 5, transport: 5, food: 5, hotel: 5, value: 5 },
    guideRating: 5,
    guideComment: "Hướng dẫn viên xuất sắc, nhiệt tình và rất chu đáo hỗ trợ từng thành viên trong đoàn.",
    createdAt: timeOffsetDays(-daysAgo, 10 + (i % 8), (i * 7) % 60),
    date: daysOffset(TODAY_STR, -daysAgo),
    source: "verified",
    sample: false
  });
}

// 2. Tạo đúng 22 đánh giá 4 sao (16.9%) -> Tổng 4-5 sao = 124/130 = 95.4%
for (let i = 1; i <= 22; i++) {
  const t = reviewTours[(i + 2) % reviewTours.length];
  const name = customerReviewers[(i + 4) % customerReviewers.length];
  const daysAgo = Math.floor((22 - i) * 10) + 3;
  generatedReviews.push({
    id: `rv_${t.id}_4s_${String(i).padStart(3, '0')}`,
    tourId: t.id,
    tourName: t.name,
    userId: `kh_${String(((i + 5) % 25) + 1).padStart(3, '0')}`,
    name: name,
    rating: 4,
    content: `Tour rất tốt và đáng giá tiền. Cảnh quan đẹp, HDV hòa đồng. Điểm trừ nhỏ là ngày cuối thời tiết hơi nắng nhưng công ty đã phát thêm nón và nước suối đầy đủ.`,
    criteria: { guide: 5, transport: 4, food: 4, hotel: 4, value: 4 },
    guideRating: 5,
    guideComment: "HDV hỗ trợ nhiệt tình, giải quyết thắc mắc nhanh gọn.",
    createdAt: timeOffsetDays(-daysAgo, 14, (i * 11) % 60),
    date: daysOffset(TODAY_STR, -daysAgo),
    source: "verified",
    sample: false
  });
}

// 3. Tạo đúng 6 đánh giá 1-3 sao (4.6%) có kèm phản hồi chính thức từ Admin
const lowReviews = [
  {
    id: "rv_104_3s_001",
    tourId: "104",
    tourName: "Huế – Di Sản Cố Đô 3N2Đ",
    userId: "kh_019",
    name: "Phan Thanh Thảo",
    rating: 3,
    content: "Khách sạn phòng hơi nhỏ so với ảnh chụp trên app, nhưng bù lại HDV nhiệt tình và các bữa ăn rất ngon miệng đậm chất Huế.",
    criteria: { guide: 4, transport: 4, food: 4, hotel: 2, value: 3 },
    guideRating: 4,
    guideComment: "HDV thuyết minh Đại Nội và chùa Thiên Mụ rất hay.",
    createdAt: timeOffsetDays(-18, 11, 20),
    date: daysOffset(TODAY_STR, -18),
    reply: {
      content: "Travel chân thành cảm ơn chị Thảo đã đóng góp ý kiến. Ban điều hành đã làm việc trực tiếp với khách sạn để nâng cấp các phòng tiêu chuẩn lên hạng Deluxe cho các đoàn tiếp theo ạ!",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-17, 9, 30)
    }
  },
  {
    id: "rv_102_3s_002",
    tourId: "102",
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    userId: "kh_020",
    name: "Lâm Mỹ Hạnh",
    rating: 3,
    content: "Lịch trình ngày thứ 2 di chuyển hơi gấp, trời nhiều sương mù nên các bác lớn tuổi trong đoàn hơi mệt khi leo dốc.",
    criteria: { guide: 4, transport: 3, food: 4, hotel: 4, value: 3 },
    guideRating: 4,
    guideComment: "HDV tận tụy dìu các bác lớn tuổi, đánh giá cao sự chu đáo của bạn.",
    createdAt: timeOffsetDays(-25, 16, 45),
    date: daysOffset(TODAY_STR, -25),
    reply: {
      content: "Travel xin tiếp thu phản hồi của chị Hạnh. Công ty đã điều chỉnh giãn cách lịch trình và bố trí thêm xe trung chuyển hỗ trợ quý khách lớn tuổi.",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-24, 10, 15)
    }
  },
  {
    id: "rv_103_3s_003",
    tourId: "103",
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    userId: "kh_021",
    name: "Huỳnh Tấn Phát",
    rating: 3,
    content: "Xe đưa đón sân bay trễ 20 phút do kẹt xe giờ cao điểm tan tầm.",
    criteria: { guide: 4, transport: 2, food: 4, hotel: 4, value: 3 },
    guideRating: 4,
    guideComment: "HDV đã chủ động xin lỗi và tặng voucher nước uống cho đoàn.",
    createdAt: timeOffsetDays(-32, 18, 0),
    date: daysOffset(TODAY_STR, -32),
    reply: {
      content: "Travel xin thành thật cáo lỗi về sự cố giao thông ngoài ý muốn. Chúng tôi đã kéo dài thêm thời gian tham quan tại Hội An bù lại cho đoàn ạ.",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-31, 8, 30)
    }
  },
  {
    id: "rv_106_2s_001",
    tourId: "106",
    tourName: "Nha Trang – Vịnh Biển Xanh 4N3Đ",
    userId: "kh_022",
    name: "Cao Thị Bích",
    rating: 2,
    content: "Bữa trưa ngày đầu ở nhà hàng hải sản phục vụ khá chậm do nhà hàng quá đông khách du lịch.",
    criteria: { guide: 3, transport: 3, food: 1, hotel: 3, value: 2 },
    guideRating: 3,
    guideComment: "HDV đã hối thúc nhà hàng nhưng vẫn mất khá nhiều thời gian chờ đợi.",
    createdAt: timeOffsetDays(-45, 12, 15),
    date: daysOffset(TODAY_STR, -45),
    reply: {
      content: "Travel đã làm việc và lập biên bản kiểm tra với đối tác nhà hàng, đồng thời cam kết bố trí sảnh riêng cho khách Travel để không phải chờ đợi.",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-44, 14, 0)
    }
  },
  {
    id: "rv_109_2s_002",
    tourId: "109",
    tourName: "Hà Giang – Mã Pí Lèng – Sông Nho Quế 3N2Đ",
    userId: "kh_023",
    name: "Chu Đức Thắng",
    rating: 2,
    content: "Hệ thống máy lạnh hàng ghế sau của xe 16 chỗ bị yếu khi đi giữa trưa.",
    criteria: { guide: 4, transport: 1, food: 3, hotel: 3, value: 2 },
    guideRating: 4,
    guideComment: "HDV đã chủ động đổi chỗ và hỗ trợ quạt tay cho hành khách.",
    createdAt: timeOffsetDays(-60, 15, 30),
    date: daysOffset(TODAY_STR, -60),
    reply: {
      content: "Công ty đã lập tức yêu cầu đối tác xe đưa phương tiện vào xưởng bảo dưỡng lại toàn bộ máy lạnh. Rất xin lỗi anh Thắng về trải nghiệm này.",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-59, 9, 0)
    }
  },
  {
    id: "rv_101_1s_001",
    tourId: "101",
    tourName: "Hà Nội – Vịnh Hạ Long 3N2Đ",
    userId: "kh_024",
    name: "Lương Triều Vĩ",
    rating: 1,
    content: "Chuyến tham quan hang Sửng Sốt bị hủy vào phút chót do lệnh cấm tàu khi có dông lốc bất ngờ.",
    criteria: { guide: 3, transport: 3, food: 3, hotel: 3, value: 1 },
    guideRating: 3,
    guideComment: "HDV giải thích lý do cấm tàu từ cảng vụ nhưng cả nhà hơi hụt hẫng.",
    createdAt: timeOffsetDays(-75, 17, 0),
    date: daysOffset(TODAY_STR, -75),
    reply: {
      content: "Travel thành thật cáo lỗi cùng quý khách. Việc hoãn xuất bến theo lệnh khẩn cấp của Cảng vụ hàng hải nhằm đảm bảo an toàn tuyệt đối tính mạng cho hành khách trong cơn dông lốc. Travel đã hoàn lại 100% tiền vé tham quan vào ví của quý khách ạ.",
      repliedBy: "Quản Trị Viên (Admin)",
      repliedAt: timeOffsetDays(-74, 10, 0)
    }
  }
];

generatedReviews = generatedReviews.concat(lowReviews);

saveJson('reviews.json', generatedReviews);
console.log(`[19] Saved reviews.json: ${generatedReviews.length} reviews (124 high [95.4%], 6 low [4.6%])`);

// ─────────────────────────────────────────────────────────────
// 22. NOTIFICATIONS (notifications.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Notifications...");
const notifications = [
  { id: "noti_001", userId: "ad001", title: "Báo cáo doanh thu tháng 10/2026 đã sẵn sàng", body: "Toàn bộ số liệu đối soát doanh thu và quỹ lương tháng 10/2026 đã được cập nhật.", type: "system", read: false, createdAt: timeOffsetDays(-1) },
  { id: "noti_002", userId: "tn001", title: "Có yêu cầu hoàn tiền mới cần xử lý", body: "Đơn TV1054 đã được Quản trị viên duyệt hoàn tiền.", type: "refund", read: false, createdAt: timeOffsetDays(-1) },
  { id: "noti_003", userId: "dh001", title: "Đề xuất hủy tour đang chờ phản hồi", body: "Tour Huế ngày 16/11 đã gửi cho Quản trị viên duyệt hủy chuyến.", type: "operator", read: true, createdAt: timeOffsetDays(-2) },
  { id: "noti_004", userId: "cs001", title: "Khiếu nại mới từ khách hàng", body: "Khách hàng Trần Thị Bích gửi phản ánh về phòng khách sạn tour Đà Nẵng.", type: "support", read: false, createdAt: timeOffsetDays(-1) },
  { id: "noti_005", userId: "hdv001", title: "Bạn đã được phân công dẫn tour", date: daysOffset(TODAY_STR, 1), body: "Tour Đà Nẵng – Hội An 4N3Đ xuất phát ngày mai.", type: "guide", read: false, createdAt: timeOffsetDays(0, 8, 0) }
];

saveJson('notifications.json', notifications);
console.log(`[20] Saved notifications.json: ${notifications.length} notifications`);

// ─────────────────────────────────────────────────────────────
// 23. AUDIT TRAIL (audit.json)
// ─────────────────────────────────────────────────────────────
console.log("Generating Audit Trail...");
const auditLogs = [
  { id: "aud_001", actorId: "ad001", actorName: "Quản Trị Viên", actorRole: "ADMIN", action: "salary.pay", targetId: "SAL-tn001-202610", note: "Phát lương định kỳ tháng 10/2026 cho nhân viên", at: timeOffsetDays(-15) },
  { id: "aud_002", actorId: "ad001", actorName: "Quản Trị Viên", actorRole: "ADMIN", action: "reconciliation.approve", targetId: "rec_20261109", note: "Duyệt đóng sổ ca ngày 09/11", at: timeOffsetDays(0, 8, 30) },
  { id: "aud_003", actorId: "tn001", actorName: "Lê Thu Ngân", actorRole: "CASHIER", action: "payment.confirm", targetId: "TV1052", note: "Xác nhận thu tiền cọc đơn TV1052", at: timeOffsetDays(-4, 10, 0) }
];

saveJson('audit.json', auditLogs);
console.log(`[21] Saved audit.json: ${auditLogs.length} audit logs`);

// ─────────────────────────────────────────────────────────────
// 24. TOUR POOLS (tour_pools.json - Ghép tour, Gom khách & Tối ưu AI)
// ─────────────────────────────────────────────────────────────
console.log("Generating Tour Pools (tour_pools.json)...");
const tourPools = [
  {
    id: "pool_001",
    tourId: 105,
    tourName: "Đà Nẵng – Hội An – Bà Nà Hills 4N3Đ",
    destination: "Đà Nẵng",
    date: daysOffset(TODAY_STR, 8),
    minPax: 6,
    maxPax: 16,
    currentPax: 8,
    targetVehicle: "Xe 16 chỗ Ford Transit",
    discountPercent: 15,
    status: "ready_depart",
    bookings: ["bk_1001", "bk_1002"],
    createdAt: timeOffsetDays(-4, 9, 0),
    note: "Đoàn đã gom đủ điều kiện khởi hành tối thiểu (8/16 khách), xe 16 chỗ và 1 HDV đi kèm."
  },
  {
    id: "pool_002",
    tourId: 102,
    tourName: "Sa Pa – Fansipan Huyền Thoại 3N2Đ",
    destination: "Sapa",
    date: daysOffset(TODAY_STR, 10),
    minPax: 8,
    maxPax: 16,
    currentPax: 4,
    targetVehicle: "Xe 16 chỗ Solati VIP",
    discountPercent: 20,
    status: "open",
    bookings: ["bk_1003"],
    createdAt: timeOffsetDays(-3, 10, 0),
    note: "Đang gom khách, thiếu 4 khách để đạt số lượng tối thiểu 8 khách."
  },
  {
    id: "pool_003",
    tourId: 108,
    tourName: "Phú Quốc – Thiên Đường Biển Đảo 3N2Đ",
    destination: "Phú Quốc",
    date: daysOffset(TODAY_STR, 12),
    minPax: 10,
    maxPax: 29,
    currentPax: 7,
    targetVehicle: "Xe 29 chỗ Thaco Universe",
    discountPercent: 15,
    status: "open",
    bookings: ["bk_1004", "bk_1005"],
    createdAt: timeOffsetDays(-2, 14, 0),
    note: "Đã có 7 khách đăng ký, gom thêm 3 khách để đảm bảo khởi hành xe 29 chỗ."
  },
  {
    id: "pool_004",
    tourId: 101,
    tourName: "Hà Nội – Vịnh Hạ Long Du Thuyền 3N2Đ",
    destination: "Hạ Long",
    date: daysOffset(TODAY_STR, 5),
    minPax: 6,
    maxPax: 12,
    currentPax: 6,
    targetVehicle: "Xe Limousine 12 chỗ",
    discountPercent: 10,
    status: "ready_depart",
    bookings: ["bk_1006"],
    createdAt: timeOffsetDays(-5, 8, 30),
    note: "Đủ 6 khách khởi hành limousine kết hợp ngủ đêm du thuyền 5 sao."
  },
  {
    id: "pool_005",
    tourId: 107,
    tourName: "Cần Thơ – Chợ Nổi Cái Răng – Cà Mau 3N2Đ",
    destination: "Cần Thơ",
    date: daysOffset(TODAY_STR, 7),
    minPax: 8,
    maxPax: 20,
    currentPax: 12,
    targetVehicle: "Xe 29 chỗ Universe",
    discountPercent: 10,
    status: "ready_depart",
    bookings: ["bk_1007", "bk_1008"],
    createdAt: timeOffsetDays(-4, 11, 0),
    note: "Đoàn miền Tây đạt 12/20 khách, chuẩn bị chốt danh sách xuất phát."
  },
  {
    id: "pool_006",
    tourId: 109,
    tourName: "Hà Giang – Mã Pí Lèng – Sông Nho Quế 3N2Đ",
    destination: "Hà Giang",
    date: daysOffset(TODAY_STR, 15),
    minPax: 6,
    maxPax: 16,
    currentPax: 3,
    targetVehicle: "Xe 16 chỗ Ford Transit",
    discountPercent: 25,
    status: "open",
    bookings: ["bk_1009"],
    createdAt: timeOffsetDays(-1, 16, 0),
    note: "Tour mùa hoa tam giác mạch đang gom khách lẻ, hỗ trợ giảm 25% giá tour."
  }
];

saveJson('tour_pools.json', tourPools);
console.log(`[22] Saved tour_pools.json: ${tourPools.length} tour pools`);

console.log("\n=======================================================");
console.log("🎉 ALL MOCK DATA GENERATION COMPLETE!");
console.log(`- Years covered: 2010 to 2026 (Historical data up to Month 10/2026).`);
console.log(`- Month 11/2026: Active test workflows for all roles.`);
console.log(`- Month 12/2026: Intentionally empty for 2026 dashboard view.`);
console.log(`- Total Bookings: ${bookings.length}`);
console.log(`- Total Daily Revenues: ${dailyRevenues.length} (including monthly salary deductions)`);
console.log(`- Total Salary Logs: ${salaryLogs.length}`);
console.log(`- Saved cleanly to: backend/storage/db, backend/storage, storage/db, frontend/data/mock`);
console.log("=======================================================\n");
