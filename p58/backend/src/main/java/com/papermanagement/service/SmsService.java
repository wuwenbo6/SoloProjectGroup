package com.papermanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.AlertRule;
import com.papermanagement.entity.ProcessLog;
import com.papermanagement.entity.SmsLog;
import com.papermanagement.entity.User;
import com.papermanagement.mapper.AlertRuleMapper;
import com.papermanagement.mapper.ProcessLogMapper;
import com.papermanagement.mapper.SmsLogMapper;
import com.papermanagement.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SmsService {

    private static final Logger logger = LoggerFactory.getLogger(SmsService.class);

    @Value("${sms.enabled:true}")
    private boolean smsEnabled;

    @Value("${sms.provider:mock}")
    private String smsProvider;

    @Autowired
    private SmsLogMapper smsLogMapper;

    @Autowired
    private AlertRuleMapper alertRuleMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProcessLogMapper processLogMapper;

    @Async
    public void checkAndSendProcessAlert(Long processId, String parameters) {
        if (!smsEnabled) {
            logger.info("短信服务未启用，跳过发送");
            return;
        }

        ProcessLog processLog = processLogMapper.selectById(processId);
        if (processLog == null) {
            return;
        }

        LambdaQueryWrapper<AlertRule> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AlertRule::getProcessCode, processLog.getProcessCode());
        wrapper.eq(AlertRule::getStatus, 1);
        wrapper.eq(AlertRule::getEnableSms, 1);
        List<AlertRule> rules = alertRuleMapper.selectList(wrapper);

        if (rules.isEmpty()) {
            logger.info("工序{}没有配置短信预警规则，跳过发送", processLog.getProcessCode());
            return;
        }

        Map<String, String> paramMap = parseParameters(parameters);

        Set<String> alertMobiles = new HashSet<>();
        List<String> alertMessages = new ArrayList<>();

        for (AlertRule rule : rules) {
            String paramValue = paramMap.get(rule.getParamName());
            if (paramValue == null) {
                continue;
            }

            boolean isAbnormal = checkParamAbnormal(paramValue, rule);
            if (isAbnormal) {
                String message = buildAlertMessage(processLog, rule, paramValue);
                alertMessages.add(message);

                Set<String> ruleMobiles = getNotifyMobiles(rule);
                alertMobiles.addAll(ruleMobiles);
            }
        }

        if (!alertMobiles.isEmpty() && !alertMessages.isEmpty()) {
            String finalMessage = String.join("；", alertMessages);
            for (String mobile : alertMobiles) {
                sendSmsAsync(mobile, finalMessage, processLog.getBatchNo(), processLog.getProcessCode(), "PARAM_ALERT");
            }
            processLog.setAbnormalFlag("ABNORMAL");
            processLog.setAbnormalDesc(String.join("；", alertMessages));
            processLogMapper.updateById(processLog);
        }
    }

    private Map<String, String> parseParameters(String parameters) {
        Map<String, String> paramMap = new HashMap<>();
        if (parameters == null || parameters.isEmpty()) {
            return paramMap;
        }
        try {
            String[] pairs = parameters.split(",");
            for (String pair : pairs) {
                String[] keyValue = pair.split(":", 2);
                if (keyValue.length == 2) {
                    paramMap.put(keyValue[0].trim(), keyValue[1].trim());
                }
            }
        } catch (Exception e) {
            logger.warn("参数解析失败: {}", parameters);
        }
        return paramMap;
    }

    private boolean checkParamAbnormal(String paramValue, AlertRule rule) {
        try {
            BigDecimal value = new BigDecimal(paramValue);
            boolean abnormal = false;

            if (rule.getThresholdMax() != null && !rule.getThresholdMax().isEmpty()) {
                BigDecimal max = new BigDecimal(rule.getThresholdMax());
                if (value.compareTo(max) > 0) {
                    abnormal = true;
                }
            }

            if (rule.getThresholdMin() != null && !rule.getThresholdMin().isEmpty()) {
                BigDecimal min = new BigDecimal(rule.getThresholdMin());
                if (value.compareTo(min) < 0) {
                    abnormal = true;
                }
            }

            return abnormal;
        } catch (Exception e) {
            logger.warn("参数值校验失败: {}", paramValue);
            return false;
        }
    }

    private String buildAlertMessage(ProcessLog processLog, AlertRule rule, String actualValue) {
        return String.format("[古法造纸预警]批次%s工序%s参数%s异常，当前值:%s，阈值范围:%s-%s，请及时处理！",
                processLog.getBatchNo(),
                processLog.getProcessName(),
                rule.getParamName(),
                actualValue,
                rule.getThresholdMin() != null ? rule.getThresholdMin() : "无下限",
                rule.getThresholdMax() != null ? rule.getThresholdMax() : "无上限");
    }

    private Set<String> getNotifyMobiles(AlertRule rule) {
        Set<String> mobiles = new HashSet<>();
        if (rule.getNotifyMobiles() != null && !rule.getNotifyMobiles().isEmpty()) {
            String[] mobileArray = rule.getNotifyMobiles().split(",");
            for (String mobile : mobileArray) {
                if (mobile.trim().length() == 11) {
                    mobiles.add(mobile.trim());
                }
            }
        }

        if (rule.getNotifyRoles() != null && !rule.getNotifyRoles().isEmpty()) {
            String[] roles = rule.getNotifyRoles().split(",");
            LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
            wrapper.in(User::getRole, Arrays.asList(roles));
            wrapper.isNotNull(User::getPhone);
            List<User> users = userMapper.selectList(wrapper);
            for (User user : users) {
                if (user.getPhone() != null && user.getPhone().length() == 11) {
                    mobiles.add(user.getPhone());
                }
            }
        }

        return mobiles;
    }

    @Async
    public void sendSmsAsync(String mobile, String content, String batchNo, String processCode, String alertType) {
        SmsLog smsLog = new SmsLog();
        smsLog.setMobile(mobile);
        smsLog.setContent(content);
        smsLog.setBatchNo(batchNo);
        smsLog.setProcessCode(processCode);
        smsLog.setAlertType(alertType);
        smsLog.setSendTime(LocalDateTime.now());

        try {
            boolean success = sendSms(mobile, content);
            if (success) {
                smsLog.setSendStatus("SUCCESS");
                smsLog.setResultCode("0");
                smsLog.setResultMsg("发送成功");
                logger.info("短信发送成功: mobile={}, content={}", mobile, content);
            } else {
                smsLog.setSendStatus("FAIL");
                smsLog.setResultCode("-1");
                smsLog.setResultMsg("发送失败");
                logger.warn("短信发送失败: mobile={}", mobile);
            }
        } catch (Exception e) {
            smsLog.setSendStatus("FAIL");
            smsLog.setResultCode("-2");
            smsLog.setResultMsg(e.getMessage());
            logger.error("短信发送异常: mobile={}, error={}", mobile, e.getMessage());
        }

        smsLogMapper.insert(smsLog);
    }

    private boolean sendSms(String mobile, String content) {
        if ("mock".equals(smsProvider)) {
            logger.info("[MOCK SMS] To: {}, Content: {}", mobile, content);
            return true;
        }
        return true;
    }

    public Result<List<AlertRule>> getAlertRules(String processCode) {
        LambdaQueryWrapper<AlertRule> wrapper = new LambdaQueryWrapper<>();
        if (processCode != null && !processCode.isEmpty()) {
            wrapper.eq(AlertRule::getProcessCode, processCode);
        }
        wrapper.orderByAsc(AlertRule::getProcessCode);
        List<AlertRule> rules = alertRuleMapper.selectList(wrapper);
        return Result.success(rules);
    }

    public Result<AlertRule> createAlertRule(AlertRule rule) {
        rule.setStatus(1);
        alertRuleMapper.insert(rule);
        return Result.success("预警规则创建成功", rule);
    }

    public Result<List<SmsLog>> getSmsLogs(String batchNo, String sendStatus) {
        LambdaQueryWrapper<SmsLog> wrapper = new LambdaQueryWrapper<>();
        if (batchNo != null && !batchNo.isEmpty()) {
            wrapper.eq(SmsLog::getBatchNo, batchNo);
        }
        if (sendStatus != null && !sendStatus.isEmpty()) {
            wrapper.eq(SmsLog::getSendStatus, sendStatus);
        }
        wrapper.orderByDesc(SmsLog::getCreateTime);
        List<SmsLog> logs = smsLogMapper.selectList(wrapper);
        return Result.success(logs);
    }
}
