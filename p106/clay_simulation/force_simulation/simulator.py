import numpy as np
from typing import Dict, Tuple, Optional, List
from dataclasses import dataclass
try:
    from ..data_acquisition import ClayParameter, ParameterCollector
    from ..numerical_computation import NumericalComputation
except ImportError:
    from data_acquisition import ClayParameter, ParameterCollector
    from numerical_computation import NumericalComputation


@dataclass
class SimulationConfig:
    clay_type: str
    force_magnitude: float
    force_direction: Tuple[float, float]
    grid_size: Tuple[int, int] = (50, 50)
    simulation_time: float = 1.0
    time_steps: int = 100
    boundary_conditions: Optional[Dict] = None


@dataclass
class SimulationResult:
    displacement: np.ndarray
    strain: Tuple[np.ndarray, np.ndarray, np.ndarray]
    stress: Tuple[np.ndarray, np.ndarray, np.ndarray]
    von_mises_stress: np.ndarray
    deformation_history: Optional[np.ndarray] = None
    moisture_effect: Optional[Dict] = None


class ForceSimulator:
    def __init__(self, collector: Optional[ParameterCollector] = None):
        self.collector = collector or ParameterCollector()
        self.current_config: Optional[SimulationConfig] = None
        self.computation: Optional[NumericalComputation] = None
        self.results: Optional[SimulationResult] = None

    def run_simulation(self, config: SimulationConfig) -> SimulationResult:
        self.current_config = config

        clay_param = self.collector.get_clay_parameter(config.clay_type)
        if not clay_param:
            raise ValueError(f"Unknown clay type: {config.clay_type}")

        is_valid, errors = self.collector.validate_parameters(config.clay_type)
        if not is_valid:
            raise ValueError(f"Invalid clay parameters: {', '.join(errors)}")

        self.computation = NumericalComputation(grid_size=config.grid_size)

        displacement = self.computation.solve_elasticity(
            clay_param=clay_param,
            force_magnitude=config.force_magnitude,
            force_direction=config.force_direction,
            boundary_conditions=config.boundary_conditions
        )

        ex, ey, exy = self.computation.compute_strain_tensor(displacement)
        sigmax, sigmay, sigmaxy = self.computation.compute_stress_tensor(ex, ey, exy, clay_param)
        von_mises = self.computation.compute_von_mises_stress(sigmax, sigmay, sigmaxy)

        deformation_history = None
        if config.simulation_time > 0 and config.time_steps > 0:
            deformation_history = self.computation.compute_viscoplastic_deformation(
                displacement,
                clay_param,
                dt=config.simulation_time / config.time_steps,
                n_steps=config.time_steps
            )

        self.results = SimulationResult(
            displacement=displacement,
            strain=(ex, ey, exy),
            stress=(sigmax, sigmay, sigmaxy),
            von_mises_stress=von_mises,
            deformation_history=deformation_history
        )

        return self.results

    def run_parameter_sweep(self, base_config: SimulationConfig,
                            param_name: str, param_range: Tuple[float, float],
                            n_points: int = 10) -> Dict[str, List]:
        param_values = np.linspace(param_range[0], param_range[1], n_points)
        results = []

        for value in param_values:
            config_dict = {
                'clay_type': base_config.clay_type,
                'force_magnitude': base_config.force_magnitude,
                'force_direction': base_config.force_direction,
                'grid_size': base_config.grid_size,
                'simulation_time': base_config.simulation_time,
                'time_steps': base_config.time_steps,
                'boundary_conditions': base_config.boundary_conditions
            }

            if param_name == 'force_magnitude':
                config_dict['force_magnitude'] = value
            elif param_name == 'moisture_content':
                clay_param = self.collector.get_clay_parameter(base_config.clay_type)
                if clay_param:
                    original_moisture = clay_param.moisture_content
                    clay_param.moisture_content = value
                    self.collector.add_clay_parameter(f"{base_config.clay_type}_temp", clay_param)
                    config_dict['clay_type'] = f"{base_config.clay_type}_temp"
            elif param_name == 'force_angle':
                angle_rad = np.radians(value)
                config_dict['force_direction'] = (np.sin(angle_rad), -np.cos(angle_rad))

            temp_config = SimulationConfig(**config_dict)
            result = self.run_simulation(temp_config)
            results.append(result)

        return {
            'param_values': param_values,
            'results': results
        }

    def analyze_moisture_effect(self, config: SimulationConfig,
                                 moisture_range: Tuple[float, float] = (0.15, 0.45),
                                 n_points: int = 10) -> Dict:
        clay_param = self.collector.get_clay_parameter(config.clay_type)
        if not clay_param:
            raise ValueError(f"Unknown clay type: {config.clay_type}")

        moisture_data = self.computation.compute_moisture_effect(
            clay_param, moisture_range, n_points
        )

        stress_results = []
        for i, m in enumerate(moisture_data['moistures']):
            temp_param = ClayParameter(
                name=clay_param.name,
                clay_type=f"{clay_param.clay_type}_m{i}",
                moisture_content=m,
                density=clay_param.density,
                youngs_modulus=moisture_data['youngs_modulus'][i],
                poissons_ratio=clay_param.poissons_ratio,
                yield_strength=moisture_data['yield_strength'][i],
                viscosity=clay_param.viscosity,
                particle_size=clay_param.particle_size,
                organic_content=clay_param.organic_content
            )
            self.collector.add_clay_parameter(temp_param)

            temp_config = SimulationConfig(
                clay_type=temp_param.clay_type,
                force_magnitude=config.force_magnitude,
                force_direction=config.force_direction,
                grid_size=config.grid_size,
                simulation_time=0,
                time_steps=0
            )
            result = self.run_simulation(temp_config)
            stress_results.append(np.max(result.von_mises_stress))

        moisture_data['max_stress'] = np.array(stress_results)
        return moisture_data

    def analyze_force_direction(self, config: SimulationConfig,
                                 angle_range: Tuple[float, float] = (0, 90),
                                 n_points: int = 10) -> Dict:
        angles = np.linspace(angle_range[0], angle_range[1], n_points)
        max_stresses = np.zeros(n_points)
        deformations = np.zeros(n_points)

        for i, angle in enumerate(angles):
            angle_rad = np.radians(angle)
            direction = (np.sin(angle_rad), -np.cos(angle_rad))

            temp_config = SimulationConfig(
                clay_type=config.clay_type,
                force_magnitude=config.force_magnitude,
                force_direction=direction,
                grid_size=config.grid_size,
                simulation_time=0,
                time_steps=0
            )

            result = self.run_simulation(temp_config)
            max_stresses[i] = np.max(result.von_mises_stress)
            deformations[i] = np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2))

        return {
            'angles': angles,
            'max_stress': max_stresses,
            'max_deformation': deformations
        }

    def get_safety_factor(self, result: Optional[SimulationResult] = None) -> float:
        if result is None:
            result = self.results

        if result is None:
            raise ValueError("No simulation results available")

        clay_param = self.collector.get_clay_parameter(self.current_config.clay_type)
        max_stress = np.max(result.von_mises_stress)
        return clay_param.yield_strength / max_stress

    def get_summary_statistics(self, result: Optional[SimulationResult] = None) -> Dict:
        if result is None:
            result = self.results

        if result is None:
            raise ValueError("No simulation results available")

        return {
            'max_von_mises_stress': np.max(result.von_mises_stress),
            'min_von_mises_stress': np.min(result.von_mises_stress),
            'mean_von_mises_stress': np.mean(result.von_mises_stress),
            'std_von_mises_stress': np.std(result.von_mises_stress),
            'max_displacement': np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2)),
            'max_shear_stress': np.max(np.abs(result.stress[2])),
            'safety_factor': self.get_safety_factor(result)
        }
