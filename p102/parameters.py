import json
import os
from typing import Dict, Any, Optional, List
import numpy as np


class ParameterManager:
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), 'config.json')
        
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.wood_types = self.config['wood_types']
        self.joint_types = self.config['joint_types']
        self.load_directions = self.config['load_directions']
        
        self.current_params: Dict[str, Any] = {}
    
    def get_wood_properties(self, wood_type: str) -> Dict[str, float]:
        if wood_type not in self.wood_types:
            raise ValueError(f"Unknown wood type: {wood_type}. "
                           f"Available types: {list(self.wood_types.keys())}")
        return self.wood_types[wood_type].copy()
    
    def set_structure_parameters(self,
                                  wood_type: str,
                                  joint_type: str,
                                  beam_width: float,
                                  beam_height: float,
                                  beam_length: float,
                                  tenon_length: float,
                                  tenon_width: float,
                                  mortise_depth: float,
                                  load_magnitude: float,
                                  load_direction: str,
                                  friction_coefficient: float = 0.4) -> Dict[str, Any]:
        if joint_type not in self.joint_types:
            raise ValueError(f"Unknown joint type: {joint_type}. "
                           f"Available types: {self.joint_types}")
        
        if load_direction not in self.load_directions:
            raise ValueError(f"Unknown load direction: {load_direction}. "
                           f"Available directions: {self.load_directions}")
        
        wood_props = self.get_wood_properties(wood_type)
        
        self.current_params = {
            'wood_type': wood_type,
            'joint_type': joint_type,
            'beam_width': beam_width,
            'beam_height': beam_height,
            'beam_length': beam_length,
            'tenon_length': tenon_length,
            'tenon_width': tenon_width,
            'mortise_depth': mortise_depth,
            'load_magnitude': load_magnitude,
            'load_direction': load_direction,
            'friction_coefficient': friction_coefficient,
            **wood_props
        }
        
        return self.current_params.copy()
    
    def get_contact_area(self, joint_type: Optional[str] = None) -> float:
        params = self.current_params
        if joint_type is None:
            joint_type = params['joint_type']
        
        if joint_type == 'butt_joint':
            return params['beam_width'] * params['beam_height']
        elif joint_type == 'lap_joint':
            return params['tenon_length'] * params['beam_width']
        elif joint_type == 'mortise_tenon':
            return 2 * params['tenon_length'] * params['tenon_width'] + \
                   params['tenon_width'] * params['beam_height']
        elif joint_type == 'dovetail':
            return 2.5 * params['tenon_length'] * params['tenon_width']
        else:
            raise ValueError(f"Unknown joint type: {joint_type}")
    
    def validate_parameters(self) -> List[str]:
        errors = []
        params = self.current_params
        
        if params['beam_width'] <= 0:
            errors.append("Beam width must be positive")
        if params['beam_height'] <= 0:
            errors.append("Beam height must be positive")
        if params['beam_length'] <= 0:
            errors.append("Beam length must be positive")
        if params['tenon_length'] <= 0:
            errors.append("Tenon length must be positive")
        if params['tenon_width'] <= 0:
            errors.append("Tenon width must be positive")
        if params['mortise_depth'] <= 0:
            errors.append("Mortise depth must be positive")
        if params['load_magnitude'] <= 0:
            errors.append("Load magnitude must be positive")
        if params['friction_coefficient'] < 0 or params['friction_coefficient'] > 1:
            errors.append("Friction coefficient must be between 0 and 1")
        
        if params['tenon_length'] > params['beam_length'] / 2:
            errors.append("Tenon length is too large for the beam")
        if params['tenon_width'] > params['beam_width']:
            errors.append("Tenon width cannot exceed beam width")
        if params['mortise_depth'] > params['beam_height'] / 2:
            errors.append("Mortise depth is too large")
        
        return errors
    
    def save_parameters(self, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.current_params, f, indent=2, ensure_ascii=False)
    
    def load_parameters(self, filepath: str) -> Dict[str, Any]:
        with open(filepath, 'r', encoding='utf-8') as f:
            loaded_data = json.load(f)
        
        required_fields = [
            'wood_type', 'joint_type', 'beam_width', 'beam_height',
            'beam_length', 'tenon_length', 'tenon_width', 'mortise_depth',
            'load_magnitude', 'load_direction'
        ]
        
        optional_fields = {
            'friction_coefficient': 0.4,
            'elastic_modulus': 10e9,
            'shear_modulus': 0.5e9,
            'density': 500,
            'compressive_strength': 40e6,
            'tensile_strength': 80e6
        }
        
        cleaned_params = {}
        
        for field in required_fields:
            if field not in loaded_data:
                raise ValueError(f"Missing required parameter: {field}")
            cleaned_params[field] = loaded_data[field]
        
        for field, default in optional_fields.items():
            if field in loaded_data:
                cleaned_params[field] = loaded_data[field]
            else:
                cleaned_params[field] = default
        
        numeric_fields = [
            'beam_width', 'beam_height', 'beam_length',
            'tenon_length', 'tenon_width', 'mortise_depth',
            'load_magnitude', 'friction_coefficient',
            'elastic_modulus', 'shear_modulus', 'density',
            'compressive_strength', 'tensile_strength'
        ]
        
        for field in numeric_fields:
            if field in cleaned_params:
                try:
                    cleaned_params[field] = float(cleaned_params[field])
                except (TypeError, ValueError):
                    raise ValueError(f"Invalid numeric value for {field}: {cleaned_params[field]}")
        
        if cleaned_params['wood_type'] not in self.wood_types:
            print(f"Warning: Unknown wood type '{cleaned_params['wood_type']}', using default properties")
        
        if cleaned_params['joint_type'] not in self.joint_types:
            raise ValueError(f"Unknown joint type: {cleaned_params['joint_type']}")
        
        if cleaned_params['load_direction'] not in self.load_directions:
            raise ValueError(f"Unknown load direction: {cleaned_params['load_direction']}")
        
        self.current_params = cleaned_params
        return self.current_params.copy()
    
    def get_parameter_bounds(self) -> Dict[str, tuple]:
        return {
            'tenon_length': (0.01, 0.1),
            'tenon_width': (0.01, 0.05),
            'mortise_depth': (0.01, 0.05),
            'friction_coefficient': (0.1, 0.8)
        }
    
    def generate_parametric_study(self,
                                    param_name: str,
                                    start: float,
                                    end: float,
                                    num_points: int = 10) -> List[Dict[str, Any]]:
        param_values = np.linspace(start, end, num_points)
        study_params = []
        
        for value in param_values:
            params = self.current_params.copy()
            params[param_name] = value
            study_params.append(params)
        
        return study_params
