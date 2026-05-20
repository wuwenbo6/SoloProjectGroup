package com.mortisejoiner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class MortiseJoinerApplication {
    public static void main(String[] args) {
        SpringApplication.run(MortiseJoinerApplication.class, args);
    }
}
