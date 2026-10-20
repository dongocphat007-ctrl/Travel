/**
 * RAG nhẹ chạy ngay trong trình duyệt — không cần backend, không cần vector DB.
 *
 * AI nhìn thấy TOÀN BỘ dữ liệu của dự án theo 2 lớp:
 *   (1) DANH MỤC ĐẦY ĐỦ: luôn đưa vào prompt, liệt kê gọn mọi tour (300) và mọi món ăn (150+)
 *       → AI biết có gì, đếm được, liệt kê được, không bao giờ "không thấy" một tour/món nào.
 *   (2) CHI TIẾT LIÊN QUAN: tìm BM25 (bỏ dấu tiếng Việt) top K tài liệu hợp với câu hỏi
 *       → có đủ giá, lịch trình từng buổi, mô tả… để trả lời chính xác.
 *
 * Nguồn dữ liệu (tất cả đều được nạp):
 *   • TOUR_SAMPLES        data/tours-detail.json (20) + data/tours/mien-*.json (504) + data/tours/quoc-te.json (100)
 *   • SAMPLE_TOURS        tab "Tour mẫu" của Admin (cùng dữ liệu JSON ở trên + tour Admin tự thêm/sửa; trùng tên chỉ giữ 1 bản)
 *   • Món ăn              data/foods.json (mặc định) GỘP với bản Admin đã lưu (không bỏ sót món nào)
 *   • UNESCO_SITES        data/unesco.json
 *   • DESTINATIONS        lịch trình / ẩm thực / chi phí gợi ý theo điểm đến (truyền từ chatbot.js)
 *   • Chuyến đi (TripManager) + tour đã đăng ký (BookingManager) của người dùng đang đăng nhập
 *
 * Kiểm tra nhanh trong Console trình duyệt:  RAG.stats()
 */
const RAG = (() => {
  const STOP = new Set(("la va cua o co khong nao gi cho toi minh muon di the nay ban hay nhung mot cac " +
    "nhu de voi tai trong khi duoc bao nhieu nhe a oi ve nen thi se dang can biet goi y giup " +
    "nhat rat qua cung ra vao len xuong tu den hon het moi").split(" "));

  const norm = (t) => String(t || "").toLowerCase().replace(/đ/g, "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Địa danh chứa từ nằm trong STOP ("Nhật Bản": nhat+ban, "Sơn La": la) → gộp thành 1 token để không bị loại mất
  const PROTECT = [[/\bnhat ban\b/g, "nhatban"], [/\bson la\b/g, "sonla"]];
  const tokenize = (t) => {
    let n = norm(t);
    PROTECT.forEach(([re, to]) => { n = n.replace(re, to); });
    return n.split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
  };

  const FOOD_KEY = "travel_food_v1";
  const INCLUDE_FEATURED = false;   // false = bỏ 3 "món tiêu biểu nhất" (mỗi vùng 1 món) → RAG chỉ có 150 món. Đổi true nếu muốn thêm lại.
  const money = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";
  const short = (n) => {                       // 2500000 → "2.5tr"
    const m = Number(n || 0) / 1e6;
    return (Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, "")) + "tr";
  };
  const REGION_LABEL = { north: "Miền Bắc", center: "Miền Trung", south: "Miền Nam" };

  // ───────────────────────── 1) Thu thập dữ liệu ─────────────────────────

  // Toàn bộ tour: trang chủ (JSON) + tab Tour mẫu (SAMPLE_TOURS). Trùng tên → chỉ giữ 1 bản.
  function collectTours() {
    const out = [], seen = new Set();
    const add = (t, group) => {
      if (!t || !t.name) return;
      const key = norm(t.name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ t, group });
    };
    (typeof TOUR_SAMPLES !== "undefined" ? TOUR_SAMPLES : []).forEach((t) =>
      add(t, t.src === "intl" ? "Tour quốc tế" : "Tour mẫu"));
    (typeof SAMPLE_TOURS !== "undefined" ? SAMPLE_TOURS : []).forEach((t) => add(t, "Tour"));
    return out;
  }

  // Toàn bộ món ăn: GỘP bản mặc định (foods.json) với bản Admin đã lưu → không món nào bị mất.
  function collectFoods() {
    const defaults = window._FoodDefaultRegions || {};
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(FOOD_KEY)); } catch {}
    if (!saved || typeof saved !== "object") saved = {};

    const keys = new Set([...Object.keys(defaults), ...Object.keys(saved)]);
    const out = [], seen = new Set();
    keys.forEach((key) => {
      const meta = defaults[key] || saved[key] || {};
      const label = meta.label || REGION_LABEL[key] || key;
      const list = [
        ...(INCLUDE_FEATURED && defaults[key]?.featured ? [defaults[key].featured] : []),
        ...(saved[key]?.foods || []),            // món Admin thêm/sửa đứng trước → ưu tiên bản mới nhất
        ...(defaults[key]?.foods || []),
      ];
      list.forEach((f) => {
        if (!f || !f.name) return;
        const k = key + "|" + norm(f.name);
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ f, label, key });
      });
    });
    return out;
  }

  const unescoList = () => (typeof UNESCO_SITES !== "undefined" ? UNESCO_SITES : []);

  // ───────────────────────── 2) Dựng "tài liệu" để tìm kiếm ─────────────────────────

  function tourText(t, group) {
    const guided = (t.guide || t.type) === "guided";
    const itin = (t.itinerary || []).map((d) => {
      const items = (d.items || []).map((i) => `${i.time ? i.time + ": " : ""}${i.desc}`).join("; ");
      return `Ngày ${d.day}${d.title ? " (" + d.title + ")" : ""}${items ? " — " + items : ""}`;
    }).join(" | ");
    const dest = t.dest || t.destination || t.region || "";   // tour quốc tế: dest đã gồm tên quốc gia
    return (
      `${group} "${t.name}" — ${guided ? "có hướng dẫn viên" : "tự túc"} | ` +
      `Điểm đến: ${dest}${t.region && (t.dest || t.destination) ? ` (${t.region})` : ""} | ` +
      `Thời gian: ${t.duration || "chưa rõ"} | Giá: ${money(t.price)}/người` +
      (t.guideFee ? ` (thuê HDV thêm ${money(t.guideFee)})` : "") +
      ((t.international || t.region === "Quốc tế") ? " | Tour quốc tế" : "") +
      (t.country ? ` | Quốc gia: ${t.country}` : "") +
      (t.cat ? ` | Loại: ${t.cat}` : "") +
      (t.groupSize ? ` | Đoàn: ${t.groupSize}` : "") +
      (t.difficulty ? ` | Độ khó: ${t.difficulty}` : "") +
      (t.highlight ? ` | Điểm nhấn: ${t.highlight}` : "") +
      (t.tags?.length ? ` | Thẻ: ${t.tags.join(", ")}` : "") +
      (t.desc ? ` | Mô tả: ${t.desc}` : "") +
      (itin ? ` | Lịch trình: ${itin}` : "")
    );
  }

  function buildDocs(extra = {}) {
    const docs = [];

    collectTours().forEach(({ t, group }) =>
      docs.push({ type: "Tour", title: t.name, place: t.dest || t.destination || "", text: tourText(t, group), tour: t }));

    collectFoods().forEach(({ f, label }) =>
      docs.push({
        type: "Ẩm thực",
        title: f.name,
        text:
          `Món ${f.name} (${[f.region, label].filter(Boolean).join(", ")}): ${f.desc || ""}` +
          (f.tags?.length ? ` Thẻ: ${f.tags.join(", ")}.` : ""),
      }));

    unescoList().forEach((s) =>
      docs.push({
        type: "UNESCO",
        title: s.name,
        text: `Di sản UNESCO "${s.name}" tại ${s.loc || "Việt Nam"}${s.year ? `, được công nhận năm ${s.year}` : ""}.`,
      }));

    const LABEL = { "lịch_trình": "Lịch trình gợi ý", "ẩm_thực": "Ẩm thực", chiphí: "Chi phí tham khảo" };
    Object.entries(extra.destinations || {}).forEach(([place, obj]) =>
      Object.entries(obj || {}).forEach(([field, content]) =>
        docs.push({
          type: "Điểm đến",
          title: `${place} — ${LABEL[field] || field}`,
          place,
          text: `${place} — ${LABEL[field] || field}:\n${content}`,
        })));

    // Chuyến đi của người dùng đang đăng nhập
    try {
      (typeof TripManager !== "undefined" ? TripManager.getAll() : []).forEach((tr) => {
        const days = (tr.days || []).map((d) =>
          `${d.label}${d.date ? " (" + d.date + ")" : ""}: ` +
          ((d.locations || []).map((l) => l.name).join(", ") || "chưa có địa điểm")).join("; ");
        docs.push({
          type: "Chuyến đi của bạn",
          title: `Chuyến đi ${tr.name}`,
          text: `Chuyến đi "${tr.name}" tới ${tr.destination}, ${tr.startDate} → ${tr.endDate}` +
                (tr.budget ? `, ngân sách ${money(tr.budget)}` : "") + (days ? `. ${days}` : "") + ".",
        });
      });
    } catch {}

    // Tour người dùng đã đăng ký (kèm trạng thái admin duyệt)
    const STATUS = { pending: "đang chờ admin nhận", confirmed: "đã được admin nhận", cancelled: "đã bị hủy" };
    try {
      (typeof BookingManager !== "undefined" ? BookingManager.mine() : []).forEach((b) =>
        docs.push({
          type: "Đăng ký của bạn",
          title: `Đăng ký tour ${b.tourName}`,
          text:
            `Bạn đã đăng ký tour "${b.tourName}" (${b.tourDest || ""}) — ngày đi ${b.date || "chưa rõ"}, ` +
            `${b.pax || 1} người, tổng ${money(b.price)}; trạng thái: ${STATUS[b.status] || STATUS.pending}.`,
        }));
    } catch {}

    docs.forEach((d) => {
      d.tokens = tokenize(d.title + " " + d.title + " " + (d.place || "") + " " + d.text); // tên + điểm đến nặng hơn
      d.normTitle = norm(d.title);
      d.normPlace = norm(d.place);
    });
    return docs;
  }

  // ───────────────────────── 3) Danh mục đầy đủ (luôn đưa vào prompt) ─────────────────────────

  function buildCatalog() {
    const tours = collectTours();
    const foods = collectFoods();
    const lines = [];

    if (tours.length) {
      lines.push(`DANH MỤC TOUR (${tours.length} tour — tên | giá/người):`);
      const byRegion = {};
      tours.forEach(({ t }) => (byRegion[t.region || (t.international ? "Quốc tế" : "Tour mẫu trong nước")] ||= []).push(t));
      Object.entries(byRegion).forEach(([region, list]) =>
        lines.push(`• ${region} (${list.length}): ` + list.map((t) => `${t.name} ${short(t.price)}`).join("; ")));
    }
    if (foods.length) {
      lines.push(`\nDANH MỤC ẨM THỰC (${foods.length} món):`);
      const byLabel = {};
      foods.forEach(({ f, label }) => (byLabel[label] ||= []).push(f.name));
      Object.entries(byLabel).forEach(([label, list]) =>
        lines.push(`• ${label} (${list.length}): ${list.join(", ")}`));
    }
    const un = unescoList();
    if (un.length) lines.push(`\nDI SẢN UNESCO (${un.length}): ` + un.map((s) => s.name).join("; "));
    return lines.join("\n");
  }

  // ───────────────────────── 4) Tìm kiếm BM25 ─────────────────────────

  // Chấm điểm BM25 cho mọi tài liệu (chưa lọc ngưỡng). Dùng chung cho search() và tourCandidates().
  function scoreDocs(query, extra = {}) {
    const q = tokenize(query);
    if (!q.length) return null;
    const docs = buildDocs(extra);
    if (!docs.length) return null;

    const N = docs.length;
    const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / N;
    const df = {};
    docs.forEach((d) => new Set(d.tokens).forEach((w) => (df[w] = (df[w] || 0) + 1)));

    const nq = norm(query);
    const scored = docs.map((d) => {
      const tf = {};
      d.tokens.forEach((w) => (tf[w] = (tf[w] || 0) + 1));
      let score = 0;
      q.forEach((w) => {
        if (!tf[w]) return;
        const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5));
        score += (idf * (tf[w] * 2.2)) / (tf[w] + 1.2 * (0.25 + 0.75 * (d.tokens.length / avgLen)));
      });
      const base = d.normTitle.split(" — ")[0];
      if (base.length > 3 && nq.includes(base)) score += 3;                  // nhắc đúng tên tour/món
      if (d.normPlace.length > 2 && d.type !== "Ẩm thực" && nq.includes(d.normPlace.split(" – ")[0])) score += 1.5; // đúng điểm đến
      return { ...d, score };
    });
    return { scored, nq };
  }

  function search(query, { k = 8, minScore = 2, relCut = 0.35, extra = {} } = {}) {
    const r = scoreDocs(query, extra);
    if (!r) return [];
    // Người dùng hỏi dạng liệt kê / so sánh → cho phép trả nhiều tài liệu hơn
    const wantsMany = /danh sach|liet ke|tat ca|nhung (tour|mon)|bao nhieu|so sanh|goi y/.test(r.nq);
    const limit = wantsMany ? Math.max(k, 15) : k;

    const ranked = r.scored.filter((d) => d.score >= minScore).sort((a, b) => b.score - a.score);
    if (!ranked.length) return [];
    return ranked.filter((d) => d.score >= ranked[0].score * relCut).slice(0, limit);
  }

  /**
   * Ứng viên cho TourSearch: chỉ các TOUR THẬT (trả về đúng đối tượng tour trong catalog, kèm score).
   * Ngưỡng thấp hơn search() vì bước sau (AI hoặc xếp hạng) còn chọn lại; mặc định lấy tối đa 40.
   */
  function tourCandidates(query, { k = 40, minScore = 0.5, extra = {} } = {}) {
    const r = scoreDocs(query, extra);
    if (!r) return [];
    return r.scored
      .filter((d) => d.type === "Tour" && d.tour && d.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((d) => ({ tour: d.tour, score: d.score }));
  }

  // ───────────────────────── Cổng phạm vi: câu hỏi có thuộc dữ liệu Travel không? ─────────────────────────

  const TOPIC_RE = /\b(tour|du lich|lich trinh|chuyen di|dang ky|dat tour|booking|gia|chi phi|bao nhieu|am thuc|mon an|mon|dac san|di san|unesco|diem den|huong dan vien|hdv|tu tuc|quoc te|mien bac|mien trung|mien nam|trong nuoc|nuoc ngoai|dat coc|thanh toan|ngay di)\b/;
  const hasPhrase = (nq, phrase) => phrase.length >= 3 && new RegExp("(^|[^a-z0-9])" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(nq);

  /**
   * true khi câu hỏi nhắc đúng tên điểm đến / tour / món / di sản có trong Travel,
   * hoặc dùng từ khoá đúng chủ đề (tour, giá, lịch trình, ẩm thực…) VÀ tìm được dữ liệu liên quan.
   * Câu hỏi ngoài lề (toán, lập trình, tin tức…) chỉ khớp vài từ chung chung sẽ bị loại.
   */
  function inScope(query, opts = {}) {
    const nq = norm(query);
    if (!nq.trim()) return false;
    const names = new Set();
    const addName = (txt) => String(txt || "").split(/\s[–—-]\s|[,()]/).forEach((seg) => { const n = norm(seg).trim(); if (n.length >= 3) names.add(n); });
    collectTours().forEach(({ t }) => { addName(t.name); addName(t.dest || t.destination); if (t.country) addName(t.country); });
    collectFoods().forEach(({ f }) => addName(f.name));
    unescoList().forEach((s) => addName(s.name));
    Object.keys((opts.extra && opts.extra.destinations) || {}).forEach(addName);
    const ENTITY_STOP = new Set(["tour", "mien bac", "mien trung", "mien nam", "quoc te", "tu tuc", "mon an"]);
    for (const n of names) if (!ENTITY_STOP.has(n) && hasPhrase(nq, n)) return true;
    return TOPIC_RE.test(nq) && search(query, opts).length > 0;
  }

  // ───────────────────────── 5) Tạo đoạn văn để nhét vào prompt ─────────────────────────

  function buildContext(query, opts = {}) {
    const catalog = buildCatalog();
    const hits = search(query, opts);
    const detail = hits.length
      ? "\n\nCHI TIẾT LIÊN QUAN ĐẾN CÂU HỎI:\n" + hits.map((h, i) => `[${i + 1}] (${h.type}) ${h.text}`).join("\n\n")
      : "";
    if (!catalog && !detail) return "";
    return (
      "\n\nDỮ LIỆU THAM KHẢO TỪ TRAVEL (nguồn đáng tin, ưu tiên dùng):\n" + catalog + detail +
      "\n\nQUY TẮC: Danh mục ở trên là TOÀN BỘ tour và món ăn hiện có trên Travel — tour/món nào không có trong danh mục thì Travel chưa có. " +
      "Khi cần giá, lịch trình, mô tả thì lấy ở phần CHI TIẾT; nếu tour có trong danh mục nhưng chưa có chi tiết, chỉ nêu tên và giá trong danh mục. " +
      "Giá và tên tour phải đúng như dữ liệu, không tự bịa."
    );
  }

  // Thống kê nhanh để kiểm tra RAG đã nhìn thấy bao nhiêu dữ liệu (gõ RAG.stats() trong Console)
  function stats(extra = {}) {
    const docs = buildDocs(extra);
    const byType = {};
    docs.forEach((d) => (byType[d.type] = (byType[d.type] || 0) + 1));
    return { tong: docs.length, ...byType, catalogChars: buildCatalog().length };
  }

  return { search, tourCandidates, inScope, buildContext, buildCatalog, stats, collectTours };
})();
if (typeof window !== "undefined") window.RAG = RAG;
