/* Trang "Thông báo" dùng chung cho mọi vai trò nội bộ: hộp thư rộng (thông báo hệ thống + hội thoại), phản hồi Admin,
 * trò chuyện với vai trò khác (có thể gắn mã đơn/tour). Admin có thêm "Gửi thông báo" (người nhận phản hồi riêng cho Admin).
 * Chuông 🔔 trên thanh trên cùng vẫn giữ nguyên; trang này là nơi xem đầy đủ. Được staff.js tự thêm vào menu của mọi vai trò. */
const Inbox = (() => {
  "use strict";
  const { esc, dt, $, $$, get, post, fail, toast, modal, confirmBox } = Staff;
  const ago = iso => {
    const t = new Date(iso).getTime(); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "vừa xong"; if (m < 60) return m + " phút trước";
    if (m < 1440) return Math.round(m / 60) + " giờ trước";
    if (m < 43200) return Math.round(m / 1440) + " ngày trước";
    return dt(iso);
  };
  const initials = n => String(n || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();
  const ROLE_CLS = { admin: "r-admin", cashier: "r-cashier", operator: "r-operator", support: "r-support", content: "r-content", guide: "r-guide" };
  const hashThread = () => { const m = location.hash.match(/^#notifications\/([\w-]+)/); return m ? m[1] : ""; };

  async function compose(ctx, preset) {
    preset = preset || {};
    const dir = await get("/api/messages/recipients");
    const canAnn = dir.canAnnounce;
    const canRemind = ctx && ctx.has && ctx.has("notification:reminder_send");
    const roles = dir.roles.filter(r => r.count > 0);

    const body = `
      ${canAnn ? `
      <div class="seg-group" id="cm-kind" style="margin-bottom:10px">
        <button type="button" data-k="announcement" class="${preset.kind === "chat" || preset.kind === "reminder" ? "" : "active"}">📢 Thông báo</button>
        ${canRemind ? `<button type="button" data-k="reminder" class="${preset.kind === "reminder" ? "active" : ""}">⚠️ Nhắc nhở vi phạm (-200k)</button>` : ""}
        <button type="button" data-k="chat" class="${preset.kind === "chat" ? "active" : ""}">💬 Trò chuyện</button>
      </div>
      <div class="small muted" id="cm-hint" style="margin-bottom:12px;line-height:1.5"></div>
      ` : `<div class="small muted" style="margin-bottom:12px">Tin nhắn nội bộ: mọi người tham gia đều thấy nội dung trao đổi.</div>`}

      <div id="cm-recipient-mode-wrap" style="margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
        <label style="margin:0 0 8px;font-weight:700">🎯 Đối tượng nhận tin:</label>
        <div class="row" style="gap:14px">
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
            <input type="radio" name="cm-target-type" value="all" id="cm-tgt-all">
            <span>📢 Tất cả mọi người (Toàn bộ nhân sự)</span>
          </label>
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
            <input type="radio" name="cm-target-type" value="roles" id="cm-tgt-roles" checked>
            <span>👥 Gửi theo vai trò</span>
          </label>
          <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;margin:0">
            <input type="radio" name="cm-target-type" value="personal" id="cm-tgt-personal">
            <span>👤 Gửi riêng cá nhân</span>
          </label>
        </div>
      </div>

      <div id="cm-role-group" style="margin-bottom:12px">
        <label style="margin-bottom:6px">Chọn các vai trò nhận tin <span class="req-star">*</span></label>
        <div class="chips" id="cm-roles">${roles.map(r => `<label class="chip"><input type="checkbox" value="${esc(r.key)}" ${(preset.roles || []).includes(r.key) ? "checked" : ""}> ${esc(r.name)} <span class="muted">(${r.count})</span></label>`).join("")}</div>
      </div>

      <div id="cm-people-group" style="margin-bottom:12px;display:none">
        <label for="cm-people-search" style="margin-bottom:4px">Tìm và chọn người nhận cụ thể (riêng tài khoản đó nhận) <span class="req-star">*</span></label>
        <input type="text" id="cm-people-search" placeholder="Gõ tên hoặc vai trò để lọc nhanh người nhận..." style="margin-bottom:6px;padding:6px 10px;font-size:13px">
        <select id="cm-people" multiple size="6" style="border-radius:6px">${dir.people.map(p => `<option value="${esc(p.id)}" data-txt="${esc((p.roleName + ' ' + p.name).toLowerCase())}" ${(preset.users || []).includes(p.id) ? "selected" : ""}>${esc(p.roleName)} – ${esc(p.name)}</option>`).join("")}</select>
        <div class="small muted" style="margin-top:4px" id="cm-people-tip">Giữ phím <b>Ctrl</b> (hoặc <b>⌘</b>) để chọn nhiều người. Chỉ riêng người được chọn mới nhận được tin.</div>
      </div>

      <div style="margin-bottom:10px">
        <label for="cm-sub">Tiêu đề <span class="req-star">*</span></label>
        <input id="cm-sub" maxlength="120" value="${esc(preset.subject || "")}" placeholder="VD: Thông báo lịch họp, Nhắc nhở công việc...">
      </div>

      <div style="margin-bottom:10px">
        <label for="cm-ref">Tour / mã đơn liên quan <span class="small muted">(không bắt buộc)</span></label>
        <input id="cm-ref" value="${esc(preset.ref || "")}" placeholder="VD: TRAVEL1004">
      </div>

      <div style="margin-bottom:6px">
        <label for="cm-txt">Nội dung <span class="req-star">*</span></label>
        <textarea id="cm-txt" rows="5" maxlength="2000" placeholder="Nhập nội dung chi tiết..."></textarea>
      </div>
      <div class="field-err" id="cm-err"></div>
    `;

    let kind = preset.kind === "reminder" && canRemind ? "reminder" : (canAnn && preset.kind !== "chat" ? "announcement" : "chat");
    let closeFn = null;

    await modal(canRemind ? "Soạn thông báo / Nhắc nhở" : (canAnn ? "Soạn thông báo" : "Soạn tin nhắn"), body, [
      { label: "Hủy", value: null },
      { label: "Gửi", kind: "primary", value: "ok", validate: ov => {
        const err = $("#cm-err", ov);
        err.textContent = "";

        const targetType = ($("input[name='cm-target-type']:checked", ov) || {}).value || "roles";
        let targetRoles = [];
        let targetUsers = [];

        if (kind === "reminder") {
          targetUsers = Array.from($("#cm-people", ov).selectedOptions).map(o => o.value);
          if (targetUsers.length !== 1) {
            err.textContent = "Thông báo nhắc nhở chỉ gửi cho 1 nhân viên cụ thể (hãy chọn đúng 1 người trong danh sách).";
            return false;
          }
        } else {
          if (targetType === "all") {
            targetRoles = roles.map(r => r.key);
          } else if (targetType === "roles") {
            targetRoles = $$("#cm-roles input:checked", ov).map(i => i.value);
            if (!targetRoles.length) {
              err.textContent = "Vui lòng chọn ít nhất một vai trò nhận tin (hoặc chọn 'Tất cả mọi người').";
              return false;
            }
          } else {
            targetUsers = Array.from($("#cm-people", ov).selectedOptions).map(o => o.value);
            if (!targetUsers.length) {
              err.textContent = "Vui lòng chọn ít nhất một người nhận riêng từ danh sách.";
              return false;
            }
          }
        }

        if (!$("#cm-sub", ov).value.trim()) {
          err.textContent = "Vui lòng nhập tiêu đề.";
          return false;
        }
        if (!$("#cm-txt", ov).value.trim()) {
          err.textContent = "Vui lòng nhập nội dung tin nhắn.";
          return false;
        }

        const btn = $(".acts .primary", ov);
        btn.disabled = true;

        if (kind === "reminder") {
          Staff.post("/api/admin/salaries/remind", {
            staffId: targetUsers[0],
            title: $("#cm-sub", ov).value.trim(),
            reason: $("#cm-txt", ov).value.trim()
          })
            .then(r => {
              closeFn(null);
              Staff.toast("Đã gửi thông báo nhắc nhở, ghi 1 lỗi và trừ 200.000 ₫.", "ok");
              if (preset.onSent) preset.onSent();
            })
            .catch(e => { err.textContent = e.message; btn.disabled = false; });
        } else {
          Staff.post("/api/messages", {
            kind,
            toRoles: targetRoles,
            toUsers: targetUsers,
            subject: $("#cm-sub", ov).value.trim(),
            text: $("#cm-txt", ov).value.trim(),
            ref: $("#cm-ref", ov).value.trim()
          })
            .then(r => {
              closeFn(null);
              if (preset.onSent) preset.onSent(r.thread);
            })
            .catch(e => { err.textContent = e.message; btn.disabled = false; });
        }
        return false;
      } }
    ], { wide: true, sticky: true, onOpen: (ov, close) => {
      closeFn = close;
      const hint = $("#cm-hint", ov);
      const roleGrp = $("#cm-role-group", ov);
      const peopleGrp = $("#cm-people-group", ov);
      const recWrap = $("#cm-recipient-mode-wrap", ov);
      const peopleTip = $("#cm-people-tip", ov);

      const updateTargetVisibility = () => {
        const val = ($("input[name='cm-target-type']:checked", ov) || {}).value || "roles";
        if (kind === "reminder") {
          if (roleGrp) roleGrp.style.display = "none";
          if (peopleGrp) peopleGrp.style.display = "block";
          if (recWrap) recWrap.style.display = "none";
          if (peopleTip) peopleTip.innerHTML = "<b class='bad'>Lưu ý:</b> Chọn đúng 1 nhân viên vi phạm để gửi nhắc nhở và tự động trừ 200k lương.";
        } else {
          if (recWrap) recWrap.style.display = "block";
          if (val === "all") {
            if (roleGrp) roleGrp.style.display = "none";
            if (peopleGrp) peopleGrp.style.display = "none";
          } else if (val === "roles") {
            if (roleGrp) roleGrp.style.display = "block";
            if (peopleGrp) peopleGrp.style.display = "none";
          } else {
            if (roleGrp) roleGrp.style.display = "none";
            if (peopleGrp) peopleGrp.style.display = "block";
            if (peopleTip) peopleTip.innerHTML = "Giữ phím <b>Ctrl</b> (hoặc <b>⌘</b>) để chọn nhiều người. <b>Chỉ riêng tài khoản được chọn mới nhận được tin.</b>";
          }
        }
      };

      $$("input[name='cm-target-type']", ov).forEach(r => r.onchange = updateTargetVisibility);

      const searchInput = $("#cm-people-search", ov);
      if (searchInput) {
        searchInput.oninput = () => {
          const kw = searchInput.value.toLowerCase().trim();
          $$("#cm-people option", ov).forEach(opt => {
            const txt = opt.dataset.txt || opt.textContent.toLowerCase();
            opt.style.display = (!kw || txt.includes(kw)) ? "" : "none";
          });
        };
      }

      const sync = () => {
        if (hint) {
          if (kind === "reminder") {
            hint.innerHTML = "<span class='badge bad'>⚠️ Nhắc nhở vi phạm:</span> Ghi nhận <b>1 lỗi</b> vào hồ sơ và tự động <b>trừ 200.000 ₫</b> tiền lương/ví thu nhập của nhân viên được chọn theo quy chế.";
          } else if (kind === "announcement") {
            hint.textContent = "📢 Thông báo rộng rãi: Người nhận chỉ thấy thông báo và phản hồi RIÊNG cho bạn (không thấy các câu trả lời của nhau).";
          } else {
            hint.textContent = "💬 Hội thoại nhóm: Mọi người tham gia đều thấy toàn bộ các tin nhắn trao đổi.";
          }
        }
        $$("#cm-kind button", ov).forEach(b => b.classList.toggle("active", b.dataset.k === kind));
        updateTargetVisibility();
      };

      $$("#cm-kind button", ov).forEach(b => b.onclick = () => { kind = b.dataset.k; sync(); });
      sync();
    } });
  }

  async function render(el, ctx) {
    const me = ctx.user;
    let notis = [], threads = [], filter = "all", q = "", selected = hashThread() ? "t:" + hashThread() : "", timer = null;
    let checkedIds = new Set();

    el.innerHTML = `
      <div class="inbox-bar toolbar">
        <div class="seg-group" id="ib-f">
          <button data-f="all" class="active">Tất cả</button>
          <button data-f="unread">Chưa đọc</button>
          <button data-f="chat">Hội thoại</button>
          <button data-f="sys">Hệ thống</button>
        </div>
        <input type="search" id="ib-q" placeholder="Tìm trong thông báo…" aria-label="Tìm kiếm">
        <div class="grow"></div>
        <button class="btn sm" id="ib-all">✓ Đọc hết</button>
        ${ctx.has("notify:send") ? "" : '<button class="btn sm" id="ib-admin">↩ Phản hồi Admin</button>'}
        <button class="btn primary" id="ib-new">${ctx.has("notify:send") ? "📢 Gửi thông báo / soạn tin" : "✉️ Soạn tin"}</button>
      </div>

      <div class="inbox">
        <div class="inbox-list card" id="ib-list-container">
          <div class="inbox-batch-bar row" style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--bg);gap:10px;align-items:center">
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;cursor:pointer;margin:0">
              <input type="checkbox" id="ib-chk-all"> <span>Chọn tất cả</span>
            </label>
            <div class="grow"></div>
            <button class="btn bad sm" id="ib-del-selected" style="display:none">🗑 Xóa đã chọn (0)</button>
            <button class="btn sm" id="ib-del-all" title="Xóa toàn bộ hộp thư">🗑 Xóa tất cả</button>
          </div>
          <div id="ib-list" style="overflow:auto;max-height:calc(100vh - 260px)"></div>
        </div>
        <div class="inbox-view card" id="ib-view"><div class="empty">Chọn một thông báo hoặc hội thoại để xem.</div></div>
      </div>
    `;

    const root = $(".inbox", el);

    const items = () => {
      const a = notis.filter(n => !/^thr-/.test(n.key || "")).map(n => ({ id: "n:" + n.id, kind: "sys", title: n.title, text: n.body, at: n.createdAt, unread: !n.read, ref: n }));
      const b = threads.map(t => ({ id: "t:" + t.id, kind: "chat", title: t.subject, text: (t.lastFrom ? t.lastFrom + ": " : "") + t.lastText, at: t.lastAt, unread: t.unread > 0, n: t.unread, ref: t, ann: t.kind === "announcement" }));
      return a.concat(b).filter(x => (filter === "all" || (filter === "unread" && x.unread) || x.kind === filter) && (!q || (x.title + " " + x.text).toLowerCase().includes(q))).sort((x, y) => new Date(y.at) - new Date(x.at));
    };

    function updateBatchBar() {
      const btnSel = $("#ib-del-selected", el);
      const chkAll = $("#ib-chk-all", el);
      const curList = items();
      const count = checkedIds.size;

      if (btnSel) {
        btnSel.style.display = count > 0 ? "inline-block" : "none";
        btnSel.textContent = `🗑 Xóa đã chọn (${count})`;
      }
      if (chkAll) {
        chkAll.checked = curList.length > 0 && curList.every(x => checkedIds.has(x.id));
      }
    }

    function drawList() {
      const list = items(), box = $("#ib-list", el);
      box.innerHTML = list.length ? list.map(x => `
        <div class="ib-item-wrap ${x.id === selected ? "sel" : ""}" style="display:flex;align-items:center;border-bottom:1px solid var(--border)">
          <div style="padding:10px 8px 10px 12px;display:flex;align-items:center">
            <input type="checkbox" class="ib-chk" data-cid="${esc(x.id)}" ${checkedIds.has(x.id) ? "checked" : ""} style="width:16px;height:16px;cursor:pointer">
          </div>
          <button class="ib-item ${x.unread ? "unread" : ""}" data-id="${esc(x.id)}" style="flex:1;border-bottom:0;padding-left:4px">
            <span class="ib-ic ${x.kind}">${x.kind === "sys" ? "🔔" : x.ann ? "📢" : "💬"}</span>
            <span class="ib-body">
              <span class="ib-t">${esc(x.title)}${x.n > 1 ? ` <span class="badge bad">${x.n}</span>` : ""}</span>
              <span class="ib-s">${esc(x.text)}</span>
            </span>
            <span class="ib-time">${esc(ago(x.at))}${x.unread ? '<i class="dot"></i>' : ""}</span>
          </button>
        </div>
      `).join("") : '<div class="empty">Không có thông báo nào.</div>';

      $$(".ib-item", box).forEach(b => b.onclick = () => select(b.dataset.id));

      $$(".ib-chk", box).forEach(chk => {
        chk.onchange = (e) => {
          e.stopPropagation();
          const id = chk.dataset.cid;
          if (chk.checked) checkedIds.add(id);
          else checkedIds.delete(id);
          updateBatchBar();
        };
      });

      updateBatchBar();
    }

    async function loadAll() {
      const [n, t] = await Promise.all([get("/api/notifications"), get("/api/messages")]);
      notis = n.notifications || [];
      threads = t.threads || [];
      drawList();
    }

    function bubbles(t) {
      return t.messages.map(m => {
        const mine = m.from.id === me.id;
        return `<div class="bub ${mine ? "mine" : ""}"><span class="av ${ROLE_CLS[m.from.role] || ""}" title="${esc(m.from.roleName)}">${esc(initials(m.from.name))}</span>
          <div class="bub-in"><div class="bub-h"><b>${esc(mine ? "Bạn" : m.from.name)}</b> <span class="muted small">${esc(m.from.roleName)} · ${esc(dt(m.at))}${m.to ? " · <i>riêng tư</i>" : ""}</span></div><div class="bub-t">${esc(m.text).replace(/\n/g, "<br>")}</div></div></div>`;
      }).join("");
    }

    async function showThread(id, keepScroll) {
      const t = (await get("/api/messages/" + encodeURIComponent(id))).thread, view = $("#ib-view", el);
      const isAdminSender = t.broadcast && t.mine;
      const to = isAdminSender && t.replyTargets.length ? `<select id="rp-to" title="Gửi cho"><option value="">Tất cả người nhận</option>${t.replyTargets.map(p => `<option value="${esc(p.id)}">Riêng: ${esc(p.name)}</option>`).join("")}</select>` : "";
      const who = t.broadcast && !t.mine ? `Từ ${esc(t.createdByName)} · bạn trả lời riêng cho người gửi` : t.broadcast ? `Đã gửi tới ${t.others.length} người` : t.others.map(p => esc(p.name)).join(", ");

      view.innerHTML = `
        <div class="ibv-h">
          <button class="btn sm ibv-back" id="ibv-back">← Danh sách</button>
          <div style="flex:1">
            <h2>${t.kind === "announcement" ? "📢 " : ""}${esc(t.subject)}</h2>
            <div class="small muted">${who}</div>
            ${t.ref ? `<span class="badge info" title="Tour liên quan" style="margin-top:4px">🧳 ${esc(t.ref.payCode)} · ${esc(t.ref.tourName)}</span>` : ""}
          </div>
          <button class="btn bad sm" id="tv-del" title="Xóa hội thoại này">🗑 Xóa</button>
        </div>
        <div class="ibv-msgs" id="ibv-msgs">${bubbles(t)}</div>
        <div class="ibv-reply">
          ${to}
          <textarea id="rp-txt" rows="2" maxlength="2000" placeholder="${t.broadcast && !t.mine ? "Phản hồi cho " + esc(t.createdByName) + "…" : "Nhập tin nhắn… (Ctrl+Enter để gửi)"}"></textarea>
          <button class="btn primary" id="rp-send">Gửi</button>
        </div>
      `;

      root.classList.add("open");
      const msgs = $("#ibv-msgs", view);
      if (!keepScroll) msgs.scrollTop = msgs.scrollHeight;

      $("#ibv-back", view).onclick = () => { root.classList.remove("open"); selected = ""; drawList(); };

      $("#tv-del", view).onclick = async () => {
        if (await confirmBox("Xóa hội thoại", "Bạn có chắc chắn muốn xóa hội thoại này khỏi hộp thư của mình?", "bad")) {
          await post(`/api/messages/${encodeURIComponent(id)}/delete`, {});
          selected = "";
          checkedIds.delete("t:" + id);
          root.classList.remove("open");
          view.innerHTML = '<div class="empty">Đã xóa hội thoại.</div>';
          await loadAll();
          toast("Đã xóa hội thoại thành công.", "ok");
        }
      };

      const send = async () => {
        const txt = $("#rp-txt", view).value.trim();
        if (!txt) return;
        const btn = $("#rp-send", view);
        btn.disabled = true;
        try {
          await post(`/api/messages/${encodeURIComponent(id)}/reply`, { text: txt, to: ($("#rp-to", view) || {}).value || "" });
          await loadAll();
          await showThread(id);
        } catch (e) {
          fail(e);
          btn.disabled = false;
        }
      };

      $("#rp-send", view).onclick = send;
      $("#rp-txt", view).addEventListener("keydown", e => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          send();
        }
      });
      await loadAll();
    }

    async function showNoti(n) {
      const view = $("#ib-view", el);
      view.innerHTML = `
        <div class="ibv-h">
          <button class="btn sm ibv-back" id="ibv-back">← Danh sách</button>
          <div style="flex:1">
            <h2>${esc(n.title)}</h2>
            <div class="small muted">${esc(dt(n.createdAt))}</div>
          </div>
          <button class="btn bad sm" id="nv-del">🗑 Xóa</button>
        </div>
        <div class="ibv-note">${esc(n.body).replace(/\n/g, "<br>")}</div>
        ${n.link ? '<div class="row" style="gap:8px;padding:0 20px 20px"><button class="btn primary" id="nv-open">Mở nội dung liên quan →</button></div>' : ""}
      `;

      root.classList.add("open");
      $("#ibv-back", view).onclick = () => { root.classList.remove("open"); selected = ""; drawList(); };

      const o = $("#nv-open", view);
      if (o) {
        o.onclick = () => {
          const l = n.link, m = l.match(/^([a-z]+\.html)?#?(.*)$/);
          if (m && l.includes(".html") && !location.pathname.endsWith("/" + m[1])) location.href = l;
          else if (m) location.hash = m[2] || "";
        };
      }

      $("#nv-del", view).onclick = async () => {
        await post("/api/notifications/delete", { ids: [n.id] });
        selected = "";
        checkedIds.delete("n:" + n.id);
        root.classList.remove("open");
        view.innerHTML = '<div class="empty">Đã xóa thông báo.</div>';
        await loadAll();
        toast("Đã xóa thông báo thành công.", "ok");
      };

      if (!n.read) {
        await post("/api/notifications/read", { ids: [n.id] });
        await loadAll();
      }
    }

    async function select(id) {
      selected = id;
      drawList();
      try {
        if (id.startsWith("t:")) {
          history.replaceState(null, "", "#notifications/" + id.slice(2));
          await showThread(id.slice(2));
        } else {
          history.replaceState(null, "", "#notifications");
          const n = notis.find(x => "n:" + x.id === id);
          if (n) await showNoti(n);
        }
      } catch (e) {
        fail(e);
      }
    }

    // Sự kiện checkbox chọn tất cả
    $("#ib-chk-all", el).onchange = (e) => {
      const curList = items();
      if (e.target.checked) {
        curList.forEach(x => checkedIds.add(x.id));
      } else {
        curList.forEach(x => checkedIds.delete(x.id));
      }
      drawList();
    };

    // Sự kiện Xóa đã chọn
    $("#ib-del-selected", el).onclick = async () => {
      const count = checkedIds.size;
      if (!count) return;
      if (await confirmBox("Xóa các mục đã chọn", `Bạn có chắc muốn xóa vĩnh viễn <b>${count}</b> mục thông báo/tin nhắn đã chọn?`, "bad")) {
        const notiIds = [];
        const threadIds = [];
        checkedIds.forEach(id => {
          if (id.startsWith("n:")) notiIds.push(id.slice(2));
          else if (id.startsWith("t:")) threadIds.push(id.slice(2));
        });

        const tasks = [];
        if (notiIds.length > 0) tasks.push(post("/api/notifications/delete", { ids: notiIds }));
        if (threadIds.length > 0) tasks.push(post("/api/messages/delete", { ids: threadIds }));
        await Promise.all(tasks);

        checkedIds.clear();
        selected = "";
        $("#ib-view", el).innerHTML = '<div class="empty">Đã xóa các mục đã chọn.</div>';
        await loadAll();
        toast(`Đã xóa thành công ${count} mục.`, "ok");
      }
    };

    // Sự kiện Xóa tất cả
    $("#ib-del-all", el).onclick = async () => {
      const totalCount = notis.length + threads.length;
      if (!totalCount) {
        toast("Hộp thư của bạn đang trống.", "info");
        return;
      }
      if (await confirmBox("Xóa toàn bộ hộp thư", `Bạn có chắc muốn <b>XÓA TẤT CẢ</b> thông báo và tin nhắn (${totalCount} mục)?<br><span class="bad">Hành động này không thể hoàn tác!</span>`, "bad")) {
        await Promise.all([
          post("/api/notifications/delete", { ids: [] }),
          post("/api/messages/delete", { all: true, ids: [] })
        ]);
        checkedIds.clear();
        selected = "";
        $("#ib-view", el).innerHTML = '<div class="empty">Hộp thư trống.</div>';
        await loadAll();
        toast("Đã dọn sạch toàn bộ thông báo và tin nhắn.", "ok");
      }
    };

    $$("#ib-f button", el).forEach(b => b.onclick = () => {
      filter = b.dataset.f;
      $$("#ib-f button", el).forEach(x => x.classList.toggle("active", x === b));
      drawList();
    });

    let qt;
    $("#ib-q", el).addEventListener("input", e => {
      clearTimeout(qt);
      qt = setTimeout(() => {
        q = e.target.value.trim().toLowerCase();
        drawList();
      }, 200);
    });

    $("#ib-all", el).onclick = async () => {
      await post("/api/notifications/read", {});
      await loadAll();
      toast("Đã đánh dấu đọc hết thông báo.", "ok");
    };

    const sent = async t => {
      toast("Đã gửi tin nhắn / thông báo thành công.", "ok");
      await loadAll();
      if (t && t.id) await select("t:" + t.id);
    };

    $("#ib-new", el).onclick = () => compose(ctx, { kind: ctx.has("notify:send") ? "announcement" : "chat", onSent: sent }).catch(fail);
    const ab = $("#ib-admin", el);
    if (ab) ab.onclick = () => compose(ctx, { kind: "chat", roles: ["admin"], subject: "Phản hồi gửi Admin", onSent: sent }).catch(fail);

    await loadAll();
    if (selected) await select(selected);
    timer = setInterval(() => {
      if (!document.body.contains(el) && !document.contains($("#ib-list"))) {
        clearInterval(timer);
        return;
      }
      loadAll().catch(() => {});
    }, 20000);
  }

  function section() {
    return { id: "notifications", label: "Thông báo", icon: "📬", render, async badge() { return (await get("/api/notifications")).unread; } };
  }
  return { section };
})();
window.Inbox = Inbox;
