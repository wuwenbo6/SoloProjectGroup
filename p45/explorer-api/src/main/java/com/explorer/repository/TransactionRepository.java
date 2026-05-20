package com.explorer.repository;

import com.explorer.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    Optional<Transaction> findByHash(String hash);

    Page<Transaction> findAllByOrderByBlockNumberDesc(Pageable pageable);

    Page<Transaction> findByBlockNumberOrderByTransactionIndexAsc(Long blockNumber, Pageable pageable);

    Page<Transaction> findByIsPrivateTrueOrderByBlockNumberDesc(Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.from = ?1 OR t.to = ?1 ORDER BY t.blockNumber DESC")
    Page<Transaction> findByAddress(String address, Pageable pageable);

    List<Transaction> findByPrivacyGroupId(String privacyGroupId);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.isPrivate = true")
    Long countPrivateTransactions();
}