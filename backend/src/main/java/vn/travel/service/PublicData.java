package vn.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.travel.config.TravelProperties;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/** Đọc file JSON CÔNG KHAI trong frontend/data (seed tour-stats, reviews-seed...) — chỉ đọc, có cache theo thời gian sửa file. */
@Service
public class PublicData {
    private static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() { };
    private final Path dir;
    private final ObjectMapper mapper;
    private final Map<String, Object[]> cache = new HashMap<>();

    @Autowired
    public PublicData(TravelProperties props, ObjectMapper mapper) {
        this(Paths.get(props.webRoot(), "data"), mapper);
    }

    public PublicData(Path dir, ObjectMapper mapper) {
        this.dir = dir.toAbsolutePath().normalize();
        this.mapper = mapper;
    }

    @SuppressWarnings("unchecked")
    public synchronized Map<String, Object> obj(String rel) {
        Path f = dir.resolve(rel);
        try {
            if (!Files.exists(f)) return Map.of();
            long lm = Files.getLastModifiedTime(f).toMillis();
            Object[] c = cache.get(rel);
            if (c != null && (long) c[0] == lm) return (Map<String, Object>) c[1];
            Map<String, Object> m = mapper.readValue(Files.readString(f), OBJ);
            cache.put(rel, new Object[]{lm, m});
            return m;
        } catch (IOException e) {
            return Map.of();
        }
    }
}
