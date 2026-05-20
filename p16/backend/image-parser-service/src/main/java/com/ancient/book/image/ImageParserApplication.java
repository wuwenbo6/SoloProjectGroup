package com.ancient.book.image;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.ancient.book"})
public class ImageParserApplication {

    public static void main(String[] args) {
        SpringApplication.run(ImageParserApplication.class, args);
    }
}
