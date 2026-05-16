package com.cardbattle.data.entity;

import lombok.Data;
import java.util.Date;

@Data
public class Card {
    private Long id;
    private String name;
    private Integer type;
    private Integer cost;
    private Integer attack;
    private Integer health;
    private String effect;
    private String description;
    private Integer rarity;
    private Date createTime;
    private Integer status;
}