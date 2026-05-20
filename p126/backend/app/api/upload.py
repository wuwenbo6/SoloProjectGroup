from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
from app.schemas import UploadResponse

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    try:
        filename = file.filename or "unknown"
        
        ext = os.path.splitext(filename)[1].lower()
        if not ext:
            ext = '.png'
        
        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}{ext}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        return UploadResponse(
            success=True,
            file_id=file_id,
            filename=filename,
            file_path=file_path
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@router.get("/{file_id}")
async def get_image(file_id: str):
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                return FileResponse(file_path)
        raise HTTPException(status_code=404, detail="图像不存在")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取图像失败: {str(e)}")
