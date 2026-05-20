import json
import numpy as np
from dataclasses import dataclass, asdict
from typing import Dict, Optional, List, Tuple


@dataclass
class ClayParameter:
    name: str
    clay_type: str
    moisture_content: float
    density: float
    youngs_modulus: float
    poissons_ratio: float
    yield_strength: float
    viscosity: float
    particle_size: float
    organic_content: float

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> 'ClayParameter':
        required_fields = ['name', 'clay_type', 'moisture_content', 'density',
                          'youngs_modulus', 'poissons_ratio', 'yield_strength',
                          'viscosity', 'particle_size', 'organic_content']

        processed_data = {}
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
            value = data[field]
            if isinstance(value, str):
                value = value.strip()
                if value.lower() in ['', 'null', 'none', 'nan']:
                    raise ValueError(f"Field {field} cannot be empty or null")
            processed_data[field] = value

        return cls(**processed_data)


class ParameterCollector:
    def __init__(self):
        self.clay_database: Dict[str, ClayParameter] = {}
        self._init_default_clays()

    def _init_default_clays(self):
        self.clay_database["kaolin"] = ClayParameter(
            name="高岭土",
            clay_type="kaolin",
            moisture_content=0.25,
            density=2600.0,
            youngs_modulus=5.0e6,
            poissons_ratio=0.35,
            yield_strength=50000.0,
            viscosity=1000.0,
            particle_size=2.0e-6,
            organic_content=0.02
        )
        self.clay_database["bentonite"] = ClayParameter(
            name="膨润土",
            clay_type="bentonite",
            moisture_content=0.35,
            density=2400.0,
            youngs_modulus=3.0e6,
            poissons_ratio=0.4,
            yield_strength=30000.0,
            viscosity=5000.0,
            particle_size=1.0e-6,
            organic_content=0.05
        )
        self.clay_database["red_clay"] = ClayParameter(
            name="红陶土",
            clay_type="red_clay",
            moisture_content=0.22,
            density=2700.0,
            youngs_modulus=7.0e6,
            poissons_ratio=0.32,
            yield_strength=70000.0,
            viscosity=800.0,
            particle_size=3.0e-6,
            organic_content=0.03
        )

    def add_clay_parameter(self, clay_param: ClayParameter) -> None:
        self.clay_database[clay_param.clay_type] = clay_param

    def get_clay_parameter(self, clay_type: str) -> Optional[ClayParameter]:
        return self.clay_database.get(clay_type)

    def list_available_clays(self) -> List[str]:
        return list(self.clay_database.keys())

    def load_from_json(self, filepath: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON file: {e}")

            if not isinstance(data, dict):
                raise ValueError("JSON file must contain a dictionary of clay parameters")

            for clay_name, clay_data in data.items():
                if not isinstance(clay_data, dict):
                    raise ValueError(f"Invalid data format for {clay_name}")
                try:
                    clay_param = ClayParameter.from_dict(clay_data)
                    self.add_clay_parameter(clay_param)
                except Exception as e:
                    raise ValueError(f"Error loading {clay_name}: {e}")

    def save_to_json(self, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(
                {k: v.to_dict() for k, v in self.clay_database.items()},
                f,
                ensure_ascii=False,
                indent=2
            )

    def import_from_csv(self, filepath: str) -> None:
        import csv
        required_columns = ['name', 'clay_type', 'moisture_content', 'density',
                           'youngs_modulus', 'poissons_ratio', 'yield_strength',
                           'viscosity', 'particle_size', 'organic_content']

        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            missing_cols = [col for col in required_columns if col not in reader.fieldnames]
            if missing_cols:
                raise ValueError(f"CSV missing required columns: {', '.join(missing_cols)}")

            for row_idx, row in enumerate(reader, start=2):
                try:
                    for col in required_columns:
                        if not row[col] or row[col].strip() == '':
                            raise ValueError(f"Column '{col}' is empty in row {row_idx}")

                    clay_param = ClayParameter(
                        name=row['name'].strip(),
                        clay_type=row['clay_type'].strip(),
                        moisture_content=float(row['moisture_content']),
                        density=float(row['density']),
                        youngs_modulus=float(row['youngs_modulus']),
                        poissons_ratio=float(row['poissons_ratio']),
                        yield_strength=float(row['yield_strength']),
                        viscosity=float(row['viscosity']),
                        particle_size=float(row['particle_size']),
                        organic_content=float(row['organic_content'])
                    )
                    self.add_clay_parameter(clay_param)
                except ValueError as e:
                    raise ValueError(f"Error in row {row_idx}: {e}")

    def calculate_derived_properties(self, clay_type: str) -> Dict[str, float]:
        param = self.get_clay_parameter(clay_type)
        if not param:
            raise ValueError(f"Unknown clay type: {clay_type}")

        shear_modulus = param.youngs_modulus / (2 * (1 + param.poissons_ratio))
        bulk_modulus = param.youngs_modulus / (3 * (1 - 2 * param.poissons_ratio))
        porosity = param.moisture_content / (1 + param.moisture_content)
        permeability = (param.particle_size ** 2) * (porosity ** 3) / (150 * (1 - porosity) ** 2)
        plasticity_index = 0.7 * param.moisture_content * 100

        return {
            "shear_modulus": shear_modulus,
            "bulk_modulus": bulk_modulus,
            "porosity": porosity,
            "permeability": permeability,
            "plasticity_index": plasticity_index
        }

    def validate_parameters(self, clay_type: str) -> Tuple[bool, List[str]]:
        param = self.get_clay_parameter(clay_type)
        if not param:
            return False, [f"Clay type {clay_type} not found"]

        errors = []
        if not (0 < param.moisture_content < 0.6):
            errors.append("Moisture content out of valid range (0-0.6)")
        if not (1000 < param.density < 5000):
            errors.append("Density out of valid range (1000-5000 kg/m³)")
        if not (0 < param.youngs_modulus < 1e10):
            errors.append("Young's modulus out of valid range")
        if not (0 < param.poissons_ratio < 0.5):
            errors.append("Poisson's ratio out of valid range (0-0.5)")
        if not (0 < param.yield_strength < 1e6):
            errors.append("Yield strength out of valid range")

        return len(errors) == 0, errors
