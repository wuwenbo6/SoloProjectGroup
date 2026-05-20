from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import httpx
import logging

from app.core.database import get_quality_db, get_batch_db
from app.core.config import settings
from app.models.quality import ThirdPartyReport, QualityTest
from app.models.batch import MaterialBatch
from app.schemas.quality import ThirdPartyReportCreate, ThirdPartyReportResponse
from app.utils.security import authenticate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/third-party", tags=["第三方检测"])

FIELD_MAPPING = {
    "report_no": "report_id",
    "reportNumber": "report_id",
    "batch_no": "batch_id",
    "batchNumber": "batch_id",
    "lab_name": "agency_name",
    "laboratory": "agency_name",
    "test_date": "report_date",
    "testDate": "report_date",
    "report_url": "report_url",
    "pdfUrl": "report_url",
    "pdf_content": "report_pdf",
    "pdfBase64": "report_pdf",
    "overall_result": "overall_result",
    "result": "overall_result",
    "is_certified": "certified",
    "certified": "certified"
}


def map_api_fields(api_data: Dict[str, Any]) -> Dict[str, Any]:
    mapped_data = {}
    for api_field, db_field in FIELD_MAPPING.items():
        if api_field in api_data:
            mapped_data[db_field] = api_data[api_field]

    for key in ["test_id", "report_id", "batch_id", "agency_name", "report_date",
                "report_url", "report_pdf", "overall_result", "certified"]:
        if key in api_data:
            mapped_data[key] = api_data[key]

    if "report_date" in mapped_data and isinstance(mapped_data["report_date"], str):
        try:
            mapped_data["report_date"] = datetime.fromisoformat(
                mapped_data["report_date"].replace('Z', '+00:00')
            )
        except (ValueError, TypeError):
            mapped_data["report_date"] = datetime.utcnow()

    if "certified" in mapped_data and isinstance(mapped_data["certified"], str):
        mapped_data["certified"] = mapped_data["certified"].lower() in ['true', 'yes', '1']

    return mapped_data


async def sync_report_from_api(report_id: str, agency_name: str, db: Session):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.THIRD_PARTY_API_URL}/reports/{report_id}",
                headers={"X-API-Key": settings.THIRD_PARTY_API_KEY},
                timeout=30.0
            )
            if response.status_code == 200:
                api_data = response.json()
                mapped_data = map_api_fields(api_data)
                mapped_data["synced_at"] = datetime.utcnow()

                report = db.query(ThirdPartyReport).filter(
                    ThirdPartyReport.report_id == report_id
                ).first()

                if report:
                    for key, value in mapped_data.items():
                        if hasattr(report, key) and value is not None:
                            setattr(report, key, value)
                    db.commit()
                    logger.info(f"报告 {report_id} 同步成功")
                    return True
            return False
    except Exception as e:
        logger.error(f"同步报告 {report_id} 失败: {str(e)}")
        return False


async def run_sync_task(report_id: str, agency_name: str):
    from app.core.database import QualitySessionLocal
    db = QualitySessionLocal()
    try:
        await sync_report_from_api(report_id, agency_name, db)
    finally:
        db.close()


@router.post("/report/sync/{report_id}")
async def sync_third_party_report(
    report_id: str,
    batch_id: str,
    agency_name: str,
    background_tasks: BackgroundTasks,
    quality_db: Session = Depends(get_quality_db),
    batch_db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {batch_id} 不存在"
        )

    existing_report = quality_db.query(ThirdPartyReport).filter(
        ThirdPartyReport.report_id == report_id
    ).first()

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"报告编号 {report_id} 已存在"
        )

    report = ThirdPartyReport(
        report_id=report_id,
        batch_id=batch_id,
        agency_name=agency_name,
        report_date=datetime.utcnow(),
        synced_at=datetime.utcnow(),
        certified=False
    )
    quality_db.add(report)
    quality_db.commit()
    quality_db.refresh(report)

    background_tasks.add_task(run_sync_task, report_id, agency_name)

    return {
        "message": "报告同步任务已启动",
        "report_id": report_id,
        "batch_id": batch_id,
        "agency_name": agency_name
    }


@router.post("/report", response_model=ThirdPartyReportResponse, status_code=status.HTTP_201_CREATED)
def create_third_party_report(
    report: ThirdPartyReportCreate,
    quality_db: Session = Depends(get_quality_db),
    batch_db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == report.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {report.batch_id} 不存在"
        )

    existing_report = quality_db.query(ThirdPartyReport).filter(
        ThirdPartyReport.report_id == report.report_id
    ).first()

    if existing_report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"报告编号 {report.report_id} 已存在"
        )

    db_report = ThirdPartyReport(**report.model_dump())
    quality_db.add(db_report)
    quality_db.commit()
    quality_db.refresh(db_report)

    if report.certified:
        existing_test = quality_db.query(QualityTest).filter(
            QualityTest.batch_id == report.batch_id
        ).order_by(QualityTest.created_at.desc()).first()

        if existing_test:
            existing_test.status = "certified"
            quality_db.commit()

    return db_report


@router.get("/report/{report_id}", response_model=ThirdPartyReportResponse)
def get_third_party_report(
    report_id: str,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    report = db.query(ThirdPartyReport).filter(ThirdPartyReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"报告编号 {report_id} 不存在"
        )
    return report


@router.get("/reports/batch/{batch_id}", response_model=List[ThirdPartyReportResponse])
def get_batch_reports(
    batch_id: str,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    reports = db.query(ThirdPartyReport).filter(
        ThirdPartyReport.batch_id == batch_id
    ).order_by(ThirdPartyReport.created_at.desc()).all()
    return reports


@router.get("/reports", response_model=List[ThirdPartyReportResponse])
def list_third_party_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    agency_name: Optional[str] = None,
    certified: Optional[bool] = None,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(ThirdPartyReport)

    if agency_name:
        query = query.filter(ThirdPartyReport.agency_name.like(f"%{agency_name}%"))
    if certified is not None:
        query = query.filter(ThirdPartyReport.certified == certified)

    reports = query.order_by(ThirdPartyReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports


@router.put("/report/{report_id}/certify")
def certify_report(
    report_id: str,
    certified: bool,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    report = db.query(ThirdPartyReport).filter(ThirdPartyReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"报告编号 {report_id} 不存在"
        )

    report.certified = certified
    report.synced_at = datetime.utcnow()
    db.commit()
    db.refresh(report)

    if certified:
        existing_test = db.query(QualityTest).filter(
            QualityTest.batch_id == report.batch_id
        ).order_by(QualityTest.created_at.desc()).first()

        if existing_test:
            existing_test.status = "certified"
            db.commit()

    return report


@router.delete("/report/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_third_party_report(
    report_id: str,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    report = db.query(ThirdPartyReport).filter(ThirdPartyReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"报告编号 {report_id} 不存在"
        )

    db.delete(report)
    db.commit()
    return None


@router.get("/agencies")
def get_registered_agencies(
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    agencies = db.query(ThirdPartyReport.agency_name).distinct().all()
    return {
        "agencies": [agency[0] for agency in agencies],
        "total": len(agencies)
    }


@router.get("/statistics")
def get_third_party_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(ThirdPartyReport)

    if start_date:
        query = query.filter(ThirdPartyReport.report_date >= start_date)
    if end_date:
        query = query.filter(ThirdPartyReport.report_date <= end_date)

    reports = query.all()
    total_reports = len(reports)
    certified_count = sum(1 for r in reports if r.certified)

    agency_stats = {}
    for report in reports:
        agency = report.agency_name
        if agency not in agency_stats:
            agency_stats[agency] = {"total": 0, "certified": 0}
        agency_stats[agency]["total"] += 1
        if report.certified:
            agency_stats[agency]["certified"] += 1

    return {
        "total_reports": total_reports,
        "certified_reports": certified_count,
        "certification_rate": certified_count / total_reports if total_reports > 0 else 0,
        "agency_statistics": agency_stats
    }
