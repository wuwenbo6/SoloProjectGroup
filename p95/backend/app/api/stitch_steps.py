from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..db.database import get_db
from ..models.models import Stitch, StitchStep
from ..schemas.schemas import StitchStepCreate, StitchStepUpdate, StitchStepResponse
from ..core.security import get_current_active_user, User

router = APIRouter(prefix="/stitches/{stitch_id}/steps", tags=["stitch_steps"])


@router.get("/", response_model=List[StitchStepResponse])
def get_stitch_steps(
    stitch_id: int,
    db: Session = Depends(get_db)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    steps = db.query(StitchStep).filter(StitchStep.stitch_id == stitch_id).order_by(StitchStep.order).all()
    return steps


@router.get("/{step_id}", response_model=StitchStepResponse)
def get_stitch_step(
    stitch_id: int,
    step_id: int,
    db: Session = Depends(get_db)
):
    step = db.query(StitchStep).filter(
        StitchStep.id == step_id,
        StitchStep.stitch_id == stitch_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.post("/", response_model=List[StitchStepResponse], status_code=status.HTTP_201_CREATED)
def create_stitch_steps(
    stitch_id: int,
    steps: List[StitchStepCreate],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stitch")
    
    db.query(StitchStep).filter(StitchStep.stitch_id == stitch_id).delete()
    
    created_steps = []
    for idx, step_data in enumerate(steps):
        db_step = StitchStep(
            **step_data.dict(),
            stitch_id=stitch_id,
            order=step_data.order if step_data.order else idx + 1
        )
        db.add(db_step)
        created_steps.append(db_step)
    
    db.commit()
    for step in created_steps:
        db.refresh(step)
    
    return created_steps


@router.put("/{step_id}", response_model=StitchStepResponse)
def update_stitch_step(
    stitch_id: int,
    step_id: int,
    step_update: StitchStepUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stitch")
    
    db_step = db.query(StitchStep).filter(
        StitchStep.id == step_id,
        StitchStep.stitch_id == stitch_id
    ).first()
    
    if not db_step:
        raise HTTPException(status_code=404, detail="Step not found")
    
    for key, value in step_update.dict(exclude_unset=True).items():
        setattr(db_step, key, value)
    
    db.commit()
    db.refresh(db_step)
    return db_step


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stitch_step(
    stitch_id: int,
    step_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stitch")
    
    db_step = db.query(StitchStep).filter(
        StitchStep.id == step_id,
        StitchStep.stitch_id == stitch_id
    ).first()
    
    if not db_step:
        raise HTTPException(status_code=404, detail="Step not found")
    
    db.delete(db_step)
    db.commit()
    return None
