# Kiến thức đi làm liên quan đến project

> Ghi chú về quy trình phát triển web application: phân tích yêu cầu, vòng đời phần mềm (SDLC) và phương pháp Agile.

## Mục lục

1. [Quy trình phát triển web application](#1-quy-trình-phát-triển-web-application)
2. [Markdown là gì?](#2-markdown-là-gì)
3. [Bài tập](#3-bài-tập)
4. [Phân tích yêu cầu (Requirements Analysis)](#4-phân-tích-yêu-cầu-requirements-analysis)
5. [Agile](#5-agile)

---

## 1. Quy trình phát triển web application

Trong quá trình phát triển web application, có thể đi theo trình tự:

| Bước | Công việc |
|:---:|---|
| 1 | Phân tích yêu cầu (Requirements Analysis) |
| 2 | Xác định chức năng (Feature Identification) |
| 3 | Vẽ workflow cho từng chức năng (Workflow Diagram) |
| 4 | Thiết kế kiến trúc phần mềm (Software Architecture Design) |
| 5 | Thiết kế database |
| 6 | Thiết kế API |
| 7 | Lập trình Frontend và Backend |
| 8 | Kiểm thử (Testing) |

---

## 2. Markdown là gì?

**Markdown** là một ngôn ngữ đánh dấu (Markup Language) đơn giản, dễ đọc và dễ viết. Thường dùng để tạo tài liệu, ghi chú, blog, file README, v.v.

Người dùng định dạng văn bản bằng các ký tự đặc biệt như `#`, `*`, `-`, `>` để tạo tiêu đề, danh sách, liên kết, hình ảnh, trích dẫn, v.v.

---

## 3. Bài tập

Vẽ workflow ở định dạng Markdown cho một sample đơn giản của một web application, và export thiết kế kiến trúc phần mềm ra file `.md`.

| STT | File | Nội dung |
|:---:|---|---|
| 1 | `README.md` | Giới thiệu đề tài |
| 2 | `workflow.md` | Vẽ workflow cho từng chức năng |
| 3 | `Database.md` | Thiết kế database |
| 4 | `API_DOCUMENT.md` | Thiết kế API |
| 5 | `software_architecture_design.md` | Thiết kế kiến trúc phần mềm |

---

## 4. Phân tích yêu cầu (Requirements Analysis)

### 4.1 Định nghĩa

**Phân tích yêu cầu** là quá trình thu thập, phân tích và xác định các yêu cầu mà hệ thống phần mềm cần đáp ứng.

### 4.2 Ví dụ: khách hàng yêu cầu xây dựng website bán hàng

Lập trình viên cần tìm hiểu những gì?

**Về chức năng và người dùng**

- Website bán hàng có những chức năng gì?
- Ai sử dụng website? Khách hàng, nhân viên, quản trị viên?
- Khách hàng có thể xem sản phẩm, đặt hàng, thanh toán, đánh giá sản phẩm.
- Khách hàng có được đặt hàng mà không cần đăng nhập không? Có cần xác thực email không?
- Nhân viên có thể quản lý sản phẩm, đơn hàng, khách hàng, đánh giá sản phẩm.
- Quản trị viên có thể quản lý nhân viên, phân quyền cho nhân viên.

**Về tích hợp**

- Có thanh toán trực tuyến không? Có cần tích hợp cổng thanh toán không?
- Có cần tích hợp dịch vụ vận chuyển không?
- Có cần tích hợp dịch vụ marketing không?
- Có cần tích hợp dịch vụ báo cáo, thống kê không?
- Có tích hợp AI không? Nếu có thì vào chức năng nào: chatbot, gợi ý sản phẩm, phân tích dữ liệu khách hàng?
- Có cần xuất báo cáo ra Excel không?
- Cần có biểu mẫu nào?

### 4.3 Hai nhóm yêu cầu

#### a) Functional Requirements (yêu cầu chức năng)

Mô tả các hành vi, chức năng mà hệ thống **phải làm được**.

Ví dụ:

- Đăng ký tài khoản người dùng
- Đăng nhập tài khoản người dùng
- Đăng xuất tài khoản người dùng
- Xem thông tin người dùng
- Quản lý sản phẩm
- Tìm kiếm sản phẩm
- Thêm vào giỏ hàng
- Đặt hàng và thanh toán

#### b) Non-functional Requirements (yêu cầu phi chức năng)

Mô tả các thuộc tính, tiêu chí chất lượng mà hệ thống **cần đáp ứng**: hiệu suất, bảo mật, khả năng mở rộng, khả năng sử dụng, khả năng bảo trì.

Ví dụ:

- Hệ thống xử lý được 1000 yêu cầu mỗi giây
- Tốc độ tải trang nhanh
- Bảo mật thông tin người dùng
- Dữ liệu được mã hóa khi truyền qua mạng
- Có khả năng mở rộng khi số lượng người dùng tăng
- Giao diện thân thiện
- Hỗ trợ nhiều ngôn ngữ
- Hỗ trợ nhiều thiết bị: máy tính, điện thoại, máy tính bảng
- Hỗ trợ nhiều trình duyệt

### 4.4 Vị trí trong vòng đời phát triển phần mềm (SDLC)

SDLC (Software Development Life Cycle) gồm các giai đoạn:

1. Phân tích yêu cầu
2. Thiết kế kiến trúc phần mềm
3. Lập trình
4. Kiểm thử
5. Deployment (triển khai)
6. Bảo trì

Với Agile, các bước này có thể lặp lại nhiều lần trong các sprint.

### 4.5 Sản phẩm tạo ra sau khi phân tích yêu cầu

Lập trình viên hoặc BA (Business Analyst) thường tạo ra các tài liệu sau:

| Tài liệu | Mô tả |
|---|---|
| **SRS** (Software Requirements Specification) | Đặc tả yêu cầu phần mềm: tài liệu mô tả chi tiết yêu cầu chức năng và phi chức năng. Dùng để giao tiếp giữa khách hàng, nhà phát triển và các bên liên quan. |
| **Use case diagram** | Sơ đồ chức năng người dùng: mô tả các tác nhân (actors) và các trường hợp sử dụng (use cases). Giúp xác định chức năng hệ thống cần cung cấp và cách người dùng tương tác với hệ thống. |
| **Use case description** | Mô tả chi tiết từng use case: các bước, điều kiện tiên quyết, kết quả mong đợi và các luồng thay thế. |
| **User story** | Mô tả nhu cầu từ góc nhìn người dùng, thường viết thành câu chuyện ngắn gọn. |
| **Acceptance criteria** | Tiêu chí chấp nhận: các điều kiện mà một chức năng phải đáp ứng để được coi là hoàn thành. |

Ngoài ra còn có wireframes, mockups, prototypes để mô tả yêu cầu.

### 4.6 Khi nào vẽ workflow?

Vẽ workflow khi **đã hiểu rõ** yêu cầu chức năng và phi chức năng của hệ thống, và muốn mô tả trực quan các bước, luồng công việc hoặc quy trình mà người dùng hoặc hệ thống thực hiện để đạt một mục tiêu cụ thể.

Workflow giúp lập trình viên, nhà thiết kế và các bên liên quan:

- Hiểu rõ hơn cách hệ thống hoạt động
- Xác định các vấn đề tiềm ẩn
- Tối ưu hóa trải nghiệm người dùng

---

## 5. Agile

### 5.1 Agile là gì?

Agile là phương pháp phát triển phần mềm **linh hoạt**, tập trung cung cấp giá trị nhanh chóng và liên tục cho khách hàng thông qua các vòng lặp phát triển ngắn.

- Nhấn mạnh sự hợp tác, phản hồi liên tục và khả năng thích ứng với thay đổi.
- Chia dự án thành nhiều giai đoạn ngắn: liên tục xây dựng sản phẩm, kiểm thử, nhận phản hồi và cải tiến.
- Giúp nhóm làm việc hiệu quả hơn và đáp ứng nhanh với yêu cầu thay đổi từ khách hàng.

### 5.2 So sánh Waterfall và Agile

| Mô hình | Quy trình |
|---|---|
| **Waterfall** | Phân tích toàn bộ → Thiết kế toàn bộ → Lập trình toàn bộ → Kiểm thử → Bàn giao |
| **Agile** | Phân tích một phần → Thiết kế → Lập trình → Kiểm thử → Nhận phản hồi → Tiếp tục phần tiếp theo |

> **Điểm quan trọng nhất của Agile:** không đợi đến khi hoàn thành toàn bộ dự án mới đưa sản phẩm cho khách hàng sử dụng và đánh giá.

### 5.3 Vì sao cần Agile? (Ví dụ)

Nhà trường đặt hàng sinh viên xây dựng website quản lý điểm rèn luyện.

- **Nếu dùng Waterfall:** nhóm có thể mất 4 tháng làm xong toàn bộ hệ thống rồi mới trình bày. Đến tháng thứ 4, khách hàng mới phát hiện giao diện, quy trình chấm điểm và cách tính điểm không đúng nhu cầu, nhóm phải sửa lại toàn bộ hệ thống, tốn nhiều thời gian và công sức.
- **Nếu dùng Agile:** nhóm chia dự án thành nhiều phần nhỏ. Mỗi phần được phát triển, kiểm thử và trình bày cho khách hàng trong vòng 2 tuần, nên sai lệch được phát hiện và sửa sớm.

### 5.4 Bốn giá trị cốt lõi

1. **Cá nhân và tương tác** hơn là quy trình và công cụ
2. **Phần mềm hoạt động** hơn là tài liệu đầy đủ
3. **Hợp tác với khách hàng** hơn là đàm phán hợp đồng
4. **Phản hồi với thay đổi** hơn là tuân thủ kế hoạch

### 5.5 Các nguyên tắc của Agile

Bản gốc có 12 nguyên tắc; ghi chú mới chép đến nguyên tắc thứ 5:

1. Ưu tiên sự hài lòng của khách hàng thông qua việc cung cấp phần mềm giá trị sớm và liên tục.
2. Chấp nhận thay đổi yêu cầu, ngay cả trong giai đoạn phát triển muộn.
3. Cung cấp phần mềm hoạt động thường xuyên, từ vài tuần đến vài tháng, ưu tiên chu kỳ ngắn hơn.
4. Hợp tác hàng ngày giữa các bên liên quan và nhóm phát triển.
5. Xây dựng dự án xung quanh các cá nhân có động lực, cung cấp môi trường và hỗ trợ cần thiết.
