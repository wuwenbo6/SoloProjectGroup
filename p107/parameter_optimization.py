import numpy as np
import warnings
from scipy.optimize import minimize, differential_evolution, basinhopping
from typing import Dict, List, Optional, Tuple, Callable
from material_collection import MaterialCollection
from formula_simulation import Formula, FormulaSimulator, InkSimulationResult


class ParameterOptimizer:
    def __init__(self, simulator: Optional[FormulaSimulator] = None):
        self.simulator = simulator or FormulaSimulator()
        self.optimization_history = []

    def objective_function(self, params: np.ndarray, 
                          formula_template: Formula,
                          param_types: List[str],
                          weights: Optional[Dict] = None) -> float:
        formula = Formula(f"Optimized_{formula_template.name}")
        formula.materials = formula_template.materials.copy()
        formula.process_params = formula_template.process_params.copy()
        
        for i, param_type in enumerate(param_types):
            formula.set_process_param(param_type, params[i])
        
        try:
            result = self.simulator.simulate_formula(formula)
            overall = result.quality_scores['overall_quality']
            
            if weights:
                score = 0
                for key, weight in weights.items():
                    score += result.quality_scores.get(key, 0) * weight
                overall = score
            
            self.optimization_history.append({
                'params': params.copy(),
                'score': overall,
                'details': result.quality_scores
            })
            
            return -overall
        except Exception:
            return 1e6

    def optimize_process_params(self, formula: Formula,
                                param_ranges: Optional[Dict[str, Tuple[float, float]]] = None,
                                method: str = 'differential_evolution',
                                weights: Optional[Dict] = None,
                                max_iter: int = 100) -> Dict:
        self.optimization_history = []
        
        recommended_ranges = {
            'firing_temperature': (600.0, 1200.0),
            'firing_time': (30.0, 300.0),
            'grinding_time': (15.0, 180.0),
            'mixing_temperature': (15.0, 80.0)
        }
        
        if param_ranges is None:
            param_ranges = {k: v for k, v in recommended_ranges.items() 
                           if k in formula.process_params}
        
        param_names = list(param_ranges.keys())
        bounds = [param_ranges[name] for name in param_names]
        
        for name, (low, high) in zip(param_names, bounds):
            if name in recommended_ranges:
                rec_low, rec_high = recommended_ranges[name]
                if low < rec_low or high > rec_high:
                    warnings.warn(f"参数 {name} 的范围超出推荐值 [{rec_low}, {rec_high}]")
        
        initial_params = np.array([formula.process_params.get(name, (b[0]+b[1])/2) 
                                   for name, b in zip(param_names, bounds)])
        
        if method == 'differential_evolution':
            result = differential_evolution(
                self.objective_function,
                bounds=bounds,
                args=(formula, param_names, weights),
                maxiter=max_iter,
                popsize=15,
                seed=42,
                strategy='best1bin',
                recombination=0.7,
                mutation=(0.5, 1.0)
            )
        elif method == 'basinhopping':
            minimizer_kwargs = {
                'method': 'L-BFGS-B',
                'bounds': bounds,
                'args': (formula, param_names, weights)
            }
            result = basinhopping(
                self.objective_function,
                x0=initial_params,
                minimizer_kwargs=minimizer_kwargs,
                niter=max_iter,
                T=1.0,
                stepsize=0.1,
                niter_success=10
            )
        elif method == 'L-BFGS-B':
            result = minimize(
                self.objective_function,
                x0=initial_params,
                args=(formula, param_names, weights),
                method='L-BFGS-B',
                bounds=bounds,
                options={'maxiter': max_iter, 'ftol': 1e-8}
            )
        else:
            raise ValueError(f"Unknown optimization method: {method}")
        
        optimized_params = {}
        for i, name in enumerate(param_names):
            value = float(result.x[i])
            low, high = param_ranges[name]
            optimized_params[name] = np.clip(value, low, high)
        
        optimized_formula = Formula(f"Optimized_{formula.name}")
        optimized_formula.materials = formula.materials.copy()
        optimized_formula.process_params = formula.process_params.copy()
        for name, value in optimized_params.items():
            optimized_formula.set_process_param(name, round(value, 2))
        
        optimized_result = self.simulator.simulate_formula(optimized_formula)
        
        return {
            'success': result.success,
            'optimized_params': optimized_params,
            'original_params': {name: formula.process_params.get(name, 0) 
                               for name in param_names},
            'best_score': -result.fun if result.fun < 1e5 else 0.0,
            'optimized_formula': optimized_formula,
            'optimized_result': optimized_result,
            'optimization_history': self.optimization_history.copy(),
            'method': method,
            'nit': getattr(result, 'nit', 0),
            'nfev': getattr(result, 'nfev', 0),
            'recommended_ranges': recommended_ranges
        }

    def optimize_material_ratios(self, formula: Formula,
                                  material_bounds: Optional[Dict[str, Tuple[float, float]]] = None,
                                  weights: Optional[Dict] = None,
                                  max_iter: int = 100,
                                  enforce_constraints: bool = True) -> Dict:
        self.optimization_history = []
        
        material_collection = MaterialCollection()
        
        if material_bounds is None:
            material_bounds = {}
            for name, current_ratio in formula.materials.items():
                material = material_collection.get_material(name)
                if material:
                    if material.material_type == 'soot':
                        material_bounds[name] = (0.4, 0.8)
                    elif material.material_type == 'binder':
                        material_bounds[name] = (0.15, 0.45)
                    elif material.material_type == 'additive':
                        material_bounds[name] = (0.01, 0.15)
                    else:
                        material_bounds[name] = (0.01, 0.20)
                else:
                    material_bounds[name] = (0.01, 0.50)
        
        material_names = list(material_bounds.keys())
        n_materials = len(material_names)
        
        soot_names = []
        binder_names = []
        additive_names = []
        for name in material_names:
            mat = material_collection.get_material(name)
            if mat:
                if mat.material_type == 'soot':
                    soot_names.append(name)
                elif mat.material_type == 'binder':
                    binder_names.append(name)
                elif mat.material_type == 'additive':
                    additive_names.append(name)
        
        def objective_wrapper(ratios_norm):
            ratios = np.zeros(n_materials)
            for i, name in enumerate(material_names):
                low, high = material_bounds[name]
                ratios[i] = low + (high - low) * ratios_norm[i]
            
            total = np.sum(ratios)
            if total > 0:
                ratios = ratios / total
            
            if enforce_constraints:
                soot_ratio = sum(ratios[i] for i, name in enumerate(material_names) if name in soot_names)
                binder_ratio = sum(ratios[i] for i, name in enumerate(material_names) if name in binder_names)
                
                if soot_ratio < 0.4 or soot_ratio > 0.8:
                    return 1e6
                if binder_ratio < 0.15 or binder_ratio > 0.5:
                    return 1e6
            
            test_formula = Formula(f"RatioOpt_{formula.name}")
            for i, name in enumerate(material_names):
                test_formula.add_material(name, round(ratios[i], 4))
            
            for name, value in formula.process_params.items():
                test_formula.set_process_param(name, value)
            
            try:
                result = self.simulator.simulate_formula(test_formula)
                overall = result.quality_scores['overall_quality']
                
                if weights:
                    score = 0
                    for key, weight in weights.items():
                        score += result.quality_scores.get(key, 0) * weight
                    overall = score
                
                self.optimization_history.append({
                    'ratios': ratios.copy(),
                    'score': overall,
                    'details': result.quality_scores
                })
                
                return -overall
            except Exception:
                return 1e6
        
        bounds = [(0, 1) for _ in range(n_materials)]
        
        result = differential_evolution(
            objective_wrapper,
            bounds=bounds,
            maxiter=max_iter,
            popsize=20,
            seed=42,
            strategy='best1bin',
            recombination=0.7
        )
        
        optimal_ratios_norm = result.x
        optimal_ratios = np.zeros(n_materials)
        for i, name in enumerate(material_names):
            low, high = material_bounds[name]
            optimal_ratios[i] = low + (high - low) * optimal_ratios_norm[i]
        optimal_ratios = optimal_ratios / np.sum(optimal_ratios)
        
        optimized_formula = Formula(f"RatioOptimized_{formula.name}")
        for i, name in enumerate(material_names):
            optimized_formula.add_material(name, round(float(optimal_ratios[i]), 4))
        for name, value in formula.process_params.items():
            optimized_formula.set_process_param(name, value)
        
        optimized_result = self.simulator.simulate_formula(optimized_formula)
        
        original_ratios = {name: formula.materials.get(name, 0) 
                          for name in material_names}
        
        return {
            'success': result.success,
            'optimized_ratios': {name: round(float(optimal_ratios[i]), 4) 
                                for i, name in enumerate(material_names)},
            'original_ratios': original_ratios,
            'best_score': -result.fun if result.fun < 1e5 else 0.0,
            'optimized_formula': optimized_formula,
            'optimized_result': optimized_result,
            'optimization_history': self.optimization_history.copy(),
            'material_bounds': material_bounds,
            'recommendations': {
                'soot_ratio_range': (0.4, 0.8),
                'binder_ratio_range': (0.15, 0.5),
                'additive_ratio_range': (0.01, 0.15)
            }
        }

    def multi_objective_optimize(self, formula: Formula,
                                 param_ranges: Dict[str, Tuple[float, float]],
                                 objectives: List[str],
                                 weights: Optional[List[float]] = None,
                                 max_iter: int = 100) -> Dict:
        if weights is None:
            weights = [1.0 / len(objectives)] * len(objectives)
        
        objective_weights = {obj: w for obj, w in zip(objectives, weights)}
        
        return self.optimize_process_params(
            formula=formula,
            param_ranges=param_ranges,
            method='differential_evolution',
            weights=objective_weights,
            max_iter=max_iter
        )

    def grid_search(self, formula: Formula,
                    param_grids: Dict[str, np.ndarray]) -> Dict:
        param_names = list(param_grids.keys())
        grids = [param_grids[name] for name in param_names]
        
        mesh = np.meshgrid(*grids)
        param_combinations = np.column_stack([m.flatten() for m in mesh])
        
        results = []
        
        for params in param_combinations:
            test_formula = Formula(f"GridSearch_{formula.name}")
            test_formula.materials = formula.materials.copy()
            test_formula.process_params = formula.process_params.copy()
            
            for i, name in enumerate(param_names):
                test_formula.set_process_param(name, params[i])
            
            sim_result = self.simulator.simulate_formula(test_formula)
            results.append({
                'params': {name: params[i] for i, name in enumerate(param_names)},
                'score': sim_result.quality_scores['overall_quality'],
                'details': sim_result.quality_scores
            })
        
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return {
            'best_result': results[0],
            'all_results': results,
            'param_grids': param_grids
        }

    def sensitivity_analysis(self, formula: Formula,
                             param_name: str,
                             param_range: np.ndarray) -> Dict:
        scores = []
        details = []
        
        original_value = formula.process_params.get(param_name, None)
        
        for value in param_range:
            test_formula = Formula(f"Sens_{formula.name}")
            test_formula.materials = formula.materials.copy()
            test_formula.process_params = formula.process_params.copy()
            test_formula.set_process_param(param_name, value)
            
            result = self.simulator.simulate_formula(test_formula)
            scores.append(result.quality_scores['overall_quality'])
            details.append(result.quality_scores)
        
        scores = np.array(scores)
        
        if original_value is not None:
            formula.set_process_param(param_name, original_value)
        
        grad = np.gradient(scores, param_range)
        
        return {
            'param_values': param_range,
            'scores': scores,
            'details': details,
            'gradient': grad,
            'max_score': np.max(scores),
            'min_score': np.min(scores),
            'optimum_param': param_range[np.argmax(scores)],
            'sensitivity_range': np.max(scores) - np.min(scores)
        }

    def plot_optimization_history(self, visualization, 
                                  save_path: Optional[str] = None):
        if not self.optimization_history:
            return None
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        scores = [-h['score'] if h['score'] < 0 else h['score'] 
                 for h in self.optimization_history]
        
        cumulative_best = np.maximum.accumulate(scores)
        
        ax.plot(scores, 'b.', alpha=0.5, label='当前得分')
        ax.plot(cumulative_best, 'r-', linewidth=2, label='最佳得分')
        
        ax.set_xlabel('迭代次数', fontsize=12)
        ax.set_ylabel('质量得分', fontsize=12)
        ax.set_title('优化过程历史', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        
        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight')
        
        return fig


import matplotlib.pyplot as plt
