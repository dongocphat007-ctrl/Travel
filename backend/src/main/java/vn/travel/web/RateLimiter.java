package vn.travel.web;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/** BE-08: giới hạn tần suất đơn giản theo khóa (IP+nhóm), cửa sổ trượt, trong bộ nhớ. */
public class RateLimiter {
    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /** true nếu còn lượt trong cửa sổ windowMs (và ghi nhận lượt này). */
    public boolean allow(String key, int max, long windowMs, long nowMs) {
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && nowMs - q.peekFirst() >= windowMs) q.pollFirst();
            if (q.size() >= max) return false;
            q.addLast(nowMs);
            return true;
        }
    }

    /** Dọn khóa cũ để không phình bộ nhớ. */
    public void sweep(long windowMs, long nowMs) {
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                while (!e.getValue().isEmpty() && nowMs - e.getValue().peekFirst() >= windowMs) e.getValue().pollFirst();
                return e.getValue().isEmpty();
            }
        });
    }
}
