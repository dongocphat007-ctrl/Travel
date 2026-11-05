# API_DOCUMENT — Thiết kế và danh mục API Travel

> Tài liệu đối chiếu các route khai báo trong `backend/src/main/java/vn/travel/web/`. Đây là API hiện có trong mã nguồn, không phải đề xuất API mới. Backend Spring Boot phục vụ frontend và `/api` cùng origin (mặc định `http://localhost:8080`).

## 1. Quy ước chung

- Body và response dùng JSON UTF-8, trừ endpoint CSV, ảnh, XML hoặc text được ghi rõ.
- Phiên người dùng dùng cookie HttpOnly có chữ ký; trình duyệt gửi cookie cùng request. Không gửi session token trong JSON.
- Route ghi (`POST`, `PUT`, `PATCH`, `DELETE`) dưới `/api/` được kiểm tra `Origin`/`Referer` chống CSRF. `/api/payments/webhook` được miễn kiểm tra origin vì xác thực bằng secret riêng.
- Quyền được kiểm tra ở backend cho từng API. Ẩn nút trên giao diện không cấp quyền.
- Trang tĩnh nhân viên cũng được giới hạn theo phiên: vai trò nội bộ chỉ mở `/staff/<vai-trò>.html` của mình; truy cập trang khách khi đang đăng nhập nội bộ được chuyển về dashboard riêng. Đây là điều hướng trang, không thêm hoặc đổi hợp đồng API; API vẫn tự kiểm tra permission.
- Response lỗi JSON chuẩn thường có dạng `{ "ok": false, "msg": "...", "error": "...", "field": "..." }`; `field` chỉ có khi lỗi gắn với trường. HTTP status thường dùng: `400` dữ liệu không hợp lệ, `401` chưa đăng nhập, `403` thiếu quyền/CSRF, `404` không tìm thấy, `409` xung đột trạng thái, `500` lỗi máy chủ.
- Một số API dữ liệu công khai có thể không được backend khai báo vì frontend đọc file tĩnh từ `frontend/data/`; khi chạy không có server, frontend có thể dùng dữ liệu dự phòng.

## 2. Xác thực và tài khoản

| Method | Path | Truy cập | Mục đích / dữ liệu chính |
|---|---|---|---|
| POST | `/api/auth/check-email` | Công khai | Kiểm tra email; body `{email}`. |
| POST | `/api/auth/register` | Công khai | Tạo tài khoản; `name,email,password,birthday,otpTicket`; mở phiên, có thể trả `welcomeVoucher`. |
| POST | `/api/auth/login` | Công khai | Đăng nhập bằng `email,password`; trả `user`, thiết lập cookie. |
| POST | `/api/auth/google` | Công khai | Đăng nhập Google bằng `{credential}`; thiết lập cookie. |
| GET, POST | `/api/auth/logout` | Công khai/phiên hiện tại | Kết thúc phiên; POST trả JSON, GET có thể chuyển hướng về `/`. |
| GET | `/api/auth/me` | Đăng nhập | Hồ sơ người dùng hiện tại. |
| GET | `/api/auth/roles` | Công khai | Metadata vai trò. |
| GET | `/api/auth/permissions` | Công khai | Ma trận quyền và danh mục quyền. |
| POST | `/api/auth/profile` | Đăng nhập | Cập nhật hồ sơ; có thể cấp voucher sinh nhật. |
| POST | `/api/auth/migrate` | Công khai theo luồng migration | Chuyển tài khoản cũ; `id,name,email,password`; tạo phiên mới. |
| GET | `/api/otp/status` | Công khai | Trạng thái OTP/email. |
| POST | `/api/otp/send` | Công khai | Gửi OTP; `name,email`. |
| POST | `/api/otp/verify` | Công khai | Xác minh OTP; `email,code`; trả ticket dùng cho đăng ký. |
| POST | `/api/auth/forgot-password/send-otp` | Công khai | Gửi OTP khôi phục; `email`. |
| POST | `/api/auth/forgot-password/reset` | Công khai | Đặt lại mật khẩu; `email,otpTicket,newPassword`. |
| POST | `/api/auth/change-password` | Đăng nhập | Đổi mật khẩu; kiểm tra role/chính sách ở controller/service. |

## 3. Tour, nội dung công khai và đánh giá

| Method | Path | Truy cập | Mục đích / tham số |
|---|---|---|---|
| GET | `/api/banners`, `/api/banners/active` | Công khai | Banner hiển thị. |
| GET | `/api/tours/featured` | Công khai | Tour nổi bật. |
| GET | `/api/tours/stats` | Công khai | Số liệu tổng hợp tour. |
| GET | `/api/tours` | Công khai | Catalog; query tùy chọn `group`. |
| GET | `/api/tours/{id}` | Công khai | Chi tiết tour. |
| GET | `/api/locations` | Công khai | Địa điểm/toạ độ. |
| GET | `/api/guides` | Công khai | Danh sách HDV đã lọc dữ liệu phù hợp cho khách. |
| GET | `/api/guides/{id}` | Công khai | Hồ sơ HDV công khai. |
| GET | `/api/foods` | Công khai | Danh sách món ăn/ẩm thực. |
| GET | `/api/content/featured` | Theo quyền nội dung | Đọc nội dung tour được ghim. |
| POST | `/api/content/featured/{tourId}/pin` | Quyền quản lý nội dung | Ghim/bỏ ghim tour nổi bật. |
| GET | `/api/reviews` | Công khai | Query theo `targetType`, `tourId`; danh sách, ảnh, reply cộng đồng và thống kê review. |
| GET | `/api/reviews/eligible` | Đăng nhập | Kiểm tra đơn đủ điều kiện đánh giá xác thực. |
| POST | `/api/reviews` | Đăng nhập, đủ điều kiện | Đánh giá xác thực tour; body gồm `bookingId`, `targetType/targetId`, `rating`, `content` và trường tiêu chí tùy chọn. |
| POST | `/api/reviews/comment` | Đăng nhập | Bình luận/hỏi đáp tour (không rating) hoặc ẩm thực (rating tùy chọn); tối đa 5 ảnh. |
| POST | `/api/reviews/{id}/replies` | Đăng nhập | Phản hồi cộng đồng; body `content`, tùy chọn `replyToId`, `images`. |

## 4. Đơn tour, thanh toán, voucher, thông báo

| Method | Path | Truy cập | Mục đích / tham số |
|---|---|---|---|
| POST | `/api/bookings` | Khách đăng nhập, quyền tạo đơn | Tạo đơn tour; server kiểm tra dữ liệu/chỗ và tự tính giá. |
| GET | `/api/bookings` | Đăng nhập | Đơn theo phạm vi người gọi; Admin có dữ liệu quản trị đầy đủ. |
| GET | `/api/my-bookings` | Đăng nhập | Các đơn của chính khách. |
| GET | `/api/bookings/{id}` | Chủ đơn hoặc vai trò được phép | Chi tiết đơn; response được lọc theo vai trò. |
| POST | `/api/bookings/sync` | Đăng nhập | Đồng bộ thay đổi tương thích; body `{bookings:[...]}` (tối đa 200 mục/lần). |
| POST | `/api/bookings/delete` | Admin | Xóa theo `{ids:[...]}`. |
| GET | `/api/vouchers/mine`, `/api/my-vouchers` | Đăng nhập | Voucher của người dùng. |
| POST | `/api/vouchers/validate` | Đăng nhập | Kiểm tra `{code,tourId}`. |
| GET | `/api/points` | Đăng nhập | Số điểm và giới hạn quy đổi. |
| POST | `/api/points/redeem` | Đăng nhập | Đổi điểm; body `{points}`. |
| GET | `/api/notifications` | Đăng nhập | Thông báo của mình. |
| POST | `/api/notifications/read` | Đăng nhập | Đánh dấu đã đọc; `{ids:[...]}` hoặc áp dụng theo logic service. |
| POST | `/api/notifications/delete` | Đăng nhập | Xóa thông báo; `{ids:[...]}` hoặc áp dụng theo logic service. |
| POST | `/api/notifications/customer` | Quyền gửi thông báo khách | Gửi thông báo; `title,body` (hoặc `text`), `link`, `target`/`customerId`. |
| GET | `/api/payments/config` | Công khai | Cấu hình thanh toán hiển thị cho khách. |
| GET | `/api/payments/info/{bookingId}` | Đăng nhập/chủ đơn | Thông tin thanh toán cho đơn. |
| POST | `/api/payments/webhook` | Dịch vụ thanh toán | Webhook; xác thực bằng `Authorization: Apikey <PAYMENT_WEBHOOK_SECRET>` hoặc header `X-Webhook-Secret` theo cấu hình. |
| GET | `/api/admin/payments`, `/api/admin/payments/stats` | Admin/quyền thanh toán | Danh sách và thống kê khoản thanh toán. |

### Ví và lương HDV

| Method | Path | Truy cập | Mục đích |
|---|---|---|---|
| GET | `/api/wallet/me` | Đăng nhập | Ví và giao dịch cá nhân. |
| POST | `/api/wallet/redeem-points` | Đăng nhập | Đổi điểm trong ví. |
| POST | `/api/wallet/withdraw` | Đăng nhập, điều kiện nghiệp vụ | Tạo yêu cầu rút tiền. |
| GET | `/api/cashier/withdrawals` | Thu ngân | Hàng đợi yêu cầu rút. |
| POST | `/api/cashier/withdrawals/{id}/approve` | Thu ngân | Duyệt yêu cầu rút. |
| POST | `/api/cashier/withdrawals/{id}/reject` | Thu ngân | Từ chối yêu cầu rút. |
| GET | `/api/admin/salaries` | Admin | Danh sách lương/thù lao. |
| POST | `/api/admin/salaries/pay`, `/api/admin/salaries/pay-all`, `/api/admin/salaries/adjust`, `/api/admin/salaries/remind`, `/api/admin/notifications/reminder` | Admin/quyền tài chính | Chi trả, điều chỉnh hoặc nhắc thanh toán. |

## 5. Vòng đời đơn khách hàng và hỗ trợ

| Method | Path | Truy cập | Mục đích / tham số |
|---|---|---|---|
| GET | `/api/bookings/{id}/extensions/preview` | Chủ đơn | Xem trước gia hạn. |
| POST | `/api/bookings/{id}/extensions` | Chủ đơn | Yêu cầu gia hạn. |
| POST | `/api/bookings/{id}/extensions/{no}/cancel` | Chủ đơn | Hủy yêu cầu gia hạn. |
| POST | `/api/bookings/{id}/company-offer` | Chủ đơn | Chọn phương án đề nghị xử lý hủy chuyến. |
| GET | `/api/bookings/{id}/cancel-preview` | Chủ đơn | Xem trước khoản hoàn khi hủy. |
| POST | `/api/bookings/{id}/cancel` | Chủ đơn | Hủy đơn theo chính sách. |
| POST | `/api/bookings/{id}/reschedule` | Chủ đơn | Đổi ngày theo điều kiện. |
| GET | `/api/tours/{tourId}/availability` | Công khai | Tình trạng còn chỗ. |
| POST | `/api/complaints` | Đăng nhập | Tạo khiếu nại/yêu cầu hỗ trợ. |
| GET | `/api/complaints/mine` | Đăng nhập | Khiếu nại của mình. |
| POST | `/api/waitlist` | Đăng nhập | Đăng ký danh sách chờ. |
| GET | `/api/staff/customers` | CSKH/Admin theo quyền | Tra cứu danh bạ khách. |
| GET | `/api/staff/customers/{id}` | CSKH/Admin theo quyền | Hồ sơ và lịch sử khách. |
| POST | `/api/staff/customers/{id}/lock` | Quyền quản lý khách | Khóa/mở theo logic endpoint. |
| DELETE | `/api/staff/customers/{id}` | Quyền quản lý khách | Xóa mềm/khóa tài khoản theo service. |

## 6. Công cụ nhân viên

### Admin

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/admin/queue`, `/api/admin/bookings`, `/api/admin/bookings/{id}` | Hàng chờ và đơn cần quản trị. |
| POST | `/api/admin/bookings/{id}/confirm`, `/api/admin/bookings/{id}/reject` | Duyệt/từ chối đơn. |
| GET | `/api/admin/refunds`; POST `/api/admin/refunds/{id}/approve`, `/api/admin/refunds/{id}/reject` | Duyệt/từ chối hoàn tiền. |
| GET | `/api/admin/reconcile`; POST `/api/admin/reconcile/{id}/decision` | Duyệt bản đối soát. |
| GET | `/api/admin/cancel-proposals`; POST `/api/admin/company-cancel`, `/api/admin/cancel-proposals/{id}/reject` | Quản lý đề xuất hủy chuyến. |
| GET, PUT | `/api/admin/config` | Đọc/cập nhật cấu hình nghiệp vụ. |
| GET | `/api/config/public` | Cấu hình công khai cho giao diện. |
| GET | `/api/admin/audit` | Nhật ký quản trị. |
| GET, POST | `/api/admin/staff` | Danh sách/tạo nhân viên. |
| PUT, DELETE | `/api/admin/staff/{id}` | Sửa/xóa mềm nhân viên. |
| POST | `/api/admin/staff/{id}/lock`, `/api/admin/staff/{id}/role`, `/api/admin/staff/{id}/reset-password` | Khóa, đổi vai trò, đặt lại mật khẩu. |
| DELETE | `/api/admin/accounts/{id}` | Xóa mềm tài khoản theo quyền. |
| GET | `/api/stats`, `/api/admin/daily-stats` | Số liệu tổng hợp và báo cáo ngày. |
| POST, DELETE | `/api/admin/daily-revenue`, `/api/admin/daily-revenue/import`, `/api/admin/daily-revenue/{id}` | Quản lý/import dữ liệu doanh thu ngày. |
| GET, POST | `/api/admin/tours` | Danh sách/tạo tour. |
| PUT, DELETE | `/api/admin/tours/{id}` | Sửa/xóa tour. |
| POST | `/api/admin/tours/{id}/toggle`; PUT `/api/admin/tours/{id}/sensitive` | Bật/tắt tour hoặc sửa trường nhạy cảm. |
| POST | `/api/admin/drafts/{id}/approve`, `/api/admin/drafts/{id}/reject` | Duyệt/từ chối bản nháp. |
| POST | `/api/admin/promote-top-tours` | Cập nhật tour nổi bật. |
| GET | `/api/admin/vouchers`, `/api/admin/banners` | Danh sách quản trị. |
| POST, PUT, DELETE | `/api/admin/vouchers`, `/api/admin/vouchers/{code}` | Tạo/sửa/xóa voucher. |
| POST, PUT, DELETE | `/api/admin/banners`, `/api/admin/banners/{id}` | Tạo/sửa/xóa banner. |
| POST | `/api/admin/upload` | Upload nội dung banner theo quyền. |
| POST | `/api/admin/tours/sync` | Endpoint tương thích đồng bộ tối đa 2.000 tour. |
| GET | `/api/admin/reviews/ai-insights`, `/api/content/reviews/ai-insights` | Phân tích đánh giá; yêu cầu quyền kiểm duyệt. |

### Thu ngân

| Method | Path | Mục đích |
|---|---|---|
| GET | `/api/cashier/queue`, `/api/cashier/stats`, `/api/cashier/daily-stats` | Hàng chờ và số liệu. |
| POST | `/api/cashier/daily-revenue`, `/api/cashier/daily-revenue/import` | Nhập doanh thu ngày. |
| GET | `/api/cashier/guide-fees`; POST `/api/cashier/guide-fees/pay` | Xem và chi thù lao HDV. |
| GET | `/api/cashier/bookings/{id}`; POST `/api/cashier/bookings/{id}/confirm` | Tra và xác nhận khoản thu của đơn. |
| GET | `/api/cashier/extensions`; POST `/api/cashier/extensions/{id}/{no}/confirm` | Đối soát phụ thu/gia hạn. |
| POST | `/api/cashier/bookings/{id}/discrepancy`, `/api/cashier/payments/{id}/resolve`, `/api/cashier/payments/{id}/attach`, `/api/cashier/bookings/{id}/undo` | Ghi sai lệch, xử lý/gắn giao dịch, hoàn tác. |
| GET | `/api/cashier/refunds`; POST `/api/cashier/refunds/{id}/pay` | Xem và thực hiện khoản hoàn đã duyệt. |
| GET, POST | `/api/cashier/reconcile` | Xem/tạo bản đối soát. |

### Điều hành, CSKH, HDV, Biên tập

| Nhóm | Method và path | Mục đích |
|---|---|---|
| Điều hành | GET `/api/operator/queue`, `/stats`, `/activity`, `/bookings/{id}`, `/guide-calendar`, `/bookings/{id}/candidates` | Hàng chờ, thống kê, hoạt động, đơn và ứng viên HDV. |
| Điều hành | POST `/api/operator/bookings/{id}/assign`, `/replace-guide`, `/unassign` | Phân công/thay/gỡ HDV. |
| Điều hành | GET, PUT `/api/operator/departures`; GET `/api/operator/departures/manifest.csv` | Quản lý chuyến khởi hành và xuất danh sách đoàn CSV. |
| Điều hành | POST `/api/operator/cancel-proposals`; GET `/api/operator/incidents`; POST `/api/operator/incidents/{id}` | Đề xuất hủy và xử lý sự cố. |
| Điều hành | GET `/api/operator/extensions`, `/api/operator/reschedule`; POST `/api/operator/extensions/{id}/{no}`, `/api/operator/reschedule/{id}` | Xử lý gia hạn và điều chỉnh ngày. |
| CSKH | GET `/api/support/complaints`; POST `/api/support/complaints/{id}/take`, `/reply`, `/propose-refund`, `/resolve` | Nhận, phản hồi, đề xuất hoàn và xử lý khiếu nại. |
| CSKH | GET `/api/support/bookings/{id}`, `/api/support/waitlist`, `/api/support/payment-issues`, `/api/support/reschedule`, `/api/support/stats` | Tra đơn, danh sách chờ, sai lệch thanh toán, đổi ngày và thống kê. |
| CSKH | POST `/api/support/waitlist/{id}`, `/api/support/payment-issues/{id}/contact`, `/api/support/reschedule/{id}` | Cập nhật các yêu cầu hỗ trợ tương ứng. |
| HDV | GET `/api/guide/rating`, `/tours`, `/tours/{id}`, `/incidents`, `/earnings`, `/profile`, `/schedule` | Dữ liệu cá nhân và tour được giao. |
| HDV | POST `/api/guide/tours/{id}/accept`, `/reject`, `/start`, `/end`, `/checkin`, `/incidents`, `/report` | Nhận/từ chối, bắt đầu/kết thúc, điểm danh, ghi sự cố/báo cáo. |
| HDV | GET `/api/guide/tours/{id}/report`; GET `/api/guide/tours/{id}/manifest.csv` | Xem báo cáo và xuất danh sách đoàn. |
| Biên tập | GET, POST `/api/content/drafts`; POST `/api/content/drafts/{id}/submit` | Quản lý và gửi bản nháp. |
| Biên tập | GET, POST `/api/content/foods`; PUT, DELETE `/api/content/foods/{id}` | Quản lý nội dung món ăn. |
| Biên tập | GET `/api/content/reviews`, `/api/content/stats`; POST `/api/content/reviews/{id}/moderate`, `/reply` | Kiểm duyệt/phản hồi đánh giá, xem thống kê. |

### Tin nhắn, ảnh tải lên

| Method | Path | Truy cập / mục đích |
|---|---|---|
| GET | `/api/messages`, `/api/messages/recipients`, `/api/messages/{id}` | Đăng nhập; danh sách, người nhận, chi tiết hội thoại. |
| POST | `/api/messages`, `/api/messages/{id}/reply`, `/api/messages/{id}/read`, `/api/messages/{id}/delete`, `/api/messages/delete` | Đăng nhập; tạo/trả lời/đánh dấu/xóa theo quyền tham gia. |
| POST | `/api/upload/avatar` | Người dùng đăng nhập tải ảnh đại diện của mình. |
| POST | `/api/upload/review` | Đăng nhập; tải ảnh review/bình luận, tối đa 3 MB, PNG/JPEG/WEBP/GIF; ảnh gắn với tài khoản tải lên. |
| POST | `/api/upload/{kind}` | Tải ảnh tour/banner/food theo permission tương ứng. |

Ảnh review gửi dạng JSON `{dataUrl}`; server kiểm tra chữ ký file, sau đó trả `{ok, path}`. Bài viết nhận `images: string[]` tối đa 5 đường dẫn; ảnh local chỉ hợp lệ nếu thuộc tài khoản hiện tại. Giới hạn comment 10/phút/IP, reply 20/phút/IP, upload ảnh review 20/phút/IP.

## 7. AI, RAG, bản đồ và du lịch trực tuyến

| Method | Path | Truy cập | Mục đích / tham số |
|---|---|---|---|
| GET | `/api/ai/status`, `/api/v1/chat/langfuse-status` | Công khai | Trạng thái AI/trace. |
| GET, POST | `/api/ai/test-trace`, `/api/v1/chat/langfuse-test-trace`, `/api/v1/chat/langfuse-test` | Tùy cấu hình/quyền endpoint | Kiểm tra trace. |
| POST | `/api/ai/generate` | Theo giới hạn/rate limit | Tạo câu trả lời; body prompt/context theo controller. |
| POST | `/api/ai/feedback` | Theo controller | Gửi feedback AI. |
| GET | `/api/rag/status` | Công khai | Trạng thái chỉ mục RAG. |
| POST | `/api/rag/search` | Công khai có rate limit | Body `{query,k?,type?}`; `type` có thể là `tour`, `food`, `unesco`. |
| POST | `/api/admin/rag/reindex` | Admin | Lập chỉ mục lại dữ liệu RAG. |
| GET | `/api/maps/config` | Công khai | Cấu hình bản đồ công khai. |
| GET | `/api/travel/airports` | Công khai | Danh sách sân bay. |
| GET | `/api/flights/search` | Công khai | Tìm chuyến; query theo điểm đi/đến, ngày, khách, hạng vé. |
| GET | `/api/hotels/search` | Công khai | Tìm khách sạn; query theo điểm đến, ngày, số khách/phòng và bộ lọc. |
| GET | `/api/travel/live-status` | Công khai | Trạng thái nhà cung cấp trực tuyến. |
| GET | `/api/flights/booking-links` | Công khai | Link đặt vé ngoài; query `id`. |
| GET | `/api/places/photo` | Công khai, rate-limited | Proxy ảnh địa điểm; query tên/kích thước theo controller. |
| POST | `/api/bookings/flight`, `/api/bookings/hotel` | Đăng nhập, chỉ sản phẩm danh mục tự quản | Tạo đơn vé/khách sạn do Travel quản lý. |
| POST | `/api/admin/inventory/{name}/sync` | Admin/quyền catalog | Đồng bộ `airports`, `flights` hoặc `hotels`. |

## 8. SEO, health và tệp xuất

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | JSON trạng thái health. |
| GET | `/sitemap.xml` | XML sitemap. |
| GET | `/robots.txt` | Text robots rules. |
| GET | `/`, `/index.html` | HTML ứng dụng; trang tour có thể được bổ sung metadata theo tour. |
| GET | `/api/operator/departures/manifest.csv`, `/api/guide/tours/{id}/manifest.csv` | CSV UTF-8 cho danh sách đoàn. |

## 9. Payload mẫu

Các mẫu dưới đây tóm lược trường cốt lõi. Trường tùy chọn, kiểm tra dữ liệu và trạng thái phụ thuộc service tương ứng.

### Đăng nhập

```http
POST /api/auth/login
Content-Type: application/json

{"email":"khach@example.com","password":"..."}
```

Response thành công có dạng `{ "ok": true, "user": {...} }`; server đặt cookie phiên.

### Tạo booking tour

```http
POST /api/bookings
Content-Type: application/json

{
  "tourId": "tour-id",
  "date": "2026-12-20",
  "customerName": "Nguyen Van A",
  "phone": "0901234567",
  "email": "khach@example.com",
  "adults": 2,
  "kids": 0,
  "infants": 0,
  "hdvOn": false,
  "hdvHours": 8,
  "guideId": "",
  "voucherCode": ""
}
```

Backend yêu cầu `customerName`, `phone`, `tourId`, `date`; số lượng dùng `adults`, `kids`, `infants`. Giá client gửi (nếu có) không được xem là giá có thẩm quyền; backend tính lại theo quy tắc nghiệp vụ.

### Tìm kiếm RAG

```http
POST /api/rag/search
Content-Type: application/json

{"query":"tour Đà Nẵng 3 ngày","k":8,"type":"tour"}
```

## 10. Phân quyền và trạng thái

- Nhóm vai trò nội bộ hiện gồm Admin, Thu ngân, Điều hành, CSKH, Biên tập và HDV. Các quyền cụ thể nằm trong `security/Permission.java` và `RolePermissions.java`.
- 401: phiên thiếu/hết hạn/không hợp lệ. 403: tài khoản bị khóa, thiếu quyền, phải đổi mật khẩu trước khi tiếp tục hoặc CSRF/origin không hợp lệ.
- Các thao tác tạo/duyệt đơn, thanh toán và hoàn tiền kiểm tra vòng đời hiện tại ở service; gọi đúng route chưa đủ để bảo đảm thao tác được chấp nhận.
- Endpoint `/api/payments/webhook` dùng header secret riêng và không dựa trên cookie người dùng.

## 11. Nguồn định nghĩa

Route và hợp đồng được khai báo trực tiếp trong `backend/src/main/java/vn/travel/web/*Controller.java`; quyền trong `security/Permission.java`, `RolePermissions.java`, `CurrentUser.java`; lỗi trong `ApiExceptionHandler.java`; phía client dùng `frontend/js/api-client.js` và các module chức năng. Khi route thay đổi, cập nhật tài liệu này từ annotation và xác minh payload với service/client tương ứng.
