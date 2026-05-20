package com.ancientbook.common.datasource;

public enum DataSourceType {

    RAREBOOK("rarebook", "善本信息库"),
    PROGRESS("progress", "修复进度库"),
    PROCESS("process", "修复工艺库"),
    AUTH("auth", "权限用户库"),
    DETECTION("detection", "检测报告库"),
    ARCHIVE("archive", "修复档案库");

    private final String name;
    private final String description;

    DataSourceType(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }
}
