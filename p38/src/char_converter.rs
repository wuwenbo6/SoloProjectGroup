use crate::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharMapping {
    pub variant: char,
    pub standard: char,
    pub simplified: Option<char>,
    pub description: Option<String>,
}

pub struct CharConverter {
    variant_to_standard: HashMap<char, char>,
    standard_to_variants: HashMap<char, Vec<char>>,
    standard_to_simplified: HashMap<char, char>,
    simplified_to_standard: HashMap<char, char>,
}

impl Default for CharConverter {
    fn default() -> Self {
        Self::new()
    }
}

impl CharConverter {
    pub fn new() -> Self {
        let mut converter = Self {
            variant_to_standard: HashMap::new(),
            standard_to_variants: HashMap::new(),
            standard_to_simplified: HashMap::new(),
            simplified_to_standard: HashMap::new(),
        };
        converter.load_default_mappings();
        converter
    }

    fn load_default_mappings(&mut self) {
        let variant_mappings = vec![
            ('𠀀', '一'), ('𠀁', '丁'), ('𠀂', '七'), ('𠀃', '万'), ('𠀄', '丈'),
            ('𠃊', '乙'), ('𠃋', '九'), ('𠃌', '了'), ('𠃍', '予'), ('𠃎', '争'),
            ('𠆢', '人'), ('𠆣', '仁'), ('𠆤', '什'), ('𠆥', '仆'), ('𠆦', '仇'),
            ('𠔥', '土'), ('𠔦', '地'), ('𠔧', '在'), ('𠔨', '圭'), ('𠔩', '坐'),
            ('𡈽', '土'), ('𡈾', '士'), ('𡈿', '壮'), ('𡉀', '声'), ('𡉁', '壳'),
            ('𢁉', '心'), ('𢁊', '必'), ('𢁋', '志'), ('𢁌', '忘'), ('𢁍', '忙'),
            ('𣎆', '手'), ('𣎇', '才'), ('𣎈', '打'), ('𣎉', '扑'), ('𣎊', '扒'),
            ('𤔡', '火'), ('𤔢', '灭'), ('𤔣', '灰'), ('𤔤', '灯'), ('𤔥', '灶'),
            ('𥜃', '示'), ('𥜄', '礼'), ('𥜅', '社'), ('𥜆', '祀'), ('𥜇', '祁'),
            ('𦉡', '衣'), ('𦉢', '表'), ('𦉢', '衰'), ('𦉣', '衷'), ('𦉤', '袁'),
            ('𡘙', '太'), ('𡚾', '美'), ('𢀖', '經'), ('𤅷', '無'), ('𥝄', '禮'),
            ('者', '者'), ('也', '也'), ('之', '之'), ('乎', '乎'), ('哉', '哉'),
            ('矣', '矣'), ('焉', '焉'), ('耳', '耳'), ('爾', '尔'), ('耶', '耶'),
        ];

        for (variant, standard) in variant_mappings {
            self.variant_to_standard.insert(variant, standard);
            self.standard_to_variants
                .entry(standard)
                .or_insert_with(Vec::new)
                .push(variant);
        }

        let simplified_mappings = vec![
            ('萬', '万'), ('禮', '礼'), ('聲', '声'), ('殼', '壳'), ('壯', '壮'),
            ('無', '无'), ('從', '从'), ('眾', '众'), ('爾', '尔'), ('麼', '么'),
            ('麼', '么'), ('後', '后'), ('裡', '里'), ('幾', '几'), ('機', '机'),
            ('體', '体'), ('會', '会'), ('能', '能'), ('欲', '欲'), ('觀', '观'),
            ('見', '见'), ('聞', '闻'), ('問', '问'), ('門', '门'), ('間', '间'),
            ('東', '东'), ('西', '西'), ('南', '南'), ('北', '北'), ('中', '中'),
            ('國', '国'), ('文', '文'), ('章', '章'), ('詩', '诗'), ('書', '书'),
        ];

        for (standard, simplified) in simplified_mappings {
            self.standard_to_simplified.insert(standard, simplified);
            self.simplified_to_standard.insert(simplified, standard);
        }
    }

    pub fn variant_to_standard(&self, c: char) -> char {
        self.variant_to_standard.get(&c).copied().unwrap_or(c)
    }

    pub fn standard_to_simplified(&self, c: char) -> char {
        self.standard_to_simplified.get(&c).copied().unwrap_or(c)
    }

    pub fn simplified_to_standard(&self, c: char) -> char {
        self.simplified_to_standard.get(&c).copied().unwrap_or(c)
    }

    pub fn convert_to_standard(&self, text: &str) -> String {
        text.chars().map(|c| self.variant_to_standard(c)).collect()
    }

    pub fn convert_to_simplified(&self, text: &str) -> String {
        text.chars()
            .map(|c| {
                let standard = self.variant_to_standard(c);
                self.standard_to_simplified(standard)
            })
            .collect()
    }

    pub fn get_variants(&self, standard: char) -> Vec<char> {
        self.standard_to_variants.get(&standard).cloned().unwrap_or_default()
    }

    pub fn is_variant(&self, c: char) -> bool {
        self.variant_to_standard.contains_key(&c)
    }

    pub fn has_simplified(&self, standard: char) -> bool {
        self.standard_to_simplified.contains_key(&standard)
    }

    pub fn add_mapping(&mut self, variant: char, standard: char, simplified: Option<char>) {
        self.variant_to_standard.insert(variant, standard);
        self.standard_to_variants
            .entry(standard)
            .or_insert_with(Vec::new)
            .push(variant);
        if let Some(simp) = simplified {
            self.standard_to_simplified.insert(standard, simp);
            self.simplified_to_standard.insert(simp, standard);
        }
    }

    pub fn get_all_mappings(&self) -> Vec<(char, char, Option<char>)> {
        let mut result = Vec::new();
        for (&variant, &standard) in &self.variant_to_standard {
            let simplified = self.standard_to_simplified.get(&standard).copied();
            result.push((variant, standard, simplified));
        }
        result.sort_by_key(|&(_, s, _)| s);
        result
    }
}

pub struct SentencePunctuator {
    puncutation_marks: Vec<char>,
    phrase_ending_chars: Vec<char>,
    converter: CharConverter,
}

impl Default for SentencePunctuator {
    fn default() -> Self {
        Self::new()
    }
}

impl SentencePunctuator {
    pub fn new() -> Self {
        Self {
            puncutation_marks: vec!['。', '，', '；', '：', '？', '！', '、'],
            phrase_ending_chars: vec![
                '者', '也', '之', '乎', '哉', '矣', '焉', '耳', '爾', '耶',
                '兮', '歟', '夫', '邪', '其', '已', '止', '休', '息', '云',
                '曰', '云', '言', '道', '語', '說', '謂', '言', '云', '爾',
            ],
            converter: CharConverter::new(),
        }
    }

    pub fn punctuate(&self, text: &str) -> String {
        let standard_text = self.converter.convert_to_standard(text);
        let mut result = String::new();
        let chars: Vec<char> = standard_text.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let c = chars[i];
            result.push(c);

            if self.puncutation_marks.contains(&c) {
                i += 1;
                continue;
            }

            if i + 1 < chars.len() {
                let next_c = chars[i + 1];

                if self.is_sentence_end(c, next_c, i, chars.len()) {
                    result.push('。');
                } else if self.is_clause_end(c, next_c, i, chars.len()) {
                    result.push('，');
                }
            } else if i == chars.len() - 1 && !self.puncutation_marks.contains(&c) {
                result.push('。');
            }

            i += 1;
        }

        self.cleanup_punctuation(&result)
    }

    fn is_sentence_end(&self, current: char, next: char, pos: usize, total: usize) -> bool {
        if self.phrase_ending_chars.contains(&current) {
            if let Some(next_char_type) = self.get_char_type(next) {
                if matches!(next_char_type, CharType::Verb | CharType::Noun | CharType::Pronoun) {
                    return true;
                }
            }
        }

        if (pos + 1) % 15 == 0 && total > 20 {
            return true;
        }

        false
    }

    fn is_clause_end(&self, current: char, next: char, _pos: usize, _total: usize) -> bool {
        if current == '，' || current == '。' {
            return false;
        }

        if let (Some(cur_type), Some(next_type)) = (self.get_char_type(current), self.get_char_type(next)) {
            match (cur_type, next_type) {
                (CharType::Conjunction, _) => return true,
                (CharType::Preposition, _) => return true,
                _ => {}
            }
        }

        false
    }

    fn get_char_type(&self, c: char) -> Option<CharType> {
        let verbs = vec![
            '曰', '云', '言', '道', '語', '說', '謂', '行', '走', '去',
            '來', '至', '到', '往', '返', '歸', '視', '見', '觀', '察',
        ];

        let nouns = vec![
            '天', '地', '人', '日', '月', '水', '火', '木', '金', '土',
            '王', '侯', '將', '相', '君', '臣', '父', '子', '夫', '婦',
        ];

        let pronouns = vec![
            '吾', '我', '余', '予', '汝', '爾', '爾', '彼', '此', '其',
            '之', '是', '斯', '茲', '夫', '惟',
        ];

        let conjunctions = vec![
            '而', '則', '乃', '故', '然', '雖', '然', '且', '況', '抑',
        ];

        let prepositions = vec![
            '於', '于', '以', '爲', '與', '及', '自', '從', '由', '爲',
        ];

        if verbs.contains(&c) {
            Some(CharType::Verb)
        } else if nouns.contains(&c) {
            Some(CharType::Noun)
        } else if pronouns.contains(&c) {
            Some(CharType::Pronoun)
        } else if conjunctions.contains(&c) {
            Some(CharType::Conjunction)
        } else if prepositions.contains(&c) {
            Some(CharType::Preposition)
        } else {
            None
        }
    }

    fn cleanup_punctuation(&self, text: &str) -> String {
        let mut result = String::new();
        let chars: Vec<char> = text.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let c = chars[i];
            if self.puncutation_marks.contains(&c) && i + 1 < chars.len() {
                let next_c = chars[i + 1];
                if self.puncutation_marks.contains(&next_c) {
                    if c == '，' && (next_c == '。' || next_c == '？' || next_c == '！') {
                        i += 1;
                        continue;
                    }
                }
            }
            result.push(c);
            i += 1;
        }

        result
    }

    pub fn remove_punctuation(&self, text: &str) -> String {
        text.chars()
            .filter(|c| !self.puncutation_marks.contains(c))
            .collect()
    }

    pub fn normalize_punctuation(&self, text: &str) -> String {
        text.chars()
            .map(|c| match c {
                '.' => '。',
                ',' => '，',
                ';' => '；',
                ':' => '：',
                '?' => '？',
                '!' => '！',
                _ => c,
            })
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CharType {
    Verb,
    Noun,
    Pronoun,
    Conjunction,
    Preposition,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_variant_conversion() {
        let converter = CharConverter::new();
        assert_eq!(converter.variant_to_standard('𠀀'), '一');
        assert_eq!(converter.variant_to_standard('人'), '人');
    }

    #[test]
    fn test_punctuation() {
        let punctuator = SentencePunctuator::new();
        let text = "子曰學而時習之不亦說乎有朋自遠方來不亦樂乎人不知而不慍不亦君子乎";
        let result = punctuator.punctuate(text);
        assert!(!result.is_empty());
        assert!(result.contains('。') || result.contains('，'));
    }
}
