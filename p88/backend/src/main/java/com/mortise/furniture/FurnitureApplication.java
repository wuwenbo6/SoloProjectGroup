package com.mortise.furniture;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
@MapperScan("com.mortise.furniture.repository")
public class FurnitureApplication {

    public static void main(String[] args) {
        SpringApplication.run(FurnitureApplication.class, args);
    }
}
