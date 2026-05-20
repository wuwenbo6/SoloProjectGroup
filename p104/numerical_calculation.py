import numpy as np
from scipy import linalg, integrate, interpolate
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass


@dataclass
class MaterialProperties:
    youngs_modulus: float
    shear_modulus: float
    density: float
    poisson_ratio: float


@dataclass
class CrossSection:
    width: float
    thickness: float
    area: float
    moment_of_inertia: float


class FiniteElementSolver:
    def __init__(self, num_elements: int = 10):
        self.num_elements = num_elements
        self.num_nodes = num_elements + 1

    def build_truss_stiffness_matrix(self,
                                     length: float,
                                     axial_stiffness: float,
                                     num_elements: Optional[int] = None) -> np.ndarray:
        if num_elements is None:
            num_elements = self.num_elements
        num_nodes = num_elements + 1
        K = np.zeros((num_nodes, num_nodes))
        element_length = length / num_elements
        k_element = axial_stiffness / element_length
        
        for i in range(num_elements):
            K[i, i] += k_element
            K[i, i + 1] -= k_element
            K[i + 1, i] -= k_element
            K[i + 1, i + 1] += k_element
        
        return K

    def build_beam_stiffness_matrix(self,
                                    length: float,
                                    bending_stiffness: float,
                                    axial_stiffness: float,
                                    num_elements: Optional[int] = None) -> np.ndarray:
        if num_elements is None:
            num_elements = self.num_elements
        num_nodes = num_elements + 1
        dof_per_node = 2
        total_dof = num_nodes * dof_per_node
        K = np.zeros((total_dof, total_dof))
        element_length = length / num_elements
        L = element_length
        EI = bending_stiffness
        EA = axial_stiffness
        
        k_beam = np.array([
            [EA/L, 0, 0, -EA/L, 0, 0],
            [0, 12*EI/L**3, 6*EI/L**2, 0, -12*EI/L**3, 6*EI/L**2],
            [0, 6*EI/L**2, 4*EI/L, 0, -6*EI/L**2, 2*EI/L],
            [-EA/L, 0, 0, EA/L, 0, 0],
            [0, -12*EI/L**3, -6*EI/L**2, 0, 12*EI/L**3, -6*EI/L**2],
            [0, 6*EI/L**2, 2*EI/L, 0, -6*EI/L**2, 4*EI/L]
        ])
        
        for i in range(num_elements):
            idx = [i*2, i*2+1, (i+1)*2, (i+1)*2+1]
            for j in range(4):
                for k in range(4):
                    K[idx[j], idx[k]] += k_beam[j, k]
        
        return K

    def solve_static(self,
                     K: np.ndarray,
                     F: np.ndarray,
                     fixed_dofs: List[int]) -> Tuple[np.ndarray, np.ndarray]:
        free_dofs = [i for i in range(K.shape[0]) if i not in fixed_dofs]
        
        K_ff = K[np.ix_(free_dofs, free_dofs)]
        K_fs = K[np.ix_(free_dofs, fixed_dofs)]
        
        F_f = F[free_dofs]
        
        u_f = linalg.solve(K_ff, F_f)
        
        u = np.zeros(K.shape[0])
        u[free_dofs] = u_f
        
        reactions = K @ u - F
        
        return u, reactions


class TensionCalculator:
    @staticmethod
    def calculate_axial_tension(strain: np.ndarray,
                                axial_stiffness: float,
                                cross_section_area: float) -> np.ndarray:
        stress = axial_stiffness * strain
        tension = stress * cross_section_area
        return tension

    @staticmethod
    def calculate_bending_tension(displacement: np.ndarray,
                                  length: float,
                                  bending_stiffness: float,
                                  thickness: float) -> np.ndarray:
        x = np.linspace(0, length, len(displacement))
        curvature = np.gradient(np.gradient(displacement, x), x)
        bending_stress = bending_stiffness * curvature * thickness / 2
        return bending_stress

    @staticmethod
    def calculate_contact_tension(normal_force: np.ndarray,
                                  contact_area: float,
                                  friction_coefficient: float = 0.3) -> np.ndarray:
        contact_pressure = normal_force / contact_area
        friction_tension = friction_coefficient * contact_pressure * contact_area
        return friction_tension

    @staticmethod
    def calculate_weave_tension(weave_pattern: str,
                               warp_count: int,
                               weft_count: int,
                               base_tension: float) -> Dict[str, float]:
        tension_factors = {
            'plain': 1.0,
            'twill': 0.85,
            'satin': 0.75,
            'lattice': 0.9
        }
        
        factor = tension_factors.get(weave_pattern.lower(), 1.0)
        
        warp_tension = base_tension * factor * np.sqrt(weft_count / warp_count)
        weft_tension = base_tension * factor * np.sqrt(warp_count / weft_count)
        
        return {
            'warp_tension': warp_tension,
            'weft_tension': weft_tension,
            'factor': factor
        }


class IntegrationSolver:
    @staticmethod
    def integrate_tension_over_time(tension_history: np.ndarray,
                                    time_steps: np.ndarray) -> float:
        return integrate.trapz(tension_history, time_steps)

    @staticmethod
    def integrate_stress_energy(stress: np.ndarray,
                                strain: np.ndarray,
                                volume: float) -> float:
        stress_energy_density = 0.5 * stress * strain
        total_energy = np.trapz(stress_energy_density * volume, strain)
        return total_energy


class InterpolationSolver:
    @staticmethod
    def interpolate_tension(x: np.ndarray,
                            y: np.ndarray,
                            x_new: np.ndarray,
                            method: str = 'cubic') -> np.ndarray:
        if method == 'linear':
            f = interpolate.interp1d(x, y, kind='linear')
        elif method == 'cubic':
            f = interpolate.interp1d(x, y, kind='cubic')
        elif method == 'spline':
            f = interpolate.make_interp_spline(x, y)
        else:
            raise ValueError(f"Unknown interpolation method: {method}")
        
        return f(x_new)

    @staticmethod
    def smooth_tension_data(tension: np.ndarray,
                            window_size: int = 5) -> np.ndarray:
        kernel = np.ones(window_size) / window_size
        return np.convolve(tension, kernel, mode='same')


class NonlinearSolver:
    @staticmethod
    def solve_nonlinear_tension(initial_guess: np.ndarray,
                                residual_func,
                                jacobian_func,
                                tol: float = 1e-6,
                                max_iter: int = 100) -> Tuple[np.ndarray, bool]:
        x = initial_guess.copy()
        
        for i in range(max_iter):
            residual = residual_func(x)
            if np.linalg.norm(residual) < tol:
                return x, True
            
            jacobian = jacobian_func(x)
            delta = linalg.solve(jacobian, -residual)
            x += delta
        
        return x, False

    @staticmethod
    def hyperelastic_stress(strain: np.ndarray,
                            mu: float,
                            lambda_: float) -> np.ndarray:
        return mu * (np.exp(strain) - 1) + lambda_ * strain * np.exp(strain)
