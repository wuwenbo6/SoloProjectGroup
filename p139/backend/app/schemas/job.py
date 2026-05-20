from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
from .circuit import Gate


class BlochCoordinates(BaseModel):
    x: float
    y: float
    z: float


class JobBase(BaseModel):
    num_qubits: int
    gates: List[Gate]
    shots: Optional[int] = 1024


class JobCreate(JobBase):
    circuit_id: Optional[str] = None


class JobUpdate(BaseModel):
    status: Optional[str] = None
    state_vector: Optional[List[complex]] = None
    probabilities: Optional[Dict[str, float]] = None
    measurements: Optional[Dict[str, int]] = None
    bloch_spheres: Optional[List[BlochCoordinates]] = None
    execution_time: Optional[float] = None
    error_message: Optional[str] = None


class Job(JobBase):
    id: str
    circuit_id: Optional[str] = None
    status: str
    state_vector: Optional[List[complex]] = None
    probabilities: Optional[Dict[str, float]] = None
    measurements: Optional[Dict[str, int]] = None
    bloch_spheres: Optional[List[BlochCoordinates]] = None
    execution_time: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobStatus(BaseModel):
    id: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
