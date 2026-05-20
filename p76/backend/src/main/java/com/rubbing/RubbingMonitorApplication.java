package com.rubbing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RubbingMonitorApplication {
    public static void main(String[] args) {
        SpringApplication.run(RubbingMonitorApplication.class, args);
    }
}
