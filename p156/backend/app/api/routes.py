from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import pandas as pd
import os
import uuid
from datetime import datetime

from backend.app.models.database import get_db, User, Company, EmissionRecord, Report
from backend.app.services.carbon_calculator import CarbonCalculator, generate_sample_data
from backend.app.services.reduction_service import ReductionService
from backend.app.services.report_service import ReportService
from backend.app.services.target_manager import TargetManager
from backend.app.services.data_quality import DataQualityScorer
from backend.app.services.benchmark_analysis import BenchmarkAnalyzer
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

UPLOAD_DIR = "./backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/auth/login")
async def login(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=email).first()
    if not user or not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    
    company = db.query(Company).filter_by(id=user.company_id).first()
    
    return {
        "token": "demo-token-" + str(uuid.uuid4()),
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "company_id": user.company_id,
            "company_name": company.name if company else "",
            "industry": company.industry if company else ""
        }
    }


@router.get("/emissions/summary")
async def get_emission_summary(company_id: str, period: Optional[str] = None, db: Session = Depends(get_db)):
    record = db.query(EmissionRecord).filter_by(
        company_id=company_id
    ).order_by(EmissionRecord.calculated_at.desc()).first()
    
    if not record:
        calculator = CarbonCalculator()
        sample_df = generate_sample_data()
        result = calculator.calculate_from_dataframe(sample_df, company_id, "2024-Q1")
        calculator.close()
        record = db.query(EmissionRecord).filter_by(id=result['record_id']).first()
    
    return {
        "id": record.id,
        "period": record.period,
        "scope1": record.scope1_total,
        "scope2": record.scope2_total,
        "scope3": record.scope3_total,
        "total": record.grand_total,
        "calculated_at": record.calculated_at
    }


@router.get("/emissions/trend")
async def get_emission_trend(company_id: str, months: int = 12):
    calculator = CarbonCalculator()
    trend_data = calculator.get_trend_data(company_id, months)
    
    if len(trend_data) < 3:
        base_months = ["2023-10", "2023-11", "2023-12", "2024-01", "2024-02", "2024-03", 
                      "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09"]
        trend_data = []
        for i, month in enumerate(base_months[:months]):
            factor = 0.9 + (i * 0.01)
            trend_data.append({
                "period": month,
                "scope1": 37500 * factor,
                "scope2": 175000 * factor,
                "scope3": 120000 * factor,
                "total": 332500 * factor
            })
    
    calculator.close()
    return trend_data


@router.get("/emissions/breakdown")
async def get_emission_breakdown(record_id: str, scope: Optional[int] = None):
    calculator = CarbonCalculator()
    breakdown = calculator.get_emission_breakdown(record_id, scope)
    calculator.close()
    return breakdown


@router.get("/emissions/hotspots")
async def get_emission_hotspots(record_id: str):
    calculator = CarbonCalculator()
    hotspots = calculator.get_hotspot_analysis(record_id)
    calculator.close()
    return hotspots


@router.post("/data/upload")
async def upload_data_file(
    company_id: str = Form(...),
    period: str = Form(...),
    file: UploadFile = File(...)
):
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        required_columns = ["category", "activity", "activity_data", "unit"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"缺少必要列: {missing_columns}")
        
        preview_data = df.head(10).to_dict('records')
        
        return {
            "file_id": str(uuid.uuid4()),
            "file_path": file_path,
            "preview": preview_data,
            "columns": df.columns.tolist(),
            "row_count": len(df)
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/data/process")
async def process_emission_data(
    company_id: str = Form(...),
    period: str = Form(...),
    file_path: str = Form(...)
):
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
        
        calculator = CarbonCalculator()
        result = calculator.calculate_from_dataframe(df, company_id, period)
        calculator.close()
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/data/generate-demo")
async def generate_demo_data(company_id: str, period: str = "2024-Q1"):
    try:
        calculator = CarbonCalculator()
        sample_df = generate_sample_data()
        result = calculator.calculate_from_dataframe(sample_df, company_id, period)
        calculator.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reduction/suggestions")
async def get_reduction_suggestions(company_id: str, industry: Optional[str] = None):
    service = ReductionService()
    suggestions = service.get_suggestions(company_id, industry)
    service.close()
    return suggestions


@router.get("/reduction/benchmark")
async def get_industry_benchmark(company_id: str, industry: str):
    service = ReductionService()
    comparison = service.compare_with_benchmark(company_id, industry)
    service.close()
    return comparison


@router.post("/reports/generate")
async def generate_report(
    company_id: str = Form(...),
    title: str = Form(...),
    period_start: str = Form(...),
    period_end: str = Form(...),
    db: Session = Depends(get_db)
):
    report_id = str(uuid.uuid4())
    report = Report(
        id=report_id,
        company_id=company_id,
        title=title,
        period_start=period_start,
        period_end=period_end,
        status="generating"
    )
    db.add(report)
    db.commit()
    
    service = ReportService()
    try:
        pdf_path = service.generate_pdf_report(company_id, period_start, period_end, report_id)
        service.close()
        return {"report_id": report_id, "status": "completed"}
    except Exception as e:
        report.status = "failed"
        db.commit()
        service.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports")
async def get_reports(company_id: str, db: Session = Depends(get_db)):
    reports = db.query(Report).filter_by(
        company_id=company_id
    ).order_by(Report.created_at.desc()).all()
    
    return [{
        "id": r.id,
        "title": r.title,
        "period_start": r.period_start,
        "period_end": r.period_end,
        "status": r.status,
        "created_at": r.created_at
    } for r in reports]


@router.get("/reports/{report_id}/download")
async def download_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter_by(id=report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="报告文件不存在")
    
    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"{report.title}.pdf"
    )


@router.get("/factors")
async def get_emission_factors(standard: Optional[str] = None):
    from backend.app.models.database import EmissionFactor
    db = next(get_db())
    query = db.query(EmissionFactor)
    if standard:
        query = query.filter_by(standard=standard)
    factors = query.all()
    return [{
        "id": f.id,
        "source_type": f.source_type,
        "activity": f.activity,
        "unit": f.unit,
        "factor_value": f.factor_value,
        "standard": f.standard,
        "year": f.year
    } for f in factors]


@router.get("/template")
async def download_template():
    template_data = {
        "category": ["燃料燃烧", "燃料燃烧", "电力消耗", "运输", "原材料"],
        "activity": ["汽油燃烧", "天然气燃烧", "外购电力", "公路货运", "钢铁生产"],
        "subcategory": ["公司车辆", "锅炉供暖", "生产用电", "原材料运输", "采购钢材"],
        "activity_data": [5000, 12000, 250000, 80000, 300],
        "unit": ["升", "立方米", "千瓦时", "吨公里", "吨"]
    }
    df = pd.DataFrame(template_data)
    
    template_path = os.path.join(UPLOAD_DIR, "emission_template.csv")
    df.to_csv(template_path, index=False, encoding='utf-8-sig')
    
    return FileResponse(
        template_path,
        media_type="text/csv",
        filename="碳排放数据导入模板.csv"
    )


@router.post("/targets")
async def create_target(
    company_id: str = Form(...),
    target_name: str = Form(...),
    target_type: str = Form(...),
    scope: str = Form(...),
    base_year: str = Form(...),
    target_year: str = Form(...),
    target_reduction_pct: float = Form(...),
    sbti_aligned: int = Form(1)
):
    try:
        manager = TargetManager()
        target_data = {
            "target_name": target_name,
            "target_type": target_type,
            "scope": scope,
            "base_year": base_year,
            "target_year": target_year,
            "target_reduction_pct": target_reduction_pct,
            "sbti_aligned": sbti_aligned
        }
        result = manager.create_sbti_target(company_id, target_data)
        manager.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/targets")
async def get_targets(company_id: str):
    manager = TargetManager()
    targets = manager.get_company_targets(company_id)
    manager.close()
    return targets


@router.get("/targets/{target_id}/tracking")
async def get_target_tracking(target_id: str):
    try:
        manager = TargetManager()
        tracking = manager.get_target_tracking(target_id)
        manager.close()
        return tracking
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/targets/{target_id}/update")
async def update_target_progress(target_id: str):
    try:
        manager = TargetManager()
        result = manager.update_target_progress(target_id)
        manager.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/targets/{target_id}")
async def delete_target(target_id: str):
    manager = TargetManager()
    success = manager.delete_target(target_id)
    manager.close()
    if not success:
        raise HTTPException(status_code=404, detail="目标不存在")
    return {"success": True}


@router.post("/quality/score")
async def calculate_quality_score(record_id: str):
    try:
        scorer = DataQualityScorer()
        result = scorer.calculate_quality_score(record_id)
        scorer.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/quality/history")
async def get_quality_history(company_id: str, limit: int = 12):
    scorer = DataQualityScorer()
    history = scorer.get_quality_history(company_id, limit)
    scorer.close()
    return history


@router.get("/benchmark/industry")
async def get_industry_comparison(company_id: str, period: Optional[str] = None):
    try:
        analyzer = BenchmarkAnalyzer()
        result = analyzer.compare_with_industry(company_id, period)
        analyzer.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/benchmark/multicompany")
async def get_multicompany_comparison(
    company_ids: List[str] = Form(...),
    period: Optional[str] = Form(None)
):
    try:
        analyzer = BenchmarkAnalyzer()
        result = analyzer.get_multicompany_comparison(company_ids, period)
        analyzer.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/benchmark/industries")
async def get_industries_list():
    analyzer = BenchmarkAnalyzer()
    industries = analyzer.get_industry_list()
    analyzer.close()
    return industries
