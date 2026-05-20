#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
古籍笔画修复模块
处理破损古籍的笔画重建、残缺修复
"""

import json
import os
from typing import Dict, List, Tuple
import numpy as np


class StrokeRestorationModel:
    """笔画修复模型"""

    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), 'models')
        self.stroke_templates = self._load_stroke_templates()
        self.char_components = self._load_char_components()

    def _load_stroke_templates(self) -> Dict:
        """加载笔画模板"""
        template_file = os.path.join(self.model_path, 'stroke_templates.json')
        if os.path.exists(template_file):
            with open(template_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._create_default_templates()

    def _load_char_components(self) -> Dict:
        """加载字符组件库"""
        components_file = os.path.join(self.model_path, 'char_components.json')
        if os.path.exists(components_file):
            with open(components_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._create_default_components()

    def _create_default_templates(self) -> Dict:
        """创建默认笔画模板"""
        return {
            'basic_strokes': {
                'heng': {'name': '横', 'code': 'H', 'points': [(0, 0.5), (1, 0.5)]},
                'shu': {'name': '竖', 'code': 'S', 'points': [(0.5, 0), (0.5, 1)]},
                'pie': {'name': '撇', 'code': 'P', 'points': [(0.5, 0), (0, 1)]},
                'na': {'name': '捺', 'code': 'N', 'points': [(0.5, 0), (1, 1)]},
                'dian': {'name': '点', 'code': 'D', 'points': [(0.5, 0.3), (0.6, 0.5)]},
                'ti': {'name': '提', 'code': 'T', 'points': [(0, 0.8), (0.5, 0.5)]}
            },
            'compound_strokes': {
                'hengzhe': {'name': '横折', 'strokes': ['heng', 'shu']},
                'hengpie': {'name': '横撇', 'strokes': ['heng', 'pie']},
                'shugou': {'name': '竖钩', 'strokes': ['shu', 'gou']}
            }
        }

    def _create_default_components(self) -> Dict:
        """创建默认字符组件库"""
        return {
            'radicals': {
                '氵': {'strokes': ['dian', 'dian', 'ti'], 'position': 'left'},
                '亻': {'strokes': ['pie', 'shu'], 'position': 'left'},
                '讠': {'strokes': ['dian', 'hengzhe'], 'position': 'left'},
                '忄': {'strokes': ['dian', 'dian', 'shu'], 'position': 'left'},
                '艹': {'strokes': ['heng', 'shu', 'shu'], 'position': 'top'},
                '宀': {'strokes': ['dian', 'dian', 'hengzhe'], 'position': 'top'}
            },
            'common_components': {
                '子': {'strokes': ['hengpie', 'shugou', 'heng']},
                '女': {'strokes': ['piezhe', 'pie', 'heng']},
                '木': {'strokes': ['heng', 'shu', 'pie', 'na']},
                '日': {'strokes': ['shu', 'hengzhe', 'heng', 'heng']},
                '月': {'strokes': ['pie', 'hengzhegou', 'heng', 'heng']}
            }
        }

    def restore_damaged_stroke(self, stroke_data: Dict, damage_level: float) -> Dict:
        """
        修复破损笔画
        :param stroke_data: 笔画数据
        :param damage_level: 破损程度 0-1
        :return: 修复结果
        """
        stroke_type = stroke_data.get('type', '')
        existing_points = stroke_data.get('points', [])

        if stroke_type in self.stroke_templates['basic_strokes']:
            template = self.stroke_templates['basic_strokes'][stroke_type]
            restored_points = self._interpolate_stroke_points(
                existing_points,
                template['points'],
                damage_level
            )

            return {
                'stroke_type': stroke_type,
                'original_points': existing_points,
                'restored_points': restored_points,
                'confidence': 1.0 - damage_level * 0.3,
                'is_complete': damage_level < 0.3
            }

        return {
            'stroke_type': stroke_type,
            'status': 'unknown_stroke_type',
            'confidence': 0.5
        }

    def _interpolate_stroke_points(self, existing: List[Tuple], template: List[Tuple], damage_level: float) -> List[Tuple]:
        """插值补全笔画点"""
        if not existing:
            return template

        if len(existing) >= len(template):
            return existing

        # 简单插值补全
        result = existing.copy()
        needed = len(template) - len(existing)
        for i in range(needed):
            alpha = (i + 1) / (needed + 1)
            interp_x = template[0][0] * (1 - alpha) + template[-1][0] * alpha
            interp_y = template[0][1] * (1 - alpha) + template[-1][1] * alpha
            result.insert(len(result) - 1, (interp_x, interp_y))

        return result

    def reconstruct_char_from_radicals(self, partial_char: Dict) -> Dict:
        """
        根据偏旁重构字符
        :param partial_char: 部分字符信息
        :return: 重构结果
        """
        identified_radicals = partial_char.get('radicals', [])
        candidates = []

        for radical in identified_radicals:
            if radical in self.char_components['radicals']:
                # 根据偏旁查找可能的字符
                possible_chars = self._find_chars_by_radical(radical)
                candidates.extend(possible_chars)

        return {
            'input_radicals': identified_radicals,
            'char_candidates': candidates[:5],
            'reconstruction_confidence': min(0.9, len(identified_radicals) * 0.3)
        }

    def _find_chars_by_radical(self, radical: str) -> List[Dict]:
        """根据偏旁查找可能的字符"""
        # 简化实现，实际应基于大型字符库
        radical_map = {
            '氵': [
                {'char': '河', 'confidence': 0.85},
                {'char': '海', 'confidence': 0.82},
                {'char': '江', 'confidence': 0.80}
            ],
            '亻': [
                {'char': '仁', 'confidence': 0.88},
                {'char': '信', 'confidence': 0.83},
                {'char': '休', 'confidence': 0.81}
            ],
            '讠': [
                {'char': '说', 'confidence': 0.85},
                {'char': '话', 'confidence': 0.82},
                {'char': '语', 'confidence': 0.80}
            ]
        }
        return radical_map.get(radical, [])


class CharShapeAnalyzer:
    """字形分析器"""

    def __init__(self):
        self.structure_rules = self._load_structure_rules()

    def _load_structure_rules(self) -> Dict:
        """加载字形结构规则"""
        return {
            'left_right': ['明', '确', '休', '说', '语'],
            'top_bottom': ['学', '字', '思', '想'],
            'surround': ['国', '围', '困', '因'],
            'half_surround': ['建', '过', '近', '远']
        }

    def analyze_char_structure(self, char_image: np.ndarray) -> Dict:
        """
        分析字符结构
        :param char_image: 字符图像矩阵
        :return: 结构分析结果
        """
        # 简化实现
        height, width = char_image.shape[:2]

        # 计算左右比例
        left_density = np.mean(char_image[:, :width // 2])
        right_density = np.mean(char_image[:, width // 2:])
        ratio = left_density / (right_density + 1e-6)

        structure_type = 'unknown'
        if 0.7 < ratio < 1.4:
            structure_type = 'left_right'
        elif ratio > 1.5:
            structure_type = 'left_component_right'

        return {
            'structure_type': structure_type,
            'left_right_ratio': ratio,
            'top_bottom_ratio': np.mean(char_image[:height // 2, :]) / np.mean(char_image[height // 2:, :] + 1e-6),
            'center_of_mass': self._calculate_centroid(char_image)
        }

    def _calculate_centroid(self, image: np.ndarray) -> Tuple[float, float]:
        """计算图像质心"""
        y_coords, x_coords = np.where(image > 0)
        if len(x_coords) == 0:
            return (0.5, 0.5)
        return (np.mean(x_coords) / image.shape[1], np.mean(y_coords) / image.shape[0])

    def detect_missing_parts(self, char_image: np.ndarray, template_char: str) -> List[Dict]:
        """检测缺失部分"""
        missing_parts = []
        height, width = char_image.shape

        # 检查四个象限
        quadrants = [
            ('top_left', (0, 0, width // 2, height // 2)),
            ('top_right', (width // 2, 0, width, height // 2)),
            ('bottom_left', (0, height // 2, width // 2, height)),
            ('bottom_right', (width // 2, height // 2, width, height))
        ]

        for name, (x1, y1, x2, y2) in quadrants:
            region = char_image[y1:y2, x1:x2]
            density = np.mean(region)
            if density < 0.1:  # 空白区域
                missing_parts.append({
                    'region': name,
                    'missing_probability': 0.8,
                    'suggestion': f'{name}区域可能有笔画缺失'
                })

        return missing_parts
