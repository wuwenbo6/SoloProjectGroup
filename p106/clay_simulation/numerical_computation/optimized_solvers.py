import numpy as np
from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
import time
import warnings
from functools import lru_cache, wraps

try:
    from scipy.sparse import csr_matrix, lil_matrix
    from scipy.sparse.linalg import spsolve, cg, gmres
    SPARSE_AVAILABLE = True
except ImportError:
    SPARSE_AVAILABLE = False
    warnings.warn("SciPy sparse modules not available, using dense matrices")

try:
    import numba
    from numba import jit, prange
    NUMBA_AVAILABLE = True
except ImportError:
    NUMBA_AVAILABLE = False
    warnings.warn("Numba not available, calculations may be slower")


@dataclass
class PerformanceMetrics:
    setup_time: float
    solve_time: float
    total_time: float
    grid_size: Tuple[int, int]
    method_used: str
    memory_usage_mb: float


class SolverOptimizer:
    def __init__(self, use_sparse: bool = True, use_numba: bool = True):
        self.use_sparse = use_sparse and SPARSE_AVAILABLE
        self.use_numba = use_numba and NUMBA_AVAILABLE
        self.performance_history: List[PerformanceMetrics] = []
        self._stiffness_cache = {}

    def timed_execution(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = func(*args, **kwargs)
            elapsed = time.time() - start
            return result, elapsed
        return wrapper

    def _assemble_stiffness_dense(self, nx: int, ny: int, E: float, nu: float) -> np.ndarray:
        n_nodes = nx * ny
        n_dofs = 2 * n_nodes
        K = np.zeros((n_dofs, n_dofs))

        D = E / ((1 + nu) * (1 - 2 * nu)) * np.array([
            [1 - nu, nu, 0],
            [nu, 1 - nu, 0],
            [0, 0, (1 - nu) / 2]
        ])

        for i in range(nx - 1):
            for j in range(ny - 1):
                ke = self._compute_element_stiffness(D)
                self._assemble_element(K, ke, i, j, nx)

        return K

    def _assemble_stiffness_sparse(self, nx: int, ny: int, E: float, nu: float) -> csr_matrix:
        n_nodes = nx * ny
        n_dofs = 2 * n_nodes
        K = lil_matrix((n_dofs, n_dofs))

        D = E / ((1 + nu) * (1 - 2 * nu)) * np.array([
            [1 - nu, nu, 0],
            [nu, 1 - nu, 0],
            [0, 0, (1 - nu) / 2]
        ])

        for i in range(nx - 1):
            for j in range(ny - 1):
                ke = self._compute_element_stiffness(D)
                self._assemble_element_sparse(K, ke, i, j, nx)

        return K.tocsr()

    def _compute_element_stiffness(self, D: np.ndarray) -> np.ndarray:
        gp = np.array([-1 / np.sqrt(3), 1 / np.sqrt(3)])

        ke = np.zeros((8, 8))

        for xi in gp:
            for eta in gp:
                dNdxi = 0.25 * np.array([
                    [-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)],
                    [-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)]
                ])

                J = np.array([[0.5, 0], [0, 0.5]])
                invJ = np.linalg.inv(J)
                detJ = np.linalg.det(J)

                dNdx = invJ @ dNdxi

                B = np.zeros((3, 8))
                for a in range(4):
                    B[0, 2 * a] = dNdx[0, a]
                    B[1, 2 * a + 1] = dNdx[1, a]
                    B[2, 2 * a] = dNdx[1, a]
                    B[2, 2 * a + 1] = dNdx[0, a]

                ke += B.T @ D @ B * detJ

        return ke

    def _assemble_element(self, K: np.ndarray, ke: np.ndarray, i: int, j: int, nx: int):
        node_indices = [
            j * nx + i,
            j * nx + i + 1,
            (j + 1) * nx + i + 1,
            (j + 1) * nx + i
        ]

        for a in range(4):
            for b in range(4):
                for m in range(2):
                    for n in range(2):
                        K[2 * node_indices[a] + m, 2 * node_indices[b] + n] += ke[2 * a + m, 2 * b + n]

    def _assemble_element_sparse(self, K: lil_matrix, ke: np.ndarray, i: int, j: int, nx: int):
        node_indices = [
            j * nx + i,
            j * nx + i + 1,
            (j + 1) * nx + i + 1,
            (j + 1) * nx + i
        ]

        for a in range(4):
            for b in range(4):
                for m in range(2):
                    for n in range(2):
                        K[2 * node_indices[a] + m, 2 * node_indices[b] + n] += ke[2 * a + m, 2 * b + n]

    def apply_boundary_conditions(self, K, F, nx: int, ny: int,
                                    force_magnitude: float, force_direction: Tuple[float, float]):
        fx, fy = force_direction
        norm = np.sqrt(fx ** 2 + fy ** 2)
        fx_normalized = fx / norm
        fy_normalized = fy / norm

        force_node = (nx - 1) * ny + nx // 2
        F[2 * force_node] += force_magnitude * fx_normalized
        F[2 * force_node + 1] += force_magnitude * fy_normalized

        for i in range(nx):
            idx = i
            if isinstance(K, np.ndarray):
                K[2 * idx, :] = 0
                K[2 * idx + 1, :] = 0
                K[2 * idx, 2 * idx] = 1
                K[2 * idx + 1, 2 * idx + 1] = 1
            else:
                K[2 * idx, :] = 0
                K[2 * idx + 1, :] = 0
                K[2 * idx, 2 * idx] = 1
                K[2 * idx + 1, 2 * idx + 1] = 1
            F[2 * idx] = 0
            F[2 * idx + 1] = 0

        return K, F

    def solve_elasticity_optimized(self, nx: int, ny: int, E: float, nu: float,
                                     force_magnitude: float, force_direction: Tuple[float, float],
                                     method: str = 'auto') -> Tuple[np.ndarray, PerformanceMetrics]:
        start_total = time.time()

        n_nodes = nx * ny
        n_dofs = 2 * n_nodes
        F = np.zeros(n_dofs)

        if method == 'auto':
            if n_dofs > 10000 and self.use_sparse:
                method = 'sparse_direct'
            elif n_dofs > 50000:
                method = 'iterative'
            else:
                method = 'dense'

        start_setup = time.time()

        if method == 'sparse_direct' and self.use_sparse:
            K = self._assemble_stiffness_sparse(nx, ny, E, nu)
            K, F = self.apply_boundary_conditions(K, F, nx, ny, force_magnitude, force_direction)
            setup_time = time.time() - start_setup

            start_solve = time.time()
            U = spsolve(K, F)
            solve_time = time.time() - start_solve

        elif method == 'iterative' and self.use_sparse:
            K = self._assemble_stiffness_sparse(nx, ny, E, nu)
            K, F = self.apply_boundary_conditions(K, F, nx, ny, force_magnitude, force_direction)
            setup_time = time.time() - start_setup

            start_solve = time.time()
            U, info = cg(K, F, maxiter=1000, tol=1e-6)
            solve_time = time.time() - start_solve

        else:
            K = self._assemble_stiffness_dense(nx, ny, E, nu)
            K, F = self.apply_boundary_conditions(K, F, nx, ny, force_magnitude, force_direction)
            setup_time = time.time() - start_setup

            start_solve = time.time()
            U = np.linalg.solve(K, F)
            solve_time = time.time() - start_solve

        total_time = time.time() - start_total

        u = U[0::2].reshape(ny, nx)
        v = U[1::2].reshape(ny, nx)
        displacement = np.array([u, v])

        if isinstance(K, np.ndarray):
            memory_usage = K.nbytes / (1024 * 1024)
        else:
            memory_usage = (K.data.nbytes + K.indptr.nbytes + K.indices.nbytes) / (1024 * 1024)

        metrics = PerformanceMetrics(
            setup_time=setup_time,
            solve_time=solve_time,
            total_time=total_time,
            grid_size=(nx, ny),
            method_used=method,
            memory_usage_mb=memory_usage
        )

        self.performance_history.append(metrics)

        return displacement, metrics

    def batch_solve_multigrid(self, grid_sizes: List[Tuple[int, int]],
                                E: float, nu: float, force_magnitude: float,
                                force_direction: Tuple[float, float]) -> Dict[Tuple[int, int], np.ndarray]:
        results = {}

        for nx, ny in sorted(grid_sizes, key=lambda x: x[0] * x[1]):
            displacement, _ = self.solve_elasticity_optimized(
                nx, ny, E, nu, force_magnitude, force_direction
            )
            results[(nx, ny)] = displacement

        return results

    def vectorized_stress_calculation(self, displacement: np.ndarray,
                                        E: float, nu: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        u, v = displacement
        ny, nx = u.shape

        du_dx = np.gradient(u, axis=1) * (nx - 1)
        du_dy = np.gradient(u, axis=0) * (ny - 1)
        dv_dx = np.gradient(v, axis=1) * (nx - 1)
        dv_dy = np.gradient(v, axis=0) * (ny - 1)

        ex = du_dx
        ey = dv_dy
        exy = 0.5 * (du_dy + dv_dx)

        lam = E * nu / ((1 + nu) * (1 - 2 * nu))
        mu = E / (2 * (1 + nu))

        sigmax = lam * (ex + ey) + 2 * mu * ex
        sigmay = lam * (ex + ey) + 2 * mu * ey
        sigmaxy = 2 * mu * exy

        return sigmax, sigmay, sigmaxy

    def get_performance_report(self) -> str:
        if not self.performance_history:
            return "No performance data available"

        total_solves = len(self.performance_history)
        avg_setup = np.mean([m.setup_time for m in self.performance_history])
        avg_solve = np.mean([m.solve_time for m in self.performance_history])
        avg_total = np.mean([m.total_time for m in self.performance_history])
        avg_memory = np.mean([m.memory_usage_mb for m in self.performance_history])

        methods_used = set(m.method_used for m in self.performance_history)

        report = [
            "=" * 60,
            "性能优化报告",
            "=" * 60,
            f"总求解次数: {total_solves}",
            f"使用方法: {', '.join(methods_used)}",
            "",
            "平均耗时:",
            f"  矩阵组装: {avg_setup:.4f} 秒",
            f"  方程求解: {avg_solve:.4f} 秒",
            f"  总计: {avg_total:.4f} 秒",
            "",
            f"平均内存使用: {avg_memory:.2f} MB",
            "",
            "各方法性能统计:",
        ]

        for method in methods_used:
            method_metrics = [m for m in self.performance_history if m.method_used == method]
            if method_metrics:
                times = [m.total_time for m in method_metrics]
                report.extend([
                    f"\n  {method}:",
                    f"    调用次数: {len(method_metrics)}",
                    f"    平均时间: {np.mean(times):.4f} 秒",
                    f"    最快: {np.min(times):.4f} 秒",
                    f"    最慢: {np.max(times):.4f} 秒",
                ])

        report.append("\n" + "=" * 60)

        return "\n".join(report)


if NUMBA_AVAILABLE:
    @jit(nopython=True, parallel=True)
    def numba_stress_calculation(u: np.ndarray, v: np.ndarray,
                                   E: float, nu: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        ny, nx = u.shape

        du_dx = np.zeros_like(u)
        du_dy = np.zeros_like(u)
        dv_dx = np.zeros_like(v)
        dv_dy = np.zeros_like(v)

        for j in prange(ny):
            for i in range(1, nx - 1):
                du_dx[j, i] = (u[j, i + 1] - u[j, i - 1]) / 2 * (nx - 1)
                dv_dx[j, i] = (v[j, i + 1] - v[j, i - 1]) / 2 * (nx - 1)

        for j in prange(1, ny - 1):
            for i in range(nx):
                du_dy[j, i] = (u[j + 1, i] - u[j - 1, i]) / 2 * (ny - 1)
                dv_dy[j, i] = (v[j + 1, i] - v[j - 1, i]) / 2 * (ny - 1)

        ex = du_dx
        ey = dv_dy
        exy = 0.5 * (du_dy + dv_dx)

        lam = E * nu / ((1 + nu) * (1 - 2 * nu))
        mu = E / (2 * (1 + nu))

        sigmax = lam * (ex + ey) + 2 * mu * ex
        sigmay = lam * (ex + ey) + 2 * mu * ey
        sigmaxy = 2 * mu * exy

        return sigmax, sigmay, sigmaxy


class FastParameterSweep:
    def __init__(self, use_parallel: bool = True):
        self.use_parallel = use_parallel and NUMBA_AVAILABLE
        self.results_cache = {}

    def sweep_moisture_content(self, moisture_range: Tuple[float, float],
                                n_points: int, base_E: float, base_nu: float,
                                nx: int, ny: int, force_magnitude: float) -> Dict:
        moistures = np.linspace(*moisture_range, n_points)
        max_stresses = np.zeros(n_points)

        for i, m in enumerate(moistures):
            moisture_factor = np.exp(-3 * (m - 0.25))
            E = base_E * moisture_factor
            nu = np.clip(base_nu + 0.05 * (m - 0.25) / 0.1, 0.25, 0.45)

            solver = SolverOptimizer()
            displacement, _ = solver.solve_elasticity_optimized(
                nx, ny, E, nu, force_magnitude, (0, -1)
            )

            sigmax, sigmay, sigmaxy = solver.vectorized_stress_calculation(
                displacement, E, nu
            )
            von_mises = np.sqrt(sigmax ** 2 - sigmax * sigmay + sigmay ** 2 + 3 * sigmaxy ** 2)
            max_stresses[i] = np.max(von_mises)

        return {
            'moistures': moistures,
            'max_stresses': max_stresses,
            'youngs_modulus': base_E * np.exp(-3 * (moistures - 0.25))
        }

    def parallel_batch_simulation(self, parameter_list: List[Dict],
                                    nx: int, ny: int) -> List[np.ndarray]:
        results = []

        for params in parameter_list:
            E = params.get('E', 5e6)
            nu = params.get('nu', 0.35)
            force = params.get('force_magnitude', 1000.0)
            direction = params.get('force_direction', (0, -1))

            solver = SolverOptimizer()
            displacement, _ = solver.solve_elasticity_optimized(
                nx, ny, E, nu, force, direction
            )
            results.append(displacement)

        return results
