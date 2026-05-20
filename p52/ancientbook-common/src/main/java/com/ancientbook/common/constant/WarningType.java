package com.ancientbook.common.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum WarningType {

    TIMEOUT(1, "进度超时", "修复进度超过预期完成时间"),
    QUALITY(2, "质量异常", "工序质量评分低于阈值"),
    MATERIAL(3, "材料不足", "修复材料库存不足"),
    PROCESS(4, "工序异常", "工序执行参数偏离标准"),
    WORKER(5, "人员异常", "修复人员技能等级不匹配"),
    EQUIPMENT(6, "设备故障", "修复设备状态异常");

    private final int code;
    private final String name;
    private final String description;

    public static WarningType of(int code) {
        for (WarningType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        return null;
    }
}
