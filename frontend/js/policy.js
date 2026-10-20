/**
 * policy.js — Trang "Chính sách & Liên hệ": Điều khoản · Hủy & hoàn cọc · Bảo mật · Liên hệ & pháp lý.
 * Nội dung lấy số liệu từ BUSINESS (business-info.js) và DEPOSIT_PCT (constants.js).
 * Mở bằng navigate("policy", { tab: "terms" | "refund" | "privacy" | "contact" }) hoặc thẻ có data-policy="<tab>".
 */
const PolicyPage = (() => {
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const val = v => v ? esc(v) : `<span class="pol-missing">Đang cập nhật</span>`;
  const B = () => window.BUSINESS;
  const pct = () => (typeof DEPOSIT_PCT !== "undefined" ? DEPOSIT_PCT : 20);

  const TABS = [
    { id: "terms",   icon: "📜", label: "Điều khoản" },
    { id: "refund",  icon: "↩️", label: "Hủy & hoàn cọc" },
    { id: "privacy", icon: "🔒", label: "Bảo mật" },
    { id: "contact", icon: "☎️", label: "Liên hệ & pháp lý" },
  ];

  function tierRows() {
    const tiers = B().cancelTiers;
    return tiers.map((t, i) => {
      const prev = tiers[i - 1];
      const range = !prev ? `Từ ${t.minDays} ngày trở lên trước ngày khởi hành`
        : t.minDays === 0 ? `Dưới ${prev.minDays} ngày trước ngày khởi hành (hoặc đã khởi hành)`
        : `Từ ${t.minDays} đến ${prev.minDays - 1} ngày trước ngày khởi hành`;
      const cls = t.refundPct === 100 ? "ok" : t.refundPct === 0 ? "no" : "mid";
      return `<tr><td>${range}</td><td><span class="pol-pill pol-pill--${cls}">Hoàn ${t.refundPct}% tiền cọc</span></td></tr>`;
    }).join("");
  }

  function demoBanner() {
    return B().demoMode ? `<div class="pol-demo">🎓 <b>Website demo / dự án học tập.</b> ${esc(B().demoNotice)}</div>` : "";
  }

  function paymentAccount() {
    if (B().demoMode) return `<div class="pol-callout"><b>Thanh toán:</b> chức năng QR chuyển khoản chỉ để minh họa quy trình đặt cọc ${pct()}%. Website <b>không nhận tiền thật</b>; vui lòng không chuyển khoản.</div>`;
    const c = window.Payment?.config;
    if (!c || !c.account) return "";
    return `<div class="pol-callout"><b>Tài khoản nhận tiền chính thức:</b> ${esc(c.bank)} · STK <b>${esc(c.account)}</b> · Chủ TK <b>${esc(c.accountName)}</b>.<br>
      Mọi khoản chuyển khoản phải kèm đúng <b>mã thanh toán</b> do hệ thống tạo (dạng <code>${esc(c.prefix)}…</code>). ${esc(B().brand)} <b>không</b> yêu cầu chuyển tiền vào tài khoản cá nhân khác qua tin nhắn hay cuộc gọi — nếu nhận được yêu cầu như vậy, hãy gọi hotline để xác minh.</div>`;
  }

  const panels = {
    terms: () => `
      <h2>Điều khoản sử dụng & đặt tour</h2>
      <p class="pol-meta">Cập nhật lần cuối: ${esc(B().policyUpdated)}</p>
      <h3>1. Phạm vi dịch vụ</h3>
      <p>${esc(B().brand)} là website giúp bạn lập kế hoạch chuyến đi và đăng ký các tour mẫu (có hướng dẫn viên hoặc tự túc). Khi bạn gửi đăng ký, ${esc(B().brand)} sẽ liên hệ xác nhận chỗ, giá và lịch trình cuối cùng qua số điện thoại/email bạn cung cấp.</p>
      <h3>2. Giá và thanh toán</h3>
      <ul>
        <li>Giá hiển thị bằng VNĐ, tính theo số người và dịch vụ bạn chọn (kể cả phí hướng dẫn viên nếu có).</li>
        <li>Để giữ chỗ, bạn <b>đặt cọc ${pct()}%</b> tổng giá trị đơn, hoặc có thể thanh toán toàn bộ ngay.</li>
        <li>Nếu đặt cọc, <b>${100 - pct()}% còn lại</b> được chuyển sau khi tour kết thúc, cộng phụ thu hướng dẫn viên làm thêm giờ (nếu có và đã được báo số tiền cụ thể).</li>
        <li>Thanh toán bằng chuyển khoản ngân hàng (VietQR). Đơn chỉ được xác nhận sau khi ${esc(B().brand)} đối chiếu thấy tiền về tài khoản.</li>
      </ul>
      ${paymentAccount()}
      <h3>3. Xác nhận đơn</h3>
      <p>Đơn ở trạng thái <b>Chờ xác nhận</b> cho đến khi ${esc(B().brand)} nhận được tiền cọc và xác nhận lại. Trường hợp hết chỗ hoặc không thể phục vụ, ${esc(B().brand)} sẽ báo ngay và hoàn lại 100% số tiền đã nhận.</p>
      <h3>4. Thay đổi lịch trình</h3>
      <p>Lịch trình có thể điều chỉnh do thời tiết, thiên tai, giao thông hoặc quyết định của cơ quan chức năng, nhằm bảo đảm an toàn và chất lượng tương đương. ${esc(B().brand)} sẽ thông báo sớm nhất có thể.</p>
      <h3>5. Trách nhiệm của khách hàng</h3>
      <ul>
        <li>Cung cấp thông tin chính xác (họ tên theo giấy tờ, số điện thoại, email); tự chuẩn bị giấy tờ tùy thân, visa, hộ chiếu khi đi tour quốc tế.</li>
        <li>Tuân thủ hướng dẫn của hướng dẫn viên và quy định tại điểm tham quan; tự chịu trách nhiệm với tư trang cá nhân.</li>
      </ul>
      <h3>6. Thông tin chuyến bay, khách sạn mang tính tham khảo</h3>
      <p>Mục "Chuyến bay & Khách sạn" hiển thị dữ liệu <b>minh họa</b> hoặc dữ liệu công khai (OpenStreetMap), <b>không phải</b> giá và chỗ trống thực tế. Hãy kiểm tra giá thật tại trang đặt vé/đặt phòng mà website dẫn tới. ${esc(B().brand)} không bán vé máy bay hay phòng khách sạn trực tiếp qua mục này.</p>
      <h3>7. Giải quyết khiếu nại</h3>
      <p>Mọi phản ánh vui lòng gửi qua hotline hoặc email ở mục <a href="#" data-policy="contact">Liên hệ & pháp lý</a>. ${esc(B().brand)} phản hồi trong vòng 3 ngày làm việc. Nếu không thỏa thuận được, tranh chấp được giải quyết theo pháp luật Việt Nam.</p>`,

    refund: () => `
      <h2>Chính sách hủy tour & hoàn tiền cọc ${pct()}%</h2>
      <p class="pol-meta">Cập nhật lần cuối: ${esc(B().policyUpdated)}</p>
      <div class="pol-callout"><b>Tóm tắt:</b> bạn đặt cọc <b>${pct()}%</b> để giữ chỗ. Hủy càng sớm, tiền cọc được hoàn càng nhiều. Nếu <b>${esc(B().brand)}</b> hủy tour, bạn được hoàn <b>100%</b>.</div>
      <h3>1. Khách tự hủy tour</h3>
      <p>Thời hạn tính từ lúc ${esc(B().brand)} nhận được yêu cầu hủy của bạn (qua hotline, Zalo hoặc email) đến ngày khởi hành:</p>
      <div class="pol-table-wrap"><table class="pol-table"><thead><tr><th>Thời điểm báo hủy</th><th>Hoàn lại</th></tr></thead><tbody>${tierRows()}</tbody></table></div>
      <h3>2. ${esc(B().brand)} hủy hoặc không thể thực hiện tour</h3>
      <ul>
        <li>Không đủ số lượng khách tối thiểu, hết chỗ, hoặc ${esc(B().brand)} không thể phục vụ: <b>hoàn 100%</b> số tiền đã nhận hoặc đổi sang tour/ngày khởi hành khác theo lựa chọn của bạn.</li>
        <li>Bất khả kháng (thiên tai, dịch bệnh, lệnh của cơ quan chức năng, đóng cửa điểm đến…): ${esc(B().brand)} ưu tiên dời ngày hoặc đổi tour không mất phí; nếu bạn không muốn đổi, hoàn lại số tiền đã nhận sau khi trừ các chi phí đã chi trả cho bên thứ ba không thể hoàn (nếu có) kèm chứng từ.</li>
      </ul>
      <h3>3. Đổi ngày / đổi tour</h3>
      <p>Báo trước ít nhất ${B().cancelTiers[0].minDays} ngày để được đổi miễn phí (tùy chỗ trống). Sau thời hạn này, việc đổi được xử lý như hủy theo bảng trên.</p>
      <h3>4. Cách thức hoàn tiền</h3>
      <ul>
        <li>Hoàn bằng chuyển khoản về <b>chính tài khoản</b> đã chuyển cọc, trong <b>${B().refundWorkingDays} ngày làm việc</b> kể từ khi yêu cầu được duyệt.</li>
        <li>Phần đã thanh toán thêm ngoài tiền cọc (nếu bạn trả toàn bộ hoặc trả nốt) được xử lý theo cùng bảng tỷ lệ trên.</li>
      </ul>
      <h3>5. Cách gửi yêu cầu hủy</h3>
      <p>Gọi hotline <b>${esc(B().hotline)}</b>${B().zalo ? `, nhắn Zalo <b>${esc(B().zalo)}</b>` : ""} hoặc email <b>${esc(B().email)}</b>, kèm mã đơn (dạng <code>${esc(window.Payment?.config?.prefix || "TRAVEL")}…</code>) và họ tên người đặt.</p>`,

    privacy: () => `
      <h2>Chính sách bảo mật thông tin</h2>
      <p class="pol-meta">Cập nhật lần cuối: ${esc(B().policyUpdated)}</p>
      <p>Chính sách này giải thích ${esc(B().brand)} thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn như thế nào, phù hợp Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</p>
      <h3>1. Dữ liệu chúng tôi thu thập</h3>
      <ul>
        <li><b>Tài khoản:</b> họ tên, email, ảnh đại diện (khi đăng nhập bằng Google).</li>
        <li><b>Đăng ký tour:</b> họ tên, số điện thoại, email, số người, ngày đi, ghi chú.</li>
        <li><b>Thanh toán:</b> chỉ ghi nhận số tiền, mã thanh toán và thời điểm báo chuyển khoản. ${esc(B().brand)} <b>không</b> thu thập hay lưu số thẻ, mật khẩu ngân hàng, mã OTP ngân hàng.</li>
        <li><b>Nội dung bạn nhập:</b> chuyến đi, lịch trình, ngân sách, tin nhắn chatbot.</li>
      </ul>
      <h3>2. Mục đích sử dụng</h3>
      <p>Để xác nhận và thực hiện đơn đặt tour, liên hệ hỗ trợ, đối soát thanh toán, xử lý hủy/hoàn tiền, xác thực đăng nhập và cải thiện dịch vụ. Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba.</p>
      <h3>3. Nơi lưu trữ và bên xử lý</h3>
      <ul>
        <li>Dữ liệu chuyến đi và tài khoản được lưu trong bộ nhớ trình duyệt của bạn (localStorage) trên thiết bị đang dùng; xóa dữ liệu trình duyệt sẽ làm mất các dữ liệu này.</li>
        <li><b>Google:</b> đăng nhập bằng Google, và câu hỏi bạn gửi cho chatbot được gửi tới Google Gemini để tạo câu trả lời. Đừng nhập thông tin nhạy cảm (số CCCD, thẻ, mật khẩu) vào chatbot.</li>
        <li><b>Dịch vụ email của hệ thống:</b> gửi mã OTP xác thực (qua máy chủ).</li>
        <li><b>OpenStreetMap:</b> tra cứu khách sạn theo địa điểm bạn nhập.</li>
      </ul>
      <h3>4. Quyền của bạn</h3>
      <p>Bạn có quyền yêu cầu xem, chỉnh sửa, xóa dữ liệu cá nhân, rút lại sự đồng ý hoặc phản đối việc xử lý. Gửi yêu cầu tới <b>${esc(B().email)}</b>; chúng tôi phản hồi trong vòng 72 giờ làm việc.</p>
      <h3>5. Bảo mật</h3>
      <p>Chúng tôi chỉ cho phép người có thẩm quyền (quản trị viên) xem thông tin đơn đặt tour để xử lý, và dùng kết nối HTTPS khi truyền dữ liệu tới các dịch vụ bên thứ ba. Không có hệ thống nào an toàn tuyệt đối; nếu phát hiện sự cố liên quan đến dữ liệu của bạn, chúng tôi sẽ thông báo theo quy định.</p>
      <h3>6. Liên hệ về dữ liệu cá nhân</h3>
      <p>${esc(B().email)} · Hotline ${esc(B().hotline)}.</p>`,

    contact: () => {
      const b = B();
      const row = (icon, k, v) => `<div class="pol-info-row"><span class="pol-info-ico">${icon}</span><div><div class="pol-info-k">${k}</div><div class="pol-info-v">${v}</div></div></div>`;
      return `
      <h2>Liên hệ & thông tin pháp lý</h2>
      <p class="pol-meta">Cập nhật lần cuối: ${esc(b.policyUpdated)}</p>
      <div class="pol-cta">
        <a class="pol-cta-btn pol-cta-btn--call" href="${esc(b.telHref())}">📞 Gọi hotline ${esc(b.hotline)}</a>
        ${b.zaloHref() ? `<a class="pol-cta-btn pol-cta-btn--zalo" href="${esc(b.zaloHref())}" target="_blank" rel="noopener">💬 Chat Zalo ${esc(b.zalo)}</a>` : ""}
        <a class="pol-cta-btn pol-cta-btn--mail" href="mailto:${esc(b.email)}">✉️ ${esc(b.email)}</a>
      </div>
      <div class="pol-grid">
        <div class="pol-box"><h3>Liên hệ</h3>
          ${row("📞", "Hotline", `<a href="${esc(b.telHref())}">${esc(b.hotline)}</a>${b.demoMode ? " <small>(số minh họa)</small>" : ""}`)}
          ${row("💬", "Zalo", b.zalo ? `<a href="${esc(b.zaloHref())}" target="_blank" rel="noopener">${esc(b.zalo)}</a>` : val(""))}
          ${row("✉️", "Email", `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`)}
          ${row("📍", "Địa chỉ", val(b.address))}
          ${row("⏰", "Giờ làm việc", val(b.workingHours))}
        </div>
        <div class="pol-box"><h3>Thông tin pháp lý</h3>
          ${b.demoMode ? `
          ${row("🎓", "Tính chất", "Dự án học tập / đồ án, phi thương mại")}
          ${row("🧾", "Đăng ký kinh doanh", "Không có — website không bán tour, không thu tiền")}
          ${row("📌", "Khi vận hành thật", "Sẽ công bố tên đơn vị, mã số thuế, ĐKKD và giấy phép lữ hành tại đây")}` : `
          ${row("🏢", "Tên đơn vị", val(b.legalName))}
          ${row("👤", "Người đại diện", val(b.representative))}
          ${row("🧾", "Mã số thuế", val(b.taxCode))}
          ${row("📄", "ĐKKD / Hộ kinh doanh", val(b.businessLicense))}
          ${row("🧳", "Giấy phép lữ hành", val(b.travelLicense))}
          ${b.mocTradeNotice ? row("✅", "Đã thông báo Bộ Công Thương", esc(b.mocTradeNotice)) : ""}`}
        </div>
      </div>
      ${paymentAccount()}
      <h3>Cam kết</h3>
      <ul>
        ${b.demoMode ? "" : "<li>Chỉ nhận tiền qua tài khoản chính thức nêu trên, có mã thanh toán đi kèm từng đơn.</li>"}
        <li>${b.demoMode ? "Khi vận hành thật, hoàn" : "Hoàn"} cọc theo <a href="#" data-policy="refund">chính sách hủy & hoàn cọc</a> đã công bố.</li>
        <li>Phản hồi khiếu nại trong 3 ngày làm việc.</li>
      </ul>`;
    },
  };

  let current = "terms";
  function render(tab) {
    if (!panels[tab]) tab = "terms";
    current = tab;
    const root = document.getElementById("page-policy");
    if (!root) return;
    root.innerHTML = `
      <div class="page-header"><div>
        <h1 class="page-title">🛡️ Chính sách & Liên hệ</h1>
        <p class="page-sub">Điều khoản, chính sách hủy – hoàn cọc, bảo mật và thông tin đơn vị — đọc trước khi chuyển tiền</p>
      </div></div>
      <div class="pol-tabs" role="tablist">${TABS.map(t => `<button class="pol-tab ${t.id === tab ? "active" : ""}" role="tab" aria-selected="${t.id === tab}" data-policy="${t.id}">${t.icon} ${t.label}</button>`).join("")}</div>
      <article class="card card-body pol-body">${demoBanner()}${panels[tab]()}</article>`;
  }

  function open(tab) { if (typeof navigate === "function") navigate("policy", { tab }); else render(tab); }

  // Điền liên hệ ở footer từ BUSINESS
  function fillFooter() {
    const ul = document.getElementById("sf-contact-list");
    if (!ul) return;
    const b = B();
    ul.innerHTML = `
      <li><span>📞</span> <a href="${esc(b.telHref())}">${esc(b.hotline)}</a></li>
      ${b.zalo ? `<li><span>💬</span> <a href="${esc(b.zaloHref())}" target="_blank" rel="noopener">Zalo ${esc(b.zalo)}</a></li>` : ""}
      <li><span>📧</span> <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>
      <li><span>🏠</span> ${esc(b.address)}</li>
      <li><span>⏰</span> ${esc(b.workingHours)}</li>
      ${b.demoMode ? `<li><span>🎓</span> Website demo — không nhận thanh toán thật</li>` : ""}`;
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-policy]");
    if (!el) return;
    e.preventDefault();
    open(el.dataset.policy);
  });
  document.addEventListener("DOMContentLoaded", fillFooter);
  if (document.readyState !== "loading") fillFooter();

  return { render, open, TABS };
})();
window.PolicyPage = PolicyPage;
