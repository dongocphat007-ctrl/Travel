package vn.travel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.travel.config.TravelProperties;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LangfuseTracerTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void disabledWhenKeysBlank() {
        TravelProperties off = new TravelProperties("web", "db", "", "", "secret", "", "client",
                "", "gemini-2.5-flash", "", "", "", false, "", "", "", "", "TRAVEL", "", false, true, false,
                "", "", "https://cloud.langfuse.com");
        LangfuseTracer tracer = new LangfuseTracer(off, mapper);
        assertFalse(tracer.enabled());
        assertEquals("https://cloud.langfuse.com", tracer.host());
    }

    @Test
    void enabledWhenKeysProvided() {
        TravelProperties on = new TravelProperties("web", "db", "", "", "secret", "", "client",
                "", "gemini-2.5-flash", "", "", "", false, "", "", "", "", "TRAVEL", "", false, true, false,
                "pk-lf-test", "sk-lf-test", "https://cloud.langfuse.com/");
        LangfuseTracer tracer = new LangfuseTracer(on, mapper);
        assertTrue(tracer.enabled());
        assertEquals("https://cloud.langfuse.com", tracer.host());
    }

    @Test
    void safeWhenDisabled() {
        TravelProperties off = new TravelProperties("web", "db", "", "", "secret", "", "client",
                "", "gemini-2.5-flash", "", "", "", false, "", "", "", "", "TRAVEL", "", false, true, false,
                "", "", "https://cloud.langfuse.com");
        LangfuseTracer tracer = new LangfuseTracer(off, mapper);
        assertDoesNotThrow(() -> tracer.recordGeneration("tr_1", "test", "u1", "s1", Instant.now(), Instant.now(),
                "gemini-2.5-flash", Map.of(), "input", "output", 10, 10, 20, Map.of(), null));
        assertDoesNotThrow(() -> tracer.recordScore("tr_1", "user-feedback", 1.0, "ok"));
    }
}

