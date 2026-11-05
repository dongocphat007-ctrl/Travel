# Bản đồ file JavaScript (frontend/js)

Tên file đã được đặt theo nội dung. Bảng gom theo trang/chức năng để biết sửa gì ở file nào.

## Khung chung, nạp trên mọi trang
| File | Làm gì |
|---|---|
| `include.js` | Nhúng các mảnh HTML trong `html/` vào `index.html` |
| `main.js` | Điểm vào: điều hướng giữa các trang, giao diện đăng nhập, khởi động ứng dụng; chặn tài khoản nội bộ ở giao diện khách và chuyển về dashboard vai trò |
| `constants.js` | Hằng số, dữ liệu tĩnh, `AppState`, thông tin doanh nghiệp `BUSINESS` (sửa một chỗ, cả site đổi) |
| `utils.js` | Hàm tiện ích dùng chung (toast, định dạng…) và `StorageManager` (LocalStorage theo từng người dùng) |
| `safe-helpers.js` | Ảnh lỗi → ảnh thay thế, lazy-load, debounce ô tìm kiếm, gọi API có thử lại, cache, vẽ danh sách theo lô |
| `api-client.js` | Cầu nối giao diện ↔ máy chủ `/api` |
| `lazy-libs.js` | Nạp thư viện nặng (jsPDF, docx, xlsx…) chỉ khi cần |
| `module-config.js` | Cấu hình Yêu thích/SEO cho khớp markup của trang |
| `brand-rename-migration.js` | Chuyển dữ liệu cũ sang tên thương hiệu "Travel" |
| `accessibility.js` | Trợ năng: alt ảnh, nhãn ô nhập, điều hướng bàn phím |
| `seo.js` | Title/mô tả/OG theo từng route |
| `contact-fab.js` | Nút liên hệ nổi (Zalo, Messenger, gọi điện) |

## Tài khoản
| File | Làm gì |
|---|---|
| `auth.js` | Đăng nhập, đăng ký, đăng xuất, Google, xác thực OTP email (`OTPService`) |
| `account-extras.js` | Thông báo theo tài khoản, kiểm tra hồ sơ, danh sách đơn của khách |
| `validator.js` | Kiểm tra dữ liệu form |
| `voucher-ui.js` | Giao diện voucher |

## Trang chủ và tour
| File | Làm gì |
|---|---|
| `home.js` | Danh sách tour trang chủ: tải dữ liệu, bộ lọc, phân trang |
| `banner.js` | Banner động và xếp hạng "Tour được yêu thích nhất" |
| `route-map.js` | Hero: bản đồ tuyến Bắc–Nam và nút chọn vùng |
| `tour-page.js` | Trang riêng của từng tour (`#/tour/<id>`), đánh giá |
| `tour-images.js` | Ảnh bìa tour (ảnh riêng → Wikipedia → emoji) |
| `weather.js` | Thời tiết điểm đến (Open-Meteo) |
| `tour-location-map.js` | Bản đồ nhỏ ở trang chi tiết tour |
| `favorites.js` | Yêu thích, so sánh, chia sẻ tour |

## Tìm tour, bản đồ, AI
| File | Làm gì |
|---|---|
| `tour-search.js` | Lõi tìm tour (RAG + AI), dùng chung cho chatbot và trang Tìm tour |
| `tour-finder.js` | Giao diện trang "Tìm tour" |
| `tour-finder-map.js` | Bản đồ Leaflet của trang Tìm tour |
| `tour-popup.js` | Popup tour trên bản đồ |
| `map-basemap.js` | Nền bản đồ (Google Maps tiếng Việt) |
| `world-map.js`, `world-tours.js` | Bản đồ thế giới và danh sách tour theo quốc gia |
| `rag.js` | Tìm kiếm ngữ cảnh BM25 trên tour, món ăn, HDV… |
| `ai-client.js` | Gọi AI dùng chung (qua `/api/ai`) |
| `chatbot.js`, `chat-log.js` | Chatbot AI và lưu lịch sử chat |

## Hướng dẫn viên
| File | Làm gì |
|---|---|
| `guides-page.js` | Trang danh sách HDV (`#/guides`) và bộ lọc |
| `guide-detail-page.js` | Trang hồ sơ HDV (`guide.html`) |
| `guide-picker.js` | Ô chọn HDV trong form đặt tour |

## Đặt tour, thanh toán, xuất file
| File | Làm gì |
|---|---|
| `payment.js` | Chuyển khoản VietQR |
| `booking-pdf.js`, `print-booking.js` | Phiếu xác nhận đặt tour (PDF / trang in) |
| `price-breakdown-format.js` | Định dạng chi tiết giá của đơn |
| `hotel-flight-search.js` | Tìm khách sạn, chuyến bay |
| `qrcode-lib.js`, `pdf-vietnamese-font.js` | Thư viện QR; font tiếng Việt cho PDF |
| `export-trip-docx-pdf.js` | Xuất chuyến đi ra Word/PDF |
| `import-trip-from-file.js` | Nhập chuyến đi từ file Word/PDF |

## Chuyến đi cá nhân và hồ sơ
| File | Làm gì |
|---|---|
| `trips.js` | Quản lý chuyến đi (`TripManager`) |
| `trip-views.js` | Vẽ giao diện chuyến đi: trang chủ cá nhân, chi tiết, lịch trình, ngân sách, dashboard, hồ sơ |
| `profile-tabs.js` | Các tab trong hồ sơ: chuyến đi cá nhân, tour mẫu đã đăng ký |
| `food-page.js` | Trang ẩm thực 3 miền |
| `policy-page.js` | Trang Chính sách và Liên hệ |

## Thống kê Admin

> Các trang nội bộ (Admin, Thu ngân, Điều hành, CSKH, Nội dung, HDV) nằm ở `frontend/staff/*.js`, không thuộc thư mục `js/`.
| File | Làm gì |
|---|---|
| `order-stats.js` | Tab Thống kê đơn và thanh toán |
