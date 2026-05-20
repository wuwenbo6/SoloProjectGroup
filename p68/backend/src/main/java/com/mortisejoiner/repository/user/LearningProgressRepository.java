package com.mortisejoiner.repository.user;

import com.mortisejoiner.entity.user.LearningProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LearningProgressRepository extends JpaRepository<LearningProgress, Long> {

    Optional<LearningProgress> findByUserIdAndFurnitureId(Long userId, Long furnitureId);

    List<LearningProgress> findByUserId(Long userId);

    List<LearningProgress> findByUserIdAndIsCompletedTrue(Long userId);

    List<LearningProgress> findByUserIdAndIsCompletedFalse(Long userId);

    Long countByUserIdAndIsCompletedTrue(Long userId);
}
