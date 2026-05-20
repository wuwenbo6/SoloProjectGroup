from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
from database import get_db
from models import RestorationHistory, PhotoArchive

router = APIRouter(prefix="/api/restoration/history")


class RestorationHistoryCreate(BaseModel):
    photo_id: int
    operation_type: str
    params_json: Optional[str] = None
    before_image_path: Optional[str] = None
    after_image_path: Optional[str] = None
    processing_time_ms: Optional[int] = None
    operator: Optional[str] = None
    notes: Optional[str] = None


class RestorationHistoryResponse(BaseModel):
    id: int
    photo_id: int
    photo_filename: str
    operation_type: str
    params_json: Optional[str]
    before_image_path: Optional[str]
    after_image_path: Optional[str]
    processing_time_ms: Optional[int]
    created_at: datetime
    operator: Optional[str]
    notes: Optional[str]

    class Config:
        orm_mode = True


class RestorationHistoryManager:
    def __init__(self):
        pass

    def create_history(self, db: Session, data: RestorationHistoryCreate) -> RestorationHistory:
        photo = db.query(PhotoArchive).filter(PhotoArchive.id == data.photo_id).first()
        if not photo:
            raise HTTPException(status_code=404, detail="照片不存在")

        history = RestorationHistory(
            photo_id=data.photo_id,
            operation_type=data.operation_type,
            params_json=data.params_json,
            before_image_path=data.before_image_path,
            after_image_path=data.after_image_path,
            processing_time_ms=data.processing_time_ms,
            operator=data.operator,
            notes=data.notes
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        photo.has_restoration = True
        photo.restoration_params = data.params_json
        db.commit()

        return history

    def get_history_by_photo(self, db: Session, photo_id: int) -> List[RestorationHistory]:
        return db.query(RestorationHistory).filter(
            RestorationHistory.photo_id == photo_id
        ).order_by(RestorationHistory.created_at.desc()).all()

    def get_all_history(self, db: Session, skip: int = 0, limit: int = 50,
                        operation_type: Optional[str] = None) -> List[RestorationHistory]:
        query = db.query(RestorationHistory)
        if operation_type:
            query = query.filter(RestorationHistory.operation_type == operation_type)
        return query.order_by(RestorationHistory.created_at.desc()).offset(skip).limit(limit).all()

    def get_history_detail(self, db: Session, history_id: int) -> Optional[RestorationHistory]:
        return db.query(RestorationHistory).filter(RestorationHistory.id == history_id).first()

    def delete_history(self, db: Session, history_id: int) -> bool:
        history = db.query(RestorationHistory).filter(RestorationHistory.id == history_id).first()
        if history:
            photo_id = history.photo_id
            db.delete(history)
            db.commit()

            remaining = db.query(RestorationHistory).filter(RestorationHistory.photo_id == photo_id).count()
            if remaining == 0:
                photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
                if photo:
                    photo.has_restoration = False
                    db.commit()
            return True
        return False

    def compare_versions(self, db: Session, history_id1: int, history_id2: int):
        h1 = self.get_history_detail(db, history_id1)
        h2 = self.get_history_detail(db, history_id2)
        if not h1 or not h2:
            raise HTTPException(status_code=404, detail="历史记录不存在")

        params1 = json.loads(h1.params_json) if h1.params_json else {}
        params2 = json.loads(h2.params_json) if h2.params_json else {}

        differences = {}
        all_keys = set(params1.keys()) | set(params2.keys())
        for key in all_keys:
            v1 = params1.get(key)
            v2 = params2.get(key)
            if v1 != v2:
                differences[key] = {"before": v1, "after": v2}

        return {
            "version1": {
                "id": h1.id,
                "operation": h1.operation_type,
                "created_at": h1.created_at,
                "image_path": h1.after_image_path
            },
            "version2": {
                "id": h2.id,
                "operation": h2.operation_type,
                "created_at": h2.created_at,
                "image_path": h2.after_image_path
            },
            "differences": differences
        }

    def export_history(self, db: Session, history_ids: List[int]) -> dict:
        histories = db.query(RestorationHistory).filter(RestorationHistory.id.in_(history_ids)).all()
        export_data = []
        for h in histories:
            export_data.append({
                "id": h.id,
                "photo_id": h.photo_id,
                "operation_type": h.operation_type,
                "params": json.loads(h.params_json) if h.params_json else {},
                "processing_time_ms": h.processing_time_ms,
                "created_at": h.created_at.isoformat(),
                "operator": h.operator,
                "notes": h.notes
            })
        return {"export_count": len(export_data), "data": export_data}


history_manager = RestorationHistoryManager()


@router.post("/", response_model=RestorationHistoryResponse)
async def create_restoration_history(data: RestorationHistoryCreate, db: Session = Depends(get_db)):
    history = history_manager.create_history(db, data)
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == history.photo_id).first()
    return RestorationHistoryResponse(
        id=history.id,
        photo_id=history.photo_id,
        photo_filename=photo.filename if photo else "",
        operation_type=history.operation_type,
        params_json=history.params_json,
        before_image_path=history.before_image_path,
        after_image_path=history.after_image_path,
        processing_time_ms=history.processing_time_ms,
        created_at=history.created_at,
        operator=history.operator,
        notes=history.notes
    )


@router.get("/photo/{photo_id}", response_model=List[RestorationHistoryResponse])
async def get_photo_restoration_history(photo_id: int, db: Session = Depends(get_db)):
    histories = history_manager.get_history_by_photo(db, photo_id)
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    result = []
    for h in histories:
        result.append(RestorationHistoryResponse(
            id=h.id,
            photo_id=h.photo_id,
            photo_filename=photo.filename if photo else "",
            operation_type=h.operation_type,
            params_json=h.params_json,
            before_image_path=h.before_image_path,
            after_image_path=h.after_image_path,
            processing_time_ms=h.processing_time_ms,
            created_at=h.created_at,
            operator=h.operator,
            notes=h.notes
        ))
    return result


@router.get("/", response_model=List[RestorationHistoryResponse])
async def list_restoration_history(skip: int = 0, limit: int = 50,
                                   operation_type: Optional[str] = None, db: Session = Depends(get_db)):
    histories = history_manager.get_all_history(db, skip, limit, operation_type)
    photo_cache = {}
    result = []
    for h in histories:
        if h.photo_id not in photo_cache:
            photo = db.query(PhotoArchive).filter(PhotoArchive.id == h.photo_id).first()
            photo_cache[h.photo_id] = photo.filename if photo else ""
        result.append(RestorationHistoryResponse(
            id=h.id,
            photo_id=h.photo_id,
            photo_filename=photo_cache[h.photo_id],
            operation_type=h.operation_type,
            params_json=h.params_json,
            before_image_path=h.before_image_path,
            after_image_path=h.after_image_path,
            processing_time_ms=h.processing_time_ms,
            created_at=h.created_at,
            operator=h.operator,
            notes=h.notes
        ))
    return result


@router.get("/{history_id}")
async def get_restoration_history_detail(history_id: int, db: Session = Depends(get_db)):
    history = history_manager.get_history_detail(db, history_id)
    if not history:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == history.photo_id).first()
    return RestorationHistoryResponse(
        id=history.id,
        photo_id=history.photo_id,
        photo_filename=photo.filename if photo else "",
        operation_type=history.operation_type,
        params_json=history.params_json,
        before_image_path=history.before_image_path,
        after_image_path=history.after_image_path,
        processing_time_ms=history.processing_time_ms,
        created_at=history.created_at,
        operator=history.operator,
        notes=history.notes
    )


@router.delete("/{history_id}")
async def delete_restoration_history(history_id: int, db: Session = Depends(get_db)):
    success = history_manager.delete_history(db, history_id)
    if not success:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    return {"status": "success", "message": "删除成功"}


@router.get("/compare/{history_id1}/{history_id2}")
async def compare_restoration_versions(history_id1: int, history_id2: int, db: Session = Depends(get_db)):
    return history_manager.compare_versions(db, history_id1, history_id2)


@router.post("/export")
async def export_restoration_history(history_ids: List[int], db: Session = Depends(get_db)):
    return history_manager.export_history(db, history_ids)
