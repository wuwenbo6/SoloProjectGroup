package com.ancientbook.common.aspect;

import com.ancientbook.common.annotation.Idempotent;
import com.ancientbook.common.exception.BusinessException;
import com.ancientbook.common.util.IdempotentLock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class IdempotentAspect {

    private final IdempotentLock idempotentLock;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer nameDiscoverer = new DefaultParameterNameDiscoverer();

    @Pointcut("@annotation(com.ancientbook.common.annotation.Idempotent)")
    public void idempotentPointcut() {
    }

    @Around("idempotentPointcut()")
    public Object around(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Idempotent idempotent = method.getAnnotation(Idempotent.class);

        String key = generateKey(joinPoint, idempotent, method);

        boolean locked = idempotentLock.tryLock(key, idempotent.expireTime(), idempotent.timeUnit());
        if (!locked) {
            throw new BusinessException(409, idempotent.message());
        }

        try {
            return joinPoint.proceed();
        } finally {
            idempotentLock.unlock(key);
        }
    }

    private String generateKey(ProceedingJoinPoint joinPoint, Idempotent idempotent, Method method) {
        String keyExpr = idempotent.key();
        if (keyExpr.isEmpty()) {
            return idempotent.prefix() + method.getName() + ":" + joinPoint.getArgs().hashCode();
        }

        Object[] args = joinPoint.getArgs();
        String[] paramNames = nameDiscoverer.getParameterNames(method);

        EvaluationContext context = new StandardEvaluationContext();
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);
            }
        }

        Expression expression = parser.parseExpression(keyExpr);
        String keyValue = expression.getValue(context, String.class);
        return idempotent.prefix() + keyValue;
    }
}
