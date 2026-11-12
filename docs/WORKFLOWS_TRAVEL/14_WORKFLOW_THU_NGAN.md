# Workflow 14 — Thu ngân (Cashier Operations)

Tài liệu mô tả toàn bộ quy trình thu chi, đối soát thanh toán, hoàn tiền, chốt sổ cuối ngày và quản lý quỹ lưu động của vai trò Thu ngân.

---

## 1. Sơ đồ luồng Thu ngân

```mermaid
flowchart TD
  A["Thu ngân đăng nhập (staff/cashier.html)"] --> B["Bảng điều khiển Thu ngân"]
  B --> C["1. Xác nhận tiền vào (Hôm nay / Ngày mai)"]
  B --> D["2. Đối soát chuyển khoản lệch"]
  B --> E["3. Chi tiền hoàn cho khách"]
  B --> F["4. Xem Doanh thu khớp Admin & Quỹ lưu động"]
  B --> G["5. Lập bản đóng sổ cuối ngày"]

  C --> C1["Lọc đơn: 'Hôm nay (10/11)' hoặc 'Ngày mai (11/11)'"]
  C1 --> C2["Bấm 'Xác nhận thanh toán' (Cọc 20% hoặc Đủ 100%)"]
  C2 --> C3["Doanh thu trong ngày tăng ngay lập tức & đồng bộ Dashboard Admin"]

  D --> D1["Giao dịch sai cú pháp / thừa thiếu tiền"]
  D1 --> D2["Gắn vào đơn đúng / Phối hợp CSKH liên hệ khách"]

  E --> E1["Danh sách hoàn tiền đã được Admin duyệt"]
  E1 --> E2["Thu ngân chuyển khoản ngân hàng & bấm 'Đã hoàn tiền'"]
  E2 --> E3["Đơn chuyển sang 'refunded', trừ quỹ lưu động"]

  F --> F1["Nút '📊 Doanh thu năm/tháng (Khớp Admin)'"]
  F1 --> F2["Xem biểu đồ & số liệu khớp 100% với Admin"]

  G --> G1["Kiểm đếm tiền thực nhận vs số liệu hệ thống"]
  G1 --> G2["Tạo bản đóng sổ (reconciliation: pending_approval)"]
  G2 --> G3["Gửi Admin duyệt chốt sổ"]
```

---

## 2. Các quy định và nghiệp vụ trọng yếu

### 2.1. Xác nhận tiền & Tăng doanh thu tức thì
* Bộ lọc ngày trực quan: Hỗ trợ nút chọn nhanh **Hôm nay** và **Ngày mai**.
* Khi khách hàng chuyển khoản trực tiếp qua ngân hàng hoặc nộp tiền mặt tại quầy, Thu ngân bấm **"Xác nhận thanh toán"**.
* Tiền được hạch toán ngay vào sổ doanh thu (`daily_revenues.json`), kích hoạt cập nhật biểu đồ doanh thu theo thời gian thực.
* Quyền hoàn tác giao dịch: Trong vòng 15 phút đầu nếu bấm nhầm, Thu ngân có thể bấm Hoàn tác và bắt buộc nhập lý do.

### 2.2. Đồng bộ số liệu 1:1 với Quản trị viên (Admin)
* Thu ngân được cấp quyền truy cập các API thống kê: `/api/stats` và `/api/cashier/stats-overview`.
* Nút **`📊 Doanh thu năm/tháng (Khớp Admin)`** cho phép Thu ngân mở popup tra cứu số liệu doanh thu chốt duyệt, thực thu và chi trả lương trùng khớp từng đồng với màn hình Tổng quan của Admin.

### 2.3. Quy tắc hai lớp duyệt hoàn tiền (Maker - Checker)
* Thu ngân **không tự ý quyết định hoàn tiền** mà chỉ thực hiện chi trả khi yêu cầu hoàn tiền đã có trạng thái `approved` từ Admin.
* Sau khi chuyển khoản xong, Thu ngân bấm "Đã hoàn tiền" kèm mã tham chiếu ngân hàng để chuyển trạng thái sang `refunded`.

### 2.4. Đóng sổ cuối ngày (`Reconciliation`)
* Cuối ca làm việc, Thu ngân tổng kết các khoản thực thu trong ngày và tạo bản ghi đóng sổ.
* **Nguyên tắc kiểm soát nội bộ:** Người lập bản đóng sổ không được tự duyệt bản đóng sổ của chính mình. Bản đóng sổ sẽ chuyển sang Admin ở trạng thái `pending_approval` để duyệt chốt sổ.
