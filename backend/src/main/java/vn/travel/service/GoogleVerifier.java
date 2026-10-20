package vn.travel.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vn.travel.config.TravelProperties;
import vn.travel.util.Maps;
import vn.travel.web.HttpError;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.Signature;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Xác minh ID token của Google Sign-In: chữ ký RS256 (khóa công khai Google), aud, iss, hạn, email_verified. */
@Component
public class GoogleVerifier {
    private static final String CERTS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() { };

    private final ObjectMapper mapper;
    private final String clientId;
    private final Clock clock;
    private final Function<String, String> fetch;
    private volatile Map<String, Object> keys;
    private volatile long keysAt;

    @Autowired
    public GoogleVerifier(TravelProperties props, ObjectMapper mapper, Clock clock) {
        this(props.googleClientId(), mapper, clock, GoogleVerifier::httpGet);
    }

    public GoogleVerifier(String clientId, ObjectMapper mapper, Clock clock, Function<String, String> fetch) {
        this.clientId = clientId;
        this.mapper = mapper;
        this.clock = clock;
        this.fetch = fetch;
    }

    private static String httpGet(String url) {
        try {
            HttpResponse<String> r = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
                    .send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() != 200) throw new IllegalStateException("HTTP " + r.statusCode());
            return r.body();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public boolean enabled() {
        return !TravelProperties.blank(clientId);
    }

    private Map<String, Object> jwks() throws Exception {
        if (keys == null || clock.millis() - keysAt > 3_600_000L) {
            keys = mapper.readValue(fetch.apply(CERTS), OBJ);
            keysAt = clock.millis();
        }
        return keys;
    }

    /** Trả claims (email, name, picture, sub...) hoặc ném HttpError 401. */
    public Map<String, Object> verify(String credential) {
        if (!enabled()) throw new HttpError(503, "Chưa cấu hình đăng nhập Google trên máy chủ");
        HttpError bad = new HttpError(401, "Đăng nhập Google không hợp lệ");
        if (credential == null) throw bad;
        String[] p = credential.split("\\.");
        if (p.length != 3) throw bad;
        try {
            Map<String, Object> header = mapper.readValue(Base64.getUrlDecoder().decode(p[0]), OBJ);
            Map<String, Object> claims = mapper.readValue(Base64.getUrlDecoder().decode(p[1]), OBJ);
            if (!"RS256".equals(header.get("alg"))) throw bad;
            Map<String, Object> jwk = null;
            for (Object o : (List<?>) jwks().get("keys")) {
                Map<String, Object> k = Maps.map(o);
                if (k != null && String.valueOf(k.get("kid")).equals(String.valueOf(header.get("kid")))) jwk = k;
            }
            if (jwk == null) throw bad;
            RSAPublicKeySpec spec = new RSAPublicKeySpec(new BigInteger(1, Base64.getUrlDecoder().decode(Maps.str(jwk, "n"))),
                    new BigInteger(1, Base64.getUrlDecoder().decode(Maps.str(jwk, "e"))));
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(KeyFactory.getInstance("RSA").generatePublic(spec));
            sig.update((p[0] + "." + p[1]).getBytes(StandardCharsets.US_ASCII));
            if (!sig.verify(Base64.getUrlDecoder().decode(p[2]))) throw bad;
            String iss = Maps.str(claims, "iss");
            if (!clientId.equals(Maps.str(claims, "aud"))
                    || !(iss.equals("accounts.google.com") || iss.equals("https://accounts.google.com"))
                    || Maps.lng(claims, "exp") * 1000 < clock.millis()
                    || Maps.str(claims, "email").isEmpty()
                    || "false".equals(Maps.str(claims, "email_verified"))) throw bad;
            return claims;
        } catch (HttpError e) {
            throw e;
        } catch (Exception e) {
            throw bad;
        }
    }
}
