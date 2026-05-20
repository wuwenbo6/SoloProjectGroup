package com.mortise.furniture.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.mortise.furniture.config.DataSourceConfig;
import com.mortise.furniture.entity.Furniture;
import com.mortise.furniture.repository.FurnitureMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class FurnitureService extends ServiceImpl<FurnitureMapper, Furniture> {

    private final String uploadPath = "/Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p88/uploads/models/";

    public List<Furniture> listAll() {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        List<Furniture> list = list();
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return list;
    }

    public Furniture getFurnitureById(Long id) {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        Furniture furniture = getById(id);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return furniture;
    }

    public boolean saveFurniture(Furniture furniture) {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        furniture.setCreateTime(LocalDateTime.now());
        furniture.setUpdateTime(LocalDateTime.now());
        furniture.setDeleted(false);
        boolean result = save(furniture);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    public boolean updateFurniture(Furniture furniture) {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        furniture.setUpdateTime(LocalDateTime.now());
        boolean result = updateById(furniture);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    public boolean deleteFurniture(Long id) {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        boolean result = removeById(id);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return result;
    }

    public String uploadModel(MultipartFile file) throws IOException {
        File uploadDir = new File(uploadPath);
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String newFilename = UUID.randomUUID().toString() + extension;

        File destFile = new File(uploadPath + newFilename);
        file.transferTo(destFile);

        return "/uploads/models/" + newFilename;
    }

    public List<Furniture> searchByCategory(String category) {
        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        LambdaQueryWrapper<Furniture> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Furniture::getCategory, category);
        List<Furniture> list = list(wrapper);
        DataSourceConfig.DynamicDataSource.clearDataSource();
        return list;
    }
}
