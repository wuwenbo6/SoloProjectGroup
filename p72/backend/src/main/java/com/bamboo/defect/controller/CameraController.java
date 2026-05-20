package com.bamboo.defect.controller;

import com.bamboo.defect.common.Result;
import com.bamboo.defect.service.ProcessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/camera")
@CrossOrigin
public class CameraController {

    @Autowired
    private ProcessService processService;

    @GetMapping("/status")
    public Result<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("connected", true);
        status.put("status", "正常");
        status.put("temperature", 35.5);
        status.put("lastCapture", System.currentTimeMillis());
        status.put("resolution", "2560x1440");
        status.put("frameRate", 30);
        status.put("exposureMode", "AUTO");
        status.put("gain", 1.2);
        return Result.success(status);
    }

    @GetMapping("/params")
    public Result<Map<String, Object>> getCameraParams() {
        Map<String, Object> params = processService.getCameraParams();
        return Result.success(params);
    }

    @PutMapping("/params")
    public Result<Void> updateCameraParams(@RequestBody Map<String, Object> params) {
        processService.updateCameraParams(params);
        return Result.success("相机参数更新成功");
    }

    @GetMapping("/snapshot")
    public Result<Map<String, Object>> getSnapshot() {
        try {
            Map<String, Object> result = new HashMap<>();
            BufferedImage image = generateTestBambooImage();
            
            Map<String, Object> params = processService.getCameraParams();
            BufferedImage enhancedImage = enhanceImage(image, params);
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(enhancedImage, "jpg", baos);
            String base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
            
            result.put("image", "data:image/jpeg;base64," + base64Image);
            result.put("width", enhancedImage.getWidth());
            result.put("height", enhancedImage.getHeight());
            result.put("timestamp", System.currentTimeMillis());
            result.put("quality", "enhanced");
            
            return Result.success(result);
        } catch (Exception e) {
            return Result.error("图像采集失败: " + e.getMessage());
        }
    }

    @PostMapping("/capture")
    public Result<Map<String, Object>> capture() {
        try {
            Map<String, Object> result = new HashMap<>();
            BufferedImage image = generateTestBambooImage();
            
            Map<String, Object> params = processService.getCameraParams();
            BufferedImage enhancedImage = enhanceImage(image, params);
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(enhancedImage, "jpg", baos);
            String base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
            
            result.put("success", true);
            result.put("imagePath", "/images/capture_" + System.currentTimeMillis() + ".jpg");
            result.put("imageData", "data:image/jpeg;base64," + base64Image);
            result.put("timestamp", System.currentTimeMillis());
            result.put("width", enhancedImage.getWidth());
            result.put("height", enhancedImage.getHeight());
            
            return Result.success(result);
        } catch (Exception e) {
            return Result.error("拍照失败: " + e.getMessage());
        }
    }

    @PostMapping("/upload")
    public Result<Map<String, Object>> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            BufferedImage image = ImageIO.read(file.getInputStream());
            Map<String, Object> params = processService.getCameraParams();
            BufferedImage enhancedImage = enhanceImage(image, params);
            
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(enhancedImage, "jpg", baos);
            String base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
            
            Map<String, Object> result = new HashMap<>();
            result.put("image", "data:image/jpeg;base64," + base64Image);
            result.put("originalFilename", file.getOriginalFilename());
            result.put("enhanced", true);
            
            return Result.success(result);
        } catch (Exception e) {
            return Result.error("图像上传处理失败: " + e.getMessage());
        }
    }

    private BufferedImage generateTestBambooImage() {
        int width = 2560;
        int height = 1440;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        
        int bambooBase = 0xD4A574;
        int bambooWeave = 0xBF9B60;
        int bambooShadow = 0xA67C50;
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int noise = (int) (Math.random() * 20 - 10);
                
                int weaveX = (x / 40) % 2;
                int weaveY = (y / 40) % 2;
                
                int color;
                if (weaveX == weaveY) {
                    color = adjustColor(bambooBase, noise);
                } else {
                    color = adjustColor(bambooWeave, noise + 10);
                }
                
                int shadowX = (x % 80) - 40;
                int shadowY = (y % 80) - 40;
                if (Math.abs(shadowX) < 5 || Math.abs(shadowY) < 5) {
                    color = adjustColor(bambooShadow, noise - 15);
                }
                
                image.setRGB(x, y, color);
            }
        }
        
        return image;
    }

    private BufferedImage enhanceImage(BufferedImage image, Map<String, Object> params) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        
        double brightness = ((Number) params.getOrDefault("brightness", 80)).doubleValue();
        double contrast = ((Number) params.getOrDefault("contrast", 50)).doubleValue();
        double saturation = ((Number) params.getOrDefault("saturation", 50)).doubleValue();
        double sharpness = ((Number) params.getOrDefault("sharpness", 60)).doubleValue();
        
        double brightnessFactor = 1.0 + (brightness - 50) / 100.0;
        double contrastFactor = 1.0 + (contrast - 50) / 100.0;
        double sharpnessFactor = sharpness / 100.0;
        
        BufferedImage adjusted = adjustBrightnessContrast(image, brightnessFactor, contrastFactor);
        
        if (sharpnessFactor > 0.1) {
            adjusted = applySharpening(adjusted, sharpnessFactor);
        }
        
        return adjustSaturation(adjusted, saturation);
    }

    private BufferedImage adjustBrightnessContrast(BufferedImage image, double brightnessFactor, double contrastFactor) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        
        int contrastOffset = (int) ((1.0 - contrastFactor) * 128.0);
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                
                r = clamp((int) ((r - 128) * contrastFactor + 128 + contrastOffset + brightnessFactor * 10 - 10));
                g = clamp((int) ((g - 128) * contrastFactor + 128 + contrastOffset + brightnessFactor * 10 - 10));
                b = clamp((int) ((b - 128) * contrastFactor + 128 + contrastOffset + brightnessFactor * 10 - 10));
                
                result.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        
        return result;
    }

    private BufferedImage applySharpening(BufferedImage image, double amount) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        
        double[][] laplacianKernel = {
            { 0, -amount * 0.5, 0 },
            { -amount * 0.5, 1 + amount * 2, -amount * 0.5 },
            { 0, -amount * 0.5, 0 }
        };
        
        for (int y = 1; y < height - 1; y++) {
            for (int x = 1; x < width - 1; x++) {
                double r = 0, g = 0, b = 0;
                
                for (int ky = -1; ky <= 1; ky++) {
                    for (int kx = -1; kx <= 1; kx++) {
                        int rgb = image.getRGB(x + kx, y + ky);
                        double weight = laplacianKernel[ky + 1][kx + 1];
                        r += ((rgb >> 16) & 0xFF) * weight;
                        g += ((rgb >> 8) & 0xFF) * weight;
                        b += (rgb & 0xFF) * weight;
                    }
                }
                
                result.setRGB(x, y, (clamp((int) r) << 16) | (clamp((int) g) << 8) | clamp((int) b));
            }
        }
        
        for (int x = 0; x < width; x++) {
            result.setRGB(x, 0, image.getRGB(x, 0));
            result.setRGB(x, height - 1, image.getRGB(x, height - 1));
        }
        for (int y = 0; y < height; y++) {
            result.setRGB(0, y, image.getRGB(0, y));
            result.setRGB(width - 1, y, image.getRGB(width - 1, y));
        }
        
        return result;
    }

    private BufferedImage adjustSaturation(BufferedImage image, double saturation) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        
        double saturationFactor = saturation / 50.0;
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                
                double gray = 0.299 * r + 0.587 * g + 0.114 * b;
                
                r = clamp((int) (gray + (r - gray) * saturationFactor));
                g = clamp((int) (gray + (g - gray) * saturationFactor));
                b = clamp((int) (gray + (b - gray) * saturationFactor));
                
                result.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        
        return result;
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(255, value));
    }

    private int adjustColor(int baseColor, int adjustment) {
        int r = ((baseColor >> 16) & 0xFF) + adjustment;
        int g = ((baseColor >> 8) & 0xFF) + adjustment;
        int b = (baseColor & 0xFF) + adjustment;
        
        r = clamp(r);
        g = clamp(g);
        b = clamp(b);
        
        return (r << 16) | (g << 8) | b;
    }
}
