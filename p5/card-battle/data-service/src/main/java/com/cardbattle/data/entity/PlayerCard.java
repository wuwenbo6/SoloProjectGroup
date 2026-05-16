package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class PlayerCard {
    private Long id;
    private Long playerId;
    private Long cardId;
    private Integer count;
    private Date obtainTime;
}