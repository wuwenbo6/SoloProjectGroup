package com.ancientbook.archive.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.common.util.DistributedLock;
import com.ancientbook.archive.service.ArchiveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/archive")
@RequiredArgsConstructor
public class ArchiveController {

    private final ArchiveService archiveService;
    private final DistributedLock distributedLock;

    @PostMapping("/generate")
    public Result<Map<String, Object>> generateArchive(@RequestBody Map<String, Object> repairData) {
        String bookCode = (String) repairData.get("bookCode");
        String lockKey = "archive:generate:" + bookCode;

        return distributedLock.executeWithLock(lockKey, 5000, () -> {
            log.info("获取锁成功，开始生成归档: bookCode={}", bookCode);
            Map<String, Object> result = archiveService.generateArchiveContent(repairData);
            return Result.success(result);
        });
    }

    @GetMapping("/{archiveCode}/export")
    public Result<String> exportArchive(@PathVariable String archiveCode,
                                        @RequestBody Map<String, Object> archiveData) {
        String content = archiveService.exportArchive(archiveData);
        return Result.success(content);
    }
}
