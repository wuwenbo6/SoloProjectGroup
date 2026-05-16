package com.cardbattle.match;

import com.cardbattle.match.queue.matcher;
import com.cardbattle.data.entity.Player;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.*;
import io.netty.handler.codec.string.StringDecoder;
import io.netty.handler.codec.string.StringEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class server {
    private static final Logger logger = LoggerFactory.getLogger(server.class);
    private static final int PORT = 8080;
    
    private matcher matcher;
    private ObjectMapper objectMapper;
    private ScheduledExecutorService matchingExecutor;
    
    public server() {
        this.matcher = new matcher();
        this.objectMapper = new ObjectMapper();
        this.matchingExecutor = Executors.newSingleThreadScheduledExecutor();
    }
    
    public void start() throws Exception {
        startMatchingWorker();
        
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        
        try {
            ServerBootstrap b = new ServerBootstrap();
            b.group(bossGroup, workerGroup)
             .channel(NioServerSocketChannel.class)
             .option(ChannelOption.SO_BACKLOG, 100)
             .childOption(ChannelOption.TCP_NODELAY, true)
             .childHandler(new ChannelInitializer<SocketChannel>() {
                 @Override
                 public void initChannel(SocketChannel ch) {
                     ChannelPipeline p = ch.pipeline();
                     p.addLast(new HttpServerCodec());
                     p.addLast(new HttpObjectAggregator(65536));
                     p.addLast(new MatchServerHandler());
                 }
             });
            
            ChannelFuture f = b.bind(PORT).sync();
            logger.info("Match Service started on port {}", PORT);
            
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                matchingExecutor.shutdown();
                matcher.close();
                bossGroup.shutdownGracefully();
                workerGroup.shutdownGracefully();
                logger.info("Match Service stopped");
            }));
            
            f.channel().closeFuture().sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
    
    private void startMatchingWorker() {
        matchingExecutor.scheduleAtFixedRate(() -> {
            try {
                matcher.processMatching();
            } catch (Exception e) {
                logger.error("Matching worker error", e);
            }
        }, 0, 1, TimeUnit.SECONDS);
    }
    
    private class MatchServerHandler extends SimpleChannelInboundHandler<FullHttpRequest> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest req) {
            try {
                String uri = req.uri();
                String content = req.content().toString(StandardCharsets.UTF_8);
                
                Map<String, Object> requestData = objectMapper.readValue(content, Map.class);
                Map<String, Object> responseData = handleRequest(uri, requestData);
                
                FullHttpResponse response = new DefaultFullHttpResponse(
                    HttpVersion.HTTP_1_1, HttpResponseStatus.OK);
                response.content().writeBytes(objectMapper.writeValueAsBytes(responseData));
                response.headers().set(HttpHeaderNames.CONTENT_TYPE, "application/json");
                response.headers().set(HttpHeaderNames.CONTENT_LENGTH, response.content().readableBytes());
                
                ctx.writeAndFlush(response);
            } catch (Exception e) {
                logger.error("Handle request error", e);
                sendError(ctx, HttpResponseStatus.INTERNAL_SERVER_ERROR);
            }
        }
        
        private Map<String, Object> handleRequest(String uri, Map<String, Object> requestData) {
            try {
                switch (uri) {
                    case "/match/join":
                        return handleJoinQueue(requestData);
                    case "/match/leave":
                        return handleLeaveQueue(requestData);
                    case "/match/invite":
                        return handleSendInvite(requestData);
                    case "/match/accept":
                        return handleAcceptInvite(requestData);
                    case "/match/reconnect":
                        return handleReconnect(requestData);
                    case "/match/room":
                        return handleGetRoomInfo(requestData);
                    case "/match/heartbeat":
                return handleHeartbeat(requestData);
            case "/match/disconnect":
                return handlePlayerDisconnect(requestData);
            default:
                return Map.of("success", false, "message", "Unknown endpoint");
        }
            } catch (Exception e) {
                logger.error("Handle request error: {}", uri, e);
                return Map.of("success", false, "message", e.getMessage());
            }
        }
        
        private Map<String, Object> handleJoinQueue(Map<String, Object> requestData) {
            Player player = new Player();
            player.setId(Long.valueOf(requestData.get("playerId").toString()));
            player.setUsername((String) requestData.get("username"));
            player.setNickname((String) requestData.get("nickname"));
            player.setRankId((Integer) requestData.get("rankId"));
            player.setRankPoints((Integer) requestData.get("rankPoints"));
            
            boolean success = matcher.joinRankQueue(player);
            return Map.of("success", success);
        }
        
        private Map<String, Object> handleLeaveQueue(Map<String, Object> requestData) {
            Player player = new Player();
            player.setId(Long.valueOf(requestData.get("playerId").toString()));
            player.setRankId((Integer) requestData.get("rankId"));
            
            boolean success = matcher.leaveRankQueue(player);
            return Map.of("success", success);
        }
        
        private Map<String, Object> handleSendInvite(Map<String, Object> requestData) {
            Long inviterId = Long.valueOf(requestData.get("inviterId").toString());
            Long inviteeId = Long.valueOf(requestData.get("inviteeId").toString());
            
            String inviteId = matcher.sendFriendInvite(inviterId, inviteeId);
            return Map.of("success", inviteId != null, "inviteId", inviteId != null ? inviteId : "");
        }
        
        private Map<String, Object> handleAcceptInvite(Map<String, Object> requestData) {
            String inviteId = (String) requestData.get("inviteId");
            Long inviteeId = Long.valueOf(requestData.get("inviteeId").toString());
            
            boolean success = matcher.acceptFriendInvite(inviteId, inviteeId);
            return Map.of("success", success);
        }
        
        private Map<String, Object> handleReconnect(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            String roomId = matcher.getReconnectRoom(playerId);
            
            if (roomId != null) {
                matcher.extendReconnectTimeout(playerId);
                Map<String, String> roomInfo = matcher.getRoomInfo(roomId);
                return Map.of("success", true, "roomId", roomId, "roomInfo", roomInfo);
            }
            return Map.of("success", false, "message", "No reconnect room found");
        }
        
        private Map<String, Object> handleGetRoomInfo(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Map<String, String> roomInfo = matcher.getRoomInfo(roomId);
            return Map.of("success", !roomInfo.isEmpty(), "roomInfo", roomInfo);
        }
        
        private Map<String, Object> handleHeartbeat(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = requestData.containsKey("playerId") ? 
                Long.valueOf(requestData.get("playerId").toString()) : null;
            
            matcher.heartbeat(roomId, playerId);
            return Map.of("success", true, "timestamp", System.currentTimeMillis());
        }
        
        private Map<String, Object> handlePlayerDisconnect(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            String roomId = matcher.getReconnectRoom(playerId);
            
            if (roomId != null) {
                matcher.extendReconnectTimeout(playerId);
            }
            
            return Map.of("success", true, "canReconnect", roomId != null, "roomId", roomId != null ? roomId : "");
        }
        
        private void sendError(ChannelHandlerContext ctx, HttpResponseStatus status) {
            FullHttpResponse response = new DefaultFullHttpResponse(
                HttpVersion.HTTP_1_1, status);
            ctx.writeAndFlush(response);
        }
        
        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            logger.error("Channel exception", cause);
            ctx.close();
        }
    }
    
    public static void main(String[] args) throws Exception {
        server matchServer = new server();
        matchServer.start();
    }
}