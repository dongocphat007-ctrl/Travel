/**
 * contact-fab.js – Nút liên hệ nhanh nổi: Zalo · Messenger · Gọi điện.
 * Số điện thoại / Zalo / Messenger lấy từ BUSINESS trong js/business-info.js (sửa một chỗ).
 */
(function () {
  const B = window.BUSINESS || {};
  const tel = B.telHref ? B.telHref() : "";
  const zalo = B.zaloHref ? B.zaloHref() : "";
  const mess = B.messengerHref ? B.messengerHref() : "";

  const ICON = {
    zalo: '<span class="cf-zalo-txt">Zalo</span>',
    mess: '<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden="true"><path d="M12 2C6.48 2 2 6.2 2 11.4c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.99.27 2.03.42 3.1.42 5.52 0 10-4.2 10-9.4S17.52 2 12 2zm1.1 12.6-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7z"/></svg>',
    tel: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>'
  };

  function item(cls, label, href, icon, onClick) {
    const a = document.createElement("a");
    a.className = "cf-btn " + cls;
    a.setAttribute("aria-label", label);
    a.innerHTML = icon + '<span class="cf-tip">' + label + "</span>";
    if (href) { a.href = href; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } }
    else { a.href = "#"; a.addEventListener("click", e => { e.preventDefault(); onClick && onClick(); }); }
    return a;
  }

  function build() {
    if (document.getElementById("contact-fab")) return;
    const box = document.createElement("div");
    box.id = "contact-fab";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Liên hệ nhanh");
    const missing = name => () => (typeof showToast === "function")
      ? showToast(name + " đang được cập nhật, vui lòng gọi hotline " + (B.hotline || ""), "info") : null;
    // Một nút "Liên hệ" mở danh sách Zalo · Messenger · Gọi điện (thay cho 3 nút tròn luôn hiện)
    const list = document.createElement("div");
    list.className = "cf-list";
    list.appendChild(item("cf-zalo", "Chat Zalo", zalo, ICON.zalo, missing("Zalo")));
    list.appendChild(item("cf-mess", "Chat Messenger", mess, ICON.mess, missing("Messenger")));
    list.appendChild(item("cf-tel", "Gọi " + (B.hotline || "hotline"), tel || "", ICON.tel, missing("Hotline")));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cf-toggle";
    toggle.textContent = "Liên hệ";
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const open = box.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && box.classList.contains("open")) { box.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); } });
    document.addEventListener("click", e => { if (!box.contains(e.target) && box.classList.contains("open")) { box.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); } });
    box.appendChild(list);
    box.appendChild(toggle);
    document.body.appendChild(box);
  }

  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
