import numpy as np
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve
from typing import Tuple, Optional, List, Dict, Union
import time


class DryingSolver:
    def __init__(self, nx: int = 50, use_optimized: bool = True):
        self.nx = nx
        self.dx = 0.0
        self.use_optimized = use_optimized
        self._matrix_cache = {}

    def set_geometry(self, thickness: float):
        self.dx = thickness / (self.nx - 1)
        self.x = np.linspace(0, thickness, self.nx)
        self._matrix_cache.clear()

    def _thomas_solve(self, a: np.ndarray, b: np.ndarray, c: np.ndarray, d: np.ndarray) -> np.ndarray:
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

    def _get_cached_matrix(self, key: str, build_func):
        if key not in self._matrix_cache:
            self._matrix_cache[key] = build_func()
        return self._matrix_cache[key]

    def solve_moisture_diffusion(
        self,
        initial_moisture: np.ndarray,
        equilibrium_moisture: float,
        diffusion_coeff: float,
        dt: float,
        num_steps: int,
        surface_mass_transfer: float = 1e-5
    ) -> Tuple[np.ndarray, np.ndarray]:
        nt = num_steps + 1
        nx = self.nx

        moisture_history = np.zeros((nt, nx))
        moisture_history[0] = initial_moisture.copy()

        M = initial_moisture.copy()
        M_eq = equilibrium_moisture

        alpha = diffusion_coeff * dt / (self.dx ** 2)

        main_diag = np.ones(nx) * (1 + 2 * alpha)
        upper_diag = np.ones(nx - 1) * (-alpha)
        lower_diag = np.ones(nx - 1) * (-alpha)

        main_diag[0] = 1 + alpha + surface_mass_transfer * self.dx / diffusion_coeff
        main_diag[-1] = 1 + alpha + surface_mass_transfer * self.dx / diffusion_coeff

        A = diags([lower_diag, main_diag, upper_diag], [-1, 0, 1], format='csr')

        for n in range(1, nt):
            b = M.copy()
            b[0] += alpha * M_eq + surface_mass_transfer * self.dx / diffusion_coeff * M_eq
            b[-1] += alpha * M_eq + surface_mass_transfer * self.dx / diffusion_coeff * M_eq

            M = spsolve(A, b)
            moisture_history[n] = M.copy()

        time = np.arange(nt) * dt
        return time, moisture_history

    def solve_heat_transfer(
        self,
        initial_temp: np.ndarray,
        ambient_temp: float,
        thermal_conductivity: float,
        density: float,
        specific_heat: float,
        dt: float,
        num_steps: int,
        h_conv: float = 10.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        nt = num_steps + 1
        nx = self.nx

        temp_history = np.zeros((nt, nx))
        temp_history[0] = initial_temp.copy()

        T = initial_temp.copy()
        T_amb = ambient_temp

        alpha = thermal_conductivity * dt / (density * specific_heat * self.dx ** 2)
        biot = h_conv * self.dx / thermal_conductivity

        main_diag = np.ones(nx) * (1 + 2 * alpha)
        upper_diag = np.ones(nx - 1) * (-alpha)
        lower_diag = np.ones(nx - 1) * (-alpha)

        main_diag[0] = 1 + alpha + alpha * biot
        main_diag[-1] = 1 + alpha + alpha * biot

        A = diags([lower_diag, main_diag, upper_diag], [-1, 0, 1], format='csr')

        for n in range(1, nt):
            b = T.copy()
            b[0] += alpha * biot * T_amb
            b[-1] += alpha * biot * T_amb

            T = spsolve(A, b)
            temp_history[n] = T.copy()

        time = np.arange(nt) * dt
        return time, temp_history

    def solve_coupled_drying(
        self,
        initial_moisture: np.ndarray,
        initial_temp: np.ndarray,
        material_params: dict,
        ambient_temp: float,
        humidity: float,
        dt: float,
        num_steps: int,
        save_interval: int = 1
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        nt = (num_steps // save_interval) + 1
        nx = self.nx

        moisture_history = np.zeros((nt, nx))
        temp_history = np.zeros((nt, nx))

        moisture_history[0] = initial_moisture.copy()
        temp_history[0] = initial_temp.copy()

        M = initial_moisture.copy()
        T = initial_temp.copy()

        rho = material_params['density']
        cp = material_params['specific_heat']
        k = material_params['thermal_conductivity']
        D0 = material_params['pre_exponential_factor']
        Ea = material_params['activation_energy']
        equilibrium_moisture = material_params['equilibrium_moisture']

        humidity_clamped = max(0.0, min(100.0, humidity))
        M_eq = equilibrium_moisture * (humidity_clamped / 100.0)
        M_eq = max(0.001, min(0.5, M_eq))

        R = 8.314
        h_conv = 15.0
        h_mass = 1e-4

        history_idx = 1

        for n in range(1, num_steps + 1):
            T_avg = np.mean(T) + 273.15
            D = D0 * np.exp(-Ea / (R * T_avg))
            D = max(D, 1e-12)

            alpha_T = k * dt / (rho * cp * self.dx ** 2)
            alpha_T = min(alpha_T, 0.5)
            alpha_M = D * dt / (self.dx ** 2)
            alpha_M = min(alpha_M, 0.5)

            if self.use_optimized:
                M_new = self._implicit_step_moisture_optimized(M, M_eq, alpha_M, h_mass, D)
                T_new = self._implicit_step_temperature_optimized(T, ambient_temp, alpha_T, h_conv, k)
            else:
                M_new = self._implicit_step_moisture(M, M_eq, alpha_M, h_mass, D)
                T_new = self._implicit_step_temperature(T, ambient_temp, alpha_T, h_conv, k)

            M = np.clip(M_new, M_eq * 0.5, 1.0)
            T = np.clip(T_new, -50.0, 200.0)

            if n % save_interval == 0:
                moisture_history[history_idx] = M.copy()
                temp_history[history_idx] = T.copy()
                history_idx += 1

        time = np.arange(nt) * dt * save_interval
        return time, moisture_history, temp_history

    def _implicit_step_moisture_optimized(self, M, M_eq, alpha, h_mass, D):
        nx = len(M)
        D_safe = max(D, 1e-12)
        biot_m = min(h_mass * self.dx / D_safe, 1000.0)

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

    def _implicit_step_temperature_optimized(self, T, T_amb, alpha, h_conv, k):
        nx = len(T)
        k_safe = max(k, 1e-6)
        biot = min(h_conv * self.dx / k_safe, 1000.0)

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

    def batch_solve_drying(
        self,
        parameter_list: List[Dict],
        progress_callback=None
    ) -> List[Dict]:
        results = []
        start_time = time.time()

        for i, params in enumerate(parameter_list):
            material_params = params['material_params']
            nx = self.nx
            initial_moisture = np.ones(nx) * material_params.get('initial_moisture', 0.35)
            initial_temp = np.ones(nx) * params.get('initial_temp', 20.0)

            time_array, moisture, temp = self.solve_coupled_drying(
                initial_moisture,
                initial_temp,
                material_params,
                params['ambient_temp'],
                params['humidity'],
                params['dt'],
                params['num_steps'],
                params.get('save_interval', 1)
            )

            results.append({
                'time': time_array,
                'moisture_history': moisture,
                'temperature_history': temp,
                'parameters': params
            })

            if progress_callback:
                progress_callback(i + 1, len(parameter_list))

        elapsed = time.time() - start_time
        print(f"批量计算完成: {len(parameter_list)} 个仿真，耗时 {elapsed:.2f} 秒")
        return results

    def _implicit_step_moisture(self, M, M_eq, alpha, h_mass, D):
        nx = len(M)
        main_diag = np.ones(nx) * (1 + 2 * alpha)
        upper_diag = np.ones(nx - 1) * (-alpha)
        lower_diag = np.ones(nx - 1) * (-alpha)

        D_safe = max(D, 1e-12)
        biot_m = h_mass * self.dx / D_safe
        biot_m = min(biot_m, 1000.0)
        main_diag[0] = 1 + alpha + alpha * biot_m
        main_diag[-1] = 1 + alpha + alpha * biot_m

        A = diags([lower_diag, main_diag, upper_diag], [-1, 0, 1], format='csr')

        b = M.copy()
        b[0] += alpha * biot_m * M_eq
        b[-1] += alpha * biot_m * M_eq

        result = spsolve(A, b)
        return np.nan_to_num(result, nan=M_eq, posinf=1.0, neginf=M_eq * 0.5)

    def _implicit_step_temperature(self, T, T_amb, alpha, h_conv, k):
        nx = len(T)
        main_diag = np.ones(nx) * (1 + 2 * alpha)
        upper_diag = np.ones(nx - 1) * (-alpha)
        lower_diag = np.ones(nx - 1) * (-alpha)

        k_safe = max(k, 1e-6)
        biot = h_conv * self.dx / k_safe
        biot = min(biot, 1000.0)
        main_diag[0] = 1 + alpha + alpha * biot
        main_diag[-1] = 1 + alpha + alpha * biot

        A = diags([lower_diag, main_diag, upper_diag], [-1, 0, 1], format='csr')

        b = T.copy()
        b[0] += alpha * biot * T_amb
        b[-1] += alpha * biot * T_amb

        result = spsolve(A, b)
        return np.nan_to_num(result, nan=T_amb, posinf=200.0, neginf=-50.0)

    def calculate_drying_rate(self, time: np.ndarray, moisture_history: np.ndarray) -> np.ndarray:
        avg_moisture = np.mean(moisture_history, axis=1)
        drying_rate = np.gradient(avg_moisture, time)
        return -drying_rate

    def calculate_effective_diffusivity(self, time: np.ndarray, moisture_history: np.ndarray) -> float:
        M_avg = np.mean(moisture_history, axis=1)
        M0 = M_avg[0]
        Me = M_avg[-1]

        if M0 <= Me:
            return 0.0

        MR = (M_avg - Me) / (M0 - Me)
        valid_idx = MR > 0.01
        log_MR = np.log(MR[valid_idx])
        t_valid = time[valid_idx]

        if len(t_valid) < 2:
            return 0.0

        slope = np.polyfit(t_valid, log_MR, 1)[0]
        L = self.x[-1] - self.x[0]
        D_eff = -slope * (L ** 2) / (np.pi ** 2)
        return max(D_eff, 0.0)
