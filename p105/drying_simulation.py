import numpy as np
import h5py
import json
import os
from datetime import datetime
from typing import Dict, Optional, Tuple

from material_params import MaterialParamsManager
from numerical_solver import DryingSolver


class DryingSimulation:
    def __init__(self, config_path: Optional[str] = None):
        self.material_manager = MaterialParamsManager()
        self.solver = DryingSolver(nx=50)

        self.config = self._get_default_config()
        if config_path and os.path.exists(config_path):
            self.load_config(config_path)

        self.results = {}
        self.simulation_id = None

    def _get_default_config(self) -> Dict:
        return {
            'material': 'raw_lacquer',
            'temperature': 25.0,
            'humidity': 60.0,
            'simulation_time': 86400.0,
            'time_step': 60.0,
            'initial_temperature': 20.0,
            'output_dir': 'results'
        }

    def load_config(self, config_path: str):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                loaded_config = json.load(f)
            self.config.update(loaded_config)
            print(f"配置文件加载成功: {config_path}")
        except Exception as e:
            print(f"加载配置文件失败: {e}，使用默认配置")

    def save_config(self, config_path: str):
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=4, ensure_ascii=False)

    def set_parameter(self, key: str, value):
        if key in self.config:
            self.config[key] = value
        else:
            print(f"警告: 未知参数 {key}")

    def get_parameter(self, key: str):
        return self.config.get(key)

    def run_simulation(self) -> bool:
        try:
            material_name = self.config['material']
            material = self.material_manager.get_material(material_name)
            if material is None:
                print(f"错误: 未找到漆料类型 {material_name}")
                return False

            self.solver.set_geometry(material.thickness)

            nx = self.solver.nx
            initial_moisture = np.ones(nx) * material.initial_moisture_content
            initial_temp = np.ones(nx) * self.config['initial_temperature']

            num_steps = int(self.config['simulation_time'] / self.config['time_step'])

            time, moisture_history, temp_history = self.solver.solve_coupled_drying(
                initial_moisture,
                initial_temp,
                material.to_dict(),
                self.config['temperature'],
                self.config['humidity'],
                self.config['time_step'],
                num_steps
            )

            drying_rate = self.solver.calculate_drying_rate(time, moisture_history)
            effective_diffusivity = self.solver.calculate_effective_diffusivity(time, moisture_history)

            self.results = {
                'time': time,
                'moisture_history': moisture_history,
                'temperature_history': temp_history,
                'drying_rate': drying_rate,
                'effective_diffusivity': effective_diffusivity,
                'x_coordinates': self.solver.x,
                'material': material.to_dict(),
                'config': self.config.copy()
            }

            self.simulation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            print(f"模拟完成! 有效扩散系数: {effective_diffusivity:.2e} m²/s")
            return True

        except Exception as e:
            print(f"模拟过程出错: {e}")
            return False

    def get_results(self) -> Optional[Dict]:
        return self.results if self.results else None

    def save_results_to_hdf5(self, filename: Optional[str] = None) -> Optional[str]:
        if not self.results:
            print("没有可保存的结果")
            return None

        if filename is None:
            filename = f"drying_results_{self.simulation_id}.h5"

        output_dir = self.config['output_dir']
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, filename)

        try:
            with h5py.File(filepath, 'w') as f:
                f.create_dataset('time', data=self.results['time'])
                f.create_dataset('moisture_history', data=self.results['moisture_history'])
                f.create_dataset('temperature_history', data=self.results['temperature_history'])
                f.create_dataset('drying_rate', data=self.results['drying_rate'])
                f.create_dataset('x_coordinates', data=self.results['x_coordinates'])

                f.attrs['effective_diffusivity'] = self.results['effective_diffusivity']
                f.attrs['material_name'] = self.results['material']['name']
                f.attrs['simulation_id'] = self.simulation_id

                config_json = json.dumps(self.results['config'])
                f.attrs['config'] = config_json

                material_json = json.dumps(self.results['material'])
                f.attrs['material_params'] = material_json

            print(f"结果已保存到: {filepath}")
            return filepath

        except Exception as e:
            print(f"保存结果失败: {e}")
            return None

    def load_results_from_hdf5(self, filepath: str) -> bool:
        try:
            with h5py.File(filepath, 'r') as f:
                self.results = {
                    'time': np.array(f['time']),
                    'moisture_history': np.array(f['moisture_history']),
                    'temperature_history': np.array(f['temperature_history']),
                    'drying_rate': np.array(f['drying_rate']),
                    'x_coordinates': np.array(f['x_coordinates']),
                    'effective_diffusivity': f.attrs.get('effective_diffusivity', 0.0),
                    'simulation_id': f.attrs.get('simulation_id', 'unknown')
                }

                if 'config' in f.attrs:
                    self.results['config'] = json.loads(f.attrs['config'])
                if 'material_params' in f.attrs:
                    self.results['material'] = json.loads(f.attrs['material_params'])

            print(f"结果已从 {filepath} 加载")
            return True

        except Exception as e:
            print(f"加载结果失败: {e}")
            return False

    def get_drying_curve(self) -> Tuple[np.ndarray, np.ndarray]:
        if not self.results:
            return np.array([]), np.array([])
        time = self.results['time']
        avg_moisture = np.mean(self.results['moisture_history'], axis=1)
        return time, avg_moisture

    def get_temperature_curve(self) -> Tuple[np.ndarray, np.ndarray]:
        if not self.results:
            return np.array([]), np.array([])
        time = self.results['time']
        avg_temp = np.mean(self.results['temperature_history'], axis=1)
        return time, avg_temp

    def get_moisture_profile_at_time(self, time_index: int) -> Tuple[np.ndarray, np.ndarray]:
        if not self.results:
            return np.array([]), np.array([])
        if time_index < 0 or time_index >= len(self.results['time']):
            return np.array([]), np.array([])
        return self.results['x_coordinates'], self.results['moisture_history'][time_index]

    def get_temperature_profile_at_time(self, time_index: int) -> Tuple[np.ndarray, np.ndarray]:
        if not self.results:
            return np.array([]), np.array([])
        if time_index < 0 or time_index >= len(self.results['time']):
            return np.array([]), np.array([])
        return self.results['x_coordinates'], self.results['temperature_history'][time_index]

    def estimate_drying_time(self, target_moisture: float) -> float:
        if not self.results:
            return -1.0
        time, avg_moisture = self.get_drying_curve()
        for t, m in zip(time, avg_moisture):
            if m <= target_moisture:
                return t
        return -1.0
