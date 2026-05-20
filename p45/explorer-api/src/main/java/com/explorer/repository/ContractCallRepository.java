package com.explorer.repository;

import com.explorer.entity.ContractCall;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractCallRepository extends JpaRepository<ContractCall, Long> {

    List<ContractCall> findByContractAddressOrderByTimestampDesc(String contractAddress);

    List<ContractCall> findByTransactionHash(String transactionHash);

    @Query("SELECT DISTINCT c.contractAddress FROM ContractCall c")
    List<String> findAllDistinctContractAddresses();
}