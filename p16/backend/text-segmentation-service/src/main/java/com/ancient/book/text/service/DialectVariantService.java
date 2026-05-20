package com.ancient.book.text.service;

import com.ancient.book.common.entity.DialectVariant;
import com.ancient.book.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class DialectVariantService {

    private final Map<String, DialectVariant> variantDictionary = new ConcurrentHashMap<>();
    private final Map<String, List<DialectVariant>> regionVariantMap = new ConcurrentHashMap<>();
    private final Map<String, Pattern> regexPatterns = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("初始化方言异体字字典...");
        loadBuiltInVariants();
        compileRegexPatterns();
        log.info("方言异体字字典初始化完成，共加载 {} 个异体字", variantDictionary.size());
    }

    private void loadBuiltInVariants() {
        addVariant("说", "悦", "通用", "通假字", "yuè", "表示喜悦", "先秦", "《论语》", 0.95, 156);
        addVariant("见", "现", "通用", "通假字", "xiàn", "表示出现", "先秦", "《论语》", 0.92, 89);
        addVariant("反", "返", "通用", "通假字", "fǎn", "表示返回", "先秦", "《孟子》", 0.90, 67);
        addVariant("蚤", "早", "通用", "通假字", "zǎo", "表示早晨", "先秦", "《孟子》", 0.88, 45);
        addVariant("距", "拒", "通用", "通假字", "jù", "表示拒绝", "先秦", "《墨子》", 0.85, 34);
        addVariant("内", "纳", "通用", "通假字", "nà", "表示接纳", "先秦", "《左传》", 0.87, 52);
        addVariant("孰", "熟", "通用", "通假字", "shú", "表示成熟", "先秦", "《论语》", 0.86, 41);
        addVariant("匪", "非", "通用", "通假字", "fēi", "表示否定", "先秦", "《诗经》", 0.89, 78);
        addVariant("莫", "暮", "通用", "通假字", "mù", "表示傍晚", "先秦", "《论语》", 0.83, 36);
        addVariant("厝", "措", "闽方言", "通假字", "cuò", "表示放置", "汉", "《列子》", 0.78, 23);
        addVariant("吳", "吴", "吴方言", "异体字", "wú", "吴国", "先秦", "《史记》", 0.91, 67);
        addVariant("粵", "粤", "粤方言", "异体字", "yuè", "广东地区", "汉", "《汉书》", 0.93, 45);
        addVariant("閩", "闽", "闽方言", "异体字", "mǐn", "福建地区", "汉", "《山海经》", 0.92, 38);
        addVariant("蜀", "蜀", "蜀方言", "异体字", "shǔ", "四川地区", "先秦", "《尚书》", 0.94, 56);
        addVariant("齊", "齐", "北方方言", "异体字", "qí", "齐国", "先秦", "《论语》", 0.95, 78);
        addVariant("楚", "楚", "楚方言", "异体字", "chǔ", "楚国", "先秦", "《楚辞》", 0.94, 67);
        addVariant("燕", "燕", "北方方言", "异体字", "yān", "燕国", "先秦", "《史记》", 0.93, 45);
        addVariant("韓", "韩", "北方方言", "异体字", "hán", "韩国", "先秦", "《韩非子》", 0.92, 34);
        addVariant("魏", "魏", "北方方言", "异体字", "wèi", "魏国", "先秦", "《史记》", 0.93, 41);
        addVariant("秦", "秦", "西北方言", "异体字", "qín", "秦国", "先秦", "《史记》", 0.95, 89);
        addVariant("晉", "晋", "晋方言", "异体字", "jìn", "晋国", "先秦", "《左传》", 0.94, 56);
        addVariant("魯", "鲁", "鲁方言", "异体字", "lǔ", "鲁国", "先秦", "《论语》", 0.96, 98);
        addVariant("宋", "宋", "宋方言", "异体字", "sòng", "宋国", "先秦", "《墨子》", 0.91, 45);
        addVariant("衞", "卫", "卫方言", "异体字", "wèi", "卫国", "先秦", "《左传》", 0.90, 34);
        addVariant("鄭", "郑", "郑方言", "异体字", "zhèng", "郑国", "先秦", "《左传》", 0.92, 41);
        addVariant("陳", "陈", "陈方言", "异体字", "chén", "陈国", "先秦", "《论语》", 0.91, 38);
        addVariant("蔡", "蔡", "蔡方言", "异体字", "cài", "蔡国", "先秦", "《左传》", 0.89, 29);
        addVariant("許", "许", "许方言", "异体字", "xǔ", "许国", "先秦", "《左传》", 0.88, 23);
        addVariant("呂", "吕", "吕方言", "异体字", "lǚ", "吕国", "先秦", "《史记》", 0.87, 19);
        addVariant("申", "申", "申方言", "异体字", "shēn", "申国", "先秦", "《左传》", 0.86, 17);
    }

    private void addVariant(String variant, String standard, String region, String type,
                            String pinyin, String context, String period, String source,
                            double confidence, int frequency) {
        DialectVariant dv = new DialectVariant();
        dv.setVariantChar(variant);
        dv.setStandardChar(standard);
        dv.setDialectRegion(region);
        dv.setDialectType(type);
        dv.setPinyin(pinyin);
        dv.setUsageContext(context);
        dv.setHistoricalPeriod(period);
        dv.setSourceReference(source);
        dv.setConfidence(confidence);
        dv.setFrequency(frequency);
        variantDictionary.put(variant, dv);

        regionVariantMap.computeIfAbsent(region, k -> new ArrayList<>()).add(dv);
    }

    private void compileRegexPatterns() {
        for (String variant : variantDictionary.keySet()) {
            Pattern pattern = Pattern.compile(Pattern.quote(variant));
            regexPatterns.put(variant, pattern);
        }
    }

    public Map<String, Object> recognizeVariants(String text) {
        if (text == null || text.isEmpty()) {
            throw new BusinessException("文本不能为空");
        }

        log.info("开始识别方言异体字，文本长度: {}", text.length());

        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> foundVariants = new ArrayList<>();
        Set<String> regions = new HashSet<>();
        Set<String> types = new HashSet<>();
        int totalVariants = 0;

        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            String charStr = String.valueOf(c);

            if (variantDictionary.containsKey(charStr)) {
                DialectVariant dv = variantDictionary.get(charStr);
                Map<String, Object> variantInfo = new HashMap<>();
                variantInfo.put("position", i);
                variantInfo.put("variantChar", charStr);
                variantInfo.put("standardChar", dv.getStandardChar());
                variantInfo.put("dialectRegion", dv.getDialectRegion());
                variantInfo.put("dialectType", dv.getDialectType());
                variantInfo.put("pinyin", dv.getPinyin());
                variantInfo.put("usageContext", dv.getUsageContext());
                variantInfo.put("historicalPeriod", dv.getHistoricalPeriod());
                variantInfo.put("sourceReference", dv.getSourceReference());
                variantInfo.put("confidence", dv.getConfidence());
                variantInfo.put("frequency", dv.getFrequency());
                foundVariants.add(variantInfo);

                regions.add(dv.getDialectRegion());
                types.add(dv.getDialectType());
                totalVariants++;
            }
        }

        String convertedText = convertToStandard(text, foundVariants);

        result.put("originalText", text);
        result.put("convertedText", convertedText);
        result.put("foundVariants", foundVariants);
        result.put("totalVariants", totalVariants);
        result.put("detectedRegions", new ArrayList<>(regions));
        result.put("detectedTypes", new ArrayList<>(types));
        result.put("detectionRate", (double) totalVariants / text.length());
        result.put("analysisTime", System.currentTimeMillis());

        log.info("方言异体字识别完成，发现 {} 个异体字", totalVariants);
        return result;
    }

    public String convertToStandard(String text, List<Map<String, Object>> variants) {
        StringBuilder result = new StringBuilder(text);

        variants.sort((a, b) -> (Integer) b.get("position") - (Integer) a.get("position"));

        for (Map<String, Object> variant : variants) {
            int position = (Integer) variant.get("position");
            String standardChar = (String) variant.get("standardChar");
            result.replace(position, position + 1, standardChar);
        }

        return result.toString();
    }

    public Map<String, Object> convertByRegion(String text, String targetRegion) {
        log.info("按方言区域转换，目标区域: {}, 文本长度: {}", targetRegion, text.length());

        Map<String, Object> result = new HashMap<>();
        List<DialectVariant> regionVariants = regionVariantMap.getOrDefault(targetRegion, new ArrayList<>());
        Map<String, String> variantToStandard = new HashMap<>();

        for (DialectVariant dv : regionVariants) {
            variantToStandard.put(dv.getVariantChar(), dv.getStandardChar());
        }

        StringBuilder converted = new StringBuilder();
        List<Map<String, Object>> conversions = new ArrayList<>();

        for (int i = 0; i < text.length(); i++) {
            String c = String.valueOf(text.charAt(i));
            if (variantToStandard.containsKey(c)) {
                converted.append(variantToStandard.get(c));
                Map<String, Object> conv = new HashMap<>();
                conv.put("position", i);
                conv.put("original", c);
                conv.put("converted", variantToStandard.get(c));
                conv.put("region", targetRegion);
                conversions.add(conv);
            } else {
                converted.append(c);
            }
        }

        result.put("originalText", text);
        result.put("convertedText", converted.toString());
        result.put("conversions", conversions);
        result.put("totalConversions", conversions.size());
        result.put("targetRegion", targetRegion);

        return result;
    }

    public List<DialectVariant> getVariantsByRegion(String region) {
        return regionVariantMap.getOrDefault(region, new ArrayList<>());
    }

    public List<DialectVariant> searchVariants(String keyword) {
        List<DialectVariant> results = new ArrayList<>();
        for (DialectVariant dv : variantDictionary.values()) {
            if (dv.getVariantChar().contains(keyword) ||
                dv.getStandardChar().contains(keyword) ||
                dv.getDialectRegion().contains(keyword) ||
                dv.getUsageContext().contains(keyword)) {
                results.add(dv);
            }
        }
        return results;
    }

    public Map<String, Object> getDictionaryStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalVariants", variantDictionary.size());
        stats.put("totalRegions", regionVariantMap.size());
        stats.put("regionDetails", getRegionDetails());
        stats.put("typeDistribution", getTypeDistribution());
        return stats;
    }

    private Map<String, Integer> getRegionDetails() {
        Map<String, Integer> details = new HashMap<>();
        for (Map.Entry<String, List<DialectVariant>> entry : regionVariantMap.entrySet()) {
            details.put(entry.getKey(), entry.getValue().size());
        }
        return details;
    }

    private Map<String, Integer> getTypeDistribution() {
        Map<String, Integer> distribution = new HashMap<>();
        for (DialectVariant dv : variantDictionary.values()) {
            String type = dv.getDialectType();
            distribution.put(type, distribution.getOrDefault(type, 0) + 1);
        }
        return distribution;
    }

    public DialectVariant getVariantInfo(String variantChar) {
        return variantDictionary.get(variantChar);
    }

    public Map<String, Object> batchConvert(List<String> textList) {
        log.info("批量转换方言异体字，数量: {}", textList.size());

        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> batchResults = new ArrayList<>();
        int totalConversions = 0;

        for (String text : textList) {
            Map<String, Object> itemResult = recognizeVariants(text);
            batchResults.add(itemResult);
            totalConversions += (Integer) itemResult.get("totalVariants");
        }

        result.put("batchResults", batchResults);
        result.put("totalConversions", totalConversions);
        result.put("averageConversionsPerText", (double) totalConversions / textList.size());
        result.put("totalTexts", textList.size());

        return result;
    }

    public Map<String, Object> analyzeDialectDistribution(String text) {
        log.info("分析文本方言分布，文本长度: {}", text.length());

        Map<String, Integer> regionCount = new HashMap<>();
        Map<String, Integer> typeCount = new HashMap<>();
        int totalVariants = 0;

        for (char c : text.toCharArray()) {
            String charStr = String.valueOf(c);
            if (variantDictionary.containsKey(charStr)) {
                DialectVariant dv = variantDictionary.get(charStr);
                regionCount.put(dv.getDialectRegion(),
                    regionCount.getOrDefault(dv.getDialectRegion(), 0) + 1);
                typeCount.put(dv.getDialectType(),
                    typeCount.getOrDefault(dv.getDialectType(), 0) + 1);
                totalVariants++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalVariants", totalVariants);
        result.put("regionDistribution", regionCount);
        result.put("typeDistribution", typeCount);
        result.put("dominantRegion", getDominantRegion(regionCount));
        result.put("dominantType", getDominantType(typeCount));

        return result;
    }

    private String getDominantRegion(Map<String, Integer> regionCount) {
        return regionCount.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("未知");
    }

    private String getDominantType(Map<String, Integer> typeCount) {
        return typeCount.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("未知");
    }
}
