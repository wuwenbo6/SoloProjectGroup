from fastapi import APIRouter, HTTPException, Query
import os
from app.schemas import WeatheringTrendResponse
from app.services.image_processor import WeatheringTrendAnalyzer

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=WeatheringTrendResponse)
async def predict_weathering_trend(
    file_id: str,
    prediction_months: int = Query(24, ge=1, le=60, description="预测月数")
):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = WeatheringTrendAnalyzer.predict_trend(file_path, prediction_months)
        
        return WeatheringTrendResponse(
            file_id=file_id,
            current_health=result["current_health"],
            trend_points=result["trend_points"],
            prediction_months=result["prediction_months"],
            recommendations=result["recommendations"],
            critical_points=result["critical_points"],
            processing_time=result["processing_time"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"风化趋势预测失败: {str(e)}")
