from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import time

from app.core.database import get_db
from app.models.job import Job as JobModel
from app.schemas.job import Job, JobCreate, JobStatus
from quantum.simulator import QuantumSimulator, simulate_circuit
from quantum.noise import NoiseModel, export_to_qasm

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=Job)
def create_job(
    job_create: JobCreate,
    noise_params: Optional[dict] = Body(None),
    db: Session = Depends(get_db),
):
    job_id = str(uuid.uuid4())
    db_job = JobModel(
        id=job_id,
        status="running",
        shots=job_create.shots,
    )
    db.add(db_job)
    db.commit()

    try:
        start_time = time.time()
        gates_dict = [g.model_dump() for g in job_create.gates]

        noise_model = None
        if noise_params:
            noise_model = NoiseModel(
                depolarizing_rate=noise_params.get("depolarizing_rate", 0.0),
                amplitude_damping=noise_params.get("amplitude_damping", 0.0),
                readout_error=noise_params.get("readout_error", 0.0),
            )

        result = simulate_circuit(
            num_qubits=job_create.num_qubits,
            gates=gates_dict,
            shots=job_create.shots,
            noise_model=noise_model,
        )

        db_job.status = "completed"
        db_job.probabilities = result["probabilities"]
        db_job.measurements = result["measurements"]
        db_job.bloch_spheres = result["bloch_spheres"]
        db_job.execution_time = result["execution_time"]

        if job_create.num_qubits <= 20:
            statevector = QuantumSimulator(job_create.num_qubits).get_statevector()
            db_job.state_vector = [str(c) for c in statevector]

        db.commit()
        db.refresh(db_job)

    except Exception as e:
        db_job.status = "failed"
        db_job.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))

    return db_job


@router.get("/", response_model=List[JobStatus])
def get_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    jobs = db.query(JobModel).offset(skip).limit(limit).all()
    return jobs


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/status", response_model=JobStatus)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully"}


@router.post("/export/qasm", response_class=PlainTextResponse)
def export_qasm(
    num_qubits: int,
    gates: List[dict],
    name: str = "quantum_circuit",
):
    qasm_content = export_to_qasm(num_qubits, gates, name)
    return qasm_content
