/**
 * evaluate-chatbot-12.js
 * Bộ đánh giá 12 câu hỏi Chatbot AI theo Task 13.9:
 *   - 3 câu nhóm (a): Về travel và CÓ dữ liệu trong web
 *   - 3 câu nhóm (b): Về travel nhưng KHÔNG CÓ thông tin trong dữ liệu web
 *   - 3 câu nhóm (c): Ngoài travel
 *   - 3 câu về chính chatbot ("bạn là ai", chào hỏi, năng lực)
 *
 * Chạy bằng: node tools/evaluate-chatbot-12.js
 */

const fs = require("fs");
const path = require("path");

// Mock browser global objects
global.window = global;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  get length() { return Object.keys(this._data).length; },
  key(i) { return Object.keys(this._data)[i] || null; }
};
global.document = {
  getElementById() { return null; },
  createElement() { return { style: {}, appendChild() {}, setAttribute() {} }; },
  body: { appendChild() {} }
};
global.fetch = async () => ({ ok: false });

// Nạp module Chatbot
const chatbotCode = fs.readFileSync(path.join(__dirname, "../frontend/js/chatbot.js"), "utf8");
eval(chatbotCode);

const TEST_SUITE = [
  // ── Nhóm (a): Travel và có dữ liệu trong web ──
  {
    id: 1,
    group: "(a) Travel có dữ liệu",
    question: "Tour Hà Nội Hạ Long 3 ngày giá bao nhiêu?",
    expectedCategory: "travel_in",
    verify(res, cat) {
      return cat === "travel_in" && !res.includes("chỉ có thể hỗ trợ các thông tin về tour") && !res.includes("chưa có thông tin hành trình");
    }
  },
  {
    id: 2,
    group: "(a) Travel có dữ liệu",
    question: "Gợi ý đặc sản ẩm thực miền Bắc nổi tiếng?",
    expectedCategory: "travel_in",
    verify(res, cat) {
      return cat === "travel_in" && !res.includes("chỉ có thể hỗ trợ các thông tin về tour") && !res.includes("chưa có thông tin hành trình");
    }
  },
  {
    id: 3,
    group: "(a) Travel có dữ liệu",
    question: "Lịch trình đi Vũng Tàu 2 ngày 1 đêm như thế nào?",
    expectedCategory: "travel_in",
    verify(res, cat) {
      return cat === "travel_in" && res.includes("Vũng Tàu") && !res.includes("chưa có thông tin hành trình");
    }
  },

  // ── Nhóm (b): Travel nhưng không có dữ liệu trong web ──
  {
    id: 4,
    group: "(b) Travel không có dữ liệu",
    question: "Lịch trình du lịch Paris Pháp 5 ngày gồm những điểm nào?",
    expectedCategory: "travel_out",
    verify(res, cat) {
      return cat === "travel_out" && res.includes("chưa có thông tin") && res.includes("tc-ai-links");
    }
  },
  {
    id: 5,
    group: "(b) Travel không có dữ liệu",
    question: "Chi phí du lịch Maldives tự túc khoảng bao nhiêu tiền?",
    expectedCategory: "travel_out",
    verify(res, cat) {
      return cat === "travel_out" && res.includes("chưa có thông tin") && res.includes("tc-ai-links");
    }
  },
  {
    id: 6,
    group: "(b) Travel không có dữ liệu",
    question: "Thời tiết ở London mùa đông có tuyết rơi không?",
    expectedCategory: "travel_out",
    verify(res, cat) {
      return cat === "travel_out" && res.includes("chưa có thông tin") && res.includes("tc-ai-links");
    }
  },

  // ── Nhóm (c): Ngoài travel ──
  {
    id: 7,
    group: "(c) Ngoài du lịch",
    question: "Giải phương trình bậc hai 2x^2 + 5x - 3 = 0",
    expectedCategory: "non_travel",
    verify(res, cat) {
      return cat === "non_travel" && res.includes("chỉ có thể hỗ trợ các thông tin về tour") && res.includes("tc-ai-links");
    }
  },
  {
    id: 8,
    group: "(c) Ngoài du lịch",
    question: "Viết giúp mình một đoạn mã Python tính dãy Fibonacci",
    expectedCategory: "non_travel",
    verify(res, cat) {
      return cat === "non_travel" && res.includes("chỉ có thể hỗ trợ các thông tin về tour") && res.includes("tc-ai-links");
    }
  },
  {
    id: 9,
    group: "(c) Ngoài du lịch",
    question: "Đội tuyển nào vô địch World Cup 2022?",
    expectedCategory: "non_travel",
    verify(res, cat) {
      return cat === "non_travel" && res.includes("chỉ có thể hỗ trợ các thông tin về tour") && res.includes("tc-ai-links");
    }
  },

  // ── Nhóm chính chatbot ──
  {
    id: 10,
    group: "Chính chatbot",
    question: "Bạn là ai?",
    expectedCategory: "self",
    verify(res, cat) {
      return cat === "self" && res.includes("trợ lý du lịch ảo của Travel") && !res.includes("Xin lỗi");
    }
  },
  {
    id: 11,
    group: "Chính chatbot",
    question: "Chào bạn, bạn có thể giúp gì cho mình?",
    expectedCategory: "self",
    verify(res, cat) {
      return cat === "self" && res.includes("trợ lý du lịch ảo của Travel") && !res.includes("Xin lỗi");
    }
  },
  {
    id: 12,
    group: "Chính chatbot",
    question: "Bạn làm được những việc gì trên website này?",
    expectedCategory: "self",
    verify(res, cat) {
      return cat === "self" && res.includes("trợ lý du lịch ảo của Travel") && !res.includes("Xin lỗi");
    }
  }
];

console.log("=== BẮT ĐẦU ĐÁNH GIÁ 12 CÂU HỎI CHATBOT AI (TASK 13.9) ===");
let passed = 0;
const results = [];

TEST_SUITE.forEach(t => {
  const cat = Chatbot.classifyQuestion(t.question);
  const resp = Chatbot.getMockResponse(t.question);
  const ok = t.verify(resp, cat);
  if (ok) passed++;
  results.push({
    stt: t.id,
    group: t.group,
    question: t.question,
    category: cat,
    passed: ok ? "ĐẠT" : "KHÔNG ĐẠT",
    snippet: resp.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) + "..."
  });
});

console.table(results.map(r => ({
  "STT": r.stt,
  "Nhóm": r.group,
  "Câu hỏi": r.question,
  "Phân loại": r.category,
  "Kết quả": r.passed,
  "Phản hồi": r.snippet
})));

console.log(`\nTổng kết: ${passed}/${TEST_SUITE.length} câu ĐẠT (${Math.round(passed * 100 / TEST_SUITE.length)}%).`);

if (passed !== TEST_SUITE.length) {
  console.error("❌ Có câu hỏi chưa đạt yêu cầu!");
  process.exit(1);
} else {
  console.log("✅ Toàn bộ 12 câu hỏi đạt chuẩn quy định 13.9!");
}
