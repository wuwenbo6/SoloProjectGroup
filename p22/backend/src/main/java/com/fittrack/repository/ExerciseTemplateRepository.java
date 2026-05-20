package com.fittrack.repository;

import com.fittrack.entity.ExerciseTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExerciseTemplateRepository extends JpaRepository<ExerciseTemplate, Long> {

    Optional<ExerciseTemplate> findByName(String name);

    List<ExerciseTemplate> findByExerciseTypeAndIsActive(String exerciseType, Boolean isActive);

    List<ExerciseTemplate> findByIsActiveTrue();

    @Query("SELECT et FROM ExerciseTemplate et LEFT JOIN FETCH et.templateFrames WHERE et.id = :id")
    Optional<ExerciseTemplate> findByIdWithFrames(Long id);
}
