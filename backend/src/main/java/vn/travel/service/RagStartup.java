package vn.travel.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Khởi động: có khóa AI mà chỉ mục embedding còn thiếu → làm nốt ở luồng nền. */
@Component
public class RagStartup implements ApplicationRunner {
    private final Rag rag;

    public RagStartup(Rag rag) {
        this.rag = rag;
    }

    @Override
    public void run(ApplicationArguments args) {
        rag.ensureIndexInBackground();
    }
}
