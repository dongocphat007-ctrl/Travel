/**
 * TAB LAYOUT MODULE — Task 5.1
 * Tách 2 phần: Chuyến đi cá nhân & Tour mẫu (có HDV / tự túc)
 *
 *
 * CÁCH TÍCH HỢP:
 *   1. Thêm CSS: <link rel="stylesheet" href="tab-layout.css">
 *   2. Thêm JS:  <script src="tab-layout.js"></script>
 *   3. Đặt container vào HTML:
 *        <div id="mainTabContainer"></div>
 *   4. Khởi tạo:
 *        TabLayout.init({
 *          container: '#mainTabContainer',
 *          personalTrips: window.tripsData || [],
 *          sampleTours:   window.toursData || [],
 *          onCreateTrip:  () => openCreateTripDialog(),
 *          onEditTrip:    (trip) => openEditDialog(trip),
 *          onDeleteTrip:  (trip) => deleteTrip(trip.id),
 *          onBookTour:    (tour) => openBookingDialog(tour),
 *          onCloneTour:   (tour) => cloneToMyTrips(tour),
 *        });
 *
 * DỮ LIỆU TOUR MẪU (toursData):
 * [
 *   {
 *     id: 't1',
 *     type: 'guided',        // 'guided' | 'self'
 *     name: 'Hội An cổ kính',
 *     destination: 'Hội An',
 *     duration: '4 ngày 3 đêm',
 *     price: 3500000,
 *     currency: 'VND',
 *     groupSize: '10–15 người',
 *     highlight: 'Phố cổ · Làng rau · Đèn lồng',
 *     difficulty: 'Dễ',
 *     tags: ['Văn hoá', 'Ẩm thực'],
 *     coverEmoji: '🏮',
 *   }
 * ]
 */

const TabLayout = (() => {

  // State
  let _cfg = {};
  let _activeTab = "personal";   // 'personal' | 'tours'
  let _tourFilter = "all";       // 'all' | 'guided' | 'self' | 'international'
  let _searchQuery = "";

  // Màu sắc & tokens
  // (CSS variables được inject vào DOM 1 lần)

  //  INIT

  function init(cfg = {}) {
    _cfg = {
      container:      "#mainTabContainer",
      personalTrips:  [],
      myBookings:     [],   // tour mẫu user đã đăng ký (BookingManager.mine())
      sampleTours:    [],
      onCreateTrip:   () => {},
      onEditTrip:     () => {},
      onDeleteTrip:   () => {},
      onBookTour:     () => {},
      onCloneTour:    () => {},
      ...cfg,
    };

    const root = document.querySelector(_cfg.container);
    if (!root) { console.error("[TabLayout] Container không tìm thấy:", _cfg.container); return; }

    injectStyles();
    render(root);
  }

  //  RENDER CHÍNH

  function render(root) {
    root.innerHTML = "";
    root.className = "tl-root";

    // Tab bar
    const tabBar = el("div", "tl-tabbar");
    tabBar.innerHTML = `
      <div class="tl-tabbar-inner">
        <button class="tl-tab ${_activeTab === "personal" ? "is-active" : ""}" data-tab="personal">
          <span class="tl-tab-icon">🧳</span>
          <span class="tl-tab-text">Chuyến đi của tôi</span>
          <span class="tl-tab-count">${_cfg.personalTrips.length + _cfg.myBookings.filter(b => b.status !== "cancelled").length}</span>
        </button>
        <button class="tl-tab ${_activeTab === "tours" ? "is-active" : ""}" data-tab="tours">
          <span class="tl-tab-icon">🗺</span>
          <span class="tl-tab-text">Tour mẫu</span>
          <span class="tl-tab-count tl-tab-count--tour">${_cfg.sampleTours.length}</span>
        </button>
        <div class="tl-tab-underline" id="tlUnderline"></div>
      </div>
    `;
    root.appendChild(tabBar);

    // Panels
    const panels = el("div", "tl-panels");
    const panelPersonal = renderPersonalPanel();
    const panelTours    = renderToursPanel();
    panelPersonal.style.display = _activeTab === "personal" ? "block" : "none";
    panelTours.style.display    = _activeTab === "tours"    ? "block" : "none";
    panels.appendChild(panelPersonal);
    panels.appendChild(panelTours);
    root.appendChild(panels);

    // Events
    bindTabEvents(root);
    updateUnderline(root);
  }

  function bindTabEvents(root) {
    root.querySelectorAll(".tl-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        _activeTab = btn.dataset.tab;
        root.querySelectorAll(".tl-tab").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        root.querySelector('[data-panel="personal"]').style.display = _activeTab === "personal" ? "block" : "none";
        root.querySelector('[data-panel="tours"]').style.display    = _activeTab === "tours"    ? "block" : "none";
        updateUnderline(root);
      });
    });
  }

  function updateUnderline(root) {
    const activeBtn = root.querySelector(".tl-tab.is-active");
    const underline = root.querySelector("#tlUnderline");
    if (!activeBtn || !underline) return;
    underline.style.left  = activeBtn.offsetLeft + "px";
    underline.style.width = activeBtn.offsetWidth + "px";
    underline.style.background = _activeTab === "personal" ? "var(--tl-indigo)" : "var(--tl-amber)";
  }

  //  PANEL 1 — CHUYẾN ĐI CÁ NHÂN

  function renderPersonalPanel() {
    const panel = el("div", "tl-panel tl-panel--personal");
    panel.dataset.panel = "personal";
    const trips = _cfg.personalTrips;

    // Header
    panel.innerHTML = `
      <div class="tl-personal-header">
        <div>
          <h2 class="tl-section-title">Chuyến đi của tôi</h2>
          <p class="tl-section-sub">Lưu trữ và quản lý hành trình cá nhân</p>
        </div>
        <button class="tl-btn-primary" id="tlBtnCreate">
          + Tạo chuyến mới
        </button>
      </div>

      ${trips.length === 0 && !_cfg.myBookings.length ? renderPersonalEmpty() : (trips.length ? renderPersonalGrid(trips) : "")}
      ${renderBookingsGroup(_cfg.myBookings)}
    `;

    // Events
    panel.querySelector("#tlBtnCreate")?.addEventListener("click", _cfg.onCreateTrip);
    panel.querySelectorAll('[data-action="edit"]').forEach(b =>
      b.addEventListener("click", e => {
        const id = e.currentTarget.dataset.id; // FIX: bỏ + để giữ string id
        _cfg.onEditTrip(trips.find(t => String(t.id) === String(id)));
      })
    );
    panel.querySelectorAll('[data-action="delete"]').forEach(b =>
      b.addEventListener("click", e => {
        const id = e.currentTarget.dataset.id; // FIX: bỏ + để giữ string id
        if (confirm("Xoá chuyến này?")) _cfg.onDeleteTrip(trips.find(t => String(t.id) === String(id)));
      })
    );

    panel.querySelectorAll("[data-bk-itin]").forEach(btn =>
      btn.addEventListener("click", e => openBookingItinerary(e.currentTarget.dataset.bkItin))
    );
    panel.querySelectorAll("[data-bk-pdf]").forEach(btn =>
      btn.addEventListener("click", e => window.BookingPDF?.download(e.currentTarget.dataset.bkPdf))
    );
    panel.querySelectorAll("[data-bk-pay]").forEach(btn =>
      btn.addEventListener("click", e => window.Payment?.open(e.currentTarget.dataset.bkPay))
    );

    return panel;
  }

  // Tour mẫu đã đăng ký (trạng thái do admin duyệt)
  function renderBookingsGroup(list) {
    if (!list.length) return "";
    const BK = {
      pending:   ["Chờ xác nhận tour", "#fef3c7", "#92400e"],
      confirmed: ["Đã xác nhận tour",  "#dcfce7", "#166534"],
      cancelled: ["Đã hủy",   "#fee2e2", "#991b1b"],
    };
    const fmtMoney = n => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
    const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const cards = list.map(b => {
      const [lbl, bg, fg] = BK[b.status] || BK.pending;
      const ngayDi = b.date ? new Date(b.date + "T00:00:00").toLocaleDateString("vi-VN") : "—";
      const waitingDepositCheck = !b.depositPaid && (b.claims?.deposit || b.claims?.full);
      const waitingFinalCheck = b.depositPaid && !b.finalPaid && !b.fullPaid && b.claims?.final;
      const waitingPaymentCheck = waitingDepositCheck || waitingFinalCheck;
      const paymentNote = b.finalPaid || b.fullPaid ? "Đã xác nhận thanh toán đủ"
        : waitingFinalCheck ? "Đã xác nhận cọc · phần còn lại đang chờ admin đối chiếu"
        : waitingDepositCheck ? "Đã gửi thông báo chuyển khoản · đang chờ admin đối chiếu"
        : b.depositPaid ? "Admin đã đối chiếu và xác nhận đã nhận cọc"
        : "Chưa ghi nhận chuyển khoản";
      return `
        <div class="tl-card tl-card--personal ${b.status === "cancelled" ? "is-past" : ""}">
          <div class="tl-card-stripe"></div>
          <div class="tl-card-body">
            <div class="tl-card-top">
              <div class="tl-card-dest">${esc(b.tourDest || "—")}</div>
              <span class="tl-badge" style="background:${bg};color:${fg}">${lbl}</span>
            </div>
            <div class="tl-card-name">${esc(b.tourName || "Tour mẫu")}</div>
            <div class="tl-card-meta">
              <span>Ngày đi ${ngayDi}</span>
              <span>${b.pax || 1} người</span>
              <span>${fmtMoney(b.price)}</span>
              ${b.deposit ? `<span>${b.payChoice === "full" || b.fullPaid ? "Trả đủ: " + fmtMoney(b.price) : "Cọc " + depositPctOf(b) + "%: " + fmtMoney(b.deposit)}</span>` : ""}
            </div>
            ${b.deposit && b.status !== "cancelled" ? `<div class="tl-card-note">${paymentNote}</div>` : ""}
            ${b.status === "confirmed" && b.deposit && !b.finalPaid && !b.fullPaid ? (q => `<div class="tl-card-note">Sau khi kết thúc tour chuyển nốt ${100 - depositPctOf(b)}% còn lại: <b>${fmtMoney(q.remaining)}</b>${(b.guideHire && b.guideHire.enabled) || (b.guideType && b.guideType !== "self") ? ` + phụ thu ${fmtMoney(GUIDE_EXTRA_HOUR_FEE)}/tiếng nếu HDV làm thêm giờ` : ""}</div>`)(quyetToanBooking(b)) : ""}
            ${b.status !== "cancelled" && b.deposit && !b.depositPaid
              ? `<button class="tl-card-btn" data-bk-pay="${esc(b.id)}" style="margin-top:10px;margin-right:6px">${waitingPaymentCheck ? "Xem trạng thái chuyển khoản" : "Chuyển khoản"}</button>`
              : ""}
            ${b.status === "confirmed" && b.deposit && b.depositPaid && !b.fullPaid && !b.finalPaid && (end => end && end < dateToStr(new Date()))(ngayKetThucTour(b))
              ? `<button class="tl-card-btn" data-bk-pay="${esc(b.id)}" style="margin-top:10px;margin-right:6px;background:#10b981;color:#fff">Chuyển khoản ${100 - depositPctOf(b)}% còn lại</button>`
              : ""}
            ${b.status !== "cancelled" ? `<button class="tl-card-btn" data-bk-pdf="${esc(b.id)}" style="margin-top:10px;margin-right:6px">Tải PDF xác nhận</button>` : ""}
            ${b.status === "confirmed"
              ? `<button class="tl-card-btn" data-bk-itin="${esc(b.id)}" style="margin-top:10px">Xem lịch trình</button>`
              : b.status === "pending" ? `<div class="tl-card-note">Lịch trình sẽ mở khi admin nhận tour</div>` : ""}
          </div>
        </div>`;
    }).join("");
    return `
      <div class="tl-group">
        <div class="tl-group-label">Tour mẫu đã đăng ký (${list.length})</div>
        <div class="tl-grid">${cards}</div>
      </div>`;
  }

  function renderPersonalEmpty() {
    return `
      <div class="tl-empty">
        <div class="tl-empty-art"></div>
        <div class="tl-empty-title">Bạn chưa có chuyến đi nào</div>
        <div class="tl-empty-sub">Tạo chuyến đi đầu tiên hoặc nhập từ file Word/PDF</div>
      </div>
    `;
  }

  function renderPersonalGrid(trips) {
    // Nhóm: sắp tới / đang đi / đã qua
    const now = new Date();
    const upcoming = trips.filter(t => new Date(t.startDate) > now);
    const ongoing  = trips.filter(t => new Date(t.startDate) <= now && new Date(t.endDate) >= now);
    const past     = trips.filter(t => new Date(t.endDate) < now);

    let html = "";
    if (ongoing.length)  html += renderPersonalGroup("Đang diễn ra", ongoing, "ongoing");
    if (upcoming.length) html += renderPersonalGroup("Sắp tới", upcoming, "upcoming");
    if (past.length)     html += renderPersonalGroup("Đã qua", past, "past");
    if (!html) html = '<div class="tl-grid">' + trips.map(renderPersonalCard).join("") + "</div>";
    return html;
  }

  function renderPersonalGroup(label, trips, type) {
    const dot = { ongoing: "", upcoming: "", past: "⬜" }[type] || "•";
    return `
      <div class="tl-group">
        <div class="tl-group-label">${dot} ${label}</div>
        <div class="tl-grid">${trips.map(t => renderPersonalCard(t, type)).join("")}</div>
      </div>
    `;
  }

  function renderPersonalCard(trip, status = "") {
    const days = tripDays(trip);
    const statusBadge = {
      ongoing:  '<span class="tl-badge tl-badge--green">Đang đi</span>',
      upcoming: '<span class="tl-badge tl-badge--blue">Sắp tới</span>',
      past:     '<span class="tl-badge tl-badge--gray">Đã qua</span>',
    }[status] || "";

    const progress = status === "ongoing" ? renderProgress(trip) : "";

    return `
      <div class="tl-card tl-card--personal ${status === "past" ? "is-past" : ""}">
        <div class="tl-card-stripe"></div>
        <div class="tl-card-body">
          <div class="tl-card-top">
            <div class="tl-card-dest">${trip.destination || "—"}</div>
            ${statusBadge}
          </div>
          <div class="tl-card-name">${trip.name || "Chuyến đi"}</div>
          <div class="tl-card-meta">
            <span>${fmtRange(trip.startDate, trip.endDate)}</span>
            <span>${days} ngày</span>
            ${trip.budget ? `<span>${fmtBudget(trip.budget, trip.currency)}</span>` : ""}
          </div>
          ${progress}
          ${trip.notes ? `<div class="tl-card-note">${trip.notes.slice(0, 60)}${trip.notes.length > 60 ? "…" : ""}</div>` : ""}
        </div>
        <div class="tl-card-actions">
          <button class="tl-card-btn" data-action="edit"   data-id="${trip.id}">Chỉnh sửa</button>
          <button class="tl-card-btn tl-card-btn--ghost" data-action="delete" data-id="${trip.id}">Xoá</button>
        </div>
      </div>
    `;
  }

  function renderProgress(trip) {
    const total   = Math.max(1, (new Date(trip.endDate) - new Date(trip.startDate)) / 86400000);
    const elapsed = (new Date() - new Date(trip.startDate)) / 86400000;
    const pct     = Math.min(100, Math.max(0, Math.round(elapsed / total * 100)));
    return `
      <div class="tl-progress-wrap">
        <div class="tl-progress-bar">
          <div class="tl-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="tl-progress-label">${pct}% hành trình</span>
      </div>
    `;
  }

  //  PANEL 2 — TOUR MẪU

  function renderToursPanel() {
    const panel = el("div", "tl-panel tl-panel--tours");
    panel.dataset.panel = "tours";
    const tours = _cfg.sampleTours;

    const guided = tours.filter(t => t.type !== "self" && !t.international);
    const self   = tours.filter(t => t.type === "self"   && !t.international);
    const intl   = tours.filter(t => t.international);

    _searchQuery = "";
    panel.innerHTML = `
      <div class="tl-tours-header">
        <div>
          <h2 class="tl-section-title tl-section-title--tour">Tour mẫu</h2>
          <p class="tl-section-sub">Chọn hành trình có sẵn hoặc tham khảo tự lên kế hoạch</p>
        </div>
        <div class="tl-tour-search">
          <span class="tl-search-icon"></span>
          <input class="tl-search-input" id="tlTourSearch" placeholder="Tìm tour…" autocomplete="off" name="tl-tour-srch-z9x" readonly onfocus="this.removeAttribute('readonly')">
        </div>
      </div>

      <!-- Filter chips -->
      <div class="tl-filter-chips">
        <button class="tl-chip ${_tourFilter === "all"           ? "is-active" : ""}" data-filter="all">Tất cả <span>${tours.length}</span></button>
        <button class="tl-chip tl-chip--guided ${_tourFilter === "guided" ? "is-active" : ""}" data-filter="guided">
          <span class="tl-chip-dot tl-chip-dot--guided"></span>Có hướng dẫn viên <span>${guided.length}</span>
        </button>
        <button class="tl-chip tl-chip--self ${_tourFilter === "self" ? "is-active" : ""}" data-filter="self">
          <span class="tl-chip-dot tl-chip-dot--self"></span>Tự túc <span>${self.length}</span>
        </button>
        <button class="tl-chip tl-chip--intl ${_tourFilter === "international" ? "is-active" : ""}" data-filter="international">
          <span class="tl-chip-dot tl-chip-dot--intl"></span>Quốc tế <span>${intl.length}</span>
        </button>
      </div>

      <!-- Legend -->
      <div class="tl-legend" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <div class="tl-legend-item">
          <span class="tl-legend-dot" style="background:var(--tl-amber)"></span>
          <span>Tour có hướng dẫn viên — Trọn gói, chuyên nghiệp, phù hợp gia đình</span>
        </div>
        <div class="tl-legend-item">
          <span class="tl-legend-dot" style="background:var(--tl-teal)"></span>
          <span>Tour tự túc — Lịch trình tham khảo, linh hoạt theo ý bạn</span>
        </div>
      </div>

      <!-- Tour content area -->
      <div id="tlTourContent"></div>
    `;

    // Bind filter
    panel.querySelectorAll("[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        _tourFilter = btn.dataset.filter;
        panel.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        renderTourContent(panel);
      });
    });

    // Bind search
    panel.querySelector("#tlTourSearch").addEventListener("input", e => {
      _searchQuery = e.target.value;
      renderTourContent(panel);
    });

    renderTourContent(panel);
    return panel;
  }

  function renderTourContent(panel) {
    let tours = _cfg.sampleTours;

    // Filter by type / international
    if (_tourFilter === "international") {
      tours = tours.filter(t => !!t.international);
    } else if (_tourFilter !== "all") {
      tours = tours.filter(t => (_tourFilter === "self" ? t.type === "self" : t.type !== "self") && !t.international);
    }

    // Filter by search
    if (_searchQuery.trim()) {
      const q = _searchQuery.toLowerCase();
      tours = tours.filter(t =>
        (t.name        || "").toLowerCase().includes(q) ||
        (t.destination || "").toLowerCase().includes(q) ||
        (t.tags        || []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    const content = panel.querySelector("#tlTourContent");
    if (!content) return;

    if (tours.length === 0) {
      content.innerHTML = `
        <div class="tl-empty">
          <div class="tl-empty-art"></div>
          <div class="tl-empty-title">Không tìm thấy tour phù hợp</div>
          <div class="tl-empty-sub">Thử từ khoá khác hoặc bỏ bộ lọc</div>
        </div>`;
      return;
    }

    // Khi filter = all: hiển thị 3 section riêng biệt
    if (_tourFilter === "all") {
      const guided = tours.filter(t => t.type !== "self" && !t.international);
      const self   = tours.filter(t => t.type === "self"   && !t.international);
      const intl   = tours.filter(t => t.international);
      content.innerHTML = "";
      if (guided.length) content.appendChild(renderTourSection("guided",        guided));
      if (self.length)   content.appendChild(renderTourSection("self",          self));
      if (intl.length)   content.appendChild(renderTourSection("international", intl));
    } else if (_tourFilter === "international") {
      content.innerHTML = "";
      content.appendChild(renderTourSection("international", tours));
    } else {
      content.innerHTML = "";
      content.appendChild(renderTourSection(_tourFilter, tours));
    }

    // Bind tour actions
    content.querySelectorAll('[data-tour-action="book"]').forEach(b =>
      b.addEventListener("click", e => {
        const id = e.currentTarget.dataset.id;
        _cfg.onBookTour(_cfg.sampleTours.find(t => t.id === id));
      })
    );
    content.querySelectorAll('[data-tour-action="clone"]').forEach(b =>
      b.addEventListener("click", e => {
        const id = e.currentTarget.dataset.id;
        _cfg.onCloneTour(_cfg.sampleTours.find(t => t.id === id));
      })
    );

    // Ảnh bìa đúng điểm đến (tải lười, có cache)
    if (typeof TourImages !== "undefined") TourImages.hydrate(content, tours);
  }

  function renderTourSection(type, tours) {
    const isGuided = type === "guided";
    const isIntl   = type === "international";
    const badgeClass = isGuided ? "tl-tour-section-badge--guided"
                     : isIntl   ? "tl-tour-section-badge--intl"
                     :            "tl-tour-section-badge--self";
    const badgeLabel = isGuided ? "Có hướng dẫn viên"
                     : isIntl   ? "Tour quốc tế"
                     :            "Tự túc";
    const desc       = isGuided ? "Đặt tour — hướng dẫn viên chuyên nghiệp đồng hành"
                     : isIntl   ? "Hành trình ngoài Việt Nam — trải nghiệm thế giới"
                     :            "Lịch trình tham khảo — sao chép và tuỳ chỉnh theo ý bạn";
    const wrap = el("div", `tl-tour-section tl-tour-section--${type}`);
    wrap.innerHTML = `
      <div class="tl-tour-section-header">
        <span class="tl-tour-section-badge ${badgeClass}">${badgeLabel}</span>
        <span class="tl-tour-section-desc">${desc}</span>
      </div>
      <div class="tl-tour-grid">
        ${tours.map(t => renderTourCard(t)).join("")}
      </div>
    `;
    return wrap;
  }

  function renderTourCard(tour) {
    const isGuided = tour.type !== "self";
    const tags = (tour.tags || []).map(t => `<span class="tl-tag">${t}</span>`).join("");

    return `
      <div class="tl-tour-card tl-tour-card--${isGuided ? "guided" : "self"}">
        <div class="tl-tour-card-thumb" data-tour-img data-tour-id="${tour.id}">
          <span class="tl-tour-card-emoji">${tour.coverEmoji || (isGuided ? "🏝" : "🗺")}</span>
          <span class="tl-tour-type-pill ${isGuided ? "tl-tour-type-pill--guided" : "tl-tour-type-pill--self"}">
            ${isGuided ? "Có HDV" : "Tự túc"}
          </span>
        </div>
        <div class="tl-tour-card-body">
          <div class="tl-tour-dest">${tour.destination || ""}</div>
          <div class="tl-tour-name">${tour.name}</div>
          <div class="tl-tour-highlight">${tour.highlight || ""}</div>
          <div class="tl-tour-meta">
            <span>⏱ ${tour.duration || ""}</span>
            ${tour.groupSize ? `<span>${tour.groupSize}</span>` : ""}
            ${tour.difficulty ? `<span>${tour.difficulty}</span>` : ""}
          </div>
          ${tags ? `<div class="tl-tags">${tags}</div>` : ""}
        </div>
        <div class="tl-tour-card-footer">
          ${isGuided
            ? `<div class="tl-tour-price">${fmtBudget(tour.price, tour.currency)}<span class="tl-tour-price-unit">/người</span></div>
               <button class="tl-btn-tour tl-btn-tour--book" data-tour-action="book" data-id="${tour.id}">Đặt tour</button>`
            : `<div class="tl-tour-price tl-tour-price--self">Tham khảo</div>
               <button class="tl-btn-tour tl-btn-tour--clone" data-tour-action="clone" data-id="${tour.id}">Dùng lịch trình này</button>`
          }
        </div>
      </div>
    `;
  }

  //  UTILS

  function el(tag, className = "") {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function fmtDate(str) {
    if (!str) return "";
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric" });
  }

  function fmtRange(s, e) {
    return `${fmtDate(s)} – ${fmtDate(e)}`;
  }

  function fmtBudget(n, currency = "VND") {
    if (!n) return "";
    const num = Number(n);
    if (currency === "VND") return num.toLocaleString("vi-VN") + " ₫";
    return num.toLocaleString("en-US", { style:"currency", currency });
  }

  function tripDays(trip) {
    if (!trip.startDate || !trip.endDate) return "?";
    const d = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
    return isNaN(d) ? "?" : d;
  }

  //  INJECT STYLES

  function injectStyles() {
    if (document.getElementById("tlStyles")) return;
    const style = document.createElement("style");
    style.id = "tlStyles";
    style.textContent = getCSS();
    document.head.appendChild(style);
  }

  function getCSS() {
    return `
/* ── Design tokens ───────────────────────────────────── */
:root {
  --tl-indigo:      #4f46e5;
  --tl-indigo-lt:   #eef2ff;
  --tl-indigo-mid:  #c7d2fe;
  --tl-amber:       #d97706;
  --tl-amber-lt:    #fffbeb;
  --tl-amber-mid:   #fde68a;
  --tl-teal:        #0d9488;
  --tl-teal-lt:     #f0fdfa;
  --tl-teal-mid:    #99f6e4;
  --tl-gray-50:     #f8fafc;
  --tl-gray-100:    #f1f5f9;
  --tl-gray-200:    #e2e8f0;
  --tl-gray-400:    #94a3b8;
  --tl-gray-600:    #475569;
  --tl-gray-800:    #1e293b;
  --tl-text:        #1e293b;
  --tl-radius:      10px;
  --tl-shadow:      0 1px 4px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06);
  --tl-font:        'Segoe UI', 'Inter', Arial, sans-serif;
}

/* ── Root ─────────────────────────────────────────────── */
.tl-root {
  font-family: var(--tl-font);
  color: var(--tl-text);
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 0 40px;
}

/* ── Tab bar ──────────────────────────────────────────── */
.tl-tabbar {
  border-bottom: 2px solid var(--tl-gray-200);
  margin-bottom: 28px;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 100;
  padding-top: 6px;
}
.tl-tabbar-inner {
  position: relative;
  display: flex;
  gap: 0;
}
.tl-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--tl-font);
  font-size: .95rem;
  color: var(--tl-gray-400);
  font-weight: 500;
  transition: color .18s;
  position: relative;
}
.tl-tab:hover { color: var(--tl-gray-600); }
.tl-tab.is-active { color: var(--tl-text); }
.tl-tab[data-tab="personal"].is-active { color: var(--tl-indigo); }
.tl-tab[data-tab="tours"].is-active    { color: var(--tl-amber); }
.tl-tab-icon { font-size: 1.05rem; }
.tl-tab-text { font-weight: 600; }
.tl-tab-count {
  font-size: .75rem; padding: 1px 8px;
  background: var(--tl-indigo-lt); color: var(--tl-indigo);
  border-radius: 99px; font-weight: 700;
}
.tl-tab-count--tour {
  background: var(--tl-amber-lt); color: var(--tl-amber);
}
.tl-tab-underline {
  position: absolute;
  bottom: -2px; left: 0;
  height: 2.5px; width: 0;
  border-radius: 2px;
  transition: left .22s cubic-bezier(.4,0,.2,1), width .22s cubic-bezier(.4,0,.2,1), background .18s;
}

/* ── Section titles ───────────────────────────────────── */
.tl-section-title {
  font-size: 1.25rem; font-weight: 700; margin: 0 0 3px;
  color: var(--tl-indigo);
}
.tl-section-title--tour { color: var(--tl-amber); }
.tl-section-sub { font-size: .85rem; color: var(--tl-gray-400); margin: 0; }

/* ── Panel: Personal header ───────────────────────────── */
.tl-personal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
}
.tl-btn-primary {
  padding: 9px 20px; background: var(--tl-indigo); color: #fff;
  border: none; border-radius: var(--tl-radius);
  font-size: .9rem; font-weight: 600; cursor: pointer;
  white-space: nowrap; transition: background .18s;
  font-family: var(--tl-font);
}
.tl-btn-primary:hover { background: var(--accent-hover, #8f1d17); }

/* ── Group label ──────────────────────────────────────── */
.tl-group { margin-bottom: 28px; }
.tl-group-label {
  font-size: .8rem; font-weight: 700; letter-spacing: .02em;
  color: var(--tl-gray-400); margin-bottom: 12px;
  padding-left: 2px; text-transform: none;
}

/* ── Grid ─────────────────────────────────────────────── */
.tl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* ── Personal card ────────────────────────────────────── */
.tl-card--personal {
  border-radius: var(--tl-radius);
  border: 1.5px solid var(--tl-gray-200);
  background: #fff;
  box-shadow: var(--tl-shadow);
  display: flex; flex-direction: column;
  overflow: hidden;
  transition: box-shadow .18s, transform .18s;
}
.tl-card--personal:hover {
  box-shadow: 0 4px 20px rgba(79,70,229,.13);
  transform: translateY(-2px);
}
.tl-card--personal.is-past {
  opacity: .72;
  filter: grayscale(.2);
}
.tl-card-stripe {
  height: 4px;
  background: linear-gradient(90deg, var(--tl-indigo) 0%, #818cf8 100%);
}
.tl-card-body { padding: 16px 16px 12px; flex: 1; }
.tl-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.tl-card-dest { font-size: .78rem; font-weight: 700; color: var(--tl-indigo); letter-spacing: .04em; text-transform: uppercase; }
.tl-card-name { font-size: 1rem; font-weight: 700; color: var(--tl-gray-800); margin-bottom: 8px; line-height: 1.3; }
.tl-card-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: .78rem; color: var(--tl-gray-400);
}
.tl-card-note {
  margin-top: 8px; font-size: .8rem; color: var(--tl-gray-400);
  font-style: italic; line-height: 1.45;
}
.tl-card-actions {
  display: flex; gap: 8px; padding: 10px 16px;
  border-top: 1px solid var(--tl-gray-100);
  background: var(--tl-gray-50);
}
.tl-card-btn {
  flex: 1; padding: 7px 0;
  border: 1.5px solid var(--tl-indigo); border-radius: 7px;
  background: var(--tl-indigo); color: #fff;
  font-size: .825rem; font-weight: 600; cursor: pointer;
  font-family: var(--tl-font); transition: background .15s;
}
.tl-card-btn:hover { background: var(--ink-2, #34414f); border-color: var(--ink-2, #34414f); }
.tl-card-btn--ghost {
  background: transparent; color: #ef4444; border-color: #fca5a5;
}
.tl-card-btn--ghost:hover { background: #fef2f2; border-color: #ef4444; }

/* ── Progress bar ─────────────────────────────────────── */
.tl-progress-wrap { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
.tl-progress-bar { flex: 1; height: 5px; background: var(--tl-gray-100); border-radius: 3px; overflow: hidden; }
.tl-progress-fill { height: 100%; background: linear-gradient(90deg, #34d399, #10b981); border-radius: 3px; transition: width .5s; }
.tl-progress-label { font-size: .72rem; color: #10b981; font-weight: 600; white-space: nowrap; }

/* ── Badges ───────────────────────────────────────────── */
.tl-badge {
  font-size: .7rem; padding: 2px 8px; border-radius: 99px;
  font-weight: 700; white-space: nowrap;
}
.tl-badge--green { background: #dcfce7; color: #15803d; }
.tl-badge--blue  { background: var(--tl-indigo-lt); color: var(--tl-indigo); }
.tl-badge--gray  { background: var(--tl-gray-100); color: var(--tl-gray-400); }

/* ── Tour panel header ────────────────────────────────── */
.tl-tours-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 20px; gap: 16px; flex-wrap: wrap;
}
.tl-tour-search {
  position: relative; display: flex; align-items: center;
}
.tl-search-icon { position: absolute; left: 10px; font-size: .9rem; pointer-events: none; }
.tl-search-input {
  padding: 8px 12px 8px 32px;
  border: 1.5px solid var(--tl-gray-200); border-radius: var(--tl-radius);
  font-size: .875rem; font-family: var(--tl-font); color: var(--tl-text);
  width: 200px; transition: border-color .18s, box-shadow .18s;
  background: var(--tl-gray-50);
}
.tl-search-input:focus { outline: none; border-color: var(--tl-amber); box-shadow: 0 0 0 3px rgba(217,119,6,.12); }

/* ── Filter chips ─────────────────────────────────────── */
.tl-filter-chips { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tl-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 99px;
  border: 1.5px solid var(--tl-gray-200); background: #fff;
  font-size: .825rem; font-weight: 600; cursor: pointer;
  color: var(--tl-gray-600); font-family: var(--tl-font); transition: all .15s;
}
.tl-chip span:last-child { font-weight: 400; color: var(--tl-gray-400); font-size: .75rem; }
.tl-chip:hover { border-color: var(--tl-gray-400); }
.tl-chip.is-active { background: var(--tl-gray-100); border-color: var(--tl-gray-400); color: var(--tl-text); }
.tl-chip--guided.is-active { background: var(--tl-amber-lt); border-color: var(--tl-amber); color: var(--tl-amber); }
.tl-chip--self.is-active   { background: var(--tl-teal-lt);  border-color: var(--tl-teal);  color: var(--tl-teal); }
.tl-chip-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.tl-chip-dot--guided { background: var(--tl-amber); }
.tl-chip-dot--self   { background: var(--tl-teal); }
.tl-chip-dot--intl   { background: #3b82f6; }

/* ── Legend ───────────────────────────────────────────── */
.tl-legend {
  display: flex; gap: 20px; flex-wrap: wrap;
  padding: 10px 14px; background: var(--tl-gray-50);
  border-radius: 8px; margin-bottom: 24px;
  border: 1px solid var(--tl-gray-200);
}
.tl-legend-item { display: flex; align-items: center; gap: 7px; font-size: .8rem; color: var(--tl-gray-600); }
.tl-legend-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* ── Tour section ─────────────────────────────────────── */
.tl-tour-section { margin-bottom: 32px; }
.tl-tour-section-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 14px; padding-bottom: 10px;
  border-bottom: 2px solid;
}
.tl-tour-section--guided .tl-tour-section-header { border-color: var(--tl-amber-mid); }
.tl-tour-section--self   .tl-tour-section-header { border-color: var(--tl-teal-mid); }
.tl-tour-section-badge {
  font-size: .8rem; font-weight: 700; padding: 4px 12px;
  border-radius: 99px; white-space: nowrap;
}
.tl-tour-section-badge--guided { background: var(--tl-amber-lt); color: var(--tl-amber); }
.tl-tour-section-badge--self   { background: var(--tl-teal-lt);  color: var(--tl-teal); }
.tl-tour-section-badge--intl   { background: #dbeafe; color: #1d4ed8; }
.tl-tour-section-desc { font-size: .82rem; color: var(--tl-gray-400); }

/* ── Tour grid ────────────────────────────────────────── */
.tl-tour-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

/* ── Tour card ────────────────────────────────────────── */
.tl-tour-card {
  border-radius: var(--tl-radius);
  border: 1.5px solid var(--tl-gray-200);
  background: #fff;
  box-shadow: var(--tl-shadow);
  display: flex; flex-direction: column;
  overflow: hidden;
  transition: box-shadow .18s, transform .18s;
}
.tl-tour-card:hover {
  transform: translateY(-2px);
}
.tl-tour-card--guided:hover { box-shadow: 0 6px 24px rgba(217,119,6,.15); }
.tl-tour-card--self:hover   { box-shadow: 0 6px 24px rgba(13,148,136,.15); }

/* Thumbnail strip */
.tl-tour-card-thumb {
  height: 120px;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  font-size: 2.6rem;
}
.tl-tour-card--guided .tl-tour-card-thumb { background: linear-gradient(135deg, var(--tl-amber-lt) 0%, #fef3c7 100%); }
.tl-tour-card--self   .tl-tour-card-thumb { background: linear-gradient(135deg, var(--tl-teal-lt) 0%, #ccfbf1 100%); }

.tl-tour-type-pill {
  position: absolute; top: 8px; right: 8px;
  font-size: .65rem; font-weight: 700; padding: 2px 8px;
  border-radius: 99px;
}
.tl-tour-type-pill--guided { background: var(--tl-amber); color: #fff; }
.tl-tour-type-pill--self   { background: var(--tl-teal);  color: #fff; }

.tl-tour-card-body { padding: 14px 14px 10px; flex: 1; }
.tl-tour-dest { font-size: .72rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 3px; }
.tl-tour-card--guided .tl-tour-dest { color: var(--tl-amber); }
.tl-tour-card--self   .tl-tour-dest { color: var(--tl-teal); }
.tl-tour-name { font-size: .95rem; font-weight: 700; color: var(--tl-gray-800); margin-bottom: 5px; line-height: 1.3; }
.tl-tour-highlight { font-size: .78rem; color: var(--tl-gray-400); margin-bottom: 8px; line-height: 1.4; }
.tl-tour-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: .76rem; color: var(--tl-gray-400); margin-bottom: 8px; }

.tl-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tl-tag {
  font-size: .7rem; padding: 2px 8px; border-radius: 4px;
  background: var(--tl-gray-100); color: var(--tl-gray-600); font-weight: 600;
}

/* Tour card footer */
.tl-tour-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--tl-gray-100);
  background: var(--tl-gray-50);
  gap: 8px;
}
.tl-tour-price { font-size: .95rem; font-weight: 800; color: var(--tl-amber); }
.tl-tour-price--self { font-size: .825rem; font-weight: 600; color: var(--tl-teal); font-style: italic; }
.tl-tour-price-unit { font-size: .72rem; font-weight: 400; color: var(--tl-gray-400); margin-left: 2px; }

.tl-btn-tour {
  padding: 7px 14px; border-radius: 7px;
  font-size: .8rem; font-weight: 700; cursor: pointer;
  border: none; font-family: var(--tl-font); transition: all .15s;
  white-space: nowrap;
}
.tl-btn-tour--book  { background: var(--tl-amber); color: #fff; }
.tl-btn-tour--book:hover  { background: #b45309; }
.tl-btn-tour--clone { background: var(--tl-teal);  color: #fff; }
.tl-btn-tour--clone:hover { background: #0f766e; }

/* ── Empty state ──────────────────────────────────────── */
.tl-empty {
  text-align: center; padding: 52px 20px;
  color: var(--tl-gray-400);
}
.tl-empty-art { font-size: 3rem; margin-bottom: 10px; }
.tl-empty-title { font-size: 1rem; font-weight: 700; color: var(--tl-gray-600); margin-bottom: 5px; }
.tl-empty-sub { font-size: .85rem; }

/* ── Responsive ───────────────────────────────────────── */
@media (max-width: 600px) {
  .tl-tab { padding: 12px 10px; font-size: .875rem; flex: 1 1 0; justify-content: center; white-space: nowrap; min-height: 44px; }
  .tl-grid, .tl-tour-grid { grid-template-columns: 1fr; }
  .tl-tours-header, .tl-personal-header { flex-direction: column; }
  .tl-search-input { width: 100%; }
  .tl-legend { flex-direction: column; gap: 8px; }
}
    `;
  }

  // Public API
  return { init, refresh: (cfg) => init({ ..._cfg, ...cfg }) };

})();

window.TabLayout = TabLayout;
