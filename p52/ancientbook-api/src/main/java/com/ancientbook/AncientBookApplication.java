package com.ancientbook;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
@MapperScan(basePackages = "com.ancientbook.**.mapper")
@EnableTransactionManagement
public class AncientBookApplication {

    public static void main(String[] args) {
        SpringApplication.run(AncientBookApplication.class, args);
    }
}
