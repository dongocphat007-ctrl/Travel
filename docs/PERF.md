# Đo thời gian vẽ danh sách dài (NEW-17)

Cách đo: dựng đúng mẫu hàng của Admin → Tour mẫu, 609 dòng, trung vị 9 lần, trong Chromium (đã đo một lần bằng script tạm, không giữ trong dự án). Muốn đo lại: dùng `TravelP13.timings["admin-tours"]` trong console như bên dưới.

| Cách vẽ | Dòng đầu hiện sau | Chặn luồng chính (tổng) | Lô nặng nhất | Đồng hồ tới khi xong |
|---|---|---|---|---|
| Ghi 1 lần (cũ) | 183 ms | 183 ms | 183 ms | 183 ms |
| `renderInBatches`, 20 dòng/lô (mới) | 5.7 ms | 426 ms | 55 ms | 757 ms |

(Số đo trong container không GPU, 1 lần chạy; máy khác sẽ lệch, nhưng tỉ lệ giữ nguyên.)

Kết luận: theo lô giúp **giao diện hiện và phản hồi sớm** (không có khoảng đứng hình 183 ms), nhưng **tốn tổng công việc hơn** vì bảng
phải tính lại độ rộng cột sau mỗi lô. Chỉ nên dùng cho danh sách rất dài như bảng Admin; danh sách đã phân trang (12 thẻ/trang ở trang chủ) giữ ghi 1 lần.
Nếu muốn giảm tổng chi phí: thêm `table-layout: fixed` cho `.adm-table` hoặc tăng `batchSize`.

Đo ngay trong ứng dụng: mở tab Admin → Tour mẫu, rồi gõ `TravelP13.timings["admin-tours"]` trong console → `{ items, batches, firstMs, totalMs }`.
