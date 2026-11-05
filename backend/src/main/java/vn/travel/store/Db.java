package vn.travel.store;

import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;

/** Cách dùng JsonStore thuận tiện cho dữ liệu dạng danh sách đối tượng (accounts, bookings, vouchers...). */
@Component
public class Db {
    public static final TypeReference<List<Map<String, Object>>> LIST = new TypeReference<>() { };
    public static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() { };

    private final JsonStore store;

    public Db(JsonStore store) {
        this.store = store;
    }

    public JsonStore store() { return store; }

    public List<Map<String, Object>> list(String name) {
        return store.read(name, LIST, new ArrayList<>());
    }

    /** Đọc – sửa – ghi trong cùng một khóa; trả về danh sách sau khi sửa. */
    public List<Map<String, Object>> update(String name, UnaryOperator<List<Map<String, Object>>> change) {
        return store.update(name, LIST, new ArrayList<>(), change);
    }

    /** Như update nhưng sửa tại chỗ (không cần trả danh sách). */
    public List<Map<String, Object>> edit(String name, Consumer<List<Map<String, Object>>> change) {
        return update(name, l -> {
            change.accept(l);
            return l;
        });
    }

    /** Tài liệu JSON dạng một đối tượng (cấu hình, bộ đếm...). */
    public Map<String, Object> obj(String name) {
        return store.read(name, OBJ, new LinkedHashMap<>());
    }

    /** Đọc – sửa – ghi một đối tượng JSON trong cùng một khóa. */
    public Map<String, Object> editObj(String name, Consumer<Map<String, Object>> change) {
        return store.update(name, OBJ, new LinkedHashMap<>(), m -> {
            change.accept(m);
            return m;
        });
    }
}
