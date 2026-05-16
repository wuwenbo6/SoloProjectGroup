package com.cardbattle.match.queue;

import com.cardbattle.data.entity.Player;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public class matcher {
    private static final Logger logger = LoggerFactory.getLogger(matcher.class);
    
    private static final String REDIS_HOST = "localhost";
    private static final int REDIS_PORT = 6379;
    private static final int REDIS_DB = 1;
    
    private static final String MATCH_QUEUE_KEY = "match:queue:";
    private static final String FRIEND_INVITE_KEY = "match:invite:";
    private static final String ROOM_KEY = "match:room:";
    private static final String RECONNECT_KEY = "match:reconnect:";
    
    private static final int RECONNECT_TIMEOUT = 120;
    private static final int ROOM_EXPIRE_SECONDS = 3600;
    
    private JedisPool jedisPool;
    private ObjectMapper objectMapper;
    private List<String> battleNodes;
    private int currentNodeIndex;
    
    public matcher() {
        JedisPoolConfig poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(200);
        this.jedisPool = new JedisPool(poolConfig, REDIS_HOST, REDIS_PORT);
        this.objectMapper = new ObjectMapper();
        this.battleNodes = Arrays.asList("battle-node-1:8081", "battle-node-2:8081", "battle-node-3:8081");
        this.currentNodeIndex = 0;
    }
    
    public boolean joinRankQueue(Player player) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            
            String playerData = objectMapper.writeValueAsString(Map.of(
                "playerId", player.getId(),
                "username", player.getUsername(),
                "nickname", player.getNickname(),
                "rankId", player.getRankId(),
                "rankPoints", player.getRankPoints(),
                "joinTime", System.currentTimeMillis()
            ));
            
            String queueKey = MATCH_QUEUE_KEY + player.getRankId();
            jedis.zadd(queueKey, System.currentTimeMillis(), playerData);
            
            logger.info("Player {} joined rank queue for rank {}", player.getId(), player.getRankId());
            return true;
        } catch (Exception e) {
            logger.error("Failed to join rank queue", e);
            return false;
        }
    }
    
    public boolean leaveRankQueue(Player player) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String queueKey = MATCH_QUEUE_KEY + player.getRankId();
            Set<String> members = jedis.zrange(queueKey, 0, -1);
            
            for (String member : members) {
                try {
                    Map<String, Object> data = objectMapper.readValue(member, Map.class);
                    if (player.getId().equals(data.get("playerId"))) {
                        jedis.zrem(queueKey, member);
                        logger.info("Player {} left rank queue", player.getId());
                        return true;
                    }
                } catch (Exception e) {
                    continue;
                }
            }
            return false;
        }
    }
    
    public String sendFriendInvite(Long inviterId, Long inviteeId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String inviteId = UUID.randomUUID().toString();
            String inviteData = objectMapper.writeValueAsString(Map.of(
                "inviteId", inviteId,
                "inviterId", inviterId,
                "inviteeId", inviteeId,
                "createTime", System.currentTimeMillis(),
                "status", "pending"
            ));
            
            jedis.setex(FRIEND_INVITE_KEY + inviteId, 120, inviteData);
            logger.info("Friend invite sent: {} invites {}", inviterId, inviteeId);
            return inviteId;
        } catch (Exception e) {
            logger.error("Failed to send friend invite", e);
            return null;
        }
    }
    
    public boolean acceptFriendInvite(String inviteId, Long inviteeId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String inviteData = jedis.get(FRIEND_INVITE_KEY + inviteId);
            
            if (inviteData == null) {
                return false;
            }
            
            Map<String, Object> data = objectMapper.readValue(inviteData, Map.class);
            if (!inviteeId.equals(data.get("inviteeId"))) {
                return false;
            }
            
            String battleNode = getNextBattleNode();
            String roomId = createRoom((Long) data.get("inviterId"), inviteeId, battleNode, "friend");
            
            jedis.setex(FRIEND_INVITE_KEY + inviteId, 60, 
                objectMapper.writeValueAsString(Map.of("status", "accepted", "roomId", roomId)));
            
            logger.info("Friend invite accepted, room created: {}", roomId);
            return true;
        } catch (Exception e) {
            logger.error("Failed to accept friend invite", e);
            return false;
        }
    }
    
    public void processMatching() {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            
            for (int rankId = 1; rankId <= 10; rankId++) {
                String queueKey = MATCH_QUEUE_KEY + rankId;
                Set<String> members = jedis.zrange(queueKey, 0, 1);
                
                if (members.size() >= 2) {
                    Iterator<String> iterator = members.iterator();
                    String player1Data = iterator.next();
                    String player2Data = iterator.next();
                    
                    Map<String, Object> player1 = objectMapper.readValue(player1Data, Map.class);
                    Map<String, Object> player2 = objectMapper.readValue(player2Data, Map.class);
                    
                    String battleNode = getNextBattleNode();
                    String roomId = createRoom((Long) player1.get("playerId"), (Long) player2.get("playerId"), battleNode, "rank");
                    
                    jedis.zrem(queueKey, player1Data, player2Data);
                    
                    logger.info("Matched players {} and {} in room {}", player1.get("playerId"), player2.get("playerId"), roomId);
                }
            }
        } catch (Exception e) {
            logger.error("Failed to process matching", e);
        }
    }
    
    private String createRoom(Long player1Id, Long player2Id, String battleNode, String type) {
        String roomId = UUID.randomUUID().toString();
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            
            Map<String, String> roomData = Map.of(
                "roomId", roomId,
                "player1Id", String.valueOf(player1Id),
                "player2Id", String.valueOf(player2Id),
                "battleNode", battleNode,
                "type", type,
                "createTime", String.valueOf(System.currentTimeMillis()),
                "status", "waiting"
            );
            
            jedis.hset(ROOM_KEY + roomId, roomData);
            jedis.expire(ROOM_KEY + roomId, ROOM_EXPIRE_SECONDS);
            
            jedis.setex(RECONNECT_KEY + player1Id, RECONNECT_TIMEOUT, roomId);
            jedis.setex(RECONNECT_KEY + player2Id, RECONNECT_TIMEOUT, roomId);
        }
        return roomId;
    }
    
    public String getReconnectRoom(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            return jedis.get(RECONNECT_KEY + playerId);
        }
    }
    
    public Map<String, String> getRoomInfo(String roomId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            return jedis.hgetAll(ROOM_KEY + roomId);
        }
    }
    
    public void updateRoomStatus(String roomId, String status) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            jedis.hset(ROOM_KEY + roomId, "status", status);
        }
    }
    
    public void extendReconnectTimeout(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String roomId = jedis.get(RECONNECT_KEY + playerId);
            if (roomId != null) {
                jedis.expire(RECONNECT_KEY + playerId, RECONNECT_TIMEOUT);
            }
        }
    }
    
    public void removeReconnectInfo(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            jedis.del(RECONNECT_KEY + playerId);
        }
    }
    
    public void heartbeat(String roomId, Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            
            if (jedis.exists(ROOM_KEY + roomId)) {
                jedis.expire(ROOM_KEY + roomId, ROOM_EXPIRE_SECONDS);
            }
            
            if (playerId != null && jedis.exists(RECONNECT_KEY + playerId)) {
                jedis.expire(RECONNECT_KEY + playerId, RECONNECT_TIMEOUT);
            }
        }
    }
    
    public void updateRoomBattleNode(String roomId, String battleNode) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            jedis.hset(ROOM_KEY + roomId, "battleNode", battleNode);
            jedis.expire(ROOM_KEY + roomId, ROOM_EXPIRE_SECONDS);
        }
    }
    
    public void extendReconnectTimeout(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            if (jedis.exists(RECONNECT_KEY + playerId)) {
                jedis.expire(RECONNECT_KEY + playerId, RECONNECT_TIMEOUT);
            }
        }
    }
    
    private String getNextBattleNode() {
        currentNodeIndex = (currentNodeIndex + 1) % battleNodes.size();
        return battleNodes.get(currentNodeIndex);
    }
    
    public void close() {
        jedisPool.close();
    }
}