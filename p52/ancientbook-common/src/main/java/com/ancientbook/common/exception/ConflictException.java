package com.ancientbook.common.exception;

import lombok.Getter;

@Getter
public class ConflictException extends BusinessException {

    private final Object currentState;
    private final String resourceId;
    private final Integer expectedVersion;
    private final Integer actualVersion;

    public ConflictException(String message) {
        super(409, message);
        this.currentState = null;
        this.resourceId = null;
        this.expectedVersion = null;
        this.actualVersion = null;
    }

    public ConflictException(String resourceId, String message) {
        super(409, message);
        this.resourceId = resourceId;
        this.currentState = null;
        this.expectedVersion = null;
        this.actualVersion = null;
    }

    public ConflictException(String resourceId, Integer expectedVersion, Integer actualVersion) {
        super(409, "数据版本冲突，预期版本: " + expectedVersion + ", 实际版本: " + actualVersion);
        this.resourceId = resourceId;
        this.expectedVersion = expectedVersion;
        this.actualVersion = actualVersion;
        this.currentState = null;
    }

    public ConflictException(String resourceId, Object currentState, String message) {
        super(409, message);
        this.resourceId = resourceId;
        this.currentState = currentState;
        this.expectedVersion = null;
        this.actualVersion = null;
    }
}
