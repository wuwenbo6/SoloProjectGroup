package com.pattern.controller;

import com.pattern.entity.Comment;
import com.pattern.entity.Pattern;
import com.pattern.service.InteractionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interactions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InteractionController {

    private final InteractionService interactionService;

    @PostMapping("/like")
    public ResponseEntity<Map<String, Object>> like(@RequestBody Map<String, Long> data) {
        Long patternId = data.get("patternId");
        Pattern pattern = interactionService.likePattern(patternId);
        return ResponseEntity.ok(Map.of(
            "message", "点赞成功",
            "likeCount", pattern != null ? pattern.getLikeCount() : 0,
            "pattern", pattern
        ));
    }

    @DeleteMapping("/like")
    public ResponseEntity<Map<String, Object>> unlike(@RequestBody Map<String, Long> data) {
        Long patternId = data.get("patternId");
        Pattern pattern = interactionService.unlikePattern(patternId);
        return ResponseEntity.ok(Map.of(
            "message", "取消点赞成功",
            "likeCount", pattern != null ? pattern.getLikeCount() : 0,
            "pattern", pattern
        ));
    }

    @PostMapping("/comment")
    public ResponseEntity<Map<String, Object>> comment(@RequestBody Comment comment) {
        Map<String, Object> result = interactionService.addComment(comment);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/comments/{patternId}")
    public ResponseEntity<List<Comment>> getComments(@PathVariable Long patternId) {
        return ResponseEntity.ok(interactionService.getCommentsByPatternId(patternId));
    }

    @PostMapping("/share")
    public ResponseEntity<Map<String, Object>> share(@RequestBody Map<String, Long> data) {
        Long patternId = data.get("patternId");
        Pattern pattern = interactionService.sharePattern(patternId);
        return ResponseEntity.ok(Map.of(
            "message", "分享成功",
            "shareCount", pattern != null ? pattern.getShareCount() : 0,
            "pattern", pattern
        ));
    }
}
