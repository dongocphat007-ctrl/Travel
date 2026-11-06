/* Biên tập nội dung: bản nháp tour (chờ Admin duyệt), món đặc sản, banner, kiểm duyệt đánh giá. Không sửa giá/HDV/sức chứa, không thấy đơn hàng hay tiền. */
(() => {
  const { esc, dt, pill, h, $, $$, get, post, put, del, ask, confirmBox, act, table, fail, tabs } = Staff;
  const REG = { bac: "Miền Bắc", trung: "Miền Trung", nam: "Miền Nam" };
  const DS = { draft: ["Nháp", ""], pending: ["Chờ Admin duyệt", "warn"], rejected: ["Bị trả lại", "bad"], published: ["Đã xuất bản", "ok"] };
  const lines = v => Array.isArray(v) ? v.map(x => typeof x === "string" ? x : (x.title || x.name || JSON.stringify(x))).join("\n") : (v || "");
  const toArr = s => s.split("\n").map(x => x.trim()).filter(Boolean);

  async function editDraft(d, tours, after) {
    if (!d && (!tours || !tours.length)) {
      fail("Chưa có tour nào trên hệ thống. Chỉ Quản trị viên (Admin) mới có quyền tạo tour mới.");
      return;
    }
    const f = d ? d.fields || {} : {};
    const fields = [
      d ? null : { name: "tourId", label: "Chọn tour để biên tập nội dung *", type: "select", required: true, options: tours.map(t => [t.id, t.name + " (" + t.id + ")"]) },
      { name: "name", label: "Tên tour", value: f.name, required: true },
      { name: "subtitle", label: "Mô tả ngắn", value: f.subtitle },
      { name: "description", label: "Mô tả chi tiết", type: "textarea", value: f.description },
      { name: "destination", label: "Điểm đến", value: f.destination },
      { name: "region", label: "Vùng", type: "select", value: f.region || "bac", options: Object.entries(REG) },
      { name: "duration", label: "Thời lượng (vd 3 ngày 2 đêm)", value: f.duration },
      { name: "image", label: "Ảnh đại diện (đường dẫn, hoặc chọn ảnh để tải lên)", upload: "tour", value: f.image },
      { name: "highlights", label: "Điểm nổi bật (mỗi dòng một ý)", type: "textarea", value: lines(f.highlights) },
      { name: "itinerary", label: "Lịch trình (mỗi dòng một ngày)", type: "textarea", value: lines(f.itinerary) }].filter(Boolean);
    const v = await ask(d ? "Sửa bản nháp" : "Biên tập nội dung tour", fields, { submit: "Lưu nháp", intro: "Chỉ Admin mới có quyền tạo tour mới, đổi giá, loại HDV và sức chứa." });
    if (!v) return;
    const tourIdVal = d ? d.tourId : (v.tourId || "");
    if (!tourIdVal) {
      fail("Vui lòng chọn tour cần biên tập nội dung. Nhân viên không có quyền tạo tour mới.");
      return;
    }
    const out = { name: v.name, subtitle: v.subtitle, description: v.description, destination: v.destination, region: v.region, duration: v.duration, image: v.image, highlights: toArr(v.highlights), itinerary: toArr(v.itinerary) };
    Object.keys(out).forEach(k => { if (out[k] === "" || (Array.isArray(out[k]) && !out[k].length)) delete out[k]; });
    await act(null, () => post("/api/content/drafts", { id: d ? d.id : "", tourId: tourIdVal, fields: out }), "Đã lưu bản nháp.", after);
  }

  const sections = [
    { id: "home", label: "Tổng quan", icon: "📈", perm: "stats:view_content", async render(el) {
      const s = (await get("/api/content/stats")).stats, k = (l, v, c) => `<div class="kpi ${v && c ? c : ""}"><div class="l">${l}</div><div class="v">${v}</div></div>`;
      el.innerHTML = `<div class="grid g4">${k("Bản nháp chờ duyệt", s.pendingDrafts, "warn")}${k("Bản nháp của tôi", s.myDrafts)}${k("Món đặc sản", s.foods)}${k("Đánh giá bị ẩn", s.hiddenReviews)}${k("Số đánh giá hiển thị", s.reviews)}${k("Điểm trung bình", s.avgRating + " ★", "ok")}</div>
        <div class="card"><h2>Tour được đặt nhiều nhất</h2>${table([{ t: "Tour", k: "name" }, { t: "Số đơn", num: true, k: "orders" }], s.topTours, { empty: "Chưa có dữ liệu" })}</div>`;
    } },
    { id: "drafts", label: "Nội dung tour", icon: "📝", perm: "content:manage_tour", async render(el) {
      const tours = (await get("/api/tours")).tours || [];
      async function reload() {
        const r = await get("/api/content/drafts");
        el.innerHTML = `<div class="toolbar"><button class="btn primary" id="nd">✏️ Biên tập nội dung tour</button></div><div class="note">Nhân viên biên tập hình ảnh, lịch trình cho tour có sẵn. Chỉ <b>Admin</b> mới có quyền tạo tour mới. Nội dung chỉ lên trang công khai sau khi <b>Admin duyệt</b>.</div>` +
          table([{ t: "Tour", html: d => esc((d.fields && d.fields.name) || d.tourId) + (d.isNew ? " " + pill("Tour mới", "info") : "") }, { t: "Trạng thái", html: d => pill(...(DS[d.status] || [d.status, ""])) + (d.status === "rejected" && d.reviewNote ? `<div class="small" style="color:var(--bad)">${esc(d.reviewNote)}</div>` : "") }, { t: "Cập nhật", html: d => dt(d.updatedAt), sort: d => d.updatedAt },
            { t: "Thao tác", nowrap: true, cls: "actions", html: d => ["draft", "rejected"].includes(d.status) ? `<div class="act-btns"><button class="btn sm" data-e="${esc(d.id)}">Sửa</button><button class="btn ok sm" data-s="${esc(d.id)}">Gửi duyệt</button></div>` : "" }], r.drafts, { sortable: true, empty: "Chưa có bản nháp" });
        $("#nd", el).onclick = () => editDraft(null, tours, reload);
        $$("[data-e]", el).forEach(b => b.onclick = () => editDraft(r.drafts.find(x => x.id === b.dataset.e), tours, reload));
        $$("[data-s]", el).forEach(b => b.onclick = () => act(b, () => post(`/api/content/drafts/${b.dataset.s}/submit`), "Đã gửi Admin duyệt.", reload));
      }
      await reload();
    } },
    { id: "foods", label: "Món đặc sản", icon: "🍜", perm: "content:manage_food", async render(el) {
      const form = f => [{ name: "name", label: "Tên món", value: f && f.name, required: true }, { name: "region", label: "Vùng", type: "select", value: f ? f.region : "bac", options: Object.entries(REG) }, { name: "province", label: "Tỉnh / thành", value: f && f.province }, { name: "description", label: "Mô tả", type: "textarea", value: f && f.description }, { name: "image", label: "Ảnh (đường dẫn, hoặc chọn ảnh để tải lên)", upload: "food", value: f && f.image }, { name: "active", label: "Hiển thị công khai", type: "checkbox", value: f ? f.active !== false : true }];
      async function reload() {
        const res = await get("/api/content/foods");
        const list = (res && res.foods) || (Array.isArray(res) ? res : []);
        el.innerHTML = `<div class="toolbar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn sm" id="food-exp-excel">📊 Xuất Excel</button>
          <button class="btn sm" id="food-exp-word">📝 Xuất Word</button>
          <button class="btn sm" id="food-exp-pdf">🖨️ In / PDF</button>
          <button class="btn sm" id="food-imp">📥 Nhập Excel/CSV</button>
          ${list.length === 0 ? '<button class="btn ok sm" id="food-seed-btn">🌱 Nạp 153 món mẫu</button>' : ""}
          <button class="btn primary" id="nf" style="margin-left:auto">+ Thêm món</button>
        </div>` + table([{ t: "Món", html: f => `<b>${esc(f.name)}</b><div class="small muted">${esc(f.description || "")}</div>` }, { t: "Vùng", html: f => esc(REG[f.region] || f.region) }, { t: "Tỉnh", k: "province" }, { t: "Hiển thị", html: f => f.active === false ? pill("Ẩn", "") : pill("Hiện", "ok") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: f => `<div class="act-btns"><button class="btn sm" data-e="${esc(f.id)}">Sửa</button><button class="btn bad sm" data-x="${esc(f.id)}">Xóa</button></div>` }], list, { empty: "Chưa có món nào" });

        const feExcel = $("#food-exp-excel", el);
        if (feExcel) feExcel.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(list, "excel");
        const feWord = $("#food-exp-word", el);
        if (feWord) feWord.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(list, "word");
        const fePdf = $("#food-exp-pdf", el);
        if (fePdf) fePdf.onclick = () => window.DataExportImport && window.DataExportImport.exportFoodsList(list, "pdf");
        const feImp = $("#food-imp", el);
        const feSeed = $("#food-seed-btn", el);
        if (feSeed) {
          feSeed.onclick = async () => {
            await act(feSeed, async () => {
              const res = await fetch("/data/foods.json").then(r => r.json());
              const regMap = { north: "bac", center: "trung", south: "nam" };
              for (const [rk, rv] of Object.entries(res)) {
                const reg = regMap[rk] || "bac";
                const all = [rv.featured, ...(rv.foods || [])].filter(Boolean);
                for (const f of all) {
                  await post("/api/content/foods", {
                    name: f.name,
                    region: reg,
                    province: f.region || rv.label || "",
                    description: f.desc || f.description || "",
                    active: true
                  });
                }
              }
            }, "Đã nạp 153 món đặc sản mẫu thành công.", reload);
          };
        }
        if (feImp) feImp.onclick = () => {
          if (!window.DataExportImport) return;
          window.DataExportImport.importData({
            title: "Nhập món ăn đặc sản từ file Excel / CSV",
            onConfirm: async (parsed) => {
              let count = 0;
              for (const r of parsed.rows) {
                const name = r[1] || r[0];
                if (!name) continue;
                const regStr = (r[2] || "").toLowerCase();
                const region = regStr.includes("trung") ? "trung" : regStr.includes("nam") ? "nam" : "bac";
                const province = r[3] || "";
                const description = r[4] || "";
                await post("/api/content/foods", { name, region, province, description, active: true });
                count++;
              }
              Staff.toast(`Đã nhập thành công ${count} món đặc sản.`, "ok");
              reload();
            }
          });
        };
        $("#nf", el).onclick = async () => { const v = await ask("Thêm món đặc sản", form(null)); if (v) act(null, () => post("/api/content/foods", v), "Đã thêm.", reload); };
        $$("[data-e]", el).forEach(b => b.onclick = async () => { const f = list.find(x => x.id === b.dataset.e); const v = await ask("Sửa món", form(f)); if (v) act(null, () => put(`/api/content/foods/${f.id}`, v), "Đã lưu.", reload); });
        $$("[data-x]", el).forEach(b => b.onclick = async () => { if (await confirmBox("Xóa món", "Xóa món này khỏi danh mục?", "bad")) act(null, () => del(`/api/content/foods/${b.dataset.x}`), "Đã xóa.", reload); });
      }
      await reload();
    } },
    { id: "banners", label: "Banner trang chủ", icon: "🖼️", perm: "content:manage_banner", async render(el) {
      const form = b => [{ name: "title", label: "Tiêu đề", value: b && b.title, required: true }, { name: "subtitle", label: "Mô tả", value: b && b.subtitle }, { name: "image", label: "Ảnh (đường dẫn, hoặc chọn ảnh để tải lên)", upload: "banner", value: b && b.image }, { name: "link", label: "Liên kết (#mục, /đường-dẫn hoặc https://…)", value: b && b.link }, { name: "ctaText", label: "Chữ trên nút", value: b && b.ctaText },
        { name: "startAt", label: "Bắt đầu (tuỳ chọn)", type: "datetime-local", value: b && b.startAt ? b.startAt.slice(0, 16) : "" }, { name: "endAt", label: "Kết thúc (tuỳ chọn)", type: "datetime-local", value: b && b.endAt ? b.endAt.slice(0, 16) : "" }, { name: "priority", label: "Ưu tiên (số lớn hiện trước)", type: "number", value: b ? b.priority : 0 }, { name: "enabled", label: "Đang bật", type: "checkbox", value: b ? b.enabled !== false : true }];
      const clean = v => { const o = { ...v, priority: Number(v.priority || 0) }; ["startAt", "endAt"].forEach(k => o[k] = v[k] ? new Date(v[k]).toISOString() : null); return o; };
      async function reload() {
        const list = (await get("/api/admin/banners")).banners;
        el.innerHTML = `<div class="toolbar"><button class="btn primary" id="nb">+ Thêm banner</button></div>` + table([{ t: "Banner", html: b => `<b>${esc(b.title)}</b><div class="small muted">${esc(b.subtitle || "")}</div>` }, { t: "Lịch chạy", html: b => (b.startAt ? dt(b.startAt) : "—") + " → " + (b.endAt ? dt(b.endAt) : "—") }, { t: "Ưu tiên", num: true, k: "priority" }, { t: "Trạng thái", html: b => pill({ running: "Đang chạy", scheduled: "Chờ chạy", expired: "Hết hạn", disabled: "Đã tắt" }[b.status] || b.status || "", b.status === "running" ? "ok" : "") },
          { t: "Thao tác", nowrap: true, cls: "actions", html: b => `<div class="act-btns"><button class="btn sm" data-e="${esc(b.id)}">Sửa</button><button class="btn bad sm" data-x="${esc(b.id)}">Xóa</button></div>` }], list, { empty: "Chưa có banner" });
        $("#nb", el).onclick = async () => { const v = await ask("Thêm banner", form(null)); if (v) act(null, () => post("/api/admin/banners", clean(v)), "Đã thêm.", reload); };
        $$("[data-e]", el).forEach(x => x.onclick = async () => { const b = list.find(i => i.id === x.dataset.e); const v = await ask("Sửa banner", form(b)); if (v) act(null, () => put(`/api/admin/banners/${b.id}`, clean(v)), "Đã lưu.", reload); });
        $$("[data-x]", el).forEach(x => x.onclick = async () => { if (await confirmBox("Xóa banner", "Xóa banner này?", "bad")) act(null, () => del(`/api/admin/banners/${x.dataset.x}`), "Đã xóa.", reload); });
      }
      await reload();
    } },
    { id: "reviews", label: "Kiểm duyệt đánh giá", icon: "⭐", perm: "review:moderate", async render(el) {
      const bar = Parts.search(() => draw(), "Tìm theo tour, tác giả, nội dung…", '<select id="rf"><option value="">Tất cả</option><option value="hidden">Đang ẩn</option><option value="shown">Đang hiện</option></select><button type="button" class="btn ok" id="btn-ai-sentiment" style="margin-left:8px;font-size:0.82rem;white-space:nowrap">✨ AI Phân tích cảm xúc</button>');
      const aiBox = h('<div id="ai-sentiment-box" style="display:none;margin-bottom:16px;background:linear-gradient(135deg,#f0fdf4 0%,#f0f9ff 100%);border:1.5px solid #0284c7;border-radius:12px;padding:16px 20px"></div>');
      const body = h("<div></div>"); el.append(bar, aiBox, body); let list = [];
      $("#rf", bar).onchange = () => draw();

      $("#btn-ai-sentiment", bar).onclick = async () => {
        const btn = $("#btn-ai-sentiment", bar);
        const oldText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "⏳ Đang phân tích...";
        try {
          const res = await get("/api/content/reviews/ai-insights");
          if (!res || !res.ok) throw new Error((res && res.msg) || "Không lấy được dữ liệu phân tích");
          aiBox.style.display = "block";
          aiBox.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #bae6fd;padding-bottom:10px">
              <div style="font-weight:700;font-size:1.05rem;color:#0369a1;display:flex;align-items:center;gap:8px">
                <span>✨ Báo Cáo AI: Phân Tích Cảm Xúc & Chất Lượng Đánh Giá</span>
                <span class="badge ok" style="font-size:0.75rem">${esc(res.total)} đánh giá · ${esc(res.average)}/5.0 ⭐</span>
              </div>
              <button type="button" class="btn sm" id="btn-close-ai-box" style="font-size:0.75rem">✕ Đóng</button>
            </div>
            <div class="grid g3" style="margin-bottom:14px;gap:12px">
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #86efac;text-align:center">
                <div style="font-size:1.5rem">😊</div>
                <div style="font-size:1.25rem;font-weight:800;color:#16a34a">${esc(res.positivePct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Hài lòng & Khen ngợi</div>
              </div>
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #fde047;text-align:center">
                <div style="font-size:1.5rem">😐</div>
                <div style="font-size:1.25rem;font-weight:800;color:#ca8a04">${esc(res.neutralPct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Bình thường / Tạm ổn</div>
              </div>
              <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid #fca5a5;text-align:center">
                <div style="font-size:1.5rem">😞</div>
                <div style="font-size:1.25rem;font-weight:800;color:#dc2626">${esc(res.negativePct)}%</div>
                <div style="font-size:0.78rem;color:#475569">Cần khắc phục / Phàn nàn</div>
              </div>
            </div>
            <div style="background:#fff;border-radius:8px;padding:14px 18px;border:1px solid #cbd5e1;line-height:1.6;font-size:0.875rem;color:#1e293b">
              ${(res.summary || "").replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}
            </div>
          `;
          $("#btn-close-ai-box", aiBox).onclick = () => { aiBox.style.display = "none"; };
          aiBox.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
          alert("Lỗi khi phân tích: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = oldText;
        }
      };
      function draw() {
        const q = $("input", bar).value.toLowerCase(), f = $("#rf", bar).value;
        const rows = list.filter(r => (!f || (f === "hidden") === !!r.hidden) && (!q || JSON.stringify([r.tourName, r.foodName, r.author, r.name, r.comment, r.content, r.text, r.title, (r.reply && r.reply.content) || ""]).toLowerCase().includes(q)));
        body.innerHTML = table([
          { t: "Mục", html: r => esc(r.tourName || r.foodName || r.tourId || "Chung") },
          { t: "Tác giả", html: r => esc(r.author || r.name || "—") + (r.source === "verified" ? ` <span class="badge ok" style="font-size:0.75rem">Đã đi</span>` : (r.source === "member" ? ` <span class="badge info" style="font-size:0.75rem">Thành viên</span>` : "")) },
          { t: "Sao", num: true, html: r => esc(r.rating) + " ★" },
          {
            t: "Nội dung & Phản hồi",
            html: r => {
              let h = `<div>${esc(r.comment || r.content || r.text || r.title || "")}</div>`;
              if (r.reply && r.reply.content) {
                h += `<div style="margin-top:6px;padding:6px 10px;background:#e0f2fe;border-left:3px solid #0284c7;border-radius:4px;font-size:0.85rem;color:#0369a1">
                  <b>💬 Phản hồi (${esc(r.reply.byName || "Content")}):</b> ${esc(r.reply.content)}
                </div>`;
              }
              if (r.hidden && r.hiddenInfo) {
                h += `<div class="small" style="color:var(--bad)">Đã ẩn: ${esc(r.hiddenInfo.reason || "")}</div>`;
              }
              return h;
            }
          },
          {
            t: "Thao tác",
            nowrap: true,
            cls: "actions",
            html: r => `
              <div class="act-btns">
                <button class="btn sm primary" data-rep="${esc(r.id)}" title="Trả lời / Phản hồi">${r.reply && r.reply.content ? "✏️ Sửa rep" : "💬 Rep"}</button>
                ${r.reply && r.reply.content ? `<button class="btn sm" data-delrep="${esc(r.id)}" title="Xóa phản hồi">🗑️</button>` : ""}
                ${r.hidden ? `<button class="btn sm" data-s="${esc(r.id)}">Hiện lại</button>` : `<button class="btn bad sm" data-h="${esc(r.id)}">Ẩn</button>`}
              </div>
            `
          }
        ], rows.slice(0, 300), { empty: "Không có đánh giá" });

        $$("[data-rep]", body).forEach(b => b.onclick = async () => {
          const item = list.find(x => x.id === b.dataset.rep);
          const currentRep = (item && item.reply && item.reply.content) || "";
          const v = await ask(
            `Phản hồi bình luận của ${item ? (item.name || item.author || "khách") : ""}`,
            [
              { name: "reply", label: "Nội dung phản hồi (hiển thị công khai dưới bình luận của khách)", type: "textarea", value: currentRep, required: true }
            ],
            { submit: "Gửi phản hồi" }
          );
          if (v && v.reply) {
            act(b, () => post(`/api/content/reviews/${b.dataset.rep}/reply`, { reply: v.reply }), "Đã lưu phản hồi.", load);
          }
        });

        $$("[data-delrep]", body).forEach(b => b.onclick = async () => {
          if (await confirmBox("Xóa phản hồi", "Bạn có chắc muốn xóa câu trả lời cho bình luận này?", "bad")) {
            act(b, () => post(`/api/content/reviews/${b.dataset.delrep}/reply`, { reply: "" }), "Đã xóa phản hồi.", load);
          }
        });

        $$("[data-h]", body).forEach(b => b.onclick = async () => { const v = await ask("Ẩn đánh giá", [{ name: "reason", label: "Lý do ẩn (vi phạm tiêu chuẩn cộng đồng)", type: "textarea", required: true }], { kind: "bad", submit: "Ẩn" }); if (v) act(null, () => post(`/api/content/reviews/${b.dataset.h}/moderate`, { hide: true, reason: v.reason }), "Đã ẩn.", load); });
        $$("[data-s]", body).forEach(b => b.onclick = () => act(b, () => post(`/api/content/reviews/${b.dataset.s}/moderate`, { hide: false }), "Đã hiện lại.", load));
      }
      async function load() { list = (await get("/api/content/reviews")).reviews; draw(); }
      await load();
    } },
    { id: "customer-notis", label: "Thông báo khách", icon: "📢", perm: "notification:customer_send", async render(el) {
      el.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <h2>📢 Gửi thông báo tới Khách hàng</h2>
          <p class="muted small">Biên tập viên (Content) và Quản trị viên (Admin) có quyền soạn và gửi thông báo trực tiếp đến chuông thông báo của khách hàng (quảng bá tour mới, chương trình ưu đãi, lưu ý thời tiết & lịch trình).</p>
          <div class="row" style="gap:10px;margin-top:12px">
            <button class="btn ok" id="cn-send-all">📢 Gửi thông báo cho TẤT CẢ khách hàng</button>
            <button class="btn primary" id="cn-send-one">✉️ Gửi thông báo cho 1 khách hàng cụ thể</button>
          </div>
        </div>
        <div class="card">
          <h3>Lưu ý khi gửi thông báo cho khách hàng:</h3>
          <ul class="muted small" style="line-height:1.6">
            <li>Thông báo sẽ xuất hiện trực tiếp trên biểu tượng chuông 🔔 của khách hàng và lưu trong trang Hồ sơ cá nhân.</li>
            <li>Tiêu đề ngắn gọn, rõ ràng (tối đa 120 ký tự).</li>
            <li>Nội dung lịch sự, cung cấp thông tin hữu ích hoặc khuyến mãi hấp dẫn.</li>
            <li>Có thể đính kèm đường dẫn trang tour hoặc trang ưu đãi (VD: <code>tours.html</code> hoặc <code>tours.html?id=101</code>).</li>
          </ul>
        </div>
      `;

      $("#cn-send-all", el).onclick = async () => {
        const v = await ask("Gửi thông báo tới TẤT CẢ khách hàng", [
          { name: "title", label: "Tiêu đề thông báo", required: true, placeholder: "VD: Ưu đãi đặc biệt mùa hè 2026..." },
          { name: "body", label: "Nội dung chi tiết", type: "textarea", required: true, placeholder: "Nội dung thông báo gửi đến toàn thể khách hàng..." },
          { name: "link", label: "Liên kết đính kèm (tùy chọn)", placeholder: "VD: tours.html hoặc page-profile.html" }
        ], { submit: "Gửi thông báo toàn bộ", kind: "ok", intro: "Thông báo sẽ gửi đến tất cả tài khoản khách hàng đang hoạt động trong hệ thống." });
        if (v) act(null, () => post("/api/notifications/customer", { target: "all", title: v.title, body: v.body, link: v.link }), "Đã gửi thông báo tới tất cả khách hàng.");
      };

      $("#cn-send-one", el).onclick = async () => {
        const v = await ask("Gửi thông báo cho 1 khách hàng cụ thể", [
          { name: "customerId", label: "Mã khách hàng hoặc ID", required: true, placeholder: "VD: u_101 hoặc mã khách hàng" },
          { name: "title", label: "Tiêu đề thông báo", required: true, placeholder: "VD: Thông báo riêng về chuyến đi của quý khách..." },
          { name: "body", label: "Nội dung chi tiết", type: "textarea", required: true, placeholder: "Nội dung thông báo..." },
          { name: "link", label: "Liên kết đính kèm (tùy chọn)", placeholder: "profile hoặc tours.html" }
        ], { submit: "Gửi thông báo", kind: "primary" });
        if (v) act(null, () => post("/api/notifications/customer", { customerId: v.customerId.trim(), title: v.title, body: v.body, link: v.link }), "Đã gửi thông báo cho khách hàng.");
      };
    } }
  ];
  Staff.boot({ roles: ["content"], title: "Biên tập nội dung", sections });
})();
