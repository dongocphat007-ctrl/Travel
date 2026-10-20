/**
 * chat-log.js — JS thuần (không server).
 * Ghi câu hỏi của người dùng + câu trả lời của AI vào localStorage (khóa CHATLOG_KEY)
 * để Admin xem / tải JSON / xoá trong tab "Chat AI".
 *
 * - Người dùng KHÔNG có giao diện nào để xem hay lưu lại các tin nhắn này.
 * - Chỉ lưu mã phiên + id/tên tài khoản. KHÔNG lưu email. SĐT/email trong tin nhắn bị che.
 * - Lưu tối đa MAX_MESSAGES tin (vượt quá thì bỏ tin cũ nhất).
 * - Lưu ý: localStorage nằm trong từng trình duyệt, nên Admin xem được chat
 *   được ghi trên CHÍNH trình duyệt/máy này.
 */
const ChatLog = (() => {
  const CHATLOG_KEY = "travel_chat_logs_v1";
  const SID_KEY = "travel_chat_sid"; // sessionStorage: mất khi đóng tab
  const MAX_MESSAGES = 3000;
  const MAX_TEXT = 4000;
  let memSid = null;

  const rnd = () => Math.random().toString(36).slice(2, 10);
  const newId = (p) => p + Date.now().toString(36) + rnd();

  function sessionId() {
    try {
      let s = sessionStorage.getItem(SID_KEY);
      if (!s) { s = newId("s_"); sessionStorage.setItem(SID_KEY, s); }
      return s;
    } catch {
      return memSid || (memSid = newId("s_"));
    }
  }

  // Bắt đầu một cuộc trò chuyện mới (khi bấm "mới" hoặc đổi tài khoản).
  function newSession() {
    try { sessionStorage.removeItem(SID_KEY); } catch {}
    memSid = null;
  }

  function who() {
    const u = typeof Auth !== "undefined" && Auth.getUser ? Auth.getUser() : null;
    if (!u) return { userId: null, userName: "Khách" };
    return { userId: u.id ? String(u.id) : "user", userName: u.name ? String(u.name) : "Người dùng" };
  }

  // Che email và số điện thoại / số dài trước khi lưu.
  function mask(t) {
    return t
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
      .replace(/(?<!\d)(?:\+?84|0)[\d .-]{8,12}\d(?!\d)/g, "[sđt]")
      .replace(/\d{9,}/g, "[số]");
  }

  function readAll() {
    try {
      const a = JSON.parse(localStorage.getItem(CHATLOG_KEY));
      return Array.isArray(a) ? a : [];
    } catch { return []; }
  }

  function writeAll(list) {
    try {
      localStorage.setItem(CHATLOG_KEY, JSON.stringify(list));
      return true;
    } catch {
      // Đầy bộ nhớ → bỏ bớt nửa cũ rồi thử lại một lần
      try { localStorage.setItem(CHATLOG_KEY, JSON.stringify(list.slice(Math.floor(list.length / 2)))); return true; }
      catch { return false; }
    }
  }

  // Ghi một tin nhắn. role: 'user' | 'ai'.
  function record(role, text) {
    if (role !== "user" && role !== "ai") return;
    let content = typeof text === "string" ? text.trim() : "";
    if (!content) return;
    if (content.length > MAX_TEXT) content = content.slice(0, MAX_TEXT) + "…";
    const list = readAll();
    list.push({ id: newId("m_"), sessionId: sessionId(), ...who(), role, text: mask(content), t: Date.now() });
    if (list.length > MAX_MESSAGES) list.splice(0, list.length - MAX_MESSAGES);
    writeAll(list);
  }

  // Các hàm dành cho Admin
  const getAll = () => readAll();
  function removeSession(sid) { writeAll(readAll().filter((m) => m.sessionId !== sid)); }
  function clearAll() { try { localStorage.removeItem(CHATLOG_KEY); } catch {} }

  return { record, newSession, getAll, removeSession, clearAll, KEY: CHATLOG_KEY };
})();
if (typeof window !== "undefined") window.ChatLog = ChatLog;
