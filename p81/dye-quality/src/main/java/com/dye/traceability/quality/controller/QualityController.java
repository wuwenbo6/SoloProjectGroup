package com.dye.traceability.quality.controller;

import com.dye.traceability.common.core.Result;
import com.dye.traceability.quality.dto.QualityInspectionDTO;
import com.dye.traceability.quality.entity.QualityInspection;
import com.dye.traceability.quality.service.QualityService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "品质检测接口")
@RestController
@RequestMapping("/api/quality")
@RequiredArgsConstructor
public class QualityController {

    private final QualityService qualityService;

    @ApiOperation("新增品质检测记录")
    @PostMapping
    public Result<Void> save(@RequestBody QualityInspectionDTO dto) {
        qualityService.saveInspection(dto);
        return Result.success();
    }

    @ApiOperation("根据批次号查询品质记录")
    @GetMapping("/batch/{batchNo}")
    public Result<List<QualityInspection>> getByBatchNo(@PathVariable String batchNo) {
        return Result.success(qualityService.getByBatchNo(batchNo));
    }

    @ApiOperation("查询品质检测列表")
    @GetMapping("/list")
    public Result<List<QualityInspection>> list(
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String type) {
        return Result.success(qualityService.listByCondition(result, type));
    }
}
