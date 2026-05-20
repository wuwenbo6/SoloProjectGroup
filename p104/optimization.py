import numpy as np
from typing import Dict, List, Callable, Optional, Tuple
from dataclasses import dataclass
from scipy.optimize import minimize, differential_evolution

from bamboo_data import BambooDataCollector
from tension_simulation import BambooWeaveSimulator, SimulationResult


@dataclass
class OptimizationConfig:
    target_tension: float = 100.0
    tension_weight: float = 1.0
    uniformity_weight: float = 2.0
    pattern_weight: float = 0.5
    feasibility_weight: float = 1.0
    max_tension_constraint: Optional[float] = 300.0
    min_tension_constraint: Optional[float] = 50.0
    max_warp_weft_ratio: float = 2.0
    min_warp_weft_ratio: float = 0.5
    bounds: Dict[str, Tuple[float, float]] = None


@dataclass
class OptimizationResult:
    optimal_params: Dict[str, float]
    optimal_tension: float
    tension_uniformity: float
    max_tension: float
    min_tension: float
    objective_value: float
    success: bool
    message: str
    optimization_history: List[float]


class TensionOptimizer:
    def __init__(self,
                 data_collector: BambooDataCollector,
                 simulator: BambooWeaveSimulator,
                 config: Optional[OptimizationConfig] = None):
        self.data_collector = data_collector
        self.simulator = simulator
        self.config = config or OptimizationConfig()
        self.optimization_history: List[float] = []
        self.param_history: List[Dict[str, float]] = []
        
        if self.config.bounds is None:
            self.config.bounds = {
                'base_tension': (50.0, 250.0),
                'warp_count': (10, 30),
                'weft_count': (10, 30),
                'friction_coefficient': (0.2, 0.6)
            }

    def _objective_function(self, params: np.ndarray, param_names: List[str]) -> float:
        param_dict = dict(zip(param_names, params))
        
        for key in ['warp_count', 'weft_count']:
            if key in param_dict:
                param_dict[key] = int(round(max(1, param_dict[key])))
        
        if 'warp_count' in param_dict and 'weft_count' in param_dict:
            ratio = param_dict['warp_count'] / param_dict['weft_count']
            if ratio > self.config.max_warp_weft_ratio:
                return 1e10
            if ratio < self.config.min_warp_weft_ratio:
                return 1e10
        
        self.simulator.set_config(**param_dict)
        
        result = self.simulator.simulate_static_tension()
        
        mean_tension = np.mean(result.total_tension)
        tension_std = np.std(result.total_tension)
        max_tension = np.max(result.total_tension)
        min_tension = np.min(result.total_tension)
        
        tension_error = (mean_tension - self.config.target_tension) ** 2
        uniformity_error = tension_std ** 2
        
        max_violation = 0.0
        if self.config.max_tension_constraint is not None:
            if max_tension > self.config.max_tension_constraint:
                max_violation = (max_tension - self.config.max_tension_constraint) ** 2
        
        min_violation = 0.0
        if self.config.min_tension_constraint is not None:
            if min_tension < self.config.min_tension_constraint:
                min_violation = (self.config.min_tension_constraint - min_tension) ** 2
        
        warp_weft_diff = abs(np.mean(result.warp_tension) - np.mean(result.weft_tension))
        balance_error = warp_weft_diff ** 2
        
        cv = tension_std / mean_tension if mean_tension > 0 else 1.0
        uniformity_penalty = max(0, cv - 0.1) ** 2
        
        objective = (
            self.config.tension_weight * tension_error +
            self.config.uniformity_weight * uniformity_error +
            10.0 * max_violation +
            10.0 * min_violation +
            self.config.pattern_weight * balance_error +
            5.0 * uniformity_penalty
        )
        
        self.optimization_history.append(objective)
        self.param_history.append(param_dict.copy())
        
        return float(objective)

    def optimize_gradient_based(self,
                                 initial_guess: Optional[Dict[str, float]] = None,
                                 method: str = 'L-BFGS-B',
                                 max_iter: int = 100) -> OptimizationResult:
        self.optimization_history = []
        self.param_history = []
        
        param_names = list(self.config.bounds.keys())
        bounds = [self.config.bounds[name] for name in param_names]
        
        if initial_guess is None:
            x0 = np.array([np.mean(b) for b in bounds])
        else:
            x0 = np.array([initial_guess[name] for name in param_names])
        
        result = minimize(
            self._objective_function,
            x0,
            args=(param_names,),
            method=method,
            bounds=bounds,
            options={'maxiter': max_iter, 'disp': True}
        )
        
        optimal_params = dict(zip(param_names, result.x))
        for key in ['warp_count', 'weft_count']:
            if key in optimal_params:
                optimal_params[key] = int(round(optimal_params[key]))
        
        self.simulator.set_config(**optimal_params)
        sim_result = self.simulator.simulate_static_tension()
        
        return OptimizationResult(
            optimal_params=optimal_params,
            optimal_tension=float(np.mean(sim_result.total_tension)),
            tension_uniformity=float(np.std(sim_result.total_tension)),
            max_tension=float(np.max(sim_result.total_tension)),
            min_tension=float(np.min(sim_result.total_tension)),
            objective_value=float(result.fun),
            success=bool(result.success),
            message=str(result.message),
            optimization_history=self.optimization_history.copy()
        )

    def optimize_global(self,
                         max_iter: int = 50,
                         popsize: int = 15) -> OptimizationResult:
        self.optimization_history = []
        self.param_history = []
        
        param_names = list(self.config.bounds.keys())
        bounds = [self.config.bounds[name] for name in param_names]
        
        result = differential_evolution(
            self._objective_function,
            bounds,
            args=(param_names,),
            maxiter=max_iter,
            popsize=popsize,
            disp=True,
            seed=42
        )
        
        optimal_params = dict(zip(param_names, result.x))
        for key in ['warp_count', 'weft_count']:
            if key in optimal_params:
                optimal_params[key] = int(round(optimal_params[key]))
        
        self.simulator.set_config(**optimal_params)
        sim_result = self.simulator.simulate_static_tension()
        
        return OptimizationResult(
            optimal_params=optimal_params,
            optimal_tension=float(np.mean(sim_result.total_tension)),
            tension_uniformity=float(np.std(sim_result.total_tension)),
            max_tension=float(np.max(sim_result.total_tension)),
            min_tension=float(np.min(sim_result.total_tension)),
            objective_value=float(result.fun),
            success=bool(result.success),
            message=str(result.message),
            optimization_history=self.optimization_history.copy()
        )

    def grid_search(self, num_points: int = 5) -> OptimizationResult:
        self.optimization_history = []
        self.param_history = []
        
        param_names = list(self.config.bounds.keys())
        param_grids = []
        
        for name in param_names:
            low, high = self.config.bounds[name]
            if name in ['warp_count', 'weft_count']:
                grid = np.linspace(low, high, num_points, dtype=int)
            else:
                grid = np.linspace(low, high, num_points)
            param_grids.append(grid)
        
        mesh = np.meshgrid(*param_grids)
        param_combinations = np.vstack([m.ravel() for m in mesh]).T
        
        best_objective = np.inf
        best_params = None
        
        for params in param_combinations:
            objective = self._objective_function(params, param_names)
            if objective < best_objective:
                best_objective = objective
                best_params = params.copy()
        
        optimal_params = dict(zip(param_names, best_params))
        for key in ['warp_count', 'weft_count']:
            if key in optimal_params:
                optimal_params[key] = int(round(optimal_params[key]))
        
        self.simulator.set_config(**optimal_params)
        sim_result = self.simulator.simulate_static_tension()
        
        return OptimizationResult(
            optimal_params=optimal_params,
            optimal_tension=float(np.mean(sim_result.total_tension)),
            tension_uniformity=float(np.std(sim_result.total_tension)),
            max_tension=float(np.max(sim_result.total_tension)),
            min_tension=float(np.min(sim_result.total_tension)),
            objective_value=float(best_objective),
            success=True,
            message="Grid search completed",
            optimization_history=self.optimization_history.copy()
        )

    def optimize_pattern(self,
                          patterns: List[str] = ['plain', 'twill', 'satin', 'lattice'],
                          target_tension: Optional[float] = None) -> Tuple[str, Dict[str, float]]:
        if target_tension is None:
            target_tension = self.config.target_tension
        
        results = {}
        
        for pattern in patterns:
            self.simulator.set_config(pattern=pattern)
            result = self.simulator.simulate_static_tension()
            
            mean_tension = np.mean(result.total_tension)
            tension_std = np.std(result.total_tension)
            
            score = (mean_tension - target_tension) ** 2 + tension_std ** 2
            results[pattern] = {
                'mean_tension': mean_tension,
                'tension_std': tension_std,
                'score': score,
                'result': result
            }
        
        best_pattern = min(results, key=lambda k: results[k]['score'])
        return best_pattern, results[best_pattern]

    def sensitivity_analysis(self,
                              base_params: Dict[str, float],
                              param_ranges: Dict[str, Tuple[float, float]],
                              num_samples: int = 10) -> Dict[str, Dict[str, float]]:
        sensitivity_results = {}
        
        for param_name, (low, high) in param_ranges.items():
            param_values = np.linspace(low, high, num_samples)
            tension_values = []
            uniformity_values = []
            
            for value in param_values:
                test_params = base_params.copy()
                test_params[param_name] = value
                
                self.simulator.set_config(**test_params)
                result = self.simulator.simulate_static_tension()
                
                tension_values.append(np.mean(result.total_tension))
                uniformity_values.append(np.std(result.total_tension))
            
            sensitivity_results[param_name] = {
                'param_values': param_values,
                'tension_values': np.array(tension_values),
                'uniformity_values': np.array(uniformity_values),
                'tension_sensitivity': np.gradient(tension_values, param_values),
                'uniformity_sensitivity': np.gradient(uniformity_values, param_values)
            }
        
        return sensitivity_results


class MultiObjectiveOptimizer:
    def __init__(self,
                 data_collector: BambooDataCollector,
                 simulator: BambooWeaveSimulator):
        self.data_collector = data_collector
        self.simulator = simulator
        self.pareto_front: List[Tuple[float, float, Dict[str, float]]] = []

    def _evaluate_solution(self, params: np.ndarray, param_names: List[str]) -> Tuple[float, float]:
        param_dict = dict(zip(param_names, params))
        for key in ['warp_count', 'weft_count']:
            if key in param_dict:
                param_dict[key] = int(round(param_dict[key]))
        
        self.simulator.set_config(**param_dict)
        result = self.simulator.simulate_static_tension()
        
        mean_tension = np.mean(result.total_tension)
        tension_std = np.std(result.total_tension)
        
        return mean_tension, tension_std

    def find_pareto_front(self,
                           param_names: List[str],
                           bounds: List[Tuple[float, float]],
                           num_samples: int = 100) -> List[Tuple[float, float, Dict[str, float]]]:
        self.pareto_front = []
        
        param_samples = []
        for b in bounds:
            param_samples.append(np.random.uniform(b[0], b[1], num_samples))
        
        for i in range(num_samples):
            params = [ps[i] for ps in param_samples]
            tension, uniformity = self._evaluate_solution(params, param_names)
            
            dominated = False
            to_remove = []
            
            for j, (t, u, _) in enumerate(self.pareto_front):
                if tension >= t and uniformity <= u:
                    dominated = True
                    break
                if tension <= t and uniformity >= u:
                    to_remove.append(j)
            
            for j in reversed(to_remove):
                del self.pareto_front[j]
            
            if not dominated:
                param_dict = dict(zip(param_names, params))
                for key in ['warp_count', 'weft_count']:
                    if key in param_dict:
                        param_dict[key] = int(round(param_dict[key]))
                self.pareto_front.append((tension, uniformity, param_dict))
        
        return self.pareto_front

    def select_solution(self,
                         tension_weight: float = 1.0,
                         uniformity_weight: float = 1.0) -> Tuple[float, float, Dict[str, float]]:
        if not self.pareto_front:
            raise ValueError("Pareto front is empty. Run find_pareto_front first.")
        
        best_score = np.inf
        best_solution = None
        
        for tension, uniformity, params in self.pareto_front:
            score = tension_weight * tension + uniformity_weight * uniformity
            if score < best_score:
                best_score = score
                best_solution = (tension, uniformity, params)
        
        return best_solution
