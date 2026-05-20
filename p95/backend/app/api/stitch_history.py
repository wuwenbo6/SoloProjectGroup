from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..db.database import get_db
from ..models.models import Stitch, StitchHistory, StitchStep
from ..schemas.schemas import StitchHistoryCreate, StitchHistoryResponse, StitchResponse
from ..core.security import get_current_active_user, User

router = APIRouter(prefix="/stitches/{stitch_id}/history", tags=["stitch_history"])


def create_history_record(
    db: Session,
    stitch: Stitch,
    change_note: str,
    user_id: int
):
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


@router.get("/", response_model=List[StitchHistoryResponse])
def get_stitch_history(
    stitch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this stitch's history")
    
    history = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch_id
    ).order_by(StitchHistory.version.desc()).all()
    
    return history


@router.get("/{version}", response_model=StitchHistoryResponse)
def get_stitch_version(
    stitch_id: int,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this stitch's history")
    
    history = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch_id,
        StitchHistory.version == version
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return history


@router.post("/{version}/restore", response_model=StitchResponse)
def restore_stitch_version(
    stitch_id: int,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stitch")
    
    history = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch_id,
        StitchHistory.version == version
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="Version not found")
    
    create_history_record(db, stitch, f"恢复前保存 (v{version} 恢复)", current_user.id)
    
    stitch.name = history.name
    stitch.description = history.description
    stitch.category = history.category
    stitch.difficulty = history.difficulty
    stitch.image_url = history.image_url
    stitch.video_url = history.video_url
    stitch.steps_text = history.steps_text
    stitch.materials = history.materials
    stitch.tips = history.tips
    
    db.query(StitchStep).filter(StitchStep.stitch_id == stitch_id).delete()
    
    if history.steps_data:
        for step_data in history.steps_data:
            step = StitchStep(
                stitch_id=stitch_id,
                order=step_data.get("order", 1),
                title=step_data.get("title", ""),
                description=step_data.get("description", ""),
                image_url=step_data.get("image_url", ""),
                video_url=step_data.get("video_url", ""),
                tips=step_data.get("tips", "")
            )
            db.add(step)
    
    db.commit()
    db.refresh(stitch)
    
    return stitch


@router.get("/compare/{v1}/{v2}")
def compare_stitch_versions(
    stitch_id: int,
    v1: int,
    v2: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    if stitch.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this stitch's history")
    
    history1 = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch_id,
        StitchHistory.version == v1
    ).first()
    
    history2 = db.query(StitchHistory).filter(
        StitchHistory.stitch_id == stitch_id,
        StitchHistory.version == v2
    ).first()
    
    if not history1 or not history2:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    
    fields = ["name", "description", "category", "difficulty", "steps_text", "materials", "tips"]
    changes = {}
    
    for field in fields:
        val1 = getattr(history1, field)
        val2 = getattr(history2, field)
        if val1 != val2:
            changes[field] = {
                "v1": val1,
                "v2": val2
            }
    
    steps_changes = []
    steps1 = history1.steps_data or []
    steps2 = history2.steps_data or []
    
    max_steps = max(len(steps1), len(steps2))
    for i in range(max_steps):
        step1 = steps1[i] if i < len(steps1) else None
        step2 = steps2[i] if i < len(steps2) else None
        
        if step1 and step2:
            step_changes = {}
            for key in ["title", "description", "image_url", "tips"]:
                if step1.get(key) != step2.get(key):
                    step_changes[key] = {
                        "v1": step1.get(key),
                        "v2": step2.get(key)
                    }
            if step_changes:
                steps_changes.append({
                    "step": i + 1,
                    "changes": step_changes
                })
        elif step1:
            steps_changes.append({
                "step": i + 1,
                "action": "removed",
                "step_data": step1
            })
        elif step2:
            steps_changes.append({
                "step": i + 1,
                "action": "added",
                "step_data": step2
            })
    
    return {
        "version1": {
            "version": history1.version,
            "date": history1.created_at,
            "change_note": history1.change_note
        },
        "version2": {
            "version": history2.version,
            "date": history2.created_at,
            "change_note": history2.change_note
        },
        "field_changes": changes,
        "steps_changes": steps_changes
    }
