/**
 * validator.js – Kiểm tra dữ liệu form
 * Phụ thuộc: utils.js
 */

const Validator = (() => {

  // Default parameter (ES6+)
  const showErr = (id, msg = "Dữ liệu không hợp lệ") => {
    const el = $id(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
  };

  const hideErr    = id => $id(id)?.classList.remove("show");
  const setErrCls  = (id, hasErr) => $id(id)?.classList.toggle("err", hasErr);

  // ---- Validate form tạo / sửa chuyến đi ----
  const validateTrip = d => {
    let ok = true;
    ["e-name","e-dest","e-start","e-end","e-budget"].forEach(hideErr);

    // FIX 5: Tên phải chứa ít nhất 1 chữ cái (không chỉ số hoặc ký tự đặc biệt)
    const name = d.name?.trim() || "";
    if (!name) {
      showErr("e-name", "Vui lòng nhập tên chuyến đi");
      setErrCls("f-name", true); ok = false;
    } else if (name.length < 2) {
      showErr("e-name", "Tên chuyến đi ít nhất 2 ký tự");
      setErrCls("f-name", true); ok = false;
    } else if (!/\p{L}/u.test(name)) {
      showErr("e-name", "Tên phải chứa ít nhất một chữ cái — không được chỉ là số hoặc ký tự đặc biệt");
      setErrCls("f-name", true); ok = false;
    } else {
      setErrCls("f-name", false);
    }

    if (!d.destination?.trim()) {
      showErr("e-dest", "Vui lòng nhập điểm đến");
      setErrCls("f-dest", true); ok = false;
    } else {
      setErrCls("f-dest", false);
    }

    // FIX 2: Ngày bắt đầu không được trước hôm nay
    const today = todayStr();
    if (!d.startDate) {
      showErr("e-start", "Vui lòng chọn ngày khởi hành");
      setErrCls("f-start", true); ok = false;
    } else if (d.startDate < today) {
      showErr("e-start", `Ngày khởi hành phải từ ${fmtToday()} trở đi`);
      setErrCls("f-start", true); ok = false;
    } else {
      setErrCls("f-start", false);
    }

    if (!d.endDate) {
      showErr("e-end", "Vui lòng chọn ngày kết thúc");
      setErrCls("f-end", true); ok = false;
    } else if (d.endDate < d.startDate) {
      showErr("e-end", "Ngày kết thúc phải sau ngày khởi hành");
      setErrCls("f-end", true); ok = false;
    } else {
      setErrCls("f-end", false);
    }

    // TASK 1.3: Ngân sách phải là số nguyên không âm, không được là chữ
    const budgetRaw = $id("f-budget")?.value ?? "";
    const hasNonDigit = /[^\d.,\s]/.test(budgetRaw); // phát hiện còn chữ cái
    if (hasNonDigit) {
      showErr("e-budget", "Ngân sách chỉ được nhập số — không nhập chữ hoặc ký tự đặc biệt");
      setErrCls("f-budget", true); ok = false;
    } else if (isNaN(d.budget) || d.budget < 0) {
      showErr("e-budget", "Ngân sách phải là số nguyên không âm (VD: 5.000.000)");
      setErrCls("f-budget", true); ok = false;
    } else if (d.budget > 999_000_000_000) {
      showErr("e-budget", "Ngân sách tối đa 999 tỷ đồng");
      setErrCls("f-budget", true); ok = false;
    } else {
      setErrCls("f-budget", false);
    }

    return ok;
  };

  // ---- Validate form thêm / sửa địa điểm ----
  const validateLoc = d => {
    let ok = true;
    ["le-name","le-planned","le-actual"].forEach(hideErr);

    if (!d.name?.trim()) {
      showErr("le-name", "Vui lòng nhập tên địa điểm");
      setErrCls("lf-name", true); ok = false;
    } else {
      setErrCls("lf-name", false);
    }

    // TASK 1.3: Chi phí phải là số nguyên không âm, không được chứa chữ
    const plannedRaw   = $id("lf-planned")?.value ?? "";
    const actualRaw    = $id("lf-actual")?.value  ?? "";
    const hasNonDigitP = /[^\d.,\s]/.test(plannedRaw);
    const hasNonDigitA = /[^\d.,\s]/.test(actualRaw);

    if (hasNonDigitP) {
      showErr("le-planned", "Chi phí dự kiến chỉ được nhập số — không nhập chữ hoặc ký tự đặc biệt");
      setErrCls("lf-planned", true); ok = false;
    } else if (isNaN(d.plannedCost) || d.plannedCost < 0) {
      showErr("le-planned", "Chi phí dự kiến phải là số không âm (VD: 200.000)");
      setErrCls("lf-planned", true); ok = false;
    } else if (d.plannedCost > 999_000_000_000) {
      showErr("le-planned", "Chi phí dự kiến tối đa 999 tỷ đồng");
      setErrCls("lf-planned", true); ok = false;
    } else {
      setErrCls("lf-planned", false);
    }

    if (hasNonDigitA) {
      showErr("le-actual", "Chi phí thực tế chỉ được nhập số — không nhập chữ hoặc ký tự đặc biệt");
      setErrCls("lf-actual", true); ok = false;
    } else if (isNaN(d.actualCost) || d.actualCost < 0) {
      showErr("le-actual", "Chi phí thực tế phải là số không âm (VD: 200.000)");
      setErrCls("lf-actual", true); ok = false;
    } else if (d.actualCost > 999_000_000_000) {
      showErr("le-actual", "Chi phí thực tế tối đa 999 tỷ đồng");
      setErrCls("lf-actual", true); ok = false;
    } else {
      setErrCls("lf-actual", false);
    }

    return ok;
  };

  // ---- Validate form liên hệ ----
  const validateContact = d => {
    let ok = true;
    ["ce-name","ce-email","ce-phone","ce-msg"].forEach(hideErr);

    if (!d.name?.trim() || d.name.trim().length < 2) {
      showErr("ce-name", "Họ tên ít nhất 2 ký tự");
      setErrCls("cf-name", true); ok = false;
    } else { setErrCls("cf-name", false); }

    // Email – kiểm tra định dạng bằng RegEx
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(d.email?.trim() || "") || !isGmail(d.email)) {
      showErr("ce-email", GMAIL_MSG);
      setErrCls("cf-email", true); ok = false;
    } else { setErrCls("cf-email", false); }

    // Số điện thoại Việt Nam – không bắt buộc nhưng nếu nhập phải đúng
    if (d.phone?.trim() && !isValidVNPhone(d.phone)) {
      showErr("ce-phone", "Số điện thoại không hợp lệ (VD: 0901234567)");
      setErrCls("cf-phone", true); ok = false;
    } else { setErrCls("cf-phone", false); }

    if (!d.message?.trim() || d.message.trim().length < 10) {
      showErr("ce-msg", "Nội dung ít nhất 10 ký tự");
      setErrCls("cf-msg", true); ok = false;
    } else { setErrCls("cf-msg", false); }

    return ok;
  };

  return { validateTrip, validateLoc, validateContact };
})();
