package com.rubbing.repository.rubbing;

import com.rubbing.entity.rubbing.Rubbing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RubbingRepository extends JpaRepository<Rubbing, Long> {
    List<Rubbing> findByCreatedByOrderByCreatedAtDesc(Long createdBy);
}
