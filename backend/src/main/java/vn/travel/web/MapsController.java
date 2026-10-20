package vn.travel.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;

import java.util.Map;

/** Cấu hình bản đồ cho trình duyệt. Khóa Maps JS vốn công khai ở phía client nên phải giới hạn theo referrer; ở đây chỉ để khỏi ghi cứng vào JS. */
@RestController
public class MapsController {
    private final TravelProperties props;

    public MapsController(TravelProperties props) {
        this.props = props;
    }

    @GetMapping("/api/maps/config")
    public Map<String, Object> config() {
        String key = props.googleMapsApiKey();
        return Maps.of("googleMapsApiKey", TravelProperties.blank(key) ? "" : key.trim(), "language", "vi", "region", "VN");
    }
}
