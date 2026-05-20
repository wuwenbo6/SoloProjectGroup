from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
import os
import shutil
import uuid
from typing import Optional
from ..core.security import get_current_active_user
from ..models.models import User

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "mp4", "webm"}


def allowed_file(filename: str):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    file_extension = file.filename.rsplit(".", 1)[1].lower()
    file_name = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "filename": file_name,
        "url": f"/uploads/{file_name}"
    }


@router.post("/images")
async def upload_multiple_images(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user)
):
    results = []
    for file in files:
        if not allowed_file(file.filename):
            continue
        
        file_extension = file.filename.rsplit(".", 1)[1].lower()
        file_name = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        results.append({
            "filename": file_name,
            "url": f"/uploads/{file_name}"
        })
    
    return {"files": results}
