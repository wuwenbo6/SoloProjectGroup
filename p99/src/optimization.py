import numpy as np
from typing import Dict, List, Tuple, Callable, Optional
from scipy.optimize import minimize
from sklearn.metrics import mean_squared_error
from .simulation import KilnSimulation


class ObjectiveFunction:
    def __init__(self, target_temp_profile: List[List[float]],
                 weights: Optional[Dict] = None,
                 constraints: Optional[Dict] = None):
        self.target_temp_profile = target_temp_profile
        self.weights = weights or {
            'temperature_error': 10.0,
            'heating_rate_penalty': 100.0,
            'cooling_rate_penalty': 50.0,
            'time_efficiency': 0.0001,
            'drying_quality': 100.0,
            'firing_quality': 100.0,
            'soaking_penalty': 50.0
        }
        self.constraints = constraints or {
            'max_heating_rate': 2.0 / 60.0,
            'max_cooling_rate': 3.0 / 60.0,
            'drying_temp_min': 373.15,
            'drying_temp_max': 473.15,
            'drying_time_min': 3600,
            'soaking_temp': 1273.15,
            'soaking_time_min': 7200,
            'max_firing_temp': 1573.15,
            'min_initial_temp': 293.15,
            'max_initial_temp': 323.15
        }

    def evaluate(self, simulation: KilnSimulation, results: Dict) -> float:
        score = 0.0

        time = results['time']
        temp_kiln = results['kiln_temperature']
        dt = time[1] - time[0] if len(time) > 1 else 1.0

        target_times = [p[0] for p in self.target_temp_profile]
        target_temps = [p[1] for p in self.target_temp_profile]

        from scipy.interpolate import interp1d
        target_interp = interp1d(target_times, target_temps,
                                  kind='linear', bounds_error=False,
                                  fill_value=(target_temps[0], target_temps[-1]))
        target_at_sim = target_interp(time)

        temp_error = np.mean((temp_kiln - target_at_sim) ** 2)
        score += self.weights['temperature_error'] * temp_error

        heating_rate = np.gradient(temp_kiln, time)

        excess_heating = np.maximum(0, heating_rate - self.constraints['max_heating_rate'])
        excess_cooling = np.maximum(0, -heating_rate - self.constraints['max_cooling_rate'])

        score += self.weights['heating_rate_penalty'] * np.sum(excess_heating ** 2) * dt
        score += self.weights['cooling_rate_penalty'] * np.sum(excess_cooling ** 2) * dt

        drying_mask = (temp_kiln >= self.constraints['drying_temp_min']) & \
                      (temp_kiln <= self.constraints['drying_temp_max'])
        drying_time = np.sum(drying_mask) * dt

        if drying_time < self.constraints['drying_time_min']:
            drying_deficit = self.constraints['drying_time_min'] - drying_time
            score += self.weights['drying_quality'] * (drying_deficit / 3600) ** 2

        soaking_mask = (temp_kiln >= self.constraints['soaking_temp'] - 50)
        soaking_time = np.sum(soaking_mask) * dt

        if soaking_time < self.constraints['soaking_time_min']:
            soaking_deficit = self.constraints['soaking_time_min'] - soaking_time
            score += self.weights['soaking_penalty'] * (soaking_deficit / 3600) ** 2

        max_temp = np.max(temp_kiln)
        if max_temp > self.constraints['max_firing_temp']:
            excess = max_temp - self.constraints['max_firing_temp']
            score += 1000.0 * excess

        initial_temp = temp_kiln[0]
        if initial_temp < self.constraints['min_initial_temp'] or \
           initial_temp > self.constraints['max_initial_temp']:
            score += 1000.0

        total_time = time[-1] - time[0]
        score += self.weights['time_efficiency'] * total_time

        if 'water_remaining' in results:
            final_water = results['water_remaining'][-1]
            max_water = np.max(results['water_remaining'])
            if max_water > 0:
                mid_idx = len(results['water_remaining']) // 2
                mid_water = results['water_remaining'][mid_idx]
                if mid_water > 0.5 * max_water:
                    score += 100.0 * mid_water

            if final_water > 0.001:
                score += 1000.0 * final_water

        if 'organic_remaining' in results:
            final_organic = results['organic_remaining'][-1]
            if final_organic > 0.001:
                score += 1000.0 * final_organic

        if 'temperature' in results:
            temp_body = results['temperature']
            temp_diff = temp_body[:, -1] - temp_body[:, 0]
            max_diff = np.max(np.abs(temp_diff))
            if max_diff > 100.0:
                score += 10.0 * (max_diff - 100.0) / 100.0

        return score


class ParameterOptimizer:
    def __init__(self, base_config: Dict):
        self.base_config = base_config
        self.objective = None
        self.best_params = None
        self.optimization_history = []
        self._validation_report = None

    def set_objective(self, objective: ObjectiveFunction):
        self.objective = objective

    def _params_to_config(self, params: np.ndarray, param_names: List[str]) -> Dict:
        import copy
        config = copy.deepcopy(self.base_config)

        idx = 0
        if 'heating_rates' in param_names:
            n_points = len(config['temperature_profile'])
            config['temperature_profile'] = self._decode_temperature_profile(
                params[idx:idx + n_points], n_points
            )
            idx += n_points

        if 'soak_time' in param_names:
            if 'soak_times' in config:
                config['soak_times'] = list(params[idx:idx + len(config['soak_times'])])
            idx += len(config.get('soak_times', [1]))

        if 'heat_transfer' in param_names:
            config['kiln']['heat_transfer_coeff'] = params[idx]
            idx += 1

        return config

    def _decode_temperature_profile(self, temp_params: np.ndarray, n_points: int) -> List[List[float]]:
        total_time = self.base_config['simulation']['total_time']
        times = np.linspace(0, total_time, n_points)

        temp_params = np.asarray(temp_params)
        temp_params = np.maximum(temp_params, 273.15)
        temp_params = np.minimum(temp_params, 1800.0)

        temp_smoothed = self._apply_monotonic_constraints(times, temp_params)

        profile = []
        for i in range(n_points):
            profile.append([float(times[i]), float(temp_smoothed[i])])

        return profile

    def _apply_monotonic_constraints(self, times: np.ndarray, temps: np.ndarray) -> np.ndarray:
        temps_smoothed = temps.copy()

        if temps_smoothed[0] < 293.15 or temps_smoothed[0] > 323.15:
            temps_smoothed[0] = 298.15

        n = len(temps_smoothed)
        max_rate = 2.0 / 60.0

        for i in range(1, n):
            dt = times[i] - times[i-1]
            max_temp_change = max_rate * dt

            if temps_smoothed[i] > temps_smoothed[i-1] + max_temp_change:
                temps_smoothed[i] = temps_smoothed[i-1] + max_temp_change

        cooling_start = int(n * 0.7)
        for i in range(n-2, max(cooling_start, 0), -1):
            dt = times[i+1] - times[i]
            max_cool_change = 3.0 / 60.0 * dt
            if temps_smoothed[i] > temps_smoothed[i+1] + max_cool_change:
                temps_smoothed[i] = temps_smoothed[i+1] + max_cool_change

        return temps_smoothed

    def _objective_wrapper(self, params: np.ndarray, param_names: List[str]) -> float:
        try:
            config = self._params_to_config(params, param_names)
            sim = KilnSimulation(config)
            results = sim.run()

            score = self.objective.evaluate(sim, results)
            self.optimization_history.append({
                'params': params.copy(),
                'score': float(score)
            })

            return float(score)
        except Exception as e:
            print(f"评估参数时出错: {e}")
            return 1e12

    def optimize_temperature_profile(self, n_iterations: int = 100) -> Tuple[Dict, float]:
        if self.objective is None:
            raise ValueError("请先设置目标函数")

        n_points = len(self.base_config['temperature_profile'])
        initial_temps = [p[1] for p in self.base_config['temperature_profile']]
        initial_params = np.array(initial_temps, dtype=np.float64)

        bounds = [(273.15, 1800.0) for _ in range(n_points)]

        from scipy.optimize import minimize

        result = minimize(
            self._objective_wrapper,
            initial_params,
            args=(['heating_rates'],),
            method='L-BFGS-B',
            bounds=bounds,
            options={
                'maxiter': n_iterations,
                'disp': True,
                'iprint': 10,
                'ftol': 1e-6,
                'gtol': 1e-6
            }
        )

        best_config = self._params_to_config(result.x, ['heating_rates'])
        self.best_params = best_config

        self._validate_and_report(best_config)

        return best_config, result.fun

    def _validate_and_report(self, config: Dict):
        sim = KilnSimulation(config)
        results = sim.run()

        report = {
            'drying_complete': results.get('water_remaining', [0])[-1] <= 0.001,
            'organic_complete': results.get('organic_remaining', [0])[-1] <= 0.001,
            'max_heating_rate_ok': True,
            'max_cooling_rate_ok': True,
            'final_temp_ok': True
        }

        temp_kiln = results['kiln_temperature']
        time = results['time']
        heating_rate = np.gradient(temp_kiln, time)

        if np.max(heating_rate) > self.objective.constraints['max_heating_rate'] * 1.1:
            report['max_heating_rate_ok'] = False

        if np.max(-heating_rate) > self.objective.constraints['max_cooling_rate'] * 1.1:
            report['max_cooling_rate_ok'] = False

        self._validation_report = report
        return report

    def get_validation_report(self) -> Optional[Dict]:
        return self._validation_report

    def optimize_multi_parameter(self, param_names: List[str],
                                  n_iterations: int = 100) -> Tuple[Dict, float]:
        if self.objective is None:
            raise ValueError("请先设置目标函数")

        initial_params = []
        bounds = []

        if 'heating_rates' in param_names:
            n_points = len(self.base_config['temperature_profile'])
            initial_temps = [p[1] for p in self.base_config['temperature_profile']]
            initial_params.extend(initial_temps)
            bounds.extend([(273.15, 1800.0) for _ in range(n_points)])

        if 'heat_transfer' in param_names:
            initial_params.append(self.base_config['kiln']['heat_transfer_coeff'])
            bounds.append((5.0, 50.0))

        initial_params = np.array(initial_params)

        result = minimize(
            self._objective_wrapper,
            initial_params,
            args=(param_names,),
            method='L-BFGS-B',
            bounds=bounds,
            options={
                'maxiter': n_iterations,
                'disp': True
            }
        )

        best_config = self._params_to_config(result.x, param_names)
        self.best_params = best_config

        return best_config, result.fun

    def grid_search(self, param_ranges: Dict, n_samples: int = 10) -> Tuple[Dict, float]:
        if self.objective is None:
            raise ValueError("请先设置目标函数")

        param_names = list(param_ranges.keys())
        param_values = [np.linspace(*r, n_samples) for r in param_ranges.values()]

        best_score = float('inf')
        best_config = None

        from itertools import product
        for combo in product(*param_values):
            config = self.base_config.copy()
            for name, value in zip(param_names, combo):
                if name == 'heat_transfer_coeff':
                    config['kiln']['heat_transfer_coeff'] = value

            try:
                sim = KilnSimulation(config)
                results = sim.run()
                score = self.objective.evaluate(sim, results)

                if score < best_score:
                    best_score = score
                    best_config = config
            except Exception as e:
                print(f"参数组合评估失败: {e}")

        self.best_params = best_config
        return best_config, best_score

    def get_optimization_history(self) -> List[Dict]:
        return self.optimization_history

    def save_optimization_results(self, filepath: str):
        import json
        results = {
            'best_params': self.best_params,
            'history': [
                {'params': h['params'].tolist(), 'score': h['score']}
                for h in self.optimization_history
            ]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)


class QualityMetrics:
    @staticmethod
    def calculate_uniformity(results: Dict) -> float:
        temp = results['temperature']
        final_temp = temp[-1, :]
        mean_temp = np.mean(final_temp)
        std_temp = np.std(final_temp)
        return std_temp / mean_temp if mean_temp > 0 else float('inf')

    @staticmethod
    def calculate_heating_smoothness(results: Dict) -> float:
        temp_kiln = results['kiln_temperature']
        time = results['time']
        heating_rate = np.gradient(temp_kiln, time)
        return np.std(heating_rate)

    @staticmethod
    def calculate_drying_quality(results: Dict) -> Dict[str, float]:
        water = results.get('water_remaining')
        if water is None:
            return {}

        drying_time = np.argmax(water < 0.001) * (results['time'][1] - results['time'][0])
        drying_rate = (water[0] - water[-1]) / (results['time'][-1] - results['time'][0])

        return {
            'drying_time_hours': drying_time / 3600,
            'final_water_content': float(water[-1]),
            'average_drying_rate': float(drying_rate * 3600)
        }

    @staticmethod
    def calculate_energy_efficiency(results: Dict) -> float:
        time = results['time']
        temp_kiln = results['kiln_temperature']
        total_time = time[-1] - time[0]
        avg_temp = np.mean(temp_kiln)
        return total_time * avg_temp

    @staticmethod
    def summary(results: Dict) -> Dict[str, float]:
        metrics = {
            'temperature_uniformity': QualityMetrics.calculate_uniformity(results),
            'heating_smoothness': QualityMetrics.calculate_heating_smoothness(results),
            'energy_efficiency': QualityMetrics.calculate_energy_efficiency(results)
        }

        drying = QualityMetrics.calculate_drying_quality(results)
        metrics.update(drying)

        return metrics
