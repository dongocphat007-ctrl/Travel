package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import vn.travel.service.Rag;
import vn.travel.util.Maps;

import java.util.Map;

/** RAG ở server: tìm đoạn dữ liệu Travel liên quan (công khai, có giới hạn tần suất); Admin lập chỉ mục embedding. */
@RestController
public class RagController {
    private final Rag rag;
    private final CurrentUser current;

    public RagController(Rag rag, CurrentUser current) {
        this.rag = rag;
        this.current = current;
    }

    @GetMapping("/api/rag/status")
    public Map<String, Object> status() {
        return rag.status();
    }

    /** { query, k?, type? } → { ok, mode: "vector"|"bm25", hits:[{id,type,refId,title,text,score}] } */
    @PostMapping("/api/rag/search")
    public Map<String, Object> search(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        int k = b.get("k") instanceof Number n ? n.intValue() : 8;
        return rag.search(Maps.str(b, "query"), k, Maps.str(b, "type"));
    }

    @PostMapping("/api/admin/rag/reindex")
    public Map<String, Object> reindex(HttpServletRequest req) {
        current.requireAdmin(req);
        return rag.reindex();
    }
}
