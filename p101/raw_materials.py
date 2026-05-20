import json
import numpy as np
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass
class FiberMaterial:
    key: str
    name: str
    fiber_length: float
    fiber_diameter: float
    tensile_strength: float
    water_absorption: float
    density: float
    color: str


FIBER_DATABASE = {
    "mulberry": FiberMaterial(
        key="mulberry",
        name="桑皮",
        fiber_length=2.5,
        fiber_diameter=0.02,
        tensile_strength=85.0,
        water_absorption=0.75,
        density=1.35,
        color="#8B7355"
    ),
    "bamboo": FiberMaterial(
        key="bamboo",
        name="竹纤维",
        fiber_length=1.8,
        fiber_diameter=0.015,
        tensile_strength=72.0,
        water_absorption=0.68,
        density=1.45,
        color="#7CCD7C"
    ),
    "rice_straw": FiberMaterial(
        key="rice_straw",
        name="稻草",
        fiber_length=1.2,
        fiber_diameter=0.012,
        tensile_strength=55.0,
        water_absorption=0.82,
        density=1.28,
        color="#F4A460"
    ),
    "cotton": FiberMaterial(
        key="cotton",
        name="棉纤维",
        fiber_length=3.0,
        fiber_diameter=0.025,
        tensile_strength=95.0,
        water_absorption=0.70,
        density=1.55,
        color="#FFFAF0"
    ),
    "hemp": FiberMaterial(
        key="hemp",
        name="麻纤维",
        fiber_length=2.8,
        fiber_diameter=0.022,
        tensile_strength=90.0,
        water_absorption=0.78,
        density=1.48,
        color="#D2B48C"
    )
}


class RawMaterialCollector:
    def __init__(self):
        self.custom_materials: Dict[str, FiberMaterial] = {}

    def get_material(self, name: str) -> Optional[FiberMaterial]:
        if name in FIBER_DATABASE:
            return FIBER_DATABASE[name]
        return self.custom_materials.get(name)

    def add_custom_material(self, material: FiberMaterial) -> None:
        self.custom_materials[material.key] = material

    def list_all_materials(self) -> List[str]:
        return list(FIBER_DATABASE.keys()) + list(self.custom_materials.keys())

    def load_materials_from_json(self, filepath: str) -> None:
        required_fields = ['key', 'name', 'fiber_length', 'fiber_diameter', 
                          'tensile_strength', 'water_absorption', 'density', 'color']
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                missing_fields = [field for field in required_fields if field not in item]
                if missing_fields:
                    print(f"警告: 材料数据缺失字段 {missing_fields}, 跳过该材料")
                    continue
                material = FiberMaterial(**item)
                self.custom_materials[material.key] = material

    def save_materials_to_json(self, filepath: str) -> None:
        materials_data = [asdict(m) for m in self.custom_materials.values()]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(materials_data, f, ensure_ascii=False, indent=2)

    def get_material_properties(self, material_names: List[str]) -> Dict[str, np.ndarray]:
        properties = {
            'fiber_length': [],
            'fiber_diameter': [],
            'tensile_strength': [],
            'water_absorption': [],
            'density': [],
            'color': []
        }
        
        for name in material_names:
            mat = self.get_material(name)
            if mat:
                properties['fiber_length'].append(mat.fiber_length)
                properties['fiber_diameter'].append(mat.fiber_diameter)
                properties['tensile_strength'].append(mat.tensile_strength)
                properties['water_absorption'].append(mat.water_absorption)
                properties['density'].append(mat.density)
                properties['color'].append(mat.color)
        
        for key in properties:
            if key != 'color':
                properties[key] = np.array(properties[key])
        
        return properties
