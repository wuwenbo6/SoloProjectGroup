package com.ancient.book.semantic.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class AncientChineseDictionary {

    private final Map<String, WordEntry> dictionary = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        log.info("初始化古汉语字典...");
        loadDefaultDictionary();
        log.info("古汉语字典初始化完成，词条数量: {}", dictionary.size());
    }

    private void loadDefaultDictionary() {
        addEntry("学而时习之", "xué ér shí xí zhī",
                Arrays.asList("学习并且按时温习"),
                "学习要持之以恒，按时复习巩固",
                Arrays.asList("出自《论语·学而》"));

        addEntry("不亦乐乎", "bù yì lè hū",
                Arrays.asList("不是很快乐吗"),
                "表示非常快乐、高兴",
                Arrays.asList("出自《论语·学而》"));

        addEntry("有朋自远方来", "yǒu péng zì yuǎn fāng lái",
                Arrays.asList("有志同道合的人从远方来"),
                "朋友从远方来，令人高兴",
                Arrays.asList("出自《论语·学而》"));

        addEntry("人不知而不愠", "rén bù zhī ér bù yùn",
                Arrays.asList("别人不了解自己也不生气"),
                "君子的修养，不因为别人不了解自己而生气",
                Arrays.asList("出自《论语·学而》"));

        addEntry("不亦君子乎", "bù yì jūn zǐ hū",
                Arrays.asList("不也是品德高尚的君子吗"),
                "反问句，表示这就是君子的行为",
                Arrays.asList("出自《论语·学而》"));

        addEntry("学而", "xué ér",
                Arrays.asList("学习并且", "学习了之后"),
                "学习并付诸实践",
                Arrays.asList("出自《论语》"));

        addEntry("君子", "jūn zǐ",
                Arrays.asList("品德高尚的人", "统治者"),
                "儒家理想人格，指有道德、有修养的人",
                Arrays.asList("出自《论语》"));

        addEntry("学", "xué",
                Arrays.asList("学习", "学问", "学校"),
                "获取知识、技能的过程",
                Arrays.asList("出自《论语》"));

        addEntry("习", "xí",
                Arrays.asList("复习", "练习", "习惯"),
                "温习、练习，巩固所学",
                Arrays.asList("出自《论语》"));

        addEntry("乐", "lè",
                Arrays.asList("快乐", "愉悦", "乐于"),
                "心情愉悦、高兴",
                Arrays.asList("出自《论语》"));

        addEntry("知", "zhī",
                Arrays.asList("知道", "了解", "智慧"),
                "认知、了解，同'智'",
                Arrays.asList("出自《论语》"));

        addEntry("仁", "rén",
                Arrays.asList("仁爱", "仁慈", "仁德"),
                "儒家核心概念，爱人的品德",
                Arrays.asList("出自《论语》"));

        addEntry("义", "yì",
                Arrays.asList("正义", "道义", "意义"),
                "正当的道理、行为准则",
                Arrays.asList("出自《论语》"));

        addEntry("道", "dào",
                Arrays.asList("道理", "道路", "方法"),
                "事物的规律、原则",
                Arrays.asList("出自《论语》"));

        addEntry("德", "dé",
                Arrays.asList("品德", "道德", "恩德"),
                "人的道德品质",
                Arrays.asList("出自《论语》"));
    }

    private void addEntry(String word, String pinyin, List<String> meanings,
                          String semanticMeaning, List<String> examples) {
        WordEntry entry = new WordEntry();
        entry.word = word;
        entry.pinyin = pinyin;
        entry.meanings = meanings;
        entry.semanticMeaning = semanticMeaning;
        entry.examples = examples;
        entry.variants = new ArrayList<>();
        entry.relatedWords = new ArrayList<>();
        dictionary.put(word, entry);
    }

    public String getPinyin(String word) {
        if (word == null || word.isEmpty()) return "";

        if (dictionary.containsKey(word)) {
            return dictionary.get(word).pinyin;
        }

        StringBuilder pinyin = new StringBuilder();
        for (char c : word.toCharArray()) {
            String charPinyin = getCharPinyin(String.valueOf(c));
            if (pinyin.length() > 0) pinyin.append(" ");
            pinyin.append(charPinyin);
        }
        return pinyin.toString();
    }

    private String getCharPinyin(String c) {
        Map<String, String> charPinyin = new HashMap<>();
        charPinyin.put("子", "zǐ");
        charPinyin.put("曰", "yuē");
        charPinyin.put("学", "xué");
        charPinyin.put("习", "xí");
        charPinyin.put("之", "zhī");
        charPinyin.put("不", "bù");
        charPinyin.put("亦", "yì");
        charPinyin.put("乐", "lè");
        charPinyin.put("乎", "hū");
        charPinyin.put("有", "yǒu");
        charPinyin.put("朋", "péng");
        charPinyin.put("自", "zì");
        charPinyin.put("远", "yuǎn");
        charPinyin.put("方", "fāng");
        charPinyin.put("来", "lái");
        charPinyin.put("人", "rén");
        charPinyin.put("知", "zhī");
        charPinyin.put("而", "ér");
        charPinyin.put("愠", "yùn");
        charPinyin.put("君", "jūn");

        return charPinyin.getOrDefault(c, c);
    }

    public String getModernTranslation(String ancientText) {
        if (dictionary.containsKey(ancientText)) {
            return dictionary.get(ancientText).meanings.get(0);
        }

        if (ancientText.length() <= 4) {
            return getDirectTranslation(ancientText);
        }

        StringBuilder result = new StringBuilder();
        int i = 0;
        while (i < ancientText.length()) {
            boolean matched = false;
            for (int len = Math.min(4, ancientText.length() - i); len >= 1; len--) {
                String seg = ancientText.substring(i, i + len);
                if (dictionary.containsKey(seg)) {
                    result.append(dictionary.get(seg).meanings.get(0));
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                result.append(ancientText.charAt(i));
                i++;
            }
        }

        return result.toString();
    }

    private String getDirectTranslation(String text) {
        Map<String, String> translations = new HashMap<>();
        translations.put("子曰", "孔子说");
        translations.put("学而", "学习");
        translations.put("时习", "按时温习");
        translations.put("说", "喜悦");
        translations.put("朋", "朋友");
        translations.put("远方", "远方");
        translations.put("人不知", "别人不了解");
        translations.put("不愠", "不生气");
        translations.put("君子", "君子");
        translations.put("仁", "仁爱的品德");
        translations.put("义", "正义的行为");

        StringBuilder result = new StringBuilder();
        int i = 0;
        while (i < text.length()) {
            boolean matched = false;
            for (int len = Math.min(2, text.length() - i); len >= 1; len--) {
                String key = text.substring(i, i + len);
                if (translations.containsKey(key)) {
                    result.append(translations.get(key));
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                result.append(text.charAt(i));
                i++;
            }
        }
        return result.toString();
    }

    public String getSemanticMeaning(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).semanticMeaning;
        }
        return "表示" + getModernTranslation(word) + "的含义";
    }

    public String getHistoricalContext(String word) {
        if (dictionary.containsKey(word) && !dictionary.get(word).examples.isEmpty()) {
            return dictionary.get(word).examples.get(0);
        }
        return "出自《论语》等儒家经典著作";
    }

    public List<String> getVariants(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).variants;
        }
        return new ArrayList<>();
    }

    public String getWordMeaning(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).meanings.get(0);
        }
        return getModernTranslation(word);
    }

    public List<String> getWordMeanings(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).meanings;
        }
        return Collections.singletonList(getModernTranslation(word));
    }

    public List<String> getExamples(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).examples;
        }
        return new ArrayList<>();
    }

    public List<String> getRelatedWords(String word) {
        if (dictionary.containsKey(word)) {
            return dictionary.get(word).relatedWords;
        }
        return new ArrayList<>();
    }

    public boolean containsWord(String word) {
        return dictionary.containsKey(word);
    }

    private static class WordEntry {
        String word;
        String pinyin;
        List<String> meanings;
        String semanticMeaning;
        List<String> examples;
        List<String> variants;
        List<String> relatedWords;
    }
}
