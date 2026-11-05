# Thu hồi khóa cũ (NEW-12) — việc của chủ dự án

Mã nguồn hiện tại không còn khóa nào (đã quét mẫu khóa Google/Gemini, OpenAI-style, Resend, GitHub, GOCSPX, private key). Nhưng khóa từng nằm trong
mã nguồn vẫn còn trong **lịch sử git** và trong mọi bản sao/zip cũ, nên chỉ xóa khỏi file là CHƯA đủ — phải **thu hồi** ở nhà cung cấp.
Công cụ không thể làm hộ bước này (cần đăng nhập tài khoản của bạn). Đánh dấu khi xong:

| # | Khóa từng bị lộ | Việc cần làm | Xong |
|---|---|---|---|
| 1 | Gemini API key | https://aistudio.google.com/app/apikey → xóa khóa cũ, tạo khóa mới, đặt `GEMINI_API_KEY` ở server (hạn chế theo IP máy chủ nếu được) | ☐ |
| 2 | EmailJS (service/template/public key) | Đăng nhập EmailJS → xóa service/template cũ hoặc đổi Public Key + Private Key. Đã thay bằng `Mailer` + `EMAIL_API_KEY` | ☐ |
| 3 | Mật khẩu admin cũ | Đổi mật khẩu mọi tài khoản admin; đặt `ADMIN_PASSWORD` mới (≥ 8 ký tự, duy nhất). Admin mặc định chỉ được tạo khi có cả `ADMIN_EMAIL` + `ADMIN_PASSWORD` | ☐ |
| 4 | `SESSION_SECRET` | Đặt giá trị mới (`openssl rand -hex 32`) → mọi phiên đăng nhập cũ mất hiệu lực | ☐ |
| 5 | `PAYMENT_WEBHOOK_SECRET` | Đổi chuỗi bí mật, cập nhật cùng giá trị trong cấu hình webhook SePay/Casso/PayOS | ☐ |
| 6 | Google Maps / Places / Ignav / Travelpayouts | Nếu từng dán vào file nào đã commit: tạo khóa mới, hạn chế theo HTTP referrer (Maps JS) hoặc IP (Places) | ☐ |
| 7 | Google OAuth Client ID | Công khai nên không cần thu hồi; chỉ đổi Client **Secret** nếu từng lộ | ☐ |

## Sau khi thu hồi
1. Xác nhận khóa cũ thật sự vô hiệu: gọi thử bằng khóa cũ phải trả 400/401/403.
2. Tùy chọn: xóa khóa khỏi lịch sử (`git filter-repo --replace-text`) rồi force-push và yêu cầu mọi người clone lại. Không bắt buộc nếu khóa đã bị thu hồi.
3. CI có job `secrets-scan` (gitleaks, quét toàn bộ lịch sử) để phát hiện nếu khóa bị commit lại.
4. Chỉ để khóa trong biến môi trường / `backend/.env` (đã `.gitignore`). `storage/` (dữ liệu khách, vectors.json) cũng không được commit.
