import numpy as np
from scipy.optimize import minimize, differential_evolution
from typing import Dict, List, Callable, Optional, Tuple
import copy
from .fermentation_simulator import FermentationSimulator


class FermentationOptimizer:
    def __init__(self, base_config: Dict):
        self.base_config = base_config
        self.optimization_history = {
            "quality_scores": [],
            "temperatures": [],
            "times": [],
            "parameters": [],
            "objectives": {
                "product_yield": [],
                "substrate_utilization": [],
                "energy_cost": [],
                "time_cost": [],
                "overall_score": []
            }
        }
        self.best_result = None
        self.best_quality = 0.0
        self.optimization_weights = {
            "product_yield": 0.35,
            "substrate_utilization": 0.25,
            "energy_cost": 0.2,
            "time_cost": 0.2
        }

    def _calculate_multi_objective_score(self, simulator: FermentationSimulator,
                                         temperature: float, ferm_time: float) -> Tuple[float, Dict]:
        try:
            results = simulator.results
            states = np.asarray(results["states"])
            state_names = results["state_names"]

            ferm_type = self.base_config.get("type", "rice_wine")

            if ferm_type == "rice_wine":
                alcohol_idx = state_names.index("alcohol")
                sugar_idx = state_names.index("sugar")
                final_alcohol = states[alcohol_idx, -1]
                final_sugar = states[sugar_idx, -1]
                initial_sugar = self.base_config["initial_conditions"]["sugar_concentration"]

                product_yield = min(final_alcohol / 20.0, 1.0)
                substrate_utilization = 1.0 - min(final_sugar / initial_sugar, 1.0) if initial_sugar > 0 else 0.0
            else:
                aa_idx = state_names.index("amino_acid")
                protein_idx = state_names.index("protein")
                final_aa = states[aa_idx, -1]
                final_protein = states[protein_idx, -1]
                initial_protein = self.base_config["initial_conditions"]["protein_concentration"]

                product_yield = min(final_aa / 100.0, 1.0)
                substrate_utilization = 1.0 - min(final_protein / initial_protein, 1.0) if initial_protein > 0 else 0.0

            temp_normalized = (temperature - 15) / (40 - 15)
            energy_cost = 1.0 - 0.5 * abs(temp_normalized - 0.5) * 2.0

            max_time = self.base_config["optimization"].get("time_bounds", [24, 168])[1]
            time_cost = 1.0 - (ferm_time / max_time)

            overall_score = (
                self.optimization_weights["product_yield"] * product_yield +
                self.optimization_weights["substrate_utilization"] * substrate_utilization +
                self.optimization_weights["energy_cost"] * energy_cost +
                self.optimization_weights["time_cost"] * time_cost
            )

            objectives = {
                "product_yield": float(product_yield),
                "substrate_utilization": float(substrate_utilization),
                "energy_cost": float(energy_cost),
                "time_cost": float(time_cost),
                "overall_score": float(overall_score)
            }

            return overall_score, objectives

        except Exception as e:
            print(f"多目标评分计算错误: {e}")
            return 0.0, {}

    def objective_function(self, params: np.ndarray) -> float:
        temperature, ferm_time = params

        if not (15 <= temperature <= 40):
            return 1e6
        if not (6 <= ferm_time <= 720):
            return 1e6

        config = copy.deepcopy(self.base_config)
        config["fermentation"]["target_temperature"] = float(temperature)
        config["fermentation"]["total_time"] = float(ferm_time)

        simulator = FermentationSimulator(config_dict=config)

        try:
            simulator.run_simulation()
            quality_score, objectives = self._calculate_multi_objective_score(
                simulator, temperature, ferm_time
            )
        except Exception as e:
            print(f"仿真出错: {e}")
            return 1e6

        self.optimization_history["quality_scores"].append(quality_score)
        self.optimization_history["temperatures"].append(float(temperature))
        self.optimization_history["times"].append(float(ferm_time))
        self.optimization_history["parameters"].append(params.tolist())

        for key, value in objectives.items():
            if key in self.optimization_history["objectives"]:
                self.optimization_history["objectives"][key].append(value)

        if quality_score > self.best_quality:
            self.best_quality = quality_score
            self.best_result = {
                "temperature": float(temperature),
                "ferm_time": float(ferm_time),
                "quality_score": float(quality_score),
                "objectives": objectives,
                "config": config
            }

        return -quality_score

    def optimize_local(self,
                       initial_temp: Optional[float] = None,
                       initial_time: Optional[float] = None,
                       method: str = "L-BFGS-B") -> Dict:
        opt_config = self.base_config["optimization"]
        temp_min, temp_max = opt_config.get("temperature_bounds", [20, 35])
        time_min, time_max = opt_config.get("time_bounds", [24, 168])

        temp_bounds = (max(15, temp_min), min(40, temp_max))
        time_bounds = (max(6, time_min), min(720, time_max))
        bounds = [temp_bounds, time_bounds]

        if initial_temp is None:
            initial_temp = self.base_config["fermentation"]["target_temperature"]
        if initial_time is None:
            initial_time = self.base_config["fermentation"]["total_time"]

        initial_temp = np.clip(initial_temp, temp_bounds[0], temp_bounds[1])
        initial_time = np.clip(initial_time, time_bounds[0], time_bounds[1])
        initial_guess = [initial_temp, initial_time]

        result = minimize(
            self.objective_function,
            initial_guess,
            method=method,
            bounds=bounds,
            options={"maxiter": 50, "disp": False, "ftol": 1e-4}
        )

        optimized_result = {
            "best_parameters": {
                "temperature": round(float(result.x[0]), 1),
                "fermentation_time": round(float(result.x[1]), 1)
            },
            "best_quality_score": round(float(-result.fun), 4),
            "iterations": int(result.nit),
            "success": bool(result.success),
            "message": str(result.message),
            "history": self.optimization_history,
            "weights": self.optimization_weights
        }

        optimized_result["recommendations"] = self._generate_recommendations(
            optimized_result["best_parameters"]["temperature"],
            optimized_result["best_parameters"]["fermentation_time"]
        )

        return optimized_result

    def optimize_global(self,
                        maxiter: int = 30,
                        popsize: int = 10) -> Dict:
        opt_config = self.base_config["optimization"]
        temp_min, temp_max = opt_config.get("temperature_bounds", [20, 35])
        time_min, time_max = opt_config.get("time_bounds", [24, 168])

        temp_bounds = (max(15, temp_min), min(40, temp_max))
        time_bounds = (max(6, time_min), min(720, time_max))
        bounds = [temp_bounds, time_bounds]

        result = differential_evolution(
            self.objective_function,
            bounds,
            maxiter=maxiter,
            popsize=popsize,
            disp=False,
            seed=42,
            tol=1e-4
        )

        optimized_result = {
            "best_parameters": {
                "temperature": round(float(result.x[0]), 1),
                "fermentation_time": round(float(result.x[1]), 1)
            },
            "best_quality_score": round(float(-result.fun), 4),
            "iterations": int(result.nit),
            "success": bool(result.success),
            "message": str(result.message),
            "history": self.optimization_history,
            "weights": self.optimization_weights
        }

        optimized_result["recommendations"] = self._generate_recommendations(
            optimized_result["best_parameters"]["temperature"],
            optimized_result["best_parameters"]["fermentation_time"]
        )

        return optimized_result

    def grid_search(self,
                    temp_resolution: int = 8,
                    time_resolution: int = 8) -> Dict:
        opt_config = self.base_config["optimization"]
        temp_min, temp_max = opt_config.get("temperature_bounds", [20, 35])
        time_min, time_max = opt_config.get("time_bounds", [24, 168])

        temp_min = max(15, temp_min)
        temp_max = min(40, temp_max)
        time_min = max(6, time_min)
        time_max = min(720, time_max)

        temperatures = np.linspace(temp_min, temp_max, temp_resolution)
        times = np.linspace(time_min, time_max, time_resolution)

        results_grid = np.zeros((temp_resolution, time_resolution))
        best_quality = 0.0
        best_params = None

        for i, temp in enumerate(temperatures):
            for j, time in enumerate(times):
                quality = -self.objective_function([temp, time])
                results_grid[i, j] = quality

                if quality > best_quality:
                    best_quality = quality
                    best_params = {"temperature": round(float(temp), 1), "fermentation_time": round(float(time), 1)}

        optimized_result = {
            "best_parameters": best_params,
            "best_quality_score": round(float(best_quality), 4),
            "results_grid": results_grid.tolist(),
            "temperatures": temperatures.tolist(),
            "times": times.tolist(),
            "history": self.optimization_history,
            "weights": self.optimization_weights
        }

        if best_params:
            optimized_result["recommendations"] = self._generate_recommendations(
                best_params["temperature"], best_params["fermentation_time"]
            )

        return optimized_result

    def _generate_recommendations(self, temperature: float, ferm_time: float) -> List[str]:
        recommendations = []
        ferm_type = self.base_config.get("type", "rice_wine")

        if temperature < 25:
            recommendations.append(f"低温发酵 ({temperature:.1f}℃)：风味更纯净，但发酵周期较长")
        elif temperature < 30:
            recommendations.append(f"中温发酵 ({temperature:.1f}℃)：平衡风味与发酵速度")
        else:
            recommendations.append(f"高温发酵 ({temperature:.1f}℃)：发酵速度快，但需注意杂菌污染")

        hours = ferm_time
        if hours < 48:
            recommendations.append(f"短周期发酵 ({hours:.1f}小时)：适合快速生产，底物利用率可能较低")
        elif hours < 120:
            recommendations.append(f"标准周期发酵 ({hours:.1f}小时)：平衡产量与生产效率")
        else:
            recommendations.append(f"长周期发酵 ({hours:.1f}小时)：风味更丰富，适合高端产品")

        if ferm_type == "rice_wine":
            if temperature < 28 and ferm_time > 72:
                recommendations.append("推荐：低温长时间发酵，适合传统黄酒工艺")
            elif temperature > 32 and ferm_time < 48:
                recommendations.append("注意：高温短周期发酵，需监控酒精浓度和风味变化")
        elif ferm_type == "soy_sauce":
            if temperature < 30 and ferm_time > 120:
                recommendations.append("推荐：中低温长周期发酵，适合酱油的酶解和风味形成")

        recommendations.append(f"预计能耗：{'低' if temperature < 26 else '中' if temperature < 32 else '高'}")

        return recommendations

    def get_optimization_history(self) -> Dict:
        return self.optimization_history

    def set_optimization_weights(self, weights: Dict[str, float]):
        for key in weights:
            if key in self.optimization_weights:
                self.optimization_weights[key] = weights[key]

        total = sum(self.optimization_weights.values())
        if abs(total - 1.0) > 1e-6:
            for key in self.optimization_weights:
                self.optimization_weights[key] /= total
            print(f"权重已归一化，总和: {sum(self.optimization_weights.values())}")

    def get_best_result(self) -> Optional[Dict]:
        return self.best_result

    def clear_history(self):
        self.optimization_history = {
            "quality_scores": [],
            "temperatures": [],
            "times": [],
            "parameters": [],
            "objectives": {
                "product_yield": [],
                "substrate_utilization": [],
                "energy_cost": [],
                "time_cost": [],
                "overall_score": []
            }
        }
        self.best_result = None
        self.best_quality = 0.0


class MultiParameterOptimizer(FermentationOptimizer):
    def __init__(self, base_config: Dict):
        super().__init__(base_config)
        self.parameter_bounds = {}
        self.param_history = []

    def set_parameter_bounds(self, parameter_name: str, bounds: Tuple[float, float]):
        if len(bounds) != 2 or bounds[0] >= bounds[1]:
            raise ValueError(f"参数范围无效: {bounds}，最小值必须小于最大值")
        self.parameter_bounds[parameter_name] = bounds

    def objective_multi_param(self, params: np.ndarray, param_names: List[str]) -> float:
        config = copy.deepcopy(self.base_config)

        for param_name, value in zip(param_names, params):
            keys = param_name.split(".")
            current = config
            for key in keys[:-1]:
                current = current[key]
            current[keys[-1]] = float(value)

        simulator = FermentationSimulator(config_dict=config)

        try:
            simulator.run_simulation()
            temp = config["fermentation"]["target_temperature"]
            time_val = config["fermentation"]["total_time"]
            quality_score, objectives = self._calculate_multi_objective_score(
                simulator, temp, time_val
            )
        except Exception as e:
            print(f"仿真出错: {e}")
            return 1e6

        return -quality_score

    def optimize_multiple(self, param_names: List[str], method: str = "L-BFGS-B") -> Dict:
        bounds = []
        initial_guess = []

        for param_name in param_names:
            if param_name not in self.parameter_bounds:
                raise ValueError(f"参数 {param_name} 未设置范围，请先调用 set_parameter_bounds")

            param_bounds = self.parameter_bounds[param_name]
            bounds.append(param_bounds)

            keys = param_name.split(".")
            current = self.base_config
            for key in keys:
                current = current[key]
            initial_val = float(current)
            initial_val = np.clip(initial_val, param_bounds[0], param_bounds[1])
            initial_guess.append(initial_val)

        def objective(params):
            return self.objective_multi_param(params, param_names)

        result = minimize(
            objective,
            initial_guess,
            method=method,
            bounds=bounds,
            options={"maxiter": 100, "disp": False, "ftol": 1e-4}
        )

        best_params = {name: round(float(val), 4) for name, val in zip(param_names, result.x)}

        optimized_result = {
            "best_parameters": best_params,
            "best_quality_score": round(float(-result.fun), 4),
            "iterations": int(result.nit),
            "success": bool(result.success),
            "message": str(result.message),
            "initial_guess": [round(float(val), 4) for val in initial_guess],
            "parameter_bounds": self.parameter_bounds
        }

        param_descriptions = {
            "fermentation.target_temperature": "目标发酵温度",
            "fermentation.total_time": "总发酵时间",
            "kinetics.yeast_growth_rate": "酵母生长速率",
            "kinetics.bacteria_growth_rate": "细菌生长速率",
            "initial_conditions.ph": "初始pH值"
        }

        recommendations = []
        for name, value in best_params.items():
            desc = param_descriptions.get(name, name)
            recommendations.append(f"{desc}: {value}")
        optimized_result["recommendations"] = recommendations

        return optimized_result


class HistoryBasedOptimizer:
    def __init__(self):
        self.historical_data = []
        self.surrogate_model = None

    def add_historical_run(self, config: Dict, quality_score: float, results: Dict = None):
        self.historical_data.append({
            "config": config,
            "quality_score": quality_score,
            "results": results
        })

    def load_historical_batch(self, data_list: List[Dict]):
        for data in data_list:
            self.historical_data.append(data)

    def get_optimal_parameters_from_history(self, top_k: int = 5) -> Dict:
        if not self.historical_data:
            raise ValueError("没有历史数据")

        sorted_runs = sorted(self.historical_data, key=lambda x: x["quality_score"], reverse=True)
        top_runs = sorted_runs[:top_k]

        temp_values = [run["config"]["fermentation"]["target_temperature"] for run in top_runs]
        time_values = [run["config"]["fermentation"]["total_time"] for run in top_runs]

        return {
            "recommended_temperature": float(np.mean(temp_values)),
            "recommended_fermentation_time": float(np.mean(time_values)),
            "temperature_std": float(np.std(temp_values)),
            "time_std": float(np.std(time_values)),
            "best_quality_score": float(top_runs[0]["quality_score"]),
            "top_runs": top_runs
        }

    def suggest_next_parameters(self, exploration_factor: float = 0.1) -> Dict:
        recommendation = self.get_optimal_parameters_from_history()

        base_temp = recommendation["recommended_temperature"]
        base_time = recommendation["recommended_fermentation_time"]

        suggested_temp = base_temp + np.random.normal(0, recommendation["temperature_std"] * exploration_factor)
        suggested_time = base_time + np.random.normal(0, recommendation["time_std"] * exploration_factor)

        opt_config = self.historical_data[0]["config"]["optimization"]
        temp_min, temp_max = opt_config["temperature_bounds"]
        time_min, time_max = opt_config["time_bounds"]

        suggested_temp = np.clip(suggested_temp, temp_min, temp_max)
        suggested_time = np.clip(suggested_time, time_min, time_max)

        return {
            "suggested_temperature": float(suggested_temp),
            "suggested_fermentation_time": float(suggested_time),
            "based_on_history": len(self.historical_data)
        }

    def get_history_statistics(self) -> Dict:
        if not self.historical_data:
            return {}

        quality_scores = [run["quality_score"] for run in self.historical_data]
        temperatures = [run["config"]["fermentation"]["target_temperature"] for run in self.historical_data]
        times = [run["config"]["fermentation"]["total_time"] for run in self.historical_data]

        return {
            "total_runs": len(self.historical_data),
            "quality_score": {
                "mean": float(np.mean(quality_scores)),
                "std": float(np.std(quality_scores)),
                "max": float(np.max(quality_scores)),
                "min": float(np.min(quality_scores))
            },
            "temperature": {
                "mean": float(np.mean(temperatures)),
                "std": float(np.std(temperatures))
            },
            "fermentation_time": {
                "mean": float(np.mean(times)),
                "std": float(np.std(times))
            }
        }
