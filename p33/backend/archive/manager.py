from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from datetime import datetime
from PIL import Image as PILImage

from database import get_db
from models import PhotoArchive

router = APIRouter()


class ArchiveQuery(BaseModel):
    page: int = 1
    page_size: int = 20
    camera_model: Optional[str] = None
    film_type: Optional[str] = None
    tags: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ArchiveUpdate(BaseModel):
    tags: Optional[str] = None
    notes: Optional[str] = None
    camera_model: Optional[str] = None
    film_type: Optional[str] = None


class ArchiveManager:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.archive_dir = os.path.join(base_dir, "archives")
        self.thumbnails_dir = os.path.join(self.archive_dir, "thumbnails")
        os.makedirs(self.archive_dir, exist_ok=True)
        os.makedirs(self.thumbnails_dir, exist_ok=True)

    def create_thumbnail(self, filepath: str, thumbnail_path: str, size: tuple = (300, 300)):
        try:
            with PILImage.open(filepath) as img:
                img.thumbnail(size)
                img.save(thumbnail_path, "JPEG", quality=85)
            return True
        except Exception as e:
            print(f"创建缩略图失败: {e}")
            return False

    def convert_format(self, input_path: str, output_path: str, output_format: str = "jpeg"):
        try:
            with PILImage.open(input_path) as img:
                if output_format.lower() in ['jpg', 'jpeg']:
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    img.save(output_path, 'JPEG', quality=95)
                elif output_format.lower() == 'png':
                    img.save(output_path, 'PNG')
                elif output_format.lower() == 'tiff':
                    img.save(output_path, 'TIFF')
                return True
        except Exception as e:
            print(f"格式转换失败: {e}")
            return False


archive_manager = ArchiveManager()


@router.post("/import")
async def import_photo(
    file: UploadFile = File(...),
    camera_model: Optional[str] = None,
    film_type: Optional[str] = None,
    tags: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"archive_{timestamp}_{file.filename}"
        filepath = os.path.join(archive_manager.archive_dir, filename)
        
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
        
        thumbnail_filename = f"thumb_{timestamp}_{file.filename}.jpg"
        thumbnail_path = os.path.join(archive_manager.thumbnails_dir, thumbnail_filename)
        archive_manager.create_thumbnail(filepath, thumbnail_path)
        
        with PILImage.open(filepath) as img:
            width, height = img.size
        
        archive = PhotoArchive(
            filename=filename,
            original_path=file.filename,
            archived_path=filepath,
            file_format=filename.split('.')[-1].lower(),
            file_size=os.path.getsize(filepath),
            width=width,
            height=height,
            camera_model=camera_model,
            film_type=film_type,
            tags=tags,
            notes=notes
        )
        
        db.add(archive)
        db.commit()
        db.refresh(archive)
        
        return {
            "id": archive.id,
            "filename": filename,
            "width": width,
            "height": height,
            "thumbnail": thumbnail_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.get("/photos")
async def list_photos(
    page: int = 1,
    page_size: int = 20,
    camera_model: Optional[str] = None,
    film_type: Optional[str] = None,
    tags: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PhotoArchive)
    
    if camera_model:
        query = query.filter(PhotoArchive.camera_model.contains(camera_model))
    if film_type:
        query = query.filter(PhotoArchive.film_type.contains(film_type))
    if tags:
        query = query.filter(PhotoArchive.tags.contains(tags))
    
    total = query.count()
    offset = (page - 1) * page_size
    photos = query.order_by(PhotoArchive.scan_date.desc()).offset(offset).limit(page_size).all()
    
    result = []
    for p in photos:
        result.append({
            "id": p.id,
            "filename": p.filename,
            "file_format": p.file_format,
            "width": p.width,
            "height": p.height,
            "camera_model": p.camera_model,
            "film_type": p.film_type,
            "tags": p.tags,
            "notes": p.notes,
            "scan_date": p.scan_date.isoformat() if p.scan_date else None,
            "has_restoration": p.has_restoration
        })
    
    return {
        "photos": result,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/photos/{photo_id}")
async def get_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    return {
        "id": photo.id,
        "filename": photo.filename,
        "file_format": photo.file_format,
        "width": photo.width,
        "height": photo.height,
        "file_size": photo.file_size,
        "camera_model": photo.camera_model,
        "film_type": photo.film_type,
        "tags": photo.tags,
        "notes": photo.notes,
        "scan_date": photo.scan_date.isoformat() if photo.scan_date else None,
        "has_restoration": photo.has_restoration,
        "restoration_params": photo.restoration_params,
        "archived_path": photo.archived_path
    }


@router.put("/photos/{photo_id}")
async def update_photo(photo_id: int, update: ArchiveUpdate, db: Session = Depends(get_db)):
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    if update.tags is not None:
        photo.tags = update.tags
    if update.notes is not None:
        photo.notes = update.notes
    if update.camera_model is not None:
        photo.camera_model = update.camera_model
    if update.film_type is not None:
        photo.film_type = update.film_type
    
    db.commit()
    return {"status": "updated"}


@router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    try:
        if os.path.exists(photo.archived_path):
            os.remove(photo.archived_path)
    except:
        pass
    
    db.delete(photo)
    db.commit()
    return {"status": "deleted"}


@router.get("/photos/{photo_id}/download")
async def download_photo(photo_id: int, format: Optional[str] = None, db: Session = Depends(get_db)):
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    if not os.path.exists(photo.archived_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if format and format.lower() != photo.file_format:
        output_filename = f"{os.path.splitext(photo.filename)[0]}.{format.lower()}"
        output_path = os.path.join(archive_manager.archive_dir, output_filename)
        
        if archive_manager.convert_format(photo.archived_path, output_path, format):
            return FileResponse(output_path, filename=output_filename)
        else:
            raise HTTPException(status_code=500, detail="格式转换失败")
    
    return FileResponse(photo.archived_path, filename=photo.filename)


@router.get("/photos/{photo_id}/thumbnail")
async def get_thumbnail(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    thumbnail_filename = f"thumb_{photo.filename}.jpg"
    thumbnail_path = os.path.join(archive_manager.thumbnails_dir, thumbnail_filename)
    
    if not os.path.exists(thumbnail_path):
        if os.path.exists(photo.archived_path):
            archive_manager.create_thumbnail(photo.archived_path, thumbnail_path)
        else:
            raise HTTPException(status_code=404, detail="原图不存在")
    
    return FileResponse(thumbnail_path)


@router.post("/batch-export")
async def batch_export(photo_ids: List[int], output_format: str = "jpeg", db: Session = Depends(get_db)):
    export_dir = os.path.join(archive_manager.archive_dir, "export")
    os.makedirs(export_dir, exist_ok=True)
    
    exported = []
    for photo_id in photo_ids:
        photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
        if photo and os.path.exists(photo.archived_path):
            output_filename = f"export_{photo.id}.{output_format.lower()}"
            output_path = os.path.join(export_dir, output_filename)
            
            if archive_manager.convert_format(photo.archived_path, output_path, output_format):
                exported.append({
                    "id": photo.id,
                    "filename": output_filename,
                    "path": output_path
                })
    
    return {"exported": exported, "count": len(exported)}


@router.get("/stats")
async def get_archive_stats(db: Session = Depends(get_db)):
    total_photos = db.query(PhotoArchive).count()
    total_size = db.query(PhotoArchive.file_size).all()
    total_size = sum(s[0] for s in total_size if s[0])
    
    camera_models = db.query(PhotoArchive.camera_model).distinct().all()
    film_types = db.query(PhotoArchive.film_type).distinct().all()
    
    return {
        "total_photos": total_photos,
        "total_size_mb": round(total_size / (1024 * 1024), 2) if total_size else 0,
        "camera_models": [c[0] for c in camera_models if c[0]],
        "film_types": [f[0] for f in film_types if f[0]]
    }
