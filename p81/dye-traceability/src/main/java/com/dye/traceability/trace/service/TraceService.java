package com.dye.traceability.trace.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.dye.traceability.common.datasource.DataSource;
import com.dye.traceability.common.datasource.DataSourceType;
import com.dye.traceability.common.exception.BusinessException;
import com.dye.traceability.trace.dto.TraceExportDTO;
import com.dye.traceability.trace.entity.MaterialTrace;
import com.dye.traceability.trace.entity.ProcessTrace;
import com.dye.traceability.trace.mapper.MaterialTraceMapper;
import com.dye.traceability.trace.mapper.ProcessTraceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class TraceService extends ServiceImpl<MaterialTraceMapper, MaterialTrace> {

    private final ProcessTraceMapper processTraceMapper;
    private static final int MAX_RETRY_TIMES = 10;
    private static final AtomicInteger sequence = new AtomicInteger(0);

    @DataSource(DataSourceType.TRACEABILITY)
    @Transactional(rollbackFor = Exception.class)
    public void saveMaterialTrace(MaterialTrace trace) {
        String traceCode = generateUniqueTraceCode("MT");
        trace.setTraceCode(traceCode);
        trace.setStatus(1);
        save(trace);
        log.info("原料溯源记录保存成功, traceCode: {}", traceCode);
    }

    @DataSource(DataSourceType.TRACEABILITY)
    @Transactional(rollbackFor = Exception.class)
    public void saveProcessTrace(ProcessTrace trace) {
        String processCode = generateUniqueTraceCode("PT");
        trace.setProcessCode(processCode);
        trace.setStatus(1);
        processTraceMapper.insert(trace);
        log.info("加工溯源记录保存成功, processCode: {}", processCode);
    }

    @DataSource(DataSourceType.TRACEABILITY)
    public List<MaterialTrace> getMaterialTraceByBatch(String batchNo) {
        LambdaQueryWrapper<MaterialTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MaterialTrace::getBatchNo, batchNo);
        wrapper.orderByDesc(MaterialTrace::getCreateTime);
        return list(wrapper);
    }

    @DataSource(DataSourceType.TRACEABILITY)
    public List<ProcessTrace> getProcessTraceByBatch(String batchNo) {
        LambdaQueryWrapper<ProcessTrace> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProcessTrace::getBatchNo, batchNo);
        wrapper.orderByAsc(ProcessTrace::getStartTime);
        return processTraceMapper.selectList(wrapper);
    }

    @DataSource(DataSourceType.TRACEABILITY)
    public Map<String, Object> exportTraceData(TraceExportDTO dto) {
        Map<String, Object> result = new HashMap<>();
        LocalDateTime startTime = dto.getStartTime();
        LocalDateTime endTime = dto.getEndTime();
        List<String> batchNos = dto.getBatchNos();

        if ("material".equals(dto.getTraceType()) || "all".equals(dto.getTraceType())) {
            LambdaQueryWrapper<MaterialTrace> materialWrapper = new LambdaQueryWrapper<>();
            if (batchNos != null && !batchNos.isEmpty()) {
                materialWrapper.in(MaterialTrace::getBatchNo, batchNos);
            }
            if (startTime != null) {
                materialWrapper.ge(MaterialTrace::getCreateTime, startTime);
            }
            if (endTime != null) {
                materialWrapper.le(MaterialTrace::getCreateTime, endTime);
            }
            materialWrapper.orderByDesc(MaterialTrace::getCreateTime);
            List<MaterialTrace> materialTraces = list(materialWrapper);
            result.put("materialTraces", materialTraces);
            log.info("导出原料溯源数据{}条", materialTraces.size());
        }

        if ("process".equals(dto.getTraceType()) || "all".equals(dto.getTraceType())) {
            LambdaQueryWrapper<ProcessTrace> processWrapper = new LambdaQueryWrapper<>();
            if (batchNos != null && !batchNos.isEmpty()) {
                processWrapper.in(ProcessTrace::getBatchNo, batchNos);
            }
            if (startTime != null) {
                processWrapper.ge(ProcessTrace::getCreateTime, startTime);
            }
            if (endTime != null) {
                processWrapper.le(ProcessTrace::getCreateTime, endTime);
            }
            processWrapper.orderByDesc(ProcessTrace::getCreateTime);
            List<ProcessTrace> processTraces = processTraceMapper.selectList(processWrapper);
            result.put("processTraces", processTraces);
            log.info("导出加工溯源数据{}条", processTraces.size());
        }

        result.put("exportTime", LocalDateTime.now());
        result.put("exportFormat", dto.getExportFormat());
        return result;
    }

    @DataSource(DataSourceType.TRACEABILITY)
    public Map<String, List<ProcessTrace>> getProcessByOrigin(String originPlace) {
        LambdaQueryWrapper<MaterialTrace> materialWrapper = new LambdaQueryWrapper<>();
        if (originPlace != null) {
            materialWrapper.like(MaterialTrace::getSupplierName, originPlace);
        }
        List<MaterialTrace> materials = list(materialWrapper);

        List<String> batchNos = materials.stream()
                .map(MaterialTrace::getBatchNo)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (batchNos.isEmpty()) {
            return new HashMap<>();
        }

        LambdaQueryWrapper<ProcessTrace> processWrapper = new LambdaQueryWrapper<>();
        processWrapper.in(ProcessTrace::getBatchNo, batchNos);
        List<ProcessTrace> processTraces = processTraceMapper.selectList(processWrapper);

        Map<String, List<ProcessTrace>> result = new HashMap<>();
        for (ProcessTrace process : processTraces) {
            result.computeIfAbsent(process.getBatchNo(), k -> new ArrayList<>()).add(process);
        }

        log.info("按产地查询工艺数据完成，共{}个批次，{}条工艺记录", batchNos.size(), processTraces.size());
        return result;
    }

    private String generateUniqueTraceCode(String prefix) {
        for (int i = 0; i < MAX_RETRY_TIMES; i++) {
            String traceCode = generateTraceCode(prefix);
            LambdaQueryWrapper<MaterialTrace> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(MaterialTrace::getTraceCode, traceCode);
            wrapper.last("LIMIT 1");
            if (getOne(wrapper) == null) {
                return traceCode;
            }
            log.warn("溯源码重复, 正在重试: {}, 第{}次重试", traceCode, i + 1);
        }
        throw new BusinessException("生成唯一溯源码失败，请稍后重试");
    }

    private String generateTraceCode(String prefix) {
        int seq = sequence.incrementAndGet() % 10000;
        return prefix + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"))
                + String.format("%04d", seq)
                + IdUtil.nanoId(4);
    }
}
