"""
古法陶瓷烧制数值模拟系统
Ancient Ceramic Firing Numerical Simulation System
"""

__version__ = "2.0.0"
__author__ = "Ceramic Simulation Team"

# 核心模块
from .simulation import KilnSimulation, FiringParameters, SimulationResult
from .numerical import ShrinkageCalculator, HeatTransfer
from .data_acquisition import SensorDataImporter
from .visualization import FiringVisualizer
from .optimization import ParameterOptimizer

# 扩展功能模块
from .kiln_extensions import (
    MultiKilnCoSimulation,
    KilnWarningSystem,
    SimulationComparison,
    FastNumericalCalculator,
    KilnConfig,
    WarningLevel,
    WarningType,
    WarningRecord,
    create_multi_kiln_demo_configs
)

__all__ = [
    # 核心模块
    'KilnSimulation',
    'FiringParameters',
    'SimulationResult',
    'ShrinkageCalculator',
    'HeatTransfer',
    'SensorDataImporter',
    'FiringVisualizer',
    'ParameterOptimizer',
    # 扩展功能
    'MultiKilnCoSimulation',
    'KilnWarningSystem',
    'SimulationComparison',
    'FastNumericalCalculator',
    'KilnConfig',
    'WarningLevel',
    'WarningType',
    'WarningRecord',
    'create_multi_kiln_demo_configs'
]
