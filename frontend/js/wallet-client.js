/**
 * wallet-client.js – Quản lý Ví thu nhập cá nhân & Rút tiền cho tài khoản
 * Kết nối các API:
 *   GET  /api/wallet/me
 *   POST /api/wallet/withdraw
 *   POST /api/wallet/redeem-points
 */
const WalletClient = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let walletData = null;

  async function load() {
    if (!window.Auth || !Auth.isLoggedIn()) return;
    try {
      const res = await Api.get("/api/wallet/me");
      if (res.ok && res.data) {
        walletData = res.data;
        render();
      }
    } catch (e) {
      console.warn("WalletClient.load error:", e);
    }
  }

  function render() {
    const sec = $("pf-wallet-section");
    // Chỉ nhân viên nội bộ và HDV mới có mục thu nhập (khách hàng không có lương nhân viên)
    if (!walletData || !walletData.isStaff) {
      if (sec) sec.style.display = "none";
      return;
    }
    if (sec) sec.style.display = "";
    const balEl = $("pf-wallet-balance");
    const earnedEl = $("pf-wallet-earned");
    const withEl = $("pf-wallet-withdrawn");
    const cntEl = $("pf-wallet-history-count");
    const listEl = $("pf-wallet-history-list");

    if (balEl) balEl.textContent = fmt(walletData.balance);
    if (earnedEl) earnedEl.textContent = fmt(walletData.totalEarned);
    if (withEl) withEl.textContent = fmt(walletData.totalWithdrawn);

    const badgeEl = $("pf-wallet-badge");
    if (badgeEl && walletData.roleName) {
      badgeEl.textContent = walletData.roleName + " · " + (walletData.incomeTitle || "15.000.000 ₫");
    }

    const withdrawals = walletData.withdrawals || [];
    if (cntEl) cntEl.textContent = withdrawals.length;

    if (listEl) {
      if (!withdrawals.length) {
        listEl.innerHTML = '<div style="font-size:0.85rem;color:#94a3b8;padding:8px 0">Bạn chưa có yêu cầu rút tiền nào.</div>';
      } else {
        listEl.innerHTML = withdrawals.map(w => {
          const stMap = {
            pending: ['Chờ duyệt chi', '#fef3c7', '#92400e'],
            approved: ['Đã chuyển tiền', '#dcfce7', '#166534'],
            rejected: ['Bị từ chối', '#fee2e2', '#991b1b']
          };
          const [lbl, bg, fg] = stMap[w.status] || ['Chờ xử lý', '#f1f5f9', '#475569'];
          const dateStr = w.createdAt ? new Date(w.createdAt).toLocaleString("vi-VN") : "—";
          return `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-weight:700;color:#0f172a;font-size:0.95rem">${fmt(w.amount)}</div>
                <div style="font-size:0.82rem;color:#64748b">${esc(w.bankName)} · STK: <b>${esc(w.accountNumber)}</b> (${esc(w.accountHolder)})</div>
                <div style="font-size:0.75rem;color:#94a3b8;margin-top:2px">${dateStr}</div>
                ${w.rejectReason ? `<div style="font-size:0.8rem;color:#dc2626;margin-top:4px">Lý do từ chối: ${esc(w.rejectReason)}</div>` : ''}
                ${w.adminNote ? `<div style="font-size:0.8rem;color:#16a34a;margin-top:4px">Ghi chú duyệt: ${esc(w.adminNote)}</div>` : ''}
              </div>
              <div>
                <span style="font-size:0.8rem;font-weight:600;padding:3px 10px;border-radius:999px;background:${bg};color:${fg}">${lbl}</span>
              </div>
            </div>
          `;
        }).join("");
      }
    }
  }

  // Popup rút tiền
  function openWithdrawDialog() {
    if (!walletData) {
      load().then(() => openWithdrawDialog());
      return;
    }

    const curBal = walletData.balance || 0;
    const minW = walletData.minWithdraw || 50000;

    const modal = document.createElement("div");
    modal.id = "wallet-withdraw-modal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)";

    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:100%;max-width:500px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:#0f172a">💸 Yêu Cầu Rút Tiền Thu Nhập</h3>
          <button type="button" id="wd-close-x" style="border:none;background:transparent;font-size:1.4rem;cursor:pointer;color:#64748b">&times;</button>
        </div>
        <form id="wd-form" style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px 14px;font-size:0.88rem;color:#065f46">
            Số dư khả dụng: <b style="font-size:1.05rem;color:#047857">${fmt(curBal)}</b>
            <div style="font-size:0.78rem;color:#059669;margin-top:2px">Rút tối thiểu: ${fmt(minW)}</div>
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Số tiền muốn rút (₫) *</label>
            <input type="number" id="wd-amt" class="form-input" min="${minW}" max="${curBal}" value="${Math.min(curBal, 15000000)}" required style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px">
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Ngân hàng / Ví nhận tiền *</label>
            <input list="bank-list" id="wd-bank" class="form-input" placeholder="Ví dụ: Vietcombank, MB Bank, Momo..." required style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px">
            <datalist id="bank-list">
              <option value="Vietcombank (Ngân hàng Ngoại Thương)">
              <option value="MB Bank (Ngân hàng Quân Đội)">
              <option value="Techcombank (Ngân hàng Kỹ Thương)">
              <option value="BIDV (Ngân hàng Đầu tư và Phát triển)">
              <option value="VietinBank (Ngân hàng Công Thương)">
              <option value="Agribank (Ngân hàng Nông Nghiệp)">
              <option value="ACB (Ngân hàng Á Châu)">
              <option value="TPBank (Ngân hàng Tiên Phong)">
              <option value="VPBank (Ngân hàng Việt Nam Thịnh Vượng)">
              <option value="Ví MoMo">
              <option value="Ví ZaloPay">
            </datalist>
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Số tài khoản / Số điện thoại ví *</label>
            <input type="text" id="wd-acc-no" class="form-input" placeholder="Nhập số tài khoản" required style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px">
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Tên chủ tài khoản (Viết hoa không dấu) *</label>
            <input type="text" id="wd-acc-name" class="form-input" placeholder="NGUYEN VAN A" required style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;text-transform:uppercase">
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Ghi chú thêm (không bắt buộc)</label>
            <input type="text" id="wd-note" class="form-input" placeholder="Chi nhánh hoặc lời nhắn" style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px">
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
            <button type="button" class="btn btn-ghost" id="wd-cancel-btn">Hủy</button>
            <button type="submit" class="btn btn-accent" id="wd-submit-btn">Gửi yêu cầu rút tiền</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("#wd-close-x").onclick = close;
    modal.querySelector("#wd-cancel-btn").onclick = close;

    modal.querySelector("#wd-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const amount = parseInt(modal.querySelector("#wd-amt").value, 10);
      const bankName = modal.querySelector("#wd-bank").value.trim();
      const accountNumber = modal.querySelector("#wd-acc-no").value.trim();
      const accountHolder = modal.querySelector("#wd-acc-name").value.trim().toUpperCase();
      const note = modal.querySelector("#wd-note").value.trim();

      if (amount < minW) {
        alert("Số tiền rút tối thiểu là " + fmt(minW));
        return;
      }
      if (amount > curBal) {
        alert("Số dư khả dụng không đủ");
        return;
      }

      const submitBtn = modal.querySelector("#wd-submit-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang xử lý...";

      try {
        const res = await Api.post("/api/wallet/withdraw", {
          amount, bankName, accountNumber, accountHolder, note
        });
        if (res.ok) {
          alert("✅ Đã gửi yêu cầu rút " + fmt(amount) + " thành công! Thu ngân sẽ kiểm tra và giải ngân sớm nhất.");
          close();
          await load();
        } else {
          alert("Lỗi: " + (res.data?.message || res.message || "Không thể thực hiện"));
          submitBtn.disabled = false;
          submitBtn.textContent = "Gửi yêu cầu rút tiền";
        }
      } catch (err) {
        alert("Lỗi kết nối máy chủ");
        submitBtn.disabled = false;
        submitBtn.textContent = "Gửi yêu cầu rút tiền";
      }
    };
  }

  // Popup đổi điểm tích lũy sang tiền mặt
  function openRedeemPointsDialog() {
    if (!walletData) {
      load().then(() => openRedeemPointsDialog());
      return;
    }

    const curPoints = walletData.points || 0;
    const rate = walletData.pointValue || 1000;

    const modal = document.createElement("div");
    modal.id = "wallet-redeem-modal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)";

    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:100%;max-width:440px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:#0f172a">🪙 Quy Đổi Điểm Thưởng</h3>
          <button type="button" id="rd-close-x" style="border:none;background:transparent;font-size:1.4rem;cursor:pointer;color:#64748b">&times;</button>
        </div>
        <form id="rd-form" style="padding:20px;display:flex;flex-direction:column;gap:12px">
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:0.88rem;color:#92400e">
            Điểm hiện có: <b style="font-size:1.1rem;color:#b45309">${curPoints} điểm</b>
            <div style="font-size:0.78rem;margin-top:2px">Tỷ lệ: <b>1 điểm = 1.000 ₫</b> cộng thẳng vào Ví thu nhập cá nhân.</div>
          </div>

          <div>
            <label style="display:block;font-size:0.85rem;font-weight:600;color:#334155;margin-bottom:4px">Số điểm muốn đổi *</label>
            <input type="number" id="rd-pts" class="form-input" min="10" max="${curPoints}" value="${Math.min(curPoints, 50)}" required style="width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px">
            <div id="rd-calc" style="font-size:0.82rem;color:#16a34a;margin-top:4px;font-weight:600">Quy đổi thành: ${fmt(Math.min(curPoints, 50) * rate)}</div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
            <button type="button" class="btn btn-ghost" id="rd-cancel-btn">Hủy</button>
            <button type="submit" class="btn btn-accent" id="rd-submit-btn" ${curPoints < 10 ? 'disabled' : ''}>Xác nhận quy đổi</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("#rd-close-x").onclick = close;
    modal.querySelector("#rd-cancel-btn").onclick = close;

    const ptsInput = modal.querySelector("#rd-pts");
    const calcEl = modal.querySelector("#rd-calc");
    ptsInput.oninput = () => {
      const p = parseInt(ptsInput.value, 10) || 0;
      calcEl.textContent = "Quy đổi thành: " + fmt(p * rate);
    };

    modal.querySelector("#rd-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const points = parseInt(ptsInput.value, 10);
      if (points < 10) {
        alert("Quy đổi tối thiểu 10 điểm");
        return;
      }
      if (points > curPoints) {
        alert("Bạn không đủ điểm");
        return;
      }

      const submitBtn = modal.querySelector("#rd-submit-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang đổi...";

      try {
        const res = await Api.post("/api/wallet/redeem-points", { points });
        if (res.ok) {
          alert("🎉 Quy đổi thành công +" + fmt(points * rate) + " vào Ví thu nhập!");
          close();
          await load();
        } else {
          alert("Lỗi: " + (res.data?.message || res.message || "Không thể thực hiện"));
          submitBtn.disabled = false;
          submitBtn.textContent = "Xác nhận quy đổi";
        }
      } catch (err) {
        alert("Lỗi kết nối máy chủ");
        submitBtn.disabled = false;
        submitBtn.textContent = "Xác nhận quy đổi";
      }
    };
  }

  // Tự động gắn sự kiện nút trên giao diện
  document.addEventListener("click", e => {
    if (e.target.closest("#pf-btn-withdraw")) {
      e.preventDefault();
      openWithdrawDialog();
    } else if (e.target.closest("#pf-btn-redeem-points")) {
      e.preventDefault();
      openRedeemPointsDialog();
    }
  });

  // Tải dữ liệu khi mở trang profile hoặc có sự kiện render
  window.addEventListener("DOMContentLoaded", () => {
    if (window.Auth && Auth.isLoggedIn()) load();
  });

  return {
    load,
    render,
    openWithdrawDialog,
    openRedeemPointsDialog,
    getData: () => walletData
  };
})();

