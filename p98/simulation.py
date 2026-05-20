import numpy as np
import h5py
import json
from datetime import datetime
from typing import Dict, Optional, List
from numerical import FermentationKinetics, DataInterpolator, MultiStrainKinetics
from anomaly_detection import FermentationAnomalyDetector


class FermentationSimulator:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_default_config()
        if config_path:
            self.load_config(config_path)
        self.kinetics = FermentationKinetics(self.config['kinetics'])
        self.results = None
        self.sensor_data = None
        self.multi_strain_results = None
        self.anomaly_detector = FermentationAnomalyDetector()
        self.last_anomaly_report = None

    def _load_default_config(self) -> Dict:
        return {
            'simulation': {
                'duration': 168,
                'time_step': 1,
                'method': 'fast_ode'
            },
            'initial_conditions': {
                'temperature': 25.0,
                'humidity': 0.6,
                'biomass': 0.1,
                'substrate': 100.0,
                'product': 0.0,
                'co2': 0.0
            },
            'kinetics': {
                'mu_max': 0.3,
                'ks': 5.0,
                'y_xs': 0.5,
                'y_ps': 1.2,
                'm_s': 0.01,
                'k_heat': 20.0,
                'ua': 10.0,
                'mass': 1000.0,
                'cp': 4.18,
                'env_temp': 20.0,
                'target_hum': 0.7,
                'evap_rate': 0.001,
                'vent_rate': 0.01
            },
            'multi_strain': {
                'strains': [
                    {
                        'name': '酵母A',
                        'mu_max': 0.35,
                        'ks': 4.0,
                        'y_xs': 0.55,
                        'y_ps': 1.3,
                        'm_s': 0.008,
                        'k_heat': 22.0,
                        'temp_opt': 30.0,
                        'hum_opt': 0.65,
                        'carrying_capacity': 80
                    },
                    {
                        'name': '酵母B',
                        'mu_max': 0.25,
                        'ks': 6.0,
                        'y_xs': 0.45,
                        'y_ps': 1.5,
                        'm_s': 0.012,
                        'k_heat': 18.0,
                        'temp_opt': 28.0,
                        'hum_opt': 0.75,
                        'carrying_capacity': 60
                    }
                ],
                'initial_biomass': [0.05, 0.05]
            }
        }

    def load_config(self, config_path: str) -> None:
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config.update(json.load(f))
        self.kinetics = FermentationKinetics(self.config['kinetics'])

    def save_config(self, config_path: str) -> None:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

    def set_initial_conditions(self, **kwargs) -> None:
        self.config['initial_conditions'].update(kwargs)

    def set_kinetic_parameters(self, **kwargs) -> None:
        self.config['kinetics'].update(kwargs)
        self.kinetics = FermentationKinetics(self.config['kinetics'])

    def set_simulation_parameters(self, **kwargs) -> None:
        self.config['simulation'].update(kwargs)

    def run_simulation(self, enable_anomaly_detection: bool = True) -> Dict:
        sim_config = self.config['simulation']
        init_cond = self.config['initial_conditions']
        
        duration = sim_config['duration']
        time_step = sim_config['time_step']
        method = sim_config['method']
        
        t_eval = np.arange(0, duration + time_step, time_step)
        t_span = (0, duration)
        
        y0 = np.array([
            init_cond['temperature'],
            init_cond['humidity'],
            init_cond['biomass'],
            init_cond['substrate'],
            init_cond['product'],
            init_cond['co2']
        ])
        
        self.results = self.kinetics.solve_fermentation(y0, t_span, t_eval, method)
        
        self._enforce_physical_constraints()
        
        self._calculate_derived_quantities()
        
        if enable_anomaly_detection:
            self.last_anomaly_report = self.run_anomaly_detection()
        
        return self.results

    def run_multi_strain_simulation(self, enable_anomaly_detection: bool = True) -> Dict:
        sim_config = self.config['simulation']
        init_cond = self.config['initial_conditions']
        multi_strain_config = self.config['multi_strain']
        
        duration = sim_config['duration']
        time_step = sim_config['time_step']
        method = sim_config['method']
        
        t_eval = np.arange(0, duration + time_step, time_step)
        t_span = (0, duration)
        
        n_strains = len(multi_strain_config['strains'])
        initial_biomass = multi_strain_config.get('initial_biomass', [0.05] * n_strains)
        
        y0 = np.concatenate([
            [init_cond['temperature'], init_cond['humidity']],
            initial_biomass,
            [init_cond['substrate'], init_cond['product'], init_cond['co2']]
        ])
        
        strains = multi_strain_config['strains']
        env_params = self.config['kinetics']
        
        multi_kinetics = MultiStrainKinetics(strains, env_params)
        self.multi_strain_results = multi_kinetics.solve_multi_strain(y0, t_span, t_eval, method)
        
        if enable_anomaly_detection:
            self.last_anomaly_report = self.anomaly_detector.detect_all_anomalies(self.multi_strain_results)
        
        return self.multi_strain_results

    def _enforce_physical_constraints(self) -> None:
        if self.results is None:
            return
        
        self.results['temperature'] = np.clip(self.results['temperature'], 0, 100)
        self.results['humidity'] = np.clip(self.results['humidity'], 0, 1)
        self.results['biomass'] = np.clip(self.results['biomass'], 0, 1000)
        self.results['substrate'] = np.clip(self.results['substrate'], 0, 10000)
        self.results['product'] = np.clip(self.results['product'], 0, 1000)
        self.results['co2'] = np.clip(self.results['co2'], 0, 5000)
        
        for i in range(1, len(self.results['time'])):
            if not np.isfinite(self.results['biomass'][i]) or self.results['biomass'][i] > 10 * self.results['biomass'][i-1]:
                self.results['biomass'][i] = self.results['biomass'][i-1]
            if not np.isfinite(self.results['substrate'][i]) or self.results['substrate'][i] < 0.5 * self.results['substrate'][i-1]:
                self.results['substrate'][i] = self.results['substrate'][i-1]

    def _calculate_derived_quantities(self) -> None:
        if self.results is None:
            return
        
        time = self.results['time']
        
        self.results['growth_rate'] = DataInterpolator.calculate_derivative(
            time, self.results['biomass']
        )
        
        self.results['substrate_consumption_rate'] = -DataInterpolator.calculate_derivative(
            time, self.results['substrate']
        )
        
        self.results['productivity'] = DataInterpolator.calculate_derivative(
            time, self.results['product']
        )
        
        self.results['growth_rate'] = np.nan_to_num(self.results['growth_rate'], nan=0, posinf=0, neginf=0)
        self.results['substrate_consumption_rate'] = np.nan_to_num(self.results['substrate_consumption_rate'], nan=0, posinf=0, neginf=0)
        self.results['productivity'] = np.nan_to_num(self.results['productivity'], nan=0, posinf=0, neginf=0)
        
        self.results['specific_growth_rate'] = np.divide(
            self.results['growth_rate'],
            self.results['biomass'],
            out=np.zeros_like(self.results['growth_rate']),
            where=self.results['biomass'] > 1e-6
        )
        self.results['specific_growth_rate'] = np.nan_to_num(self.results['specific_growth_rate'], nan=0, posinf=0, neginf=0)
        self.results['specific_growth_rate'] = np.clip(self.results['specific_growth_rate'], 0, 2)

    def run_anomaly_detection(self) -> List:
        results_to_check = self.multi_strain_results if self.multi_strain_results else self.results
        if results_to_check is None:
            raise ValueError("需要先运行仿真")
        
        return self.anomaly_detector.detect_all_anomalies(results_to_check)

    def get_anomaly_summary(self) -> Dict:
        return self.anomaly_detector.get_alert_summary()

    def generate_anomaly_report(self) -> str:
        return self.anomaly_detector.generate_report()

    def load_sensor_data(self, time: np.ndarray, data: Dict[str, np.ndarray]) -> None:
        self.sensor_data = {'time': time}
        self.sensor_data.update(data)

    def compare_with_sensor_data(self) -> Dict:
        if self.results is None or self.sensor_data is None:
            raise ValueError("需要先运行仿真并加载传感器数据")
        
        comparison = {}
        sim_time = self.results['time']
        
        for key in self.sensor_data:
            if key == 'time':
                continue
            
            if key in self.results:
                sensor_interp = DataInterpolator.interpolate_time_series(
                    self.sensor_data['time'],
                    self.sensor_data[key],
                    sim_time
                )
                
                comparison[key] = {
                    'simulation': self.results[key],
                    'sensor': sensor_interp,
                    'error': self.results[key] - sensor_interp,
                    'rmse': np.sqrt(np.mean((self.results[key] - sensor_interp) ** 2))
                }
        
        return comparison

    def run_batch_simulations(self, param_ranges: Dict, n_samples: int = 50) -> List[Dict]:
        from scipy.stats import qmc
        
        sampler = qmc.LatinHypercube(d=len(param_ranges))
        sample = sampler.random(n=n_samples)
        
        param_names = list(param_ranges.keys())
        param_values = []
        for i, name in enumerate(param_names):
            min_val, max_val = param_ranges[name]
            scaled = min_val + sample[:, i] * (max_val - min_val)
            param_values.append(scaled)
        
        original_config = self.config['kinetics'].copy()
        batch_results = []
        
        for i in range(n_samples):
            for j, name in enumerate(param_names):
                self.config['kinetics'][name] = param_values[j][i]
            
            self.kinetics = FermentationKinetics(self.config['kinetics'])
            self.run_simulation(enable_anomaly_detection=False)
            
            summary = self.get_summary()
            summary['params'] = {name: param_values[j][i] for j, name in enumerate(param_names)}
            batch_results.append(summary)
        
        self.config['kinetics'] = original_config
        self.kinetics = FermentationKinetics(original_config)
        
        return batch_results

    def save_results(self, filepath: str) -> None:
        if self.results is None and self.multi_strain_results is None:
            raise ValueError("没有可保存的仿真结果")
        
        results_to_save = self.multi_strain_results if self.multi_strain_results else self.results
        
        with h5py.File(filepath, 'w') as f:
            f.attrs['timestamp'] = datetime.now().isoformat()
            f.attrs['config'] = json.dumps(self.config, ensure_ascii=False)
            f.attrs['is_multi_strain'] = self.multi_strain_results is not None
            
            for key, value in results_to_save.items():
                f.create_dataset(key, data=value)
            
            if self.sensor_data is not None:
                sensor_group = f.create_group('sensor_data')
                for key, value in self.sensor_data.items():
                    sensor_group.create_dataset(key, data=value)

    def load_results(self, filepath: str) -> Dict:
        with h5py.File(filepath, 'r') as f:
            results = {}
            for key in f.keys():
                if key != 'sensor_data':
                    results[key] = np.array(f[key])
            
            if f.attrs.get('is_multi_strain', False):
                self.multi_strain_results = results
                self.results = None
            else:
                self.results = results
                self.multi_strain_results = None
            
            if 'sensor_data' in f:
                self.sensor_data = {}
                for key in f['sensor_data']:
                    self.sensor_data[key] = np.array(f['sensor_data'][key])
            
            if 'config' in f.attrs:
                self.config = json.loads(f.attrs['config'])
                self.kinetics = FermentationKinetics(self.config['kinetics'])
        
        return self.multi_strain_results if self.multi_strain_results else self.results

    def get_summary(self) -> Dict:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("需要先运行仿真")
        
        biomass_key = 'total_biomass' if self.multi_strain_results else 'biomass'
        
        summary = {
            'final_temperature': results['temperature'][-1],
            'final_humidity': results['humidity'][-1],
            'final_biomass': results[biomass_key][-1],
            'final_substrate': results['substrate'][-1],
            'final_product': results['product'][-1],
            'substrate_conversion': (
                1 - results['substrate'][-1] / results['substrate'][0]
            ) * 100
        }
        
        if 'growth_rate' in results:
            summary['max_growth_rate'] = np.max(results['growth_rate'])
        if 'productivity' in results:
            summary['avg_productivity'] = np.mean(results['productivity'])
        
        if self.multi_strain_results:
            for i in range(len(self.config['multi_strain']['strains'])):
                summary[f'final_biomass_strain_{i}'] = results[f'biomass_{i}'][-1]
        
        return summary
