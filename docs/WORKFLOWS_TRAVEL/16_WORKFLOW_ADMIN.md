# Workflow 16 — Quản trị viên

```mermaid
flowchart TD
 A[Admin đăng nhập] --> B[Kiểm tra admin permission]
 B --> C{Chọn phân hệ}
 C -->|Đơn| D[Xem và duyệt / từ chối đơn]
 C -->|Hoàn tiền| E[Xem đề xuất và duyệt]
 C -->|Nội dung| F[Duyệt tour, nội dung, giá]
 C -->|Voucher / banner| G[Quản lý chiến dịch và hiển thị]
 C -->|Nhân sự| H[Quản lý tài khoản và quyền nhân viên]
 C -->|Báo cáo| I[Xem thống kê, xuất CSV]
 C -->|Cấu hình| J[Cập nhật cấu hình hệ thống]
 C -->|Nhật ký| K[Tra cứu audit]
 D --> L[Ghi quyết định, trạng thái và audit]
 E --> L
 F --> L
 G --> L
 H --> L
 I --> L
 J --> L
 K --> L
```

Admin không xác nhận giao dịch ngân hàng và không tự thực hiện chuyển tiền hoàn; các thao tác đó thuộc Thu ngân.

Admin làm việc tại `/staff/admin.html`. Khi phiên Admin còn hiệu lực, truy cập trang chủ/giao diện khách hoặc dashboard của vai trò khác sẽ chuyển về dashboard Admin; muốn vào website khách cần đăng xuất phiên nội bộ.
