import numpy as np
from typing import List, Dict, Tuple, Optional
from material_params import LacquerMaterial, MaterialParamsManager
from numerical_solver import DryingSolver


class LacquerLayer:
    def __init__(self, material: LacquerMaterial, thickness: float, layer_id: int):
        self.material = material
        self.thickness = thickness
        self.layer_id = layer_id
        self.moisture = None
        self.temperature = None
        self.nx = 0

    def initialize(self, nx: int, initial_moisture: float, initial_temp: float):
        self.nx = nx
        self.moisture = np.ones(nx) * initial_moisture
        self.temperature = np.ones(nx) * initial_temp

    def get_properties(self) -> Dict:
        return {
            'density': self.material.density,
            'specific_heat': self.material.specific_heat,
            'thermal_conductivity': self.material.thermal_conductivity,
            'pre_exponential_factor': self.material.pre_exponential_factor,
            'activation_energy': self.material.activation_energy,
            'equilibrium_moisture': self.material.equilibrium_moisture
        }


class MultiLayerDryingSimulator:
    def __init__(self, nx_per_layer: int = 30):
        self.nx_per_layer = nx_per_layer
        self.layers: List[LacquerLayer] = []
        self.material_manager = MaterialParamsManager()
        self.results = {}
        self.x_global = None
        self.layer_boundaries = []

    def add_layer(self, material_name: str, thickness: float) -> int:
        material = self.material_manager.get_material(material_name)
        if material is None:
            raise ValueError(f"漆料类型不存在: {material_name}")

        layer_id = len(self.layers)
        layer = LacquerLayer(material, thickness, layer_id)
        self.layers.append(layer)
        return layer_id

    def _build_global_mesh(self):
        total_thickness = sum(layer.thickness for layer in self.layers)
        nx_total = len(self.layers) * self.nx_per_layer

        self.x_global = np.zeros(nx_total)
        self.layer_boundaries = []
        current_pos = 0

        for layer in self.layers:
            dx = layer.thickness / (self.nx_per_layer - 1)
            start_idx = layer.layer_id * self.nx_per_layer
            end_idx = start_idx + self.nx_per_layer

            self.x_global[start_idx:end_idx] = np.linspace(
                current_pos, current_pos + layer.thickness, self.nx_per_layer
            )
            self.layer_boundaries.append((current_pos, current_pos + layer.thickness))
            current_pos += layer.thickness

        return nx_total, total_thickness

    def _get_interface_indices(self) -> List[int]:
        interfaces = []
        for i in range(len(self.layers) - 1):
            interface_idx = (i + 1) * self.nx_per_layer - 1
            interfaces.append(interface_idx)
        return interfaces

    def run_simulation(
        self,
        ambient_temp: float,
        humidity: float,
        simulation_time: float,
        dt: float = 60.0,
        initial_temp: float = 20.0,
        save_interval: int = 1
    ) -> Dict:
        if not self.layers:
            raise ValueError("请先添加漆料层")

        nx_total, _ = self._build_global_mesh()
        total_steps = int(simulation_time / dt)
        nt = (total_steps // save_interval) + 1

        moisture_history = np.zeros((nt, nx_total))
        temp_history = np.zeros((nt, nx_total))

        for layer in self.layers:
            layer.initialize(
                self.nx_per_layer,
                layer.material.initial_moisture_content,
                initial_temp
            )

        for layer in self.layers:
            start_idx = layer.layer_id * self.nx_per_layer
            end_idx = start_idx + self.nx_per_layer
            moisture_history[0, start_idx:end_idx] = layer.moisture
            temp_history[0, start_idx:end_idx] = layer.temperature

        R = 8.314
        h_conv = 15.0
        h_mass = 1e-4

        humidity_clamped = max(0.0, min(100.0, humidity))

        for step in range(1, total_steps + 1):
            for layer in self.layers:
                start_idx = layer.layer_id * self.nx_per_layer
                end_idx = start_idx + self.nx_per_layer

                props = layer.get_properties()
                M_eq = props['equilibrium_moisture'] * (humidity_clamped / 100.0)
                M_eq = max(0.001, min(0.5, M_eq))

                T_avg = np.mean(layer.temperature) + 273.15
                D = props['pre_exponential_factor'] * np.exp(-props['activation_energy'] / (R * T_avg))
                D = max(D, 1e-12)

                dx = layer.thickness / (self.nx_per_layer - 1)
                alpha_T = props['thermal_conductivity'] * dt / (props['density'] * props['specific_heat'] * dx ** 2)
                alpha_T = min(alpha_T, 0.5)
                alpha_M = D * dt / (dx ** 2)
                alpha_M = min(alpha_M, 0.5)

                new_moisture = self._solve_layer_diffusion(layer.moisture, M_eq, alpha_M, h_mass, D, dx)
                new_temp = self._solve_layer_heat(layer.temperature, ambient_temp, alpha_T, h_conv, props['thermal_conductivity'], dx)

                layer.moisture = np.clip(new_moisture, M_eq * 0.5, 1.0)
                layer.temperature = np.clip(new_temp, -50.0, 200.0)

            if step % save_interval == 0:
                history_idx = step // save_interval
                if history_idx < nt:
                    for layer in self.layers:
                        start_idx = layer.layer_id * self.nx_per_layer
                        end_idx = start_idx + self.nx_per_layer
                        moisture_history[history_idx, start_idx:end_idx] = layer.moisture
                        temp_history[history_idx, start_idx:end_idx] = layer.temperature

        time = np.arange(nt) * dt * save_interval

        self.results = {
            'time': time,
            'moisture_history': moisture_history,
            'temperature_history': temp_history,
            'x_global': self.x_global,
            'layer_boundaries': self.layer_boundaries,
            'layer_info': [
                {
                    'layer_id': layer.layer_id,
                    'material': layer.material.name,
                    'thickness': layer.thickness,
                    'x_start': self.layer_boundaries[layer.layer_id][0],
                    'x_end': self.layer_boundaries[layer.layer_id][1]
                }
                for layer in self.layers
            ],
            'ambient_temp': ambient_temp,
            'humidity': humidity
        }

        return self.results

    def _solve_layer_diffusion(self, M, M_eq, alpha, h_mass, D, dx):
        nx = len(M)
        D_safe = max(D, 1e-12)
        biot_m = min(h_mass * dx / D_safe, 1000.0)

        a = np.ones(nx - 1) * (-alpha)
        b = np.ones(nx) * (1 + 2 * alpha)
        c = np.ones(nx - 1) * (-alpha)
        d = M.copy()

        b[0] = 1 + alpha + alpha * biot_m
        b[-1] = 1 + alpha + alpha * biot_m
        d[0] += alpha * biot_m * M_eq
        d[-1] += alpha * biot_m * M_eq

        result = self._thomas_solve(a, b, c, d)
        return np.nan_to_num(result, nan=M_eq, posinf=1.0, neginf=M_eq * 0.5)

    def _solve_layer_heat(self, T, T_amb, alpha, h_conv, k, dx):
        nx = len(T)
        k_safe = max(k, 1e-6)
        biot = min(h_conv * dx / k_safe, 1000.0)

        a = np.ones(nx - 1) * (-alpha)
        b = np.ones(nx) * (1 + 2 * alpha)
        c = np.ones(nx - 1) * (-alpha)
        d = T.copy()

        b[0] = 1 + alpha + alpha * biot
        b[-1] = 1 + alpha + alpha * biot
        d[0] += alpha * biot * T_amb
        d[-1] += alpha * biot * T_amb

        result = self._thomas_solve(a, b, c, d)
        return np.nan_to_num(result, nan=T_amb, posinf=200.0, neginf=-50.0)

    def _thomas_solve(self, a, b, c, d):
        n = len(d)
        c_prime = np.zeros(n - 1)
        d_prime = np.zeros(n)
        x = np.zeros(n)

        c_prime[0] = c[0] / b[0]
        d_prime[0] = d[0] / b[0]

        for i in range(1, n - 1):
            temp = b[i] - a[i - 1] * c_prime[i - 1]
            c_prime[i] = c[i] / temp
            d_prime[i] = (d[i] - a[i - 1] * d_prime[i - 1]) / temp

        d_prime[-1] = (d[-1] - a[-1] * d_prime[-2]) / (b[-1] - a[-1] * c_prime[-1])
        x[-1] = d_prime[-1]

        for i in range(n - 2, -1, -1):
            x[i] = d_prime[i] - c_prime[i] * x[i + 1]

        return x

    def get_layer_results(self, layer_id: int) -> Optional[Dict]:
        if layer_id < 0 or layer_id >= len(self.layers):
            return None

        start_idx = layer_id * self.nx_per_layer
        end_idx = start_idx + self.nx_per_layer

        return {
            'time': self.results['time'],
            'moisture_history': self.results['moisture_history'][:, start_idx:end_idx],
            'temperature_history': self.results['temperature_history'][:, start_idx:end_idx],
            'x': self.results['x_global'][start_idx:end_idx],
            'layer_info': self.results['layer_info'][layer_id]
        }

    def get_average_moisture_all_layers(self) -> Tuple[np.ndarray, np.ndarray]:
        time = self.results['time']
        avg_moisture = np.mean(self.results['moisture_history'], axis=1)
        return time, avg_moisture

    def get_layer_interface_gradient(self, step: int = -1) -> List[Dict]:
        gradients = []
        for i in range(len(self.layers) - 1):
            interface_idx = (i + 1) * self.nx_per_layer - 1

            moisture_gradient = (
                self.results['moisture_history'][step, interface_idx + 1] -
                self.results['moisture_history'][step, interface_idx]
            )
            temp_gradient = (
                self.results['temperature_history'][step, interface_idx + 1] -
                self.results['temperature_history'][step, interface_idx]
            )

            gradients.append({
                'between_layers': (i, i + 1),
                'moisture_gradient': moisture_gradient,
                'temperature_gradient': temp_gradient,
                'position': self.x_global[interface_idx]
            })
        return gradients

    def get_drying_time_by_layer(self, target_moisture: float = 0.08) -> Dict[int, float]:
        drying_times = {}
        for layer_id in range(len(self.layers)):
            layer_result = self.get_layer_results(layer_id)
            avg_moisture = np.mean(layer_result['moisture_history'], axis=1)

            for t, m in zip(layer_result['time'], avg_moisture):
                if m <= target_moisture:
                    drying_times[layer_id] = t
                    break
            else:
                drying_times[layer_id] = -1

        return drying_times
