package com.ancient.book.common.config;

import feign.*;
import feign.okhttp.OkHttpClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.util.concurrent.TimeUnit;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class FeignClientConfig {

    private final ServiceRegistryConfig serviceRegistryConfig;

    @Bean
    public Client feignClient() {
        okhttp3.OkHttpClient okHttpClient = new okhttp3.OkHttpClient.Builder()
                .connectTimeout(serviceRegistryConfig.getConnectionTimeoutMs(), TimeUnit.MILLISECONDS)
                .readTimeout(serviceRegistryConfig.getReadTimeoutMs(), TimeUnit.MILLISECONDS)
                .writeTimeout(serviceRegistryConfig.getReadTimeoutMs(), TimeUnit.MILLISECONDS)
                .connectionPool(new okhttp3.ConnectionPool(
                        serviceRegistryConfig.getMaxConnections(),
                        5,
                        TimeUnit.MINUTES
                ))
                .retryOnConnectionFailure(true)
                .addInterceptor(new ServiceCallInterceptor())
                .build();

        log.info("Feign OkHttpClient 初始化完成: 最大连接数={}, 连接超时={}ms, 读取超时={}ms",
                serviceRegistryConfig.getMaxConnections(),
                serviceRegistryConfig.getConnectionTimeoutMs(),
                serviceRegistryConfig.getReadTimeoutMs());

        return new OkHttpClient(okHttpClient);
    }

    @Bean
    public Retryer feignRetryer() {
        return new Retryer.Default(100, TimeUnit.SECONDS.toMillis(1), 3);
    }

    @Bean
    public Logger.Level feignLoggerLevel() {
        return Logger.Level.BASIC;
    }

    @Bean
    public Request.Options feignRequestOptions() {
        return new Request.Options(
                serviceRegistryConfig.getConnectionTimeoutMs(),
                TimeUnit.MILLISECONDS,
                serviceRegistryConfig.getReadTimeoutMs(),
                TimeUnit.MILLISECONDS,
                true
        );
    }

    public static class ServiceCallInterceptor implements okhttp3.Interceptor {
        @Override
        public okhttp3.Response intercept(Chain chain) throws java.io.IOException {
            okhttp3.Request request = chain.request();
            long startTime = System.currentTimeMillis();

            String serviceName = request.url().host();
            String path = request.url().encodedPath();

            okhttp3.Request tracedRequest = request.newBuilder()
                    .header("X-Request-ID", java.util.UUID.randomUUID().toString())
                    .header("X-Timestamp", String.valueOf(startTime))
                    .header("X-Service-Name", serviceName)
                    .build();

            try {
                okhttp3.Response response = chain.proceed(tracedRequest);
                long duration = System.currentTimeMillis() - startTime;

                if (duration > 1000) {
                    log.warn("慢服务调用: {} {} - {}ms", request.method(), path, duration);
                }

                return response;
            } catch (Exception e) {
                log.error("服务调用失败: {} {} - {}", request.method(), path, e.getMessage());
                throw e;
            }
        }
    }
}
