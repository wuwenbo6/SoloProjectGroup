package com.mortisejoiner.repository.furniture;

import com.mortisejoiner.entity.furniture.FurniturePart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FurniturePartRepository extends JpaRepository<FurniturePart, Long> {

    List<FurniturePart> findByFurnitureIdOrderByStepOrder(Long furnitureId);

    Optional<FurniturePart> findByFurnitureIdAndModelId(Long furnitureId, String modelId);

    List<FurniturePart> findByFurnitureIdAndStepOrderLessThanEqual(Long furnitureId, Integer stepOrder);
}
