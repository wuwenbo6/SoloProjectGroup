#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古今文字语义对齐模块
实现古籍文字与现代语义的映射与对齐
"""

import json
import os
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class SemanticPair:
    """语义对数据类"""
    ancient: str
    modern: str
    similarity: float
    context: str
    source: str


class AncientModernDictionary:
    """古今词典"""

    def __init__(self, dict_path: str = None):
        self.dict_path = dict_path or os.path.join(os.path.dirname(__file__), 'data')
        self.word_mappings = self._load_word_mappings()
        self.semantic_vectors = self._load_semantic_vectors()

    def _load_word_mappings(self) -> Dict:
        """加载词汇映射"""
        mapping_file = os.path.join(self.dict_path, 'word_mappings.json')
        if os.path.exists(mapping_file):
            with open(mapping_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._create_default_mappings()

    def _load_semantic_vectors(self) -> Dict:
        """加载语义向量"""
        vector_file = os.path.join(self.dict_path, 'semantic_vectors.json')
        if os.path.exists(vector_file):
            with open(vector_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _create_default_mappings(self) -> Dict:
        """创建默认词汇映射"""
        return {
            '学': {
                'modern': ['学习', '学问', '学识'],
                'meanings': [
                    {'meaning': '学习', 'examples': ['学而时习之'], 'category': 'verb'},
                    {'meaning': '学问', 'examples': ['笃学不倦'], 'category': 'noun'},
                    {'meaning': '学校', 'examples': ['入学'], 'category': 'noun'}
                ],
                'variant_forms': ['學'],
                'pinyin': 'xué'
            },
            '习': {
                'modern': ['温习', '练习', '习惯'],
                'meanings': [
                    {'meaning': '温习', 'examples': ['传不习乎'], 'category': 'verb'},
                    {'meaning': '练习', 'examples': ['习练'], 'category': 'verb'},
                    {'meaning': '习惯', 'examples': ['习性'], 'category': 'noun'}
                ],
                'variant_forms': ['習'],
                'pinyin': 'xí'
            },
            '之': {
                'modern': ['的', '去', '到', '这'],
                'meanings': [
                    {'meaning': '的（助词）', 'examples': ['仁者爱人'], 'category': 'particle'},
                    {'meaning': '去、到', 'examples': ['之楚'], 'category': 'verb'},
                    {'meaning': '这、此', 'examples': ['之子于归'], 'category': 'pronoun'}
                ],
                'variant_forms': [],
                'pinyin': 'zhī'
            },
            '说': {
                'modern': ['说', '讲', '喜悦'],
                'meanings': [
                    {'meaning': '说话', 'examples': ['说事'], 'category': 'verb'},
                    {'meaning': '解释', 'examples': ['解说'], 'category': 'verb'},
                    {'meaning': '喜悦（通悦）', 'examples': ['不亦说乎'], 'category': 'adj'}
                ],
                'variant_forms': ['悦'],
                'pinyin': 'shuō/yuè'
            },
            '乎': {
                'modern': ['吗', '呢', '于'],
                'meanings': [
                    {'meaning': '疑问语气', 'examples': ['不亦乐乎'], 'category': 'particle'},
                    {'meaning': '感叹语气', 'examples': ['大哉'], 'category': 'particle'},
                    {'meaning': '相当于于', 'examples': ['在乎'], 'category': 'prep'}
                ],
                'variant_forms': [],
                'pinyin': 'hū'
            }
        }

    def get_modern_equivalents(self, ancient_word: str) -> List[str]:
        """获取现代对应词"""
        if ancient_word in self.word_mappings:
            return self.word_mappings[ancient_word]['modern']
        return []

    def get_meanings(self, ancient_word: str) -> List[Dict]:
        """获取词义解释"""
        if ancient_word in self.word_mappings:
            return self.word_mappings[ancient_word]['meanings']
        return []

    def get_variant_forms(self, ancient_word: str) -> List[str]:
        """获取异体字"""
        if ancient_word in self.word_mappings:
            return self.word_mappings[ancient_word]['variant_forms']
        return []

    def search_by_modern(self, modern_word: str) -> List[Dict]:
        """根据现代词查找古汉语对应"""
        results = []
        for ancient, data in self.word_mappings.items():
            if modern_word in data['modern']:
                results.append({
                    'ancient': ancient,
                    'pinyin': data['pinyin'],
                    'meanings': data['meanings']
                })
        return results


class SemanticAligner:
    """语义对齐器"""

    def __init__(self, dictionary: AncientModernDictionary = None):
        self.dictionary = dictionary or AncientModernDictionary()
        self.context_patterns = self._load_context_patterns()

    def _load_context_patterns(self) -> Dict:
        """加载上下文模式"""
        return {
            '学而X之': ['时习', '不厌', '时思'],
            '不亦X乎': ['乐', '说', '远'],
            '有朋自X来': ['远方', '四方']
        }

    def align_sentence(self, ancient_sentence: str) -> Dict:
        """
        对齐整句古文
        :param ancient_sentence: 古文句子
        :return: 对齐结果
        """
        alignments = []
        modern_words = []

        for char in ancient_sentence:
            equivalents = self.dictionary.get_modern_equivalents(char)
            if equivalents:
                alignments.append({
                    'ancient': char,
                    'modern': equivalents[0],
                    'alternatives': equivalents[1:],
                    'meanings': self.dictionary.get_meanings(char),
                    'confidence': self._calculate_confidence(char, equivalents[0])
                })
                modern_words.append(equivalents[0])
            else:
                alignments.append({
                    'ancient': char,
                    'modern': char,
                    'alternatives': [],
                    'meanings': [],
                    'confidence': 0.5
                })
                modern_words.append(char)

        return {
            'ancient': ancient_sentence,
            'modern_translation': ''.join(modern_words),
            'word_alignments': alignments,
            'overall_confidence': sum(a['confidence'] for a in alignments) / len(alignments),
            'variant_notes': self._collect_variant_notes(ancient_sentence)
        }

    def _calculate_confidence(self, ancient: str, modern: str) -> float:
        """计算对齐置信度"""
        # 简化置信度计算
        if len(ancient) == len(modern):
            return 0.9
        if len(modern) > len(ancient):
            return 0.8
        return 0.7

    def _collect_variant_notes(self, sentence: str) -> List[str]:
        """收集异体字注释"""
        notes = []
        for char in sentence:
            variants = self.dictionary.get_variant_forms(char)
            if variants:
                notes.append(f'"{char}"的异体字：{", ".join(variants)}')
        return notes

    def align_by_context(self, ancient_text: str, context: str = None) -> SemanticPair:
        """
        基于上下文的语义对齐
        :param ancient_text: 古文文本
        :param context: 上下文
        :return: 语义对
        """
        alignment = self.align_sentence(ancient_text)

        return SemanticPair(
            ancient=ancient_text,
            modern=alignment['modern_translation'],
            similarity=alignment['overall_confidence'],
            context=context or '',
            source='contextual_alignment'
        )

    def find_best_alignment(self, ancient_text: str, candidates: List[str]) -> Tuple[str, float]:
        """
        查找最佳语义对齐
        :param ancient_text: 古文文本
        :param candidates: 候选现代文列表
        :return: (最佳匹配, 相似度)
        """
        best_match = None
        best_score = 0.0

        for candidate in candidates:
            score = self._calculate_semantic_similarity(ancient_text, candidate)
            if score > best_score:
                best_score = score
                best_match = candidate

        return best_match, best_score

    def _calculate_semantic_similarity(self, ancient: str, modern: str) -> float:
        """计算语义相似度"""
        # 简化实现：基于字符重叠和词典匹配
        ancient_chars = set(ancient)
        modern_chars = set(modern)

        # 查找词典匹配
        dict_matches = 0
        for char in ancient_chars:
            equivalents = self.dictionary.get_modern_equivalents(char)
            for eq in equivalents:
                if any(c in modern for c in eq):
                    dict_matches += 1
                    break

        base_similarity = len(ancient_chars & modern_chars) / max(len(ancient_chars), len(modern_chars))
        dict_bonus = dict_matches / len(ancient_chars) * 0.3

        return min(base_similarity + dict_bonus, 1.0)


class SemanticSearchEngine:
    """语义搜索引擎"""

    def __init__(self, aligner: SemanticAligner):
        self.aligner = aligner
        self.knowledge_base = self._build_knowledge_base()

    def _build_knowledge_base(self) -> Dict:
        """构建知识库"""
        return {
            '论语': [
                {'text': '学而时习之，不亦说乎', 'translation': '学习并且按时温习，不是很快乐吗'},
                {'text': '有朋自远方来，不亦乐乎', 'translation': '有志同道合的人从远方来，不是很令人高兴吗'},
                {'text': '人不知而不愠，不亦君子乎', 'translation': '别人不了解自己也不生气，不也是品德高尚的君子吗'}
            ],
            '孟子': [
                {'text': '孟子见梁惠王', 'translation': '孟子拜见梁惠王'},
                {'text': '王何必曰利，亦有仁义而已矣', 'translation': '大王何必说利呢，只要讲仁义就行了'}
            ]
        }

    def search_similar_sentences(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        搜索相似句子
        :param query: 查询文本
        :param top_k: 返回数量
        :return: 相似句子列表
        """
        results = []

        for source, sentences in self.knowledge_base.items():
            for item in sentences:
                similarity = self.aligner._calculate_semantic_similarity(query, item['text'])
                if similarity > 0.2:
                    results.append({
                        'ancient_text': item['text'],
                        'modern_translation': item['translation'],
                        'source': source,
                        'similarity': similarity
                    })

        results.sort(key=lambda x: x['similarity'], reverse=True)
        return results[:top_k]

    def search_by_keyword(self, keyword: str) -> List[Dict]:
        """
        按关键词搜索
        :param keyword: 关键词
        :return: 搜索结果
        """
        results = []

        # 查找包含关键词的句子
        for source, sentences in self.knowledge_base.items():
            for item in sentences:
                if keyword in item['text'] or keyword in item['translation']:
                    results.append({
                        'ancient_text': item['text'],
                        'modern_translation': item['translation'],
                        'source': source,
                        'match_type': 'exact'
                    })

        # 如果没有精确匹配，尝试语义匹配
        if not results:
            return self.search_similar_sentences(keyword)

        return results
