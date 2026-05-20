package com.ancient.book.image.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.ancient.book.common.dto.PageUploadRequest;
import com.ancient.book.common.dto.RestorationResponse;
import com.ancient.book.common.exception.BusinessException;
import com.ancient.book.image.util.PathResolutionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageParserService {

    private final PathResolutionUtil pathResolutionUtil;

    public RestorationResponse parseAncientBookImage(PageUploadRequest request) {
        try {
            log.info("开始解析古籍图像: {}, 页码: {}", request.getBookName(), request.getPageNumber());
            
            MultipartFile imageFile = request.getImageFile();
            validateImageFile(imageFile);

            String originalFileName = imageFile.getOriginalFilename();
            if (!pathResolutionUtil.isSupportedImageFormat(originalFileName)) {
                throw new BusinessException("不支持的图像格式，请上传jpg、png、bmp等格式");
            }

            String originalImagePath = pathResolutionUtil.resolveOriginalImagePath(
                    request.getBookName(), originalFileName);
            log.info("原始图像路径解析成功: {}", originalImagePath);

            pathResolutionUtil.saveImageToPath(imageFile.getInputStream(), originalImagePath);

            String processedImagePath = pathResolutionUtil.resolveProcessedImagePath(originalImagePath);
            log.info("处理后图像路径解析成功: {}", processedImagePath);

            String extractedText = simulateTextExtraction(originalImagePath);
            String damageAnalysis = analyzeDamageAreasInternal(originalImagePath);
            String variantChars = detectVariantCharacters(extractedText);
            String aiSuggestions = generateAiSuggestions(damageAnalysis, extractedText);

            RestorationResponse response = new RestorationResponse();
            response.setPageId(generatePageId());
            response.setBookName(request.getBookName());
            response.setPageNumber(request.getPageNumber());
            response.setOriginalImagePath(originalImagePath);
            response.setRestoredImagePath(processedImagePath);
            response.setExtractedText(extractedText);
            response.setDamageAreas(damageAnalysis);
            response.setDamageLevel(calculateDamageLevel(damageAnalysis));
            response.setAiSuggestions(aiSuggestions);
            response.setVariantCharacters(variantChars);
            response.setStatus(1);
            response.setProcessTime(LocalDateTime.now());

            log.info("古籍图像解析完成，页面ID: {}", response.getPageId());
            return response;

        } catch (IOException e) {
            log.error("图像文件处理失败", e);
            throw new BusinessException("图像文件处理失败: " + e.getMessage());
        } catch (SecurityException e) {
            log.error("路径安全验证失败", e);
            throw new BusinessException("路径访问异常: " + e.getMessage());
        } catch (Exception e) {
            log.error("古籍图像解析失败", e);
            throw new BusinessException("古籍图像解析失败: " + e.getMessage());
        }
    }

    public Map<String, Object> analyzeDamageAreas(String imagePath) {
        try {
            log.info("分析残损区域: {}", imagePath);

            if (!pathResolutionUtil.isValidPath(imagePath)) {
                throw new BusinessException("图像路径不合法");
            }

            String damageAnalysis = analyzeDamageAreasInternal(imagePath);
            int damageLevel = calculateDamageLevel(damageAnalysis);
            String suggestions = generateRestorationSuggestions(damageAnalysis);

            Map<String, Object> result = new HashMap<>();
            result.put("imagePath", imagePath);
            result.put("damageAreas", damageAnalysis);
            result.put("damageLevel", damageLevel);
            result.put("suggestions", suggestions);
            result.put("analysisTime", LocalDateTime.now());

            return result;

        } catch (Exception e) {
            log.error("残损区域分析失败", e);
            throw new BusinessException("残损区域分析失败: " + e.getMessage());
        }
    }

    public String extractTextFromImage(String imagePath) {
        try {
            log.info("从图像提取文字: {}", imagePath);

            if (!pathResolutionUtil.isValidPath(imagePath)) {
                throw new BusinessException("图像路径不合法");
            }

            return simulateTextExtraction(imagePath);

        } catch (Exception e) {
            log.error("文字提取失败", e);
            throw new BusinessException("文字提取失败: " + e.getMessage());
        }
    }

    public String preprocessImage(MultipartFile imageFile, String bookName) {
        try {
            validateImageFile(imageFile);

            String originalFileName = imageFile.getOriginalFilename();
            String originalPath = pathResolutionUtil.resolveOriginalImagePath(bookName, originalFileName);
            pathResolutionUtil.saveImageToPath(imageFile.getInputStream(), originalPath);

            String processedPath = pathResolutionUtil.resolveProcessedImagePath(originalPath);
            log.info("图像预处理完成: {}", processedPath);

            return processedPath;

        } catch (Exception e) {
            log.error("图像预处理失败", e);
            throw new BusinessException("图像预处理失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getImageInfo(String imagePath) {
        if (!pathResolutionUtil.isValidPath(imagePath)) {
            throw new BusinessException("图像路径不合法");
        }

        Map<String, Object> info = new HashMap<>();
        info.put("imagePath", imagePath);
        info.put("previewUrl", pathResolutionUtil.resolvePreviewUrl(imagePath));
        info.put("valid", true);
        return info;
    }

    private void validateImageFile(MultipartFile imageFile) {
        if (imageFile == null || imageFile.isEmpty()) {
            throw new BusinessException("请上传图像文件");
        }

        long fileSize = imageFile.getSize();
        if (fileSize > 500 * 1024 * 1024) {
            throw new BusinessException("文件大小不能超过500MB");
        }

        String contentType = imageFile.getContentType();
        if (StrUtil.isBlank(contentType) || !contentType.startsWith("image/")) {
            throw new BusinessException("请上传有效的图像文件");
        }
    }

    private String simulateTextExtraction(String imagePath) {
        log.debug("模拟文字提取: {}", imagePath);
        return "子曰学而时习之不亦说乎有朋自远方来不亦乐乎人不知而不愠不亦君子乎君子务本本立而道生孝弟也者其为仁之本与";
    }

    private String analyzeDamageAreasInternal(String imagePath) {
        log.debug("分析残损区域: {}", imagePath);
        
        StringBuilder damageAreas = new StringBuilder();
        damageAreas.append("{x:100,y:150,width:80,height:40,type:stroke_missing,description:'笔画缺失'};");
        damageAreas.append("{x:250,y:300,width:60,height:50,type:character_erosion,description:'文字腐蚀'};");
        damageAreas.append("{x:400,y:450,width:30,height:30,type:stain,description:'污渍'}");
        
        return damageAreas.toString();
    }

    private int calculateDamageLevel(String damageAnalysis) {
        if (StrUtil.isBlank(damageAnalysis)) {
            return 0;
        }
        int damageCount = damageAnalysis.split(";").length;
        if (damageCount <= 1) return 1;
        if (damageCount <= 3) return 2;
        return 3;
    }

    private String generateRestorationSuggestions(String damageAnalysis) {
        StringBuilder suggestions = new StringBuilder();
        suggestions.append("根据残损分析，建议采取以下修复措施：\n");
        suggestions.append("1. 对笔画缺失区域使用AI笔画补全算法进行修复；\n");
        suggestions.append("2. 对文字腐蚀区域进行图像增强处理；\n");
        suggestions.append("3. 对污渍区域进行去噪处理；\n");
        suggestions.append("4. 建议进行人工复核确认修复效果。");
        return suggestions.toString();
    }

    private String generateAiSuggestions(String damageAnalysis, String extractedText) {
        return "检测到该古籍页面存在" + damageAnalysis.split(";").length + 
                "处残损，建议使用AI修复功能进行处理。提取文字共" + 
                extractedText.length() + "字。";
    }

    private String detectVariantCharacters(String text) {
        if (StrUtil.isBlank(text)) {
            return "";
        }

        StringBuilder variants = new StringBuilder();
        if (text.contains("说")) {
            variants.append("说->悦(通假字);");
        }
        if (text.contains("弟")) {
            variants.append("弟->悌(通假字);");
        }
        return variants.toString();
    }

    private Long generatePageId() {
        return IdUtil.getSnowflakeNextId();
    }
}
