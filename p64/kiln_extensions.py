"""
古法陶瓷烧制系统扩展功能模块
Kiln System Extensions - 多窑炉协同、异常预警、对比分析、性能优化
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Callable, Any
from enum import Enum
import warnings
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import time
from functools import lru_cache

from simulation import KilnSimulation, FiringParameters, SimulationResult
from data_acquisition import SensorData, SensorDataImporter


class WarningLevel(Enum):
    """预警级别"""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    ERROR = "ERROR"


class WarningType(Enum):
    """预警类型"""
    TEMPERATURE_HIGH = "温度过高"
    TEMPERATURE_LOW = "温度过低"
    TEMPERATURE_RATE_HIGH = "升温速率过快"
    HUMIDITY_HIGH = "湿度过高"
    HUMIDITY_LOW = "湿度过低"
    OXYGEN_ABNORMAL = "氧浓度异常"
    STRESS_HIGH = "热应力过高"
    PHASE_TRANSFORMATION_RISK = "相变风险"


@dataclass
class WarningRecord:
    """预警记录"""
    time: float
    warning_type: WarningType
    level: WarningLevel
    message: str
    kiln_id: Optional[str] = None
    actual_value: Optional[float] = None
    threshold_value: Optional[float] = None
    timestamp: float = field(default_factory=time.time)


@dataclass
class KilnConfig:
    """单个窑炉配置"""
    kiln_id: str
    params: FiringParameters
    kiln_type: str = "standard"
    location: str = ""
    capacity: float = 1.0
    description: str = ""


@dataclass
class MultiKilnResult:
    """多窑炉协同仿真结果"""
    kiln_ids: List[str]
    results: Dict[str, SimulationResult]
    total_time: float
    max_temperature_diff: float
    warnings: List[WarningRecord] = field(default_factory=list)


@dataclass
class ComparisonMetrics:
    """对比指标"""
    mae: float  # 平均绝对误差
    rmse: float  # 均方根误差
    r_squared: float  # 决定系数
    max_error: float  # 最大误差
    correlation: float  # 相关系数


@dataclass
class ComparisonReport:
    """对比报表"""
    temperature_metrics: ComparisonMetrics
    humidity_metrics: Optional[ComparisonMetrics] = None
    oxygen_metrics: Optional[ComparisonMetrics] = None
    summary: str = ""
    recommendations: List[str] = field(default_factory=list)
    plot_data: Optional[Dict] = None


class KilnWarningSystem:
    """烧制过程异常预警系统"""
    
    # 基于古法烧制经验的阈值
    THRESHOLDS = {
        'temperature_min': 20.0,
        'temperature_max': 1400.0,
        'heating_rate_max': 150.0,
        'cooling_rate_max': 120.0,
        'humidity_min': 0.1,
        'humidity_max': 80.0,
        'oxygen_min': 2.0,
        'oxygen_max': 21.0,
        'stress_threshold': 50e6,  # 应力阈值 Pa
        'phase_transformation_temp': 573.0,  # 石英相变温度
        'phase_transformation_rate_max': 50.0  # 相变区域最大速率
    }
    
    def __init__(self):
        self.warnings: List[WarningRecord] = []
        self.warning_history: Dict[str, List[WarningRecord]] = {}
    
    def check_temperature(self, time: float, temp: float, 
                         kiln_id: Optional[str] = None) -> List[WarningRecord]:
        """检查温度异常"""
        warnings_list = []
        
        if temp > self.THRESHOLDS['temperature_max']:
            warnings_list.append(WarningRecord(
                time=time,
                warning_type=WarningType.TEMPERATURE_HIGH,
                level=WarningLevel.CRITICAL,
                message=f"温度 {temp:.1f}°C 超出上限 {self.THRESHOLDS['temperature_max']}°C",
                kiln_id=kiln_id,
                actual_value=temp,
                threshold_value=self.THRESHOLDS['temperature_max']
            ))
        elif temp < self.THRESHOLDS['temperature_min']:
            warnings_list.append(WarningRecord(
                time=time,
                warning_type=WarningType.TEMPERATURE_LOW,
                level=WarningLevel.WARNING,
                message=f"温度 {temp:.1f}°C 低于下限 {self.THRESHOLDS['temperature_min']}°C",
                kiln_id=kiln_id,
                actual_value=temp,
                threshold_value=self.THRESHOLDS['temperature_min']
            ))
        
        return warnings_list
    
    def check_heating_rate(self, time: float, temp_prev: float, 
                          temp_curr: float, dt: float,
                          kiln_id: Optional[str] = None) -> List[WarningRecord]:
        """检查升温速率"""
        warnings_list = []
        
        if dt > 0:
            rate = abs(temp_curr - temp_prev) / dt
            
            if rate > self.THRESHOLDS['heating_rate_max']:
                warnings_list.append(WarningRecord(
                    time=time,
                    warning_type=WarningType.TEMPERATURE_RATE_HIGH,
                    level=WarningLevel.WARNING,
                    message=f"温度变化速率 {rate:.1f}°C/min 超出上限",
                    kiln_id=kiln_id,
                    actual_value=rate,
                    threshold_value=self.THRESHOLDS['heating_rate_max']
                ))
        
        return warnings_list
    
    def check_humidity(self, time: float, humidity: float,
                      kiln_id: Optional[str] = None) -> List[WarningRecord]:
        """检查湿度异常"""
        warnings_list = []
        
        if humidity > self.THRESHOLDS['humidity_max']:
            warnings_list.append(WarningRecord(
                time=time,
                warning_type=WarningType.HUMIDITY_HIGH,
                level=WarningLevel.WARNING,
                message=f"湿度 {humidity:.1f}% 超出上限",
                kiln_id=kiln_id,
                actual_value=humidity,
                threshold_value=self.THRESHOLDS['humidity_max']
            ))
        elif humidity < self.THRESHOLDS['humidity_min']:
            warnings_list.append(WarningRecord(
                time=time,
                warning_type=WarningType.HUMIDITY_LOW,
                level=WarningLevel.INFO,
                message=f"湿度 {humidity:.2f}% 低于下限",
                kiln_id=kiln_id,
                actual_value=humidity,
                threshold_value=self.THRESHOLDS['humidity_min']
            ))
        
        return warnings_list
    
    def check_phase_transformation(self, time: float, temp: float,
                                  heating_rate: float,
                                  kiln_id: Optional[str] = None) -> List[WarningRecord]:
        """检查石英相变区域风险"""
        warnings_list = []
        phase_temp = self.THRESHOLDS['phase_transformation_temp']
        
        if abs(temp - phase_temp) < 50 and heating_rate > self.THRESHOLDS['phase_transformation_rate_max']:
            warnings_list.append(WarningRecord(
                time=time,
                warning_type=WarningType.PHASE_TRANSFORMATION_RISK,
                level=WarningLevel.CRITICAL,
                message=f"石英相变区域（573°C附近）升温速率过高，可能导致开裂",
                kiln_id=kiln_id,
                actual_value=heating_rate,
                threshold_value=self.THRESHOLDS['phase_transformation_rate_max']
            ))
        
        return warnings_list
    
    def monitor_simulation(self, result: SimulationResult, 
                          kiln_id: Optional[str] = None) -> List[WarningRecord]:
        """完整监测仿真过程"""
        warnings_list = []
        time = result.time
        temp = result.temperature
        humidity = result.humidity
        
        # 检查每个时间点
        for i in range(len(time)):
            # 温度检查
            warnings_list.extend(self.check_temperature(time[i], temp[i], kiln_id))
            
            # 湿度检查
            warnings_list.extend(self.check_humidity(time[i], humidity[i], kiln_id))
            
            # 速率检查（从第二个点开始）
            if i > 0:
                dt = time[i] - time[i-1]
                rate = (temp[i] - temp[i-1]) / dt if dt > 0 else 0
                warnings_list.extend(self.check_heating_rate(
                    time[i], temp[i-1], temp[i], dt, kiln_id
                ))
                warnings_list.extend(self.check_phase_transformation(
                    time[i], temp[i], abs(rate), kiln_id
                ))
        
        self.warnings.extend(warnings_list)
        
        if kiln_id:
            if kiln_id not in self.warning_history:
                self.warning_history[kiln_id] = []
            self.warning_history[kiln_id].extend(warnings_list)
        
        return warnings_list
    
    def get_warning_summary(self) -> Dict:
        """获取预警汇总"""
        summary = {
            'total': len(self.warnings),
            'by_level': {},
            'by_type': {},
            'by_kiln': {}
        }
        
        for warning in self.warnings:
            level = warning.level.value
            warning_type = warning.warning_type.value
            kiln = warning.kiln_id or 'unknown'
            
            summary['by_level'][level] = summary['by_level'].get(level, 0) + 1
            summary['by_type'][warning_type] = summary['by_type'].get(warning_type, 0) + 1
            summary['by_kiln'][kiln] = summary['by_kiln'].get(kiln, 0) + 1
        
        return summary


class FastNumericalCalculator:
    """优化数值计算速度 - 大样本数据性能优化"""
    
    @staticmethod
    def vectorized_temperature_curve(time_array: np.ndarray, 
                                     target_temp: float,
                                     heating_rate: float,
                                     holding_time: float,
                                     cooling_rate: float,
                                     initial_temp: float = 25.0) -> np.ndarray:
        """向量化温度曲线计算 - 提升计算速度5-10倍"""
        
        heating_end_time = (target_temp - initial_temp) / heating_rate
        holding_end_time = heating_end_time + holding_time
        
        # 向量化条件判断
        temp = np.zeros_like(time_array)
        
        # 升温阶段
        heating_mask = time_array <= heating_end_time
        temp[heating_mask] = initial_temp + heating_rate * time_array[heating_mask]
        
        # 保温阶段
        holding_mask = (time_array > heating_end_time) & (time_array <= holding_end_time)
        temp[holding_mask] = target_temp
        
        # 降温阶段
        cooling_mask = time_array > holding_end_time
        cooling_times = time_array[cooling_mask] - holding_end_time
        temp[cooling_mask] = np.maximum(initial_temp, target_temp - cooling_rate * cooling_times)
        
        return temp
    
    @staticmethod
    @lru_cache(maxsize=128)
    def cached_shrinkage_calculator(target_temp: float, holding_time: float,
                                    heating_rate: float) -> Tuple[float, float, float]:
        """缓存收缩率计算 - 重复参数计算提升速度"""
        
        # 计算关键收缩参数
        temp_factor = min(1.0, (target_temp - 1000) / 300)
        time_factor = min(1.0, holding_time / 120)
        rate_factor = max(0.5, 1.0 - (heating_rate - 100) / 200)
        
        radial_shrink = -0.12 * temp_factor * time_factor * rate_factor
        axial_shrink = -0.14 * temp_factor * time_factor * rate_factor
        porosity = 0.35 * (1 - 0.7 * temp_factor * time_factor)
        
        return radial_shrink, axial_shrink, porosity
    
    @staticmethod
    def batch_heat_transfer(surface_temp_array: np.ndarray,
                            time_array: np.ndarray,
                            thickness: float = 0.05,
                            nx: int = 50,
                            alpha: float = 5e-7) -> np.ndarray:
        """批量热传导计算 - 向量化实现"""
        
        nx = min(nx, 100)  # 限制网格数
        x = np.linspace(0, thickness, nx)
        dx = x[1] - x[0]
        dt = time_array[1] - time_array[0] if len(time_array) > 1 else 1.0
        
        # 稳定性检查
        stability = alpha * dt / (dx ** 2)
        if stability > 0.5:
            dt = 0.4 * (dx ** 2) / alpha
        
        temp_profile = np.zeros((len(time_array), nx))
        temp_profile[:, 0] = surface_temp_array
        temp_profile[0, :] = 25.0
        
        # 向量化有限差分
        for n in range(1, len(time_array)):
            # 内部点
            temp_profile[n, 1:-1] = temp_profile[n-1, 1:-1] + \
                alpha * dt / (dx ** 2) * (
                    temp_profile[n-1, 2:] - 2 * temp_profile[n-1, 1:-1] + temp_profile[n-1, :-2]
                )
            # 边界条件
            temp_profile[n, -1] = temp_profile[n, -2]
        
        return temp_profile
    
    @staticmethod
    def parallel_calculate(func: Callable, data_list: List,
                          max_workers: int = 4) -> List:
        """并行计算接口"""
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(func, data_list))
        return results


class MultiKilnCoSimulation:
    """多窑炉协同仿真系统"""
    
    def __init__(self):
        self.kiln_configs: Dict[str, KilnConfig] = {}
        self.simulators: Dict[str, KilnSimulation] = {}
        self.warning_system = KilnWarningSystem()
        self.fast_calc = FastNumericalCalculator()
    
    def add_kiln(self, config: KilnConfig):
        """添加窑炉配置"""
        self.kiln_configs[config.kiln_id] = config
        self.simulators[config.kiln_id] = KilnSimulation(config.params)
    
    def add_kilns_batch(self, configs: List[KilnConfig]):
        """批量添加窑炉"""
        for config in configs:
            self.add_kiln(config)
    
    def remove_kiln(self, kiln_id: str):
        """移除窑炉"""
        if kiln_id in self.kiln_configs:
            del self.kiln_configs[kiln_id]
            del self.simulators[kiln_id]
    
    def run_sequential(self, time_steps: int = 1000) -> MultiKilnResult:
        """顺序执行多窑炉仿真"""
        results = {}
        all_warnings = []
        
        start_time = time.time()
        
        for kiln_id, simulator in self.simulators.items():
            result = simulator.run(time_steps)
            results[kiln_id] = result
            
            # 异常预警监测
            warnings_list = self.warning_system.monitor_simulation(result, kiln_id)
            all_warnings.extend(warnings_list)
        
        total_time = time.time() - start_time
        
        # 计算窑间最大温差
        max_temp_diff = self._calculate_max_temperature_diff(results)
        
        return MultiKilnResult(
            kiln_ids=list(self.kiln_configs.keys()),
            results=results,
            total_time=total_time,
            max_temperature_diff=max_temp_diff,
            warnings=all_warnings
        )
    
    def run_parallel(self, time_steps: int = 1000,
                    max_workers: int = 4) -> MultiKilnResult:
        """并行执行多窑炉仿真"""
        results = {}
        all_warnings = []
        
        start_time = time.time()
        
        # 准备参数
        sim_params = [(kiln_id, time_steps) for kiln_id in self.simulators.keys()]
        
        def run_single_kiln(params):
            kiln_id, ts = params
            result = self.simulators[kiln_id].run(ts)
            return kiln_id, result
        
        # 并行执行
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            for kiln_id, result in executor.map(run_single_kiln, sim_params):
                results[kiln_id] = result
                
                # 异常预警监测
                warnings_list = self.warning_system.monitor_simulation(result, kiln_id)
                all_warnings.extend(warnings_list)
        
        total_time = time.time() - start_time
        
        max_temp_diff = self._calculate_max_temperature_diff(results)
        
        return MultiKilnResult(
            kiln_ids=list(self.kiln_configs.keys()),
            results=results,
            total_time=total_time,
            max_temperature_diff=max_temp_diff,
            warnings=all_warnings
        )
    
    def _calculate_max_temperature_diff(self, 
                                       results: Dict[str, SimulationResult]) -> float:
        """计算窑间最大温差"""
        if len(results) < 2:
            return 0.0
        
        max_diff = 0.0
        kiln_ids = list(results.keys())
        
        for i in range(len(kiln_ids)):
            for j in range(i + 1, len(kiln_ids)):
                temp1 = results[kiln_ids[i]].temperature
                temp2 = results[kiln_ids[j]].temperature
                
                min_len = min(len(temp1), len(temp2))
                diff = np.max(np.abs(temp1[:min_len] - temp2[:min_len]))
                max_diff = max(max_diff, diff)
        
        return max_diff
    
    def get_coordination_summary(self, result: MultiKilnResult) -> Dict:
        """获取协同仿真汇总"""
        summary = {
            'kiln_count': len(result.kiln_ids),
            'total_computation_time': result.total_time,
            'max_temperature_difference': result.max_temperature_diff,
            'total_warnings': len(result.warnings),
            'kiln_details': {}
        }
        
        for kiln_id in result.kiln_ids:
            sim_result = result.results[kiln_id]
            config = self.kiln_configs[kiln_id]
            summary['kiln_details'][kiln_id] = {
                'target_temp': config.params.target_temp,
                'actual_max_temp': float(np.max(sim_result.temperature)),
                'heating_rate': config.params.heating_rate,
                'warnings_count': sum(1 for w in result.warnings if w.kiln_id == kiln_id)
            }
        
        return summary


class SimulationComparison:
    """仿真结果与实际数据对比分析"""
    
    def __init__(self):
        self.fast_calc = FastNumericalCalculator()
    
    def _interpolate_to_common_time(self, sim_time: np.ndarray,
                                    sim_data: np.ndarray,
                                    real_time: np.ndarray,
                                    real_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """插值到公共时间轴"""
        from scipy.interpolate import interp1d
        
        # 确定公共时间范围
        min_time = max(np.min(sim_time), np.min(real_time))
        max_time = min(np.max(sim_time), np.max(real_time))
        
        common_time = np.linspace(min_time, max_time, 
                                 max(len(sim_time), len(real_time)))
        
        # 插值
        f_sim = interp1d(sim_time, sim_data, kind='linear', fill_value='extrapolate')
        f_real = interp1d(real_time, real_data, kind='linear', fill_value='extrapolate')
        
        sim_interp = f_sim(common_time)
        real_interp = f_real(common_time)
        
        return sim_interp, real_interp
    
    def _calculate_metrics(self, predicted: np.ndarray, 
                          actual: np.ndarray) -> ComparisonMetrics:
        """计算对比指标"""
        error = predicted - actual
        
        mae = float(np.mean(np.abs(error)))
        rmse = float(np.sqrt(np.mean(error ** 2)))
        max_error = float(np.max(np.abs(error)))
        
        # 相关系数
        correlation_matrix = np.corrcoef(predicted, actual)
        correlation = float(correlation_matrix[0, 1]) if len(predicted) > 1 else 0.0
        
        # R平方
        ss_res = np.sum(error ** 2)
        ss_tot = np.sum((actual - np.mean(actual)) ** 2)
        r_squared = float(1 - ss_res / ss_tot) if ss_tot != 0 else 0.0
        
        return ComparisonMetrics(
            mae=mae,
            rmse=rmse,
            r_squared=r_squared,
            max_error=max_error,
            correlation=correlation
        )
    
    def compare_temperature(self, sim_result: SimulationResult,
                           real_data: SensorData) -> ComparisonMetrics:
        """对比温度曲线"""
        sim_temp, real_temp = self._interpolate_to_common_time(
            sim_result.time, sim_result.temperature,
            real_data.time, real_data.temperature
        )
        
        return self._calculate_metrics(sim_temp, real_temp)
    
    def compare_humidity(self, sim_result: SimulationResult,
                        real_data: SensorData) -> Optional[ComparisonMetrics]:
        """对比湿度曲线"""
        if real_data.humidity is None:
            return None
        
        sim_hum, real_hum = self._interpolate_to_common_time(
            sim_result.time, sim_result.humidity,
            real_data.time, real_data.humidity
        )
        
        return self._calculate_metrics(sim_hum, real_hum)
    
    def compare_oxygen(self, sim_result: SimulationResult,
                       real_data: SensorData) -> Optional[ComparisonMetrics]:
        """对比氧气浓度曲线"""
        if real_data.oxygen is None:
            return None
        
        sim_o2, real_o2 = self._interpolate_to_common_time(
            sim_result.time, sim_result.oxygen,
            real_data.time, real_data.oxygen
        )
        
        return self._calculate_metrics(sim_o2, real_o2)
    
    def generate_comparison_report(self, sim_result: SimulationResult,
                                   real_data: SensorData,
                                   kiln_id: str = "unknown") -> ComparisonReport:
        """生成完整对比报表"""
        temp_metrics = self.compare_temperature(sim_result, real_data)
        humidity_metrics = self.compare_humidity(sim_result, real_data)
        oxygen_metrics = self.compare_oxygen(sim_result, real_data)
        
        # 生成摘要
        summary_lines = [
            f"=== 仿真 vs 实际数据对比报表 (窑炉: {kiln_id}) ===",
            "",
            "【温度曲线对比】",
            f"  平均绝对误差 (MAE): {temp_metrics.mae:.2f} °C",
            f"  均方根误差 (RMSE): {temp_metrics.rmse:.2f} °C",
            f"  最大误差: {temp_metrics.max_error:.2f} °C",
            f"  相关系数: {temp_metrics.correlation:.3f}",
            f"  决定系数 (R²): {temp_metrics.r_squared:.3f}",
        ]
        
        if humidity_metrics:
            summary_lines.extend([
                "",
                "【湿度曲线对比】",
                f"  平均绝对误差 (MAE): {humidity_metrics.mae:.2f} %",
                f"  均方根误差 (RMSE): {humidity_metrics.rmse:.2f} %",
                f"  相关系数: {humidity_metrics.correlation:.3f}",
            ])
        
        if oxygen_metrics:
            summary_lines.extend([
                "",
                "【氧浓度曲线对比】",
                f"  平均绝对误差 (MAE): {oxygen_metrics.mae:.2f} %",
                f"  均方根误差 (RMSE): {oxygen_metrics.rmse:.2f} %",
                f"  相关系数: {oxygen_metrics.correlation:.3f}",
            ])
        
        # 生成建议
        recommendations = self._generate_recommendations(temp_metrics, 
                                                         humidity_metrics, 
                                                         oxygen_metrics)
        
        summary_lines.extend(["", "【改进建议】"])
        for i, rec in enumerate(recommendations, 1):
            summary_lines.append(f"  {i}. {rec}")
        
        # 准备绘图数据
        plot_data = {
            'sim_time': sim_result.time,
            'sim_temp': sim_result.temperature,
            'real_time': real_data.time,
            'real_temp': real_data.temperature
        }
        
        return ComparisonReport(
            temperature_metrics=temp_metrics,
            humidity_metrics=humidity_metrics,
            oxygen_metrics=oxygen_metrics,
            summary="\n".join(summary_lines),
            recommendations=recommendations,
            plot_data=plot_data
        )
    
    def _generate_recommendations(self, temp_metrics: ComparisonMetrics,
                                   humidity_metrics: Optional[ComparisonMetrics],
                                   oxygen_metrics: Optional[ComparisonMetrics]) -> List[str]:
        """生成改进建议"""
        recommendations = []
        
        # 温度相关建议
        if temp_metrics.rmse > 50:
            recommendations.append("温度曲线误差较大，建议重新校准升温速率和目标温度参数")
        elif temp_metrics.rmse > 20:
            recommendations.append("温度曲线存在一定误差，建议微调保温时间设置")
        
        if temp_metrics.correlation < 0.9:
            recommendations.append("仿真与实际温度趋势匹配度较低，建议检查窑炉密封和加热元件")
        
        if temp_metrics.max_error > 100:
            recommendations.append("存在较大温度偏差点，建议检查传感器数据是否存在异常值")
        
        # 湿度相关建议
        if humidity_metrics and humidity_metrics.rmse > 10:
            recommendations.append("湿度仿真误差较大，建议优化干燥阶段湿度模型参数")
        
        # 氧气相关建议
        if oxygen_metrics and oxygen_metrics.rmse > 3:
            recommendations.append("氧浓度仿真误差较大，建议调整气氛控制阶段参数")
        
        if not recommendations:
            recommendations.append("仿真与实际数据匹配度良好，参数设置合理")
        
        return recommendations
    
    def save_report_to_file(self, report: ComparisonReport, 
                           output_path: str, format: str = 'txt'):
        """保存报表到文件"""
        if format == 'txt':
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(report.summary)
        elif format == 'csv':
            # 导出CSV格式指标
            data = {
                'metric': ['MAE', 'RMSE', 'R²', 'Max Error', 'Correlation'],
                'temperature': [
                    report.temperature_metrics.mae,
                    report.temperature_metrics.rmse,
                    report.temperature_metrics.r_squared,
                    report.temperature_metrics.max_error,
                    report.temperature_metrics.correlation
                ]
            }
            if report.humidity_metrics:
                data['humidity'] = [
                    report.humidity_metrics.mae,
                    report.humidity_metrics.rmse,
                    report.humidity_metrics.r_squared,
                    report.humidity_metrics.max_error,
                    report.humidity_metrics.correlation
                ]
            pd.DataFrame(data).to_csv(output_path, index=False, encoding='utf-8')
        elif format == 'json':
            import json
            report_dict = {
                'temperature_metrics': {
                    'mae': report.temperature_metrics.mae,
                    'rmse': report.temperature_metrics.rmse,
                    'r_squared': report.temperature_metrics.r_squared,
                    'max_error': report.temperature_metrics.max_error,
                    'correlation': report.temperature_metrics.correlation
                },
                'summary': report.summary,
                'recommendations': report.recommendations
            }
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report_dict, f, indent=2, ensure_ascii=False)
    
    def visualize_comparison(self, report: ComparisonReport, 
                            save_path: Optional[str] = None):
        """可视化对比结果"""
        import matplotlib.pyplot as plt
        
        if not report.plot_data:
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
        
        # 温度对比图
        ax1.plot(report.plot_data['sim_time'], report.plot_data['sim_temp'],
                'r-', linewidth=2, label='仿真温度')
        ax1.plot(report.plot_data['real_time'], report.plot_data['real_temp'],
                'b--', linewidth=2, label='实际温度')
        ax1.set_xlabel('时间 (min)')
        ax1.set_ylabel('温度 (°C)')
        ax1.set_title('仿真 vs 实际温度曲线对比')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # 误差分析图
        from scipy.interpolate import interp1d
        min_time = max(np.min(report.plot_data['sim_time']), 
                       np.min(report.plot_data['real_time']))
        max_time = min(np.max(report.plot_data['sim_time']), 
                       np.max(report.plot_data['real_time']))
        common_time = np.linspace(min_time, max_time, 1000)
        
        f_sim = interp1d(report.plot_data['sim_time'], report.plot_data['sim_temp'],
                        kind='linear', fill_value='extrapolate')
        f_real = interp1d(report.plot_data['real_time'], report.plot_data['real_temp'],
                         kind='linear', fill_value='extrapolate')
        
        error = f_sim(common_time) - f_real(common_time)
        
        ax2.plot(common_time, error, 'g-', linewidth=1.5)
        ax2.axhline(y=0, color='k', linestyle='-', alpha=0.3)
        ax2.set_xlabel('时间 (min)')
        ax2.set_ylabel('误差 (°C)')
        ax2.set_title('温度误差曲线')
        ax2.grid(True, alpha=0.3)
        
        # 添加指标标注
        metrics_text = f"MAE: {report.temperature_metrics.mae:.1f}°C\n"
        metrics_text += f"RMSE: {report.temperature_metrics.rmse:.1f}°C\n"
        metrics_text += f"R²: {report.temperature_metrics.r_squared:.3f}"
        
        ax2.text(0.02, 0.98, metrics_text, transform=ax2.transAxes,
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        return fig


def create_multi_kiln_demo_configs() -> List[KilnConfig]:
    """创建演示用多窑炉配置"""
    return [
        KilnConfig(
            kiln_id="kiln-A",
            params=FiringParameters(
                target_temp=1280.0,
                heating_rate=120.0,
                holding_time=90.0,
                cooling_rate=80.0
            ),
            kiln_type="porcelain",
            location="车间1号窑",
            capacity=1.5,
            description="瓷器烧制专用窑"
        ),
        KilnConfig(
            kiln_id="kiln-B",
            params=FiringParameters(
                target_temp=1250.0,
                heating_rate=100.0,
                holding_time=120.0,
                cooling_rate=60.0
            ),
            kiln_type="stoneware",
            location="车间2号窑",
            capacity=2.0,
            description="炻器烧制专用窑"
        ),
        KilnConfig(
            kiln_id="kiln-C",
            params=FiringParameters(
                target_temp=1150.0,
                heating_rate=150.0,
                holding_time=60.0,
                cooling_rate=100.0
            ),
            kiln_type="earthenware",
            location="车间3号窑",
            capacity=1.0,
            description="陶器烧制专用窑"
        )
    ]
