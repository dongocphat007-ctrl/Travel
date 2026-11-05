import axios from "axios";
// Trang danh sách hướng dẫn viên (dạng accordion) – route #/guides
// cấu hình axios
const API_URL = "/api";
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

const ROUTE = "#/guides";

// lấy dữ liệu về cần có nơi chứa nó
let allGuides = [];
let loadFailed = false;

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

// ===== phương thức lấy dữ liệu từ API và lưu vào biến allGuides =====
async function getGuides() {
  loadFailed = false;
  // Hồ sơ HDV đọc từ file ở frontend trước; chỉ khi file không đọc được mới hỏi server
  try {
    const response = await axios.get("data/guides-seed.json", { timeout: 5000 });
    allGuides = response.data;
  } catch (error) {
    try {
      const response = await api.get("/guides");
      allGuides = response.data.guides;
    } catch (err) {
      console.error("Error fetching guides:", err);
      allGuides = [];
      loadFailed = true;
    }
    if (!Array.isArray(allGuides)) allGuides = [];
    return;
  }
  if (!Array.isArray(allGuides)) allGuides = [];
  // Lịch bận THẬT (gồm các đơn đã đặt) chỉ server biết → hỏi server để cập nhật ngày bận; lỗi thì dùng lịch trong file
  try {
    const response = await api.get("/guides");
    const live = new Map((response.data.guides || []).map((g) => [g.id, g]));
    allGuides = allGuides.map((g) => (live.has(g.id) ? { ...g, busyDates: live.get(g.id).busyDates || g.busyDates } : g));
  } catch (err) { /* không có server */ }
}

// ===== Các phần nhỏ của thẻ guide =====
// chữ cái đầu của tên, dùng khi không có ảnh
function getInitials(name) {
  const words = String(name || "?").trim().split(/\s+/);
  const first = (words[0] || "?")[0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function renderAvatar(guide) {
  if (guide.avatar) {
    return `<img class="guide-avatar" src="${escapeHtml(guide.avatar)}" alt="Ảnh ${escapeHtml(guide.name)}" width="64" height="64" loading="lazy" data-initials="${escapeHtml(getInitials(guide.name))}">`;
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

// ★ 4.8 (126 đánh giá) · 310 tour đã dẫn
function renderRating(guide) {
  if (!guide.rating) return "";
  const n = guide.reviewCount ? ` (${escapeHtml(guide.reviewCount)} đánh giá)` : "";
  const led = guide.toursLed ? ` · ${escapeHtml(guide.toursLed)} tour đã dẫn` : "";
  return `<span class="guide-rating"><b>★ ${escapeHtml(Number(guide.rating).toFixed(1))}</b>${n}${led}</span>`;
}

// thẻ chuyên môn / chứng chỉ / địa bàn
function renderTags(list, cls) {
  return (list || []).length ? `<span class="guide-tags">${list.map((x) => `<span class="${cls}">${escapeHtml(x)}</span>`).join("")}</span>` : "—";
}

function renderFacts(guide) {
  const status = STATUS[guide.status] || STATUS.off;
  return `
    <dl class="guide-facts">
      <div class="fact-item"><dt>Kinh nghiệm</dt><dd>${escapeHtml(guide.experience)} năm</dd></div>
      <div class="fact-item"><dt>Ngôn ngữ</dt><dd>${(guide.languages || []).map(escapeHtml).join(", ")}</dd></div>
      <div class="fact-item"><dt>Khu vực</dt><dd>${(guide.regions || []).map(escapeHtml).join(", ") || "—"}</dd></div>
      <div class="fact-item"><dt>Trạng thái</dt><dd>${escapeHtml(status.label)}</dd></div>
      ${guide.title ? `<div class="fact-item"><dt>Loại thẻ</dt><dd>${escapeHtml(guide.title)}</dd></div>` : ""}
      ${guide.rating ? `<div class="fact-item"><dt>Đánh giá</dt><dd>${renderRating(guide)}</dd></div>` : ""}
      ${(guide.provinces || []).length ? `<div class="fact-item fact-wide"><dt>Địa bàn quen thuộc</dt><dd>${renderTags(guide.provinces, "guide-tag")}</dd></div>` : ""}
      ${(guide.specialties || []).length ? `<div class="fact-item fact-wide"><dt>Chuyên môn</dt><dd>${renderTags(guide.specialties, "guide-tag guide-tag--spec")}</dd></div>` : ""}
      ${(guide.certifications || []).length ? `<div class="fact-item fact-wide"><dt>Chứng chỉ</dt><dd>${renderTags(guide.certifications, "guide-tag guide-tag--cert")}</dd></div>` : ""}
    </dl>
    ${guide.demo ? '<p class="guide-demo-note">Hồ sơ mẫu dùng để minh họa; điểm đánh giá và số tour là dữ liệu giả lập.</p>' : ""}
  `;
}

// ===== có dữ liệu thì render ra giao diện cho người dùng thấy =====
function renderGuides(guides) {
  const guideList = document.querySelector("#guideList");
  if (!guideList) return;

  // không có guide nào thì hiển thị thông báo
  if (!guides || guides.length === 0) {
    guideList.innerHTML = `
      <div class="guide-state">
        <div style="font-size: 2rem"></div>
        <h2>Không có hướng dẫn viên phù hợp</h2>
        <p>Thử đổi bộ lọc khu vực, ngôn ngữ hoặc trạng thái.</p>
      </div>
    `;
    return;
  }

  // làm mới danh sách rồi duyệt qua từng guide và hiển thị
  guideList.innerHTML = "";
  guides.forEach((guide) => {
    const id = escapeHtml(guide.id);
    guideList.innerHTML += `
      <article class="guide-card" data-id="${id}">

        <!-- PHẦN ĐẦU: bấm vào để xổ chi tiết -->
        <button type="button" class="guide-header" id="guide-btn-${id}"
          aria-expanded="false" aria-controls="guide-panel-${id}">
          ${renderAvatar(guide)}
          <span class="guide-info">
            <span class="guide-name">${escapeHtml(guide.name)}</span>
            <span class="guide-meta">${renderMeta(guide)}</span>
            ${renderRating(guide)}
            ${renderLanguages(guide)}
          </span>
          ${renderStatus(guide)}
          <span class="guide-arrow" aria-hidden="true">▾</span>
        </button>

        <!-- PHẦN CHI TIẾT: xổ ra khi bấm -->
        <div class="guide-panel" id="guide-panel-${id}" role="region" aria-labelledby="guide-btn-${id}">
          <div class="guide-panel-inner">
            <div class="guide-body">
              <p class="guide-bio">${escapeHtml(guide.bio)}</p>
              ${renderFacts(guide)}
              <div class="busy-line">
                <b>Ngày bận sắp tới</b>
                ${renderBusyDates(guide, 6)}
              </div>
              <a class="detail-btn" href="guide.html?id=${encodeURIComponent(guide.id)}">
                Xem hồ sơ đầy đủ →
              </a>
            </div>
          </div>
        </div>

      </article>
    `;
  });
  handleAvatarError(guideList);
}

// ===== hiển thị cả trang: loading -> dữ liệu (hoặc lỗi) =====
async function renderGuidePage() {
  const guideList = document.querySelector("#guideList");
  const loadingEl = document.querySelector("#guideLoading");
  const errorEl = document.querySelector("#guideError");
  const summaryEl = document.querySelector("#guideSummary");
  if (!guideList) return;

  guideList.innerHTML = "";
  errorEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");

  await getGuides();

  loadingEl.classList.add("hidden");
  // lỗi tải dữ liệu thì hiện nút thử lại
  if (loadFailed) {
    errorEl.classList.remove("hidden");
    return;
  }
  fillLangFilter();
  applyGuideFilters();
}

// ===== Bộ lọc khu vực / ngôn ngữ / trạng thái (lọc trên dữ liệu đã tải, không gọi lại server) =====
function fillLangFilter() {
  const sel = document.querySelector("#gf-lang");
  if (!sel || sel.options.length > 1) return;
  const langs = [...new Set(allGuides.flatMap((g) => g.languages || []))].sort((a, b) => a.localeCompare(b, "vi"));
  sel.innerHTML = '<option value="">Tất cả</option>' + langs.map((l) => `<option>${escapeHtml(l)}</option>`).join("");
}

function applyGuideFilters() {
  const val = (id) => (document.querySelector(id) || {}).value || "";
  const region = val("#gf-region"), lang = val("#gf-lang"), status = val("#gf-status");
  const list = allGuides.filter((g) =>
    (!region || (g.regions || []).includes(region)) &&
    (!lang || (g.languages || []).includes(lang)) &&
    (!status || g.status === status));
  const ready = list.filter((g) => g.status === "active").length;
  const summaryEl = document.querySelector("#guideSummary");
  if (summaryEl) summaryEl.textContent = `${list.length}/${allGuides.length} hướng dẫn viên · ${ready} người đang nhận tour. Bấm vào một người để xem chi tiết.`;
  renderGuides(list);
}

// ===== Accordion: bấm một card để xổ chi tiết, mỗi lần chỉ mở 1 guide =====
function setOpen(card, isOpen) {
  card.classList.toggle("open", isOpen);
  card.querySelector(".guide-header").setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function toggleGuide(card) {
  const willOpen = !card.classList.contains("open");
  // đóng các guide đang mở trước
  document.querySelectorAll("#guideList .guide-card.open").forEach((c) => setOpen(c, false));
  if (willOpen) setOpen(card, true);
}

// ===== Gắn vào app (index.html) =====
function setupGuidesPage() {
  const guideList = document.querySelector("#guideList");
  // bấm vào đầu thẻ thì xổ / thu chi tiết
  guideList.addEventListener("click", (event) => {
    const header = event.target.closest(".guide-header");
    if (header) toggleGuide(header.closest(".guide-card"));
  });
  ["#gf-region", "#gf-lang", "#gf-status"].forEach((id) => document.querySelector(id)?.addEventListener("change", applyGuideFilters));
  // nút thử lại khi tải lỗi
  document.querySelector("#guideRetryBtn").addEventListener("click", () => {
    renderGuidePage();
  });
  // nút "Hướng dẫn viên" trên thanh điều hướng
  const navBtn = document.querySelector("#nav-guides");
  if (navBtn) {
    navBtn.addEventListener("click", () => {
      if (location.hash === ROUTE) {
        navigate("guides");
        return;
      }
      // đổi hash -> sự kiện hashchange sẽ mở trang (nút Back / F5 vẫn đúng)
      location.hash = ROUTE;
    });
  }

  // chỉ xử lý sau khi trang tải xong, vì main.js tự gọi navigate("home") lúc khởi động
  let ready = false;

  // rời trang guides bằng navigate() thì bỏ hash để F5 không bật lại trang này
  const oldNavigate = window.navigate;
  window.navigate = function (page) {
    const result = oldNavigate.apply(this, arguments);
    if (ready && page !== "guides" && location.hash === ROUTE) {
      history.pushState(null, "", location.pathname + location.search);
    }
    return result;
  };

  window.addEventListener("hashchange", () => {
    if (!ready) return;
    if (location.hash === ROUTE) {
      navigate("guides");
    } else if (!location.hash && typeof AppState !== "undefined" && AppState.page === "guides") {
      // bấm nút Back của trình duyệt -> về trang chủ
      navigate("home");
    }
  });

  window.addEventListener("load", () => {
    ready = true;
    if (location.hash === ROUTE) navigate("guides");
  });
}

// main.js gọi GuidesPage.render() khi chuyển sang trang guides
window.GuidesPage = { render: renderGuidePage };

if (document.querySelector("#guideList") && typeof window.navigate === "function") {
  setupGuidesPage();
}
