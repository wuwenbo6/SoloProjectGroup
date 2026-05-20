package com.dye.traceability.thirdparty.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dye.traceability.common.datasource.DataSource;
import com.dye.traceability.common.datasource.DataSourceType;
import com.dye.traceability.common.exception.BusinessException;
import com.dye.traceability.thirdparty.dto.ThirdPartyReportDTO;
import com.dye.traceability.thirdparty.entity.ThirdPartyInspection;
import com.dye.traceability.thirdparty.mapper.ThirdPartyInspectionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@RequiredArgsConstructor
public class ThirdPartyService extends ServiceImpl<ThirdPartyInspectionMapper, ThirdPartyInspection> {

    private static final int MAX_RETRY_TIMES = 10;
    private static final AtomicInteger sequence = new AtomicInteger(0);
    private static final int SCALE_4 = 4;
    private static final int SCALE_2 = 2;

    @DataSource(DataSourceType.QUALITY)
    @Transactional(rollbackFor = Exception.class)
    public void syncReport(ThirdPartyReportDTO dto) {
        ThirdPartyInspection inspection = new ThirdPartyInspection();
        inspection.setReportNo(generateUniqueReportNo());
        inspection.setBatchNo(dto.getBatchNo());
        inspection.setInspectionAgency(dto.getInspectionAgency());
        inspection.setInspectionDate(dto.getInspectionDate() != null ? dto.getInspectionDate() : 
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        inspection.setInspector(dto.getInspector());
        
        inspection.setColorDifference(convertToBigDecimal(dto.getColorDifference(), SCALE_4));
        inspection.setColorFastnessWashing(convertToBigDecimal(dto.getColorFastnessWashing(), SCALE_4));
        inspection.setColorFastnessLight(convertToBigDecimal(dto.getColorFastnessLight(), SCALE_4));
        inspection.setColorFastnessRubbing(convertToBigDecimal(dto.getColorFastnessRubbing(), SCALE_4));
        inspection.setPhValue(convertToBigDecimal(dto.getPhValue(), SCALE_2));
        inspection.setFormaldehydeContent(convertToBigDecimal(dto.getFormaldehydeContent(), SCALE_4));
        
        inspection.setHeavyMetals(dto.getHeavyMetals());
        inspection.setInspectionResult(dto.getInspectionResult());
        inspection.setReportUrl(dto.getReportUrl());
        inspection.setSyncStatus("SUCCESS");
        inspection.setRemark(dto.getRemark());
        
        save(inspection);
        log.info("第三方检测报告同步成功, 批次号: {}, 报告号: {}", dto.getBatchNo(), inspection.getReportNo());
    }

    private BigDecimal convertToBigDecimal(Double value, int scale) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP);
    }

    @DataSource(DataSourceType.QUALITY)
    public List<ThirdPartyInspection> getByBatchNo(String batchNo) {
        LambdaQueryWrapper<ThirdPartyInspection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ThirdPartyInspection::getBatchNo, batchNo);
        wrapper.orderByDesc(ThirdPartyInspection::getCreateTime);
        return list(wrapper);
    }

    @DataSource(DataSourceType.QUALITY)
    public List<ThirdPartyInspection> listByAgency(String inspectionAgency, String result) {
        LambdaQueryWrapper<ThirdPartyInspection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ThirdPartyInspection::getDeleted, 0);
        if (inspectionAgency != null) {
            wrapper.eq(ThirdPartyInspection::getInspectionAgency, inspectionAgency);
        }
        if (result != null) {
            wrapper.eq(ThirdPartyInspection::getInspectionResult, result);
        }
        wrapper.orderByDesc(ThirdPartyInspection::getCreateTime);
        return list(wrapper);
    }

    private String generateUniqueReportNo() {
        for (int i = 0; i < MAX_RETRY_TIMES; i++) {
            String reportNo = generateReportNo();
            LambdaQueryWrapper<ThirdPartyInspection> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(ThirdPartyInspection::getReportNo, reportNo);
            wrapper.last("LIMIT 1");
            if (getOne(wrapper) == null) {
                return reportNo;
            }
            log.warn("报告编号重复, 正在重试: {}, 第{}次重试", reportNo, i + 1);
        }
        throw new BusinessException("生成唯一报告编号失败，请稍后重试");
    }

    private String generateReportNo() {
        int seq = sequence.incrementAndGet() % 10000;
        return "TPR" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + String.format("%04d", seq)
                + IdUtil.nanoId(4);
    }
}
