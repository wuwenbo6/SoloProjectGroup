from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from ..db.database import get_db
from ..models.models import Work, User
from ..schemas.schemas import WorkCreate, WorkUpdate, WorkResponse
from ..core.security import get_current_active_user

router = APIRouter(prefix="/works", tags=["works"])


class PaginatedWorksResponse(BaseModel):
    items: List[WorkResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/", response_model=PaginatedWorksResponse)
def get_works(
    page: int = 1,
    page_size: int = 12,
    user_id: Optional[int] = None,
    stitch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    query = db.query(Work).options(
        joinedload(Work.owner),
        joinedload(Work.stitch)
    )
    
    if user_id:
        query = query.filter(Work.owner_id == user_id)
    if stitch_id:
        query = query.filter(Work.stitch_id == stitch_id)
    
    total = query.count()
    works = query.order_by(Work.created_at.desc()).offset(skip).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": works,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/my", response_model=PaginatedWorksResponse)
def get_my_works(
    page: int = 1,
    page_size: int = 12,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    query = db.query(Work).options(
        joinedload(Work.owner),
        joinedload(Work.stitch)
    ).filter(Work.owner_id == current_user.id)
    
    total = query.count()
    works = query.order_by(Work.created_at.desc()).offset(skip).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return {
        "items": works,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/{work_id}", response_model=WorkResponse)
def get_work(work_id: int, db: Session = Depends(get_db)):
    work = db.query(Work).filter(Work.id == work_id).first()
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")
    return work


@router.post("/", response_model=WorkResponse, status_code=status.HTTP_201_CREATED)
def create_work(
    work: WorkCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = Work(
        **work.dict(),
        owner_id=current_user.id
    )
    db.add(db_work)
    db.commit()
    db.refresh(db_work)
    return db_work


@router.put("/{work_id}", response_model=WorkResponse)
def update_work(
    work_id: int,
    work_update: WorkUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = db.query(Work).filter(Work.id == work_id).first()
    if not db_work:
        raise HTTPException(status_code=404, detail="Work not found")
    
    if db_work.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this work")
    
    for key, value in work_update.dict(exclude_unset=True).items():
        setattr(db_work, key, value)
    
    db.commit()
    db.refresh(db_work)
    return db_work


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work(
    work_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = db.query(Work).filter(Work.id == work_id).first()
    if not db_work:
        raise HTTPException(status_code=404, detail="Work not found")
    
    if db_work.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this work")
    
    db.delete(db_work)
    db.commit()
    return None


@router.post("/{work_id}/like", response_model=WorkResponse)
def like_work(
    work_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = db.query(Work).filter(Work.id == work_id).first()
    if not db_work:
        raise HTTPException(status_code=404, detail="Work not found")
    
    db_work.likes_count += 1
    db.commit()
    db.refresh(db_work)
    return db_work


@router.post("/{work_id}/share", response_model=WorkResponse)
def share_work(
    work_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_work = db.query(Work).filter(Work.id == work_id).first()
    if not db_work:
        raise HTTPException(status_code=404, detail="Work not found")
    
    db_work.shares_count += 1
    db.commit()
    db.refresh(db_work)
    return db_work
