package com.dye.traceability.batch.controller;

import com.dye.traceability.batch.entity.FormulaBatch;
import com.dye.traceability.batch.service.BatchService;
import com.dye.traceability.common.core.Result;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "配方批次管理接口")
@RestController
@RequestMapping("/api/batch")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;

    @ApiOperation("创建配方批次")
    @PostMapping
    public Result<Void> createBatch(@RequestBody FormulaBatch batch) {
        batchService.createBatch(batch);
        return Result.success();
    }

    @ApiOperation("查询批次列表")
    @GetMapping("/list")
    public Result<List<FormulaBatch>> list(
            @RequestParam(required = false) String formulaNo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String workshop) {
        return Result.success(batchService.listByCondition(formulaNo, status, workshop));
    }

    @ApiOperation("根据批次号查询详情")
    @GetMapping("/{batchNo}")
    public Result<FormulaBatch> getByBatchNo(@PathVariable String batchNo) {
        return Result.success(batchService.getByBatchNo(batchNo));
    }
}
