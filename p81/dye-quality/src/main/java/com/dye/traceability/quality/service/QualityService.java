package com.dye.traceability.quality.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dye.traceability.common.datasource.DataSource;
import com.dye.traceability.common.datasource.DataSourceType;
import com.dye.traceability.common.exception.BusinessException;
import com.dye.traceability.quality.dto.QualityInspectionDTO;
import com.dye.traceability.quality.entity.QualityInspection;
import com.dye.traceability.quality.mapper.QualityInspectionMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class QualityService extends ServiceImpl<QualityInspectionMapper, QualityInspection> {

    private static final int MAX_RETRY_TIMES = 10;
    private static final AtomicInteger sequence = new AtomicInteger(0);
    private static final int SCALE = 4;

    @DataSource(DataSourceType.QUALITY)
    @Transactional(rollbackFor = Exception.class)
    public void saveInspection(QualityInspectionDTO dto) {
        QualityInspection inspection = new QualityInspection();
        BeanUtils.copyProperties(dto, inspection);
        
        inspection.setColorDifference(convertToBigDecimal(dto.getColorDifference(), SCALE));
        inspection.setColorFastness(convertToBigDecimal(dto.getColorFastness(), SCALE));
        inspection.setPhValue(convertToBigDecimal(dto.getPhValue(), 2));
        inspection.setSolidContent(convertToBigDecimal(dto.getSolidContent(), SCALE));
        
        String inspectionNo = generateUniqueInspectionNo();
        inspection.setInspectionNo(inspectionNo);
        inspection.setStatus(1);
        save(inspection);
        log.info("品质检测记录保存成功, inspectionNo: {}", inspectionNo);
    }

    private BigDecimal convertToBigDecimal(Double value, int scale) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP);
    }

    @DataSource(DataSourceType.QUALITY)
    public List<QualityInspection> getByBatchNo(String batchNo) {
        LambdaQueryWrapper<QualityInspection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(QualityInspection::getBatchNo, batchNo);
        wrapper.orderByDesc(QualityInspection::getCreateTime);
        return list(wrapper);
    }

    @DataSource(DataSourceType.QUALITY)
    public List<QualityInspection> listByCondition(String result, String type) {
        LambdaQueryWrapper<QualityInspection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(QualityInspection::getDeleted, 0);
        if (result != null) {
            wrapper.eq(QualityInspection::getInspectionResult, result);
        }
        if (type != null) {
            wrapper.eq(QualityInspection::getInspectionType, type);
        }
        wrapper.orderByDesc(QualityInspection::getCreateTime);
        return list(wrapper);
    }

    private String generateUniqueInspectionNo() {
        for (int i = 0; i < MAX_RETRY_TIMES; i++) {
            String inspectionNo = generateInspectionNo();
            LambdaQueryWrapper<QualityInspection> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(QualityInspection::getInspectionNo, inspectionNo);
            wrapper.last("LIMIT 1");
            if (getOne(wrapper) == null) {
                return inspectionNo;
            }
            log.warn("检测编号重复, 正在重试: {}, 第{}次重试", inspectionNo, i + 1);
        }
        throw new BusinessException("生成唯一检测编号失败，请稍后重试");
    }

    private String generateInspectionNo() {
        int seq = sequence.incrementAndGet() % 10000;
        return "QI" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + String.format("%04d", seq)
                + IdUtil.nanoId(4);
    }
}
