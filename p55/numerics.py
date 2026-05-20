import numpy as np
from scipy import interpolate, signal, optimize
from scipy.integrate import cumtrapz
from typing import Tuple, List, Optional, Callable


class ThermalCalculation:
    @staticmethod
    def heat_capacity(T: float, material: str = "clay") -> float:
        if material == "clay":
            return 0.8 + 0.0005 * T + 0.0000002 * T ** 2
        elif material == "kiln_brick":
            return 0.9 + 0.0003 * T
        return 1.0

    @staticmethod
    def thermal_conductivity(T: float, material: str = "clay") -> float:
        if material == "clay":
            return 1.5 * (1 + 0.0001 * T)
        elif material == "kiln_brick":
            return 0.8 * (1 + 0.0002 * T)
        return 1.0

    @staticmethod
    def thermal_diffusivity(T: float, density: float = 2000.0, material: str = "clay") -> float:
        k = ThermalCalculation.thermal_conductivity(T, material)
        cp = ThermalCalculation.heat_capacity(T, material)
        return k / (density * cp)

    @staticmethod
    def calculate_energy_consumption(T_curve: np.ndarray, dt: float, mass: float = 1.0) -> float:
        cp = ThermalCalculation.heat_capacity(T_curve)
        dT = np.gradient(T_curve)
        energy = mass * np.trapz(cp * dT)
        return abs(energy)


class HeatTransferSolver:
    def __init__(self, length: float = 0.1, nx: int = 50):
        self.length = length
        self.nx = nx
        self.x = np.linspace(0, length, nx)
        self.dx = self.x[1] - self.x[0]

    def solve_1d_transient(self, t_total: float, T_surface: np.ndarray,
                           t_points: np.ndarray, initial_temp: float = 25.0) -> Tuple[np.ndarray, np.ndarray]:
        dt = t_points[1] - t_points[0]
        T = np.full((len(t_points), self.nx), initial_temp)
        T[:, 0] = T_surface
        T[:, -1] = T_surface

        for i in range(1, len(t_points)):
            alpha = ThermalCalculation.thermal_diffusivity(np.mean(T[i-1, :]))
            T[i, 1:-1] = T[i-1, 1:-1] + alpha * dt / (self.dx ** 2) * (
                    T[i-1, 2:] - 2 * T[i-1, 1:-1] + T[i-1, :-2]
            )

        return self.x, T


class StressCalculation:
    @staticmethod
    def calculate_thermal_strain(T: np.ndarray, T_ref: float = 25.0,
                                 alpha: float = 5e-6) -> np.ndarray:
        return alpha * (T - T_ref)

    @staticmethod
    def calculate_stress(strain: np.ndarray, E: float = 20e9, nu: float = 0.22) -> np.ndarray:
        return E * strain / (1 - 2 * nu)

    @staticmethod
    def temperature_gradient(T: np.ndarray, x: np.ndarray) -> np.ndarray:
        return np.gradient(T, x, axis=1)


class PhaseChangeCalculation:
    @staticmethod
    def quartz_inversion(T: np.ndarray) -> np.ndarray:
        T_inversion = 573.0
        delta_T = 50.0
        transition = 0.0045 * (1 / (1 + np.exp(-(T - T_inversion) / delta_T)) - 0.5) * 2
        return transition

    @staticmethod
    def vitrification_degree(T: np.ndarray, T_start: float = 900.0,
                            T_end: float = 1250.0) -> np.ndarray:
        vitrification = np.where(
            T < T_start, 0.0,
            np.where(T > T_end, 1.0, (T - T_start) / (T_end - T_start))
        )
        return vitrification

    @staticmethod
    def calculate_energy_consumption(T_curve: np.ndarray, dt: float,
                                     mass: float = 1.0) -> float:
        cp = ThermalCalculation.heat_capacity(T_curve)
        dT = np.gradient(T_curve)
        energy = mass * cumtrapz(cp * dT, dx=dt, initial=0)[-1]
        return abs(energy)


class NumericalUtils:
    @staticmethod
    def smooth_data(data: np.ndarray, window_size: int = 5) -> np.ndarray:
        kernel = np.ones(window_size) / window_size
        return np.convolve(data, kernel, mode='same')

    @staticmethod
    def interpolate_data(x_old: np.ndarray, y_old: np.ndarray,
                         x_new: np.ndarray, method: str = 'cubic') -> np.ndarray:
        if method == 'cubic' and len(x_old) >= 4:
            f = interpolate.interp1d(x_old, y_old, kind='cubic', fill_value='extrapolate')
        elif method == 'linear':
            f = interpolate.interp1d(x_old, y_old, kind='linear', fill_value='extrapolate')
        else:
            f = interpolate.interp1d(x_old, y_old, kind='nearest', fill_value='extrapolate')
        return f(x_new)

    @staticmethod
    def calculate_derivative(x: np.ndarray, y: np.ndarray) -> np.ndarray:
        return np.gradient(y, x)

    @staticmethod
    def calculate_integral(x: np.ndarray, y: np.ndarray) -> float:
        return np.trapz(y, x)

    @staticmethod
    def find_zeros(x: np.ndarray, y: np.ndarray) -> list:
        zeros = []
        for i in range(len(y) - 1):
            if y[i] * y[i + 1] <= 0:
                if abs(y[i + 1] - y[i]) > 1e-10:
                    x_zero = x[i] - y[i] * (x[i + 1] - x[i]) / (y[i + 1] - y[i])
                    zeros.append(x_zero)
        return zeros

    @staticmethod
    def fit_curve(x: np.ndarray, y: np.ndarray, func: Callable,
                  p0: Optional[List] = None) -> Tuple[tuple, np.ndarray]:
        popt, _ = optimize.curve_fit(func, x, y, p0=p0)
        y_fit = func(x, *popt)
        return popt, y_fit

    @staticmethod
    def rms_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return np.sqrt(np.mean((y_true - y_pred) ** 2))

    @staticmethod
    def mean_absolute_error(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return np.mean(np.abs(y_true - y_pred))
