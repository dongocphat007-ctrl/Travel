# Workflow 07 — Chuyến đi cá nhân

```mermaid
flowchart TD
 A[Khách mở chuyến đi cá nhân] --> B{Tạo mới hay mở chuyến có sẵn?}
 B -->|Tạo mới| C[Nhập tên, địa điểm, ngày]
 B -->|Mở| D[Tải itinerary đã lưu]
 C --> E[Thêm điểm đến và hoạt động]
 D --> E
 E --> F[Chỉnh sửa thứ tự, ghi chú và thời gian]
 F --> G[Lưu dữ liệu chuyến đi]
 G --> H{Tiếp tục thao tác?}
 H -->|Thêm dữ liệu từ tour / tệp| E
 H -->|Xuất tài liệu| I[Tạo Word hoặc PDF]
 H -->|Xem bản đồ / chi tiết| J[Hiển thị lịch trình]
```

Chức năng trong `frontend/js/trips.js` lưu itinerary cá nhân bằng `localStorage` trên trình duyệt; hiện không thấy API backend đồng bộ itinerary cá nhân. Xuất Word/PDF và một số thao tác dùng dữ liệu trình duyệt.
