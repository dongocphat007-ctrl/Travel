/**
 * admin-chat.js — Tab "Chat AI" trong trang Admin (JS thuần, không server).
 * Xem câu hỏi của người dùng + câu trả lời của AI, tìm kiếm, thống kê chủ đề,
 * tải về JSON và xoá. Dữ liệu đọc từ localStorage qua ChatLog (js/chat-log.js).
 * Chỉ Admin mới thấy tab này (admin.js kiểm tra role === 'admin').
 */
const AdminChat = (() => {

  const state = {
    messages: [],
    total: 0,
    q: "",
    sel: null,
    view: "sessions", // 'sessions' | 'pairs'
    onlyUnanswered: false,
    loadedAt: 0,
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (t) => (t ? new Date(t).toLocaleString("vi-VN") : "—");
  const toast = (msg, type) => { try { showToast(msg, type || "info"); } catch { /* không có toast */ } };

  // Gom tin nhắn thành các cuộc trò chuyện
  function sessions() {
    const map = new Map();
    for (const m of state.messages) {
      let s = map.get(m.sessionId);
      if (!s) {
        s = { sid: m.sessionId, userName: m.userName || "Khách", userId: m.userId, msgs: [], last: 0 };
        map.set(m.sessionId, s);
      }
      s.msgs.push(m);
      if (m.t > s.last) s.last = m.t;
      if (m.userName && m.userName !== "Khách") { s.userName = m.userName; s.userId = m.userId; }
    }
    const list = [...map.values()];
    list.forEach((s) => s.msgs.sort((a, b) => a.t - b.t));
    list.sort((a, b) => b.last - a.last);
    return list;
  }

  // Ghép từng câu hỏi của user với câu trả lời AI ngay sau nó
  function pairs() {
    const out = [];
    for (const s of sessions()) {
      let cur = null;
      for (const m of s.msgs) {
        if (m.role === "user") {
          cur = { sid: s.sid, userName: s.userName, userId: s.userId, q: m.text, tQ: m.t, a: "", tA: null };
          out.push(cur);
        } else if (cur) {
          cur.a = cur.a ? cur.a + "\n" + m.text : m.text;
          if (!cur.tA) cur.tA = m.t;
        }
      }
    }
    out.sort((a, b) => b.tQ - a.tQ);
    return out;
  }

  function filteredPairs() {
    const q = state.q.trim().toLowerCase();
    return pairs().filter((p) =>
      (!state.onlyUnanswered || !p.a) &&
      (!q || p.userName.toLowerCase().includes(q) || p.q.toLowerCase().includes(q) || p.a.toLowerCase().includes(q)));
  }

  function pairsHtml(list) {
    if (!list.length) return '<div style="padding:16px;color:var(--muted,#64748b);font-size:.88rem">Không có câu hỏi nào khớp.</div>';
    return list.map((p) => `<div class="acx-pair">
        <div class="acx-pmeta"><b>${esc(p.userName)}</b> · ${esc(fmt(p.tQ))}${p.a ? "" : ' <span class="acx-warn">⚠ chưa có trả lời</span>'}</div>
        <div class="acx-q">❓ ${esc(p.q)}</div>
        <div class="acx-a">${p.a ? "🤖 " + esc(p.a) : "<i>AI chưa trả lời (lỗi mạng hoặc người dùng thoát giữa chừng)</i>"}</div>
        <div><button class="acx-btn" data-chat-act="select-from-pair" data-sid="${esc(p.sid)}">Xem cả cuộc trò chuyện</button></div>
      </div>`).join("");
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    const all = sessions();
    if (!q) return all;
    return all.filter((s) => s.userName.toLowerCase().includes(q) || s.msgs.some((m) => m.text.toLowerCase().includes(q)));
  }

  // Chủ đề được hỏi nhiều (đếm cụm 2 âm tiết, vd "bún chả", "hà nội")
  const STOP = new Set(("cho tôi muốn các của và là có không những một được này với bao nhiêu thế nào đi ở gì giúp mình " +
    "bạn hãy xin chào ạ nhé nha thì sẽ đang cần biết gợi ý nhất rất quá cũng ra vào lên xuống từ đến hơn hết mới " +
    "như để khi nếu thể làm nên trong ngày đêm lịch trình").split(" "));
  function topics() {
    const pair = new Map();
    const one = new Map();
    for (const m of state.messages) {
      if (m.role !== "user") continue;
      const w = (m.text.toLowerCase().match(/\p{L}{2,}/gu) || []);
      for (let i = 0; i < w.length; i++) {
        if (STOP.has(w[i])) continue;
        one.set(w[i], (one.get(w[i]) || 0) + 1);
        if (i + 1 < w.length && !STOP.has(w[i + 1])) {
          const k = w[i] + " " + w[i + 1];
          pair.set(k, (pair.get(k) || 0) + 1);
        }
      }
    }
    const top = (mp, min) => [...mp].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]);
    let out = top(pair, 2).slice(0, 10);
    if (out.length < 6) out = out.concat(top(one, 2).filter(([k]) => !out.some(([p]) => p.includes(k))).slice(0, 10 - out.length));
    return out;
  }

  // Giao diện
  function ensureStyle() {
    if (document.getElementById("adm-chat-style")) return;
    const st = document.createElement("style");
    st.id = "adm-chat-style";
    st.textContent = `
      .acx-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
      .acx-bar .grow{flex:1;min-width:160px}
      .acx-in{width:100%;padding:9px 12px;border:1px solid var(--border,#e2e8f0);border-radius:10px;font:inherit;background:var(--surface,#fff);color:var(--text,#0f172a)}
      .acx-btn{padding:8px 12px;border:1px solid var(--border,#e2e8f0);border-radius:10px;background:var(--surface,#fff);color:var(--text,#0f172a);cursor:pointer;font:inherit;font-size:.85rem}
      .acx-btn:hover{background:rgba(26,115,232,.08)}
      .acx-btn.danger{color:#b91c1c}.acx-btn.primary{background:#1a73e8;color:#fff;border-color:#1a73e8}
      .acx-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
      .acx-chip{background:rgba(26,115,232,.08);border-radius:99px;padding:5px 12px;font-size:.8rem}
      .acx-topics{margin-bottom:12px;font-size:.82rem;color:var(--muted,#64748b)}
      .acx-topics span{display:inline-block;margin:2px 6px 2px 0;padding:2px 9px;border-radius:99px;background:rgba(0,0,0,.05);color:var(--text,#0f172a)}
      .acx-grid{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:14px;min-height:340px}
      @media(max-width:760px){.acx-grid{grid-template-columns:1fr}}
      .acx-list{border:1px solid var(--border,#e2e8f0);border-radius:12px;overflow:auto;max-height:560px;background:var(--surface,#fff)}
      .acx-item{padding:10px 12px;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer}
      .acx-item:hover{background:rgba(26,115,232,.05)}.acx-item.on{background:rgba(26,115,232,.12)}
      .acx-item b{display:block;font-size:.88rem}.acx-item small{color:var(--muted,#64748b);display:block}
      .acx-prev{font-size:.82rem;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .acx-detail{border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:12px;background:var(--surface,#fff);max-height:560px;overflow:auto}
      .acx-msg{margin:8px 0;display:flex}.acx-msg.user{justify-content:flex-end}
      .acx-bub{max-width:82%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;font-size:.88rem;line-height:1.45}
      .acx-msg.user .acx-bub{background:#1a73e8;color:#fff}.acx-msg.ai .acx-bub{background:rgba(0,0,0,.06)}
      .acx-time{font-size:.68rem;opacity:.7;margin-top:3px}
      .acx-pairs{border:1px solid var(--border,#e2e8f0);border-radius:12px;background:var(--surface,#fff);max-height:640px;overflow:auto}
      .acx-pair{padding:12px 14px;border-bottom:1px solid var(--border,#e2e8f0)}
      .acx-pmeta{font-size:.78rem;color:var(--muted,#64748b);margin-bottom:6px}
      .acx-warn{color:#b45309;font-weight:600}
      .acx-q{background:rgba(26,115,232,.1);padding:8px 12px;border-radius:10px;margin-bottom:6px;white-space:pre-wrap;word-break:break-word;font-size:.88rem}
      .acx-a{background:rgba(0,0,0,.05);padding:8px 12px;border-radius:10px;margin-bottom:8px;white-space:pre-wrap;word-break:break-word;font-size:.88rem;max-height:220px;overflow:auto}
      .acx-btn.on{background:#1a73e8;color:#fff;border-color:#1a73e8}
      .acx-note{padding:14px;border-radius:12px;background:rgba(245,158,11,.12);font-size:.88rem;line-height:1.5}
      .acx-note code{background:rgba(0,0,0,.08);padding:1px 6px;border-radius:5px}`;
    document.head.appendChild(st);
  }

  function listHtml(list) {
    if (!list.length) return '<div style="padding:16px;color:var(--muted,#64748b);font-size:.88rem">Chưa có cuộc trò chuyện nào.</div>';
    return list.map((s) => {
      const first = s.msgs.find((m) => m.role === "user");
      return `<div class="acx-item ${state.sel === s.sid ? "on" : ""}" data-chat-act="select" data-sid="${esc(s.sid)}">
        <b>${esc(s.userName)}</b>
        <small>${esc(fmt(s.last))} · ${s.msgs.length} tin</small>
        <div class="acx-prev">${esc(first ? first.text : "—")}</div></div>`;
    }).join("");
  }

  function detailHtml(list) {
    const s = list.find((x) => x.sid === state.sel);
    if (!s) return '<div style="color:var(--muted,#64748b);padding:12px">← Chọn một cuộc trò chuyện để xem chi tiết.</div>';
    return `<div class="acx-bar">
        <div class="grow"><b>${esc(s.userName)}</b> <small style="color:var(--muted,#64748b)">· ${s.msgs.length} tin · bắt đầu ${esc(fmt(s.msgs[0].t))}</small></div>
        <button class="acx-btn" data-chat-act="dl-one" data-sid="${esc(s.sid)}">⬇ Tải JSON</button>
        <button class="acx-btn danger" data-chat-act="del-one" data-sid="${esc(s.sid)}">🗑 Xoá</button>
      </div>` +
      s.msgs.map((m) => `<div class="acx-msg ${m.role === "user" ? "user" : "ai"}"><div>
          <div class="acx-bub">${esc(m.text)}</div>
          <div class="acx-time" style="text-align:${m.role === "user" ? "right" : "left"}">${m.role === "user" ? esc(s.userName) : "Travel AI"} · ${esc(fmt(m.t))}</div>
        </div></div>`).join("");
  }

  function paintBody() {
    if (state.view === "pairs") {
      const pl = document.getElementById("acx-pairs");
      if (pl) pl.innerHTML = pairsHtml(filteredPairs());
      return;
    }
    const list = filtered();
    if (state.sel && !list.some((s) => s.sid === state.sel)) state.sel = null;
    const l = document.getElementById("acx-list");
    const d = document.getElementById("acx-detail");
    if (l) l.innerHTML = listHtml(list);
    if (d) d.innerHTML = detailHtml(list);
  }

  function paint() {
    const root = document.getElementById("adm-chat-root");
    if (!root) return;
    ensureStyle();
    const all = sessions();
    const today = new Date().toDateString();
    const todayCount = state.messages.filter((m) => new Date(m.t).toDateString() === today && m.role === "user").length;
    const tp = topics();
    root.innerHTML = `
      <div class="acx-bar">
        <input class="acx-in grow" id="acx-search" data-chat-search placeholder="🔍 Tìm theo từ khoá hoặc tên người dùng…" value="${esc(state.q)}">
        <button class="acx-btn ${state.view === "sessions" ? "on" : ""}" data-chat-act="view-sessions">💬 Hội thoại</button>
        <button class="acx-btn ${state.view === "pairs" ? "on" : ""}" data-chat-act="view-pairs">❓ Hỏi – Đáp</button>
        ${state.view === "pairs" ? `<button class="acx-btn ${state.onlyUnanswered ? "on" : ""}" data-chat-act="toggle-unanswered">⚠ Chưa trả lời</button>
        <button class="acx-btn" data-chat-act="dl-pairs">⬇ Tải Hỏi–Đáp (JSON)</button>` : ""}
        <button class="acx-btn" data-chat-act="reload">↻ Tải lại</button>
        <button class="acx-btn" data-chat-act="dl-all">⬇ Tải tất cả (JSON)</button>
        <button class="acx-btn danger" data-chat-act="del-all">🗑 Xoá tất cả</button>
      </div>
      <div class="acx-chips">
        <span class="acx-chip">💬 ${state.messages.length} tin nhắn</span>
        <span class="acx-chip">🧑‍🤝‍🧑 ${all.length} cuộc trò chuyện</span>
        <span class="acx-chip">❓ ${todayCount} câu hỏi hôm nay</span>
      </div>
      ${tp.length ? `<div class="acx-topics">🔥 Hay được hỏi: ${tp.map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join("")}</div>` : ""}
      ${state.view === "pairs"
        ? '<div class="acx-pairs" id="acx-pairs"></div>'
        : '<div class="acx-grid"><div class="acx-list" id="acx-list"></div><div class="acx-detail" id="acx-detail"></div></div>'}`;
    paintBody();
  }

  // Đọc dữ liệu (localStorage)
  function load() {
    state.messages = ChatLog.getAll();
    state.total = state.messages.length;
    state.loadedAt = Date.now();
    paint();
  }

  function download(name, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  async function act(name, el) {
    const sid = el && el.dataset ? el.dataset.sid : null;
    switch (name) {
      case "reload": return load();
      case "view-sessions": state.view = "sessions"; return paint();
      case "view-pairs": state.view = "pairs"; return paint();
      case "toggle-unanswered": state.onlyUnanswered = !state.onlyUnanswered; return paint();
      case "select-from-pair": state.view = "sessions"; state.sel = sid; state.q = ""; return paint();
      case "dl-pairs": {
        const list = filteredPairs().map((p) => ({
          user: p.userName, userId: p.userId, sessionId: p.sid,
          question: p.q, askedAt: new Date(p.tQ).toISOString(),
          answer: p.a || null, answeredAt: p.tA ? new Date(p.tA).toISOString() : null,
        }));
        download(`Travel_hoi_dap_${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), count: list.length, pairs: list }, null, 1));
        return;
      }
      case "select": state.sel = sid; return paintBody();
      case "dl-one": {
        const s = sessions().find((x) => x.sid === sid);
        if (s) download(`Travel_chat_${s.userName.replace(/[^\w-]+/g, "_")}_${today()}.json`,
          JSON.stringify({ exportedAt: new Date().toISOString(), user: s.userName, messages: s.msgs }, null, 1));
        return;
      }
      case "dl-all": {
        download(`Travel_chat_logs_${today()}.json`,
          JSON.stringify({ exportedAt: new Date().toISOString(), count: state.messages.length, messages: state.messages }, null, 1));
        return;
      }
      case "del-one": {
        if (!confirm("Xoá vĩnh viễn cuộc trò chuyện này?")) return;
        ChatLog.removeSession(sid);
        state.sel = null; toast("🗑️ Đã xoá cuộc trò chuyện", "info"); load();
        return;
      }
      case "del-all": {
        const ans = prompt("Xoá TOÀN BỘ tin nhắn? Hành động này không hoàn tác.\nGõ XOA để xác nhận:");
        if (ans !== "XOA") return;
        ChatLog.clearAll();
        state.sel = null; toast("🗑️ Đã xoá toàn bộ", "info"); load();
      }
    }
  }

  // Một bộ lắng nghe duy nhất cho toàn tab (vì Admin vẽ lại HTML liên tục)
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-chat-act]");
    if (el) act(el.dataset.chatAct, el);
  });
  document.addEventListener("input", (e) => {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-chat-search")) {
      state.q = e.target.value;
      paintBody();
    }
  });

  // Admin gọi hàm này khi vẽ tab: trả về khung HTML rồi tự tải dữ liệu.
  function renderTab() {
    setTimeout(() => { paint(); load(); }, 0);
    return '<div id="adm-chat-root"><div class="acx-note">⏳ Đang tải…</div></div>';
  }

  return { renderTab, _state: state };
})();
if (typeof window !== "undefined") window.AdminChat = AdminChat;
