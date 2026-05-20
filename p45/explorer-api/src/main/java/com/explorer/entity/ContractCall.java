package com.explorer.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "contract_calls")
public class ContractCall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_hash", nullable = false)
    private String transactionHash;

    @Column(name = "contract_address", nullable = false)
    private String contractAddress;

    @Column(name = "method_name")
    private String methodName;

    @Column(name = "method_signature")
    private String methodSignature;

    @Column(name = "caller_address")
    private String callerAddress;

    @Column(name = "params")
    @Column(length = 4096)
    private String params;

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "block_number")
    private Long blockNumber;
}