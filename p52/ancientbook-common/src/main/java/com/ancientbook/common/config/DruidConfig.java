package com.ancientbook.common.config;

import com.alibaba.druid.pool.DruidDataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.common.datasource.DynamicDataSource;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class DruidConfig {

    @Bean
    @ConfigurationProperties("spring.datasource.druid.rarebook")
    public DataSource rarebookDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.progress")
    public DataSource progressDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.process")
    public DataSource processDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.auth")
    public DataSource authDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.detection")
    public DataSource detectionDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.druid.archive")
    public DataSource archiveDataSource() {
        return new DruidDataSource();
    }

    @Bean
    @Primary
    public DynamicDataSource dynamicDataSource() {
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put(DataSourceType.RAREBOOK.getName(), rarebookDataSource());
        targetDataSources.put(DataSourceType.PROGRESS.getName(), progressDataSource());
        targetDataSources.put(DataSourceType.PROCESS.getName(), processDataSource());
        targetDataSources.put(DataSourceType.AUTH.getName(), authDataSource());
        targetDataSources.put(DataSourceType.DETECTION.getName(), detectionDataSource());
        targetDataSources.put(DataSourceType.ARCHIVE.getName(), archiveDataSource());
        return new DynamicDataSource(rarebookDataSource(), targetDataSources);
    }
}
