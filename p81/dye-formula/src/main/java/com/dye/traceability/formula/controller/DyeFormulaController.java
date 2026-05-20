package com.dye.traceability.formula.controller;

import com.dye.traceability.common.core.Result;
import com.dye.traceability.formula.entity.DyeFormula;
import com.dye.traceability.formula.service.DyeFormulaService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Api(tags = "染料配方接口")
@RestController
@RequestMapping("/api/formula")
@RequiredArgsConstructor
public class DyeFormulaController {

    private final DyeFormulaService dyeFormulaService;

    @ApiOperation("新增染料配方")
    @PostMapping
    public Result<Void> save(@RequestBody DyeFormula formula) {
        dyeFormulaService.saveFormula(formula);
        return Result.success();
    }

    @ApiOperation("获取配方详情")
    @GetMapping("/{id}")
    public Result<DyeFormula> getDetail(@PathVariable Long id) {
        return Result.success(dyeFormulaService.getDetail(id));
    }

    @ApiOperation("查询配方列表")
    @GetMapping("/list")
    public Result<List<DyeFormula>> list(
            @RequestParam(required = false) String colorSystem,
            @RequestParam(required = false) String colorCode,
            @RequestParam(required = false) String keyword) {
        return Result.success(dyeFormulaService.listByCondition(colorSystem, colorCode, keyword));
    }

    @ApiOperation("配方过期预警")
    @GetMapping("/expire-warning")
    public Result<Map<String, List<DyeFormula>>> getExpireWarning(
            @RequestParam(required = false, defaultValue = "30") Integer warningDays) {
        return Result.success(dyeFormulaService.getExpireWarning(warningDays));
    }

    @ApiOperation("按原料产地查询配方")
    @GetMapping("/origin")
    public Result<Map<String, List<DyeFormula>>> getFormulaByOrigin(
            @RequestParam(required = false) String originPlace) {
        return Result.success(dyeFormulaService.getFormulaByOrigin(originPlace));
    }
}
