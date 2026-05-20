from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.circuit import Circuit as CircuitModel
from app.schemas.circuit import Circuit, CircuitCreate, CircuitUpdate

router = APIRouter(prefix="/circuits", tags=["circuits"])


@router.post("/", response_model=Circuit)
def create_circuit(circuit: CircuitCreate, db: Session = Depends(get_db)):
    db_circuit = CircuitModel(
        name=circuit.name,
        num_qubits=circuit.num_qubits,
        gates=[g.model_dump() for g in circuit.gates]
    )
    db.add(db_circuit)
    db.commit()
    db.refresh(db_circuit)
    return db_circuit


@router.get("/", response_model=List[Circuit])
def get_circuits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    circuits = db.query(CircuitModel).offset(skip).limit(limit).all()
    return circuits


@router.get("/{circuit_id}", response_model=Circuit)
def get_circuit(circuit_id: str, db: Session = Depends(get_db)):
    circuit = db.query(CircuitModel).filter(CircuitModel.id == circuit_id).first()
    if circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    return circuit


@router.put("/{circuit_id}", response_model=Circuit)
def update_circuit(circuit_id: str, circuit_update: CircuitUpdate, db: Session = Depends(get_db)):
    circuit = db.query(CircuitModel).filter(CircuitModel.id == circuit_id).first()
    if circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    
    if circuit_update.name is not None:
        circuit.name = circuit_update.name
    if circuit_update.gates is not None:
        circuit.gates = [g.model_dump() for g in circuit_update.gates]
    
    db.commit()
    db.refresh(circuit)
    return circuit


@router.delete("/{circuit_id}")
def delete_circuit(circuit_id: str, db: Session = Depends(get_db)):
    circuit = db.query(CircuitModel).filter(CircuitModel.id == circuit_id).first()
    if circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    db.delete(circuit)
    db.commit()
    return {"message": "Circuit deleted successfully"}
