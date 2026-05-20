package com.indexer.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
public class OffsetService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${indexer.redis.last-processed-block-key:indexer:last_processed_block}")
    private String lastProcessedBlockKey;

    @Value("${indexer.redis.mock-block-number-key:indexer:mock_block_number}")
    private String mockBlockNumberKey;

    @Value("${indexer.start-block:0}")
    private Long startBlock;

    private final ConcurrentHashMap<String, AtomicLong> inMemoryStore = new ConcurrentHashMap<>();
    private volatile boolean redisAvailable = true;

    public OffsetService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @PostConstruct
    public void init() {
        try {
            redisTemplate.opsForValue().get("health-check");
            log.info("Redis connection established successfully");
        } catch (Exception e) {
            log.warn("Redis not available, falling back to in-memory storage: {}", e.getMessage());
            redisAvailable = false;
            inMemoryStore.put(lastProcessedBlockKey, new AtomicLong(startBlock - 1));
            inMemoryStore.put(mockBlockNumberKey, new AtomicLong(0));
        }
    }

    public Long getLastProcessedBlock() {
        if (redisAvailable) {
            try {
                Object value = redisTemplate.opsForValue().get(lastProcessedBlockKey);
                if (value != null) {
                    return Long.parseLong(value.toString());
                }
            } catch (Exception e) {
                log.warn("Redis unavailable, falling back to in-memory storage: {}", e.getMessage());
                redisAvailable = false;
                inMemoryStore.putIfAbsent(lastProcessedBlockKey, new AtomicLong(startBlock - 1));
            }
        }
        return inMemoryStore.getOrDefault(lastProcessedBlockKey, new AtomicLong(startBlock - 1)).get();
    }

    public void updateLastProcessedBlock(Long blockNumber) {
        if (redisAvailable) {
            try {
                redisTemplate.opsForValue().set(lastProcessedBlockKey, blockNumber);
                log.debug("Updated last processed block to: {} (persisted to Redis)", blockNumber);
                return;
            } catch (Exception e) {
                log.warn("Failed to update to Redis, using in-memory fallback: {}", e.getMessage());
                redisAvailable = false;
                inMemoryStore.putIfAbsent(lastProcessedBlockKey, new AtomicLong(startBlock - 1));
            }
        }
        inMemoryStore.get(lastProcessedBlockKey).set(blockNumber);
        log.debug("Updated last processed block to: {} (in-memory)", blockNumber);
    }

    public Long getMockBlockNumber() {
        if (redisAvailable) {
            try {
                Object value = redisTemplate.opsForValue().get(mockBlockNumberKey);
                if (value != null) {
                    return Long.parseLong(value.toString());
                }
            } catch (Exception e) {
                log.warn("Redis unavailable, falling back to in-memory storage: {}", e.getMessage());
                redisAvailable = false;
                inMemoryStore.putIfAbsent(mockBlockNumberKey, new AtomicLong(0));
            }
        }
        return inMemoryStore.getOrDefault(mockBlockNumberKey, new AtomicLong(0)).get();
    }

    public void updateMockBlockNumber(Long blockNumber) {
        if (redisAvailable) {
            try {
                redisTemplate.opsForValue().set(mockBlockNumberKey, blockNumber);
                log.debug("Updated mock block number to: {} (persisted to Redis)", blockNumber);
                return;
            } catch (Exception e) {
                log.warn("Failed to update to Redis, using in-memory fallback: {}", e.getMessage());
                redisAvailable = false;
                inMemoryStore.putIfAbsent(mockBlockNumberKey, new AtomicLong(0));
            }
        }
        inMemoryStore.get(mockBlockNumberKey).set(blockNumber);
        log.debug("Updated mock block number to: {} (in-memory)", blockNumber);
    }

    public void resetOffset() {
        if (redisAvailable) {
            try {
                redisTemplate.delete(lastProcessedBlockKey);
                redisTemplate.delete(mockBlockNumberKey);
                log.info("Reset all offsets in Redis");
                return;
            } catch (Exception e) {
                log.warn("Failed to reset Redis, resetting in-memory instead: {}", e.getMessage());
                redisAvailable = false;
            }
        }
        inMemoryStore.put(lastProcessedBlockKey, new AtomicLong(startBlock - 1));
        inMemoryStore.put(mockBlockNumberKey, new AtomicLong(0));
        log.info("Reset all offsets in memory");
    }

    public boolean isRedisAvailable() {
        return redisAvailable;
    }
}