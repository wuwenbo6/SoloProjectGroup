package com.explorer.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "private_transaction_participants")
public class PrivateTransactionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_hash", nullable = false)
    private String transactionHash;

    @Column(name = "participant_address", nullable = false)
    private String participantAddress;

    @Column(name = "org_name")
    private String orgName;

    @Column(name = "public_key")
    @Column(length = 1024)
    private String publicKey;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;
}