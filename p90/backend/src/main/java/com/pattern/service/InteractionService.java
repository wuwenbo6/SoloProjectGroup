package com.pattern.service;

import com.pattern.entity.Comment;
import com.pattern.entity.Pattern;
import com.pattern.repository.CommentRepository;
import com.pattern.repository.PatternRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@Service
@RequiredArgsConstructor
public class InteractionService {

    private final CommentRepository commentRepository;
    private final PatternRepository patternRepository;

    @Transactional
    public Map<String, Object> addComment(Comment comment) {
        if (comment.getUserId() == null) {
            comment.setUserId(1L);
        }
        if (comment.getUserName() == null || comment.getUserName().isEmpty()) {
            comment.setUserName("匿名用户");
        }
        
        Comment savedComment = commentRepository.save(comment);
        
        Pattern pattern = patternRepository.findById(comment.getPatternId()).orElse(null);
        if (pattern != null) {
            pattern.setCommentCount(pattern.getCommentCount() + 1);
            patternRepository.save(pattern);
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("comment", savedComment);
        result.put("pattern", pattern);
        return result;
    }

    public List<Comment> getCommentsByPatternId(Long patternId) {
        return commentRepository.findByPatternIdOrderByCreatedAtDesc(patternId);
    }

    @Transactional
    public Pattern likePattern(Long patternId) {
        Pattern pattern = patternRepository.findById(patternId).orElse(null);
        if (pattern != null) {
            pattern.setLikeCount(pattern.getLikeCount() + 1);
            return patternRepository.save(pattern);
        }
        return null;
    }

    @Transactional
    public Pattern unlikePattern(Long patternId) {
        Pattern pattern = patternRepository.findById(patternId).orElse(null);
        if (pattern != null && pattern.getLikeCount() > 0) {
            pattern.setLikeCount(pattern.getLikeCount() - 1);
            return patternRepository.save(pattern);
        }
        return pattern;
    }

    @Transactional
    public Pattern sharePattern(Long patternId) {
        Pattern pattern = patternRepository.findById(patternId).orElse(null);
        if (pattern != null) {
            pattern.setShareCount(pattern.getShareCount() + 1);
            return patternRepository.save(pattern);
        }
        return null;
    }
}
