# Hệ Thống Vai Trò và Phân Quyền (RBAC) – Travel Project

Tài liệu này quy định chi tiết toàn bộ các **vai trò (Roles)**, **quyền hạn (Permissions)** và **ma trận phân quyền (RBAC Matrix)** trong dự án Travel. Hệ thống được xây dựng đồng bộ giữa **Backend (Spring Boot)** và **Frontend (Vanilla JS)**.

---

## 1. Cấp bậc và Danh mục 7 Vai trò

Hệ thống phân cấp thành:
1. **ADMIN**: Cấp quản trị cao nhất, không có vai trò nào cao hơn (đã loại bỏ superadmin).
2. **Nhân viên nội bộ (Staff)**: Do `ADMIN` tạo và quản lý:
   - `CASHIER` (Thu ngân)
   - `OPERATOR` (Điều hành tour)
   - `SUPPORT` (Chăm sóc khách hàng)
   - `CONTENT` (Biên tập nội dung)
   - `GUIDE` (Hướng dẫn viên)
3. **Khách hàng bên ngoài (Customer)**:
   - `CUSTOMER`: Người dùng thông thường tự đăng ký tài khoản.

### Bảng tóm tắt định danh vai trò

| Mã vai trò (Enum) | Key định danh | Tiền tố tài khoản | Tên hiển thị | Loại tài khoản | Trang Dashboard / Giao diện chính |
|---|---|---|---|---|---|
| `ADMIN` | `admin` | `ad` | Quản trị viên | Nội bộ | `admin.html` |
| `CASHIER` | `cashier` | `tn` | Thu ngân | Nội bộ | `cashier.html` |
| `OPERATOR` | `operator` | `dh` | Điều hành tour | Nội bộ | `operator.html` |
| `SUPPORT` | `support` | `cs` | Chăm sóc khách hàng | Nội bộ | `support.html` |
| `CONTENT` | `content` | `nd` | Biên tập nội dung | Nội bộ | `content.html` |
| `GUIDE` | `guide` | `hdv` | Hướng dẫn viên | Nội bộ | `guide.html` |
| `CUSTOMER` | `user` / `customer` | `kh` | Khách hàng | Khách ngoài | `page-profile.html` / `index.html` |

**Giới hạn khu vực:** phiên nội bộ chỉ dùng trang dashboard tương ứng vai trò dưới `/staff/`. Kể cả `ADMIN` không truy cập trang chủ/giao diện khách khi còn đăng nhập nội bộ; truy cập trang khách hoặc dashboard vai trò khác sẽ được chuyển về dashboard của chính mình. Khách hàng không được mở dashboard nhân viên. Quy tắc điều hướng được kiểm tra ở backend; quyền API vẫn do RBAC quyết định.

---

## 2. Chi tiết Quyền hạn của Từng Vai trò (Những gì được dùng)

### 2.1. Khách hàng (`CUSTOMER`)
Khách hàng tự đăng ký tài khoản qua Email hoặc Google và được sử dụng các tính năng:
- **`booking:create`**: Tìm kiếm và thực hiện đặt tour mới.
- **`booking:view_own`**: Xem danh sách các đơn đặt tour của chính mình và theo dõi tiến trình (timeline).
- **`booking:cancel_own`**: Yêu cầu hủy đơn tour của mình theo chính sách hoàn tiền tương ứng mốc thời gian.
- **`booking:reschedule_own`**: Yêu cầu đổi ngày khởi hành nếu còn chỗ và HDV rảnh.
- **`review:create_own`**: Viết đánh giá chất lượng (điểm sao, nhận xét) cho tour và hướng dẫn viên sau khi hoàn thành chuyến đi (`completed`).
- **`complaint:create_own`**: Gửi phản ánh, khiếu nại kèm hình ảnh minh chứng trong hoặc sau chuyến đi.

### 2.2. Thu ngân (`CASHIER`)
Thu ngân chịu trách nhiệm toàn bộ luồng tiền vào/ra của doanh nghiệp:
- **`payment:view`**: Xem danh sách các giao dịch thanh toán và thông tin chuyển khoản.
- **`payment:confirm`**: Bấm xác nhận khi nhận tiền cọc (20%) hoặc thanh toán đủ (100%) để chuyển đơn sang `paid_deposit` hoặc `paid_full`.
- **`payment:resolve_discrepancy`**: Xử lý và ghi chú các giao dịch chuyển thiếu, thừa hoặc sai cú pháp chuyển khoản.
- **`payment:refund`**: Thực hiện chuyển trạng thái hoàn tiền `refunded` khi khách hủy hoặc khiếu nại đã được duyệt.
- **`reconcile:create`**: Lập bản đóng sổ đối soát cuối ngày (tổng số tiền thực thu, đối chiếu sao kê ngân hàng, ghi nhận chênh lệch).
- **`stats:view_cashier`**: Xem thống kê tổng tiền thực thu trong ngày.
- **Không được làm:** Không xác nhận đơn (`confirmed`), không duyệt hoàn tiền, không quản lý nhân viên, không xem doanh thu tổng.

### 2.3. Điều hành tour (`OPERATOR`)
Điều hành tour chịu trách nhiệm vận hành lịch trình và nhân sự dẫn đoàn:
- **`tour:assign_guide`**: Gán hoặc đổi hướng dẫn viên cho các đơn tour dựa trên lịch rảnh (`isGuideFree`) và khu vực phụ trách.
- **`tour:schedule_manage`**: Quản lý lịch khởi hành các chuyến đi, ngày khởi hành và cập nhật số chỗ còn trống.
- **`tour:cancel_propose`**: Đề xuất hủy hoặc dồn ngày tour khi đến hạn mà không đủ số khách tối thiểu.
- **`tour:overdue_assignment_handle`**: Tiếp nhận cảnh báo và xử lý các đơn tour bị bỏ quên hoặc HDV từ chối.
- **`incident:manage`**: Tiếp nhận báo cáo sự cố từ HDV để điều phối hỗ trợ khẩn cấp.
- **`passenger:view_unmasked`**: Xem thông tin hành khách đầy đủ kèm số CCCD/hộ chiếu để chuẩn bị danh sách đoàn và bảo hiểm.
- **`stats:view_operator`**: Xem số lượng đơn, các chuyến đi sắp tới, tình trạng phân bổ hướng dẫn viên (không xem doanh thu tài chính).

### 2.4. Chăm sóc khách hàng (`SUPPORT`)
Bộ phận CSKH là cầu nối giữa khách hàng và doanh nghiệp:
- **`complaint:process`**: Tiếp nhận, theo dõi và xử lý các khiếu nại của khách (`open` → `processing` → `resolved`).
- **`complaint:refund_propose`**: Đề xuất mức hoàn tiền đền bù cho khách hàng khiếu nại (để Admin phê duyệt).
- **`waitlist:manage`**: Theo dõi danh sách chờ (waitlist) khi tour kín chỗ và liên hệ khách khi có người hủy.
- **`support:assist_customer`**: Trợ giúp khách đổi ngày, liên hệ khách khi chuyển khoản lệch/thiếu thông tin.
- **`passenger:view_masked`**: Xem thông tin hành khách với số CCCD/hộ chiếu được che bảo mật.
- **`stats:view_support`**: Xem thống kê số lượng khiếu nại và thời gian giải quyết trung bình (không xem doanh thu).

### 2.5. Biên tập nội dung (`CONTENT`)
Bộ phận nội dung quản lý hình ảnh, thông tin giới thiệu và ẩm thực:
- **`content:manage_tour`**: Tạo mới, chỉnh sửa mô tả, hình ảnh, lịch trình tour (lưu ở trạng thái **Bản nháp** chờ Admin duyệt).
- **`content:manage_food`**: Quản lý danh mục đặc sản ẩm thực 3 miền (Bắc, Trung, Nam).
- **`content:manage_banner`**: Quản lý hình ảnh banner carousel hiển thị trên trang chủ.
- **`review:moderate`**: Ẩn hoặc hiển thị các bình luận, đánh giá vi phạm tiêu chuẩn cộng đồng.
- **`stats:view_content`**: Xem số lượt xem tour, điểm đánh giá trung bình và các tour được quan tâm nhất (không xem doanh thu).
- **Không được làm:** Không được sửa các trường nhạy cảm của tour: giá tour, loại HDV (`guideType`), cờ cho phép gia hạn (`allowExtension`), sức chứa tối đa.

### 2.6. Hướng dẫn viên (`GUIDE`)
Hướng dẫn viên làm việc trực tiếp tại hiện trường dẫn đoàn:
- **`guide:view_assigned`**: Xem danh sách các tour và danh sách đoàn khách được phân công cho mình.
- **`guide:respond_assignment`**: Nhận tour (`guide_accepted`) hoặc từ chối kèm lý do khi được điều hành gán tour.
- **`trip:checkin`**: Điểm danh hành khách khi lên xe/đoàn và đánh dấu vắng mặt (`no_show`).
- **`trip:start_end`**: Bấm bắt đầu chuyến đi (`in_progress`) vào ngày khởi hành và bấm kết thúc chuyến đi (`completed`).
- **`incident:report`**: Tạo báo cáo sự cố (sức khỏe, thất lạc đồ đạc, lịch trình) gắn trực tiếp với mã đơn tour.
- **`guide:view_profile`**: Xem hồ sơ HDV của chính mình (bản chỉ xem).
- **`trip:report`**: Nộp / sửa báo cáo tour gọn sau khi kết thúc chuyến đi.
- **`guide:view_schedule`**: Xem lịch làm việc cá nhân, các ngày bận (`busyDates`) và ngày nghỉ bù sau tour (`restDaysAfterTour`).

### 2.7. Quản trị viên (`ADMIN`)
Cấp quản trị cao nhất của hệ thống, quản lý toàn diện:
- **`staff:manage`**: Toàn quyền tạo nhân viên (chế độ nhập tay hoặc tự sinh với mã tiền tố `tn001`, `dh001`, v.v.), khóa/mở khóa tài khoản, đặt lại mật khẩu.
- **`booking:confirm` / `booking:reject`**: Xác nhận duyệt đơn (`confirmed`) hoặc từ chối đơn tour sau khi đã nhận tiền.
- **`refund:approve`**: Phê duyệt yêu cầu hoàn tiền (do khách hủy hoặc do CSKH đề xuất đền bù).
- **`reconcile:approve`**: Duyệt bản đóng sổ đối soát cuối ngày do Thu ngân lập và ghi nhận giải trình chênh lệch.
- **`company_cancel:approve`**: Phê duyệt quyết định hủy tour từ phía công ty (thiên tai, không đủ khách).
- **`tour:approve_content`**: Duyệt xuất bản các tour nháp do Biên tập viên tạo lên trang công khai.
- **`tour:manage_sensitive`**: Toàn quyền sửa các trường nhạy cảm: giá tour, `guideType`, `allowExtension`, sức chứa.
- **`system:config`**: Cấu hình các tham số hệ thống (thời gian hết hạn giữ chỗ, hạn thanh toán, tỷ lệ cọc, tích hợp bên ngoài).
- **`audit:view`**: Xem toàn bộ nhật ký thay đổi trạng thái đơn và thao tác quản trị.
- **`stats:view_full`**: Xem dashboard thống kê toàn diện (doanh thu, số đơn, KPI, biểu đồ và bảng số liệu drill-down).
- **Làm thay việc của:** `OPERATOR`, `SUPPORT`, `CONTENT`.
- **NGOẠI LỆ QUAN TRỌNG:** ADMIN **KHÔNG** có quyền `payment:confirm` (nguyên tắc phân lập người thu tiền và người duyệt đơn).

---

## 3. Ma trận Phân quyền Tổng hợp (RBAC Matrix)

| Nghiệp vụ / Quyền hạn | Mã Permission | CUSTOMER | CASHIER | OPERATOR | SUPPORT | CONTENT | GUIDE | ADMIN |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Đặt tour mới | `booking:create` | ✔ | | | | | | |
| Xem đơn của mình | `booking:view_own` | ✔ | | | | | | |
| Hủy đơn của mình | `booking:cancel_own` | ✔ | | | | | | |
| Viết đánh giá sau tour | `review:create_own` | ✔ | | | | | | |
| Gửi khiếu nại | `complaint:create_own` | ✔ | | | | | | |
| Xem danh sách thanh toán | `payment:view` | | ✔ | | | | | ✔ |
| **Xác nhận thu tiền** | `payment:confirm` | | **✔** | | | | | **KHÔNG** |
| Xử lý chuyển khoản lệch | `payment:resolve_discrepancy` | | ✔ | | | | | |
| Thực hiện hoàn tiền | `payment:refund` | | ✔ | | | | | |
| Lập bản đóng sổ cuối ngày | `reconcile:create` | | ✔ | | | | | |
| Xem tổng tiền thu ngày | `stats:view_cashier` | | ✔ | | | | | |
| **Xác nhận duyệt đơn** | `booking:confirm` | | | | | | | ✔ |
| Từ chối duyệt đơn | `booking:reject` | | | | | | | ✔ |
| **Duyệt hoàn tiền** | `refund:approve` | | | | | | | ✔ |
| **Duyệt bản đóng sổ** | `reconcile:approve` | | | | | | | ✔ |
| Duyệt công ty hủy tour | `company_cancel:approve` | | | | | | | ✔ |
| Gán / đổi HDV | `tour:assign_guide` | | | ✔ | | | | ✔ |
| Quản lý lịch khởi hành | `tour:schedule_manage` | | | ✔ | | | | ✔ |
| Đề xuất hủy / dồn tour | `tour:cancel_propose` | | | ✔ | | | | ✔ |
| Xem CCCD không che | `passenger:view_unmasked` | | | ✔ | | | | ✔ |
| Thống kê điều hành tour | `stats:view_operator` | | | ✔ | | | | ✔ |
| Xử lý khiếu nại khách | `complaint:process` | | | | ✔ | | | ✔ |
| Đề xuất hoàn tiền khiếu nại | `complaint:refund_propose` | | | | ✔ | | | ✔ |
| Quản lý danh sách chờ | `waitlist:manage` | | | | ✔ | | | ✔ |
| Xem CCCD dạng che | `passenger:view_masked` | | | | ✔ | | | ✔ |
| Thống kê khiếu nại CSKH | `stats:view_support` | | | | ✔ | | | ✔ |
| Soạn nội dung tour (nháp) | `content:manage_tour` | | | | | ✔ | | ✔ |
| Quản lý ẩm thực 3 miền | `content:manage_food` | | | | | ✔ | | ✔ |
| Quản lý banner quảng cáo | `content:manage_banner` | | | | | ✔ | | ✔ |
| Ẩn/hiện bình luận vi phạm | `review:moderate` | | | | | ✔ | | ✔ |
| **Sửa giá / trường nhạy cảm** | `tour:manage_sensitive` | | | | | | | ✔ |
| **Duyệt xuất bản tour nháp** | `tour:approve_content` | | | | | | | ✔ |
| Nhận / từ chối tour giao | `guide:respond_assignment` | | | | | | ✔ | |
| Điểm danh khách (check-in) | `trip:checkin` | | | | | | ✔ | |
| Bắt đầu / kết thúc chuyến | `trip:start_end` | | | | | | ✔ | |
| Báo cáo sự cố chuyến đi | `incident:report` | | | | | | ✔ | |
| Quản lý tài khoản nhân viên | `staff:manage` | | | | | | | ✔ |
| Cấu hình tham số hệ thống | `system:config` | | | | | | | ✔ |
| Xem nhật ký audit log | `audit:view` | | | | | | | ✔ |
| Xem doanh thu / KPI đầy đủ | `stats:view_full` | | | | | | | ✔ |

---

## 4. Cách Sử dụng trong Mã nguồn

### 4.1. Phía Server (Spring Boot / Java)

Các lớp chính nằm trong package `vn.travel.security`:
- `Role.java`: Enum định nghĩa các vai trò.
- `Permission.java`: Enum định nghĩa các mã quyền.
- `RolePermissions.java`: Trung tâm lưu trữ và kiểm tra ma trận quyền.

Trong các Controller, kiểm tra quyền thông qua `CurrentUser`:
```java
@Autowired
private CurrentUser current;

// 1. Kiểm tra theo Permission (Khuyến nghị dùng để dễ mở rộng vai trò):
current.requirePermission(req, Permission.PAYMENT_CONFIRM);

// 2. Kiểm tra theo Role cụ thể:
current.requireRole(req, Role.CASHIER);

// 3. Kiểm tra vai trò Admin:
current.requireAdmin(req);

// 4. Lấy thông tin vai trò hiện tại:
Role role = current.getRole(req);
boolean canRefund = current.hasPermission(req, Permission.PAYMENT_REFUND);
```

### 4.2. Phía Client (Frontend / Vanilla JS)

File nguồn dùng chung `frontend/shared/roles-permissions.js` (UMD) cung cấp:
- `window.TravelRoles`: Danh mục vai trò và metadata.
- `window.TravelPermissions`: Danh mục mã quyền.
- `window.TravelRBAC`: Bộ điều hướng và kiểm tra quyền.

Thông qua module `Auth`:
```javascript
// Kiểm tra quyền của người dùng hiện tại
if (Auth.hasPermission("payment:confirm")) {
  btnConfirmPayment.style.display = "block";
}

// Kiểm tra vai trò
if (Auth.hasRole("OPERATOR")) {
  // Hiển thị chức năng điều hành
}

// Kiểm tra nhân viên nội bộ
if (Auth.isStaff()) {
  // Hiển thị thanh công cụ nội bộ
}

// Lấy thông tin vai trò
const meta = Auth.getRoleMeta();
console.log(meta.name); // "Thu ngân"
```

### 4.3. API Tra cứu từ Máy chủ
- `GET /api/auth/roles`: Trả về danh sách tất cả các vai trò, metadata và danh mục quyền.
- `GET /api/auth/permissions`: Trả về toàn bộ ma trận phân quyền và mô tả quyền.
- `GET /api/auth/me`: Trả về thông tin tài khoản hiện tại kèm `role`, `roleName`, `rolePrefix` và `permissions`.

---

## 5. Hướng dẫn Mở rộng Vai trò Mới trong Tương lai

Khi cần bổ sung vai trò mới (ví dụ: Kế toán trưởng `ACCOUNTANT`):
1. **Tại `Role.java` & `shared/roles-permissions.js`:** Thêm giá trị `ACCOUNTANT("accountant", "Kế toán", "kt", true, "...")`.
2. **Tại `RolePermissions.java`:** Cấu hình danh sách `Set<Permission>` tương ứng cho `ACCOUNTANT`.
3. **Các API hiện tại:** Giữ nguyên 100% logic vì mọi kiểm tra đều dựa trên `hasPermission()`, không cần viết thêm câu lệnh `if/else` rải rác trong hệ thống.


## Bổ sung: Thông báo, thù lao HDV

- **`notify:send`** (chỉ ADMIN): gửi thông báo / nhắc nhở chủ động cho vai trò hoặc cá nhân. Người nhận phản hồi RIÊNG cho Admin. Mọi vai trò nội bộ đều dùng được trang **Thông báo** để trò chuyện với vai trò khác (không cần quyền riêng, khách hàng bị chặn).
- **`guide_fee:pay`** (chỉ CASHIER): ghi nhận đã chi thù lao HDV. Admin không có quyền này (tách người duyệt và người chi tiền).
- API: `GET/POST /api/messages`, `GET /api/messages/recipients`, `GET /api/messages/{id}`, `POST /api/messages/{id}/reply`; `GET /api/guide/profile`, `GET/POST /api/guide/tours/{id}/report`; `GET /api/cashier/guide-fees`, `POST /api/cashier/guide-fees/pay`.
- Dữ liệu: `threads.json` (hội thoại); đơn có thêm `tourReport`, `lateCount`, `guideFeePaidAt`; điểm danh có thêm trạng thái `late` (đến trễ, vẫn tính có mặt).
