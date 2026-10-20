import axios from "axios";
// Trang hồ sơ hướng dẫn viên: guide.html?id=g_hn01
// cấu hình axios
const API_URL = "/api";
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

// Các phần tử DOM
const loadingEl = document.getElementById("guideLoading");
const errorEl = document.getElementById("guideError");
const guideDetailEl = document.getElementById("guideDetail");

// tiêu đề gốc của trang (dùng khi không tìm thấy guide)
const SITE_TITLE = document.title;

// 3 trạng thái của hướng dẫn viên
const STATUS = {
  active: { label: "Đang nhận tour", cls: "active" },
  busy: { label: "Đang bận", cls: "busy" },
  off: { label: "Tạm nghỉ", cls: "off" },
};

// chống chèn mã HTML khi đưa dữ liệu vào giao diện
function escapeHtml(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// ===== Các hàm xử lý ngày =====
function pad(n) {
  return String(n).padStart(2, "0");
}

// ngày hôm nay dạng YYYY-MM-DD (cùng định dạng với busyDates)
function getToday() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// 2026-11-02 -> 02/11/2026
function formatDate(dateStr) {
  return dateStr.slice(8, 10) + "/" + dateStr.slice(5, 7) + "/" + dateStr.slice(0, 4);
}

// lấy các ngày bận hợp lệ, sắp xếp tăng dần
function getBusyDates(guide) {
  const list = Array.isArray(guide.busyDates) ? guide.busyDates : [];
  return list.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
}

// chỉ lấy các ngày bận từ hôm nay trở đi
function getUpcomingBusy(guide) {
  return getBusyDates(guide).filter((d) => d >= getToday());
}

/**
 * Lấy tham số id hướng dẫn viên từ URL bằng URLSearchParams
 * Ví dụ: guide.html?id=g_hn01 -> guideId = "g_hn01"
 */
function getGuideIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// ===== Lấy thông tin chi tiết hướng dẫn viên từ API =====
// trả về { guide, failed }: guide = null nghĩa là không tìm thấy, failed = true nghĩa là lỗi tải dữ liệu
async function getGuideDetail(id) {
  try {
    const response = await api.get(`/guides/${encodeURIComponent(id)}`);
    return { guide: response.data.guide || null, failed: false };
  } catch (error) {
    // không có server Node (mở bằng Live Server...) thì đọc file mẫu rồi tìm theo id
    try {
      const response = await axios.get("data/guides-seed.json", { timeout: 5000 });
      const guides = Array.isArray(response.data) ? response.data : [];
      return { guide: guides.find((g) => g.id === id) || null, failed: false };
    } catch (err) {
      console.error("Lỗi khi tải hồ sơ hướng dẫn viên:", err);
      return { guide: null, failed: true };
    }
  }
}

// ===== Các phần nhỏ của trang =====
// chữ cái đầu của tên, dùng khi không có ảnh
function getInitials(name) {
  const words = String(name || "?").trim().split(/\s+/);
  const first = (words[0] || "?")[0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function renderAvatar(guide) {
  if (guide.avatar) {
    return `<img class="guide-avatar" src="${escapeHtml(guide.avatar)}" alt="Ảnh ${escapeHtml(guide.name)}" width="112" height="112" loading="lazy" data-initials="${escapeHtml(getInitials(guide.name))}">`;
  }
  return `<span class="guide-avatar guide-avatar-fallback" aria-hidden="true">${escapeHtml(getInitials(guide.name))}</span>`;
}

// ảnh bị lỗi thì thay bằng vòng tròn chữ cái đầu
function handleAvatarError(scope) {
  scope.querySelectorAll("img.guide-avatar").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const span = document.createElement("span");
        span.className = img.className + " guide-avatar-fallback";
        span.setAttribute("aria-hidden", "true");
        span.textContent = img.dataset.initials || "?";
        img.replaceWith(span);
      },
      { once: true },
    );
  });
}

function renderLanguages(guide) {
  let html = '<span class="guide-languages">';
  (guide.languages || []).forEach((lang) => {
    html += `<span class="language-tag">${escapeHtml(lang)}</span>`;
  });
  html += "</span>";
  return html;
}

// 8 năm kinh nghiệm · Miền Bắc
function renderMeta(guide) {
  const exp = guide.experience ? guide.experience + " năm kinh nghiệm" : "";
  const regions = (guide.regions || []).length ? " · " + guide.regions.map(escapeHtml).join(", ") : "";
  return exp + regions;
}

// nhãn trạng thái (đang nhận tour, đang bận...)
function renderStatus(guide) {
  const status = STATUS[guide.status] || STATUS.off;
  // hôm nay trùng ngày bận thì báo "Bận hôm nay"
  const busyToday = getBusyDates(guide).includes(getToday());
  const label = busyToday && guide.status === "active" ? "Bận hôm nay" : status.label;
  return `<span class="guide-status ${status.cls}">${label}</span>`;
}

// các ngày bận sắp tới (tối đa max ngày)
function renderBusyDates(guide, max) {
  const upcoming = getUpcomingBusy(guide);
  if (upcoming.length === 0) {
    return '<span class="no-busy">Chưa có lịch bận sắp tới</span>';
  }
  let html = "";
  upcoming.slice(0, max).forEach((date) => {
    html += `<span class="busy-date">${formatDate(date)}</span>`;
  });
  if (upcoming.length > max) {
    html += `<span class="no-busy">+${upcoming.length - max} ngày nữa</span>`;
  }
  return html;
}

function renderFacts(guide) {
  const status = STATUS[guide.status] || STATUS.off;
  return `
    <dl class="guide-facts">
      <div class="fact-item"><dt>Kinh nghiệm</dt><dd>${escapeHtml(guide.experience)} năm</dd></div>
      <div class="fact-item"><dt>Ngôn ngữ</dt><dd>${(guide.languages || []).map(escapeHtml).join(", ")}</dd></div>
      <div class="fact-item"><dt>Khu vực</dt><dd>${(guide.regions || []).map(escapeHtml).join(", ") || "—"}</dd></div>
      <div class="fact-item"><dt>Trạng thái</dt><dd>${escapeHtml(status.label)}</dd></div>
    </dl>
  `;
}

// ===== Lịch bận: vẽ 1 tháng (ngày bận tô đỏ, hôm nay có viền) =====
function renderMonth(year, month, busySet, todayKey) {
  // tuần bắt đầu từ Thứ hai: Chủ nhật (0) đổi thành cột cuối
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let cells = "";
  ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].forEach((name) => {
    cells += `<div class="calendar-dow">${name}</div>`;
  });
  // các ô trống trước ngày mùng 1
  for (let i = 0; i < firstDay; i++) {
    cells += '<div class="calendar-day empty"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = year + "-" + pad(month + 1) + "-" + pad(day);
    const isBusy = busySet.has(key);
    let cls = "calendar-day";
    if (isBusy) cls += " busy";
    if (key === todayKey) cls += " today";
    if (key < todayKey) cls += " past";
    cells += `<div class="${cls}" aria-label="${day}/${month + 1}/${year}: ${isBusy ? "bận" : "còn trống"}">${day}</div>`;
  }
  return `
    <div>
      <div class="calendar-title">Tháng ${month + 1}/${year}</div>
      <div class="calendar-grid">${cells}</div>
    </div>
  `;
}

// lịch 3 tháng, bắt đầu từ tháng hiện tại
function renderCalendar(guide) {
  const busySet = new Set(getBusyDates(guide));
  const now = new Date();
  const todayKey = getToday();

  let months = "";
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months += renderMonth(d.getFullYear(), d.getMonth(), busySet, todayKey);
  }
  return `
    <div class="calendar-list">${months}</div>
    <div class="calendar-legend">
      <span><i class="legend-dot busy"></i>Ngày bận</span>
      <span><i class="legend-dot"></i>Còn trống</span>
      <span><i class="legend-dot today"></i>Hôm nay</span>
    </div>
  `;
}

// ===== Hiển thị chi tiết hướng dẫn viên ra giao diện =====
function renderGuideDetail(guide) {
  guideDetailEl.innerHTML = `
    <section class="guide-hero">
      ${renderAvatar(guide)}
      <div class="guide-hero-info">
        <h1>${escapeHtml(guide.name)}</h1>
        <div class="guide-meta">${renderMeta(guide)}</div>
        ${renderStatus(guide)}
        ${renderLanguages(guide)}
      </div>
    </section>

    <section class="guide-section">
      <h2>Giới thiệu</h2>
      <p class="guide-bio">${escapeHtml(guide.bio)}</p>
    </section>

    <section class="guide-section">
      <h2>Thông tin</h2>
      ${renderFacts(guide)}
    </section>

    <section class="guide-section">
      <h2>Lịch bận</h2>
      <p class="calendar-note">Các ngày đánh dấu đỏ là ngày hướng dẫn viên đã có lịch. Ngày còn trống vẫn nên liên hệ để xác nhận.</p>
      ${renderCalendar(guide)}
      <div class="busy-line">
        <b>Ngày bận sắp tới</b>
        ${renderBusyDates(guide, 12)}
      </div>
    </section>
  `;
  handleAvatarError(guideDetailEl);
}

// hiện khung thông báo lỗi (thay cho khung chi tiết)
function showError(html) {
  loadingEl.classList.add("hidden");
  guideDetailEl.classList.add("hidden");
  errorEl.innerHTML = html;
  errorEl.classList.remove("hidden");
}

// ===== Tải và hiển thị trang =====
async function loadGuideDetail() {
  const id = getGuideIdFromUrl();

  // chưa chọn hướng dẫn viên nào
  if (!id) {
    showError(`
      <div style="font-size: 2rem"></div>
      <h2>Chưa chọn hướng dẫn viên</h2>
      <p>Hãy chọn một người trong <a href="index.html#/guides">danh sách hướng dẫn viên</a>.</p>
    `);
    return;
  }

  errorEl.classList.add("hidden");
  guideDetailEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  const result = await getGuideDetail(id);

  // lỗi tải dữ liệu thì hiện nút thử lại
  if (result.failed) {
    showError(`
      <div style="font-size: 2rem"></div>
      <h2>Không tải được hồ sơ</h2>
      <p>Kiểm tra mạng rồi thử lại.</p>
      <button type="button" id="retryBtn" class="retry-btn">Thử lại</button>
    `);
    document.getElementById("retryBtn").addEventListener("click", loadGuideDetail);
    return;
  }

  // không có hướng dẫn viên với id này
  if (!result.guide) {
    document.title = "Không tìm thấy – " + SITE_TITLE;
    showError(`
      <div style="font-size: 2rem"></div>
      <h2>Không tìm thấy hướng dẫn viên</h2>
      <p>Mã <b>${escapeHtml(id)}</b> không tồn tại.<br><a href="index.html#/guides">← Về danh sách hướng dẫn viên</a></p>
    `);
    return;
  }

  document.title = result.guide.name + " – Hướng dẫn viên | Travel";
  loadingEl.classList.add("hidden");
  renderGuideDetail(result.guide);
  guideDetailEl.classList.remove("hidden");
}

loadGuideDetail();
