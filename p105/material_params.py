import json
import os
from typing import Dict, Optional
import numpy as np


class LacquerMaterial:
    def __init__(self, name: str):
        self.name = name
        self.density = 0.0
        self.specific_heat = 0.0
        self.thermal_conductivity = 0.0
        self.diffusion_coefficient = 0.0
        self.initial_moisture_content = 0.0
        self.equilibrium_moisture = 0.0
        self.thickness = 0.0
        self.activation_energy = 0.0
        self.pre_exponential_factor = 0.0

    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'density': self.density,
            'specific_heat': self.specific_heat,
            'thermal_conductivity': self.thermal_conductivity,
            'diffusion_coefficient': self.diffusion_coefficient,
            'initial_moisture_content': self.initial_moisture_content,
            'equilibrium_moisture': self.equilibrium_moisture,
            'thickness': self.thickness,
            'activation_energy': self.activation_energy,
            'pre_exponential_factor': self.pre_exponential_factor
        }

    def from_dict(self, data: Dict):
        numeric_fields = [
            'density', 'specific_heat', 'thermal_conductivity',
            'diffusion_coefficient', 'initial_moisture_content',
            'equilibrium_moisture', 'thickness',
            'activation_energy', 'pre_exponential_factor'
        ]

        for key, value in data.items():
            if hasattr(self, key):
                if key == 'name':
                    setattr(self, key, str(value) if value is not None else 'unknown')
                elif key in numeric_fields:
                    if value is None:
                        setattr(self, key, 0.0)
                    else:
                        try:
                            if isinstance(value, np.ndarray):
                                numeric_val = float(value.item())
                            else:
                                numeric_val = float(value)
                            setattr(self, key, numeric_val)
                        except (ValueError, TypeError):
                            setattr(self, key, 0.0)
                else:
                    setattr(self, key, value)
        return self


class MaterialParamsManager:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        self.materials: Dict[str, LacquerMaterial] = {}
        self._load_default_materials()

    def _load_default_materials(self):
        self.materials['raw_lacquer'] = LacquerMaterial('raw_lacquer')
        self.materials['raw_lacquer'].density = 950.0
        self.materials['raw_lacquer'].specific_heat = 2000.0
        self.materials['raw_lacquer'].thermal_conductivity = 0.15
        self.materials['raw_lacquer'].diffusion_coefficient = 1e-9
        self.materials['raw_lacquer'].initial_moisture_content = 0.35
        self.materials['raw_lacquer'].equilibrium_moisture = 0.05
        self.materials['raw_lacquer'].thickness = 0.001
        self.materials['raw_lacquer'].activation_energy = 35000.0
        self.materials['raw_lacquer'].pre_exponential_factor = 0.001

        self.materials['cinnabar_lacquer'] = LacquerMaterial('cinnabar_lacquer')
        self.materials['cinnabar_lacquer'].density = 1200.0
        self.materials['cinnabar_lacquer'].specific_heat = 1800.0
        self.materials['cinnabar_lacquer'].thermal_conductivity = 0.2
        self.materials['cinnabar_lacquer'].diffusion_coefficient = 8e-10
        self.materials['cinnabar_lacquer'].initial_moisture_content = 0.30
        self.materials['cinnabar_lacquer'].equilibrium_moisture = 0.04
        self.materials['cinnabar_lacquer'].thickness = 0.001
        self.materials['cinnabar_lacquer'].activation_energy = 38000.0
        self.materials['cinnabar_lacquer'].pre_exponential_factor = 0.0008

        self.materials['black_lacquer'] = LacquerMaterial('black_lacquer')
        self.materials['black_lacquer'].density = 1100.0
        self.materials['black_lacquer'].specific_heat = 1900.0
        self.materials['black_lacquer'].thermal_conductivity = 0.18
        self.materials['black_lacquer'].diffusion_coefficient = 9e-10
        self.materials['black_lacquer'].initial_moisture_content = 0.32
        self.materials['black_lacquer'].equilibrium_moisture = 0.045
        self.materials['black_lacquer'].thickness = 0.001
        self.materials['black_lacquer'].activation_energy = 36000.0
        self.materials['black_lacquer'].pre_exponential_factor = 0.0009

    def get_material(self, material_name: str) -> Optional[LacquerMaterial]:
        return self.materials.get(material_name)

    def add_material(self, material: LacquerMaterial):
        self.materials[material.name] = material

    def load_material_from_json(self, file_path: str) -> Optional[LacquerMaterial]:
        try:
            if not os.path.exists(file_path):
                print(f"文件不存在: {file_path}")
                return None

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if not isinstance(data, dict):
                print(f"JSON 格式错误: 期望对象，得到 {type(data)}")
                return None

            name = data.get('name', 'unknown')
            if not isinstance(name, str) or not name.strip():
                name = 'unknown_material'

            material = LacquerMaterial(name)
            material.from_dict(data)

            required_fields = ['density', 'specific_heat', 'thermal_conductivity',
                              'thickness', 'initial_moisture_content', 'equilibrium_moisture']
            missing_fields = []
            for field in required_fields:
                value = getattr(material, field, 0.0)
                if value == 0.0:
                    missing_fields.append(field)

            if missing_fields:
                print(f"警告: 以下参数可能缺失或为零: {', '.join(missing_fields)}")

            self.materials[material.name] = material
            print(f"成功加载漆料参数: {material.name}")
            return material

        except json.JSONDecodeError as e:
            print(f"JSON 解析错误: {e}")
            return None
        except Exception as e:
            print(f"加载原料参数失败: {e}")
            import traceback
            traceback.print_exc()
            return None

    def save_material_to_json(self, material_name: str, file_path: str) -> bool:
        material = self.get_material(material_name)
        if not material:
            print(f"漆料不存在: {material_name}")
            return False

        try:
            directory = os.path.dirname(file_path)
            if directory and not os.path.exists(directory):
                os.makedirs(directory)

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(material.to_dict(), f, indent=4, ensure_ascii=False)
            print(f"成功保存漆料参数到: {file_path}")
            return True
        except Exception as e:
            print(f"保存漆料参数失败: {e}")
            return False

    def get_available_materials(self) -> list:
        return list(self.materials.keys())

    def calculate_diffusion_coefficient(self, material_name: str, temperature: float) -> float:
        material = self.get_material(material_name)
        if material:
            R = 8.314
            D0 = material.pre_exponential_factor
            Ea = material.activation_energy
            T = temperature + 273.15
            return D0 * np.exp(-Ea / (R * T))
        return 0.0

