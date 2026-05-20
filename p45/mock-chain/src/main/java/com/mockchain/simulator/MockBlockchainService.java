package com.mockchain.simulator;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class MockBlockchainService {

    private final Map<Long, Map<String, Object>> blocks = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> transactions = new ConcurrentHashMap<>();
    private Long currentBlockNumber = 0L;

    @Scheduled(fixedDelayString = "${block.interval:5000}")
    public void generateBlock() {
        Map<String, Object> block = createMockBlock(currentBlockNumber);
        blocks.put(currentBlockNumber, block);

        int txCount = new Random().nextInt(5) + 1;
        for (int i = 0; i < txCount; i++) {
            Map<String, Object> tx = createMockTransaction(currentBlockNumber, i);
            transactions.put((String) tx.get("hash"), tx);
        }

        log.info("Generated block #{} with {} transactions", currentBlockNumber, txCount);
        currentBlockNumber++;
    }

    private Map<String, Object> createMockBlock(Long number) {
        Map<String, Object> block = new HashMap<>();
        block.put("number", number);
        block.put("hash", "0x" + generateRandomHash());
        block.put("parentHash", number > 0 ? "0x" + generateRandomHash() : null);
        block.put("nonce", "0x" + generateRandomHash().substring(0, 16));
        block.put("miner", "0x" + generateRandomHash().substring(0, 40));
        block.put("timestamp", LocalDateTime.now().toString());
        block.put("gasLimit", 15000000L);
        block.put("gasUsed", 8000000L + new Random().nextInt(4000000));
        block.put("size", 1000L + new Random().nextInt(5000));
        return block;
    }

    private Map<String, Object> createMockTransaction(Long blockNumber, int index) {
        Map<String, Object> tx = new HashMap<>();
        tx.put("hash", "0x" + generateRandomHash());
        tx.put("blockNumber", blockNumber);
        tx.put("transactionIndex", index);
        tx.put("from", "0x" + generateRandomHash().substring(0, 40));
        tx.put("to", "0x" + generateRandomHash().substring(0, 40));
        tx.put("value", String.valueOf(new Random().nextInt(1000000)));
        tx.put("gasPrice", "20000000000");
        tx.put("gas", 21000L + new Random().nextInt(100000));
        tx.put("input", "0x" + generateRandomHash().substring(0, 64));
        tx.put("status", "success");
        tx.put("timestamp", LocalDateTime.now().toString());

        boolean isPrivate = new Random().nextInt(10) < 3;
        tx.put("isPrivate", isPrivate);
        if (isPrivate) {
            tx.put("privateFrom", "Org" + (new Random().nextInt(3) + 1));
            tx.put("privacyGroupId", "privacyGroup" + (new Random().nextInt(3) + 1));
            tx.put("privateFor", Arrays.asList("Org1", "Org2"));
        }

        return tx;
    }

    private String generateRandomHash() {
        byte[] randomBytes = new byte[32];
        new Random().nextBytes(randomBytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : randomBytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public Long getLatestBlockNumber() {
        return currentBlockNumber > 0 ? currentBlockNumber - 1 : 0L;
    }

    public Map<String, Object> getBlockByNumber(Long number) {
        return blocks.get(number);
    }

    public Map<String, Object> getTransactionByHash(String hash) {
        return transactions.get(hash);
    }

    public List<Map<String, Object>> getLatestBlocks(int count) {
        List<Map<String, Object>> result = new ArrayList<>();
        long start = Math.max(0, currentBlockNumber - count);
        for (long i = currentBlockNumber - 1; i >= start && i >= 0; i--) {
            result.add(blocks.get(i));
        }
        return result;
    }
}