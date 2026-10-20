/**
 * utils.js – Tiện ích dùng chung (ES6+)
 * Phụ thuộc: không có
 */

const Utils = (() => {

  // Default parameter (ES6+)
  const fmt = (n = 0) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

  const fmtDate = (s = "") => {
    if (!s) return "";
    const [y, m, d] = s.split("-"); // Destructuring (ES6+)
    return `${d}/${m}/${y}`;
  };

  const fmtRange = (s, e) => `${fmtDate(s)} – ${fmtDate(e)}`;

  const dayCount = (s, e) =>
    Math.max(1, Math.round((new Date(e) - new Date(s)) / 864e5) + 1);

  // Default parameter (ES6+)
  const uid = (prefix = "id") =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Rest parameter (ES6+)
  const cx = (...classes) => classes.filter(Boolean).join(" ");

  // Escape HTML – phòng XSS
  const esc = (str = "") =>
    String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const $id = id => document.getElementById(id);

  // FIX 2: Lấy ngày hôm nay dạng YYYY-MM-DD
  const todayStr = () => new Date().toISOString().split("T")[0];

  // FIX 2: Ngày hôm nay dạng dd/mm/yyyy để hiển thị
  const fmtToday = () => {
    const [y, m, d] = todayStr().split("-");
    return `${d}/${m}/${y}`;
  };

  // FIX 4: Lấy số nguyên từ ô input đã format (có dấu chấm phân cách)
  const rawNum = id => {
    const el  = document.getElementById(id);
    const val = (el?.value || "").replace(/[^\d]/g, "");
    return val ? parseInt(val, 10) : 0;
  };

  return { fmt, fmtDate, fmtRange, dayCount, uid, cx, esc, $id, todayStr, fmtToday, rawNum };
})();

// Destructuring export (ES6+)
const { fmt, fmtDate, fmtRange, dayCount, uid, cx, esc, $id, todayStr, fmtToday, rawNum } = Utils;

/**
 * TASK 1.3: Number Input Formatter – nâng cấp
 * (1) Chỉ cho nhập số dương
 * (2) Chặn ký tự chữ ngay tại keydown + paste
 * (3) Format dấu chấm phân cách hàng nghìn realtime
 * (4) Visual feedback: border đỏ nếu còn ký tự lạ
 */

// Danh sách các phím điều hướng/chỉnh sửa được phép bấm
const ALLOWED_KEYS = new Set([
  "Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown",
  "Home","End","Tab","Enter"
]);

function setupNumInput(id, opts = {}) {
  const el = $id(id);
  if (!el) return;

  // Giá trị tối đa mặc định: 999 tỷ (hợp lý cho ngân sách VNĐ)
  const MAX_VAL = opts.max ?? 999_000_000_000;
  // Tên trường để hiển thị lỗi realtime (optional)
  const errId   = opts.errId ?? null;

  // ---- Hàm nội bộ ----
  const onlyDigits = str => str.replace(/[^\d]/g, "");

  const formatVal = raw => {
    if (!raw) return "";
    const n = parseInt(raw, 10);
    if (isNaN(n)) return "";
    // Giới hạn max
    const clamped = Math.min(n, MAX_VAL);
    return clamped.toLocaleString("vi-VN");
  };

  const clearInlineErr = () => {
    el.classList.remove("err");
    if (errId) {
      const errEl = $id(errId);
      if (errEl) errEl.classList.remove("show");
    }
  };

  // ---- (1) keydown: chặn phím ký tự / dấu ngay khi gõ ----
  el.addEventListener("keydown", e => {
    // Cho phép: phím điều hướng, Ctrl/Cmd combo (copy-paste)
    if (ALLOWED_KEYS.has(e.key))          return;
    if (e.ctrlKey || e.metaKey)           return;
    // Chỉ cho: chữ số 0–9 (key là ký tự đơn số)
    if (/^\d$/.test(e.key))               return;
    // Chặn tất cả còn lại (chữ cái, dấu, ký hiệu, +, -, .)
    e.preventDefault();
  });

  // ---- (2) paste: lọc, chỉ giữ chữ số ----
  el.addEventListener("paste", e => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    const digits = onlyDigits(pasted);
    if (!digits) return;
    // Ghép vào vị trí con trỏ
    const start  = el.selectionStart;
    const end    = el.selectionEnd;
    const cur    = onlyDigits(el.value);
    const before = onlyDigits(el.value.slice(0, start).replace(/\./g, ""));
    const after  = onlyDigits(el.value.slice(end).replace(/\./g, ""));
    el.value     = formatVal(before + digits + after);
    clearInlineErr();
  });

  // ---- (3) input: lọc + format realtime ----
  el.addEventListener("input", e => {
    const raw     = onlyDigits(e.target.value);
    e.target.value = formatVal(raw);
    clearInlineErr();
  });

  // ---- focus: bỏ format để dễ sửa, bôi đen toàn bộ, tạm ẩn .valid ----
  el.addEventListener("focus", e => {
    const raw      = onlyDigits(e.target.value);
    e.target.value = raw;
    el.classList.remove("valid"); // ẩn viền xanh khi đang sửa
    clearInlineErr();
    setTimeout(() => e.target.select(), 0);
  });

  // ---- blur: format lại, validate inline, thêm .valid nếu có giá trị ----
  el.addEventListener("blur", e => {
    const raw = onlyDigits(e.target.value);
    e.target.value = formatVal(raw);
    if (raw) {
      clearInlineErr();
      el.classList.add("valid");
    } else {
      el.classList.remove("valid");
    }
  });
}

// Toast notification
function showToast(msg, type = "info", duration = 3200) {
  const container = $id("toasts");
  const toast     = document.createElement("div");
  toast.className = `toast t-${type}`;
  toast.innerHTML = `${type === "success" ? "✓" : type === "error" ? "✕" : type === "warn" ? "⚠" : "ℹ"} ${esc(msg)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.cssText = "opacity:0;transition:opacity .3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
