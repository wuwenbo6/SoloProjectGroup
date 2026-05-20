"""
传统泥塑工艺受力数值模拟系统
================================

模块说明:
- data_acquisition: 泥料参数采集与管理
- numerical_computation: 数值计算核心（含优化求解器）
- force_simulation: 受力模拟（含多泥料协同、异常检测）
- visualization: 结果可视化
- optimization: 参数优化
- data_storage: 数据存储与管理
- validation: 仿真与实测对比验证

作者: Clay Simulation Team
版本: 2.0.0
"""

__version__ = "2.0.0"
__author__ = "Clay Simulation Team"

try:
    from .data_acquisition import ParameterCollector, ClayParameter
    from .numerical_computation import NumericalComputation, SolverOptimizer, FastParameterSweep
    from .force_simulation import (
        ForceSimulator, SimulationConfig, SimulationResult,
        MultiClaySimulator, ClayRegion, ContactCondition, MultiClaySimulationResult,
        AnomalyDetector, Anomaly, AnomalySeverity, AnomalyType, DetectionThresholds
    )
    from .visualization import ResultVisualizer
    from .optimization import ParameterOptimizer, OptimizationConstraints, OptimizationResult
    from .data_storage import DataStorage
    from .validation import TestDataComparator, TestMeasurement, ComparisonResult, generate_sample_test_data
except ImportError:
    from data_acquisition import ParameterCollector, ClayParameter
    from numerical_computation import NumericalComputation, SolverOptimizer, FastParameterSweep
    from force_simulation import (
        ForceSimulator, SimulationConfig, SimulationResult,
        MultiClaySimulator, ClayRegion, ContactCondition, MultiClaySimulationResult,
        AnomalyDetector, Anomaly, AnomalySeverity, AnomalyType, DetectionThresholds
    )
    from visualization import ResultVisualizer
    from optimization import ParameterOptimizer, OptimizationConstraints, OptimizationResult
    from data_storage import DataStorage
    from validation import TestDataComparator, TestMeasurement, ComparisonResult, generate_sample_test_data

__all__ = [
    # 泥料参数采集
    "ParameterCollector",
    "ClayParameter",

    # 数值计算
    "NumericalComputation",
    "SolverOptimizer",
    "FastParameterSweep",

    # 受力模拟
    "ForceSimulator",
    "SimulationConfig",
    "SimulationResult",

    # 多泥料协同模拟
    "MultiClaySimulator",
    "ClayRegion",
    "ContactCondition",
    "MultiClaySimulationResult",

    # 异常检测
    "AnomalyDetector",
    "Anomaly",
    "AnomalySeverity",
    "AnomalyType",
    "DetectionThresholds",

    # 可视化
    "ResultVisualizer",

    # 参数优化
    "ParameterOptimizer",
    "OptimizationConstraints",
    "OptimizationResult",

    # 数据存储
    "DataStorage",

    # 验证对比
    "TestDataComparator",
    "TestMeasurement",
    "ComparisonResult",
    "generate_sample_test_data",
]
