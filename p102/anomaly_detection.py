import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class WarningLevel(Enum):
    INFO = 0
    WARNING = 1
    CRITICAL = 2
    FATAL = 3


@dataclass
class AnomalyWarning:
    warning_id: str
    timestamp: str
    level: WarningLevel
    category: str
    message: str
    location: Optional[Tuple[float, float, float]] = None
    current_value: Optional[float] = None
    threshold_value: Optional[float] = None
    recommendation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class AnomalyDetector:
    def __init__(self):
        self.thresholds: Dict[str, float] = {
            'safety_factor_min': 1.5,
            'safety_factor_critical': 1.0,
            'stress_max_ratio': 0.8,
            'deformation_max_ratio': 0.01,
            'contact_pressure_max_ratio': 0.7,
            'interaction_factor_max': 0.5,
            'load_imbalance_ratio': 0.3,
            'rate_of_change_stress': 1e6,
            'rate_of_change_deformation': 1e-3
        }
        
        self.warnings: List[AnomalyWarning] = []
        self.history: List[Dict[str, Any]] = []
        self.warning_callbacks: List[Callable[[AnomalyWarning], None]] = []
    
    def set_threshold(self, threshold_name: str, value: float) -> None:
        if threshold_name in self.thresholds:
            self.thresholds[threshold_name] = value
        else:
            raise ValueError(f"Unknown threshold: {threshold_name}. Available: {list(self.thresholds.keys())}")
    
    def add_warning_callback(self, callback: Callable[[AnomalyWarning], None]) -> None:
        self.warning_callbacks.append(callback)
    
    def _create_warning(self,
                         level: WarningLevel,
                         category: str,
                         message: str,
                         location: Optional[Tuple[float, float, float]] = None,
                         current_value: Optional[float] = None,
                         threshold_value: Optional[float] = None,
                         recommendation: Optional[str] = None,
                         **kwargs) -> AnomalyWarning:
        warning = AnomalyWarning(
            warning_id=f"WARN_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}",
            timestamp=datetime.now().isoformat(),
            level=level,
            category=category,
            message=message,
            location=location,
            current_value=current_value,
            threshold_value=threshold_value,
            recommendation=recommendation,
            metadata=kwargs
        )
        self.warnings.append(warning)
        
        for callback in self.warning_callbacks:
            try:
                callback(warning)
            except Exception as e:
                print(f"Warning callback error: {e}")
        
        return warning
    
    def check_safety_factor(self,
                             safety_factor: float,
                             location: Optional[Tuple[float, float, float]] = None,
                             component_id: Optional[str] = None) -> List[AnomalyWarning]:
        warnings = []
        sf_critical = self.thresholds['safety_factor_critical']
        sf_min = self.thresholds['safety_factor_min']
        
        if safety_factor < sf_critical:
            warnings.append(self._create_warning(
                level=WarningLevel.FATAL,
                category='safety_factor',
                message=f"安全系数严重不足! 当前值: {safety_factor:.3f}, 临界值: {sf_critical}",
                location=location,
                current_value=safety_factor,
                threshold_value=sf_critical,
                recommendation="立即减小载荷或增加结构强度",
                component_id=component_id
            ))
        elif safety_factor < sf_min:
            warnings.append(self._create_warning(
                level=WarningLevel.CRITICAL,
                category='safety_factor',
                message=f"安全系数低于最小值! 当前值: {safety_factor:.3f}, 最小值: {sf_min}",
                location=location,
                current_value=safety_factor,
                threshold_value=sf_min,
                recommendation="考虑调整结构参数或减小载荷",
                component_id=component_id
            ))
        elif safety_factor < sf_min * 1.2:
            warnings.append(self._create_warning(
                level=WarningLevel.WARNING,
                category='safety_factor',
                message=f"安全系数接近下限值: {safety_factor:.3f}",
                location=location,
                current_value=safety_factor,
                threshold_value=sf_min * 1.2,
                recommendation="建议关注该区域应力状态",
                component_id=component_id
            ))
        
        return warnings
    
    def check_stress_level(self,
                            max_stress: float,
                            yield_strength: float,
                            location: Optional[Tuple[float, float, float]] = None,
                            stress_type: str = 'von_mises',
                            component_id: Optional[str] = None) -> List[AnomalyWarning]:
        warnings = []
        stress_ratio = max_stress / yield_strength
        max_ratio = self.thresholds['stress_max_ratio']
        
        if stress_ratio >= 1.0:
            warnings.append(self._create_warning(
                level=WarningLevel.FATAL,
                category='stress_level',
                message=f"{stress_type}应力超过屈服强度! 比值: {stress_ratio:.3f}",
                location=location,
                current_value=max_stress,
                threshold_value=yield_strength,
                recommendation="立即停止加载，检查结构完整性",
                stress_type=stress_type,
                component_id=component_id
            ))
        elif stress_ratio > max_ratio:
            warnings.append(self._create_warning(
                level=WarningLevel.CRITICAL,
                category='stress_level',
                message=f"{stress_type}应力接近许用值! 比值: {stress_ratio:.3f}",
                location=location,
                current_value=max_stress,
                threshold_value=yield_strength * max_ratio,
                recommendation="考虑降低载荷或增加截面尺寸",
                stress_type=stress_type,
                component_id=component_id
            ))
        elif stress_ratio > max_ratio * 0.8:
            warnings.append(self._create_warning(
                level=WarningLevel.WARNING,
                category='stress_level',
                message=f"{stress_type}应力水平较高: {stress_ratio:.3f}",
                location=location,
                current_value=max_stress,
                threshold_value=yield_strength * max_ratio,
                recommendation="建议监测该区域应力变化",
                stress_type=stress_type,
                component_id=component_id
            ))
        
        return warnings
    
    def check_deformation(self,
                           deformation: float,
                           span_length: float,
                           location: Optional[Tuple[float, float, float]] = None,
                           component_id: Optional[str] = None) -> List[AnomalyWarning]:
        warnings = []
        def_ratio = deformation / span_length
        max_ratio = self.thresholds['deformation_max_ratio']
        
        if def_ratio > max_ratio * 2:
            warnings.append(self._create_warning(
                level=WarningLevel.FATAL,
                category='deformation',
                message=f"变形量严重超标! 变形/跨径比: {def_ratio:.4f}",
                location=location,
                current_value=deformation,
                threshold_value=span_length * max_ratio,
                recommendation="立即检查结构是否发生永久变形或损坏",
                component_id=component_id
            ))
        elif def_ratio > max_ratio:
            warnings.append(self._create_warning(
                level=WarningLevel.CRITICAL,
                category='deformation',
                message=f"变形量超过许用值! 变形/跨径比: {def_ratio:.4f}",
                location=location,
                current_value=deformation,
                threshold_value=span_length * max_ratio,
                recommendation="考虑增加结构刚度或减小载荷",
                component_id=component_id
            ))
        elif def_ratio > max_ratio * 0.7:
            warnings.append(self._create_warning(
                level=WarningLevel.WARNING,
                category='deformation',
                message=f"变形量接近许用上限: {def_ratio:.4f}",
                location=location,
                current_value=deformation,
                threshold_value=span_length * max_ratio,
                recommendation="建议监测变形趋势",
                component_id=component_id
            ))
        
        return warnings
    
    def check_contact_pressure(self,
                                contact_pressure: float,
                                compressive_strength: float,
                                location: Optional[Tuple[float, float, float]] = None,
                                component_id: Optional[str] = None) -> List[AnomalyWarning]:
        warnings = []
        pressure_ratio = contact_pressure / compressive_strength
        max_ratio = self.thresholds['contact_pressure_max_ratio']
        
        if pressure_ratio >= 1.0:
            warnings.append(self._create_warning(
                level=WarningLevel.FATAL,
                category='contact_pressure',
                message=f"接触压应力超过抗压强度! 比值: {pressure_ratio:.3f}",
                location=location,
                current_value=contact_pressure,
                threshold_value=compressive_strength,
                recommendation="存在局部压溃风险，立即检查接触区域",
                component_id=component_id
            ))
        elif pressure_ratio > max_ratio:
            warnings.append(self._create_warning(
                level=WarningLevel.CRITICAL,
                category='contact_pressure',
                message=f"接触压应力较高! 比值: {pressure_ratio:.3f}",
                location=location,
                current_value=contact_pressure,
                threshold_value=compressive_strength * max_ratio,
                recommendation="考虑增大接触面积或减小载荷",
                component_id=component_id
            ))
        
        return warnings
    
    def check_joint_interaction(self,
                                 interaction_factor: float,
                                 joint_id: str) -> List[AnomalyWarning]:
        warnings = []
        max_factor = self.thresholds['interaction_factor_max']
        
        if interaction_factor > max_factor:
            warnings.append(self._create_warning(
                level=WarningLevel.CRITICAL,
                category='joint_interaction',
                message=f"榫卯{joint_id}相互作用因子过高: {interaction_factor:.3f}",
                recommendation="考虑调整榫卯间距或增加中间支撑",
                joint_id=joint_id
            ))
        elif interaction_factor > max_factor * 0.7:
            warnings.append(self._create_warning(
                level=WarningLevel.WARNING,
                category='joint_interaction',
                message=f"榫卯{joint_id}相互作用值得关注: {interaction_factor:.3f}",
                recommendation="建议检查相邻榫卯的受力分布",
                joint_id=joint_id
            ))
        
        return warnings
    
    def check_load_distribution(self,
                                 joint_loads: Dict[str, float],
                                 total_load: float) -> List[AnomalyWarning]:
        warnings = []
        if not joint_loads:
            return warnings
        
        n_joints = len(joint_loads)
        expected_load = total_load / n_joints
        max_imbalance = self.thresholds['load_imbalance_ratio']
        
        for joint_id, load in joint_loads.items():
            imbalance_ratio = abs(load - expected_load) / expected_load
            
            if imbalance_ratio > max_imbalance * 2:
                warnings.append(self._create_warning(
                    level=WarningLevel.CRITICAL,
                    category='load_distribution',
                    message=f"榫卯{joint_id}载荷严重不均! 偏差率: {imbalance_ratio:.1%}",
                    current_value=load,
                    threshold_value=expected_load * (1 + max_imbalance),
                    recommendation="考虑调整榫卯位置或增加辅助支撑",
                    joint_id=joint_id
                ))
            elif imbalance_ratio > max_imbalance:
                warnings.append(self._create_warning(
                    level=WarningLevel.WARNING,
                    category='load_distribution',
                    message=f"榫卯{joint_id}载荷分布不均: {imbalance_ratio:.1%}",
                    current_value=load,
                    threshold_value=expected_load * (1 + max_imbalance),
                    recommendation="建议检查载荷作用位置",
                    joint_id=joint_id
                ))
        
        return warnings
    
    def check_rate_of_change(self,
                              current_state: Dict[str, Any],
                              previous_state: Dict[str, Any],
                              time_step: float = 1.0) -> List[AnomalyWarning]:
        warnings = []
        
        if not previous_state or time_step <= 0:
            return warnings
        
        if 'max_stress' in current_state and 'max_stress' in previous_state:
            stress_rate = abs(current_state['max_stress'] - previous_state['max_stress']) / time_step
            max_rate = self.thresholds['rate_of_change_stress']
            
            if stress_rate > max_rate:
                warnings.append(self._create_warning(
                    level=WarningLevel.CRITICAL,
                    category='rate_of_change',
                    message=f"应力变化率过高: {stress_rate/1e6:.2f} MPa/s",
                    current_value=stress_rate,
                    threshold_value=max_rate,
                    recommendation="应力快速变化，可能存在冲击载荷"
                ))
        
        if 'deformation' in current_state and 'deformation' in previous_state:
            deform_rate = abs(current_state['deformation'] - previous_state['deformation']) / time_step
            max_rate = self.thresholds['rate_of_change_deformation']
            
            if deform_rate > max_rate:
                warnings.append(self._create_warning(
                    level=WarningLevel.WARNING,
                    category='rate_of_change',
                    message=f"变形速率较高: {deform_rate*1000:.2f} mm/s",
                    current_value=deform_rate,
                    threshold_value=max_rate,
                    recommendation="建议检查是否存在动态载荷"
                ))
        
        return warnings
    
    def analyze_simulation_results(self,
                                    results: Dict[str, Any],
                                    wood_properties: Optional[Dict[str, float]] = None,
                                    span_length: float = 0.3) -> List[AnomalyWarning]:
        all_warnings = []
        
        if wood_properties is None:
            wood_properties = {
                'compressive_strength': 40e6,
                'tensile_strength': 80e6,
                'shear_strength': 10e6
            }
        
        sf = results.get('safety_factors', {}).get('overall', 0)
        all_warnings.extend(self.check_safety_factor(sf))
        
        max_stress = results.get('max_stresses', {}).get('max_von_mises', 0)
        all_warnings.extend(self.check_stress_level(
            max_stress,
            wood_properties.get('compressive_strength', 40e6),
            stress_type='von_mises'
        ))
        
        deformation = results.get('deformation', {}).get('total', 0)
        all_warnings.extend(self.check_deformation(deformation, span_length))
        
        contact_pressure = results.get('contact_stresses', {}).get('contact_pressure', 0)
        all_warnings.extend(self.check_contact_pressure(
            contact_pressure,
            wood_properties.get('compressive_strength', 40e6)
        ))
        
        if 'joint_results' in results:
            joint_results = results['joint_results']
            joint_loads = {}
            
            for joint_id, joint_res in joint_results.items():
                joint_loads[joint_id] = joint_res.get('load_distribution', {}).get('total_load', 0)
            
            total_load = sum(joint_loads.values())
            all_warnings.extend(self.check_load_distribution(joint_loads, total_load))
            
            if 'interaction_factors' in results:
                for joint_id, factor in results['interaction_factors'].items():
                    all_warnings.extend(self.check_joint_interaction(factor, joint_id))
        
        self.history.append({
            'timestamp': datetime.now().isoformat(),
            'max_stress': max_stress,
            'deformation': deformation,
            'safety_factor': sf,
            'n_warnings': len(all_warnings)
        })
        
        if len(self.history) >= 2:
            all_warnings.extend(self.check_rate_of_change(
                self.history[-1],
                self.history[-2]
            ))
        
        return all_warnings
    
    def get_warning_summary(self) -> Dict[str, Any]:
        summary = {
            'total_warnings': len(self.warnings),
            'by_level': {},
            'by_category': {},
            'critical_warnings': [],
            'fatal_warnings': []
        }
        
        for level in WarningLevel:
            count = sum(1 for w in self.warnings if w.level == level)
            summary['by_level'][level.name] = count
        
        categories = set(w.category for w in self.warnings)
        for cat in categories:
            summary['by_category'][cat] = sum(1 for w in self.warnings if w.category == cat)
        
        summary['critical_warnings'] = [w for w in self.warnings if w.level == WarningLevel.CRITICAL]
        summary['fatal_warnings'] = [w for w in self.warnings if w.level == WarningLevel.FATAL]
        
        if self.warnings:
            worst_level = max(self.warnings, key=lambda w: w.level.value).level
            summary['overall_status'] = worst_level.name
        else:
            summary['overall_status'] = 'SAFE'
        
        return summary
    
    def print_warnings(self, min_level: WarningLevel = WarningLevel.WARNING) -> None:
        filtered = [w for w in self.warnings if w.level.value >= min_level.value]
        
        if not filtered:
            print("✅ 未检测到异常")
            return
        
        print(f"\n⚠️  检测到 {len(filtered)} 个异常警告:\n")
        
        for warning in sorted(filtered, key=lambda w: w.level.value, reverse=True):
            level_icon = {
                WarningLevel.INFO: "ℹ️",
                WarningLevel.WARNING: "⚠️",
                WarningLevel.CRITICAL: "🔴",
                WarningLevel.FATAL: "💀"
            }[warning.level]
            
            print(f"{level_icon} [{warning.level.name}] {warning.category}")
            print(f"   {warning.message}")
            if warning.current_value is not None and warning.threshold_value is not None:
                print(f"   当前值: {warning.current_value:.4g}, 阈值: {warning.threshold_value:.4g}")
            if warning.recommendation:
                print(f"   建议: {warning.recommendation}")
            print()
    
    def clear_warnings(self) -> None:
        self.warnings = []
