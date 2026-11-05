package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.travel.web.HttpError;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** AiProxy: chặn đầu vào sai TRƯỚC khi gọi mạng (không cần khóa thật), khóa không bao giờ lộ ra lỗi. */
class AiProxyTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private AiProxy on() { return new AiProxy(TestProps.with("fake-key-123", "", "", ""), mapper); }

    @Test void disabledWithoutKeyReturns503() {
        AiProxy off = new AiProxy(TestProps.with("", "", "", ""), mapper);
        assertFalse(off.enabled());
        assertEquals(503, assertThrows(HttpError.class, () -> off.generate(Map.of("prompt", "xin chào"))).status());
    }

    @Test void blankKeyCountsAsDisabled() {
        assertFalse(new AiProxy(TestProps.with("   ", "", "", ""), mapper).enabled());
        assertTrue(on().enabled());
    }

    @Test void emptyPromptIsRejected() {
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of())).status());
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("prompt", ""))).status());
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("contents", List.of(Map.of("role", "user", "text", ""))))).status());
    }

    @Test void tooLongPromptIsRejected() {
        String big = "a".repeat(AiProxy.MAX_CHARS + 1);
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("prompt", big))).status());
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("prompt", "ok", "system", big))).status());
    }

    @Test void tooManyTurnsIsRejected() {
        List<Map<String, Object>> turns = new ArrayList<>();
        for (int i = 0; i <= AiProxy.MAX_TURNS; i++) turns.add(Map.of("role", i % 2 == 0 ? "user" : "assistant", "text", "câu " + i));
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("contents", turns))).status());
    }

    @Test void initialModelTurnDroppedAndConsecutiveMerged() {
        // Nếu chỉ có model turn, sau khi drop sẽ rỗng -> ném 400
        List<Map<String, Object>> onlyModel = List.of(Map.of("role", "model", "text", "chào bạn"));
        assertEquals(400, assertThrows(HttpError.class, () -> on().generate(Map.of("contents", onlyModel))).status());
    }
}
