package com.pattern.service;

import com.pattern.entity.Pattern;
import com.pattern.repository.PatternRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PatternService {

    private final PatternRepository patternRepository;

    @Transactional
    public Pattern create(Pattern pattern) {
        if (pattern.getLikeCount() == null) pattern.setLikeCount(0);
        if (pattern.getCommentCount() == null) pattern.setCommentCount(0);
        if (pattern.getShareCount() == null) pattern.setShareCount(0);
        if (pattern.getUserId() == null) pattern.setUserId(1L);
        if (pattern.getAuthorName() == null || pattern.getAuthorName().isEmpty()) {
            pattern.setAuthorName("匿名用户");
        }
        return patternRepository.save(pattern);
    }

    public Optional<Pattern> getById(Long id) {
        return patternRepository.findById(id);
    }

    public List<Pattern> getAll(String sort) {
        Sort sortOrder = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("likeCount".equals(sort)) {
            sortOrder = Sort.by(Sort.Direction.DESC, "likeCount");
        } else if ("shareCount".equals(sort)) {
            sortOrder = Sort.by(Sort.Direction.DESC, "shareCount");
        }
        return patternRepository.findAll(sortOrder);
    }

    public Page<Pattern> getAllPaged(int page, int size, String sort) {
        Sort sortOrder = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("likeCount".equals(sort)) {
            sortOrder = Sort.by(Sort.Direction.DESC, "likeCount");
        } else if ("shareCount".equals(sort)) {
            sortOrder = Sort.by(Sort.Direction.DESC, "shareCount");
        }
        Pageable pageable = PageRequest.of(page, size, sortOrder);
        return patternRepository.findAll(pageable);
    }

    public List<Pattern> getByUserId(Long userId) {
        return patternRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Pattern update(Long id, Pattern patternDetails) {
        return patternRepository.findById(id)
                .map(pattern -> {
                    if (patternDetails.getName() != null) {
                        pattern.setName(patternDetails.getName());
                    }
                    if (patternDetails.getDescription() != null) {
                        pattern.setDescription(patternDetails.getDescription());
                    }
                    if (patternDetails.getTags() != null) {
                        pattern.setTags(patternDetails.getTags());
                    }
                    if (patternDetails.getImageData() != null) {
                        pattern.setImageData(patternDetails.getImageData());
                    }
                    if (patternDetails.getAuthorName() != null) {
                        pattern.setAuthorName(patternDetails.getAuthorName());
                    }
                    return patternRepository.save(pattern);
                })
                .orElseThrow(() -> new RuntimeException("纹样不存在"));
    }

    @Transactional
    public void delete(Long id) {
        patternRepository.deleteById(id);
    }

    @Transactional
    public void incrementLikeCount(Long id) {
        patternRepository.findById(id).ifPresent(pattern -> {
            pattern.setLikeCount(pattern.getLikeCount() + 1);
            patternRepository.save(pattern);
        });
    }

    @Transactional
    public void decrementLikeCount(Long id) {
        patternRepository.findById(id).ifPresent(pattern -> {
            if (pattern.getLikeCount() > 0) {
                pattern.setLikeCount(pattern.getLikeCount() - 1);
                patternRepository.save(pattern);
            }
        });
    }

    @Transactional
    public void incrementCommentCount(Long id) {
        patternRepository.findById(id).ifPresent(pattern -> {
            pattern.setCommentCount(pattern.getCommentCount() + 1);
            patternRepository.save(pattern);
        });
    }

    @Transactional
    public void incrementShareCount(Long id) {
        patternRepository.findById(id).ifPresent(pattern -> {
            pattern.setShareCount(pattern.getShareCount() + 1);
            patternRepository.save(pattern);
        });
    }
}
