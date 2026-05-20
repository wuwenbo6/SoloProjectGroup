package com.indexer.repository;

import com.indexer.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByHash(String hash);

    Optional<Block> findByNumber(Long number);

    @Query("SELECT MAX(b.number) FROM Block b")
    Optional<Long> findLatestBlockNumber();
}