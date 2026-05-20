package com.ancient.book.database.service;

import com.ancient.book.common.entity.AncientBookPage;
import com.ancient.book.common.exception.BusinessException;
import com.ancient.book.database.mapper.AncientBookPageMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AncientBookPageService {

    private final AncientBookPageMapper pageMapper;

    public AncientBookPage savePage(AncientBookPage page) {
        try {
            log.info("保存古籍页面: {}, 页码: {}", page.getBookName(), page.getPageNumber());
            page.setCreateTime(LocalDateTime.now());
            page.setUpdateTime(LocalDateTime.now());
            pageMapper.insert(page);
            log.info("古籍页面保存成功，ID: {}", page.getId());
            return page;
        } catch (Exception e) {
            log.error("古籍页面保存失败", e);
            throw new BusinessException("古籍页面保存失败");
        }
    }

    public AncientBookPage getPageById(Long id) {
        AncientBookPage page = pageMapper.selectById(id);
        if (page == null) {
            throw new BusinessException("古籍页面不存在");
        }
        return page;
    }

    public List<AncientBookPage> getPagesByBookName(String bookName) {
        LambdaQueryWrapper<AncientBookPage> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AncientBookPage::getBookName, bookName);
        wrapper.orderByAsc(AncientBookPage::getPageNumber);
        return pageMapper.selectList(wrapper);
    }

    public IPage<AncientBookPage> getPageList(int current, int size, String bookName) {
        Page<AncientBookPage> page = new Page<>(current, size);
        LambdaQueryWrapper<AncientBookPage> wrapper = new LambdaQueryWrapper<>();
        if (bookName != null && !bookName.isEmpty()) {
            wrapper.like(AncientBookPage::getBookName, bookName);
        }
        wrapper.orderByDesc(AncientBookPage::getCreateTime);
        return pageMapper.selectPage(page, wrapper);
    }

    public AncientBookPage updatePage(AncientBookPage page) {
        page.setUpdateTime(LocalDateTime.now());
        pageMapper.updateById(page);
        return page;
    }

    public void deletePage(Long id) {
        pageMapper.deleteById(id);
    }

    public void updatePageStatus(Long id, Integer status) {
        AncientBookPage page = new AncientBookPage();
        page.setId(id);
        page.setStatus(status);
        page.setUpdateTime(LocalDateTime.now());
        pageMapper.updateById(page);
    }

    public void saveDamageAreas(Long pageId, String damageAreas) {
        AncientBookPage page = new AncientBookPage();
        page.setId(pageId);
        page.setDamageAreas(damageAreas);
        page.setUpdateTime(LocalDateTime.now());
        pageMapper.updateById(page);
    }

    public void saveExtractedText(Long pageId, String extractedText) {
        AncientBookPage page = new AncientBookPage();
        page.setId(pageId);
        page.setExtractedText(extractedText);
        page.setUpdateTime(LocalDateTime.now());
        pageMapper.updateById(page);
    }
}
