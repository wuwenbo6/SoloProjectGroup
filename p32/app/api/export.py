from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from fastapi.responses import StreamingResponse, JSONResponse
import io
import csv
import json

from app.core.database import get_traceability_db, get_batch_db, get_quality_db
from app.models.traceability import RawMaterial, ProcessingStep, TraceabilityChain
from app.models.batch import MaterialBatch, BatchEvent
from app.models.quality import QualityTest
from app.utils.security import authenticate

router = APIRouter(prefix="/export", tags=["数据导出"])


def _get_traceability_chain_data(batch_ids: List[str], trace_db: Session, batch_db: Session, quality_db: Session):
    chains_data = []

    for batch_id in batch_ids:
        chain = trace_db.query(TraceabilityChain).filter(
            TraceabilityChain.batch_id == batch_id
        ).first()

        batch = batch_db.query(MaterialBatch).filter(
            MaterialBatch.batch_id == batch_id
        ).first()

        material = None
        if batch:
            material = trace_db.query(RawMaterial).filter(
                RawMaterial.material_code == batch.material_code
            ).first()

        processing_steps = trace_db.query(ProcessingStep).filter(
            ProcessingStep.batch_id == batch_id
        ).order_by(ProcessingStep.step_order).all()

        quality_tests = quality_db.query(QualityTest).filter(
            QualityTest.batch_id == batch_id
        ).all()

        batch_events = batch_db.query(BatchEvent).filter(
            BatchEvent.batch_id == batch_id
        ).all()

        chains_data.append({
            "batch_id": batch_id,
            "trace_code": chain.trace_code if chain else None,
            "material_info": {
                "material_code": material.material_code if material else None,
                "material_name": material.name if material else None,
                "origin_province": material.origin_province if material else None,
                "origin_city": material.origin_city if material else None,
                "origin_village": material.origin_village if material else None,
                "longitude": material.longitude if material else None,
                "latitude": material.latitude if material else None,
                "harvest_date": material.harvest_date.isoformat() if material and material.harvest_date else None,
                "craft_type": material.craft_type if material else None
            } if material else None,
            "batch_info": {
                "material_name": batch.material_name if batch else None,
                "production_date": batch.production_date.isoformat() if batch and batch.production_date else None,
                "expiry_date": batch.expiry_date.isoformat() if batch and batch.expiry_date else None,
                "quantity": batch.quantity if batch else None,
                "unit": batch.unit if batch else None,
                "warehouse": batch.warehouse if batch else None,
                "grade": batch.grade if batch else None,
                "status": batch.status if batch else None
            } if batch else None,
            "processing_steps": [
                {
                    "step_order": step.step_order,
                    "step_name": step.step_name,
                    "operator": step.operator,
                    "operation_time": step.operation_time.isoformat() if step.operation_time else None,
                    "location": step.location,
                    "equipment": step.equipment,
                    "notes": step.notes
                }
                for step in processing_steps
            ],
            "quality_tests": [
                {
                    "test_code": test.test_code,
                    "overall_score": test.overall_score,
                    "grade": test.grade,
                    "test_date": test.test_date.isoformat() if test.test_date else None,
                    "status": test.status
                }
                for test in quality_tests
            ],
            "batch_events": [
                {
                    "event_type": event.event_type,
                    "event_title": event.event_title,
                    "event_description": event.event_description,
                    "operator": event.operator,
                    "event_time": event.event_time.isoformat() if event.event_time else None
                }
                for event in batch_events
            ],
            "chain_status": chain.status if chain else None,
            "current_stage": chain.current_stage if chain else None
        })

    return chains_data


@router.post("/traceability/json")
async def export_traceability_json(
    batch_ids: List[str],
    include_material: bool = Query(True, description="是否包含原料信息"),
    include_processing: bool = Query(True, description="是否包含加工步骤"),
    include_quality: bool = Query(True, description="是否包含品质检测"),
    include_events: bool = Query(True, description="是否包含批次事件"),
    trace_db: Session = Depends(get_traceability_db),
    batch_db: Session = Depends(get_batch_db),
    quality_db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    chains_data = _get_traceability_chain_data(batch_ids, trace_db, batch_db, quality_db)

    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "total_batches": len(batch_ids),
        "include_material": include_material,
        "include_processing": include_processing,
        "include_quality": include_quality,
        "include_events": include_events,
        "data": chains_data
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=traceability_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        }
    )


@router.post("/traceability/csv")
async def export_traceability_csv(
    batch_ids: List[str],
    trace_db: Session = Depends(get_traceability_db),
    batch_db: Session = Depends(get_batch_db),
    quality_db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    chains_data = _get_traceability_chain_data(batch_ids, trace_db, batch_db, quality_db)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)

    headers = [
        "批次号", "溯源码", "原料编号", "原料名称", "产地省份", "产地城市",
        "采集日期", "生产日期", "过期日期", "数量", "单位", "品质等级",
        "当前状态", "加工步骤数", "检测次数", "导出时间"
    ]
    writer.writerow(headers)

    for chain in chains_data:
        writer.writerow([
            chain["batch_id"],
            chain["trace_code"],
            chain["material_info"]["material_code"] if chain["material_info"] else "",
            chain["material_info"]["material_name"] if chain["material_info"] else "",
            chain["material_info"]["origin_province"] if chain["material_info"] else "",
            chain["material_info"]["origin_city"] if chain["material_info"] else "",
            chain["material_info"]["harvest_date"] if chain["material_info"] else "",
            chain["batch_info"]["production_date"] if chain["batch_info"] else "",
            chain["batch_info"]["expiry_date"] if chain["batch_info"] else "",
            chain["batch_info"]["quantity"] if chain["batch_info"] else "",
            chain["batch_info"]["unit"] if chain["batch_info"] else "",
            chain["batch_info"]["grade"] if chain["batch_info"] else "",
            chain["chain_status"],
            len(chain["processing_steps"]),
            len(chain["quality_tests"]),
            datetime.utcnow().isoformat()
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=traceability_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        }
    )


@router.get("/materials/json")
async def export_materials_json(
    material_code: Optional[str] = Query(None, description="按原料编号筛选"),
    category: Optional[str] = Query(None, description="按原料分类筛选"),
    craft_type: Optional[str] = Query(None, description="按工艺类型筛选"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial)

    if material_code:
        query = query.filter(RawMaterial.material_code == material_code)
    if category:
        query = query.filter(RawMaterial.category == category)
    if craft_type:
        query = query.filter(RawMaterial.craft_type == craft_type)
    if start_date:
        query = query.filter(RawMaterial.created_at >= start_date)
    if end_date:
        query = query.filter(RawMaterial.created_at <= end_date)

    materials = query.order_by(RawMaterial.created_at.desc()).all()

    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "total_count": len(materials),
        "filters": {
            "material_code": material_code,
            "category": category,
            "craft_type": craft_type
        },
        "data": [
            {
                "material_code": mat.material_code,
                "name": mat.name,
                "category": mat.category,
                "origin_province": mat.origin_province,
                "origin_city": mat.origin_city,
                "origin_village": mat.origin_village,
                "longitude": mat.longitude,
                "latitude": mat.latitude,
                "harvest_date": mat.harvest_date.isoformat() if mat.harvest_date else None,
                "collector": mat.collector,
                "craft_type": mat.craft_type,
                "description": mat.description,
                "is_active": mat.is_active,
                "created_at": mat.created_at.isoformat() if mat.created_at else None
            }
            for mat in materials
        ]
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=materials_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        }
    )


@router.get("/quality/json")
async def export_quality_json(
    batch_id: Optional[str] = Query(None, description="按批次号筛选"),
    grade: Optional[str] = Query(None, description="按品质等级筛选"),
    status: Optional[str] = Query(None, description="按检测状态筛选"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(QualityTest)

    if batch_id:
        query = query.filter(QualityTest.batch_id == batch_id)
    if grade:
        query = query.filter(QualityTest.grade == grade)
    if status:
        query = query.filter(QualityTest.status == status)
    if start_date:
        query = query.filter(QualityTest.test_date >= start_date)
    if end_date:
        query = query.filter(QualityTest.test_date <= end_date)

    tests = query.order_by(QualityTest.created_at.desc()).all()

    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "total_count": len(tests),
        "filters": {
            "batch_id": batch_id,
            "grade": grade,
            "status": status
        },
        "data": [
            {
                "test_code": test.test_code,
                "batch_id": test.batch_id,
                "overall_score": test.overall_score,
                "grade": test.grade,
                "status": test.status,
                "tester": test.tester,
                "test_date": test.test_date.isoformat() if test.test_date else None,
                "test_location": test.test_location,
                "remarks": test.remarks,
                "created_at": test.created_at.isoformat() if test.created_at else None
            }
            for test in tests
        ]
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=quality_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        }
    )


@router.get("/batches/json")
async def export_batches_json(
    material_code: Optional[str] = Query(None, description="按原料编号筛选"),
    status: Optional[str] = Query(None, description="按批次状态筛选"),
    grade: Optional[str] = Query(None, description="按品质等级筛选"),
    warning_status: Optional[str] = Query(None, description="按预警状态筛选"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
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
    if warning_status:
        query = query.filter(MaterialBatch.warning_status == warning_status)
    if start_date:
        query = query.filter(MaterialBatch.production_date >= start_date)
    if end_date:
        query = query.filter(MaterialBatch.production_date <= end_date)

    batches = query.order_by(MaterialBatch.created_at.desc()).all()

    export_data = {
        "export_time": datetime.utcnow().isoformat(),
        "total_count": len(batches),
        "filters": {
            "material_code": material_code,
            "status": status,
            "grade": grade,
            "warning_status": warning_status
        },
        "data": [
            {
                "batch_id": batch.batch_id,
                "material_code": batch.material_code,
                "material_name": batch.material_name,
                "production_date": batch.production_date.isoformat() if batch.production_date else None,
                "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
                "shelf_life_days": batch.shelf_life_days,
                "quantity": batch.quantity,
                "unit": batch.unit,
                "warehouse": batch.warehouse,
                "status": batch.status,
                "grade": batch.grade,
                "warning_status": batch.warning_status,
                "trace_code": batch.trace_code,
                "created_at": batch.created_at.isoformat() if batch.created_at else None
            }
            for batch in batches
        ]
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f"attachment; filename=batches_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        }
    )


@router.get("/statistics/summary")
async def get_export_statistics(
    trace_db: Session = Depends(get_traceability_db),
    batch_db: Session = Depends(get_batch_db),
    quality_db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    material_count = trace_db.query(RawMaterial).count()
    batch_count = batch_db.query(MaterialBatch).count()
    quality_test_count = quality_db.query(QualityTest).count()
    chain_count = trace_db.query(TraceabilityChain).count()

    categories = trace_db.query(RawMaterial.category).distinct().all()
    craft_types = trace_db.query(RawMaterial.craft_type).distinct().all()

    return {
        "exportable_data": {
            "materials": material_count,
            "batches": batch_count,
            "quality_tests": quality_test_count,
            "traceability_chains": chain_count
        },
        "available_filters": {
            "categories": [cat[0] for cat in categories if cat[0]],
            "craft_types": [ct[0] for ct in craft_types if ct[0]]
        },
        "supported_formats": ["json", "csv"]
    }
