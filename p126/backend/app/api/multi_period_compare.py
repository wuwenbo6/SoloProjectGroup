from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import os
import uuid
from typing import Optional
from app.schemas import MultiPeriodCompareResponse
from app.services.image_processor import MultiPeriodComparator

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=MultiPeriodCompareResponse)
async def compare_periods(
    file1: UploadFile = File(..., description="早期图像"),
    file2: UploadFile = File(..., description="后期图像"),
    time_diff_days: Optional[int] = Form(None, description="两次拍摄间隔天数")
):
    try:
        file1_path = os.path.join(UPLOAD_DIR, f"compare_{uuid.uuid4()}_{file1.filename}")
        file2_path = os.path.join(UPLOAD_DIR, f"compare_{uuid.uuid4()}_{file2.filename}")
        
        with open(file1_path, "wb") as buffer:
            content = await file1.read()
            buffer.write(content)
        
        with open(file2_path, "wb") as buffer:
            content = await file2.read()
            buffer.write(content)
        
        result = MultiPeriodComparator.compare(file1_path, file2_path, time_diff_days)
        
        try:
            os.remove(file1_path)
            os.remove(file2_path)
        except:
            pass
        
        return MultiPeriodCompareResponse(
            comparison_id=result["comparison_id"],
            earlier_file_id=result["earlier_file_id"],
            later_file_id=result["later_file_id"],
            time_diff_days=result["time_diff_days"],
            metrics=result["metrics"],
            overall_assessment=result["overall_assessment"],
            change_rate=result["change_rate"],
            processing_time=result["processing_time"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"多期对比失败: {str(e)}")

@router.post("/by-id/{file_id1}/{file_id2}", response_model=MultiPeriodCompareResponse)
async def compare_by_ids(
    file_id1: str,
    file_id2: str,
    time_diff_days: Optional[int] = Query(None, description="两次拍摄间隔天数")
):
    try:
        file1_path = None
        file2_path = None
        
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id1):
                file1_path = os.path.join(UPLOAD_DIR, filename)
            if filename.startswith(file_id2):
                file2_path = os.path.join(UPLOAD_DIR, filename)
        
        if not file1_path:
            raise HTTPException(status_code=404, detail=f"图像1不存在: {file_id1}")
        if not file2_path:
            raise HTTPException(status_code=404, detail=f"图像2不存在: {file_id2}")
        
        result = MultiPeriodComparator.compare(file1_path, file2_path, time_diff_days)
        
        return MultiPeriodCompareResponse(
            comparison_id=result["comparison_id"],
            earlier_file_id=result["earlier_file_id"],
            later_file_id=result["later_file_id"],
            time_diff_days=result["time_diff_days"],
            metrics=result["metrics"],
            overall_assessment=result["overall_assessment"],
            change_rate=result["change_rate"],
            processing_time=result["processing_time"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"多期对比失败: {str(e)}")
