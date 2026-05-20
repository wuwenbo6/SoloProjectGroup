package com.ancientbook.rarebook.controller;

import com.ancientbook.common.result.Result;
import com.ancientbook.rarebook.dto.RareBookQueryDTO;
import com.ancientbook.rarebook.entity.RareBook;
import com.ancientbook.rarebook.service.RareBookService;
import com.github.pagehelper.PageInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rarebook")
@RequiredArgsConstructor
public class RareBookController {

    private final RareBookService rareBookService;

    @PostMapping
    public Result<RareBook> create(@Validated @RequestBody RareBook rareBook) {
        return Result.success(rareBookService.create(rareBook));
    }

    @PutMapping("/{id}")
    public Result<RareBook> update(@PathVariable Long id, @RequestBody RareBook rareBook) {
        return Result.success(rareBookService.update(id, rareBook));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        rareBookService.delete(id);
        return Result.success();
    }

    @GetMapping("/{id}")
    public Result<RareBook> getById(@PathVariable Long id) {
        return Result.success(rareBookService.getById(id));
    }

    @GetMapping("/code/{bookCode}")
    public Result<RareBook> getByBookCode(@PathVariable String bookCode) {
        return Result.success(rareBookService.getByBookCode(bookCode));
    }

    @GetMapping("/page")
    public Result<PageInfo<RareBook>> queryPage(RareBookQueryDTO queryDTO) {
        return Result.success(rareBookService.queryPage(queryDTO));
    }

    @GetMapping("/statistics")
    public Result<Map<String, Object>> getStatistics() {
        return Result.success(rareBookService.getStatistics());
    }
}
