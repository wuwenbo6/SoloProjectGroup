from fastapi import APIRouter, HTTPException, Query
import os
from app.schemas import ModelSliceResponse
from app.services.image_processor import ModelSlicer

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=ModelSliceResponse)
async def analyze_slices(
    file_id: str,
    grid_rows: int = Query(4, ge=2, le=10, description="网格行数"),
    grid_cols: int = Query(4, ge=2, le=10, description="网格列数")
):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = ModelSlicer.slice_and_analyze(file_path, grid_rows, grid_cols)
        
        return ModelSliceResponse(
            file_id=file_id,
            grid_size=result["grid_size"],
            slices=result["slices"],
            heatmap_data=result["heatmap_data"],
            high_risk_areas=result["high_risk_areas"],
            overall_summary=result["overall_summary"],
            processing_time=result["processing_time"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"模型切片分析失败: {str(e)}")
