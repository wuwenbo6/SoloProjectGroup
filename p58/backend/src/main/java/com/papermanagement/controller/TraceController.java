package com.papermanagement.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.papermanagement.dto.Result;
import com.papermanagement.entity.TraceRecord;
import com.papermanagement.service.TraceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/trace")
public class TraceController {

    @Autowired
    private TraceService traceService;

    @PostMapping("/generate")
    public Result<TraceRecord> generateTraceCode(@RequestBody Map<String, String> params, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return traceService.generateTraceCode(params.get("batchNo"), userId);
    }

    @GetMapping("/verify/{traceCode}")
    public Result<Map<String, Object>> verifyTraceCode(@PathVariable String traceCode) {
        return traceService.verifyTraceCode(traceCode);
    }

    @GetMapping("/list")
    public Result<IPage<TraceRecord>> getTraceList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String batchNo) {
        return traceService.getTraceList(page, size, batchNo);
    }
}
