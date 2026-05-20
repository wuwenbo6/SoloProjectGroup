import numpy as np
import h5py
import json
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

from bamboo_data import BambooDataCollector, BambooStrip
from numerical_calculation import FiniteElementSolver, TensionCalculator


@dataclass
class WeaveConfig:
    pattern: str = 'plain'
    warp_count: int = 10
    weft_count: int = 10
    base_tension: float = 100.0
    friction_coefficient: float = 0.3
    simulation_time: float = 1.0
    time_steps: int = 100


@dataclass
class SimulationResult:
    time: np.ndarray
    warp_tension: np.ndarray
    weft_tension: np.ndarray
    contact_tension: np.ndarray
    total_tension: np.ndarray
    strain: np.ndarray
    displacement: np.ndarray
    config: Dict[str, Any]
    metadata: Dict[str, Any]


class BambooWeaveSimulator:
    def __init__(self, data_collector: BambooDataCollector):
        self.data_collector = data_collector
        self.fe_solver = FiniteElementSolver()
        self.tension_calc = TensionCalculator()
        self.config = WeaveConfig()
        self.last_result: Optional[SimulationResult] = None

    def set_config(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)

    def load_config_from_json(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        self.set_config(**config_data)

    def save_config_to_json(self, filepath: str):
        config_dict = asdict(self.config)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)

    def simulate_static_tension(self,
                                warp_strip_index: int = 0,
                                weft_strip_index: int = 0,
                                external_force: Optional[np.ndarray] = None) -> SimulationResult:
        if warp_strip_index >= len(self.data_collector.strips):
            raise ValueError("Warp strip index out of range")
        if weft_strip_index >= len(self.data_collector.strips):
            raise ValueError("Weft strip index out of range")

        warp_strip = self.data_collector.strips[warp_strip_index]
        weft_strip = self.data_collector.strips[weft_strip_index]

        weave_tension = self.tension_calc.calculate_weave_tension(
            self.config.pattern,
            self.config.warp_count,
            self.config.weft_count,
            self.config.base_tension
        )

        num_nodes = self.fe_solver.num_nodes
        time = np.linspace(0, self.config.simulation_time, self.config.time_steps)

        warp_tension = np.zeros((self.config.time_steps, num_nodes))
        weft_tension = np.zeros((self.config.time_steps, num_nodes))
        contact_tension = np.zeros((self.config.time_steps, num_nodes))

        warp_axial_stiffness = warp_strip.get_axial_stiffness()
        weft_axial_stiffness = weft_strip.get_axial_stiffness()

        for t_idx, t in enumerate(time):
            tension_factor = 0.5 * (1 + np.sin(np.pi * t / self.config.simulation_time))

            warp_strain = weave_tension['warp_tension'] * tension_factor / warp_axial_stiffness
            weft_strain = weave_tension['weft_tension'] * tension_factor / weft_axial_stiffness

            warp_tension[t_idx, :] = self.tension_calc.calculate_axial_tension(
                warp_strain * np.ones(num_nodes),
                warp_axial_stiffness,
                warp_strip.cross_section_area
            )

            weft_tension[t_idx, :] = self.tension_calc.calculate_axial_tension(
                weft_strain * np.ones(num_nodes),
                weft_axial_stiffness,
                weft_strip.cross_section_area
            )

            contact_area = warp_strip.width * weft_strip.thickness
            normal_force = (warp_tension[t_idx, :] + weft_tension[t_idx, :]) * 0.1
            contact_tension[t_idx, :] = self.tension_calc.calculate_contact_tension(
                normal_force,
                contact_area,
                self.config.friction_coefficient
            )

        total_tension = warp_tension + weft_tension + contact_tension
        strain = (warp_tension + weft_tension) / (warp_axial_stiffness + weft_axial_stiffness)
        displacement = strain * warp_strip.length

        metadata = {
            'simulation_type': 'static_tension',
            'timestamp': datetime.now().isoformat(),
            'warp_species': warp_strip.species.name,
            'weft_species': weft_strip.species.name
        }

        result = SimulationResult(
            time=time,
            warp_tension=warp_tension,
            weft_tension=weft_tension,
            contact_tension=contact_tension,
            total_tension=total_tension,
            strain=strain,
            displacement=displacement,
            config=asdict(self.config),
            metadata=metadata
        )

        self.last_result = result
        return result

    def simulate_dynamic_tension(self,
                                 warp_strip_index: int = 0,
                                 weft_strip_index: int = 0,
                                 initial_velocity: float = 0.0,
                                 damping_ratio: float = 0.05) -> SimulationResult:
        if warp_strip_index >= len(self.data_collector.strips):
            raise ValueError("Warp strip index out of range")
        if weft_strip_index >= len(self.data_collector.strips):
            raise ValueError("Weft strip index out of range")

        warp_strip = self.data_collector.strips[warp_strip_index]
        weft_strip = self.data_collector.strips[weft_strip_index]

        weave_tension = self.tension_calc.calculate_weave_tension(
            self.config.pattern,
            self.config.warp_count,
            self.config.weft_count,
            self.config.base_tension
        )

        num_nodes = self.fe_solver.num_nodes
        dt = self.config.simulation_time / self.config.time_steps
        time = np.linspace(0, self.config.simulation_time, self.config.time_steps)

        warp_tension = np.zeros((self.config.time_steps, num_nodes))
        weft_tension = np.zeros((self.config.time_steps, num_nodes))
        contact_tension = np.zeros((self.config.time_steps, num_nodes))

        warp_axial_stiffness = warp_strip.get_axial_stiffness()
        weft_axial_stiffness = weft_strip.get_axial_stiffness()

        warp_mass = warp_strip.species.density * warp_strip.cross_section_area * warp_strip.length / num_nodes
        weft_mass = weft_strip.species.density * weft_strip.cross_section_area * weft_strip.length / num_nodes

        initial_displacement = self.config.base_tension / warp_axial_stiffness * warp_strip.length
        warp_displacement = np.ones(num_nodes) * initial_displacement
        warp_velocity = np.ones(num_nodes) * initial_velocity
        weft_displacement = np.ones(num_nodes) * initial_displacement
        weft_velocity = np.ones(num_nodes) * initial_velocity

        damping = 2 * damping_ratio * np.sqrt(warp_axial_stiffness * warp_mass)

        max_tension = warp_strip.species.tensile_strength * warp_strip.cross_section_area
        max_displacement = 0.1 * warp_strip.length

        for t_idx in range(self.config.time_steps):
            warp_strain = warp_displacement / warp_strip.length
            weft_strain = weft_displacement / weft_strip.length

            warp_stiffness_force = warp_axial_stiffness * warp_strain
            weft_stiffness_force = weft_axial_stiffness * weft_strain

            warp_damping_force = damping * warp_velocity
            weft_damping_force = damping * weft_velocity

            warp_acceleration = (-warp_stiffness_force - warp_damping_force) / warp_mass
            weft_acceleration = (-weft_stiffness_force - weft_damping_force) / weft_mass

            warp_acceleration = np.clip(warp_acceleration, -1e6, 1e6)
            weft_acceleration = np.clip(weft_acceleration, -1e6, 1e6)

            warp_velocity += warp_acceleration * dt
            weft_velocity += weft_acceleration * dt
            warp_displacement += warp_velocity * dt
            weft_displacement += weft_velocity * dt

            warp_displacement = np.clip(warp_displacement, -max_displacement, max_displacement)
            weft_displacement = np.clip(weft_displacement, -max_displacement, max_displacement)

            warp_strain = np.clip(warp_displacement / warp_strip.length, -0.01, 0.01)
            weft_strain = np.clip(weft_displacement / weft_strip.length, -0.01, 0.01)

            warp_tension[t_idx, :] = np.clip(
                self.tension_calc.calculate_axial_tension(
                    warp_strain,
                    warp_axial_stiffness,
                    warp_strip.cross_section_area
                ),
                0, max_tension
            )

            weft_tension[t_idx, :] = np.clip(
                self.tension_calc.calculate_axial_tension(
                    weft_strain,
                    weft_axial_stiffness,
                    weft_strip.cross_section_area
                ),
                0, max_tension
            )

            contact_area = warp_strip.width * weft_strip.thickness
            normal_force = np.abs(warp_stiffness_force + weft_stiffness_force) * 0.1
            contact_tension[t_idx, :] = np.clip(
                self.tension_calc.calculate_contact_tension(
                    normal_force,
                    contact_area,
                    self.config.friction_coefficient
                ),
                0, max_tension
            )

        total_tension = np.clip(warp_tension + weft_tension + contact_tension, 0, max_tension * 3)
        strain = np.clip(
            (warp_tension + weft_tension) / (warp_axial_stiffness + weft_axial_stiffness),
            0, 0.1
        )
        displacement = np.sqrt(
            np.mean(warp_displacement)**2 + np.mean(weft_displacement)**2
        ) * np.ones(num_nodes)

        metadata = {
            'simulation_type': 'dynamic_tension',
            'timestamp': datetime.now().isoformat(),
            'warp_species': warp_strip.species.name,
            'weft_species': weft_strip.species.name,
            'damping_ratio': damping_ratio,
            'initial_velocity': initial_velocity
        }

        result = SimulationResult(
            time=time,
            warp_tension=warp_tension,
            weft_tension=weft_tension,
            contact_tension=contact_tension,
            total_tension=total_tension,
            strain=strain,
            displacement=displacement,
            config=asdict(self.config),
            metadata=metadata
        )

        self.last_result = result
        return result

    def save_result_to_hdf5(self, result: SimulationResult, filepath: str):
        with h5py.File(filepath, 'w') as f:
            f.create_dataset('time', data=result.time)
            f.create_dataset('warp_tension', data=result.warp_tension)
            f.create_dataset('weft_tension', data=result.weft_tension)
            f.create_dataset('contact_tension', data=result.contact_tension)
            f.create_dataset('total_tension', data=result.total_tension)
            f.create_dataset('strain', data=result.strain)
            f.create_dataset('displacement', data=result.displacement)

            config_group = f.create_group('config')
            for key, value in result.config.items():
                config_group.attrs[key] = value

            metadata_group = f.create_group('metadata')
            for key, value in result.metadata.items():
                metadata_group.attrs[key] = value

    def load_result_from_hdf5(self, filepath: str) -> SimulationResult:
        with h5py.File(filepath, 'r') as f:
            time = np.array(f['time'])
            warp_tension = np.array(f['warp_tension'])
            weft_tension = np.array(f['weft_tension'])
            contact_tension = np.array(f['contact_tension'])
            total_tension = np.array(f['total_tension'])
            strain = np.array(f['strain'])
            displacement = np.array(f['displacement'])

            config = dict(f['config'].attrs)
            metadata = dict(f['metadata'].attrs)

        return SimulationResult(
            time=time,
            warp_tension=warp_tension,
            weft_tension=weft_tension,
            contact_tension=contact_tension,
            total_tension=total_tension,
            strain=strain,
            displacement=displacement,
            config=config,
            metadata=metadata
        )

    def get_tension_summary(self, result: Optional[SimulationResult] = None) -> Dict[str, float]:
        if result is None:
            result = self.last_result
        
        if result is None:
            raise ValueError("No simulation result available")

        return {
            'max_warp_tension': float(np.max(result.warp_tension)),
            'mean_warp_tension': float(np.mean(result.warp_tension)),
            'max_weft_tension': float(np.max(result.weft_tension)),
            'mean_weft_tension': float(np.mean(result.weft_tension)),
            'max_contact_tension': float(np.max(result.contact_tension)),
            'max_total_tension': float(np.max(result.total_tension)),
            'mean_total_tension': float(np.mean(result.total_tension)),
            'max_strain': float(np.max(result.strain))
        }
