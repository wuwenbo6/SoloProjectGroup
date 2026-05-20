from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import Tag, PhotoArchive, photo_tag_association

router = APIRouter(prefix="/api/archive/tags")


class TagCreate(BaseModel):
    name: str
    color: str = "#3b82f6"
    description: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str
    description: Optional[str]
    created_at: datetime
    photo_count: int

    class Config:
        orm_mode = True


class PhotoTagsUpdate(BaseModel):
    tag_ids: List[int]


class TagManager:
    def __init__(self):
        pass

    def create_tag(self, db: Session, data: TagCreate) -> Tag:
        existing = db.query(Tag).filter(Tag.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="标签名称已存在")

        tag = Tag(
            name=data.name,
            color=data.color,
            description=data.description,
            photo_count=0
        )
        db.add(tag)
        db.commit()
        db.refresh(tag)
        return tag

    def get_all_tags(self, db: Session) -> List[Tag]:
        return db.query(Tag).order_by(Tag.name).all()

    def get_tag_by_id(self, db: Session, tag_id: int) -> Optional[Tag]:
        return db.query(Tag).filter(Tag.id == tag_id).first()

    def update_tag(self, db: Session, tag_id: int, data: TagUpdate) -> Tag:
        tag = self.get_tag_by_id(db, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="标签不存在")

        if data.name and data.name != tag.name:
            existing = db.query(Tag).filter(Tag.name == data.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="标签名称已存在")
            tag.name = data.name

        if data.color:
            tag.color = data.color
        if data.description is not None:
            tag.description = data.description

        db.commit()
        db.refresh(tag)
        return tag

    def delete_tag(self, db: Session, tag_id: int) -> bool:
        tag = self.get_tag_by_id(db, tag_id)
        if not tag:
            return False

        db.execute(photo_tag_association.delete().where(photo_tag_association.c.tag_id == tag_id))
        db.delete(tag)
        db.commit()
        return True

    def add_tags_to_photo(self, db: Session, photo_id: int, tag_ids: List[int]) -> PhotoArchive:
        photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
        if not photo:
            raise HTTPException(status_code=404, detail="照片不存在")

        for tag_id in tag_ids:
            tag = self.get_tag_by_id(db, tag_id)
            if tag and tag not in photo.tag_objects:
                photo.tag_objects.append(tag)
                tag.photo_count += 1

        db.commit()
        db.refresh(photo)
        return photo

    def remove_tag_from_photo(self, db: Session, photo_id: int, tag_id: int) -> bool:
        photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
        tag = self.get_tag_by_id(db, tag_id)
        if not photo or not tag:
            return False

        if tag in photo.tag_objects:
            photo.tag_objects.remove(tag)
            tag.photo_count -= 1
            db.commit()
        return True

    def get_photo_tags(self, db: Session, photo_id: int) -> List[Tag]:
        photo = db.query(PhotoArchive).filter(PhotoArchive.id == photo_id).first()
        if not photo:
            raise HTTPException(status_code=404, detail="照片不存在")
        return photo.tag_objects

    def get_photos_by_tag(self, db: Session, tag_id: int, skip: int = 0, limit: int = 50) -> List[PhotoArchive]:
        tag = self.get_tag_by_id(db, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="标签不存在")

        photos = db.query(PhotoArchive).join(
            photo_tag_association,
            PhotoArchive.id == photo_tag_association.c.photo_id
        ).filter(
            photo_tag_association.c.tag_id == tag_id
        ).order_by(
            PhotoArchive.scan_date.desc()
        ).offset(skip).limit(limit).all()

        return photos

    def get_tags_stats(self, db: Session) -> dict:
        tags = self.get_all_tags(db)
        total_photos = db.query(PhotoArchive).count()
        tagged_photos = db.query(PhotoArchive).filter(
            PhotoArchive.tag_objects.any()
        ).count()

        return {
            "total_tags": len(tags),
            "total_photos": total_photos,
            "tagged_photos": tagged_photos,
            "untagged_photos": total_photos - tagged_photos,
            "top_tags": sorted(tags, key=lambda t: -t.photo_count)[:5]
        }

    def batch_tag_photos(self, db: Session, photo_ids: List[int], tag_ids: List[int]) -> int:
        tagged_count = 0
        for photo_id in photo_ids:
            try:
                self.add_tags_to_photo(db, photo_id, tag_ids)
                tagged_count += 1
            except:
                continue
        return tagged_count

    def auto_tag_by_film_type(self, db: Session) -> int:
        film_types = db.query(PhotoArchive.film_type).distinct().all()
        tagged_count = 0

        for (film_type,) in film_types:
            if not film_type:
                continue

            tag_name = f"胶片:{film_type}"
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, color="#8b5cf6", photo_count=0)
                db.add(tag)
                db.commit()
                db.refresh(tag)

            photos = db.query(PhotoArchive).filter(
                PhotoArchive.film_type == film_type,
                ~PhotoArchive.tag_objects.any(Tag.id == tag.id)
            ).all()

            for photo in photos:
                photo.tag_objects.append(tag)
                tag.photo_count += 1
                tagged_count += 1

        db.commit()
        return tagged_count

    def auto_tag_by_camera(self, db: Session) -> int:
        camera_models = db.query(PhotoArchive.camera_model).distinct().all()
        tagged_count = 0

        for (camera_model,) in camera_models:
            if not camera_model:
                continue

            tag_name = f"设备:{camera_model}"
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, color="#06b6d4", photo_count=0)
                db.add(tag)
                db.commit()
                db.refresh(tag)

            photos = db.query(PhotoArchive).filter(
                PhotoArchive.camera_model == camera_model,
                ~PhotoArchive.tag_objects.any(Tag.id == tag.id)
            ).all()

            for photo in photos:
                photo.tag_objects.append(tag)
                tag.photo_count += 1
                tagged_count += 1

        db.commit()
        return tagged_count


tag_manager = TagManager()


@router.post("/", response_model=TagResponse)
async def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    return tag_manager.create_tag(db, data)


@router.get("/", response_model=List[TagResponse])
async def list_tags(db: Session = Depends(get_db)):
    return tag_manager.get_all_tags(db)


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = tag_manager.get_tag_by_id(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(tag_id: int, data: TagUpdate, db: Session = Depends(get_db)):
    return tag_manager.update_tag(db, tag_id, data)


@router.delete("/{tag_id}")
async def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    success = tag_manager.delete_tag(db, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="标签不存在")
    return {"status": "success", "message": "删除成功"}


@router.post("/photo/{photo_id}")
async def add_tags_to_photo(photo_id: int, data: PhotoTagsUpdate, db: Session = Depends(get_db)):
    photo = tag_manager.add_tags_to_photo(db, photo_id, data.tag_ids)
    return {
        "status": "success",
        "photo_id": photo.id,
        "tag_count": len(photo.tag_objects)
    }


@router.delete("/photo/{photo_id}/{tag_id}")
async def remove_tag_from_photo(photo_id: int, tag_id: int, db: Session = Depends(get_db)):
    success = tag_manager.remove_tag_from_photo(db, photo_id, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="照片或标签不存在")
    return {"status": "success", "message": "移除成功"}


@router.get("/photo/{photo_id}", response_model=List[TagResponse])
async def get_photo_tags(photo_id: int, db: Session = Depends(get_db)):
    return tag_manager.get_photo_tags(db, photo_id)


@router.get("/{tag_id}/photos")
async def get_photos_by_tag(tag_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    photos = tag_manager.get_photos_by_tag(db, tag_id, skip, limit)
    return {
        "count": len(photos),
        "photos": [
            {
                "id": p.id,
                "filename": p.filename,
                "film_type": p.film_type,
                "scan_date": p.scan_date
            }
            for p in photos
        ]
    }


@router.get("/stats")
async def get_tags_stats(db: Session = Depends(get_db)):
    return tag_manager.get_tags_stats(db)


@router.post("/batch")
async def batch_tag_photos(photo_ids: List[int], tag_ids: List[int], db: Session = Depends(get_db)):
    tagged = tag_manager.batch_tag_photos(db, photo_ids, tag_ids)
    return {"tagged_count": tagged}


@router.post("/auto/film-type")
async def auto_tag_by_film_type(db: Session = Depends(get_db)):
    tagged = tag_manager.auto_tag_by_film_type(db)
    return {"tagged_count": tagged}


@router.post("/auto/camera")
async def auto_tag_by_camera(db: Session = Depends(get_db)):
    tagged = tag_manager.auto_tag_by_camera(db)
    return {"tagged_count": tagged}
