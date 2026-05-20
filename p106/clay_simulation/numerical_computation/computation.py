import numpy as np
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve
from scipy.interpolate import griddata
from typing import Dict, Tuple, Optional
try:
    from ..data_acquisition import ClayParameter
except ImportError:
    from data_acquisition import ClayParameter


class NumericalComputation:
    def __init__(self, grid_size: Tuple[int, int] = (50, 50)):
        self.grid_size = grid_size
        self.nx, self.ny = grid_size
        self.dx = 1.0 / (self.nx - 1)
        self.dy = 1.0 / (self.ny - 1)
        self.x = np.linspace(0, 1, self.nx)
        self.y = np.linspace(0, 1, self.ny)
        self.X, self.Y = np.meshgrid(self.x, self.y)

    def compute_strain_tensor(self, displacement: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        u = displacement[0]
        v = displacement[1]

        ex = np.gradient(u, self.dx, axis=1)
        ey = np.gradient(v, self.dy, axis=0)
        exy = 0.5 * (np.gradient(u, self.dy, axis=0) + np.gradient(v, self.dx, axis=1))

        return ex, ey, exy

    def compute_stress_tensor(self, ex: np.ndarray, ey: np.ndarray, exy: np.ndarray,
                              clay_param: ClayParameter) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        E = clay_param.youngs_modulus
        nu = clay_param.poissons_ratio

        lam = E * nu / ((1 + nu) * (1 - 2 * nu))
        mu = E / (2 * (1 + nu))

        sigmax = lam * (ex + ey) + 2 * mu * ex
        sigmay = lam * (ex + ey) + 2 * mu * ey
        sigmaxy = 2 * mu * exy

        return sigmax, sigmay, sigmaxy

    def compute_von_mises_stress(self, sigmax: np.ndarray, sigmay: np.ndarray,
                                  sigmaxy: np.ndarray) -> np.ndarray:
        max_abs = np.maximum(np.abs(sigmax), np.abs(sigmay))
        max_abs = np.maximum(max_abs, np.abs(sigmaxy))
        max_abs = np.maximum(max_abs, 1e-10)

        sigmax_normalized = sigmax / max_abs
        sigmay_normalized = sigmay / max_abs
        sigmaxy_normalized = sigmaxy / max_abs

        term = (sigmax_normalized ** 2 - sigmax_normalized * sigmay_normalized +
                sigmay_normalized ** 2 + 3 * sigmaxy_normalized ** 2)
        term = np.maximum(term, 0)

        return max_abs * np.sqrt(term)

    def _compute_elastic_modulus_scaled(self, clay_param):
        E = clay_param.youngs_modulus
        nu = np.clip(clay_param.poissons_ratio, 0.01, 0.49)

        lam = E * nu / ((1 + nu) * (1 - 2 * nu))
        mu = E / (2 * (1 + nu))
        return lam, mu

    def solve_elasticity(self, clay_param: ClayParameter, force_magnitude: float,
                         force_direction: Tuple[float, float],
                         boundary_conditions: Optional[Dict] = None) -> Tuple[np.ndarray, np.ndarray]:
        if boundary_conditions is None:
            boundary_conditions = {
                'bottom': 'fixed',
                'top': 'force'
            }

        n_nodes = self.nx * self.ny
        n_dofs = 2 * n_nodes

        K = lil_matrix((n_dofs, n_dofs))
        F = np.zeros(n_dofs)

        E = clay_param.youngs_modulus
        nu = clay_param.poissons_ratio

        D = E / ((1 + nu) * (1 - 2 * nu)) * np.array([
            [1 - nu, nu, 0],
            [nu, 1 - nu, 0],
            [0, 0, (1 - 2 * nu) / 2]
        ])

        for i in range(self.nx - 1):
            for j in range(self.ny - 1):
                node_indices = [
                    j * self.nx + i,
                    j * self.nx + i + 1,
                    (j + 1) * self.nx + i + 1,
                    (j + 1) * self.nx + i
                ]

                ke = self._compute_element_stiffness(D, i, j)

                for a in range(4):
                    for b in range(4):
                        for m in range(2):
                            for n in range(2):
                                K[2 * node_indices[a] + m, 2 * node_indices[b] + n] += ke[2 * a + m, 2 * b + n]

        self._apply_boundary_conditions(K, F, force_magnitude, force_direction, boundary_conditions)

        U = spsolve(K.tocsr(), F)

        u = U[0::2].reshape(self.ny, self.nx)
        v = U[1::2].reshape(self.ny, self.nx)

        return np.array([u, v])

    def _compute_element_stiffness(self, D: np.ndarray, i: int, j: int) -> np.ndarray:
        gp = np.array([-1 / np.sqrt(3), 1 / np.sqrt(3)])
        gw = np.array([1, 1])

        ke = np.zeros((8, 8))

        for xi in gp:
            for eta in gp:
                dNdxi = 0.25 * np.array([
                    [-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)],
                    [-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)]
                ])

                J = dNdxi @ np.array([
                    [i * self.dx, j * self.dy],
                    [(i + 1) * self.dx, j * self.dy],
                    [(i + 1) * self.dx, (j + 1) * self.dy],
                    [i * self.dx, (j + 1) * self.dy]
                ])

                invJ = np.linalg.inv(J)
                detJ = np.linalg.det(J)

                dNdx = invJ @ dNdxi

                B = np.zeros((3, 8))
                for a in range(4):
                    B[0, 2 * a] = dNdx[0, a]
                    B[1, 2 * a + 1] = dNdx[1, a]
                    B[2, 2 * a] = dNdx[1, a]
                    B[2, 2 * a + 1] = dNdx[0, a]

                ke += B.T @ D @ B * detJ * gw[0] * gw[1]

        return ke

    def _apply_boundary_conditions(self, K, F, force_magnitude, force_direction, boundary_conditions):
        fx, fy = force_direction
        norm = np.sqrt(fx ** 2 + fy ** 2)
        fx_normalized = fx / norm
        fy_normalized = fy / norm

        if 'top' in boundary_conditions and boundary_conditions['top'] == 'force':
            for i in range(self.nx):
                idx = (self.ny - 1) * self.nx + i
                F[2 * idx] += force_magnitude * fx_normalized / self.nx
                F[2 * idx + 1] += force_magnitude * fy_normalized / self.nx

        if 'bottom' in boundary_conditions and boundary_conditions['bottom'] == 'fixed':
            for i in range(self.nx):
                idx = i
                K[2 * idx, :] = 0
                K[2 * idx + 1, :] = 0
                K[2 * idx, 2 * idx] = 1
                K[2 * idx + 1, 2 * idx + 1] = 1
                F[2 * idx] = 0
                F[2 * idx + 1] = 0

    def compute_viscoplastic_deformation(self, displacement: np.ndarray, clay_param: ClayParameter,
                                          dt: float = 0.01, n_steps: int = 100) -> np.ndarray:
        u_history = np.zeros((n_steps + 1, 2, self.ny, self.nx))
        u_history[0] = displacement.copy()

        for step in range(n_steps):
            ex, ey, exy = self.compute_strain_tensor(u_history[step])
            sigmax, sigmay, sigmaxy = self.compute_stress_tensor(ex, ey, exy, clay_param)
            von_mises = self.compute_von_mises_stress(sigmax, sigmay, sigmaxy)

            yield_mask = von_mises > clay_param.yield_strength

            strain_rate = np.zeros_like(von_mises)
            strain_rate[yield_mask] = (von_mises[yield_mask] - clay_param.yield_strength) / clay_param.viscosity

            du = strain_rate * dt
            u_history[step + 1, 0] = u_history[step, 0] + du
            u_history[step + 1, 1] = u_history[step, 1] + du

        return u_history

    def compute_moisture_effect(self, clay_param: ClayParameter, moisture_range: Tuple[float, float],
                                 n_points: int = 10) -> Dict[str, np.ndarray]:
        moistures = np.linspace(moisture_range[0], moisture_range[1], n_points)

        E_values = np.zeros(n_points)
        yield_values = np.zeros(n_points)

        for i, m in enumerate(moistures):
            moisture_factor = np.exp(-3 * (m - 0.25))
            E_values[i] = clay_param.youngs_modulus * moisture_factor
            yield_values[i] = clay_param.yield_strength * moisture_factor

        return {
            'moistures': moistures,
            'youngs_modulus': E_values,
            'yield_strength': yield_values
        }

    def interpolate_results(self, points: np.ndarray, values: np.ndarray,
                            method: str = 'cubic') -> np.ndarray:
        return griddata(points, values, (self.X, self.Y), method=method)
