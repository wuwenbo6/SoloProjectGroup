import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, asdict
from scipy.optimize import minimize, differential_evolution
from simulation import CeramicFiringSimulation, FiringConfig
from numerics import NumericalUtils, PhaseChangeCalculation


@dataclass
class OptimizationResult:
    best_params: Dict[str, float]
    best_score: float
    success: bool
    iterations: int
    history: List[Dict[str, float]]


@dataclass
class HistoricalFiringData:
    config: Dict
    results: Dict
    success_rate: float
    quality_score: float


class FiringObjective:
    @staticmethod
    def energy_objective(simulation_results: Dict[str, np.ndarray]) -> float:
        time = simulation_results['time']
        temp = simulation_results['temperature']
        dt = time[1] - time[0]
        energy = PhaseChangeCalculation.calculate_energy_consumption(temp, dt)
        return max(energy, 0.0)

    @staticmethod
    def shrinkage_uniformity_objective(simulation_results: Dict[str, np.ndarray]) -> float:
        shrinkage = simulation_results['shrinkage']
        shrinkage_rate = np.gradient(shrinkage)
        std = np.std(shrinkage_rate)
        return max(std, 1e-6)

    @staticmethod
    def time_objective(simulation_results: Dict[str, np.ndarray]) -> float:
        total_time = simulation_results['time'][-1]
        return max(total_time, 1.0)

    @staticmethod
    def temperature_stability_objective(simulation_results: Dict[str, np.ndarray]) -> float:
        temp = simulation_results['temperature']
        temp_rate = np.gradient(temp)
        holding_mask = (np.abs(temp_rate) < 0.5)
        holding_time = np.sum(holding_mask)
        if holding_time > 0:
            penalty = 1000.0 / (holding_time + 1.0)
        else:
            penalty = 10000.0
        return penalty

    @staticmethod
    def temperature_ramp_rate_objective(simulation_results: Dict[str, np.ndarray]) -> float:
        temp = simulation_results['temperature']
        time = simulation_results['time']
        rates = np.abs(np.gradient(temp, time)) * 60
        excessive_ramp = np.sum(rates[rates > 300])
        return excessive_ramp

    @staticmethod
    def final_shrinkage_objective(simulation_results: Dict[str, np.ndarray],
                                   target_shrinkage: float = 10.0) -> float:
        final_shrinkage = simulation_results['shrinkage'][-1]
        return abs(final_shrinkage - target_shrinkage)

    @staticmethod
    def combined_objective(simulation_results: Dict[str, np.ndarray],
                           weights: Optional[Dict[str, float]] = None,
                           target_shrinkage: float = 10.0) -> float:
        if weights is None:
            weights = {
                'energy': 0.15,
                'shrinkage_uniformity': 0.2,
                'time': 0.15,
                'stability': 0.25,
                'ramp_rate': 0.1,
                'final_shrinkage': 0.15
            }

        energy = FiringObjective.energy_objective(simulation_results)
        shrinkage_uniformity = FiringObjective.shrinkage_uniformity_objective(simulation_results)
        time_cost = FiringObjective.time_objective(simulation_results)
        stability = FiringObjective.temperature_stability_objective(simulation_results)
        ramp_rate_penalty = FiringObjective.temperature_ramp_rate_objective(simulation_results)
        shrinkage_error = FiringObjective.final_shrinkage_objective(simulation_results, target_shrinkage)

        energy_norm = np.clip(energy / 1000.0, 0, 10)
        shrinkage_uniformity_norm = np.clip(shrinkage_uniformity / 0.1, 0, 10)
        time_norm = np.clip(time_cost / 600.0, 0, 10)
        stability_norm = np.clip(stability / 100.0, 0, 10)
        ramp_rate_norm = np.clip(ramp_rate_penalty / 1000.0, 0, 10)
        shrinkage_error_norm = np.clip(shrinkage_error / 5.0, 0, 10)

        total = (
                weights['energy'] * energy_norm +
                weights['shrinkage_uniformity'] * shrinkage_uniformity_norm +
                weights['time'] * time_norm +
                weights['stability'] * stability_norm +
                weights['ramp_rate'] * ramp_rate_norm +
                weights['final_shrinkage'] * shrinkage_error_norm
        )

        return float(total)


class FiringOptimizer:
    def __init__(self, base_config: FiringConfig, target_shrinkage: float = 10.0,
                 custom_weights: Optional[Dict[str, float]] = None):
        self.base_config = base_config
        self.target_shrinkage = target_shrinkage
        self.custom_weights = custom_weights
        self.historical_data: List[HistoricalFiringData] = []
        self.objective_function = FiringObjective.combined_objective

    def params_to_config(self, params: np.ndarray, param_names: List[str]) -> FiringConfig:
        config_dict = asdict(self.base_config)
        for i, name in enumerate(param_names):
            if name == 'target_temp':
                config_dict[name] = max(500.0, min(1400.0, params[i]))
            elif name in ['heating_rate', 'cooling_rate']:
                config_dict[name] = max(10.0, min(500.0, params[i]))
            elif name == 'holding_time':
                config_dict[name] = max(0.0, min(480.0, params[i]))
            else:
                config_dict[name] = params[i]
        return FiringConfig(**config_dict)

    def evaluate_params(self, params: np.ndarray, param_names: List[str]) -> float:
        try:
            config = self.params_to_config(params, param_names)
            simulation = CeramicFiringSimulation(config)
            results = simulation.run_simulation()
            score = self.objective_function(results, self.custom_weights, self.target_shrinkage)
            return float(score)
        except Exception as e:
            return 1e10

    def optimize_local(self, initial_guess: Dict[str, float],
                       bounds: Optional[Dict[str, Tuple[float, float]]] = None,
                       method: str = 'L-BFGS-B',
                       max_iter: int = 100) -> OptimizationResult:
        param_names = list(initial_guess.keys())
        x0 = np.array([initial_guess[name] for name in param_names])

        if bounds is None:
            bounds = self.get_recommended_bounds()

        bounds_list = [bounds.get(name, (0, 1000)) for name in param_names]

        history = []
        best_score = [float('inf')]
        best_params = [x0.copy()]

        def callback(x):
            current_params = {param_names[i]: x[i] for i in range(len(param_names))}
            history.append(current_params)
            current_score = self.evaluate_params(x, param_names)
            if current_score < best_score[0]:
                best_score[0] = current_score
                best_params[0] = x.copy()

        result = minimize(
            fun=lambda x: self.evaluate_params(x, param_names),
            x0=x0,
            bounds=bounds_list,
            method=method,
            callback=callback,
            options={'maxiter': max_iter, 'disp': False, 'ftol': 1e-6}
        )

        if result.success and result.fun <= best_score[0]:
            final_params = {param_names[i]: result.x[i] for i in range(len(param_names))}
            final_score = result.fun
        else:
            final_params = {param_names[i]: best_params[0][i] for i in range(len(param_names))}
            final_score = best_score[0]

        return OptimizationResult(
            best_params=final_params,
            best_score=float(final_score),
            success=result.success or len(history) > 0,
            iterations=result.nit,
            history=history
        )

    @staticmethod
    def get_recommended_bounds() -> Dict[str, Tuple[float, float]]:
        return {
            'target_temp': (1100.0, 1350.0),
            'heating_rate': (50.0, 250.0),
            'holding_time': (30.0, 240.0),
            'cooling_rate': (50.0, 200.0)
        }

    def optimize_global(self, bounds: Optional[Dict[str, Tuple[float, float]]] = None,
                        max_iter: int = 50,
                        population_size: int = 15) -> OptimizationResult:
        if bounds is None:
            bounds = self.get_recommended_bounds()

        param_names = list(bounds.keys())
        bounds_list = [bounds[name] for name in param_names]

        history = []
        best_score = [float('inf')]
        best_params = [np.zeros(len(param_names))]

        def callback(x, convergence=None):
            current_params = {param_names[i]: x[i] for i in range(len(param_names))}
            history.append(current_params)
            current_score = self.evaluate_params(x, param_names)
            if current_score < best_score[0]:
                best_score[0] = current_score
                best_params[0] = x.copy()

        result = differential_evolution(
            func=lambda x: self.evaluate_params(x, param_names),
            bounds=bounds_list,
            maxiter=max_iter,
            popsize=population_size,
            callback=callback,
            disp=False,
            tol=1e-6,
            mutation=(0.5, 1),
            recombination=0.7
        )

        if result.success and result.fun <= best_score[0]:
            final_params = {param_names[i]: result.x[i] for i in range(len(param_names))}
            final_score = result.fun
        else:
            final_params = {param_names[i]: best_params[0][i] for i in range(len(param_names))}
            final_score = best_score[0]

        return OptimizationResult(
            best_params=final_params,
            best_score=float(final_score),
            success=result.success or len(history) > 0,
            iterations=result.nit,
            history=history
        )

    def add_historical_data(self, config: Dict, results: Dict,
                            success_rate: float, quality_score: float):
        self.historical_data.append(HistoricalFiringData(
            config=config,
            results=results,
            success_rate=success_rate,
            quality_score=quality_score
        ))

    def learn_from_history(self, param_names: List[str],
                           n_recommendations: int = 5) -> List[Dict[str, float]]:
        if not self.historical_data:
            return []

        sorted_data = sorted(self.historical_data,
                             key=lambda x: x.quality_score, reverse=True)
        top_data = sorted_data[:n_recommendations]

        recommendations = []
        for data in top_data:
            params = {name: data.config.get(name) for name in param_names
                      if data.config.get(name) is not None}
            recommendations.append(params)

        return recommendations

    def suggest_optimization_bounds(self, param_names: List[str]) -> Dict[str, Tuple[float, float]]:
        if not self.historical_data:
            default_bounds = {
                'heating_rate': (50.0, 300.0),
                'holding_time': (30.0, 240.0),
                'cooling_rate': (50.0, 200.0),
                'target_temp': (1100.0, 1350.0),
                'total_time': (300.0, 900.0)
            }
            return {name: default_bounds.get(name, (0, 100)) for name in param_names}

        configs = [d.config for d in self.historical_data]
        bounds = {}
        for name in param_names:
            values = [c.get(name) for c in configs if c.get(name) is not None]
            if values:
                v_min, v_max = min(values), max(values)
                margin = (v_max - v_min) * 0.2
                bounds[name] = (v_min - margin, v_max + margin)
            else:
                bounds[name] = (0, 100)

        return bounds


class ParameterTuner:
    def __init__(self, simulation_class):
        self.simulation_class = simulation_class
        self.tuning_history = []

    def sensitivity_analysis(self, base_config: FiringConfig,
                             param_name: str, param_range: np.ndarray,
                             output_key: str = 'shrinkage') -> Tuple[np.ndarray, np.ndarray]:
        results = []
        config_dict = asdict(base_config)

        for value in param_range:
            config_dict[param_name] = value
            config = FiringConfig(**config_dict)
            simulation = CeramicFiringSimulation(config)
            sim_results = simulation.run_simulation()
            results.append(np.mean(sim_results[output_key]))

        return param_range, np.array(results)

    def grid_search(self, base_config: FiringConfig,
                    param_grid: Dict[str, List[float]],
                    objective_func: Callable) -> Tuple[Dict, float]:
        param_names = list(param_grid.keys())
        best_score = float('inf')
        best_params = {}

        from itertools import product
        param_values_list = list(param_grid.values())

        for combo in product(*param_values_list):
            config_dict = asdict(base_config)
            current_params = {}
            for i, name in enumerate(param_names):
                config_dict[name] = combo[i]
                current_params[name] = combo[i]

            config = FiringConfig(**config_dict)
            simulation = CeramicFiringSimulation(config)
            results = simulation.run_simulation()
            score = objective_func(results)

            self.tuning_history.append({
                'params': current_params,
                'score': score
            })

            if score < best_score:
                best_score = score
                best_params = current_params.copy()

        return best_params, best_score

    def get_tuning_history_dataframe(self):
        if not self.tuning_history:
            return None
        try:
            import pandas as pd
            records = []
            for entry in self.tuning_history:
                row = entry['params'].copy()
                row['score'] = entry['score']
                records.append(row)
            return pd.DataFrame(records)
        except ImportError:
            return self.tuning_history
