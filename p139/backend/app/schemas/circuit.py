from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime


class Gate(BaseModel):
    type: str
    target: int
    controls: Optional[List[int]] = None


class CircuitBase(BaseModel):
    name: Optional[str] = None
    num_qubits: int
    gates: List[Gate]


class CircuitCreate(CircuitBase):
    pass


class CircuitUpdate(BaseModel):
    name: Optional[str] = None
    gates: Optional[List[Gate]] = None


class Circuit(CircuitBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
