package com.pattern.repository;

import com.pattern.entity.Pattern;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PatternRepository extends JpaRepository<Pattern, Long> {

    List<Pattern> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT p FROM Pattern p ORDER BY p.createdAt DESC")
    List<Pattern> findAllOrderByCreatedAtDesc();

    @Query("SELECT p FROM Pattern p ORDER BY p.likeCount DESC")
    List<Pattern> findAllOrderByLikeCountDesc();

    @Query("SELECT p FROM Pattern p ORDER BY p.shareCount DESC")
    List<Pattern> findAllOrderByShareCountDesc();
}
