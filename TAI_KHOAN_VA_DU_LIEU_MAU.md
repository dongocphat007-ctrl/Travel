# Danh Sách Tài Khoản Thiết Lập Sẵn & Dữ Liệu Ảo Theo Vai Trò

> **Phạm vi sau đăng nhập:** mọi tài khoản nội bộ, kể cả Admin, chỉ dùng dashboard và chức năng theo vai trò dưới `/staff/`. Khi phiên nội bộ còn hiệu lực, trang chủ và giao diện khách chuyển về dashboard tương ứng; đăng xuất để vào website khách hàng.

> **Ghi chú đăng nhập nhanh:**  
> Tất cả các tài khoản bên dưới đều dùng chung một mật khẩu mặc định:  
> 🔑 **Mật khẩu:** `Travel@2026`  
> *(Đáp ứng quy định mật khẩu mạnh: ≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt)*

---

## 1. Bảng Tổng Hợp Tài Khoản Mẫu (7 Vai Trò Hệ Thống)

| STT | Vai trò | Mã NV | Họ và tên | Email đăng nhập | Mật khẩu | Vùng phụ trách & Hồ sơ liên kết |
|:---:|---|:---:|---|---|:---:|---|
| 1 | **Quản trị viên (`ADMIN`)** | `ad001` | Quản Trị Viên | `admin@travel.vn` | `Travel@2026` | Toàn quyền duyệt đơn, duyệt hoàn tiền/đóng sổ, quản lý nhân viên, cấu hình. |
| 2 | **Thu ngân (`CASHIER`)** | `tn001` | Lê Thu Ngân | `thungan@travel.vn` | `Travel@2026` | Xác nhận tiền cọc/đủ, đối soát chuyển lệch, hoàn tiền, lập bản đóng sổ cuối ngày. |
| 3 | **Điều hành tour (`OPERATOR`)** | `dh001` | Trần Điều Hành | `dieuhanh@travel.vn` | `Travel@2026` | Gán và đổi HDV, quản lý lịch khởi hành, xử lý đơn bị bỏ quên và sự cố đoàn. |
| 4 | **Chăm sóc khách (`SUPPORT`)** | `cs001` | Phạm Chăm Sóc | `cskh@travel.vn` | `Travel@2026` | Tiếp nhận & xử lý khiếu nại, đề xuất hoàn tiền, quản lý danh sách chờ (waitlist). |
| 5 | **Biên tập nội dung (`CONTENT`)** | `nd001` | Hoàng Biên Tập | `bientap@travel.vn` | `Travel@2026` | Soạn thảo tour nháp, quản lý ẩm thực 3 miền, banner quảng cáo, duyệt bình luận. |
| 6 | **HDV Hà Nội – Hạ Long (`GUIDE`)** | `hdv001` | Nguyễn Minh Quân | `hdv.quan@travel.vn` | `Travel@2026` | Hồ sơ `g_hn01`: Miền Bắc (Hà Nội, Vịnh Hạ Long, 8 năm KN, Đơn `TRAVEL1004` chờ nhận). |
| 7 | **HDV Tây Bắc Quốc tế (`GUIDE`)** | `hdv002` | Trần Thu Hà | `hdv.ha@travel.vn` | `Travel@2026` | Hồ sơ `g_hn02`: Miền Bắc (Sa Pa, Hà Giang, Tiếng Pháp, Đơn `TRAVEL1005` sắp đi). |
| 8 | **HDV Trekking Tây Bắc (`GUIDE`)** | `hdv003` | Hoàng Văn Sơn | `hdv.son@travel.vn` | `Travel@2026` | Hồ sơ `g_hn03`: Tây Bắc (Trekking Fansipan, Săn mây Y Tý, Sơ cấp cứu núi cao). |
| 9 | **HDV Biển Đảo Đông Bắc (`GUIDE`)** | `hdv004` | Phạm Thị Lan | `hdv.lan@travel.vn` | `Travel@2026` | Hồ sơ `g_hn04`: Miền Bắc (Cát Bà, Cô Tô, gia đình có trẻ nhỏ, Tiếng Trung). |
| 10 | **HDV Đông Tây Bắc (`GUIDE`)** | `hdv005` | Bùi Đức Thắng | `hdv.thang@travel.vn` | `Travel@2026` | Hồ sơ `g_hn05`: Miền Bắc (Mộc Châu, Điện Biên, 12 năm KN, đoàn số lượng lớn). |
| 11 | **HDV Cố Đô Di Sản (`GUIDE`)** | `hdv006` | Lê Hoàng Phúc | `hdv.phuc@travel.vn` | `Travel@2026` | Hồ sơ `g_mt01`: Miền Trung (Huế, Hội An, Đà Nẵng, 10 năm KN văn hóa cố đô). |
| 12 | **HDV Khám Phá Hang Động (`GUIDE`)** | `hdv007` | Nguyễn Thị Mai | `hdv.mai@travel.vn` | `Travel@2026` | Hồ sơ `g_mt02`: Miền Trung (Phong Nha – Kẻ Bàng, cứu hộ hang động cơ bản). |
| 13 | **HDV Biển Nam Trung Bộ (`GUIDE`)** | `hdv008` | Trương Quốc Bảo | `hdv.bao@travel.vn` | `Travel@2026` | Hồ sơ `g_mt03`: Miền Trung (Nha Trang, Phú Yên, lặn biển ngắm san hô, Tiếng Hàn). |
| 14 | **HDV Văn Hóa Tây Nguyên (`GUIDE`)** | `hdv009` | Đinh Công Hiếu | `hdv.hieu@travel.vn` | `Travel@2026` | Hồ sơ `g_mt04`: Tây Nguyên (Đà Lạt, Buôn Ma Thuột, cồng chiêng & đồi cà phê). |
| 15 | **HDV Sông Nước Nam Bộ (`GUIDE`)** | `hdv010` | Võ Anh Tuấn | `hdv.tuan@travel.vn` | `Travel@2026` | Hồ sơ `g_mn01`: Miền Nam (Cần Thơ, Chợ nổi Cái Răng, Đơn `TRAVEL1006` đang đi hôm nay). |
| 16 | **HDV Miệt Vườn Sinh Thái (`GUIDE`)** | `hdv011` | Châu Ngọc Diệp | `hdv.diep@travel.vn` | `Travel@2026` | Hồ sơ `g_mn02`: Miền Nam (Vĩnh Long, Bến Tre, homestay miệt vườn, Tiếng Pháp). |
| 17 | **HDV Quốc Tế TP.HCM (`GUIDE`)** | `hdv012` | Lý Thanh Tùng | `hdv.tung@travel.vn` | `Travel@2026` | Hồ sơ `g_mn03`: Miền Nam (TP.HCM, Củ Chi, Cần Giờ, Tiếng Hoa, đoàn doanh nghiệp). |
| 18 | **HDV Biển Đảo Phía Nam (`GUIDE`)** | `hdv013` | Huỳnh Kim Ngân | `hdv.ngan@travel.vn` | `Travel@2026` | Hồ sơ `g_mn04`: Miền Nam (Phú Quốc, Côn Đảo, nghỉ dưỡng & tâm linh). |
| 19 | **HDV Đông Bắc Á (`GUIDE`)** | `hdv014` | Đặng Bảo Ngọc | `hdv.ngoc@travel.vn` | `Travel@2026` | Hồ sơ `g_qt01`: Quốc tế (Nhật Bản, Hàn Quốc, JLPT N2, thủ tục xuất nhập cảnh). |
| 20 | **HDV Đông Nam Á (`GUIDE`)** | `hdv015` | Mai Anh Thư | `hdv.thu@travel.vn` | `Travel@2026` | Hồ sơ `g_qt02`: Quốc tế (Thái Lan, Singapore, Malaysia, Tiếng Thái giao tiếp). |
| 21 | **HDV Quốc Tế Trung - Hàn (`GUIDE`)** | `hdv016` | Vũ Hải Đăng | `hdv.dang@travel.vn` | `Travel@2026` | Hồ sơ `g_qt03`: Quốc tế (Seoul, Jeju, Bắc Kinh, Thượng Hải, TOPIK 4 & HSK). |
| 22 | **Khách hàng mẫu (`CUSTOMER`)** | `kh001` | Nguyễn Văn An | `khachhang@travel.vn` | `Travel@2026` | Khách hàng mẫu: có sẵn các đơn đặt tour thực tế ở nhiều giai đoạn. |

---

## 2. Dữ Liệu Ảo (Mock Data) Cho Từng Vai Trò Khi Đăng Nhập

Hệ thống đã được thiết lập sẵn **hơn 100+ đơn đặt tour, 60+ đánh giá review, 16 hồ sơ HDV đầy đủ lịch sử và ảnh chân dung thực tế, 6 báo cáo sự cố điều hành, 6 khiếu nại CSKH, 4 danh sách chờ (waitlist), 4 tour nháp biên tập, 14 bản đóng sổ và 4 giao dịch chuyển khoản lệch**. 100% tài khoản vai trò (Admin, Thu ngân, Điều hành, CSKH, Biên tập, 16 HDV và Khách hàng) đều có ảnh đại diện (avatar) chân dung AI / ảnh thật sắc nét:

### 2.1. Dành cho THU NGÂN (`CASHIER`) – Email: `thungan@travel.vn`
Khi Thu ngân đăng nhập, giao diện sẽ có các danh mục số tiền và nghiệp vụ rõ ràng:
1. **Đơn chờ xác nhận tiền (`pending_payment`):**
   - `TRAVEL1001`: Hà Nội – Hạ Long 3N2Đ (2 khách, tổng 5.000.000 ₫, **cọc 20%: 1.000.000 ₫**)
   - `TRAVEL2001`: Ninh Bình – Tràng An 2N1Đ (2 khách, tổng 3.600.000 ₫, **cọc 20%: 720.000 ₫**)
   - `TRAVEL2002`: Phú Quốc – Cáp treo Hòn Thơm 4N3Đ (2 khách, tổng 11.000.000 ₫, **cọc 20%: 2.200.000 ₫**)
   - `TRAVEL2003`: Nha Trang – Lặn ngắm san hô 3N2Đ (2 khách, tổng 6.400.000 ₫, **cọc 20%: 1.280.000 ₫**)
   - `TRAVEL2004`: Đà Lạt mộng mơ 3N2Đ (4 khách, **trả đủ 100%: 10.400.000 ₫**)
   - `TRAVEL2006`: Hokkaido mùa tuyết trắng Nhật Bản 6 ngày (2 khách, tổng 76.000.000 ₫, **cọc 20%: 15.200.000 ₫**)
   - 👉 **Hành động:** Nút *"Đã nhận cọc 20%"* hoặc *"Đã nhận đủ 100%"*.
2. **Đơn chờ thu nốt 80% công nợ sau chuyến đi (`balance`):**
   - `TRAVEL2010`: Cần Thơ Cái Răng (còn nợ **3.360.000 ₫**, hạn thu sau tour 31/10/2026)
   - `TRAVEL2011`: Đà Nẵng Hội An (còn nợ **6.400.000 ₫**, hạn thu 31/10/2026)
   - `TRAVEL2012`: Hà Giang Mã Pí Lèng (còn nợ **11.520.000 ₫**, hạn thu 31/10/2026)
   - `TRAVEL2013`: Côn Đảo linh thiêng (còn nợ **9.920.000 ₫**, hạn thu 31/10/2026)
   - 👉 **Hành động:** Nút *"Đã thu nốt"* để ghi nhận hoàn tất công nợ.
3. **Giao dịch chuyển khoản lệch (`discrepancies`):**
   - `pm_disc_01`: Chuyển thiếu tiền đơn `TRAVEL2001` (khách chuyển 500.000 ₫ thay vì 720.000 ₫).
   - `pm_disc_02`: Sai nội dung không có mã đơn (`unmatched`: chuyển 2.200.000 ₫ ghi 'Tran Van Hung chuyen tien tour').
   - `pm_disc_03`: Chuyển trùng 2 lần đơn `TRAVEL2005` (chuyển 2 lần 1.120.000 ₫, đã bàn giao CSKH liên hệ khách).
4. **Đơn chờ thực hiện lệnh hoàn tiền (`refund_pending`):**
   - `TRAVEL1008`: Hoàn **1.120.000 ₫** cho khách Phạm Văn Cường (Admin đã duyệt hủy tour Nha Trang).
   - `TRAVEL2020`: Hoàn **1.500.000 ₫** (100% cọc) cho khách Đặng Văn Khoa (hủy trước 15 ngày).
   - `TRAVEL2021`: Đã hoàn tiền thành công **2.400.000 ₫** (`refunded`).
   - 👉 **Hành động:** Nút *"Đã hoàn tiền"*.
5. **Bản đối soát đóng sổ cuối ngày:**
   - `rec_20261026`: Ngày 26/10/2026, tổng thu **48.600.000 ₫**, khớp sao kê 100%, chờ Admin duyệt.
   - `rec_20261025`: Tổng thu **39.200.000 ₫**, đã duyệt.
   - `rec_20261024`: Tổng thu **52.450.000 ₫**, lệch -50.000 ₫ do trừ phí duy trì ngân hàng, có giải trình hợp lệ.

---

### 2.2. Dành cho QUẢN TRỊ VIÊN (`ADMIN`) – Email: `admin@travel.vn`
Khi Quản trị viên đăng nhập, các mục chờ duyệt và thống kê hiển thị:
1. **Đơn chờ Admin xác nhận duyệt (`paid_deposit` & `paid_full`):**
   - `TRAVEL1002`: Đà Nẵng – Hội An 4N3Đ (đã cọc 1.600.000 ₫, còn nợ 6.400.000 ₫).
   - `TRAVEL2141`: Quy Nhơn – Kỳ Co – Eo Gió 4N3Đ (đã cọc 2.720.000 ₫).
   - `TRAVEL2142`: Sapa Fansipan (đã cọc 1.120.000 ₫).
   - `TRAVEL2143`: Bangkok – Pattaya 5N4Đ (khách đã trả đủ 100%: 26.700.000 ₫).
   - `TRAVEL2144`: Cần Thơ – Rừng tràm Trà Sư (đã cọc 1.440.000 ₫).
   - 👉 **Hành động:** Nút *"Xác nhận"* (duyệt sang `confirmed`) hoặc nút *"Từ chối"* (kèm lý do).
2. **Bản đóng sổ chờ Admin phê duyệt:**
   - Bản đóng sổ ngày 26/10/2026 `rec_20261026` của Thu ngân Lê Thu Ngân (48.600.000 ₫) đang ở trạng thái `pending_approval`.
   - 👉 **Hành động:** Nút *"Duyệt đóng sổ"*.
3. **Duyệt hoàn tiền & Khiếu nại đền bù:**
   - Đề xuất hoàn tiền khiếu nại `cmp_03` (500.000 ₫) và `cmp_01` (300.000 ₫).
4. **Báo cáo doanh thu & Thống kê toàn diện (Dashboard & Table):**
   - Doanh thu thực tế các tháng 8, 9, 10 năm 2026 và cả năm 2026, drill-down xem từng tháng và quý.
   - Danh sách 33 tài khoản người dùng và nhân viên trong hệ thống.

---

### 2.3. Dành cho ĐIỀU HÀNH TOUR (`OPERATOR`) – Email: `dieuhanh@travel.vn`
Khi Điều hành tour đăng nhập, các đơn cần phân công và lịch tour hiển thị:
1. **Đơn đã xác nhận cần gán HDV (`confirmed`):**
   - `TRAVEL1003`: Tây Bắc – Hà Giang 4N3Đ (4 khách, ngày 08/11/2026, đã thu đủ 14.400.000 ₫).
   - `TRAVEL2131`: Cố đô Huế – Đại Nội 3N2Đ (3 khách, ngày 10/11/2026, gợi ý: Lê Hoàng Phúc `hdv006`).
   - `TRAVEL2132`: Phú Quốc – Sunset Sanato 3N2Đ (5 khách, ngày 12/11/2026, gợi ý: Huỳnh Kim Ngân `hdv013`).
   - `TRAVEL2133`: Seoul – Đảo Nami Hàn Quốc 5N4Đ (4 khách, ngày 15/11/2026, gợi ý: Vũ Hải Đăng `hdv016`).
   - `TRAVEL2134`: Khám phá Hang Én Quảng Bình 3N2Đ (4 khách, ngày 18/11/2026, gợi ý: Nguyễn Thị Mai `hdv007`).
   - 👉 **Hành động:** Mở popup chọn HDV rảnh chuyên tuyến phù hợp và bấm *"Gán HDV"*.
2. **Đơn bị HDV từ chối cần gán lại (`rejected`):**
   - `TRAVEL2136`: Ba Bể – Thác Bản Giốc 3N2Đ (HDV Hoàng Văn Sơn đã từ chối do trùng lịch gia đình, Điều hành bấm gán đổi HDV Bùi Đức Thắng `hdv005`).
3. **Đơn đang chờ HDV xác nhận (`guide_pending`):**
   - `TRAVEL1004` (HDV Nguyễn Minh Quân), `TRAVEL2121` (HDV Nguyễn Thị Mai), `TRAVEL2122` (HDV Huỳnh Kim Ngân).
4. **Quản lý chuyến khởi hành (`departures.json`):**
   - 8 chuyến khởi hành trong tháng 11/2026: kiểm tra sức chứa, số chỗ còn lại, cảnh báo chuyến `belowMin` / `atRisk` thiếu khách tối thiểu (chuyến Mộc Châu ngày 02/11).
5. **Theo dõi sự cố đoàn khách:**
   - 5 sự cố đã được báo cáo và xử lý an toàn (say sóng cano, sơ cứu leo núi Fansipan, mưa đèo Hải Vân...).

---

### 2.4. Dành cho CHĂM SÓC KHÁCH HÀNG (`SUPPORT`) – Email: `cskh@travel.vn`
Khi CSKH đăng nhập, trung tâm xử lý khiếu nại và phản ánh hiển thị:
1. **Khiếu nại đang mở cần xử lý trong 24h (`open`):**
   - `cmp_01`: Đơn `TRAVEL1006` (Khách Nguyễn Văn An phản ánh xe đón trễ 30 phút tại Cần Thơ).
   - `cmp_04`: Đơn `TRAVEL2103` (Khách Trần Thị Bình phản ánh dời lịch trình sớm 1 tiếng tại Hội An).
2. **Khiếu nại đang xử lý đề xuất bồi thường (`processing`):**
   - `cmp_03`: Đơn `TRAVEL2101` (Điều hòa phòng khách sạn kêu ồn, CSKH đã đổi phòng và đề xuất hoàn 500.000 ₫).
3. **Khiếu nại đã giải quyết (`resolved`):**
   - `cmp_02`: Khách Phạm Văn Cường (món ăn lên chậm, đã tặng voucher 200.000 ₫).
   - `cmp_05`: Khách Vũ Thị Mai (để quên sạc dự phòng trên xe, CSKH đã tìm thấy và gửi bưu điện về tận nhà).
4. **Danh sách chờ (`waitlist`):**
   - 2 khách đăng ký chờ khi Tour Phú Quốc và Tour Fansipan kín chỗ.

---

### 2.5. Dành cho BIÊN TẬP NỘI DUNG (`CONTENT`) – Email: `bientap@travel.vn`
Khi Biên tập viên đăng nhập:
1. **Tour bản nháp chờ Admin duyệt (`tour-drafts.json`):**
   - `dr_01`: *"Hành trình Mù Cang Chải mùa nước đổ – Ruộng bậc thang Tây Bắc 3N2Đ"* (trạng thái `draft`).
   - `dr_02`: *"Khám phá Đảo Phú Quý – Thiên đường hoang sơ biển xanh ngọc bích 3N2Đ"* (trạng thái `pending_approval`).
2. **Quản lý ẩm thực 3 miền (`foods.json`):**
   - Đầy đủ đặc sản 3 miền Bắc, Trung, Nam với bộ lọc vùng miền và địa điểm thưởng thức.
3. **Quản lý banner quảng cáo carousel (`banners.json`).**
4. **Kiểm duyệt đánh giá (`reviews.json`):**
   - 64+ đánh giá của khách hàng, công cụ ẩn/hiện đánh giá vi phạm.

---

### 2.6. Dành cho HƯỚNG DẪN VIÊN (`GUIDE`) – TẤT CẢ 16 HDV ĐỀU CÓ LỊCH SỬ TOUR PHONG PHÚ

Tất cả 16 Hướng dẫn viên trong hệ thống đều đã có:
- **Nhiều tour đã hoàn thành trong quá khứ (`completed`)** trong các tháng 8, 9, 10/2026.
- **Có đầy đủ điểm danh hành khách (`checkin: present`), đánh giá sao (4.8 - 5.0 ⭐) và lời khen ngợi từ khách hàng.**
- **Có số liệu thù lao dẫn tour thực tế.**

#### Một số tài khoản HDV tiêu biểu để đăng nhập kiểm tra:
1. **`hdv.quan@travel.vn` (Nguyễn Minh Quân - `hdv001` - Miền Bắc):**
   - Đã đi 4 tour hoàn thành (Hà Nội, Vịnh Hạ Long, Tràng An Bái Đính).
   - Có 1 tour đang đi hôm nay `TRAVEL2101` (Hà Nội – Hạ Long 3N2Đ, đoàn 4 khách).
   - Có 1 tour được giao chờ nhận `TRAVEL1004` (Huế – Phong Nha 3N2Đ).
2. **`hdv.ha@travel.vn` (Trần Thu Hà - `hdv002` - HDV Quốc tế):**
   - Đã đi 4 tour hoàn thành (Sapa, Hà Giang, Côn Đảo).
   - Có 1 tour đang đi `TRAVEL2102` (Sapa mùa lúa chín).
   - Có 1 tour sắp đi ngày 30/10 `TRAVEL1005` (Ba Bể – Bản Giốc 3N2Đ).
3. **`hdv.son@travel.vn` (Hoàng Văn Sơn - `hdv003` - Trekking Tây Bắc):**
   - Đã đi 4 tour trekking Fansipan, săn mây Y Tý, Tà Xùa.
   - Báo cáo sự cố `inc_02` (sơ cứu trượt chân leo núi an toàn).
   - Có tour đã nhận sắp khởi hành ngày 01/11 `TRAVEL2111` (Trekking Fansipan 4 khách).
4. **`hdv.phuc@travel.vn` (Lê Hoàng Phúc - `hdv006` - Di sản Miền Trung):**
   - Đã đi 4 tour Huế, Đà Nẵng, Hội An (nhiều đánh giá 5 sao về kiến thức cung đình).
   - Có tour đang đi hôm nay `TRAVEL2103` (Đà Nẵng – Bà Nà – Hội An).
5. **`hdv.tuan@travel.vn` (Võ Anh Tuấn - `hdv010` - Miền Tây Nam Bộ):**
   - Đã đi 4 tour Cần Thơ, Chợ nổi Cái Răng, Rừng tràm Trà Sư.
   - Có tour đang đi hôm nay `TRAVEL1006` (Cần Thơ Cái Răng, đoàn khách Nguyễn Văn An).
6. **`hdv.ngoc@travel.vn` (Đặng Bảo Ngọc - `hdv014` - Quốc tế Nhật – Hàn):**
   - Đã đi 4 tour Tokyo, Phú Sĩ, Kyoto, Osaka, Seoul.
   - Có tour đã nhận sắp đi ngày 05/11 `TRAVEL2114` (Tokyo – Hakone 6 ngày).
7. *(Tất cả các HDV còn lại: `hdv.lan`, `hdv.thang`, `hdv.mai`, `hdv.bao`, `hdv.hieu`, `hdv.diep`, `hdv.tung`, `hdv.ngan`, `hdv.thu`, `hdv.dang` đều có đầy đủ 4 tour completed và lịch trình riêng!)*

---

### 2.7. Dành cho KHÁCH HÀNG (`CUSTOMER`) – Email: `khachhang@travel.vn`
Khi Khách hàng Nguyễn Văn An đăng nhập, vào mục **"Đơn của tôi"** sẽ thấy:
1. **Đơn `TRAVEL1001` & `TRAVEL2001` (`pending_payment`):** Xem mã QR chuyển khoản Vietcombank, hạn thanh toán 24h.
2. **Đơn `TRAVEL1006` (`in_progress`):** Timeline chuyến đi Cần Thơ đang diễn ra hôm nay.
3. **Đơn `TRAVEL2010` (`confirmed`):** Đã đi tour, công nợ 80% thu sau chuyến đi.
4. **Đơn `TRAVEL1007` (`completed`):** Chuyến đi Côn Đảo đã hoàn thành:
   - 👉 Nút *"Viết đánh giá"* (đã có đánh giá 5 sao).
   - 👉 Nút *"Tải hóa đơn xác nhận"* (file PDF).
5. **Đơn khiếu nại `cmp_01`:** Theo dõi phản hồi từ bộ phận CSKH.
---

## 3. Bản Đồ Vòng Đời Đơn Tour Qua Các Vai Trò

```
[Khách đặt tour]
       │
       ▼
 1. pending_payment  ───►  [Thu ngân CASHIER xác nhận cọc 20%]
       │
       ▼
 2. paid_deposit     ───►  [Admin ADMIN xác nhận duyệt đơn]
       │
       ▼
 3. confirmed        ───►  [Điều hành OPERATOR gán HDV phù hợp]
       │
       ▼
 4. guide_pending    ───►  [HDV GUIDE bấm "Nhận tour"]
       │
       ▼
 5. guide_accepted   ───►  [Chuẩn bị khởi hành & nhắc khách]
       │
       ▼
 6. in_progress      ───►  [HDV điểm danh, dẫn đoàn, báo sự cố]
       │
       ▼
 7. completed        ───►  [Khách đánh giá, Admin ghi nhận doanh thu]
```

*(Các luồng phụ: Khách hủy đơn → `refund_pending` → Thu ngân chuyển tiền → `refunded`)*

---

## 4. Hướng Dẫn Kiểm Tra Nhanh Trên Trình Duyệt

1. Mở trang chủ ứng dụng tại: `http://localhost:8080` (hoặc cổng cấu hình).
2. Bấm nút **"Đăng nhập"** ở góc phải thanh menu.
3. Nhập Email của bất kỳ vai trò nào trong bảng ở **Mục 1** và mật khẩu `Travel@2026`.
4. Sau khi đăng nhập, khách hàng ở giao diện khách; nhân viên (kể cả Admin) được chuyển thẳng vào dashboard riêng và chỉ thấy các chức năng được cấp cho vai trò đó.

---

## 5. Mã nguồn trang nội bộ

Toàn bộ giao diện nội bộ (Admin, Thu ngân, Điều hành, CSKH, Nội dung, HDV) chạy từ `frontend/staff/*.js`, mỗi trang `/staff/<vai-trò>.html` nạp `staff.js` + `parts.js` + file của vai trò đó. Các bản cũ cùng tên trong `frontend/js/` (kể cả `admin-voucher-banner.js`, `admin-chat.js`) đã được xóa; tab Thù lao & đánh giá của HDV đã chuyển sang `staff/guide.js`.

