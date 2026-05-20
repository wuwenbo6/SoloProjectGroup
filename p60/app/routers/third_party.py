from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_active_user, require_role
from .. import models, schemas
from ..third_party_integration import (
    sync_third_party_data,
    apply_test_data_to_wood_type as apply_data
)

router = APIRouter(prefix="/third-party", tags=["Third Party Integration"])


@router.post("/sync")
async def sync_test_data(
    request: schemas.ThirdPartyTestDataSyncRequest,
    use_mock_data: bool = Query(False, description="Use mock data for testing"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    wood_type = db.query(models.WoodType).filter(
        models.WoodType.id == request.wood_type_id
    ).first()

    if not wood_type:
        raise HTTPException(status_code=404, detail="Wood type not found")

    synced_record, warnings = await sync_third_party_data(
        db=db,
        wood_type_id=request.wood_type_id,
        external_id=request.external_id,
        use_mock_data=use_mock_data
    )

    if not synced_record:
        raise HTTPException(
            status_code=503,
            detail="Failed to sync data from third-party API. Try using mock data for testing."
        )

    return {
        "message": "Data synced successfully",
        "data": synced_record,
        "warnings": warnings
    }


@router.get("/test-data", response_model=List[schemas.ThirdPartyTestDataResponse])
def list_test_data(
    wood_type_id: Optional[int] = None,
    is_synced: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.ThirdPartyTestData)

    if wood_type_id:
        query = query.filter(models.ThirdPartyTestData.wood_type_id == wood_type_id)
    if is_synced is not None:
        query = query.filter(models.ThirdPartyTestData.is_synced == is_synced)

    test_data = query.order_by(models.ThirdPartyTestData.created_at.desc()).offset(skip).limit(limit).all()
    return test_data


@router.get("/test-data/{test_id}", response_model=schemas.ThirdPartyTestDataResponse)
def get_test_data(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    test_data = db.query(models.ThirdPartyTestData).filter(
        models.ThirdPartyTestData.id == test_id
    ).first()

    if not test_data:
        raise HTTPException(status_code=404, detail="Test data not found")

    return test_data


@router.delete("/test-data/{test_id}")
def delete_test_data(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin"))
):
    test_data = db.query(models.ThirdPartyTestData).filter(
        models.ThirdPartyTestData.id == test_id
    ).first()

    if not test_data:
        raise HTTPException(status_code=404, detail="Test data not found")

    db.delete(test_data)
    db.commit()
    return {"message": "Test data deleted successfully"}


@router.post("/apply-to-wood-type/{wood_type_id}")
def apply_test_data_to_wood_type(
    wood_type_id: int,
    test_data_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    success, warnings = apply_data(db, wood_type_id, test_data_id)

    if not success and warnings:
        raise HTTPException(
            status_code=400,
            detail=warnings[0] if warnings else "Failed to apply test data"
        )

    wood_type = db.query(models.WoodType).filter(
        models.WoodType.id == wood_type_id
    ).first()

    return {
        "message": "Wood type properties updated with third-party test data",
        "wood_type": wood_type,
        "warnings": warnings
    }
