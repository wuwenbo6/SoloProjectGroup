package com.bamboo.craft.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.bamboo.craft.common.Result;
import com.bamboo.craft.entity.craft.Craft;
import com.bamboo.craft.service.CraftService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/crafts")
public class CraftController {

    @Autowired
    private CraftService craftService;

    @GetMapping
    public Result<Page<Craft>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<Craft> page = craftService.list(keyword, category, pageNum, pageSize);
        return Result.success(page);
    }

    @GetMapping("/{id}")
    public Result<Craft> getById(@PathVariable Long id) {
        Craft craft = craftService.getById(id);
        return Result.success(craft);
    }

    @PostMapping
    public Result<Void> save(@RequestBody Craft craft) {
        boolean success = craftService.save(craft);
        return success ? Result.success() : Result.error("保存失败");
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody Craft craft) {
        craft.setId(id);
        boolean success = craftService.update(craft);
        return success ? Result.success() : Result.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        boolean success = craftService.delete(id);
        return success ? Result.success() : Result.error("删除失败");
    }

    @PostMapping("/{id}/like")
    public Result<Void> like(@PathVariable Long id) {
        boolean success = craftService.like(id);
        return success ? Result.success() : Result.error("点赞失败");
    }

    @GetMapping("/user/{userId}")
    public Result<Page<Craft>> getUserWorks(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<Craft> page = craftService.getUserWorks(userId, pageNum, pageSize);
        return Result.success(page);
    }
}
