package com.ancient.book.database.service;

import com.ancient.book.common.entity.Interpretation;
import com.ancient.book.common.exception.BusinessException;
import com.ancient.book.database.mapper.InterpretationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterpretationService {

    private final InterpretationMapper interpretationMapper;

    public Interpretation saveInterpretation(Interpretation interpretation) {
        try {
            log.info("保存释义对照数据: {}", interpretation.getAncientText());
            interpretation.setCreateTime(LocalDateTime.now());
            interpretation.setUpdateTime(LocalDateTime.now());
            interpretationMapper.insert(interpretation);
            log.info("释义对照数据保存成功，ID: {}", interpretation.getId());
            return interpretation;
        } catch (Exception e) {
            log.error("释义对照数据保存失败", e);
            throw new BusinessException("释义对照数据保存失败");
        }
    }

    public Interpretation getInterpretationById(Long id) {
        Interpretation interpretation = interpretationMapper.selectById(id);
        if (interpretation == null) {
            throw new BusinessException("释义对照数据不存在");
        }
        return interpretation;
    }

    public List<Interpretation> searchByAncientText(String ancientText) {
        LambdaQueryWrapper<Interpretation> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(Interpretation::getAncientText, ancientText);
        return interpretationMapper.selectList(wrapper);
    }

    public IPage<Interpretation> getInterpretationList(int current, int size, String keyword) {
        Page<Interpretation> page = new Page<>(current, size);
        LambdaQueryWrapper<Interpretation> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(Interpretation::getAncientText, keyword)
                    .or().like(Interpretation::getModernTranslation, keyword));
        }
        wrapper.orderByDesc(Interpretation::getCreateTime);
        return interpretationMapper.selectPage(page, wrapper);
    }

    public Interpretation updateInterpretation(Interpretation interpretation) {
        interpretation.setUpdateTime(LocalDateTime.now());
        interpretationMapper.updateById(interpretation);
        return interpretation;
    }

    public void deleteInterpretation(Long id) {
        interpretationMapper.deleteById(id);
    }
}
