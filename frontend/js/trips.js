/**
 * trips.js – TripManager
 * CRUD chuyến đi và địa điểm
 * Phụ thuộc: storage.js, utils.js, constants.js
 */

/**
 * Class TripModel (ES6+ Class)
 * Đại diện cho đối tượng chuyến đi — dùng khi tạo trip mới
 */
class TripModel {
  constructor({ name, destination, startDate, endDate, budget, members, description, emoji, coverImage, guideHire }) {
    this.id          = uid("trip");
    this.name        = name.trim();
    this.destination = destination.trim();
    this.startDate   = startDate;
    this.endDate     = endDate;
    this.budget      = +budget;
    this.members     = +members || 1;
    this.description = description?.trim() || "";
    this.emoji       = emoji || "✈️";
    this.coverImage  = coverImage || "";   // Task 3.1: base64 ảnh bìa
    this.guideHire   = guideHire || { enabled: false };   // thuê HDV nội địa
    this.createdAt   = new Date().toISOString();
    this.days        = [];
  }

  // Tính số ngày của chuyến đi
  get duration() {
    return Math.max(1,
      Math.round((new Date(this.endDate) - new Date(this.startDate)) / 864e5) + 1
    );
  }

  // Tính trạng thái
  get status() {
    const today = new Date().toISOString().split("T")[0];
    if (this.endDate < today)    return "completed";
    if (this.startDate <= today) return "ongoing";
    return "upcoming";
  }

  // Tổng chi thực tế
  get actualSpent() {
    return this.days.reduce((s, d) =>
      s + d.locations.reduce((ls, l) => ls + l.actualCost, 0), 0);
  }

  // Còn lại trong ngân sách
  get remaining() {
    return this.budget - this.actualSpent;
  }

  // Chuyển sang plain object để lưu localStorage
  toJSON() {
    return {
      id: this.id, name: this.name, destination: this.destination,
      startDate: this.startDate, endDate: this.endDate,
      budget: this.budget, members: this.members,
      description: this.description, emoji: this.emoji,
      coverImage: this.coverImage,   // Task 3.1
      guideHire: this.guideHire,
      createdAt: this.createdAt, days: this.days
    };
  }
}

// TripManager  (trips.js)
const TripManager = (() => {

  // Tính trạng thái dựa trên ngày hôm nay
  const statusOf = (start, end) => {
    const today = new Date().toISOString().split("T")[0];
    if (end < today)  return "completed";
    if (start <= today) return "ongoing";
    return "upcoming";
  };

  // Tạo mảng ngày từ startDate → endDate
  const makeDays = (start, end) => {
    const days = [];
    const s = new Date(start);
    const e = new Date(end);
    let cur = new Date(s);
    let n   = 1;
    while (cur <= e) {
      days.push({
        id:        uid("day"),
        label:     `Ngày ${n}`,
        date:      cur.toISOString().split("T")[0],
        locations: []
      });
      cur.setDate(cur.getDate() + 1);
      n++;
    }
    return days;
  };

  // ---- Kiểm tra tính hợp lệ dùng every() (ES6+) ----
  const isValid = (trip) =>
    ["name", "destination", "startDate", "endDate"].every(
      field => trip[field] && String(trip[field]).trim().length > 0
    );

  // ---- READ: Lấy tất cả — dùng map() (ES6+) ----
  const getAll = () =>
    StorageManager.load().map(t => ({
      ...t,  // Spread operator (ES6+)
      status: statusOf(t.startDate, t.endDate)
    }));

  // ---- READ: Tìm theo ID — dùng find() (ES6+) ----
  const getById = (id) => getAll().find(t => t.id === id) || null;

  // ---- CREATE — dùng class TripModel (ES6+) ----
  const create = (d) => {
    const trips = StorageManager.load();
    const model = new TripModel(d);          // Khởi tạo qua class
    model.days  = makeDays(d.startDate, d.endDate);
    if (!isValid(model)) return null;
    const t = model.toJSON();                // Chuyển về plain object
    trips.unshift(t);
    StorageManager.save(trips);
    return t;
  };

  // ---- UPDATE ----
  const update = (id, d) => {
    const trips = StorageManager.load();
    const idx   = trips.findIndex(t => t.id === id); // findIndex() (ES6+)
    if (idx < 0) return null;

    const old     = trips[idx];
    const updated = {
      ...old, ...d,  // Spread + merge (ES6+)
      budget:     +d.budget,
      members:    +d.members || 1,
      coverImage: (d.coverImage !== undefined) ? d.coverImage : (old.coverImage || ""), // Task 3.1
      updatedAt:  new Date().toISOString()
    };

    // Nếu đổi ngày → regenerate days, giữ locations ngày cũ
    if (d.startDate !== old.startDate || d.endDate !== old.endDate) {
      const dayMap = Object.fromEntries(
        old.days.map(day => [day.date, day])
      );
      updated.days = makeDays(d.startDate, d.endDate).map(day => ({
        ...day,
        locations: dayMap[day.date]?.locations || []
      }));
    }

    trips[idx] = updated;
    StorageManager.save(trips);
    return updated;
  };

  // ---- DELETE ----
  const remove = (id) => {
    const trips = StorageManager.load().filter(t => t.id !== id);
    StorageManager.save(trips);
  };

  // Location CRUD

  const addLoc = (tripId, dayId, d) => {
    const trips = StorageManager.load();
    const trip  = trips.find(t => t.id === tripId);
    const day   = trip?.days.find(dy => dy.id === dayId);
    if (!day) return null;

    const loc = {
      id:          uid("loc"),
      name:        d.name.trim(),
      category:    d.category || "other",
      time:        d.time || "",
      note:        d.note?.trim() || "",
      plannedCost: +d.plannedCost || 0,
      actualCost:  +d.actualCost  || 0,
      createdAt:   new Date().toISOString()
    };
    day.locations.push(loc);
    StorageManager.save(trips);
    return loc;
  };

  const updateLoc = (tripId, dayId, locId, d) => {
    const trips = StorageManager.load();
    const trip  = trips.find(t => t.id === tripId);
    const day   = trip?.days.find(dy => dy.id === dayId);
    const li    = day?.locations.findIndex(l => l.id === locId) ?? -1;
    if (li < 0) return null;

    day.locations[li] = {
      ...day.locations[li],
      name:        d.name.trim(),
      category:    d.category,
      time:        d.time || "",
      note:        d.note?.trim() || "",
      plannedCost: +d.plannedCost || 0,
      actualCost:  +d.actualCost  || 0
    };
    StorageManager.save(trips);
    return day.locations[li];
  };

  const removeLoc = (tripId, dayId, locId) => {
    const trips = StorageManager.load();
    const trip  = trips.find(t => t.id === tripId);
    const day   = trip?.days.find(dy => dy.id === dayId);
    if (day) {
      day.locations = day.locations.filter(l => l.id !== locId);
      StorageManager.save(trips);
    }
  };

  // Thống kê — dùng reduce, filter, map, some, every (ES6+)
  const getStats = () => {
    const all = getAll();

    // reduce() — tổng ngân sách
    const totalBudget = all.reduce((sum, t) => sum + t.budget, 0);

    // reduce() lồng 2 cấp — tổng chi thực tế
    const totalSpent = all.reduce((sum, t) =>
      sum + t.days.reduce((ds, d) =>
        ds + d.locations.reduce((ls, l) => ls + l.actualCost, 0), 0), 0);

    // reduce() lồng — tổng địa điểm
    const totalLocs = all.reduce((s, t) =>
      s + t.days.reduce((ds, d) => ds + d.locations.length, 0), 0);

    // filter() — đếm trạng thái
    const upcoming  = all.filter(t => t.status === "upcoming").length;
    const ongoing   = all.filter(t => t.status === "ongoing").length;
    const completed = all.filter(t => t.status === "completed").length;

    // some() — có chuyến nào vượt ngân sách không
    const hasOverBudget = all.some(t => {
      const spent = t.days.reduce((s, d) =>
        s + d.locations.reduce((ls, l) => ls + l.actualCost, 0), 0);
      return spent > t.budget && t.budget > 0;
    });

    // every() — kiểm tra tất cả chuyến đi có ngân sách được nhập
    const allHaveBudget = all.every(t => t.budget > 0);

    // reduce() — gom nhóm điểm đến
    const destMap = all.reduce((acc, t) => {
      const k  = t.destination.trim();
      acc[k]   = (acc[k] || 0) + 1;
      return acc;
    }, {});

    // sort() + slice() + map() — top điểm đến
    const topDest = Object.entries(destMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([dest, count]) => ({ dest, count }));

    return {
      total: all.length,
      upcoming, ongoing, completed,
      totalBudget, totalSpent, totalLocs,
      topDest, hasOverBudget, allHaveBudget
    };
  };

  return {
    getAll, getById, create, update, remove,
    addLoc, updateLoc, removeLoc,
    getStats, isValid
  };
})();


/**
 * BookingManager – đăng ký tour mẫu của user đang đăng nhập (key travel_bookings, admin duyệt trạng thái)
 * Là nguồn dữ liệu duy nhất cho: tab "Chuyến đi của tôi", Thống kê (Dashboard) và Hồ sơ.
 *   pending = chờ nhận · confirmed = đã nhận · cancelled = đã hủy (không tính vào thống kê chi phí/số chuyến)
 */
const BookingManager = (() => {
  const loadAll = () => {
    try { return JSON.parse(localStorage.getItem("travel_bookings") || "[]") || []; } catch { return []; }
  };

  // Đăng ký của user hiện tại, mới nhất trước
  const mine = () => {
    const uid = Auth.getUser()?.id;
    return uid
      ? loadAll().filter(b => b.userId === uid).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      : [];
  };

  const active = () => mine().filter(b => b.status !== "cancelled");

  const getStats = () => {
    const all = mine(), act = all.filter(b => b.status !== "cancelled");
    const destMap = act.reduce((m, b) => { const k = (b.tourDest || "").trim(); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
    const today = dateToStr(new Date());
    return {
      total: act.length,
      upcoming:  act.filter(b => (b.date || "") >= today).length,                          // chưa tới ngày đi
      completed: act.filter(b => b.status === "confirmed" && b.date && b.date < today).length, // đã nhận và đã qua ngày đi
      pending:   all.filter(b => b.status === "pending").length,
      confirmed: all.filter(b => b.status === "confirmed").length,
      cancelled: all.filter(b => b.status === "cancelled").length,
      totalPrice: act.reduce((s, b) => s + (+b.price || 0), 0),
      destMap
    };
  };

  return { mine, active, getStats };
})();
