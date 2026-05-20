package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.Material;
import com.papermanagement.entity.ProcessLog;
import com.papermanagement.entity.QualityReport;
import com.papermanagement.entity.TraceRecord;
import com.papermanagement.mapper.MaterialMapper;
import com.papermanagement.mapper.ProcessLogMapper;
import com.papermanagement.mapper.QualityReportMapper;
import com.papermanagement.mapper.TraceRecordMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class TraceService {

    private static final Logger logger = LoggerFactory.getLogger(TraceService.class);
    private static final int MAX_RETRY_TIMES = 5;

    @Autowired
    private TraceRecordMapper traceRecordMapper;

    @Autowired
    private MaterialMapper materialMapper;

    @Autowired
    private ProcessLogMapper processLogMapper;

    @Autowired
    private QualityReportMapper qualityReportMapper;

    @Transactional(rollbackFor = Exception.class)
    public Result<TraceRecord> generateTraceCode(String batchNo, Long userId) {
        String idempotentKey = generateIdempotentKey(batchNo, userId);

        LambdaQueryWrapper<TraceRecord> existWrapper = new LambdaQueryWrapper<>();
        existWrapper.eq(TraceRecord::getIdempotentKey, idempotentKey);
        TraceRecord existRecord = traceRecordMapper.selectOne(existWrapper);
        if (existRecord != null) {
            logger.info("幂等命中，直接返回已存在的溯源码: {}", existRecord.getTraceCode());
            return Result.success(existRecord);
        }

        int retryCount = 0;
        while (retryCount < MAX_RETRY_TIMES) {
            try {
                String traceCode = generateUniqueTraceCode();

                TraceRecord record = new TraceRecord();
                record.setTraceCode(traceCode);
                record.setBatchNo(batchNo);
                record.setIdempotentKey(idempotentKey);
                record.setStatus("ACTIVE");
                record.setCreateUserId(userId);
                record.setGenerateTime(LocalDateTime.now());
                record.setVerifyCount(0);

                traceRecordMapper.insert(record);
                logger.info("溯源码生成成功: {}, 批次号: {}, 重试次数: {}", traceCode, batchNo, retryCount);
                return Result.success("溯源码生成成功", record);

            } catch (DuplicateKeyException e) {
                retryCount++;
                logger.warn("溯源码重复，进行第{}次重试", retryCount);
                if (retryCount >= MAX_RETRY_TIMES) {
                    logger.error("溯源码生成失败，已达到最大重试次数: {}", MAX_RETRY_TIMES);
                    return Result.error("溯源码生成失败，请稍后重试");
                }
                try {
                    Thread.sleep(10 * retryCount);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return Result.error("生成过程被中断");
                }
            }
        }
        return Result.error("溯源码生成失败，请稍后重试");
    }

    private String generateUniqueTraceCode() {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String random = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        String nanoTime = String.valueOf(System.nanoTime()).substring(0, 4);
        return "TC" + timestamp + random + nanoTime;
    }

    private String generateIdempotentKey(String batchNo, Long userId) {
        try {
            String raw = batchNo + "_" + userId + "_" + LocalDateTime.now().toLocalDate();
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(raw.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString().substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return "IDEMP_" + batchNo + "_" + userId + "_" + System.currentTimeMillis();
        }
    }

    public Result<Map<String, Object>> verifyTraceCode(String traceCode) {
        LambdaQueryWrapper<TraceRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceRecord::getTraceCode, traceCode);
        TraceRecord record = traceRecordMapper.selectOne(wrapper);

        if (record == null) {
            return Result.error("溯源码不存在");
        }

        if (!"ACTIVE".equals(record.getStatus())) {
            return Result.error("溯源码已失效");
        }

        record.setVerifyCount(record.getVerifyCount() + 1);
        record.setVerifyTime(LocalDateTime.now());
        traceRecordMapper.updateById(record);

        Map<String, Object> result = new HashMap<>();
        result.put("traceInfo", record);

        LambdaQueryWrapper<Material> materialWrapper = new LambdaQueryWrapper<>();
        materialWrapper.eq(Material::getBatchNo, record.getBatchNo());
        java.util.List<Material> materials = materialMapper.selectList(materialWrapper);
        result.put("materials", materials);

        LambdaQueryWrapper<ProcessLog> processWrapper = new LambdaQueryWrapper<>();
        processWrapper.eq(ProcessLog::getBatchNo, record.getBatchNo());
        processWrapper.orderByAsc(ProcessLog::getStartTime);
        java.util.List<ProcessLog> processLogs = processLogMapper.selectList(processWrapper);
        result.put("processLogs", processLogs);

        LambdaQueryWrapper<QualityReport> qualityWrapper = new LambdaQueryWrapper<>();
        qualityWrapper.eq(QualityReport::getBatchNo, record.getBatchNo());
        java.util.List<QualityReport> qualityReports = qualityReportMapper.selectList(qualityWrapper);
        result.put("qualityReports", qualityReports);

        return Result.success(result);
    }

    public Result<IPage<TraceRecord>> getTraceList(Integer page, Integer size, String batchNo) {
        Page<TraceRecord> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<TraceRecord> wrapper = new LambdaQueryWrapper<>();
        if (batchNo != null && !batchNo.isEmpty()) {
            wrapper.eq(TraceRecord::getBatchNo, batchNo);
        }
        wrapper.orderByDesc(TraceRecord::getCreateTime);
        IPage<TraceRecord> result = traceRecordMapper.selectPage(pageParam, wrapper);
        return Result.success(result);
    }
}
