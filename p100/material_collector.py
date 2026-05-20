import json
import numpy as np
from typing import Dict, List, Optional, Union


class Material:
    def __init__(self, name: str, concentration: float, molar_mass: float,
                 absorption_coefficient: float, color: List[float]):
        self.name = name
        self.concentration = concentration
        self.molar_mass = molar_mass
        self.absorption_coefficient = absorption_coefficient
        self.color = np.array(color)

    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'concentration': self.concentration,
            'molar_mass': self.molar_mass,
            'absorption_coefficient': self.absorption_coefficient,
            'color': self.color.tolist()
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Material':
        return cls(
            name=data['name'],
            concentration=data['concentration'],
            molar_mass=data['molar_mass'],
            absorption_coefficient=data['absorption_coefficient'],
            color=data['color']
        )


class MaterialCollector:
    def __init__(self):
        self.materials: Dict[str, Material] = {}

    def add_material(self, material: Material) -> None:
        self.materials[material.name] = material

    def remove_material(self, name: str) -> None:
        if name in self.materials:
            del self.materials[name]

    def get_material(self, name: str) -> Optional[Material]:
        return self.materials.get(name)

    def get_all_materials(self) -> List[Material]:
        return list(self.materials.values())

    def update_concentration(self, name: str, new_concentration: float) -> bool:
        if name in self.materials:
            self.materials[name].concentration = new_concentration
            return True
        return False

    def calculate_total_mass(self, ratios: Dict[str, float]) -> float:
        total_mass = 0.0
        for name, ratio in ratios.items():
            if name in self.materials:
                material = self.materials[name]
                total_mass += material.concentration * ratio * material.molar_mass
        return total_mass

    def get_concentration_array(self) -> np.ndarray:
        return np.array([m.concentration for m in self.materials.values()])

    def get_absorption_array(self) -> np.ndarray:
        return np.array([m.absorption_coefficient for m in self.materials.values()])

    def get_color_matrix(self) -> np.ndarray:
        return np.array([m.color for m in self.materials.values()])

    def save_to_json(self, filepath: str) -> None:
        data = {
            'materials': [m.to_dict() for m in self.materials.values()]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def load_from_json(self, filepath: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for mat_data in data.get('materials', []):
            try:
                required_fields = ['name', 'concentration', 'molar_mass', 'absorption_coefficient', 'color']
                for field in required_fields:
                    if field not in mat_data:
                        raise ValueError(f"缺少必填字段: {field}")
                
                mat_data['concentration'] = max(0.0, float(mat_data['concentration']))
                mat_data['molar_mass'] = max(0.001, float(mat_data['molar_mass']))
                mat_data['absorption_coefficient'] = max(0.0, float(mat_data['absorption_coefficient']))
                
                if isinstance(mat_data['color'], str):
                    mat_data['color'] = json.loads(mat_data['color'])
                mat_data['color'] = [max(0.0, min(1.0, float(c))) for c in mat_data['color']]
                if len(mat_data['color']) != 3:
                    raise ValueError(f"颜色必须是RGB三通道，当前为{len(mat_data['color'])}个通道")
                
                self.add_material(Material.from_dict(mat_data))
            except Exception as e:
                print(f"警告：跳过无效的原料数据: {e}")

    def import_from_csv(self, filepath: str) -> None:
        try:
            import pandas as pd
            df = pd.read_csv(filepath)
            
            required_columns = ['name', 'concentration', 'molar_mass', 'absorption_coefficient', 'r', 'g', 'b']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"CSV缺少必要的列: {missing_columns}")
            
            for _, row in df.iterrows():
                try:
                    material = Material(
                        name=str(row['name']),
                        concentration=max(0.0, float(row['concentration'])),
                        molar_mass=max(0.001, float(row['molar_mass'])),
                        absorption_coefficient=max(0.0, float(row['absorption_coefficient'])),
                        color=[
                            max(0.0, min(1.0, float(row['r']))),
                            max(0.0, min(1.0, float(row['g']))),
                            max(0.0, min(1.0, float(row['b'])))
                        ]
                    )
                    self.add_material(material)
                except Exception as e:
                    print(f"警告：跳过行 {_}: {e}")
        except ImportError:
            raise ImportError("pandas is required for CSV import")

    def validate_materials(self) -> List[str]:
        errors = []
        for name, material in self.materials.items():
            if material.concentration < 0:
                errors.append(f"{name}: 浓度不能为负值")
            if material.molar_mass <= 0:
                errors.append(f"{name}: 摩尔质量必须为正数")
            if material.absorption_coefficient < 0:
                errors.append(f"{name}: 吸光系数不能为负值")
            if len(material.color) != 3:
                errors.append(f"{name}: 颜色必须是RGB三通道")
        return errors
