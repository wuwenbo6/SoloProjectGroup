package com.explorer.repository;

import com.explorer.entity.Block;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByHash(String hash);

    Optional<Block> findByNumber(Long number);

    Page<Block> findAllByOrderByNumberDesc(Pageable pageable);

    @Query("SELECT MAX(b.number) FROM Block b")
    Optional<Long> findLatestBlockNumber();
}