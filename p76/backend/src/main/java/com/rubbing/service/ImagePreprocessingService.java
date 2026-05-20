package com.rubbing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.util.Arrays;

@Slf4j
@Service
public class ImagePreprocessingService {

    public BufferedImage preprocessImage(BufferedImage originalImage, double sharpness, int noiseLevel, int brightness, int contrast) {
        log.info("开始图像预处理: sharpness={}, noiseLevel={}, brightness={}, contrast={}", 
            sharpness, noiseLevel, brightness, contrast);
        
        try {
            BufferedImage processedImage = originalImage;
            
            if (brightness != 50 || contrast != 50) {
                processedImage = adjustBrightnessContrast(processedImage, brightness, contrast);
            }
            
            if (noiseLevel > 0) {
                processedImage = applyDenoise(processedImage, noiseLevel);
            }
            
            if (sharpness > 0) {
                processedImage = applySharpening(processedImage, sharpness);
            }
            
            log.info("图像预处理完成");
            return processedImage;
        } catch (Exception e) {
            log.error("图像预处理失败: {}", e.getMessage());
            return originalImage;
        }
    }

    private BufferedImage applySharpening(BufferedImage image, double sharpnessFactor) {
        float factor = (float) (sharpnessFactor / 50.0);
        
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
        log.debug("图像锐化完成");
        return result;
    }

    private BufferedImage applyDenoise(BufferedImage image, int noiseLevel) {
        if (noiseLevel <= 3) {
            return applyMedianFilter(image, 3);
        } else if (noiseLevel <= 7) {
            return applyGaussianFilter(image);
        } else {
            BufferedImage denoised = applyGaussianFilter(image);
            return applyMedianFilter(denoised, 3);
        }
    }

    private BufferedImage applyMedianFilter(BufferedImage image, int kernelSize) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, image.getType());
        
        int halfSize = kernelSize / 2;
        int[] pixels = new int[kernelSize * kernelSize];
        
        for (int y = halfSize; y < height - halfSize; y++) {
            for (int x = halfSize; x < width - halfSize; x++) {
                int index = 0;
                for (int ky = -halfSize; ky <= halfSize; ky++) {
                    for (int kx = -halfSize; kx <= halfSize; kx++) {
                        pixels[index++] = image.getRGB(x + kx, y + ky);
                    }
                }
                
                Arrays.sort(pixels);
                int medianPixel = pixels[pixels.length / 2];
                result.setRGB(x, y, medianPixel);
            }
        }
        
        log.debug("中值滤波去噪完成");
        return result;
    }

    private BufferedImage applyGaussianFilter(BufferedImage image) {
        float[] gaussianKernel = {
            1/16f, 2/16f, 1/16f,
            2/16f, 4/16f, 2/16f,
            1/16f, 2/16f, 1/16f
        };
        
        Kernel kernel = new Kernel(3, 3, gaussianKernel);
        ConvolveOp convolveOp = new ConvolveOp(kernel, ConvolveOp.EDGE_NO_OP, null);
        
        BufferedImage result = new BufferedImage(
            image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        
        convolveOp.filter(image, result);
        log.debug("高斯滤波去噪完成");
        return result;
    }

    private BufferedImage adjustBrightnessContrast(BufferedImage image, int brightness, int contrast) {
        int width = image.getWidth();
        int height = image.getHeight();
        BufferedImage result = new BufferedImage(width, height, image.getType());
        
        float brightnessFactor = (brightness - 50) / 50.0f;
        float contrastFactor = (float) Math.pow((contrast + 25) / 125.0, 2);
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                
                r = adjustPixel(r, brightnessFactor, contrastFactor);
                g = adjustPixel(g, brightnessFactor, contrastFactor);
                b = adjustPixel(b, brightnessFactor, contrastFactor);
                
                result.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        
        log.debug("亮度对比度调整完成");
        return result;
    }

    private int adjustPixel(int pixel, float brightnessFactor, float contrastFactor) {
        float value = pixel / 255.0f;
        value = value + brightnessFactor;
        value = ((value - 0.5f) * contrastFactor) + 0.5f;
        value = Math.max(0, Math.min(1, value));
        return (int) (value * 255);
    }

    public double calculateImageQuality(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        
        double sharpnessScore = calculateSharpnessScore(image, width, height);
        double contrastScore = calculateContrastScore(image, width, height);
        double noiseScore = calculateNoiseScore(image, width, height);
        
        double overallScore = sharpnessScore * 0.4 + contrastScore * 0.35 + noiseScore * 0.25;
        log.info("图像质量评分: sharpness={}, contrast={}, noise={}, overall={}", 
            String.format("%.2f", sharpnessScore), 
            String.format("%.2f", contrastScore), 
            String.format("%.2f", noiseScore), 
            String.format("%.2f", overallScore));
        
        return overallScore;
    }

    private double calculateSharpnessScore(BufferedImage image, int width, int height) {
        int laplacianSum = 0;
        int count = 0;
        
        int[] laplacianKernel = {-1, -4, -1, -4, 20, -4, -1, -4, -1};
        
        for (int y = 1; y < height - 1; y++) {
            for (int x = 1; x < width - 1; x++) {
                int graySum = 0;
                int kernelIndex = 0;
                for (int ky = -1; ky <= 1; ky++) {
                    for (int kx = -1; kx <= 1; kx++) {
                        int rgb = image.getRGB(x + kx, y + ky);
                        int gray = (int) ((0.299 * ((rgb >> 16) & 0xFF)) + 
                                          (0.587 * ((rgb >> 8) & 0xFF)) + 
                                          (0.114 * (rgb & 0xFF)));
                        graySum += gray * laplacianKernel[kernelIndex++];
                    }
                }
                laplacianSum += Math.abs(graySum);
                count++;
            }
        }
        
        double variance = count > 0 ? laplacianSum / (double) count : 0;
        double score = Math.min(100, (variance / 1000.0) * 100);
        return score;
    }

    private double calculateContrastScore(BufferedImage image, int width, int height) {
        int[] histogram = new int[256];
        
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                int gray = (int) ((0.299 * ((rgb >> 16) & 0xFF)) + 
                                  (0.587 * ((rgb >> 8) & 0xFF)) + 
                                  (0.114 * (rgb & 0xFF)));
                histogram[gray]++;
            }
        }
        
        int minGray = 0, maxGray = 255;
        int totalPixels = width * height;
        int threshold = (int) (totalPixels * 0.01);
        
        int cumulative = 0;
        for (int i = 0; i < 256; i++) {
            cumulative += histogram[i];
            if (cumulative >= threshold) {
                minGray = i;
                break;
            }
        }
        
        cumulative = 0;
        for (int i = 255; i >= 0; i--) {
            cumulative += histogram[i];
            if (cumulative >= threshold) {
                maxGray = i;
                break;
            }
        }
        
        double contrast = maxGray - minGray;
        return Math.min(100, (contrast / 200.0) * 100);
    }

    private double calculateNoiseScore(BufferedImage image, int width, int height) {
        int noiseEstimate = 0;
        int count = 0;
        
        for (int y = 1; y < height - 1; y++) {
            for (int x = 1; x < width - 1; x++) {
                int center = getGrayValue(image, x, y);
                int neighbors = getGrayValue(image, x-1, y) + getGrayValue(image, x+1, y) +
                                getGrayValue(image, x, y-1) + getGrayValue(image, x, y+1);
                noiseEstimate += Math.abs(4 * center - neighbors);
                count++;
            }
        }
        
        double noiseLevel = count > 0 ? noiseEstimate / (double) count : 0;
        return Math.max(0, 100 - (noiseLevel / 50.0) * 100);
    }

    private int getGrayValue(BufferedImage image, int x, int y) {
        int rgb = image.getRGB(x, y);
        return (int) ((0.299 * ((rgb >> 16) & 0xFF)) + 
                      (0.587 * ((rgb >> 8) & 0xFF)) + 
                      (0.114 * (rgb & 0xFF)));
    }
}
