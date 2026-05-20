package com.pattern.controller;

import com.pattern.entity.Pattern;
import com.pattern.service.PatternService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patterns")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PatternController {

    private final PatternService patternService;

    @PostMapping
    public ResponseEntity<Pattern> create(@RequestBody Pattern pattern) {
        return ResponseEntity.ok(patternService.create(pattern));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Pattern> getById(@PathVariable Long id) {
        return patternService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Pattern>> getAll(
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(patternService.getAll(sort));
    }

    @GetMapping("/page")
    public ResponseEntity<Page<Pattern>> getAllPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(patternService.getAllPaged(page, size, sort));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Pattern> update(@PathVariable Long id, @RequestBody Pattern pattern) {
        return ResponseEntity.ok(patternService.update(id, pattern));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        patternService.delete(id);
        return ResponseEntity.ok().build();
    }
}
