# Workflow 17 — Kiến trúc API và dữ liệu

```mermaid
flowchart LR
 U[Người dùng] --> FE[Frontend HTML/CSS/JS]
 FE --> F[Rate limit / CSRF / session]
 F --> C[Spring Boot controller]
 C --> S[Service nghiệp vụ]
 S --> V[Kiểm tra quyền, dữ liệu, giá và trạng thái]
 V --> J[(JsonStore: storage/db/*.json)]
 S --> X[Dịch vụ ngoài tùy cấu hình]
 X --> S
 J --> S --> C --> FE --> U
 WH[Webhook thanh toán] --> C
```

Request ghi cần đúng phiên, quyền và origin. Dữ liệu riêng tư nằm trong `backend/storage`, không được phục vụ như tệp frontend. Dịch vụ ngoài gồm AI/RAG, bản đồ/địa điểm, tìm vé/khách sạn và email/OTP.
