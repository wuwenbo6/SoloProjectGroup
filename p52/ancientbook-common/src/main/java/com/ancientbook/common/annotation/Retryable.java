package com.ancientbook.common.annotation;

import java.lang.annotation.*;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Retryable {

    /**
     * 最大重试次数
     */
    int maxAttempts() default 3;

    /**
     * 重试间隔(毫秒)
     */
    long delay() default 1000;

    /**
     * 指数退避乘数
     */
    double multiplier() default 2.0;

    /**
     * 需要重试的异常类型
     */
    Class<? extends Throwable>[] retryOn() default {Exception.class};
}
