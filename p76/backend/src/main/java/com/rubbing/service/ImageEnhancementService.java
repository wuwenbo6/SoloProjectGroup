package com.rubbing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.RescaleOp;
import java.awt.Color;

@Slf4j
@Service
public class ImageEnhancementService {

    public BufferedImage applyEnhancement(BufferedImage original, String type, double intensity) {
        log.info("应用图像增强: type={}, intensity={}", type, intensity);
        
        switch (type.toLowerCase()) {
            case "sharpen":
                return applyAdaptiveSharpening(original, intensity);
            case "contrast":
                return applyContrastEnhancement(original, intensity);
            case "denoise":
                return applyAdvancedDenoise(original, (int) intensity);
            case "edge":
                return applyEdgeEnhancement(original, intensity);
            case "brightness":
                return applyBrightnessAdjustment(original, intensity);
            case "histogram":
                return applyHistogramEqualization(original);
            default:
                return original;
        }
    }

    private BufferedImage applyAdaptiveSharpening(BufferedImage image, double intensity) {
        float factor = (float) (intensity / 50.0);
        float[] sharpenKernel = {
            -0.5f * factor, -0.5f * factor, -0.5f * factor,
            -0.5f * factor,  1 + 4 * factor, -0.5f * factor,
            -0.5f * factor, -0.5f * factor, -0.5f * factor
        };
        
        Kernel kernel = new Kernel(3, 3, sharpenKernel);
        ConvolveOp convolveOp = new ConvolveOp(kernel, ConvolveOp.EDGE_NO_OP, null);
        
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        convolveOp.filter(image, result);
        return result;
    }

    private BufferedImage applyContrastEnhancement(BufferedImage image, double intensity) {
        float scale = (float) (1.0 + (intensity - 50) / 50.0);
        float offset = 0.0f;
        
        RescaleOp rescaleOp = new RescaleOp(scale, offset, null);
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        rescaleOp.filter(image, result);
        return result;
    }

    private BufferedImage applyAdvancedDenoise(BufferedImage image, int level) {
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        int windowSize = 2 * level + 1;
        int halfWindow = windowSize / 2;
        
        for (int y = halfWindow; y < image.getHeight() - halfWindow; y++) {
            for (int x = halfWindow; x < image.getWidth() - halfWindow; x++) {
                int rSum = 0, gSum = 0, bSum = 0, count = 0;
                
                for (int dy = -halfWindow; dy <= halfWindow; dy++) {
                    for (int dx = -halfWindow; dx <= halfWindow; dx++) {
                        int rgb = image.getRGB(x + dx, y + dy);
                        rSum += (rgb >> 16) & 0xFF;
                        gSum += (rgb >> 8) & 0xFF;
                        bSum += rgb & 0xFF;
                        count++;
                    }
                }
                
                int r = rSum / count;
                int g = gSum / count;
                int b = bSum / count;
                
                result.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        
        return result;
    }

    private BufferedImage applyEdgeEnhancement(BufferedImage image, double intensity) {
        float factor = (float) (intensity / 50.0);
        float[] edgeKernel = {
            -1 * factor, -1 * factor, -1 * factor,
            -1 * factor,  8 * factor + 1, -1 * factor,
            -1 * factor, -1 * factor, -1 * factor
        };
        
        Kernel kernel = new Kernel(3, 3, edgeKernel);
        ConvolveOp convolveOp = new ConvolveOp(kernel, ConvolveOp.EDGE_NO_OP, null);
        
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        convolveOp.filter(image, result);
        return result;
    }

    private BufferedImage applyBrightnessAdjustment(BufferedImage image, double intensity) {
        float adjustment = (float) ((intensity - 50) * 2.55);
        
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int rgb = image.getRGB(x, y);
                int r = Math.min(255, Math.max(0, ((rgb >> 16) & 0xFF) + (int) adjustment));
                int g = Math.min(255, Math.max(0, ((rgb >> 8) & 0xFF) + (int) adjustment));
                int b = Math.min(255, Math.max(0, (rgb & 0xFF) + (int) adjustment));
                result.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        
        return result;
    }

    private BufferedImage applyHistogramEqualization(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        
        int[] histogram = new int[256];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int gray = getGrayscaleValue(image.getRGB(x, y));
                histogram[gray]++;
            }
        }
        
        int[] cdf = new int[256];
        cdf[0] = histogram[0];
        for (int i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        int cdfMin = 0;
        for (int i = 0; i < 256; i++) {
            if (cdf[i] > 0) {
                cdfMin = cdf[i];
                break;
            }
        }
        
        int[] lookup = new int[256];
        int totalPixels = width * height;
        for (int i = 0; i < 256; i++) {
            if (cdf[i] > 0) {
                lookup[i] = (int) (((cdf[i] - cdfMin) * 255.0) / (totalPixels - cdfMin));
            }
        }
        
        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                int gray = getGrayscaleValue(rgb);
                int newGray = lookup[gray];
                result.setRGB(x, y, (newGray << 16) | (newGray << 8) | newGray);
            }
        }
        
        return result;
    }

    private int getGrayscaleValue(int rgb) {
        int r = (rgb >> 16) & 0xFF;
        int g = (rgb >> 8) & 0xFF;
        int b = rgb & 0xFF;
        return (int) (0.299 * r + 0.587 * g + 0.114 * b);
    }

    public byte[] imageToBase64(BufferedImage image) {
        try {
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "png", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("图像转换失败: {}", e.getMessage());
            return new byte[0];
        }
    }
}
