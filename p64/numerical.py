"""
数值计算模块 - 坯体收缩率、热传导等计算
Numerical Calculation Module - Shrinkage Rate, Heat Transfer Calculation
"""

import numpy as np
from scipy.integrate import quad, odeint
from scipy.interpolate import interp1d
from dataclasses import dataclass
from typing import Tuple, Optional


@dataclass
class MaterialProperties:
    """陶瓷坯体材料参数"""
    alpha: float = 5e-6
    thermal_conductivity: float = 1.5
    specific_heat: float = 850.0
    density: float = 2400.0
    youngs_modulus: float = 70e9
    poisson_ratio: float = 0.22
    initial_porosity: float = 0.35


class ShrinkageCalculator:
    """坯体收缩率计算器"""
    
    def __init__(self, material_props: Optional[MaterialProperties] = None):
        self.props = material_props or MaterialProperties()
    
    def thermal_shrinkage(self, temperature: np.ndarray) -> np.ndarray:
        """计算热收缩"""
        T_ref = 25.0
        delta_T = temperature - T_ref
        shrinkage = -self.props.alpha * delta_T
        return shrinkage
    
    def sintering_shrinkage(self, temperature: np.ndarray, time: np.ndarray) -> np.ndarray:
        """计算烧结收缩率"""
        shrinkage = np.zeros_like(temperature)
        
        for i, (temp, t) in enumerate(zip(temperature, time)):
            if temp < 500:
                s = 0.0
            elif temp < 900:
                s = 0.02 * (temp - 500) / 400 * min(1.0, t / 60)
            elif temp < 1200:
                s = 0.02 + 0.08 * (temp - 900) / 300 * min(1.0, (t - 60) / 120)
            else:
                s = 0.10 + 0.05 * min(1.0, (t - 180) / 60)
            shrinkage[i] = -s
        
        return shrinkage
    
    def total_shrinkage(self, temperature: np.ndarray, time: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """计算总收缩率（径向和轴向）"""
        thermal = self.thermal_shrinkage(temperature)
        sintering = self.sintering_shrinkage(temperature, time)
        
        radial_shrinkage = thermal + sintering
        axial_shrinkage = 1.1 * radial_shrinkage
        
        return radial_shrinkage, axial_shrinkage
    
    def porosity_evolution(self, temperature: np.ndarray, time: np.ndarray) -> np.ndarray:
        """计算孔隙率演变"""
        porosity = np.ones_like(temperature) * self.props.initial_porosity
        
        for i, (temp, t) in enumerate(zip(temperature, time)):
            if temp > 800:
                sintering_factor = min(1.0, (temp - 800) / 500) * min(1.0, t / 180)
                porosity[i] = self.props.initial_porosity * (1 - 0.7 * sintering_factor)
            else:
                porosity[i] = self.props.initial_porosity
        
        return porosity
    
    def density_evolution(self, temperature: np.ndarray, time: np.ndarray) -> np.ndarray:
        """计算密度演变"""
        porosity = self.porosity_evolution(temperature, time)
        density = self.props.density * (1 - porosity)
        return density


class HeatTransfer:
    """热传导计算"""
    
    def __init__(self, material_props: Optional[MaterialProperties] = None):
        self.props = material_props or MaterialProperties()
    
    def thermal_diffusivity(self) -> float:
        """计算热扩散系数"""
        return self.props.thermal_conductivity / (self.props.density * self.props.specific_heat)
    
    def one_dimensional_transfer(self, surface_temp: np.ndarray, time: np.ndarray,
                                 thickness: float = 0.05, nx: int = 50) -> Tuple[np.ndarray, np.ndarray]:
        """一维热传导计算"""
        alpha = self.thermal_diffusivity()
        x = np.linspace(0, thickness, nx)
        dx = x[1] - x[0]
        dt = time[1] - time[0]
        
        temp_profile = np.ones((len(time), nx)) * 25.0
        temp_profile[:, 0] = surface_temp
        
        for n in range(1, len(time)):
            for i in range(1, nx - 1):
                temp_profile[n, i] = temp_profile[n-1, i] + alpha * dt / dx**2 * (
                    temp_profile[n-1, i+1] - 2 * temp_profile[n-1, i] + temp_profile[n-1, i-1]
                )
            temp_profile[n, -1] = temp_profile[n, -2]
        
        return x, temp_profile
    
    def heat_flux(self, temperature: np.ndarray, distance: float) -> np.ndarray:
        """计算热通量"""
        dT_dx = np.gradient(temperature, distance)
        flux = -self.props.thermal_conductivity * dT_dx
        return flux


class StressCalculator:
    """应力计算器"""
    
    def __init__(self, material_props: Optional[MaterialProperties] = None):
        self.props = material_props or MaterialProperties()
    
    def thermal_stress(self, temperature: np.ndarray, time: np.ndarray,
                       constraint: float = 1.0) -> np.ndarray:
        """计算热应力"""
        dT_dt = np.gradient(temperature, time)
        E = self.props.youngs_modulus
        alpha = self.props.alpha
        nu = self.props.poisson_ratio
        
        stress = E * alpha * dT_dt * constraint / (1 - nu)
        return stress
    
    def sintering_stress(self, shrinkage: np.ndarray, time: np.ndarray) -> np.ndarray:
        """计算烧结应力"""
        dS_dt = np.gradient(shrinkage, time)
        E = self.props.youngs_modulus
        nu = self.props.poisson_ratio
        
        stress = E * dS_dt / (1 - nu)
        return stress
    
    def total_stress(self, temperature: np.ndarray, shrinkage: np.ndarray,
                     time: np.ndarray) -> np.ndarray:
        """计算总应力"""
        thermal = self.thermal_stress(temperature, time)
        sintering = self.sintering_stress(shrinkage, time)
        return thermal + sintering


class PhaseTransformation:
    """相变计算"""
    
    def __init__(self):
        pass
    
    def quartz_transformation(self, temperature: np.ndarray) -> np.ndarray:
        """石英相变计算"""
        transformation = np.zeros_like(temperature)
        
        for i, temp in enumerate(temperature):
            if 550 < temp < 580:
                transformation[i] = np.exp(-((temp - 565) / 10) ** 2)
            elif 565 <= temp < 575:
                transformation[i] = 1.0
        
        return transformation
    
    def mullite_formation(self, temperature: np.ndarray, time: np.ndarray) -> np.ndarray:
        """莫来石形成计算"""
        mullite = np.zeros_like(temperature)
        
        for i, (temp, t) in enumerate(zip(temperature, time)):
            if temp > 1000:
                activation = min(1.0, (temp - 1000) / 300)
                time_factor = min(1.0, t / 120)
                mullite[i] = 0.3 * activation * time_factor
        
        return mullite
    
    def glass_phase_formation(self, temperature: np.ndarray) -> np.ndarray:
        """玻璃相形成计算"""
        glass = np.zeros_like(temperature)
        
        for i, temp in enumerate(temperature):
            if temp > 1100:
                glass[i] = min(0.4, 0.4 * (temp - 1100) / 200)
        
        return glass
