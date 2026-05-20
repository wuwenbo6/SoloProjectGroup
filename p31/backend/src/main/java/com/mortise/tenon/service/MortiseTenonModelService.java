package com.mortise.tenon.service;

import com.mortise.tenon.common.PageResult;
import com.mortise.tenon.entity.MortiseTenonModel;
import com.mortise.tenon.repository.MortiseTenonModelRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MortiseTenonModelService {

    @Autowired
    private MortiseTenonModelRepository modelRepository;

    private static final String MODEL_UPLOAD_PATH = "/Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p31/uploads/models/";

    @Transactional(readOnly = true)
    public PageResult<MortiseTenonModel> findPage(int page, int pageSize, String keyword, Long typeId, Boolean published) {
        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<MortiseTenonModel> resultPage;

        if (keyword != null && !keyword.trim().isEmpty()) {
            if (typeId != null) {
                if (published != null) {
                    resultPage = modelRepository.findByTypeIdAndPublishedAndKeyword(typeId, published, keyword, pageable);
                } else {
                    resultPage = modelRepository.findByTypeIdAndKeyword(typeId, keyword, pageable);
                }
            } else {
                if (published != null) {
                    resultPage = modelRepository.findByPublishedAndKeyword(published, keyword, pageable);
                } else {
                    resultPage = modelRepository.findByKeyword(keyword, pageable);
                }
            }
        } else {
            if (typeId != null) {
                if (published != null) {
                    resultPage = modelRepository.findByTypeIdAndPublished(typeId, published, pageable);
                } else {
                    resultPage = modelRepository.findByTypeId(typeId, pageable);
                }
            } else {
                if (published != null) {
                    resultPage = modelRepository.findByIsPublished(published, pageable);
                } else {
                    resultPage = modelRepository.findAll(pageable);
                }
            }
        }

        return PageResult.of(resultPage.getContent(), resultPage.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> findAll() {
        return modelRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> findAllPublished() {
        return modelRepository.findByIsPublishedTrue();
    }

    @Transactional(readOnly = true)
    public Optional<MortiseTenonModel> findById(Long id) {
        return modelRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<MortiseTenonModel> findByModelCode(String modelCode) {
        return modelRepository.findByModelCode(modelCode);
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> findByTypeId(Long typeId) {
        return modelRepository.findByTypeId(typeId);
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> searchByKeyword(String keyword) {
        return modelRepository.searchByKeyword(keyword);
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> findByIds(List<Long> ids) {
        return modelRepository.findByIds(ids);
    }

    @Transactional(readOnly = true)
    public List<MortiseTenonModel> findIdsList(String idsStr) {
        if (idsStr == null || idsStr.trim().isEmpty()) {
            return new ArrayList<>();
        }
        List<Long> ids = Arrays.stream(idsStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toList());
        return findByIds(ids);
    }

    @Transactional
    public MortiseTenonModel save(MortiseTenonModel model) {
        return modelRepository.save(model);
    }

    @Transactional
    public MortiseTenonModel update(MortiseTenonModel model) {
        return modelRepository.save(model);
    }

    @Transactional
    public void deleteById(Long id) {
        modelRepository.deleteById(id);
    }

    @Transactional
    public String uploadModelFile(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new RuntimeException("文件不能为空");
        }

        File uploadDir = new File(MODEL_UPLOAD_PATH);
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String newFilename = UUID.randomUUID().toString() + extension;

        Path filePath = Paths.get(MODEL_UPLOAD_PATH, newFilename);
        Files.copy(file.getInputStream(), filePath);

        return "/uploads/models/" + newFilename;
    }

    @Transactional
    public void incrementViewCount(Long modelId) {
        modelRepository.findById(modelId).ifPresent(model -> {
            model.setViewCount(model.getViewCount() + 1);
            modelRepository.save(model);
        });
    }
}