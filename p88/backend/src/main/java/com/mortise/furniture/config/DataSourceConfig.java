package com.mortise.furniture.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class DataSourceConfig {

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.furniture")
    public DataSource furnitureDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.mortise")
    public DataSource mortiseDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.craft")
    public DataSource craftDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean
    @Primary
    public DataSource dynamicDataSource() {
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("furniture", furnitureDataSource());
        targetDataSources.put("mortise", mortiseDataSource());
        targetDataSources.put("craft", craftDataSource());

        DynamicDataSource dynamicDataSource = new DynamicDataSource();
        dynamicDataSource.setTargetDataSources(targetDataSources);
        dynamicDataSource.setDefaultTargetDataSource(furnitureDataSource());
        return dynamicDataSource;
    }

    public static class DynamicDataSource extends AbstractRoutingDataSource {
        private static final ThreadLocal<String> contextHolder = new ThreadLocal<>();

        public static void setDataSource(String dataSource) {
            contextHolder.set(dataSource);
        }

        public static void clearDataSource() {
            contextHolder.remove();
        }

        @Override
        protected Object determineCurrentLookupKey() {
            return contextHolder.get();
        }
    }
}
