# Danh mục workflow dự án Travel

Các sơ đồ dưới đây được tách theo chức năng để dễ mở, gửi và cập nhật. Mỗi file là Markdown có sơ đồ Mermaid; mở bằng VS Code, GitHub hoặc trình xem Mermaid để thấy hình.

## Khách hàng

- `01_WORKFLOW_DANG_KY_DANG_NHAP.md` — đăng ký, OTP, đăng nhập, Google, khôi phục mật khẩu.
- `02_WORKFLOW_TIM_KIEM_VA_XEM_TOUR.md` — khám phá, lọc, tìm kiếm và xem chi tiết tour.
- `03_WORKFLOW_DAT_TOUR.md` — chọn ngày, hành khách, HDV, voucher, kiểm tra chỗ và tạo đơn.
- `04_WORKFLOW_THANH_TOAN_VA_XAC_NHAN.md` — QR/chuyển khoản, webhook, thu ngân và duyệt đơn.
- `05_WORKFLOW_QUAN_LY_DON_HUY_DOI_NGAY.md` — theo dõi đơn, hủy, hoàn tiền, đổi ngày, khiếu nại.
- `06_WORKFLOW_CHUYEN_BAY_KHACH_SAN.md` — tìm chuyến bay/khách sạn và đặt danh mục Travel.
- `07_WORKFLOW_CHUYEN_DI_CA_NHAN.md` — tạo, cập nhật và xuất lịch trình cá nhân.
- `08_WORKFLOW_DANH_GIA_VA_PHAN_HOI.md` — đánh giá xác thực, bình luận và kiểm duyệt.
- `09_WORKFLOW_CHATBOT_VA_TIM_TOUR_AI.md` — RAG, chatbot, tìm tour có AI và dự phòng.
- `10_WORKFLOW_VI_DIEM_THUONG_VOUCHER.md` — ví, điểm thưởng và voucher.

## Nhân viên

- `11_WORKFLOW_HD_VIEN.md` — nhận tour, điểm danh, sự cố, kết thúc tour.
- `12_WORKFLOW_DIEU_HANH.md` — phân công HDV, khởi hành, sức chứa và điều phối.
- `13_WORKFLOW_CSKH.md` — tiếp nhận yêu cầu, tra cứu, phản hồi và đề xuất xử lý.
- `14_WORKFLOW_THU_NGAN.md` — đối soát, xác nhận thu, hoàn tiền và đóng sổ.
- `15_WORKFLOW_BIEN_TAP_NOI_DUNG.md` — soạn tour/nội dung, hình ảnh và kiểm duyệt.
- `16_WORKFLOW_ADMIN.md` — quản trị, duyệt, cấu hình, nhân sự và báo cáo.

## Phân hệ Nghiệp vụ Mở rộng

- `18_WORKFLOW_GHEP_TOUR_VA_DON_DOAN.md` — ghép tour đa vai trò: khách ghép đoàn trên web, AI RAG quét tour thiếu người, Điều hành quản lý pool, HDV ghép khách tại chỗ.
- `19_WORKFLOW_QUY_LUU_DONG_VA_LUONG_KPI.md` — dòng tiền quỹ lưu động khớp thực thu, phát lương toàn công ty định kỳ ngày 25, xét tăng lương theo KPI và khấu trừ Dashboard.

## Nền tảng

- `17_WORKFLOW_KIEN_TRUC_API_VA_DU_LIEU.md` — đường đi chung từ trình duyệt qua API tới JSON store và dịch vụ ngoài.

## Ghi chú phạm vi

Các luồng được dựng từ các màn hình frontend, controller/service backend và tài liệu nghiệp vụ trong gói `Travel.zip`. Tài liệu dự án là nguồn tham khảo để hiểu phần mềm; những mục ghi là chức năng dự kiến/chưa làm không được biểu diễn như chức năng đã triển khai. Một số nhánh tùy cấu hình môi trường hoặc trạng thái dịch vụ ngoài.
