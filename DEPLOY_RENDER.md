# Deploy Travel lên Render bằng Docker

## Project đã có cấu hình Docker

- `Dockerfile`: build backend Spring Boot bằng Java 17, đóng frontend vào image.
- `docker-entrypoint.sh`: khởi tạo nội dung frontend vào persistent disk một lần và chạy ứng dụng trên cổng Render cấp.
- `.dockerignore`: loại `.env`, dữ liệu runtime, output và build artifacts khỏi Docker build context.
- `render.yaml`: cấu hình Render Blueprint, region Singapore, persistent disk, health check và các biến môi trường.

## Các bước triển khai

1. Đưa toàn bộ thư mục project lên GitHub. Không commit `.env`; kiểm tra GitHub không có secret trước khi push.
2. Trên Render chọn **New → Blueprint**, kết nối repository và chọn nhánh vừa push. Render đọc `render.yaml` ở thư mục gốc.
3. Điền các biến được đánh dấu cần nhập: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SITE_URL` (URL `https://...onrender.com` sau khi service tạo xong), và tùy chọn email `EMAIL_USER` / `EMAIL_PASS`.
4. Hoàn tất tạo service. Sau khi deploy thành công, mở URL Render và thử trang khách, đăng nhập, dashboard vai trò, API và upload ảnh.

## Lưu trữ dữ liệu

Render gắn persistent disk tại `/var/data`. JSON của backend lưu trong `/var/data/db`, frontend khởi tạo tại `/var/data/site`, ảnh upload nằm dưới thư mục `img` của site. Nhờ vậy dữ liệu và ảnh tồn tại qua deploy/restart. Persistent disk cần gói Render hỗ trợ disk và có thể phát sinh chi phí; kiểm tra giá hiện hành trong dashboard trước khi tạo tài nguyên.

Project hiện dùng file JSON làm kho dữ liệu. Một persistent disk đơn không biến JSON thành cơ sở dữ liệu an toàn cho nhiều instance đồng thời. Hãy để một instance chạy ứng dụng; nếu cần scale nhiều instance, chuyển dữ liệu sang database dùng chung và ảnh sang object storage.

## Chạy Docker cục bộ

Từ thư mục gốc project:

```sh
docker build -t travel-project .
docker run --rm -p 8080:8080 \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='replace-with-a-strong-password' \
  -e SESSION_SECRET='replace-with-a-long-random-secret' \
  -e SITE_URL=http://localhost:8080 \
  -v travel-data:/var/data \
  travel-project
```

Sau đó mở `http://localhost:8080`. Dùng thông tin bí mật riêng cho môi trường local; không ghi chúng vào file được commit.
