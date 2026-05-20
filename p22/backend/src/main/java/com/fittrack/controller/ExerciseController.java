package com.fittrack.controller;

import com.fittrack.entity.ExerciseTemplate;
import com.fittrack.entity.WorkoutSession;
import com.fittrack.repository.ExerciseTemplateRepository;
import com.fittrack.service.WorkoutHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/exercises")
@CrossOrigin(origins = "*")
public class ExerciseController {

    private final ExerciseTemplateRepository exerciseTemplateRepository;
    private final WorkoutHistoryService workoutHistoryService;

    public ExerciseController(ExerciseTemplateRepository exerciseTemplateRepository,
                               WorkoutHistoryService workoutHistoryService) {
        this.exerciseTemplateRepository = exerciseTemplateRepository;
        this.workoutHistoryService = workoutHistoryService;
    }

    @GetMapping("/templates")
    public ResponseEntity<List<ExerciseTemplate>> getAllTemplates() {
        return ResponseEntity.ok(exerciseTemplateRepository.findByIsActiveTrue());
    }

    @GetMapping("/templates/{id}")
    public ResponseEntity<ExerciseTemplate> getTemplateById(@PathVariable Long id) {
        return exerciseTemplateRepository.findByIdWithFrames(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/templates/type/{type}")
    public ResponseEntity<List<ExerciseTemplate>> getTemplatesByType(@PathVariable String type) {
        return ResponseEntity.ok(exerciseTemplateRepository.findByExerciseTypeAndIsActive(type, true));
    }

    @PostMapping("/sessions/start")
    public ResponseEntity<WorkoutSession> startSession(
            @RequestParam Long userId,
            @RequestParam Long exerciseTemplateId) {
        WorkoutSession session = workoutHistoryService.startSession(userId, exerciseTemplateId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/{id}/end")
    public ResponseEntity<Void> endSession(
            @PathVariable Long id,
            @RequestParam int repsCount,
            @RequestParam double accuracy) {
        workoutHistoryService.endSession(id, repsCount, accuracy);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/history/{userId}")
    public ResponseEntity<List<WorkoutSession>> getUserHistory(@PathVariable Long userId) {
        return ResponseEntity.ok(workoutHistoryService.getUserHistory(userId));
    }

    @GetMapping("/history/{userId}/range")
    public ResponseEntity<List<WorkoutSession>> getUserHistoryByDateRange(
            @PathVariable Long userId,
            @RequestParam LocalDateTime start,
            @RequestParam LocalDateTime end) {
        return ResponseEntity.ok(workoutHistoryService.getUserHistoryByDateRange(userId, start, end));
    }
}
