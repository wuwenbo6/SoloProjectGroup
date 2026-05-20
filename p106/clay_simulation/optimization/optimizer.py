import numpy as np
from typing import Dict, Tuple, Optional, List, Callable
from dataclasses import dataclass
from scipy.optimize import minimize, differential_evolution, shgo
from scipy.interpolate import interp1d
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
try:
    from ..data_acquisition import ClayParameter, ParameterCollector
    from ..force_simulation import ForceSimulator, SimulationConfig, SimulationResult
except ImportError:
    from data_acquisition import ClayParameter, ParameterCollector
    from force_simulation import ForceSimulator, SimulationConfig, SimulationResult


@dataclass
class OptimizationConstraints:
    target_safety_factor: float = 1.5
    max_allowable_stress: Optional[float] = None
    max_allowable_deformation: Optional[float] = None
    moisture_range: Tuple[float, float] = (0.18, 0.30)
    plasticity_range: Tuple[float, float] = (10.0, 30.0)
    force_range: Tuple[float, float] = (500.0, 5000.0)
    clay_types: Optional[List[str]] = None
    min_youngs_modulus: float = 1e6
    max_youngs_modulus: float = 1e7


@dataclass
class OptimizationResult:
    optimal_parameters: Dict
    optimal_clay_type: str
    predicted_stress: float
    predicted_deformation: float
    safety_factor: float
    objective_value: float
    optimization_history: Optional[List[Dict]] = None


class ParameterOptimizer:
    def __init__(self, collector: Optional[ParameterCollector] = None):
        self.collector = collector or ParameterCollector()
        self.simulator = ForceSimulator(self.collector)
        self.surrogate_model = None
        self.optimization_history = []

    def _objective_function(self, x: np.ndarray, config_base: SimulationConfig,
                          constraints: OptimizationConstraints,
                          weights: Dict[str, float]) -> float:
        moisture_content = x[0]
        force_magnitude = x[1]
        clay_type_idx = int(np.clip(x[2], 0, len(constraints.clay_types) - 1)) if len(x) > 2 else 0

        clay_type = constraints.clay_types[clay_type_idx] if constraints.clay_types else config_base.clay_type

        clay_param = self.collector.get_clay_parameter(clay_type)
        if not clay_param:
            return 1e10

        original_moisture = clay_param.moisture_content
        temp_clay = ClayParameter(
            name=clay_param.name,
            clay_type=f"{clay_type}_opt_temp",
            moisture_content=moisture_content,
            density=clay_param.density,
            youngs_modulus=clay_param.youngs_modulus,
            poissons_ratio=clay_param.poissons_ratio,
            yield_strength=clay_param.yield_strength,
            viscosity=clay_param.viscosity,
            particle_size=clay_param.particle_size,
            organic_content=clay_param.organic_content
        )
        self.collector.add_clay_parameter(temp_clay)

        try:
            derived_props = self.collector.calculate_derived_properties(clay_type)
            plasticity_index = derived_props['plasticity_index']
        except Exception:
            clay_param.moisture_content = original_moisture
            return 1e10

        try:
            temp_config = SimulationConfig(
                clay_type=f"{clay_type}_opt_temp",
                force_magnitude=force_magnitude,
                force_direction=config_base.force_direction,
                grid_size=config_base.grid_size,
                simulation_time=0,
                time_steps=0
            )

            result = self.simulator.run_simulation(temp_config)

            max_stress = np.max(result.von_mises_stress)
            max_deformation = np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2))
            safety_factor = clay_param.yield_strength / max_stress

            clay_param.moisture_content = original_moisture

        except Exception:
            clay_param.moisture_content = original_moisture
            return 1e10

        objective = 0.0

        if weights.get('minimize_stress', 0) > 0:
            objective += weights['minimize_stress'] * max_stress / 1e4

        if weights.get('minimize_deformation', 0) > 0:
            objective += weights['minimize_deformation'] * max_deformation * 100

        if weights.get('maximize_safety_factor', 0) > 0:
            objective -= weights['maximize_safety_factor'] * safety_factor

        if weights.get('maximize_force_magnitude', 0) > 0:
            objective -= weights['maximize_force_magnitude'] * force_magnitude / 1e3

        if weights.get('optimize_plasticity', 0) > 0:
            plasticity_penalty = abs(plasticity_index - (constraints.plasticity_range[0] + constraints.plasticity_range[1]) / 2)
            objective += weights['optimize_plasticity'] * plasticity_penalty

        penalty = 0.0
        if constraints.target_safety_factor and safety_factor < constraints.target_safety_factor:
            penalty += 1e3 * (constraints.target_safety_factor - safety_factor) ** 2

        if constraints.max_allowable_stress and max_stress > constraints.max_allowable_stress:
            penalty += 1e3 * ((max_stress - constraints.max_allowable_stress) / 1e3) ** 2

        if constraints.max_allowable_deformation and max_deformation > constraints.max_allowable_deformation:
            penalty += 1e3 * (max_deformation - constraints.max_allowable_deformation) ** 2

        if not (constraints.plasticity_range[0] <= plasticity_index <= constraints.plasticity_range[1]):
            if plasticity_index < constraints.plasticity_range[0]:
                penalty += 1e2 * (constraints.plasticity_range[0] - plasticity_index) ** 2
            else:
                penalty += 1e2 * (plasticity_index - constraints.plasticity_range[1]) ** 2

        if not (constraints.min_youngs_modulus <= clay_param.youngs_modulus <= constraints.max_youngs_modulus):
            penalty += 1e3

        self.optimization_history.append({
            'moisture': moisture_content,
            'force': force_magnitude,
            'clay_type': clay_type,
            'max_stress': max_stress,
            'max_deformation': max_deformation,
            'safety_factor': safety_factor,
            'plasticity_index': plasticity_index,
            'objective': objective + penalty
        })

        return objective + penalty

    def optimize_parameters(self, base_config: SimulationConfig,
                           constraints: OptimizationConstraints,
                           weights: Optional[Dict[str, float]] = None,
                           method: str = 'differential_evolution',
                           n_iterations: int = 50) -> OptimizationResult:
        if weights is None:
            weights = {
                'minimize_stress': 1.0,
                'minimize_deformation': 0.8,
                'maximize_safety_factor': 1.5,
                'maximize_force_magnitude': 0.0,
                'optimize_plasticity': 0.5
            }

        if constraints.clay_types is None:
            constraints.clay_types = self.collector.list_available_clays()

        self.optimization_history = []

        bounds = [
            constraints.moisture_range,
            constraints.force_range
        ]

        if len(constraints.clay_types) > 1:
            bounds.append((0, len(constraints.clay_types) - 1))

        def callback(xk, convergence=None):
            pass

        if method == 'differential_evolution':
            result = differential_evolution(
                self._objective_function,
                bounds,
                args=(base_config, constraints, weights),
                maxiter=n_iterations,
                popsize=15,
                mutation=(0.5, 1.0),
                recombination=0.7,
                callback=callback,
                seed=42
            )
        elif method == 'shgo':
            result = shgo(
                self._objective_function,
                bounds,
                args=(base_config, constraints, weights),
                n=100,
                iters=5,
                callback=callback
            )
        elif method == 'nelder-mead':
            x0 = np.array([
                (constraints.moisture_range[0] + constraints.moisture_range[1]) / 2,
                (constraints.force_range[0] + constraints.force_range[1]) / 2,
                0 if len(constraints.clay_types) > 1 else None
            ])
            if x0[-1] is None:
                x0 = x0[:-1]
            result = minimize(
                self._objective_function,
                x0,
                args=(base_config, constraints, weights),
                method='Nelder-Mead',
                options={'maxiter': n_iterations * 10}
            )
        else:
            raise ValueError(f"Unknown optimization method: {method}")

        optimal_x = result.x

        optimal_moisture = optimal_x[0]
        optimal_force = optimal_x[1]

        if len(optimal_x) > 2:
            optimal_clay_idx = int(np.clip(optimal_x[2], 0, len(constraints.clay_types) - 1))
            optimal_clay_type = constraints.clay_types[optimal_clay_idx]
        else:
            optimal_clay_type = base_config.clay_type

        clay_param = self.collector.get_clay_parameter(optimal_clay_type)
        clay_param.moisture_content = optimal_moisture
        self.collector.add_clay_parameter(f"{optimal_clay_type}_optimal", clay_param)

        final_config = SimulationConfig(
            clay_type=f"{optimal_clay_type}_optimal",
            force_magnitude=optimal_force,
            force_direction=base_config.force_direction,
            grid_size=base_config.grid_size,
            simulation_time=0,
            time_steps=0
        )

        final_result = self.simulator.run_simulation(final_config)

        opt_result = OptimizationResult(
            optimal_parameters={
                'moisture_content': optimal_moisture,
                'force_magnitude': optimal_force,
                'force_direction': base_config.force_direction
            },
            optimal_clay_type=optimal_clay_type,
            predicted_stress=np.max(final_result.von_mises_stress),
            predicted_deformation=np.max(np.sqrt(final_result.displacement[0] ** 2 + final_result.displacement[1] ** 2)),
            safety_factor=clay_param.yield_strength / np.max(final_result.von_mises_stress),
            objective_value=result.fun,
            optimization_history=self.optimization_history
        )

        return opt_result

    def grid_search_optimization(self, base_config: SimulationConfig,
                               constraints: OptimizationConstraints,
                               weights: Optional[Dict[str, float]] = None,
                               resolution: int = 10) -> OptimizationResult:
        if weights is None:
            weights = {
                'minimize_stress': 1.0,
                'minimize_deformation': 1.0,
                'maximize_safety_factor': 0.5
            }

        if constraints.clay_types is None:
            constraints.clay_types = self.collector.list_available_clays()

        self.optimization_history = []

        moisture_values = np.linspace(*constraints.moisture_range, resolution)
        force_values = np.linspace(*constraints.force_range, resolution)

        best_result = None
        best_objective = float('inf')

        for clay_type in constraints.clay_types:
            for moisture in moisture_values:
                for force in force_values:
                    clay_param = self.collector.get_clay_parameter(clay_type)
                    if not clay_param:
                        continue

                    original_moisture = clay_param.moisture_content
                    temp_clay = ClayParameter(
                        name=clay_param.name,
                        clay_type=f"{clay_type}_grid_{moisture:.2f}",
                        moisture_content=moisture,
                        density=clay_param.density,
                        youngs_modulus=clay_param.youngs_modulus,
                        poissons_ratio=clay_param.poissons_ratio,
                        yield_strength=clay_param.yield_strength,
                        viscosity=clay_param.viscosity,
                        particle_size=clay_param.particle_size,
                        organic_content=clay_param.organic_content
                    )
                    self.collector.add_clay_parameter(temp_clay)

                    try:
                        temp_config = SimulationConfig(
                            clay_type=f"{clay_type}_grid_{moisture:.2f}",
                            force_magnitude=force,
                            force_direction=base_config.force_direction,
                            grid_size=base_config.grid_size,
                            simulation_time=0,
                            time_steps=0
                        )

                        result = self.simulator.run_simulation(temp_config)

                        max_stress = np.max(result.von_mises_stress)
                        max_deformation = np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2))
                        safety_factor = clay_param.yield_strength / max_stress

                        objective = 0.0
                        objective += weights.get('minimize_stress', 0) * max_stress
                        objective += weights.get('minimize_deformation', 0) * max_deformation
                        objective -= weights.get('maximize_safety_factor', 0) * safety_factor

                        valid = True
                        if constraints.target_safety_factor and safety_factor < constraints.target_safety_factor:
                            valid = False
                        if constraints.max_allowable_stress and max_stress > constraints.max_allowable_stress:
                            valid = False
                        if constraints.max_allowable_deformation and max_deformation > constraints.max_allowable_deformation:
                            valid = False

                        if valid and objective < best_objective:
                            best_objective = objective
                            best_result = OptimizationResult(
                                optimal_parameters={
                                    'moisture_content': moisture,
                                    'force_magnitude': force,
                                    'force_direction': base_config.force_direction
                                },
                                optimal_clay_type=clay_type,
                                predicted_stress=max_stress,
                                predicted_deformation=max_deformation,
                                safety_factor=safety_factor,
                                objective_value=objective
                            )

                        self.optimization_history.append({
                            'moisture': moisture,
                            'force': force,
                            'clay_type': clay_type,
                            'max_stress': max_stress,
                            'max_deformation': max_deformation,
                            'safety_factor': safety_factor,
                            'objective': objective,
                            'valid': valid
                        })

                    except Exception:
                        pass

                    clay_param.moisture_content = original_moisture

        if best_result:
            best_result.optimization_history = self.optimization_history

        return best_result

    def multi_objective_optimization(self, base_config: SimulationConfig,
                                    constraints: OptimizationConstraints,
                                    objectives: List[str],
                                    n_samples: int = 100) -> List[OptimizationResult]:
        pareto_front = []

        results = self.grid_search_optimization(
            base_config,
            constraints,
            resolution=int(np.sqrt(n_samples))
        )

        if not results.optimization_history:
            return []

        valid_results = [r for r in results.optimization_history if r.get('valid', True)]

        for r in valid_results:
            dominated = False
            for other in valid_results:
                if other is r:
                    continue

                if (other.get('max_stress', float('inf')) <= r.get('max_stress', float('inf')) and
                    other.get('max_deformation', float('inf')) <= r.get('max_deformation', float('inf')) and
                    other.get('safety_factor', 0) >= r.get('safety_factor', 0) and
                    (other.get('max_stress', float('inf')) < r.get('max_stress', float('inf')) or
                     other.get('max_deformation', float('inf')) < r.get('max_deformation', float('inf')) or
                     other.get('safety_factor', 0) > r.get('safety_factor', 0))):
                    dominated = True
                    break

            if not dominated:
                pareto_result = OptimizationResult(
                    optimal_parameters={
                        'moisture_content': r['moisture'],
                        'force_magnitude': r['force'],
                        'force_direction': base_config.force_direction
                    },
                    optimal_clay_type=r['clay_type'],
                    predicted_stress=r['max_stress'],
                    predicted_deformation=r['max_deformation'],
                    safety_factor=r['safety_factor'],
                    objective_value=r['objective']
                )
                pareto_front.append(pareto_result)

        return pareto_front

    def build_surrogate_model(self, base_config: SimulationConfig,
                            n_training_samples: int = 200) -> None:
        clay_types = self.collector.list_available_clays()
        X = []
        y_stress = []
        y_deformation = []

        for _ in range(n_training_samples):
            clay_type = np.random.choice(clay_types)
            moisture = np.random.uniform(0.15, 0.40)
            force = np.random.uniform(100, 10000)

            clay_param = self.collector.get_clay_parameter(clay_type)
            if not clay_param:
                continue

            original_moisture = clay_param.moisture_content
            temp_clay = ClayParameter(
                name=clay_param.name,
                clay_type=f"{clay_type}_surrogate_{_}",
                moisture_content=moisture,
                density=clay_param.density,
                youngs_modulus=clay_param.youngs_modulus,
                poissons_ratio=clay_param.poissons_ratio,
                yield_strength=clay_param.yield_strength,
                viscosity=clay_param.viscosity,
                particle_size=clay_param.particle_size,
                organic_content=clay_param.organic_content
            )
            self.collector.add_clay_parameter(temp_clay)

            try:
                temp_config = SimulationConfig(
                    clay_type=f"{clay_type}_surrogate_{_}",
                    force_magnitude=force,
                    force_direction=(0, -1),
                    grid_size=(20, 20),
                    simulation_time=0,
                    time_steps=0
                )

                result = self.simulator.run_simulation(temp_config)
                max_stress = np.max(result.von_mises_stress)
                max_deformation = np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2))

                clay_type_encoded = clay_types.index(clay_type)
                X.append([moisture, force, clay_type_encoded])
                y_stress.append(max_stress)
                y_deformation.append(max_deformation)

            except Exception:
                pass

            clay_param.moisture_content = original_moisture

        X = np.array(X)
        y_stress = np.array(y_stress)
        y_deformation = np.array(y_deformation)

        if len(X) > 0:
            self.surrogate_model = {
                'stress_model': RandomForestRegressor(n_estimators=50, random_state=42).fit(X, y_stress),
                'deformation_model': RandomForestRegressor(n_estimators=50, random_state=42).fit(X, y_deformation),
                'clay_types': clay_types
            }

    def predict_with_surrogate(self, moisture: float, force: float,
                            clay_type: str) -> Tuple[float, float]:
        if self.surrogate_model is None:
            raise ValueError("Surrogate model not built yet")

        clay_type_encoded = self.surrogate_model['clay_types'].index(clay_type)
        X = np.array([[moisture, force, clay_type_encoded]])

        predicted_stress = self.surrogate_model['stress_model'].predict(X)[0]
        predicted_deformation = self.surrogate_model['deformation_model'].predict(X)[0]

        return predicted_stress, predicted_deformation

    def plot_optimization_history(self, opt_result: OptimizationResult,
                                show: bool = True,
                                save_path: Optional[str] = None) -> None:
        import matplotlib.pyplot as plt

        if not opt_result.optimization_history:
            print("No optimization history available")
            return

        history = opt_result.optimization_history

        fig, axes = plt.subplots(2, 2, figsize=(12, 10))

        iterations = range(len(history))
        objectives = [h['objective'] for h in history]
        axes[0, 0].plot(iterations, objectives, 'b-', linewidth=1)
        axes[0, 0].set_xlabel('Iteration')
        axes[0, 0].set_ylabel('Objective Value')
        axes[0, 0].set_title('Optimization Convergence')
        axes[0, 0].grid(True, alpha=0.3)

        moistures = [h['moisture'] for h in history]
        axes[0, 1].plot(iterations, moistures, 'g-', linewidth=1)
        axes[0, 1].set_xlabel('Iteration')
        axes[0, 1].set_ylabel('Moisture Content')
        axes[0, 1].set_title('Moisture Content Evolution')
        axes[0, 1].grid(True, alpha=0.3)

        forces = [h['force'] for h in history]
        axes[1, 0].plot(iterations, forces, 'r-', linewidth=1)
        axes[1, 0].set_xlabel('Iteration')
        axes[1, 0].set_ylabel('Force Magnitude')
        axes[1, 0].set_title('Force Magnitude Evolution')
        axes[1, 0].grid(True, alpha=0.3)

        safety_factors = [h['safety_factor'] for h in history]
        axes[1, 1].plot(iterations, safety_factors, 'm-', linewidth=1)
        axes[1, 1].set_xlabel('Iteration')
        axes[1, 1].set_ylabel('Safety Factor')
        axes[1, 1].set_title('Safety Factor Evolution')
        axes[1, 1].grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()

    def plot_pareto_front(self, pareto_front: List[OptimizationResult],
                        show: bool = True,
                        save_path: Optional[str] = None) -> None:
        import matplotlib.pyplot as plt

        if not pareto_front:
            print("No Pareto front results available")
            return

        stresses = [r.predicted_stress for r in pareto_front]
        deformations = [r.predicted_deformation for r in pareto_front]
        safety_factors = [r.safety_factor for r in pareto_front]
        clay_types = [r.optimal_clay_type for r in pareto_front]

        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        scatter1 = axes[0].scatter(stresses, deformations, c=safety_factors,
                                   cmap='viridis', s=100, alpha=0.7)
        axes[0].set_xlabel('Maximum Stress (Pa)')
        axes[0].set_ylabel('Maximum Deformation')
        axes[0].set_title('Pareto Front: Stress vs Deformation')
        axes[0].grid(True, alpha=0.3)
        plt.colorbar(scatter1, ax=axes[0], label='Safety Factor')

        unique_clays = list(set(clay_types))
        colors = plt.cm.tab10(range(len(unique_clays)))
        clay_to_color = {c: colors[i] for i, c in enumerate(unique_clays)}

        for clay in unique_clays:
            indices = [i for i, ct in enumerate(clay_types) if ct == clay]
            axes[1].scatter(
                [stresses[i] for i in indices],
                [safety_factors[i] for i in indices],
                c=[clay_to_color[clay]],
                s=100,
                alpha=0.7,
                label=clay
            )

        axes[1].set_xlabel('Maximum Stress (Pa)')
        axes[1].set_ylabel('Safety Factor')
        axes[1].set_title('Pareto Front: Stress vs Safety Factor by Clay Type')
        axes[1].grid(True, alpha=0.3)
        axes[1].legend()

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show:
            plt.show()
        else:
            plt.close()
