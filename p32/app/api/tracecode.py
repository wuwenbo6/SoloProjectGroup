from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime
import logging

from app.core.database import get_batch_db, get_traceability_db, get_quality_db
from app.models.batch import TraceCode, MaterialBatch
from app.models.traceability import RawMaterial, ProcessingStep
from app.models.quality import QualityTest, ThirdPartyReport
from app.utils.trace_code import generate_trace_code
from app.utils.security import authenticate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tracecode", tags=["溯源码"])


@router.get("/verify/{trace_code}")
def verify_trace_code(
    trace_code: str,
    batch_db: Session = Depends(get_batch_db),
    trace_db: Session = Depends(get_traceability_db),
    quality_db: Session = Depends(get_quality_db)
):
    trace_code_obj = batch_db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()

    if not trace_code_obj:
        return {
            "valid": False,
            "trace_code": trace_code,
            "message": "溯源码不存在或已失效"
        }

    if trace_code_obj.status != "active":
        return {
            "valid": False,
            "trace_code": trace_code,
            "message": "溯源码已失效"
        }

    trace_code_obj.query_count += 1
    trace_code_obj.last_query_at = datetime.utcnow()
    batch_db.commit()

    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == trace_code_obj.batch_id).first()

    material = None
    if batch:
        material = trace_db.query(RawMaterial).filter(
            RawMaterial.material_code == batch.material_code
        ).first()

    processing_steps = []
    if batch:
        processing_steps = trace_db.query(ProcessingStep).filter(
            ProcessingStep.batch_id == batch.batch_id
        ).order_by(ProcessingStep.step_order).all()

    quality_tests = []
    if batch:
        quality_tests = quality_db.query(QualityTest).filter(
            QualityTest.batch_id == batch.batch_id
        ).order_by(QualityTest.created_at.desc()).all()

    third_party_reports = []
    if batch:
        third_party_reports = quality_db.query(ThirdPartyReport).filter(
            ThirdPartyReport.batch_id == batch.batch_id
        ).all()

    return {
        "valid": True,
        "trace_code": trace_code,
        "query_count": trace_code_obj.query_count,
        "last_query_at": trace_code_obj.last_query_at,
        "batch_info": {
            "batch_id": batch.batch_id if batch else None,
            "material_code": batch.material_code if batch else None,
            "material_name": batch.material_name if batch else None,
            "production_date": batch.production_date if batch else None,
            "quantity": batch.quantity if batch else None,
            "status": batch.status if batch else None,
            "grade": batch.grade if batch else None,
            "warehouse": batch.warehouse if batch else None,
        },
        "material_info": {
            "name": material.name if material else None,
            "category": material.category if material else None,
            "origin_province": material.origin_province if material else None,
            "origin_city": material.origin_city if material else None,
            "collector": material.collector if material else None,
        },
        "processing_steps": [
            {
                "step_order": step.step_order,
                "step_name": step.step_name,
                "operator": step.operator,
                "operation_time": step.operation_time,
                "location": step.location,
                "notes": step.notes
            } for step in processing_steps
        ],
        "quality_info": [
            {
                "test_code": test.test_code,
                "overall_score": test.overall_score,
                "grade": test.grade,
                "status": test.status,
                "test_date": test.test_date
            } for test in quality_tests
        ],
        "third_party_reports": [
            {
                "report_id": report.report_id,
                "agency_name": report.agency_name,
                "report_date": report.report_date,
                "certified": report.certified
            } for report in third_party_reports
        ]
    }


@router.post("/generate")
def generate_new_trace_code(
    batch_id: str,
    code_type: Optional[str] = "qrcode",
    generated_by: Optional[str] = None,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    existing_codes = db.query(TraceCode).filter(TraceCode.batch_id == batch_id).all()
    for code in existing_codes:
        if code.status == "active":
            return {
                "message": "该批次已有有效的溯源码",
                "trace_code": code.trace_code,
                "batch_id": batch_id,
                "code_type": code.code_type
            }

    max_retries = 10
    trace_code = None
    db_trace_code = None

    for attempt in range(max_retries):
        try:
            trace_code = generate_trace_code(batch_id, code_type, counter=attempt)

            existing = db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()
            if existing:
                logger.warning(f"溯源码冲突，重试第 {attempt + 1} 次")
                continue

            db_trace_code = TraceCode(
                trace_code=trace_code,
                batch_id=batch_id,
                code_type=code_type,
                generated_by=generated_by,
                status="active"
            )
            db.add(db_trace_code)
            db.flush()
            break
        except IntegrityError:
            db.rollback()
            logger.warning(f"数据库唯一约束冲突，重试第 {attempt + 1} 次")
            continue
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成溯源码失败，已重试 {max_retries} 次"
        )

    batch.trace_code = trace_code
    db.commit()
    db.refresh(db_trace_code)

    return {
        "trace_code": trace_code,
        "batch_id": batch_id,
        "code_type": code_type,
        "generated_at": db_trace_code.generated_at
    }


@router.get("/{trace_code}")
def get_trace_code_detail(
    trace_code: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    trace_code_obj = db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()
    if not trace_code_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"溯源码 {trace_code} 不存在"
        )
    return trace_code_obj


@router.put("/{trace_code}/status")
def update_trace_code_status(
    trace_code: str,
    status: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    trace_code_obj = db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()
    if not trace_code_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"溯源码 {trace_code} 不存在"
        )

    trace_code_obj.status = status
    db.commit()
    db.refresh(trace_code_obj)
    return trace_code_obj


@router.get("/batch/{batch_id}")
def get_batch_trace_codes(
    batch_id: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    trace_codes = db.query(TraceCode).filter(TraceCode.batch_id == batch_id).all()
    return {
        "batch_id": batch_id,
        "total_codes": len(trace_codes),
        "trace_codes": trace_codes
    }


@router.delete("/{trace_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trace_code(
    trace_code: str,
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    trace_code_obj = db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()
    if not trace_code_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"溯源码 {trace_code} 不存在"
        )

    db.delete(trace_code_obj)
    db.commit()
    return None


@router.get("/statistics/summary")
def get_tracecode_statistics(
    db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    total_codes = db.query(TraceCode).count()
    active_codes = db.query(TraceCode).filter(TraceCode.status == "active").count()
    used_codes = db.query(TraceCode).filter(TraceCode.is_used == True).count()

    total_queries = db.query(TraceCode.query_count).all()
    total_query_count = sum(q[0] for q in total_queries)

    code_types = db.query(TraceCode.code_type).distinct().all()

    return {
        "total_codes": total_codes,
        "active_codes": active_codes,
        "used_codes": used_codes,
        "total_query_count": total_query_count,
        "avg_query_per_code": total_query_count / total_codes if total_codes > 0 else 0,
        "code_types": [ct[0] for ct in code_types]
    }


@router.get("/scan/{trace_code}")
def get_trace_code_for_scan(
    trace_code: str,
    batch_db: Session = Depends(get_batch_db),
    trace_db: Session = Depends(get_traceability_db),
    quality_db: Session = Depends(get_quality_db)
):
    trace_code_obj = batch_db.query(TraceCode).filter(TraceCode.trace_code == trace_code).first()

    if not trace_code_obj or trace_code_obj.status != "active":
        return {
            "valid": False,
            "trace_code": trace_code,
            "message": "溯源码无效"
        }

    trace_code_obj.query_count += 1
    trace_code_obj.last_query_at = datetime.utcnow()
    batch_db.commit()

    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == trace_code_obj.batch_id).first()
    material = None
    if batch:
        material = trace_db.query(RawMaterial).filter(RawMaterial.material_code == batch.material_code).first()

    processing_steps = []
    if batch:
        processing_steps = trace_db.query(ProcessingStep).filter(ProcessingStep.batch_id == batch.batch_id).order_by(ProcessingStep.step_order).all()

    quality_test = None
    if batch:
        quality_test = quality_db.query(QualityTest).filter(QualityTest.batch_id == batch.batch_id).order_by(QualityTest.created_at.desc()).first()

    return {
        "valid": True,
        "trace_code": trace_code,
        "batch": {
            "batch_id": batch.batch_id if batch else None,
            "material_name": batch.material_name if batch else None,
            "production_date": batch.production_date if batch else None,
            "grade": batch.grade if batch else None,
        },
        "origin": {
            "province": material.origin_province if material else None,
            "city": material.origin_city if material else None,
            "collector": material.collector if material else None,
        },
        "quality": {
            "score": quality_test.overall_score if quality_test else None,
            "grade": quality_test.grade if quality_test else None,
        },
        "chain_length": len(processing_steps)
    }
