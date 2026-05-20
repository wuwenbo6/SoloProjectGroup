package com.mortise.tenon.controller;

import com.alibaba.fastjson.JSONObject;
import com.mortise.tenon.common.Result;
import com.mortise.tenon.service.RestorationSimulationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/restoration")
@CrossOrigin(origins = "*")
public class RestorationSimulationController {

    @Autowired
    private RestorationSimulationService simulationService;

    @GetMapping("/plans")
    public Result<?> listPlans() {
        return Result.success(simulationService.listPlans());
    }

    @GetMapping("/plan/{planId}")
    public Result<?> getPlanDetail(@PathVariable String planId) {
        JSONObject result = simulationService.getPlanDetail(planId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @GetMapping("/damage-cases")
    public Result<?> listDamageCases() {
        return Result.success(simulationService.listDamageCases());
    }

    @GetMapping("/damage/{damageId}")
    public Result<?> getDamageCaseDetail(@PathVariable String damageId) {
        JSONObject result = simulationService.getDamageCaseDetail(damageId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @PostMapping("/simulation/start")
    public Result<?> startSimulation(@RequestBody JSONObject params) {
        String planId = params.getString("planId");
        String userId = params.getString("userId");
        JSONObject result = simulationService.startSimulation(planId, userId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @PostMapping("/simulation/update")
    public Result<?> updateSimulationStep(@RequestBody JSONObject params) {
        String sessionId = params.getString("sessionId");
        double accuracy = params.getDoubleValue("accuracy");
        boolean stepComplete = params.getBooleanValue("stepComplete");
        JSONObject result = simulationService.updateSimulationStep(sessionId, accuracy, stepComplete);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @GetMapping("/simulation/{sessionId}")
    public Result<?> getSimulationState(@PathVariable String sessionId) {
        JSONObject result = simulationService.getSimulationState(sessionId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @PostMapping("/simulation/pause")
    public Result<?> pauseSimulation(@RequestBody JSONObject params) {
        String sessionId = params.getString("sessionId");
        JSONObject result = simulationService.pauseSimulation(sessionId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @PostMapping("/simulation/resume")
    public Result<?> resumeSimulation(@RequestBody JSONObject params) {
        String sessionId = params.getString("sessionId");
        JSONObject result = simulationService.resumeSimulation(sessionId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }

    @PostMapping("/simulation/end")
    public Result<?> endSimulation(@RequestBody JSONObject params) {
        String sessionId = params.getString("sessionId");
        JSONObject result = simulationService.endSimulation(sessionId);
        return result.getBoolean("success") ? Result.success(result) : Result.error(result.getString("message")));
    }
}
