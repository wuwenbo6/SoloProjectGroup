package com.papermanagement.controller;

import com.papermanagement.dto.Result;
import com.papermanagement.entity.AlertRule;
import com.papermanagement.entity.SmsLog;
import com.papermanagement.service.SmsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/sms")
public class SmsController {

    @Autowired
    private SmsService smsService;

    @GetMapping("/rules")
    public Result<List<AlertRule>> getAlertRules(@RequestParam(required = false) String processCode) {
        return smsService.getAlertRules(processCode);
    }

    @PostMapping("/rule")
    public Result<AlertRule> createAlertRule(@RequestBody AlertRule rule) {
        return smsService.createAlertRule(rule);
    }

    @GetMapping("/logs")
    public Result<List<SmsLog>> getSmsLogs(
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) String sendStatus) {
        return smsService.getSmsLogs(batchNo, sendStatus);
    }
}
