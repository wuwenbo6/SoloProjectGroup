import h5py
import json
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Any
import os
from material_collection import MaterialCollection
from formula_simulation import Formula, InkSimulationResult


class DataStorage:
    def __init__(self, base_path: str = "./data"):
        self.base_path = base_path
        self.hdf5_path = os.path.join(base_path, "simulation_results.h5")
        self.config_path = os.path.join(base_path, "formula_configs")
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(self.base_path, exist_ok=True)
        os.makedirs(self.config_path, exist_ok=True)

    def save_simulation_result(self, formula: Formula, 
                                result: InkSimulationResult,
                                simulation_id: Optional[str] = None) -> str:
        if simulation_id is None:
            simulation_id = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        with h5py.File(self.hdf5_path, 'a') as f:
            if simulation_id in f:
                del f[simulation_id]

            grp = f.create_group(simulation_id)
            
            grp.attrs['formula_name'] = formula.name
            grp.attrs['timestamp'] = datetime.now().isoformat()
            grp.attrs['overall_quality'] = result.quality_scores['overall_quality']

            materials_grp = grp.create_group('materials')
            for name, ratio in formula.materials.items():
                materials_grp.attrs[name] = ratio

            process_grp = grp.create_group('process_params')
            for name, value in formula.process_params.items():
                process_grp.attrs[name] = value

            props_grp = grp.create_group('properties')
            for key, value in result.properties.items():
                if isinstance(value, (int, float, str)):
                    props_grp.attrs[key] = value

            quality_grp = grp.create_group('quality_scores')
            for key, value in result.quality_scores.items():
                quality_grp.attrs[key] = value

            process_data_grp = grp.create_group('process_data')
            for key, value in result.process_data.items():
                if isinstance(value, np.ndarray):
                    process_data_grp.create_dataset(key, data=value)
                elif isinstance(value, (int, float, str)):
                    process_data_grp.attrs[key] = value

            temporal_grp = grp.create_group('temporal_data')
            for key, value in result.temporal_data.items():
                if isinstance(value, np.ndarray):
                    temporal_grp.create_dataset(key, data=value)
                elif isinstance(value, (int, float, str)):
                    temporal_grp.attrs[key] = value

        return simulation_id

    def load_simulation_result(self, simulation_id: str) -> Optional[Dict]:
        if not os.path.exists(self.hdf5_path):
            return None

        try:
            with h5py.File(self.hdf5_path, 'r') as f:
                if simulation_id not in f:
                    return None

                grp = f[simulation_id]
                result = {
                    'simulation_id': simulation_id,
                    'formula_name': grp.attrs.get('formula_name', ''),
                    'timestamp': grp.attrs.get('timestamp', ''),
                    'overall_quality': grp.attrs.get('overall_quality', 0.0),
                    'materials': {},
                    'process_params': {},
                    'properties': {},
                    'quality_scores': {},
                    'process_data': {},
                    'temporal_data': {}
                }

                if 'materials' in grp:
                    for key in grp['materials'].attrs:
                        result['materials'][key] = grp['materials'].attrs[key]

                if 'process_params' in grp:
                    for key in grp['process_params'].attrs:
                        result['process_params'][key] = grp['process_params'].attrs[key]

                if 'properties' in grp:
                    for key in grp['properties'].attrs:
                        result['properties'][key] = grp['properties'].attrs[key]

                if 'quality_scores' in grp:
                    for key in grp['quality_scores'].attrs:
                        result['quality_scores'][key] = grp['quality_scores'].attrs[key]

                if 'process_data' in grp:
                    for key in grp['process_data']:
                        if isinstance(grp['process_data'][key], h5py.Dataset):
                            result['process_data'][key] = grp['process_data'][key][:]
                    for key in grp['process_data'].attrs:
                        result['process_data'][key] = grp['process_data'].attrs[key]

                if 'temporal_data' in grp:
                    for key in grp['temporal_data']:
                        if isinstance(grp['temporal_data'][key], h5py.Dataset):
                            result['temporal_data'][key] = grp['temporal_data'][key][:]
                    for key in grp['temporal_data'].attrs:
                        result['temporal_data'][key] = grp['temporal_data'].attrs[key]

            return result
        except Exception:
            return None

    def list_all_simulations(self) -> List[Dict]:
        if not os.path.exists(self.hdf5_path):
            return []

        simulations = []
        try:
            with h5py.File(self.hdf5_path, 'r') as f:
                for sim_id in f.keys():
                    grp = f[sim_id]
                    simulations.append({
                        'simulation_id': sim_id,
                        'formula_name': grp.attrs.get('formula_name', ''),
                        'timestamp': grp.attrs.get('timestamp', ''),
                        'overall_quality': grp.attrs.get('overall_quality', 0.0)
                    })
        except Exception:
            pass

        return sorted(simulations, key=lambda x: x['timestamp'], reverse=True)

    def save_formula_config(self, formula: Formula, 
                           config_name: Optional[str] = None) -> str:
        if config_name is None:
            config_name = formula.name

        config = {
            'name': formula.name,
            'materials': formula.materials,
            'process_params': formula.process_params,
            'saved_at': datetime.now().isoformat()
        }

        filename = f"{config_name.replace(' ', '_')}.json"
        filepath = os.path.join(self.config_path, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

        return filepath

    def load_formula_config(self, config_name: str) -> Optional[Formula]:
        filename = f"{config_name.replace(' ', '_')}.json"
        filepath = os.path.join(self.config_path, filename)

        if not os.path.exists(filepath):
            return None

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                config = json.load(f)

            formula = Formula(config['name'])
            formula.materials = config.get('materials', {})
            formula.process_params.update(config.get('process_params', {}))

            return formula
        except Exception:
            return None

    def list_all_formula_configs(self) -> List[Dict]:
        configs = []
        for filename in os.listdir(self.config_path):
            if filename.endswith('.json'):
                filepath = os.path.join(self.config_path, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        configs.append({
                            'config_name': filename.replace('.json', ''),
                            'formula_name': config.get('name', ''),
                            'saved_at': config.get('saved_at', '')
                        })
                except Exception:
                    continue

        return sorted(configs, key=lambda x: x['saved_at'], reverse=True)

    def export_comparison_data(self, simulation_ids: List[str], 
                               output_file: str) -> str:
        comparison_data = []
        for sim_id in simulation_ids:
            result = self.load_simulation_result(sim_id)
            if result:
                comparison_data.append({
                    'simulation_id': sim_id,
                    'formula_name': result['formula_name'],
                    'overall_quality': result['overall_quality'],
                    'quality_scores': result['quality_scores'],
                    'properties': result['properties']
                })

        output_path = os.path.join(self.base_path, output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(comparison_data, f, ensure_ascii=False, indent=2)

        return output_path

    def save_optimization_result(self, optimization_result: Dict,
                                 name: Optional[str] = None) -> str:
        if name is None:
            name = f"opt_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        opt_data = {
            'name': name,
            'success': bool(optimization_result.get('success', False)),
            'best_score': float(optimization_result.get('best_score', 0.0)),
            'optimized_params': optimization_result.get('optimized_params', {}),
            'original_params': optimization_result.get('original_params', {}),
            'optimized_ratios': optimization_result.get('optimized_ratios', {}),
            'original_ratios': optimization_result.get('original_ratios', {}),
            'method': optimization_result.get('method', ''),
            'saved_at': datetime.now().isoformat()
        }

        opt_path = os.path.join(self.base_path, "optimizations")
        os.makedirs(opt_path, exist_ok=True)

        filepath = os.path.join(opt_path, f"{name}.json")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(opt_data, f, ensure_ascii=False, indent=2)

        return filepath

    def delete_simulation(self, simulation_id: str) -> bool:
        if not os.path.exists(self.hdf5_path):
            return False

        try:
            with h5py.File(self.hdf5_path, 'a') as f:
                if simulation_id in f:
                    del f[simulation_id]
                    return True
            return False
        except Exception:
            return False

    def get_statistics(self) -> Dict:
        sims = self.list_all_simulations()
        configs = self.list_all_formula_configs()

        if not sims:
            return {
                'total_simulations': 0,
                'total_configs': len(configs),
                'best_score': 0,
                'average_score': 0
            }

        scores = [s['overall_quality'] for s in sims]

        return {
            'total_simulations': len(sims),
            'total_configs': len(configs),
            'best_score': max(scores),
            'worst_score': min(scores),
            'average_score': sum(scores) / len(scores),
            'best_simulation': sims[scores.index(max(scores))]['simulation_id']
        }
