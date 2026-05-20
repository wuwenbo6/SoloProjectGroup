import numpy as np
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass
from enum import Enum
from collections import deque


class WarningLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class AnomalyWarning:
    level: WarningLevel
    category: str
    message: str
    parameter: Optional[str] = None
    current_value: Optional[float] = None
    threshold: Optional[float] = None
    suggestion: Optional[str] = None
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            import time
            self.timestamp = time.time()

    def to_dict(self) -> Dict:
        return {
            'level': self.level.value,
            'category': self.category,
            'message': self.message,
            'parameter': self.parameter,
            'current_value': self.current_value,
            'threshold': self.threshold,
            'suggestion': self.suggestion,
            'timestamp': self.timestamp
        }


class AnomalyDetector:
    def __init__(self):
        self.warnings: List[AnomalyWarning] = []
        self.thresholds = self._get_default_thresholds()
        self.history = deque(maxlen=100)

    def _get_default_thresholds(self) -> Dict:
        return {
            'soot_ratio': {
                'min': 0.4,
                'max': 0.85,
                'warning_min': 0.45,
                'warning_max': 0.80
            },
            'binder_ratio': {
                'min': 0.10,
                'max': 0.50,
                'warning_min': 0.15,
                'warning_max': 0.45
            },
            'additive_ratio': {
                'min': 0.01,
                'max': 0.20,
                'warning_min': 0.03,
                'warning_max': 0.15
            },
            'firing_temperature': {
                'min': 400.0,
                'max': 1400.0,
                'warning_min': 500.0,
                'warning_max': 1200.0
            },
            'firing_time': {
                'min': 30.0,
                'max': 480.0,
                'warning_min': 60.0,
                'warning_max': 300.0
            },
            'grinding_time': {
                'min': 10.0,
                'max': 360.0,
                'warning_min': 30.0,
                'warning_max': 180.0
            },
            'carbon_content': {
                'min': 0.7,
                'max': 0.99,
                'warning_min': 0.8,
                'warning_max': 0.97
            },
            'particle_size': {
                'min': 0.01,
                'max': 0.5,
                'warning_min': 0.03,
                'warning_max': 0.3
            },
            'viscosity': {
                'min': 100.0,
                'max': 2000.0,
                'warning_min': 200.0,
                'warning_max': 1000.0
            }
        }

    def set_threshold(self, param_name: str, thresholds: Dict) -> None:
        self.thresholds[param_name] = thresholds

    def detect_formula_anomalies(self, formula) -> List[AnomalyWarning]:
        self.warnings = []
        
        self._check_material_ratios(formula)
        self._check_process_parameters(formula)
        self._check_material_compatibility(formula)
        
        return self.warnings

    def _check_material_ratios(self, formula) -> None:
        soot_ratio = formula.get_ratio_by_type('soot')
        binder_ratio = formula.get_ratio_by_type('binder')
        additive_ratio = formula.get_ratio_by_type('additive')
        
        self._check_threshold('soot_ratio', soot_ratio, '料比例')
        self._check_threshold('binder_ratio', binder_ratio, '胶料比例')
        self._check_threshold('additive_ratio', additive_ratio, '添加剂比例')
        
        total_ratio = soot_ratio + binder_ratio + additive_ratio
        if abs(total_ratio - 1.0) > 0.01:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.WARNING,
                category='ratio_check',
                message=f"原料比例总和异常: {total_ratio:.3f}，未归一化",
                parameter='total_ratio',
                current_value=total_ratio,
                threshold=1.0,
                suggestion='建议调用 normalize_ratios() 方法归一化比例'
            ))

    def _check_process_parameters(self, formula) -> None:
        temp = formula.process_params.get('firing_temperature', 800.0)
        time = formula.process_params.get('firing_time', 120.0)
        grind = formula.process_params.get('grinding_time', 60.0)
        
        self._check_threshold('firing_temperature', temp, '烧制温度(℃)')
        self._check_threshold('firing_time', time, '烧制时间(min)')
        self._check_threshold('grinding_time', grind, '研磨时间(min)')
        
        if temp > 1000 and time > 240:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.WARNING,
                category='process_synergy',
                message='高温长时间烧制可能导致过度碳化',
                suggestion='建议降低温度或缩短烧制时间'
            ))

    def _check_threshold(self, param_name: str, value: float, display_name: str) -> None:
        if param_name not in self.thresholds:
            return
        
        thresh = self.thresholds[param_name]
        
        if value < thresh['min']:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.ERROR,
                category='threshold_check',
                message=f'{display_name}低于最小值',
                parameter=param_name,
                current_value=value,
                threshold=thresh['min'],
                suggestion=f'建议增加{display_name}至{thresh["warning_min"]}以上'
            ))
        elif value < thresh['warning_min']:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.WARNING,
                category='threshold_check',
                message=f'{display_name}接近最小值',
                parameter=param_name,
                current_value=value,
                threshold=thresh['warning_min'],
                suggestion=f'建议适当增加{display_name}'
            ))
        
        if value > thresh['max']:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.ERROR,
                category='threshold_check',
                message=f'{display_name}超过最大值',
                parameter=param_name,
                current_value=value,
                threshold=thresh['max'],
                suggestion=f'建议降低{display_name}至{thresh["warning_max"]}以下'
            ))
        elif value > thresh['warning_max']:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.WARNING,
                category='threshold_check',
                message=f'{display_name}接近最大值',
                parameter=param_name,
                current_value=value,
                threshold=thresh['warning_max'],
                suggestion=f'建议适当降低{display_name}'
            ))

    def _check_material_compatibility(self, formula) -> None:
        material_names = list(formula.materials.keys())
        
        incompatible_pairs = [
            ('朱砂', '桃胶'),
            ('冰片', '朱砂')
        ]
        
        for mat1, mat2 in incompatible_pairs:
            if mat1 in material_names and mat2 in material_names:
                self.warnings.append(AnomalyWarning(
                    level=WarningLevel.WARNING,
                    category='compatibility',
                    message=f'{mat1}与{mat2}可能存在配伍禁忌',
                    suggestion='建议调整配方或咨询传统工艺专家'
                ))
        
        soot_count = len([name for name in material_names 
                         if formula._get_material_type(name) == 'soot'])
        if soot_count > 3:
            self.warnings.append(AnomalyWarning(
                level=WarningLevel.INFO,
                category='complexity',
                message=f'烟料种类较多({soot_count}种)，混合均匀难度增加',
                suggestion='建议延长混合时间或分步混合'
            ))

    def detect_simulation_anomalies(self, simulation_result) -> List[AnomalyWarning]:
        sim_warnings = []
        
        props = simulation_result.properties
        scores = simulation_result.quality_scores
        
        if 'carbonization_degree' in props:
            if props['carbonization_degree'] < 0.3:
                sim_warnings.append(AnomalyWarning(
                    level=WarningLevel.WARNING,
                    category='carbonization',
                    message='碳化程度过低，可能导致墨色偏淡',
                    parameter='carbonization_degree',
                    current_value=props['carbonization_degree'],
                    threshold=0.3,
                    suggestion='建议提高烧制温度或延长烧制时间'
                ))
            elif props['carbonization_degree'] > 0.95:
                sim_warnings.append(AnomalyWarning(
                    level=WarningLevel.WARNING,
                    category='carbonization',
                    message='碳化程度过高，可能导致墨质发脆',
                    parameter='carbonization_degree',
                    current_value=props['carbonization_degree'],
                    threshold=0.95,
                    suggestion='建议降低烧制温度或缩短烧制时间'
                ))
        
        overall = scores.get('overall_quality', 0)
        if overall < 30:
            sim_warnings.append(AnomalyWarning(
                level=WarningLevel.WARNING,
                category='quality',
                message=f'综合质量评分较低({overall:.1f})',
                parameter='overall_quality',
                current_value=overall,
                threshold=30.0,
                suggestion='建议优化配方比例或工艺参数'
            ))
        
        blackness = scores.get('blackness_score', 0)
        gloss = scores.get('gloss_score', 0)
        if blackness > 80 and gloss < 20:
            sim_warnings.append(AnomalyWarning(
                level=WarningLevel.INFO,
                category='balance',
                message='黑度较高但光泽度偏低，可能影响书写体验',
                suggestion='可考虑增加胶料比例或优化研磨工艺'
            ))
        
        return sim_warnings

    def detect_process_anomalies(self, process_data: Dict) -> List[AnomalyWarning]:
        process_warnings = []
        
        temp_profile = process_data.get('temperature_profile', np.array([]))
        carbonization = process_data.get('carbonization_curve', np.array([]))
        
        if len(temp_profile) > 0:
            temp_rate = np.diff(temp_profile)
            max_rate = np.max(np.abs(temp_rate)) if len(temp_rate) > 0 else 0
            if max_rate > 50:
                process_warnings.append(AnomalyWarning(
                    level=WarningLevel.WARNING,
                    category='heating_rate',
                    message=f'升温速率过快({max_rate:.1f}℃/min)',
                    parameter='heating_rate',
                    current_value=max_rate,
                    threshold=50.0,
                    suggestion='建议采用阶梯式升温，避免热冲击'
                ))
        
        if len(carbonization) > 0:
            carbonization_final = carbonization[-1]
            if carbonization_final < 0.4:
                process_warnings.append(AnomalyWarning(
                    level=WarningLevel.WARNING,
                    category='process_quality',
                    message='工艺结束时碳化度不足',
                    parameter='final_carbonization',
                    current_value=carbonization_final,
                    threshold=0.4,
                    suggestion='建议延长烧制保温时间'
                ))
        
        return process_warnings

    def get_warnings_by_level(self, level: WarningLevel) -> List[AnomalyWarning]:
        return [w for w in self.warnings if w.level == level]

    def get_warning_summary(self) -> Dict:
        summary = {
            'total': len(self.warnings),
            'by_level': {},
            'by_category': {}
        }
        
        for warning in self.warnings:
            level = warning.level.value
            summary['by_level'][level] = summary['by_level'].get(level, 0) + 1
            
            category = warning.category
            summary['by_category'][category] = summary['by_category'].get(category, 0) + 1
        
        return summary

    def print_warnings(self) -> None:
        summary = self.get_warning_summary()
        print(f"\n{'='*60}")
        print(f"异常预警汇总: 共{summary['total']}条")
        for level, count in summary['by_level'].items():
            print(f"  {level.upper()}: {count}条")
        print(f"{'='*60}")
        
        for warning in self.warnings:
            level_icon = {
                'info': 'ℹ️',
                'warning': '⚠️',
                'error': '❌',
                'critical': '🚨'
            }.get(warning.level.value, '•')
            
            print(f"\n{level_icon} [{warning.level.value.upper()}] {warning.category}")
            print(f"  {warning.message}")
            if warning.parameter:
                print(f"  参数: {warning.parameter} = {warning.current_value:.4f}" 
                      if warning.current_value else f"  参数: {warning.parameter}")
            if warning.suggestion:
                print(f"  建议: {warning.suggestion}")

    def export_warnings_to_dict(self) -> List[Dict]:
        return [w.to_dict() for w in self.warnings]
