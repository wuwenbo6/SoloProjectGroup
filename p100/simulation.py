import numpy as np
import h5py
import json
from datetime import datetime
from typing import Dict, List, Tuple, Optional

try:
    from .material_collector import MaterialCollector
    from .numerical_calculator import NumericalCalculator
except ImportError:
    from material_collector import MaterialCollector
    from numerical_calculator import NumericalCalculator


class DyeSimulation:
    def __init__(self, material_collector: MaterialCollector, 
                 calculator: Optional[NumericalCalculator] = None,
                 config_file: Optional[str] = None):
        self.material_collector = material_collector
        self.calculator = calculator if calculator else NumericalCalculator()
        self.simulation_results = {}
        self.config = self._load_config(config_file)

    def _load_config(self, config_file: Optional[str]) -> Dict:
        default_config = {
            'simulation': {
                'temperature_range': [20, 100],
                'time_steps': 100,
                'reaction_rate_constant': 0.01
            }
        }
        if config_file:
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except FileNotFoundError:
                return default_config
        return default_config

    def run_single_simulation(self, ratios: Dict[str, float], temperature: float,
                               time_span: Tuple[float, float] = (0, 100)) -> Dict:
        materials = self.material_collector.get_all_materials()
        material_names = [m.name for m in materials]
        
        ratios_array = np.array([ratios.get(name, 0) for name in material_names])
        ratios_array = ratios_array / np.sum(ratios_array) if np.sum(ratios_array) > 0 else ratios_array
        
        initial_concentrations = np.array([m.concentration for m in materials]) * ratios_array
        
        t, conc_history = self.calculator.simulate_reaction(
            initial_concentrations, temperature, time_span,
            num_points=self.config['simulation']['time_steps']
        )
        
        absorption_coeffs = np.array([m.absorption_coefficient for m in materials])
        absorption_history = np.array([
            self.calculator.calculate_absorption_spectrum(conc, absorption_coeffs)
            for conc in conc_history
        ])
        
        result = {
            'material_names': material_names,
            'ratios': dict(zip(material_names, ratios_array)),
            'temperature': temperature,
            'time_points': t,
            'concentration_history': conc_history,
            'absorption_history': absorption_history,
            'initial_concentrations': initial_concentrations,
            'final_concentrations': conc_history[-1],
            'reaction_yield': self.calculator.calculate_reaction_yield(
                np.sum(initial_concentrations), np.sum(conc_history[-1])
            ),
            'timestamp': datetime.now().isoformat()
        }
        
        return result

    def run_temperature_sweep(self, ratios: Dict[str, float],
                               temp_range: Optional[Tuple[float, float]] = None,
                               num_temps: int = 20,
                               time_point: float = 50.0) -> Dict:
        if temp_range is None:
            temp_range = tuple(self.config['simulation']['temperature_range'])
        
        materials = self.material_collector.get_all_materials()
        initial_concentrations = np.array([
            m.concentration * ratios.get(m.name, 0) for m in materials
        ])
        
        temperatures, final_concentrations = self.calculator.temperature_effect_curve(
            temp_range, initial_concentrations, time_point, num_temps
        )
        
        absorption_coeffs = np.array([m.absorption_coefficient for m in materials])
        final_absorptions = np.array([
            self.calculator.calculate_absorption_spectrum(c, absorption_coeffs)
            for c in final_concentrations
        ])
        
        result = {
            'temperatures': temperatures,
            'final_concentrations': final_concentrations,
            'final_absorptions': final_absorptions,
            'reaction_yields': [
                self.calculator.calculate_reaction_yield(
                    np.sum(initial_concentrations), np.sum(c)
                ) for c in final_concentrations
            ],
            'ratios': ratios,
            'time_point': time_point
        }
        
        return result

    def run_ratio_optimization(self, target_absorption: np.ndarray,
                                bounds: Optional[List[Tuple[float, float]]] = None) -> Dict:
        absorption_coeffs = self.material_collector.get_absorption_array()
        optimized_ratios = self.calculator.optimize_ratio(
            target_absorption, absorption_coeffs, bounds
        )
        
        material_names = [m.name for m in self.material_collector.get_all_materials()]
        ratio_dict = dict(zip(material_names, optimized_ratios))
        
        result = {
            'optimized_ratios': ratio_dict,
            'target_absorption': target_absorption,
            'achieved_absorption': np.dot(optimized_ratios, absorption_coeffs),
            'error': np.sum((np.dot(optimized_ratios, absorption_coeffs) - target_absorption) ** 2)
        }
        
        return result

    def run_batch_simulation(self, ratio_list: List[Dict[str, float]],
                              temperature: float,
                              time_span: Tuple[float, float] = (0, 100)) -> List[Dict]:
        results = []
        for ratios in ratio_list:
            result = self.run_single_simulation(ratios, temperature, time_span)
            results.append(result)
        return results

    def save_to_hdf5(self, results: Dict, filepath: str, 
                     group_name: Optional[str] = None) -> None:
        if group_name is None:
            group_name = f"simulation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with h5py.File(filepath, 'a') as hf:
            if group_name in hf:
                del hf[group_name]
            grp = hf.create_group(group_name)
            
            for key, value in results.items():
                if isinstance(value, np.ndarray):
                    grp.create_dataset(key, data=value)
                elif isinstance(value, (int, float, str)):
                    grp.attrs[key] = value
                elif isinstance(value, list):
                    if all(isinstance(x, (int, float)) for x in value):
                        grp.create_dataset(key, data=np.array(value))
                    elif all(isinstance(x, str) for x in value):
                        grp.attrs[key] = json.dumps(value)
                elif isinstance(value, dict):
                    subgrp = grp.create_group(key)
                    for k, v in value.items():
                        if isinstance(v, (int, float, str)):
                            subgrp.attrs[k] = v
                        elif isinstance(v, np.ndarray):
                            subgrp.create_dataset(k, data=v)

    def load_from_hdf5(self, filepath: str, group_name: str) -> Dict:
        results = {}
        with h5py.File(filepath, 'r') as hf:
            if group_name not in hf:
                raise ValueError(f"Group {group_name} not found in {filepath}")
            
            grp = hf[group_name]
            
            for key in grp.attrs:
                results[key] = grp.attrs[key]
            
            for key in grp:
                if isinstance(grp[key], h5py.Dataset):
                    results[key] = grp[key][:]
                elif isinstance(grp[key], h5py.Group):
                    subdict = {}
                    for k in grp[key].attrs:
                        subdict[k] = grp[key].attrs[k]
                    results[key] = subdict
        
        return results

    def list_hdf5_groups(self, filepath: str) -> List[str]:
        try:
            with h5py.File(filepath, 'r') as hf:
                return list(hf.keys())
        except FileNotFoundError:
            return []

    def calculate_mixture_color(self, ratios: Dict[str, float], 
                                 mixing_mode: str = 'subtractive') -> np.ndarray:
        try:
            from .color_predictor import ColorPredictor
        except ImportError:
            from color_predictor import ColorPredictor
        color_predictor = ColorPredictor()
        
        material_names = [m.name for m in self.material_collector.get_all_materials()]
        ratios_array = np.array([ratios.get(name, 0) for name in material_names])
        ratios_array = ratios_array / np.sum(ratios_array) if np.sum(ratios_array) > 0 else ratios_array
        
        color_matrix = self.material_collector.get_color_matrix()
        color_list = [color_matrix[i] for i in range(len(color_matrix))]
        
        mixed_color = color_predictor.predict_mixed_color(color_list, ratios_array, mixing_mode)
        return np.clip(mixed_color, 0, 1)

    def simulate_color_evolution(self, ratios: Dict[str, float],
                                  temperature: float,
                                  time_span: Tuple[float, float] = (0, 100),
                                  mixing_mode: str = 'subtractive') -> Dict:
        try:
            from .color_predictor import ColorPredictor
        except ImportError:
            from color_predictor import ColorPredictor
        color_predictor = ColorPredictor()
        
        sim_result = self.run_single_simulation(ratios, temperature, time_span)
        
        color_matrix = self.material_collector.get_color_matrix()
        concentration_history = sim_result['concentration_history']
        
        total_conc = np.sum(concentration_history, axis=1, keepdims=True)
        total_conc[total_conc == 0] = 1
        normalized_conc = concentration_history / total_conc
        
        color_evolution = []
        for weights in normalized_conc:
            color_list = [color_matrix[i] for i in range(len(color_matrix))]
            mixed_color = color_predictor.predict_mixed_color(color_list, weights, mixing_mode)
            color_evolution.append(mixed_color)
        
        color_evolution = np.array(color_evolution)
        color_evolution = np.clip(color_evolution, 0, 1)
        
        return {
            'time_points': sim_result['time_points'],
            'color_evolution': color_evolution,
            'concentration_history': concentration_history,
            'final_color': color_evolution[-1],
            'mixing_mode': mixing_mode
        }
