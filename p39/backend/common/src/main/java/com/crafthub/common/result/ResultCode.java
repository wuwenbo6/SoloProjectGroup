package com.crafthub.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    ERROR(500, "操作失败"),
    
    PARAM_ERROR(400, "参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "拒绝访问"),
    NOT_FOUND(404, "资源不存在"),
    
    USER_NOT_FOUND(1001, "用户不存在"),
    USER_ALREADY_EXISTS(1002, "用户已存在"),
    USER_PASSWORD_ERROR(1003, "密码错误"),
    
    ARTISAN_NOT_FOUND(2001, "匠人不存在"),
    ARTISAN_NOT_VERIFIED(2002, "匠人未通过认证"),
    
    ORDER_NOT_FOUND(3001, "订单不存在"),
    ORDER_STATUS_ERROR(3002, "订单状态错误"),
    
    REQUIREMENT_NOT_FOUND(4001, "需求不存在"),
    
    PAYMENT_ERROR(5001, "支付失败"),
    
    SERVICE_UNAVAILABLE(9001, "服务暂时不可用");

    private final Integer code;
    private final String message;
}
