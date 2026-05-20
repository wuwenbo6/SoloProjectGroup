package com.mortise.tenon.controller;

import com.alibaba.fastjson.JSONObject;
import com.mortise.tenon.common.Result;
import com.mortise.tenon.service.DigitalCollectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/collection")
@CrossOrigin(origins = "*")
public class DigitalCollectionController {

    @Autowired
    private DigitalCollectionService collectionService;

    @GetMapping("/sources")
    public Result<?> getAvailableSources() {
        return Result.success(collectionService.getAvailableSources());
    }

    @PostMapping("/sync/{sourceId}")
    public Result<?> syncFromSource(@PathVariable String sourceId) {
        JSONObject result = collectionService.syncFromCollection(sourceId);
        if (result.getBoolean("success")) {
            return Result.success(result.getString("message"), result);
        } else {
            return Result.error(result.getString("message"));
        }
    }

    @PostMapping("/sync/all")
    public Result<?> syncAll() {
        JSONObject result = collectionService.syncAllCollections();
        return Result.success("所有馆藏同步完成", result);
    }

    @GetMapping("/status")
    public Result<?> getSyncStatus() {
        return Result.success(collectionService.getSyncStatus());
    }

    @GetMapping("/statistics")
    public Result<?> getStatistics() {
        return Result.success(collectionService.getCollectionStatistics());
    }
}
