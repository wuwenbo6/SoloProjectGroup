package com.ancientbook.common.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan(basePackages = "com.ancientbook.**.mapper")
public class MyBatisConfig {
}
