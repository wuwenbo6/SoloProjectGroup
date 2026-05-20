package com.dye.traceability.trace.controller;

import com.dye.traceability.common.core.Result;
import com.dye.traceability.trace.dto.TraceExportDTO;
import com.dye.traceability.trace.entity.MaterialTrace;
import com.dye.traceability.trace.entity.ProcessTrace;
import com.dye.traceability.trace.service.TraceService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Api(tags = "原料溯源接口")
@RestController
@RequestMapping("/api/trace")
@RequiredArgsConstructor
public class TraceController {

    private final TraceService traceService;

    @ApiOperation("新增原料溯源记录")
    @PostMapping("/material")
    public Result<Void> saveMaterialTrace(@RequestBody MaterialTrace trace) {
        traceService.saveMaterialTrace(trace);
        return Result.success();
    }

    @ApiOperation("新增加工溯源记录")
    @PostMapping("/process")
    public Result<Void> saveProcessTrace(@RequestBody ProcessTrace trace) {
        traceService.saveProcessTrace(trace);
        return Result.success();
    }

    @ApiOperation("根据批次号查询原料溯源")
    @GetMapping("/material/batch/{batchNo}")
    public Result<List<MaterialTrace>> getMaterialTrace(@PathVariable String batchNo) {
        return Result.success(traceService.getMaterialTraceByBatch(batchNo));
    }

    @ApiOperation("根据批次号查询加工溯源")
    @GetMapping("/process/batch/{batchNo}")
    public Result<List<ProcessTrace>> getProcessTrace(@PathVariable String batchNo) {
        return Result.success(traceService.getProcessTraceByBatch(batchNo));
    }

    @ApiOperation("溯源数据批量导出")
    @PostMapping("/export")
    public Result<Map<String, Object>> exportTraceData(@RequestBody TraceExportDTO dto) {
        return Result.success(traceService.exportTraceData(dto));
    }

    @ApiOperation("按原料产地查询关联工艺")
    @GetMapping("/process/origin")
    public Result<Map<String, List<ProcessTrace>>> getProcessByOrigin(
            @RequestParam(required = false) String originPlace) {
        return Result.success(traceService.getProcessByOrigin(originPlace));
    }
}
