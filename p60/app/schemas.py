from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class WoodTypeBase(BaseModel):
    name: str
    density: float
    elastic_modulus: float
    shear_modulus: float
    tensile_strength: float
    compressive_strength: float
    bending_strength: float
    hardness: float
    moisture_content: float = 12.0
    description: Optional[str] = None
    source: Optional[str] = None


class WoodTypeCreate(WoodTypeBase):
    third_party_id: Optional[str] = None


class WoodTypeResponse(WoodTypeBase):
    id: int
    third_party_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MortiseTenonStructureBase(BaseModel):
    name: str
    structure_type: str
    description: Optional[str] = None
    mortise_width: float
    mortise_height: float
    mortise_depth: float
    tenon_width: float
    tenon_height: float
    tenon_length: float
    fit_clearance: float = 0.1
    shoulder_length: float = 0.0
    wood_type_id: int


class MortiseTenonStructureCreate(MortiseTenonStructureBase):
    pass


class MortiseTenonStructureResponse(MortiseTenonStructureBase):
    id: int
    owner_id: int
    wood_type: Optional[WoodTypeResponse]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class StressAnalysisRequest(BaseModel):
    structure_id: int
    force_direction: str
    applied_force: float
    use_third_party_data: bool = False


class StressAnalysisResponse(BaseModel):
    id: int
    structure_id: int
    force_direction: str
    applied_force: float
    max_stress: float
    min_stress: float
    avg_stress: float
    stress_distribution: Dict[str, Any]
    safety_factor: float
    failure_probability: float
    critical_points: List[Dict[str, Any]]
    used_third_party_data: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AssemblySimulationRequest(BaseModel):
    structure_id: int
    assembly_force: float
    insertion_depth: float
    friction_coefficient: float = 0.4


class AssemblySimulationResponse(BaseModel):
    id: int
    structure_id: int
    assembly_force: float
    insertion_depth: float
    friction_coefficient: float
    contact_pressure_distribution: Dict[str, Any]
    stress_during_assembly: Dict[str, Any]
    assembly_stages: List[Dict[str, Any]]
    estimated_assembly_time: float
    difficulty_score: float
    recommendations: str
    created_at: datetime

    class Config:
        from_attributes = True


class ThirdPartyTestDataSyncRequest(BaseModel):
    wood_type_id: int
    external_id: str


class ThirdPartyTestDataResponse(BaseModel):
    id: int
    wood_type_id: int
    external_id: str
    test_date: Optional[datetime]
    test_laboratory: Optional[str]
    density: Optional[float]
    elastic_modulus: Optional[float]
    shear_modulus: Optional[float]
    tensile_strength: Optional[float]
    compressive_strength: Optional[float]
    bending_strength: Optional[float]
    is_synced: bool
    created_at: datetime
    synced_at: Optional[datetime]

    class Config:
        from_attributes = True
