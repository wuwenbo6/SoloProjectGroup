package com.bamboo.defect;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BambooDefectDetectionApplication {
    public static void main(String[] args) {
        SpringApplication.run(BambooDefectDetectionApplication.class, args);
        System.out.println("=======================================");
        System.out.println("  竹编缺陷检测监控系统后端启动成功!");
        System.out.println("  访问地址: http://localhost:8080");
        System.out.println("=======================================");
    }
}
