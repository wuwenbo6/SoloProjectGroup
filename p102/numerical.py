import numpy as np
from scipy import linalg, integrate
from typing import Dict, Any, Tuple, Optional


class NumericalCalculator:
    @staticmethod
    def calculate_section_properties(width: float, height: float) -> Dict[str, float]:
        area = width * height
        moment_of_inertia_x = (width * height ** 3) / 12
        moment_of_inertia_y = (height * width ** 3) / 12
        section_modulus_x = moment_of_inertia_x / (height / 2)
        section_modulus_y = moment_of_inertia_y / (width / 2)
        polar_moment_of_inertia = moment_of_inertia_x + moment_of_inertia_y
        shear_area = 5 / 6 * area
        
        return {
            'area': area,
            'moment_of_inertia_x': moment_of_inertia_x,
            'moment_of_inertia_y': moment_of_inertia_y,
            'section_modulus_x': section_modulus_x,
            'section_modulus_y': section_modulus_y,
            'polar_moment_of_inertia': polar_moment_of_inertia,
            'shear_area': shear_area
        }
    
    @staticmethod
    def calculate_axial_stress(load: float, area: float) -> float:
        return load / area
    
    @staticmethod
    def calculate_shear_stress(shear_force: float, shear_area: float) -> float:
        return shear_force / shear_area
    
    @staticmethod
    def calculate_bending_stress(bending_moment: float, section_modulus: float) -> float:
        return bending_moment / section_modulus
    
    @staticmethod
    def calculate_torsional_shear_stress(torque: float, 
                                         polar_modulus: float,
                                         width: float,
                                         height: float) -> float:
        if width == height:
            alpha = 0.208
            polar_modulus_rect = alpha * width * height ** 2
        else:
            ratio = min(width, height) / max(width, height)
            alpha = 0.208 + 0.096 * (1 - ratio)
            polar_modulus_rect = alpha * min(width, height) * max(width, height) ** 2
        
        return torque / polar_modulus_rect
    
    @staticmethod
    def calculate_principal_stresses(sigma_x: float, 
                                      sigma_y: float, 
                                      tau_xy: float) -> Tuple[float, float, float]:
        sigma_x = np.nan_to_num(sigma_x, nan=0.0, posinf=1e18, neginf=-1e18)
        sigma_y = np.nan_to_num(sigma_y, nan=0.0, posinf=1e18, neginf=-1e18)
        tau_xy = np.nan_to_num(tau_xy, nan=0.0, posinf=1e18, neginf=-1e18)
        
        sigma_avg = (sigma_x + sigma_y) / 2
        diff_term = np.clip(((sigma_x - sigma_y) / 2) ** 2, 0, 1e36)
        tau_term = np.clip(tau_xy ** 2, 0, 1e36)
        R = np.sqrt(diff_term + tau_term)
        
        sigma_1 = sigma_avg + R
        sigma_2 = sigma_avg - R
        
        denominator = sigma_x - sigma_y
        if abs(denominator) < 1e-10:
            if abs(tau_xy) < 1e-10:
                theta_p = 0.0
            else:
                theta_p = np.pi / 4 if tau_xy > 0 else -np.pi / 4
        else:
            theta_p = 0.5 * np.arctan2(2 * tau_xy, denominator)
        
        return sigma_1, sigma_2, np.degrees(theta_p)
    
    @staticmethod
    def calculate_von_mises_stress(sigma_x: float, 
                                    sigma_y: float, 
                                    sigma_z: float,
                                    tau_xy: float, 
                                    tau_yz: float, 
                                    tau_xz: float) -> float:
        sigma_x = np.nan_to_num(sigma_x, nan=0.0, posinf=1e18, neginf=-1e18)
        sigma_y = np.nan_to_num(sigma_y, nan=0.0, posinf=1e18, neginf=-1e18)
        sigma_z = np.nan_to_num(sigma_z, nan=0.0, posinf=1e18, neginf=-1e18)
        tau_xy = np.nan_to_num(tau_xy, nan=0.0, posinf=1e18, neginf=-1e18)
        tau_yz = np.nan_to_num(tau_yz, nan=0.0, posinf=1e18, neginf=-1e18)
        tau_xz = np.nan_to_num(tau_xz, nan=0.0, posinf=1e18, neginf=-1e18)
        
        term1 = np.clip((sigma_x - sigma_y) ** 2, 0, 1e36)
        term2 = np.clip((sigma_y - sigma_z) ** 2, 0, 1e36)
        term3 = np.clip((sigma_z - sigma_x) ** 2, 0, 1e36)
        term4 = 6 * np.clip(tau_xy ** 2 + tau_yz ** 2 + tau_xz ** 2, 0, 1e36)
        
        return np.sqrt(0.5 * (term1 + term2 + term3 + term4))
    
    @staticmethod
    def calculate_contact_stress(contact_area: float, 
                                  normal_force: float,
                                  friction_coeff: float) -> Dict[str, float]:
        normal_stress = normal_force / contact_area
        shear_stress = friction_coeff * normal_stress
        
        return {
            'normal_stress': normal_stress,
            'shear_stress': shear_stress,
            'contact_pressure': normal_stress
        }
    
    @staticmethod
    def generate_stress_field(params: Dict[str, Any],
                               num_points: int = 50) -> Dict[str, np.ndarray]:
        beam_length = max(params['beam_length'], 1e-6)
        beam_height = max(params['beam_height'], 1e-6)
        beam_width = max(params['beam_width'], 1e-6)
        
        x = np.linspace(0, beam_length, num_points)
        y = np.linspace(-beam_height/2, beam_height/2, num_points)
        X, Y = np.meshgrid(x, y)
        
        section_props = NumericalCalculator.calculate_section_properties(
            beam_width, beam_height
        )
        
        area = max(section_props['area'], 1e-12)
        inertia_x = max(section_props['moment_of_inertia_x'], 1e-12)
        polar_inertia = max(section_props['polar_moment_of_inertia'], 1e-12)
        
        if params['load_direction'] == 'axial':
            sigma_x = params['load_magnitude'] / area * np.ones_like(X)
            sigma_y = np.zeros_like(X)
            tau_xy = np.zeros_like(X)
        
        elif params['load_direction'] == 'shear':
            sigma_x = np.zeros_like(X)
            sigma_y = np.zeros_like(X)
            norm_y = 2 * Y / beam_height
            tau_xy = 1.5 * params['load_magnitude'] / area * (1 - norm_y ** 2)
        
        elif params['load_direction'] == 'bending':
            bending_moment = params['load_magnitude'] * (beam_length - X)
            sigma_x = -bending_moment * Y / inertia_x
            sigma_y = np.zeros_like(X)
            tau_xy = np.zeros_like(X)
        
        elif params['load_direction'] == 'torsion':
            sigma_x = np.zeros_like(X)
            sigma_y = np.zeros_like(X)
            tau_xy = params['load_magnitude'] * Y / polar_inertia
        
        else:
            raise ValueError(f"Unknown load direction: {params['load_direction']}")
        
        sigma_x = np.clip(sigma_x, -1e12, 1e12)
        sigma_y = np.clip(sigma_y, -1e12, 1e12)
        tau_xy = np.clip(tau_xy, -1e12, 1e12)
        
        von_mises = NumericalCalculator.calculate_von_mises_stress(
            sigma_x, sigma_y, np.zeros_like(sigma_x),
            tau_xy, np.zeros_like(tau_xy), np.zeros_like(tau_xy)
        )
        
        return {
            'X': X,
            'Y': Y,
            'sigma_x': sigma_x,
            'sigma_y': sigma_y,
            'tau_xy': tau_xy,
            'von_mises': von_mises
        }
    
    @staticmethod
    def solve_equilibrium(nodes: np.ndarray,
                           elements: np.ndarray,
                           forces: np.ndarray,
                           E: float,
                           nu: float = 0.3) -> np.ndarray:
        num_nodes = len(nodes)
        K = np.zeros((2 * num_nodes, 2 * num_nodes))
        
        for elem in elements:
            i, j = elem
            xi, yi = nodes[i]
            xj, yj = nodes[j]
            
            L = np.sqrt((xj - xi) ** 2 + (yj - yi) ** 2)
            c = (xj - xi) / L
            s = (yj - yi) / L
            
            A = 0.01 * 0.01
            k_elem = E * A / L * np.array([
                [c*c, c*s, -c*c, -c*s],
                [c*s, s*s, -c*s, -s*s],
                [-c*c, -c*s, c*c, c*s],
                [-c*s, -s*s, c*s, s*s]
            ])
            
            idx = [2*i, 2*i+1, 2*j, 2*j+1]
            for a in range(4):
                for b in range(4):
                    K[idx[a], idx[b]] += k_elem[a, b]
        
        fixed_dofs = [0, 1]
        free_dofs = [i for i in range(2 * num_nodes) if i not in fixed_dofs]
        
        K_free = K[np.ix_(free_dofs, free_dofs)]
        F_free = forces[free_dofs]
        
        U_free = linalg.solve(K_free, F_free)
        displacements = np.zeros(2 * num_nodes)
        displacements[free_dofs] = U_free
        
        return displacements.reshape(-1, 2)
    
    @staticmethod
    def calculate_safety_factor(stress: float, strength: float) -> float:
        stress_abs = abs(np.nan_to_num(stress, nan=1e-6, posinf=1e18, neginf=1e18))
        strength_val = np.nan_to_num(strength, nan=1e6, posinf=1e18, neginf=1e18)
        
        if stress_abs < 1e-10:
            return 1000.0
        
        sf = abs(strength_val / stress_abs)
        return min(sf, 1000.0)
    
    @staticmethod
    def calculate_joint_stiffness(params: Dict[str, Any]) -> float:
        E = params['elastic_modulus']
        G = params['shear_modulus']
        contact_area = params['tenon_length'] * params['tenon_width']
        length = params['tenon_length']
        
        axial_stiffness = E * contact_area / length
        shear_stiffness = G * contact_area / length
        
        return 0.7 * axial_stiffness + 0.3 * shear_stiffness
    
    @staticmethod
    def integrate_stress_field(stress_field: np.ndarray,
                                x_coords: np.ndarray,
                                y_coords: np.ndarray) -> float:
        return integrate.trapz(integrate.trapz(stress_field, y_coords, axis=0), x_coords)
