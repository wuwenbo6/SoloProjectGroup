try:
    from .computation import NumericalComputation
    from .optimized_solvers import SolverOptimizer, FastParameterSweep, PerformanceMetrics
except ImportError:
    from numerical_computation.computation import NumericalComputation
    from numerical_computation.optimized_solvers import (
        SolverOptimizer, FastParameterSweep, PerformanceMetrics
    )

__all__ = [
    "NumericalComputation",
    "SolverOptimizer",
    "FastParameterSweep",
    "PerformanceMetrics"
]
