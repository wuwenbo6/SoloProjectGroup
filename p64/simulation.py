"""
核心仿真模块 - 窑温、湿度、气氛计算
Core Simulation Module - Kiln Temperature, Humidity, Atmosphere Calculation
"""

import numpy as np
import warnings
from dataclasses import dataclass
from typing import Tuple, Optional


class SimulationError(Exception):
    """仿真异常类"""
    pass


@dataclass
class FiringParameters:
    """烧制参数配置 - 基于古法烧制经验"""
    initial_temp: float = 25.0
    target_temp: float = 1300.0
    heating_rate: float = 150.0
    holding_time: float = 120.0
    cooling_rate: float = 100.0
    initial_humidity: float = 60.0
    ambient_temp: float = 25.0
    total_time: float = 600.0
    
    # 古法烧制参数边界
    MIN_TEMP: float = 20.0
    MAX_TEMP: float = 1450.0
    MIN_HEATING_RATE: float = 10.0
    MAX_HEATING_RATE: float = 300.0
    MIN_COOLING_RATE: float = 10.0
    MAX_COOLING_RATE: float = 250.0
    MIN_HUMIDITY: float = 0.1
    MAX_HUMIDITY: float = 100.0


@dataclass
class SimulationResult:
    """仿真结果数据结构"""
    time: np.ndarray
    temperature: np.ndarray
    humidity: np.ndarray
    oxygen: np.ndarray
    co2: np.ndarray
    reduction_atmosphere: np.ndarray
    
    def __post_init__(self):
        """初始化后数据校验"""
        if np.any(np.isnan(self.temperature)):
            warnings.warn("仿真结果包含 NaN 值")
        if np.any(np.isinf(self.temperature)):
            warnings.warn("仿真结果包含无穷大值")


class KilnSimulation:
    """窑炉烧制过程仿真 - 基于古法陶瓷烧制经验"""
    
    def __init__(self, params: Optional[FiringParameters] = None):
        self.params = params or FiringParameters()
        self.result = None
        self._validate_parameters()
    
    def _validate_parameters(self):
        """参数校验 - 防止非法参数导致溢出"""
        p = self.params
        
        # 温度边界检查
        if not (p.MIN_TEMP <= p.initial_temp <= p.MAX_TEMP):
            raise SimulationError(
                f"初始温度 {p.initial_temp}°C 超出边界 [{p.MIN_TEMP}, {p.MAX_TEMP}]"
            )
        if not (p.MIN_TEMP <= p.target_temp <= p.MAX_TEMP):
            raise SimulationError(
                f"目标温度 {p.target_temp}°C 超出边界 [{p.MIN_TEMP}, {p.MAX_TEMP}]"
            )
        if p.target_temp <= p.initial_temp:
            raise SimulationError("目标温度必须高于初始温度")
        
        # 速率边界检查
        if not (p.MIN_HEATING_RATE <= p.heating_rate <= p.MAX_HEATING_RATE):
            raise SimulationError(
                f"升温速率 {p.heating_rate}°C/min 超出边界"
            )
        if not (p.MIN_COOLING_RATE <= p.cooling_rate <= p.MAX_COOLING_RATE):
            raise SimulationError(
                f"降温速率 {p.cooling_rate}°C/min 超出边界"
            )
        
        # 湿度检查
        if not (p.MIN_HUMIDITY <= p.initial_humidity <= p.MAX_HUMIDITY):
            raise SimulationError(
                f"初始湿度 {p.initial_humidity}% 超出边界"
            )
        
        # 时间检查
        if p.total_time <= 0:
            raise SimulationError("总时间必须为正数")
        if p.holding_time < 0:
            raise SimulationError("保温时间不能为负数")
    
    def _safe_divide(self, a: float, b: float, default: float = 0.0) -> float:
        """安全除法 - 防止除零溢出"""
        try:
            if abs(b) < 1e-10:
                warnings.warn("除数接近零，返回默认值")
                return default
            result = a / b
            if np.isnan(result) or np.isinf(result):
                warnings.warn("计算结果为 NaN 或无穷大，返回默认值")
                return default
            return result
        except Exception as e:
            warnings.warn(f"除法运算异常: {e}")
            return default
    
    def temperature_curve(self, t: float) -> float:
        """计算时刻t的温度曲线 - 带溢出保护"""
        try:
            p = self.params
            
            # 时间边界检查
            t = max(0.0, min(t, p.total_time))
            
            heating_end_time = self._safe_divide(
                p.target_temp - p.initial_temp,
                p.heating_rate,
                default=1.0
            )
            holding_end_time = heating_end_time + p.holding_time
            
            if t <= heating_end_time:
                temp = p.initial_temp + p.heating_rate * t
            elif t <= holding_end_time:
                temp = p.target_temp
            else:
                cooling_time = t - holding_end_time
                temp = p.target_temp - p.cooling_rate * cooling_time
                temp = max(temp, p.ambient_temp)
            
            # 温度边界保护
            temp = max(p.MIN_TEMP, min(temp, p.MAX_TEMP))
            return temp
            
        except Exception as e:
            warnings.warn(f"温度计算异常: {e}，返回环境温度")
            return self.params.ambient_temp
    
    def humidity_model(self, t: float, temp: float) -> float:
        """湿度模型 - 随温度和时间变化"""
        try:
            p = self.params
            
            # 输入边界检查
            t = max(0.0, t)
            temp = max(p.MIN_TEMP, min(temp, p.MAX_TEMP))
            
            heating_end_time = self._safe_divide(
                p.target_temp - p.initial_temp,
                p.heating_rate,
                default=1.0
            )
            
            if t < heating_end_time * 0.3:
                # 指数函数溢出保护
                exp_arg = -0.02 * t
                exp_arg = max(-100.0, min(exp_arg, 0.0))  # 防止指数溢出
                drying_factor = np.exp(exp_arg)
            else:
                drying_factor = 0.01
            
            humidity = p.initial_humidity * drying_factor
            humidity = max(p.MIN_HUMIDITY, min(humidity, p.MAX_HUMIDITY))
            
            return humidity
            
        except Exception as e:
            warnings.warn(f"湿度计算异常: {e}")
            return 0.5
    
    def atmosphere_model(self, t: float, temp: float) -> Tuple[float, float, float]:
        """气氛模型 - 氧气、二氧化碳、还原气氛"""
        try:
            p = self.params
            
            # 输入边界检查
            t = max(0.0, t)
            temp = max(p.MIN_TEMP, min(temp, p.MAX_TEMP))
            
            heating_end_time = self._safe_divide(
                p.target_temp - p.initial_temp,
                p.heating_rate,
                default=1.0
            )
            holding_end_time = heating_end_time + p.holding_time
            
            oxygen = 20.9
            co2 = 0.03
            reduction = 0.0
            
            if temp < 300:
                pass  # 使用默认值
            elif temp < 900:
                oxygen = 20.9 * (1 - 0.5 * self._safe_divide(temp - 300, 600, 0.0))
                co2 = 0.03 + 2.0 * self._safe_divide(temp - 300, 600, 0.0)
                reduction = 0.1 * self._safe_divide(temp - 300, 600, 0.0)
            elif t <= holding_end_time:
                oxygen = 8.0
                co2 = 3.0
                sin_arg = 0.1 * (t - heating_end_time)
                sin_arg = max(-10.0, min(sin_arg, 10.0))
                reduction = 0.5 + 0.3 * np.sin(sin_arg)
            else:
                cooling_duration = min(60.0, max(0.0, t - holding_end_time))
                oxygen = 8.0 + 12.9 * self._safe_divide(cooling_duration, 60.0, 1.0)
                co2 = 3.0 - 2.97 * self._safe_divide(cooling_duration, 60.0, 1.0)
                reduction = max(0.0, 0.5 - 0.5 * min(1.0, self._safe_divide(cooling_duration, 30.0, 1.0)))
            
            # 边界保护
            oxygen = max(0.0, min(21.0, oxygen))
            co2 = max(0.0, min(5.0, co2))
            reduction = max(0.0, min(1.0, reduction))
            
            return oxygen, co2, reduction
            
        except Exception as e:
            warnings.warn(f"气氛计算异常: {e}，返回默认值")
            return 20.9, 0.03, 0.0
    
    def run(self, time_steps: int = 1000) -> SimulationResult:
        """运行仿真 - 完整异常处理"""
        try:
            if time_steps < 10:
                raise SimulationError("时间步数太少，至少需要10步")
            if time_steps > 100000:
                warnings.warn("时间步数过多，可能导致性能问题")
            
            p = self.params
            time = np.linspace(0, p.total_time, time_steps)
            
            # 向量化计算，提高效率和稳定性
            temperature = np.vectorize(self.temperature_curve)(time)
            humidity = np.array([
                self.humidity_model(t, temp) for t, temp in zip(time, temperature)
            ])
            
            oxygen = []
            co2 = []
            reduction = []
            
            for t, temp in zip(time, temperature):
                o2, co, r = self.atmosphere_model(t, temp)
                oxygen.append(o2)
                co2.append(co)
                reduction.append(r)
            
            # 转换为numpy数组并进行最终校验
            oxygen_arr = np.array(oxygen, dtype=np.float64)
            co2_arr = np.array(co2, dtype=np.float64)
            reduction_arr = np.array(reduction, dtype=np.float64)
            
            # NaN 和 Inf 处理
            temperature = np.nan_to_num(temperature, nan=p.ambient_temp, posinf=p.MAX_TEMP, neginf=p.MIN_TEMP)
            humidity = np.nan_to_num(humidity, nan=0.5, posinf=100.0, neginf=0.1)
            oxygen_arr = np.nan_to_num(oxygen_arr, nan=20.9, posinf=21.0, neginf=0.0)
            co2_arr = np.nan_to_num(co2_arr, nan=0.03, posinf=5.0, neginf=0.0)
            reduction_arr = np.nan_to_num(reduction_arr, nan=0.0, posinf=1.0, neginf=0.0)
            
            self.result = SimulationResult(
                time=time,
                temperature=temperature,
                humidity=humidity,
                oxygen=oxygen_arr,
                co2=co2_arr,
                reduction_atmosphere=reduction_arr
            )
            
            return self.result
            
        except Exception as e:
            raise SimulationError(f"仿真运行失败: {str(e)}") from e
    
    def get_thermal_stress(self) -> np.ndarray:
        """计算热应力 - 带溢出保护"""
        if self.result is None:
            raise ValueError("Simulation not run yet")
        
        try:
            temp = self.result.temperature
            time = self.result.time
            
            # 梯度计算保护
            if len(time) < 2:
                warnings.warn("数据点不足，无法计算梯度")
                return np.zeros_like(temp)
            
            dt = np.gradient(temp, time)
            
            # 材料参数
            alpha = 5e-6
            E = 70e9
            nu = 0.22
            
            # 应力计算保护
            denominator = 1 - nu
            if abs(denominator) < 1e-10:
                warnings.warn("分母接近零，应力计算可能不稳定")
                denominator = 1e-10
            
            stress = E * alpha * dt / denominator
            
            # 溢出保护
            stress = np.nan_to_num(stress, nan=0.0, posinf=1e9, neginf=-1e9)
            
            return stress
            
        except Exception as e:
            warnings.warn(f"热应力计算异常: {e}")
            return np.zeros_like(self.result.temperature)
