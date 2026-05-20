package com.mortise.tenon.controller;

import com.alibaba.fastjson.JSONObject;
import com.mortise.tenon.common.PageResult;
import com.mortise.tenon.common.Result;
import com.mortise.tenon.entity.MortiseTenonModel;
import com.mortise.tenon.service.MortiseTenonModelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/model")
@CrossOrigin(origins = "*")
public class MortiseTenonModelController {

    @Autowired
    private MortiseTenonModelService modelService;

    @GetMapping("/page")
    public Result<PageResult<MortiseTenonModel>> listByPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long typeId,
            @RequestParam(required = false) Boolean published) {

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        PageResult<MortiseTenonModel> result = modelService.findPage(page, pageSize, keyword, typeId, published);
        return Result.success(result);
    }

    @GetMapping("/list")
    @Cacheable(value = "models", key = "'all'", cacheManager = "modelCacheManager")
    public Result<List<MortiseTenonModel>> list() {
        return Result.success(modelService.findAll());
    }

    @GetMapping("/published")
    @Cacheable(value = "models", key = "'published'", cacheManager = "modelCacheManager")
    public Result<List<MortiseTenonModel>> publishedList() {
        return Result.success(modelService.findAllPublished());
    }

    @GetMapping("/{id}")
    @Cacheable(value = "models", key = "#id", cacheManager = "modelCacheManager")
    public Result<MortiseTenonModel> getById(@PathVariable Long id) {
        return modelService.findById(id)
                .map(Result::success)
                .orElse(Result.error("模型不存在"));
    }

    @GetMapping("/code/{modelCode}")
    @Cacheable(value = "models", key = "#modelCode", cacheManager = "modelCacheManager")
    public Result<MortiseTenonModel> getByCode(@PathVariable String modelCode) {
        return modelService.findByModelCode(modelCode)
                .map(Result::success)
                .orElse(Result.error("模型不存在"));
    }

    @GetMapping("/type/{typeId}")
    @Cacheable(value = "models", key = "'type_' + #typeId", cacheManager = "modelCacheManager")
    public Result<List<MortiseTenonModel>> getByTypeId(@PathVariable Long typeId) {
        return Result.success(modelService.findByTypeId(typeId));
    }

    @GetMapping("/search")
    public Result<List<MortiseTenonModel>> search(@RequestParam(required = false) String keyword) {
        return Result.success(modelService.searchByKeyword(keyword));
    }

    @GetMapping("/ids")
    @Cacheable(value = "models", key = "'ids_' + #ids.hashCode()", cacheManager = "modelCacheManager")
    public Result<List<MortiseTenonModel>> getByIds(@RequestParam String ids) {
        return Result.success(modelService.findIdsList(ids));
    }

    @PostMapping("/compare")
    public Result<List<MortiseTenonModel>> compare(@RequestBody List<Long> ids) {
        return Result.success(modelService.findByIds(ids));
    }

    @PostMapping
    @CacheEvict(value = "models", allEntries = true, cacheManager = "modelCacheManager")
    public Result<MortiseTenonModel> create(@RequestBody MortiseTenonModel model) {
        return Result.success(modelService.save(model));
    }

    @PutMapping
    @CacheEvict(value = "models", allEntries = true, cacheManager = "modelCacheManager")
    public Result<MortiseTenonModel> update(@RequestBody MortiseTenonModel model) {
        return Result.success(modelService.update(model));
    }

    @DeleteMapping("/{id}")
    @CacheEvict(value = "models", allEntries = true, cacheManager = "modelCacheManager")
    public Result<Void> delete(@PathVariable Long id) {
        modelService.deleteById(id);
        return Result.success();
    }

    @PostMapping("/upload")
    public Result<String> uploadModel(@RequestParam("file") MultipartFile file) {
        try {
            String filePath = modelService.uploadModelFile(file);
            return Result.success("上传成功", filePath);
        } catch (IOException e) {
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/view")
    public Result<Void> incrementViewCount(@PathVariable Long id) {
        modelService.incrementViewCount(id);
        return Result.success();
    }

    @GetMapping("/batch")
    public Result<List<MortiseTenonModel>> getBatch(@RequestParam List<Long> ids) {
        long start = System.nanoTime();
        List<MortiseTenonModel> result = modelService.findByIds(ids);
        long duration = System.nanoTime() - start;
        return Result.success(result);
    }

    @GetMapping("/lazy/{id}")
    public Result<JSONObject> getModelLazy(@PathVariable Long id) {
        return modelService.findById(id)
                .map(model -> {
                    JSONObject result = new JSONObject();
                    result.put("id", model.getId());
                    result.put("name", model.getName());
                    result.put("modelCode", model.getModelCode());
                    result.put("category", model.getCategory());
                    result.put("description", model.getDescription());
                    result.put("componentsLoaded", false);
                    return Result.success(result);
                })
                .orElse(Result.error("模型不存在"));
    }

    @GetMapping("/{id}/components")
    public Result<JSONObject> getModelComponents(@PathVariable Long id) {
        return modelService.findById(id)
                .map(model -> {
                    JSONObject result = new JSONObject();
                    result.put("modelId", id);
                    result.put("components", model.getComponents());
                    result.put("componentCount", model.getComponents().size());
                    return Result.success(result);
                })
                .orElse(Result.error("模型不存在"));
    }
}