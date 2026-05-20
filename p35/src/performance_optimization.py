import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from functools import lru_cache
import time
from dataclasses import dataclass
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed


@dataclass
class PerformanceStats:
    """性能统计"""
    total_time: float
    avg_time_per_step: float
    steps_completed: int
    cache_hits: int
    cache_misses: int
    efficiency_ratio: float


class VectorizedDynamics:
    """向量化动力学计算，支持批量仿真"""

    def __init__(self, base_model):
        self.base_model = base_model
        self.compute_stats = {"cache_hits": 0, "cache_misses": 0}

    @staticmethod
    def ode_vectorized(t: float, y: np.ndarray, params: np.ndarray) -> np.ndarray:
        """向量化ODE计算 - 简化版本"""
        n_sims = y.shape[0] // 5 if y.ndim == 1 else y.shape[1]
        dydt = np.zeros_like(y)

        X = y[..., 0]
        S = y[..., 1]
        P = y[..., 2]
        T = y[..., 3]
        pH = y[..., 4]

        mu_max = 0.5
        Ks = 5.0
        Yxs = 0.1
        Yps = 0.45

        mu = mu_max * S / (Ks + S) * (1 + 0.05 * (T - 30) - 0.01 * (T - 30) ** 2)
        mu = np.clip(mu, 0, 1.0)

        dydt[..., 0] = mu * X * (1 - X / 1e12)
        dydt[..., 1] = -mu * X / Yxs
        dydt[..., 2] = -dydt[..., 1] * Yps
        dydt[..., 3] = 0.05 * (30 - T) + 0.001 * X * 1e-6
        dydt[..., 4] = -0.001 * X * 1e-6 + 0.01 * (4.5 - pH)

        return dydt

    def batch_simulate(self, initial_conditions: List[Dict],
                       t_span: Tuple[float, float], dt: float = 1.0) -> List[Dict]:
        """批量仿真，支持多组初始条件并行"""
        n_sims = len(initial_conditions)
        n_states = 5

        t_eval = np.arange(t_span[0], t_span[1] + dt, dt)
        n_steps = len(t_eval)

        y = np.zeros((n_sims, n_states, n_steps))

        for i, ic in enumerate(initial_conditions):
            y[i, 0, 0] = ic.get("biomass", 1e6)
            y[i, 1, 0] = ic.get("substrate", 150)
            y[i, 2, 0] = ic.get("product", 0)
            y[i, 3, 0] = ic.get("temperature", 30)
            y[i, 4, 0] = ic.get("ph", 5.0)

        for step in range(n_steps - 1):
            current_t = t_eval[step]
            current_y = y[:, :, step]

            k1 = self.ode_vectorized(current_t, current_y, None)
            k2 = self.ode_vectorized(current_t + dt/2, current_y + dt/2 * k1, None)
            k3 = self.ode_vectorized(current_t + dt/2, current_y + dt/2 * k2, None)
            k4 = self.ode_vectorized(current_t + dt, current_y + dt * k3, None)

            y[:, :, step + 1] = current_y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)

            y[:, 0, step + 1] = np.clip(y[:, 0, step + 1], 1e3, 1e12)
            y[:, 1, step + 1] = np.clip(y[:, 1, step + 1], 0, None)

        results = []
        for i in range(n_sims):
            results.append({
                "time": t_eval,
                "states": y[i],
                "state_names": ["biomass", "substrate", "product", "temperature", "ph"],
                "simulation_id": i
            })

        return results


class AdaptiveStepSolver:
    """自适应步长求解器"""

    def __init__(self, rtol: float = 1e-3, atol: float = 1e-6,
                 max_step: float = 5.0, min_step: float = 0.01):
        self.rtol = rtol
        self.atol = atol
        self.max_step = max_step
        self.min_step = min_step
        self.step_history = []

    def solve(self, ode_func: Callable, y0: np.ndarray,
              t_span: Tuple[float, float], **kwargs) -> Dict:
        """自适应步长求解"""
        t0, tf = t_span
        t = t0
        y = np.array(y0, dtype=np.float64)
        h = self.max_step / 2

        time_points = [t]
        state_history = [y.copy()]
        step_sizes = []

        while t < tf:
            if t + h > tf:
                h = tf - t

            y1 = self._rk4_step(ode_func, t, y, h)
            y2_half = self._rk4_step(ode_func, t, y, h/2)
            y2 = self._rk4_step(ode_func, t + h/2, y2_half, h/2)

            error = np.max(np.abs(y2 - y1) / (self.atol + self.rtol * np.abs(y2)))

            if error < 1.0:
                t += h
                y = y2
                time_points.append(t)
                state_history.append(y.copy())
                step_sizes.append(h)

                if error < 0.1:
                    h = min(h * 1.5, self.max_step)
            else:
                h = max(h * 0.5, self.min_step)

        self.step_history = step_sizes

        states = np.array(state_history).T

        return {
            "time": np.array(time_points),
            "states": states,
            "n_steps": len(time_points),
            "avg_step_size": np.mean(step_sizes) if step_sizes else 0,
            "step_sizes": step_sizes
        }

    def _rk4_step(self, ode_func: Callable, t: float, y: np.ndarray, h: float) -> np.ndarray:
        """RK4单步"""
        k1 = np.array(ode_func(t, y), dtype=np.float64)
        k2 = np.array(ode_func(t + h/2, y + h/2 * k1), dtype=np.float64)
        k3 = np.array(ode_func(t + h/2, y + h/2 * k2), dtype=np.float64)
        k4 = np.array(ode_func(t + h, y + h * k3), dtype=np.float64)
        return y + h/6 * (k1 + 2*k2 + 2*k3 + k4)


class ParallelSimulator:
    """并行仿真器"""

    def __init__(self, max_workers: Optional[int] = None):
        self.max_workers = max_workers

    def simulate_worker(self, sim_args: Tuple) -> Dict:
        """工作进程仿真函数"""
        idx, config, t_span, dt = sim_args
        np.random.seed(idx)

        n_steps = int((t_span[1] - t_span[0]) / dt) + 1
        t_eval = np.linspace(t_span[0], t_span[1], n_steps)

        states = np.zeros((5, n_steps))
        states[0, 0] = 1e6
        states[1, 0] = 150
        states[2, 0] = 0
        states[3, 0] = 30
        states[4, 0] = 5.0

        for step in range(n_steps - 1):
            t = t_eval[step]
            X, S, P, T, pH = states[:, step]

            mu_max = 0.5 + np.random.normal(0, 0.05)
            Ks = 5.0
            mu = mu_max * S / (Ks + S) * (1 + 0.05 * (T - 30) - 0.01 * (T - 30) ** 2)
            mu = np.clip(mu, 0, 1.0)

            dX = mu * X * (1 - X / 1e12)
            dS = -mu * X / 0.1
            dP = -dS * 0.45
            dT = 0.05 * (30 - T) + 0.001 * X * 1e-6
            dpH = -0.001 * X * 1e-6 + 0.01 * (4.5 - pH)

            states[0, step + 1] = np.clip(X + dt * dX, 1e3, 1e12)
            states[1, step + 1] = np.clip(S + dt * dS, 0, None)
            states[2, step + 1] = P + dt * dP
            states[3, step + 1] = T + dt * dT
            states[4, step + 1] = pH + dt * dpH

        return {
            "simulation_id": idx,
            "time": t_eval,
            "states": states,
            "state_names": ["biomass", "substrate", "product", "temperature", "ph"]
        }

    def run_parallel(self, n_simulations: int, t_span: Tuple[float, float],
                     dt: float = 1.0, use_processes: bool = True) -> List[Dict]:
        """并行运行多个仿真"""
        sim_args = [(i, None, t_span, dt) for i in range(n_simulations)]

        Executor = ProcessPoolExecutor if use_processes else ThreadPoolExecutor

        results = []
        with Executor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.simulate_worker, args): args for args in sim_args}
            for future in as_completed(futures):
                results.append(future.result())

        results.sort(key=lambda x: x["simulation_id"])
        return results


class SparseMatrixSimulator:
    """稀疏矩阵仿真器（适用于多菌株大系统）"""

    def __init__(self, n_strains: int):
        self.n_strains = n_strains
        self.interaction_matrix = np.zeros((n_strains, n_strains))

    def set_interaction(self, strain_i: int, strain_j: int, value: float):
        """设置菌株间相互作用"""
        self.interaction_matrix[strain_i, strain_j] = value

    def simulate_sparse(self, initial_biomass: np.ndarray,
                        t_span: Tuple[float, float], dt: float = 1.0) -> Dict:
        """使用稀疏计算仿真多菌株系统"""
        n_states = self.n_strains + 4
        n_steps = int((t_span[1] - t_span[0]) / dt) + 1

        states = np.zeros((n_states, n_steps))
        states[:self.n_strains, 0] = initial_biomass
        states[self.n_strains, 0] = 150
        states[self.n_strains + 1, 0] = 0
        states[self.n_strains + 2, 0] = 30
        states[self.n_strains + 3, 0] = 5.0

        t_eval = np.linspace(t_span[0], t_span[1], n_steps)

        for step in range(n_steps - 1):
            X = states[:self.n_strains, step]
            S = states[self.n_strains, step]
            T = states[self.n_strains + 2, step]

            growth_rates = 0.5 * S / (5.0 + S) * (1 + 0.05 * (T - 30))
            interaction_effects = self.interaction_matrix @ X
            effective_rates = growth_rates * (1 + interaction_effects / (1 + X))

            dX = effective_rates * X * (1 - X / 1e11)
            dS = -np.sum(dX / 0.1)

            states[:self.n_strains, step + 1] = np.clip(X + dt * dX, 1e3, 1e12)
            states[self.n_strains, step + 1] = max(0, S + dt * dS)
            states[self.n_strains + 1, step + 1] = states[self.n_strains + 1, step] - 0.45 * dS
            states[self.n_strains + 2, step + 1] = 30 + 0.02 * (T - 30)
            states[self.n_strains + 3, step + 1] = 4.5 + 0.02 * (states[self.n_strains + 3, step] - 4.5)

        return {
            "time": t_eval,
            "states": states,
            "n_strains": self.n_strains
        }


class PerformanceProfiler:
    """性能分析器"""

    def __init__(self):
        self.timings = {}
        self.start_times = {}

    def start_timer(self, name: str):
        """开始计时"""
        self.start_times[name] = time.time()

    def end_timer(self, name: str):
        """结束计时"""
        if name in self.start_times:
            elapsed = time.time() - self.start_times[name]
            if name not in self.timings:
                self.timings[name] = []
            self.timings[name].append(elapsed)
            del self.start_times[name]
            return elapsed
        return 0

    def get_stats(self, name: str) -> Dict:
        """获取计时统计"""
        if name not in self.timings or not self.timings[name]:
            return {}

        times = np.array(self.timings[name])
        return {
            "mean": float(np.mean(times)),
            "median": float(np.median(times)),
            "std": float(np.std(times)),
            "min": float(np.min(times)),
            "max": float(np.max(times)),
            "count": len(times)
        }

    def generate_report(self) -> str:
        """生成性能报告"""
        report = ["⏱️ 性能分析报告\n"]

        for name in sorted(self.timings.keys()):
            stats = self.get_stats(name)
            if stats:
                report.append(f"\n{name}:")
                report.append(f"  平均耗时: {stats['mean']:.4f} 秒")
                report.append(f"  中位数: {stats['median']:.4f} 秒")
                report.append(f"  标准差: {stats['std']:.4f} 秒")
                report.append(f"  范围: [{stats['min']:.4f}, {stats['max']:.4f}] 秒")
                report.append(f"  样本数: {stats['count']}")

        return "\n".join(report)
