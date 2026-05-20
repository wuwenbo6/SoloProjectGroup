package com.ancientbook.common.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum WarningLevel {

    LOW(1, "低", "轻微异常，不影响正常修复"),
    MEDIUM(2, "中", "中度异常，需要关注处理"),
    HIGH(3, "高", "严重异常，需要立即处理");

    private final int code;
    private final String name;
    private final String description;
}
