package com.folk.activity.audit.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.folk.activity.audit.config.AuditMQConfig;
import com.folk.activity.audit.entity.AuditRecord;
import com.folk.activity.audit.mapper.AuditRecordMapper;
import com.folk.activity.common.core.result.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditController {
    private final AuditRecordMapper auditRecordMapper;
    private final RabbitTemplate rabbitTemplate;

    @PostMapping("/submit")
    public Result<AuditRecord> submitAudit(@RequestBody AuditRecord record) {
        record.setStatus(0);
        record.setCreateTime(LocalDateTime.now());
        auditRecordMapper.insert(record);
        
        Map<String, Object> message = Map.of(
            "auditId", record.getId(),
            "bizType", record.getBizType(),
            "bizId", record.getBizId(),
            "applicantId", record.getApplicantId(),
            "applicantName", record.getApplicantName(),
            "status", 0,
            "submitTime", LocalDateTime.now().toString()
        );
        rabbitTemplate.convertAndSend(AuditMQConfig.AUDIT_EXCHANGE, AuditMQConfig.AUDIT_ROUTING_KEY, message);
        
        return Result.success(record);
    }

    @PostMapping("/approve/{id}")
    public Result<Boolean> approve(@PathVariable Long id, 
                                    @RequestParam Long auditorId, 
                                    @RequestParam String auditorName,
                                    @RequestParam(required = false) String opinion) {
        AuditRecord record = auditRecordMapper.selectById(id);
        if (record == null) {
            return Result.fail("审核记录不存在");
        }
        
        if (record.getStatus() != 0) {
            return Result.fail("该记录已审核，不能重复审核");
        }
        
        record.setStatus(1);
        record.setAuditorId(auditorId);
        record.setAuditorName(auditorName);
        record.setAuditOpinion(opinion);
        record.setUpdateTime(LocalDateTime.now());
        auditRecordMapper.updateById(record);
        
        Map<String, Object> message = Map.of(
            "auditId", id,
            "bizType", record.getBizType(),
            "bizId", record.getBizId(),
            "applicantId", record.getApplicantId(),
            "status", 1,
            "auditorName", auditorName,
            "auditTime", LocalDateTime.now().toString(),
            "message", "审核已通过"
        );
        rabbitTemplate.convertAndSend(AuditMQConfig.AUDIT_EXCHANGE, AuditMQConfig.AUDIT_ROUTING_KEY, message);
        
        return Result.success(true);
    }

    @PostMapping("/reject/{id}")
    public Result<Boolean> reject(@PathVariable Long id, 
                                   @RequestParam Long auditorId, 
                                   @RequestParam String auditorName,
                                   @RequestParam String opinion) {
        AuditRecord record = auditRecordMapper.selectById(id);
        if (record == null) {
            return Result.fail("审核记录不存在");
        }
        
        if (record.getStatus() != 0) {
            return Result.fail("该记录已审核，不能重复审核");
        }
        
        record.setStatus(2);
        record.setAuditorId(auditorId);
        record.setAuditorName(auditorName);
        record.setAuditOpinion(opinion);
        record.setUpdateTime(LocalDateTime.now());
        auditRecordMapper.updateById(record);
        
        Map<String, Object> message = Map.of(
            "auditId", id,
            "bizType", record.getBizType(),
            "bizId", record.getBizId(),
            "applicantId", record.getApplicantId(),
            "status", 2,
            "auditorName", auditorName,
            "auditTime", LocalDateTime.now().toString(),
            "message", "审核未通过: " + opinion
        );
        rabbitTemplate.convertAndSend(AuditMQConfig.AUDIT_EXCHANGE, AuditMQConfig.AUDIT_ROUTING_KEY, message);
        
        return Result.success(true);
    }

    @GetMapping("/list/{applicantId}")
    public Result<List<AuditRecord>> getApplicantRecords(@PathVariable Long applicantId) {
        return Result.success(auditRecordMapper.selectList(new LambdaQueryWrapper<AuditRecord>()
                .eq(AuditRecord::getApplicantId, applicantId)
                .orderByDesc(AuditRecord::getCreateTime))));
    }

    @GetMapping("/pending")
    public Result<List<AuditRecord>> getPendingRecords() {
        return Result.success(auditRecordMapper.selectList(new LambdaQueryWrapper<AuditRecord>()
                .eq(AuditRecord::getStatus, 0)
                .orderByAsc(AuditRecord::getCreateTime))));
    }
}
