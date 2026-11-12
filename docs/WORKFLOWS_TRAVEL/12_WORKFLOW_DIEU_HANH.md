# Workflow 12 — Điều hành tour (Tour Operations)

Tài liệu mô tả quy trình vận hành và điều phối của bộ phận Điều hành tour: quản lý danh sách đơn chờ điều hành, phân công HDV, đề xuất hủy tour khi thiếu nhân sự, theo dõi xuất bến và xử lý sự cố đoàn.

---

## 1. Sơ đồ luồng Điều hành tour

```mermaid
flowchart TD
  A["Điều hành đăng nhập (staff/operator.html)"] --> B["Hàng đợi điều phối: 4 Tab"]
  B --> B1["1. Chưa có HDV"]
  B --> B2["2. HDV đã từ chối / Quá hạn"]
  B --> B3["3. Đã gán, chờ HDV nhận"]
  B --> B4["4. Đã nhận, chuẩn bị khởi hành"]

  B1 --> C["Bấm 'Gán HDV'"]
  B2 --> C
  C --> D["Server tính toán ứng viên rảnh (candidates API)"]
  D --> E{"Có HDV khả dụng?"}

  E -- "Có HDV rảnh" --> F["Xem danh sách: số tour tháng này, đánh giá, loại HDV"]
  F --> G["Chọn HDV & bấm 'Gán HDV'"]
  G --> H["Đơn chuyển sang 'guide_pending', hẹn giờ trả lời"]

  E -- "Không có HDV / Tất cả bận" --> I["Hiển thị cảnh báo & nút: '🚫 Không có HDV – Đề xuất hủy tour'"]
  I --> J["Nhập lý do thiếu nhân sự -> Gửi Admin"]
  B1 --> J1["Hành động nhanh: '🚫 Hủy tour' trực tiếp trên bảng"]
  J1 --> J
  J --> K["Admin duyệt hủy tour công ty -> Tự động hoàn 100% tiền khách"]

  H --> L{"HDV phản hồi?"}
  L -- "Từ chối" --> B2
  L -- "Quá hạn" --> B2
  L -- "Đồng ý" --> B4

  B4 --> M["Quản lý Lịch xuất bến & Sức chứa đoàn"]
  M --> N["Theo dõi đoàn tour đang chạy"]
  N --> O{"HDV báo sự cố?"}
  O -- "Có sự cố" --> P["Tab Sự cố: Điều phối xe thay thế, y tế, khách sạn"]
  P --> Q["Đánh dấu sự cố đã xử lý"]
  O -- "Bình thường" --> R["HDV kết thúc tour & nộp báo cáo"]
```

---

## 2. Các nghiệp vụ trọng yếu

### 2.1. Tối ưu phân công ứng viên HDV (`candidates`)
* Hệ thống tự động lọc danh sách 16 HDV:
  * Loại trừ các HDV bị trùng lịch tour vào ngày khởi hành hoặc đang trong thời gian nghỉ bù.
  * Ưu tiên HDV có ít tour nhất trong tháng để cân đối khối lượng công việc.
  * Phân biệt rõ loại HDV phù hợp: Tour nội địa yêu cầu thẻ HDV nội địa (`domestic`), Tour quốc tế yêu cầu thẻ quốc tế (`international`).

### 2.2. Đề xuất hủy tour do thiếu HDV (`Cancel Proposals`)
* **Bối cảnh:** Khi vào mùa cao điểm hoặc toàn bộ HDV phù hợp đều đã kín lịch, Điều hành không thể gán người dẫn đoàn.
* **Thao tác:**
  * Bấm nút **`🚫 Không có HDV – Đề xuất hủy tour`** ngay trong popup phân công khi danh sách ứng viên trống (`availCount === 0`).
  * Hoặc bấm nút **`🚫 Hủy tour`** ở cột Thao tác tại tab "Chưa có HDV" và "HDV đã từ chối".
* **Luồng xử lý:** Đề xuất được chuyển ngay sang phân hệ **"Hủy tour (công ty)"** trên Dashboard của Admin. Khi Admin bấm duyệt, toàn bộ khách trong đoàn được hủy tour và hệ thống tự động sinh lệnh hoàn tiền 100% sang Thu ngân.

### 2.3. Quản lý sự cố hiện trường (`Incidents`)
* Nhận sự cố thời gian thực từ HDV: Chậm lịch trình (`delay`), Sức khỏe khách (`health`), Phương tiện xe hỏng (`vehicle`), Khách phàn nàn (`complaint`), Thất lạc hành lý (`lost`)...
* Điều hành xem mức độ nghiêm trọng (`low`, `medium`, `high`) để phối hợp hỗ trợ và cập nhật trạng thái đã giải quyết.
