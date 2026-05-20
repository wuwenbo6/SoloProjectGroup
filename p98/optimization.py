import numpy as np
from typing import Dict, List, Callable, Optional, Tuple
from simulation import FermentationSimulator
import matplotlib.pyplot as plt

try:
    from skopt import gp_minimize
    from skopt.space import Real
    from skopt.plots import plot_convergence, plot_objective
    SKOPT_AVAILABLE = True
except ImportError:
    SKOPT_AVAILABLE = False
    print("警告: scikit-optimize 未安装，优化功能将不可用")
    print("请运行: pip install scikit-optimize")


class FermentationOptimizer:
    def __init__(self, simulator: FermentationSimulator):
        self.simulator = simulator
        self.optimization_results = None
        self.best_parameters = None
        self.optimization_history = []
        
        self.target_temperature_range = (25, 35)
        self.target_humidity_range = (0.6, 0.85)
        self.target_fermentation_time = 168
        self.target_product_yield = 0.8
        self.min_substrate_conversion = 90

    def _calculate_objective_score(self, results: Dict, target: str, 
                                   weights: Dict) -> float:
        final_temp = results['temperature'][-1]
        final_hum = results['humidity'][-1]
        final_product = results['product'][-1]
        final_biomass = results['biomass'][-1]
        substrate_conversion = (1 - results['substrate'][-1] / results['substrate'][0]) * 100
        
        penalty = 0.0
        
        temp_optimal = np.mean(self.target_temperature_range)
        temp_deviation = abs(final_temp - temp_optimal)
        if final_temp < self.target_temperature_range[0] or final_temp > self.target_temperature_range[1]:
            penalty += 10 * temp_deviation
        
        hum_optimal = np.mean(self.target_humidity_range)
        hum_deviation = abs(final_hum - hum_optimal)
        if final_hum < self.target_humidity_range[0] or final_hum > self.target_humidity_range[1]:
            penalty += 20 * hum_deviation
        
        if substrate_conversion < self.min_substrate_conversion:
            penalty += 5 * (self.min_substrate_conversion - substrate_conversion)
        
        growth_rates = np.diff(results['biomass'])
        if np.any(growth_rates < -0.1):
            penalty += 100 * np.sum(growth_rates < -0.1)
        
        temperature_spikes = np.abs(np.diff(results['temperature']))
        if np.any(temperature_spikes > 5):
            penalty += 50 * np.sum(temperature_spikes > 5)
        
        score = 0.0
        
        if target == 'max_product':
            productivity_score = final_product
            score = -(productivity_score - penalty * 0.1)
            
        elif target == 'optimal_process':
            w_product = weights.get('product', 0.4)
            w_conversion = weights.get('conversion', 0.3)
            w_quality = weights.get('quality', 0.3)
            
            norm_product = min(final_product / 100.0, 1.0)
            norm_conversion = min(substrate_conversion / 100.0, 1.0)
            
            temp_quality = max(0, 1 - abs(final_temp - 30) / 10)
            hum_quality = max(0, 1 - abs(final_hum - 0.7) / 0.3)
            quality_score = (temp_quality + hum_quality) / 2
            
            total_score = (w_product * norm_product + 
                          w_conversion * norm_conversion + 
                          w_quality * quality_score)
            
            score = -(total_score - penalty * 0.01)
            
        elif target == 'energy_efficient':
            temp_stability = 1 / (1 + np.std(results['temperature']))
            vent_rate = self.simulator.config['kinetics'].get('vent_rate', 0.01)
            energy_score = temp_stability * (1 - vent_rate * 10)
            
            norm_product = min(final_product / 100.0, 1.0)
            
            total_score = 0.6 * norm_product + 0.4 * energy_score
            score = -(total_score - penalty * 0.01)
            
        elif target == 'fast_fermentation':
            target_product = weights.get('target_product', 50.0)
            time_idx = np.where(results['product'] >= target_product)[0]
            if len(time_idx) > 0:
                time_to_target = results['time'][time_idx[0]]
            else:
                time_to_target = self.target_fermentation_time * 2
            
            norm_time = max(0, 1 - time_to_target / self.target_fermentation_time)
            norm_product = min(final_product / 100.0, 1.0)
            
            total_score = 0.7 * norm_time + 0.3 * norm_product
            score = -(total_score - penalty * 0.01)
            
        else:
            score = -(final_product - penalty * 0.1)
        
        return score

    def _build_objective(self, target: str, weights: Optional[Dict] = None) -> Callable:
        if weights is None:
            weights = {}

        def objective(params: List) -> float:
            param_names = self._get_param_names()
            param_dict = dict(zip(param_names, params))
            
            mu_max = param_dict.get('mu_max', 0.3)
            ks = param_dict.get('ks', 5.0)
            target_hum = param_dict.get('target_humidity', 0.7)
            vent_rate = param_dict.get('vent_rate', 0.01)
            k_heat = param_dict.get('k_heat', 25.0)
            ua = param_dict.get('ua', 10.0)
            
            self.simulator.set_kinetic_parameters(
                mu_max=mu_max,
                ks=ks,
                target_hum=target_hum,
                vent_rate=vent_rate,
                k_heat=k_heat,
                ua=ua
            )
            
            try:
                results = self.simulator.run_simulation()
            except Exception as e:
                print(f"仿真错误: {e}")
                return 1e10
            
            score = self._calculate_objective_score(results, target, weights)
            
            self.optimization_history.append({
                'parameters': param_dict.copy(),
                'score': score,
                'results': {
                    'final_product': results['product'][-1],
                    'final_biomass': results['biomass'][-1],
                    'substrate_conversion': (1 - results['substrate'][-1] / results['substrate'][0]) * 100,
                    'final_temperature': results['temperature'][-1],
                    'final_humidity': results['humidity'][-1]
                }
            })
            
            return score

        return objective

    def _get_param_names(self) -> List[str]:
        return ['mu_max', 'ks', 'target_humidity', 'vent_rate', 'k_heat', 'ua']

    def _get_search_space(self) -> List:
        return [
            Real(0.15, 0.45, name='mu_max'),
            Real(2.0, 8.0, name='ks'),
            Real(0.6, 0.85, name='target_humidity'),
            Real(0.005, 0.05, name='vent_rate'),
            Real(15.0, 35.0, name='k_heat'),
            Real(8.0, 15.0, name='ua')
        ]

    def optimize(self, target: str = 'optimal_process', 
                 weights: Optional[Dict] = None,
                 n_calls: int = 50,
                 random_state: int = 42) -> Dict:
        if not SKOPT_AVAILABLE:
            raise ImportError("需要安装 scikit-optimize 才能使用优化功能")
        
        valid_targets = ['max_product', 'optimal_process', 'energy_efficient', 'fast_fermentation']
        if target not in valid_targets:
            raise ValueError(f"无效的优化目标。可选目标: {valid_targets}")
        
        self.optimization_history = []
        
        space = self._get_search_space()
        objective = self._build_objective(target, weights)
        
        print(f"开始参数优化，目标: {target}")
        print(f"优化参数: {self._get_param_names()}")
        print(f"迭代次数: {n_calls}")
        
        result = gp_minimize(
            objective,
            space,
            n_calls=n_calls,
            random_state=random_state,
            verbose=True,
            n_initial_points=min(10, n_calls)
        )
        
        self.optimization_results = result
        
        param_names = self._get_param_names()
        self.best_parameters = dict(zip(param_names, result.x))
        
        print("\n优化完成!")
        print("最优参数:")
        for k, v in self.best_parameters.items():
            print(f"  {k}: {v:.4f}")
        
        best_idx = np.argmin([h['score'] for h in self.optimization_history])
        best_result = self.optimization_history[best_idx]['results']
        print("\n最优结果:")
        for k, v in best_result.items():
            print(f"  {k}: {v:.4f}")
        
        return {
            'best_parameters': self.best_parameters,
            'best_score': -result.fun,
            'best_result': best_result,
            'n_calls': n_calls,
            'convergence': self._get_convergence_data()
        }

    def _get_convergence_data(self) -> Dict:
        if self.optimization_results is None:
            return {}
        
        scores = np.array([h['score'] for h in self.optimization_history])
        min_scores = np.minimum.accumulate(scores)
        
        return {
            'iterations': np.arange(len(scores)),
            'scores': scores,
            'best_scores': min_scores
        }

    def calibrate_with_sensor_data(self, sensor_data: Dict,
                                  n_calls: int = 40,
                                  random_state: int = 42) -> Dict:
        if not SKOPT_AVAILABLE:
            raise ImportError("需要安装 scikit-optimize 才能使用校准功能")
        
        def calibration_objective(params: List) -> float:
            param_names = ['mu_max', 'ks', 'y_xs', 'y_ps', 'k_heat', 'ua']
            param_dict = dict(zip(param_names, params))
            
            self.simulator.set_kinetic_parameters(**param_dict)
            
            try:
                results = self.simulator.run_simulation()
            except:
                return 1e10
            
            rmse_sum = 0.0
            n_vars = 0
            weights = {
                'temperature': 2.0,
                'humidity': 3.0,
                'biomass': 1.5,
                'substrate': 2.0,
                'product': 1.0
            }
            
            for key in ['temperature', 'humidity', 'biomass', 'substrate', 'product']:
                if key in sensor_data and key in results:
                    sensor_interp = np.interp(
                        results['time'],
                        sensor_data['time'],
                        sensor_data[key]
                    )
                    
                    rmse = np.sqrt(np.mean((results[key] - sensor_interp) ** 2))
                    
                    max_val = np.max(sensor_data[key])
                    if max_val > 0:
                        normalized_rmse = rmse / max_val
                    else:
                        normalized_rmse = rmse
                    
                    rmse_sum += weights.get(key, 1.0) * normalized_rmse
                    n_vars += 1
            
            biomass_deviation = np.abs(np.mean(results['biomass']) - np.mean(sensor_data['biomass']))
            rmse_sum += 0.5 * biomass_deviation / (np.mean(sensor_data['biomass']) + 1e-6)
            
            return rmse_sum / n_vars if n_vars > 0 else 1e10

        space = [
            Real(0.15, 0.45, name='mu_max'),
            Real(2.0, 8.0, name='ks'),
            Real(0.3, 0.6, name='y_xs'),
            Real(0.8, 1.5, name='y_ps'),
            Real(15.0, 35.0, name='k_heat'),
            Real(8.0, 15.0, name='ua')
        ]

        print("开始模型校准...")
        result = gp_minimize(
            calibration_objective,
            space,
            n_calls=n_calls,
            random_state=random_state,
            verbose=True,
            n_initial_points=min(10, n_calls)
        )

        param_names = ['mu_max', 'ks', 'y_xs', 'y_ps', 'k_heat', 'ua']
        best_params = dict(zip(param_names, result.x))
        
        self.simulator.set_kinetic_parameters(**best_params)
        
        print("\n校准完成!")
        print("校准后参数:")
        for k, v in best_params.items():
            print(f"  {k}: {v:.4f}")
        
        return {
            'best_parameters': best_params,
            'calibration_error': result.fun,
            'n_calls': n_calls
        }

    def plot_convergence(self, show: bool = True,
                        save_path: Optional[str] = None) -> plt.Figure:
        if not SKOPT_AVAILABLE:
            raise ImportError("需要安装 scikit-optimize 才能使用可视化功能")
        
        if self.optimization_results is None:
            raise ValueError("没有可可视化的优化结果")
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        plot_convergence(self.optimization_results, ax=ax1)
        ax1.set_title('优化收敛曲线', fontsize=14, fontweight='bold')
        
        convergence = self._get_convergence_data()
        ax2.plot(convergence['iterations'], -convergence['best_scores'], 'r-', linewidth=2, label='最优值')
        ax2.scatter(convergence['iterations'], -convergence['scores'], alpha=0.5, s=20, label='每次评估')
        ax2.set_xlabel('迭代次数', fontsize=12)
        ax2.set_ylabel('目标函数值', fontsize=12)
        ax2.set_title('目标函数优化历史', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_objective_surface(self, show: bool = True,
                              save_path: Optional[str] = None) -> plt.Figure:
        if not SKOPT_AVAILABLE:
            raise ImportError("需要安装 scikit-optimize 才能使用可视化功能")
        
        if self.optimization_results is None:
            raise ValueError("没有可可视化的优化结果")
        
        fig = plt.figure(figsize=(14, 12))
        plot_objective(self.optimization_results, fig=fig, sample_source='result')
        plt.suptitle('参数优化目标函数响应面', fontsize=16, fontweight='bold')
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def sensitivity_analysis(self, param_ranges: Optional[Dict] = None,
                            n_points: int = 20) -> Dict:
        if param_ranges is None:
            param_ranges = {
                'mu_max': (0.15, 0.45),
                'ks': (2.0, 8.0),
                'target_hum': (0.6, 0.85),
                'vent_rate': (0.005, 0.05)
            }
        
        original_params = self.simulator.config['kinetics'].copy()
        
        sensitivity_results = {}
        
        for param, (min_val, max_val) in param_ranges.items():
            values = np.linspace(min_val, max_val, n_points)
            outputs = []
            
            for value in values:
                self.simulator.set_kinetic_parameters(**{param: value})
                results = self.simulator.run_simulation()
                
                outputs.append({
                    'final_product': results['product'][-1],
                    'final_biomass': results['biomass'][-1],
                    'substrate_conversion': (1 - results['substrate'][-1] / results['substrate'][0]) * 100,
                    'avg_temperature': np.mean(results['temperature']),
                    'growth_rate': np.mean(np.diff(results['biomass']))
                })
            
            sensitivity_results[param] = {
                'values': values,
                'outputs': outputs
            }
        
        self.simulator.set_kinetic_parameters(**original_params)
        
        return sensitivity_results

    def plot_sensitivity(self, sensitivity_results: Dict,
                        show: bool = True,
                        save_path: Optional[str] = None) -> plt.Figure:
        n_params = len(sensitivity_results)
        fig, axes = plt.subplots(n_params, 1, figsize=(14, 5 * n_params), sharex=False)
        
        if n_params == 1:
            axes = [axes]
        
        param_labels = {
            'mu_max': '最大比生长速率 (1/h)',
            'ks': '底物饱和常数 (g/L)',
            'target_hum': '目标湿度',
            'vent_rate': '通风速率 (1/h)'
        }
        
        for idx, (param, data) in enumerate(sensitivity_results.items()):
            ax = axes[idx]
            values = data['values']
            
            products = [o['final_product'] for o in data['outputs']]
            conversions = [o['substrate_conversion'] for o in data['outputs']]
            temps = [o['avg_temperature'] for o in data['outputs']]
            
            ax2 = ax.twinx()
            ax3 = ax.twinx()
            ax3.spines['right'].set_position(('outward', 60))
            
            line1, = ax.plot(values, products, 'g-', linewidth=2, label='最终产物浓度')
            line2, = ax2.plot(values, conversions, 'orange', linewidth=2, label='底物转化率')
            line3, = ax3.plot(values, temps, 'b--', linewidth=2, label='平均温度')
            
            ax.set_xlabel(param_labels.get(param, param), fontsize=12)
            ax.set_ylabel('最终产物浓度 (g/L)', fontsize=12, color='g')
            ax2.set_ylabel('底物转化率 (%)', fontsize=12, color='orange')
            ax3.set_ylabel('平均温度 (°C)', fontsize=12, color='b')
            
            ax.set_title(f'{param_labels.get(param, param)} 参数敏感性分析', fontsize=14, fontweight='bold')
            ax.grid(True, alpha=0.3)
            
            lines = [line1, line2, line3]
            labels = [l.get_label() for l in lines]
            ax.legend(lines, labels, loc='best')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def get_best_simulation(self) -> Dict:
        if self.best_parameters is None:
            raise ValueError("需要先执行参数优化")
        
        self.simulator.set_kinetic_parameters(**self.best_parameters)
        
        return self.simulator.run_simulation()

    def grid_search_optimization(self, param_grid: Dict, target: str = 'optimal_process') -> Dict:
        original_params = self.simulator.config['kinetics'].copy()
        
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        best_score = float('inf')
        best_params = None
        best_result = None
        
        import itertools
        all_combinations = list(itertools.product(*param_values))
        
        print(f"网格搜索: {len(all_combinations)} 种参数组合")
        
        for i, combo in enumerate(all_combinations):
            param_dict = dict(zip(param_names, combo))
            self.simulator.set_kinetic_parameters(**param_dict)
            
            try:
                results = self.simulator.run_simulation()
                score = self._calculate_objective_score(results, target, {})
                
                if score < best_score:
                    best_score = score
                    best_params = param_dict.copy()
                    best_result = {
                        'final_product': results['product'][-1],
                        'final_biomass': results['biomass'][-1],
                        'substrate_conversion': (1 - results['substrate'][-1] / results['substrate'][0]) * 100,
                        'final_temperature': results['temperature'][-1],
                        'final_humidity': results['humidity'][-1]
                    }
            except:
                continue
            
            if (i + 1) % 10 == 0:
                print(f"已完成 {i + 1}/{len(all_combinations)}")
        
        self.simulator.set_kinetic_parameters(**original_params)
        
        self.best_parameters = best_params
        
        print("\n网格搜索完成!")
        print("最优参数:")
        for k, v in best_params.items():
            print(f"  {k}: {v:.4f}")
        
        return {
            'best_parameters': best_params,
            'best_score': -best_score,
            'best_result': best_result
        }
