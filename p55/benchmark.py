import numpy as np
import time
import tracemalloc
from dataclasses import dataclass, field
from typing import Dict, List, Any, Callable, Optional
from functools import wraps
import matplotlib.pyplot as plt


@dataclass
class PerformanceMetrics:
    execution_time: float
    memory_peak_mb: float
    memory_mean_mb: float
    cpu_usage: float
    n_iterations: int
    time_per_iteration_ms: float
    throughput_per_sec: float
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class BenchmarkResult:
    name: str
    description: str
    metrics: PerformanceMetrics
    details: Dict[str, Any] = field(default_factory=dict)


def measure_performance(n_runs: int = 5, warmup: int = 1) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> BenchmarkResult:
            for _ in range(warmup):
                func(*args, **kwargs)

            tracemalloc.start()
            start_time = time.perf_counter()

            for _ in range(n_runs):
                result = func(*args, **kwargs)

            end_time = time.perf_counter()
            current, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

            total_time = end_time - start_time
            time_per_iter = (total_time / n_runs) * 1000
            throughput = n_runs / total_time
            peak_mb = peak / (1024 * 1024)
            current_mb = current / (1024 * 1024)

            metrics = PerformanceMetrics(
                execution_time=total_time,
                memory_peak_mb=peak_mb,
                memory_mean_mb=current_mb,
                cpu_usage=100.0,
                n_iterations=n_runs,
                time_per_iteration_ms=time_per_iter,
                throughput_per_sec=throughput,
            )

            return BenchmarkResult(
                name=func.__name__,
                description=func.__doc__ or "",
                metrics=metrics,
                details={"result_size": len(result.get('time', [])) if isinstance(result, dict) else 0}
            )
        return wrapper
    return decorator


class SimulationBenchmark:
    def __init__(self):
        self.results: List[BenchmarkResult] = []

    def benchmark_original_vs_optimized(self) -> Dict[str, BenchmarkResult]:
        from simulation import CeramicFiringSimulation, FiringConfig as OldConfig
        from simulation_optimized import OptimizedFiringSimulation, FiringConfig as NewConfig

        config = {
            'initial_temp': 25.0,
            'target_temp': 1280.0,
            'heating_rate': 150.0,
            'holding_time': 120.0,
            'cooling_rate': 100.0,
            'total_time': 600.0,
        }

        old_config = OldConfig(**config)
        new_config = NewConfig(**config)

        @measure_performance(n_runs=10)
        def original_simulation():
            sim = CeramicFiringSimulation(old_config)
            return sim.run_simulation(dt=1.0)

        @measure_performance(n_runs=10)
        def optimized_simulation():
            sim = OptimizedFiringSimulation(new_config)
            return sim.run_simulation_optimized()

        orig_result = original_simulation()
        opt_result = optimized_simulation()

        self.results.extend([orig_result, opt_result])

        return {
            'original': orig_result,
            'optimized': opt_result,
        }

    def benchmark_vectorization(self) -> Dict[str, Any]:
        from simulation_optimized import OptimizedFiringSimulation, FiringConfig

        config = FiringConfig(total_time=600.0)
        sim = OptimizedFiringSimulation(config)

        n_points_list = [100, 1000, 10000, 100000]
        times_loop = []
        times_vectorized = []

        for n in n_points_list:
            t = np.linspace(0, 600, n)

            start = time.perf_counter()
            result_loop = np.zeros(n)
            for i in range(n):
                ti = t[i]
                if ti < 500:
                    result_loop[i] = 25 + 150 * (ti / 60)
                else:
                    result_loop[i] = 1280
            loop_time = time.perf_counter() - start

            start = time.perf_counter()
            result_vec = np.where(t < 500, 25 + 150 * (t / 60), 1280)
            vec_time = time.perf_counter() - start

            times_loop.append(loop_time)
            times_vectorized.append(vec_time)

        speedups = [l / v for l, v in zip(times_loop, times_vectorized)]

        return {
            'n_points': n_points_list,
            'loop_times': times_loop,
            'vectorized_times': times_vectorized,
            'speedups': speedups,
            'avg_speedup': np.mean(speedups),
        }

    def benchmark_parallel_scaling(self, max_processes: int = 8) -> Dict[str, Any]:
        from simulation_optimized import FiringConfig, ParallelSimulationEngine

        base_config = FiringConfig(total_time=600.0)

        n_simulations = 20
        configs = [FiringConfig(
            target_temp=1200 + i * 20,
            heating_rate=120 + i * 5,
        ) for i in range(n_simulations)]

        times = []
        throughputs = []

        for n_proc in range(1, min(max_processes, 8) + 1):
            engine = ParallelSimulationEngine(n_processes=n_proc)

            start = time.perf_counter()
            results = engine.run_batch(configs)
            elapsed = time.perf_counter() - start

            times.append(elapsed)
            throughputs.append(n_simulations / elapsed)

        speedups = [times[0] / t for t in times]
        efficiency = [s / (i + 1) for i, s in enumerate(speedups)]

        return {
            'n_processes': list(range(1, min(max_processes, 8) + 1)),
            'times': times,
            'throughputs': throughputs,
            'speedups': speedups,
            'efficiency': efficiency,
        }

    def benchmark_adaptive_timestep(self) -> Dict[str, Any]:
        from simulation_optimized import OptimizedFiringSimulation, FiringConfig, HighPrecisionSimulator

        config_fixed = FiringConfig(total_time=600.0, dt=1.0, adaptive_timestep=False)
        config_adaptive = FiringConfig(total_time=600.0, dt=1.0, adaptive_timestep=True, max_dt=5.0, min_dt=0.1)

        @measure_performance(n_runs=5)
        def fixed_timestep():
            sim = OptimizedFiringSimulation(config_fixed)
            return sim.run_simulation_optimized()

        @measure_performance(n_runs=5)
        def adaptive_timestep():
            sim = OptimizedFiringSimulation(config_adaptive)
            return sim.run_simulation_with_checkpoints()

        @measure_performance(n_runs=3)
        def high_precision():
            sim = HighPrecisionSimulator(config_fixed)
            return sim.run_high_precision_simulation()

        fixed_result = fixed_timestep()
        adaptive_result = adaptive_timestep()
        precision_result = high_precision()

        self.results.extend([fixed_result, adaptive_result, precision_result])

        return {
            'fixed': fixed_result,
            'adaptive': adaptive_result,
            'high_precision': precision_result,
        }

    def benchmark_checkpoint_resume(self) -> Dict[str, Any]:
        from simulation_optimized import OptimizedFiringSimulation, FiringConfig
        import os
        import shutil

        config = FiringConfig(total_time=600.0)
        if os.path.exists('checkpoints'):
            shutil.rmtree('checkpoints')

        sim = OptimizedFiringSimulation(config)

        start = time.perf_counter()
        result = sim.run_simulation_optimized()
        time_full = time.perf_counter() - start

        sim2 = OptimizedFiringSimulation(config)
        sim2.current_time = 300.0
        sim2.current_step = int(300 / config.dt)
        sim2._setup_arrays(int(600 / config.dt) + 100)
        sim2.time_points[:sim2.current_step + 1] = np.linspace(0, 300, sim2.current_step + 1)
        sim2.temperature_profile[:sim2.current_step + 1] = sim._temperature_curve_vectorized(
            sim2.time_points[:sim2.current_step + 1], config
        )

        start = time.perf_counter()
        result_resumed = sim2.resume_simulation()
        time_resume = time.perf_counter() - start

        return {
            'full_simulation_time': time_full,
            'resume_time': time_resume,
            'resume_saving_pct': (1 - time_resume / time_full) * 100,
            'result_length': len(result['time']),
            'resumed_length': len(result_resumed['time']),
        }

    def benchmark_storage_efficiency(self) -> Dict[str, Any]:
        from simulation_optimized import OptimizedFiringSimulation, FiringConfig
        from storage_optimized import calculate_memory_savings, CompressedResultStore
        import os
        import shutil

        config = FiringConfig(total_time=6000.0, dt=0.1)
        sim = OptimizedFiringSimulation(config)
        result = sim.run_simulation_optimized()

        savings = calculate_memory_savings(result)

        if os.path.exists('results'):
            shutil.rmtree('results')

        store = CompressedResultStore('results')

        start = time.perf_counter()
        sim_id = store.save_result(result, vars(config))
        save_time = time.perf_counter() - start

        start = time.perf_counter()
        loaded = store.load_result(sim_id)
        load_time = time.perf_counter() - start

        original_size_mb = sum(arr.nbytes for arr in result.values()) / (1024 * 1024)
        file_size_mb = os.path.getsize(f'results/{sim_id}.h5') / (1024 * 1024)

        return {
            'memory_savings': savings,
            'save_time': save_time,
            'load_time': load_time,
            'original_size_mb': original_size_mb,
            'file_size_mb': file_size_mb,
            'compression_ratio': original_size_mb / file_size_mb,
        }

    def print_report(self):
        print("=" * 80)
        print("PERFORMANCE BENCHMARK REPORT")
        print("=" * 80)

        for result in self.results:
            print(f"\n{result.name.upper()}")
            print(f"  Description: {result.description}")
            print(f"  Total time:    {result.metrics.execution_time:.4f}s")
            print(f"  Per iteration: {result.metrics.time_per_iteration_ms:.2f}ms")
            print(f"  Throughput:    {result.metrics.throughput_per_sec:.1f}/s")
            print(f"  Peak memory:   {result.metrics.memory_peak_mb:.2f}MB")
            print(f"  Iterations:    {result.metrics.n_iterations}")

    def plot_comparison(self, output_file: str = 'performance_comparison.png'):
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))

        names = [r.name.replace('_', ' ').title() for r in self.results]
        times = [r.metrics.execution_time / r.metrics.n_iterations * 1000 for r in self.results]
        memories = [r.metrics.memory_peak_mb for r in self.results]

        axes[0, 0].barh(names, times, color='steelblue')
        axes[0, 0].set_xlabel('Time per Iteration (ms)')
        axes[0, 0].set_title('Execution Time Comparison')
        axes[0, 0].grid(axis='x', alpha=0.3)

        axes[0, 1].barh(names, memories, color='coral')
        axes[0, 1].set_xlabel('Peak Memory (MB)')
        axes[0, 1].set_title('Memory Usage Comparison')
        axes[0, 1].grid(axis='x', alpha=0.3)

        if len(self.results) >= 2:
            speedups = [
                (self.results[0].metrics.time_per_iteration_ms / r.metrics.time_per_iteration_ms)
                for r in self.results
            ]
            axes[1, 0].barh(names, speedups, color='mediumseagreen')
            axes[1, 0].set_xlabel('Speedup Factor (x)')
            axes[1, 0].set_title('Performance Speedup')
            axes[1, 0].axvline(x=1, color='red', linestyle='--', alpha=0.7, label='Baseline')
            axes[1, 0].legend()
            axes[1, 0].grid(axis='x', alpha=0.3)

        if len(self.results) >= 2:
            efficiencies = [
                (self.results[0].metrics.memory_peak_mb - r.metrics.memory_peak_mb) /
                self.results[0].metrics.memory_peak_mb * 100
                for r in self.results
            ]
            axes[1, 1].barh(names, efficiencies, color='orchid')
            axes[1, 1].set_xlabel('Memory Savings (%)')
            axes[1, 1].set_title('Memory Efficiency')
            axes[1, 1].axvline(x=0, color='black', linestyle='-', alpha=0.5)
            axes[1, 1].grid(axis='x', alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"\nPerformance plot saved to: {output_file}")


def run_full_benchmark() -> Dict[str, Any]:
    print("Starting full benchmark suite...")
    benchmark = SimulationBenchmark()

    results = {}

    print("\n1. Original vs Optimized Simulation...")
    results['sim_comparison'] = benchmark.benchmark_original_vs_optimized()

    print("2. Vectorization Performance...")
    results['vectorization'] = benchmark.benchmark_vectorization()

    print("3. Parallel Scaling Test...")
    results['parallel'] = benchmark.benchmark_parallel_scaling()

    print("4. Adaptive Timestep Performance...")
    results['timestep'] = benchmark.benchmark_adaptive_timestep()

    print("5. Checkpoint/Resume Performance...")
    results['checkpoint'] = benchmark.benchmark_checkpoint_resume()

    print("6. Storage Efficiency Test...")
    results['storage'] = benchmark.benchmark_storage_efficiency()

    benchmark.print_report()
    benchmark.plot_comparison()

    return results


def print_optimization_summary(results: Dict[str, Any]):
    print("\n" + "=" * 80)
    print("OPTIMIZATION SUMMARY")
    print("=" * 80)

    sim = results['sim_comparison']
    speedup = sim['original'].metrics.time_per_iteration_ms / sim['optimized'].metrics.time_per_iteration_ms
    memory_saving = (
        (sim['original'].metrics.memory_peak_mb - sim['optimized'].metrics.memory_peak_mb) /
        sim['original'].metrics.memory_peak_mb * 100
    )

    print(f"\n{'Optimization':<30} {'Speedup':<15} {'Memory Saving':<15}")
    print("-" * 60)
    print(f"{'Vectorized Computation':<30} {speedup:>13.2f}x {memory_saving:>14.1f}%")

    vec = results['vectorization']
    print(f"{'Vectorized Array Operations':<30} {vec['avg_speedup']:>13.2f}x {'N/A':>15}")

    parallel = results['parallel']
    max_speedup = max(parallel['speedups'])
    print(f"{'Parallel Processing (8-core)':<30} {max_speedup:>13.2f}x {'N/A':>15}")

    storage = results['storage']
    print(f"{'Compressed Storage (HDF5)':<30} {'N/A':>15} {storage['compression_ratio']:>14.1f}x")
    print(f"{'32-bit Float Precision':<30} {'N/A':>15} {storage['memory_savings']['lightweight_saving_pct']:>14.1f}%")

    checkpoint = results['checkpoint']
    print(f"{'Checkpoint Resume':<30} {'N/A':>15} {checkpoint['resume_saving_pct']:>14.1f}%")

    print("\n" + "=" * 80)
    print("SUMMARY STATISTICS")
    print("=" * 80)
    print(f"Total Speedup Achieved:      {speedup * max_speedup:.1f}x (theoretical)")
    print(f"Memory Reduction:            ~{storage['memory_savings']['compressed_saving_pct']:.0f}%")
    print(f"Parallel Efficiency:         {parallel['efficiency'][-1]*100:.1f}% at 8 cores")
    print(f"Storage Compression Ratio:   {storage['compression_ratio']:.1f}x")
    print("=" * 80)


if __name__ == '__main__':
    results = run_full_benchmark()
    print_optimization_summary(results)
