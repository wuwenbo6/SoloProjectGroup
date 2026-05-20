import numpy as np
import h5py
import json
from datetime import datetime
from .numerical import HeatTransferSolver, ThermodynamicsCalculator, AtmosphereModel, Interpolator


class KilnSimulation:
    def __init__(self, config=None):
        self.config = config or self._default_config()
        self.results = None
        self.time_array = None
        self._initialize_components()

    def _default_config(self):
        return {
            'simulation': {
                'total_time': 86400,
                'time_step': 60,
                'geometry': {
                    'thickness': 0.1,
                    'num_nodes': 21
                }
            },
            'material': {
                'density': 2300.0,
                'specific_heat': 850.0,
                'thermal_conductivity': 1.5,
                'organic_content': 0.05,
                'water_content': 0.08
            },
            'kiln': {
                'heat_transfer_coeff': 25.0,
                'volume': 1.0
            },
            'temperature_profile': [
                [0, 293.15],
                [3600, 373.15],
                [10800, 573.15],
                [18000, 873.15],
                [28800, 1273.15],
                [36000, 1523.15],
                [43200, 1523.15],
                [50400, 1273.15],
                [64800, 298.15]
            ],
            'humidity_profile': [
                [0, 0.01],
                [7200, 0.005],
                [14400, 0.001]
            ]
        }

    def _initialize_components(self):
        self.heat_solver = HeatTransferSolver(self.config['material'])
        self.atmosphere = AtmosphereModel()
        self.thermo = ThermodynamicsCalculator()

    def load_config(self, config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        self._initialize_components()

    def save_config(self, config_file):
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=4, ensure_ascii=False)

    def run(self):
        sim_config = self.config['simulation']
        total_time = sim_config['total_time']
        time_step = sim_config['time_step']
        self.time_array = np.arange(0, total_time + time_step, time_step)

        thickness = sim_config['geometry']['thickness']
        num_nodes = sim_config['geometry']['num_nodes']
        x = np.linspace(0, thickness, num_nodes)

        T_initial = np.ones(num_nodes) * 293.15

        def T_ambient_func(t):
            return Interpolator.temperature_profile(t, self.config['temperature_profile'])

        h = self.config['kiln']['heat_transfer_coeff']
        t_span = [0, total_time]

        ode_result = self.heat_solver.solve_transient(
            x, T_initial, t_span, h, T_ambient_func, t_eval=self.time_array
        )

        self.results = {
            'time': self.time_array,
            'position': x,
            'temperature': ode_result.y.T,
            'kiln_temperature': np.array([T_ambient_func(t) for t in self.time_array])
        }

        self._calculate_atmosphere_params()
        self._calculate_physical_changes()

        return self.results

    def _calculate_atmosphere_params(self):
        n = len(self.time_array)
        humidity_profile = self.config['humidity_profile']

        absolute_humidity = np.array([
            Interpolator.temperature_profile(t, humidity_profile)
            for t in self.time_array
        ])

        relative_humidity = self.thermo.relative_humidity(
            self.results['kiln_temperature'],
            absolute_humidity
        )

        oxygen_content = np.array([
            self.atmosphere.update_oxygen_content(T, 101325, t)
            for t, T in zip(self.time_array, self.results['kiln_temperature'])
        ])

        co2_production = np.array([
            self.atmosphere.calculate_co2_production(
                T, self.config['material']['organic_content']
            )
            for T in self.results['kiln_temperature']
        ])

        self.results['absolute_humidity'] = absolute_humidity
        self.results['relative_humidity'] = relative_humidity
        self.results['oxygen_content'] = oxygen_content
        self.results['co2_production'] = co2_production

    def _calculate_physical_changes(self):
        water_content = self.config['material']['water_content']
        organic_content = self.config['material']['organic_content']

        n = len(self.time_array)
        water_remaining = np.ones(n) * water_content
        organic_remaining = np.ones(n) * organic_content

        for i, T in enumerate(self.results['kiln_temperature']):
            if T > 373.15:
                rate = min(0.001 * (T - 373.15), 0.01)
                if i > 0:
                    dt = self.time_array[i] - self.time_array[i - 1]
                    water_remaining[i] = max(0, water_remaining[i - 1] - rate * dt)
                else:
                    water_remaining[i] = water_content
            else:
                if i > 0:
                    water_remaining[i] = water_remaining[i - 1]

        for i, T in enumerate(self.results['kiln_temperature']):
            if T > 673.15:
                rate = min(0.0005 * (T - 673.15), 0.005)
                if i > 0:
                    dt = self.time_array[i] - self.time_array[i - 1]
                    organic_remaining[i] = max(0, organic_remaining[i - 1] - rate * dt)
                else:
                    organic_remaining[i] = organic_content
            else:
                if i > 0:
                    organic_remaining[i] = organic_remaining[i - 1]

        self.results['water_remaining'] = water_remaining
        self.results['organic_remaining'] = organic_remaining

        shrinkage = self.thermo.thermal_expansion(self.results['temperature'])
        self.results['shrinkage'] = shrinkage

    def save_results(self, filename):
        with h5py.File(filename, 'w') as f:
            metadata = f.create_group('metadata')
            metadata.attrs['timestamp'] = datetime.now().isoformat()
            metadata.attrs['version'] = '1.0.0'

            config_str = json.dumps(self.config, ensure_ascii=False)
            metadata.attrs['config'] = config_str

            for key, value in self.results.items():
                if isinstance(value, np.ndarray):
                    f.create_dataset(key, data=value)

    def load_results(self, filename):
        with h5py.File(filename, 'r') as f:
            self.results = {}
            for key in f.keys():
                self.results[key] = np.array(f[key])

            metadata = f['metadata']
            if 'config' in metadata.attrs:
                self.config = json.loads(metadata.attrs['config'])

        self.time_array = self.results['time']
        return self.results
