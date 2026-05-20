from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import json
from datetime import datetime
from app.database import get_photo_db, get_repair_db
from app.models.photo import Photo
from app.models.repair import RepairRecord
from app.models.user import User
from app.schemas.photo import Photo as PhotoSchema, PhotoUpdate
from app.schemas.repair import RepairRecord as RepairSchema
from app.utils.auth import get_current_user
from app.utils.repair import repair_service

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "original"), exist_ok=True)


async def process_repair_task(
    repair_id: int,
    photo_id: int,
    original_path: str,
    repair_type: str,
    parameters: dict,
    photo_db: Session,
    repair_db: Session
):
    try:
        repair = repair_db.query(RepairRecord).filter(RepairRecord.id == repair_id).first()
        if not repair:
            return
        
        repair.status = "processing"
        repair.started_at = datetime.utcnow()
        repair.progress = 30
        repair_db.commit()
        
        repaired_path, thumbnail_path = await repair_service.repair_photo(
            original_path, repair_type, parameters
        )
        
        photo = photo_db.query(Photo).filter(Photo.id == photo_id).first()
        if photo:
            photo.repaired_path = repaired_path
            photo.thumbnail_path = thumbnail_path
            photo_db.commit()
        
        repair.status = "completed"
        repair.progress = 100
        repair.completed_at = datetime.utcnow()
        repair_db.commit()
        
    except Exception as e:
        repair.status = "failed"
        repair.error_message = str(e)
        repair_db.commit()


@router.post("/upload", response_model=PhotoSchema)
async def upload_photo(
    file: UploadFile = File(...),
    title: str = None,
    description: str = None,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    file_ext = os.path.splitext(file.filename)[1]
    new_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, "original", new_filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    photo = Photo(
        user_id=current_user.id,
        original_filename=file.filename,
        original_path=file_path,
        title=title or file.filename,
        description=description
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    
    return photo


@router.get("/", response_model=List[PhotoSchema])
def get_user_photos(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    try:
        photos = db.query(Photo).filter(Photo.user_id == current_user.id).order_by(
            Photo.created_at.desc()
        ).offset(skip).limit(limit).all()
        return photos
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch photos: {str(e)}"
        )


@router.get("/{photo_id}", response_model=PhotoSchema)
def get_photo(
    photo_id: int,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id and not photo.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    return photo


@router.put("/{photo_id}", response_model=PhotoSchema)
def update_photo(
    photo_id: int,
    photo_update: PhotoUpdate,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    for key, value in photo_update.dict(exclude_unset=True).items():
        setattr(photo, key, value)
    
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if os.path.exists(photo.original_path):
        os.remove(photo.original_path)
    if photo.repaired_path and os.path.exists(photo.repaired_path):
        os.remove(photo.repaired_path)
    if photo.thumbnail_path and os.path.exists(photo.thumbnail_path):
        os.remove(photo.thumbnail_path)
    
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted successfully"}


@router.post("/{photo_id}/repair", response_model=RepairSchema)
async def start_repair(
    photo_id: int,
    repair_type: str = "full",
    parameters: str = "{}",
    background_tasks: BackgroundTasks = None,
    photo_db: Session = Depends(get_photo_db),
    repair_db: Session = Depends(get_repair_db),
    current_user: User = Depends(get_current_user)
):
    photo = photo_db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        params_dict = json.loads(parameters)
    except json.JSONDecodeError:
        params_dict = {}
    
    repair = RepairRecord(
        photo_id=photo_id,
        user_id=current_user.id,
        repair_type=repair_type,
        parameters=parameters,
        status="pending"
    )
    repair_db.add(repair)
    repair_db.commit()
    repair_db.refresh(repair)
    
    background_tasks.add_task(
        process_repair_task,
        repair.id,
        photo_id,
        photo.original_path,
        repair_type,
        params_dict,
        photo_db,
        repair_db
    )
    
    return repair


@router.get("/{photo_id}/repairs", response_model=List[RepairSchema])
def get_photo_repairs(
    photo_id: int,
    db: Session = Depends(get_repair_db),
    current_user: User = Depends(get_current_user)
):
    repairs = db.query(RepairRecord).filter(
        RepairRecord.photo_id == photo_id,
        RepairRecord.user_id == current_user.id
    ).order_by(RepairRecord.created_at.desc()).all()
    return repairs


@router.get("/repair/{repair_id}", response_model=RepairSchema)
def get_repair_status(
    repair_id: int,
    db: Session = Depends(get_repair_db),
    current_user: User = Depends(get_current_user)
):
    repair = db.query(RepairRecord).filter(RepairRecord.id == repair_id).first()
    if not repair:
        raise HTTPException(status_code=404, detail="Repair not found")
    if repair.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return repair


@router.post("/{photo_id}/share")
def share_photo(
    photo_id: int,
    db: Session = Depends(get_photo_db),
    current_user: User = Depends(get_current_user)
):
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not photo.share_token:
        photo.share_token = str(uuid.uuid4())[:12]
        photo.is_public = True
        db.commit()
        db.refresh(photo)
    
    return {
        "share_token": photo.share_token,
        "share_url": f"/share/{photo.share_token}",
        "photo_id": photo.id
    }


@router.post("/{photo_id}/film-style")
async def apply_film_style(
    photo_id: int,
    style: str = "classic",
    grain: float = 0.2,
    vignette: float = 0.2,
    soft_focus: bool = False,
    border: bool = False,
    db: Session = Depends(get_photo_db),
    current_user = Depends(get_current_user)
):
    photo = db.query(Photo).filter(Photo.id == photo_id, Photo.user_id == current_user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        styled_path = await repair_service.apply_film_style_async(
            photo.repaired_path or photo.original_path,
            style, grain, vignette, soft_focus, border
        )
        photo.repaired_path = styled_path
        db.commit()
        
        return {
            "success": True,
            "styled_path": styled_path,
            "photo_id": photo_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply film style: {str(e)}")


@router.get("/film-styles")
def get_film_styles():
    return {
        "styles": [
            {"id": "classic", "name": "经典复古", "description": "暖色调、柔和色彩"},
            {"id": "sepia", "name": "怀旧棕褐", "description": "老照片棕褐色调"},
            {"id": "warm", "name": "温暖日光", "description": "温暖阳光色调"},
            {"id": "cool", "name": "冷调胶片", "description": "冷色调复古风格"}
        ],
        "options": {
            "grain": {"name": "胶片颗粒", "min": 0, "max": 0.5, "default": 0.2},
            "vignette": {"name": "暗角效果", "min": 0, "max": 0.5, "default": 0.2},
            "soft_focus": {"name": "柔焦效果", "default": False},
            "border": {"name": "复古边框", "default": False}
        }
    }


@router.get("/repair-records")
def get_repair_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_repair_db),
    current_user = Depends(get_current_user)
):
    records = db.query(RepairRecord).filter(
        RepairRecord.user_id == current_user.id
    ).order_by(RepairRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.get("/repair-records/export")
async def export_repair_records(
    format: str = "json",
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_repair_db),
    current_user = Depends(get_current_user)
):
    query = db.query(RepairRecord).filter(RepairRecord.user_id == current_user.id)
    
    if start_date:
        query = query.filter(RepairRecord.created_at >= start_date)
    if end_date:
        query = query.filter(RepairRecord.created_at <= end_date)
    
    records = query.order_by(RepairRecord.created_at.desc()).all()
    
    result = []
    for record in records:
        result.append({
            "id": record.id,
            "photo_id": record.photo_id,
            "repair_type": record.repair_type,
            "status": record.status,
            "progress": record.progress,
            "parameters": record.parameters,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "completed_at": record.completed_at.isoformat() if record.completed_at else None
        })
    
    if format == "csv":
        import csv
        from io import StringIO
        output = StringIO()
        if result:
            writer = csv.DictWriter(output, fieldnames=result[0].keys())
            writer.writeheader()
            writer.writerows(result)
        csv_content = output.getvalue()
        return Response(content=csv_content, media_type="text/csv", headers={
            "Content-Disposition": f"attachment; filename=repair_records_{uuid.uuid4().hex[:8]}.csv"
        })
    
    return result


@router.get("/similar-photos/{photo_id}")
async def get_similar_photos(
    photo_id: int,
    top_k: int = 5,
    db: Session = Depends(get_photo_db),
    current_user = Depends(get_current_user)
):
    target_photo = db.query(Photo).filter(
        Photo.id == photo_id, Photo.user_id == current_user.id
    ).first()
    if not target_photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    all_photos = db.query(Photo).filter(
        Photo.user_id == current_user.id, Photo.id != photo_id
    ).all()
    
    def calculate_similarity(img_path1, img_path2):
        try:
            if not Image or not os.path.exists(img_path1) or not os.path.exists(img_path2):
                return 0.5
            
            def get_image_histogram(path):
                img = Image.open(path).convert('RGB').resize((64, 64))
                hist = np.array(img.histogram())
                hist = hist / hist.sum()
                return hist
            
            hist1 = get_image_histogram(img_path1)
            hist2 = get_image_histogram(img_path2)
            
            intersection = np.minimum(hist1, hist2).sum()
            return float(intersection)
        except Exception:
            return 0.0
    
    similarities = []
    target_path = target_photo.original_path or target_photo.repaired_path
    
    for photo in all_photos:
        photo_path = photo.original_path or photo.repaired_path
        similarity = calculate_similarity(target_path, photo_path)
        similarities.append({
            "photo_id": photo.id,
            "title": photo.title,
            "thumbnail_path": photo.thumbnail_path,
            "similarity": round(similarity * 100, 2),
            "created_at": photo.created_at.isoformat()
        })
    
    similarities.sort(key=lambda x: x["similarity"], reverse=True)
    return similarities[:top_k]


@router.get("/share/{token}", response_model=PhotoSchema)
def get_shared_photo(
    token: str,
    db: Session = Depends(get_photo_db)
):
    try:
        photo = db.query(Photo).filter(Photo.share_token == token, Photo.is_public == True).first()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found or link expired")
        
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        
        if photo.repaired_path and not os.path.isabs(photo.repaired_path):
            photo.repaired_path = os.path.join(base_dir, photo.repaired_path)
        if photo.original_path and not os.path.isabs(photo.original_path):
            photo.original_path = os.path.join(base_dir, photo.original_path)
        if photo.thumbnail_path and not os.path.isabs(photo.thumbnail_path):
            photo.thumbnail_path = os.path.join(base_dir, photo.thumbnail_path)
        
        return photo
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading shared photo: {str(e)}"
        )
