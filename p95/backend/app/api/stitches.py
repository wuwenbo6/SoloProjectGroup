from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..db.database import get_db
from ..models.models import Stitch, User, StitchStep, StitchHistory
from ..schemas.schemas import StitchCreate, StitchUpdate, StitchResponse
from ..core.security import get_current_active_user

router = APIRouter(prefix="/stitches", tags=["stitches"])


def create_history_record(db: Session, stitch: Stitch, change_note: str, user_id: int):
    last_history = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch.id
    ).order_by(StitchHistory.version.desc()).first()
    
    next_version = last_history.version + 1 if last_history else 1
    
    steps_data = []
    for step in stitch.steps:
        steps_data.append({
            "order": step.order,
            "title": step.title,
            "description": step.description,
            "image_url": step.image_url,
            "video_url": step.video_url,
            "tips": step.tips
        })
    
    history = StitchHistory(
        stitch_id=stitch.id,
        version=next_version,
        name=stitch.name,
        description=stitch.description,
        category=stitch.category,
        difficulty=stitch.difficulty,
        image_url=stitch.image_url,
        video_url=stitch.video_url,
        steps_text=stitch.steps_text,
        materials=stitch.materials,
        tips=stitch.tips,
        steps_data=steps_data,
        change_note=change_note,
        changed_by_id=user_id
    )
    
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


@router.get("/", response_model=List[StitchResponse])
def get_stitches(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Stitch).filter(Stitch.is_public == True)
    
    if category:
        query = query.filter(Stitch.category == category)
    if difficulty:
        query = query.filter(Stitch.difficulty == difficulty)
    if search:
        query = query.filter(Stitch.name.contains(search))
    
    stitches = query.order_by(Stitch.created_at.desc()).offset(skip).limit(limit).all()
    return stitches


@router.get("/my", response_model=List[StitchResponse])
def get_my_stitches(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    stitches = db.query(Stitch).filter(
        Stitch.owner_id == current_user.id
    ).order_by(Stitch.created_at.desc()).offset(skip).limit(limit).all()
    return stitches


@router.get("/{stitch_id}", response_model=StitchResponse)
def get_stitch(stitch_id: int, db: Session = Depends(get_db)):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    stitch.view_count += 1
    db.commit()
    return stitch


@router.post("/", response_model=StitchResponse, status_code=status.HTTP_201_CREATED)
def create_stitch(
    stitch: StitchCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    stitch_data = stitch.dict()
    steps = stitch_data.pop('steps', [])
    
    for key, value in stitch_data.items():
        if isinstance(value, str) and not value:
            stitch_data[key] = ""
    
    db_stitch = Stitch(
        **stitch_data,
        owner_id=current_user.id
    )
    db.add(db_stitch)
    db.commit()
    db.refresh(db_stitch)
    
    for idx, step_data in enumerate(steps):
        step_data_dict = step_data.dict() if hasattr(step_data, 'dict') else step_data
        db_step = StitchStep(
            **step_data_dict,
            stitch_id=db_stitch.id,
            order=step_data_dict.get('order', idx + 1)
        )
        db.add(db_step)
    
    db.commit()
    db.refresh(db_stitch)
    
    create_history_record(db, db_stitch, "创建针法", current_user.id)
    
    return db_stitch


@router.put("/{stitch_id}", response_model=StitchResponse)
def update_stitch(
    stitch_id: int,
    stitch_update: StitchUpdate,
    change_note: str = Body("", description="修改说明"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_stitch = db.query(Stitch).options(joinedload(Stitch.steps)).filter(Stitch.id == stitch_id).first()
    if not db_stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if db_stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this stitch")
    
    update_data = stitch_update.dict(exclude_unset=True)
    steps = update_data.pop('steps', None)
    
    for key, value in update_data.items():
        if isinstance(value, str) and value is None:
            update_data[key] = ""
    
    for key, value in update_data.items():
        setattr(db_stitch, key, value)
    
    if steps is not None:
        db.query(StitchStep).filter(StitchStep.stitch_id == stitch_id).delete()
        for idx, step_data in enumerate(steps):
            step_data_dict = step_data.dict() if hasattr(step_data, 'dict') else step_data
            db_step = StitchStep(
                **step_data_dict,
                stitch_id=stitch_id,
                order=step_data_dict.get('order', idx + 1)
            )
            db.add(db_step)
    
    db.commit()
    db.refresh(db_stitch)
    
    create_history_record(db, db_stitch, change_note or "更新针法", current_user.id)
    
    return db_stitch


@router.delete("/{stitch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stitch(
    stitch_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not db_stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if db_stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this stitch")
    
    db.delete(db_stitch)
    db.commit()
    return None
