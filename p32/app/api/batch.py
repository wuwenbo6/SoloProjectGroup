from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_batch_db, get_traceability_db
from app.models.batch import MaterialBatch, BatchEvent, InventoryRecord, TraceCode
from app.models.traceability import RawMaterial
from app.schemas.batch import (
    MaterialBatchCreate, MaterialBatchUpdate, MaterialBatchResponse,
    BatchEventCreate, BatchEventResponse,
    InventoryRecordCreate, InventoryRecordResponse,
    TraceCodeCreate, ExpiryWarningResponse
)
from app.utils.trace_code import generate_trace_code
from app.utils.security import authenticate

router = APIRouter(prefix="/batch", tags=["批次管理"])


@router.post("/", response_model=MaterialBatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch: MaterialBatchCreate,
    batch_db: Session = Depends(get_batch_db),
    trace_db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    existing_batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch.batch_id).first()
    if existing_batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"批次号 {batch.batch_id} 已存在"
        )

    material = trace_db.query(RawMaterial).filter(RawMaterial.material_code == batch.material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {batch.material_code} 不存在"
        )

    db_batch = MaterialBatch(**batch.model_dump())
    batch_db.add(db_batch)
    batch_db.commit()
    batch_db.refresh(db_batch)

    event = BatchEvent(
        batch_id=batch.batch_id,
        event_type="批次创建",
        event_title="批次创建完成",
        event_description=f"批次 {batch.batch_id} 已成功创建，原料：{material.name}",
        event_time=datetime.utcnow()
    )
    batch_db.add(event)
    batch_db.commit()

    return db_batch


@router.get("/{batch_id}", response_model=MaterialBatchResponse)
def get_batch(
    batch_id: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )
    return batch


@router.get("/", response_model=List[MaterialBatchResponse])
def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    material_code: Optional[str] = None,
    status: Optional[str] = None,
    grade: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(MaterialBatch)

    if material_code:
        query = query.filter(MaterialBatch.material_code == material_code)
    if status:
        query = query.filter(MaterialBatch.status == status)
    if grade:
        query = query.filter(MaterialBatch.grade == grade)
    if is_active is not None:
        query = query.filter(MaterialBatch.is_active == is_active)

    batches = query.order_by(MaterialBatch.created_at.desc()).offset(skip).limit(limit).all()
    return batches


@router.put("/{batch_id}", response_model=MaterialBatchResponse)
def update_batch(
    batch_id: str,
    batch_update: MaterialBatchUpdate,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    update_data = batch_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)

    batch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    batch_id: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    batch.is_active = False
    batch.updated_at = datetime.utcnow()
    db.commit()
    return None


@router.post("/event/", response_model=BatchEventResponse, status_code=status.HTTP_201_CREATED)
def create_batch_event(
    event: BatchEventCreate,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == event.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {event.batch_id} 不存在"
        )

    db_event = BatchEvent(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/event/{batch_id}", response_model=List[BatchEventResponse])
def get_batch_events(
    batch_id: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    events = db.query(BatchEvent).filter(
        BatchEvent.batch_id == batch_id
    ).order_by(BatchEvent.event_time.desc()).all()
    return events


@router.post("/inventory/", response_model=InventoryRecordResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_record(
    record: InventoryRecordCreate,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == record.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {record.batch_id} 不存在"
        )

    db_record = InventoryRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    if record.record_type == "入库":
        batch.status = "已入库"
    elif record.record_type == "出库":
        batch.status = "已出库"
    db.commit()

    return db_record


@router.get("/inventory/{batch_id}", response_model=List[InventoryRecordResponse])
def get_inventory_records(
    batch_id: str,
    record_type: Optional[str] = None,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(InventoryRecord).filter(InventoryRecord.batch_id == batch_id)
    if record_type:
        query = query.filter(InventoryRecord.record_type == record_type)
    records = query.order_by(InventoryRecord.record_time.desc()).all()
    return records


@router.post("/tracecode/", status_code=status.HTTP_201_CREATED)
def generate_batch_tracecode(
    trace_code_data: TraceCodeCreate,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == trace_code_data.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {trace_code_data.batch_id} 不存在"
        )

    trace_code = generate_trace_code(trace_code_data.batch_id, trace_code_data.code_type)
    db_trace_code = TraceCode(
        trace_code=trace_code,
        batch_id=trace_code_data.batch_id,
        code_type=trace_code_data.code_type,
        generated_by=trace_code_data.generated_by,
        status="active"
    )
    db.add(db_trace_code)
    db.commit()
    db.refresh(db_trace_code)

    batch.trace_code = trace_code
    db.commit()

    event = BatchEvent(
        batch_id=trace_code_data.batch_id,
        event_type="溯源码生成",
        event_title="溯源码已生成",
        event_description=f"溯源码 {trace_code} 已成功生成",
        event_time=datetime.utcnow()
    )
    db.add(event)
    db.commit()

    return {
        "trace_code": trace_code,
        "batch_id": trace_code_data.batch_id,
        "code_type": trace_code_data.code_type
    }


@router.get("/tracecode/{batch_id}")
def get_batch_tracecodes(
    batch_id: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    trace_codes = db.query(TraceCode).filter(TraceCode.batch_id == batch_id).all()
    return trace_codes


@router.put("/{batch_id}/status")
def update_batch_status(
    batch_id: str,
    status: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    batch.status = status
    batch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(batch)

    event = BatchEvent(
        batch_id=batch_id,
        event_type="状态变更",
        event_title=f"状态变更为 {status}",
        event_description=f"批次 {batch_id} 状态已更新为 {status}",
        event_time=datetime.utcnow()
    )
    db.add(event)
    db.commit()

    return batch


@router.get("/statistics/summary")
def get_batch_statistics(
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    total_batches = db.query(MaterialBatch).count()
    active_batches = db.query(MaterialBatch).filter(MaterialBatch.is_active == True).count()

    status_counts = {}
    statuses = db.query(MaterialBatch.status).distinct().all()
    for (status,) in statuses:
        status_counts[status] = db.query(MaterialBatch).filter(MaterialBatch.status == status).count()

    grade_counts = {}
    grades = db.query(MaterialBatch.grade).filter(MaterialBatch.grade.isnot(None)).distinct().all()
    for (grade,) in grades:
        grade_counts[grade] = db.query(MaterialBatch).filter(MaterialBatch.grade == grade).count()

    return {
        "total_batches": total_batches,
        "active_batches": active_batches,
        "status_distribution": status_counts,
        "grade_distribution": grade_counts
    }


@router.get("/warnings/expiry", response_model=List[ExpiryWarningResponse])
def get_expiry_warnings(
    warning_days: int = Query(30, ge=1, description="预警天数"),
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    now = datetime.utcnow()
    warning_date = now + timedelta(days=warning_days)

    batches = db.query(MaterialBatch).filter(
        MaterialBatch.is_active == True,
        MaterialBatch.expiry_date.isnot(None)
    ).all()

    warning_batches = []
    for batch in batches:
        if batch.expiry_date:
            days_until_expiry = (batch.expiry_date - now).days

            if days_until_expiry <= 0:
                warning_level = "已过期"
                batch.warning_status = "expired"
            elif days_until_expiry <= 7:
                warning_level = "紧急预警"
                batch.warning_status = "urgent"
            elif days_until_expiry <= warning_days:
                warning_level = "即将过期"
                batch.warning_status = "warning"
            else:
                continue

            warning_batches.append({
                "batch_id": batch.batch_id,
                "material_code": batch.material_code,
                "material_name": batch.material_name,
                "production_date": batch.production_date,
                "expiry_date": batch.expiry_date,
                "days_until_expiry": days_until_expiry,
                "warning_level": warning_level,
                "quantity": batch.quantity,
                "unit": batch.unit,
                "warehouse": batch.warehouse
            })

    db.commit()
    return warning_batches


@router.get("/warnings/summary")
def get_warning_summary(
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    now = datetime.utcnow()
    warning_days = [30, 15, 7]
    summary = {
        "total_expiring": 0,
        "total_expired": 0,
        "by_days": {}
    }

    batches = db.query(MaterialBatch).filter(
        MaterialBatch.is_active == True,
        MaterialBatch.expiry_date.isnot(None)
    ).all()

    for batch in batches:
        if batch.expiry_date:
            days_until_expiry = (batch.expiry_date - now).days
            if days_until_expiry <= 0:
                summary["total_expired"] += 1
            elif days_until_expiry <= 30:
                summary["total_expiring"] += 1

    for days in warning_days:
        count = sum(
            1 for batch in batches
            if batch.expiry_date and 0 < (batch.expiry_date - now).days <= days
        )
        summary["by_days"][f"{days}天内"] = count

    warning_status_counts = {}
    statuses = db.query(MaterialBatch.warning_status).filter(
        MaterialBatch.warning_status.isnot(None)
    ).distinct().all()
    for (status,) in statuses:
        warning_status_counts[status] = db.query(MaterialBatch).filter(
            MaterialBatch.warning_status == status
        ).count()

    summary["warning_status_counts"] = warning_status_counts
    return summary


@router.post("/warnings/refresh")
def refresh_warning_status(
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    now = datetime.utcnow()
    batches = db.query(MaterialBatch).filter(
        MaterialBatch.is_active == True,
        MaterialBatch.expiry_date.isnot(None)
    ).all()

    updated_count = 0
    for batch in batches:
        if batch.expiry_date:
            days_until_expiry = (batch.expiry_date - now).days
            old_status = batch.warning_status

            if days_until_expiry <= 0:
                batch.warning_status = "expired"
            elif days_until_expiry <= 7:
                batch.warning_status = "urgent"
            elif days_until_expiry <= 30:
                batch.warning_status = "warning"
            else:
                batch.warning_status = "normal"

            if old_status != batch.warning_status:
                updated_count += 1

    db.commit()
    return {
        "message": "预警状态刷新完成",
        "updated_count": updated_count
    }
