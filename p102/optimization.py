import numpy as np
from typing import Dict, Any, List, Optional, Callable, Tuple
from functools import partial
import matplotlib.pyplot as plt
from parameters import ParameterManager
from simulation import StressSimulation


class JointOptimizer:
    def __init__(self, param_manager: ParameterManager, simulation: StressSimulation):
        self.param_manager = param_manager
        self.simulation = simulation
        self.base_params = param_manager.current_params.copy()
        self.optimization_results: Optional[Dict[str, Any]] = None
        self.convergence_history: List[Dict[str, Any]] = []
    
    def objective_function(self, 
                           x: List[float],
                           param_names: List[str],
                           weights: Optional[Dict[str, float]] = None) -> float:
        if weights is None:
            weights = {
                'safety_factor': 0.5,
                'deformation': 0.3,
                'stress': 0.2
            }
        
        test_params = self.base_params.copy()
        for name, value in zip(param_names, x):
            test_params[name] = value
        
        param_violation_penalty = 0.0
        
        beam_length = test_params.get('beam_length', self.base_params.get('beam_length', 0.3))
        if 'tenon_length' in param_names:
            idx = param_names.index('tenon_length')
            if x[idx] > beam_length / 2:
                param_violation_penalty += 100.0
        
        beam_width = test_params.get('beam_width', self.base_params.get('beam_width', 0.05))
        if 'tenon_width' in param_names:
            idx = param_names.index('tenon_width')
            if x[idx] > beam_width:
                param_violation_penalty += 100.0
        
        beam_height = test_params.get('beam_height', self.base_params.get('beam_height', 0.05))
        if 'mortise_depth' in param_names:
            idx = param_names.index('mortise_depth')
            if x[idx] > beam_height / 2:
                param_violation_penalty += 100.0
        
        if 'friction_coefficient' in param_names:
            idx = param_names.index('friction_coefficient')
            if x[idx] < 0 or x[idx] > 1:
                param_violation_penalty += 100.0
        
        for i, name in enumerate(param_names):
            if x[i] <= 0:
                param_violation_penalty += 100.0
        
        result = self.simulation.run_simulation(test_params)
        
        safety_factor = result['safety_factors']['overall']
        deformation = result['deformation']['total'] * 1000
        max_stress = result['max_stresses']['max_von_mises'] / 1e6
        
        if safety_factor < 1.0:
            sf_penalty = (1.0 - safety_factor) * 100.0
        else:
            sf_penalty = 0.0
        
        target_sf = 2.0
        if safety_factor < target_sf:
            sf_score = safety_factor / target_sf
        else:
            sf_score = 1.0 + 0.1 * (safety_factor - target_sf) / target_sf
            sf_score = min(sf_score, 1.5)
        
        deform_score = 1.0 / (1.0 + deformation / 10.0)
        stress_score = 1.0 / (1.0 + max_stress / 50.0)
        
        objective = -(weights['safety_factor'] * sf_score +
                      weights['deformation'] * deform_score +
                      weights['stress'] * stress_score)
        
        total_penalty = param_violation_penalty + sf_penalty
        total_objective = objective + total_penalty
        
        self.convergence_history.append({
            'parameters': dict(zip(param_names, x)),
            'safety_factor': safety_factor,
            'deformation_mm': deformation,
            'max_stress_mpa': max_stress,
            'objective_value': -objective,
            'penalty': total_penalty,
            'feasible': safety_factor >= 1.0 and param_violation_penalty == 0
        })
        
        return total_objective
    
    def random_search(self,
                       param_bounds: Dict[str, Tuple[float, float]],
                       n_iterations: int = 100,
                       weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        param_names = list(param_bounds.keys())
        bounds = [param_bounds[name] for name in param_names]
        
        best_score = float('inf')
        best_params = None
        best_result = None
        best_feasible = False
        
        feasible_results = []
        
        self.convergence_history = []
        
        for iteration in range(n_iterations):
            x = [np.random.uniform(b[0], b[1]) for b in bounds]
            score = self.objective_function(x, param_names, weights)
            
            current_history = self.convergence_history[-1]
            is_feasible = current_history['feasible']
            
            if is_feasible:
                feasible_results.append({
                    'params': dict(zip(param_names, x)),
                    'score': score,
                    'safety_factor': current_history['safety_factor']
                })
            
            if is_feasible and not best_feasible:
                best_score = score
                best_params = dict(zip(param_names, x))
                best_feasible = True
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
            
            elif is_feasible == best_feasible and score < best_score:
                best_score = score
                best_params = dict(zip(param_names, x))
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
            
            elif not best_feasible and score < best_score:
                best_score = score
                best_params = dict(zip(param_names, x))
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
        
        if best_params is None:
            best_params = {name: (b[0] + b[1]) / 2 for name, b in param_bounds.items()}
            test_params = self.base_params.copy()
            test_params.update(best_params)
            best_result = self.simulation.run_simulation(test_params)
        
        self.optimization_results = {
            'method': 'random_search',
            'best_params': best_params,
            'best_score': -best_score,
            'best_result': best_result,
            'n_iterations': n_iterations,
            'convergence_history': self.convergence_history,
            'n_feasible': len(feasible_results),
            'feasible': best_feasible
        }
        
        return self.optimization_results
    
    def grid_search(self,
                     param_bounds: Dict[str, Tuple[float, float]],
                     n_points_per_param: int = 10,
                     weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        param_names = list(param_bounds.keys())
        param_grids = [np.linspace(b[0], b[1], n_points_per_param) for b in param_bounds.values()]
        
        grid_points = np.array(np.meshgrid(*param_grids)).T.reshape(-1, len(param_names))
        
        best_score = float('inf')
        best_params = None
        best_result = None
        best_feasible = False
        
        feasible_results = []
        
        self.convergence_history = []
        
        for x in grid_points:
            score = self.objective_function(x, param_names, weights)
            
            current_history = self.convergence_history[-1]
            is_feasible = current_history['feasible']
            
            if is_feasible:
                feasible_results.append({
                    'params': dict(zip(param_names, x)),
                    'score': score,
                    'safety_factor': current_history['safety_factor']
                })
            
            if is_feasible and not best_feasible:
                best_score = score
                best_params = dict(zip(param_names, x))
                best_feasible = True
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
            
            elif is_feasible == best_feasible and score < best_score:
                best_score = score
                best_params = dict(zip(param_names, x))
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
            
            elif not best_feasible and score < best_score:
                best_score = score
                best_params = dict(zip(param_names, x))
                
                test_params = self.base_params.copy()
                test_params.update(best_params)
                best_result = self.simulation.run_simulation(test_params)
        
        if best_params is None:
            best_params = {name: (b[0] + b[1]) / 2 for name, b in param_bounds.items()}
            test_params = self.base_params.copy()
            test_params.update(best_params)
            best_result = self.simulation.run_simulation(test_params)
        
        self.optimization_results = {
            'method': 'grid_search',
            'best_params': best_params,
            'best_score': -best_score,
            'best_result': best_result,
            'n_iterations': len(grid_points),
            'convergence_history': self.convergence_history,
            'n_feasible': len(feasible_results),
            'feasible': best_feasible
        }
        
        return self.optimization_results
    
    def bayesian_optimization(self,
                               param_bounds: Dict[str, Tuple[float, float]],
                               n_calls: int = 50,
                               n_random_starts: int = 10,
                               weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        try:
            from skopt import gp_minimize
            from skopt.space import Real
        except ImportError:
            print("scikit-optimize not available. Falling back to random search.")
            return self.random_search(param_bounds, n_calls, weights)
        
        param_names = list(param_bounds.keys())
        space = [Real(b[0], b[1], name=name) for name, b in param_bounds.items()]
        
        self.convergence_history = []
        
        objective = partial(self.objective_function, param_names=param_names, weights=weights)
        
        result = gp_minimize(
            objective,
            space,
            n_calls=n_calls,
            n_random_starts=n_random_starts,
            random_state=42,
            verbose=False
        )
        
        best_x = result.x
        best_score = result.fun
        
        feasible_results = []
        for h in self.convergence_history:
            if h['feasible']:
                feasible_results.append(h)
        
        if feasible_results:
            feasible_results.sort(key=lambda x: x['objective_value'], reverse=True)
            best_feasible = feasible_results[0]
            best_x = [best_feasible['parameters'][name] for name in param_names]
            best_score = -best_feasible['objective_value']
        
        best_params = dict(zip(param_names, best_x))
        
        test_params = self.base_params.copy()
        test_params.update(best_params)
        best_result = self.simulation.run_simulation(test_params)
        
        self.optimization_results = {
            'method': 'bayesian_optimization',
            'best_params': best_params,
            'best_score': -best_score if best_score < 0 else best_score,
            'best_result': best_result,
            'n_iterations': n_calls,
            'convergence_history': self.convergence_history,
            'n_feasible': len(feasible_results),
            'feasible': len(feasible_results) > 0,
            'skopt_result': result
        }
        
        return self.optimization_results
    
    def optimize(self,
                  method: str = 'bayesian',
                  param_names: Optional[List[str]] = None,
                  n_iterations: int = 50,
                  weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        if param_names is None:
            param_names = ['tenon_length', 'tenon_width', 'mortise_depth']
        
        all_bounds = self.param_manager.get_parameter_bounds()
        param_bounds = {name: all_bounds[name] for name in param_names}
        
        if method == 'random':
            return self.random_search(param_bounds, n_iterations, weights)
        elif method == 'grid':
            return self.grid_search(param_bounds, int(n_iterations ** (1/len(param_names))) + 1, weights)
        elif method == 'bayesian':
            return self.bayesian_optimization(param_bounds, n_iterations, weights)
        else:
            raise ValueError(f"Unknown optimization method: {method}. "
                           f"Available: 'random', 'grid', 'bayesian'")
    
    def plot_convergence(self,
                          save_path: Optional[str] = None,
                          show: bool = True) -> None:
        if not self.convergence_history:
            raise ValueError("No optimization history available. Run optimization first.")
        
        iterations = range(1, len(self.convergence_history) + 1)
        objectives = [h['objective_value'] for h in self.convergence_history]
        safety_factors = [h['safety_factor'] for h in self.convergence_history]
        deformations = [h['deformation_mm'] for h in self.convergence_history]
        
        cumulative_best = []
        current_best = 0
        for obj in objectives:
            current_best = max(current_best, obj)
            cumulative_best.append(current_best)
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        ax1 = axes[0, 0]
        ax1.plot(iterations, objectives, 'b.', alpha=0.5, label='Evaluations')
        ax1.plot(iterations, cumulative_best, 'r-', linewidth=2, label='Best Found')
        ax1.set_xlabel('Iteration', fontsize=12)
        ax1.set_ylabel('Objective Value', fontsize=12)
        ax1.set_title('Convergence History', fontsize=14, fontweight='bold')
        ax1.legend(fontsize=10)
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[0, 1]
        ax2.plot(iterations, safety_factors, 'g.', alpha=0.6)
        ax2.axhline(y=1.0, color='red', linestyle='--', linewidth=2, label='SF=1 Limit')
        ax2.set_xlabel('Iteration', fontsize=12)
        ax2.set_ylabel('Safety Factor', fontsize=12)
        ax2.set_title('Safety Factor Evolution', fontsize=14, fontweight='bold')
        ax2.legend(fontsize=10)
        ax2.grid(True, alpha=0.3)
        
        ax3 = axes[1, 0]
        ax3.plot(iterations, deformations, 'm.', alpha=0.6)
        ax3.set_xlabel('Iteration', fontsize=12)
        ax3.set_ylabel('Deformation (mm)', fontsize=12)
        ax3.set_title('Deformation Evolution', fontsize=14, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        
        ax4 = axes[1, 1]
        ax4.axis('off')
        if self.optimization_results:
            best = self.optimization_results['best_params']
            info_text = "OPTIMIZATION RESULTS\n"
            info_text += "=" * 30 + "\n\n"
            info_text += f"Method: {self.optimization_results['method'].replace('_', ' ').title()}\n"
            info_text += f"Total Evaluations: {self.optimization_results['n_iterations']}\n\n"
            info_text += "Best Parameters:\n"
            for name, value in best.items():
                info_text += f"  {name}: {value*1000:.2f} mm\n"
            info_text += f"\nBest Score: {self.optimization_results['best_score']:.4f}\n"
            
            ax4.text(0.1, 0.9, info_text, transform=ax4.transAxes,
                    fontsize=11, verticalalignment='top', family='monospace')
        
        plt.suptitle('Joint Optimization Results', fontsize=16, fontweight='bold', y=0.98)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def compare_before_after(self,
                              save_path: Optional[str] = None,
                              show: bool = True) -> None:
        if not self.optimization_results:
            raise ValueError("No optimization results available. Run optimization first.")
        
        base_result = self.simulation.run_simulation(self.base_params)
        optimized_result = self.optimization_results['best_result']
        
        categories = ['Safety\nFactor', 'Deformation\n(mm)', 'Max Stress\n(MPa)', 'Contact\nStress (MPa)']
        
        before_values = [
            base_result['safety_factors']['overall'],
            base_result['deformation']['total'] * 1000,
            base_result['max_stresses']['max_von_mises'] / 1e6,
            base_result['contact_stresses']['contact_pressure'] / 1e6
        ]
        
        after_values = [
            optimized_result['safety_factors']['overall'],
            optimized_result['deformation']['total'] * 1000,
            optimized_result['max_stresses']['max_von_mises'] / 1e6,
            optimized_result['contact_stresses']['contact_pressure'] / 1e6
        ]
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        for idx, ax in enumerate(axes.flat):
            x = np.arange(2)
            width = 0.5
            
            values = [before_values[idx], after_values[idx]]
            colors = ['#e74c3c', '#2ecc71']
            labels = ['Before', 'After']
            
            bars = ax.bar(x, values, width, color=colors, alpha=0.8, edgecolor='black')
            
            for bar, value in zip(bars, values):
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{value:.3f}',
                       ha='center', va='bottom', fontsize=11, fontweight='bold')
            
            ax.set_xticks(x)
            ax.set_xticklabels(labels, fontsize=11)
            ax.set_title(categories[idx], fontsize=13, fontweight='bold')
            ax.grid(True, axis='y', alpha=0.3)
            
            if 'Safety' in categories[idx]:
                ax.axhline(y=1.0, color='red', linestyle='--', linewidth=2, alpha=0.7)
        
        plt.suptitle('Before vs After Optimization Comparison', fontsize=16, fontweight='bold', y=0.98)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def get_optimization_summary(self) -> str:
        if not self.optimization_results:
            return "No optimization results available."
        
        result = self.optimization_results
        summary = [
            "=" * 60,
            "JOINT OPTIMIZATION SUMMARY",
            "=" * 60,
            "",
            f"Method: {result['method'].replace('_', ' ').title()}",
            f"Total Evaluations: {result['n_iterations']}",
            f"Feasible Solutions Found: {result.get('n_feasible', 'N/A')}",
            f"Best Solution Feasible: {'YES' if result.get('feasible', False) else 'NO'}",
            f"Best Objective Score: {result['best_score']:.4f}",
            "",
            "Optimized Parameters:",
            "-" * 30
        ]
        
        for name, value in result['best_params'].items():
            base_value = self.base_params[name]
            change_pct = (value - base_value) / base_value * 100
            summary.append(f"  {name:20s}: {value*1000:8.2f} mm "
                         f"(base: {base_value*1000:8.2f} mm, change: {change_pct:+.1f}%)")
        
        summary.extend([
            "",
            "Performance Metrics:",
            "-" * 30,
            f"  Overall Safety Factor: "
            f"{result['best_result']['safety_factors']['overall']:.3f}",
            f"  Total Deformation: "
            f"{result['best_result']['deformation']['total']*1000:.3f} mm",
            f"  Maximum Von Mises Stress: "
            f"{result['best_result']['max_stresses']['max_von_mises']/1e6:.2f} MPa",
            f"  Contact Pressure: "
            f"{result['best_result']['contact_stresses']['contact_pressure']/1e6:.2f} MPa",
            "",
            "Design Status:",
            "-" * 30
        ])
        
        sf = result['best_result']['safety_factors']['overall']
        if sf >= 2.0:
            status = "EXCELLENT - Safety factor well above target"
        elif sf >= 1.5:
            status = "GOOD - Safety factor meets requirements"
        elif sf >= 1.0:
            status = "MARGINAL - Safety factor just meets minimum requirement"
        else:
            status = "UNACCEPTABLE - Safety factor below minimum requirement"
        summary.append(f"  {status}")
        
        summary.extend([
            "",
            "=" * 60
        ])
        
        return "\n".join(summary)
