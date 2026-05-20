import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings

try:
    from ..data_acquisition import ClayParameter, ParameterCollector
    from ..numerical_computation import NumericalComputation
except ImportError:
    from data_acquisition import ClayParameter, ParameterCollector
    from numerical_computation import NumericalComputation


@dataclass
class ClayRegion:
    clay_type: str
    x_range: Tuple[float, float]
    y_range: Tuple[float, float]
    thickness: float = 1.0


@dataclass
class ContactCondition:
    region1: str
    region2: str
    contact_type: str = 'bonded'
    friction_coefficient: float = 0.3
    bond_strength: float = 1e5


@dataclass
class MultiClaySimulationResult:
    displacement: np.ndarray
    strain: Tuple[np.ndarray, np.ndarray, np.ndarray]
    stress: Tuple[np.ndarray, np.ndarray, np.ndarray]
    von_mises_stress: np.ndarray
    clay_regions: List[ClayRegion]
    region_masks: np.ndarray
    contact_forces: Optional[Dict[str, np.ndarray]] = None
    deformation_history: Optional[np.ndarray] = None


class MultiClaySimulator:
    def __init__(self, collector: Optional[ParameterCollector] = None):
        self.collector = collector or ParameterCollector()
        self.clay_regions: List[ClayRegion] = []
        self.contact_conditions: List[ContactCondition] = []
        self._region_cache: Dict[str, ClayParameter] = {}

    def add_clay_region(self, region: ClayRegion) -> None:
        self.clay_regions.append(region)
        clay_param = self.collector.get_clay_parameter(region.clay_type)
        if clay_param:
            self._region_cache[f"region_{len(self.clay_regions)}"] = clay_param

    def add_contact_condition(self, contact: ContactCondition) -> None:
        self.contact_conditions.append(contact)

    def _create_region_masks(self, nx: int, ny: int) -> np.ndarray:
        x_coords = np.linspace(0, 1, nx)
        y_coords = np.linspace(0, 1, ny)
        X, Y = np.meshgrid(x_coords, y_coords)

        masks = np.zeros((ny, nx), dtype=int)

        for i, region in enumerate(self.clay_regions):
            x_min, x_max = region.x_range
            y_min, y_max = region.y_range
            region_mask = (X >= x_min) & (X <= x_max) & (Y >= y_min) & (Y <= y_max)
            masks[region_mask] = i + 1

        background_mask = masks == 0
        if np.any(background_mask) and self.clay_regions:
            masks[background_mask] = 1

        return masks

    def _get_composite_elastic_properties(self, masks: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        ny, nx = masks.shape
        E = np.zeros((ny, nx))
        nu = np.zeros((ny, nx))

        for i, region in enumerate(self.clay_regions):
            region_mask = masks == (i + 1)
            clay_param = self.collector.get_clay_parameter(region.clay_type)
            if clay_param:
                E[region_mask] = clay_param.youngs_modulus
                nu[region_mask] = clay_param.poissons_ratio

        if np.any(E == 0) and self.clay_regions:
            default_param = self.collector.get_clay_parameter(self.clay_regions[0].clay_type)
            if default_param:
                E[E == 0] = default_param.youngs_modulus
                nu[nu == 0] = default_param.poissons_ratio

        return E, nu

    def run_multi_clay_simulation(self, force_magnitude: float,
                                    force_direction: Tuple[float, float],
                                    force_position: Tuple[float, float] = (0.5, 1.0),
                                    grid_size: Tuple[int, int] = (30, 30),
                                    simulation_time: float = 0.0,
                                    time_steps: int = 0) -> MultiClaySimulationResult:
        nx, ny = grid_size
        computation = NumericalComputation(grid_size=grid_size)

        masks = self._create_region_masks(nx, ny)
        E, nu = self._get_composite_elastic_properties(masks)

        displacement = self._solve_composite_elasticity(
            E, nu, force_magnitude, force_direction, force_position, computation
        )

        ex, ey, exy = computation.compute_strain_tensor(displacement)
        sigmax, sigmay, sigmaxy = self._compute_composite_stress(ex, ey, exy, E, nu)
        von_mises = computation.compute_von_mises_stress(sigmax, sigmay, sigmaxy)

        contact_forces = self._compute_contact_forces(displacement, E, nu, masks)

        deformation_history = None
        if simulation_time > 0 and time_steps > 0:
            deformation_history = self._compute_viscoplastic_deformation_multi(
                displacement, masks, simulation_time, time_steps, computation
            )

        return MultiClaySimulationResult(
            displacement=displacement,
            strain=(ex, ey, exy),
            stress=(sigmax, sigmay, sigmaxy),
            von_mises_stress=von_mises,
            clay_regions=self.clay_regions,
            region_masks=masks,
            contact_forces=contact_forces,
            deformation_history=deformation_history
        )

    def _solve_composite_elasticity(self, E: np.ndarray, nu: np.ndarray,
                                     force_magnitude: float,
                                     force_direction: Tuple[float, float],
                                     force_position: Tuple[float, float],
                                     computation: NumericalComputation) -> np.ndarray:
        nx, ny = computation.nx, computation.ny
        n_nodes = nx * ny
        n_dofs = 2 * n_nodes

        K = np.zeros((n_dofs, n_dofs))
        F = np.zeros(n_dofs)

        dx = 1.0 / (nx - 1)
        dy = 1.0 / (ny - 1)

        for i in range(nx - 1):
            for j in range(ny - 1):
                node_indices = [
                    j * nx + i,
                    j * nx + i + 1,
                    (j + 1) * nx + i + 1,
                    (j + 1) * nx + i
                ]

                center_i = i + 0.5
                center_j = j + 0.5
                E_elem = E[int(center_j), int(center_i)]
                nu_elem = nu[int(center_j), int(center_i)]

                ke = self._compute_element_stiffness_optimized(E_elem, nu_elem, dx, dy)

                for a in range(4):
                    for b in range(4):
                        for m in range(2):
                            for n in range(2):
                                K[2 * node_indices[a] + m, 2 * node_indices[b] + n] += ke[2 * a + m, 2 * b + n]

        fx, fy = force_direction
        norm = np.sqrt(fx ** 2 + fy ** 2)
        fx_normalized = fx / norm
        fy_normalized = fy / norm

        force_node_x = int(force_position[0] * (nx - 1))
        force_node_y = int(force_position[1] * (ny - 1))
        force_node_idx = force_node_y * nx + force_node_x

        F[2 * force_node_idx] += force_magnitude * fx_normalized
        F[2 * force_node_idx + 1] += force_magnitude * fy_normalized

        for i in range(nx):
            idx = i
            K[2 * idx, :] = 0
            K[2 * idx + 1, :] = 0
            K[2 * idx, 2 * idx] = 1
            K[2 * idx + 1, 2 * idx + 1] = 1
            F[2 * idx] = 0
            F[2 * idx + 1] = 0

        U = np.linalg.solve(K, F)

        u = U[0::2].reshape(ny, nx)
        v = U[1::2].reshape(ny, nx)

        return np.array([u, v])

    def _compute_element_stiffness_optimized(self, E: float, nu: float,
                                               dx: float, dy: float) -> np.ndarray:
        D = E / ((1 + nu) * (1 - 2 * nu)) * np.array([
            [1 - nu, nu, 0],
            [nu, 1 - nu, 0],
            [0, 0, (1 - 2 * nu) / 2]
        ])

        gp = np.array([-1 / np.sqrt(3), 1 / np.sqrt(3)])

        ke = np.zeros((8, 8))

        for xi in gp:
            for eta in gp:
                dNdxi = 0.25 * np.array([
                    [-(1 - eta), (1 - eta), (1 + eta), -(1 + eta)],
                    [-(1 - xi), -(1 + xi), (1 + xi), (1 - xi)]
                ])

                J = np.array([[dx / 2, 0], [0, dy / 2]])

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

    def _compute_composite_stress(self, ex: np.ndarray, ey: np.ndarray, exy: np.ndarray,
                                   E: np.ndarray, nu: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        lam = E * nu / ((1 + nu) * (1 - 2 * nu))
        mu = E / (2 * (1 + nu))

        sigmax = lam * (ex + ey) + 2 * mu * ex
        sigmay = lam * (ex + ey) + 2 * mu * ey
        sigmaxy = 2 * mu * exy

        return sigmax, sigmay, sigmaxy

    def _compute_contact_forces(self, displacement: np.ndarray, E: np.ndarray,
                                 nu: np.ndarray, masks: np.ndarray) -> Dict[str, np.ndarray]:
        contact_forces = {}

        for contact in self.contact_conditions:
            region_idx1 = int(contact.region1.split('_')[1])
            region_idx2 = int(contact.region2.split('_')[1])

            boundary_mask = self._find_region_boundary(masks, region_idx1, region_idx2)

            if np.any(boundary_mask):
                u, v = displacement
                du = np.gradient(u, axis=1)
                dv = np.gradient(v, axis=0)

                contact_stress = E[boundary_mask].mean() * np.sqrt(du[boundary_mask] ** 2 + dv[boundary_mask] ** 2)

                contact_forces[f"{contact.region1}_{contact.region2}"] = contact_stress

        return contact_forces

    def _find_region_boundary(self, masks: np.ndarray, region1: int, region2: int) -> np.ndarray:
        kernel = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]])

        from scipy.ndimage import convolve
        mask1 = (masks == region1).astype(float)
        neighbors1 = convolve(mask1, kernel, mode='constant', cval=0)

        boundary = (neighbors1 > 0) & (masks == region2)
        return boundary

    def _compute_viscoplastic_deformation_multi(self, displacement: np.ndarray,
                                                  masks: np.ndarray,
                                                  simulation_time: float,
                                                  time_steps: int,
                                                  computation: NumericalComputation) -> np.ndarray:
        dt = simulation_time / time_steps
        history = np.zeros((time_steps + 1, 2, computation.ny, computation.nx))
        history[0] = displacement.copy()

        E, nu = self._get_composite_elastic_properties(masks)

        yield_strength = np.zeros_like(E)
        viscosity = np.zeros_like(E)

        for i, region in enumerate(self.clay_regions):
            region_mask = masks == (i + 1)
            clay_param = self.collector.get_clay_parameter(region.clay_type)
            if clay_param:
                yield_strength[region_mask] = clay_param.yield_strength
                viscosity[region_mask] = clay_param.viscosity

        for step in range(time_steps):
            ex, ey, exy = computation.compute_strain_tensor(history[step])
            sigmax, sigmay, sigmaxy = self._compute_composite_stress(ex, ey, exy, E, nu)
            von_mises = computation.compute_von_mises_stress(sigmax, sigmay, sigmaxy)

            yield_mask = von_mises > yield_strength

            strain_rate = np.zeros_like(von_mises)
            strain_rate[yield_mask] = (von_mises[yield_mask] - yield_strength[yield_mask]) / viscosity[yield_mask]

            du = strain_rate * dt
            history[step + 1, 0] = history[step, 0] + du
            history[step + 1, 1] = history[step, 1] + du

        return history

    def get_region_statistics(self, result: MultiClaySimulationResult) -> Dict[str, Dict]:
        stats = {}

        for i, region in enumerate(self.clay_regions):
            region_mask = result.region_masks == (i + 1)

            region_stress = result.von_mises_stress[region_mask]
            region_disp_x = result.displacement[0][region_mask]
            region_disp_y = result.displacement[1][region_mask]

            stats[f"region_{i + 1}_{region.clay_type}"] = {
                'max_stress': float(np.max(region_stress)),
                'mean_stress': float(np.mean(region_stress)),
                'min_stress': float(np.min(region_stress)),
                'max_displacement': float(np.max(np.sqrt(region_disp_x ** 2 + region_disp_y ** 2))),
                'area_fraction': float(np.sum(region_mask) / region_mask.size),
                'clay_type': region.clay_type
            }

        return stats
