package com.fittrack.service;

import com.fittrack.dto.VideoAnalysisMessage;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class VideoAnalysisProducer {

    private final RabbitTemplate rabbitTemplate;

    @Value("${video.analysis.exchange.name}")
    private String exchangeName;

    @Value("${video.analysis.routing.key}")
    private String routingKey;

    public VideoAnalysisProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void sendVideoAnalysisTask(VideoAnalysisMessage message) {
        rabbitTemplate.convertAndSend(exchangeName, routingKey, message);
    }
}
