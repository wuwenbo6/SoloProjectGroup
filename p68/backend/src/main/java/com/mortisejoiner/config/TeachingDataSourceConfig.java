package com.mortisejoiner.config;

import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
        basePackages = "com.mortisejoiner.repository.teaching",
        entityManagerFactoryRef = "teachingEntityManagerFactory",
        transactionManagerRef = "teachingTransactionManager"
)
public class TeachingDataSourceConfig {

    @Bean(name = "teachingDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.teaching")
    public DataSource teachingDataSource() {
        return DataSourceBuilder.create()
                .type(com.zaxxer.hikari.HikariDataSource.class)
                .build();
    }

    @Bean(name = "teachingEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean teachingEntityManagerFactory(
            EntityManagerFactoryBuilder builder,
            @Qualifier("teachingDataSource") DataSource dataSource) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("hibernate.hbm2ddl.auto", "update");
        properties.put("hibernate.dialect", "org.hibernate.dialect.MySQLDialect");
        properties.put("hibernate.jdbc.batch_size", 50);
        properties.put("hibernate.order_inserts", true);
        properties.put("hibernate.order_updates", true);
        return builder
                .dataSource(dataSource)
                .packages("com.mortisejoiner.entity.teaching")
                .persistenceUnit("teaching")
                .properties(properties)
                .build();
    }

    @Bean(name = "teachingTransactionManager")
    public PlatformTransactionManager teachingTransactionManager(
            @Qualifier("teachingEntityManagerFactory") EntityManagerFactory teachingEntityManagerFactory) {
        return new JpaTransactionManager(teachingEntityManagerFactory);
    }
}
