package vn.travel.service;

import java.util.List;

/** Biến văn bản thành vector. Tách interface để kiểm thử không cần gọi mạng. Vector đã chuẩn hóa độ dài 1 (cosine = tích vô hướng). */
public interface Embedder {
    boolean enabled();

    /** Tên model + số chiều: đổi một trong hai thì vector cũ trong vectors.json bị bỏ. */
    String model();

    int dims();

    /** query=true: nhúng câu hỏi (taskType RETRIEVAL_QUERY); false: nhúng tài liệu. Ném HttpError khi nhà cung cấp lỗi. */
    List<float[]> embed(List<String> texts, boolean query);
}
