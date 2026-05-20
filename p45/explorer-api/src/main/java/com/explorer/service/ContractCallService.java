package com.explorer.service;

import com.explorer.entity.ContractCall;
import com.explorer.repository.ContractCallRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ContractCallService {

    private final ContractCallRepository contractCallRepository;

    public List<ContractCall> getContractCalls(String contractAddress) {
        return contractCallRepository.findByContractAddressOrderByTimestampDesc(contractAddress);
    }

    public List<ContractCall> getContractCallsByTransaction(String transactionHash) {
        return contractCallRepository.findByTransactionHash(transactionHash);
    }

    public List<String> getAllContractAddresses() {
        return contractCallRepository.findAllDistinctContractAddresses();
    }

    public ContractCall saveContractCall(ContractCall contractCall) {
        return contractCallRepository.save(contractCall);
    }
}