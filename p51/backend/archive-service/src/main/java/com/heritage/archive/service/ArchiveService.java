package com.heritage.archive.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.heritage.archive.mapper.ArchiveMapper;
import com.heritage.common.entity.Archive;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ArchiveService extends ServiceImpl<ArchiveMapper, Archive> {

    public List<Archive> getByEquipmentId(Long equipmentId) {
        return this.list(new LambdaQueryWrapper<Archive>()
                .eq(Archive::getEquipmentId, equipmentId)
                .orderByDesc(Archive::getRecordDate));
    }

    public List<Archive> getByType(String archiveType) {
        return this.list(new LambdaQueryWrapper<Archive>()
                .eq(Archive::getArchiveType, archiveType)
                .orderByDesc(Archive::getRecordDate));
    }
}
