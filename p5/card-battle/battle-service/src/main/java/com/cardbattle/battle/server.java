package com.cardbattle.battle;

import com.cardbattle.battle.handler.CardHandler;
import com.cardbattle.battle.handler.TurnHandler;
import com.cardbattle.battle.model.BattleRoom;
import com.cardbattle.data.entity.BattleRecord;
import com.cardbattle.data.server;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class server {
    private static final Logger logger = LoggerFactory.getLogger(server.class);
    private static final int PORT = 8081;
    
    private ConcurrentHashMap<String, BattleRoom> rooms;
    private CardHandler cardHandler;
    private TurnHandler turnHandler;
    private ObjectMapper objectMapper;
    private ScheduledExecutorService battleExecutor;
    private server dataServer;
    
    public server() {
        this.rooms = new ConcurrentHashMap<>();
        this.cardHandler = new CardHandler();
        this.turnHandler = new TurnHandler();
        this.objectMapper = new ObjectMapper();
        this.battleExecutor = Executors.newScheduledThreadPool(2);
        this.dataServer = new server();
    }
    
    public void start() throws Exception {
        startBattleChecker();
        
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
                     p.addLast(new BattleServerHandler());
                 }
             });
            
            ChannelFuture f = b.bind(PORT).sync();
            logger.info("Battle Service started on port {}", PORT);
            
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                battleExecutor.shutdown();
                bossGroup.shutdownGracefully();
                workerGroup.shutdownGracefully();
                logger.info("Battle Service stopped");
            }));
            
            f.channel().closeFuture().sync();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
    
    private void startBattleChecker() {
        battleExecutor.scheduleAtFixedRate(() -> {
            for (BattleRoom room : rooms.values()) {
                if ("PLAYING".equals(room.getStatus())) {
                    turnHandler.checkTurnTimeout(room);
                    room.checkDisconnectTimeout();
                    if (room.checkBattleEnd() || room.isBothPlayersDisconnected()) {
                        onBattleEnd(room);
                    }
                }
            }
            
            List<String> roomsToRemove = new ArrayList<>();
            for (Map.Entry<String, BattleRoom> entry : rooms.entrySet()) {
                BattleRoom room = entry.getValue();
                if ("ENDED".equals(room.getStatus()) && 
                    (room.getEndTime() == null || 
                     System.currentTimeMillis() - room.getEndTime().getTime() > 10 * 60 * 1000)) {
                    roomsToRemove.add(entry.getKey());
                }
            }
            for (String roomId : roomsToRemove) {
                rooms.remove(roomId);
            }
        }, 0, 1, TimeUnit.SECONDS);
    }
    
    private void onBattleEnd(BattleRoom room) {
        logger.info("Battle ended in room {}. Winner: {}", room.getRoomId(), room.getWinnerId());
        
        Long loserId = room.getPlayer1Id().equals(room.getWinnerId()) ? 
            room.getPlayer2Id() : room.getPlayer1Id();
        
        dataServer.updatePlayerAfterBattle(room.getWinnerId(), loserId, 25, 10);
        
        dataServer.getSeasonService().updatePlayerRecordAfterBattle(room.getWinnerId(), true);
        dataServer.getSeasonService().updatePlayerRecordAfterBattle(loserId, false);
        
        BattleRecord record = new BattleRecord();
        record.setBattleId(room.getRoomId());
        record.setPlayer1Id(room.getPlayer1Id());
        record.setPlayer2Id(room.getPlayer2Id());
        record.setWinnerId(room.getWinnerId());
        record.setDuration(room.getDurationSeconds());
        record.setTurnCount(room.getTurnNumber());
        record.setStartTime(room.getStartTime());
        record.setEndTime(room.getEndTime());
        record.setStatus(1);
        
        dataServer.saveBattleRecord(record);
        dataServer.getReplayService().saveBattleReplay(record, room.getFullReplayState());
        
        logger.info("Battle replay saved for room: {}", room.getRoomId());
    }
    
    public BattleRoom createRoom(String roomId, Long player1Id, Long player2Id) {
        BattleRoom room = new BattleRoom(roomId, player1Id, player2Id);
        rooms.put(roomId, room);
        logger.info("Created battle room {} for players {} and {}", roomId, player1Id, player2Id);
        return room;
    }
    
    public BattleRoom getRoom(String roomId) {
        return rooms.get(roomId);
    }
    
    private class BattleServerHandler extends SimpleChannelInboundHandler<FullHttpRequest> {
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
                    case "/battle/create":
                        return handleCreateRoom(requestData);
                    case "/battle/play":
                        return handlePlayCard(requestData);
                    case "/battle/attack":
                        return handleAttack(requestData);
                    case "/battle/endturn":
                        return handleEndTurn(requestData);
                    case "/battle/state":
                        return handleGetState(requestData);
                    case "/battle/replay":
                        return handleGetReplay(requestData);
                    case "/battle/disconnect":
                        return handlePlayerDisconnect(requestData);
                    case "/battle/reconnect":
                        return handlePlayerReconnect(requestData);
                    case "/battle/heartbeat":
                        return handleBattleHeartbeat(requestData);
                    default:
                        return Map.of("success", false, "message", "Unknown endpoint");
                }
            } catch (Exception e) {
                logger.error("Handle request error: {}", uri, e);
                return Map.of("success", false, "message", e.getMessage());
            }
        }
        
        private Map<String, Object> handleCreateRoom(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long player1Id = Long.valueOf(requestData.get("player1Id").toString());
            Long player2Id = Long.valueOf(requestData.get("player2Id").toString());
            
            BattleRoom room = createRoom(roomId, player1Id, player2Id);
            return Map.of("success", true, "roomId", room.getRoomId());
        }
        
        private Map<String, Object> handlePlayCard(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            Long cardInstanceId = Long.valueOf(requestData.get("cardInstanceId").toString());
            Long targetId = Long.valueOf(requestData.get("targetId").toString());
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            if (!room.isPlayerTurn(playerId)) {
                return Map.of("success", false, "message", "Not your turn");
            }
            
            CardHandler.CardPlayResult result = cardHandler.playCard(room, playerId, cardInstanceId, targetId);
            
            room.checkBattleEnd();
            return Map.of("success", result.isSuccess(), "message", result.getMessage() != null ? result.getMessage() : "");
        }
        
        private Map<String, Object> handleAttack(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            Long targetId = Long.valueOf(requestData.get("targetId").toString());
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            if (!room.isPlayerTurn(playerId)) {
                return Map.of("success", false, "message", "Not your turn");
            }
            
            boolean success = cardHandler.attackTarget(room, playerId, targetId);
            room.checkBattleEnd();
            
            return Map.of("success", success);
        }
        
        private Map<String, Object> handleEndTurn(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            boolean success = turnHandler.endTurn(room, playerId);
            return Map.of("success", success);
        }
        
        private Map<String, Object> handleGetState(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            return Map.of(
                "success", true,
                "turnNumber", room.getTurnNumber(),
                "currentTurnPlayerId", room.getCurrentTurnPlayerId(),
                "remainingTime", room.getRemainingTurnTime(),
                "status", room.getStatus(),
                "winnerId", room.getWinnerId() != null ? room.getWinnerId() : "",
                "player1Health", room.getPlayer1State().getHealth(),
                "player2Health", room.getPlayer2State().getHealth(),
                "player1Mana", room.getPlayer1State().getMana(),
                "player2Mana", room.getPlayer2State().getMana()
            );
        }
        
        private Map<String, Object> handleGetReplay(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            return Map.of(
                "success", true,
                "battleLog", room.getBattleLog(),
                "turnCount", room.getTurnNumber(),
                "winnerId", room.getWinnerId() != null ? room.getWinnerId() : ""
            );
        }
        
        private Map<String, Object> handlePlayerDisconnect(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            room.setPlayerDisconnected(playerId);
            logger.info("Player {} disconnected from room {}", playerId, roomId);
            
            return Map.of(
                "success", true,
                "canReconnect", true,
                "reconnectTimeoutSeconds", 60
            );
        }
        
        private Map<String, Object> handlePlayerReconnect(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            if (room.isPlayerReconnectTimeout(playerId)) {
                return Map.of("success", false, "message", "Reconnect timeout");
            }
            
            room.setPlayerReconnected(playerId);
            logger.info("Player {} reconnected to room {}", playerId, roomId);
            
            return Map.of(
                "success", true,
                "roomId", roomId,
                "playerState", Map.of(
                    "health", room.getPlayerState(playerId).getHealth(),
                    "mana", room.getPlayerState(playerId).getMana(),
                    "handSize", room.getPlayerState(playerId).getHand().size()
                ),
                "turnNumber", room.getTurnNumber(),
                "currentTurnPlayerId", room.getCurrentTurnPlayerId()
            );
        }
        
        private Map<String, Object> handleBattleHeartbeat(Map<String, Object> requestData) {
            String roomId = (String) requestData.get("roomId");
            Long playerId = requestData.containsKey("playerId") ? 
                Long.valueOf(requestData.get("playerId").toString()) : null;
            
            BattleRoom room = getRoom(roomId);
            if (room == null) {
                return Map.of("success", false, "message", "Room not found");
            }
            
            if (playerId != null && !room.isPlayerConnected(playerId)) {
                room.setPlayerReconnected(playerId);
                logger.info("Player {} reconnected via heartbeat to room {}", playerId, roomId);
            }
            
            return Map.of(
                "success", true,
                "timestamp", System.currentTimeMillis(),
                "roomStatus", room.getStatus(),
                "player1Connected", room.isPlayer1Connected(),
                "player2Connected", room.isPlayer2Connected()
            );
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
        server battleServer = new server();
        battleServer.start();
    }
}