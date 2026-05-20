package com.ancient.book.image.util;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
public class PathResolutionUtil {

    @Value("${image.storage.base-path:./data/images}")
    private String baseStoragePath;

    @Value("${image.storage.original-path:/original}")
    private String originalPath;

    @Value("${image.storage.processed-path:/processed}")
    private String processedPath;

    @Value("${image.processing.supported-formats:jpg,jpeg,png,bmp,tiff,tif}")
    private String supportedFormats;

    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList(
            "jpg", "jpeg", "png", "bmp", "tiff", "tif", "gif"
    );

    private static final String DATE_PATTERN = "yyyy/MM/dd";

    public String resolveOriginalImagePath(String bookName, String fileName) {
        validateBookName(bookName);
        validateFileName(fileName);

        String dateDir = LocalDate.now().format(DateTimeFormatter.ofPattern(DATE_PATTERN));
        String safeBookName = sanitizeFileName(bookName);
        String safeFileName = generateSafeFileName(fileName);

        String fullPath = Paths.get(baseStoragePath, safeBookName, originalPath, dateDir, safeFileName)
                .normalize()
                .toString();

        validatePathSecurity(fullPath, baseStoragePath);

        log.debug("解析原始图像路径: {}", fullPath);
        return fullPath;
    }

    public String resolveProcessedImagePath(String originalPath) {
        if (StrUtil.isBlank(originalPath)) {
            throw new IllegalArgumentException("原始路径不能为空");
        }

        Path original = Paths.get(originalPath).normalize();
        String fileName = original.getFileName().toString();
        String baseName = FileUtil.mainName(fileName);
        String ext = FileUtil.extName(fileName);

        String processedFileName = "processed_" + baseName + "_" + 
                IdUtil.simpleUUID() + "." + ext;

        String relativePath = StrUtil.subAfter(originalPath, originalPath, false);
        if (StrUtil.isBlank(relativePath)) {
            relativePath = LocalDate.now().format(DateTimeFormatter.ofPattern(DATE_PATTERN));
        }

        String parentDir = original.getParent() != null ? original.getParent().toString() : "";
        String baseDir = StrUtil.subBefore(parentDir, originalPath, false);
        if (StrUtil.isBlank(baseDir)) {
            baseDir = baseStoragePath;
        }

        String fullPath = Paths.get(baseDir, processedPath, relativePath, processedFileName)
                .normalize()
                .toString();

        validatePathSecurity(fullPath, baseStoragePath);

        log.debug("解析处理后图像路径: {}", fullPath);
        return fullPath;
    }

    public String saveImageToPath(InputStream inputStream, String targetPath) throws IOException {
        if (inputStream == null) {
            throw new IllegalArgumentException("输入流不能为空");
        }
        if (StrUtil.isBlank(targetPath)) {
            throw new IllegalArgumentException("目标路径不能为空");
        }

        Path path = Paths.get(targetPath).normalize();
        validatePathSecurity(targetPath, baseStoragePath);

        Path parentDir = path.getParent();
        if (parentDir != null && !Files.exists(parentDir)) {
            Files.createDirectories(parentDir);
            log.debug("创建目录: {}", parentDir);
        }

        Files.copy(inputStream, path, StandardCopyOption.REPLACE_EXISTING);
        log.info("图像保存成功: {}", targetPath);

        return targetPath;
    }

    public String getFileExtension(String fileName) {
        if (StrUtil.isBlank(fileName)) {
            return "";
        }
        int lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex == -1 || lastDotIndex == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(lastDotIndex + 1).toLowerCase();
    }

    public boolean isSupportedImageFormat(String fileName) {
        String extension = getFileExtension(fileName);
        boolean supported = ALLOWED_EXTENSIONS.contains(extension);
        if (!supported) {
            log.warn("不支持的图像格式: {}", extension);
        }
        return supported;
    }

    public void ensureDirectoryExists(String dirPath) {
        if (StrUtil.isBlank(dirPath)) {
            throw new IllegalArgumentException("目录路径不能为空");
        }
        Path path = Paths.get(dirPath).normalize();
        if (!Files.exists(path)) {
            try {
                Files.createDirectories(path);
                log.debug("创建目录: {}", dirPath);
            } catch (IOException e) {
                log.error("创建目录失败: {}", dirPath, e);
                throw new RuntimeException("创建目录失败: " + e.getMessage(), e);
            }
        }
    }

    public String getRelativePath(String absolutePath, String basePath) {
        if (StrUtil.isBlank(absolutePath) || StrUtil.isBlank(basePath)) {
            return absolutePath;
        }

        Path absolute = Paths.get(absolutePath).normalize();
        Path base = Paths.get(basePath).normalize();

        if (absolute.startsWith(base)) {
            return base.relativize(absolute).toString();
        }

        return absolutePath;
    }

    public String getStorageBasePath() {
        return baseStoragePath;
    }

    private void validateBookName(String bookName) {
        if (StrUtil.isBlank(bookName)) {
            throw new IllegalArgumentException("古籍名称不能为空");
        }
        if (bookName.length() > 200) {
            throw new IllegalArgumentException("古籍名称过长，最大支持200字符");
        }
    }

    private void validateFileName(String fileName) {
        if (StrUtil.isBlank(fileName)) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        if (fileName.length() > 255) {
            throw new IllegalArgumentException("文件名过长，最大支持255字符");
        }
        if (!isSupportedImageFormat(fileName)) {
            throw new IllegalArgumentException("不支持的图像格式: " + fileName);
        }
    }

    private String sanitizeFileName(String fileName) {
        if (StrUtil.isBlank(fileName)) {
            return "unknown";
        }
        
        String sanitized = fileName.replaceAll("[^a-zA-Z0-9\\u4e00-\\u9fa5_\\-\\.]", "_");
        if (sanitized.length() > 100) {
            sanitized = sanitized.substring(0, 100);
        }
        return sanitized;
    }

    private String generateSafeFileName(String originalFileName) {
        String extension = getFileExtension(originalFileName);
        String baseName = IdUtil.simpleUUID();
        return baseName + "." + extension;
    }

    private void validatePathSecurity(String targetPath, String basePath) {
        Path target = Paths.get(targetPath).normalize();
        Path base = Paths.get(basePath).normalize().toAbsolutePath();

        if (!target.startsWith(base)) {
            log.error("路径遍历攻击检测: targetPath={}, basePath={}", targetPath, basePath);
            throw new SecurityException("非法路径访问");
        }

        String normalized = target.toString();
        if (normalized.contains("..") || normalized.contains("./")) {
            log.error("非法路径字符检测: {}", targetPath);
            throw new SecurityException("非法路径字符");
        }
    }

    public String resolvePreviewUrl(String filePath) {
        if (StrUtil.isBlank(filePath)) {
            return "";
        }
        String relativePath = getRelativePath(filePath, baseStoragePath);
        return "/api/image/preview/" + relativePath.replace("\\", "/");
    }

    public boolean isValidPath(String path) {
        if (StrUtil.isBlank(path)) {
            return false;
        }
        try {
            validatePathSecurity(path, baseStoragePath);
            return true;
        } catch (SecurityException e) {
            log.warn("路径验证失败: {}", path);
            return false;
        }
    }
}
