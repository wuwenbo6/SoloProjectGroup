package com.fittrack.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MotionAnalysisWebSocketHandler motionAnalysisWebSocketHandler;

    public WebSocketConfig(MotionAnalysisWebSocketHandler motionAnalysisWebSocketHandler) {
        this.motionAnalysisWebSocketHandler = motionAnalysisWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(motionAnalysisWebSocketHandler, "/ws/motion")
                .setAllowedOrigins("*");
    }
}
