import numpy as np
from scipy.integrate import odeint
from scipy.optimize import minimize
from scipy.interpolate import interp1d
from typing import Callable, List, Tuple, Optional, Dict


class NumericalCalculator:
    def __init__(self, rate_constant: float = 0.01):
        self.rate_constant = rate_constant

    def arrhenius_equation(self, temperature: float, Ea: float = 50000, 
                           A: float = 1e6) -> float:
        R = 8.314
        try:
            exponent = -Ea / (R * (temperature + 273.15))
            exponent = np.clip(exponent, -100, 0)
            return A * np.exp(exponent)
        except (OverflowError, FloatingPointError):
            return 0.0

    def reaction_kinetics(self, concentrations: np.ndarray, t: float,
                          temperature: float, rate_constant: Optional[float] = None) -> np.ndarray:
        k = rate_constant if rate_constant else self.arrhenius_equation(temperature)
        dCdt = -k * concentrations
        return dCdt

    def simulate_reaction(self, initial_concentrations: np.ndarray,
                          temperature: float, time_span: Tuple[float, float],
                          num_points: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        t = np.linspace(time_span[0], time_span[1], num_points)
        initial_concentrations = np.clip(np.array(initial_concentrations), 0, 1e10)
        k = self.arrhenius_equation(temperature)
        result = odeint(self.reaction_kinetics, initial_concentrations, t,
                        args=(temperature, k))
        result = np.clip(result, 0, 1e10)
        return t, result

    def calculate_mixture_properties(self, concentrations: np.ndarray,
                                     ratios: np.ndarray) -> np.ndarray:
        total_concentration = np.sum(concentrations * ratios)
        return total_concentration

    def beer_lambert(self, concentration: float, absorption_coeff: float,
                     path_length: float = 1.0) -> float:
        return absorption_coeff * path_length * concentration

    def calculate_absorption_spectrum(self, concentrations: np.ndarray,
                                      absorption_coeffs: np.ndarray,
                                      path_length: float = 1.0) -> np.ndarray:
        return np.array([self.beer_lambert(c, a, path_length) 
                         for c, a in zip(concentrations, absorption_coeffs)])

    def optimize_ratio(self, target_absorption: np.ndarray,
                       absorption_coeffs: np.ndarray,
                       bounds: Optional[List[Tuple[float, float]]] = None) -> np.ndarray:
        n = len(absorption_coeffs)
        if bounds is None:
            bounds = [(0, 1) for _ in range(n)]

        def objective(ratios):
            ratios = ratios / np.sum(ratios)
            absorption = np.dot(ratios, absorption_coeffs)
            return np.sum((absorption - target_absorption) ** 2)

        x0 = np.ones(n) / n
        result = minimize(objective, x0, bounds=bounds, method='L-BFGS-B')
        optimized_ratios = result.x / np.sum(result.x)
        return optimized_ratios

    def temperature_effect_curve(self, temp_range: Tuple[float, float],
                                  initial_concentrations: np.ndarray,
                                  time_point: float = 10.0,
                                  num_points: int = 50) -> Tuple[np.ndarray, np.ndarray]:
        temperatures = np.linspace(temp_range[0], temp_range[1], num_points)
        final_concentrations = []

        for temp in temperatures:
            k = self.arrhenius_equation(temp)
            t_span = (0, time_point)
            t, result = self.simulate_reaction(initial_concentrations, temp, t_span, 2)
            final_concentrations.append(result[-1])

        return temperatures, np.array(final_concentrations)

    def interpolate_data(self, x: np.ndarray, y: np.ndarray,
                         kind: str = 'linear') -> Callable:
        return interp1d(x, y, kind=kind, fill_value='extrapolate')

    def calculate_reaction_yield(self, initial_conc: float,
                                  final_conc: float) -> float:
        if initial_conc == 0:
            return 0.0
        return ((initial_conc - final_conc) / initial_conc) * 100

    def multi_component_diffusion(self, concentrations: np.ndarray,
                                    diffusion_coeffs: np.ndarray,
                                    time: float, distance: float) -> np.ndarray:
        concentrations = np.clip(concentrations, 0, 1e10)
        if distance == 0:
            return np.zeros_like(concentrations)
        exponent = -diffusion_coeffs * time / (distance ** 2)
        exponent = np.clip(exponent, -100, 0)
        return concentrations * np.exp(exponent)

    def ph_effect_calculation(self, ph: float, pka: float,
                               concentration: float) -> float:
        ratio = 10 ** (ph - pka)
        return concentration * (ratio / (1 + ratio))

    def calculate_kinetic_parameters(self, time_data: np.ndarray,
                                      conc_data: np.ndarray) -> Tuple[float, float]:
        def objective(params):
            k, C0 = params
            predicted = C0 * np.exp(-k * time_data)
            return np.sum((predicted - conc_data) ** 2)

        x0 = [0.01, conc_data[0]]
        bounds = [(0, None), (0, None)]
        result = minimize(objective, x0, bounds=bounds)
        k_opt, C0_opt = result.x
        return k_opt, C0_opt

    def batch_reaction_simulation(self, initial_concentrations: np.ndarray,
                                   temperature_profile: np.ndarray,
                                   time_points: np.ndarray) -> np.ndarray:
        results = np.zeros((len(time_points), len(initial_concentrations)))
        results[0] = initial_concentrations

        for i in range(1, len(time_points)):
            dt = time_points[i] - time_points[i-1]
            temp = temperature_profile[i-1]
            k = self.arrhenius_equation(temp)
            results[i] = results[i-1] * np.exp(-k * dt)

        return results
