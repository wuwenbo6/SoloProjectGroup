package com.folk.activity.message.listener;

import com.folk.activity.message.config.RabbitMQConfig;
import com.folk.activity.message.entity.MessageRecord;
import com.folk.activity.message.mapper.MessageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class AuditResultListener {

    private final MessageRecordMapper messageRecordMapper;

    @RabbitListener(queues = RabbitMQConfig.AUDIT_QUEUE)
    public void handleAuditResult(Map<String, Object> message) {
        try {
            System.out.println("收到审核结果消息: " + message);
            
            Integer status = (Integer) message.get("status");
            Long applicantId = (Long) message.get("applicantId");
            String bizType = (String) message.get("bizType");
            String messageContent = (String) message.get("message");
            
            if (applicantId != null) {
                MessageRecord record = new MessageRecord();
                record.setUserId(applicantId);
                record.setTemplateCode("AUDIT_" + status);
                record.setTitle(generateTitle(status, bizType));
                record.setContent(messageContent);
                record.setChannel("PUSH");
                record.setStatus(1);
                record.setCreateTime(LocalDateTime.now());
                record.setDeleted(0);
                
                messageRecordMapper.insert(record);
                
                System.out.println("审核结果消息已保存并推送给用户: " + applicantId);
            }
        } catch (Exception e) {
            System.err.println("处理审核结果消息失败: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String generateTitle(Integer status, String bizType) {
        String title;
        switch (status) {
            case 0:
                title = "审核提交成功";
                break;
            case 1:
                title = "审核通过通知";
                break;
            case 2:
                title = "审核未通过通知";
                break;
            default:
                title = "审核状态更新";
        }
        return "【" + bizType + "】" + title;
    }
}
