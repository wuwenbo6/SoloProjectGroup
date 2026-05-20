from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import base64
from ..core.database import get_db
from ..models import Song
from ..schemas import SongResponse, SongListResponse

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("", response_model=SongListResponse)
def get_songs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    songs = db.query(Song).offset(skip).limit(limit).all()
    total = db.query(Song).count()
    return {"songs": songs, "total": total}


@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.delete("/{song_id}")
def delete_song(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    db.delete(song)
    db.commit()
    return {"success": True, "message": "Song deleted successfully"}


@router.put("/{song_id}/cover")
async def upload_cover(
    song_id: int,
    cover_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if not cover_file.content_type or not cover_file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")

    try:
        contents = await cover_file.read()
        base64_image = base64.b64encode(contents).decode('utf-8')
        data_url = f"data:{cover_file.content_type};base64,{base64_image}"

        song.cover_image = data_url
        db.commit()

        return {"success": True, "message": "Cover uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading cover: {str(e)}")


@router.put("/{song_id}/cover-url")
def set_cover_url(
    song_id: int,
    cover_url: str = Form(...),
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    song.cover_url = cover_url
    db.commit()
    return {"success": True, "message": "Cover URL set successfully"}


@router.put("/{song_id}/lyrics")
def update_lyrics(
    song_id: int,
    lyrics: str = Form(...),
    db: Session = Depends(get_db)
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    song.lyrics = lyrics
    db.commit()
    return {"success": True, "message": "Lyrics updated successfully"}
