package com.heritage.scoring;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.EnableEurekaClient;

@SpringBootApplication
@EnableEurekaClient
@MapperScan("com.heritage.scoring.mapper")
public class RestorationScoringApplication {
    public static void main(String[] args) {
        SpringApplication.run(RestorationScoringApplication.class, args);
    }
}