package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class PlayerSeasonRecord {
    private Long id;
    private Long playerId;
    private Integer seasonId;
    private Integer highestRankId;
    private Integer highestRankPoints;
    private Integer finalRankId;
    private Integer finalRankPoints;
    private Integer wins;
    private Integer losses;
    private Integer draws;
    private Integer winStreak;
    private Integer maxWinStreak;
    private Integer battleCount;
    private Integer rewardsClaimed;
    private Date claimTime;
    private Date createTime;
    private Date updateTime;
}