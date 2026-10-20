package vn.travel.web;

/** Lỗi nghiệp vụ → JSON {"ok":false,"msg":"...","field":"..."} đúng mã HTTP (khớp hợp đồng cũ của frontend). */
public class HttpError extends RuntimeException {
    private final int status;
    private final String field;

    public HttpError(int status, String msg) {
        this(status, msg, null);
    }

    public HttpError(int status, String msg, String field) {
        super(msg);
        this.status = status;
        this.field = field;
    }

    public int status() { return status; }
    public String field() { return field; }

    public static HttpError bad(String msg) { return new HttpError(400, msg); }
    public static HttpError bad(String msg, String field) { return new HttpError(400, msg, field); }
    public static HttpError unauthorized() { return new HttpError(401, "Vui lòng đăng nhập"); }
    public static HttpError forbidden() { return new HttpError(403, "Bạn không có quyền thực hiện thao tác này"); }
    public static HttpError notFound(String msg) { return new HttpError(404, msg); }
    public static HttpError conflict(String msg, String field) { return new HttpError(409, msg, field); }
}
