from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class SongBase(BaseModel):
    title: str
    artist: Optional[str] = None
    album: Optional[str] = None


class SongCreate(SongBase):
    file_path: str
    duration: Optional[int] = None


class SongResponse(SongBase):
    id: int
    duration: Optional[int] = None
    cover_url: Optional[str] = None
    lyrics: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FingerprintBase(BaseModel):
    song_id: int
    hash: str
    offset: int


class FingerprintCreate(FingerprintBase):
    pass


class FingerprintResponse(FingerprintBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MatchResult(BaseModel):
    song_id: int
    title: str
    artist: Optional[str] = None
    album: Optional[str] = None
    confidence: float
    match_count: int
    max_offset_alignment: Optional[int] = None


class UploadResponse(BaseModel):
    success: bool
    message: str
    song: Optional[SongResponse] = None
    matches: Optional[List[MatchResult]] = None
    fingerprint_info: Optional[dict] = None


class SongListResponse(BaseModel):
    songs: List[SongResponse]
    total: int
