import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import time
import json

from .high_performance_solver import (
    VectorizedODESolver,
    ParallelParameterSweep,
    MemoryEfficientStorage,
    CheckpointManager,
    SolverMethod,
    PrecisionMode
)
from .numerical_computation import TemperatureProfile
from .fermentation_simulator import FermentationSimulator


class SimulationMode(Enum):
    """仿真运行模式"""
    STANDARD = "standard"
    HIGH_PERFORMANCE = "high_performance"
    MEMORY_EFFICIENT = "memory_efficient"
    ADAPTIVE = "adaptive"


@dataclass
class SimulationPerformanceMetrics:
    """仿真性能指标"""
    total_wall_time: float
    avg_step_time: float
    memory_usage_mb: float
    steps_per_second: float
    f_evals_per_second: float
    speedup_factor: float = 1.0


class HighPerformanceSimulator:
    """高性能发酵仿真器 - 集成所有优化"""

    def __init__(self, config: Dict, mode: SimulationMode = SimulationMode.HIGH_PERFORMANCE):
        self.config = config
        self.mode = mode
        self.ferm_type = config.get("type", "rice_wine")
        self.ferm_params = config["fermentation"]
        self.init_conditions = config["initial_conditions"]

        self._setup_kinetics()
        self._setup_solver()

        self.results: Optional[Dict] = None
        self.performance_metrics: Optional[SimulationPerformanceMetrics] = None
        self.checkpoint_manager = CheckpointManager()
        self.storage: Optional[MemoryEfficientStorage] = None

    def _setup_kinetics(self):
        """设置动力学模型"""
        if self.ferm_type == "rice_wine":
            from .numerical_computation import RiceWineKinetics
            self.kinetics = RiceWineKinetics(self.config)
            self.state_names = self.kinetics.state_names
        elif self.ferm_type == "soy_sauce":
            from .numerical_computation import SoySauceKinetics
            self.kinetics = SoySauceKinetics(self.config)
            self.state_names = self.kinetics.state_names
        else:
            raise ValueError(f"不支持的发酵类型: {self.ferm_type}")

    def _setup_solver(self):
        """根据模式配置求解器"""
        if self.mode == SimulationMode.HIGH_PERFORMANCE:
            self.precision = PrecisionMode.SINGLE
            self.use_adaptive = True
            self.use_memory_storage = False
        elif self.mode == SimulationMode.MEMORY_EFFICIENT:
            self.precision = PrecisionMode.SINGLE
            self.use_adaptive = True
            self.use_memory_storage = True
        elif self.mode == SimulationMode.ADAPTIVE:
            self.precision = PrecisionMode.DOUBLE
            self.use_adaptive = True
            self.use_memory_storage = False
        else:
            self.precision = PrecisionMode.DOUBLE
            self.use_adaptive = False
            self.use_memory_storage = False

        self.solver = VectorizedODESolver(self.kinetics.ode_system, self.precision)

        if self.use_memory_storage:
            self.storage = MemoryEfficientStorage(chunk_size=1000, compression="gzip")

    def get_initial_state(self) -> np.ndarray:
        """获取初始状态向量"""
        ic = self.init_conditions
        if self.ferm_type == "rice_wine":
            return np.array([
                ic["yeast_concentration"],
                ic["bacteria_concentration"],
                ic["sugar_concentration"],
                ic["alcohol_concentration"],
                self.ferm_params["initial_temperature"],
                ic["ph"]
            ], dtype=self.solver.dtype)
        elif self.ferm_type == "soy_sauce":
            return np.array([
                ic["aspergillus_concentration"],
                ic["lactobacillus_concentration"],
                ic["yeast_concentration"],
                ic["protein_concentration"],
                ic["starch_concentration"],
                ic["amino_acid_concentration"],
                ic["salt_concentration"],
                self.ferm_params["initial_temperature"],
                ic["ph"]
            ], dtype=self.solver.dtype)

    def run_simulation(self, T_profile: Optional[TemperatureProfile] = None,
                       method: SolverMethod = SolverMethod.RK45,
                       enable_checkpoints: bool = True,
                       checkpoint_interval: int = 5000,
                       resume_from: Optional[str] = None) -> Dict:
        """运行高性能仿真"""
        start_time = time.time()

        total_time = self.ferm_params["total_time"]
        time_step = self.ferm_params.get("time_step", 0.5)

        if T_profile is None:
            T_profile = TemperatureProfile.from_constant(
                total_time,
                self.ferm_params["target_temperature"]
            )

        if resume_from:
            checkpoint_data = self.checkpoint_manager.load_checkpoint(resume_from)
            t_start = checkpoint_data["current_time"]
            y0 = checkpoint_data["current_state"]
            resume_step = checkpoint_data["current_step"]
            print(f"从检查点恢复: t={t_start:.2f}h, step={resume_step}")
        else:
            t_start = 0.0
            y0 = self.get_initial_state()
            resume_step = 0

        t_span = (t_start, total_time)

        if self.use_adaptive:
            times, states = self.solver.adaptive_solve(
                t_span, y0,
                initial_h=time_step,
                tol=1e-6,
                max_h=5.0,
                min_h=1e-4,
                checkpoint_interval=checkpoint_interval if enable_checkpoints else 1000000,
                args=(T_profile,)
            )
        else:
            times, states = self.solver.fixed_step_solve(
                t_span, y0,
                h=time_step,
                method=method,
                checkpoint_interval=checkpoint_interval if enable_checkpoints else 1000000,
                args=(T_profile,)
            )

        if self.use_memory_storage and self.storage:
            for t, state in zip(times, states.T):
                self.storage.append(t, state)

        self.results = {
            "time": times,
            "states": states,
            "state_names": self.state_names,
            "simulation_id": f"hpsim_{int(time.time())}",
            "config": self.config,
            "mode": self.mode.value,
            "precision": self.precision.value,
            "resumed_from": resume_from,
            "solver_stats": self.solver.get_statistics()
        }

        elapsed = time.time() - start_time
        self._calculate_performance_metrics(elapsed)

        return self.results

    def _calculate_performance_metrics(self, elapsed_time: float):
        """计算性能指标"""
        stats = self.solver.get_statistics()

        memory_usage = 0.0
        if self.storage:
            memory_usage = self.storage.estimate_memory_usage()
        elif self.results and self.results["states"] is not None:
            memory_usage = (self.results["states"].nbytes + self.results["time"].nbytes) / (1024 * 1024)

        steps = stats["total_steps"]
        f_evals = stats["function_evaluations"]

        self.performance_metrics = SimulationPerformanceMetrics(
            total_wall_time=elapsed_time,
            avg_step_time=elapsed_time / steps if steps > 0 else 0,
            memory_usage_mb=memory_usage,
            steps_per_second=steps / elapsed_time if elapsed_time > 0 else 0,
            f_evals_per_second=f_evals / elapsed_time if elapsed_time > 0 else 0,
            speedup_factor=self._estimate_speedup()
        )

    def _estimate_speedup(self) -> float:
        """估算相对于标准求解器的加速比"""
        base_time_per_step = 0.001  # 标准scipy求解器每步的估算时间
        if self.performance_metrics:
            actual_time = self.performance_metrics.avg_step_time
            return base_time_per_step / actual_time if actual_time > 0 else 1.0
        return 1.0

    def save_checkpoint(self, filename: Optional[str] = None) -> str:
        """保存当前检查点"""
        if self.results is None:
            raise ValueError("仿真尚未运行，无法保存检查点")

        final_state = self.results["states"][:, -1]
        final_time = float(self.results["time"][-1])
        final_step = len(self.results["time"])

        return self.checkpoint_manager.save_checkpoint(
            self.solver, final_time, final_state, final_step, self.config, filename
        )

    def get_performance_report(self) -> str:
        """生成性能报告"""
        if self.performance_metrics is None:
            return "性能指标不可用，请先运行仿真"

        lines = ["=" * 50, "高性能仿真器性能报告", "=" * 50]
        pm = self.performance_metrics
        ss = self.solver.get_statistics()

        lines.extend([
            f"\n运行模式: {self.mode.value}",
            f"数值精度: {self.precision.value}",
            f"\n时间统计:",
            f"  总壁钟时间: {pm.total_wall_time:.4f} 秒",
            f"  平均每步时间: {pm.avg_step_time * 1000:.2f} 毫秒",
            f"  处理速度: {pm.steps_per_second:.1f} 步/秒",
            f"  函数计算速度: {pm.f_evals_per_second:.1f} 次/秒",
            f"\n求解器统计:",
            f"  总步数: {ss['total_steps']}",
            f"  接受步数: {ss['accepted_steps']}",
            f"  拒绝步数: {ss['rejected_steps']}",
            f"  函数评估次数: {ss['function_evaluations']}",
            f"  平均步长: {ss['average_step_size']:.4f} h",
            f"\n内存使用:",
            f"  估算内存: {pm.memory_usage_mb:.2f} MB",
            f"  理论加速比: {pm.speedup_factor:.1f}x"
        ])

        if ss.get('checkpoints_saved', 0) > 0:
            lines.append(f"\n断点续算:")
            lines.append(f"  已保存检查点: {ss['checkpoints_saved']}")

        return "\n".join(lines)

    def get_state_at_time(self, t: float) -> Dict[str, float]:
        """获取指定时间点的状态"""
        if self.results is None:
            raise ValueError("仿真尚未运行")

        times = self.results["time"]
        states = self.results["states"]

        idx = np.argmin(np.abs(times - t))
        return {
            name: float(states[i, idx])
            for i, name in enumerate(self.state_names)
        }

    def calculate_quality_score(self) -> float:
        """计算质量得分"""
        if self.results is None:
            raise ValueError("仿真尚未运行")

        states = self.results["states"]
        final_idx = -1

        if self.ferm_type == "rice_wine":
            final_alcohol = states[3, final_idx]
            final_sugar = states[2, final_idx]
            final_yeast = states[0, final_idx]

            alcohol_score = min(final_alcohol / 15.0, 1.0)
            sugar_score = np.exp(-((final_sugar - 30) ** 2) / 200)
            yeast_score = min(final_yeast / 2e8, 1.0)

            quality_score = 0.4 * alcohol_score + 0.3 * sugar_score + 0.3 * yeast_score
        elif self.ferm_type == "soy_sauce":
            final_aa = states[5, final_idx]
            final_prot = states[3, final_idx]
            initial_prot = self.init_conditions["protein_concentration"]

            aa_score = min(final_aa / 80.0, 1.0)
            conversion_score = min((initial_prot - final_prot) / initial_prot, 1.0)
            balance_score = np.exp(-((states[8, final_idx] - 4.8) ** 2) / 0.5)

            quality_score = 0.4 * aa_score + 0.35 * conversion_score + 0.25 * balance_score
        else:
            quality_score = 0.0

        return float(quality_score)


class BatchOptimizationSimulator:
    """批量优化仿真器"""

    def __init__(self, base_config: Dict, max_workers: int = 4):
        self.base_config = base_config
        self.max_workers = max_workers
        self.parallel_sweep = ParallelParameterSweep(base_config, max_workers)

    def optimize_parameters(self, param_ranges: Dict[str, List],
                            objective_func: Optional[Callable] = None) -> Dict:
        """参数优化"""
        print(f"开始参数优化，参数组合数: {len(self.parallel_sweep._generate_combinations(param_ranges))}")

        results = self.parallel_sweep.run_sweep(param_ranges, use_processes=True)

        valid_results = [r for r in results if r.get("success", False)]

        if not valid_results:
            return {"best_params": None, "all_results": results, "success_rate": 0.0}

        if objective_func is None:
            def default_objective(result):
                sim_result = result.get("result", {})
                if "states" in sim_result:
                    alcohol_final = sim_result["states"][3, -1]
                    sugar_final = sim_result["states"][2, -1]
                    return float(alcohol_final / (sugar_final + 1))
                return 0.0

            objective_func = default_objective

        scores = []
        for r in valid_results:
            try:
                score = objective_func(r)
                scores.append((r, score))
            except Exception:
                pass

        scores.sort(key=lambda x: x[1], reverse=True)

        if scores:
            best_result, best_score = scores[0]
            return {
                "best_params": best_result["params"],
                "best_score": best_score,
                "best_simulation_id": best_result["simulation_id"],
                "all_results": results,
                "success_rate": len(valid_results) / len(results),
                "total_simulations": len(results)
            }
        else:
            return {"best_params": None, "all_results": results, "success_rate": 0.0}


class BenchmarkSuite:
    """性能基准测试套件"""

    def __init__(self, config: Dict, n_runs: int = 3):
        self.config = config
        self.n_runs = n_runs
        self.benchmark_results: Dict = {}

    def run_benchmark(self) -> Dict:
        """运行完整基准测试"""
        modes = [SimulationMode.STANDARD, SimulationMode.HIGH_PERFORMANCE,
                 SimulationMode.MEMORY_EFFICIENT, SimulationMode.ADAPTIVE]

        results = {}
        for mode in modes:
            times = []
            memory_usages = []

            for _ in range(self.n_runs):
                sim = HighPerformanceSimulator(self.config, mode)
                sim.run_simulation(enable_checkpoints=False)
                times.append(sim.performance_metrics.total_wall_time)
                memory_usages.append(sim.performance_metrics.memory_usage_mb)

            results[mode.value] = {
                "avg_time": np.mean(times),
                "std_time": np.std(times),
                "avg_memory_mb": np.mean(memory_usages),
                "speedup_vs_standard": np.mean(times) / results[SimulationMode.STANDARD.value]["avg_time"]
                if "standard" in results else 1.0
            }

        self.benchmark_results = results
        return results

    def generate_benchmark_report(self) -> str:
        """生成基准测试报告"""
        if not self.benchmark_results:
            return "请先运行基准测试"

        lines = ["=" * 60, "发酵仿真器性能基准测试报告", "=" * 60]

        lines.append(f"\n{'模式':<25} {'平均时间(s)':<15} {'内存(MB)':<15} {'相对加速比':<15}")
        lines.append("-" * 60)

        for mode, data in self.benchmark_results.items():
            lines.append(
                f"{mode:<25} {data['avg_time']:<15.4f} "
                f"{data['avg_memory_mb']:<15.2f} {data['speedup_vs_standard']:<15.2f}x"
            )

        lines.append("\n" + "=" * 60)
        best_mode = min(self.benchmark_results.keys(),
                        key=lambda k: self.benchmark_results[k]["avg_time"])
        lines.append(f"推荐模式: {best_mode}")

        return "\n".join(lines)
