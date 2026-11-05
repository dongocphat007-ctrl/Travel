/**
 * GeminiAI — module gọi AI dùng chung (Tìm Tour AI, mẹo AI, nhập chuyến đi, chatbot).
 *
 * KHÔNG còn khóa API trong trình duyệt: mọi lời gọi đi qua Spring Boot (POST /api/ai/generate);
 * khóa Gemini chỉ nằm ở biến môi trường GEMINI_API_KEY của máy chủ.
 * Không có máy chủ / chưa cấu hình khóa → hasKey() = false và giao diện dùng chế độ demo.
 */
const GeminiAI = (() => {
  const MODEL = "gemini-1.5-flash";   // chỉ để hiển thị; model thật do máy chủ chọn (GEMINI_MODEL)
  let enabled = false;
  let langfuseEnabled = false;
  let lastTraceId = null;
  let ready = null;

  // Hỏi máy chủ một lần xem AI & Langfuse đã được cấu hình chưa
  function init() {
    if (ready) return ready;
    ready = (async () => {
      try {
        const r = await fetch("/api/ai/status", { credentials: "same-origin" });
        if (r.ok) {
          const j = await r.json();
          enabled = !!j.enabled;
          langfuseEnabled = !!j.langfuse;
        }
      } catch (e) { enabled = false; langfuseEnabled = false; }
      return enabled;
    })();
    return ready;
  }

  function hasKey() { return enabled; }   // giữ tên cũ để chatbot.js không phải đổi logic
  function hasLangfuse() { return langfuseEnabled; }

  async function post(body) {
    let res;
    try {
      res = await fetch("/api/ai/generate", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) { throw new Error("Không kết nối được máy chủ AI"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || `AI HTTP ${res.status}`);
    if (!data.text) throw new Error("AI không có phản hồi");
    if (data.traceId) {
      lastTraceId = data.traceId;
      GeminiAI.lastTraceId = data.traceId;
    }
    return data.text;
  }

  /**
   * @param {string} prompt  nội dung người dùng
   * @param {{system?:string, maxTokens?:number, temperature?:number, json?:boolean, feature?:string, userId?:string, sessionId?:string}} opts
   * @returns {Promise<string>} text trả về
   */
  async function generate(prompt, opts = {}) {
    await init();
    return post({
      prompt,
      system: opts.system,
      maxTokens: opts.maxTokens || 2000,
      temperature: opts.temperature ?? 0.5,
      json: !!opts.json,
      feature: opts.feature || "travel-ai",
      userId: opts.userId,
      sessionId: opts.sessionId,
    });
  }

  /** Hội thoại nhiều lượt (chatbot): turns = [{role:"user"|"assistant", content}] */
  async function chat(turns, opts = {}) {
    await init();
    return post({
      contents: turns.map((m) => ({ role: m.role, text: m.content })),
      system: opts.system,
      maxTokens: opts.maxTokens || 1000,
      temperature: opts.temperature ?? 0.75,
      feature: opts.feature || "chatbot",
      userId: opts.userId,
      sessionId: opts.sessionId,
    });
  }

  /** Gửi đánh giá phản hồi (thumbs up: 1, thumbs down: 0) lên Langfuse qua server */
  async function sendFeedback(traceId, value, comment = "") {
    const tid = traceId || lastTraceId;
    if (!tid) return false;
    try {
      const res = await fetch("/api/ai/feedback", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traceId: tid, value: Number(value), comment: String(comment || "") }),
      });
      return res.ok;
    } catch (e) { return false; }
  }

  /** Gọi AI và parse JSON (tự bỏ ```json fence nếu có). */
  async function generateJSON(prompt, opts = {}) {
    const raw = await generate(prompt, { ...opts, json: true });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  }

  init();
  return { generate, generateJSON, chat, sendFeedback, hasKey, hasLangfuse, init, MODEL, get lastTraceId() { return lastTraceId; }, set lastTraceId(v) { lastTraceId = v; } };
})();
window.GeminiAI = GeminiAI;
