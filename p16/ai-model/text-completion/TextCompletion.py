#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古籍文字补全模块
基于上下文预测残缺文字，实现古籍智能修复
"""

import json
import os
from typing import Dict, List, Tuple


class AncientTextCompleter:
    """古文文字补全器"""

    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), 'data')
        self.char_database = self._load_char_database()
        self.context_model = self._load_context_model()

    def _load_char_database(self) -> Dict:
        """加载古籍文字数据库"""
        db_path = os.path.join(self.model_path, 'char_database.json')
        if os.path.exists(db_path):
            with open(db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._create_default_database()

    def _load_context_model(self) -> Dict:
        """加载上下文预测模型"""
        model_file = os.path.join(self.model_path, 'context_model.json')
        if os.path.exists(model_file):
            with open(model_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._create_default_context_model()

    def _create_default_database(self) -> Dict:
        """创建默认文字数据库"""
        return {
            'chars': {
                '学': {'variants': ['學'], 'frequency': 0.0085, 'radical': '子'},
                '习': {'variants': ['習'], 'frequency': 0.0062, 'radical': '乙'},
                '之': {'variants': [], 'frequency': 0.0125, 'radical': '丶'},
                '说': {'variants': ['悦'], 'frequency': 0.0048, 'radical': '讠'},
                '乎': {'variants': [], 'frequency': 0.0035, 'radical': '丿'},
                '朋': {'variants': [], 'frequency': 0.0028, 'radical': '月'},
                '乐': {'variants': ['樂'], 'frequency': 0.0042, 'radical': '丿'},
                '君': {'variants': [], 'frequency': 0.0038, 'radical': '口'},
                '子': {'variants': [], 'frequency': 0.0095, 'radical': '子'},
                '曰': {'variants': [], 'frequency': 0.0052, 'radical': '曰'}
            },
            'stroke_info': {
                '学': {'total': 8, 'strokes': ['点', '点', '撇', '点', '横撇', '竖钩', '横']},
                '习': {'total': 3, 'strokes': ['横折钩', '点', '提']},
                '之': {'total': 3, 'strokes': ['点', '横撇', '捺']}
            }
        }

    def _create_default_context_model(self) -> Dict:
        """创建默认上下文模型"""
        return {
            'n_grams': {
                '学而': {'next': ['时', '之', '不'], 'weights': [0.6, 0.25, 0.15]},
                '时习': {'next': ['之'], 'weights': [1.0]},
                '习之': {'next': ['不'], 'weights': [1.0]},
                '之不': {'next': ['亦'], 'weights': [1.0]},
                '不亦': {'next': ['乐', '然'], 'weights': [0.85, 0.15]},
                '亦乐': {'next': ['乎'], 'weights': [1.0]},
                '有朋': {'next': ['自'], 'weights': [1.0]},
                '朋自': {'next': ['远'], 'weights': [1.0]},
                '远方': {'next': ['来'], 'weights': [1.0]}
            },
            'classical_patterns': [
                'A而B之',
                '不亦A乎',
                'A者B也',
                'A之B'
            ]
        }

    def complete_missing_char(self, left_context: str, right_context: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """
        根据上下文补全缺失文字
        :param left_context: 左侧上下文
        :param right_context: 右侧上下文
        :param top_k: 返回候选数量
        :return: 候选文字列表及置信度
        """
        candidates = []

        # 基于N-gram预测
        if len(left_context) >= 2:
            last_two = left_context[-2:]
            if last_two in self.context_model['n_grams']:
                next_chars = self.context_model['n_grams'][last_two]['next']
                weights = self.context_model['n_grams'][last_two]['weights']
                for char, weight in zip(next_chars, weights):
                    candidates.append((char, weight * 0.7))

        # 基于字符频率补充
        for char, info in self.char_database['chars'].items():
            if char not in [c[0] for c in candidates]:
                candidates.append((char, info['frequency'] * 0.3))

        # 排序并返回前K个
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[:top_k]

    def complete_multiple_chars(self, left_context: str, right_context: str, num_chars: int = 1) -> str:
        """
        补全多个缺失文字
        :param left_context: 左侧上下文
        :param right_context: 右侧上下文
        :param num_chars: 缺失文字数量
        :return: 补全后的文字
        """
        result = []
        current_left = left_context

        for _ in range(num_chars):
            candidates = self.complete_missing_char(current_left, right_context, top_k=1)
            if candidates:
                result.append(candidates[0][0])
                current_left += candidates[0][0]

        return ''.join(result)

    def get_char_strokes(self, char: str) -> Dict:
        """获取字符笔画信息"""
        if char in self.char_database['stroke_info']:
            return self.char_database['stroke_info'][char]
        return {'total': 0, 'strokes': []}

    def suggest_char_alternatives(self, char: str) -> List[str]:
        """获取异体字建议"""
        if char in self.char_database['chars']:
            return self.char_database['chars'][char]['variants']
        return []


class StrokeInpainter:
    """笔画修复器"""

    def __init__(self):
        self.stroke_database = self._load_stroke_database()

    def _load_stroke_database(self) -> Dict:
        """加载笔画数据库"""
        return {
            'stroke_types': [
                '横', '竖', '撇', '捺', '点',
                '横折', '横撇', '竖钩', '弯钩', '竖折'
            ],
            'char_templates': {
                '学': {
                    'regions': {
                        'top': ['点', '点', '撇'],
                        'middle': ['点', '横撇'],
                        'bottom': ['竖钩', '横']
                    }
                },
                '习': {
                    'regions': {
                        'outer': ['横折钩'],
                        'inner': ['点', '提']
                    }
                }
            }
        }

    def repair_strokes(self, char_image_data: Dict, missing_regions: List[str]) -> Dict:
        """
        修复字符笔画
        :param char_image_data: 字符图像数据
        :param missing_regions: 缺失区域列表
        :return: 修复结果
        """
        char = char_image_data.get('char', '')
        repairs = []

        if char in self.stroke_database['char_templates']:
            template = self.stroke_database['char_templates'][char]
            for region in missing_regions:
                if region in template['regions']:
                    for stroke in template['regions'][region]:
                        repairs.append({
                            'stroke': stroke,
                            'region': region,
                            'confidence': self._calculate_stroke_confidence(stroke, char)
                        })

        return {
            'char': char,
            'repairs': repairs,
            'total_repaired': len(repairs),
            'repair_confidence': sum(r['confidence'] for r in repairs) / len(repairs) if repairs else 0
        }

    def _calculate_stroke_confidence(self, stroke: str, char: str) -> float:
        """计算笔画修复置信度"""
        base_confidence = 0.75
        if stroke in self.stroke_database['stroke_types']:
            base_confidence += 0.1
        return min(base_confidence, 0.95)

    def suggest_stroke_improvements(self, char: str, current_strokes: List[str]) -> List[Dict]:
        """建议笔画改进方案"""
        suggestions = []
        if char in self.stroke_database['char_templates']:
            template = self.stroke_database['char_templates'][char]
            all_strokes = []
            for region_strokes in template['regions'].values():
                all_strokes.extend(region_strokes)

            missing = [s for s in all_strokes if s not in current_strokes]
            for stroke in missing:
                suggestions.append({
                    'stroke': stroke,
                    'action': 'add',
                    'suggestion': f'建议添加"{stroke}"笔画'
                })

        return suggestions
