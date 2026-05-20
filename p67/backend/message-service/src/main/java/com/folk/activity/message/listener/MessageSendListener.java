package com.folk.activity.message.listener;

import com.folk.activity.message.config.RabbitMQConfig;
import com.folk.activity.message.entity.MessageRecord;
import com.folk.activity.message.mapper.MessageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class MessageSendListener {

    private final MessageRecordMapper messageRecordMapper;

    @RabbitListener(queues = RabbitMQConfig.MESSAGE_QUEUE)
    public void handleMessageSend(Map<String, Object> message) {
        try {
            System.out.println("处理消息发送: " + message);
            
            Long messageId = (Long) message.get("messageId");
            if (messageId != null) {
                MessageRecord record = new MessageRecord();
                record.setId(messageId);
                record.setStatus(1);
                messageRecordMapper.updateById(record);
                
                System.out.println("消息发送成功，ID: " + messageId);
            }
        } catch (Exception e) {
            System.err.println("处理消息发送失败: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
