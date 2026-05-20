package com.mortisejoiner.controller;

import com.mortisejoiner.entity.furniture.Furniture;
import com.mortisejoiner.entity.furniture.FurniturePart;
import com.mortisejoiner.service.FurnitureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/furniture")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FurnitureController {

    @Autowired
    private FurnitureService furnitureService;

    @GetMapping("/public/list")
    public ResponseEntity<List<Furniture>> getPublicFurnitureList() {
        return ResponseEntity.ok(furnitureService.getAllActiveFurniture());
    }

    @GetMapping("/public/{id}")
    public ResponseEntity<Furniture> getPublicFurnitureById(@PathVariable Long id) {
        return furnitureService.getFurnitureById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/public/{id}/parts")
    public ResponseEntity<List<FurniturePart>> getPublicFurnitureParts(@PathVariable Long id) {
        return ResponseEntity.ok(furnitureService.getFurnitureParts(id));
    }

    @GetMapping("/{id}/parts/{modelId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<FurniturePart> getFurniturePartByModelId(@PathVariable Long id, @PathVariable String modelId) {
        return furnitureService.getFurniturePartByModelId(id, modelId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<Furniture> createFurniture(@RequestBody Furniture furniture) {
        return ResponseEntity.ok(furnitureService.createFurniture(furniture));
    }

    @PostMapping("/{id}/parts")
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<FurniturePart> addFurniturePart(@PathVariable Long id, @RequestBody FurniturePart part) {
        return ResponseEntity.ok(furnitureService.addFurniturePart(id, part));
    }
}
