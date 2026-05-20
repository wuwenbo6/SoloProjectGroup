import numpy as np
from scipy import interpolate, optimize, stats
from scipy.ndimage import gaussian_filter1d
from typing import Tuple, List, Dict, Optional, Union
import warnings
try:
    from numba import jit, prange
    NUMBA_AVAILABLE = True
except ImportError:
    NUMBA_AVAILABLE = False
    def jit(func=None, *args, **kwargs):
        if func is not None:
            return func
        return lambda f: f
    prange = range


class NumericalComputation:
    _cached_temp_effect = {}
    _cache_max_size = 1000

    @staticmethod
    def weighted_average(values: np.ndarray, weights: np.ndarray) -> float:
        if np.sum(weights) == 0 or len(values) == 0:
            return 0.0
        return np.average(values, weights=weights)

    @staticmethod
    def vectorized_weighted_average(values_matrix: np.ndarray, 
                                     weights_matrix: np.ndarray) -> np.ndarray:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            result = np.average(values_matrix, axis=1, weights=weights_matrix)
            result = np.nan_to_num(result, nan=0.0)
        return result

    @staticmethod
    def geometric_mean(values: np.ndarray, weights: Optional[np.ndarray] = None) -> float:
        if weights is None:
            weights = np.ones_like(values)
        values = np.clip(values, 1e-10, None)
        log_vals = np.log(values)
        return np.clip(np.exp(np.average(log_vals, weights=weights)), 0, 1e10)

    @staticmethod
    def harmonic_mean(values: np.ndarray, weights: Optional[np.ndarray] = None) -> float:
        if weights is None:
            weights = np.ones_like(values)
        values_safe = np.clip(values, 1e-10, None)
        denom = np.sum(weights / values_safe)
        if denom < 1e-10:
            return 0.0
        return np.clip(np.sum(weights) / denom, 0, 1e10)

    @staticmethod
    def temperature_effect(temperature: float, ref_temp: float = 25.0, 
                           activation_energy: float = 40.0) -> float:
        cache_key = (temperature, ref_temp, activation_energy)
        if cache_key in NumericalComputation._cached_temp_effect:
            return NumericalComputation._cached_temp_effect[cache_key]
        
        R = 8.314
        result = np.exp(activation_energy * 1000 / R * (1 / (ref_temp + 273.15) - 1 / (temperature + 273.15)))
        
        if len(NumericalComputation._cached_temp_effect) < NumericalComputation._cache_max_size:
            NumericalComputation._cached_temp_effect[cache_key] = result
        
        return result

    @staticmethod
    def vectorized_temperature_effect(temperatures: np.ndarray, ref_temp: float = 25.0,
                                       activation_energy: float = 40.0) -> np.ndarray:
        R = 8.314
        return np.exp(activation_energy * 1000 / R * (1 / (ref_temp + 273.15) - 1 / (temperatures + 273.15)))

    @staticmethod
    def arrhenius_equation(temperatures: np.ndarray, A: float, Ea: float) -> np.ndarray:
        R = 8.314
        return A * np.exp(-Ea * 1000 / (R * (temperatures + 273.15)))

    @staticmethod
    def reaction_kinetics(time: np.ndarray, k: float, order: int = 1) -> np.ndarray:
        if order == 1:
            return np.exp(-k * time)
        elif order == 2:
            return 1 / (1 + k * time)
        else:
            return (1 + (order - 1) * k * time) ** (1 / (1 - order))

    @staticmethod
    def mixing_model(ratios: np.ndarray, properties: np.ndarray) -> np.ndarray:
        return np.dot(ratios, properties)

    @staticmethod
    def batch_mixing_model(ratios_matrix: np.ndarray, 
                           properties_matrix: np.ndarray) -> np.ndarray:
        return np.einsum('ij,kj->ik', ratios_matrix, properties_matrix)

    @staticmethod
    def particle_sedimentation(particle_sizes: np.ndarray, time: np.ndarray,
                               viscosity: float = 1.0, density_diff: float = 1.0) -> np.ndarray:
        g = 9.81
        settling_velocity = (g * density_diff * particle_sizes ** 2) / (18 * viscosity)
        return settling_velocity[:, np.newaxis] * time

    @staticmethod
    def viscosity_model(shear_rates: np.ndarray, eta0: float, 
                        tau: float, n: float = 0.8) -> np.ndarray:
        return eta0 / (1 + (tau * shear_rates) ** (1 - n))

    @staticmethod
    def diffusion_model(time: np.ndarray, D: float, initial_conc: float = 1.0) -> np.ndarray:
        time_safe = np.clip(time, 1e-10, None)
        D_safe = max(D, 1e-10)
        denominator = np.sqrt(4 * np.pi * D_safe * time_safe)
        result = initial_conc / denominator
        return np.clip(result, 0, 1e10)

    @staticmethod
    def vectorized_diffusion_model(time_array: np.ndarray, D_array: np.ndarray,
                                    initial_conc_array: Optional[np.ndarray] = None) -> np.ndarray:
        if initial_conc_array is None:
            initial_conc_array = np.ones_like(time_array)
        
        time_safe = np.clip(time_array, 1e-10, None)
        D_safe = np.clip(D_array, 1e-10, None)
        denominator = np.sqrt(4 * np.pi * D_safe * time_safe)
        result = initial_conc_array / denominator
        return np.clip(result, 0, 1e10)

    @staticmethod
    def carbonization_degree(temperature: np.ndarray, time: float, 
                            T_start: float = 300.0, rate: float = 0.005) -> np.ndarray:
        temp_safe = np.clip(temperature, 0, 3000)
        time_safe = np.maximum(time, 0.1)
        temp_effect = np.where(temp_safe < T_start, 0.0, 
                               1 - np.exp(-rate * np.clip(temp_safe - T_start, 0, None)))
        carbonization = temp_effect * (1 - np.exp(-time_safe / 60))
        return np.clip(carbonization, 0, 1.0)

    @staticmethod
    def reaction_kinetics(time: np.ndarray, k: float, order: int = 1) -> np.ndarray:
        time_safe = np.clip(time, 0, 1e6)
        k_safe = np.clip(k, 0, 1e3)
        if order == 1:
            return np.exp(-k_safe * time_safe)
        elif order == 2:
            return 1 / (1 + k_safe * time_safe)
        else:
            denom = (1 + (order - 1) * k_safe * time_safe)
            denom = np.clip(denom, 1e-10, None)
            return denom ** (1 / (1 - order))

    @staticmethod
    def interpolate_curve(x: np.ndarray, y: np.ndarray, 
                         new_x: np.ndarray, method: str = 'cubic') -> np.ndarray:
        if method == 'linear':
            f = interpolate.interp1d(x, y, kind='linear', fill_value='extrapolate')
        elif method == 'cubic':
            f = interpolate.CubicSpline(x, y)
        elif method == 'akima':
            f = interpolate.Akima1DInterpolator(x, y)
        else:
            raise ValueError(f"Unknown interpolation method: {method}")
        return f(new_x)

    @staticmethod
    def smooth_curve(y: np.ndarray, sigma: float = 1.0) -> np.ndarray:
        return gaussian_filter1d(y, sigma=sigma)

    @staticmethod
    def curve_fit(model_func, x: np.ndarray, y: np.ndarray, 
                  p0: Optional[List] = None) -> Tuple[np.ndarray, np.ndarray]:
        popt, pcov = optimize.curve_fit(model_func, x, y, p0=p0)
        perr = np.sqrt(np.diag(pcov))
        return popt, perr

    @staticmethod
    def calculate_statistics(data: np.ndarray) -> Dict:
        return {
            'mean': np.mean(data),
            'median': np.median(data),
            'std': np.std(data),
            'var': np.var(data),
            'min': np.min(data),
            'max': np.max(data),
            'q25': np.percentile(data, 25),
            'q75': np.percentile(data, 75),
            'skewness': stats.skew(data),
            'kurtosis': stats.kurtosis(data)
        }

    @staticmethod
    def grayscale_to_l(grayscale: float) -> float:
        return 116 * ((grayscale / 255 + 0.16) / 1.16) ** (1/3) - 16

    @staticmethod
    def l_to_grayscale(L: float) -> float:
        return 255 * (1.16 * ((L + 16) / 116) ** 3 - 0.16)

    @staticmethod
    def calculate_blackness(carbon_content: float, particle_size: float, 
                           temperature_effect: float) -> float:
        base_blackness = 50 + 50 * carbon_content
        size_factor = np.exp(-particle_size / 0.1)
        temp_factor = 0.5 + 0.5 * temperature_effect
        return base_blackness * size_factor * temp_factor

    @staticmethod
    def calculate_gloss(binder_ratio: float, particle_size: float, 
                       smoothness: float = 0.8) -> float:
        base_gloss = 30 + 70 * binder_ratio
        size_factor = np.exp(-particle_size / 0.05)
        smooth_factor = 0.7 + 0.3 * smoothness
        return min(100, base_gloss * size_factor * smooth_factor)

    @staticmethod
    def calculate_durability(carbon_content: float, binder_strength: float,
                            water_resistance: float) -> float:
        return 100 * (0.4 * carbon_content + 0.4 * binder_strength + 0.2 * water_resistance)

    @staticmethod
    def optimize_mixture(target_properties: Dict, 
                        available_materials: List[Dict],
                        constraints: Optional[Dict] = None) -> Tuple[np.ndarray, float]:
        n_materials = len(available_materials)
        prop_names = list(target_properties.keys())
        
        def objective(ratios):
            predicted = {}
            for prop in prop_names:
                values = np.array([m['properties'].get(prop, 0) for m in available_materials])
                predicted[prop] = np.sum(ratios * values)
            
            error = 0.0
            for prop, target in target_properties.items():
                error += ((predicted[prop] - target) / target) ** 2
            
            return error
        
        def constraint_sum(ratios):
            return np.sum(ratios) - 1.0
        
        bounds = [(0, 1) for _ in range(n_materials)]
        cons = [{'type': 'eq', 'fun': constraint_sum}]
        
        if constraints:
            for key, (low, high) in constraints.items():
                def make_constraint(idx, l, h):
                    def c(r):
                        return h - r[idx] if idx < len(r) else 0
                    return c
                bounds[key] = (low, high)
        
        x0 = np.ones(n_materials) / n_materials
        result = optimize.minimize(objective, x0, method='SLSQP', 
                                   bounds=bounds, constraints=cons)
        
        return result.x, result.fun

    @staticmethod
    def calculate_mixture_properties(ratios: np.ndarray, 
                                    materials: List[Dict]) -> Dict:
        properties = {}
        all_props = set()
        for mat in materials:
            all_props.update(mat['properties'].keys())
        
        for prop in all_props:
            values = np.array([m['properties'].get(prop, 0) for m in materials])
            properties[prop] = np.sum(ratios * values)
        
        return properties

    @staticmethod
    def vectorized_calculate_blackness(carbon_content_array: np.ndarray, 
                                        particle_size_array: np.ndarray,
                                        temp_effect_array: np.ndarray) -> np.ndarray:
        base_blackness = 50 + 50 * carbon_content_array
        size_factor = np.exp(-particle_size_array / 0.1)
        temp_factor = 0.5 + 0.5 * temp_effect_array
        return base_blackness * size_factor * temp_factor

    @staticmethod
    def vectorized_calculate_gloss(binder_ratio_array: np.ndarray,
                                    particle_size_array: np.ndarray,
                                    smoothness_array: Optional[np.ndarray] = None) -> np.ndarray:
        if smoothness_array is None:
            smoothness_array = np.ones_like(binder_ratio_array) * 0.8
        
        base_gloss = 30 + 70 * binder_ratio_array
        size_factor = np.exp(-particle_size_array / 0.05)
        smooth_factor = 0.7 + 0.3 * smoothness_array
        return np.minimum(100, base_gloss * size_factor * smooth_factor)

    @staticmethod
    def batch_optimize_mixture(target_properties_list: List[Dict],
                                available_materials: List[Dict],
                                use_parallel: bool = False,
                                n_jobs: int = -1) -> List[Tuple[np.ndarray, float]]:
        results = []
        
        if use_parallel and NUMBA_AVAILABLE:
            try:
                from joblib import Parallel, delayed
                results = Parallel(n_jobs=n_jobs)(
                    delayed(NumericalComputation.optimize_mixture)(
                        target, available_materials
                    ) for target in target_properties_list
                )
                return results
            except ImportError:
                pass
        
        for target in target_properties_list:
            result = NumericalComputation.optimize_mixture(target, available_materials)
            results.append(result)
        
        return results

    @staticmethod
    def batch_calculate_mixture_properties(ratios_matrix: np.ndarray,
                                            materials: List[Dict]) -> Dict[str, np.ndarray]:
        all_props = set()
        for mat in materials:
            all_props.update(mat['properties'].keys())
        
        results = {}
        for prop in all_props:
            values = np.array([m['properties'].get(prop, 0) for m in materials])
            results[prop] = np.dot(ratios_matrix, values)
        
        return results

    @staticmethod
    def clear_cache():
        NumericalComputation._cached_temp_effect.clear()

    @staticmethod
    def benchmark_performance(n_samples: int = 1000, verbose: bool = True) -> Dict:
        import time
        
        results = {}
        
        temperatures = np.random.uniform(200, 1200, n_samples)
        times = np.random.uniform(30, 300, n_samples)
        
        start = time.time()
        for t in temperatures:
            NumericalComputation.temperature_effect(t)
        results['single_temp_effect_time'] = time.time() - start
        
        start = time.time()
        NumericalComputation.vectorized_temperature_effect(temperatures)
        results['vectorized_temp_effect_time'] = time.time() - start
        
        start = time.time()
        NumericalComputation.carbonization_degree(temperatures, 120.0)
        results['carbonization_degree_time'] = time.time() - start
        
        ratios_matrix = np.random.rand(100, 5)
        ratios_matrix = ratios_matrix / ratios_matrix.sum(axis=1, keepdims=True)
        props_matrix = np.random.rand(5, 10)
        
        start = time.time()
        NumericalComputation.batch_mixing_model(ratios_matrix, props_matrix)
        results['batch_mixing_time'] = time.time() - start
        
        results['speedup_temp_effect'] = (
            results['single_temp_effect_time'] / results['vectorized_temp_effect_time']
            if results['vectorized_temp_effect_time'] > 0 else 0
        )
        
        if verbose:
            print(f"性能基准测试 (n_samples={n_samples}):")
            print(f"  单次温度效应计算: {results['single_temp_effect_time']:.4f}s")
            print(f"  向量化温度效应计算: {results['vectorized_temp_effect_time']:.4f}s")
            print(f"  加速比: {results['speedup_temp_effect']:.2f}x")
            print(f"  碳化度计算: {results['carbonization_degree_time']:.4f}s")
            print(f"  批量混合计算: {results['batch_mixing_time']:.4f}s")
        
        return results
