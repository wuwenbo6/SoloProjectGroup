package com.ancientbook.process.controller;

import com.ancientbook.process.entity.ProcessVersion;
import com.ancientbook.process.service.ProcessVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/process/version")
@RequiredArgsConstructor
public class ProcessVersionController {

    private final ProcessVersionService versionService;

    @PostMapping("/{processCode}")
    public ProcessVersion createVersion(
            @PathVariable String processCode,
            @RequestBody ProcessVersion version) {
        return versionService.createVersion(processCode, version);
    }

    @PostMapping("/{versionCode}/audit")
    public ProcessVersion auditVersion(
            @PathVariable String versionCode,
            @RequestParam String auditorId,
            @RequestParam String auditorName,
            @RequestParam String auditOpinion,
            @RequestParam boolean passed) {
        return versionService.auditVersion(versionCode, auditorId, auditorName, auditOpinion, passed);
    }

    @GetMapping("/{versionCode}")
    public ProcessVersion getVersionByCode(@PathVariable String versionCode) {
        return versionService.getVersionByCode(versionCode);
    }

    @GetMapping("/list/{processCode}")
    public List<ProcessVersion> getVersionsByProcessCode(@PathVariable String processCode) {
        return versionService.getVersionsByProcessCode(processCode);
    }

    @GetMapping("/current/{processCode}")
    public ProcessVersion getCurrentVersion(@PathVariable String processCode) {
        return versionService.getCurrentVersion(processCode);
    }

    @PostMapping("/{processCode}/rollback/{versionCode}")
    public ProcessVersion rollbackVersion(
            @PathVariable String processCode,
            @PathVariable String versionCode) {
        return versionService.rollbackVersion(processCode, versionCode);
    }

    @GetMapping("/compare/{processCode}")
    public Map<String, Object> compareVersions(
            @PathVariable String processCode,
            @RequestParam String versionCode1,
            @RequestParam String versionCode2) {
        return versionService.getVersionComparison(processCode, versionCode1, versionCode2);
    }

    @DeleteMapping("/{versionCode}")
    public Map<String, Object> deleteVersion(@PathVariable String versionCode) {
        boolean success = versionService.deleteVersion(versionCode);
        return Map.of(
                "success", success,
                "message", success ? "删除成功" : "删除失败"
        );
    }
}
