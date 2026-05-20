package com.explorer.repository;

import com.explorer.entity.PrivateTransactionParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PrivateTransactionParticipantRepository extends JpaRepository<PrivateTransactionParticipant, Long> {

    List<PrivateTransactionParticipant> findByTransactionHash(String transactionHash);

    List<PrivateTransactionParticipant> findByOrgName(String orgName);
}