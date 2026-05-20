package com.crafthub.artisan.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.crafthub.artisan.dto.ArtisanVerifyDTO;
import com.crafthub.artisan.entity.Artisan;
import com.crafthub.artisan.entity.ArtisanVerifyRecord;
import com.crafthub.artisan.mapper.ArtisanMapper;
import com.crafthub.artisan.mapper.ArtisanVerifyRecordMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ArtisanService extends ServiceImpl<ArtisanMapper, Artisan> {

    private static final Logger log = LoggerFactory.getLogger(ArtisanService.class);
    private final ArtisanVerifyRecordMapper verifyRecordMapper;

    public List<Artisan> getPendingVerifyList() {
        LambdaQueryWrapper<Artisan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Artisan::getStatus, 0)
               .orderByAsc(Artisan::getCreateTime);
        return list(wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean verifyArtisan(ArtisanVerifyDTO dto) {
        log.info("开始审核匠人: artisanId={}, status={}", dto.getArtisanId(), dto.getStatus());

        Artisan artisan = getById(dto.getArtisanId());
        if (artisan == null) {
            log.warn("审核失败: 匠人不存在, artisanId={}", dto.getArtisanId());
            return false;
        }

        if (artisan.getStatus() != 0) {
            log.warn("审核失败: 匠人已审核, artisanId={}, currentStatus={}", 
                    dto.getArtisanId(), artisan.getStatus());
            return false;
        }

        artisan.setStatus(dto.getStatus());
        artisan.setVerifyTime(LocalDateTime.now());
        artisan.setVerifyUserId(dto.getVerifyUserId());

        boolean updateResult = updateById(artisan);
        if (!updateResult) {
            log.error("更新匠人状态失败: artisanId={}", dto.getArtisanId());
            return false;
        }

        ArtisanVerifyRecord record = new ArtisanVerifyRecord();
        record.setArtisanId(dto.getArtisanId());
        record.setStatus(dto.getStatus());
        record.setReason(dto.getReason());
        record.setVerifyUserId(dto.getVerifyUserId());
        int insertResult = verifyRecordMapper.insert(record);

        if (insertResult <= 0) {
            log.error("插入审核记录失败: artisanId={}", dto.getArtisanId());
            return false;
        }

        log.info("匠人审核完成: artisanId={}, status={}", dto.getArtisanId(), dto.getStatus());
        return true;
    }

    public List<Artisan> getVerifiedArtisans() {
        LambdaQueryWrapper<Artisan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Artisan::getStatus, 1)
               .orderByDesc(Artisan::getOrderCount);
        return list(wrapper);
    }
}
