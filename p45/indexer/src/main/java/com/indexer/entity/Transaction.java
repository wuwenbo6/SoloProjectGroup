package com.indexer.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String hash;

    @Column(name = "transaction_index")
    private Integer transactionIndex;

    @Column(name = "from_address")
    private String from;

    @Column(name = "to_address")
    private String to;

    @Column(name = "value")
    private String value;

    @Column(name = "gas_price")
    private String gasPrice;

    @Column(name = "gas")
    private Long gas;

    @Column(name = "input")
    @Column(length = 8192)
    private String input;

    @Column(name = "nonce")
    private Long nonce;

    @Column(name = "block_hash")
    private String blockHash;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "contract_address")
    private String contractAddress;

    @Column(name = "is_private")
    private Boolean isPrivate = false;

    @Column(name = "private_from")
    private String privateFrom;

    @Column(name = "privacy_group_id")
    private String privacyGroupId;

    @Column(name = "status")
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id")
    private Block block;
}