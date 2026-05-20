package com.mortise.furniture.service;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.mortise.furniture.config.DataSourceConfig;
import com.mortise.furniture.dto.SimilarFurnitureDTO;
import com.mortise.furniture.entity.Furniture;
import com.mortise.furniture.entity.ModelFeature;
import com.mortise.furniture.repository.ModelFeatureMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ModelSimilarityService extends ServiceImpl<ModelFeatureMapper, ModelFeature> {

    @Autowired
    private FurnitureService furnitureService;

    @Autowired
    private MortiseStructureService mortiseStructureService;

    private final Map<String, List<double[]>> featureCache = new ConcurrentHashMap<>();

    public List<SimilarFurnitureDTO> findSimilarFurniture(Long furnitureId, int topN) {
        Furniture targetFurniture = furnitureService.getFurnitureById(furnitureId);
        if (targetFurniture == null) {
            return Collections.emptyList();
        }

        ModelFeature targetFeature = extractOrGetFeatures(furnitureId);
        if (targetFeature == null) {
            return Collections.emptyList();
        }

        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        List<Furniture> allFurniture = furnitureService.list();
        DataSourceConfig.DynamicDataSource.clearDataSource();

        List<SimilarFurnitureDTO> results = new ArrayList<>();

        for (Furniture furniture : allFurniture) {
            if (furniture.getId().equals(furnitureId)) continue;

            ModelFeature feature = extractOrGetFeatures(furniture.getId());
            if (feature == null) continue;

            double similarity = calculateSimilarity(targetFeature, feature);
            if (similarity > 0.3) {
                SimilarFurnitureDTO dto = new SimilarFurnitureDTO();
                dto.setFurniture(furniture);
                dto.setSimilarityScore(similarity);
                dto.setSimilarityReason(generateReason(targetFeature, feature, similarity));
                results.add(dto);
            }
        }

        return results.stream()
                .sorted((a, b) -> Double.compare(b.getSimilarityScore(), a.getSimilarityScore()))
                .limit(topN)
                .collect(Collectors.toList());
    }

    public ModelFeature extractOrGetFeatures(Long furnitureId) {
        String cacheKey = "feature:" + furnitureId;
        if (featureCache.containsKey(cacheKey)) {
            DataSourceConfig.DynamicDataSource.setDataSource("furniture");
            ModelFeature feature = lambdaQuery().eq(ModelFeature::getFurnitureId, furnitureId).one();
            DataSourceConfig.DynamicDataSource.clearDataSource();
            return feature;
        }

        return extractFeatures(furnitureId);
    }

    public ModelFeature extractFeatures(Long furnitureId) {
        Furniture furniture = furnitureService.getFurnitureById(furnitureId);
        if (furniture == null) return null;

        DataSourceConfig.DynamicDataSource.setDataSource("mortise");
        int mortiseCount = mortiseStructureService.getByFurnitureId(furnitureId).size();
        DataSourceConfig.DynamicDataSource.clearDataSource();

        ModelFeature feature = new ModelFeature();
        feature.setFurnitureId(furnitureId);
        feature.setWidth(furniture.getWidth());
        feature.setHeight(furniture.getHeight());
        feature.setDepth(furniture.getDepth());
        feature.setVolume(furniture.getWidth() * furniture.getHeight() * furniture.getDepth());
        feature.setMortiseCount(mortiseCount);
        feature.setCategory(furniture.getCategory());
        feature.setMaterial(furniture.getMaterial());
        feature.setComponentCount(mortiseCount + 1);
        feature.setComplexityScore(calculateComplexity(furniture, mortiseCount));

        double[] featureVector = generateFeatureVector(furniture, mortiseCount);
        feature.setFeatureVector(Arrays.toString(featureVector));
        feature.setHash(generateHash(featureVector));

        feature.setCreateTime(LocalDateTime.now());
        feature.setUpdateTime(LocalDateTime.now());
        feature.setDeleted(false);

        DataSourceConfig.DynamicDataSource.setDataSource("furniture");
        save(feature);
        DataSourceConfig.DynamicDataSource.clearDataSource();

        return feature;
    }

    private double calculateSimilarity(ModelFeature f1, ModelFeature f2) {
        double[] v1 = parseFeatureVector(f1.getFeatureVector());
        double[] v2 = parseFeatureVector(f2.getFeatureVector());

        double cosineSim = cosineSimilarity(v1, v2);
        double sizeSim = sizeSimilarity(f1, f2);
        double categorySim = f1.getCategory().equals(f2.getCategory()) ? 1.0 : 0.0;
        double materialSim = f1.getMaterial() != null && f1.getMaterial().equals(f2.getMaterial()) ? 1.0 : 0.0;
        double mortiseSim = Math.abs(f1.getMortiseCount() - f2.getMortiseCount()) < 3 ? 0.8 : 0.2;

        return cosineSim * 0.4 + sizeSim * 0.25 + categorySim * 0.15 + materialSim * 0.1 + mortiseSim * 0.1;
    }

    private double[] generateFeatureVector(Furniture furniture, int mortiseCount) {
        double[] vector = new double[16];

        double maxVolume = 1000000.0;
        vector[0] = Math.min(furniture.getWidth() / 200.0, 1.0);
        vector[1] = Math.min(furniture.getHeight() / 200.0, 1.0);
        vector[2] = Math.min(furniture.getDepth() / 200.0, 1.0);
        vector[3] = Math.min((furniture.getWidth() * furniture.getHeight() * furniture.getDepth()) / maxVolume, 1.0);

        double aspectRatio = furniture.getHeight() > 0 ? furniture.getWidth() / furniture.getHeight() : 1.0;
        vector[4] = Math.min(aspectRatio / 3.0, 1.0);

        vector[5] = Math.min(mortiseCount / 20.0, 1.0);

        String category = furniture.getCategory();
        if (category != null) {
            switch (category) {
                case "椅子": vector[6] = 1.0; break;
                case "桌子": vector[7] = 1.0; break;
                case "柜子": vector[8] = 1.0; break;
                case "床": vector[9] = 1.0; break;
                default: vector[10] = 1.0; break;
            }
        }

        String material = furniture.getMaterial();
        if (material != null) {
            switch (material) {
                case "黄花梨": vector[11] = 1.0; break;
                case "红木": vector[12] = 1.0; break;
                case "榆木": vector[13] = 1.0; break;
                default: vector[14] = 0.5; break;
            }
        }

        vector[15] = Math.min(mortiseCount * 0.05 + furniture.getWidth() * 0.001, 1.0);

        return vector;
    }

    private double cosineSimilarity(double[] v1, double[] v2) {
        if (v1.length != v2.length) return 0.0;

        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;

        for (int i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            norm1 += v1[i] * v1[i];
            norm2 += v2[i] * v2[i];
        }

        if (norm1 == 0 || norm2 == 0) return 0.0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    private double sizeSimilarity(ModelFeature f1, ModelFeature f2) {
        double volumeDiff = Math.abs(f1.getVolume() - f2.getVolume());
        double maxVolume = Math.max(f1.getVolume(), f2.getVolume());
        return maxVolume > 0 ? 1.0 - (volumeDiff / maxVolume) : 1.0;
    }

    private double calculateComplexity(Furniture furniture, int mortiseCount) {
        double score = 0.0;
        score += Math.min(mortiseCount * 0.1, 5.0);
        score += Math.min(furniture.getWidth() * 0.005, 2.0);
        score += Math.min(furniture.getHeight() * 0.005, 2.0);
        score += furniture.getMaterial() != null && furniture.getMaterial().contains("花梨") ? 1.0 : 0.0;
        return Math.min(score, 10.0);
    }

    private String generateReason(ModelFeature f1, ModelFeature f2, double similarity) {
        List<String> reasons = new ArrayList<>();

        if (f1.getCategory().equals(f2.getCategory())) {
            reasons.add("同属" + f1.getCategory() + "类别");
        }

        double sizeDiff = Math.abs(f1.getVolume() - f2.getVolume()) / Math.max(f1.getVolume(), f2.getVolume());
        if (sizeDiff < 0.3) {
            reasons.add("尺寸相近");
        }

        if (Math.abs(f1.getMortiseCount() - f2.getMortiseCount()) < 3) {
            reasons.add("榫卯结构数量相近");
        }

        if (f1.getMaterial() != null && f1.getMaterial().equals(f2.getMaterial())) {
            reasons.add("材质相同");
        }

        return String.join("、", reasons);
    }

    private double[] parseFeatureVector(String featureVectorStr) {
        try {
            return JSON.parseObject(featureVectorStr, double[].class);
        } catch (Exception e) {
            return new double[16];
        }
    }

    private String generateHash(double[] featureVector) {
        try {
            StringBuilder sb = new StringBuilder();
            for (double v : featureVector) {
                sb.append(String.format("%.4f", v));
            }
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return new BigInteger(1, digest).toString(16);
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }

    public void clearCache() {
        featureCache.clear();
    }
}
