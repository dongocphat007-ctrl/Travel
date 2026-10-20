/**
 * brand-migrate.js – Đổi tên dự án thành "Travel" (trước đây: TripCraft / Travel VN / TravelVN)
 *
 * Chạy 1 lần duy nhất, TRƯỚC mọi script khác, để dữ liệu người dùng đã lưu không bị mất:
 *   1) Đổi tên key localStorage / sessionStorage:  tripcraft_*  và  travel_vn_*  →  travel_*
 *      (kể cả key theo từng user như tripcraft_v2__<userId>)
 *   2) Sửa chữ cũ nằm BÊN TRONG dữ liệu đã lưu (email admin/demo, tên hiển thị, lịch sử chat…)
 *   3) Không ghi đè nếu key mới đã có dữ liệu; key cũ luôn được xóa sau khi chuyển.
 */
(function () {
  "use strict";
  var DONE_FLAG = "travel_brand_migrated_v1";

  var KEY_RULES = [
    ["tripcraft_", "travel_"],
    ["travel_vn_", "travel_"]
  ];

  // Thứ tự quan trọng: email trước, tên chung sau
  var TEXT_RULES = [
    ["admin@travelvn.com", "admin@travel.com"],
    ["hello@travelvn.vn",  "hello@travel.vn"],
    ["demo@tripcraft.vn",  "demo@travel.vn"],
    ["TRAVEL_VN", "TRAVEL"], ["Travel_VN", "Travel"],
    ["TRAVEL VN", "TRAVEL"], ["Travel VN", "Travel"],
    ["TravelVN",  "Travel"], ["TRIPCRAFT", "TRAVEL"], ["TripCraft", "Travel"]
  ];

  function newKeyName(k) {
    for (var i = 0; i < KEY_RULES.length; i++) {
      var r = KEY_RULES[i];
      if (k.indexOf(r[0]) === 0) return r[1] + k.slice(r[0].length);
    }
    return null;
  }

  function fixText(s) {
    var out = s;
    for (var i = 0; i < TEXT_RULES.length; i++) {
      if (out.indexOf(TEXT_RULES[i][0]) !== -1) out = out.split(TEXT_RULES[i][0]).join(TEXT_RULES[i][1]);
    }
    return out;
  }

  function migrate(store, rewriteContent) {
    var keys = [], i;
    for (i = 0; i < store.length; i++) keys.push(store.key(i));

    // (1) đổi tên key
    keys.forEach(function (k) {
      var nk = newKeyName(k);
      if (!nk) return;
      try {
        var v = store.getItem(k);
        if (store.getItem(nk) === null && v !== null) store.setItem(nk, v);
        store.removeItem(k);
      } catch (e) { /* quota đầy… bỏ qua key này */ }
    });

    // (2) sửa nội dung bên trong các key travel_*
    if (!rewriteContent) return;
    var all = [];
    for (i = 0; i < store.length; i++) all.push(store.key(i));
    all.forEach(function (k) {
      if (k.indexOf("travel_") !== 0 || k === DONE_FLAG) return;
      try {
        var v = store.getItem(k);
        if (typeof v !== "string") return;
        var nv = fixText(v);
        if (nv !== v) store.setItem(k, nv);
      } catch (e) {}
    });
  }

  try {
    if (localStorage.getItem(DONE_FLAG)) return;
    migrate(localStorage, true);
    try { migrate(sessionStorage, false); } catch (e) {}
    localStorage.setItem(DONE_FLAG, "1");
  } catch (e) { /* storage bị chặn → bỏ qua, app vẫn chạy */ }
})();
