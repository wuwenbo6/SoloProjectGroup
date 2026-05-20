import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import time
import h5py
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
import warnings
from collections import deque


class SolverMethod(Enum):
    RK4 = "RK4"
    RK45 = "RK45"
    ADAPTIVE_RK = "AdaptiveRK"
    EULER = "Euler"
    IMPLICIT_EULER = "ImplicitEuler"


class PrecisionMode(Enum):
    SINGLE = "float32"
    DOUBLE = "float64"


@dataclass
class CheckpointData:
    checkpoint_id: str
    time: float
    state: np.ndarray
    step: int
    wall_time: float
    adaptive_params: Dict = field(default_factory=dict)


@dataclass
class SolverStatistics:
    total_steps: int = 0
    accepted_steps: int = 0
    rejected_steps: int = 0
    f_evals: int = 0
    total_wall_time: float = 0.0
    max_memory_usage: float = 0.0
    avg_step_size: float = 0.0


class VectorizedODESolver:
    """向量化ODE求解器 - 高性能版本"""

    def __init__(self, ode_func: Callable, precision: PrecisionMode = PrecisionMode.DOUBLE):
        self.ode_func = ode_func
        self.precision = precision
        self.dtype = np.float32 if precision == PrecisionMode.SINGLE else np.float64
        self.stats = SolverStatistics()
        self._checkpoints: List[CheckpointData] = []
        self._last_state: Optional[np.ndarray] = None
        self._last_time: float = 0.0

    def rk4_step(self, t: float, y: np.ndarray, h: float, args: Tuple = ()) -> np.ndarray:
        """经典RK4单步 - 向量化实现"""
        self.stats.f_evals += 4
        k1 = h * np.array(self.ode_func(t, y, *args), dtype=self.dtype)
        k2 = h * np.array(self.ode_func(t + h/2, y + k1/2, *args), dtype=self.dtype)
        k3 = h * np.array(self.ode_func(t + h/2, y + k2/2, *args), dtype=self.dtype)
        k4 = h * np.array(self.ode_func(t + h, y + k3, *args), dtype=self.dtype)
        return y + (k1 + 2*k2 + 2*k3 + k4) / 6.0

    def rk45_step(self, t: float, y: np.ndarray, h: float, args: Tuple = ()) -> Tuple[np.ndarray, float, np.ndarray]:
        """自适应步长RK45"""
        self.stats.f_evals += 6

        k1 = h * np.array(self.ode_func(t, y, *args), dtype=self.dtype)
        k2 = h * np.array(self.ode_func(t + h/4, y + k1/4, *args), dtype=self.dtype)
        k3 = h * np.array(self.ode_func(t + 3*h/8, y + 3*k1/32 + 9*k2/32, *args), dtype=self.dtype)
        k4 = h * np.array(self.ode_func(t + 12*h/13, y + 1932*k1/2197 - 7200*k2/2197 + 7296*k3/2197, *args), dtype=self.dtype)
        k5 = h * np.array(self.ode_func(t + h, y + 439*k1/216 - 8*k2 + 3680*k3/513 - 845*k4/4104, *args), dtype=self.dtype)
        k6 = h * np.array(self.ode_func(t + h/2, y - 8*k1/27 + 2*k2 - 3544*k3/2565 + 1859*k4/4104 - 11*k5/40, *args), dtype=self.dtype)

        y4 = y + 25*k1/216 + 1408*k3/2565 + 2197*k4/4104 - k5/5
        y5 = y + 16*k1/135 + 6656*k3/12825 + 28561*k4/56430 - 9*k5/50 + 2*k6/55

        error = np.max(np.abs(y5 - y4) / (1e-8 + np.abs(y5)))
        return y5, error, y4

    def adaptive_solve(self, t_span: Tuple[float, float], y0: np.ndarray,
                       initial_h: float = 0.1, tol: float = 1e-6,
                       max_h: float = 5.0, min_h: float = 1e-4,
                       max_steps: int = 100000,
                       checkpoint_interval: int = 1000,
                       args: Tuple = ()) -> Tuple[np.ndarray, np.ndarray]:
        """自适应步长求解"""
        start_time = time.time()
        t0, tf = t_span
        y = np.array(y0, dtype=self.dtype)
        t = t0
        h = initial_h

        times = [t]
        states = [y.copy()]
        step_count = 0

        while t < tf and step_count < max_steps:
            if t + h > tf:
                h = tf - t

            y_new, error, _ = self.rk45_step(t, y, h, *args)

            if error < tol or h <= min_h:
                t += h
                y = y_new
                times.append(t)
                states.append(y.copy())
                step_count += 1
                self.stats.accepted_steps += 1

                if error > 0:
                    h = min(max_h, h * 0.9 * (tol / error) ** 0.2)

                if step_count % checkpoint_interval == 0:
                    self._save_checkpoint(t, y, step_count, time.time() - start_time)
            else:
                h = max(min_h, h * 0.5)
                self.stats.rejected_steps += 1

        self.stats.total_steps = step_count
        self.stats.total_wall_time = time.time() - start_time
        self.stats.avg_step_size = (tf - t0) / step_count if step_count > 0 else 0

        return np.array(times, dtype=self.dtype), np.array(states, dtype=self.dtype).T

    def fixed_step_solve(self, t_span: Tuple[float, float], y0: np.ndarray,
                         h: float = 0.1, method: SolverMethod = SolverMethod.RK4,
                         checkpoint_interval: int = 1000,
                         args: Tuple = ()) -> Tuple[np.ndarray, np.ndarray]:
        """固定步长求解"""
        start_time = time.time()
        t0, tf = t_span
        y = np.array(y0, dtype=self.dtype)
        t = t0

        n_steps = int(np.ceil((tf - t0) / h)) + 1
        times = np.linspace(t0, tf, n_steps, dtype=self.dtype)
        states = np.zeros((len(y), n_steps), dtype=self.dtype)
        states[:, 0] = y

        for i in range(1, n_steps):
            step_h = times[i] - times[i-1]
            if method == SolverMethod.RK4:
                y = self.rk4_step(times[i-1], states[:, i-1], step_h, *args)
            elif method == SolverMethod.EULER:
                self.stats.f_evals += 1
                dy = np.array(self.ode_func(times[i-1], states[:, i-1], *args), dtype=self.dtype)
                y = states[:, i-1] + step_h * dy

            states[:, i] = y
            t = times[i]
            self.stats.accepted_steps += 1

            if i % checkpoint_interval == 0:
                self._save_checkpoint(t, y, i, time.time() - start_time)

        self.stats.total_steps = n_steps - 1
        self.stats.total_wall_time = time.time() - start_time
        self.stats.avg_step_size = h

        return times, states

    def _save_checkpoint(self, t: float, y: np.ndarray, step: int, wall_time: float):
        """保存检查点"""
        checkpoint = CheckpointData(
            checkpoint_id=f"cp_{step}_{int(time.time())}",
            time=float(t),
            state=y.copy(),
            step=step,
            wall_time=wall_time
        )
        self._checkpoints.append(checkpoint)
        self._last_state = y.copy()
        self._last_time = t

    def get_latest_checkpoint(self) -> Optional[CheckpointData]:
        """获取最新检查点"""
        return self._checkpoints[-1] if self._checkpoints else None

    def restore_from_checkpoint(self, checkpoint: CheckpointData) -> Tuple[float, np.ndarray]:
        """从检查点恢复"""
        self._last_state = checkpoint.state.copy()
        self._last_time = checkpoint.time
        return checkpoint.time, checkpoint.state.copy()

    def get_statistics(self) -> Dict:
        """获取统计信息"""
        return {
            "total_steps": self.stats.total_steps,
            "accepted_steps": self.stats.accepted_steps,
            "rejected_steps": self.stats.rejected_steps,
            "function_evaluations": self.stats.f_evals,
            "total_wall_time": self.stats.total_wall_time,
            "average_step_size": self.stats.avg_step_size,
            "checkpoints_saved": len(self._checkpoints)
        }


class ParallelParameterSweep:
    """并行参数扫描器"""

    def __init__(self, base_config: Dict, max_workers: Optional[int] = None):
        self.base_config = base_config
        self.max_workers = max_workers
        self.results: List[Dict] = []

    @staticmethod
    def _simulation_worker(args_tuple) -> Dict:
        """工作进程 - 独立仿真"""
        idx, param_dict, config, t_span, y0 = args_tuple

        modified_config = config.copy()
        for key, value in param_dict.items():
            keys = key.split('.')
            cfg = modified_config
            for k in keys[:-1]:
                cfg = cfg.setdefault(k, {})
            cfg[keys[-1]] = value

        try:
            from .fermentation_simulator import FermentationSimulator
            sim = FermentationSimulator(config_dict=modified_config)
            result = sim.run_simulation()
            return {
                "simulation_id": idx,
                "params": param_dict,
                "result": result,
                "success": True
            }
        except Exception as e:
            return {
                "simulation_id": idx,
                "params": param_dict,
                "error": str(e),
                "success": False
            }

    def run_sweep(self, parameter_space: Dict[str, List],
                  use_processes: bool = True) -> List[Dict]:
        """执行参数扫描"""
        param_combinations = self._generate_combinations(parameter_space)
        worker_args = [(i, params, self.base_config, None, None)
                       for i, params in enumerate(param_combinations)]

        Executor = ProcessPoolExecutor if use_processes else ThreadPoolExecutor

        results = []
        with Executor(max_workers=self.max_workers) as executor:
            future_to_args = {executor.submit(self._simulation_worker, args): args
                             for args in worker_args}

            for future in as_completed(future_to_args):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    results.append({
                        "simulation_id": future_to_args[future][0],
                        "success": False,
                        "error": str(e)
                    })

        self.results = sorted(results, key=lambda x: x.get("simulation_id", 0))
        return self.results

    def _generate_combinations(self, param_space: Dict[str, List]) -> List[Dict]:
        """生成参数组合"""
        from itertools import product
        keys = list(param_space.keys())
        values_list = list(param_space.values())
        combinations = []

        for combo in product(*values_list):
            combinations.append(dict(zip(keys, combo)))

        return combinations


class OptimizedFermentationKinetics:
    """优化的发酵动力学 - 向量化和JIT友好版本"""

    def __init__(self, config: Dict):
        self.config = config
        self._cached_params = self._precompute_parameters()
        self.state_names = []

    def _precompute_parameters(self) -> Dict:
        """预计算静态参数"""
        kinetics = self.config.get("kinetics", {})
        return {
            "Ea_over_R": kinetics.get("temperature_sensitivity", 0.05) * 1000 / 8.314,
            "ph_opt": kinetics.get("ph_optimal", 4.5),
            "ph_sigma": kinetics.get("ph_range", 1.0),
            "Ks_sugar": 5.0,
            "K_carrying": 1e10,
            "Y_xs": 0.1,
            "Y_ps": 0.45
        }

    @staticmethod
    def arrhenius_correction_vectorized(T: np.ndarray, Ea_over_R: float, T_ref: float = 30.0):
        """向量化温度校正"""
        return np.exp(Ea_over_R * (1.0 / (T_ref + 273.15) - 1.0 / (T + 273.15)))

    @staticmethod
    def ph_correction_vectorized(ph: np.ndarray, ph_opt: float, ph_sigma: float):
        """向量化pH校正"""
        return np.exp(-0.5 * ((ph - ph_opt) / ph_sigma) ** 2)

    @staticmethod
    def monod_vectorized(S: np.ndarray, Ks: float):
        """向量化Monod方程"""
        return S / (Ks + S)

    def get_jacobian(self, t: float, y: np.ndarray) -> np.ndarray:
        """计算雅可比矩阵 - 用于隐式求解"""
        n = len(y)
        J = np.zeros((n, n), dtype=np.float64)
        h = 1e-6

        f_base = np.array(self.ode_system(t, y), dtype=np.float64)

        for i in range(n):
            y_perturbed = y.copy()
            y_perturbed[i] += h
            f_perturbed = np.array(self.ode_system(t, y_perturbed), dtype=np.float64)
            J[:, i] = (f_perturbed - f_base) / h

        return J


class MemoryEfficientStorage:
    """内存高效存储 - 使用分块压缩存储"""

    def __init__(self, chunk_size: int = 1000, compression: str = "gzip"):
        self.chunk_size = chunk_size
        self.compression = compression
        self._chunks: List[Tuple[np.ndarray, np.ndarray]] = []
        self._current_times: deque = deque()
        self._current_states: deque = deque()
        self.total_points = 0

    def append(self, t: float, state: np.ndarray):
        """追加数据点"""
        self._current_times.append(t)
        self._current_states.append(state)
        self.total_points += 1

        if len(self._current_times) >= self.chunk_size:
            self._flush_chunk()

    def _flush_chunk(self):
        """将当前缓冲区写入块"""
        if self._current_times:
            times_array = np.array(self._current_times, dtype=np.float32)
            states_array = np.array(self._current_states, dtype=np.float32).T
            self._chunks.append((times_array, states_array))
            self._current_times.clear()
            self._current_states.clear()

    def get_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """获取所有数据"""
        self._flush_chunk()

        if not self._chunks:
            return np.array([]), np.array([])

        all_times = np.concatenate([chunk[0] for chunk in self._chunks])
        all_states = np.concatenate([chunk[1] for chunk in self._chunks], axis=1)

        return all_times, all_states

    def save_to_hdf5(self, filepath: str, dataset_name: str = "simulation"):
        """保存到HDF5文件"""
        self._flush_chunk()

        with h5py.File(filepath, 'w') as f:
            grp = f.create_group(dataset_name)

            all_times, all_states = self.get_data()
            grp.create_dataset("time", data=all_times, compression=self.compression)
            grp.create_dataset("states", data=all_states, compression=self.compression)

            grp.attrs["total_points"] = self.total_points
            grp.attrs["chunk_size"] = self.chunk_size
            grp.attrs["n_variables"] = all_states.shape[0] if all_states.size > 0 else 0

    @classmethod
    def load_from_hdf5(cls, filepath: str, dataset_name: str = "simulation") -> Tuple[np.ndarray, np.ndarray]:
        """从HDF5加载"""
        with h5py.File(filepath, 'r') as f:
            grp = f[dataset_name]
            time = grp["time"][:]
            states = grp["states"][:]
        return time, states

    def estimate_memory_usage(self) -> float:
        """估算内存使用 (MB)"""
        memory_per_point = 4  # float32
        total_elements = self.total_points * (1 + 1)  # time + state
        return (total_elements * memory_per_point) / (1024 * 1024)


class CheckpointManager:
    """断点续算管理器"""

    CHECKPOINT_FORMAT_VERSION = "1.0"

    def __init__(self, checkpoint_dir: str = "./checkpoints"):
        import os
        self.checkpoint_dir = checkpoint_dir
        os.makedirs(checkpoint_dir, exist_ok=True)

    def save_checkpoint(self, solver: VectorizedODESolver, t: float, y: np.ndarray,
                        step: int, config: Dict, filename: Optional[str] = None) -> str:
        """保存完整仿真检查点"""
        import json
        import os

        if filename is None:
            filename = f"checkpoint_{int(time.time())}_step{step}.h5"

        filepath = os.path.join(self.checkpoint_dir, filename)

        with h5py.File(filepath, 'w') as f:
            f.attrs["format_version"] = self.CHECKPOINT_FORMAT_VERSION
            f.attrs["current_time"] = float(t)
            f.attrs["current_step"] = step
            f.attrs["wall_time"] = solver.stats.total_wall_time
            f.attrs["timestamp"] = time.time()

            f.create_dataset("current_state", data=y, compression="gzip")
            f.create_dataset("stats", data=np.array([
                solver.stats.total_steps,
                solver.stats.accepted_steps,
                solver.stats.rejected_steps,
                solver.stats.f_evals
            ]))

            config_json = json.dumps(config, ensure_ascii=False)
            f.attrs["config"] = np.string_(config_json)

        return filepath

    def load_checkpoint(self, filepath: str) -> Dict:
        """加载检查点"""
        import json

        with h5py.File(filepath, 'r') as f:
            if f.attrs.get("format_version") != self.CHECKPOINT_FORMAT_VERSION:
                warnings.warn("检查点格式版本不匹配，可能导致兼容问题")

            config = json.loads(f.attrs["config"])
            current_state = f["current_state"][:]

            stats = f["stats"][:]

            return {
                "current_time": float(f.attrs["current_time"]),
                "current_step": int(f.attrs["current_step"]),
                "wall_time": float(f.attrs["wall_time"]),
                "current_state": current_state,
                "config": config,
                "stats": {
                    "total_steps": int(stats[0]),
                    "accepted_steps": int(stats[1]),
                    "rejected_steps": int(stats[2]),
                    "function_evaluations": int(stats[3])
                }
            }

    def list_checkpoints(self) -> List[str]:
        """列出所有检查点"""
        import os
        return sorted([f for f in os.listdir(self.checkpoint_dir) if f.endswith('.h5')])

    def get_latest_checkpoint(self) -> Optional[str]:
        """获取最新检查点"""
        import os
        checkpoints = self.list_checkpoints()
        if not checkpoints:
            return None
        return os.path.join(self.checkpoint_dir, max(checkpoints, key=lambda x: x.split('_')[1] if '_' in x else x))
