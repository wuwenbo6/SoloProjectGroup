package com.ancientbook.common.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public abstract class VersionedEntity extends BaseEntity {

    private Integer version;
}
