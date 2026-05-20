from fastapi import APIRouter, HTTPException
import os
from app.schemas import RepairEstimateResponse
from app.services.image_processor import RepairEstimator

router = APIRouter()
UPLOAD_DIR = "uploads"

@router.get("/{file_id}", response_model=RepairEstimateResponse)
async def estimate_repair(file_id: str):
    file_path = None
    try:
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                file_path = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not file_path:
            raise HTTPException(status_code=404, detail="图像不存在")
        
        result = RepairEstimator.estimate_repair(file_path)
        
        return RepairEstimateResponse(
            file_id=file_id,
            total_estimated_cost=result["total_estimated_cost"],
            total_estimated_time=result["total_estimated_time"],
            repair_items=result["repair_items"],
            material_list=result["material_list"],
            priority_summary=result["priority_summary"],
            processing_time=result["processing_time"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"维修量估算失败: {str(e)}")
