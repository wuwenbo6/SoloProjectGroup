package com.mortisejoiner.controller;

import com.mortisejoiner.entity.teaching.DisassembleStep;
import com.mortisejoiner.service.TeachingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teaching")
@CrossOrigin(origins = "*", maxAge = 3600)
public class TeachingController {

    @Autowired
    private TeachingService teachingService;

    @GetMapping("/steps/{furnitureId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<List<DisassembleStep>> getSteps(@PathVariable Long furnitureId) {
        return ResponseEntity.ok(teachingService.getStepsByFurnitureId(furnitureId));
    }

    @GetMapping("/steps/{furnitureId}/{stepNumber}")
    @PreAuthorize("hasAnyRole('STUDENT', 'INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<DisassembleStep> getStep(@PathVariable Long furnitureId, @PathVariable Integer stepNumber) {
        return teachingService.getStepByFurnitureAndStepNumber(furnitureId, stepNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/steps")
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<DisassembleStep> createStep(@RequestBody DisassembleStep step) {
        return ResponseEntity.ok(teachingService.createStep(step));
    }

    @PostMapping("/steps/batch")
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<List<DisassembleStep>> createStepsBatch(@RequestBody List<DisassembleStep> steps) {
        return ResponseEntity.ok(teachingService.createStepsBatch(steps));
    }
}
