package com.folk.activity.message.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.common.core.result.Result;
import com.folk.activity.message.config.RabbitMQConfig;
import com.folk.activity.message.entity.MessageRecord;
import com.folk.activity.message.mapper.MessageRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/message")
@RequiredArgsConstructor
public class MessageController {
    private final MessageRecordMapper messageRecordMapper;
    private final RabbitTemplate rabbitTemplate;

    @PostMapping("/send")
    public Result<MessageRecord> sendMessage(@RequestBody MessageRecord record) {
        record.setStatus(0);
        record.setCreateTime(LocalDateTime.now());
        messageRecordMapper.insert(record);
        
        rabbitTemplate.convertAndSend(RabbitMQConfig.MESSAGE_EXCHANGE, RabbitMQConfig.MESSAGE_ROUTING_KEY, 
            Map.of("messageId", record.getId(), "content", record.getContent(), "userId", record.getUserId()));
        
        record.setStatus(1);
        messageRecordMapper.updateById(record);
        
        return Result.success(record);
    }

    @PostMapping("/send/batch")
    public Result<Boolean> sendBatchMessage(@RequestBody List<Long> userIds, 
                                            @RequestParam String title, 
                                            @RequestParam String content) {
        userIds.forEach(userId -> {
            MessageRecord record = new MessageRecord();
            record.setUserId(userId);
            record.setTitle(title);
            record.setContent(content);
            record.setChannel("PUSH");
            record.setStatus(1);
            record.setCreateTime(LocalDateTime.now());
            record.setDeleted(0);
            messageRecordMapper.insert(record);
            
            rabbitTemplate.convertAndSend(RabbitMQConfig.MESSAGE_EXCHANGE, RabbitMQConfig.MESSAGE_ROUTING_KEY,
                Map.of("messageId", record.getId(), "content", content, "userId", userId));
        });
        
        return Result.success(true);
    }

    @GetMapping("/user/{userId}")
    public Result<List<MessageRecord>> getUserMessages(@PathVariable Long userId, 
                                                        @RequestParam(required = false) Integer status) {
        LambdaQueryWrapper<MessageRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(MessageRecord::getUserId, userId)
                    .eq(MessageRecord::getDeleted, 0)
                    .orderByDesc(MessageRecord::getCreateTime);
        
        if (status != null) {
            queryWrapper.eq(MessageRecord::getStatus, status);
        }
        
        return Result.success(messageRecordMapper.selectList(queryWrapper));
    }

    @PostMapping("/read/{id}")
    public Result<Boolean> markAsRead(@PathVariable Long id) {
        MessageRecord record = new MessageRecord();
        record.setId(id);
        record.setStatus(2);
        return Result.success(messageRecordMapper.updateById(record) > 0);
    }

    @PostMapping("/read/all/{userId}")
    public Result<Boolean> markAllAsRead(@PathVariable Long userId) {
        LambdaQueryWrapper<MessageRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(MessageRecord::getUserId, userId)
                    .eq(MessageRecord::getStatus, 1);
        
        List<MessageRecord> records = messageRecordMapper.selectList(queryWrapper);
        records.forEach(record -> {
            record.setStatus(2);
            messageRecordMapper.updateById(record);
        });
        
        return Result.success(true);
    }

    @GetMapping("/unread/{userId}")
    public Result<Long> getUnreadCount(@PathVariable Long userId) {
        Long count = messageRecordMapper.selectCount(new LambdaQueryWrapper<MessageRecord>()
                .eq(MessageRecord::getUserId, userId)
                .eq(MessageRecord::getStatus, 1)
                .eq(MessageRecord::getDeleted, 0));
        return Result.success(count);
    }
}
