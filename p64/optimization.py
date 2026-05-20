"""
参数优化模块 - 自动优化烧制参数
Parameter Optimization Module - Automatic Firing Parameter Optimization
"""

import numpy as np
from scipy.optimize import minimize, differential_evolution
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Callable, Any
import warnings

warnings.filterwarnings('ignore')


class OptimizationError(Exception):
    """优化异常类"""
    pass


# 古法陶瓷烧制经验数据 - 基于传统工艺的最优参数
# 来源: 景德镇、宜兴等传统窑口烧制经验总结
ANCIENT_FIRING_EXPERIENCE = {
    'optimal_target_temp': 1280.0,      # 最佳烧成温度
    'optimal_holding_time': 90.0,       # 最佳保温时间
    'optimal_heating_rate': 120.0,       # 最佳升温速率
    'optimal_cooling_rate': 80.0,        # 最佳降温速率
    'low_temp_range': (200, 600),       # 低温氧化阶段
    'mid_temp_range': (600, 1000),      # 中温过渡阶段
    'high_temp_range': (1000, 1350),    # 高温还原阶段
    'reduction_start_temp': 1000.0,     # 还原气氛起始温度
    'quartz_transformation_temp': 573.0,# 石英相变温度
    'recommended_rates': {
        'porcelain': {'heating': 100, 'holding': 120, 'cooling': 60},
        'stoneware': {'heating': 120, 'holding': 90, 'cooling': 80},
        'earthenware': {'heating': 150, 'holding': 60, 'cooling': 100}
    },
    'quality_penalty_weights': {
        'temp_deviation': 0.4,
        'rate_deviation': 0.3,
        'time_deviation': 0.3
    }
}


@dataclass
class OptimizationBounds:
    """优化参数边界 - 基于古法烧制经验调整"""
    heating_rate: Tuple[float, float] = (60, 200)
    target_temp: Tuple[float, float] = (1180, 1350)
    holding_time: Tuple[float, float] = (60, 180)
    cooling_rate: Tuple[float, float] = (50, 150)


@dataclass
class OptimizationWeights:
    """优化权重 - 多目标优化权重配置"""
    energy_consumption: float = 0.25
    shrinkage_quality: float = 0.30
    thermal_stress_risk: float = 0.25
    time_efficiency: float = 0.10
    experience_deviation: float = 0.10  # 与古法经验的偏离度惩罚


@dataclass
class OptimizationResult:
    """优化结果 - 增强版，包含质量评估"""
    optimal_params: Dict[str, float]
    fitness: float
    history: List[float] = field(default_factory=list)
    convergence: bool = False
    quality_score: Dict[str, float] = field(default_factory=dict)
    constraint_violations: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


class AncientFiringObjective:
    """基于古法烧制经验的目标函数"""
    
    def __init__(self, weights: Optional[OptimizationWeights] = None,
                 pottery_type: str = 'stoneware'):
        self.weights = weights or OptimizationWeights()
        self.experience = ANCIENT_FIRING_EXPERIENCE
        
        if pottery_type in self.experience['recommended_rates']:
            self.target_rates = self.experience['recommended_rates'][pottery_type]
        else:
            self.target_rates = self.experience['recommended_rates']['stoneware']
        
        self.penalty_weights = self.experience['quality_penalty_weights']
    
    def _safe_divide(self, a: float, b: float, default: float = 1.0) -> float:
        """安全除法"""
        try:
            if abs(b) < 1e-10:
                return default
            return a / b
        except:
            return default
    
    def calculate_energy_consumption(self, heating_rate: float, target_temp: float,
                                    holding_time: float, cooling_rate: float) -> float:
        """计算能耗 - 基于热传导模型"""
        try:
            initial_temp = 25.0
            heating_time = self._safe_divide(target_temp - initial_temp, heating_rate, 10.0)
            cooling_time = self._safe_divide(target_temp - initial_temp, cooling_rate, 10.0)
            
            heating_energy = heating_rate * heating_time
            holding_energy = 0.3 * target_temp * holding_time
            cooling_energy = 0.1 * cooling_rate * cooling_time
            
            total_energy = heating_energy + holding_energy + cooling_energy
            
            return np.clip(total_energy / 10000.0, 0.0, 5.0)
            
        except Exception as e:
            warnings.warn(f"能耗计算异常: {e}")
            return 2.5
    
    def calculate_thermal_stress_risk(self, heating_rate: float, cooling_rate: float,
                                       target_temp: float) -> float:
        """计算热应力风险 - 考虑石英相变影响"""
        try:
            base_stress = (heating_rate / 100.0) ** 2 + (cooling_rate / 100.0) ** 2
            temp_factor = max(0.0, (target_temp - 1200.0) / 200.0)
            
            quartz_penalty = 0.0
            if heating_rate < 80 or cooling_rate < 50:
                quartz_penalty = 0.3
            
            total_risk = base_stress * (1 + 0.5 * temp_factor) + quartz_penalty
            
            return np.clip(total_risk, 0.0, 5.0)
            
        except Exception as e:
            warnings.warn(f"热应力计算异常: {e}")
            return 2.5
    
    def calculate_shrinkage_quality(self, target_temp: float, holding_time: float,
                                    heating_rate: float) -> float:
        """计算收缩质量 - 基于烧结动力学"""
        try:
            optimal_temp = self.experience['optimal_target_temp']
            optimal_holding = self.experience['optimal_holding_time']
            
            temp_deviation = abs(target_temp - optimal_temp) / 100.0
            temp_penalty = temp_deviation ** 2
            
            time_deviation = abs(holding_time - optimal_holding) / 60.0
            time_penalty = time_deviation ** 2
            
            rate_factor = max(0.0, (heating_rate - 150.0) / 100.0)
            
            quality_loss = (self.penalty_weights['temp_deviation'] * temp_penalty +
                           self.penalty_weights['time_deviation'] * time_penalty +
                           self.penalty_weights['rate_deviation'] * rate_factor)
            
            return np.clip(quality_loss, 0.0, 3.0)
            
        except Exception as e:
            warnings.warn(f"收缩质量计算异常: {e}")
            return 1.5
    
    def calculate_time_efficiency(self, heating_rate: float, target_temp: float,
                                 holding_time: float, cooling_rate: float) -> float:
        """计算时间效率"""
        try:
            initial_temp = 25.0
            heating_time = self._safe_divide(target_temp - initial_temp, heating_rate, 10.0)
            cooling_time = self._safe_divide(target_temp - initial_temp, cooling_rate, 10.0)
            total_time = heating_time + holding_time + cooling_time
            
            return np.clip(total_time / 600.0, 0.0, 3.0)
            
        except Exception as e:
            warnings.warn(f"时间效率计算异常: {e}")
            return 1.0
    
    def calculate_experience_deviation(self, heating_rate: float, target_temp: float,
                                      holding_time: float, cooling_rate: float) -> float:
        """计算与古法经验的偏离度"""
        try:
            target_heating = self.target_rates['heating']
            target_cooling = self.target_rates['cooling']
            target_holding = self.target_rates['holding']
            
            heating_dev = abs(heating_rate - target_heating) / 100.0
            cooling_dev = abs(cooling_rate - target_cooling) / 100.0
            holding_dev = abs(holding_time - target_holding) / 100.0
            temp_dev = abs(target_temp - self.experience['optimal_target_temp']) / 100.0
            
            total_dev = (heating_dev + cooling_dev + holding_dev + temp_dev) / 4.0
            
            return np.clip(total_dev, 0.0, 2.0)
            
        except Exception as e:
            warnings.warn(f"经验偏离度计算异常: {e}")
            return 1.0
    
    def objective_function(self, x: np.ndarray) -> float:
        """综合目标函数"""
        try:
            heating_rate, target_temp, holding_time, cooling_rate = x
            
            energy = self.calculate_energy_consumption(heating_rate, target_temp, holding_time, cooling_rate)
            stress = self.calculate_thermal_stress_risk(heating_rate, cooling_rate, target_temp)
            shrinkage = self.calculate_shrinkage_quality(target_temp, holding_time, heating_rate)
            time_cost = self.calculate_time_efficiency(heating_rate, target_temp, holding_time, cooling_rate)
            experience_dev = self.calculate_experience_deviation(heating_rate, target_temp, holding_time, cooling_rate)
            
            total = (self.weights.energy_consumption * energy +
                    self.weights.thermal_stress_risk * stress +
                    self.weights.shrinkage_quality * shrinkage +
                    self.weights.time_efficiency * time_cost +
                    self.weights.experience_deviation * experience_dev)
            
            return float(total)
            
        except Exception as e:
            warnings.warn(f"目标函数计算异常: {e}")
            return 10.0


class ParameterOptimizer:
    """参数优化器 - 基于古法烧制经验增强版"""
    
    def __init__(self, bounds: Optional[OptimizationBounds] = None,
                 weights: Optional[OptimizationWeights] = None,
                 pottery_type: str = 'stoneware'):
        self.bounds = bounds or OptimizationBounds()
        self.objective = AncientFiringObjective(weights, pottery_type)
        self.optimization_history = []
        self.pottery_type = pottery_type
        self.experience = ANCIENT_FIRING_EXPERIENCE
    
    def _validate_parameters(self, params: np.ndarray) -> Tuple[bool, List[str]]:
        """参数合法性校验"""
        violations = []
        hr, tt, ht, cr = params
        
        if not (self.bounds.heating_rate[0] <= hr <= self.bounds.heating_rate[1]):
            violations.append(f"升温速率 {hr:.1f} 超出边界 {self.bounds.heating_rate}")
        
        if not (self.bounds.target_temp[0] <= tt <= self.bounds.target_temp[1]):
            violations.append(f"目标温度 {tt:.1f} 超出边界 {self.bounds.target_temp}")
        
        if not (self.bounds.holding_time[0] <= ht <= self.bounds.holding_time[1]):
            violations.append(f"保温时间 {ht:.1f} 超出边界 {self.bounds.holding_time}")
        
        if not (self.bounds.cooling_rate[0] <= cr <= self.bounds.cooling_rate[1]):
            violations.append(f"降温速率 {cr:.1f} 超出边界 {self.bounds.cooling_rate}")
        
        if tt > 1300 and ht < 60:
            violations.append("高温烧制建议保温时间不少于60分钟")
        
        if hr > 150 and tt > 1250:
            violations.append("高温阶段建议降低升温速率")
        
        return len(violations) == 0, violations
    
    def _get_bounds_list(self) -> List[Tuple[float, float]]:
        """获取边界列表"""
        return [
            self.bounds.heating_rate,
            self.bounds.target_temp,
            self.bounds.holding_time,
            self.bounds.cooling_rate
        ]
    
    def _callback(self, x: np.ndarray):
        """优化回调函数"""
        try:
            fitness = self.objective.objective_function(x)
            self.optimization_history.append(fitness)
        except:
            pass
    
    def _calculate_quality_score(self, x: np.ndarray) -> Dict[str, float]:
        """计算优化结果的质量评分"""
        try:
            heating_rate, target_temp, holding_time, cooling_rate = x
            
            opt_temp = self.experience['optimal_target_temp']
            temp_score = max(0.0, 100 - abs(target_temp - opt_temp) / 5.0)
            
            opt_hold = self.experience['optimal_holding_time']
            time_score = max(0.0, 100 - abs(holding_time - opt_hold) / 2.0)
            
            rate_score = max(0.0, 100 - abs(heating_rate - 120) - abs(cooling_rate - 80))
            
            overall = temp_score * 0.4 + rate_score * 0.3 + time_score * 0.3
            
            defect_risk = min(100.0, (heating_rate - 100) / 2.0 + (cooling_rate - 60) / 2.0)
            defect_risk = max(0.0, defect_risk)
            
            return {
                'temperature_score': round(temp_score, 2),
                'holding_time_score': round(time_score, 2),
                'rate_score': round(rate_score, 2),
                'overall_score': round(overall, 2),
                'defect_risk_percent': round(defect_risk, 2)
            }
        except Exception as e:
            warnings.warn(f"质量评分计算异常: {e}")
            return {'overall_score': 50.0}
    
    def _generate_recommendations(self, params: Dict[str, float], quality: Dict[str, float]) -> List[str]:
        """生成工艺改进建议"""
        recommendations = []
        
        if quality.get('temperature_score', 100) < 80:
            recommendations.append(
                f"建议将目标温度调整到 {self.experience['optimal_target_temp']}°C 附近以获得最佳烧结效果"
            )
        
        if quality.get('defect_risk_percent', 0) > 30:
            recommendations.append(
                "热应力风险较高，建议降低升/降温速率或在500-600°C石英相变区间减缓升温"
            )
        
        if params['target_temp'] > 1300 and params['holding_time'] < 90:
            recommendations.append(
                "高温烧制时建议延长保温时间以确保坯体充分烧结"
            )
        
        if self.pottery_type == 'porcelain' and params['cooling_rate'] > 80:
            recommendations.append(
                "瓷器烧制建议采用更缓慢的降温速度，防止热震开裂"
            )
        
        if not recommendations:
            recommendations.append("参数配置合理，符合古法烧制经验")
        
        return recommendations
    
    def optimize_gradient_based(self, initial_guess: Optional[List[float]] = None) -> OptimizationResult:
        """基于梯度的局部优化"""
        try:
            if initial_guess is None:
                target_rates = self.objective.target_rates
                initial_guess = [
                    target_rates['heating'],
                    self.experience['optimal_target_temp'],
                    target_rates['holding'],
                    target_rates['cooling']
                ]
            
            bounds = self._get_bounds_list()
            self.optimization_history = []
            
            result = minimize(
                self.objective.objective_function,
                x0=initial_guess,
                bounds=bounds,
                method='L-BFGS-B',
                callback=self._callback,
                options={'maxiter': 200, 'disp': False, 'ftol': 1e-6}
            )
            
            optimal_params = {
                'heating_rate': round(float(result.x[0]), 2),
                'target_temp': round(float(result.x[1]), 2),
                'holding_time': round(float(result.x[2]), 2),
                'cooling_rate': round(float(result.x[3]), 2)
            }
            
            quality_score = self._calculate_quality_score(result.x)
            is_valid, violations = self._validate_parameters(result.x)
            recommendations = self._generate_recommendations(optimal_params, quality_score)
            
            return OptimizationResult(
                optimal_params=optimal_params,
                fitness=round(float(result.fun), 6),
                history=self.optimization_history.copy(),
                convergence=result.success and is_valid,
                quality_score=quality_score,
                constraint_violations=violations,
                recommendations=recommendations
            )
            
        except Exception as e:
            raise OptimizationError(f"梯度优化失败: {e}") from e
    
    def optimize_global(self, popsize: int = 20, maxiter: int = 150) -> OptimizationResult:
        """全局优化（差分进化）- 基于经验改进版"""
        try:
            bounds = self._get_bounds_list()
            self.optimization_history = []
            
            def callback(x, convergence=None):
                self._callback(x)
            
            result = differential_evolution(
                self.objective.objective_function,
                bounds=bounds,
                popsize=popsize,
                maxiter=maxiter,
                callback=callback,
                disp=False,
                seed=42,
                mutation=(0.5, 1.0),
                recombination=0.7,
                polish=True
            )
            
            optimal_params = {
                'heating_rate': round(float(result.x[0]), 2),
                'target_temp': round(float(result.x[1]), 2),
                'holding_time': round(float(result.x[2]), 2),
                'cooling_rate': round(float(result.x[3]), 2)
            }
            
            quality_score = self._calculate_quality_score(result.x)
            is_valid, violations = self._validate_parameters(result.x)
            recommendations = self._generate_recommendations(optimal_params, quality_score)
            
            return OptimizationResult(
                optimal_params=optimal_params,
                fitness=round(float(result.fun), 6),
                history=self.optimization_history.copy(),
                convergence=result.success and is_valid,
                quality_score=quality_score,
                constraint_violations=violations,
                recommendations=recommendations
            )
            
        except Exception as e:
            raise OptimizationError(f"全局优化失败: {e}") from e
    
    def optimize_multi_strategy(self, use_global_first: bool = True) -> OptimizationResult:
        """多策略优化 - 全局搜索后局部精化"""
        try:
            if use_global_first:
                global_result = self.optimize_global(popsize=15, maxiter=80)
                
                initial_guess = [
                    global_result.optimal_params['heating_rate'],
                    global_result.optimal_params['target_temp'],
                    global_result.optimal_params['holding_time'],
                    global_result.optimal_params['cooling_rate']
                ]
                
                local_result = self.optimize_gradient_based(initial_guess)
                
                combined_history = global_result.history + local_result.history
                
                if local_result.fitness < global_result.fitness and local_result.convergence:
                    return OptimizationResult(
                        optimal_params=local_result.optimal_params,
                        fitness=local_result.fitness,
                        history=combined_history,
                        convergence=True,
                        quality_score=local_result.quality_score,
                        constraint_violations=local_result.constraint_violations,
                        recommendations=local_result.recommendations
                    )
                else:
                    return OptimizationResult(
                        optimal_params=global_result.optimal_params,
                        fitness=global_result.fitness,
                        history=combined_history,
                        convergence=global_result.convergence,
                        quality_score=global_result.quality_score,
                        constraint_violations=global_result.constraint_violations,
                        recommendations=global_result.recommendations
                    )
            else:
                return self.optimize_gradient_based()
                
        except Exception as e:
            warnings.warn(f"多策略优化失败，回退到全局优化: {e}")
            return self.optimize_global()
    
    def sensitivity_analysis(self, param_name: str, param_range: np.ndarray,
                            base_params: Optional[Dict[str, float]] = None) -> Tuple[np.ndarray, np.ndarray]:
        """敏感性分析"""
        try:
            if base_params is None:
                base_params = {
                    'heating_rate': self.experience['optimal_heating_rate'],
                    'target_temp': self.experience['optimal_target_temp'],
                    'holding_time': self.experience['optimal_holding_time'],
                    'cooling_rate': self.experience['optimal_cooling_rate']
                }
            
            objectives = []
            
            for value in param_range:
                params = base_params.copy()
                params[param_name] = value
                x = [params['heating_rate'], params['target_temp'],
                     params['holding_time'], params['cooling_rate']]
                objectives.append(self.objective.objective_function(x))
            
            return param_range, np.array(objectives)
            
        except Exception as e:
            raise OptimizationError(f"敏感性分析失败: {e}") from e
    
    def pareto_analysis(self, num_points: int = 60) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """帕累托前沿分析：能耗 vs 质量"""
        try:
            heating_rates = np.linspace(60, 200, num_points)
            energy_costs = []
            quality_costs = []
            
            for hr in heating_rates:
                x = [hr, self.experience['optimal_target_temp'], 
                     self.experience['optimal_holding_time'], 80.0]
                energy = self.objective.calculate_energy_consumption(*x)
                stress = self.objective.calculate_thermal_stress_risk(x[0], x[3], x[1])
                shrinkage = self.objective.calculate_shrinkage_quality(x[1], x[2], x[0])
                quality = stress + shrinkage
                
                energy_costs.append(energy)
                quality_costs.append(quality)
            
            return heating_rates, np.array(energy_costs), np.array(quality_costs)
            
        except Exception as e:
            raise OptimizationError(f"帕累托分析失败: {e}") from e


class ScheduleGenerator:
    """烧制曲线生成器"""
    
    def __init__(self):
        pass
    
    def generate_schedule(self, heating_rate: float, target_temp: float,
                         holding_time: float, cooling_rate: float,
                         time_step: float = 1.0) -> Tuple[np.ndarray, np.ndarray]:
        """生成烧制曲线"""
        try:
            initial_temp = 25.0
            
            heating_end_time = (target_temp - initial_temp) / max(heating_rate, 1e-6)
            holding_end_time = heating_end_time + holding_time
            cooling_end_time = holding_end_time + (target_temp - initial_temp) / max(cooling_rate, 1e-6)
            
            total_time = cooling_end_time
            time = np.arange(0, total_time + time_step, time_step)
            
            temperature = np.zeros_like(time)
            
            for i, t in enumerate(time):
                if t <= heating_end_time:
                    temperature[i] = initial_temp + heating_rate * t
                elif t <= holding_end_time:
                    temperature[i] = target_temp
                else:
                    cooling_t = t - holding_end_time
                    temperature[i] = max(initial_temp, target_temp - cooling_rate * cooling_t)
            
            return time, temperature
            
        except Exception as e:
            raise OptimizationError(f"烧制曲线生成失败: {e}") from e
    
    def generate_multi_stage_schedule(self, stages: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """生成多阶段烧制曲线"""
        try:
            time_points = [0.0]
            temp_points = [25.0]
            
            current_time = 0.0
            current_temp = 25.0
            
            for stage in stages:
                stage_type = stage.get('type', 'heating')
                
                if stage_type == 'heating':
                    rate = stage.get('rate', 100)
                    target = stage.get('target', 1000)
                    duration = (target - current_temp) / max(rate, 1e-6)
                    time_points.append(current_time + duration)
                    temp_points.append(target)
                    current_time += duration
                    current_temp = target
                
                elif stage_type == 'holding':
                    duration = stage.get('duration', 60)
                    time_points.append(current_time + duration)
                    temp_points.append(current_temp)
                    current_time += duration
                
                elif stage_type == 'cooling':
                    rate = stage.get('rate', 80)
                    target = stage.get('target', 25)
                    duration = (current_temp - target) / max(rate, 1e-6)
                    time_points.append(current_time + duration)
                    temp_points.append(target)
                    current_time += duration
                    current_temp = target
            
            from scipy.interpolate import interp1d
            time = np.linspace(0, current_time, 1000)
            interp = interp1d(time_points, temp_points, kind='linear')
            temperature = interp(time)
            
            return time, temperature
            
        except Exception as e:
            raise OptimizationError(f"多阶段曲线生成失败: {e}") from e


class QualityPredictor:
    """质量预测器"""
    
    def __init__(self):
        self.experience = ANCIENT_FIRING_EXPERIENCE
    
    def predict_quality_score(self, heating_rate: float, target_temp: float,
                          holding_time: float, cooling_rate: float) -> Dict[str, float]:
        """预测质量分数"""
        try:
            opt_temp = self.experience['optimal_target_temp']
            temp_score = max(0.0, 100 - abs(target_temp - opt_temp) / 5.0)
            
            rate_score = max(0.0, 100 - max(0, heating_rate - 150) - max(0, cooling_rate - 100))
            
            if holding_time < 60:
                time_score = 50 + (holding_time / 60) * 50
            elif holding_time > 180:
                time_score = 100 - ((holding_time - 180) / 60) * 30
            else:
                time_score = 100
            
            overall = temp_score * 0.4 + rate_score * 0.3 + time_score * 0.3
            
            return {
                'temperature_score': round(temp_score, 2),
                'rate_score': round(rate_score, 2),
                'time_score': round(time_score, 2),
                'overall_score': round(overall, 2)
            }
            
        except Exception as e:
            warnings.warn(f"质量预测异常: {e}")
            return {'overall_score': 50.0}
    
    def predict_defect_risk(self, heating_rate: float, cooling_rate: float) -> Dict[str, float]:
        """预测缺陷风险"""
        try:
            cracking_risk = min(100.0, 50 * ((heating_rate / 200.0) ** 2 + (cooling_rate / 150.0) ** 2))
            warping_risk = min(100.0, 50 * (heating_rate / 200.0) + 50 * (cooling_rate / 150.0))
            
            return {
                'cracking_risk_percent': round(cracking_risk, 2),
                'warping_risk_percent': round(warping_risk, 2),
                'total_risk_percent': round((cracking_risk + warping_risk) / 2.0, 2)
            }
            
        except Exception as e:
            warnings.warn(f"缺陷风险预测异常: {e}")
            return {'total_risk_percent': 50.0}
