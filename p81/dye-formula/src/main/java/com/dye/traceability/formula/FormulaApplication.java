package com.dye.traceability.formula;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = "com.dye.traceability")
@MapperScan(basePackages = "com.dye.traceability.formula.mapper")
public class FormulaApplication {

    public static void main(String[] args) {
        SpringApplication.run(FormulaApplication.class, args);
    }
}
