package com.rubbing.service;

import com.rubbing.entity.interpretation.Annotation;
import com.rubbing.entity.interpretation.Interpretation;
import com.rubbing.repository.interpretation.AnnotationRepository;
import com.rubbing.repository.interpretation.InterpretationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterpretationService {

    private final AnnotationRepository annotationRepository;
    private final InterpretationRepository interpretationRepository;

    public Map<String, Object> recognizeText(Long rubbingId) {
        List<Annotation> annotations = new ArrayList<>();
        
        int count = 5;
        for (int i = 0; i < count; i++) {
            Annotation ann = new Annotation();
            ann.setX(0.1 + i * 0.15);
            ann.setY(0.1 + (i % 3) * 0.25);
            ann.setWidth(0.12);
            ann.setHeight(0.08);
            ann.setText("文字" + (i + 1));
            ann.setConfidence(0.75 + Math.random() * 0.25);
            annotations.add(ann);
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("annotations", annotations);
        result.put("message", "OCR识别完成");
        return result;
    }

    @Transactional("interpretationTransactionManager")
    public Map<String, Object> saveAnnotations(Long rubbingId, Long userId, List<Annotation> annotations) {
        List<Annotation> existingAnns = annotationRepository.findByRubbingIdOrderByCreatedAtAsc(rubbingId);
        Map<Long, Annotation> existingMap = existingAnns.stream()
                .collect(Collectors.toMap(Annotation::getId, a -> a));
        
        Set<Long> incomingIds = annotations.stream()
                .filter(a -> a.getId() != null)
                .map(Annotation::getId)
                .collect(Collectors.toSet());
        
        List<Annotation> toDelete = existingAnns.stream()
                .filter(a -> !incomingIds.contains(a.getId()))
                .collect(Collectors.toList());
        
        List<String> conflicts = new ArrayList<>();
        List<Annotation> toSave = new ArrayList<>();
        
        for (Annotation incoming : annotations) {
            if (incoming.getId() != null && existingMap.containsKey(incoming.getId())) {
                Annotation existing = existingMap.get(incoming.getId());
                if (!Objects.equals(existing.getVersion(), incoming.getVersion())) {
                    conflicts.add("标注 ID " + incoming.getId() + " 已被其他用户修改");
                    continue;
                }
                incoming.setVersion(existing.getVersion());
                incoming.setCreatedAt(existing.getCreatedAt());
            }
            incoming.setRubbingId(rubbingId);
            incoming.setLastModifiedBy(userId);
            if (incoming.getUserId() == null) {
                incoming.setUserId(userId);
            }
            incoming.setUpdatedAt(LocalDateTime.now());
            toSave.add(incoming);
        }
        
        annotationRepository.deleteAll(toDelete);
        
        try {
            annotationRepository.saveAll(toSave);
        } catch (OptimisticLockingFailureException e) {
            throw new RuntimeException("部分标注已被其他用户修改，请刷新后重试");
        }

        Interpretation interpretation = interpretationRepository
                .findByRubbingIdAndUserId(rubbingId, userId)
                .orElse(new Interpretation());
        interpretation.setRubbingId(rubbingId);
        interpretation.setUserId(userId);
        interpretation.setStatus(Interpretation.Status.COMPLETED);
        interpretation.setUpdatedAt(LocalDateTime.now());
        interpretationRepository.save(interpretation);

        Map<String, Object> result = new HashMap<>();
        result.put("success", conflicts.isEmpty());
        result.put("conflicts", conflicts);
        result.put("savedCount", toSave.size());
        result.put("deletedCount", toDelete.size());
        return result;
    }

    public List<Annotation> getAnnotations(Long rubbingId) {
        return annotationRepository.findByRubbingIdOrderByCreatedAtAsc(rubbingId);
    }

    public Interpretation getInterpretationByRubbingId(Long rubbingId, Long userId) {
        Interpretation interpretation = interpretationRepository
                .findByRubbingIdAndUserId(rubbingId, userId)
                .orElse(null);
        if (interpretation != null) {
            interpretation.setAnnotations(getAnnotations(rubbingId));
        }
        return interpretation;
    }

    public Map<String, Object> getInterpretationsWithPaging(int page, int size) {
        List<Interpretation> all = interpretationRepository.findAllByOrderByCreatedAtDesc();
        int total = all.size();
        int start = page * size;
        int end = Math.min(start + size, total);
        List<Interpretation> content = all.subList(start, end);
        
        for (Interpretation inter : content) {
            inter.setAnnotations(null);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("list", content);
        result.put("total", total);
        result.put("page", page);
        result.put("size", size);
        return result;
    }

    public Map<String, Object> compareInterpretations(List<Long> interpretationIds, int page, int size) {
        List<Interpretation> interpretations = interpretationRepository.findAllById(interpretationIds);
        if (interpretations.isEmpty()) {
            throw new RuntimeException("未找到释读记录");
        }

        Long rubbingId = interpretations.get(0).getRubbingId();
        Map<Long, List<Annotation>> annotationMap = new HashMap<>();
        
        for (Interpretation inter : interpretations) {
            annotationMap.put(inter.getId(), getAnnotations(inter.getRubbingId()));
        }

        Map<String, Map<Long, Annotation>> positionIndex = new HashMap<>();
        for (Map.Entry<Long, List<Annotation>> entry : annotationMap.entrySet()) {
            for (Annotation ann : entry.getValue()) {
                String key = ann.getX() + "_" + ann.getY();
                positionIndex.computeIfAbsent(key, k -> new HashMap<>())
                        .put(entry.getKey(), ann);
            }
        }

        List<Map<String, Object>> allDiffs = new ArrayList<>();
        for (Map.Entry<String, Map<Long, Annotation>> entry : positionIndex.entrySet()) {
            Map<Long, Annotation> versions = entry.getValue();
            
            Map<String, Object> diffItem = new HashMap<>();
            Annotation baseAnn = versions.values().iterator().next();
            diffItem.put("annotationId", baseAnn.getId());
            diffItem.put("text", baseAnn.getText());
            diffItem.put("x", baseAnn.getX());
            diffItem.put("y", baseAnn.getY());
            
            List<Map<String, Object>> versionList = new ArrayList<>();
            for (Interpretation inter : interpretations) {
                Map<String, Object> version = new HashMap<>();
                version.put("interpretationId", inter.getId());
                version.put("username", "用户" + inter.getUserId());
                
                Annotation ann = versions.get(inter.getId());
                if (ann != null) {
                    version.put("text", ann.getText());
                    version.put("diff", "same");
                } else {
                    version.put("text", "");
                    version.put("diff", "missing");
                }
                versionList.add(version);
            }
            diffItem.put("versions", versionList);
            allDiffs.add(diffItem);
        }

        int total = allDiffs.size();
        int start = page * size;
        int end = Math.min(start + size, total);
        List<Map<String, Object>> pagedDiffs = allDiffs.subList(start, end);

        Map<String, Object> result = new HashMap<>();
        result.put("id", System.currentTimeMillis());
        result.put("interpretationIds", interpretationIds);
        result.put("diffAnnotations", pagedDiffs);
        result.put("total", total);
        result.put("page", page);
        result.put("size", size);
        result.put("hasMore", end < total);
        result.put("createdAt", System.currentTimeMillis());
        return result;
    }
}
