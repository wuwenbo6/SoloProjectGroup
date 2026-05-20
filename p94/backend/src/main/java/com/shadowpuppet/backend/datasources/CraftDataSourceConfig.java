package com.shadowpuppet.backend.datasources;

import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

@Configuration
@MapperScan(basePackages = "com.shadowpuppet.backend.mapper.craft", sqlSessionFactoryRef = "craftSqlSessionFactory")
public class CraftDataSourceConfig {

    @Bean(name = "craftDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.craft")
    public DataSource craftDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Bean(name = "craftSqlSessionFactory")
    public SqlSessionFactory craftSqlSessionFactory(@Qualifier("craftDataSource") DataSource dataSource) throws Exception {
        MybatisSqlSessionFactoryBean bean = new MybatisSqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/craft/*.xml"));
        return bean.getObject();
    }

    @Bean(name = "craftSqlSessionTemplate")
    public SqlSessionTemplate craftSqlSessionTemplate(@Qualifier("craftSqlSessionFactory") SqlSessionFactory sqlSessionFactory) {
        return new SqlSessionTemplate(sqlSessionFactory);
    }
}
