package com.indexer.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "blocks")
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String hash;

    @Column(nullable = false)
    private Long number;

    @Column(name = "parent_hash")
    private String parentHash;

    @Column(name = "nonce")
    private String nonce;

    @Column(name = "sha3_uncles")
    private String sha3Uncles;

    @Column(name = "logs_bloom")
    @Column(length = 2048)
    private String logsBloom;

    @Column(name = "transactions_root")
    private String transactionsRoot;

    @Column(name = "state_root")
    private String stateRoot;

    @Column(name = "receipts_root")
    private String receiptsRoot;

    @Column(name = "miner")
    private String miner;

    @Column(name = "difficulty")
    private String difficulty;

    @Column(name = "total_difficulty")
    private String totalDifficulty;

    @Column(name = "extra_data")
    @Column(length = 1024)
    private String extraData;

    @Column(name = "size")
    private Long size;

    @Column(name = "gas_limit")
    private Long gasLimit;

    @Column(name = "gas_used")
    private Long gasUsed;

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "transaction_count")
    private Integer transactionCount;

    @OneToMany(mappedBy = "block", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Transaction> transactions = new ArrayList<>();
}