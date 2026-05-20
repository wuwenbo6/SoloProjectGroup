import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Callable
from dataclasses import dataclass
import time
from functools import lru_cache, wraps
import warnings


@dataclass
class PerformanceMetrics:
    original_time: float
    optimized_time: float
    speedup_factor: float
    memory_usage_mb: float
    cache_hit_rate: float
    n_operations: int


class ComputationOptimizer:
    def __init__(self, use_vectorization: bool = True, 
                 use_caching: bool = True,
                 use_parallel: bool = False,
                 chunk_size: int = 1000):
        self.use_vectorization = use_vectorization
        self.use_caching = use_caching
        self.use_parallel = use_parallel
        self.chunk_size = chunk_size
        self.cache_hits = 0
        self.cache_misses = 0
        self.performance_history: List[Dict[str, Any]] = []
    
    def timed_execution(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            start = time.time()
            result = func(self, *args, **kwargs)
            elapsed = time.time() - start
            return result, elapsed
        return wrapper
    
    def vectorize_stress_calculation(self,
                                    x_coords: np.ndarray,
                                    y_coords: np.ndarray,
                                    load: float,
                                    beam_width: float,
                                    beam_height: float,
                                    beam_length: float) -> Dict[str, np.ndarray]:
        if not self.use_vectorization:
            return self._stress_calculation_serial(x_coords, y_coords, load,
                                                   beam_width, beam_height, beam_length)
        
        I = beam_width * beam_height ** 3 / 12
        y_dist = y_coords - beam_height / 2
        x_dist = beam_length - x_coords
        
        sigma_x = load * x_dist * y_dist / I
        tau_xy = load * (beam_height ** 2 / 4 - y_dist ** 2) / (2 * I * beam_width)
        sigma_y = np.zeros_like(sigma_x)
        
        sigma_1 = (sigma_x + sigma_y) / 2 + np.sqrt(((sigma_x - sigma_y) / 2) ** 2 + tau_xy ** 2)
        sigma_2 = (sigma_x + sigma_y) / 2 - np.sqrt(((sigma_x - sigma_y) / 2) ** 2 + tau_xy ** 2)
        
        von_mises = np.sqrt(sigma_x ** 2 - sigma_x * sigma_y + sigma_y ** 2 + 3 * tau_xy ** 2)
        von_mises = np.nan_to_num(von_mises, nan=0.0, posinf=1e15, neginf=-1e15)
        
        return {
            'sigma_x': sigma_x,
            'sigma_y': sigma_y,
            'tau_xy': tau_xy,
            'sigma_1': sigma_1,
            'sigma_2': sigma_2,
            'von_mises': von_mises
        }
    
    def _stress_calculation_serial(self,
                                    x_coords: np.ndarray,
                                    y_coords: np.ndarray,
                                    load: float,
                                    beam_width: float,
                                    beam_height: float,
                                    beam_length: float) -> Dict[str, np.ndarray]:
        n_points = len(x_coords)
        sigma_x = np.zeros(n_points)
        sigma_y = np.zeros(n_points)
        tau_xy = np.zeros(n_points)
        
        I = beam_width * beam_height ** 3 / 12
        
        for i in range(n_points):
            y_dist = y_coords[i] - beam_height / 2
            x_dist = beam_length - x_coords[i]
            
            sigma_x[i] = load * x_dist * y_dist / I
            tau_xy[i] = load * (beam_height ** 2 / 4 - y_dist ** 2) / (2 * I * beam_width)
        
        sigma_1 = (sigma_x + sigma_y) / 2 + np.sqrt(((sigma_x - sigma_y) / 2) ** 2 + tau_xy ** 2)
        sigma_2 = (sigma_x + sigma_y) / 2 - np.sqrt(((sigma_x - sigma_y) / 2) ** 2 + tau_xy ** 2)
        
        von_mises = np.sqrt(sigma_x ** 2 - sigma_x * sigma_y + sigma_y ** 2 + 3 * tau_xy ** 2)
        von_mises = np.nan_to_num(von_mises, nan=0.0, posinf=1e15, neginf=-1e15)
        
        return {
            'sigma_x': sigma_x,
            'sigma_y': sigma_y,
            'tau_xy': tau_xy,
            'sigma_1': sigma_1,
            'sigma_2': sigma_2,
            'von_mises': von_mises
        }
    
    def batch_process_stress(self,
                            n_samples: int,
                            load_range: Tuple[float, float],
                            beam_width: float,
                            beam_height: float,
                            beam_length: float,
                            progress_callback: Optional[Callable[[int, int], None]] = None) -> Dict[str, Any]:
        x_coords = np.random.uniform(0, beam_length, n_samples)
        y_coords = np.random.uniform(0, beam_height, n_samples)
        loads = np.random.uniform(load_range[0], load_range[1], n_samples)
        
        all_results = {
            'sigma_x': [],
            'sigma_y': [],
            'tau_xy': [],
            'von_mises': []
        }
        
        n_chunks = (n_samples + self.chunk_size - 1) // self.chunk_size
        
        for i in range(n_chunks):
            start_idx = i * self.chunk_size
            end_idx = min(start_idx + self.chunk_size, n_samples)
            
            chunk_x = x_coords[start_idx:end_idx]
            chunk_y = y_coords[start_idx:end_idx]
            chunk_loads = loads[start_idx:end_idx]
            
            for j in range(len(chunk_x)):
                result = self.vectorize_stress_calculation(
                    np.array([chunk_x[j]]),
                    np.array([chunk_y[j]]),
                    chunk_loads[j],
                    beam_width,
                    beam_height,
                    beam_length
                )
                
                all_results['sigma_x'].append(result['sigma_x'][0])
                all_results['sigma_y'].append(result['sigma_y'][0])
                all_results['tau_xy'].append(result['tau_xy'][0])
                all_results['von_mises'].append(result['von_mises'][0])
            
            if progress_callback:
                progress_callback(end_idx, n_samples)
        
        for key in all_results:
            all_results[key] = np.array(all_results[key])
        
        return all_results
    
    @lru_cache(maxsize=1024)
    def _cached_beam_properties(self, width: float, height: float, 
                                 length: float, material: str) -> Tuple[float, float, float]:
        self.cache_misses += 1
        
        E = {
            'oak': 12e9,
            'pine': 10e9,
            'maple': 13e9,
            'walnut': 11e9
        }.get(material, 12e9)
        
        I = width * height ** 3 / 12
        A = width * height
        
        return E, I, A
    
    def get_beam_properties(self, width: float, height: float,
                            length: float, material: str) -> Dict[str, float]:
        if self.use_caching:
            E, I, A = self._cached_beam_properties(width, height, length, material)
        else:
            self.cache_misses += 1
            E, I, A = self._cached_beam_properties.__wrapped__(self, width, height, length, material)
        
        return {'E': E, 'I': I, 'A': A}
    
    def fast_safety_factor_calculation(self,
                                        stresses: np.ndarray,
                                        yield_strength: float) -> np.ndarray:
        with np.errstate(divide='ignore', invalid='ignore'):
            sf = yield_strength / stresses
            sf = np.nan_to_num(sf, nan=100.0, posinf=100.0, neginf=0.0)
            sf = np.clip(sf, 0, 100)
        
        return sf
    
    def optimize_parametric_study(self,
                                    param_ranges: Dict[str, Tuple[float, float]],
                                    n_samples_per_param: int = 20,
                                    base_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if base_params is None:
            base_params = {
                'beam_width': 0.05,
                'beam_height': 0.05,
                'beam_length': 0.3,
                'tenon_length': 0.03,
                'tenon_width': 0.02,
                'friction_coefficient': 0.5,
                'wood_type': 'oak'
            }
        
        results = {
            'parameters': [],
            'max_stress': [],
            'safety_factor': [],
            'deformation': []
        }
        
        param_names = list(param_ranges.keys())
        total_samples = len(param_names) * n_samples_per_param
        
        for i, param_name in enumerate(param_names):
            param_min, param_max = param_ranges[param_name]
            param_values = np.linspace(param_min, param_max, n_samples_per_param)
            
            for value in param_values:
                current_params = base_params.copy()
                current_params[param_name] = value
                
                props = self.get_beam_properties(
                    current_params['beam_width'],
                    current_params['beam_height'],
                    current_params['beam_length'],
                    current_params['wood_type']
                )
                
                max_stress = 3 * 1000 * current_params['beam_length'] / \
                            (current_params['beam_width'] * current_params['beam_height'] ** 2)
                
                safety_factor = 40e6 / max_stress if max_stress > 0 else 100
                
                deformation = 1000 * current_params['beam_length'] ** 3 / \
                             (3 * props['E'] * props['I'])
                
                results['parameters'].append(current_params.copy())
                results['max_stress'].append(max_stress)
                results['safety_factor'].append(safety_factor)
                results['deformation'].append(deformation)
        
        for key in ['max_stress', 'safety_factor', 'deformation']:
            results[key] = np.array(results[key])
        
        return results
    
    def benchmark_performance(self, n_points: int = 10000) -> PerformanceMetrics:
        x_coords = np.random.uniform(0, 0.3, n_points)
        y_coords = np.random.uniform(0, 0.05, n_points)
        
        original_setting = self.use_vectorization
        self.use_vectorization = False
        
        start = time.time()
        _ = self._stress_calculation_serial(x_coords, y_coords, 1000, 0.05, 0.05, 0.3)
        original_time = time.time() - start
        
        self.use_vectorization = True
        
        start = time.time()
        _ = self.vectorize_stress_calculation(x_coords, y_coords, 1000, 0.05, 0.05, 0.3)
        optimized_time = time.time() - start
        
        self.use_vectorization = original_setting
        
        speedup = original_time / max(optimized_time, 1e-10)
        
        memory_mb = (x_coords.nbytes + y_coords.nbytes) / 1024 / 1024
        
        total_cache_ops = self.cache_hits + self.cache_misses
        hit_rate = self.cache_hits / max(total_cache_ops, 1)
        
        return PerformanceMetrics(
            original_time=original_time,
            optimized_time=optimized_time,
            speedup_factor=speedup,
            memory_usage_mb=memory_mb,
            cache_hit_rate=hit_rate,
            n_operations=n_points
        )
    
    def print_benchmark_report(self, n_points: int = 10000) -> None:
        metrics = self.benchmark_performance(n_points)
        
        print("\n" + "="*60)
        print("⚡ 计算性能优化基准测试")
        print("="*60)
        
        print(f"\n测试配置:")
        print(f"  计算点数: {metrics.n_operations:,}")
        print(f"  向量化优化: {'开启' if self.use_vectorization else '关闭'}")
        print(f"  缓存优化: {'开启' if self.use_caching else '关闭'}")
        
        print(f"\n性能结果:")
        print(f"  串行计算时间: {metrics.original_time*1000:.2f} ms")
        print(f"  优化计算时间: {metrics.optimized_time*1000:.2f} ms")
        print(f"  加速比: {metrics.speedup_factor:.2f}x")
        
        print(f"\n资源使用:")
        print(f"  内存使用: {metrics.memory_usage_mb:.2f} MB")
        print(f"  缓存命中率: {metrics.cache_hit_rate:.1%}")
        
        if metrics.speedup_factor > 10:
            performance_level = "🚀 极优"
        elif metrics.speedup_factor > 5:
            performance_level = "⚡ 优秀"
        elif metrics.speedup_factor > 2:
            performance_level = "✅ 良好"
        else:
            performance_level = "⚠️  一般"
        
        print(f"\n性能评级: {performance_level}")
        print("="*60 + "\n")


class FastDataProcessor:
    def __init__(self, dtype=np.float32):
        self.dtype = dtype
    
    def compress_stress_data(self, stress_field: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
        compressed = {}
        
        for key, value in stress_field.items():
            if isinstance(value, np.ndarray):
                compressed[key] = value.astype(self.dtype)
        
        return compressed
    
    def downsample_stress_field(self, stress_data: np.ndarray,
                                original_resolution: int,
                                target_resolution: int) -> np.ndarray:
        if target_resolution >= original_resolution:
            return stress_data
        
        factor = original_resolution // target_resolution
        
        if len(stress_data.shape) == 1:
            downsampled = stress_data[::factor]
        elif len(stress_data.shape) == 2:
            downsampled = stress_data[::factor, ::factor]
        else:
            downsampled = stress_data
        
        return downsampled
    
    def compute_statistics_fast(self, data: np.ndarray) -> Dict[str, float]:
        valid_data = data[np.isfinite(data)]
        
        if len(valid_data) == 0:
            return {
                'mean': 0.0,
                'std': 0.0,
                'min': 0.0,
                'max': 0.0,
                'median': 0.0,
                'percentile_95': 0.0
            }
        
        return {
            'mean': float(np.mean(valid_data)),
            'std': float(np.std(valid_data)),
            'min': float(np.min(valid_data)),
            'max': float(np.max(valid_data)),
            'median': float(np.median(valid_data)),
            'percentile_95': float(np.percentile(valid_data, 95))
        }
