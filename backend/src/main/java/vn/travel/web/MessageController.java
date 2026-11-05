package vn.travel.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import vn.travel.service.Messages;
import vn.travel.util.Maps;

import java.util.List;
import java.util.Map;

/**
 * API trang "Thông báo" của nhân viên nội bộ: hội thoại giữa các vai trò + thông báo Admin chủ động gửi.
 * Quyền gửi thông báo (kind=announcement) kiểm trong {@link Messages#create}; mọi vai trò nội bộ trò chuyện được. Khách hàng bị chặn (403).
 */
@RestController
public class MessageController {
    private final CurrentUser current;
    private final Messages messages;

    public MessageController(CurrentUser current, Messages messages) {
        this.current = current;
        this.messages = messages;
    }

    @GetMapping("/api/messages")
    public Map<String, Object> list(HttpServletRequest req) {
        return messages.list(current.require(req));
    }

    @GetMapping("/api/messages/recipients")
    public Map<String, Object> recipients(HttpServletRequest req) {
        return messages.recipients(current.require(req));
    }

    @GetMapping("/api/messages/{id}")
    public Map<String, Object> open(@PathVariable String id, HttpServletRequest req) {
        return Maps.of("ok", true, "thread", messages.open(current.require(req), id));
    }

    @PostMapping("/api/messages")
    public Map<String, Object> create(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> u = current.require(req);
        Map<String, Object> b = Api.body(body);
        return Maps.of("ok", true, "thread", messages.create(u, Api.s(b, "kind"), Api.s(b, "subject"), Api.s(b, "text"),
                b.get("toRoles") instanceof List<?> r ? r : List.of(), b.get("toUsers") instanceof List<?> p ? p : List.of(), Api.s(b, "ref")));
    }

    @PostMapping("/api/messages/{id}/reply")
    public Map<String, Object> reply(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        return Maps.of("ok", true, "thread", messages.reply(current.require(req), id, Api.s(body, "text"), Api.s(body, "to")));
    }

    @PostMapping("/api/messages/{id}/read")
    public Map<String, Object> read(@PathVariable String id, HttpServletRequest req) {
        messages.markRead(current.require(req), id);
        return Maps.of("ok", true);
    }

    @PostMapping("/api/messages/{id}/delete")
    public Map<String, Object> delete(@PathVariable String id, HttpServletRequest req) {
        messages.deleteThread(current.require(req), id);
        return Maps.of("ok", true);
    }

    @PostMapping("/api/messages/delete")
    public Map<String, Object> deleteBulk(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest req) {
        Map<String, Object> b = Api.body(body);
        List<?> ids = b.get("ids") instanceof List<?> l ? l : null;
        messages.deleteThreads(current.require(req), ids);
        return Maps.of("ok", true);
    }
}
