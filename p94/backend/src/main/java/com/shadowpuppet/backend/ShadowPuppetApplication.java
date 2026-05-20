package com.shadowpuppet.backend;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan(basePackages = "com.shadowpuppet.backend.mapper")
public class ShadowPuppetApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShadowPuppetApplication.class, args);
    }
}
