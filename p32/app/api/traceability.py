from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_traceability_db, get_batch_db
from app.models.traceability import ProcessingStep, TraceabilityChain, RawMaterial
from app.models.batch import MaterialBatch
from app.schemas.material import ProcessingStepCreate, ProcessingStepResponse
from app.utils.security import authenticate

router = APIRouter(prefix="/traceability", tags=["溯源数据"])


@router.post("/processing/", response_model=ProcessingStepResponse, status_code=status.HTTP_201_CREATED)
def create_processing_step(
    step: ProcessingStepCreate,
    trace_db: Session = Depends(get_traceability_db),
    batch_db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == step.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {step.batch_id} 不存在"
        )

    existing_step = trace_db.query(ProcessingStep).filter(
        ProcessingStep.batch_id == step.batch_id,
        ProcessingStep.step_order == step.step_order
    ).first()

    if existing_step:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"批次 {step.batch_id} 的步骤 {step.step_order} 已存在"
        )

    db_step = ProcessingStep(**step.model_dump())
    trace_db.add(db_step)
    trace_db.commit()
    trace_db.refresh(db_step)
    return db_step


@router.get("/processing/{batch_id}", response_model=List[ProcessingStepResponse])
def get_processing_steps(
    batch_id: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    steps = db.query(ProcessingStep).filter(
        ProcessingStep.batch_id == batch_id
    ).order_by(ProcessingStep.step_order).all()
    return steps


@router.put("/processing/{step_id}", response_model=ProcessingStepResponse)
def update_processing_step(
    step_id: int,
    step_update: ProcessingStepCreate,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    step = db.query(ProcessingStep).filter(ProcessingStep.id == step_id).first()
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"加工步骤 {step_id} 不存在"
        )

    update_data = step_update.model_dump()
    for key, value in update_data.items():
        setattr(step, key, value)

    db.commit()
    db.refresh(step)
    return step


@router.delete("/processing/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_processing_step(
    step_id: int,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    step = db.query(ProcessingStep).filter(ProcessingStep.id == step_id).first()
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"加工步骤 {step_id} 不存在"
        )

    db.delete(step)
    db.commit()
    return None


@router.post("/chain/", status_code=status.HTTP_201_CREATED)
def create_traceability_chain(
    batch_id: str,
    material_code: str,
    trace_db: Session = Depends(get_traceability_db),
    batch_db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    material = trace_db.query(RawMaterial).filter(RawMaterial.material_code == material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {material_code} 不存在"
        )

    trace_code = batch.trace_code or f"TC{batch_id}{datetime.now().strftime('%Y%m%d%H%M%S')}"

    existing_chain = trace_db.query(TraceabilityChain).filter(
        TraceabilityChain.batch_id == batch_id
    ).first()

    if existing_chain:
        existing_chain.updated_at = datetime.utcnow()
        trace_db.commit()
        trace_db.refresh(existing_chain)
        return existing_chain

    db_chain = TraceabilityChain(
        trace_code=trace_code,
        batch_id=batch_id,
        material_code=material_code,
        current_stage="原料采集",
        status="in_progress"
    )
    trace_db.add(db_chain)
    trace_db.commit()
    trace_db.refresh(db_chain)
    return db_chain


@router.get("/chain/{trace_code}")
def get_traceability_chain(
    trace_code: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    chain = db.query(TraceabilityChain).filter(TraceabilityChain.trace_code == trace_code).first()
    if not chain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"溯源码 {trace_code} 不存在"
        )

    steps = db.query(ProcessingStep).filter(
        ProcessingStep.batch_id == chain.batch_id
    ).order_by(ProcessingStep.step_order).all()

    material = db.query(RawMaterial).filter(
        RawMaterial.material_code == chain.material_code
    ).first()

    return {
        "chain": chain,
        "material": material,
        "processing_steps": steps
    }


@router.get("/chain/batch/{batch_id}")
def get_chain_by_batch(
    batch_id: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    chains = db.query(TraceabilityChain).filter(TraceabilityChain.batch_id == batch_id).all()
    return chains


@router.put("/chain/{trace_code}/stage")
def update_chain_stage(
    trace_code: str,
    current_stage: str,
    status: Optional[str] = None,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    chain = db.query(TraceabilityChain).filter(TraceabilityChain.trace_code == trace_code).first()
    if not chain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"溯源码 {trace_code} 不存在"
        )

    chain.current_stage = current_stage
    if status:
        chain.status = status
    chain.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(chain)
    return chain


@router.get("/chains/", response_model=List)
def list_traceability_chains(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    material_code: Optional[str] = None,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(TraceabilityChain)

    if status:
        query = query.filter(TraceabilityChain.status == status)
    if material_code:
        query = query.filter(TraceabilityChain.material_code == material_code)

    chains = query.order_by(TraceabilityChain.created_at.desc()).offset(skip).limit(limit).all()
    return chains
