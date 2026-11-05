/* Shared public-review tools: image upload, galleries and member replies. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  async function compress(file) {
    const src = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(src.width, src.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(src.width * scale)); canvas.height = Math.max(1, Math.round(src.height * scale));
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height); src.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  }
  async function upload(files) {
    const out = [];
    for (const file of Array.from(files || []).slice(0, 5)) {
      if (!file.type.startsWith("image/")) throw new Error("Chỉ chọn tệp ảnh.");
      const res = await Api.post("/api/upload/review", { dataUrl: await compress(file) });
      if (!res || !res.ok) throw new Error(res && res.data && res.data.msg || "Không tải được ảnh.");
      out.push(res.data.path);
    }
    return out;
  }
  function gallery(images) {
    const list = Array.isArray(images) ? images : [];
    return list.length ? '<div class="review-gallery">' + list.map((p) => '<a href="' + esc(p) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(p) + '" alt="Ảnh đính kèm bình luận"></a>').join("") + '</div>' : "";
  }
  function replies(rootId, list) {
    const arr = Array.isArray(list) ? list : [];
    const logged = !!(window.Auth && Auth.currentUser && Auth.currentUser());
    const byId = new Map(arr.map((r) => [String(r.id), r]));
    const items = arr.map((r) => {
      const target = r.replyToId && byId.get(String(r.replyToId));
      return '<div class="review-community-reply"><b>' + esc(r.name || "Thành viên") + '</b>' + (target ? '<small> · trả lời ' + esc(target.name || "Thành viên") + '</small>' : '') + '<p>' + esc(r.content || "") + '</p>' + gallery(r.images) + (logged ? '<button type="button" class="review-reply-link" data-root="' + esc(rootId) + '" data-reply-to="' + esc(r.id) + '">Trả lời</button>' : '<button type="button" class="review-login-reply">Đăng nhập để trả lời</button>') + '</div>';
    }).join("");
    return '<div class="review-community-thread">' + items + (logged ? form(rootId, "") : '<button type="button" class="review-login-reply">Đăng nhập để trả lời</button>') + '</div>';
  }
  function form(rootId, replyTo) {
    return '<form class="review-community-form" data-root="' + esc(rootId) + '" data-reply-to="' + esc(replyTo) + '"><textarea name="content" maxlength="1000" minlength="3" required placeholder="Viết phản hồi… (3–1000 ký tự)"></textarea><div class="review-community-tools"><label>Ảnh (tối đa 5) <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple></label><button class="btn btn-outline" type="submit">Gửi phản hồi</button><span role="status"></span></div></form>';
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".review-login-reply")) {
      if (window.Auth && Auth.openLoginModal) Auth.openLoginModal();
      else window.location.href = "#/login";
      return;
    }
    const b = e.target.closest(".review-reply-link"); if (!b) return;
    const thread = b.closest(".review-community-thread"); if (!thread) return;
    thread.querySelector(".review-replying")?.remove();
    const holder = document.createElement("div"); holder.className = "review-replying"; holder.innerHTML = form(b.dataset.root, b.dataset.replyTo);
    b.after(holder); holder.querySelector("textarea").focus();
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest(".review-community-form"); if (!f) return;
    e.preventDefault(); const button = f.querySelector("button[type=submit]"), status = f.querySelector('[role="status"]');
    button.disabled = true; status.textContent = "Đang gửi…";
    try {
      const images = await upload(f.elements.images.files);
      const res = await Api.post("/api/reviews/" + encodeURIComponent(f.dataset.root) + "/replies", { content: f.elements.content.value.trim(), replyToId: f.dataset.replyTo || undefined, images });
      if (!res || !res.ok) throw new Error(res && res.data && res.data.msg || "Không gửi được phản hồi.");
      window.dispatchEvent(new CustomEvent("review-community:posted", { detail: { rootId: f.dataset.root } }));
    } catch (err) { status.textContent = err.message || "Không gửi được phản hồi."; button.disabled = false; }
  });
  window.ReviewCommunity = { gallery, replies, upload };
})();
