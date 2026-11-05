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

    @GetMapping({"/api/ai/status", "/api/v1/chat/langfuse-status"})
    public Map<String, Object> status() {
        return Maps.of(
                "ok", true,
                "connected", ai.langfuseEnabled(),
                "enabled", ai.enabled(),
                "langfuse", ai.langfuseEnabled(),
                "host", ai.host(),
                "dashboardUrl", ai.host()
        );
    }

    @RequestMapping(value = {"/api/ai/test-trace", "/api/v1/chat/langfuse-test-trace", "/api/v1/chat/langfuse-test"}, method = {RequestMethod.GET, RequestMethod.POST})
    public Map<String, Object> testTrace(@RequestBody(required = false) Map<String, Object> body) {
        String prompt = body != null ? Maps.str(body, "prompt") : null;
        String reply = body != null ? Maps.str(body, "reply") : null;
        return ai.testLangfuse(prompt, reply);
    }

    @PostMapping("/api/ai/generate")
    public Map<String, Object> generate(@RequestBody(required = false) Map<String, Object> body) {
        AiProxy.GenerateResult r = ai.generateWithTrace(body == null ? Map.of() : body);
        return Maps.of("ok", true, "text", r.text(), "traceId", r.traceId());
    }

    @PostMapping("/api/ai/feedback")
    public Map<String, Object> feedback(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String traceId = Maps.str(b, "traceId");
        double value = b.get("value") instanceof Number n ? n.doubleValue() : 1.0;
        String comment = Maps.str(b, "comment");
        ai.feedback(traceId, value, comment);
        return Maps.of("ok", true);
    }
}
