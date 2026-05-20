import json
import numpy as np
from typing import Dict, List, Optional, Union


class BambooSpecies:
    def __init__(self,
                 name: str,
                 youngs_modulus: float,
                 shear_modulus: float,
                 density: float,
                 tensile_strength: float,
                 poisson_ratio: float = 0.3):
        self.name = name
        self.youngs_modulus = youngs_modulus
        self.shear_modulus = shear_modulus
        self.density = density
        self.tensile_strength = tensile_strength
        self.poisson_ratio = poisson_ratio


class BambooStrip:
    def __init__(self,
                 species: BambooSpecies,
                 length: float,
                 width: float,
                 thickness: float,
                 moisture_content: float = 12.0):
        self.species = species
        self.length = length
        self.width = width
        self.thickness = thickness
        self.moisture_content = moisture_content
        self.cross_section_area = width * thickness
        self.moment_of_inertia = (width * thickness**3) / 12

    def get_axial_stiffness(self) -> float:
        return self.species.youngs_modulus * self.cross_section_area

    def get_bending_stiffness(self) -> float:
        return self.species.youngs_modulus * self.moment_of_inertia


class BambooDataCollector:
    def __init__(self):
        self.species_db: Dict[str, BambooSpecies] = {}
        self.strips: List[BambooStrip] = []
        self._init_default_species()

    def _init_default_species(self):
        self.species_db['Phyllostachys pubescens'] = BambooSpecies(
            name='Phyllostachys pubescens',
            youngs_modulus=1.2e10,
            shear_modulus=5.0e9,
            density=780.0,
            tensile_strength=120e6,
            poisson_ratio=0.3
        )
        self.species_db['Phyllostachys bambusoides'] = BambooSpecies(
            name='Phyllostachys bambusoides',
            youngs_modulus=1.5e10,
            shear_modulus=6.0e9,
            density=820.0,
            tensile_strength=150e6,
            poisson_ratio=0.28
        )

    def add_species(self, species: BambooSpecies):
        self.species_db[species.name] = species

    def create_strip(self,
                     species_name: str,
                     length: float,
                     width: float,
                     thickness: float,
                     moisture_content: float = 12.0) -> Optional[BambooStrip]:
        if species_name not in self.species_db:
            raise ValueError(f"Species {species_name} not found in database")
        
        strip = BambooStrip(
            species=self.species_db[species_name],
            length=length,
            width=width,
            thickness=thickness,
            moisture_content=moisture_content
        )
        self.strips.append(strip)
        return strip

    def import_from_json(self, filepath: str):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON 文件格式错误: {e}")
        except FileNotFoundError:
            raise ValueError(f"文件不存在: {filepath}")
        
        required_species_fields = ['name', 'youngs_modulus', 'shear_modulus', 
                                   'density', 'tensile_strength']
        
        if 'species' in data:
            for sp_data in data['species']:
                for field in required_species_fields:
                    if field not in sp_data:
                        raise ValueError(f"竹种数据缺少必需字段: {field}")
                    if field != 'name' and not isinstance(sp_data[field], (int, float)):
                        raise ValueError(f"字段 {field} 必须是数值类型")
                
                if 'poisson_ratio' not in sp_data:
                    sp_data['poisson_ratio'] = 0.3
                
                species = BambooSpecies(**sp_data)
                self.add_species(species)
        
        required_strip_fields = ['species_name', 'length', 'width', 'thickness']
        
        if 'strips' in data:
            for strip_data in data['strips']:
                for field in required_strip_fields:
                    if field not in strip_data:
                        raise ValueError(f"竹丝数据缺少必需字段: {field}")
                    if field != 'species_name' and not isinstance(strip_data[field], (int, float)):
                        raise ValueError(f"字段 {field} 必须是数值类型")
                
                if 'moisture_content' not in strip_data:
                    strip_data['moisture_content'] = 12.0
                
                if strip_data['species_name'] not in self.species_db:
                    raise ValueError(f"竹种 {strip_data['species_name']} 未定义，请先导入该竹种数据")
                
                self.create_strip(**strip_data)

    def export_to_json(self, filepath: str):
        data = {
            'species': [
                {
                    'name': sp.name,
                    'youngs_modulus': sp.youngs_modulus,
                    'shear_modulus': sp.shear_modulus,
                    'density': sp.density,
                    'tensile_strength': sp.tensile_strength,
                    'poisson_ratio': sp.poisson_ratio
                }
                for sp in self.species_db.values()
            ],
            'strips': [
                {
                    'species_name': s.species.name,
                    'length': s.length,
                    'width': s.width,
                    'thickness': s.thickness,
                    'moisture_content': s.moisture_content
                }
                for s in self.strips
            ]
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get_strip_properties(self, strip_index: int) -> Dict[str, float]:
        if strip_index >= len(self.strips):
            raise IndexError("Strip index out of range")
        
        strip = self.strips[strip_index]
        return {
            'species': strip.species.name,
            'length': strip.length,
            'width': strip.width,
            'thickness': strip.thickness,
            'cross_section_area': strip.cross_section_area,
            'axial_stiffness': strip.get_axial_stiffness(),
            'bending_stiffness': strip.get_bending_stiffness()
        }
