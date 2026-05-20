package com.folk.activity.message.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.folk.activity.common.core.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("t_message_record")
public class MessageRecord extends BaseEntity {
    private Long userId;
    private String userPhone;
    private String templateCode;
    private String title;
    private String content;
    private String channel;
    private Integer status;
    private String result;
    private String remark;
    private Integer deleted;
}
