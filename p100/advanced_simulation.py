import numpy as np
import h5py
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Callable, Any
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
import warnings

try:
    from .material_collector import MaterialCollector, Material
    from .numerical_calculator import NumericalCalculator
    from .color_predictor import ColorPredictor
except ImportError:
    from material_collector import MaterialCollector, Material
    from numerical_calculator import NumericalCalculator
    from color_predictor import ColorPredictor


class WarningLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class WarningInfo:
    level: WarningLevel
    code: str
    message: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComparisonResult:
    parameter_name: str
    simulated_value: float
    actual_value: float
    absolute_error: float
    relative_error: float
    passed: bool
    threshold: float


class AdvancedDyeSimulation:
    def __init__(self, material_collector: MaterialCollector, 
                 calculator: Optional[NumericalCalculator] = None,
                 use_parallel: bool = True,
                 max_workers: int = 4):
        self.material_collector = material_collector
        self.calculator = calculator if calculator else NumericalCalculator()
        self.color_predictor = ColorPredictor()
        self.use_parallel = use_parallel
        self.max_workers = max_workers
        self.warnings: List[WarningInfo] = []
        self.comparison_results: List[ComparisonResult] = []
        
        self.warning_thresholds = {
            'max_concentration': 5.0,
            'min_temperature': 20,
            'max_temperature': 150,
            'min_reaction_yield': 10.0,
            'max_color_difference': 0.3,
            'ratio_sum_tolerance': 0.01
        }

    def add_warning(self, level: WarningLevel, code: str, message: str, 
                    details: Optional[Dict[str, Any]] = None) -> None:
        warning = WarningInfo(
            level=level,
            code=code,
            message=message,
            details=details or {}
        )
        self.warnings.append(warning)
        
        if level == WarningLevel.CRITICAL:
            raise RuntimeError(f"CRITICAL [{code}]: {message}")
        elif level == WarningLevel.ERROR:
            warnings.warn(f"ERROR [{code}]: {message}", RuntimeWarning)
        elif level == WarningLevel.WARNING:
            warnings.warn(f"WARNING [{code}]: {message}", UserWarning)

    def clear_warnings(self) -> None:
        self.warnings = []

    def get_warnings(self, level: Optional[WarningLevel] = None) -> List[WarningInfo]:
        if level is None:
            return self.warnings
        return [w for w in self.warnings if w.level == level]

    def validate_simulation_params(self, ratios: Dict[str, float], 
                                    temperature: float) -> bool:
        is_valid = True
        
        ratio_sum = sum(ratios.values())
        if abs(ratio_sum - 1.0) > self.warning_thresholds['ratio_sum_tolerance']:
            self.add_warning(
                WarningLevel.WARNING,
                "RATIO_SUM_INVALID",
                f"配比比例之和为 {ratio_sum:.4f}，偏离1.0超过允许范围",
                {"ratio_sum": ratio_sum, "tolerance": self.warning_thresholds['ratio_sum_tolerance']}
            )
            is_valid = False
        
        for name, ratio in ratios.items():
            if ratio < 0:
                self.add_warning(
                    WarningLevel.ERROR,
                    "NEGATIVE_RATIO",
                    f"染料 {name} 的配比比例为负值: {ratio}",
                    {"dye_name": name, "ratio": ratio}
                )
                is_valid = False
        
        materials = self.material_collector.get_all_materials()
        for m in materials:
            if m.name in ratios:
                conc = m.concentration * ratios[m.name]
                if conc > self.warning_thresholds['max_concentration']:
                    self.add_warning(
                        WarningLevel.WARNING,
                        "HIGH_CONCENTRATION",
                        f"染料 {m.name} 的计算浓度过高: {conc:.2f} mol/L",
                        {"dye_name": m.name, "concentration": conc, 
                         "threshold": self.warning_thresholds['max_concentration']}
                    )
        
        if temperature < self.warning_thresholds['min_temperature']:
            self.add_warning(
                WarningLevel.WARNING,
                "LOW_TEMPERATURE",
                f"反应温度 {temperature}°C 低于建议最低温度",
                {"temperature": temperature, 
                 "min_temperature": self.warning_thresholds['min_temperature']}
            )
        elif temperature > self.warning_thresholds['max_temperature']:
            self.add_warning(
                WarningLevel.WARNING,
                "HIGH_TEMPERATURE",
                f"反应温度 {temperature}°C 高于建议最高温度",
                {"temperature": temperature, 
                 "max_temperature": self.warning_thresholds['max_temperature']}
            )
        
        return is_valid

    def run_single_simulation_optimized(self, ratios: Dict[str, float], 
                                         temperature: float,
                                         time_span: Tuple[float, float] = (0, 100),
                                         num_points: int = 100) -> Dict:
        self.validate_simulation_params(ratios, temperature)
        
        materials = self.material_collector.get_all_materials()
        material_names = [m.name for m in materials]
        
        ratios_array = np.array([ratios.get(name, 0) for name in material_names], dtype=np.float32)
        ratios_array = ratios_array / np.sum(ratios_array) if np.sum(ratios_array) > 0 else ratios_array
        
        initial_concentrations = np.array([m.concentration for m in materials], dtype=np.float32) * ratios_array
        
        t, conc_history = self.calculator.simulate_reaction(
            initial_concentrations, temperature, time_span, num_points
        )
        
        absorption_coeffs = np.array([m.absorption_coefficient for m in materials], dtype=np.float32)
        absorption_history = np.dot(conc_history, absorption_coeffs)
        
        color_matrix = np.array([m.color for m in materials], dtype=np.float32)
        total_conc = np.sum(conc_history, axis=1, keepdims=True)
        total_conc[total_conc == 0] = 1
        normalized_conc = conc_history / total_conc
        
        cmyk_colors = np.array([self.color_predictor.rgb_to_cmyk(c) for c in color_matrix])
        cmyk_evolution = np.dot(normalized_conc, cmyk_colors)
        color_evolution = np.array([self.color_predictor.cmyk_to_rgb(c) for c in cmyk_evolution])
        
        result = {
            'material_names': material_names,
            'ratios': dict(zip(material_names, ratios_array)),
            'temperature': temperature,
            'time_points': t.astype(np.float32),
            'concentration_history': conc_history,
            'absorption_history': absorption_history,
            'initial_concentrations': initial_concentrations,
            'final_concentrations': conc_history[-1],
            'color_evolution': np.clip(color_evolution, 0, 1),
            'final_color': np.clip(color_evolution[-1], 0, 1),
            'reaction_yield': self.calculator.calculate_reaction_yield(
                np.sum(initial_concentrations), np.sum(conc_history[-1])
            ),
            'timestamp': datetime.now().isoformat(),
            'warnings': [w.__dict__ for w in self.warnings]
        }
        
        return result

    def _simulation_worker(self, args: Tuple[Dict[str, float], float, Tuple[float, float], int]) -> Dict:
        ratios, temperature, time_span, num_points = args
        return self.run_single_simulation_optimized(ratios, temperature, time_span, num_points)

    def run_cooperative_mixture_simulation(self, 
                                            dye_groups: List[List[str]],
                                            group_ratios: List[float],
                                            temperature: float,
                                            time_span: Tuple[float, float] = (0, 100),
                                            interaction_strength: float = 0.1) -> Dict:
        if len(dye_groups) != len(group_ratios):
            raise ValueError("染料组数量与组配比数量不匹配")
        
        if abs(sum(group_ratios) - 1.0) > 0.01:
            self.add_warning(
                WarningLevel.WARNING,
                "GROUP_RATIO_SUM",
                f"染料组配比之和为 {sum(group_ratios):.4f}，已自动归一化"
            )
            group_ratios = np.array(group_ratios) / sum(group_ratios)
        
        all_dyes = set()
        for group in dye_groups:
            all_dyes.update(group)
        
        combined_ratios = {}
        for group, group_ratio in zip(dye_groups, group_ratios):
            individual_ratio = group_ratio / len(group)
            for dye in group:
                if dye in combined_ratios:
                    combined_ratios[dye] += individual_ratio
                else:
                    combined_ratios[dye] = individual_ratio
        
        base_result = self.run_single_simulation_optimized(combined_ratios, temperature, time_span)
        
        interaction_effects = self._calculate_interaction_effects(
            dye_groups, group_ratios, base_result, interaction_strength
        )
        
        result = {
            **base_result,
            'dye_groups': dye_groups,
            'group_ratios': group_ratios,
            'interaction_strength': interaction_strength,
            'interaction_effects': interaction_effects,
            'simulation_type': 'cooperative_mixture'
        }
        
        return result

    def _calculate_interaction_effects(self, dye_groups: List[List[str]], 
                                        group_ratios: List[float],
                                        base_result: Dict,
                                        interaction_strength: float) -> Dict:
        interactions = []
        
        for i in range(len(dye_groups)):
            for j in range(i + 1, len(dye_groups)):
                group1, group2 = dye_groups[i], dye_groups[j]
                ratio1, ratio2 = group_ratios[i], group_ratios[j]
                
                interaction_factor = ratio1 * ratio2 * interaction_strength * 4
                
                interaction = {
                    'group_pair': (group1, group2),
                    'group_indices': (i, j),
                    'interaction_factor': interaction_factor,
                    'yield_modification': interaction_factor * 0.1,
                    'color_shift': np.array([interaction_factor * 0.05, 
                                             -interaction_factor * 0.02, 
                                             interaction_factor * 0.03])
                }
                interactions.append(interaction)
        
        return {
            'total_interactions': len(interactions),
            'interactions': interactions,
            'average_interaction_strength': np.mean([i['interaction_factor'] for i in interactions])
        }

    def run_multi_dye_grid_search(self, 
                                   param_grid: Dict[str, List[float]],
                                   temperature: float,
                                   time_span: Tuple[float, float] = (0, 100),
                                   objective_function: Optional[Callable[[Dict], float]] = None,
                                   maximize: bool = True) -> Dict:
        from itertools import product
        
        dye_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        all_combinations = list(product(*param_values))
        
        ratio_combinations = []
        for combo in all_combinations:
            total = sum(combo)
            if total > 0:
                normalized = tuple(v / total for v in combo)
                ratio_dict = dict(zip(dye_names, normalized))
                ratio_combinations.append(ratio_dict)
        
        if objective_function is None:
            def objective_function(result):
                return result['reaction_yield']
        
        simulation_args = [(ratios, temperature, time_span, 50) for ratios in ratio_combinations]
        
        if self.use_parallel and len(ratio_combinations) > 10:
            with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
                results = list(executor.map(self._simulation_worker, simulation_args))
        else:
            results = [self._simulation_worker(args) for args in simulation_args]
        
        objective_values = [objective_function(r) for r in results]
        
        if maximize:
            best_idx = np.argmax(objective_values)
        else:
            best_idx = np.argmin(objective_values)
        
        return {
            'total_combinations': len(ratio_combinations),
            'parameter_grid': param_grid,
            'all_results': results,
            'objective_values': objective_values,
            'best_result': results[best_idx],
            'best_objective_value': objective_values[best_idx],
            'best_index': best_idx,
            'objective_function_name': objective_function.__name__ if hasattr(objective_function, '__name__') else 'custom'
        }

    def compare_with_actual_data(self, simulation_result: Dict,
                                  actual_data: Dict[str, Any],
                                  thresholds: Optional[Dict[str, float]] = None) -> Dict:
        default_thresholds = {
            'reaction_yield': 5.0,
            'final_color': 0.15,
            'absorption': 0.1,
            'concentration': 0.05
        }
        thresholds = thresholds or default_thresholds
        
        self.comparison_results = []
        
        if 'reaction_yield' in actual_data:
            sim_yield = simulation_result['reaction_yield']
            actual_yield = actual_data['reaction_yield']
            abs_error = abs(sim_yield - actual_yield)
            rel_error = abs_error / abs(actual_yield) if actual_yield != 0 else float('inf')
            
            self.comparison_results.append(ComparisonResult(
                parameter_name='reaction_yield',
                simulated_value=sim_yield,
                actual_value=actual_yield,
                absolute_error=abs_error,
                relative_error=rel_error,
                passed=rel_error * 100 <= thresholds['reaction_yield'],
                threshold=thresholds['reaction_yield']
            ))
            
            if rel_error * 100 > thresholds['reaction_yield']:
                self.add_warning(
                    WarningLevel.WARNING,
                    "YIELD_MISMATCH",
                    f"反应产率偏差超过阈值: {rel_error*100:.2f}% > {thresholds['reaction_yield']}%",
                    {"simulated": sim_yield, "actual": actual_yield, "error_pct": rel_error*100}
                )
        
        if 'final_color' in actual_data:
            sim_color = np.array(simulation_result['final_color'])
            actual_color = np.array(actual_data['final_color'])
            color_diff = self.color_predictor.color_difference(sim_color, actual_color, 'euclidean')
            
            self.comparison_results.append(ComparisonResult(
                parameter_name='final_color',
                simulated_value=float(np.mean(sim_color)),
                actual_value=float(np.mean(actual_color)),
                absolute_error=float(color_diff),
                relative_error=float(color_diff / np.mean(actual_color) if np.mean(actual_color) != 0 else color_diff),
                passed=color_diff <= thresholds['final_color'],
                threshold=thresholds['final_color']
            ))
            
            if color_diff > thresholds['final_color']:
                self.add_warning(
                    WarningLevel.WARNING,
                    "COLOR_MISMATCH",
                    f"颜色差异超过阈值: {color_diff:.4f} > {thresholds['final_color']}",
                    {"simulated": sim_color.tolist(), "actual": actual_color.tolist(), "difference": color_diff}
                )
        
        if 'final_concentrations' in actual_data and 'final_concentrations' in simulation_result:
            sim_conc = simulation_result['final_concentrations']
            actual_conc = np.array(actual_data['final_concentrations'])
            
            for i, (s, a) in enumerate(zip(sim_conc, actual_conc)):
                abs_error = abs(s - a)
                rel_error = abs_error / abs(a) if a != 0 else 0
                name = simulation_result.get('material_names', [f'dye_{i}'])[i]
                
                self.comparison_results.append(ComparisonResult(
                    parameter_name=f'concentration_{name}',
                    simulated_value=float(s),
                    actual_value=float(a),
                    absolute_error=float(abs_error),
                    relative_error=float(rel_error),
                    passed=rel_error * 100 <= thresholds['concentration'] * 100,
                    threshold=thresholds['concentration']
                ))
        
        passed_count = sum(1 for r in self.comparison_results if r.passed)
        overall_pass_rate = passed_count / len(self.comparison_results) if self.comparison_results else 0
        
        comparison_summary = {
            'total_parameters': len(self.comparison_results),
            'passed_parameters': passed_count,
            'overall_pass_rate': overall_pass_rate,
            'all_passed': overall_pass_rate == 1.0,
            'detailed_results': [r.__dict__ for r in self.comparison_results]
        }
        
        return comparison_summary

    def batch_comparison_analysis(self, simulation_results: List[Dict],
                                   actual_datasets: List[Dict[str, Any]],
                                   output_dir: str = 'comparison_results') -> Dict:
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        if len(simulation_results) != len(actual_datasets):
            raise ValueError("模拟结果数量与实际数据数量不匹配")
        
        all_comparisons = []
        
        for i, (sim_result, actual_data) in enumerate(zip(simulation_results, actual_datasets)):
            comparison = self.compare_with_actual_data(sim_result, actual_data)
            comparison['simulation_index'] = i
            all_comparisons.append(comparison)
            
            with open(os.path.join(output_dir, f'comparison_{i}.json'), 'w', encoding='utf-8') as f:
                json.dump(comparison, f, indent=2, ensure_ascii=False)
        
        pass_rates = [c['overall_pass_rate'] for c in all_comparisons]
        avg_pass_rate = np.mean(pass_rates)
        
        error_analysis = self._analyze_comparison_errors(all_comparisons)
        
        summary = {
            'total_comparisons': len(all_comparisons),
            'average_pass_rate': float(avg_pass_rate),
            'min_pass_rate': float(min(pass_rates)),
            'max_pass_rate': float(max(pass_rates)),
            'all_comparisons': all_comparisons,
            'error_analysis': error_analysis,
            'summary_file': os.path.join(output_dir, 'comparison_summary.json')
        }
        
        with open(summary['summary_file'], 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        return summary

    def _analyze_comparison_errors(self, all_comparisons: List[Dict]) -> Dict:
        parameter_errors = {}
        
        for comparison in all_comparisons:
            for result in comparison['detailed_results']:
                param = result['parameter_name']
                if param not in parameter_errors:
                    parameter_errors[param] = []
                parameter_errors[param].append(result['relative_error'])
        
        error_stats = {}
        for param, errors in parameter_errors.items():
            error_stats[param] = {
                'mean_error': float(np.mean(errors)),
                'max_error': float(np.max(errors)),
                'min_error': float(np.min(errors)),
                'std_error': float(np.std(errors)),
                'failure_count': sum(1 for e in errors if e > 0.05)
            }
        
        return error_stats

    def vectorized_batch_simulation(self, ratio_matrix: np.ndarray,
                                     temperature_vector: np.ndarray,
                                     time_span: Tuple[float, float] = (0, 100),
                                     num_points: int = 50) -> Dict:
        n_simulations = ratio_matrix.shape[0]
        if len(temperature_vector) != n_simulations:
            raise ValueError("配比矩阵行数与温度向量长度不匹配")
        
        materials = self.material_collector.get_all_materials()
        n_materials = len(materials)
        
        if ratio_matrix.shape[1] != n_materials:
            raise ValueError(f"配比矩阵列数应为 {n_materials}")
        
        row_sums = ratio_matrix.sum(axis=1, keepdims=True)
        ratio_matrix = ratio_matrix / (row_sums + 1e-10)
        
        conc_matrix = np.array([m.concentration for m in materials])
        initial_conc_matrix = ratio_matrix * conc_matrix
        
        absorption_coeffs = np.array([m.absorption_coefficient for m in materials])
        
        all_results = []
        all_final_conc = []
        all_final_abs = []
        
        for i in range(n_simulations):
            t, conc_history = self.calculator.simulate_reaction(
                initial_conc_matrix[i], temperature_vector[i], time_span, num_points
            )
            final_conc = conc_history[-1]
            final_abs = np.dot(final_conc, absorption_coeffs)
            
            all_final_conc.append(final_conc)
            all_final_abs.append(final_abs)
            
            all_results.append({
                'index': i,
                'temperature': temperature_vector[i],
                'ratios': ratio_matrix[i],
                'final_concentrations': final_conc,
                'final_absorption': final_abs
            })
        
        return {
            'n_simulations': n_simulations,
            'all_results': all_results,
            'final_concentrations_matrix': np.array(all_final_conc),
            'final_absorptions_array': np.array(all_final_abs),
            'simulation_type': 'vectorized_batch'
        }

    def export_warnings_report(self, filepath: str) -> None:
        report = {
            'total_warnings': len(self.warnings),
            'warning_level_count': {
                level.value: len(self.get_warnings(level)) for level in WarningLevel
            },
            'warnings': [w.__dict__ for w in self.warnings],
            'generated_at': datetime.now().isoformat()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
