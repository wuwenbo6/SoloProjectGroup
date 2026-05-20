package com.mortisejoiner.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.*;

@RestController
@RequestMapping("/api/upload")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FileUploadController {

    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);

    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS = new HashSet<>(Arrays.asList(
            "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "m4v", "3gp"
    ));

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = new HashSet<>(Arrays.asList(
            "jpg", "jpeg", "png", "gif", "bmp", "webp"
    ));

    private static final long MAX_FILE_SIZE = 500 * 1024 * 1024;

    @Value("${app.upload.path:uploads}")
    private String uploadPath;

    @PostMapping(value = "/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> uploadVideo(@RequestParam("file") MultipartFile file) {
        logger.info("收到视频上传请求: {}, 大小: {} bytes", file.getOriginalFilename(), file.getSize());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "文件不能为空"
            ));
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "文件大小不能超过500MB"
            ));
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename).toLowerCase();

        if (!ALLOWED_VIDEO_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "不支持的视频格式，支持格式: " + String.join(", ", ALLOWED_VIDEO_EXTENSIONS)
            ));
        }

        try {
            String newFilename = generateFileName(extension);
            String relativePath = "videos" + File.separator + newFilename;
            Path targetPath = Paths.get(uploadPath, relativePath);

            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());

            String fileUrl = "/uploads/videos/" + newFilename;
            logger.info("视频上传成功: {}", fileUrl);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "上传成功",
                    "url", fileUrl,
                    "filename", newFilename,
                    "originalFilename", originalFilename,
                    "size", file.getSize()
            ));

        } catch (IOException e) {
            logger.error("视频上传失败", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "文件上传失败: " + e.getMessage()
            ));
        }
    }

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> uploadImage(@RequestParam("file") MultipartFile file) {
        logger.info("收到图片上传请求: {}, 大小: {} bytes", file.getOriginalFilename(), file.getSize());

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "文件不能为空"
            ));
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "图片大小不能超过10MB"
            ));
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename).toLowerCase();

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "不支持的图片格式，支持格式: " + String.join(", ", ALLOWED_IMAGE_EXTENSIONS)
            ));
        }

        try {
            String newFilename = generateFileName(extension);
            String relativePath = "images" + File.separator + newFilename;
            Path targetPath = Paths.get(uploadPath, relativePath);

            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());

            String fileUrl = "/uploads/images/" + newFilename;
            logger.info("图片上传成功: {}", fileUrl);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "上传成功",
                    "url", fileUrl,
                    "filename", newFilename,
                    "originalFilename", originalFilename,
                    "size", file.getSize()
            ));

        } catch (IOException e) {
            logger.error("图片上传失败", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "文件上传失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/supported-formats")
    public ResponseEntity<Map<String, Object>> getSupportedFormats() {
        return ResponseEntity.ok(Map.of(
                "video", ALLOWED_VIDEO_EXTENSIONS,
                "image", ALLOWED_IMAGE_EXTENSIONS,
                "maxVideoSize", MAX_FILE_SIZE,
                "maxImageSize", 10 * 1024 * 1024
        ));
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    private String generateFileName(String extension) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmssSSS");
        String timestamp = sdf.format(new Date());
        String random = UUID.randomUUID().toString().substring(0, 8);
        return timestamp + "_" + random + "." + extension;
    }
}
