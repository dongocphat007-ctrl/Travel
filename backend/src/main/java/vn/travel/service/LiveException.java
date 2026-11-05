package vn.travel.service;

/** Lỗi khi gọi nguồn dữ liệu trực tuyến (Ignav / Google Places / Travelpayouts). Thông điệp an toàn để hiển thị, không chứa khóa API. */
public class LiveException extends RuntimeException {
    private final int status;

    public LiveException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() { return status; }
}
