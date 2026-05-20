package com.ancientbook.common.annotation;

import java.lang.annotation.*;
import java.util.concurrent.TimeUnit;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Idempotent {

    /**
     * 幂等Key前缀
     */
    String prefix() default "idempotent:";

    /**
     * 幂等Key的SpEL表达式
     */
    String key() default "";

    /**
     * 过期时间，默认5分钟
     */
    int expireTime() default 5;

    /**
     * 时间单位
     */
    TimeUnit timeUnit() default TimeUnit.MINUTES;

    /**
     * 提示信息
     */
    String message() default "请勿重复提交";
}
