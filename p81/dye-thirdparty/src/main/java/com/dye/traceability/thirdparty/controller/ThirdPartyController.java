package com.dye.traceability.thirdparty.controller;

import com.dye.traceability.common.core.Result;
import com.dye.traceability.thirdparty.dto.ThirdPartyReportDTO;
import com.dye.traceability.thirdparty.entity.ThirdPartyInspection;
import com.dye.traceability.thirdparty.service.ThirdPartyService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "第三方检测机构对接接口")
@RestController
@RequestMapping("/api/thirdparty")
@RequiredArgsConstructor
public class ThirdPartyController {

    private final ThirdPartyService thirdPartyService;

    @ApiOperation("同步第三方检测报告")
    @PostMapping("/report/sync")
    public Result<Void> syncReport(@RequestBody ThirdPartyReportDTO dto) {
        thirdPartyService.syncReport(dto);
        return Result.success();
    }

    @ApiOperation("根据批次号查询第三方检测报告")
    @GetMapping("/report/batch/{batchNo}")
    public Result<List<ThirdPartyInspection>> getByBatchNo(@PathVariable String batchNo) {
        return Result.success(thirdPartyService.getByBatchNo(batchNo));
    }

    @ApiOperation("查询第三方检测报告列表")
    @GetMapping("/report/list")
    public Result<List<ThirdPartyInspection>> list(
            @RequestParam(required = false) String inspectionAgency,
            @RequestParam(required = false) String result) {
        return Result.success(thirdPartyService.listByAgency(inspectionAgency, result));
    }
}
