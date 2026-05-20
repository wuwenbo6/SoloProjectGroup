from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_active_user
from .. import models, schemas

router = APIRouter(prefix="/structures", tags=["Structures"])


@router.post("/wood-types", response_model=schemas.WoodTypeResponse)
def create_wood_type(
    wood_type: schemas.WoodTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_wood_type = db.query(models.WoodType).filter(
        models.WoodType.name == wood_type.name
    ).first()
    if db_wood_type:
        raise HTTPException(status_code=400, detail="Wood type already exists")
    
    db_wood_type = models.WoodType(**wood_type.model_dump())
    db.add(db_wood_type)
    db.commit()
    db.refresh(db_wood_type)
    return db_wood_type


@router.get("/wood-types", response_model=List[schemas.WoodTypeResponse])
def list_wood_types(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    wood_types = db.query(models.WoodType).offset(skip).limit(limit).all()
    return wood_types


@router.get("/wood-types/{wood_type_id}", response_model=schemas.WoodTypeResponse)
def get_wood_type(
    wood_type_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    wood_type = db.query(models.WoodType).filter(models.WoodType.id == wood_type_id).first()
    if not wood_type:
        raise HTTPException(status_code=404, detail="Wood type not found")
    return wood_type


@router.post("/mortise-tenon", response_model=schemas.MortiseTenonStructureResponse)
def create_mortise_tenon_structure(
    structure: schemas.MortiseTenonStructureCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    wood_type = db.query(models.WoodType).filter(
        models.WoodType.id == structure.wood_type_id
    ).first()
    if not wood_type:
        raise HTTPException(status_code=404, detail="Wood type not found")
    
    db_structure = models.MortiseTenonStructure(
        **structure.model_dump(),
        owner_id=current_user.id
    )
    db.add(db_structure)
    db.commit()
    db.refresh(db_structure)
    return db_structure


@router.get("/mortise-tenon", response_model=List[schemas.MortiseTenonStructureResponse])
def list_mortise_tenon_structures(
    skip: int = 0,
    limit: int = 100,
    structure_type: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.owner_id == current_user.id
    )
    if structure_type:
        query = query.filter(models.MortiseTenonStructure.structure_type == structure_type)
    structures = query.offset(skip).limit(limit).all()
    return structures


@router.get("/mortise-tenon/{structure_id}", response_model=schemas.MortiseTenonStructureResponse)
def get_mortise_tenon_structure(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    structure = db.query(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.id == structure_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")
    return structure


@router.put("/mortise-tenon/{structure_id}", response_model=schemas.MortiseTenonStructureResponse)
def update_mortise_tenon_structure(
    structure_id: int,
    structure_update: schemas.MortiseTenonStructureCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    structure = db.query(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.id == structure_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")
    
    for key, value in structure_update.model_dump().items():
        setattr(structure, key, value)
    
    db.commit()
    db.refresh(structure)
    return structure


@router.delete("/mortise-tenon/{structure_id}")
def delete_mortise_tenon_structure(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    structure = db.query(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.id == structure_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")
    
    db.delete(structure)
    db.commit()
    return {"message": "Structure deleted successfully"}
