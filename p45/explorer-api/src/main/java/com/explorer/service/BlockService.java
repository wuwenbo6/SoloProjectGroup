package com.explorer.service;

import com.explorer.entity.Block;
import com.explorer.repository.BlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final BlockRepository blockRepository;

    public Page<Block> getBlocks(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return blockRepository.findAllByOrderByNumberDesc(pageable);
    }

    public Optional<Block> getBlockByHash(String hash) {
        return blockRepository.findByHash(hash);
    }

    public Optional<Block> getBlockByNumber(Long number) {
        return blockRepository.findByNumber(number);
    }

    public Optional<Long> getLatestBlockNumber() {
        return blockRepository.findLatestBlockNumber();
    }

    public Block saveBlock(Block block) {
        return blockRepository.save(block);
    }
}