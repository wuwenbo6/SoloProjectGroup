package com.crafthub.artisan;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@MapperScan("com.crafthub.artisan.mapper")
public class ArtisanApplication {

    public static void main(String[] args) {
        SpringApplication.run(ArtisanApplication.class, args);
    }
}
