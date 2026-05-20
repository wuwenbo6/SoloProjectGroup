import numpy as np
import h5py
import json
import os
from datetime import datetime
from typing import Dict, Optional, Any, List
from dataclasses import asdict
from simulation import FiringConfig


class HDF5Storage:
    def __init__(self, filename: str):
        self.filename = filename
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        if not os.path.exists(self.filename):
            with h5py.File(self.filename, 'w') as f:
                f.attrs['created_at'] = datetime.now().isoformat()
                f.attrs['version'] = '1.0'

    def save_simulation_results(self, results: Dict[str, np.ndarray],
                                 config: Optional[FiringConfig] = None,
                                 run_name: Optional[str] = None) -> str:
        if run_name is None:
            run_name = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        with h5py.File(self.filename, 'a') as f:
            if run_name in f:
                del f[run_name]

            grp = f.create_group(run_name)

            for key, value in results.items():
                if isinstance(value, np.ndarray):
                    grp.create_dataset(key, data=value, compression='gzip')
                else:
                    grp.attrs[key] = value

            if config is not None:
                config_grp = grp.create_group('config')
                for key, value in asdict(config).items():
                    if isinstance(value, (int, float, str, bool)):
                        config_grp.attrs[key] = value
                    else:
                        config_grp.attrs[key] = str(value)

            grp.attrs['saved_at'] = datetime.now().isoformat()

        return run_name

    def load_simulation_results(self, run_name: str) -> Dict[str, Any]:
        results = {}

        with h5py.File(self.filename, 'r') as f:
            if run_name not in f:
                raise ValueError(f"Run '{run_name}' not found in storage")

            grp = f[run_name]

            for key in grp.keys():
                if isinstance(grp[key], h5py.Dataset):
                    results[key] = grp[key][:]

            for key, value in grp.attrs.items():
                if key not in results:
                    results[key] = value

            if 'config' in grp:
                config_grp = grp['config']
                results['config'] = {key: value for key, value in config_grp.attrs.items()}

        return results

    def list_runs(self) -> List[str]:
        with h5py.File(self.filename, 'r') as f:
            return list(f.keys())

    def delete_run(self, run_name: str):
        with h5py.File(self.filename, 'a') as f:
            if run_name in f:
                del f[run_name]

    def get_run_metadata(self, run_name: str) -> Dict[str, Any]:
        with h5py.File(self.filename, 'r') as f:
            if run_name not in f:
                raise ValueError(f"Run '{run_name}' not found in storage")

            grp = f[run_name]
            metadata = dict(grp.attrs)

            if 'config' in grp:
                config_grp = grp['config']
                metadata['config'] = dict(config_grp.attrs)

            return metadata

    def search_runs(self, **kwargs) -> List[str]:
        matching_runs = []

        with h5py.File(self.filename, 'r') as f:
            for run_name in f.keys():
                grp = f[run_name]
                match = True

                for key, value in kwargs.items():
                    if key in grp.attrs:
                        if grp.attrs[key] != value:
                            match = False
                            break
                    elif 'config' in grp and key in grp['config'].attrs:
                        if grp['config'].attrs[key] != value:
                            match = False
                            break
                    else:
                        match = False
                        break

                if match:
                    matching_runs.append(run_name)

        return matching_runs


class JSONConfigStorage:
    def __init__(self, config_dir: str = "configs"):
        self.config_dir = config_dir
        os.makedirs(config_dir, exist_ok=True)

    def save_config(self, config: FiringConfig, name: Optional[str] = None) -> str:
        if name is None:
            name = f"config_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        if not name.endswith('.json'):
            name += '.json'

        filepath = os.path.join(self.config_dir, name)
        config_dict = asdict(config)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)

        return name

    def load_config(self, name: str) -> FiringConfig:
        if not name.endswith('.json'):
            name += '.json'

        filepath = os.path.join(self.config_dir, name)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Config file '{name}' not found")

        with open(filepath, 'r', encoding='utf-8') as f:
            config_dict = json.load(f)

        return FiringConfig(**config_dict)

    def list_configs(self) -> List[str]:
        return [f for f in os.listdir(self.config_dir) if f.endswith('.json')]

    def delete_config(self, name: str):
        if not name.endswith('.json'):
            name += '.json'

        filepath = os.path.join(self.config_dir, name)
        if os.path.exists(filepath):
            os.remove(filepath)


class StorageManager:
    def __init__(self, hdf5_file: str = "simulation_results.h5",
                 config_dir: str = "configs"):
        self.hdf5 = HDF5Storage(hdf5_file)
        self.json_configs = JSONConfigStorage(config_dir)

    def save_full_run(self, config: FiringConfig, results: Dict[str, np.ndarray],
                      run_name: Optional[str] = None) -> str:
        config_name = f"{run_name or 'config'}_cfg.json"
        self.json_configs.save_config(config, config_name)
        return self.hdf5.save_simulation_results(results, config, run_name)

    def load_full_run(self, run_name: str) -> Dict[str, Any]:
        results = self.hdf5.load_simulation_results(run_name)
        return results

    def export_to_csv(self, run_name: str, output_dir: str = "exports"):
        os.makedirs(output_dir, exist_ok=True)
        results = self.hdf5.load_simulation_results(run_name)

        csv_file = os.path.join(output_dir, f"{run_name}.csv")

        arrays = {k: v for k, v in results.items() if isinstance(v, np.ndarray)}
        if arrays:
            max_len = max(len(v) for v in arrays.values())

            with open(csv_file, 'w', newline='') as f:
                headers = list(arrays.keys())
                f.write(','.join(headers) + '\n')

                for i in range(max_len):
                    row = []
                    for key in headers:
                        arr = arrays[key]
                        if i < len(arr):
                            row.append(str(arr[i]))
                        else:
                            row.append('')
                    f.write(','.join(row) + '\n')

        return csv_file

    def get_statistics(self) -> Dict[str, Any]:
        runs = self.hdf5.list_runs()
        configs = self.json_configs.list_configs()

        stats = {
            'total_runs': len(runs),
            'total_configs': len(configs),
            'runs': runs,
            'configs': configs
        }

        if runs:
            final_shrinkages = []
            for run in runs:
                try:
                    results = self.hdf5.load_simulation_results(run)
                    if 'shrinkage' in results:
                        final_shrinkages.append(results['shrinkage'][-1])
                except Exception:
                    pass

            if final_shrinkages:
                stats['avg_final_shrinkage'] = np.mean(final_shrinkages)
                stats['min_final_shrinkage'] = np.min(final_shrinkages)
                stats['max_final_shrinkage'] = np.max(final_shrinkages)

        return stats

    def backup(self, backup_dir: str = "backups") -> str:
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        import shutil

        hdf5_backup = os.path.join(backup_dir, f"results_{timestamp}.h5")
        shutil.copy2(self.hdf5.filename, hdf5_backup)

        config_backup = os.path.join(backup_dir, f"configs_{timestamp}")
        if os.path.exists(self.json_configs.config_dir):
            shutil.copytree(self.json_configs.config_dir, config_backup)

        return backup_dir
