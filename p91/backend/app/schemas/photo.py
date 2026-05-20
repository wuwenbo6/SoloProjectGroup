from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PhotoBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: bool = False


class PhotoCreate(PhotoBase):
    original_filename: str
    original_path: str


class PhotoUpdate(PhotoBase):
    pass


class Photo(PhotoBase):
    id: int
    user_id: int
    original_filename: str
    original_path: str
    repaired_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
