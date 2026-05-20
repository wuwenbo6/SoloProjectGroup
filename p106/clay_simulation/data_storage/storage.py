import h5py
import json
import numpy as np
from datetime import datetime
from typing import Dict, Optional, List, Any
import os
try:
    from ..data_acquisition import ClayParameter, ParameterCollector
    from ..force_simulation import SimulationConfig, SimulationResult
    from ..optimization import OptimizationResult
except ImportError:
    from data_acquisition import ClayParameter, ParameterCollector
    from force_simulation import SimulationConfig, SimulationResult
    from optimization import OptimizationResult


class DataStorage:
    def __init__(self, base_dir: str = "simulation_data"):
        self.base_dir = base_dir
        self.hdf5_dir = os.path.join(base_dir, "hdf5")
        self.config_dir = os.path.join(base_dir, "configs")
        self.results_dir = os.path.join(base_dir, "results")

        for directory in [self.base_dir, self.hdf5_dir, self.config_dir, self.results_dir]:
            os.makedirs(directory, exist_ok=True)

    def _generate_timestamp(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    def save_configuration(self, config: SimulationConfig,
                          clay_param: ClayParameter,
                          filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"config_{config.clay_type}_{self._generate_timestamp()}.json"

        filepath = os.path.join(self.config_dir, filename)

        config_data = {
            'clay_type': config.clay_type,
            'force_magnitude': config.force_magnitude,
            'force_direction': list(config.force_direction),
            'grid_size': list(config.grid_size),
            'simulation_time': config.simulation_time,
            'time_steps': config.time_steps,
            'boundary_conditions': config.boundary_conditions,
            'clay_parameters': {
                'name': clay_param.name,
                'clay_type': clay_param.clay_type,
                'moisture_content': clay_param.moisture_content,
                'density': clay_param.density,
                'youngs_modulus': clay_param.youngs_modulus,
                'poissons_ratio': clay_param.poissons_ratio,
                'yield_strength': clay_param.yield_strength,
                'viscosity': clay_param.viscosity,
                'particle_size': clay_param.particle_size,
                'organic_content': clay_param.organic_content
            },
            'saved_at': datetime.now().isoformat()
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

        return filepath

    def load_configuration(self, filename: str) -> Dict:
        filepath = os.path.join(self.config_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Configuration file not found: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_simulation_results(self, result: SimulationResult,
                               config: SimulationConfig,
                               clay_param: ClayParameter,
                               filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"simulation_{config.clay_type}_{self._generate_timestamp()}.h5"

        filepath = os.path.join(self.hdf5_dir, filename)

        with h5py.File(filepath, 'w') as f:
            f.create_dataset('displacement', data=result.displacement)
            f.create_dataset('von_mises_stress', data=result.von_mises_stress)

            strain_group = f.create_group('strain')
            strain_group.create_dataset('ex', data=result.strain[0])
            strain_group.create_dataset('ey', data=result.strain[1])
            strain_group.create_dataset('exy', data=result.strain[2])

            stress_group = f.create_group('stress')
            stress_group.create_dataset('sigmax', data=result.stress[0])
            stress_group.create_dataset('sigmay', data=result.stress[1])
            stress_group.create_dataset('sigmaxy', data=result.stress[2])

            if result.deformation_history is not None:
                f.create_dataset('deformation_history', data=result.deformation_history)

            metadata = f.create_group('metadata')
            metadata.attrs['clay_type'] = config.clay_type
            metadata.attrs['clay_name'] = clay_param.name
            metadata.attrs['force_magnitude'] = config.force_magnitude
            metadata.attrs['force_direction_x'] = config.force_direction[0]
            metadata.attrs['force_direction_y'] = config.force_direction[1]
            metadata.attrs['grid_size_x'] = config.grid_size[0]
            metadata.attrs['grid_size_y'] = config.grid_size[1]
            metadata.attrs['moisture_content'] = clay_param.moisture_content
            metadata.attrs['youngs_modulus'] = clay_param.youngs_modulus
            metadata.attrs['yield_strength'] = clay_param.yield_strength
            metadata.attrs['saved_at'] = datetime.now().isoformat()

            stats = f.create_group('statistics')
            stats.attrs['max_von_mises_stress'] = float(np.max(result.von_mises_stress))
            stats.attrs['min_von_mises_stress'] = float(np.min(result.von_mises_stress))
            stats.attrs['mean_von_mises_stress'] = float(np.mean(result.von_mises_stress))
            stats.attrs['std_von_mises_stress'] = float(np.std(result.von_mises_stress))
            max_disp = float(np.max(np.sqrt(result.displacement[0] ** 2 + result.displacement[1] ** 2)))
            stats.attrs['max_displacement'] = max_disp
            stats.attrs['safety_factor'] = clay_param.yield_strength / float(np.max(result.von_mises_stress))

        return filepath

    def load_simulation_results(self, filename: str) -> Dict:
        filepath = os.path.join(self.hdf5_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Simulation file not found: {filepath}")

        result = {}

        with h5py.File(filepath, 'r') as f:
            result['displacement'] = np.array(f['displacement'])
            result['von_mises_stress'] = np.array(f['von_mises_stress'])

            result['strain'] = (
                np.array(f['strain']['ex']),
                np.array(f['strain']['ey']),
                np.array(f['strain']['exy'])
            )

            result['stress'] = (
                np.array(f['stress']['sigmax']),
                np.array(f['stress']['sigmay']),
                np.array(f['stress']['sigmaxy'])
            )

            if 'deformation_history' in f:
                result['deformation_history'] = np.array(f['deformation_history'])

            result['metadata'] = {}
            for key, value in f['metadata'].attrs.items():
                result['metadata'][key] = value

            result['statistics'] = {}
            for key, value in f['statistics'].attrs.items():
                result['statistics'][key] = value

        return result

    def save_optimization_results(self, opt_result: OptimizationResult,
                                 base_config: SimulationConfig,
                                 constraints: Dict,
                                 weights: Dict,
                                 filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"optimization_{self._generate_timestamp()}.json"

        filepath = os.path.join(self.results_dir, filename)

        history_serializable = []
        if opt_result.optimization_history:
            for h in opt_result.optimization_history:
                h_serializable = {}
                for k, v in h.items():
                    if isinstance(v, np.floating):
                        h_serializable[k] = float(v)
                    elif isinstance(v, np.integer):
                        h_serializable[k] = int(v)
                    else:
                        h_serializable[k] = v
                history_serializable.append(h_serializable)

        data = {
            'optimal_parameters': {
                k: float(v) if isinstance(v, (np.floating, float)) else v
                for k, v in opt_result.optimal_parameters.items()
            },
            'optimal_clay_type': opt_result.optimal_clay_type,
            'predicted_stress': float(opt_result.predicted_stress),
            'predicted_deformation': float(opt_result.predicted_deformation),
            'safety_factor': float(opt_result.safety_factor),
            'objective_value': float(opt_result.objective_value),
            'constraints': constraints,
            'weights': weights,
            'base_config': {
                'clay_type': base_config.clay_type,
                'force_direction': list(base_config.force_direction),
                'grid_size': list(base_config.grid_size)
            },
            'optimization_history': history_serializable,
            'saved_at': datetime.now().isoformat()
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath

    def load_optimization_results(self, filename: str) -> Dict:
        filepath = os.path.join(self.results_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Optimization file not found: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def list_saved_simulations(self) -> List[str]:
        return [f for f in os.listdir(self.hdf5_dir) if f.endswith('.h5')]

    def list_saved_configurations(self) -> List[str]:
        return [f for f in os.listdir(self.config_dir) if f.endswith('.json')]

    def list_saved_optimizations(self) -> List[str]:
        return [f for f in os.listdir(self.results_dir) if f.endswith('.json')]

    def create_summary_report(self, output_filename: Optional[str] = None) -> str:
        if output_filename is None:
            output_filename = f"summary_report_{self._generate_timestamp()}.json"

        filepath = os.path.join(self.base_dir, output_filename)

        simulations = self.list_saved_simulations()
        configs = self.list_saved_configurations()
        optimizations = self.list_saved_optimizations()

        simulation_summaries = []
        for sim_file in simulations[:10]:
            try:
                data = self.load_simulation_results(sim_file)
                simulation_summaries.append({
                    'filename': sim_file,
                    'clay_type': data['metadata'].get('clay_type', 'unknown'),
                    'max_stress': data['statistics'].get('max_von_mises_stress', 0),
                    'safety_factor': data['statistics'].get('safety_factor', 0)
                })
            except Exception:
                continue

        report = {
            'total_simulations': len(simulations),
            'total_configurations': len(configs),
            'total_optimizations': len(optimizations),
            'recent_simulations': simulation_summaries,
            'report_generated': datetime.now().isoformat(),
            'data_directories': {
                'hdf5': self.hdf5_dir,
                'configs': self.config_dir,
                'results': self.results_dir
            }
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return filepath

    def export_to_vtk(self, result: SimulationResult,
                     config: SimulationConfig,
                     filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"vtk_{config.clay_type}_{self._generate_timestamp()}.vtk"

        filepath = os.path.join(self.results_dir, filename)

        nx, ny = result.von_mises_stress.shape
        x = np.linspace(0, 1, nx)
        y = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x, y)

        with open(filepath, 'w') as f:
            f.write('# vtk DataFile Version 3.0\n')
            f.write('Clay Simulation Results\n')
            f.write('ASCII\n')
            f.write('DATASET STRUCTURED_POINTS\n')
            f.write(f'DIMENSIONS {nx} {ny} 1\n')
            f.write(f'ORIGIN 0 0 0\n')
            f.write(f'SPACING {1.0/(nx-1)} {1.0/(ny-1)} 1\n')
            f.write(f'POINT_DATA {nx * ny}\n')

            f.write('SCALARS Von_Mises_Stress double 1\n')
            f.write('LOOKUP_TABLE default\n')
            for j in range(ny):
                for i in range(nx):
                    f.write(f'{result.von_mises_stress[j, i]} ')
                f.write('\n')

            f.write('\nVECTORS Displacement double\n')
            for j in range(ny):
                for i in range(nx):
                    f.write(f'{result.displacement[0, j, i]} {result.displacement[1, j, i]} 0 ')
                f.write('\n')

        return filepath

    def backup_all_data(self, backup_name: Optional[str] = None) -> str:
        import shutil

        if backup_name is None:
            backup_name = f"backup_{self._generate_timestamp()}"

        backup_dir = os.path.join(self.base_dir, "backups", backup_name)
        os.makedirs(backup_dir, exist_ok=True)

        for directory in [self.hdf5_dir, self.config_dir, self.results_dir]:
            dir_name = os.path.basename(directory)
            dest_dir = os.path.join(backup_dir, dir_name)
            if os.path.exists(directory):
                shutil.copytree(directory, dest_dir, dirs_exist_ok=True)

        return backup_dir
