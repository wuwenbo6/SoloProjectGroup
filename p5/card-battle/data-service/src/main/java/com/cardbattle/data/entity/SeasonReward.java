package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class SeasonReward {
    private Long id;
    private Integer seasonId;
    private Integer minRankId;
    private Integer maxRankId;
    private String rankName;
    private String rewardType;
    private String rewardName;
    private Integer rewardValue;
    private String rewardDescription;
    private Date createTime;
    
    public static final String REWARD_TYPE_CARD = "CARD";
    public static final String REWARD_TYPE_COINS = "COINS";
    public static final String REWARD_TYPE_TITLE = "TITLE";
    public static final String REWARD_TYPE_AVATAR = "AVATAR";
}