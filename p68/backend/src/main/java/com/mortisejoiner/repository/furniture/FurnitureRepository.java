package com.mortisejoiner.repository.furniture;

import com.mortisejoiner.entity.furniture.Furniture;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FurnitureRepository extends JpaRepository<Furniture, Long> {

    List<Furniture> findByIsActiveTrue();

    Optional<Furniture> findByIdAndIsActiveTrue(Long id);

    List<Furniture> findByCategory(String category);

    @Query("SELECT f FROM Furniture f WHERE f.isActive = true ORDER BY f.createdAt DESC")
    List<Furniture> findLatestFurniture();

    List<Furniture> findByDifficultyBetween(Integer minDifficulty, Integer maxDifficulty);
}
