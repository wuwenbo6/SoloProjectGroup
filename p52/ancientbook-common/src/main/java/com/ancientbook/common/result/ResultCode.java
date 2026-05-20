package com.ancientbook.common.result;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ResultCode {

    SUCCESS(200, "操作成功"),
    ERROR(500, "操作失败"),
    PARAM_ERROR(400, "参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "禁止访问"),
    NOT_FOUND(404, "资源不存在"),
    
    RAREBOOK_NOT_FOUND(1001, "善本信息不存在"),
    PROGRESS_NOT_FOUND(1002, "修复进度不存在"),
    PROCESS_NOT_FOUND(1003, "修复工艺不存在"),
    DETECTION_NOT_FOUND(1004, "检测报告不存在"),
    ARCHIVE_NOT_FOUND(1005, "修复档案不存在"),
    
    USER_NOT_FOUND(2001, "用户不存在"),
    USER_PASSWORD_ERROR(2002, "密码错误"),
    USER_DISABLED(2003, "用户已禁用"),
    TOKEN_INVALID(2004, "Token无效"),
    TOKEN_EXPIRED(2005, "Token已过期"),
    
    THIRD_PARTY_ERROR(3001, "第三方接口调用失败"),
    ENCRYPT_ERROR(3002, "加密失败"),
    DECRYPT_ERROR(3003, "解密失败"),
    EXPORT_ERROR(3004, "导出失败");

    private final Integer code;
    private final String message;
}
