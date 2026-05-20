from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_quality_db, get_batch_db
from app.models.quality import QualityTest, QualityParameter, ColorTest, ToughnessTest, CompositionTest
from app.models.batch import MaterialBatch
from app.schemas.quality import (
    QualityTestCreate, QualityTestResponse, QualityTestCalculate,
    QualityGradeResponse, ColorTestCreate, ToughnessTestCreate, CompositionTestCreate
)
from app.utils.quality_grading import quality_engine
from app.utils.security import authenticate

router = APIRouter(prefix="/quality", tags=["品质分级"])


@router.post("/calculate", response_model=QualityGradeResponse)
def calculate_quality_grade(
    data: QualityTestCalculate,
    quality_db: Session = Depends(get_quality_db),
    batch_db: Session = Depends(get_batch_db),
    auth: dict = Depends(authenticate)
):
    batch = batch_db.query(MaterialBatch).filter(MaterialBatch.batch_id == data.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次号 {data.batch_id} 不存在"
        )

    result = quality_engine.calculate_grade(
        batch_id=data.batch_id,
        color_data=data.color_test.model_dump() if data.color_test else None,
        toughness_data=data.toughness_test.model_dump() if data.toughness_test else None,
        composition_data=data.composition_test.model_dump() if data.composition_test else None,
        custom_params=[p.model_dump() for p in data.custom_parameters] if data.custom_parameters else None
    )

    db_test = QualityTest(
        batch_id=data.batch_id,
        test_code=result["test_code"],
        overall_score=result["overall_score"],
        grade=result["grade"],
        status="completed",
        created_at=datetime.utcnow()
    )
    quality_db.add(db_test)
    quality_db.flush()

    if result["color_score"] is not None and data.color_test:
        color_test = ColorTest(
            test_id=db_test.id,
            batch_id=data.batch_id,
            **data.color_test.model_dump(),
            score=result["color_score"]
        )
        quality_db.add(color_test)

    if result["toughness_score"] is not None and data.toughness_test:
        toughness_test = ToughnessTest(
            test_id=db_test.id,
            batch_id=data.batch_id,
            **data.toughness_test.model_dump(),
            score=result["toughness_score"]
        )
        quality_db.add(toughness_test)

    if result["composition_score"] is not None and data.composition_test:
        composition_test = CompositionTest(
            test_id=db_test.id,
            batch_id=data.batch_id,
            **data.composition_test.model_dump(),
            score=result["composition_score"]
        )
        quality_db.add(composition_test)

    if result["parameter_scores"]:
        for param in result["parameter_scores"]:
            db_param = QualityParameter(
                test_id=db_test.id,
                **param
            )
            quality_db.add(db_param)

    quality_db.commit()

    batch.grade = result["grade"]
    batch_db.commit()

    return result


@router.post("/test", response_model=QualityTestResponse, status_code=status.HTTP_201_CREATED)
def create_quality_test(
    test: QualityTestCreate,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    db_test = QualityTest(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test


@router.get("/test/{test_code}", response_model=QualityTestResponse)
def get_quality_test(
    test_code: str,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    test = db.query(QualityTest).filter(QualityTest.test_code == test_code).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"检测编号 {test_code} 不存在"
        )
    return test


@router.get("/test/batch/{batch_id}", response_model=List[QualityTestResponse])
def get_batch_quality_tests(
    batch_id: str,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    tests = db.query(QualityTest).filter(QualityTest.batch_id == batch_id).order_by(QualityTest.created_at.desc()).all()
    return tests


@router.get("/tests", response_model=List[QualityTestResponse])
def list_quality_tests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    grade: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(QualityTest)

    if grade:
        query = query.filter(QualityTest.grade == grade)
    if status:
        query = query.filter(QualityTest.status == status)

    tests = query.order_by(QualityTest.created_at.desc()).offset(skip).limit(limit).all()
    return tests


@router.get("/details/{test_id}")
def get_quality_test_details(
    test_id: int,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    test = db.query(QualityTest).filter(QualityTest.id == test_id).first()
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"检测记录 {test_id} 不存在"
        )

    color_test = db.query(ColorTest).filter(ColorTest.test_id == test_id).first()
    toughness_test = db.query(ToughnessTest).filter(ToughnessTest.test_id == test_id).first()
    composition_test = db.query(CompositionTest).filter(CompositionTest.test_id == test_id).first()
    parameters = db.query(QualityParameter).filter(QualityParameter.test_id == test_id).all()

    return {
        "test": test,
        "color_test": color_test,
        "toughness_test": toughness_test,
        "composition_test": composition_test,
        "parameters": parameters
    }


@router.post("/color", status_code=status.HTTP_201_CREATED)
def create_color_test(
    test: ColorTestCreate,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    db_test = ColorTest(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test


@router.post("/toughness", status_code=status.HTTP_201_CREATED)
def create_toughness_test(
    test: ToughnessTestCreate,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    db_test = ToughnessTest(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test


@router.post("/composition", status_code=status.HTTP_201_CREATED)
def create_composition_test(
    test: CompositionTestCreate,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    db_test = CompositionTest(**test.model_dump())
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test


@router.get("/statistics")
def get_quality_statistics(
    material_code: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_quality_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(QualityTest)

    if start_date:
        query = query.filter(QualityTest.created_at >= start_date)
    if end_date:
        query = query.filter(QualityTest.created_at <= end_date)

    tests = query.all()

    if not tests:
        return {
            "total_tests": 0,
            "average_score": 0,
            "grade_distribution": {}
        }

    total_tests = len(tests)
    valid_tests = [t for t in tests if t.overall_score is not None]
    avg_score = sum(t.overall_score for t in valid_tests) / len(valid_tests) if valid_tests else 0

    grade_distribution = {}
    for test in tests:
        grade = test.grade or "未评级"
        grade_distribution[grade] = grade_distribution.get(grade, 0) + 1

    return {
        "total_tests": total_tests,
        "average_score": round(avg_score, 2),
        "grade_distribution": grade_distribution
    }
