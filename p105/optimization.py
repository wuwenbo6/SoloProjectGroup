import numpy as np
from scipy.optimize import minimize
from typing import Dict, List, Tuple, Optional, Callable
from drying_simulation import DryingSimulation


class DryingOptimizer:
    def __init__(self, simulation: DryingSimulation):
        self.simulation = simulation
        self.best_params = None
        self.best_score = float('inf')
        self.optimization_history = []

    def objective_function(self, params: np.ndarray, target_moisture: float,
                          weights: Optional[Dict] = None) -> float:
        if weights is None:
            weights = {'time': 2.0, 'energy': 1.0, 'quality': 1000.0}

        temperature = params[0]
        humidity = params[1]

        if temperature < 5 or temperature > 80:
            return 1e12

        if humidity < 10 or humidity > 95:
            return 1e12

        self.simulation.set_parameter('temperature', temperature)
        self.simulation.set_parameter('humidity', humidity)

        if not self.simulation.run_simulation():
            return 1e12

        drying_time = self.simulation.estimate_drying_time(target_moisture)

        final_moisture = np.mean(self.simulation.results['moisture_history'][-1])
        moisture_deviation = abs(final_moisture - target_moisture)

        if drying_time < 0:
            penalty = 1e8 * (target_moisture - final_moisture + 0.01) if final_moisture > target_moisture else 0
            drying_time_penalty = self.simulation.config['simulation_time']
        else:
            penalty = 0
            drying_time_penalty = drying_time

        initial_temp = self.simulation.config['initial_temperature']
        energy_consumption = abs(temperature - initial_temp) * drying_time_penalty / 3600

        quality_penalty = moisture_deviation ** 2 * weights['quality'] * 1e4

        score = (weights['time'] * drying_time_penalty / 3600 +
                 weights['energy'] * energy_consumption +
                 quality_penalty +
                 penalty)

        self.optimization_history.append({
            'temperature': round(float(temperature), 2),
            'humidity': round(float(humidity), 2),
            'drying_time': float(drying_time),
            'final_moisture': float(final_moisture),
            'score': float(score)
        })

        if score < self.best_score:
            self.best_score = score
            self.best_params = params.copy()

        return score

    def optimize(self, target_moisture: float,
                temp_range: Tuple[float, float] = (15, 50),
                humidity_range: Tuple[float, float] = (30, 90),
                weights: Optional[Dict] = None,
                method: str = 'L-BFGS-B') -> Dict:
        self.optimization_history = []
        self.best_score = float('inf')
        self.best_params = None

        grid_points = 5
        temp_grid = np.linspace(temp_range[0], temp_range[1], grid_points)
        humidity_grid = np.linspace(humidity_range[0], humidity_range[1], grid_points)

        for temp in temp_grid:
            for humidity in humidity_grid:
                self.objective_function(np.array([temp, humidity]), target_moisture, weights)

        if self.best_params is not None:
            initial_guess = self.best_params
        else:
            initial_guess = [
                (temp_range[0] + temp_range[1]) / 2,
                (humidity_range[0] + humidity_range[1]) / 2
            ]

        bounds = [temp_range, humidity_range]

        def objective(params):
            return self.objective_function(params, target_moisture, weights)

        result = minimize(
            objective,
            initial_guess,
            method=method,
            bounds=bounds,
            options={'maxiter': 30, 'disp': False, 'eps': 0.5}
        )

        optimal_temp = np.clip(result.x[0], temp_range[0], temp_range[1])
        optimal_humidity = np.clip(result.x[1], humidity_range[0], humidity_range[1])

        self.simulation.set_parameter('temperature', optimal_temp)
        self.simulation.set_parameter('humidity', optimal_humidity)
        self.simulation.run_simulation()

        final_drying_time = self.simulation.estimate_drying_time(target_moisture)
        final_moisture = np.mean(self.simulation.results['moisture_history'][-1])

        if final_drying_time < 0:
            print(f"警告: 在当前参数下未能达到目标含水率 {target_moisture*100:.1f}%")
            print(f"最终含水率: {final_moisture*100:.2f}%")
            print("建议: 提高干燥温度或降低环境湿度")

        return {
            'optimal_temperature': round(float(optimal_temp), 1),
            'optimal_humidity': round(float(optimal_humidity), 1),
            'drying_time_hours': round(float(final_drying_time) / 3600, 2) if final_drying_time > 0 else -1,
            'final_moisture': round(float(final_moisture) * 100, 2),
            'target_moisture': round(float(target_moisture) * 100, 2),
            'best_score': round(float(self.best_score), 2),
            'iterations': len(self.optimization_history),
            'success': result.success and final_drying_time > 0,
            'message': str(result.message) if result.success else "未能找到满足干燥要求的参数"
        }

    def grid_search_optimize(self, target_moisture: float,
                           temp_range: Tuple[float, float] = (15, 50),
                           humidity_range: Tuple[float, float] = (30, 90),
                           n_points: int = 10,
                           weights: Optional[Dict] = None) -> Dict:
        self.optimization_history = []
        self.best_score = float('inf')
        self.best_params = None

        temps = np.linspace(temp_range[0], temp_range[1], n_points)
        humidities = np.linspace(humidity_range[0], humidity_range[1], n_points)

        best_result = None
        best_valid_score = float('inf')

        for temp in temps:
            for humidity in humidities:
                score = self.objective_function(np.array([temp, humidity]), target_moisture, weights)
                drying_time = self.simulation.estimate_drying_time(target_moisture)
                final_moisture = np.mean(self.simulation.results['moisture_history'][-1])

                if drying_time > 0 and score < best_valid_score:
                    best_valid_score = score
                    best_result = {
                        'optimal_temperature': temp,
                        'optimal_humidity': humidity,
                        'drying_time': drying_time,
                        'final_moisture': final_moisture,
                        'score': score
                    }

        if best_result is None:
            valid_results = [r for r in self.optimization_history if r['drying_time'] > 0]
            if valid_results:
                best = min(valid_results, key=lambda x: x['score'])
                best_result = {
                    'optimal_temperature': best['temperature'],
                    'optimal_humidity': best['humidity'],
                    'drying_time': best['drying_time'],
                    'final_moisture': best['final_moisture'],
                    'score': best['score']
                }
            else:
                return {
                    'optimal_temperature': None,
                    'optimal_humidity': None,
                    'drying_time_hours': -1,
                    'final_moisture': round(float(target_moisture * 100), 2),
                    'target_moisture': round(float(target_moisture * 100), 2),
                    'best_score': float('inf'),
                    'iterations': len(self.optimization_history),
                    'success': False,
                    'message': '网格搜索未能找到满足干燥要求的参数组合'
                }

        self.simulation.set_parameter('temperature', best_result['optimal_temperature'])
        self.simulation.set_parameter('humidity', best_result['optimal_humidity'])
        self.simulation.run_simulation()

        return {
            'optimal_temperature': round(float(best_result['optimal_temperature']), 1),
            'optimal_humidity': round(float(best_result['optimal_humidity']), 1),
            'drying_time_hours': round(float(best_result['drying_time']) / 3600, 2) if best_result['drying_time'] > 0 else -1,
            'final_moisture': round(float(best_result['final_moisture']) * 100, 2),
            'target_moisture': round(float(target_moisture) * 100, 2),
            'best_score': round(float(best_result['score']), 2),
            'iterations': len(self.optimization_history),
            'success': True,
            'message': '网格搜索完成'
        }

    def get_optimization_history(self) -> List[Dict]:
        return self.optimization_history

    def get_pareto_front(self) -> List[Dict]:
        if not self.optimization_history:
            return []

        pareto_points = []
        for i, point1 in enumerate(self.optimization_history):
            dominated = False
            for point2 in self.optimization_history:
                if (point2['drying_time'] < point1['drying_time'] and
                    abs(point2['final_moisture'] - 0.08) < abs(point1['final_moisture'] - 0.08)):
                    dominated = True
                    break
            if not dominated:
                pareto_points.append(point1)

        return pareto_points


class ParameterSensitivityAnalysis:
    def __init__(self, simulation: DryingSimulation):
        self.simulation = simulation
        self.results = {}

    def analyze_temperature_sensitivity(self, temp_values: List[float],
                                      humidity: float = 60.0) -> Dict:
        base_config = self.simulation.config.copy()
        self.simulation.set_parameter('humidity', humidity)

        drying_times = []
        final_moistures = []

        for temp in temp_values:
            self.simulation.set_parameter('temperature', temp)
            self.simulation.run_simulation()

            drying_time = self.simulation.estimate_drying_time(0.08)
            final_moisture = np.mean(self.simulation.results['moisture_history'][-1])

            drying_times.append(drying_time)
            final_moistures.append(final_moisture)

        self.results['temperature'] = {
            'values': temp_values,
            'drying_times': drying_times,
            'final_moistures': final_moistures
        }

        self.simulation.config = base_config
        return self.results['temperature']

    def analyze_humidity_sensitivity(self, humidity_values: List[float],
                                   temperature: float = 25.0) -> Dict:
        base_config = self.simulation.config.copy()
        self.simulation.set_parameter('temperature', temperature)

        drying_times = []
        final_moistures = []

        for humidity in humidity_values:
            self.simulation.set_parameter('humidity', humidity)
            self.simulation.run_simulation()

            drying_time = self.simulation.estimate_drying_time(0.08)
            final_moisture = np.mean(self.simulation.results['moisture_history'][-1])

            drying_times.append(drying_time)
            final_moistures.append(final_moisture)

        self.results['humidity'] = {
            'values': humidity_values,
            'drying_times': drying_times,
            'final_moistures': final_moistures
        }

        self.simulation.config = base_config
        return self.results['humidity']

    def compare_materials(self, material_names: List[str],
                        temperature: float = 25.0,
                        humidity: float = 60.0) -> Dict:
        base_config = self.simulation.config.copy()
        self.simulation.set_parameter('temperature', temperature)
        self.simulation.set_parameter('humidity', humidity)

        comparison = {}

        for material in material_names:
            self.simulation.set_parameter('material', material)
            self.simulation.run_simulation()

            drying_time = self.simulation.estimate_drying_time(0.08)
            final_moisture = np.mean(self.simulation.results['moisture_history'][-1])
            effective_diffusivity = self.simulation.results['effective_diffusivity']

            comparison[material] = {
                'drying_time_hours': drying_time / 3600 if drying_time > 0 else -1,
                'final_moisture': final_moisture,
                'effective_diffusivity': effective_diffusivity
            }

        self.simulation.config = base_config
        return comparison

    def generate_sensitivity_report(self) -> str:
        report = "参数敏感性分析报告\n"
        report += "=" * 50 + "\n\n"

        if 'temperature' in self.results:
            res = self.results['temperature']
            report += "温度敏感性分析:\n"
            for i, temp in enumerate(res['values']):
                report += f"  T={temp}°C: 干燥时间={res['drying_times'][i] / 3600:.1f}h, 最终含水率={res['final_moistures'][i] * 100:.2f}%\n"
            report += "\n"

        if 'humidity' in self.results:
            res = self.results['humidity']
            report += "湿度敏感性分析:\n"
            for i, hum in enumerate(res['values']):
                report += f"  RH={hum}%: 干燥时间={res['drying_times'][i] / 3600:.1f}h, 最终含水率={res['final_moistures'][i] * 100:.2f}%\n"
            report += "\n"

        return report
