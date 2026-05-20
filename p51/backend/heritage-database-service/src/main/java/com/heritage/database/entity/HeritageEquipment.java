package com.heritage.database.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("heritage_equipment")
public class HeritageEquipment {
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private String equipmentCode;
    
    private String name;
    
    private String equipmentType;
    
    private String category;
    
    private String factory;
    
    private Integer manufactureYear;
    
    private Integer retireYear;
    
    private String location;
    
    private Double weight;
    
    private String dimensions;
    
    private String material;
    
    private String originalPurpose;
    
    private String historicalBackground;
    
    private String technicalSpecs;
    
    private String status;
    
    private String damageLevel;
    
    private String preservationCondition;
    
    private String ownerUnit;
    
    private String contactPerson;
    
    private String contactPhone;
    
    private String source;
    
    private String externalId;
    
    private String tags;
    
    private String images;
    
    private String model3dPath;
    
    private Integer syncStatus;
    
    private LocalDateTime lastSyncTime;
    
    private LocalDateTime createTime;
    
    private LocalDateTime updateTime;
    
    private Integer isDeleted;
}