package com.ancientbook.process.service;

import com.ancientbook.process.entity.ProcessVersion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessVersionService {

    private final Map<String, ProcessVersion> versionStore = new ConcurrentHashMap<>();

    public ProcessVersion createVersion(String processCode, ProcessVersion version) {
        List<ProcessVersion> existingVersions = getVersionsByProcessCode(processCode);
        int nextMajor = 1;
        int nextMinor = 0;
        int nextPatch = 0;

        if (!existingVersions.isEmpty()) {
            ProcessVersion latest = existingVersions.get(0);
            nextMajor = latest.getMajorVersion();
            nextMinor = latest.getMinorVersion();
            nextPatch = latest.getPatchVersion() + 1;
        }

        if (version.getMajorVersion() != null) {
            nextMajor = version.getMajorVersion();
        }
        if (version.getMinorVersion() != null) {
            nextMinor = version.getMinorVersion();
        }
        if (version.getPatchVersion() != null) {
            nextPatch = version.getPatchVersion();
        }

        String versionCode = "V_" + processCode + "_" + nextMajor + "." + nextMinor + "." + nextPatch;

        ProcessVersion newVersion = new ProcessVersion();
        newVersion.setVersionCode(versionCode);
        newVersion.setProcessCode(processCode);
        newVersion.setProcessName(version.getProcessName());
        newVersion.setMajorVersion(nextMajor);
        newVersion.setMinorVersion(nextMinor);
        newVersion.setPatchVersion(nextPatch);
        newVersion.setVersionName(version.getVersionName() != null ?
                version.getVersionName() : "版本 " + nextMajor + "." + nextMinor + "." + nextPatch);
        newVersion.setDescription(version.getDescription());
        newVersion.setChangeLog(version.getChangeLog());
        newVersion.setProcessType(version.getProcessType());
        newVersion.setMaterials(version.getMaterials());
        newVersion.setTools(version.getTools());
        newVersion.setSteps(version.getSteps());
        newVersion.setStandard(version.getStandard());
        newVersion.setDifficultyLevel(version.getDifficultyLevel());
        newVersion.setApplicableMaterials(version.getApplicableMaterials());
        newVersion.setMinConditionLevel(version.getMinConditionLevel());
        newVersion.setMaxConditionLevel(version.getMaxConditionLevel());
        newVersion.setCreatorId(version.getCreatorId());
        newVersion.setCreatorName(version.getCreatorName());
        newVersion.setStatus(0);
        newVersion.setIsCurrent(false);
        newVersion.setCreateTime(LocalDateTime.now());
        newVersion.setRemark(version.getRemark());

        versionStore.put(versionCode, newVersion);
        log.info("创建工艺版本: {}", versionCode);
        return newVersion;
    }

    public ProcessVersion auditVersion(String versionCode, String auditorId,
                                       String auditorName, String auditOpinion, boolean passed) {
        ProcessVersion version = versionStore.get(versionCode);
        if (version == null) {
            throw new RuntimeException("版本不存在");
        }

        version.setAuditorId(auditorId);
        version.setAuditorName(auditorName);
        version.setAuditTime(LocalDateTime.now());
        version.setAuditOpinion(auditOpinion);
        version.setStatus(passed ? 1 : 2);

        if (passed) {
            versionStore.values().stream()
                    .filter(v -> v.getProcessCode().equals(version.getProcessCode()))
                    .forEach(v -> v.setIsCurrent(false));
            version.setIsCurrent(true);
            log.info("版本审核通过，设为当前版本: {}", versionCode);
        }

        return version;
    }

    public ProcessVersion getVersionByCode(String versionCode) {
        return versionStore.get(versionCode);
    }

    public List<ProcessVersion> getVersionsByProcessCode(String processCode) {
        return versionStore.values().stream()
                .filter(v -> processCode.equals(v.getProcessCode()))
                .sorted(Comparator.comparing(ProcessVersion::getMajorVersion).reversed()
                        .thenComparing(ProcessVersion::getMinorVersion).reversed()
                        .thenComparing(ProcessVersion::getPatchVersion).reversed())
                .collect(Collectors.toList());
    }

    public ProcessVersion getCurrentVersion(String processCode) {
        return versionStore.values().stream()
                .filter(v -> processCode.equals(v.getProcessCode()) && Boolean.TRUE.equals(v.getIsCurrent()))
                .findFirst()
                .orElse(null);
    }

    public ProcessVersion rollbackVersion(String processCode, String targetVersionCode) {
        ProcessVersion target = versionStore.get(targetVersionCode);
        if (target == null) {
            throw new RuntimeException("目标版本不存在");
        }

        if (!processCode.equals(target.getProcessCode())) {
            throw new RuntimeException("版本不属于指定工艺");
        }

        versionStore.values().stream()
                .filter(v -> processCode.equals(v.getProcessCode()))
                .forEach(v -> v.setIsCurrent(false));

        target.setIsCurrent(true);
        log.info("回滚到版本: {}", targetVersionCode);
        return target;
    }

    public Map<String, Object> getVersionComparison(String processCode, String versionCode1, String versionCode2) {
        ProcessVersion v1 = versionStore.get(versionCode1);
        ProcessVersion v2 = versionStore.get(versionCode2);

        if (v1 == null || v2 == null) {
            throw new RuntimeException("版本不存在");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("processCode", processCode);
        result.put("version1", toVersionInfo(v1));
        result.put("version2", toVersionInfo(v2));

        List<Map<String, Object>> differences = new ArrayList<>();
        checkDifference("processName", v1.getProcessName(), v2.getProcessName(), differences);
        checkDifference("processType", v1.getProcessType(), v2.getProcessType(), differences);
        checkDifference("materials", v1.getMaterials(), v2.getMaterials(), differences);
        checkDifference("tools", v1.getTools(), v2.getTools(), differences);
        checkDifference("steps", v1.getSteps(), v2.getSteps(), differences);
        checkDifference("standard", v1.getStandard(), v2.getStandard(), differences);
        checkDifference("difficultyLevel", v1.getDifficultyLevel(), v2.getDifficultyLevel(), differences);
        checkDifference("applicableMaterials", v1.getApplicableMaterials(), v2.getApplicableMaterials(), differences);
        checkDifference("minConditionLevel", v1.getMinConditionLevel(), v2.getMinConditionLevel(), differences);
        checkDifference("maxConditionLevel", v1.getMaxConditionLevel(), v2.getMaxConditionLevel(), differences);

        result.put("differences", differences);
        result.put("hasDifferences", !differences.isEmpty());
        return result;
    }

    private Map<String, Object> toVersionInfo(ProcessVersion v) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("versionCode", v.getVersionCode());
        info.put("versionNumber", v.getVersionNumber());
        info.put("versionName", v.getVersionName());
        info.put("processName", v.getProcessName());
        info.put("processType", v.getProcessType());
        info.put("materials", v.getMaterials());
        info.put("tools", v.getTools());
        info.put("steps", v.getSteps());
        info.put("difficultyLevel", v.getDifficultyLevel());
        info.put("status", v.getStatus());
        info.put("isCurrent", v.getIsCurrent());
        info.put("creatorName", v.getCreatorName());
        info.put("createTime", v.getCreateTime());
        return info;
    }

    private void checkDifference(String field, Object value1, Object value2, List<Map<String, Object>> differences) {
        boolean different = !Objects.equals(value1, value2);
        if (different) {
            Map<String, Object> diff = new LinkedHashMap<>();
            diff.put("field", field);
            diff.put("value1", value1);
            diff.put("value2", value2);
            differences.add(diff);
        }
    }

    public boolean deleteVersion(String versionCode) {
        ProcessVersion version = versionStore.get(versionCode);
        if (version == null) {
            return false;
        }
        if (Boolean.TRUE.equals(version.getIsCurrent())) {
            throw new RuntimeException("不能删除当前使用中的版本");
        }
        versionStore.remove(versionCode);
        log.info("删除版本: {}", versionCode);
        return true;
    }
}
