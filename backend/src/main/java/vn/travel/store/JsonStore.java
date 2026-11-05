package vn.travel.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vn.travel.config.TravelProperties;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

/**
 * BE-02: lớp DUY NHẤT đọc/ghi file JSON dữ liệu riêng tư (storage/db/*.json).
 * - khóa theo từng file (ReentrantLock)
 * - ghi nguyên tử: ghi file tạm rồi đổi tên
 * - giữ định dạng JSON thụt lề 2 như bản Node trước đây
 * Không có database, entity hay repository.
 */
@Component
public class JsonStore {

    private static final Pattern NAME = Pattern.compile("[A-Za-z0-9_-]+");

    private final Path dir;
    private final ObjectMapper mapper;
    private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();
    /** Bản đã parse của từng file, kèm dấu vết (mtime, kích thước) để biết file có đổi không. Mọi lần ghi qua lớp này đều xóa mục tương ứng. */
    private final ConcurrentHashMap<String, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(long mtime, long size, Object value) { }

    @Autowired
    public JsonStore(TravelProperties props, ObjectMapper mapper) {
        this(Paths.get(props.dbDir()), mapper);
    }

    /** Dùng cho test: thư mục JSON tạm, không đụng dữ liệu thật. */
    public JsonStore(Path dir, ObjectMapper mapper) {
        this.dir = dir.toAbsolutePath().normalize();
        this.mapper = mapper.copy().enable(SerializationFeature.INDENT_OUTPUT);
        try {
            Files.createDirectories(this.dir);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public Path dir() {
        return dir;
    }

    /**
     * Đọc file {name}.json; thiếu file hoặc hỏng thì trả về fallback.
     * Trước đây MỖI lần gọi đều đọc đĩa + parse lại cả file; các vòng lặp theo từng đơn (chọn HDV, hàng đợi điều hành...) gọi hàng trăm lần
     * nên rất chậm. Nay giữ bản đã parse và chỉ đọc lại khi file đổi (mtime/kích thước khác) hoặc vừa được ghi qua lớp này.
     * Luôn trả BẢN SAO sâu: người gọi sửa thoải mái mà không làm bẩn bộ nhớ đệm (giống hành vi cũ, mỗi lần một bản mới).
     */
    @SuppressWarnings("unchecked")
    public <T> T read(String name, TypeReference<T> type, T fallback) {
        Path f = file(name);
        ReentrantLock lock = lock(name);
        lock.lock();
        try {
            if (!Files.exists(f)) { cache.remove(name); return fallback; }
            long mtime = Files.getLastModifiedTime(f).toMillis(), size = Files.size(f);
            Cached c = cache.get(name);
            if (c != null && c.mtime() == mtime && c.size() == size) return (T) deepCopy(c.value());
            T parsed = mapper.readValue(Files.readString(f, StandardCharsets.UTF_8), type);
            if (parsed instanceof Map || parsed instanceof List) cache.put(name, new Cached(mtime, size, deepCopy(parsed)));
            return parsed;
        } catch (IOException e) {
            cache.remove(name);
            return fallback;
        } finally {
            lock.unlock();
        }
    }

    /** Sao chép sâu cây JSON (Map/List/số/chuỗi/bool/null) – nhanh hơn nhiều so với đọc đĩa + parse lại. */
    static Object deepCopy(Object o) {
        if (o instanceof Map<?, ?> m) {
            Map<Object, Object> out = new LinkedHashMap<>(Math.max(16, (int) (m.size() / 0.75f) + 1));
            for (Map.Entry<?, ?> e : m.entrySet()) out.put(e.getKey(), deepCopy(e.getValue()));
            return out;
        }
        if (o instanceof List<?> l) {
            List<Object> out = new ArrayList<>(l.size());
            for (Object x : l) out.add(deepCopy(x));
            return out;
        }
        return o;   // String, Number, Boolean, null: bất biến
    }

    /** Ghi nguyên tử toàn bộ nội dung. */
    public void write(String name, Object value) {
        ReentrantLock lock = lock(name);
        lock.lock();
        try {
            writeLocked(file(name), value);
            cache.remove(name);
        } finally {
            lock.unlock();
        }
    }

    /** Đọc – sửa – ghi trong CÙNG một khóa (tránh mất dữ liệu khi ghi đồng thời). */
    public <T> T update(String name, TypeReference<T> type, T fallback, UnaryOperator<T> change) {
        Path f = file(name);
        ReentrantLock lock = lock(name);
        lock.lock();
        try {
            T current = fallback;
            if (Files.exists(f)) {
                String text;
                try {
                    text = Files.readString(f, StandardCharsets.UTF_8);
                } catch (IOException e) {
                    // Không đọc được (ví dụ phần mềm diệt virus / ứng dụng khác đang giữ file trên Windows): KHÔNG được coi là file rỗng
                    // rồi ghi đè, vì sẽ mất toàn bộ dữ liệu. Báo lỗi để thao tác này thất bại an toàn.
                    throw new UncheckedIOException(e);
                }
                try {
                    current = mapper.readValue(text, type);
                } catch (IOException ignored) { /* nội dung JSON hỏng: dùng fallback */ }
            }
            T next = change.apply(current);
            writeLocked(f, next);
            cache.remove(name);
            return next;
        } finally {
            lock.unlock();
        }
    }

    private void writeLocked(Path target, Object value) {
        Path tmp = target.resolveSibling(target.getFileName() + "." + ProcessHandle.current().pid() + ".tmp");
        try {
            Files.writeString(tmp, mapper.writeValueAsString(value), StandardCharsets.UTF_8);
            IOException last = null;
            for (int attempt = 0; attempt < 5; attempt++) {   // Windows: diệt virus/indexer đôi khi giữ file vài chục ms → thử lại thay vì lỗi 500
                try {
                    try {
                        Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                    } catch (AtomicMoveNotSupportedException e) {
                        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
                    }
                    return;
                } catch (IOException e) {
                    last = e;
                    try { Thread.sleep(25L * (attempt + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            }
            throw last;
        } catch (IOException e) {
            try { Files.deleteIfExists(tmp); } catch (IOException ignored) { }
            throw new UncheckedIOException(e);
        }
    }

    private Path file(String name) {
        if (name == null || !NAME.matcher(name).matches())
            throw new IllegalArgumentException("Tên file JSON không hợp lệ: " + name);
        return dir.resolve(name + ".json");
    }

    private ReentrantLock lock(String name) {
        return locks.computeIfAbsent(name, k -> new ReentrantLock());
    }
}
