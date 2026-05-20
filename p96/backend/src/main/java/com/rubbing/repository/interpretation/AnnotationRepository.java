package com.rubbing.repository.interpretation;

import com.rubbing.entity.interpretation.Annotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, Long> {
    List<Annotation> findByRubbingIdOrderByCreatedAtAsc(Long rubbingId);
    List<Annotation> findByRubbingIdAndUserIdOrderByCreatedAtAsc(Long rubbingId, Long userId);
    void deleteByRubbingId(Long rubbingId);
}
