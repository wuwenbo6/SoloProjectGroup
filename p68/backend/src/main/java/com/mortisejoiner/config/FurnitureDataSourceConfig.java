package com.mortisejoiner.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableTransactionManagement
@EnableJpaRepositories(
        basePackages = "com.mortisejoiner.repository.furniture",
        entityManagerFactoryRef = "furnitureEntityManagerFactory",
        transactionManagerRef = "furnitureTransactionManager"
)
public class FurnitureDataSourceConfig {

    @Primary
    @Bean(name = "furnitureDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.furniture")
    public DataSource furnitureDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Primary
    @Bean(name = "furnitureEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean furnitureEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("furnitureDataSource") DataSource dataSource) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", "update");
        properties.put("hibernate.dialect", "org.hibernate.dialect.MySQLDialect");
        return builder
                .dataSource(dataSource)
                .packages("com.mortisejoiner.entity.furniture")
                .persistenceUnit("furniture")
                .properties(properties)
                .build();
    }

    @Primary
    @Bean(name = "furnitureTransactionManager")
    public PlatformTransactionManager furnitureTransactionManager(
            @Qualifier("furnitureEntityManagerFactory") EntityManagerFactory furnitureEntityManagerFactory) {
        return new JpaTransactionManager(furnitureEntityManagerFactory);
    }
}
