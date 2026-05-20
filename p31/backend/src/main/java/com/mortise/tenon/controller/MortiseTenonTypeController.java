package com.mortise.tenon.controller;

import com.mortise.tenon.common.Result;
import com.mortise.tenon.entity.MortiseTenonType;
import com.mortise.tenon.repository.MortiseTenonTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/type")
@CrossOrigin(origins = "*")
public class MortiseTenonTypeController {

    @Autowired
    private MortiseTenonTypeRepository typeRepository;

    @GetMapping("/list")
    public Result<List<MortiseTenonType>> list() {
        return Result.success(typeRepository.findAll());
    }

    @GetMapping("/active")
    public Result<List<MortiseTenonType>> activeList() {
        return Result.success(typeRepository.findByIsActiveTrue());
    }

    @GetMapping("/{id}")
    public Result<MortiseTenonType> getById(@PathVariable Long id) {
        return typeRepository.findById(id)
                .map(Result::success)
                .orElse(Result.error("类型不存在"));
    }

    @GetMapping("/code/{typeCode}")
    public Result<MortiseTenonType> getByCode(@PathVariable String typeCode) {
        return typeRepository.findByTypeCode(typeCode)
                .map(Result::success)
                .orElse(Result.error("类型不存在"));
    }

    @GetMapping("/category/{category}")
    public Result<List<MortiseTenonType>> getByCategory(@PathVariable String category) {
        return Result.success(typeRepository.findByCategory(category));
    }

    @GetMapping("/categories")
    public Result<List<String>> getAllCategories() {
        return Result.success(typeRepository.findAllCategories());
    }

    @PostMapping
    public Result<MortiseTenonType> create(@RequestBody MortiseTenonType type) {
        return Result.success(typeRepository.save(type));
    }

    @PutMapping
    public Result<MortiseTenonType> update(@RequestBody MortiseTenonType type) {
        return Result.success(typeRepository.save(type));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        typeRepository.deleteById(id);
        return Result.success();
    }
}