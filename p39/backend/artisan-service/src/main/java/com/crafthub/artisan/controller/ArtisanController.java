package com.crafthub.artisan.controller;

import com.crafthub.artisan.dto.ArtisanVerifyDTO;
import com.crafthub.artisan.entity.Artisan;
import com.crafthub.artisan.service.ArtisanService;
import com.crafthub.common.result.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/artisan")
@RequiredArgsConstructor
public class ArtisanController {

    private static final Logger log = LoggerFactory.getLogger(ArtisanController.class);
    private final ArtisanService artisanService;

    @GetMapping("/pending")
    public Result<List<Artisan>> getPendingVerifyList() {
        List<Artisan> list = artisanService.getPendingVerifyList();
        return Result.success(list);
    }

    @GetMapping("/verified")
    public Result<List<Artisan>> getVerifiedArtisans() {
        List<Artisan> list = artisanService.getVerifiedArtisans();
        return Result.success(list);
    }

    @GetMapping("/{id}")
    public Result<Artisan> getById(@PathVariable Long id) {
        Artisan artisan = artisanService.getById(id);
        return artisan != null ? Result.success(artisan) : Result.error("匠人不存在");
    }

    @PostMapping("/verify")
    public Result<Void> verifyArtisan(@Valid @RequestBody ArtisanVerifyDTO dto) {
        log.info("收到匠人审核请求: {}", dto);

        boolean success = artisanService.verifyArtisan(dto);

        if (success) {
            log.info("匠人审核成功: artisanId={}", dto.getArtisanId());
            return Result.success("审核成功", null);
        } else {
            log.warn("匠人审核失败: artisanId={}", dto.getArtisanId());
            return Result.error("审核失败");
        }
    }

    @PostMapping
    public Result<Void> createArtisan(@RequestBody Artisan artisan) {
        artisan.setStatus(0);
        boolean success = artisanService.save(artisan);
        return success ? Result.success("提交成功，等待审核", null) : Result.error("提交失败");
    }

    @PutMapping("/{id}")
    public Result<Void> updateArtisan(@PathVariable Long id, @RequestBody Artisan artisan) {
        artisan.setId(id);
        boolean success = artisanService.updateById(artisan);
        return success ? Result.success("更新成功", null) : Result.error("更新失败");
    }
}
