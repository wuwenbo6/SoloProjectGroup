package com.bamboo.craft.config;

import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

@Configuration
@MapperScan(basePackages = "com.bamboo.craft.mapper.interaction", sqlSessionFactoryRef = "interactionSqlSessionFactory")
public class InteractionDataSourceConfig {

    @Bean(name = "interactionDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.interaction")
    public DataSource interactionDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "interactionSqlSessionFactory")
    public SqlSessionFactory interactionSqlSessionFactory(@Qualifier("interactionDataSource") DataSource dataSource) throws Exception {
        MybatisSqlSessionFactoryBean bean = new MybatisSqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/interaction/*.xml"));
        return bean.getObject();
    }
}
