/**
 * render.js – Toàn bộ hàm render giao diện
 * Phụ thuộc: utils.js, constants.js, auth.js, trips.js
 */

// Emoji Picker
function renderEmojiPicker() {
  $id("emoji-grid").innerHTML = EMOJIS.map(em =>
    `<div class="emoji-opt ${em === AppState.emoji ? "sel" : ""}" data-emoji="${em}">${em}</div>`
  ).join("");
  $id("f-emoji").value = AppState.emoji;
}

// RENDER: Home – Danh sách chuyến đi
function _renderTripGrid() {
  const q         = $id("search-q")?.value?.toLowerCase() || "";
  const st        = $id("filter-status")?.value || "";
  const so        = $id("sort-by")?.value || "newest";
  const loggedIn  = Auth.isLoggedIn();

  let trips = TripManager.getAll();

  // filter() – tìm kiếm
  if (q) trips = trips.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.destination.toLowerCase().includes(q)
  );

  // filter() – lọc trạng thái
  if (st) trips = trips.filter(t => t.status === st);

  // sort() – sắp xếp
  trips.sort((a, b) => {
    switch (so) {
      case "oldest":      return a.createdAt.localeCompare(b.createdAt);
      case "name-az":     return a.name.localeCompare(b.name, "vi");
      case "name-za":     return b.name.localeCompare(a.name, "vi");
      case "budget-desc": return b.budget - a.budget;
      case "budget-asc":  return a.budget  - b.budget;
      case "start-soon":  return a.startDate.localeCompare(b.startDate);
      default:            return b.createdAt.localeCompare(a.createdAt);
    }
  });

  $id("trips-count").textContent = `${trips.length} chuyến đi`;

  const grid = $id("trips-grid");
  if (!trips.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-icon"></div>
        <div class="empty-title">${q || st ? "Không tìm thấy kết quả" : "Chưa có chuyến đi nào"}</div>
        <div class="empty-desc">${q || st ? "Thử thay đổi từ khóa hoặc bộ lọc." : "Bắt đầu bằng cách tạo chuyến đi đầu tiên!"}</div>
        ${!q && !st ? `<button class="btn btn-accent" id="empty-new-btn">＋ Tạo chuyến đi ngay</button>` : ""}
      </div>`;
    $id("empty-new-btn")?.addEventListener("click", () => requireAuth(openNewTripForm));
    return;
  }

  // map() – render từng trip card
  grid.innerHTML = trips.map(t => {
    const spent     = t.days.reduce((s,d) => s + d.locations.reduce((ls,l) => ls + l.actualCost, 0), 0);
    const locs      = t.days.reduce((s,d) => s + d.locations.length, 0);
    const coverIdx  = EMOJIS.indexOf(t.emoji);
    const coverCls  = `cover-${coverIdx >= 0 ? coverIdx : 0}`;
    // Task 3.1: ảnh bìa thay thế gradient nếu có
    const coverHTML = t.coverImage
      ? `<div class="trip-cover trip-cover--photo" style="background-image:url('${t.coverImage}')">
           <span class="trip-cover-emoji-badge">${t.emoji}</span>
         </div>`
      : `<div class="trip-cover ${coverCls}">${t.emoji}</div>`;
    return `
      <div class="trip-card" data-id="${t.id}">
        ${!loggedIn ? `<div class="lock-overlay">Đăng nhập để xem</div>` : ""}
        ${coverHTML}
        <div class="trip-body">
          <div class="trip-name">${esc(t.name)}</div>
          <div class="trip-dest">${esc(t.destination)}</div>
          <div class="trip-meta">
            <span class="badge ${STATUS_CLS[t.status]}">${STATUS_LBL[t.status]}</span>
            <span class="trip-dates">${fmtRange(t.startDate, t.endDate)}</span>
          </div>
          <div class="trip-info">
            <span>${dayCount(t.startDate, t.endDate)} ngày</span>
            <span>${locs} địa điểm</span>
            <span>${fmt(spent)}</span>
          </div>
        </div>
        <div class="trip-actions">
          <button class="btn btn-outline btn-sm trip-act" data-action="detail" data-id="${t.id}">Xem chi tiết</button>
          ${loggedIn ? `
          <button class="btn btn-ghost btn-sm trip-act"  data-action="edit"   data-id="${t.id}">Sửa</button>
          <button class="btn btn-danger btn-sm trip-act" data-action="delete" data-id="${t.id}" data-name="${esc(t.name)}"></button>` : ""}
        </div>
      </div>`;
  }).join("");

  attachTripCardEvents();
}

/**
 * RENDER: renderHome — Task 5.1 wrapper
 * Gọi TabLayout.refresh() nếu đã init, fallback về _renderTripGrid
 */
function renderHome() {
  const trips   = TripManager.getAll();
  const q       = $id("search-q")?.value?.toLowerCase()  || "";
  const st      = $id("filter-status")?.value            || "";
  const so      = $id("sort-by")?.value                  || "newest";

  // Lọc + sắp xếp giống logic cũ để truyền vào TabLayout
  let filtered = trips.slice();
  if (q)  filtered = filtered.filter(t =>
    t.name.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q));
  if (st) filtered = filtered.filter(t => t.status === st);
  filtered.sort((a, b) => {
    switch (so) {
      case "oldest":      return a.createdAt.localeCompare(b.createdAt);
      case "name-az":     return a.name.localeCompare(b.name, "vi");
      case "name-za":     return b.name.localeCompare(a.name, "vi");
      case "budget-desc": return b.budget - a.budget;
      case "budget-asc":  return a.budget  - b.budget;
      case "start-soon":  return a.startDate.localeCompare(b.startDate);
      default:            return b.createdAt.localeCompare(a.createdAt);
    }
  });

  if (window.TabLayout && $id("mainTabContainer")) {
    TabLayout.refresh({ personalTrips: filtered, myBookings: BookingManager.mine() });
  } else {
    // Fallback nếu TabLayout chưa load
    _renderTripGrid();
  }
}

// Event delegation + mouseover/mouseout
function attachTripCardEvents() {
  const grid = $id("trips-grid");
  if (!grid) return;

  grid.onclick = e => {
    const btn = e.target.closest(".trip-act");
    if (btn) {
      e.stopPropagation();
      const { action, id, name } = btn.dataset;
      if (action === "detail") requireAuth(() => openDetail(id));
      if (action === "edit")   requireAuth(() => openEditTripForm(id));
      if (action === "delete") requireAuth(() => askDeleteTrip(id, name));
      return;
    }
    const card = e.target.closest(".trip-card");
    if (card) requireAuth(() => openDetail(card.dataset.id));
  };

  // mouseover / mouseout – highlight khi hover
  grid.addEventListener("mouseover", e => {
    const c = e.target.closest(".trip-card");
    if (c) c.style.outline = "2px solid var(--primary)";
  });
  grid.addEventListener("mouseout", e => {
    const c = e.target.closest(".trip-card");
    if (c) c.style.outline = "";
  });
}

// RENDER: Trip Detail
function renderDetail(tripId) {
  const t = TripManager.getById(tripId);
  if (!t) { navigate("home"); return; }

  // Task 3.1: hero với ảnh bìa nếu có
  const heroCoverBg = t.coverImage
    ? `style="background:linear-gradient(135deg,rgba(30,27,75,.72),rgba(79,70,229,.6)), url('${t.coverImage}') center/cover no-repeat"`
    : "";
  $id("detail-hero").innerHTML = `
    <div class="hero-emoji ${t.coverImage ? "hero-emoji--photo" : ""}">${t.emoji}</div>
    <div class="hero-info">
      <div class="hero-name">${esc(t.name)}</div>
      <div class="hero-dest">${esc(t.destination)}</div>
      <div class="hero-dates">${fmtRange(t.startDate, t.endDate)} · ${dayCount(t.startDate, t.endDate)} ngày · ${t.members || 1} người</div>
      ${t.guideHire?.enabled ? `<div class="hero-dates">‍Có HDV nội địa · ${t.guideHire.hoursPerDay} tiếng/ngày · ${new Intl.NumberFormat("vi-VN").format(tinhPhiHDV(dayCount(t.startDate, t.endDate), t.guideHire.hoursPerDay))} ₫ (đã tính vào chi phí)</div>` : ""}
      ${t.description ? `<div class="hero-desc">${esc(t.description)}</div>` : ""}
    </div>
    <div class="hero-actions">
      <span class="badge" style="background:rgba(255,255,255,.25);color:#fff">${STATUS_LBL[t.status]}</span>
      <button class="btn btn-outline btn-sm" id="hero-edit-btn"
        style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.4);color:#fff">
        Sửa chuyến đi
      </button>
    </div>`;
  if (heroCoverBg) $id("detail-hero").setAttribute("style",
    `background:linear-gradient(135deg,rgba(30,27,75,.68),rgba(79,70,229,.55)), url('${t.coverImage}') center/cover no-repeat; border-radius:var(--radius); margin-bottom:22px; color:#fff; padding:28px 26px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; box-shadow:var(--shadow-md);`);

  $id("hero-edit-btn")?.addEventListener("click", () => openEditTripForm(t.id));

  switchTab(AppState.activeTab, false);
  renderItinerary(t);
  renderBudget(t);

  $id("loc-filter-cat").value    = AppState.locCatFilter;
  $id("loc-filter-cat").onchange = e => {
    AppState.locCatFilter = e.target.value;
    renderItinerary(TripManager.getById(AppState.tripId));
  };
}

// ---- Render lịch trình từng ngày ----
function renderItinerary(t) {
  const catFilter = AppState.locCatFilter;
  const container = $id("days-container");

  if (!t?.days?.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon"></div><div class="empty-title">Chưa có lịch trình</div></div>`;
    return;
  }

  // reduce() + filter() – tổng địa điểm sau lọc
  const total = t.days.reduce((s, d) =>
    s + (catFilter ? d.locations.filter(l => l.category === catFilter).length : d.locations.length), 0);
  $id("loc-filter-count").textContent = catFilter ? `Đang lọc: ${total} địa điểm` : `${total} địa điểm`;

  // map() – render từng ngày
  container.innerHTML = t.days.map(day => {
    const locs = catFilter
      ? day.locations.filter(l => l.category === catFilter)
      : day.locations;

    return `
      <div class="day-section">
        <div class="day-header">
          <span class="day-title">${esc(day.label)}</span>
          <span class="day-date">${fmtDate(day.date)}</span>
        </div>
        <div class="day-locs">
          ${!locs.length
            ? `<div class="loc-empty">${catFilter ? "Không có địa điểm thuộc loại này" : "Chưa có địa điểm — hãy thêm ngay!"}</div>`
            : locs.map(l => `
              <div class="loc-item">
                <div class="loc-icon c-${l.category}">${CAT_ICON[l.category] || ""}</div>
                <div class="loc-info">
                  <div class="loc-name">${esc(l.name)}</div>
                  <div class="loc-meta">${l.time ? `${l.time} · ` : ""}${CAT_LBL[l.category] || "Khác"}</div>
                  ${l.note ? `<div class="loc-note">${esc(l.note)}</div>` : ""}
                </div>
                <div class="loc-cost">
                  ${l.actualCost  > 0 ? `<div class="cost-actual">${fmt(l.actualCost)}</div>`          : ""}
                  ${l.plannedCost > 0 ? `<div class="cost-planned">DK: ${fmt(l.plannedCost)}</div>` : ""}
                </div>
                <div class="loc-acts">
                  <button class="btn btn-ghost btn-icon btn-sm"
                    data-loc-edit="${t.id}|${day.id}|${l.id}" title="Sửa"></button>
                  <button class="btn btn-ghost btn-icon btn-sm"
                    data-loc-del="${t.id}|${day.id}|${l.id}|${esc(l.name)}" title="Xóa"></button>
                </div>
              </div>`).join("")}
          <button class="add-loc-btn" data-add-loc="${t.id}|${day.id}">
            ＋ Thêm địa điểm vào ${day.label}
          </button>
        </div>
      </div>`;
  }).join("");

  // Event delegation cho lịch trình
  container.onclick = e => {
    const ed = e.target.closest("[data-loc-edit]");
    if (ed)  { const [ti,di,li] = ed.dataset.locEdit.split("|"); openEditLocForm(ti,di,li); return; }
    const dd = e.target.closest("[data-loc-del]");
    if (dd)  { const [ti,di,li,nm] = dd.dataset.locDel.split("|"); askDeleteLoc(ti,di,li,nm); return; }
    const ad = e.target.closest("[data-add-loc]");
    if (ad)  { const [ti,di] = ad.dataset.addLoc.split("|"); openAddLocForm(ti,di); }
  };
}

// ---- Render tab Ngân sách ----
function renderBudget(t) {
  const allLocs = t.days.flatMap(d => d.locations.map(l => ({ ...l, dayLabel: d.label })));
  // Phí HDV nội địa (nếu thuê) cộng thẳng vào chi phí của lịch trình
  const hdvCost = t.guideHire?.enabled ? tinhPhiHDV(dayCount(t.startDate, t.endDate), t.guideHire.hoursPerDay) : 0;
  const planned = allLocs.reduce((s,l) => s + l.plannedCost, 0) + hdvCost;
  const actual  = allLocs.reduce((s,l) => s + l.actualCost,  0) + hdvCost;
  const budget  = t.budget;
  const remaining = budget - actual;
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
  const cls = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";

  $id("tc-budget").innerHTML = `
    <div class="budget-grid">
      <div class="budget-stat"><div class="budget-lbl">Ngân sách</div><div class="budget-val">${fmt(budget)}</div></div>
      <div class="budget-stat"><div class="budget-lbl">Đã chi thực tế</div><div class="budget-val ${actual > budget ? "over" : "ok"}">${fmt(actual)}</div></div>
      <div class="budget-stat"><div class="budget-lbl">${remaining >= 0 ? "Còn lại" : "Vượt ngân sách"}</div><div class="budget-val ${remaining < 0 ? "over" : "ok"}">${fmt(Math.abs(remaining))}</div></div>
    </div>
    <div class="prog-wrap">
      <div class="prog-labels"><span>Đã chi: ${pct.toFixed(1)}%</span><span>${fmt(actual)} / ${fmt(budget)}</span></div>
      <div class="prog-bar"><div class="prog-fill prog-${cls}" style="width:${pct}%"></div></div>
      ${planned > 0 ? `<p style="font-size:12.5px;color:var(--text-muted);margin-top:9px">Chi phí dự kiến tổng: ${fmt(planned)}</p>` : ""}
    </div>
    ${hdvCost ? `<p style="font-size:13px;margin:10px 0">‍Đã gồm phí HDV nội địa: <b>${fmt(hdvCost)}</b> (${t.guideHire.hoursPerDay} tiếng/ngày)</p>` : ""}
    ${allLocs.some(l => l.plannedCost || l.actualCost) ? `
    <div class="card"><div class="exp-table-wrap">
      <table>
        <thead><tr>
          <th>Địa điểm</th><th>Ngày</th>
          <th style="text-align:right">Dự kiến</th>
          <th style="text-align:right">Thực tế</th>
          <th style="text-align:right">Chênh lệch</th>
        </tr></thead>
        <tbody>${allLocs.filter(l => l.plannedCost || l.actualCost).map(l => `
          <tr>
            <td>${CAT_ICON[l.category]} ${esc(l.name)}</td>
            <td style="color:var(--text-muted)">${l.dayLabel}</td>
            <td style="text-align:right">${l.plannedCost > 0 ? fmt(l.plannedCost) : "–"}</td>
            <td style="text-align:right;font-weight:700;color:var(--primary)">${l.actualCost > 0 ? fmt(l.actualCost) : "–"}</td>
            <td style="text-align:right;color:${l.actualCost > l.plannedCost ? "var(--danger)" : "var(--success)"}">
              ${l.plannedCost > 0 && l.actualCost > 0
                ? `${l.actualCost > l.plannedCost ? "▲" : "▼"} ${fmt(Math.abs(l.actualCost - l.plannedCost))}`
                : "–"}
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div></div>` : `
    <div class="empty">
      <div class="empty-icon"></div>
      <div class="empty-title">Chưa có chi phí</div>
      <div class="empty-desc">Thêm địa điểm vào lịch trình và nhập chi phí để theo dõi.</div>
    </div>`}`;
}

// RENDER: Dashboard – Thống kê tổng quan
function renderDashboard() {
  const s = TripManager.getStats();
  const bk = BookingManager.getStats();   // tour mẫu đã đăng ký (không tính tour đã hủy)

  $id("dash-stats").innerHTML = [
    { icon:"🗺️", val: s.total + bk.total,   lbl:"Tổng chuyến đi"    },
    { icon:"📍", val: s.totalLocs,         lbl:"Địa điểm đã thêm" },
    { icon:"💰", val: fmt(s.totalBudget + bk.totalPrice), lbl:"Tổng ngân sách" },
    { icon:"💸", val: fmt(s.totalSpent),   lbl:"Đã chi thực tế"   },
  ].map(i => `
    <div class="stat-card">
      <div class="stat-icon">${i.icon}</div>
      <div class="stat-val">${i.val}</div>
      <div class="stat-lbl">${i.lbl}</div>
    </div>`).join("");

  if (s.hasOverBudget) showToast("Có chuyến đi đang vượt ngân sách!", "warn", 5000);

  $id("dash-status").innerHTML = [
    { lbl:"Sắp tới",      count: s.upcoming,  color:"#0d2137" },
    { lbl:"Đang diễn ra", count: s.ongoing,   color:"#059669" },
    { lbl:"Đã xong",      count: s.completed, color:"#6B7280" },
    { lbl:"Tour mẫu chờ nhận", count: bk.pending,   color:"#D97706" },
    { lbl:"Tour mẫu đã nhận",  count: bk.confirmed, color:"#16A34A" },
  ].map(i => `
    <div class="breakdown-row">
      <div style="display:flex;align-items:center">
        <div class="b-dot" style="background:${i.color}"></div>${i.lbl}
      </div>
      <strong style="color:${i.color}">${i.count}</strong>
    </div>`).join("") || '<p style="color:var(--text-muted)">Chưa có dữ liệu</p>';

  // Gần đây: chuyến đi cá nhân + tour mẫu đã đăng ký, mới nhất trước
  const recent = TripManager.getAll().map(t => ({
      at: t.createdAt || "", emoji: t.emoji, name: t.name, dest: t.destination, date: fmtDate(t.startDate),
      open: t.id, badge: `<span class="badge ${STATUS_CLS[t.status]}">${STATUS_LBL[t.status]}</span>`
    }))
    .concat(BookingManager.mine().map(b => ({
      at: b.createdAt || "", emoji: "🎫", name: b.tourName || "Tour mẫu", dest: b.tourDest || "",
      date: b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("vi-VN") : "—", open: "",
      badge: `<span class="adm-status adm-status-${b.status}">${BOOKING_STATUS_LBL[b.status] || BOOKING_STATUS_LBL.pending}</span>`
    })))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  $id("dash-recent").innerHTML = recent.length
    ? recent.map(t => `
      <div class="card" style="margin-bottom:9px;${t.open ? "cursor:pointer" : ""}" ${t.open ? `data-open-trip="${t.open}"` : ""}>
        <div style="display:flex;align-items:center;gap:11px;padding:12px 15px">
          <span style="font-size:26px">${t.emoji}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${esc(t.name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${esc(t.dest)} · ${t.date}</div>
          </div>
          ${t.badge}
        </div>
      </div>`).join("")
    : `<div class="empty" style="padding:28px 0">
        <div class="empty-icon" style="font-size:36px"></div>
        <div class="empty-title" style="font-size:15px">Chưa có chuyến đi</div>
      </div>`;

  $id("dash-recent").onclick = e => {
    const c = e.target.closest("[data-open-trip]");
    if (c) openDetail(c.dataset.openTrip);
  };

  const destMap = Object.assign({}, bk.destMap);
  TripManager.getAll().forEach(t => { const k = t.destination.trim(); destMap[k] = (destMap[k] || 0) + 1; });
  const topDest = Object.entries(destMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([dest, count]) => ({ dest, count }));
  const maxDest = topDest[0]?.count || 1;
  $id("dash-dest").innerHTML = topDest.length
    ? topDest.map(({ dest, count }, i) => `
      <div class="dest-row">
        <span style="font-size:18px;min-width:24px;text-align:center">${["","","","4️⃣","5️⃣"][i] || ""}</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-weight:600;font-size:14px">${esc(dest)}</span>
            <span style="font-size:12px;color:var(--text-muted)">${count} chuyến</span>
          </div>
          <div class="prog-bar">
            <div class="dest-fill" style="width:${(count / maxDest) * 100}%"></div>
          </div>
        </div>
      </div>`).join("")
    : '<p style="color:var(--text-muted)">Chưa có dữ liệu điểm đến</p>';
}

// Tab switcher
function switchTab(tab, updateState = true) {
  if (updateState) AppState.activeTab = tab;
  $id("tab-it")?.classList.toggle("active", tab === "itinerary");
  $id("tab-bud")?.classList.toggle("active", tab === "budget");
  $id("tc-itinerary").style.display = tab === "itinerary" ? "block" : "none";
  $id("tc-budget").style.display    = tab === "budget"    ? "block" : "none";
}

// RENDER: Profile – Hồ sơ cá nhân
function renderProfile() {
  const user = Auth.getUser();
  if (!user) { navigate("home"); return; }

  // Avatar
  const avatarEl = $id("pf-avatar");
  if (user.picture) {
    avatarEl.innerHTML = `<img loading="lazy" decoding="async" src="${user.picture}" alt="${esc(user.initials)}" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    avatarEl.style.background = "transparent";
    avatarEl.style.fontSize   = "0";
  } else {
    avatarEl.textContent     = user.initials;
    avatarEl.style.background = user.bg || "#4F46E5";
    avatarEl.style.fontSize   = "";
  }

  // Nút "Xóa ảnh" chỉ hiện khi người dùng đã tự chọn ảnh
  const rmAvatar = $id("pf-avatar-remove");
  if (rmAvatar) rmAvatar.style.display = user.avatarCustom ? "" : "none";

  // Thông tin cơ bản
  $id("pf-name-display").textContent = user.name;
  $id("pf-email").textContent        = user.email;

  const providerMap = {
    google:   "Đăng nhập bằng Google",
    facebook: "Đăng nhập bằng Facebook",
    local:    "Tài khoản email & mật khẩu"
  };
  $id("pf-provider").textContent = providerMap[user.provider] || "Không xác định";

  // Ngày tham gia
  const joinedEl = $id("pf-joined");
  if (joinedEl) {
    const createdAt = user.createdAt || user.loginAt;
    if (createdAt) {
      const d = new Date(createdAt);
      joinedEl.textContent = "Tham gia " + d.toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
    } else {
      $id("pf-joined-row")?.style && ($id("pf-joined-row").style.display = "none");
    }
  }

  // Tour mẫu đã đăng ký: chỉ hiện khi user có đăng ký (trạng thái do admin duyệt)
  let dsBooking = BookingManager.mine();
  let boxBooking = $id("pf-bookings-section");
  if (boxBooking) {
    boxBooking.style.display = dsBooking.length ? "" : "none";
    $id("pf-bookings").innerHTML = dsBooking.map(b => {
      let ngayDi = b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("vi-VN") : "—";
      return `<div class="pf-bk-item">
        <div>
          <div class="pf-bk-name">${b.kind === "flight" ? "✈️ " : b.kind === "hotel" ? "🏨 " : ""}${esc(b.tourName || "—")}</div>
          <div class="pf-bk-sub">${esc(b.tourDest || "")} · Ngày đi ${ngayDi} · ${b.pax || 1} người</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="adm-status adm-status-${b.status}">${BOOKING_STATUS_LBL[b.status] || BOOKING_STATUS_LBL.pending}</span>
          ${b.kind ? (b.status === "pending" && !b.depositPaid ? `<button class="btn btn-outline btn-sm" onclick="Payment.open('${esc(b.id)}')">Thanh toán</button>` : "")
            : b.status === "confirmed" ? `<button class="btn btn-outline btn-sm" onclick="openBookingItinerary('${b.id}')">Xem lịch trình</button>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  // Input chỉnh sửa tên
  $id("pf-name-input").value = user.name;

  // Mọi user (email, Google, Facebook...) đều được đổi tên hiển thị
  const editBtn = $id("pf-edit-btn");
  if (editBtn) editBtn.style.display = "";

  // Thống kê nhanh
  const trips     = TripManager.getAll();
  const completed = trips.filter(t => t.status === "completed").length;
  const upcoming  = trips.filter(t => t.status === "upcoming").length;
  const bkStats = BookingManager.getStats();   // tour mẫu đã đăng ký (trừ tour đã hủy)
  const totalSpent = trips.reduce((s, t) =>
    s + t.days.reduce((ds, d) =>
      ds + d.locations.reduce((ls, l) => ls + l.actualCost, 0), 0), 0);

  $id("pf-stats").innerHTML = `
    <div class="pf-stat"><span class="pf-stat-num">${trips.length + bkStats.total}</span><span class="pf-stat-lbl">Tổng chuyến</span></div>
    <div class="pf-stat"><span class="pf-stat-num">${completed + bkStats.completed}</span><span class="pf-stat-lbl">Đã hoàn thành</span></div>
    <div class="pf-stat"><span class="pf-stat-num">${upcoming + bkStats.upcoming}</span><span class="pf-stat-lbl">Sắp tới</span></div>
    <div class="pf-stat"><span class="pf-stat-num">${fmt(totalSpent)}</span><span class="pf-stat-lbl">Đã chi</span></div>
  `;

  // Danh sách chuyến đi
  const grid = $id("pf-trips-grid");
  if (!trips.length) {
    grid.innerHTML = `<div class="empty" style="padding:32px 0">
      <div class="empty-icon"></div>
      <div class="empty-title">Chưa có chuyến đi nào</div>
      <div class="empty-desc">Tạo chuyến đi đầu tiên ngay!</div>
      <button class="btn btn-accent" onclick="navigate('home')">＋ Tạo chuyến đi</button>
    </div>`;
    return;
  }

  grid.innerHTML = trips.map(t => {
    const spent   = t.days.reduce((s,d) => s + d.locations.reduce((ls,l) => ls + l.actualCost, 0), 0);
    const locs    = t.days.reduce((s,d) => s + d.locations.length, 0);
    return `
    <div class="pf-trip-card" onclick="openDetail('${t.id}')">
      <div class="pf-trip-emoji">${t.emoji}</div>
      <div class="pf-trip-body">
        <div class="pf-trip-name">${esc(t.name)}</div>
        <div class="pf-trip-meta">${esc(t.destination)} · ${t.days.length} ngày · ${locs} địa điểm</div>
        <div class="pf-trip-meta">${fmt(spent)} đã chi · <span class="badge ${STATUS_CLS[t.status]}">${STATUS_LBL[t.status]}</span></div>
      </div>
      <div class="pf-trip-date">${fmtDate(t.startDate)}</div>
    </div>`;
  }).join("");
}

