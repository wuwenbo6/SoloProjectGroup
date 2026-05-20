package com.papermanagement.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.ProcessLog;
import com.papermanagement.entity.ProcessNode;
import com.papermanagement.service.ProcessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/process")
public class ProcessController {

    @Autowired
    private ProcessService processService;

    @PostMapping("/start")
    public Result<ProcessLog> startProcess(@RequestBody ProcessLog processLog) {
        return processService.startProcess(processLog);
    }

    @PutMapping("/complete/{id}")
    public Result<ProcessLog> completeProcess(@PathVariable Long id, @RequestBody Map<String, String> params) {
        return processService.completeProcess(id, params.get("parameters"));
    }

    @GetMapping("/list")
    public Result<IPage<ProcessLog>> getProcessLogList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String batchNo,
            @RequestParam(required = false) Long craftsmanId) {
        return processService.getProcessLogList(page, size, batchNo, craftsmanId);
    }

    @GetMapping("/nodes")
    public Result<List<ProcessNode>> getProcessNodeList() {
        return processService.getProcessNodeList();
    }

    @GetMapping("/abnormal")
    public Result<List<ProcessLog>> getAbnormalList() {
        return processService.getAbnormalList();
    }

    @PutMapping("/progress/{id}")
    public Result<ProcessLog> updateProgress(@PathVariable Long id, @RequestBody Map<String, Object> params) {
        int progress = (Integer) params.getOrDefault("progress", 0);
        String remark = (String) params.get("remark");
        return processService.updateProgress(id, progress, remark);
    }

    @PutMapping("/abnormal/{id}")
    public Result<ProcessLog> reportAbnormal(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String reason = params.get("reason");
        return processService.reportAbnormal(id, reason);
    }
}
