package vn.travel.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** NEW-15: ảnh tour nội bộ ("image" trong data/tours*.json) phải trỏ tới file có thật, tên không dấu/khoảng trắng; banner mẫu phải có file ảnh. */
class TourImagesTest {
    private static final Path FE = Path.of("../frontend");
    private static final ObjectMapper M = new ObjectMapper();

    private static List<JsonNode> allTours() throws Exception {
        assumeTrue(Files.exists(FE), "chạy từ thư mục backend/ để thấy ../frontend");
        List<JsonNode> out = new ArrayList<>();
        for (String f : new String[]{"data/tours-detail.json", "data/tours/mien-bac.json", "data/tours/mien-trung.json", "data/tours/mien-nam.json", "data/tours/quoc-te.json"})
            M.readTree(Files.readString(FE.resolve(f))).get("tours").forEach(out::add);
        return out;
    }

    @Test void everyLocalTourImageFileExistsWithAsciiName() throws Exception {
        for (JsonNode t : allTours()) {
            String img = t.path("image").asText("");
            if (img.isBlank() || img.matches("^(https?:|data:).*")) continue;
            assertTrue(img.matches("^[\\x21-\\x7e]+$"), "tên file ảnh phải không dấu, không khoảng trắng: tour " + t.get("id") + " → " + img);
            assertTrue(Files.isRegularFile(FE.resolve(img)), "tour " + t.get("id") + " trỏ tới file không tồn tại: " + img);
        }
    }

    @Test void bannerToursAndSampleBannersHaveImages() throws Exception {
        List<JsonNode> tours = allTours();
        long hot = tours.stream().filter(t -> t.get("id").asText().startsWith("hot")).count();
        long hotWithImage = tours.stream().filter(t -> t.get("id").asText().startsWith("hot") && !t.path("image").asText("").isBlank()).count();
        assertTrue(hot > 0 && hotWithImage == hot, "tour banner (hot*) phải có ảnh riêng: " + hotWithImage + "/" + hot);
        Path seed = Path.of("src/main/resources/seed/banners.json");
        assumeTrue(Files.exists(seed));
        for (JsonNode b : M.readTree(Files.readString(seed))) {
            String img = b.path("image").asText("");
            if (!img.isBlank() && !img.startsWith("http"))
                assertTrue(Files.isRegularFile(FE.resolve(img)), "banner " + b.get("id") + " thiếu file " + img);
        }
    }
}
