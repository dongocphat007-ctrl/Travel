package vn.travel.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Test dùng thư mục JSON tạm, không đụng dữ liệu thật. */
class JsonStoreTest {
    private static final TypeReference<List<Map<String, Object>>> LIST = new TypeReference<>() { };

    @Test
    void readMissingFileReturnsFallback(@TempDir Path tmp) {
        JsonStore s = new JsonStore(tmp, new ObjectMapper());
        assertEquals(List.of(), s.read("bookings", LIST, List.of()));
    }

    @Test
    void writeThenRead_andNoTmpLeftBehind(@TempDir Path tmp) throws Exception {
        JsonStore s = new JsonStore(tmp, new ObjectMapper());
        s.write("vouchers", List.of(Map.of("code", "WELCOME10")));
        assertEquals("WELCOME10", s.read("vouchers", LIST, List.of()).get(0).get("code"));
        try (var files = Files.list(tmp)) {
            assertTrue(files.noneMatch(p -> p.toString().endsWith(".tmp")));
        }
    }

    @Test
    void updateIsAtomicUnderConcurrency(@TempDir Path tmp) throws Exception {
        JsonStore s = new JsonStore(tmp, new ObjectMapper());
        Thread[] ts = new Thread[8];
        for (int i = 0; i < ts.length; i++) {
            final int n = i;
            ts[i] = new Thread(() -> {
                for (int k = 0; k < 10; k++)
                    s.update("bookings", LIST, new ArrayList<>(), cur -> {
                        List<Map<String, Object>> next = new ArrayList<>(cur);
                        next.add(Map.of("id", n + "-" + System.nanoTime()));
                        return next;
                    });
            });
            ts[i].start();
        }
        for (Thread t : ts) t.join();
        assertEquals(80, s.read("bookings", LIST, List.of()).size());
    }

    @Test
    void rejectsPathTraversalNames(@TempDir Path tmp) {
        JsonStore s = new JsonStore(tmp, new ObjectMapper());
        assertThrows(IllegalArgumentException.class, () -> s.write("../evil", List.of()));
    }
}
