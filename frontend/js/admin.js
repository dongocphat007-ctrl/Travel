/**
 * admin.js – Trang quản trị Admin
 * Chức năng:
 *   1. Phân quyền: chỉ user có role='admin' mới vào được
 *   2. Quản lý tour mẫu: CRUD lưu localStorage key 'travel_tours_v1'
 *   3. Quản lý booking: xem + đổi trạng thái 'travel_bookings'
 *   4. Thống kê nhanh (số user, tour, booking)
 * Phụ thuộc: auth.js, utils.js
 */

const Admin = (() => {

  // Keys
  const TOURS_KEY    = "travel_tours_v1";
  const BOOKINGS_KEY = "travel_bookings";
  const USERS_KEY    = "travel_users_v1";
  const FEEDBACK_KEY = "travel_feedback_v1";

  // Dữ liệu mặc định (seed) lấy từ cùng các file JSON với trang chủ — không còn bản sao riêng:
  //   data/tours/mien-*.json (504 tour trong nước) + data/tours/quoc-te.json (100 tour quốc tế).
  // 20 tour chi tiết (id 101…) nay thuộc nhóm Tour mẫu nên cũng được seed vào đây.
  let DEFAULT_TOURS = [];
  const ADMIN_DIFFS = { "Trung bình": 1, "Khó": 1 };
  const toAdminTour = (t) => {
    const { src, ...rest } = t;                       // bỏ cờ runtime "src"
    return {
      ...rest,
      id: String(t.id),                               // Admin/TabLayout so sánh id dạng chuỗi
      type: t.guide === "self" ? "self" : "guided",
      destination: t.dest || t.destination || "",
      coverEmoji: t.emoji || t.coverEmoji || "🧳",
      currency: "VND",
      difficulty: ADMIN_DIFFS[t.difficulty] ? t.difficulty : "Dễ",
      international: t.region === "Quốc tế",
      active: true,
    };
  };
  // Chờ trình duyệt rảnh rồi mới nạp đủ tour (trang chủ đã hiện tour hàng đầu trước)
  const toursReady = new Promise(res => (window.requestIdleCallback || (f => setTimeout(f, 800)))(res, { timeout: 3000 }))
    .then(() => (typeof loadHomeData === "function" ? loadHomeData() : Promise.resolve()))
    .then(() => {
      DEFAULT_TOURS = (typeof TOUR_SAMPLES !== "undefined" ? TOUR_SAMPLES : [])
        .filter(t => !t._admin).map(toAdminTour);
      if (!DEFAULT_TOURS.length) console.error("[admin] Chưa có dữ liệu tour mẫu (hãy chạy bằng Live Server / python -m http.server).");
    });

  // Helpers localStorage
  const loadTours    = () => { try { const r = localStorage.getItem(TOURS_KEY);    return r ? JSON.parse(r) : null; } catch { return null; } };
  const saveTours    = d  => localStorage.setItem(TOURS_KEY, JSON.stringify(d));
  const loadBookings = () => { try { const r = localStorage.getItem(BOOKINGS_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
  const saveBookings = d  => {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(d));
    window.OrderStats?.autoWrite(true);   // cập nhật file orders.json đã liên kết (nếu có)
  };
  const loadFeedback = () => { try { const r = localStorage.getItem(FEEDBACK_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
  const saveFeedback = d  => localStorage.setItem(FEEDBACK_KEY, JSON.stringify(d));
  const loadUsers    = () => { try { const r = localStorage.getItem(USERS_KEY);    return r ? JSON.parse(r) : []; } catch { return []; } };

  // Seed DEFAULT_TOURS: merge vào localStorage, giữ tour người dùng đã tạo/sửa
  const ensureToursSeeded = () => {
    const existing = loadTours();
    if (existing === null && !DEFAULT_TOURS.length) return;   // JSON chưa nạp xong → chờ lần gọi sau

    // Bảng migration: sửa emoji/field lỗi trong data cũ
    const EMOJI_FIX = { "🇹🇭":"🐘", "🇰🇷":"🏯", "🇱🇦":"🛕" };
    const INTL_IDS  = new Set(["g29","g30","g31","g32","g33","g34"]);

    const migrate = tours => tours.map(t => {
      const fix = {};
      if (EMOJI_FIX[t.coverEmoji]) fix.coverEmoji = EMOJI_FIX[t.coverEmoji];
      if (INTL_IDS.has(t.id) && !t.international) fix.international = true;
      // Loại tour theo chủ đề (adventure/cultural/food/eco/luxury…) → gộp vào "guided", giữ chủ đề ở theme
      if (t.type !== "guided" && t.type !== "self") { fix.theme = t.theme || t.type; fix.type = "guided"; }
      return Object.keys(fix).length ? { ...t, ...fix } : t;
    });

    if (existing === null) {
      saveTours(DEFAULT_TOURS);
    } else {
      const existingIds = new Set(existing.map(t => t.id));
      const toAdd = DEFAULT_TOURS.filter(t => !existingIds.has(t.id));
      saveTours(migrate([...existing, ...toAdd]));
    }
  };

  // Kiểm tra quyền admin
  const isAdmin = () => {
    const u = Auth.getUser();
    return u && u.role === "admin";
  };

  // Nâng cấp user lên admin (dùng nội bộ / hàm debug)
  const grantAdmin = (email) => {
    const users = loadUsers();
    const idx   = users.findIndex(u => u.email === email);
    if (idx < 0) return false;
    users[idx].role = "admin";
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    // Cập nhật session nếu đang đăng nhập bằng tài khoản đó
    const sess = Auth.getUser();
    if (sess && sess.email === email) {
      sess.role = "admin";
      localStorage.setItem("travel_auth_v1", JSON.stringify(sess));
    }
    return true;
  };

  // Tài khoản CHÍNH (chủ hệ thống): luôn là admin, không ai khác được huỷ quyền hay xoá
  const SUPER_ADMIN_EMAIL = "dongocphat007@gmail.com";
  const isSuperEmail = (email) => String(email || "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  // Gộp tài khoản trùng email (dữ liệu cũ: 1 email có cả tài khoản Email lẫn Google),
  // đồng thời đảm bảo tài khoản chính luôn có quyền admin
  const cleanUsers = () => {
    const raw = loadUsers() || [];
    const map = new Map();
    raw.forEach(u => {
      const key = String(u.email || "").trim().toLowerCase();
      if (!key) { map.set("__" + map.size, u); return; }
      const old = map.get(key);
      if (!old) { map.set(key, u); return; }
      // Ưu tiên bản có quyền admin / có mật khẩu; gộp thêm thông tin còn thiếu
      const keep  = (old.role === "admin" || (old.passHash && !u.passHash)) ? old : u;
      const other = keep === old ? u : old;
      map.set(key, { ...other, ...keep, role: (old.role === "admin" || u.role === "admin") ? "admin" : keep.role,
                     googleLinked: !!(old.googleLinked || u.googleLinked || old.provider === "google" || u.provider === "google") });
    });
    const out = [...map.values()].map(u => isSuperEmail(u.email) ? { ...u, role: "admin" } : u);
    if (JSON.stringify(out) !== JSON.stringify(raw)) localStorage.setItem(USERS_KEY, JSON.stringify(out));
    return out;
  };

  // State trang admin
  let _tab        = "tours";   // 'tours' | 'bookings' | 'users' | 'food' | 'feedback' | 'chats' | 'stats' | 'vouchers' | 'banners'
  let _editTourId = null;
  let _tourImageData = "";   // ảnh bìa tải lên (base64) của tour đang sửa
  let _fbFilter    = "all"; // 'all' | 'new' | 'done'
  let _tourFilter  = "all"; // 'all' | 'domestic' | 'international' // null = thêm mới, string = đang sửa

  // RENDER CHÍNH
  function render() {
    const root = document.getElementById("page-admin");
    if (!root) return;

    if (!isAdmin()) {
      root.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;padding:40px 20px;text-align:center">
          <div style="font-size:3rem">🔒</div>
          <h2 style="font-size:1.4rem;font-weight:800;color:var(--text)">Không có quyền truy cập</h2>
          <p style="color:var(--muted);max-width:360px">Trang này chỉ dành cho Admin. Vui lòng đăng nhập bằng tài khoản có quyền Admin.</p>
          <button class="btn btn-accent" onclick="navigate('home')">← Về trang chủ</button>
        </div>`;
      return;
    }

    ensureToursSeeded();

    const tours    = loadTours()    || [];
    const bookings = loadBookings() || [];
    const users    = cleanUsers();
    const feedbacks = loadFeedback() || [];
    const newFbCount = feedbacks.filter(f => f.status === "new").length;

    const pendingCount  = bookings.filter(b => b.status === "pending").length;
    // Số đơn chờ nhận đang ở mức khẩn cấp (còn dưới 8 ngày tới ngày đi)
    const urgentCount   = bookings.filter(b => b.status === "pending" && b.date && soNgayConLai(b.date) <= URGENT_MAX_DAYS).length;
    const activeTours   = tours.filter(t => t.active !== false).length;

    root.innerHTML = `
      <div class="adm-wrap">
        <!-- ── Header ── -->
        <div class="adm-header">
          <div>
            <h1 class="adm-title">⚙️ Quản trị Admin</h1>
            <p class="adm-sub">Travel Dashboard</p>
          </div>
          <button class="btn btn-ghost adm-back-btn" onclick="navigate('home')">← Về trang chủ</button>
        </div>

        <!-- ── Stat cards ── -->
        <div class="adm-stats">
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#e0f2f9">🗺️</div>
            <div class="adm-stat-body">
              <div class="adm-stat-num">${tours.length}</div>
              <div class="adm-stat-lbl">Tour mẫu</div>
              <div class="adm-stat-sub">${activeTours} đang hiển thị</div>
            </div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#fef3c7">📋</div>
            <div class="adm-stat-body">
              <div class="adm-stat-num">${bookings.length}</div>
              <div class="adm-stat-lbl">Lượt đặt tour</div>
              <div class="adm-stat-sub" style="color:${pendingCount>0?"#d97706":"var(--muted)"}">${pendingCount} chờ nhận${urgentCount > 0 ? ` · 🔥 ${urgentCount} khẩn cấp` : ""}</div>
            </div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#dcfce7">👥</div>
            <div class="adm-stat-body">
              <div class="adm-stat-num">${users.length}</div>
              <div class="adm-stat-lbl">Tài khoản</div>
              <div class="adm-stat-sub">${users.filter(u=>u.role==="admin").length} admin</div>
            </div>
          </div>
          <div class="adm-stat-card">
            <div class="adm-stat-icon" style="background:#fce7f3">🍴</div>
            <div class="adm-stat-body">
              <div class="adm-stat-num" id="adm-food-count">—</div>
              <div class="adm-stat-lbl">Món ẩm thực</div>
              <div class="adm-stat-sub">3 miền</div>
            </div>
          </div>
        </div>

        <!-- ── Tabs ── -->
        <div class="adm-tabs">
          <button class="adm-tab ${_tab==="tours"    ?"active":""}" onclick="Admin._setTab('tours')">🗺️ Tour mẫu</button>
          <button class="adm-tab ${_tab==="bookings" ?"active":""}" onclick="Admin._setTab('bookings')">
            📋 Booking
            ${pendingCount>0?`<span class="adm-badge">${pendingCount}</span>`:""}
          </button>
          <button class="adm-tab ${_tab==="users"    ?"active":""}" onclick="Admin._setTab('users')">👥 Người dùng</button>
          <button class="adm-tab ${_tab==="food"     ?"active":""}" onclick="Admin._setTab('food')">🍴 Ẩm thực</button>
          <button class="adm-tab ${_tab==="feedback" ?"active":""}" onclick="Admin._setTab('feedback')">
            💬 Phản hồi
            ${newFbCount>0?`<span class="adm-badge">${newFbCount}</span>`:""}
          </button>
          <button class="adm-tab ${_tab==="chats"    ?"active":""}" onclick="Admin._setTab('chats')">🤖 Chat AI</button>
          <button class="adm-tab ${_tab==="stats"    ?"active":""}" onclick="Admin._setTab('stats')">📊 Thống kê</button>
          <button class="adm-tab ${_tab==="vouchers" ?"active":""}" onclick="Admin._setTab('vouchers')">🎟️ Voucher</button>
          <button class="adm-tab ${_tab==="banners"  ?"active":""}" onclick="Admin._setTab('banners')">🖼️ Banner</button>
        </div>

        <!-- ── Tab content ── -->
        <div class="adm-content" id="adm-content">
          ${_tab === "tours"    ? renderToursTab(tours)    : ""}
          ${_tab === "bookings" ? renderBookingsTab(bookings) : ""}
          ${_tab === "users"    ? renderUsersTab(users)    : ""}
          ${_tab === "food"     ? Admin._renderFoodTab()   : ""}
          ${_tab === "feedback" ? renderFeedbackTab(feedbacks) : ""}
          ${_tab === "stats"    ? (window.OrderStats ? OrderStats.renderTab(bookings) : "<p>Thiếu file js/order-stats.js</p>") : ""}
          ${_tab === "chats"    ? (window.AdminChat ? AdminChat.renderTab() : "<p>Thiếu file js/admin-chat.js</p>") : ""}
          ${(_tab === "vouchers" || _tab === "banners") ? '<div id="adm-p0-root"></div>' : ""}
        </div>
      </div>

      <!-- ── Modal thêm / sửa tour ── -->
      <div class="adm-modal-overlay" id="adm-tour-modal" style="display:none">
        <div class="adm-modal" id="adm-tour-form-wrap"></div>
      </div>
    `;
    if (_tab === "vouchers" || _tab === "banners") window.AdminP0?.mount(_tab);   // js/admin-p0.js
    if (_tab === "stats") window.OrderStats?.mountPayments?.();                    // js/order-stats.js: số liệu thật từ /api/admin/payments
    // Cập nhật stat ẩm thực
    setTimeout(() => {
      const foodEl = document.getElementById("adm-food-count");
      if (foodEl) {
        try {
          const fd = localStorage.getItem("travel_food_v1");
          const regs = fd ? JSON.parse(fd) : (window._FoodDefaultRegions || {});
          const total = Object.values(regs).reduce((s,r) => s + (r.foods?.length||0), 0);
          foodEl.textContent = total || "—";
        } catch { foodEl.textContent = "—"; }
      }
    }, 0);
  }

  // TAB: TOUR MẪU
  function renderToursTab(allTours) {
    const cntAll   = allTours.length;
    const cntIntl  = allTours.filter(t => t.international).length;
    const cntDom   = cntAll - cntIntl;

    const filtered = _tourFilter === "international" ? allTours.filter(t =>  t.international)
                   : _tourFilter === "domestic"      ? allTours.filter(t => !t.international)
                   : allTours;

    const pillBtn = (key, label, count) =>
      `<button class="adm-pill ${_tourFilter===key?"active":""}" onclick="Admin._setTourFilter('${key}')">${label} <span class="adm-pill-count">${count}</span></button>`;

    const emptyState = `
      <div class="adm-empty">
        <div style="font-size:2.5rem">🗺️</div>
        <div>Chưa có tour nào${_tourFilter!=="all"?" trong nhóm này":""}. ${_tourFilter==="all"?"Hãy thêm tour đầu tiên!":""}</div>
        ${_tourFilter==="all"?'<button class="btn btn-accent" onclick="Admin._openTourForm(null)">＋ Thêm tour</button>':""}
      </div>`;

    const rows = filtered.map(t => `
      <tr class="adm-tr ${t.active===false?"adm-tr--inactive":""}">
        <td class="adm-td adm-td-emoji">${t.coverEmoji||"🗺️"}</td>
        <td class="adm-td">
          <div class="adm-tour-name">
            ${esc(t.name)}
            ${t.international ? '<span class="adm-badge-intl">🌏 Quốc tế</span>' : ""}
          </div>
          <div class="adm-tour-dest">📍 ${esc(t.destination)}</div>
        </td>
        <td class="adm-td adm-td-center">
          <span class="adm-type-badge adm-type-${t.type}">${t.type==="guided"?"Có HDV":"Tự túc"}</span>
        </td>
        <td class="adm-td adm-td-center">${esc(t.duration||"")}</td>
        <td class="adm-td adm-td-right">${t.price ? Number(t.price).toLocaleString("vi-VN")+"₫" : "—"}</td>
        <td class="adm-td adm-td-center">
          <label class="adm-toggle" title="${t.active===false?"Đang ẩn – nhấn để hiện":"Đang hiện – nhấn để ẩn"}">
            <input type="checkbox" ${t.active!==false?"checked":""} onchange="Admin._toggleTour('${t.id}',this.checked)">
            <span class="adm-toggle-slider"></span>
          </label>
        </td>
        <td class="adm-td adm-td-actions">
          <button class="adm-btn-icon" title="Sửa" onclick="Admin._openTourForm('${t.id}')">✏️</button>
          <button class="adm-btn-icon adm-btn-danger" title="Xóa" onclick="Admin._deleteTour('${t.id}','${esc(t.name)}')">🗑️</button>
        </td>
      </tr>`).join("");

    return `
      <div class="adm-section-bar">
        <span class="adm-section-title">Danh sách tour mẫu</span>
        <button class="btn btn-accent btn-sm" onclick="Admin._openTourForm(null)">＋ Thêm tour</button>
      </div>
      <div class="adm-pill-bar">
        ${pillBtn("all",           "🗺️ Tất cả",      cntAll)}
        ${pillBtn("domestic",      "🇻🇳 Trong nước", cntDom)}
        ${pillBtn("international", "🌏 Quốc tế",     cntIntl)}
      </div>
      ${filtered.length === 0 ? emptyState : `
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th class="adm-th"></th>
              <th class="adm-th">Tên tour / Điểm đến</th>
              <th class="adm-th adm-td-center">Loại</th>
              <th class="adm-th adm-td-center">Thời gian</th>
              <th class="adm-th adm-td-right">Giá</th>
              <th class="adm-th adm-td-center">Hiển thị</th>
              <th class="adm-th adm-td-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`}
    `;
  }

  // TAB: BOOKING
  const STATUS_CFG = {
    pending:   { lbl:BOOKING_STATUS_LBL.pending,   cls:"adm-status-pending"   },
    confirmed: { lbl:BOOKING_STATUS_LBL.confirmed, cls:"adm-status-confirmed" },
    cancelled: { lbl:BOOKING_STATUS_LBL.cancelled, cls:"adm-status-cancelled" },
  };

  function renderBookingsTab(bookings) {
    if (!bookings.length) return `
      <div class="adm-empty">
        <div style="font-size:2.5rem">📋</div>
        <div>Chưa có booking nào được gửi.</div>
      </div>`;

    // Chờ nhận lên đầu, trong nhóm đó tour gần ngày đi nhất (khẩn cấp) lên trước; các nhóm còn lại: mới đặt trước
    const sorted = [...bookings].sort((a, b) => {
      const aCho = a.status === "pending", bCho = b.status === "pending";
      if (aCho !== bCho) return aCho ? -1 : 1;
      if (aCho && bCho) {
        const da = soNgayConLai(a.date), db = soNgayConLai(b.date);
        if (da !== db) return (da === null ? 9999 : da) - (db === null ? 9999 : db);
      }
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    const cards = sorted.map(b => {
      const st = STATUS_CFG[b.status] || STATUS_CFG.pending;
      const dt = b.createdAt ? new Date(b.createdAt).toLocaleString("vi-VN") : "—";
      // Mức ưu tiên chỉ hiện với đơn đang chờ nhận
      const prio = b.status === "pending" ? mucUuTien(b.date) : null;
      const ngayDi = b.date ? new Date(b.date+"T00:00:00").toLocaleDateString("vi-VN") : "—";
      const gia = b.price ? Number(b.price).toLocaleString("vi-VN")+"₫" : "—";
      return `
        <div class="adm-bk-card adm-bk-card--${b.status || "pending"}">
          <div class="adm-bk-card-head">
            <div class="adm-bk-card-tour">
              <div class="adm-bk-tour-icon">🧭</div>
              <div>
                <div class="adm-bk-tour">${esc(b.tourName||"—")}</div>
                <div class="adm-bk-dest">📍 ${esc(b.tourDest||"")}</div>
              </div>
            </div>
            <div class="adm-bk-card-badges">
              <span class="adm-status ${st.cls}">${st.lbl}</span>
              ${prio ? `<span class="adm-prio ${prio.cls}">${prio.lbl}</span>` : ""}
            </div>
          </div>
          <div class="adm-bk-card-grid">
            <div class="adm-bk-field adm-bk-field--cus">
              <span class="adm-bk-avatar">${esc((b.customerName||"?").trim().charAt(0).toUpperCase())}</span>
              <div class="adm-bk-field-txt">
                <span class="adm-bk-lbl">Khách hàng</span>
                <span class="adm-bk-val">${esc(b.customerName||"—")}</span>
                <span class="adm-bk-phone">📞 ${esc(b.phone||"")}</span>
              </div>
            </div>
            <div class="adm-bk-field"><span class="adm-bk-lbl">👥 Số người</span><span class="adm-bk-val">${b.pax||1} người</span></div>
            <div class="adm-bk-field"><span class="adm-bk-lbl">📅 Ngày đi</span><span class="adm-bk-val">${ngayDi}</span></div>
            ${b.priceBreakdown && b.priceBreakdown.discount ? `<div class="adm-bk-field"><span class="adm-bk-lbl">🎟️ Voucher ${esc(b.priceBreakdown.voucherCode||"")}</span><span class="adm-bk-val">−${Number(b.priceBreakdown.discount).toLocaleString("vi-VN")}₫ <small>(tạm tính ${Number(b.priceBreakdown.subtotal).toLocaleString("vi-VN")}₫)</small></span></div>` : ""}
            <div class="adm-bk-field"><span class="adm-bk-lbl">💰 ${b.priceBreakdown && b.priceBreakdown.discount ? "Giá cuối" : "Tổng tiền"}</span><span class="adm-bk-val adm-bk-price">${gia}</span></div>
            ${b.finalPaid ? (q => `<div class="adm-bk-field"><span class="adm-bk-lbl">💵 Đã thu sau tour</span><span class="adm-bk-val">${q.finalDue.toLocaleString("vi-VN")}₫${q.otHours ? ` (gồm phụ thu HDV ${q.otHours} tiếng: ${q.otFee.toLocaleString("vi-VN")}₫)` : ""}</span></div>`)(quyetToanBooking(b)) : ""}
            ${b.deposit ? `<div class="adm-bk-field"><span class="adm-bk-lbl">${b.payChoice === "full" || b.fullPaid ? "💰 Khách chọn trả đủ" : "🏦 Cọc " + depositPctOf(b) + "%"}</span><span class="adm-bk-val">${Number(b.payChoice === "full" || b.fullPaid ? b.price : b.deposit).toLocaleString("vi-VN")}₫${b.guideHire?.enabled ? " · gồm HDV" : ""} — ${b.depositPaid ? "✅ đã nhận" : "⏳ chưa nhận"}</span></div>
            <div class="adm-bk-field"><span class="adm-bk-lbl">🔖 Nội dung CK</span><span class="adm-bk-val adm-bk-val--sm">${esc(b.payCode || "—")}</span></div>` : ""}
            <div class="adm-bk-field"><span class="adm-bk-lbl">🕒 Thời gian đặt</span><span class="adm-bk-val adm-bk-val--sm">${dt}</span></div>
          </div>
          <div class="adm-bk-card-actions">
            ${b.status==="pending" ? `
              <button class="adm-btn-sm adm-btn-confirm" onclick="Admin._setBookingStatus('${b.id}','confirmed')">✅ Nhận tour</button>
              <button class="adm-btn-sm adm-btn-cancel"  onclick="Admin._setBookingStatus('${b.id}','cancelled')">❌ Hủy</button>` :
            b.status==="confirmed" ? `
              ${b.finalPaid ? `<span class="adm-status adm-status-confirmed">💵 Đã thu đủ</span>`
                : `<button class="adm-btn-sm adm-btn-confirm" onclick="Admin._completeBooking('${b.id}')">🏁 ${b.fullPaid ? "Hoàn tất tour" : "Hoàn tất tour & thu " + (100 - depositPctOf(b)) + "% còn lại"}</button>`}
              <button class="adm-btn-sm adm-btn-cancel"  onclick="Admin._setBookingStatus('${b.id}','cancelled')">❌ Huỷ</button>` :
            `<button class="adm-btn-sm adm-btn-undo" onclick="Admin._setBookingStatus('${b.id}','pending')">↩ Hoàn tác</button>`}
            ${b.deposit && b.status!=="cancelled" ? `<button class="adm-btn-sm ${b.depositPaid?"adm-btn-undo":"adm-btn-confirm"}" onclick="Admin._toggleDeposit('${b.id}')">${b.depositPaid ? "↩ Bỏ xác nhận thanh toán" : (b.payChoice === "full" ? "💰 Đã nhận thanh toán đủ" : "💰 Đã nhận cọc")}</button>` : ""}
            <button class="adm-btn-icon adm-btn-danger" title="Xóa" onclick="Admin._deleteBooking('${b.id}')">🗑️</button>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="adm-section-bar">
        <span class="adm-section-title">Danh sách đặt tour</span>
        <div class="adm-bk-legend">
          <span class="adm-status adm-status-pending">⏳ Chờ xác nhận tour</span>
          <span class="adm-status adm-status-confirmed">✅ Đã xác nhận tour</span>
          <span class="adm-status adm-status-cancelled">❌ Đã hủy</span>
          <span class="adm-prio adm-prio-urgent">🔥 Khẩn cấp: ${BOOKING_MIN_DAYS}–${URGENT_MAX_DAYS} ngày</span>
          <span class="adm-prio adm-prio-chill">😎 Chill chill: từ ${URGENT_MAX_DAYS + 1} ngày</span>
        </div>
      </div>
      <div class="adm-bk-list">${cards}</div>`;
  }

  // TAB: NGƯỜI DÙNG
  function renderUsersTab(users) {
    if (!users.length) return `
      <div class="adm-empty">
        <div style="font-size:2.5rem">👥</div>
        <div>Chưa có tài khoản nào được đăng ký.</div>
      </div>`;

    const currentUser = Auth.getUser();
    const rows = users.map(u => {
      const isMe     = u.email === currentUser?.email;
      const isAdminU = u.role === "admin";
      const isSuperU = isSuperEmail(u.email);
      const joined   = u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "—";
      return `
        <tr class="adm-tr">
          <td class="adm-td">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:${u.bg||"#6B7280"};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;flex-shrink:0;overflow:hidden">${u.picture ? `<img loading="lazy" decoding="async" src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover">` : esc(u.initials||"?")}</div>
              <div>
                <div style="font-weight:600;font-size:.9rem">${esc(u.name||"—")} ${isMe?'<span style="font-size:.75rem;color:var(--muted)">(bạn)</span>':""}</div>
                <div style="font-size:.78rem;color:var(--muted)">${esc(u.email||"")}</div>
              </div>
            </div>
          </td>
          <td class="adm-td adm-td-center">${u.provider==="google"?"🟦 Google":"🔑 Email"}</td>
          <td class="adm-td adm-td-center">
            ${isSuperU
              ? `<span class="adm-role-admin">👑 Chủ hệ thống</span>`
              : isAdminU
              ? `<span class="adm-role-admin">👑 Admin</span>`
              : `<span class="adm-role-user">👤 User</span>`}
          </td>
          <td class="adm-td adm-td-center">${joined}</td>
          <td class="adm-td adm-td-actions">
            ${isSuperU
              ? `<span class="adm-role-admin" title="Không thể huỷ quyền hay xoá tài khoản chính">🔒 Tài khoản chính</span>`
              : isMe
              ? `<span style="color:var(--muted);font-size:.8rem">—</span>`
              : `${!isAdminU
                  ? `<button class="adm-btn-sm adm-btn-confirm" onclick="Admin._grantAdmin('${esc(u.email)}')">👑 Cấp Admin</button>`
                  : `<button class="adm-btn-sm adm-btn-cancel"  onclick="Admin._revokeAdmin('${esc(u.email)}')">↩ Huỷ Admin</button>`}
                 <button class="adm-btn-icon adm-btn-danger" title="Xóa tài khoản" onclick="Admin._deleteUser('${esc(u.email)}','${esc(u.name)}')">🗑️</button>`}
          </td>
        </tr>`;
    }).join("");

    return `
      <div class="adm-section-bar">
        <span class="adm-section-title">Danh sách người dùng</span>
      </div>
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th class="adm-th">Tên / Email</th>
              <th class="adm-th adm-td-center">Đăng nhập qua</th>
              <th class="adm-th adm-td-center">Quyền</th>
              <th class="adm-th adm-td-center">Ngày đăng ký</th>
              <th class="adm-th adm-td-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // FORM THÊM / SỬA TOUR
  const EMOJI_OPTS = ["🗺️","✈️","🏖️","⛰️","🏙️","🌊","🏝️","🎒","🚂","🚢","🌸","🦁","🏮","🏛️","🚤","🌿","🌄","🍜","🦞","🎋"];
  const DIFFICULTY_OPTS = ["Dễ","Trung bình","Khó"];

  function _openTourForm(tourId) {
    _editTourId = tourId;
    const tours = loadTours() || [];
    const tour  = tourId ? tours.find(t => t.id === tourId) : null;
    _tourImageData = (tour?.image && tour.image.startsWith("data:")) ? tour.image : "";
    const imgUrlVal = (tour?.image && !tour.image.startsWith("data:")) ? tour.image : "";

    const wrap = document.getElementById("adm-tour-form-wrap");
    if (!wrap) return;

    const emojiGrid = EMOJI_OPTS.map(e =>
      `<button type="button" class="adm-emoji-opt ${(tour?.coverEmoji||"🗺️")===e?"sel":""}" data-emoji="${e}" onclick="Admin._pickEmoji(this,'${e}')">${e}</button>`
    ).join("");

    const tagVal = tour?.tags?.join(", ") || "";

    wrap.innerHTML = `
      <div class="adm-modal-header">
        <h3>${tourId ? "✏️ Sửa tour" : "＋ Thêm tour mới"}</h3>
        <button class="adm-modal-close" onclick="Admin._closeTourModal()">×</button>
      </div>
      <div class="adm-modal-body">
        <input type="hidden" id="adm-f-emoji" value="${tour?.coverEmoji||"🗺️"}">

        <div class="adm-form-row">
          <div class="adm-form-group adm-fg-full">
            <label class="adm-label">Tên tour <span class="adm-req">*</span></label>
            <input class="adm-input" id="adm-f-name" value="${esc(tour?.name||"")}" placeholder="VD: Hội An – Đà Nẵng trọn gói">
            <div class="adm-err" id="adm-e-name"></div>
          </div>
        </div>

        <div class="adm-form-row">
          <div class="adm-form-group">
            <label class="adm-label">Điểm đến <span class="adm-req">*</span></label>
            <input class="adm-input" id="adm-f-dest" value="${esc(tour?.destination||"")}" placeholder="VD: Đà Nẵng · Hội An">
            <div class="adm-err" id="adm-e-dest"></div>
          </div>
          <div class="adm-form-group">
            <label class="adm-label">Loại tour <span class="adm-req">*</span></label>
            <select class="adm-input" id="adm-f-type">
              <option value="guided" ${tour?.type==="guided"?"selected":""}>Có hướng dẫn viên</option>
              <option value="self"   ${tour?.type==="self"  ?"selected":""}>Tự túc</option>
            </select>
          </div>
        </div>

        <div class="adm-form-row" id="adm-geo-row" style="${tour?.international ? "display:none" : ""}">
          <div class="adm-form-group">
            <label class="adm-label">Vùng <span class="adm-req">*</span></label>
            <select class="adm-input" id="adm-f-region" onchange="Admin._fillProvinces()">
              <option value="">— Chọn vùng —</option>
              ${Object.keys(window.REGION_PROVINCES || {}).map(r => `<option value="${esc(r)}" ${tour?.region===r?"selected":""}>${esc(r)}</option>`).join("")}
            </select>
          </div>
          <div class="adm-form-group">
            <label class="adm-label">Tỉnh / thành <span class="adm-req">*</span></label>
            <select class="adm-input" id="adm-f-prov"><option value="">— Chọn tỉnh —</option></select>
            <div class="adm-err" id="adm-e-geo"></div>
          </div>
        </div>

        <div class="adm-form-row">
          <div class="adm-form-group">
            <label class="adm-label">Thời gian</label>
            <input class="adm-input" id="adm-f-duration" value="${esc(tour?.duration||"")}" placeholder="VD: 3 ngày 2 đêm">
          </div>
          <div class="adm-form-group">
            <label class="adm-label">Quy mô nhóm</label>
            <input class="adm-input" id="adm-f-group" value="${esc(tour?.groupSize||"")}" placeholder="VD: 10–20 người">
          </div>
        </div>

        <div class="adm-form-row">
          <div class="adm-form-group">
            <label class="adm-label">Giá (₫)</label>
            <input class="adm-input" id="adm-f-price" type="number" min="0" value="${tour?.price||""}" placeholder="VD: 4990000">
          </div>
          <div class="adm-form-group">
            <label class="adm-label">Độ khó</label>
            <select class="adm-input" id="adm-f-diff">
              ${DIFFICULTY_OPTS.map(d=>`<option value="${d}" ${(tour?.difficulty||"Dễ")===d?"selected":""}>${d}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="adm-form-group adm-fg-full">
          <label class="adm-label">Điểm nổi bật</label>
          <input class="adm-input" id="adm-f-highlight" value="${esc(tour?.highlight||"")}" placeholder="VD: Phố cổ · Bà Nà Hills · Cầu Rồng">
        </div>

        <div class="adm-form-group adm-fg-full">
          <label class="adm-label">Tags (cách nhau bằng dấu phẩy)</label>
          <input class="adm-input" id="adm-f-tags" value="${esc(tagVal)}" placeholder="VD: Văn hoá, Ẩm thực, Gia đình">
        </div>

        <div class="adm-form-group adm-fg-full">
          <label class="adm-label">Biểu tượng (emoji)</label>
          <div class="adm-emoji-grid">${emojiGrid}</div>
        </div>

        <div class="adm-form-group adm-fg-full">
          <label class="adm-label">🖼️ Ảnh bìa tour</label>
          <div class="adm-img-row">
            <div class="adm-img-prev" id="adm-f-img-prev">Tự động<br>theo điểm đến</div>
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">
              <input class="adm-input" id="adm-f-image" value="${esc(imgUrlVal)}" placeholder="Dán link ảnh https://… (để trống = tự lấy ảnh đúng điểm đến)" oninput="Admin._imgUrlInput()">
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <label class="adm-btn-sm adm-btn-confirm" style="cursor:pointer">📁 Tải ảnh lên<input type="file" accept="image/*" hidden onchange="Admin._pickTourImage(this)"></label>
                <button type="button" class="adm-btn-sm adm-btn-cancel" onclick="Admin._clearTourImage()">↺ Dùng ảnh tự động</button>
              </div>
            </div>
          </div>
        </div>

        <div class="adm-form-row">
          <div class="adm-form-group adm-fg-full" style="display:flex;align-items:center;gap:12px">
            <label class="adm-toggle" style="flex-shrink:0">
              <input type="checkbox" id="adm-f-active" ${tour?.active!==false?"checked":""}>
              <span class="adm-toggle-slider"></span>
            </label>
            <span class="adm-label" style="margin:0">Hiển thị tour này cho người dùng</span>
          </div>
          <div class="adm-form-group adm-fg-full" style="display:flex;align-items:center;gap:12px">
            <label class="adm-toggle" style="flex-shrink:0">
              <input type="checkbox" id="adm-f-intl" ${tour?.international?"checked":""} onchange="Admin._geoToggle()">
              <span class="adm-toggle-slider"></span>
            </label>
            <span class="adm-label" style="margin:0">🌏 Tour quốc tế (ngoài Việt Nam)</span>
          </div>
        </div>
      </div>
      <div class="adm-modal-footer">
        <button class="btn btn-ghost" onclick="Admin._closeTourModal()">Hủy</button>
        <button class="btn btn-accent" onclick="Admin._saveTour()">💾 ${tourId ? "Lưu thay đổi" : "Thêm tour"}</button>
      </div>`;

    document.getElementById("adm-tour-modal").style.display = "flex";
    _fillProvinces(tour?.province || "");
    _refreshImgPrev();
  }

  // Ảnh bìa tour: xem trước / tải lên / xoá
  function _refreshImgPrev() {
    const box = document.getElementById("adm-f-img-prev"); if (!box) return;
    const url = (document.getElementById("adm-f-image")?.value || "").trim() || _tourImageData;
    box.innerHTML = "";
    if (url) {
      const img = new Image(); img.src = url; img.alt = "Ảnh bìa";
      img.style.cssText = "width:100%;height:100%;object-fit:cover";
      img.onerror = () => { box.innerHTML = "⚠️ Không tải<br>được ảnh"; };
      box.appendChild(img);
    } else box.innerHTML = "Tự động<br>theo điểm đến";
  }
  function _imgUrlInput() {
    if ((document.getElementById("adm-f-image")?.value || "").trim()) _tourImageData = "";
    _refreshImgPrev();
  }
  function _pickTourImage(input) {
    const file = input.files && input.files[0];
    if (!file || !file.type.startsWith("image/")) { showToast("⚠️ Vui lòng chọn file ảnh", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        const MAX = 900, k = Math.min(1, MAX / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        _tourImageData = c.toDataURL("image/jpeg", 0.82);   // nén để không đầy localStorage
        const u = document.getElementById("adm-f-image"); if (u) u.value = "";
        _refreshImgPrev();
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
    input.value = "";
  }
  function _clearTourImage() {
    _tourImageData = "";
    const u = document.getElementById("adm-f-image"); if (u) u.value = "";
    _refreshImgPrev();
  }

  function _pickEmoji(el, emoji) {
    document.querySelectorAll(".adm-emoji-opt").forEach(e => e.classList.remove("sel"));
    el.classList.add("sel");
    const inp = document.getElementById("adm-f-emoji");
    if (inp) inp.value = emoji;
  }

  // Ràng buộc vùng → tỉnh: danh sách tỉnh đổi theo vùng đã chọn
  function _fillProvinces(selected) {
    const region = document.getElementById("adm-f-region")?.value || "";
    const sel = document.getElementById("adm-f-prov");
    if (!sel) return;
    const list = (window.REGION_PROVINCES || {})[region] || [];
    sel.innerHTML = `<option value="">— Chọn tỉnh —</option>` + list.map(p => `<option value="${esc(p)}" ${p===selected?"selected":""}>${esc(p)}</option>`).join("");
  }
  // Tour quốc tế không cần chọn vùng / tỉnh trong nước
  function _geoToggle() {
    const intl = document.getElementById("adm-f-intl")?.checked;
    const row = document.getElementById("adm-geo-row");
    if (row) row.style.display = intl ? "none" : "";
  }

  function _closeTourModal() {
    const m = document.getElementById("adm-tour-modal");
    if (m) m.style.display = "none";
    _editTourId = null;
  }

  function _saveTour() {
    const name     = (document.getElementById("adm-f-name")?.value      || "").trim();
    const dest     = (document.getElementById("adm-f-dest")?.value      || "").trim();
    const type     =  document.getElementById("adm-f-type")?.value      || "guided";
    const duration = (document.getElementById("adm-f-duration")?.value  || "").trim();
    const group    = (document.getElementById("adm-f-group")?.value     || "").trim();
    const price    =  parseFloat(document.getElementById("adm-f-price")?.value) || 0;
    const diff     =  document.getElementById("adm-f-diff")?.value      || "Dễ";
    const highlight= (document.getElementById("adm-f-highlight")?.value || "").trim();
    const tagsRaw  = (document.getElementById("adm-f-tags")?.value      || "").trim();
    const emoji    =  document.getElementById("adm-f-emoji")?.value     || "🗺️";
    const active   =  document.getElementById("adm-f-active")?.checked  ?? true;
    const intl     =  document.getElementById("adm-f-intl")?.checked    ?? false;
    const imgUrl   = (document.getElementById("adm-f-image")?.value     || "").trim();
    const image    =  imgUrl || _tourImageData;
    const region   =  intl ? "Quốc tế" : (document.getElementById("adm-f-region")?.value || "");
    const province =  intl ? "" : (document.getElementById("adm-f-prov")?.value || "");

    // Validate
    let ok = true;
    const setErr = (id, msg) => { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; } };
    setErr("adm-e-name", ""); setErr("adm-e-dest", ""); setErr("adm-e-geo", "");
    if (!name) { setErr("adm-e-name", "Vui lòng nhập tên tour"); ok = false; }
    if (!dest) { setErr("adm-e-dest", "Vui lòng nhập điểm đến"); ok = false; }
    if (!intl && (!region || !province)) { setErr("adm-e-geo", "Vui lòng chọn vùng và tỉnh / thành"); ok = false; }
    if (imgUrl && !/^https?:\/\//i.test(imgUrl)) { showToast("⚠️ Link ảnh phải bắt đầu bằng http:// hoặc https://", "error"); return; }
    if (!ok) return;

    const tags = tagsRaw ? tagsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
    const tours = loadTours() || [];

    if (_editTourId) {
      // Sửa
      const idx = tours.findIndex(t => t.id === _editTourId);
      if (idx >= 0) {
        tours[idx] = { ...tours[idx], name, destination:dest, type, duration, groupSize:group, price, difficulty:diff, highlight, tags, coverEmoji:emoji, image, active, international:intl, region, province };
      }
      showToast("✅ Đã cập nhật tour!", "success");
    } else {
      // Thêm mới
      tours.unshift({ id:"tour_"+Date.now(), name, destination:dest, type, duration, groupSize:group, price, currency:"VND", difficulty:diff, highlight, tags, coverEmoji:emoji, image, active, international:intl, region, province, createdAt:new Date().toISOString() });
      showToast("✅ Đã thêm tour mới!", "success");
    }

    saveTours(tours);
    _closeTourModal();
    render();

    // Cập nhật SAMPLE_TOURS trong main.js runtime để TabLayout dùng ngay
    _syncToursRuntime();
  }

  function _toggleTour(id, active) {
    const tours = loadTours() || [];
    const tour  = tours.find(t => t.id === id);
    if (tour) { tour.active = active; saveTours(tours); }
    render();
    _syncToursRuntime();
    showToast(active ? "👁️ Tour đã được hiển thị" : "🙈 Tour đã bị ẩn", "info");
  }

  function _deleteTour(id, name) {
    if (!confirm(`Bạn có chắc muốn xóa tour "${name}"?\nHành động này không thể hoàn tác.`)) return;
    const tours = (loadTours() || []).filter(t => t.id !== id);
    saveTours(tours);
    render();
    _syncToursRuntime();
    showToast("🗑️ Đã xóa tour!", "info");
  }

  // Đồng bộ tours từ localStorage về SAMPLE_TOURS runtime
  function _syncToursRuntime() {
    if (typeof renderTours === "function") { try { renderTours(false); } catch (e) {} }   // cập nhật danh sách "Tour mẫu" ở trang chủ
    if (typeof SAMPLE_TOURS !== "undefined" && Array.isArray(SAMPLE_TOURS)) {
      const tours = (loadTours() || []).filter(t => t.active !== false);
      SAMPLE_TOURS.length = 0;
      tours.forEach(t => SAMPLE_TOURS.push(t));
    }
  }

  // BOOKING ACTIONS
  // Xác nhận thủ công đã nhận cọc (đối chiếu với giao dịch trên SePay / app ngân hàng)
  function _toggleDeposit(id) {
    const bookings = loadBookings();
    const bk = bookings.find(b => b.id === id);
    if (!bk) return;
    const full = bk.payChoice === "full";
    const amt  = full ? bk.price : bk.deposit;
    if (!bk.depositPaid && !confirm(`Xác nhận ĐÃ NHẬN ${full ? "thanh toán đủ" : "cọc"} ${Number(amt||0).toLocaleString("vi-VN")}₫ cho mã ${bk.payCode || bk.id}?\n\nHãy đối chiếu giao dịch trên SePay/app ngân hàng trước.`)) return;
    bk.depositPaid = !bk.depositPaid;
    bk.depositPaidAt = bk.depositPaid ? new Date().toISOString() : null;
    bk.fullPaid = bk.depositPaid && full;   // trả đủ ngay từ đầu → không còn khoản chuyển sau tour
    saveBookings(bookings);
    render();
    window.renderHome?.();
    showToast(bk.depositPaid ? "💰 Đã ghi nhận nhận cọc" : "↩ Đã bỏ xác nhận cọc", "success");
  }

  function _setBookingStatus(id, status) {
    const bookings = loadBookings();
    const bk = bookings.find(b => b.id === id);
    if (bk) { bk.status = status; saveBookings(bookings); }
    render();
    window.renderHome?.();   // đồng bộ tab "Chuyến đi của tôi" và thống kê
    const msg = { confirmed:"✅ Tour đã được xác nhận!", cancelled:"❌ Đã hủy đăng ký tour", pending:"↩ Đã đưa tour về trạng thái chờ xác nhận" };
    showToast(msg[status] || "Đã cập nhật", status === "confirmed" ? "success" : "info");
  }

  // Hoàn tất tour: thu phần còn lại (sau cọc) + phụ thu nếu HDV làm thêm giờ
  function _completeBooking(id) {
    const bookings = loadBookings();
    const bk = bookings.find(b => b.id === id);
    if (!bk) return;
    const end = ngayKetThucTour(bk);
    if (end && end >= dateToStr(new Date())) {
      showToast("⚠️ Tour chưa kết thúc (kết thúc ngày " + end.split("-").reverse().join("/") + ") nên chưa thể thu phần còn lại", "warn");
      return;
    }
    let ot = 0;
    const hasHdv = bk.guideHire?.enabled || (bk.guideType && bk.guideType !== "self");
    if (hasHdv) {
      const v = prompt(`HDV có làm thêm giờ không? Nhập TỔNG số tiếng làm thêm cả tour (0 nếu không). Phụ thu ${GUIDE_EXTRA_HOUR_FEE.toLocaleString("vi-VN")}₫/tiếng:`, "0");
      if (v === null) return;
      ot = Math.max(0, Math.round(+String(v).replace(",", ".") || 0));
    }
    bk.overtimeHours = ot;
    const q = quyetToanBooking(bk);
    if (!confirm((bk.fullPaid ? "Khách đã thanh toán đủ trước tour" : `Thu ${100 - depositPctOf(bk)}% còn lại: ${q.remaining.toLocaleString("vi-VN")}₫`) + (ot ? `\nPhụ thu HDV làm thêm ${ot} tiếng: ${q.otFee.toLocaleString("vi-VN")}₫` : "") + `\nTổng cần thu: ${q.finalDue.toLocaleString("vi-VN")}₫\n\nXác nhận đã thu?`)) return;
    bk.finalPaid = true; bk.finalPaidAt = new Date().toISOString(); bk.otFee = q.otFee;
    saveBookings(bookings);
    render();
    window.renderHome?.();
    showToast("💵 Đã thu " + q.finalDue.toLocaleString("vi-VN") + "₫ – hoàn tất tour", "success");
  }

  function _deleteBooking(id) {
    if (!confirm("Xóa booking này?")) return;
    const bookings = loadBookings().filter(b => b.id !== id);
    saveBookings(bookings);
    render();
    window.renderHome?.();
    showToast("🗑️ Đã xóa booking", "info");
  }

  // USER ACTIONS
  function _grantAdmin(email) {
    if (isSuperEmail(email)) return;
    if (!confirm(`Cấp quyền Admin cho "${email}"?`)) return;
    grantAdmin(email);
    render();
    showToast(`👑 Đã cấp Admin cho ${email}`, "success");
  }

  function _revokeAdmin(email) {
    if (isSuperEmail(email)) { showToast("🔒 Không thể huỷ quyền của tài khoản chính", "error"); return; }
    if (!confirm(`Huỷ quyền Admin của "${email}"?`)) return;
    const users = loadUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx >= 0) { delete users[idx].role; localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    render();
    showToast(`↩ Đã huỷ quyền Admin của ${email}`, "info");
  }

  function _deleteUser(email, name) {
    if (isSuperEmail(email)) { showToast("🔒 Không thể xoá tài khoản chính", "error"); return; }
    if (!confirm(`Xóa tài khoản "${name}" (${email})?\nHành động này không thể hoàn tác.`)) return;
    const users = loadUsers().filter(u => u.email !== email);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    render();
    showToast(`🗑️ Đã xóa tài khoản ${name}`, "info");
  }


  // TAB: PHẢN HỒI KHÁCH HÀNG (gửi từ form ở footer)
  const FB_TOPIC = {
    feedback: { icon: "💡", label: "Góp ý tính năng" },
    bug:      { icon: "🐞", label: "Báo lỗi" },
    question: { icon: "❓", label: "Câu hỏi" },
    other:    { icon: "📝", label: "Khác" }
  };

  function renderFeedbackTab(list) {
    const cntNew  = list.filter(f => f.status === "new").length;
    const cntDone = list.length - cntNew;
    const pill = (key, label, count) =>
      `<button class="adm-pill ${_fbFilter===key?"active":""}" onclick="Admin._setFbFilter('${key}')">${label} <span class="adm-pill-count">${count}</span></button>`;

    const shown = list.filter(f => _fbFilter === "all" ? true : _fbFilter === "new" ? f.status === "new" : f.status !== "new");

    const cards = shown.map(f => {
      const t    = FB_TOPIC[f.topic] || FB_TOPIC.other;
      const when = f.createdAt ? new Date(f.createdAt).toLocaleString("vi-VN") : "—";
      const isNew = f.status === "new";
      const subject = encodeURIComponent("Phản hồi từ Travel: " + t.label);
      const body    = encodeURIComponent("Chào " + (f.name || "bạn") + ",\n\nCảm ơn bạn đã gửi phản hồi cho Travel.\n\n\n---\nNội dung bạn đã gửi:\n" + (f.message || ""));
      return `
        <div class="adm-fb-card ${isNew ? "is-new" : ""}">
          <div class="adm-fb-head">
            <div class="adm-fb-avatar">${esc((f.name || "?").trim().charAt(0).toUpperCase())}</div>
            <div class="adm-fb-who">
              <div class="adm-fb-name">${esc(f.name || "Ẩn danh")}
                ${f.userId ? '<span class="adm-fb-tag">👤 Thành viên</span>' : '<span class="adm-fb-tag adm-fb-tag--guest">Khách</span>'}
              </div>
              <div class="adm-fb-contact">
                <span>📧 ${esc(f.email || "—")}</span>
                ${f.phone ? `<span>📱 ${esc(f.phone)}</span>` : ""}
                <span>🕒 ${when}</span>
              </div>
            </div>
            <div class="adm-fb-side">
              <span class="adm-fb-topic">${t.icon} ${t.label}</span>
              <span class="adm-status ${isNew ? "adm-status-pending" : "adm-status-confirmed"}">${isNew ? "🆕 Mới" : "✅ Đã xử lý"}</span>
            </div>
          </div>
          <div class="adm-fb-msg">${esc(f.message || "").replace(/\n/g, "<br>")}</div>
          <div class="adm-fb-actions">
            <a class="adm-btn-sm adm-btn-confirm" style="text-decoration:none" href="mailto:${esc(f.email || "")}?subject=${subject}&body=${body}">✉️ Trả lời qua email</a>
            <button class="adm-btn-sm ${isNew ? "adm-btn-confirm" : "adm-btn-cancel"}" onclick="Admin._setFeedbackStatus('${f.id}','${isNew ? "done" : "new"}')">${isNew ? "✔ Đánh dấu đã xử lý" : "↩ Đánh dấu chưa xử lý"}</button>
            <button class="adm-btn-icon adm-btn-danger" title="Xóa phản hồi" onclick="Admin._deleteFeedback('${f.id}')">🗑️</button>
          </div>
        </div>`;
    }).join("");

    const empty = `
      <div class="adm-empty">
        <div style="font-size:2.5rem">💬</div>
        <div>${list.length ? "Không có phản hồi nào trong nhóm này." : 'Chưa có phản hồi nào. Khách hàng gửi phản hồi qua form "Gửi phản hồi" ở chân trang (footer).'}</div>
      </div>`;

    return `
      <div class="adm-section-bar">
        <span class="adm-section-title">Phản hồi từ khách hàng</span>
        <span style="font-size:.82rem;color:var(--muted)">Nguồn: form "Gửi phản hồi" ở footer</span>
      </div>
      <div class="adm-pill-bar">
        ${pill("all", "📚 Tất cả", list.length)}
        ${pill("new", "🆕 Chưa xử lý", cntNew)}
        ${pill("done", "✅ Đã xử lý", cntDone)}
      </div>
      <div class="adm-fb-list">${shown.length ? cards : empty}</div>`;
  }

  function _setFbFilter(f) { _fbFilter = f; render(); }

  function _setFeedbackStatus(id, status) {
    const list = loadFeedback();
    const fb = list.find(x => x.id === id);
    if (fb) { fb.status = status; saveFeedback(list); }
    render();
    showToast(status === "done" ? "✅ Đã đánh dấu đã xử lý" : "↩ Đã chuyển về chưa xử lý", "info");
  }

  function _deleteFeedback(id) {
    if (!confirm("Xóa phản hồi này?")) return;
    saveFeedback(loadFeedback().filter(x => x.id !== id));
    render();
    showToast("🗑️ Đã xóa phản hồi", "info");
  }

  // Tab switch
  function _setTab(tab) {
    _tab = tab;
    if (tab === "bookings" || tab === "stats") window.Api?.refreshBookings(true);   // lấy đơn mới nhất từ server (tự vẽ lại nếu có thay đổi)
    render();
  }

  function _setTourFilter(f) {
    _tourFilter = f;
    render();
  }

  // Expose API công khai
  return {
    render, isAdmin, grantAdmin, ensureToursSeeded, toursReady,
    loadTours, saveTours,
    // Internal actions gọi từ onclick inline
    _setTab, _setTourFilter, _openTourForm, _closeTourModal, _saveTour, _pickEmoji, _fillProvinces, _geoToggle,
    _imgUrlInput, _pickTourImage, _clearTourImage,
    _toggleTour, _deleteTour,
    _setBookingStatus, _deleteBooking, _completeBooking, _toggleDeposit,
    _setFbFilter, _setFeedbackStatus, _deleteFeedback,
    _grantAdmin, _revokeAdmin, _deleteUser,
    _syncToursRuntime,
  };
})();

/**
 * FOOD ADMIN — Quản lý ẩm thực (thêm vào Admin module)
 * Patch vào Admin object sau khi khai báo
 */
(function patchFoodAdmin() {
  const FOOD_KEY = "travel_food_v1";

  // Load / Save
  function loadFood() {
    try {
      const r = localStorage.getItem(FOOD_KEY);
      if (r) return JSON.parse(r);
    } catch {}
    return null; // null = chưa có, dùng default từ FoodModule
  }
  function saveFood(data) {
    localStorage.setItem(FOOD_KEY, JSON.stringify(data));
  }
  function getRegions() {
    const saved = loadFood();
    if (saved) return saved;
    // Lấy default từ FoodModule
    return window._FoodDefaultRegions || null;
  }

  // State
  let _foodRegion = "north"; // tab đang active
  let _editFood   = null;    // { region, idx } hoặc null (thêm mới)

  // Render tab Ẩm thực
  function renderFoodTab() {
    const regions = getRegions();
    if (!regions) return '<p style="color:var(--muted);padding:24px">Chưa tải được dữ liệu ẩm thực.</p>';

    const regionList = [
      { key: "north",  label: "🌿 Miền Bắc" },
      { key: "center", label: "🌶 Miền Trung" },
      { key: "south",  label: "🌊 Miền Nam" },
    ];

    const r = regions[_foodRegion];
    const foods = r ? r.foods : [];

    return `
      <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${regionList.map(rl => `
            <button class="adm-tab ${_foodRegion === rl.key ? "active" : ""}" style="margin:0"
              onclick="Admin._foodSetRegion('${rl.key}')">${rl.label}
              <span style="font-size:.75rem;opacity:.7;margin-left:4px">(${(regions[rl.key]?.foods||[]).length})</span>
            </button>`).join("")}
        </div>
        <button class="adm-btn-sm adm-btn-confirm" onclick="Admin._openFoodForm(null)">＋ Thêm món</button>
      </div>

      <div style="overflow-x:auto">
        <table class="adm-table">
          <thead><tr>
            <th class="adm-th" style="width:60px">Ảnh</th>
            <th class="adm-th">Tên món</th>
            <th class="adm-th">Vùng</th>
            <th class="adm-th">Tags</th>
            <th class="adm-th" style="width:100px">Thao tác</th>
          </tr></thead>
          <tbody>
            ${foods.length === 0
              ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">Chưa có món nào. Bấm "＋ Thêm món" để bắt đầu.</td></tr>`
              : foods.map((f, idx) => `
              <tr>
                <td class="adm-td">
                  ${f.image
                    ? `<img loading="lazy" decoding="async" src="${f.image}" style="width:48px;height:48px;object-fit:cover;border-radius:8px">`
                    : `<span style="font-size:2rem;display:block;text-align:center">${f.emoji}</span>`}
                </td>
                <td class="adm-td">
                  <strong>${f.name}</strong>
                  <div style="font-size:.78rem;color:var(--muted);margin-top:2px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.desc}</div>
                </td>
                <td class="adm-td" style="font-size:.85rem">${f.region}</td>
                <td class="adm-td">${(f.tags||[]).map(t=>`<span style="background:var(--surface-2);border-radius:4px;padding:2px 6px;font-size:.72rem;margin:2px;display:inline-block">${t}</span>`).join("")}</td>
                <td class="adm-td adm-td-actions">
                  <button class="adm-btn-icon" title="Sửa" onclick="Admin._openFoodForm(${idx})">✏️</button>
                  <button class="adm-btn-icon adm-btn-danger" title="Xóa" onclick="Admin._deleteFoodItem(${idx})">🗑️</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <!-- Modal thêm/sửa món -->
      <div class="adm-modal-overlay" id="adm-food-modal" style="display:none">
        <div class="adm-modal" id="adm-food-form-wrap" style="max-width:520px"></div>
      </div>`;
  }

  // Mở form thêm/sửa
  function _openFoodForm(idx) {
    const regions = getRegions();
    const r       = regions[_foodRegion];
    const food    = idx !== null ? (r?.foods[idx] || {}) : {};
    _editFood     = idx !== null ? { region: _foodRegion, idx } : null;

    const wrap = document.getElementById("adm-food-form-wrap");
    const modal = document.getElementById("adm-food-modal");
    if (!wrap || !modal) return;

    wrap.innerHTML = `
      <div class="adm-modal-header">
        <h3>${idx !== null ? "✏️ Sửa món ăn" : "＋ Thêm món ăn mới"}</h3>
        <button class="adm-modal-close" onclick="Admin._closeFoodModal()">×</button>
      </div>

      <div class="adm-modal-body">
        <div class="adm-form-row">
          <div class="adm-form-group">
            <label class="adm-label">Tên món <span class="adm-req">*</span></label>
            <input id="fadm-name" class="adm-input" value="${food.name||""}" placeholder="Phở Hà Nội">
          </div>
          <div class="adm-form-group">
            <label class="adm-label">Emoji</label>
            <input id="fadm-emoji" class="adm-input" value="${food.emoji||"🍜"}" placeholder="🍜" style="font-size:1.4rem;text-align:center">
          </div>
        </div>

        <div class="adm-form-group">
          <label class="adm-label">Vùng / Địa danh <span class="adm-req">*</span></label>
          <input id="fadm-region" class="adm-input" value="${food.region||""}" placeholder="Hà Nội · Hội An">
        </div>

        <div class="adm-form-group">
          <label class="adm-label">Mô tả <span class="adm-req">*</span></label>
          <textarea id="fadm-desc" class="adm-input" rows="4" style="resize:vertical" placeholder="Mô tả ngắn gọn về món ăn...">${food.desc||""}</textarea>
        </div>

        <div class="adm-form-group">
          <label class="adm-label">Tags <span style="font-weight:400;color:var(--muted)">(cách nhau bởi dấu phẩy)</span></label>
          <input id="fadm-tags" class="adm-input" value="${(food.tags||[]).join(", ")}" placeholder="Thanh đạm, Sáng sớm, Nổi tiếng">
        </div>

        <div class="adm-form-group">
          <label class="adm-label">Hình ảnh món ăn</label>
          <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;padding:12px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px">
            <div id="fadm-img-preview" style="width:72px;height:72px;border-radius:10px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:2.2rem;border:1.5px solid var(--border)">
              ${food.image ? `<img loading="lazy" decoding="async" src="${food.image}" style="width:100%;height:100%;object-fit:cover">` : (food.emoji||"🍜")}
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
              <label class="adm-btn-sm adm-btn-confirm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;width:fit-content">
                📷 Chọn ảnh
                <input type="file" id="fadm-img-input" accept="image/*" style="display:none" onchange="Admin._foodPreviewImg(this)">
              </label>
              <p style="font-size:.76rem;color:var(--muted);margin:0;line-height:1.5">JPG / PNG / WebP · Lưu dạng base64<br>Khuyến nghị: vuông, tối thiểu 200×200px</p>
              ${food.image ? `<button class="adm-btn-sm" style="background:var(--surface-2);color:var(--muted);width:fit-content" onclick="Admin._foodClearImg()">✕ Xóa ảnh</button>` : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="adm-modal-footer">
        <button class="adm-btn-sm" style="background:var(--surface-2);color:var(--text)" onclick="Admin._closeFoodModal()">Huỷ</button>
        <button class="adm-btn-sm adm-btn-confirm" onclick="Admin._saveFoodItem()">💾 Lưu món ăn</button>
      </div>`;

    modal.style.display = "flex";
  }

  // Preview ảnh trước khi lưu
  function _foodPreviewImg(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById("fadm-img-preview");
      if (preview) preview.innerHTML = `<img loading="lazy" decoding="async" src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
      // Lưu tạm vào input hidden
      input.dataset.base64 = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function _foodClearImg() {
    const preview = document.getElementById("fadm-img-preview");
    const inp     = document.getElementById("fadm-img-input");
    if (preview) {
      const emoji = document.getElementById("fadm-emoji");
      preview.innerHTML = emoji ? emoji.value : "🍜";
    }
    if (inp) { inp.value = ""; inp.dataset.base64 = ""; }
  }

  function _closeFoodModal() {
    const modal = document.getElementById("adm-food-modal");
    if (modal) modal.style.display = "none";
    _editFood = null;
  }

  // Lưu món
  function _saveFoodItem() {
    const name  = document.getElementById("fadm-name")?.value.trim();
    const emoji = document.getElementById("fadm-emoji")?.value.trim() || "🍜";
    const reg   = document.getElementById("fadm-region")?.value.trim();
    const desc  = document.getElementById("fadm-desc")?.value.trim();
    const tags  = (document.getElementById("fadm-tags")?.value || "").split(",").map(t=>t.trim()).filter(Boolean);
    const imgInput = document.getElementById("fadm-img-input");
    const image = imgInput?.dataset.base64 || (_editFood !== null ? (getRegions()[_editFood?.region]?.foods[_editFood?.idx]?.image || "") : "");

    if (!name || !reg || !desc) { showToast("⚠️ Vui lòng điền đủ Tên, Vùng và Mô tả", "error"); return; }

    const regions = getRegions() || {};
    if (!regions[_foodRegion]) regions[_foodRegion] = { foods: [] };
    if (!regions[_foodRegion].foods) regions[_foodRegion].foods = [];

    const item = { emoji, name, region: reg, desc, tags, ...(image ? { image } : {}) };

    if (_editFood !== null) {
      regions[_editFood.region].foods[_editFood.idx] = { ...regions[_editFood.region].foods[_editFood.idx], ...item };
      showToast(`✅ Đã cập nhật "${name}"`, "success");
    } else {
      regions[_foodRegion].foods.push(item);
      showToast(`✅ Đã thêm "${name}"`, "success");
    }

    saveFood(regions);
    // Thông báo FoodModule reload
    if (window.FoodModule && typeof FoodModule.reload === "function") FoodModule.reload();
    _closeFoodModal();
    render();
  }

  // Xóa món
  function _deleteFoodItem(idx) {
    const regions = getRegions();
    const name    = regions[_foodRegion]?.foods[idx]?.name || "món này";
    if (!confirm(`Xóa "${name}" khỏi danh sách?`)) return;
    regions[_foodRegion].foods.splice(idx, 1);
    saveFood(regions);
    if (window.FoodModule && typeof FoodModule.reload === "function") FoodModule.reload();
    showToast(`🗑️ Đã xóa "${name}"`, "info");
    render();
  }

  // Switch region trong tab food
  function _foodSetRegion(region) {
    _foodRegion = region;
    render();
  }

  // Patch vào Admin
  Object.assign(Admin, {
    _renderFoodTab: renderFoodTab,
    _openFoodForm,
    _closeFoodModal,
    _saveFoodItem,
    _deleteFoodItem,
    _foodSetRegion,
    _foodPreviewImg,
    _foodClearImg,
  });

})();
