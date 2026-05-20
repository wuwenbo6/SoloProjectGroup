package com.heritage.database;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.EnableEurekaClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableEurekaClient
@EnableScheduling
@MapperScan("com.heritage.database.mapper")
public class HeritageDatabaseApplication {
    public static void main(String[] args) {
        SpringApplication.run(HeritageDatabaseApplication.class, args);
    }
}