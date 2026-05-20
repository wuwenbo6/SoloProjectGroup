package com.ancientbook.common.annotation;

import java.lang.annotation.*;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Crypto {

    boolean encryptRequest() default true;

    boolean encryptResponse() default true;

    boolean verifySignature() default true;
}
