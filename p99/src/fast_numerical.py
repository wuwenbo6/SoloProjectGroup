import numpy as np
from typing import Dict, List, Optional, Tuple, Callable
from scipy.linalg import solve_banded
from scipy.integrate import ode
import time


class VectorizedHeatSolver:
    def __init__(self, material_props: Dict):
        self.rho = material_props.get('density', 2300.0)
        self.cp = material_props.get('specific_heat', 850.0)
        self.k = material_props.get('thermal_conductivity', 1.5)
        self.alpha = self.k / (self.rho * self.cp)

    def solve_1d_fft_based(self, x: np.ndarray, T_initial: np.ndarray,
                            t_span: Tuple[float, float], h: float,
                            T_ambient_func: Callable, num_time_steps: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        dx = x[1] - x[0]
        t = np.linspace(t_span[0], t_span[1], num_time_steps)

        n = len(x)
        T = np.zeros((num_time_steps, n))
        T[0] = T_initial.copy()

        T_ambient = np.array([T_ambient_func(ti) for ti in t])

        dt = t[1] - t[0]
        Fo = self.alpha * dt / dx ** 2
        Bi = h * dx / self.k

        A = np.diag(1 + 2 * Fo * np.ones(n)) + \
            np.diag(-Fo * np.ones(n - 1), 1) + \
            np.diag(-Fo * np.ones(n - 1), -1)

        A[0, 0] = 1 + Fo * (1 + Bi)
        A[0, 1] = -Fo
        A[-1, -1] = 1 + Fo * (1 + Bi)
        A[-1, -2] = -Fo

        ab = np.zeros((3, n))
        ab[0, 1:] = np.diag(A, 1)
        ab[1, :] = np.diag(A, 0)
        ab[2, :-1] = np.diag(A, -1)

        for i in range(1, num_time_steps):
            b = T[i - 1].copy()
            b[0] += Fo * Bi * T_ambient[i]
            b[-1] += Fo * Bi * T_ambient[i]
            T[i] = solve_banded((1, 1), ab, b)

        return t, T

    def solve_batch(self, batch_configs: List[Dict], parallel: bool = False) -> List[Dict]:
        results = []

        if parallel:
            try:
                from concurrent.futures import ProcessPoolExecutor
                import multiprocessing

                num_workers = min(multiprocessing.cpu_count(), len(batch_configs))

                with ProcessPoolExecutor(max_workers=num_workers) as executor:
                    futures = [
                        executor.submit(self._solve_single_config, config)
                        for config in batch_configs
                    ]
                    results = [f.result() for f in futures]

            except ImportError:
                for config in batch_configs:
                    results.append(self._solve_single_config(config))
        else:
            for config in batch_configs:
                results.append(self._solve_single_config(config))

        return results

    def _solve_single_config(self, config: Dict) -> Dict:
        x = config['x']
        T_initial = config['T_initial']
        t_span = config['t_span']
        h = config['h']
        T_ambient_func = config['T_ambient_func']

        t, T = self.solve_1d_fft_based(x, T_initial, t_span, h, T_ambient_func)

        return {
            'time': t,
            'position': x,
            'temperature': T
        }


class OptimizedODESolver:
    def __init__(self, method: str = 'dopri5'):
        self.method = method

    def solve_vectorized(self, f: Callable, t_span: Tuple[float, float],
                          y0: np.ndarray, args: Tuple = (),
                          num_steps: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        t = np.linspace(t_span[0], t_span[1], num_steps)
        y = np.zeros((num_steps, len(y0)))
        y[0] = y0

        r = ode(f)
        r.set_integrator(self.method, nsteps=10000)
        r.set_initial_value(y0, t[0])
        r.set_f_params(*args)

        for i in range(1, num_steps):
            y[i] = r.integrate(t[i])
            if not r.successful():
                break

        return t, y


class FastThermodynamics:
    @staticmethod
    def calculate_heat_capacity_vectorized(T: np.ndarray) -> np.ndarray:
        T_celsius = T - 273.15
        return 850.0 + 0.5 * T_celsius + 0.0005 * T_celsius ** 2

    @staticmethod
    def calculate_thermal_expansion_vectorized(T: np.ndarray,
                                                T_ref: float = 293.15) -> np.ndarray:
        alpha = 5e-6
        return 1.0 + alpha * (T - T_ref)

    @staticmethod
    def calculate_heat_flux_vectorized(T: np.ndarray, k: float,
                                        dx: float) -> np.ndarray:
        flux = -k * np.gradient(T, dx, axis=-1)
        return flux


class MultiKilnBatchSimulator:
    def __init__(self, num_workers: Optional[int] = None):
        self.num_workers = num_workers

    def run_batch_simulation(self, kiln_configs: List[Dict],
                              progress_callback: Optional[Callable] = None) -> List[Dict]:
        results = []

        try:
            from concurrent.futures import ProcessPoolExecutor
            import multiprocessing

            num_workers = self.num_workers or min(multiprocessing.cpu_count(),
                                                   len(kiln_configs))

            with ProcessPoolExecutor(max_workers=num_workers) as executor:
                futures = [
                    executor.submit(self._run_single_kiln, config)
                    for config in kiln_configs
                ]

                for i, f in enumerate(futures):
                    results.append(f.result())
                    if progress_callback:
                        progress_callback(i + 1, len(kiln_configs))

        except Exception:
            for i, config in enumerate(kiln_configs):
                results.append(self._run_single_kiln(config))
                if progress_callback:
                    progress_callback(i + 1, len(kiln_configs))

        return results

    def _run_single_kiln(self, config: Dict) -> Dict:
        from .simulation import KilnSimulation

        sim = KilnSimulation(config)
        results = sim.run()

        return {
            'config': config,
            'results': results
        }


class PerformanceProfiler:
    def __init__(self):
        self.timings: Dict[str, List[float]] = {}
        self.start_times: Dict[str, float] = {}

    def start(self, operation: str):
        self.start_times[operation] = time.time()

    def stop(self, operation: str) -> float:
        if operation in self.start_times:
            elapsed = time.time() - self.start_times[operation]
            if operation not in self.timings:
                self.timings[operation] = []
            self.timings[operation].append(elapsed)
            return elapsed
        return 0.0

    def get_stats(self, operation: str) -> Dict:
        if operation not in self.timings:
            return {}

        times = np.array(self.timings[operation])
        return {
            'mean': float(np.mean(times)),
            'median': float(np.median(times)),
            'std': float(np.std(times)),
            'min': float(np.min(times)),
            'max': float(np.max(times)),
            'total': float(np.sum(times)),
            'count': len(times)
        }

    def get_summary(self) -> Dict:
        summary = {}
        for op in self.timings:
            summary[op] = self.get_stats(op)
        return summary

    def print_summary(self):
        print("\n" + "=" * 60)
        print("Performance Summary")
        print("=" * 60)
        for op, stats in self.get_summary().items():
            print(f"\n{op}:")
            print(f"  Count: {stats['count']}")
            print(f"  Mean: {stats['mean'] * 1000:.2f} ms")
            print(f"  Median: {stats['median'] * 1000:.2f} ms")
            print(f"  Total: {stats['total']:.4f} s")
        print("=" * 60 + "\n")


class MemoryOptimizer:
    @staticmethod
    def optimize_array(arr: np.ndarray, dtype: Optional[np.dtype] = None) -> np.ndarray:
        if dtype is None:
            if np.issubdtype(arr.dtype, np.floating):
                if np.max(np.abs(arr)) < 1e6:
                    dtype = np.float32
                else:
                    dtype = np.float64
            else:
                return arr

        return arr.astype(dtype, copy=False)

    @staticmethod
    def batch_optimize(results: Dict) -> Dict:
        optimized = {}
        for key, value in results.items():
            if isinstance(value, np.ndarray):
                optimized[key] = MemoryOptimizer.optimize_array(value)
            else:
                optimized[key] = value
        return optimized

    @staticmethod
    def estimate_memory_usage(results: Dict) -> Dict:
        usage = {}
        total = 0
        for key, value in results.items():
            if isinstance(value, np.ndarray):
                bytes_used = value.nbytes
                usage[key] = f"{bytes_used / 1024 / 1024:.2f} MB"
                total += bytes_used
            else:
                usage[key] = "0 MB (non-array)"
        usage['total'] = f"{total / 1024 / 1024:.2f} MB"
        return usage


class VectorizedInterpolator:
    @staticmethod
    def interp1d_batch(x: np.ndarray, y: np.ndarray,
                        x_new: np.ndarray, kind: str = 'linear') -> np.ndarray:
        from scipy.interpolate import interp1d

        if y.ndim == 1:
            f = interp1d(x, y, kind=kind, bounds_error=False, fill_value='extrapolate')
            return f(x_new)

        result = np.zeros((y.shape[0], len(x_new)))
        for i in range(y.shape[0]):
            f = interp1d(x, y[i], kind=kind, bounds_error=False, fill_value='extrapolate')
            result[i] = f(x_new)
        return result

    @staticmethod
    def temperature_profile_batch(times: np.ndarray,
                                   profile_points: List[List[float]]) -> np.ndarray:
        profile_x = [p[0] for p in profile_points]
        profile_y = [p[1] for p in profile_points]

        return VectorizedInterpolator.interp1d_batch(
            np.array(profile_x), np.array(profile_y), times
        )


class FastAnomalyDetector:
    def __init__(self, window_size: int = 50):
        self.window_size = window_size

    def detect_outliers_vectorized(self, data: np.ndarray,
                                    threshold: float = 3.0) -> np.ndarray:
        mean = np.mean(data)
        std = np.std(data)
        z_scores = np.abs((data - mean) / (std if std > 0 else 1))
        return z_scores > threshold

    def rolling_std_vectorized(self, data: np.ndarray) -> np.ndarray:
        window = self.window_size
        pad_width = (window // 2, window // 2)
        padded = np.pad(data, pad_width, mode='edge')

        shape = padded.shape[:-1] + (padded.shape[-1] - window + 1, window)
        strides = padded.strides + (padded.strides[-1],)
        windows = np.lib.stride_tricks.as_strided(padded, shape=shape, strides=strides)

        return np.std(windows, axis=-1)

    def detect_change_points_vectorized(self, data: np.ndarray,
                                         sensitivity: float = 2.0) -> np.ndarray:
        grad = np.gradient(data)
        rolling_std = self.rolling_std_vectorized(grad)
        mean_std = np.mean(rolling_std)

        change_points = np.where(np.abs(grad) > sensitivity * mean_std)[0]
        return change_points


def benchmark_solver(solver_class, config: Dict, num_runs: int = 10) -> Dict:
    profiler = PerformanceProfiler()

    x = np.linspace(0, 0.1, 50)
    T_initial = np.ones(50) * 293.15
    t_span = (0, 86400)

    def T_ambient_func(t):
        return 293.15 + 1200 * (t / 86400)

    solver = solver_class(config.get('material', {}))

    for i in range(num_runs):
        profiler.start('solve')
        solver.solve_1d_fft_based(x, T_initial, t_span, 25.0, T_ambient_func)
        profiler.stop('solve')

    return profiler.get_stats('solve')
