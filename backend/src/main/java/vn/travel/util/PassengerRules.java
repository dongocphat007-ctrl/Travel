package vn.travel.util;

import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Map;

/**
 * 9.4–9.5: quy tắc độ tuổi của hành khách, tính theo NGÀY KHỞI HÀNH (không phải ngày đặt).
 * Cùng ngưỡng với js/constants.js: dưới {@link Pricing#CHILD_FREE_UNDER} tuổi = em bé (miễn phí),
 * từ đó đến dưới {@link Pricing#CHILD_HALF_UNDER} tuổi = trẻ em (50% giá), từ {@code CHILD_HALF_UNDER} tuổi = người lớn.
 * Lớp thuần Java (không phụ thuộc Spring) để kiểm thử được độc lập.
 */
public final class PassengerRules {
    private PassengerRules() { }

    public static final int MAX_AGE = 120;

    public enum Category { ADULT, CHILD, INFANT }

    /** Số người theo từng nhóm tuổi. */
    public record Counts(int adults, int kids, int infants) {
        public int total() { return adults + kids + infants; }
    }

    /** Tuổi (số năm tròn) tại ngày {@code on}; âm nếu sinh sau ngày đó. */
    public static int ageOn(LocalDate dob, LocalDate on) {
        if (dob.isAfter(on)) return -1;
        return Period.between(dob, on).getYears();
    }

    public static Category categoryOf(int age) {
        if (age < Pricing.CHILD_FREE_UNDER) return Category.INFANT;
        if (age < Pricing.CHILD_HALF_UNDER) return Category.CHILD;
        return Category.ADULT;
    }

    /**
     * Số người theo nhóm tuổi, ÁP CÙNG QUY TẮC với {@link Pricing#compute}: mỗi người lớn dắt tối đa 1 bé miễn phí;
     * bé thứ hai trở lên của cùng người lớn tính như trẻ em. Mọi hành khách phải có ngày sinh hợp lệ (đã kiểm ở validate).
     */
    public static Counts derive(List<Map<String, Object>> passengers, LocalDate tripDate) {
        int adults = 0, kids = 0, infants = 0;
        for (Map<String, Object> p : passengers) {
            LocalDate dob = GuideAvailability.parse(Maps.str(p, "dob"));
            if (dob == null) continue;
            switch (categoryOf(ageOn(dob, tripDate))) {
                case ADULT -> adults++;
                case CHILD -> kids++;
                default -> infants++;
            }
        }
        int freeInfants = Math.min(infants, adults);
        return new Counts(adults, kids + (infants - freeInfants), freeInfants);
    }

    /**
     * Kiểm tra danh sách hành khách của một đơn. Trả về thông báo lỗi (tiếng Việt) hoặc {@code null} nếu hợp lệ.
     * Các lỗi: số hành khách khác số khách đã khai; thiếu/sai/ngày sinh trong tương lai; không có người lớn;
     * nhóm tuổi tính từ ngày sinh không khớp số người lớn/trẻ em/em bé đã khai (ảnh hưởng giá).
     */
    public static String validate(List<Map<String, Object>> passengers, LocalDate tripDate, int adults, int kids, int infants) {
        int declared = adults + kids + infants;
        if (passengers.size() != declared)
            return "Cần khai đủ " + declared + " hành khách (đang có " + passengers.size() + ")";
        for (int i = 0; i < passengers.size(); i++) {
            Map<String, Object> p = passengers.get(i);
            String who = "Hành khách " + (i + 1) + (Maps.str(p, "name").isEmpty() ? "" : " (" + Maps.str(p, "name") + ")");
            LocalDate dob = GuideAvailability.parse(Maps.str(p, "dob"));
            if (dob == null) return who + ": thiếu hoặc sai ngày sinh (định dạng yyyy-MM-dd)";
            int age = ageOn(dob, tripDate);
            if (age < 0) return who + ": ngày sinh sau ngày khởi hành";
            if (age > MAX_AGE) return who + ": ngày sinh không hợp lý";
        }
        Counts d = derive(passengers, tripDate);
        if (d.adults() < 1) return "Mỗi đơn cần ít nhất 1 người lớn (từ " + Pricing.CHILD_HALF_UNDER + " tuổi tính đến ngày khởi hành)";
        if (d.adults() != adults || d.kids() != kids || d.infants() != infants)
            return "Ngày sinh không khớp số khách đã chọn: theo ngày sinh có " + d.adults() + " người lớn, " + d.kids() + " trẻ em ("
                    + Pricing.CHILD_FREE_UNDER + "–" + (Pricing.CHILD_HALF_UNDER - 1) + " tuổi), " + d.infants() + " em bé (dưới " + Pricing.CHILD_FREE_UNDER
                    + " tuổi), còn bạn chọn " + adults + "/" + kids + "/" + infants + ". Hãy chỉnh lại số lượng để giá tính đúng";
        return null;
    }
}
