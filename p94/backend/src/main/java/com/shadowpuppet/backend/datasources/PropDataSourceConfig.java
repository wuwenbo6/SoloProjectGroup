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
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;

@Configuration
@MapperScan(basePackages = "com.shadowpuppet.backend.mapper.prop", sqlSessionFactoryRef = "propSqlSessionFactory")
public class PropDataSourceConfig {

    @Primary
    @Bean(name = "propDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.prop")
    public DataSource propDataSource() {
        return DataSourceBuilder.create().build();
    }

    @Primary
    @Bean(name = "propSqlSessionFactory")
    public SqlSessionFactory propSqlSessionFactory(@Qualifier("propDataSource") DataSource dataSource) throws Exception {
        MybatisSqlSessionFactoryBean bean = new MybatisSqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/prop/*.xml"));
        return bean.getObject();
    }

    @Primary
    @Bean(name = "propSqlSessionTemplate")
    public SqlSessionTemplate propSqlSessionTemplate(@Qualifier("propSqlSessionFactory") SqlSessionFactory sqlSessionFactory) {
        return new SqlSessionTemplate(sqlSessionFactory);
    }
}
