import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
from .config import get_settings
from . import models

settings = get_settings()


class ThirdPartyFieldMapping(BaseModel):
    test_id: List[str] = Field(default=["test_id", "id", "sample_id"])
    test_date: List[str] = Field(default=["test_date", "date", "testing_date", "timestamp"])
    test_laboratory: List[str] = Field(default=["laboratory", "test_lab", "facility", "lab_name"])
    wood_species: List[str] = Field(default=["wood_species", "species", "wood_type", "material"])
    density: List[str] = Field(default=["density", "rho", "bulk_density"])
    elastic_modulus: List[str] = Field(default=["elastic_modulus", "modulus_of_elasticity", "MOE", "E"])
    shear_modulus: List[str] = Field(default=["shear_modulus", "modulus_of_rupture", "G", "shear_G"])
    tensile_strength: List[str] = Field(default=["tensile_strength", "tensile", "strength_tension", "sigma_t"])
    compressive_strength: List[str] = Field(default=["compressive_strength", "compression", "strength_compression", "sigma_c"])
    bending_strength: List[str] = Field(default=["bending_strength", "flexural_strength", "MOR", "modulus_of_rupture"])
    hardness: List[str] = Field(default=["hardness", "janka", "janka_hardness"])
    moisture_content: List[str] = Field(default=["moisture_content", "moisture", "MC"])


class FieldValidator:

    RANGE_CHECKS = {
        "density": (200.0, 1200.0, "kg/m³"),
        "elastic_modulus": (5000.0, 25000.0, "MPa"),
        "shear_modulus": (300.0, 2000.0, "MPa"),
        "tensile_strength": (30.0, 200.0, "MPa"),
        "compressive_strength": (20.0, 100.0, "MPa"),
        "bending_strength": (40.0, 150.0, "MPa"),
        "hardness": (1000.0, 8000.0, "N"),
        "moisture_content": (6.0, 20.0, "%")
    }

    @classmethod
    def validate_numeric_range(
        cls,
        field_name: str,
        value: float
    ) -> tuple[bool, Optional[str]]:
        if field_name not in cls.RANGE_CHECKS:
            return True, None

        min_val, max_val, unit = cls.RANGE_CHECKS[field_name]
        if value is None:
            return False, f"{field_name} value is None"
        if value < min_val or value > max_val:
            return False, (
                f"{field_name} value {value} {unit} is outside valid range "
                f"[{min_val}, {max_val}]"
            )
        return True, None

    @classmethod
    def validate_all_fields(
        cls,
        data: Dict[str, Any]
    ) -> tuple[bool, List[str]]:
        errors = []
        for field_name in cls.RANGE_CHECKS.keys():
            value = data.get(field_name)
            if value is not None:
                valid, error = cls.validate_numeric_range(field_name, value)
                if not valid and error:
                    errors.append(error)
        return len(errors) == 0, errors


class ThirdPartyDataParser:

    MAPPING = ThirdPartyFieldMapping()

    @classmethod
    def find_field_value(
        cls,
        raw_data: Dict[str, Any],
        field_candidates: List[str]
    ) -> Optional[Any]:
        for candidate in field_candidates:
            if candidate in raw_data:
                return raw_data[candidate]

            for key in raw_data.keys():
                if candidate.lower() in key.lower():
                    return raw_data[key]

            if "." in candidate:
                parts = candidate.split(".")
                current = raw_data
                for part in parts:
                    if isinstance(current, dict) and part in current:
                        current = current[part]
                    else:
                        break
                else:
                    return current

        return None

    @classmethod
    def safe_float_convert(
        cls,
        value: Any,
        default: Optional[float] = None
    ) -> Optional[float]:
        if value is None:
            return default
        try:
            if isinstance(value, str):
                value = value.strip()
                if not value:
                    return default
                value = value.replace(",", "")
            return float(value)
        except (ValueError, TypeError):
            return default

    @classmethod
    def safe_datetime_convert(
        cls,
        value: Any,
        default: Optional[datetime] = None
    ) -> Optional[datetime]:
        if value is None:
            return default
        try:
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                for fmt in [
                    "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%dT%H:%M:%SZ",
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%d",
                    "%d/%m/%Y",
                    "%m/%d/%Y"
                ]:
                    try:
                        return datetime.strptime(value, fmt)
                    except ValueError:
                        continue
            return default
        except Exception:
            return default

    @classmethod
    def parse(
        cls,
        raw_data: Dict[str, Any]
    ) -> tuple[Dict[str, Any], List[str], bool]:
        parsed = {}
        warnings = []

        parsed["external_id"] = str(
            cls.find_field_value(raw_data, cls.MAPPING.test_id) or "unknown"
        )

        parsed["test_date"] = cls.safe_datetime_convert(
            cls.find_field_value(raw_data, cls.MAPPING.test_date)
        )

        parsed["test_laboratory"] = (
            cls.find_field_value(raw_data, cls.MAPPING.test_laboratory) or
            "Unknown Laboratory"
        )

        numeric_fields = [
            ("density", cls.MAPPING.density),
            ("elastic_modulus", cls.MAPPING.elastic_modulus),
            ("shear_modulus", cls.MAPPING.shear_modulus),
            ("tensile_strength", cls.MAPPING.tensile_strength),
            ("compressive_strength", cls.MAPPING.compressive_strength),
            ("bending_strength", cls.MAPPING.bending_strength),
            ("hardness", cls.MAPPING.hardness),
            ("moisture_content", cls.MAPPING.moisture_content)
        ]

        for field_name, candidates in numeric_fields:
            value = cls.safe_float_convert(
                cls.find_field_value(raw_data, candidates)
            )
            if value is None:
                warnings.append(f"Could not extract valid {field_name}")
            parsed[field_name] = value

        is_valid, validation_errors = FieldValidator.validate_all_fields(parsed)
        warnings.extend(validation_errors)

        parsed["raw_data"] = raw_data

        return parsed, warnings, is_valid


class ThirdPartyWoodTestingClient:

    def __init__(self):
        self.base_url = settings.THIRD_PARTY_API_URL
        self.api_key = settings.THIRD_PARTY_API_KEY
        self.timeout = 30.0

    async def fetch_test_data(
        self,
        external_id: str
    ) -> Optional[Dict[str, Any]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/wood-tests/{external_id}",
                    headers=headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError:
            return None

    async def search_wood_tests(
        self,
        wood_species: str = None,
        start_date: str = None,
        end_date: str = None
    ) -> Optional[Dict[str, Any]]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        params = {}
        if wood_species:
            params["species"] = wood_species
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/wood-tests",
                    headers=headers,
                    params=params
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError:
            return None


async def sync_third_party_data(
    db: Session,
    wood_type_id: int,
    external_id: str,
    use_mock_data: bool = False
) -> tuple[Optional[models.ThirdPartyTestData], List[str]]:

    if use_mock_data:
        raw_data = get_mock_test_data(external_id)
    else:
        client = ThirdPartyWoodTestingClient()
        raw_data = await client.fetch_test_data(external_id)
        if not raw_data:
            return None, ["Failed to fetch data from third-party API"]

    parsed_data, warnings, is_valid = ThirdPartyDataParser.parse(raw_data)

    if not is_valid:
        warnings.append("Data validation failed - some fields are outside expected ranges")

    existing_record = db.query(models.ThirdPartyTestData).filter(
        models.ThirdPartyTestData.external_id == external_id
    ).first()

    if existing_record:
        for key, value in parsed_data.items():
            if hasattr(existing_record, key):
                setattr(existing_record, key, value)
        existing_record.is_synced = True
        existing_record.synced_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_record)
        return existing_record, warnings
    else:
        new_record = models.ThirdPartyTestData(
            wood_type_id=wood_type_id,
            **parsed_data,
            is_synced=True,
            synced_at=datetime.utcnow()
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record, warnings


def get_mock_test_data(external_id: str) -> Dict[str, Any]:
    return {
        "test_id": external_id,
        "test_date": datetime.utcnow().isoformat(),
        "laboratory": "Wood Testing Lab - Demo",
        "wood_species": "Pinus sylvestris",
        "mechanical_properties": {
            "density": 470.0,
            "elastic_modulus": 12500.0,
            "shear_modulus": 620.0,
            "tensile_strength": 90.0,
            "compressive_strength": 45.0,
            "bending_strength": 80.0,
            "hardness": 2500.0
        },
        "test_method": "ASTM D143",
        "certification": "ISO 17025",
        "moisture_content": 12.0
    }


def apply_test_data_to_wood_type(
    db: Session,
    wood_type_id: int,
    test_data_id: int
) -> tuple[bool, List[str]]:

    wood_type = db.query(models.WoodType).filter(
        models.WoodType.id == wood_type_id
    ).first()

    if not wood_type:
        return False, ["Wood type not found"]

    test_data = db.query(models.ThirdPartyTestData).filter(
        models.ThirdPartyTestData.id == test_data_id
    ).first()

    if not test_data:
        return False, ["Test data not found"]

    warnings = []

    fields_to_update = [
        "density",
        "elastic_modulus",
        "shear_modulus",
        "tensile_strength",
        "compressive_strength",
        "bending_strength",
        "hardness"
    ]

    for field in fields_to_update:
        value = getattr(test_data, field)
        if value is not None:
            is_valid, error = FieldValidator.validate_numeric_range(field, value)
            if is_valid:
                setattr(wood_type, field, value)
            else:
                warnings.append(f"Skipped {field}: {error}")
        else:
            warnings.append(f"Skipped {field}: value is None")

    wood_type.third_party_id = test_data.external_id

    db.commit()
    db.refresh(wood_type)

    return True, warnings
