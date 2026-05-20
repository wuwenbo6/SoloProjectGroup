from fastapi import APIRouter, HTTPException
import os
from app.schemas import ClassificationResponse
from app.services.image_processor import PaperClassifier

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=ClassificationResponse)
async def classify_paper(file_id: str):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = PaperClassifier.classify(file_path)
        
        return ClassificationResponse(
            file_id=file_id,
            paper_type=result["paper_type"],
            confidence=result["confidence"],
            sub_type=result["sub_type"],
            properties=result["properties"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分类失败: {str(e)}")
