package com.rubbing.repository.interpretation;

import com.rubbing.entity.interpretation.Interpretation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InterpretationRepository extends JpaRepository<Interpretation, Long> {
    List<Interpretation> findByRubbingIdOrderByCreatedAtDesc(Long rubbingId);
    Optional<Interpretation> findByRubbingIdAndUserId(Long rubbingId, Long userId);
    List<Interpretation> findAllByOrderByCreatedAtDesc();
}
