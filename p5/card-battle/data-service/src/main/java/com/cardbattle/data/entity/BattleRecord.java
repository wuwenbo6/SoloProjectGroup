package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class BattleRecord {
    private Long id;
    private String battleId;
    private Long player1Id;
    private Long player2Id;
    private Long winnerId;
    private Integer duration;
    private Integer turnCount;
    private String replayData;
    private Date startTime;
    private Date endTime;
    private Integer status;
}