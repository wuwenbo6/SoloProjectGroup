package com.cardbattle.data;

import com.cardbattle.data.dao.*;
import com.cardbattle.data.entity.BattleRecord;
import com.cardbattle.data.entity.Player;
import com.cardbattle.data.entity.Season;
import com.cardbattle.data.redis.RedisService;
import com.cardbattle.data.service.SeasonService;
import com.cardbattle.data.service.ReplayService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.*;
import org.apache.ibatis.datasource.pooled.PooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.TransactionFactory;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

public class server {
    private static final Logger logger = LoggerFactory.getLogger(server.class);
    private static final int PORT = 8082;
    
    private static final String DB_URL = "jdbc:mysql://localhost:3306/card_battle?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "password";
    
    private SqlSessionFactory sqlSessionFactory;
    private RedisService redisService;
    private SeasonService seasonService;
    private ReplayService replayService;
    private ObjectMapper objectMapper;
    
    public server() {
        this.objectMapper = new ObjectMapper();
        initDatabase();
        initRedis();
        initServices();
    }
    
    private void initDatabase() {
        DataSource dataSource = new PooledDataSource(
            "com.mysql.cj.jdbc.Driver",
            DB_URL,
            DB_USER,
            DB_PASSWORD
        );
        
        TransactionFactory transactionFactory = new JdbcTransactionFactory();
        Environment environment = new Environment("development", transactionFactory, dataSource);
        Configuration configuration = new Configuration(environment);
        
        configuration.addMapper(PlayerDao.class);
        configuration.addMapper(CardDao.class);
        configuration.addMapper(BattleDao.class);
        configuration.addMapper(RankDao.class);
        configuration.addMapper(SeasonDao.class);
        configuration.addMapper(SeasonRewardDao.class);
        configuration.addMapper(PlayerSeasonRecordDao.class);
        
        sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        logger.info("Database initialized successfully");
    }
    
    private void initRedis() {
        redisService = new RedisService();
        logger.info("Redis initialized successfully");
    }
    
    private void initServices() {
        seasonService = new SeasonService(sqlSessionFactory);
        replayService = new ReplayService(sqlSessionFactory);
        logger.info("Data Services initialized successfully");
    }
    
    public SeasonService getSeasonService() {
        return seasonService;
    }
    
    public ReplayService getReplayService() {
        return replayService;
    }
    
    public Player getPlayerById(Long playerId) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            PlayerDao dao = session.getMapper(PlayerDao.class);
            return dao.findById(playerId);
        }
    }
    
    public Player getPlayerByUsername(String username) {
        try (SqlSession session = sqlSessionFactory.openSession()) {
            PlayerDao dao = session.getMapper(PlayerDao.class);
            return dao.findByUsername(username);
        }
    }
    
    public boolean updatePlayerAfterBattle(Long winnerId, Long loserId, int winnerPoints, int loserPoints) {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            PlayerDao dao = session.getMapper(PlayerDao.class);
            dao.addWin(winnerId);
            dao.addRankPoints(winnerId, winnerPoints);
            dao.addLoss(loserId);
            dao.addRankPoints(loserId, loserPoints);
            return true;
        } catch (Exception e) {
            logger.error("Failed to update player after battle", e);
            return false;
        }
    }
    
    public boolean saveBattleRecord(BattleRecord record) {
        try (SqlSession session = sqlSessionFactory.openSession(true)) {
            BattleDao dao = session.getMapper(BattleDao.class);
            if (record.getId() == null) {
                dao.insert(record);
            } else {
                dao.update(record);
            }
            return true;
        } catch (Exception e) {
            logger.error("Failed to save battle record", e);
            return false;
        }
    }
    
    public RedisService getRedisService() {
        return redisService;
    }
    
    public SqlSessionFactory getSqlSessionFactory() {
        return sqlSessionFactory;
    }
    
    public void start() throws Exception {
        startHttpServer();
        logger.info("Data Service started successfully on port {}", PORT);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (redisService != null) {
                redisService.close();
            }
            logger.info("Data Service stopped");
        }));
    }
    
    private void startHttpServer() throws Exception {
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        
        ServerBootstrap b = new ServerBootstrap();
        b.group(bossGroup, workerGroup)
         .channel(NioServerSocketChannel.class)
         .childHandler(new ChannelInitializer<SocketChannel>() {
             @Override
             public void initChannel(SocketChannel ch) {
                 ChannelPipeline p = ch.pipeline();
                 p.addLast(new HttpServerCodec());
                 p.addLast(new HttpObjectAggregator(65536));
                 p.addLast(new DataServerHandler());
             }
         });
        
        b.bind(PORT).sync();
    }
    
    private class DataServerHandler extends SimpleChannelInboundHandler<FullHttpRequest> {
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
                    case "/season/current":
                        return handleGetCurrentSeason();
                    case "/season/settle":
                        return handleSettleSeason(requestData);
                    case "/season/stats":
                        return handleGetPlayerSeasonStats(requestData);
                    case "/season/rewards":
                        return handleGetSeasonRewards(requestData);
                    case "/season/claim":
                        return handleClaimSeasonRewards(requestData);
                    case "/replay/get":
                        return handleGetReplay(requestData);
                    case "/replay/history":
                        return handleGetPlayerHistory(requestData);
                    case "/player/info":
                        return handleGetPlayerInfo(requestData);
                    default:
                        return Map.of("success", false, "message", "Unknown endpoint");
                }
            } catch (Exception e) {
                logger.error("Handle request error: {}", uri, e);
                return Map.of("success", false, "message", e.getMessage());
            }
        }
        
        private Map<String, Object> handleGetCurrentSeason() {
            Season season = seasonService.getCurrentSeason();
            if (season != null) {
                return Map.of(
                    "success", true,
                    "season", Map.of(
                        "id", season.getId(),
                        "name", season.getName(),
                        "description", season.getDescription(),
                        "startTime", season.getStartTime(),
                        "endTime", season.getEndTime(),
                        "status", season.getStatus()
                    )
                );
            }
            return Map.of("success", false, "message", "No active season found");
        }
        
        private Map<String, Object> handleSettleSeason(Map<String, Object> requestData) {
            Integer seasonId = Integer.valueOf(requestData.get("seasonId").toString());
            return seasonService.settleSeason(seasonId);
        }
        
        private Map<String, Object> handleGetPlayerSeasonStats(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            Integer seasonId = requestData.containsKey("seasonId") ? 
                Integer.valueOf(requestData.get("seasonId").toString()) : null;
            
            if (seasonId == null) {
                Season current = seasonService.getCurrentSeason();
                if (current != null) {
                    seasonId = current.getId();
                } else {
                    seasonId = 1;
                }
            }
            
            Map<String, Object> stats = seasonService.getPlayerSeasonStats(playerId, seasonId);
            return Map.of("success", true, "stats", stats);
        }
        
        private Map<String, Object> handleGetSeasonRewards(Map<String, Object> requestData) {
            Integer seasonId = requestData.containsKey("seasonId") ? 
                Integer.valueOf(requestData.get("seasonId").toString()) : null;
            
            if (seasonId == null) {
                Season current = seasonService.getCurrentSeason();
                if (current != null) {
                    seasonId = current.getId();
                } else {
                    seasonId = 1;
                }
            }
            
            List<?> rewards = seasonService.getSeasonRewards(seasonId);
            return Map.of("success", true, "rewards", rewards);
        }
        
        private Map<String, Object> handleClaimSeasonRewards(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            Integer seasonId = Integer.valueOf(requestData.get("seasonId").toString());
            return seasonService.claimSeasonRewards(playerId, seasonId);
        }
        
        private Map<String, Object> handleGetReplay(Map<String, Object> requestData) {
            String battleId = (String) requestData.get("battleId");
            Map<String, Object> replay = replayService.getBattleReplay(battleId);
            if (replay != null) {
                return Map.of("success", true, "replay", replay);
            }
            return Map.of("success", false, "message", "Replay not found");
        }
        
        private Map<String, Object> handleGetPlayerHistory(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            int limit = requestData.containsKey("limit") ? 
                Integer.parseInt(requestData.get("limit").toString()) : 20;
            int offset = requestData.containsKey("offset") ? 
                Integer.parseInt(requestData.get("offset").toString()) : 0;
            
            List<Map<String, Object>> history = replayService.getPlayerBattleHistory(playerId, limit, offset);
            int total = replayService.getPlayerBattleCount(playerId);
            
            return Map.of(
                "success", true, 
                "history", history,
                "total", total
            );
        }
        
        private Map<String, Object> handleGetPlayerInfo(Map<String, Object> requestData) {
            Long playerId = Long.valueOf(requestData.get("playerId").toString());
            Player player = getPlayerById(playerId);
            if (player != null) {
                return Map.of(
                    "success", true,
                    "player", Map.of(
                        "id", player.getId(),
                        "username", player.getUsername(),
                        "nickname", player.getNickname(),
                        "level", player.getLevel(),
                        "exp", player.getExp(),
                        "rankId", player.getRankId(),
                        "rankPoints", player.getRankPoints(),
                        "wins", player.getWins(),
                        "losses", player.getLosses(),
                        "rankTitle", player.getRankTitle() != null ? player.getRankTitle() : ""
                    )
                );
            }
            return Map.of("success", false, "message", "Player not found");
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
        server dataServer = new server();
        dataServer.start();
    }
}