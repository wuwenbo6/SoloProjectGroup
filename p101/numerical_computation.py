import numpy as np
from scipy import interpolate
from scipy.ndimage import gaussian_filter1d
from typing import Tuple, Dict, Optional


class NumericalComputer:
    def __init__(self):
        pass

    @staticmethod
    def weighted_average(properties: np.ndarray, ratios: np.ndarray) -> np.ndarray:
        return np.sum(properties * ratios, axis=-1)

    @staticmethod
    def fiber_interaction_model(lengths: np.ndarray, diameters: np.ndarray, 
                                ratios: np.ndarray, soak_time: float) -> float:
        avg_length = np.sum(lengths * ratios)
        avg_diameter = np.sum(diameters * ratios)
        
        avg_diameter = np.clip(avg_diameter, 0.005, 1.0)
        
        aspect_ratio = avg_length / avg_diameter
        aspect_ratio = np.clip(aspect_ratio, 10, 500)
        soak_factor = 1.0 - np.exp(-soak_time / 24.0)
        
        interaction_coeff = 0.15 * aspect_ratio * soak_factor
        return np.clip(interaction_coeff, 0.0, 5.0)

    @staticmethod
    def calculate_soaking_effect(soak_time: float, water_absorption: np.ndarray, 
                                  ratios: np.ndarray) -> np.ndarray:
        max_absorption = 1.0
        absorption_rate = 0.05
        absorption_level = max_absorption * (1 - np.exp(-absorption_rate * soak_time))
        effective_absorption = water_absorption * absorption_level
        weighted_absorption = np.sum(effective_absorption * ratios)
        return weighted_absorption

    @staticmethod
    def predict_tensile_strength(base_strengths: np.ndarray, ratios: np.ndarray,
                                  soak_time: float, fiber_lengths: np.ndarray) -> float:
        base_avg = np.sum(base_strengths * ratios)
        avg_length = np.sum(fiber_lengths * ratios)
        
        length_factor = np.tanh(avg_length / 2.0)
        soak_factor = 0.85 + 0.15 * np.tanh(soak_time / 12.0)
        interaction_factor = NumericalComputer.fiber_interaction_model(
            fiber_lengths, np.array([0.02]*len(fiber_lengths)), ratios, soak_time
        )
        
        predicted_strength = base_avg * length_factor * soak_factor * (1 + interaction_factor)
        return predicted_strength

    @staticmethod
    def calculate_porosity(ratios: np.ndarray, densities: np.ndarray, 
                            soak_time: float) -> float:
        weighted_density = np.sum(densities * ratios)
        expansion_factor = 1.0 + 0.1 * np.tanh(soak_time / 10.0)
        effective_density = weighted_density / expansion_factor
        
        base_porosity = 0.4
        porosity = base_porosity * (1.5 - effective_density / 1.5)
        return np.clip(porosity, 0.2, 0.8)

    @staticmethod
    def smooth_curve(x: np.ndarray, y: np.ndarray, sigma: float = 2.0) -> Tuple[np.ndarray, np.ndarray]:
        y_smooth = gaussian_filter1d(y, sigma=sigma)
        return x, y_smooth

    @staticmethod
    def interpolate_curve(x: np.ndarray, y: np.ndarray, new_x: np.ndarray,
                           kind: str = 'cubic') -> np.ndarray:
        f = interpolate.interp1d(x, y, kind=kind, fill_value='extrapolate')
        return f(new_x)

    @staticmethod
    def calculate_fiber_distribution(ratios: np.ndarray, fiber_lengths: np.ndarray,
                                      num_bins: int = 20) -> Tuple[np.ndarray, np.ndarray]:
        if len(fiber_lengths) == 0:
            return np.array([]), np.array([])
        
        min_len = np.min(fiber_lengths) * 0.8
        max_len = np.max(fiber_lengths) * 1.2
        
        if abs(max_len - min_len) < 0.001:
            max_len = min_len + 0.5
        
        bins = np.linspace(min_len, max_len, num_bins + 1)
        bin_width = bins[1] - bins[0]
        bin_centers = (bins[:-1] + bins[1:]) / 2
        
        distribution = np.zeros(num_bins)
        for ratio, length in zip(ratios, fiber_lengths):
            idx = np.searchsorted(bins, length, side='right') - 1
            idx = np.clip(idx, 0, num_bins - 1)
            distribution[idx] += ratio
        
        return bin_centers, distribution

    @staticmethod
    def calculate_quality_metrics(strength: float, porosity: float,
                                   water_absorption: float) -> Dict[str, float]:
        uniformity = 1.0 - abs(0.45 - porosity)
        durability = strength * uniformity * 0.01
        printability = (1.0 - abs(0.5 - water_absorption)) * 100
        
        return {
            'strength': strength,
            'porosity': porosity,
            'water_absorption': water_absorption,
            'uniformity': uniformity,
            'durability': durability,
            'printability': printability,
            'overall_score': (strength * 0.4 + uniformity * 30 + printability * 0.3)
        }
