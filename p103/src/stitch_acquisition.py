import json
import numpy as np
from typing import Dict, List, Optional, Union
from pathlib import Path


class StitchParameters:
    def __init__(self):
        self.thread_type: str = 'silk_120D'
        self.stitch_type: str = 'fill'
        self.base_tension: float = 1.0
        self.stitch_count: int = 100
        self.stitch_length: float = 3.0
        self.stitch_spacing: float = 0.3
        self.stitch_speed: float = 10.0
        self.fabric_stiffness: float = 1000.0
        self.needle_temperature: float = 25.0
        self.humidity: float = 50.0
        self.tension_factor: float = 1.0


class StitchAcquisition:
    def __init__(self):
        self.parameters = StitchParameters()
        self.acquisition_history: List[Dict] = []
    
    def load_from_json(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            type_mapping = {
                'thread_type': str,
                'stitch_type': str,
                'base_tension': float,
                'stitch_count': int,
                'stitch_length': float,
                'stitch_spacing': float,
                'stitch_speed': float,
                'fabric_stiffness': float,
                'needle_temperature': float,
                'humidity': float,
                'tension_factor': float
            }
            
            loaded_count = 0
            for key, value in data.items():
                if hasattr(self.parameters, key) and key in type_mapping:
                    try:
                        if key == 'stitch_count' and isinstance(value, str):
                            value = int(float(value))
                        else:
                            value = type_mapping[key](value)
                        setattr(self.parameters, key, value)
                        loaded_count += 1
                    except (ValueError, TypeError) as e:
                        print(f"Warning: Could not convert {key}={value}: {e}")
            
            self.acquisition_history.append({
                'timestamp': self._get_timestamp(),
                'action': 'load',
                'filepath': filepath,
                'parameters_loaded': loaded_count,
                'parameters': self._get_param_dict()
            })
            return loaded_count > 0
        except Exception as e:
            print(f"Error loading parameters: {e}")
            return False
    
    def save_to_json(self, filepath: str) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self._get_param_dict(), f, indent=2, ensure_ascii=False)
            
            self.acquisition_history.append({
                'timestamp': self._get_timestamp(),
                'action': 'save',
                'filepath': filepath,
                'parameters': self._get_param_dict()
            })
            return True
        except Exception as e:
            print(f"Error saving parameters: {e}")
            return False
    
    def _get_param_dict(self) -> Dict:
        return {
            key: getattr(self.parameters, key)
            for key in dir(self.parameters)
            if not key.startswith('_') and not callable(getattr(self.parameters, key))
        }
    
    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().isoformat()
    
    def set_parameter(self, key: str, value: Union[str, float, int]) -> bool:
        if hasattr(self.parameters, key):
            old_value = getattr(self.parameters, key)
            setattr(self.parameters, key, value)
            
            self.acquisition_history.append({
                'timestamp': self._get_timestamp(),
                'action': 'modify',
                'parameter': key,
                'old_value': old_value,
                'new_value': value
            })
            return True
        return False
    
    def get_parameter(self, key: str) -> Optional[Union[str, float, int]]:
        if hasattr(self.parameters, key):
            return getattr(self.parameters, key)
        return None
    
    def get_all_parameters(self) -> Dict:
        return self._get_param_dict()
    
    def batch_set_parameters(self, params: Dict) -> None:
        for key, value in params.items():
            self.set_parameter(key, value)
    
    def validate_parameters(self) -> Dict[str, Union[bool, List[str]]]:
        errors = []
        valid_threads = ['silk_120D', 'silk_240D', 'cotton_30s']
        valid_stitches = ['satin', 'chain', 'fill', 'outline']
        
        if self.parameters.thread_type not in valid_threads:
            errors.append(f"Invalid thread_type: {self.parameters.thread_type}")
        
        if self.parameters.stitch_type not in valid_stitches:
            errors.append(f"Invalid stitch_type: {self.parameters.stitch_type}")
        
        if self.parameters.base_tension <= 0 or self.parameters.base_tension > 10:
            errors.append("base_tension must be between 0 and 10 N")
        
        if self.parameters.stitch_count <= 0 or self.parameters.stitch_count > 10000:
            errors.append("stitch_count must be between 1 and 10000")
        
        if self.parameters.stitch_length <= 0 or self.parameters.stitch_length > 50:
            errors.append("stitch_length must be between 0 and 50 mm")
        
        if self.parameters.stitch_spacing <= 0 or self.parameters.stitch_spacing > 10:
            errors.append("stitch_spacing must be between 0 and 10 mm")
        
        if self.parameters.stitch_speed <= 0 or self.parameters.stitch_speed > 100:
            errors.append("stitch_speed must be between 0 and 100 stitches/sec")
        
        if self.parameters.fabric_stiffness <= 0 or self.parameters.fabric_stiffness > 10000:
            errors.append("fabric_stiffness must be between 0 and 10000 N/m")
        
        if self.parameters.needle_temperature < 0 or self.parameters.needle_temperature > 100:
            errors.append("needle_temperature must be between 0 and 100 °C")
        
        if self.parameters.humidity < 0 or self.parameters.humidity > 100:
            errors.append("humidity must be between 0 and 100 %")
        
        if self.parameters.tension_factor <= 0 or self.parameters.tension_factor > 3:
            errors.append("tension_factor must be between 0 and 3")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def generate_parameter_range(self, param_name: str, start: float, 
                                  end: float, steps: int) -> np.ndarray:
        return np.linspace(start, end, steps)
    
    def get_acquisition_history(self) -> List[Dict]:
        return self.acquisition_history.copy()
    
    def clear_history(self) -> None:
        self.acquisition_history.clear()
    
    def export_history(self, filepath: str) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.acquisition_history, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error exporting history: {e}")
            return False
    
    def import_experimental_data(self, filepath: str, apply_to_parameters: bool = True) -> Optional[Dict]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                if filepath.endswith('.json'):
                    data = json.load(f)
                    if isinstance(data, dict) and apply_to_parameters:
                        self._apply_dict_to_parameters(data)
                    return data
                elif filepath.endswith('.csv'):
                    data = self._parse_csv(filepath)
                    if apply_to_parameters and 'parameters' in data:
                        self._apply_dict_to_parameters(data['parameters'])
                    return data
        except Exception as e:
            print(f"Error importing data: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _apply_dict_to_parameters(self, data: Dict) -> int:
        type_mapping = {
            'thread_type': str,
            'stitch_type': str,
            'base_tension': float,
            'stitch_count': int,
            'stitch_length': float,
            'stitch_spacing': float,
            'stitch_speed': float,
            'fabric_stiffness': float,
            'needle_temperature': float,
            'humidity': float,
            'tension_factor': float
        }
        
        applied_count = 0
        for key, value in data.items():
            if hasattr(self.parameters, key) and key in type_mapping:
                try:
                    if key == 'stitch_count' and isinstance(value, str):
                        value = int(float(value))
                    else:
                        value = type_mapping[key](value)
                    setattr(self.parameters, key, value)
                    applied_count += 1
                except (ValueError, TypeError):
                    continue
        return applied_count
    
    def _parse_csv(self, filepath: str) -> Dict:
        import csv
        data = {'headers': [], 'rows': [], 'parameters': {}, 'time_series': []}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data['headers'] = reader.fieldnames
            
            param_fields = ['thread_type', 'stitch_type', 'base_tension', 'stitch_count',
                           'stitch_length', 'stitch_spacing', 'stitch_speed',
                           'fabric_stiffness', 'needle_temperature', 'humidity', 'tension_factor']
            
            time_series_fields = ['time', 'tension', 'force', 'position']
            
            for row in reader:
                data['rows'].append(row)
                
                for field in param_fields:
                    if field in row and row[field].strip() != '':
                        if field not in data['parameters']:
                            data['parameters'][field] = row[field]
                
                ts_row = {}
                for field in time_series_fields:
                    if field in row:
                        try:
                            ts_row[field] = float(row[field])
                        except (ValueError, TypeError):
                            pass
                if ts_row:
                    data['time_series'].append(ts_row)
        
        return data
    
    def create_template_config(self, filepath: str) -> bool:
        template = {
            "thread_type": "silk_120D",
            "stitch_type": "fill",
            "base_tension": 1.0,
            "stitch_count": 100,
            "stitch_length": 3.0,
            "stitch_spacing": 0.3,
            "stitch_speed": 10.0,
            "fabric_stiffness": 1000.0,
            "needle_temperature": 25.0,
            "humidity": 50.0,
            "tension_factor": 1.0,
            "_description": "刺绣针法参数配置模板",
            "_thread_types": ["silk_120D", "silk_240D", "cotton_30s"],
            "_stitch_types": ["satin", "chain", "fill", "outline"]
        }
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(template, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error creating template: {e}")
            return False