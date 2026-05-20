package com.heritage.common.cache;

import java.lang.annotation.*;
import java.util.concurrent.TimeUnit;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ResponseCache {
    
    String key() default "";
    
    int ttl() default 300;
    
    TimeUnit timeUnit() default TimeUnit.SECONDS;
    
    boolean syncUpdate() default false;
    
    String condition() default "";
}

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@interface CacheEvict {
    
    String key() default "";
    
    boolean allEntries() default false;
}

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@interface BatchQuery {
    
    int maxBatchSize() default 100;
    
    boolean enableParallel() default true;
}