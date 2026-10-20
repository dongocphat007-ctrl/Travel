/**
 * js/merge-glue.js – keo nối Source A (UI đã freeze) + Source B (P10–P13).
 * Chỉ CẤU HÌNH các module của B cho khớp markup/router/API của A. Không chứa logic nghiệp vụ mới.
 * Nạp SAU favorites.js / a11y.js / seo.js (xem index.html). Chạy đồng bộ lúc parse, trước DOMContentLoaded.
 */
(function () {
  "use strict";

  // 11.x Yêu thích / So sánh: card tour của A là <article class="tour-card" data-tour-id="…"> (js/home.js).
  if (window.TravelFav && TravelFav.config) {
    TravelFav.config.cardSelector = ".tour-card[data-tour-id]";
    TravelFav.config.getTourId = function (card) { return card.getAttribute("data-tour-id"); };
    // Toast của A (đúng giao diện tem/giấy) thay cho toast riêng của B; fallback về toast của B nếu thiếu.
    TravelFav.config.notify = function (msg) { if (typeof window.showToast === "function") window.showToast(msg, "info"); };
  }

  // 12.7 SEO: tiêu đề/mô tả trang chủ theo bản của A (index.html).
  if (window.TravelSEO && TravelSEO.ROUTES && TravelSEO.ROUTES[0] && TravelSEO.ROUTES[0].key === "home") {
    TravelSEO.ROUTES[0].title = "Travel – Tour du lịch Việt Nam và quốc tế";
    TravelSEO.ROUTES[0].desc = "629 hành trình có sẵn từ Bắc vào Nam và ra thế giới: lịch trình rõ ràng, giá minh bạch, hướng dẫn viên địa phương.";
  }
})();
