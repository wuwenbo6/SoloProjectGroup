package com.rubbing.service;

import com.rubbing.entity.dictionary.CharacterDictionary;
import com.rubbing.repository.CharacterDictionaryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional("dictionaryTransactionManager")
public class DictionaryService {

    @Autowired
    private CharacterDictionaryRepository dictionaryRepository;

    public Optional<CharacterDictionary> lookupCharacter(String character) {
        return dictionaryRepository.findByCharacter(character);
    }

    public Map<String, CharacterDictionary> lookupCharacters(List<String> characters) {
        List<CharacterDictionary> results = dictionaryRepository.findByCharactersIn(characters);
        return results.stream()
                .collect(Collectors.toMap(CharacterDictionary::getCharacter, c -> c));
    }

    public List<CharacterDictionary> searchByPinyin(String pinyin) {
        return dictionaryRepository.findByPinyinContaining(pinyin);
    }

    public List<CharacterDictionary> findByRadical(String radical) {
        return dictionaryRepository.findByRadical(radical);
    }

    public List<CharacterDictionary> searchByKeyword(String keyword) {
        return dictionaryRepository.searchByDefinition(keyword);
    }

    @PostConstruct
    public void initSampleData() {
        if (dictionaryRepository.count() == 0) {
            String[][] sampleData = {
                    {"文", "wén", "ㄨㄣˊ", "文", "4", "文", "", "① 记录语言的符号：文字、文盲。② 用文字记下来以及与之有关的：文凭、文艺。③ 人类劳动成果的总结：文化、文物。④ 温和：文火、文静。", "文字、文化、文章", "常用汉字", "U+6587"},
                    {"字", "zì", "ㄗˋ", "子", "6", "字", "", "① 用来记录语言的符号：文字、汉字。② 文字的不同形式，书法的派别：草字、篆字。③ 书法的作品：字画、字幅。④ 字的音：字正腔圆。", "汉字、文字、字体", "常用汉字", "U+5B57"},
                    {"人", "rén", "ㄖㄣˊ", "人", "2", "人", "", "① 由类人猿进化而成的能制造和使用工具进行劳动、并能运用语言进行交际的动物：人类。② 别人，他人：待人热诚。③ 人的品质、性情、名誉：丢人，文如其人。", "人民、人类、人口", "常用汉字", "U+4EBA"},
                    {"大", "dà,dài", "ㄉㄚˋ,ㄉㄞˋ", "大", "3", "大", "", "① 指面积、体积、容量、数量、强度、力量超过一般或超过所比较的对象：大厅、大政。② 大小的对比：这间房有那间两个大。③ 规模广，程度深，性质重要：大局、大众。", "大小、大家、大地", "常用汉字", "U+5927"},
                    {"中", "zhōng,zhòng", "ㄓㄨㄥ,ㄓㄨㄥˋ", "丨", "4", "中", "", "① 和四方、上下或两端距离同等的地位：中心、当中。② 在一定范围内，里面：暗中、房中。③ 性质或等级在两端之间的：中辍、中等。", "中国、中心、中间", "常用汉字", "U+4E2D"},
                    {"国", "guó", "ㄍㄨㄛˊ", "囗", "8", "國", "", "① 有土地、人民、主权的政体（古代指诸侯所受封的地域）：国家、国土。② 特指中国的：国产、国货。", "国家、中国、国际", "常用汉字", "U+56FD"},
                    {"山", "shān", "ㄕㄢ", "山", "3", "山", "", "① 地面形成的高耸的部分：土山、山崖。② 形状像山的：山墙。③ 形容大声：山响、山呼万岁。", "山水、山东、山西", "常用汉字", "U+5C71"},
                    {"水", "shuǐ", "ㄕㄨㄟˇ", "水", "4", "水", "", "① 一种无色、无臭、透明的液体：水稻、水滴石穿。② 河流：汉水、湘水。③ 江河湖海的通称：水库、水利。", "水果、水平、水泥", "常用汉字", "U+6C34"},
                    {"日", "rì", "ㄖˋ", "日", "4", "日", "", "① 离地球最近的恒星（亦称“太阳”）：日月星辰。② 白天，与“夜”相对：日班。③ 天，一昼夜：多日不见、今日。", "日子、日月、日本", "常用汉字", "U+65E5"},
                    {"月", "yuè", "ㄩㄝˋ", "月", "4", "月", "", "① 地球最大的天然卫星（亦称“月亮”、“月球”）：月光（月球反射太阳的光）、月蚀。② 计时单位：一月、月份。", "月亮、月光、月饼", "常用汉字", "U+6708"},
                    {"一", "yī", "ㄧ", "一", "1", "一", "壹", "① 数名，最小的正整数（在钞票和单据上常用大写“壹”代）。② 纯；专：专一、一心一意。③ 全；满：一生、一地水。", "一个、第一、一般", "常用汉字", "U+4E00"},
                    {"十", "shí", "ㄕˊ", "十", "2", "十", "拾", "① 数名，九加一（在钞票和单据上常用大写“拾”代）。② 表示多、久：十室九空。③ 表示达到顶点：十足、十成。", "十个、十年、十分", "常用汉字", "U+5341"},
                    {"百", "bǎi", "ㄅㄞˇ", "白", "6", "百", "佰", "① 数名，十个十（在钞票和单据上常用大写“佰”代）：百步穿杨、百儿八十。② 喻很多：百草、百货、百姓。", "百万、百姓、百分", "常用汉字", "U+767E"},
                    {"千", "qiān", "ㄑㄧㄢ", "十", "3", "千", "仟", "① 数目，十个一百（在钞票和单据上常用大写“仟”代）：千米（公里）。② 喻极多：千方百计、千言万语。", "千万、千克、千年", "常用汉字", "U+5343"},
                    {"万", "wàn,mò", "ㄨㄢˋ,ㄇㄛˋ", "一", "3", "萬", "", "① 数目，十个一千：万户侯。② 喻极多：万物、万方。③ 极，很，绝对：万万、万幸。", "万一、万能、万岁", "常用汉字", "U+4E07"}
            };

            for (String[] data : sampleData) {
                CharacterDictionary cd = new CharacterDictionary();
                cd.setCharacter(data[0]);
                cd.setPinyin(data[1]);
                cd.setZhuyin(data[2]);
                cd.setRadical(data[3]);
                cd.setStrokeCount(Integer.parseInt(data[4]));
                cd.setTraditional(data[5]);
                cd.setVariant(data[6]);
                cd.setDefinition(data[7]);
                cd.setExamples(data[8]);
                cd.setSource(data[9]);
                cd.setUnicode(data[10]);
                dictionaryRepository.save(cd);
            }
        }
    }
}
