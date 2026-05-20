import numpy as np
from scipy.optimize import minimize, differential_evolution, basinhopping
from typing import Dict, List, Tuple, Callable, Optional
from dataclasses import dataclass


@dataclass
class OptimizationResult:
    best_params: Dict[str, float]
    best_fitness: float
    history: List[float]
    method: str
    success: bool
    message: str


class ParameterOptimization:
    def __init__(self):
        self.bounds: Dict[str, Tuple[float, float]] = {}
        self.target_tension: Optional[float] = None
        self.constraints: List[Dict] = []
    
    def set_bounds(self, param_name: str, lower: float, upper: float) -> None:
        self.bounds[param_name] = (lower, upper)
    
    def set_bounds_from_dict(self, bounds_dict: Dict[str, Tuple[float, float]]) -> None:
        self.bounds.update(bounds_dict)
    
    def set_target_tension(self, target: float) -> None:
        self.target_tension = target
    
    def add_constraint(self, constraint_type: str, constraint_func: Callable) -> None:
        self.constraints.append({
            'type': constraint_type,
            'fun': constraint_func
        })
    
    def _objective_factory(self, simulation_func: Callable, 
                           objective_type: str = 'mse',
                           thread_type: str = 'silk_120D') -> Callable:
        param_names = list(self.bounds.keys())
        
        thread_breaking_tensions = {
            'silk_120D': 5.0,
            'silk_240D': 8.0,
            'cotton_30s': 3.5
        }
        breaking_tension = thread_breaking_tensions.get(thread_type, 5.0)
        
        safety_factor_min = 1.5
        cv_target_max = 0.15
        
        def objective(x: np.ndarray) -> float:
            params = dict(zip(param_names, x))
            
            try:
                time, tension = simulation_func(**params)
            except Exception:
                return 1e10
            
            mean_t = np.mean(tension)
            max_t = np.max(tension)
            min_t = np.min(tension)
            cv = np.std(tension) / mean_t if mean_t > 0 else 1.0
            
            penalty = 0.0
            
            if max_t <= 0 or min_t <= 0:
                penalty += 1e9
            
            current_safety = breaking_tension / max_t if max_t > 0 else 0
            if current_safety < safety_factor_min:
                penalty += 1e6 * (safety_factor_min - current_safety)
            
            if cv > cv_target_max:
                penalty += 1e4 * (cv - cv_target_max)
            
            if self.target_tension is not None:
                tension_deviation = abs(mean_t - self.target_tension)
                if tension_deviation > 0.5 * self.target_tension:
                    penalty += 1e3 * tension_deviation
            
            if objective_type == 'mse':
                if self.target_tension is None:
                    self.target_tension = 1.0
                mse = np.mean((tension - self.target_tension) ** 2)
                return float(mse + penalty)
            
            elif objective_type == 'cv_minimize':
                return float(cv + penalty)
            
            elif objective_type == 'target_range':
                target_penalty = 0.0
                if self.target_tension is not None:
                    target_penalty = abs(mean_t - self.target_tension)
                return float(0.5 * cv + 0.3 * target_penalty + 0.2 * (max_t - min_t) + penalty)
            
            elif objective_type == 'production':
                efficiency_penalty = 0.0
                if 'stitch_speed' in params:
                    speed = params['stitch_speed']
                    if speed < 5:
                        efficiency_penalty += 100 * (5 - speed)
                    elif speed > 20:
                        efficiency_penalty += 50 * (speed - 20)
                return float(cv * 100 + efficiency_penalty + penalty)
            
            else:
                raise ValueError(f"Unknown objective type: {objective_type}")
        
        return objective
    
    def optimize_grid_search(self, simulation_func: Callable,
                              points_per_param: int = 10,
                              objective_type: str = 'mse',
                              thread_type: str = 'silk_120D') -> OptimizationResult:
        param_names = list(self.bounds.keys())
        param_grids = [np.linspace(self.bounds[name][0], self.bounds[name][1], points_per_param)
                       for name in param_names]
        
        mesh = np.meshgrid(*param_grids)
        param_combinations = np.vstack([m.ravel() for m in mesh]).T
        
        objective = self._objective_factory(simulation_func, objective_type, thread_type)
        
        best_fitness = float('inf')
        best_params = None
        history = []
        
        for params in param_combinations:
            fitness = objective(params)
            history.append(fitness)
            
            if fitness < best_fitness:
                best_fitness = fitness
                best_params = params
        
        result = OptimizationResult(
            best_params=dict(zip(param_names, best_params)),
            best_fitness=best_fitness,
            history=history,
            method='grid_search',
            success=best_fitness < 1e6,
            message='Grid search completed successfully' if best_fitness < 1e6 else 'No feasible solution found'
        )
        
        return result
    
    def optimize_gradient_based(self, simulation_func: Callable,
                                 initial_guess: Optional[Dict[str, float]] = None,
                                 method: str = 'L-BFGS-B',
                                 objective_type: str = 'mse',
                                 max_iter: int = 100,
                                 thread_type: str = 'silk_120D') -> OptimizationResult:
        param_names = list(self.bounds.keys())
        bounds_list = [self.bounds[name] for name in param_names]
        
        if initial_guess is None:
            recommended = self.get_recommended_params()
            x0 = np.array([recommended.get(name, (self.bounds[name][0] + self.bounds[name][1]) / 2)
                          for name in param_names])
        else:
            x0 = np.array([initial_guess[name] for name in param_names])
        
        objective = self._objective_factory(simulation_func, objective_type, thread_type)
        history = []
        
        def callback(x):
            history.append(objective(x))
        
        result = minimize(
            objective, x0, method=method, bounds=bounds_list,
            callback=callback, options={'maxiter': max_iter}
        )
        
        opt_result = OptimizationResult(
            best_params=dict(zip(param_names, result.x)),
            best_fitness=float(result.fun),
            history=history,
            method=method,
            success=bool(result.success) and result.fun < 1e6,
            message=result.message
        )
        
        return opt_result
    
    def optimize_differential_evolution(self, simulation_func: Callable,
                                         objective_type: str = 'mse',
                                         population_size: int = 15,
                                         max_iter: int = 100,
                                         thread_type: str = 'silk_120D') -> OptimizationResult:
        param_names = list(self.bounds.keys())
        bounds_list = [self.bounds[name] for name in param_names]
        
        objective = self._objective_factory(simulation_func, objective_type, thread_type)
        history = []
        
        def callback(x, convergence):
            history.append(objective(x))
        
        result = differential_evolution(
            objective, bounds_list, popsize=population_size,
            maxiter=max_iter, callback=callback,
            disp=False, seed=42, polish=True
        )
        
        opt_result = OptimizationResult(
            best_params=dict(zip(param_names, result.x)),
            best_fitness=float(result.fun),
            history=history,
            method='differential_evolution',
            success=bool(result.success) and result.fun < 1e6,
            message=result.message
        )
        
        return opt_result
    
    def optimize_basinhopping(self, simulation_func: Callable,
                               initial_guess: Optional[Dict[str, float]] = None,
                               objective_type: str = 'mse',
                               n_iter: int = 100,
                               thread_type: str = 'silk_120D') -> OptimizationResult:
        param_names = list(self.bounds.keys())
        bounds_list = [self.bounds[name] for name in param_names]
        
        if initial_guess is None:
            recommended = self.get_recommended_params()
            x0 = np.array([recommended.get(name, (self.bounds[name][0] + self.bounds[name][1]) / 2)
                          for name in param_names])
        else:
            x0 = np.array([initial_guess[name] for name in param_names])
        
        objective = self._objective_factory(simulation_func, objective_type, thread_type)
        history = []
        
        def callback(x, f, accepted):
            history.append(f)
        
        minimizer_kwargs = {"method": "L-BFGS-B", "bounds": bounds_list}
        
        result = basinhopping(
            objective, x0, niter=n_iter,
            minimizer_kwargs=minimizer_kwargs,
            callback=callback, seed=42
        )
        
        opt_result = OptimizationResult(
            best_params=dict(zip(param_names, result.x)),
            best_fitness=float(result.fun),
            history=history,
            method='basinhopping',
            success=result.fun < 1e6,
            message='Basinhopping completed'
        )
        
        return opt_result
    
    def optimize_random_search(self, simulation_func: Callable,
                                objective_type: str = 'mse',
                                n_samples: int = 1000,
                                thread_type: str = 'silk_120D') -> OptimizationResult:
        param_names = list(self.bounds.keys())
        objective = self._objective_factory(simulation_func, objective_type, thread_type)
        
        best_fitness = float('inf')
        best_params = None
        history = []
        
        rng = np.random.default_rng(42)
        
        for _ in range(n_samples):
            params = np.array([
                rng.uniform(self.bounds[name][0], self.bounds[name][1])
                for name in param_names
            ])
            
            fitness = objective(params)
            history.append(fitness)
            
            if fitness < best_fitness:
                best_fitness = fitness
                best_params = params
        
        result = OptimizationResult(
            best_params=dict(zip(param_names, best_params)),
            best_fitness=best_fitness,
            history=history,
            method='random_search',
            success=best_fitness < 1e6,
            message='Random search completed successfully'
        )
        
        return result
    
    def get_recommended_params(self, stitch_type: str = 'fill') -> Dict[str, float]:
        recommendations = {
            'satin': {
                'base_tension': 2.0,
                'stitch_speed': 10.0,
                'fabric_stiffness': 1000.0
            },
            'chain': {
                'base_tension': 1.0,
                'stitch_speed': 15.0,
                'fabric_stiffness': 800.0
            },
            'fill': {
                'base_tension': 1.2,
                'stitch_speed': 12.0,
                'fabric_stiffness': 1000.0
            },
            'outline': {
                'base_tension': 1.5,
                'stitch_speed': 8.0,
                'fabric_stiffness': 1200.0
            }
        }
        
        return recommendations.get(stitch_type, recommendations['fill'])
    
    def set_embroidery_bounds(self, stitch_type: str = 'fill') -> None:
        bounds = {
            'satin': {
                'base_tension': (1.5, 3.5),
                'stitch_speed': (8, 15),
                'fabric_stiffness': (500, 1500)
            },
            'chain': {
                'base_tension': (0.5, 2.0),
                'stitch_speed': (10, 25),
                'fabric_stiffness': (400, 1200)
            },
            'fill': {
                'base_tension': (0.8, 2.5),
                'stitch_speed': (10, 20),
                'fabric_stiffness': (500, 1500)
            },
            'outline': {
                'base_tension': (1.0, 3.0),
                'stitch_speed': (6, 14),
                'fabric_stiffness': (600, 1800)
            }
        }
        
        selected = bounds.get(stitch_type, bounds['fill'])
        for param_name, (low, high) in selected.items():
            self.set_bounds(param_name, low, high)
    
    def sensitivity_analysis(self, simulation_func: Callable,
                              base_params: Dict[str, float],
                              param_range: float = 0.2,
                              n_points: int = 20) -> Dict[str, Dict]:
        sensitivity_results = {}
        
        for param_name in self.bounds.keys():
            base_value = base_params[param_name]
            values = np.linspace(
                base_value * (1 - param_range),
                base_value * (1 + param_range),
                n_points
            )
            
            mean_tensions = []
            cv_values = []
            
            for value in values:
                test_params = base_params.copy()
                test_params[param_name] = value
                
                time, tension = simulation_func(**test_params)
                mean_t = np.mean(tension)
                cv = np.std(tension) / mean_t
                
                mean_tensions.append(mean_t)
                cv_values.append(cv)
            
            sensitivity_results[param_name] = {
                'values': values,
                'mean_tension': np.array(mean_tensions),
                'cv': np.array(cv_values)
            }
        
        return sensitivity_results
    
    def pareto_optimization(self, simulation_func: Callable,
                             n_samples: int = 500) -> Dict[str, np.ndarray]:
        param_names = list(self.bounds.keys())
        rng = np.random.default_rng(42)
        
        param_values = []
        mean_tensions = []
        cv_values = []
        
        for _ in range(n_samples):
            params = np.array([
                rng.uniform(self.bounds[name][0], self.bounds[name][1])
                for name in param_names
            ])
            
            time, tension = simulation_func(**dict(zip(param_names, params)))
            mean_t = np.mean(tension)
            cv = np.std(tension) / mean_t
            
            param_values.append(params)
            mean_tensions.append(mean_t)
            cv_values.append(cv)
        
        return {
            'params': np.array(param_values),
            'mean_tension': np.array(mean_tensions),
            'cv': np.array(cv_values)
        }
    
    def multi_objective_weighted(self, simulation_func: Callable,
                                   weights: Dict[str, float],
                                   method: str = 'differential_evolution',
                                   thread_type: str = 'silk_120D',
                                   **kwargs) -> OptimizationResult:
        param_names = list(self.bounds.keys())
        bounds_list = [self.bounds[name] for name in param_names]
        
        thread_breaking_tensions = {
            'silk_120D': 5.0,
            'silk_240D': 8.0,
            'cotton_30s': 3.5
        }
        breaking_tension = thread_breaking_tensions.get(thread_type, 5.0)
        
        def objective(x):
            params = dict(zip(param_names, x))
            
            try:
                time, tension = simulation_func(**params)
            except Exception:
                return 1e10
            
            mean_t = np.mean(tension)
            max_t = np.max(tension)
            cv = np.std(tension) / mean_t if mean_t > 0 else 1.0
            
            fitness = 0.0
            penalty = 0.0
            
            safety_factor_min = 1.5
            current_safety = breaking_tension / max_t if max_t > 0 else 0
            if current_safety < safety_factor_min:
                penalty += 1e6 * (safety_factor_min - current_safety)
            
            if cv > 0.15:
                penalty += 1e4 * (cv - 0.15)
            
            if 'mean' in weights:
                target_mean = weights.get('target_mean', 1.0)
                fitness += weights['mean'] * abs(mean_t - target_mean)
            
            if 'cv' in weights:
                fitness += weights['cv'] * cv
            
            if 'max' in weights:
                fitness += weights['max'] * max_t
            
            return float(fitness + penalty)
        
        history = []
        
        def callback(x, convergence=None):
            history.append(objective(x))
        
        if method == 'differential_evolution':
            result = differential_evolution(
                objective, bounds_list, callback=callback,
                disp=False, seed=42, polish=True, **kwargs
            )
        else:
            recommended = self.get_recommended_params()
            x0 = np.array([recommended.get(name, np.mean(b))
                          for name, b in zip(param_names, bounds_list)])
            result = minimize(
                objective, x0,
                method='L-BFGS-B', bounds=bounds_list,
                callback=lambda x: history.append(objective(x)),
                **kwargs
            )
        
        opt_result = OptimizationResult(
            best_params=dict(zip(param_names, result.x)),
            best_fitness=float(result.fun),
            history=history,
            method=f'weighted_multi_objective_{method}',
            success=getattr(result, 'success', True) and result.fun < 1e6,
            message=getattr(result, 'message', 'Optimization completed')
        )
        
        return opt_result
    
    def compare_methods(self, simulation_func: Callable,
                         objective_type: str = 'mse',
                         thread_type: str = 'silk_120D') -> Dict[str, OptimizationResult]:
        results = {}
        
        print("Running grid search...")
        results['grid_search'] = self.optimize_grid_search(
            simulation_func, points_per_param=5, 
            objective_type=objective_type, thread_type=thread_type
        )
        
        print("Running gradient-based optimization...")
        results['gradient_based'] = self.optimize_gradient_based(
            simulation_func, objective_type=objective_type,
            thread_type=thread_type
        )
        
        print("Running differential evolution...")
        results['differential_evolution'] = self.optimize_differential_evolution(
            simulation_func, objective_type=objective_type,
            thread_type=thread_type
        )
        
        print("Running random search...")
        results['random_search'] = self.optimize_random_search(
            simulation_func, n_samples=200, 
            objective_type=objective_type, thread_type=thread_type
        )
        
        return results
    
    def get_param_suggestions(self, stitch_type: str) -> Dict[str, Tuple[float, float]]:
        suggestions = {
            'satin': {
                'base_tension': (1.5, 3.0),
                'stitch_speed': (8.0, 15.0),
                'thread_tension': (0.8, 1.5)
            },
            'chain': {
                'base_tension': (0.5, 1.5),
                'stitch_speed': (10.0, 20.0),
                'thread_tension': (0.5, 1.0)
            },
            'fill': {
                'base_tension': (0.8, 2.0),
                'stitch_speed': (12.0, 18.0),
                'thread_tension': (0.6, 1.2)
            },
            'outline': {
                'base_tension': (1.0, 2.5),
                'stitch_speed': (6.0, 12.0),
                'thread_tension': (0.7, 1.3)
            }
        }
        
        return suggestions.get(stitch_type, suggestions['fill'])
    
    def validate_optimization_result(self, result: OptimizationResult,
                                      simulation_func: Callable,
                                      n_runs: int = 5) -> Dict:
        param_names = list(result.best_params.keys())
        tensions = []
        
        for _ in range(n_runs):
            time, tension = simulation_func(**result.best_params)
            tensions.append(tension)
        
        tensions = np.array(tensions)
        
        return {
            'mean_tension': float(np.mean(tensions)),
            'std_tension': float(np.std(tensions)),
            'cv': float(np.std(np.mean(tensions, axis=1)) / np.mean(tensions)),
            'stability': 'good' if np.std(np.mean(tensions, axis=1)) / np.mean(tensions) < 0.05 else 'poor'
        }