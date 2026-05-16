package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class Season {
    private Integer id;
    private String name;
    private String description;
    private Date startTime;
    private Date endTime;
    private Integer status;
    private Date createTime;
    
    public static final int STATUS_UPCOMING = 0;
    public static final int STATUS_ACTIVE = 1;
    public static final int STATUS_ENDED = 2;
}