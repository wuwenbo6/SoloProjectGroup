package com.ancient.book.semantic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.ancient.book"})
public class SemanticMatchingApplication {

    public static void main(String[] args) {
        SpringApplication.run(SemanticMatchingApplication.class, args);
    }
}
