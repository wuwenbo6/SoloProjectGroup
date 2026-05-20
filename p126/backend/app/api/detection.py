from fastapi import APIRouter, HTTPException
import os
from app.schemas import DetectionResponse
from app.services.image_processor import StainDetector

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=DetectionResponse)
async def detect_stains(file_id: str):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = StainDetector.detect(file_path)
        
        return DetectionResponse(
            file_id=file_id,
            stains=result["stains"],
            total_stains=result["total_stains"],
            processing_time=result["processing_time"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")
