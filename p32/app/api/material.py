from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_traceability_db
from app.models.traceability import RawMaterial, OriginInfo
from app.schemas.material import (
    RawMaterialCreate, RawMaterialUpdate, RawMaterialResponse,
    OriginInfoCreate, OriginInfoResponse
)
from app.utils.security import authenticate

router = APIRouter(prefix="/material", tags=["原料信息"])


@router.post("/", response_model=RawMaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(
    material: RawMaterialCreate,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    existing_material = db.query(RawMaterial).filter(RawMaterial.material_code == material.material_code).first()
    if existing_material:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"原料编号 {material.material_code} 已存在"
        )

    db_material = RawMaterial(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@router.get("/{material_code}", response_model=RawMaterialResponse)
def get_material(
    material_code: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    material = db.query(RawMaterial).filter(RawMaterial.material_code == material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {material_code} 不存在"
        )
    return material


@router.get("/", response_model=List[RawMaterialResponse])
def list_materials(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = None,
    craft_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial)

    if category:
        query = query.filter(RawMaterial.category == category)
    if craft_type:
        query = query.filter(RawMaterial.craft_type == craft_type)
    if is_active is not None:
        query = query.filter(RawMaterial.is_active == is_active)

    materials = query.order_by(RawMaterial.created_at.desc()).offset(skip).limit(limit).all()
    return materials


@router.put("/{material_code}", response_model=RawMaterialResponse)
def update_material(
    material_code: str,
    material_update: RawMaterialUpdate,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    material = db.query(RawMaterial).filter(RawMaterial.material_code == material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {material_code} 不存在"
        )

    update_data = material_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(material, key, value)

    material.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_code: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    material = db.query(RawMaterial).filter(RawMaterial.material_code == material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {material_code} 不存在"
        )

    material.is_active = False
    material.updated_at = datetime.utcnow()
    db.commit()
    return None


@router.post("/origin/", response_model=OriginInfoResponse, status_code=status.HTTP_201_CREATED)
def create_origin_info(
    origin_info: OriginInfoCreate,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    material = db.query(RawMaterial).filter(RawMaterial.material_code == origin_info.material_code).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"原料编号 {origin_info.material_code} 不存在"
        )

    db_origin = OriginInfo(**origin_info.model_dump())
    db.add(db_origin)
    db.commit()
    db.refresh(db_origin)
    return db_origin


@router.get("/origin/{material_code}", response_model=List[OriginInfoResponse])
def get_origin_info(
    material_code: str,
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    origins = db.query(OriginInfo).filter(OriginInfo.material_code == material_code).order_by(OriginInfo.created_at.desc()).all()
    return origins
