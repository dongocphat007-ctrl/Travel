package vn.travel.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class AppBeans {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
