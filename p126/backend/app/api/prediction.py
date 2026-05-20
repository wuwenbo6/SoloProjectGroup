from fastapi import APIRouter, HTTPException
import os
from app.schemas import PredictionResponse
from app.services.image_processor import DamagePredictor

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=PredictionResponse)
async def predict_damage(file_id: str):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = DamagePredictor.predict(file_path)
        
        return PredictionResponse(
            file_id=file_id,
            predictions=result["predictions"],
            overall_health=result["overall_health"],
            risk_level=result["risk_level"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测失败: {str(e)}")
