package vn.travel.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * BE-07: lỗi JSON thống nhất. Hợp đồng hiện tại của frontend là {"ok":false,"msg":"...","field"?:"..."}
 * (js/data-api.js, auth.js, main.js đọc `msg` và `field`); đồng thời trả thêm khóa "error" = msg để khớp mô tả trong TASKS.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(HttpError.class)
    public ResponseEntity<Map<String, Object>> handle(HttpError e) {
        return body(e.status(), e.getMessage(), e.field());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> badJson(Exception e) {
        return body(400, "Dữ liệu gửi lên không hợp lệ", null);
    }

    /**
     * Endpoint /api/... KHÔNG do Spring Boot xử lý (vd /api/tours, /api/locations: frontend đọc thẳng file JSON công khai)
     * → 404 với thân RỖNG. js/data-api.js hiểu "404 không có JSON" = không có máy chủ cho phần này và tự dùng file JSON.
     */
    @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
    public ResponseEntity<Void> notHandled(Exception e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> other(Exception e) {
        e.printStackTrace();
        return body(500, "Lỗi máy chủ", null);
    }

    private static ResponseEntity<Map<String, Object>> body(int status, String msg, String field) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", false);
        m.put("msg", msg);
        m.put("error", msg);
        if (field != null) m.put("field", field);
        return ResponseEntity.status(status).body(m);
    }
}
