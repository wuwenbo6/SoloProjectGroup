package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.ProcessLog;
import com.papermanagement.entity.ProcessNode;
import com.papermanagement.mapper.ProcessLogMapper;
import com.papermanagement.mapper.ProcessNodeMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProcessService {

    private static final Logger logger = LoggerFactory.getLogger(ProcessService.class);

    @Autowired
    private ProcessLogMapper processLogMapper;

    @Autowired
    private ProcessNodeMapper processNodeMapper;

    @Autowired
    private ProcessSyncService processSyncService;

    @Autowired
    private SmsService smsService;

    public Result<ProcessLog> startProcess(ProcessLog processLog) {
        processLog.setStartTime(LocalDateTime.now());
        processLog.setStatus("PROCESSING");
        processLog.setAbnormalFlag("NORMAL");
        processLogMapper.insert(processLog);

        processSyncService.broadcastProcessUpdate(processLog, 0);
        logger.info("工序开始，推送实时更新: batchNo={}, processCode={}",
                processLog.getBatchNo(), processLog.getProcessCode());

        return Result.success("工序开始成功", processLog);
    }

    public Result<ProcessLog> completeProcess(Long id, String parameters) {
        ProcessLog processLog = processLogMapper.selectById(id);
        if (processLog == null) {
            return Result.error("工序记录不存在");
        }
        processLog.setEndTime(LocalDateTime.now());
        processLog.setParameters(parameters);
        processLog.setStatus("COMPLETED");
        processLogMapper.updateById(processLog);

        processSyncService.broadcastProcessUpdate(processLog, 100);
        processSyncService.broadcastProcessComplete(processLog);
        logger.info("工序完成，推送实时更新: batchNo={}, processCode={}",
                processLog.getBatchNo(), processLog.getProcessCode());

        smsService.checkAndSendProcessAlert(id, parameters);

        return Result.success("工序完成成功", processLog);
    }

    public Result<ProcessLog> updateProgress(Long id, int progress, String remark) {
        ProcessLog processLog = processLogMapper.selectById(id);
        if (processLog == null) {
            return Result.error("工序记录不存在");
        }

        if (remark != null && !remark.isEmpty()) {
            processLog.setRemark(remark);
        }
        processLogMapper.updateById(processLog);

        processSyncService.broadcastProcessUpdate(processLog, progress);

        return Result.success("进度更新成功", processLog);
    }

    public Result<ProcessLog> reportAbnormal(Long id, String reason) {
        ProcessLog processLog = processLogMapper.selectById(id);
        if (processLog == null) {
            return Result.error("工序记录不存在");
        }
        processLog.setAbnormalFlag("ABNORMAL");
        processLog.setAbnormalDesc(reason);
        processLogMapper.updateById(processLog);

        processSyncService.broadcastAbnormalWarning(processLog, reason);
        logger.warn("工序异常，推送警告: batchNo={}, processCode={}, reason={}",
                processLog.getBatchNo(), processLog.getProcessCode(), reason);

        return Result.success("异常已记录", processLog);
    }

    public Result<IPage<ProcessLog>> getProcessLogList(Integer page, Integer size, String batchNo, Long craftsmanId) {
        Page<ProcessLog> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<ProcessLog> wrapper = new LambdaQueryWrapper<>();
        if (batchNo != null && !batchNo.isEmpty()) {
            wrapper.eq(ProcessLog::getBatchNo, batchNo);
        }
        if (craftsmanId != null) {
            wrapper.eq(ProcessLog::getCraftsmanId, craftsmanId);
        }
        wrapper.orderByDesc(ProcessLog::getCreateTime);
        IPage<ProcessLog> result = processLogMapper.selectPage(pageParam, wrapper);
        return Result.success(result);
    }

    public Result<List<ProcessNode>> getProcessNodeList() {
        LambdaQueryWrapper<ProcessNode> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProcessNode::getStatus, 1);
        wrapper.orderByAsc(ProcessNode::getSortOrder);
        List<ProcessNode> list = processNodeMapper.selectList(wrapper);
        return Result.success(list);
    }

    public Result<List<ProcessLog>> getAbnormalList() {
        LambdaQueryWrapper<ProcessLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProcessLog::getAbnormalFlag, "ABNORMAL");
        wrapper.orderByDesc(ProcessLog::getCreateTime);
        List<ProcessLog> list = processLogMapper.selectList(wrapper);
        return Result.success(list);
    }
}
