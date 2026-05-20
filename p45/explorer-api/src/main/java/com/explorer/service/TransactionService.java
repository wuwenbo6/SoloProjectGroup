package com.explorer.service;

import com.explorer.entity.Transaction;
import com.explorer.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;

    public Page<Transaction> getTransactions(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return transactionRepository.findAllByOrderByBlockNumberDesc(pageable);
    }

    public Page<Transaction> getPrivateTransactions(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return transactionRepository.findByIsPrivateTrueOrderByBlockNumberDesc(pageable);
    }

    public Optional<Transaction> getTransactionByHash(String hash) {
        return transactionRepository.findByHash(hash);
    }

    public Page<Transaction> getTransactionsByBlockNumber(Long blockNumber, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return transactionRepository.findByBlockNumberOrderByTransactionIndexAsc(blockNumber, pageable);
    }

    public Page<Transaction> getTransactionsByAddress(String address, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return transactionRepository.findByAddress(address, pageable);
    }

    public List<Transaction> getTransactionsByPrivacyGroupId(String privacyGroupId) {
        return transactionRepository.findByPrivacyGroupId(privacyGroupId);
    }

    public Long getPrivateTransactionCount() {
        return transactionRepository.countPrivateTransactions();
    }

    public Transaction saveTransaction(Transaction transaction) {
        return transactionRepository.save(transaction);
    }
}