import json
import h5py
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from raw_materials import RawMaterialCollector
from numerical_computation import NumericalComputer
from advanced_features import FiberSynergyModel, ProcessWarningSystem, WarningLevel


class PaperSimulationConfig:
    def __init__(self):
        self.material_names: List[str] = []
        self.ratios: List[float] = []
        self.soak_time: float = 24.0
        self.temperature: float = 25.0
        self.simulation_id: str = ""
        self.enable_synergy: bool = True
        self.enable_warnings: bool = True

    def validate(self) -> bool:
        if not self.material_names or len(self.material_names) == 0:
            return False
        if abs(sum(self.ratios) - 1.0) > 0.001:
            return False
        if self.soak_time <= 0:
            return False
        return True

    def to_dict(self) -> Dict:
        return {
            'material_names': self.material_names,
            'ratios': self.ratios,
            'soak_time': self.soak_time,
            'temperature': self.temperature,
            'simulation_id': self.simulation_id,
            'enable_synergy': self.enable_synergy,
            'enable_warnings': self.enable_warnings
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'PaperSimulationConfig':
        config = cls()
        config.material_names = data.get('material_names', [])
        config.ratios = data.get('ratios', [])
        config.soak_time = data.get('soak_time', 24.0)
        config.temperature = data.get('temperature', 25.0)
        config.simulation_id = data.get('simulation_id', '')
        config.enable_synergy = data.get('enable_synergy', True)
        config.enable_warnings = data.get('enable_warnings', True)
        return config


class PaperSimulationResult:
    def __init__(self, config: PaperSimulationConfig):
        self.config = config
        self.tensile_strength: float = 0.0
        self.porosity: float = 0.0
        self.water_absorption: float = 0.0
        self.fiber_length_dist: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self.quality_metrics: Dict[str, float] = {}
        self.soaking_curve: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self.synergy_effects: Dict[str, float] = {}
        self.warnings: List[Dict] = []
        self.is_valid: bool = True
        self.timestamp: str = datetime.now().isoformat()


class PaperFiberSimulator:
    def __init__(self):
        self.material_collector = RawMaterialCollector()
        self.computer = NumericalComputer()
        self.synergy_model = FiberSynergyModel()
        self.warning_system = ProcessWarningSystem()

    def run_simulation(self, config: PaperSimulationConfig) -> PaperSimulationResult:
        if not config.validate():
            raise ValueError("Invalid simulation configuration")

        self.warning_system.clear_warnings()
        result = PaperSimulationResult(config)
        
        properties = self.material_collector.get_material_properties(config.material_names)
        ratios = np.array(config.ratios)
        
        if config.enable_warnings:
            self.warning_system.validate_ratios(config.ratios, config.material_names)
            self.warning_system.validate_soak_time(config.soak_time, config.material_names)
            self.warning_system.check_synergy_conflicts(config.material_names, config.ratios)
        
        if config.enable_synergy:
            synergy = self.synergy_model.calculate_composite_synergy(
                config.material_names, ratios
            )
            result.synergy_effects = synergy
        else:
            synergy = {'strength_boost': 0.0, 'uniformity_boost': 0.0, 
                      'soak_time_reduction': 0.0, 'effective_pairs': 0}
            result.synergy_effects = synergy
        
        adjusted_soak_time = config.soak_time * (1 - synergy.get('soak_time_reduction', 0))
        
        base_strength = self.computer.predict_tensile_strength(
            properties['tensile_strength'], ratios,
            adjusted_soak_time, properties['fiber_length']
        )
        result.tensile_strength = base_strength * (1 + synergy.get('strength_boost', 0))
        
        result.porosity = self.computer.calculate_porosity(
            ratios, properties['density'], adjusted_soak_time
        )
        result.porosity = np.clip(result.porosity * (1 - synergy.get('uniformity_boost', 0) * 0.1), 0.2, 0.8)
        
        result.water_absorption = self.computer.calculate_soaking_effect(
            adjusted_soak_time, properties['water_absorption'], ratios
        )
        
        result.fiber_length_dist = self.computer.calculate_fiber_distribution(
            ratios, properties['fiber_length']
        )
        
        result.quality_metrics = self.computer.calculate_quality_metrics(
            result.tensile_strength, result.porosity, result.water_absorption
        )
        
        if config.enable_warnings:
            self.warning_system.validate_quality_metrics(result.quality_metrics)
            warning_summary = self.warning_system.get_warnings_summary()
            for w in self.warning_system.warnings:
                result.warnings.append({
                    'level': w.level.value,
                    'code': w.code,
                    'message': w.message,
                    'details': w.details
                })
            result.is_valid = warning_summary['by_level'].get('ERROR', 0) == 0
        
        soak_times = np.linspace(0, 72, 100)
        strength_curve = []
        for t in soak_times:
            adjusted_t = t * (1 - synergy.get('soak_time_reduction', 0))
            strength = self.computer.predict_tensile_strength(
                properties['tensile_strength'], ratios, adjusted_t, properties['fiber_length']
            )
            strength_curve.append(strength * (1 + synergy.get('strength_boost', 0)))
        
        result.soaking_curve = (soak_times, np.array(strength_curve))
        
        return result

    def run_parameter_sweep(self, base_config: PaperSimulationConfig,
                             param_name: str, param_values: np.ndarray) -> List[PaperSimulationResult]:
        results = []
        for val in param_values:
            config = PaperSimulationConfig.from_dict(base_config.to_dict())
            
            if param_name == 'soak_time':
                config.soak_time = float(val)
            elif param_name == 'ratios':
                config.ratios = val.tolist()
            
            config.simulation_id = f"{param_name}_{val:.2f}"
            results.append(self.run_simulation(config))
        
        return results

    def save_config(self, config: PaperSimulationConfig, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)

    def load_config(self, filepath: str) -> PaperSimulationConfig:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return PaperSimulationConfig.from_dict(data)

    def save_results_hdf5(self, results: List[PaperSimulationResult], filepath: str) -> None:
        with h5py.File(filepath, 'w') as f:
            for i, result in enumerate(results):
                grp = f.create_group(f"simulation_{i}")
                
                grp.attrs['simulation_id'] = result.config.simulation_id
                grp.attrs['timestamp'] = result.timestamp
                grp.attrs['soak_time'] = result.config.soak_time
                grp.attrs['tensile_strength'] = result.tensile_strength
                grp.attrs['porosity'] = result.porosity
                grp.attrs['water_absorption'] = result.water_absorption
                
                grp.create_dataset('ratios', data=np.array(result.config.ratios))
                grp.create_dataset('material_names', data=np.string_(result.config.material_names))
                
                if result.fiber_length_dist:
                    bins, dist = result.fiber_length_dist
                    grp.create_dataset('fiber_bins', data=bins)
                    grp.create_dataset('fiber_distribution', data=dist)
                
                if result.soaking_curve:
                    x, y = result.soaking_curve
                    grp.create_dataset('soak_curve_x', data=x)
                    grp.create_dataset('soak_curve_y', data=y)
                
                metrics_grp = grp.create_group('quality_metrics')
                for key, val in result.quality_metrics.items():
                    metrics_grp.attrs[key] = val

    def load_results_hdf5(self, filepath: str) -> List[PaperSimulationResult]:
        results = []
        with h5py.File(filepath, 'r') as f:
            for grp_name in f.keys():
                grp = f[grp_name]
                
                config = PaperSimulationConfig()
                config.simulation_id = grp.attrs.get('simulation_id', '')
                config.soak_time = grp.attrs.get('soak_time', 24.0)
                config.ratios = list(grp['ratios'][:])
                config.material_names = [m.decode('utf-8') for m in grp['material_names'][:]]
                
                result = PaperSimulationResult(config)
                result.timestamp = grp.attrs.get('timestamp', '')
                result.tensile_strength = grp.attrs.get('tensile_strength', 0.0)
                result.porosity = grp.attrs.get('porosity', 0.0)
                result.water_absorption = grp.attrs.get('water_absorption', 0.0)
                
                if 'fiber_bins' in grp and 'fiber_distribution' in grp:
                    result.fiber_length_dist = (grp['fiber_bins'][:], grp['fiber_distribution'][:])
                
                if 'soak_curve_x' in grp and 'soak_curve_y' in grp:
                    result.soaking_curve = (grp['soak_curve_x'][:], grp['soak_curve_y'][:])
                
                if 'quality_metrics' in grp:
                    metrics_grp = grp['quality_metrics']
                    result.quality_metrics = {k: metrics_grp.attrs[k] for k in metrics_grp.attrs}
                
                results.append(result)
        
        return results
