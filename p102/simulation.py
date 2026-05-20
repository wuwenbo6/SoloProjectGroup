import numpy as np
import h5py
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from parameters import ParameterManager
from numerical import NumericalCalculator


class StressSimulation:
    def __init__(self, param_manager: Optional[ParameterManager] = None):
        self.param_manager = param_manager or ParameterManager()
        self.calculator = NumericalCalculator()
        self.results: Dict[str, Any] = {}
        self.simulation_id: Optional[str] = None
    
    def run_simulation(self, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if params is None:
            params = self.param_manager.current_params
        
        if not params:
            raise ValueError("No parameters set for simulation")
        
        self.simulation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        section_props = self.calculator.calculate_section_properties(
            params['beam_width'], params['beam_height']
        )
        
        contact_area = self.param_manager.get_contact_area()
        
        stress_field = self.calculator.generate_stress_field(params)
        
        max_stresses = {
            'max_sigma_x': np.max(np.abs(stress_field['sigma_x'])),
            'max_sigma_y': np.max(np.abs(stress_field['sigma_y'])),
            'max_tau_xy': np.max(np.abs(stress_field['tau_xy'])),
            'max_von_mises': np.max(stress_field['von_mises'])
        }
        
        contact_stresses = self.calculator.calculate_contact_stress(
            contact_area,
            params['load_magnitude'],
            params['friction_coefficient']
        )
        
        joint_stiffness = self.calculator.calculate_joint_stiffness(params)
        
        safety_factors = self._calculate_safety_factors(
            max_stresses, contact_stresses, params
        )
        
        failure_modes = self._evaluate_failure_modes(
            max_stresses, contact_stresses, params
        )
        
        deformation = self._calculate_joint_deformation(params, joint_stiffness)
        
        self.results = {
            'simulation_id': self.simulation_id,
            'timestamp': datetime.now().isoformat(),
            'parameters': params,
            'section_properties': section_props,
            'contact_area': contact_area,
            'stress_field': stress_field,
            'max_stresses': max_stresses,
            'contact_stresses': contact_stresses,
            'joint_stiffness': joint_stiffness,
            'safety_factors': safety_factors,
            'failure_modes': failure_modes,
            'deformation': deformation,
            'converged': True
        }
        
        return self.results
    
    def _calculate_safety_factors(self,
                                    max_stresses: Dict[str, float],
                                    contact_stresses: Dict[str, float],
                                    params: Dict[str, Any]) -> Dict[str, float]:
        sf_compressive = self.calculator.calculate_safety_factor(
            max_stresses['max_sigma_x'],
            params['compressive_strength']
        )
        
        sf_tensile = self.calculator.calculate_safety_factor(
            max_stresses['max_sigma_x'],
            params['tensile_strength']
        )
        
        sf_shear = self.calculator.calculate_safety_factor(
            max_stresses['max_tau_xy'],
            params['shear_modulus'] / 10
        )
        
        sf_contact = self.calculator.calculate_safety_factor(
            contact_stresses['contact_pressure'],
            params['compressive_strength']
        )
        
        overall_sf = min(sf_compressive, sf_tensile, sf_shear, sf_contact)
        
        return {
            'compressive': sf_compressive,
            'tensile': sf_tensile,
            'shear': sf_shear,
            'contact': sf_contact,
            'overall': overall_sf
        }
    
    def _evaluate_failure_modes(self,
                                 max_stresses: Dict[str, float],
                                 contact_stresses: Dict[str, float],
                                 params: Dict[str, Any]) -> Dict[str, Any]:
        modes = {}
        
        modes['compression_failure'] = \
            max_stresses['max_sigma_x'] > params['compressive_strength']
        
        modes['tension_failure'] = \
            max_stresses['max_sigma_x'] > params['tensile_strength']
        
        modes['shear_failure'] = \
            max_stresses['max_tau_xy'] > params['shear_modulus'] / 15
        
        modes['contact_failure'] = \
            contact_stresses['contact_pressure'] > params['compressive_strength'] * 0.8
        
        modes['sliding_failure'] = \
            contact_stresses['shear_stress'] > contact_stresses['normal_stress'] * \
            params['friction_coefficient']
        
        modes['any_failure'] = any(modes.values())
        
        return modes
    
    def _calculate_joint_deformation(self,
                                      params: Dict[str, Any],
                                      stiffness: float) -> Dict[str, float]:
        load = params['load_magnitude']
        
        axial_deformation = load / stiffness
        
        shear_deformation = 0.5 * axial_deformation
        
        bending_deformation = (load * params['beam_length'] ** 3) / \
                              (3 * params['elastic_modulus'] * 
                               self.calculator.calculate_section_properties(
                                   params['beam_width'], 
                                   params['beam_height']
                               )['moment_of_inertia_x'])
        
        total_deformation = np.sqrt(
            axial_deformation ** 2 + 
            shear_deformation ** 2 + 
            bending_deformation ** 2
        )
        
        return {
            'axial': axial_deformation,
            'shear': shear_deformation,
            'bending': bending_deformation,
            'total': total_deformation
        }
    
    def run_parametric_study(self,
                              param_name: str,
                              start: float,
                              end: float,
                              num_points: int = 10) -> List[Dict[str, Any]]:
        study_params = self.param_manager.generate_parametric_study(
            param_name, start, end, num_points
        )
        
        study_results = []
        for params in study_params:
            result = self.run_simulation(params)
            study_results.append(result)
        
        return study_results
    
    def save_results(self, filepath: Optional[str] = None) -> str:
        if not self.results:
            raise ValueError("No simulation results to save")
        
        if filepath is None:
            data_dir = os.path.join(os.path.dirname(__file__), 'data')
            os.makedirs(data_dir, exist_ok=True)
            filepath = os.path.join(
                data_dir, 
                f"simulation_{self.results['simulation_id']}.h5"
            )
        
        with h5py.File(filepath, 'w') as f:
            f.attrs['simulation_id'] = self.results['simulation_id']
            f.attrs['timestamp'] = self.results['timestamp']
            
            params_grp = f.create_group('parameters')
            for key, value in self.results['parameters'].items():
                if isinstance(value, (int, float, str)):
                    params_grp.attrs[key] = value
            
            section_grp = f.create_group('section_properties')
            for key, value in self.results['section_properties'].items():
                section_grp.attrs[key] = value
            
            f.attrs['contact_area'] = self.results['contact_area']
            
            stress_grp = f.create_group('stress_field')
            for key, value in self.results['stress_field'].items():
                stress_grp.create_dataset(key, data=value)
            
            max_stress_grp = f.create_group('max_stresses')
            for key, value in self.results['max_stresses'].items():
                max_stress_grp.attrs[key] = value
            
            contact_grp = f.create_group('contact_stresses')
            for key, value in self.results['contact_stresses'].items():
                contact_grp.attrs[key] = value
            
            f.attrs['joint_stiffness'] = self.results['joint_stiffness']
            
            sf_grp = f.create_group('safety_factors')
            for key, value in self.results['safety_factors'].items():
                sf_grp.attrs[key] = value
            
            failure_grp = f.create_group('failure_modes')
            for key, value in self.results['failure_modes'].items():
                failure_grp.attrs[key] = value
            
            deform_grp = f.create_group('deformation')
            for key, value in self.results['deformation'].items():
                deform_grp.attrs[key] = value
            
            f.attrs['converged'] = self.results['converged']
        
        return filepath
    
    @staticmethod
    def load_results(filepath: str) -> Dict[str, Any]:
        results = {}
        
        with h5py.File(filepath, 'r') as f:
            results['simulation_id'] = f.attrs['simulation_id']
            results['timestamp'] = f.attrs['timestamp']
            
            results['parameters'] = dict(f['parameters'].attrs)
            results['section_properties'] = dict(f['section_properties'].attrs)
            results['contact_area'] = f.attrs['contact_area']
            
            results['stress_field'] = {}
            for key in f['stress_field']:
                results['stress_field'][key] = f['stress_field'][key][:]
            
            results['max_stresses'] = dict(f['max_stresses'].attrs)
            results['contact_stresses'] = dict(f['contact_stresses'].attrs)
            results['joint_stiffness'] = f.attrs['joint_stiffness']
            results['safety_factors'] = dict(f['safety_factors'].attrs)
            results['failure_modes'] = dict(f['failure_modes'].attrs)
            results['deformation'] = dict(f['deformation'].attrs)
            results['converged'] = f.attrs['converged']
        
        return results
    
    def get_summary(self) -> str:
        if not self.results:
            return "No simulation results available"
        
        r = self.results
        summary = [
            "=" * 50,
            f"Simulation ID: {r['simulation_id']}",
            f"Timestamp: {r['timestamp']}",
            "",
            "Structure Parameters:",
            f"  Wood Type: {r['parameters']['wood_type']}",
            f"  Joint Type: {r['parameters']['joint_type']}",
            f"  Load Direction: {r['parameters']['load_direction']}",
            f"  Load Magnitude: {r['parameters']['load_magnitude']:.2f} N",
            "",
            "Key Results:",
            f"  Maximum Von Mises Stress: {r['max_stresses']['max_von_mises']/1e6:.2f} MPa",
            f"  Maximum Shear Stress: {r['max_stresses']['max_tau_xy']/1e6:.2f} MPa",
            f"  Contact Pressure: {r['contact_stresses']['contact_pressure']/1e6:.2f} MPa",
            "",
            "Safety Factors:",
            f"  Compressive: {r['safety_factors']['compressive']:.2f}",
            f"  Tensile: {r['safety_factors']['tensile']:.2f}",
            f"  Shear: {r['safety_factors']['shear']:.2f}",
            f"  Overall: {r['safety_factors']['overall']:.2f}",
            "",
            "Deformation:",
            f"  Total Deformation: {r['deformation']['total']*1000:.2f} mm",
            "",
            "Failure Assessment:",
            f"  Failure Detected: {'YES' if r['failure_modes']['any_failure'] else 'NO'}",
            "=" * 50
        ]
        
        return "\n".join(summary)
