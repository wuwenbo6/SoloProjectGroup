package com.ancient.book.database.service;

import com.ancient.book.common.entity.RestorationDraft;
import com.ancient.book.common.exception.BusinessException;
import com.ancient.book.database.mapper.RestorationDraftMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class RestorationDraftService {

    private final RestorationDraftMapper draftMapper;
    
    private final Map<Long, Object> draftLocks = new ConcurrentHashMap<>();

    @Transactional(rollbackFor = Exception.class)
    public RestorationDraft saveDraft(RestorationDraft draft) {
        try {
            log.info("保存修复草稿，页面ID: {}, 步骤: {}", draft.getPageId(), draft.getRestorationStep());
            
            validateDraftData(draft);
            
            draft.setCreateTime(LocalDateTime.now());
            draft.setUpdateTime(LocalDateTime.now());
            draft.setIsCurrent(1);
            
            if (draft.getVersion() == null) {
                draft.setVersion(1);
            }
            
            int result = draftMapper.insert(draft);
            if (result == 0) {
                throw new BusinessException("修复草稿数据写入失败，数据库返回0条影响");
            }
            
            if (draft.getId() == null) {
                log.error("修复草稿保存后ID为空，可能存在数据库主键生成问题");
                throw new BusinessException("修复草稿保存失败，ID生成异常");
            }
            
            log.info("修复草稿保存成功，ID: {}", draft.getId());
            return draft;
            
        } catch (BusinessException e) {
            log.error("修复草稿保存业务异常: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("修复草稿保存失败，异常类型: {}, 消息: {}", e.getClass().getSimpleName(), e.getMessage(), e);
            throw new BusinessException("修复草稿保存失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public RestorationDraft saveDraftWithLock(RestorationDraft draft) {
        Object lock = draftLocks.computeIfAbsent(draft.getPageId(), k -> new Object());
        synchronized (lock) {
            try {
                LambdaUpdateWrapper<RestorationDraft> wrapper = new LambdaUpdateWrapper<>();
                wrapper.eq(RestorationDraft::getPageId, draft.getPageId())
                       .eq(RestorationDraft::getIsCurrent, 1);
                RestorationDraft oldDraft = new RestorationDraft();
                oldDraft.setIsCurrent(0);
                draftMapper.update(oldDraft, wrapper);
                
                draft.setVersion(draft.getVersion() != null ? draft.getVersion() + 1 : 1);
                return saveDraft(draft);
            } finally {
                draftLocks.remove(draft.getPageId());
            }
        }
    }

    public RestorationDraft getDraftById(Long id) {
        if (id == null) {
            throw new BusinessException("草稿ID不能为空");
        }
        
        RestorationDraft draft = draftMapper.selectById(id);
        if (draft == null) {
            log.warn("修复草稿不存在，ID: {}", id);
            throw new BusinessException("修复草稿不存在");
        }
        return draft;
    }

    public List<RestorationDraft> getDraftsByPageId(Long pageId) {
        if (pageId == null) {
            throw new BusinessException("页面ID不能为空");
        }
        
        LambdaQueryWrapper<RestorationDraft> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RestorationDraft::getPageId, pageId)
               .orderByAsc(RestorationDraft::getRestorationStep)
               .orderByDesc(RestorationDraft::getVersion);
        return draftMapper.selectList(wrapper);
    }

    public RestorationDraft getCurrentDraftByPageId(Long pageId) {
        if (pageId == null) {
            throw new BusinessException("页面ID不能为空");
        }
        
        LambdaQueryWrapper<RestorationDraft> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RestorationDraft::getPageId, pageId)
               .eq(RestorationDraft::getIsCurrent, 1)
               .last("LIMIT 1");
        return draftMapper.selectOne(wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public RestorationDraft updateDraft(RestorationDraft draft) {
        if (draft.getId() == null) {
            throw new BusinessException("草稿ID不能为空");
        }
        
        try {
            draft.setUpdateTime(LocalDateTime.now());
            int result = draftMapper.updateById(draft);
            if (result == 0) {
                log.warn("修复草稿更新失败，无数据被更新，ID: {}", draft.getId());
                throw new BusinessException("修复草稿更新失败，草稿不存在或无变化");
            }
            log.info("修复草稿更新成功，ID: {}", draft.getId());
            return draft;
        } catch (Exception e) {
            log.error("修复草稿更新失败", e);
            throw new BusinessException("修复草稿更新失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDraft(Long id) {
        if (id == null) {
            throw new BusinessException("草稿ID不能为空");
        }
        
        try {
            int result = draftMapper.deleteById(id);
            if (result == 0) {
                log.warn("修复草稿删除失败，无数据被删除，ID: {}", id);
                throw new BusinessException("修复草稿删除失败，草稿不存在");
            }
            log.info("修复草稿删除成功，ID: {}", id);
        } catch (Exception e) {
            log.error("修复草稿删除失败", e);
            throw new BusinessException("修复草稿删除失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveAiSuggestions(Long draftId, String aiSuggestions) {
        if (draftId == null) {
            throw new BusinessException("草稿ID不能为空");
        }
        
        try {
            RestorationDraft draft = new RestorationDraft();
            draft.setId(draftId);
            draft.setAiSuggestions(aiSuggestions);
            draft.setUpdateTime(LocalDateTime.now());
            
            LambdaUpdateWrapper<RestorationDraft> wrapper = new LambdaUpdateWrapper<>();
            wrapper.eq(RestorationDraft::getId, draftId);
            int result = draftMapper.update(draft, wrapper);
            
            if (result == 0) {
                log.error("AI建议保存失败，草稿不存在，ID: {}", draftId);
                throw new BusinessException("AI建议保存失败，草稿不存在");
            }
            log.info("AI建议保存成功，草稿ID: {}", draftId);
        } catch (Exception e) {
            log.error("AI建议保存失败", e);
            throw new BusinessException("AI建议保存失败: " + e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveOperationLog(Long draftId, String operationLog) {
        if (draftId == null) {
            throw new BusinessException("草稿ID不能为空");
        }
        
        try {
            RestorationDraft draft = new RestorationDraft();
            draft.setId(draftId);
            draft.setOperationLog(operationLog);
            draft.setUpdateTime(LocalDateTime.now());
            
            LambdaUpdateWrapper<RestorationDraft> wrapper = new LambdaUpdateWrapper<>();
            wrapper.eq(RestorationDraft::getId, draftId);
            int result = draftMapper.update(draft, wrapper);
            
            if (result == 0) {
                log.error("操作日志保存失败，草稿不存在，ID: {}", draftId);
                throw new BusinessException("操作日志保存失败，草稿不存在");
            }
            log.info("操作日志保存成功，草稿ID: {}", draftId);
        } catch (Exception e) {
            log.error("操作日志保存失败", e);
            throw new BusinessException("操作日志保存失败: " + e.getMessage());
        }
    }

    private void validateDraftData(RestorationDraft draft) {
        if (draft.getPageId() == null) {
            throw new BusinessException("页面ID不能为空");
        }
        if (draft.getRestorationStep() == null) {
            throw new BusinessException("修复步骤不能为空");
        }
        if (draft.getDraftContent() == null || draft.getDraftContent().trim().isEmpty()) {
            log.warn("草稿内容为空，页面ID: {}", draft.getPageId());
        }
    }
}
