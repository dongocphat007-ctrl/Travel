# Workflow 01 — Đăng ký và đăng nhập

```mermaid
flowchart TD
 A[Khách mở đăng nhập / đăng ký] --> B{Chọn cách xác thực}
 B -->|Email mới| C[Kiểm tra email]
 C --> D[Gửi OTP]
 D --> E{OTP hợp lệ và còn hạn?}
 E -->|Không| D
 E -->|Có| F[Tạo tài khoản]
 F --> G[Cấp voucher chào mừng nếu đủ điều kiện]
 B -->|Email và mật khẩu| H[POST đăng nhập]
 B -->|Google| I[Google Sign-In]
 H --> J{Thông tin đúng?}
 I --> K{Google token hợp lệ?}
 J -->|Không| X[Hiện lỗi đăng nhập]
 K -->|Không| X
 J -->|Có| L[Tạo phiên cookie]
 K -->|Có| L
 G --> L
 L --> M[Tải hồ sơ và quyền]
 M --> N{Vai trò tài khoản?}
 N -->|Khách hàng| C1[Đi tới website khách hàng]
 N -->|Vai trò nội bộ| S1[Đi tới dashboard riêng /staff/vai-trò.html]
 S1 --> S2[Chỉ mở dashboard của chính vai trò; trang khách chuyển về dashboard]
 O[Quên mật khẩu] --> P[Gửi OTP] --> Q{OTP hợp lệ?}
 Q -->|Có| R[Đặt mật khẩu mới]
 Q -->|Không| X
```

**Các điểm xử lý:** backend xác thực OTP/token, tạo phiên và cấp quyền; frontend không tự quyết định danh tính. API chính: `/api/auth/*`, `/api/otp/*`.

Phiên nội bộ, kể cả Admin, không dùng được trang chủ, trang tour công khai, trang in của khách hoặc các mảnh giao diện khách. Tài khoản nội bộ chỉ vào dashboard đúng vai trò; backend thực hiện chuyển hướng và kiểm tra quyền API. Đăng xuất để kết thúc phiên nội bộ trước khi sử dụng giao diện khách.
