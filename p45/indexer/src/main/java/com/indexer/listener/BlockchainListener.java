package com.indexer.listener;

import com.indexer.entity.Block;
import com.indexer.entity.Transaction;
import com.indexer.repository.BlockRepository;
import com.indexer.repository.TransactionRepository;
import com.indexer.service.OffsetService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlockchainListener {

    private final BlockRepository blockRepository;
    private final TransactionRepository transactionRepository;
    private final OffsetService offsetService;
    private final RestTemplate restTemplate = new RestTemplate();

    private Long lastIndexedBlock;

    @PostConstruct
    public void init() {
        lastIndexedBlock = offsetService.getLastProcessedBlock();
        log.info("Initialized last indexed block from Redis: {}", lastIndexedBlock);
    }

    @Scheduled(fixedDelayString = "${indexer.poll-interval:3000}")
    public void pollForNewBlocks() {
        try {
            Long latestBlock = getLatestBlockNumber();
            if (latestBlock > lastIndexedBlock) {
                for (long i = lastIndexedBlock + 1; i <= latestBlock; i++) {
                    indexBlock(i);
                }
                lastIndexedBlock = latestBlock;
                offsetService.updateLastProcessedBlock(latestBlock);
                log.info("Indexed blocks up to: {} (persisted to Redis)", latestBlock);
            }
        } catch (Exception e) {
            log.error("Error polling for new blocks: {}", e.getMessage());
        }
    }

    private Long getLatestBlockNumber() {
        try {
            String url = "http://localhost:8082/api/blocks/latest";
            Long result = restTemplate.getForObject(url, Long.class);
            return result != null ? result : 0L;
        } catch (Exception e) {
            log.warn("Could not connect to mock chain, generating mock data");
            return generateMockBlockNumber();
        }
    }

    private Long generateMockBlockNumber() {
        Long mockBlockNumber = offsetService.getMockBlockNumber();
        if (Math.random() > 0.3) {
            mockBlockNumber++;
            offsetService.updateMockBlockNumber(mockBlockNumber);
            log.debug("Updated mock block number to: {} (persisted to Redis)", mockBlockNumber);
        }
        return mockBlockNumber;
    }

    private void indexBlock(Long blockNumber) {
        if (blockRepository.findByNumber(blockNumber).isPresent()) {
            return;
        }

        Block block = createMockBlock(blockNumber);
        block = blockRepository.save(block);

        List<Transaction> transactions = createMockTransactions(block);
        for (Transaction tx : transactions) {
            if (transactionRepository.findByHash(tx.getHash()).isEmpty()) {
                transactionRepository.save(tx);
            }
        }

        log.info("Indexed block {} with {} transactions", blockNumber, transactions.size());
    }

    private Block createMockBlock(Long blockNumber) {
        Block block = new Block();
        block.setNumber(blockNumber);
        block.setHash("0x" + generateRandomHash());
        block.setParentHash(blockNumber > 0 ? "0x" + generateRandomHash() : null);
        block.setNonce("0x" + generateRandomHash().substring(0, 16));
        block.setSha3Uncles("0x" + generateRandomHash());
        block.setTransactionsRoot("0x" + generateRandomHash());
        block.setStateRoot("0x" + generateRandomHash());
        block.setReceiptsRoot("0x" + generateRandomHash());
        block.setMiner("0x" + generateRandomHash().substring(0, 40));
        block.setDifficulty("1000000");
        block.setTotalDifficulty(String.valueOf(blockNumber * 1000000));
        block.setExtraData("0x" + generateRandomHash().substring(0, 32));
        block.setSize(1000L + new Random().nextInt(5000));
        block.setGasLimit(15000000L);
        block.setGasUsed(8000000L + new Random().nextInt(4000000));
        block.setTimestamp(LocalDateTime.now());
        block.setTransactionCount(new Random().nextInt(10) + 1);
        return block;
    }

    private List<Transaction> createMockTransactions(Block block) {
        List<Transaction> transactions = new ArrayList<>();
        int txCount = block.getTransactionCount();

        for (int i = 0; i < txCount; i++) {
            Transaction tx = new Transaction();
            tx.setHash("0x" + generateRandomHash());
            tx.setTransactionIndex(i);
            tx.setFrom("0x" + generateRandomHash().substring(0, 40));
            tx.setTo("0x" + generateRandomHash().substring(0, 40));
            tx.setValue(String.valueOf(new Random().nextInt(1000000)));
            tx.setGasPrice("20000000000");
            tx.setGas(21000L + new Random().nextInt(100000));
            tx.setInput("0x" + generateRandomHash().substring(0, 64));
            tx.setNonce((long) new Random().nextInt(100));
            tx.setBlockHash(block.getHash());
            tx.setBlockNumber(block.getNumber());
            tx.setTimestamp(block.getTimestamp());
            tx.setStatus("success");
            tx.setBlock(block);

            boolean isPrivate = new Random().nextInt(10) < 3;
            tx.setIsPrivate(isPrivate);
            if (isPrivate) {
                tx.setPrivateFrom("0x" + generateRandomHash().substring(0, 40));
                tx.setPrivacyGroupId("privacyGroup" + (new Random().nextInt(3) + 1));
            }

            transactions.add(tx);
        }

        return transactions;
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
}