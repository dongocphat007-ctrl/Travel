package vn.travel.web;

import org.springframework.web.bind.annotation.*;
import vn.travel.service.AiProxy;
import vn.travel.util.Maps;

import java.util.Map;

/** Mọi lời gọi AI của trình duyệt (chatbot, Tìm Tour AI, mẹo AI, nhập chuyến đi) đi qua đây — khóa AI không xuống trình duyệt. */
@RestController
public class AiController {
    private final AiProxy ai;

    public AiController(AiProxy ai) {
        this.ai = ai;
    }

    @GetMapping("/api/ai/status")
    public Map<String, Object> status() {
        return Maps.of("ok", true, "enabled", ai.enabled());
    }

    @PostMapping("/api/ai/generate")
    public Map<String, Object> generate(@RequestBody(required = false) Map<String, Object> body) {
        return Maps.of("ok", true, "text", ai.generate(body == null ? Map.of() : body));
    }
}
