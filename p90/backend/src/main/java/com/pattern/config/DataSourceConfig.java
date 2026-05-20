package com.pattern.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Bean(name = "patternDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.pattern")
    public DataSource patternDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "userDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.user")
    public DataSource userDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "interactionDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.interaction")
    public DataSource interactionDataSource() {
        return DataSourceBuilder.create().build();
    }
}
