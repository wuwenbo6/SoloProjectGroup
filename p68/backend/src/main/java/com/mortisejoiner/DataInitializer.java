package com.mortisejoiner;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Override
    public void run(String... args) throws Exception {
        System.out.println("========================================");
        System.out.println("  榫卯家具拆解教学平台 - 后端服务启动成功");
        System.out.println("========================================");
        System.out.println("  服务地址: http://localhost:8080/api");
        System.out.println("  前端地址: http://localhost:5173");
        System.out.println("========================================");
        System.out.println("  测试账号:");
        System.out.println("  - 管理员: admin / admin123");
        System.out.println("  - 讲师: instructor / admin123");
        System.out.println("  - 学员: student / admin123");
        System.out.println("========================================");
    }
}
