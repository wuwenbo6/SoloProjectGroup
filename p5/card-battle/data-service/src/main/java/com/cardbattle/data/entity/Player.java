package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class Player {
    private Long id;
    private String username;
    private String password;
    private String nickname;
    private Integer level;
    private Integer exp;
    private Integer rankId;
    private Integer rankPoints;
    private Integer wins;
    private Integer losses;
    private Integer draws;
    private String rankTitle;
    private Date createTime;
    private Date updateTime;
    private Integer status;
}