import numpy as np
import json
from typing import Dict, List, Optional, Union


class Material:
    def __init__(self, name: str, material_type: str, properties: Dict):
        self.name = name
        self.material_type = material_type
        self.properties = properties

    def __repr__(self):
        return f"Material(name='{self.name}', type='{self.material_type}')"


class MaterialCollection:
    def __init__(self):
        self.materials: Dict[str, Material] = {}
        self._init_default_materials()

    def _init_default_materials(self):
        default_materials = [
            {
                "name": "松烟",
                "type": "soot",
                "properties": {
                    "carbon_content": 0.92,
                    "ash_content": 0.03,
                    "particle_size": 0.15,
                    "density": 1.8,
                    "blackness": 85,
                    "gloss": 40
                }
            },
            {
                "name": "桐油烟",
                "type": "soot",
                "properties": {
                    "carbon_content": 0.95,
                    "ash_content": 0.02,
                    "particle_size": 0.08,
                    "density": 1.9,
                    "blackness": 92,
                    "gloss": 65
                }
            },
            {
                "name": "漆烟",
                "type": "soot",
                "properties": {
                    "carbon_content": 0.97,
                    "ash_content": 0.01,
                    "particle_size": 0.05,
                    "density": 2.0,
                    "blackness": 95,
                    "gloss": 80
                }
            },
            {
                "name": "骨胶",
                "type": "binder",
                "properties": {
                    "viscosity": 500,
                    "gel_strength": 250,
                    "ph": 5.5,
                    "binding_power": 0.85,
                    "water_resistance": 0.6
                }
            },
            {
                "name": "桃胶",
                "type": "binder",
                "properties": {
                    "viscosity": 350,
                    "gel_strength": 180,
                    "ph": 5.0,
                    "binding_power": 0.75,
                    "water_resistance": 0.45
                }
            },
            {
                "name": "珍珠粉",
                "type": "additive",
                "properties": {
                    "particle_size": 2.0,
                    "hardness": 3.5,
                    "gloss_enhance": 0.15,
                    "smoothness": 0.8
                }
            },
            {
                "name": "冰片",
                "type": "additive",
                "properties": {
                    "melting_point": 208,
                    "aroma": 0.9,
                    "preservative": 0.7,
                    "diffusion": 0.85
                }
            },
            {
                "name": "朱砂",
                "type": "additive",
                "properties": {
                    "color_red": 255,
                    "opacity": 0.95,
                    "density": 8.1,
                    "permanence": 0.98
                }
            }
        ]

        for mat in default_materials:
            self.add_material(mat["name"], mat["type"], mat["properties"])

    def add_material(self, name: str, material_type: str, properties: Dict) -> None:
        self.materials[name] = Material(name, material_type, properties)

    def get_material(self, name: str) -> Optional[Material]:
        return self.materials.get(name)

    def get_materials_by_type(self, material_type: str) -> List[Material]:
        return [mat for mat in self.materials.values() if mat.material_type == material_type]

    def list_all_materials(self) -> List[str]:
        return list(self.materials.keys())

    def remove_material(self, name: str) -> bool:
        if name in self.materials:
            del self.materials[name]
            return True
        return False

    def import_from_json(self, filepath: str) -> Dict:
        result = {
            'success': False,
            'imported_count': 0,
            'failed_count': 0,
            'failed_materials': [],
            'errors': []
        }
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            if "materials" not in data:
                result['errors'].append("JSON文件中缺少'materials'字段")
                return result
                
            materials = data.get("materials", [])
            if not isinstance(materials, list):
                result['errors'].append("'materials'字段格式错误，应为列表")
                return result
                
            for idx, mat_data in enumerate(materials):
                try:
                    if not isinstance(mat_data, dict):
                        result['failed_count'] += 1
                        result['failed_materials'].append(f"第{idx+1}项：不是字典格式")
                        continue
                        
                    if "name" not in mat_data:
                        result['failed_count'] += 1
                        result['failed_materials'].append(f"第{idx+1}项：缺少'name'字段")
                        continue
                        
                    if "type" not in mat_data:
                        result['failed_count'] += 1
                        result['failed_materials'].append(f"第{idx+1}项({mat_data.get('name', '未知')})：缺少'type'字段")
                        continue
                        
                    if "properties" not in mat_data:
                        result['failed_count'] += 1
                        result['failed_materials'].append(f"第{idx+1}项({mat_data.get('name', '未知')})：缺少'properties'字段")
                        continue
                        
                    if not isinstance(mat_data["properties"], dict):
                        result['failed_count'] += 1
                        result['failed_materials'].append(f"第{idx+1}项({mat_data.get('name', '未知')})：'properties'不是字典格式")
                        continue
                        
                    self.add_material(
                        str(mat_data["name"]),
                        str(mat_data["type"]),
                        dict(mat_data["properties"])
                    )
                    result['imported_count'] += 1
                    
                except Exception as e:
                    result['failed_count'] += 1
                    result['failed_materials'].append(f"第{idx+1}项：{str(e)}")
                    
            result['success'] = True
            
        except FileNotFoundError:
            result['errors'].append(f"文件不存在: {filepath}")
        except json.JSONDecodeError as e:
            result['errors'].append(f"JSON解析错误: {str(e)}")
        except Exception as e:
            result['errors'].append(f"导入失败: {str(e)}")
            
        return result

    def export_to_json(self, filepath: str) -> None:
        data = {
            "materials": [
                {
                    "name": mat.name,
                    "type": mat.material_type,
                    "properties": mat.properties
                }
                for mat in self.materials.values()
            ]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def validate_material_compatibility(self, material_names: List[str]) -> Dict:
        result = {
            "valid": True,
            "issues": [],
            "warnings": []
        }

        has_soot = any(self.get_material(name).material_type == "soot" 
                       for name in material_names if self.get_material(name))
        has_binder = any(self.get_material(name).material_type == "binder" 
                         for name in material_names if self.get_material(name))

        if not has_soot:
            result["valid"] = False
            result["issues"].append("配方中缺少烟料（soot）")
        
        if not has_binder:
            result["valid"] = False
            result["issues"].append("配方中缺少胶料（binder）")

        return result

    def get_material_properties_array(self, material_names: List[str], 
                                      property_name: str) -> np.ndarray:
        values = []
        for name in material_names:
            mat = self.get_material(name)
            if mat and property_name in mat.properties:
                values.append(mat.properties[property_name])
            else:
                values.append(0.0)
        return np.array(values)
