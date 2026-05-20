package com.heritage.restoration;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.EnableEurekaClient;

@SpringBootApplication
@EnableEurekaClient
@MapperScan("com.heritage.restoration.mapper")
public class RestorationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RestorationServiceApplication.class, args);
    }
}
