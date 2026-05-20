__version__ = "2.0.0"
__author__ = "古法酿造仿真团队"
__description__ = "古法酿造发酵过程数值仿真系统"

from .numerical_computation import (
    FermentationKinetics,
    RiceWineKinetics,
    SoySauceKinetics,
    ODESolver,
    TemperatureProfile
)

from .fermentation_simulator import FermentationSimulator

from .data_acquisition import (
    ParameterInput,
    SensorDataCollector,
    DataValidator
)

from .visualization import FermentationVisualizer

from .parameter_optimization import (
    FermentationOptimizer,
    MultiParameterOptimizer,
    HistoryBasedOptimizer
)

from .data_storage import (
    JSONStorage,
    HDF5Storage,
    DataManager
)

from .multi_strain_simulation import (
    StrainProperties,
    StrainInteraction,
    MultiStrainDynamics,
    CoCultureOptimizer
)

from .anomaly_detection import (
    AnomalySeverity,
    AnomalyType,
    AnomalyEvent,
    ThresholdConfig,
    AnomalyDetector,
    RealTimeMonitor
)

from .data_comparison import (
    ComparisonMetrics,
    VariableComparison,
    SimulationDataComparator,
    ModelCalibrator,
    PerformanceTracker
)

from .high_performance_solver import (
    SolverMethod,
    PrecisionMode,
    CheckpointData,
    SolverStatistics,
    VectorizedODESolver,
    ParallelParameterSweep,
    OptimizedFermentationKinetics,
    MemoryEfficientStorage,
    CheckpointManager
)

from .high_performance_simulator import (
    SimulationMode,
    SimulationPerformanceMetrics,
    HighPerformanceSimulator,
    BatchOptimizationSimulator,
    BenchmarkSuite
)

from .historical_data_interface import (
    HistoricalBatchData,
    HistoricalDataInterface,
    SampleDataGenerator,
    APIClient
)

from .process_generation import (
    ProductType,
    FermentationStage,
    StageParameters,
    ProcessRecipe,
    RecipeGenerator,
    IntelligentOptimizer
)

from .multi_batch_analysis import (
    ComparisonMetric,
    BatchSummary,
    VariableComparisonResult,
    BatchGroupReport,
    BatchDataNormalizer,
    MultiBatchComparator,
    BatchBenchmarker,
    TrendAnalyzer,
    ReportGenerator
)

__all__ = [
    'FermentationKinetics',
    'RiceWineKinetics',
    'SoySauceKinetics',
    'ODESolver',
    'TemperatureProfile',
    'FermentationSimulator',
    'ParameterInput',
    'SensorDataCollector',
    'DataValidator',
    'FermentationVisualizer',
    'FermentationOptimizer',
    'MultiParameterOptimizer',
    'HistoryBasedOptimizer',
    'JSONStorage',
    'HDF5Storage',
    'DataManager',
    'StrainProperties',
    'StrainInteraction',
    'MultiStrainDynamics',
    'CoCultureOptimizer',
    'AnomalySeverity',
    'AnomalyType',
    'AnomalyEvent',
    'ThresholdConfig',
    'AnomalyDetector',
    'RealTimeMonitor',
    'ComparisonMetrics',
    'VariableComparison',
    'SimulationDataComparator',
    'ModelCalibrator',
    'PerformanceTracker',
    'SolverMethod',
    'PrecisionMode',
    'CheckpointData',
    'SolverStatistics',
    'VectorizedODESolver',
    'ParallelParameterSweep',
    'OptimizedFermentationKinetics',
    'MemoryEfficientStorage',
    'CheckpointManager',
    'SimulationMode',
    'SimulationPerformanceMetrics',
    'HighPerformanceSimulator',
    'BatchOptimizationSimulator',
    'BenchmarkSuite',
    'HistoricalBatchData',
    'HistoricalDataInterface',
    'SampleDataGenerator',
    'APIClient',
    'ProductType',
    'FermentationStage',
    'StageParameters',
    'ProcessRecipe',
    'RecipeGenerator',
    'IntelligentOptimizer',
    'ComparisonMetric',
    'BatchSummary',
    'VariableComparisonResult',
    'BatchGroupReport',
    'BatchDataNormalizer',
    'MultiBatchComparator',
    'BatchBenchmarker',
    'TrendAnalyzer',
    'ReportGenerator'
]
