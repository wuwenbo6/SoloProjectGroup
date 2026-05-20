"""
古法造纸纤维配比模拟系统 - 高级功能模块
包含: 多纤维协同配比模拟、异常预警、数据对比分析、性能优化
"""

import numpy as np
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Callable
from enum import Enum
import warnings
from functools import lru_cache

from raw_materials import RawMaterialCollector, FiberMaterial
from numerical_computation import NumericalComputer


class WarningLevel(Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class ProcessWarning:
    level: WarningLevel
    code: str
    message: str
    details: Dict = field(default_factory=dict)
    timestamp: float = 0.0


class SynergyEffectType(Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class FiberSynergyModel:
    """多纤维协同作用模型"""
    
    def __init__(self):
        self.synergy_matrix: Dict[Tuple[str, str], Dict] = {}
        self._init_default_synergies()
    
    def _init_default_synergies(self):
        """初始化默认纤维协同作用关系"""
        default_synergies = [
            (("mulberry", "bamboo"), {
                "effect": "positive",
                "strength_boost": 0.12,
                "uniformity_boost": 0.08,
                "soak_time_reduction": 0.1
            }),
            (("mulberry", "cotton"), {
                "effect": "positive",
                "strength_boost": 0.15,
                "uniformity_boost": 0.12,
                "soak_time_reduction": 0.05
            }),
            (("bamboo", "rice_straw"), {
                "effect": "negative",
                "strength_boost": -0.08,
                "uniformity_boost": -0.05,
                "soak_time_reduction": 0.0
            }),
            (("hemp", "mulberry"), {
                "effect": "positive",
                "strength_boost": 0.10,
                "uniformity_boost": 0.06,
                "soak_time_reduction": 0.15
            }),
            (("hemp", "cotton"), {
                "effect": "neutral",
                "strength_boost": 0.02,
                "uniformity_boost": 0.01,
                "soak_time_reduction": 0.0
            }),
        ]
        
        for (fiber1, fiber2), synergy in default_synergies:
            self.synergy_matrix[(fiber1, fiber2)] = synergy
            self.synergy_matrix[(fiber2, fiber1)] = synergy
    
    def get_pair_synergy(self, fiber1: str, fiber2: str) -> Optional[Dict]:
        """获取两种纤维的协同作用"""
        return self.synergy_matrix.get((fiber1, fiber2))
    
    def calculate_composite_synergy(self, fiber_names: List[str], 
                                    ratios: np.ndarray) -> Dict[str, float]:
        """计算多纤维复合协同作用"""
        n = len(fiber_names)
        total_strength_boost = 0.0
        total_uniformity_boost = 0.0
        total_soak_reduction = 0.0
        weight_sum = 0.0
        
        for i in range(n):
            for j in range(i + 1, n):
                synergy = self.get_pair_synergy(fiber_names[i], fiber_names[j])
                if synergy:
                    pair_weight = ratios[i] * ratios[j] * 2
                    total_strength_boost += synergy["strength_boost"] * pair_weight
                    total_uniformity_boost += synergy["uniformity_boost"] * pair_weight
                    total_soak_reduction += synergy["soak_time_reduction"] * pair_weight
                    weight_sum += pair_weight
        
        if weight_sum > 0:
            norm_factor = 1.0 / weight_sum
            total_strength_boost *= norm_factor
            total_uniformity_boost *= norm_factor
            total_soak_reduction *= norm_factor
        
        return {
            "strength_boost": total_strength_boost,
            "uniformity_boost": total_uniformity_boost,
            "soak_time_reduction": total_soak_reduction,
            "effective_pairs": weight_sum
        }


class ProcessWarningSystem:
    """配比过程异常预警系统"""
    
    def __init__(self):
        self.warnings: List[ProcessWarning] = []
        self.warning_counts: Dict[str, int] = {}
        
        self.thresholds = {
            "min_ratio": 0.02,
            "max_single_ratio": 0.9,
            "min_soak_time": 2.0,
            "max_soak_time": 72.0,
            "min_strength": 30.0,
            "min_uniformity": 0.3,
            "max_porosity": 0.9,
            "min_porosity": 0.1,
            "high_absorption": 0.95,
        }
    
    def _add_warning(self, level: WarningLevel, code: str, 
                     message: str, details: Dict = None):
        """添加预警"""
        warning = ProcessWarning(
            level=level,
            code=code,
            message=message,
            details=details or {}
        )
        self.warnings.append(warning)
        self.warning_counts[code] = self.warning_counts.get(code, 0) + 1
    
    def validate_ratios(self, ratios: List[float], material_names: List[str]) -> bool:
        """验证配比合理性"""
        valid = True
        
        if abs(sum(ratios) - 1.0) > 0.01:
            self._add_warning(
                WarningLevel.ERROR,
                "RATIO_SUM_INVALID",
                f"配比总和异常: {sum(ratios):.4f}, 应该接近1.0",
                {"actual_sum": sum(ratios)}
            )
            valid = False
        
        for name, ratio in zip(material_names, ratios):
            if ratio < self.thresholds["min_ratio"]:
                self._add_warning(
                    WarningLevel.WARNING,
                    "RATIO_TOO_LOW",
                    f"纤维 {name} 配比过低: {ratio:.4f}",
                    {"material": name, "ratio": ratio}
                )
                valid = False
            elif ratio > self.thresholds["max_single_ratio"]:
                self._add_warning(
                    WarningLevel.WARNING,
                    "RATIO_TOO_HIGH",
                    f"纤维 {name} 配比过高: {ratio:.4f}, 可能导致均匀性问题",
                    {"material": name, "ratio": ratio}
                )
                valid = False
        
        if len(set(ratios)) == 1:
            self._add_warning(
                WarningLevel.INFO,
                "EQUAL_RATIOS",
                "所有纤维配比相同，建议根据纤维特性调整以获得协同效应",
                {"num_materials": len(ratios)}
            )
        
        return valid
    
    def validate_soak_time(self, soak_time: float, material_names: List[str]) -> bool:
        """验证浸泡时间合理性"""
        valid = True
        
        if soak_time < self.thresholds["min_soak_time"]:
            self._add_warning(
                WarningLevel.WARNING,
                "SOAK_TIME_TOO_SHORT",
                f"浸泡时间过短: {soak_time:.1f}小时，纤维可能未充分膨润",
                {"soak_time": soak_time}
            )
            valid = False
        elif soak_time > self.thresholds["max_soak_time"]:
            self._add_warning(
                WarningLevel.WARNING,
                "SOAK_TIME_TOO_LONG",
                f"浸泡时间过长: {soak_time:.1f}小时，可能导致纤维过度降解",
                {"soak_time": soak_time}
            )
            valid = False
        
        return valid
    
    def validate_quality_metrics(self, metrics: Dict[str, float]) -> bool:
        """验证质量指标合理性"""
        valid = True
        
        if metrics.get("strength", 100) < self.thresholds["min_strength"]:
            self._add_warning(
                WarningLevel.WARNING,
                "STRENGTH_TOO_LOW",
                f"预测抗张强度过低: {metrics['strength']:.1f} MPa",
                {"strength": metrics['strength']}
            )
            valid = False
        
        if metrics.get("uniformity", 1.0) < self.thresholds["min_uniformity"]:
            self._add_warning(
                WarningLevel.WARNING,
                "UNIFORMITY_TOO_LOW",
                f"纤维均匀性过低: {metrics['uniformity']:.2f}",
                {"uniformity": metrics['uniformity']}
            )
            valid = False
        
        if metrics.get("porosity", 0.5) > self.thresholds["max_porosity"]:
            self._add_warning(
                WarningLevel.WARNING,
                "POROSITY_TOO_HIGH",
                f"孔隙率过高: {metrics['porosity']:.3f}, 可能导致纸张强度不足",
                {"porosity": metrics['porosity']}
            )
            valid = False
        elif metrics.get("porosity", 0.5) < self.thresholds["min_porosity"]:
            self._add_warning(
                WarningLevel.WARNING,
                "POROSITY_TOO_LOW",
                f"孔隙率过低: {metrics['porosity']:.3f}, 可能影响油墨吸收",
                {"porosity": metrics['porosity']}
            )
            valid = False
        
        if metrics.get("water_absorption", 0.5) > self.thresholds["high_absorption"]:
            self._add_warning(
                WarningLevel.INFO,
                "HIGH_WATER_ABSORPTION",
                f"吸水率较高: {metrics['water_absorption']:.2f}",
                {"water_absorption": metrics['water_absorption']}
            )
        
        return valid
    
    def check_synergy_conflicts(self, fiber_names: List[str], 
                                 ratios: List[float]) -> bool:
        """检查纤维协同冲突"""
        valid = True
        synergy_model = FiberSynergyModel()
        
        n = len(fiber_names)
        for i in range(n):
            for j in range(i + 1, n):
                synergy = synergy_model.get_pair_synergy(fiber_names[i], fiber_names[j])
                if synergy and synergy["effect"] == "negative":
                    pair_weight = ratios[i] * ratios[j]
                    if pair_weight > 0.1:
                        self._add_warning(
                            WarningLevel.WARNING,
                            "NEGATIVE_SYNERGY",
                            f"纤维 {fiber_names[i]} 与 {fiber_names[j]} 存在负协同作用",
                            {"pair": (fiber_names[i], fiber_names[j]),
                             "weight": pair_weight,
                             "strength_penalty": synergy["strength_boost"]}
                        )
                        valid = False
        
        return valid
    
    def get_warnings_summary(self) -> Dict:
        """获取预警摘要"""
        summary = {
            "total_warnings": len(self.warnings),
            "by_level": {},
            "by_code": self.warning_counts.copy(),
            "details": []
        }
        
        for warning in self.warnings:
            level = warning.level.value
            summary["by_level"][level] = summary["by_level"].get(level, 0) + 1
        
        return summary
    
    def clear_warnings(self):
        """清除所有预警"""
        self.warnings.clear()
        self.warning_counts.clear()


class ActualPaperData:
    """实际造纸数据管理"""
    
    def __init__(self):
        self.data_records: List[Dict] = []
    
    def add_record(self, record: Dict):
        """添加实际生产记录"""
        required_fields = ["id", "material_names", "ratios", "soak_time",
                           "actual_strength", "actual_porosity", "actual_absorption"]
        for field in required_fields:
            if field not in record:
                raise ValueError(f"缺少必填字段: {field}")
        
        self.data_records.append(record)
    
    def load_from_json(self, filepath: str):
        """从JSON加载实际数据"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for record in data:
                self.add_record(record)
    
    def save_to_json(self, filepath: str):
        """保存实际数据到JSON"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.data_records, f, ensure_ascii=False, indent=2)
    
    def find_similar_config(self, material_names: List[str], ratios: List[float],
                             soak_time: float, tolerance: float = 0.1) -> List[Dict]:
        """查找相似配置的实际记录"""
        similar = []
        target_set = set(material_names)
        
        for record in self.data_records:
            record_set = set(record["material_names"])
            
            if record_set != target_set:
                continue
            
            ratio_diff = 0.0
            for name in material_names:
                idx = record["material_names"].index(name)
                ratio_idx = material_names.index(name)
                ratio_diff += abs(record["ratios"][idx] - ratios[ratio_idx])
            
            time_diff = abs(record["soak_time"] - soak_time) / soak_time
            
            if ratio_diff < tolerance and time_diff < tolerance:
                record["match_score"] = 1.0 - (ratio_diff + time_diff) / 2
                similar.append(record)
        
        return sorted(similar, key=lambda x: x["match_score"], reverse=True)


class SimulationComparator:
    """仿真结果与实际数据对比分析"""
    
    def __init__(self):
        self.actual_data = ActualPaperData()
    
    def compare_single_result(self, simulation_result, 
                               actual_record: Dict = None) -> Dict:
        """对比单组仿真结果"""
        metrics = simulation_result.quality_metrics
        
        if actual_record is None:
            return {
                "comparison_type": "no_actual_data",
                "simulation_metrics": metrics.copy(),
                "differences": {}
            }
        
        differences = {
            "strength_error_pct": (
                (metrics["strength"] - actual_record["actual_strength"])
                / actual_record["actual_strength"] * 100
            ),
            "porosity_error_abs": (
                metrics["porosity"] - actual_record["actual_porosity"]
            ),
            "absorption_error_abs": (
                metrics["water_absorption"] - actual_record["actual_absorption"]
            ),
        }
        
        differences["overall_accuracy_pct"] = 100 - (
            abs(differences["strength_error_pct"]) * 0.5 +
            abs(differences["porosity_error_abs"]) * 100 * 0.3 +
            abs(differences["absorption_error_abs"]) * 100 * 0.2
        )
        
        return {
            "comparison_type": "with_actual_data",
            "simulation_metrics": metrics.copy(),
            "actual_metrics": {
                "strength": actual_record["actual_strength"],
                "porosity": actual_record["actual_porosity"],
                "water_absorption": actual_record["actual_absorption"]
            },
            "differences": differences,
            "actual_record_id": actual_record.get("id", "unknown")
        }
    
    def generate_comparison_report(self, simulation_results: List,
                                    actual_records: List[Dict] = None) -> Dict:
        """生成对比分析报告"""
        if actual_records is None:
            actual_records = self.actual_data.data_records
        
        comparisons = []
        for result in simulation_results:
            if actual_records:
                for record in actual_records:
                    comp = self.compare_single_result(result, record)
                    comparisons.append(comp)
            else:
                comp = self.compare_single_result(result, None)
                comparisons.append(comp)
        
        if comparisons and "overall_accuracy_pct" in comparisons[0]["differences"]:
            accuracies = [c["differences"]["overall_accuracy_pct"] for c in comparisons]
            stats = {
                "mean_accuracy": np.mean(accuracies),
                "min_accuracy": np.min(accuracies),
                "max_accuracy": np.max(accuracies),
                "std_accuracy": np.std(accuracies)
            }
        else:
            stats = {}
        
        return {
            "num_comparisons": len(comparisons),
            "accuracy_statistics": stats,
            "individual_comparisons": comparisons,
            "recommendations": self._generate_recommendations(comparisons)
        }
    
    def _generate_recommendations(self, comparisons: List[Dict]) -> List[str]:
        """生成改进建议"""
        recommendations = []
        
        if not comparisons or "overall_accuracy_pct" not in comparisons[0]["differences"]:
            recommendations.append("暂无实际数据进行对比，建议添加实际生产记录")
            return recommendations
        
        avg_strength_error = np.mean([
            c["differences"]["strength_error_pct"] for c in comparisons
        ])
        
        if avg_strength_error > 10:
            recommendations.append(
                "仿真强度普遍高估，建议调整纤维协同作用系数"
            )
        elif avg_strength_error < -10:
            recommendations.append(
                "仿真强度普遍低估，建议检查基础强度参数设置"
            )
        
        avg_accuracy = np.mean([
            c["differences"]["overall_accuracy_pct"] for c in comparisons
        ])
        
        if avg_accuracy < 80:
            recommendations.append(
                f"整体仿真准确度较低({avg_accuracy:.1f}%)，建议校准模型参数"
            )
        elif avg_accuracy > 90:
            recommendations.append(
                f"仿真准确度良好({avg_accuracy:.1f}%)，模型可靠"
            )
        
        return recommendations


class OptimizedNumericalComputer(NumericalComputer):
    """优化后的数值计算器 - 提升大样本计算速度"""
    
    def __init__(self):
        super().__init__()
        self._property_cache = {}
    
    @staticmethod
    def batch_calculate_strength(base_strengths: np.ndarray, ratio_matrix: np.ndarray,
                                  soak_times: np.ndarray, fiber_lengths: np.ndarray) -> np.ndarray:
        """批量计算抗张强度（向量化优化）"""
        n_samples = ratio_matrix.shape[0]
        
        base_avg = np.dot(ratio_matrix, base_strengths)
        avg_length = np.dot(ratio_matrix, fiber_lengths)
        
        length_factor = np.tanh(avg_length / 2.0)
        soak_factor = 0.85 + 0.15 * np.tanh(soak_times / 12.0)
        
        aspect_ratio = avg_length / 0.02
        soak_factor_2d = 1.0 - np.exp(-soak_times / 24.0)
        interaction_factor = 0.15 * aspect_ratio * soak_factor_2d
        interaction_factor = np.clip(interaction_factor, 0.0, 5.0)
        
        predicted_strength = base_avg * length_factor * soak_factor * (1 + interaction_factor)
        
        return predicted_strength
    
    @staticmethod
    def batch_calculate_porosity(ratio_matrix: np.ndarray, densities: np.ndarray,
                                   soak_times: np.ndarray) -> np.ndarray:
        """批量计算孔隙率（向量化优化）"""
        weighted_density = np.dot(ratio_matrix, densities)
        expansion_factor = 1.0 + 0.1 * np.tanh(soak_times / 10.0)
        effective_density = weighted_density / expansion_factor
        
        base_porosity = 0.4
        porosity = base_porosity * (1.5 - effective_density / 1.5)
        return np.clip(porosity, 0.2, 0.8)
    
    @staticmethod
    def batch_calculate_quality_metrics(strengths: np.ndarray, porosities: np.ndarray,
                                         absorptions: np.ndarray) -> Dict[str, np.ndarray]:
        """批量计算质量指标"""
        uniformity = 1.0 - np.abs(0.45 - porosities)
        durability = strengths * uniformity * 0.01
        printability = (1.0 - np.abs(0.5 - absorptions)) * 100
        overall_score = strengths * 0.4 + uniformity * 30 + printability * 0.3
        
        return {
            "strength": strengths,
            "porosity": porosities,
            "water_absorption": absorptions,
            "uniformity": uniformity,
            "durability": durability,
            "printability": printability,
            "overall_score": overall_score
        }
    
    def batch_simulate(self, material_properties: Dict[str, np.ndarray],
                       ratio_matrix: np.ndarray, soak_times: np.ndarray,
                       use_synergy: bool = True) -> Dict[str, np.ndarray]:
        """批量仿真（高性能版本）"""
        n_samples = ratio_matrix.shape[0]
        
        strengths = self.batch_calculate_strength(
            material_properties['tensile_strength'],
            ratio_matrix,
            soak_times,
            material_properties['fiber_length']
        )
        
        porosities = self.batch_calculate_porosity(
            ratio_matrix,
            material_properties['density'],
            soak_times
        )
        
        max_absorption = 1.0
        absorption_rate = 0.05
        absorption_level = max_absorption * (1 - np.exp(-absorption_rate * soak_times))
        avg_absorption = np.dot(ratio_matrix, material_properties['water_absorption'])
        absorptions = avg_absorption * absorption_level
        
        if use_synergy:
            synergy_model = FiberSynergyModel()
            for i in range(n_samples):
                pass
        
        metrics = self.batch_calculate_quality_metrics(strengths, porosities, absorptions)
        
        return metrics


def generate_latin_hypercube_samples(n_samples: int, n_dimensions: int) -> np.ndarray:
    """生成拉丁超立方采样用于参数扫描"""
    samples = np.zeros((n_samples, n_dimensions))
    
    for i in range(n_dimensions):
        samples[:, i] = (np.arange(n_samples) + np.random.rand(n_samples)) / n_samples
    
    for i in range(n_dimensions):
        np.random.shuffle(samples[:, i])
    
    samples = samples / samples.sum(axis=1, keepdims=True)
    
    return samples


def benchmark_performance(n_samples_list: List[int], n_materials: int = 4):
    """性能基准测试"""
    import time
    
    collector = RawMaterialCollector()
    material_names = ['mulberry', 'bamboo', 'rice_straw', 'cotton'][:n_materials]
    properties = collector.get_material_properties(material_names)
    
    results = []
    
    for n_samples in n_samples_list:
        ratio_matrix = generate_latin_hypercube_samples(n_samples, n_materials)
        soak_times = np.random.uniform(6, 48, n_samples)
        
        start_time = time.time()
        
        metrics = OptimizedNumericalComputer.batch_simulate(
            OptimizedNumericalComputer(),
            properties,
            ratio_matrix,
            soak_times
        )
        
        elapsed = time.time() - start_time
        
        results.append({
            "n_samples": n_samples,
            "time_seconds": elapsed,
            "samples_per_second": n_samples / elapsed,
            "avg_score": np.mean(metrics["overall_score"])
        })
        
        print(f"样本数: {n_samples:6d}, 耗时: {elapsed:.4f}s, "
              f"速度: {n_samples/elapsed:.1f} 样本/秒")
    
    return results
