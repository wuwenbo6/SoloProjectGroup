package com.ancientbook.rarebook.service;

import com.ancientbook.common.datasource.DataSource;
import com.ancientbook.common.datasource.DataSourceType;
import com.ancientbook.common.exception.BusinessException;
import com.ancientbook.common.result.ResultCode;
import com.ancientbook.rarebook.dto.RareBookQueryDTO;
import com.ancientbook.rarebook.entity.RareBook;
import com.ancientbook.rarebook.mapper.RareBookMapper;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@DataSource(DataSourceType.RAREBOOK)
public class RareBookService {

    private final RareBookMapper rareBookMapper;

    @Transactional(rollbackFor = Exception.class)
    public RareBook create(RareBook rareBook) {
        RareBook exist = rareBookMapper.selectByBookCode(rareBook.getBookCode());
        if (exist != null) {
            throw new BusinessException("善本编号已存在");
        }
        if (rareBook.getStatus() == null) {
            rareBook.setStatus(0);
        }
        rareBookMapper.insert(rareBook);
        return rareBookMapper.selectById(rareBook.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public RareBook update(Long id, RareBook rareBook) {
        RareBook exist = rareBookMapper.selectById(id);
        if (exist == null) {
            throw new BusinessException(ResultCode.RAREBOOK_NOT_FOUND);
        }
        if (rareBook.getBookCode() != null && !rareBook.getBookCode().equals(exist.getBookCode())) {
            RareBook codeExist = rareBookMapper.selectByBookCode(rareBook.getBookCode());
            if (codeExist != null) {
                throw new BusinessException("善本编号已存在");
            }
        }
        rareBook.setId(id);
        rareBookMapper.updateById(rareBook);
        return rareBookMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        RareBook exist = rareBookMapper.selectById(id);
        if (exist == null) {
            throw new BusinessException(ResultCode.RAREBOOK_NOT_FOUND);
        }
        rareBookMapper.deleteById(id);
    }

    public RareBook getById(Long id) {
        RareBook rareBook = rareBookMapper.selectById(id);
        if (rareBook == null) {
            throw new BusinessException(ResultCode.RAREBOOK_NOT_FOUND);
        }
        return rareBook;
    }

    public RareBook getByBookCode(String bookCode) {
        return rareBookMapper.selectByBookCode(bookCode);
    }

    public PageInfo<RareBook> queryPage(RareBookQueryDTO queryDTO) {
        PageHelper.startPage(queryDTO.getPageNum(), queryDTO.getPageSize());
        return new PageInfo<>(rareBookMapper.selectList(queryDTO));
    }

    public Map<String, Object> getStatistics() {
        Map<String, Object> statistics = new HashMap<>();
        RareBookQueryDTO all = new RareBookQueryDTO();
        all.setPageNum(1);
        all.setPageSize(Integer.MAX_VALUE);
        statistics.put("total", rareBookMapper.selectCount(all));
        
        all.setStatus(0);
        statistics.put("pending", rareBookMapper.selectCount(all));
        
        all.setStatus(1);
        statistics.put("repairing", rareBookMapper.selectCount(all));
        
        all.setStatus(2);
        statistics.put("completed", rareBookMapper.selectCount(all));
        
        all.setStatus(3);
        statistics.put("archived", rareBookMapper.selectCount(all));
        
        return statistics;
    }
}
