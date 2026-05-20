package com.mortise.tenon.controller;

import com.mortise.tenon.common.Result;
import com.mortise.tenon.entity.StressAnalysis;
import com.mortise.tenon.repository.StressAnalysisRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/stress")
@CrossOrigin(origins = "*")
public class StressAnalysisController {

    @Autowired
    private StressAnalysisRepository stressAnalysisRepository;

    @GetMapping("/list")
    public Result<List<StressAnalysis>> list() {
        return Result.success(stressAnalysisRepository.findAll());
    }

    @GetMapping("/model/{modelId}")
    public Result<List<StressAnalysis>> getByModelId(@PathVariable Long modelId) {
        return Result.success(stressAnalysisRepository.findByModelId(modelId));
    }

    @GetMapping("/model/{modelId}/type/{analysisType}")
    public Result<List<StressAnalysis>> getByModelIdAndType(
            @PathVariable Long modelId,
            @PathVariable String analysisType) {
        return Result.success(stressAnalysisRepository.findByModelIdAndAnalysisType(modelId, analysisType));
    }

    @GetMapping("/validated")
    public Result<List<StressAnalysis>> getValidated() {
        return Result.success(stressAnalysisRepository.findByIsValidatedTrue());
    }

    @GetMapping("/{id}")
    public Result<StressAnalysis> getById(@PathVariable Long id) {
        return stressAnalysisRepository.findById(id)
                .map(Result::success)
                .orElse(Result.error("分析结果不存在"));
    }

    @GetMapping("/code/{analysisCode}")
    public Result<StressAnalysis> getByCode(@PathVariable String analysisCode) {
        return stressAnalysisRepository.findByAnalysisCode(analysisCode)
                .map(Result::success)
                .orElse(Result.error("分析结果不存在"));
    }

    @PostMapping
    public Result<StressAnalysis> create(@RequestBody StressAnalysis stressAnalysis) {
        return Result.success(stressAnalysisRepository.save(stressAnalysis));
    }

    @PutMapping
    public Result<StressAnalysis> update(@RequestBody StressAnalysis stressAnalysis) {
        return Result.success(stressAnalysisRepository.save(stressAnalysis));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        stressAnalysisRepository.deleteById(id);
        return Result.success();
    }

    @DeleteMapping("/model/{modelId}")
    public Result<Void> deleteByModelId(@PathVariable Long modelId) {
        stressAnalysisRepository.deleteByModelId(modelId);
        return Result.success();
    }

    @PostMapping("/{id}/validate")
    public Result<StressAnalysis> validateAnalysis(@PathVariable Long id) {
        return stressAnalysisRepository.findById(id).map(analysis -> {
            analysis.setIsValidated(true);
            return Result.success(stressAnalysisRepository.save(analysis));
        }).orElse(Result.error("分析结果不存在"));
    }
}