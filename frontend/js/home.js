// DỮ LIỆU TOUR + UNESCO (Travel) – đọc từ các file JSON trong thư mục data/
//   data/tours-detail.json        → 20 tour chi tiết đầu tiên (nay thuộc nhóm "Tour mẫu", không còn nhóm riêng "Tour hàng đầu")
//   data/tours/mien-bac|mien-trung|mien-nam.json → 504 "Tour mẫu" trong nước, tách theo vùng (mỗi tour có ord = thứ tự gốc)
//   data/tours/quoc-te.json       → 100 "Tour quốc tế"
// Trang chủ nạp 20 tour chi tiết + UNESCO trước để hiện ngay, các vùng nạp theo nhu cầu (chọn vùng) hoặc khi trình duyệt rảnh.
//   data/unesco.json              → di sản UNESCO
var TOUR_SAMPLES = [];   // gộp cả ba nhóm, mỗi tour có thêm trường src: "sample" | "intl"
var UNESCO_SITES = [];
var _homeDataPromise = null;

var SRC_LABEL = { sample: "Tour mẫu", intl: "Tour quốc tế" };
var PAGE_SIZE = 12;        // số tour mỗi trang (phân trang)
var sortMode = "default", guideMode = "all", srcMode = "all", curPage = 1;
var regionMode = "all", provMode = "all";   // lọc vùng -> tỉnh (áp dụng cho mọi nhóm tour)
var advBudget = "all", advDays = "all", advCat = "all", advDest = "";   // bộ lọc nâng cao

// 63 tỉnh/thành chia theo 3 vùng (khớp với trường region trong data/tours/*.json)
var REGION_PROVINCES = {
  "Miền Bắc":  ["Hà Nội","Hải Phòng","Quảng Ninh","Bắc Ninh","Bắc Giang","Hải Dương","Hưng Yên","Hà Nam","Nam Định","Thái Bình","Ninh Bình","Vĩnh Phúc","Phú Thọ","Thái Nguyên","Bắc Kạn","Cao Bằng","Lạng Sơn","Hà Giang","Tuyên Quang","Lào Cai","Yên Bái","Lai Châu","Điện Biên","Sơn La","Hòa Bình"],
  "Miền Trung":["Thanh Hóa","Nghệ An","Hà Tĩnh","Quảng Bình","Quảng Trị","Thừa Thiên Huế","Đà Nẵng","Quảng Nam","Quảng Ngãi","Bình Định","Phú Yên","Khánh Hòa","Ninh Thuận","Kon Tum","Gia Lai","Đắk Lắk","Đắk Nông","Lâm Đồng"],
  "Miền Nam":  ["TP. Hồ Chí Minh","Bà Rịa – Vũng Tàu","Bình Dương","Bình Phước","Đồng Nai","Tây Ninh","Bình Thuận","Long An","Tiền Giang","Bến Tre","Vĩnh Long","Trà Vinh","Đồng Tháp","An Giang","Kiên Giang","Cần Thơ","Hậu Giang","Sóc Trăng","Bạc Liêu","Cà Mau"]
};

// Từ khóa địa danh trong điểm đến -> tỉnh
var PROVINCE_KEYWORDS = {
  "Hà Nội":["hà nội","hà tây"], "Hải Phòng":["hải phòng","cát bà"], "Quảng Ninh":["quảng ninh","hạ long","cô tô","yên tử","uông bí"],
  "Bắc Ninh":["bắc ninh"], "Bắc Giang":["bắc giang"], "Hà Nam":["hà nam"], "Nam Định":["nam định"], "Thái Bình":["thái bình"],
  "Ninh Bình":["ninh bình","tam cốc","cúc phương"], "Vĩnh Phúc":["vĩnh phúc","tam đảo"], "Phú Thọ":["đền hùng","phú thọ"],
  "Bắc Kạn":["hồ ba bể","bắc kạn"], "Cao Bằng":["cao bằng"], "Lạng Sơn":["lạng sơn"], "Hà Giang":["hà giang"],
  "Lào Cai":["lào cai","sapa","sa pa","bắc hà","y tý"], "Yên Bái":["yên bái","mù cang chải"], "Lai Châu":["lai châu"],
  "Điện Biên":["điện biên"], "Sơn La":["sơn la","mộc châu","tà xùa"], "Hòa Bình":["hòa bình","mai châu"],
  "Thanh Hóa":["thanh hóa","sầm sơn","pù luông"], "Nghệ An":["nghệ an","cửa lò"], "Hà Tĩnh":["hà tĩnh"],
  "Quảng Bình":["quảng bình","phong nha"], "Quảng Trị":["quảng trị"], "Thừa Thiên Huế":["huế","bạch mã"],
  "Đà Nẵng":["đà nẵng","xuyên việt"], "Quảng Nam":["quảng nam","xuyên việt","hội an","cù lao chàm","mỹ sơn"], "Quảng Ngãi":["quảng ngãi","lý sơn"],
  "Bình Định":["bình định","quy nhơn"], "Phú Yên":["phú yên"], "Khánh Hòa":["khánh hòa","khánh hoà","nha trang","bình ba","vạn ninh"],
  "Ninh Thuận":["ninh thuận"], "Kon Tum":["kon tum"], "Gia Lai":["gia lai","pleiku"], "Đắk Lắk":["đắk lắk","buôn ma thuột"],
  "Đắk Nông":["đắk nông"], "Lâm Đồng":["lâm đồng","đà lạt","bảo lộc"],
  "TP. Hồ Chí Minh":["tp.hcm","tp. hồ chí minh","củ chi","cần giờ","quận 5"], "Bà Rịa – Vũng Tàu":["vũng tàu","bà rịa","côn đảo","hồ tràm","bình châu"],
  "Bình Phước":["bình phước"], "Đồng Nai":["đồng nai","cát tiên"], "Tây Ninh":["tây ninh"], "Bình Thuận":["bình thuận","mũi né","phan thiết"],
  "Long An":["long an"], "Tiền Giang":["tiền giang","mỹ tho"], "Bến Tre":["bến tre"], "Vĩnh Long":["vĩnh long"], "Trà Vinh":["trà vinh"],
  "Đồng Tháp":["đồng tháp"], "An Giang":["an giang","châu đốc"], "Kiên Giang":["kiên giang","hà tiên","phú quốc"], "Cần Thơ":["cần thơ"],
  "Sóc Trăng":["sóc trăng"], "Bạc Liêu":["bạc liêu"], "Cà Mau":["cà mau"]
};

// Các tỉnh mà 1 tour đi qua (tour nhiều điểm đến thuộc nhiều tỉnh); chỉ tính tỉnh nằm trong vùng của tour
function provincesOf(t) {
  if (t._prov) return t._prov;
  var dest = (t.dest || t.name || "").toLowerCase();
  var list = REGION_PROVINCES[t.region] || [];
  t._prov = list.filter(function(p){
    return (PROVINCE_KEYWORDS[p] || []).some(function(k){ return dest.indexOf(k) >= 0; });
  });
  return t._prov;
}

// Tour: lấy từ server (/api/tours?group=…); không có server (mở bằng máy chủ tĩnh) thì đọc file JSON như cũ
function loadTours(group, fileUrl) {
  return fetch("/api/tours?group=" + group, { credentials: "same-origin" }).then(function(r){
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  }).then(function(d){
    if (!d || !Array.isArray(d.tours)) throw new Error("API không trả danh sách tour");
    return d;
  }).catch(function(){ return loadJson(fileUrl); });
}

function loadJson(url) {
  return fetch(url, { cache: "no-cache" }).then(function(r){
    if (!r.ok) throw new Error(url + " → HTTP " + r.status);
    return r.json();
  });
}

// Tour do Admin tạo (id "tour_...", lưu ở localStorage "travel_tours_v1") → gộp vào danh sách trang chủ.
// Gọi lại mỗi lần vẽ danh sách nên thêm / sửa / ẩn / xóa trong Admin có hiệu lực ngay.
function syncAdminTours() {
  var raw = "";
  try { raw = localStorage.getItem("travel_tours_v1") || ""; } catch (e) {}
  if (syncAdminTours._raw === raw) return;          // không đổi → bỏ qua
  syncAdminTours._raw = raw;
  var admin = [];
  try { admin = JSON.parse(raw || "[]") || []; } catch (e) {}
  // Tìm vùng theo điểm đến (dùng bảng tỉnh/vùng sẵn có)
  var regionOf = function(dest) {
    var d = String(dest || "").toLowerCase();
    var regions = Object.keys(REGION_PROVINCES);
    for (var i = 0; i < regions.length; i++) {
      var ps = REGION_PROVINCES[regions[i]];
      for (var j = 0; j < ps.length; j++) {
        if ((PROVINCE_KEYWORDS[ps[j]] || []).some(function(k){ return d.indexOf(k) >= 0; })) return regions[i];
      }
    }
    return "";
  };
  var RC = { "Miền Bắc": "north", "Miền Trung": "central", "Miền Nam": "south", "Quốc tế": "intl" };
  var extras = admin.filter(function(t){ return String(t.id).indexOf("tour_") === 0 && t.active !== false; })
    .map(function(t){
      var intl = !!t.international;
      var region = intl ? "Quốc tế" : (t.region || regionOf(t.destination) || "Miền Nam");
      return {
        _admin: true, src: intl ? "intl" : "sample", id: t.id, name: t.name, price: +t.price || 0,
        region: region, dest: t.destination || "", cat: (t.tags && t.tags[0]) || "Tour tự tạo",
        emoji: t.coverEmoji || "🧳", image: t.image || "", desc: t.highlight || ("Tour " + (t.destination || t.name)),
        rc: RC[region] || "south", guide: t.type === "self" ? "self" : "guided",
        duration: t.duration || "", groupSize: t.groupSize || "", difficulty: t.difficulty || "Dễ",
        tags: t.tags || [], highlight: t.highlight || "", itinerary: t.itinerary || [],
        includes: t.includes, excludes: t.excludes, pickup: t.pickup, cancelNote: t.cancelNote, departures: t.departures,
        _prov: t.province ? [t.province] : undefined
      };
    });
  TOUR_SAMPLES = TOUR_SAMPLES.filter(function(t){ return !t._admin; }).concat(extras);
}

// Cập nhật số tour ở các nút lọc nhóm (gọi lại khi giao diện trang chủ được nạp sau dữ liệu)
function updateSrcCounts() {
  ["sample", "intl"].forEach(function(k){
    var el = document.getElementById("cnt-" + k);
    if (el) el.textContent = TOUR_SAMPLES.filter(function(t){ return t.src === k; }).length;
  });
}

// ── Nạp dữ liệu theo nhóm: core (20 tour chi tiết + UNESCO) và 4 nhóm bac | trung | nam | intl ──
var DATA_GROUPS = { bac: "data/tours/mien-bac.json", trung: "data/tours/mien-trung.json", nam: "data/tours/mien-nam.json", intl: "data/tours/quoc-te.json" };
var ALL_GROUPS = ["bac", "trung", "nam", "intl"];
var REGION_GROUP = { "Miền Bắc": "bac", "Miền Trung": "trung", "Miền Nam": "nam", "Quốc tế": "intl" };
var _core = null, _corePromise = null, _groups = {}, _groupPromises = {};

// Ghép lại TOUR_SAMPLES: 20 tour chi tiết (thuộc Tour mẫu, đứng đầu) → tour mẫu còn lại (theo ord) → quốc tế
function rebuildTours() {
  var tag = function(src){ return function(t){ return Object.assign({ src: src }, t); }; };
  var sample = [].concat(_groups.bac || [], _groups.trung || [], _groups.nam || [])
    .sort(function(a, b){ return (a.ord || 0) - (b.ord || 0); });
  TOUR_SAMPLES = ((_core && _core.tours) || []).map(tag("sample"))
    .concat(sample.map(tag("sample")))
    .concat((_groups.intl || []).map(tag("intl")));
  syncAdminTours._raw = null;
  syncAdminTours();
}

function loadCoreData() {
  if (_corePromise) return _corePromise;
  _corePromise = Promise.all([loadTours("core", "data/tours-detail.json"), loadJson("data/unesco.json")])
    .then(function(res){
      _core = res[0];
      UNESCO_SITES = res[1].sites || [];
      rebuildTours();
      updateSrcCounts();
    }).catch(function(err){ _corePromise = null; throw err; });   // cho phép thử lại lần sau
  return _corePromise;
}

function loadGroup(g) {
  if (_groupPromises[g]) return _groupPromises[g];
  _groupPromises[g] = Promise.all([loadCoreData(), loadTours(g, DATA_GROUPS[g])]).then(function(res){
    _groups[g] = res[1].tours || [];
    rebuildTours();
  }).catch(function(err){ delete _groupPromises[g]; throw err; });
  return _groupPromises[g];
}

// Nạp các nhóm cần cho 1 vùng ("all" hoặc tên vùng)
function loadRegionData(region) {
  var g = REGION_GROUP[region];
  return g ? loadGroup(g) : loadHomeData();
}

// Nạp TOÀN BỘ (Admin, chatbot RAG, trang chi tiết tour dùng) – gọi nhiều lần vẫn chỉ tải 1 lần mỗi file
function loadHomeData() {
  return Promise.all([loadCoreData()].concat(ALL_GROUPS.map(loadGroup))).then(function(){
    updateSrcCounts();
  }).catch(function(err){
    console.error("[home] Không đọc được dữ liệu JSON:", err);
    var c = document.getElementById("toursContainer");
    if (c && !TOUR_SAMPLES.length) {
      c.innerHTML = '<div class="tours-empty"><p class="tours-empty-title">Chưa tải được danh sách tour.</p><p>Kiểm tra kết nối rồi thử lại để xem các hành trình nhé.</p><button class="btn btn-primary" id="tours-retry">Thử lại</button></div>';
      var rb = document.getElementById("tours-retry");
      if (rb) rb.onclick = function(){ c.innerHTML = '<p style="text-align:center;padding:24px">Đang tải…</p>'; loadHomeData().then(function(){ if (typeof renderHome === "function") renderHome(); }).catch(function(){}); };
    }
    throw err;
  });
}

// Nhóm nào đang cần theo bộ lọc hiện tại (để bấm chọn vùng là nạp đúng vùng đó trước)
function groupsNeeded() {
  if (regionMode !== "all") return [REGION_GROUP[regionMode]].filter(Boolean);
  if (srcMode === "intl") return ["intl"];
  if (srcMode === "sample") return ["bac", "trung", "nam"];
  return ALL_GROUPS;
}

const CONTINENTS = {
  "🌏 Châu Á":         ["Việt Nam","Thái Lan","Nhật Bản","Hàn Quốc","Trung Quốc","Singapore","Indonesia","Malaysia","Ấn Độ","UAE","Campuchia","Lào"],
  "🌍 Châu Âu":        ["Pháp","Ý","Tây Ban Nha","Đức","Anh","Hà Lan","Thụy Sĩ","Bồ Đào Nha","Hy Lạp","Thụy Điển","Na Uy","Czech"],
  "🌎 Châu Mỹ":        ["Mỹ","Canada","Brazil","Mexico","Argentina","Peru","Colombia","Chile","Cuba","Ecuador"],
  "🌍 Châu Phi":       ["Ai Cập","Nam Phi","Morocco","Kenya","Tanzania","Ethiopia","Tunisia","Ghana"],
  "🌏 Châu Đại Dương": ["Úc","New Zealand","Fiji","Papua New Guinea","Samoa","Vanuatu"],
};

function fmtV(n){ return Number(n).toLocaleString("vi-VN"); }
function escH(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// Bỏ dấu + hạ chữ thường để so khớp tên điểm đến ("da lat" khớp "Đà Lạt")
function foldVi(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }

// Số ngày của tour, đọc từ chuỗi "3 ngày 2 đêm"
function daysOf(t) { var m = /(\d+)\s*ngày/.exec(t.duration || ""); return m ? +m[1] : 1; }

var BUDGETS = [["all","Mọi mức giá",0,Infinity],["lt2","Dưới 2 triệu",0,2e6],["2-5","2 – 5 triệu",2e6,5e6],["5-10","5 – 10 triệu",5e6,10e6],["10-20","10 – 20 triệu",10e6,20e6],["gt20","Trên 20 triệu",20e6,Infinity]];
var DAYS = [["all","Mọi số ngày"],["1","1 ngày"],["2","2 ngày"],["3","3 ngày"],["4-5","4 – 5 ngày"],["6+","6 ngày trở lên"]];
function daysMatch(n, key) {
  return key === "all" || (key === "4-5" ? n >= 4 && n <= 5 : key === "6+" ? n >= 6 : n === +key);
}

// Lọc + sắp xếp theo ô tìm kiếm, nhóm tour, vùng/tỉnh, ngân sách, số ngày, danh mục, điểm đến, hướng dẫn viên, giá
function getFilteredTours() {
  var q = (document.getElementById("tourSearch")?.value || "").toLowerCase();
  var destQ = foldVi(advDest.trim());
  var bud = BUDGETS.filter(function(b){ return b[0] === advBudget; })[0] || BUDGETS[0];
  var withGuide = function(t){ return guideMode === "guided" && t.guide === "guided"; };
  var list = TOUR_SAMPLES.map(function(t){
    return Object.assign({}, t, { displayPrice: withGuide(t) ? Math.round(t.price * 1.3) : t.price });
  }).filter(function(t){
    var text = (t.name + " " + t.region + " " + t.cat + " " + t.desc).toLowerCase();
    if (regionMode !== "all") {
      if (t.region !== regionMode) return false;
      if (provMode !== "all" && provincesOf(t).indexOf(provMode) < 0) return false;
    }
    if (advBudget !== "all" && !(t.displayPrice >= bud[2] && t.displayPrice < bud[3])) return false;
    if (!daysMatch(daysOf(t), advDays)) return false;
    if (advCat !== "all" && t.cat !== advCat) return false;
    if (destQ && foldVi(destOf(t)).indexOf(destQ) < 0) return false;
    return text.includes(q) && (srcMode === "all" || t.src === srcMode) && (guideMode === "all" || t.guide === guideMode);
  });
  if (sortMode === "asc")  list.sort(function(a,b){ return a.displayPrice - b.displayPrice; });
  if (sortMode === "desc") list.sort(function(a,b){ return b.displayPrice - a.displayPrice; });
  return list;
}

function tourCardHtml(t) {
  // Mỗi tour là một tấm vé: thân vé (tuyến, tên, mô tả, dữ kiện) + cuống vé (mã, giá, nút). Style trong css/design.css
  var guided = t.guide === "guided";
  var facts = [];
  if (t.duration) facts.push('<span class="tc-fact">' + escH(t.duration) + "</span>");
  facts.push('<span class="tc-fact' + (guided ? " is-guided" : "") + '">' + (guided ? "Có hướng dẫn viên" : "Tự túc") + "</span>");
  if (t.src === "intl") facts.push('<span class="tc-fact">' + escH(SRC_LABEL.intl) + "</span>");
  if (t._stats) facts.push(t._stats);
  var priceNote = (guideMode === "guided" && guided) ? '<span class="tc-note">Đã gồm hướng dẫn viên (+30%)</span>' : "";
  var code = /^\d+$/.test(String(t.id)) ? '<span class="tc-code">Mã ' + escH(t.id) + "</span>" : "";
  return '<article class="tour-card ' + escH(t.rc) + '" data-tour-id="' + escH(t.id) + '">'
    + '<div class="tc-body">'
    + '<p class="tc-meta">' + escH(t.region) + (t.cat ? " · " + escH(t.cat) : "") + "</p>"
    + '<h3 class="tc-name">' + escH(t.name) + "</h3>"
    + (t.desc ? '<p class="tc-desc"><span class="tc-desc-label">Điểm nổi bật</span>' + escH(t.desc) + "</p>" : "")
    + '<p class="tc-facts">' + facts.join("") + "</p></div>"
    + '<div class="tc-right">' + code + '<span class="tc-price">' + fmtV(t.displayPrice) + " ₫</span>"
    + '<span class="tc-sub">/ người</span>' + priceNote
    + '<button class="btn-detail" type="button" data-tour-id="' + escH(t.id) + '">Xem chi tiết</button></div></article>';
}

// Hàng chip tỉnh/thành: hiện khi đã chọn một vùng trong nước (Miền Bắc / Trung / Nam)
function renderRegionFilter() {
  var box = document.getElementById("regionFilter");
  if (!box) return;
  if (!REGION_PROVINCES[regionMode]) { box.style.display = "none"; box.innerHTML = ""; return; }
  var inRegion = TOUR_SAMPLES.filter(function(t){ return t.region === regionMode && (srcMode === "all" || t.src === srcMode); });
  var btn = function(attr, val, label, on, dim){
    return '<button class="guide-btn rg-prov' + (on ? " active" : "") + '" ' + attr + '="' + escH(val) + '"' + (dim ? ' data-empty="1"' : "") + ">" + label + "</button>";
  };
  box.innerHTML = '<div class="sort-group" style="margin:6px 0">'
    + btn("data-prov", "all", "Tất cả tỉnh (" + inRegion.length + ")", provMode === "all")
    + REGION_PROVINCES[regionMode].map(function(p){
        var n = inRegion.filter(function(t){ return provincesOf(t).indexOf(p) >= 0; }).length;
        return btn("data-prov", p, p + (n ? " (" + n + ")" : " · không có"), provMode === p, !n);
      }).join("") + "</div>";
  box.style.display = "";
  box.querySelectorAll(".rg-prov").forEach(function(b){
    b.addEventListener("click", function(){ provMode = b.dataset.prov; renderRegionFilter(); renderTours(); });
  });
}

// Bảng lọc nâng cao: vùng, ngân sách, số ngày, danh mục, điểm đến (+ nút xóa lọc)
function activeFilterCount() {
  return (regionMode !== "all") + (advBudget !== "all") + (advDays !== "all") + (advCat !== "all") + (advDest.trim() ? 1 : 0);
}
function renderAdvFilter() {
  var box = document.getElementById("advFilter");
  if (!box) return;
  var opt = function(val, label, cur){ return '<option value="' + escH(val) + '"' + (val === cur ? " selected" : "") + ">" + escH(label) + "</option>"; };
  var cats = Array.from(new Set(TOUR_SAMPLES.map(function(t){ return t.cat; }).filter(Boolean))).sort(function(a,b){ return a.localeCompare(b, "vi"); });
  var places = {};
  TOUR_SAMPLES.forEach(function(t){ destOf(t).split(/\s*[·,–]\s*/).forEach(function(x){ x = x.trim(); if (x) places[x] = 1; }); });
  var field = function(label, inner){ return '<label class="af-field"><span>' + label + "</span>" + inner + "</label>"; };
  var n = activeFilterCount();
  box.innerHTML =
    field("Vùng", '<select id="af-region">' + opt("all", "Tất cả vùng", regionMode)
      + Object.keys(REGION_PROVINCES).concat(["Quốc tế"]).map(function(r){ return opt(r, r, regionMode); }).join("") + "</select>")
    + field("Ngân sách", '<select id="af-budget">' + BUDGETS.map(function(b){ return opt(b[0], b[1], advBudget); }).join("") + "</select>")
    + field("Số ngày", '<select id="af-days">' + DAYS.map(function(d){ return opt(d[0], d[1], advDays); }).join("") + "</select>")
    + field("Danh mục", '<select id="af-cat">' + opt("all", "Tất cả danh mục", advCat) + cats.map(function(c){ return opt(c, c, advCat); }).join("") + "</select>")
    + field("Điểm đến", '<input id="af-dest" type="search" list="af-dest-list" placeholder="VD: Đà Lạt" autocomplete="off" value="' + escH(advDest) + '">'
      + '<datalist id="af-dest-list">' + Object.keys(places).sort(function(a,b){ return a.localeCompare(b, "vi"); }).map(function(p){ return '<option value="' + escH(p) + '">'; }).join("") + "</datalist>")
    + '<button type="button" class="af-reset" id="af-reset"' + (n ? "" : " disabled") + ">Xóa bộ lọc" + (n ? " (" + n + ")" : "") + "</button>";
  var onChange = function(id, set, rerender){
    var el = document.getElementById(id);
    el.addEventListener(id === "af-dest" ? "input" : "change", function(){ set(el.value); if (rerender) renderRegionFilter(); syncResetBtn(); renderTours(); });
  };
  onChange("af-region", function(v){ regionMode = v; provMode = "all"; }, true);
  onChange("af-budget", function(v){ advBudget = v; });
  onChange("af-days",   function(v){ advDays = v; });
  onChange("af-cat",    function(v){ advCat = v; });
  onChange("af-dest",   function(v){ advDest = v; });
  document.getElementById("af-reset").addEventListener("click", function(){
    regionMode = provMode = advBudget = advDays = advCat = "all"; advDest = "";
    renderAdvFilter(); renderRegionFilter(); renderTours();
  });
}
function syncResetBtn() {
  var b = document.getElementById("af-reset");
  if (!b) return;
  var n = activeFilterCount();
  b.disabled = !n;
  b.textContent = "Xóa bộ lọc" + (n ? " (" + n + ")" : "");
}

// Phân trang: « ‹ 1 … 4 [5] 6 … 26 › »
function pageNumbers(cur, total) {
  var set = {}; [1, total, cur - 1, cur, cur + 1].forEach(function(p){ if (p >= 1 && p <= total) set[p] = 1; });
  if (cur <= 3) [2, 3, 4].forEach(function(p){ if (p <= total) set[p] = 1; });
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach(function(p){ if (p >= 1) set[p] = 1; });
  var nums = Object.keys(set).map(Number).sort(function(a, b){ return a - b; }), out = [];
  nums.forEach(function(p, i){ if (i && p - nums[i - 1] > 1) out.push("…"); out.push(p); });
  return out;
}
function paginationHtml(total) {
  var pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return "";
  var b = function(label, page, cls, dis, aria){
    return '<button type="button" class="pg-btn ' + (cls || "") + '"' + (dis ? " disabled" : ' data-page="' + page + '"') + (aria ? ' aria-label="' + aria + '"' : "") + ">" + label + "</button>";
  };
  return '<nav class="pagination" aria-label="Phân trang tour">'
    + b("‹", curPage - 1, "", curPage === 1, "Trang trước")
    + pageNumbers(curPage, pages).map(function(p){
        return p === "…" ? '<span class="pg-gap">…</span>' : b(p, p, p === curPage ? "active" : "", false, "Trang " + p);
      }).join("")
    + b("›", curPage + 1, "", curPage === pages, "Trang sau") + "</nav>";
}

// reset=true: quay về trang 1 (khi đổi bộ lọc); false: giữ nguyên trang hiện tại
function renderTours(reset) {
  syncAdminTours();
  updateSrcCounts();
  if (window.RouteMap) RouteMap.update();       // hero: số tour theo vùng/tỉnh + trạng thái đang chọn
  // Chọn vùng / nhóm chưa nạp → nạp ngay vùng đó rồi vẽ lại (không đợi nạp ngầm)
  var missing = groupsNeeded().filter(function(g){ return !_groups[g]; });
  if (missing.length && _core) {
    Promise.all(missing.map(loadGroup)).then(function(){ renderTours(false); renderRegionFilter(); }).catch(function(){});
    var box = document.getElementById("toursContainer");
      if (box && regionMode !== "all") { box.innerHTML = '<div class="tours-empty"><p>Đang tìm tour trong khu vực này…</p></div>'; return; }
  }
  if (reset !== false) curPage = 1;
  var container = document.getElementById("toursContainer");
  if (!container) return;
  var list = getFilteredTours();
  var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (curPage > pages) curPage = pages;
  var info = document.getElementById("tourCount");
  if (info) info.textContent = list.length + " tour" + (pages > 1 ? " · trang " + curPage + "/" + pages : "");
  if (!list.length) {
    var anyFilter = activeFilterCount() || document.getElementById("tourSearch")?.value;
    container.innerHTML = '<div class="tours-empty"><p class="tours-empty-title">Chưa tìm thấy tour phù hợp.</p><p>'
      + (anyFilter ? 'Thử nới bộ lọc hoặc <a href="#" id="tourClearAll">xóa bộ lọc</a> để xem thêm hành trình.' : "Thử một từ khóa khác để tìm hành trình bạn muốn.") + "</p></div>";
    document.getElementById("tourClearAll")?.addEventListener("click", function(e){
      e.preventDefault(); document.getElementById("af-reset")?.click();
      var s = document.getElementById("tourSearch"); if (s && s.value) { s.value = ""; renderTours(); }
    });
    return;
  }
  var start = (curPage - 1) * PAGE_SIZE;
  container.innerHTML = list.slice(start, start + PAGE_SIZE).map(tourCardHtml).join("") + paginationHtml(list.length);
  container.querySelectorAll(".pg-btn[data-page]").forEach(function(btn){
    btn.addEventListener("click", function(){
      curPage = +btn.dataset.page;
      renderTours(false);
      var top = document.getElementById("tourCount");
      if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.pageYOffset - 90, behavior: "smooth" });
    });
  });
}

// Một lần duy nhất: ủy quyền click cho toàn bộ danh sách
document.getElementById("toursContainer")?.addEventListener("click", function(e){
  var el = e.target.closest("[data-tour-id]");
  if (el) viewTourSample(el.dataset.tourId);
});

// Điểm đến thật của tour: tour mẫu có trường dest; 20 tour chi tiết lấy từ tên (bỏ phần "3N2Đ")
function destOf(t) { return t.dest || t.name.replace(/\s*\d+N\d+Đ$/, ""); }

// Dữ liệu tour -> định dạng modal chi tiết / đặt tour (openTourDetail)
function tourToModalData(t) {
  return {
    id: t.id, name: t.name, destination: destOf(t), price: t.price,
    coverEmoji: t.emoji, emoji: t.emoji, description: t.desc, category: t.cat,
    duration: t.duration || "3 ngày 2 đêm", groupSize: t.groupSize || "Linh hoạt",
    difficulty: t.difficulty || "Nhẹ nhàng", tags: t.tags || [],
    highlight: t.highlight || t.desc, itinerary: t.itinerary || [],
    imageQuery: t.imageQuery, image: t.image, guideFee: t.guideFee, type: t.guide,
    includes: t.includes, excludes: t.excludes
  };
}

// Bấm thẻ tour -> mở trang riêng của tour (#/tour/<id>), xem được cả khi chưa đăng nhập
function viewTourSample(id) {
  var t = TOUR_SAMPLES.find(function(x){ return String(x.id) === String(id); });
  if (!t) return;
  if (typeof TourPage !== "undefined") TourPage.open(t.id);
  else location.hash = "#/tour/" + encodeURIComponent(t.id);
}

// Gắn 1 nhóm nút lọc: chỉ một nút active, đổi trạng thái rồi vẽ lại
function bindFilterGroup(selector, onPick) {
  document.querySelectorAll(selector).forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll(selector).forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      onPick(btn);
      renderTours();
    });
  });
}
document.getElementById("tourSearch")?.addEventListener("input", function(){ renderTours(); });
bindFilterGroup(".sort-btn",  function(b){ sortMode  = b.dataset.sort; });
bindFilterGroup(".guide-btn[data-guide]", function(b){ guideMode = b.dataset.guide; });
bindFilterGroup(".src-btn[data-src]", function(b){ srcMode = b.dataset.src; provMode = "all"; renderRegionFilter(); });

// UNESCO GRID
function renderUnesco() {
  let grid = document.getElementById("unescoGrid");
  if (!grid) return;
  grid.innerHTML = UNESCO_SITES.slice().sort(function(x, y){ return x.year - y.year; }).map(function(u){
    return '<div class="uc-row" role="listitem"><span class="uc-year">' + u.year + '</span>'
      + '<h3 class="uc-name">' + escH(u.name) + '</h3><span class="uc-loc">' + escH(u.loc) + "</span></div>";
  }).join("");
}

// CONTINENT / COUNTRIES
function renderContinents() {
  let sel = document.getElementById("continentSelect");
  if (!sel) return;
  Object.keys(CONTINENTS).forEach(function(k){
    let opt = document.createElement("option");
    opt.value = k; opt.textContent = k;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", function(){
    let sec = document.getElementById("countrySec");
    let title = document.getElementById("countryTitle");
    let grid = document.getElementById("countriesGrid");
    if (!sel.value) { if(sec) sec.classList.add("hidden"); return; }
    let countries = CONTINENTS[sel.value] || [];
    if(title) title.textContent = sel.value + " (" + countries.length + " quốc gia)";
    if(grid) grid.innerHTML = countries.map(function(c){ return '<span class="chip">' + escH(c) + "</span>"; }).join("");
    if(sec) sec.classList.remove("hidden");
  });
}

// MOBILE NAV TOGGLE
function setMobileNavOpen(isOpen) {
  let nav = document.getElementById("nav-right-btns");
  let toggle = document.getElementById("nav-mobile-toggle");
  nav?.classList.toggle("open", isOpen);
  toggle?.setAttribute("aria-expanded", String(isOpen));
  toggle?.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
}

document.getElementById("nav-mobile-toggle")?.addEventListener("click", function(){
  let nav = document.getElementById("nav-right-btns");
  setMobileNavOpen(!nav?.classList.contains("open"));
});

// Close mobile nav when clicking outside
document.addEventListener("click", function(e){
  let nav = document.getElementById("nav-right-btns");
  let toggle = document.getElementById("nav-mobile-toggle");
  if (nav && nav.classList.contains("open") && !nav.contains(e.target) && e.target !== toggle) {
    setMobileNavOpen(false);
  }
});

// Đóng menu di động sau khi chọn một mục
document.getElementById("nav-right-btns")?.addEventListener("click", function(e){
  if (e.target.closest(".nav-btn, #nav-login-btn")) setMobileNavOpen(false);
});

// NAV: Create trip button
document.getElementById("nav-create-trip-btn")?.addEventListener("click", function(){
  if (typeof requireAuth === "function" && typeof openNewTripForm === "function") {
    requireAuth(openNewTripForm);
  } else if (typeof navigate === "function") {
    navigate("create-trip");
  }
});

document.getElementById("hero-create-btn")?.addEventListener("click", function(){
  if (typeof requireAuth === "function" && typeof openNewTripForm === "function") {
    requireAuth(openNewTripForm);
  } else if (typeof navigate === "function") {
    navigate("create-trip");
  }
});

// FOOTER ACCORDION
(function(){
  let sfBtn  = document.getElementById("sf-feedback-toggle");
  let sfBody = document.getElementById("sf-feedback-body");
  if (!sfBtn || !sfBody) return;
  sfBtn.addEventListener("click", function(){
    let isOpen = sfBody.classList.toggle("open");
    sfBtn.setAttribute("aria-expanded", String(isOpen));
  });
})();

// Init home section renders (called after all scripts load)
window._initHomeSection = function(){
  var drawAll = function(){
    updateSrcCounts();
    renderAdvFilter();
    renderRegionFilter();
    renderTours(false);
  };
  loadCoreData().then(function(){
    if (!TOUR_SAMPLES.length) return;
    drawAll();
    renderUnesco();
    renderContinents();
    // Các vùng còn lại nạp ngầm khi trình duyệt rảnh; vẽ lại danh sách mỗi khi có thêm dữ liệu
    var idle = window.requestIdleCallback || function(f){ return setTimeout(f, 600); };
    idle(function(){
      ALL_GROUPS.forEach(function(g){
        loadGroup(g).then(function(){
          updateSrcCounts();
          renderTours(false);
          var inForm = document.activeElement && document.activeElement.closest && document.activeElement.closest("#advFilter");
          if (!inForm) { renderAdvFilter(); renderRegionFilter(); }
        }).catch(function(){});
      });
    }, { timeout: 2500 });
  }).catch(function(err){
    console.error("[home] Không đọc được dữ liệu JSON:", err);
    var c = document.getElementById("toursContainer");
    if (c) {
      c.innerHTML = '<div class="tours-empty"><p class="tours-empty-title">Chưa tải được danh sách tour.</p><p>Kiểm tra kết nối rồi thử lại để xem các hành trình nhé.</p><button class="btn btn-primary" id="tours-retry">Thử lại</button></div>';
      var rb = document.getElementById("tours-retry");
      if (rb) rb.onclick = function(){ c.innerHTML = '<p style="text-align:center;padding:24px">Đang tải…</p>'; loadHomeData().then(function(){ if (typeof renderHome === "function") renderHome(); }).catch(function(){}); };
    }
  });
};
