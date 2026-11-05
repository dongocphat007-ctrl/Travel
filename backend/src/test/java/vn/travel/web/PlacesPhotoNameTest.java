package vn.travel.web;

import org.junit.jupiter.api.Test;
import vn.travel.service.PlacesClient;

import static org.junit.jupiter.api.Assertions.*;

class PlacesPhotoNameTest {
    @Test
    void onlyGooglePhotoResourceNamesAreAccepted() {
        assertTrue(PlacesClient.validPhotoName("places/ChIJabc/photos/AUc7tX_1"));
        assertFalse(PlacesClient.validPhotoName("places/x/photos/y/../../z"));
        assertFalse(PlacesClient.validPhotoName("https://evil.example/a.jpg"));
        assertFalse(PlacesClient.validPhotoName(null));
    }

    @Test
    void liveSearchEndpointsAreRateLimited() {
        assertNotNull(RateLimitFilter.rule("GET", "/api/flights/search"));
        assertNotNull(RateLimitFilter.rule("GET", "/api/hotels/search"));
        assertNotNull(RateLimitFilter.rule("GET", "/api/flights/booking-links"));
        assertNull(RateLimitFilter.rule("GET", "/api/travel/airports"));
    }
}
