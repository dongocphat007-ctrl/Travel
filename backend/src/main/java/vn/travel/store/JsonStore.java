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

    /** Đọc file {name}.json; thiếu file hoặc hỏng thì trả về fallback. */
    public <T> T read(String name, TypeReference<T> type, T fallback) {
        Path f = file(name);
        ReentrantLock lock = lock(name);
        lock.lock();
        try {
            if (!Files.exists(f)) return fallback;
            return mapper.readValue(Files.readString(f, StandardCharsets.UTF_8), type);
        } catch (IOException e) {
            return fallback;
        } finally {
            lock.unlock();
        }
    }

    /** Ghi nguyên tử toàn bộ nội dung. */
    public void write(String name, Object value) {
        ReentrantLock lock = lock(name);
        lock.lock();
        try {
            writeLocked(file(name), value);
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
                try {
                    current = mapper.readValue(Files.readString(f, StandardCharsets.UTF_8), type);
                } catch (IOException ignored) { /* file hỏng: dùng fallback */ }
            }
            T next = change.apply(current);
            writeLocked(f, next);
            return next;
        } finally {
            lock.unlock();
        }
    }

    private void writeLocked(Path target, Object value) {
        Path tmp = target.resolveSibling(target.getFileName() + "." + ProcessHandle.current().pid() + ".tmp");
        try {
            Files.writeString(tmp, mapper.writeValueAsString(value), StandardCharsets.UTF_8);
            try {
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            }
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
