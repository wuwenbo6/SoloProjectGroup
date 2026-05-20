import json
import h5py
import numpy as np
import os
from datetime import datetime
from typing import Dict, List, Optional, Any


class JSONStorage:
    def __init__(self, base_dir: str = "data/configs"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def save_config(self, config: Dict, filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            ferm_type = config.get("type", "unknown")
            filename = f"{ferm_type}_config_{timestamp}.json"

        filepath = os.path.join(self.base_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

        return filepath

    def load_config(self, filename: str) -> Dict:
        filepath = os.path.join(self.base_dir, filename)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"配置文件不存在: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def list_configs(self) -> List[str]:
        return [f for f in os.listdir(self.base_dir) if f.endswith('.json')]

    def save_optimization_results(self, results: Dict, filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"optimization_results_{timestamp}.json"

        filepath = os.path.join(self.base_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        return filepath

    def save_summary(self, summary: Dict, filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"simulation_summary_{timestamp}.json"

        filepath = os.path.join(self.base_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        return filepath


class HDF5Storage:
    def __init__(self, base_dir: str = "data/simulations"):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

    def save_simulation_results(self, results: Dict, filename: Optional[str] = None) -> str:
        if filename is None:
            simulation_id = results.get("simulation_id", datetime.now().strftime("%Y%m%d_%H%M%S"))
            ferm_type = results.get("config", {}).get("type", "unknown")
            filename = f"{ferm_type}_simulation_{simulation_id}.h5"

        filepath = os.path.join(self.base_dir, filename)

        with h5py.File(filepath, 'w') as f:
            f.attrs["simulation_id"] = results.get("simulation_id", "")
            f.attrs["fermentation_type"] = results.get("config", {}).get("type", "unknown")

            time = np.array(results.get("time", []))
            f.create_dataset("time", data=time)

            states = np.array(results.get("states", []))
            state_names = results.get("state_names", [])
            f.create_dataset("states", data=states)
            f.attrs["state_names"] = json.dumps(state_names, ensure_ascii=False)

            if "config" in results:
                self._save_dict_to_group(f, "config", results["config"])

            if "summary_statistics" in results:
                self._save_dict_to_group(f, "summary", results["summary_statistics"])

        return filepath

    def _save_dict_to_group(self, parent: h5py.Group, group_name: str, data: Dict):
        group = parent.create_group(group_name)
        for key, value in data.items():
            if isinstance(value, dict):
                self._save_dict_to_group(group, key, value)
            elif isinstance(value, (int, float, str)):
                group.attrs[key] = value
            elif isinstance(value, list):
                try:
                    arr = np.array(value)
                    group.create_dataset(key, data=arr)
                except Exception:
                    group.attrs[key] = json.dumps(value, ensure_ascii=False)

    def load_simulation_results(self, filename: str) -> Dict:
        filepath = os.path.join(self.base_dir, filename)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"仿真结果文件不存在: {filepath}")

        results = {}

        with h5py.File(filepath, 'r') as f:
            results["simulation_id"] = f.attrs.get("simulation_id", "")
            results["fermentation_type"] = f.attrs.get("fermentation_type", "")

            if "time" in f:
                results["time"] = f["time"][:].tolist()

            if "states" in f:
                results["states"] = f["states"][:].tolist()

            if "state_names" in f.attrs:
                results["state_names"] = json.loads(f.attrs["state_names"])

            if "config" in f:
                results["config"] = self._load_group_to_dict(f["config"])

            if "summary" in f:
                results["summary_statistics"] = self._load_group_to_dict(f["summary"])

        return results

    def _load_group_to_dict(self, group: h5py.Group) -> Dict:
        result = {}

        for key in group.attrs:
            value = group.attrs[key]
            if isinstance(value, str) and value.startswith('[') and value.endswith(']'):
                try:
                    result[key] = json.loads(value)
                except json.JSONDecodeError:
                    result[key] = value
            else:
                result[key] = value

        for key in group:
            if isinstance(group[key], h5py.Group):
                result[key] = self._load_group_to_dict(group[key])
            elif isinstance(group[key], h5py.Dataset):
                result[key] = group[key][:].tolist()

        return result

    def list_simulations(self) -> List[str]:
        return [f for f in os.listdir(self.base_dir) if f.endswith('.h5')]

    def save_batch_simulations(self, results_list: List[Dict], batch_name: Optional[str] = None) -> str:
        if batch_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_name = f"batch_simulations_{timestamp}.h5"

        filepath = os.path.join(self.base_dir, batch_name)

        with h5py.File(filepath, 'w') as f:
            f.attrs["batch_size"] = len(results_list)

            for i, results in enumerate(results_list):
                group_name = f"simulation_{i:04d}"
                group = f.create_group(group_name)

                group.attrs["simulation_id"] = results.get("simulation_id", "")
                group.attrs["fermentation_type"] = results.get("config", {}).get("type", "unknown")

                time = np.array(results.get("time", []))
                group.create_dataset("time", data=time)

                states = np.array(results.get("states", []))
                group.create_dataset("states", data=states)

                state_names = results.get("state_names", [])
                group.attrs["state_names"] = json.dumps(state_names, ensure_ascii=False)

        return filepath


class DataManager:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self.json_storage = JSONStorage(os.path.join(base_dir, "configs"))
        self.hdf5_storage = HDF5Storage(os.path.join(base_dir, "simulations"))
        self.history_dir = os.path.join(base_dir, "history")
        os.makedirs(self.history_dir, exist_ok=True)

    def save_full_simulation(self, config: Dict, results: Dict, summary: Dict) -> Dict[str, str]:
        config_path = self.json_storage.save_config(config)
        results_path = self.hdf5_storage.save_simulation_results(results)
        summary_path = self.json_storage.save_summary(summary)

        return {
            "config_path": config_path,
            "results_path": results_path,
            "summary_path": summary_path
        }

    def load_full_simulation(self, config_filename: str, results_filename: str) -> Dict[str, Any]:
        config = self.json_storage.load_config(config_filename)
        results = self.hdf5_storage.load_simulation_results(results_filename)

        return {
            "config": config,
            "results": results
        }

    def save_historical_data(self, historical_data: List[Dict], filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"historical_data_{timestamp}.json"

        filepath = os.path.join(self.history_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(historical_data, f, ensure_ascii=False, indent=2)

        return filepath

    def load_historical_data(self, filename: str) -> List[Dict]:
        filepath = os.path.join(self.history_dir, filename)

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"历史数据文件不存在: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def get_storage_summary(self) -> Dict:
        return {
            "configs_count": len(self.json_storage.list_configs()),
            "simulations_count": len(self.hdf5_storage.list_simulations()),
            "base_directory": self.base_dir,
            "config_files": self.json_storage.list_configs(),
            "simulation_files": self.hdf5_storage.list_simulations()
        }

    def export_to_csv(self, results: Dict, filename: Optional[str] = None) -> str:
        import csv

        if filename is None:
            simulation_id = results.get("simulation_id", datetime.now().strftime("%Y%m%d_%H%M%S"))
            filename = f"simulation_{simulation_id}.csv"

        filepath = os.path.join(self.base_dir, "simulations", filename)

        time = results.get("time", [])
        states = results.get("states", [])
        state_names = results.get("state_names", [])

        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)

            header = ["time"] + state_names
            writer.writerow(header)

            for i, t in enumerate(time):
                row = [t] + [states[j][i] for j in range(len(state_names))]
                writer.writerow(row)

        return filepath

    def cleanup_old_files(self, days: int = 30) -> int:
        import time
        current_time = time.time()
        deleted_count = 0

        for root, dirs, files in os.walk(self.base_dir):
            for file in files:
                filepath = os.path.join(root, file)
                file_age = (current_time - os.path.getmtime(filepath)) / (24 * 3600)

                if file_age > days:
                    os.remove(filepath)
                    deleted_count += 1

        return deleted_count
