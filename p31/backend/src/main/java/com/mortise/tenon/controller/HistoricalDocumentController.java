package com.mortise.tenon.controller;

import com.mortise.tenon.common.Result;
import com.mortise.tenon.entity.HistoricalDocument;
import com.mortise.tenon.repository.HistoricalDocumentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/document")
@CrossOrigin(origins = "*")
public class HistoricalDocumentController {

    @Autowired
    private HistoricalDocumentRepository documentRepository;

    @Value("${file.upload.document-path}")
    private String documentUploadPath;

    @GetMapping("/list")
    public Result<List<HistoricalDocument>> list() {
        return Result.success(documentRepository.findAll());
    }

    @GetMapping("/model/{modelId}")
    public Result<List<HistoricalDocument>> getByModelId(@PathVariable Long modelId) {
        return Result.success(documentRepository.findByModelId(modelId));
    }

    @GetMapping("/type/{documentType}")
    public Result<List<HistoricalDocument>> getByType(@PathVariable String documentType) {
        return Result.success(documentRepository.findByDocumentType(documentType));
    }

    @GetMapping("/verified")
    public Result<List<HistoricalDocument>> getVerified() {
        return Result.success(documentRepository.findByIsVerifiedTrue());
    }

    @GetMapping("/search")
    public Result<List<HistoricalDocument>> search(@RequestParam String keyword) {
        return Result.success(documentRepository.findByDocumentTitleContaining(keyword));
    }

    @GetMapping("/{id}")
    public Result<HistoricalDocument> getById(@PathVariable Long id) {
        return documentRepository.findById(id)
                .map(Result::success)
                .orElse(Result.error("文献不存在"));
    }

    @GetMapping("/code/{documentCode}")
    public Result<HistoricalDocument> getByCode(@PathVariable String documentCode) {
        return documentRepository.findByDocumentCode(documentCode)
                .map(Result::success)
                .orElse(Result.error("文献不存在"));
    }

    @PostMapping
    public Result<HistoricalDocument> create(@RequestBody HistoricalDocument document) {
        return Result.success(documentRepository.save(document));
    }

    @PutMapping
    public Result<HistoricalDocument> update(@RequestBody HistoricalDocument document) {
        return Result.success(documentRepository.save(document));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        documentRepository.deleteById(id);
        return Result.success();
    }

    @PostMapping("/upload")
    public Result<String> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "modelId", required = false) Long modelId) {
        try {
            if (file.isEmpty()) {
                return Result.error("文件不能为空");
            }

            File uploadDir = new File(documentUploadPath);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }

            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String newFilename = UUID.randomUUID().toString() + extension;

            Path filePath = Paths.get(documentUploadPath, newFilename);
            Files.copy(file.getInputStream(), filePath);

            return Result.success("上传成功", "/uploads/documents/" + newFilename);
        } catch (IOException e) {
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/verify")
    public Result<HistoricalDocument> verifyDocument(@PathVariable Long id) {
        return documentRepository.findById(id).map(document -> {
            document.setIsVerified(true);
            return Result.success(documentRepository.save(document));
        }).orElse(Result.error("文献不存在"));
    }
}