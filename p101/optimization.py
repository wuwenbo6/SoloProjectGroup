import numpy as np
from scipy.optimize import minimize
from typing import Dict, List, Tuple, Optional, Callable

from simulation import PaperFiberSimulator, PaperSimulationConfig, PaperSimulationResult


class PapermakingConstraints:
    MIN_STRENGTH = 50.0
    MAX_STRENGTH = 150.0
    MIN_POROSITY = 0.2
    MAX_POROSITY = 0.8
    MIN_WATER_ABSORPTION = 0.3
    MAX_WATER_ABSORPTION = 0.9
    MIN_SOAK_TIME = 6.0
    MAX_SOAK_TIME = 48.0
    MIN_RATIO = 0.05
    MAX_RATIO = 0.8


class ParameterOptimizer:
    def __init__(self, simulator: PaperFiberSimulator):
        self.simulator = simulator
        self.optimization_history: List[Dict] = []

    def _objective_function(self, params: np.ndarray, 
                             material_names: List[str],
                             weights: Dict[str, float],
                             constraints: Dict[str, float]) -> float:
        n_materials = len(material_names)
        
        raw_ratios = params[:n_materials]
        raw_ratios = np.clip(raw_ratios, constraints['min_ratio'], constraints['max_ratio'])
        ratios = raw_ratios / np.sum(raw_ratios)
        
        soak_time = params[n_materials] if len(params) > n_materials else 24.0
        soak_time = np.clip(soak_time, constraints['min_soak_time'], constraints['max_soak_time'])
        
        config = PaperSimulationConfig()
        config.material_names = material_names
        config.ratios = ratios.tolist()
        config.soak_time = float(soak_time)
        
        try:
            result = self.simulator.run_simulation(config)
        except Exception as e:
            return 1e9
        
        metrics = result.quality_metrics
        
        penalty = 0.0
        if metrics['strength'] < constraints.get('min_strength', 0):
            penalty += (constraints['min_strength'] - metrics['strength']) * 10
        if metrics['porosity'] < constraints.get('min_porosity', 0):
            penalty += (constraints['min_porosity'] - metrics['porosity']) * 1000
        if metrics['porosity'] > constraints.get('max_porosity', 1):
            penalty += (metrics['porosity'] - constraints['max_porosity']) * 1000
        if metrics['water_absorption'] < constraints.get('min_water_absorption', 0):
            penalty += (constraints['min_water_absorption'] - metrics['water_absorption']) * 1000
        if metrics['water_absorption'] > constraints.get('max_water_absorption', 1):
            penalty += (metrics['water_absorption'] - constraints['max_water_absorption']) * 1000
        
        score = penalty
        if 'strength' in weights:
            score -= weights['strength'] * metrics['strength']
        if 'uniformity' in weights:
            score -= weights['uniformity'] * metrics['uniformity'] * 100
        if 'printability' in weights:
            score -= weights['printability'] * metrics['printability']
        if 'durability' in weights:
            score -= weights['durability'] * metrics['durability'] * 10
        if 'overall_score' in weights:
            score -= weights['overall_score'] * metrics['overall_score']
        
        self.optimization_history.append({
            'ratios': ratios.tolist(),
            'soak_time': float(soak_time),
            'score': float(-score + penalty),
            'penalty': float(penalty),
            'metrics': metrics
        })
        
        return float(score)

    def optimize_ratios(self, material_names: List[str], 
                        weights: Optional[Dict[str, float]] = None,
                        initial_ratios: Optional[List[float]] = None,
                        fixed_soak_time: Optional[float] = None,
                        constraints: Optional[Dict[str, float]] = None) -> Tuple[PaperSimulationResult, Dict]:
        if weights is None:
            weights = {
                'strength': 0.4,
                'uniformity': 0.3,
                'printability': 0.3
            }
        
        if constraints is None:
            constraints = {
                'min_strength': PapermakingConstraints.MIN_STRENGTH,
                'min_porosity': PapermakingConstraints.MIN_POROSITY,
                'max_porosity': PapermakingConstraints.MAX_POROSITY,
                'min_water_absorption': PapermakingConstraints.MIN_WATER_ABSORPTION,
                'max_water_absorption': PapermakingConstraints.MAX_WATER_ABSORPTION,
                'min_soak_time': PapermakingConstraints.MIN_SOAK_TIME,
                'max_soak_time': PapermakingConstraints.MAX_SOAK_TIME,
                'min_ratio': PapermakingConstraints.MIN_RATIO,
                'max_ratio': PapermakingConstraints.MAX_RATIO
            }
        
        n_materials = len(material_names)
        
        if initial_ratios is None:
            initial_ratios = [1.0 / n_materials] * n_materials
        else:
            initial_ratios = list(initial_ratios)
            initial_ratios = [r / sum(initial_ratios) for r in initial_ratios]
        
        if fixed_soak_time is not None:
            initial_params = np.array(initial_ratios)
        else:
            initial_params = np.array(initial_ratios + [24.0])
        
        bounds = [(constraints['min_ratio'], constraints['max_ratio']) for _ in range(n_materials)]
        if fixed_soak_time is None:
            bounds.append((constraints['min_soak_time'], constraints['max_soak_time']))
        
        constraint_list = []
        if fixed_soak_time is not None:
            constraint_list.append({
                'type': 'eq',
                'fun': lambda x: np.sum(x[:n_materials]) - 1.0
            })
        
        self.optimization_history = []
        
        result = minimize(
            self._objective_function,
            initial_params,
            args=(material_names, weights, constraints),
            method='SLSQP',
            bounds=bounds,
            constraints=constraint_list,
            options={'maxiter': 300, 'disp': False, 'ftol': 1e-8}
        )
        
        optimal_params = result.x
        optimal_ratios = optimal_params[:n_materials]
        optimal_ratios = optimal_ratios / np.sum(optimal_ratios)
        
        if fixed_soak_time is not None:
            optimal_soak_time = fixed_soak_time
        else:
            optimal_soak_time = optimal_params[n_materials] if len(optimal_params) > n_materials else 24.0
        
        optimal_config = PaperSimulationConfig()
        optimal_config.material_names = material_names
        optimal_config.ratios = optimal_ratios.tolist()
        optimal_config.soak_time = float(optimal_soak_time)
        optimal_config.simulation_id = "optimal_config"
        
        simulation_result = self.simulator.run_simulation(optimal_config)
        
        optimization_info = {
            'success': result.success,
            'message': result.message,
            'n_iterations': result.nit,
            'final_score': -result.fun,
            'constraints': constraints,
            'history': self.optimization_history
        }
        
        return simulation_result, optimization_info

    def grid_search_soak_time(self, material_names: List[str], ratios: List[float],
                               soak_time_range: Tuple[float, float] = (1, 72),
                               n_points: int = 50) -> Tuple[PaperSimulationResult, List[PaperSimulationResult]]:
        config = PaperSimulationConfig()
        config.material_names = material_names
        config.ratios = ratios
        
        soak_times = np.linspace(soak_time_range[0], soak_time_range[1], n_points)
        
        results = self.simulator.run_parameter_sweep(config, 'soak_time', soak_times)
        
        best_idx = np.argmax([r.quality_metrics['overall_score'] for r in results])
        
        return results[best_idx], results

    def multi_objective_optimize(self, material_names: List[str],
                                  objectives: List[Dict[str, float]],
                                  n_pareto_points: int = 20) -> List[PaperSimulationResult]:
        pareto_results = []
        
        for alpha in np.linspace(0, 1, n_pareto_points):
            weights = {}
            for i, obj in enumerate(objectives):
                w = alpha if i == 0 else (1 - alpha) / (len(objectives) - 1)
                for key, val in obj.items():
                    weights[key] = weights.get(key, 0) + w * val
            
            result, _ = self.optimize_ratios(material_names, weights=weights)
            pareto_results.append(result)
        
        return pareto_results

    def get_optimization_curve(self) -> Tuple[np.ndarray, np.ndarray]:
        if not self.optimization_history:
            return np.array([]), np.array([])
        
        iterations = np.arange(len(self.optimization_history))
        scores = np.array([h['score'] for h in self.optimization_history])
        
        return iterations, scores
