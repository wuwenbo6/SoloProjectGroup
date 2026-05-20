package com.folk.activity.message.listener;

import com.folk.activity.message.entity.MessageRecord;
import com.folk.activity.message.mapper.MessageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OrderProgressListener {
    private final MessageRecordMapper messageRecordMapper;

    @RabbitListener(queues = "message.queue")
    public void handleOrderProgress(Map<String, Object> message) {
        try {
            String type = (String) message.get("type");
            if ("ORDER_PROGRESS".equals(type)) {
                saveMessageRecord(message);
                pushToWebSocket(message);
            }
        } catch (Exception e) {
            System.err.println("处理订单进度消息失败: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void saveMessageRecord(Map<String, Object> message) {
        MessageRecord record = new MessageRecord();
        record.setUserId(((Number) message.get("userId")).longValue());
        record.setTitle((String) message.get("title"));
        record.setContent((String) message.get("content"));
        record.setChannel("PUSH");
        record.setStatus(1);
        record.setCreateTime(LocalDateTime.now());
        record.setDeleted(0);
        messageRecordMapper.insert(record);
    }

    private void pushToWebSocket(Map<String, Object> message) {
        System.out.println("WebSocket推送订单进度: " + message);
    }
}
