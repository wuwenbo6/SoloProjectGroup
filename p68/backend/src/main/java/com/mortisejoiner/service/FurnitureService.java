package com.mortisejoiner.service;

import com.mortisejoiner.entity.furniture.Furniture;
import com.mortisejoiner.entity.furniture.FurniturePart;
import com.mortisejoiner.repository.furniture.FurniturePartRepository;
import com.mortisejoiner.repository.furniture.FurnitureRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FurnitureService {

    @Autowired
    private FurnitureRepository furnitureRepository;

    @Autowired
    private FurniturePartRepository furniturePartRepository;

    public List<Furniture> getAllActiveFurniture() {
        return furnitureRepository.findByIsActiveTrue();
    }

    public Optional<Furniture> getFurnitureById(Long id) {
        return furnitureRepository.findByIdAndIsActiveTrue(id);
    }

    public List<FurniturePart> getFurnitureParts(Long furnitureId) {
        return furniturePartRepository.findByFurnitureIdOrderByStepOrder(furnitureId);
    }

    public Optional<FurniturePart> getFurniturePartByModelId(Long furnitureId, String modelId) {
        return furniturePartRepository.findByFurnitureIdAndModelId(furnitureId, modelId);
    }

    public List<Furniture> getFurnitureByCategory(String category) {
        return furnitureRepository.findByCategory(category);
    }

    public Furniture createFurniture(Furniture furniture) {
        return furnitureRepository.save(furniture);
    }

    public FurniturePart addFurniturePart(Long furnitureId, FurniturePart part) {
        part.setFurniture(furnitureRepository.getReferenceById(furnitureId));
        return furniturePartRepository.save(part);
    }
}
