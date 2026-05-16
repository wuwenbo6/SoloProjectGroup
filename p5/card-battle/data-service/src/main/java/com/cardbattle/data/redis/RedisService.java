package com.cardbattle.data.redis;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;

public class RedisService {
    private static final String REDIS_HOST = "localhost";
    private static final int REDIS_PORT = 6379;
    private static final int REDIS_DB = 0;
    
    private static final String PLAYER_ONLINE_KEY = "player:online:";
    private static final String PLAYER_ROOM_KEY = "player:room:";
    private static final String PLAYER_STATUS_KEY = "player:status:";
    
    private JedisPool jedisPool;
    private ObjectMapper objectMapper;
    
    public RedisService() {
        JedisPoolConfig poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(200);
        poolConfig.setMaxIdle(50);
        poolConfig.setMinIdle(10);
        this.jedisPool = new JedisPool(poolConfig, REDIS_HOST, REDIS_PORT);
        this.objectMapper = new ObjectMapper();
    }
    
    public void setPlayerOnline(Long playerId, boolean online) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String key = PLAYER_ONLINE_KEY + playerId;
            if (online) {
                jedis.setex(key, 300, "1");
            } else {
                jedis.del(key);
            }
        }
    }
    
    public boolean isPlayerOnline(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            return jedis.exists(PLAYER_ONLINE_KEY + playerId);
        }
    }
    
    public void setPlayerRoom(Long playerId, String roomId, String battleNode) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            String key = PLAYER_ROOM_KEY + playerId;
            Map<String, String> roomInfo = Map.of(
                "roomId", roomId,
                "battleNode", battleNode,
                "timestamp", String.valueOf(System.currentTimeMillis())
            );
            jedis.hset(key, roomInfo);
            jedis.expire(key, 180);
        }
    }
    
    public Map<String, String> getPlayerRoom(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            return jedis.hgetAll(PLAYER_ROOM_KEY + playerId);
        }
    }
    
    public void removePlayerRoom(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            jedis.del(PLAYER_ROOM_KEY + playerId);
        }
    }
    
    public void setPlayerStatus(Long playerId, String status) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            jedis.setex(PLAYER_STATUS_KEY + playerId, 600, status);
        }
    }
    
    public String getPlayerStatus(Long playerId) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.select(REDIS_DB);
            return jedis.get(PLAYER_STATUS_KEY + playerId);
        }
    }
    
    public void close() {
        jedisPool.close();
    }
}