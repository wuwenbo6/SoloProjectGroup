package com.ancient.book.semantic.service;

import com.ancient.book.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SemanticMatchingService {

    private final AncientChineseDictionary dictionary;

    public Map<String, Object> getModernInterpretation(String ancientText) {
        try {
            log.info("古文释义处理，文本长度: {}", ancientText.length());

            String pinyin = dictionary.getPinyin(ancientText);
            String modernTranslation = dictionary.getModernTranslation(ancientText);
            String semanticMeaning = dictionary.getSemanticMeaning(ancientText);
            String historicalContext = dictionary.getHistoricalContext(ancientText);
            List<String> variants = dictionary.getVariants(ancientText);

            Map<String, Object> result = new HashMap<>();
            result.put("ancientText", ancientText);
            result.put("pinyin", pinyin);
            result.put("modernTranslation", modernTranslation);
            result.put("semanticMeaning", semanticMeaning);
            result.put("historicalContext", historicalContext);
            result.put("variants", variants);
            result.put("confidenceScore", calculateConfidenceScore(ancientText));
            result.put("success", true);

            log.info("古文释义处理完成");
            return result;

        } catch (Exception e) {
            log.error("古文释义处理失败", e);
            throw new BusinessException("古文释义处理失败: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> matchSemanticUnits(String text) {
        try {
            log.info("语义单元匹配处理，文本: {}", text);

            List<Map<String, Object>> matches = new ArrayList<>();
            List<String> units = extractSemanticUnits(text);

            for (int i = 0; i < units.size(); i++) {
                String unit = units.get(i);
                if (unit.length() >= 1) {
                    Map<String, Object> match = new HashMap<>();
                    match.put("unit", unit);
                    match.put("meaning", dictionary.getWordMeaning(unit));
                    match.put("position", i);
                    match.put("length", unit.length());
                    match.put("pinyin", dictionary.getPinyin(unit));
                    match.put("confidence", Math.min(0.9, 0.7 + Math.random() * 0.2));
                    matches.add(match);
                }
            }

            log.info("语义单元匹配完成，匹配数量: {}", matches.size());
            return matches;

        } catch (Exception e) {
            log.error("语义单元匹配失败", e);
            throw new BusinessException("语义单元匹配失败: " + e.getMessage());
        }
    }

    public Map<String, Object> alignAncientModern(String ancientText, String modernText) {
        try {
            log.info("古今文语义对齐处理");

            Map<String, Object> alignment = new HashMap<>();
            alignment.put("ancientText", ancientText);
            alignment.put("modernText", modernText);
            alignment.put("alignmentScore", calculateAlignmentScore(ancientText, modernText));
            alignment.put("alignedPairs", generateAlignedPairs(ancientText, modernText));
            alignment.put("mappingQuality", evaluateMappingQuality(ancientText, modernText));

            return alignment;

        } catch (Exception e) {
            log.error("古今文语义对齐失败", e);
            throw new BusinessException("古今文语义对齐失败: " + e.getMessage());
        }
    }

    public Map<String, Object> getWordDictionary(String word) {
        try {
            log.info("查询字典词条: {}", word);

            Map<String, Object> result = new HashMap<>();
            result.put("word", word);
            result.put("pinyin", dictionary.getPinyin(word));
            result.put("meanings", dictionary.getWordMeanings(word));
            result.put("examples", dictionary.getExamples(word));
            result.put("variants", dictionary.getVariants(word));
            result.put("relatedWords", dictionary.getRelatedWords(word));

            return result;

        } catch (Exception e) {
            log.error("字典查询失败", e);
            throw new BusinessException("字典查询失败: " + e.getMessage());
        }
    }

    private double calculateConfidenceScore(String text) {
        return Math.min(0.98, 0.85 + Math.random() * 0.1);
    }

    private double calculateAlignmentScore(String ancientText, String modernText) {
        double baseScore = 0.75;
        int commonChars = 0;
        Set<Character> ancientChars = new HashSet<>();
        for (char c : ancientText.toCharArray()) ancientChars.add(c);
        for (char c : modernText.toCharArray()) {
            if (ancientChars.contains(c)) commonChars++;
        }
        double similarity = (double) commonChars / Math.max(ancientText.length(), modernText.length());
        return Math.min(0.98, baseScore + similarity * 0.2);
    }

    private List<String> extractSemanticUnits(String text) {
        List<String> units = new ArrayList<>();
        int i = 0;
        while (i < text.length()) {
            int maxLen = Math.min(4, text.length() - i);
            boolean matched = false;
            for (int len = maxLen; len >= 1; len--) {
                String candidate = text.substring(i, i + len);
                if (dictionary.containsWord(candidate)) {
                    units.add(candidate);
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                units.add(String.valueOf(text.charAt(i)));
                i++;
            }
        }
        return units;
    }

    private List<Map<String, String>> generateAlignedPairs(String ancientText, String modernText) {
        List<Map<String, String>> pairs = new ArrayList<>();

        int maxLen = Math.min(4, ancientText.length());
        for (int i = 0; i < ancientText.length(); i += maxLen) {
            int end = Math.min(i + maxLen, ancientText.length());
            String ancientSeg = ancientText.substring(i, end);
            String modernSeg = dictionary.getModernTranslation(ancientSeg);

            Map<String, String> pair = new HashMap<>();
            pair.put("ancient", ancientSeg);
            pair.put("modern", modernSeg);
            pair.put("alignment", String.format("%.2f", 0.7 + Math.random() * 0.25));
            pairs.add(pair);
        }

        return pairs;
    }

    private String evaluateMappingQuality(String ancientText, String modernText) {
        double score = calculateAlignmentScore(ancientText, modernText);
        if (score >= 0.9) return "高";
        if (score >= 0.75) return "中";
        return "低";
    }
}
