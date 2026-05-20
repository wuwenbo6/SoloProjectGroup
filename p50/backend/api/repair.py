from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
import os
from models.database import get_db, RepairRecord
from services.audio_repair import AudioRepairService
from config.settings import settings

router = APIRouter()
repair_service = AudioRepairService()

class RepairRequest(BaseModel):
    synthesis_task_id: str
    repair_type: Optional[str] = "full"

@router.post("/repair-audio")
async def repair_audio(
    request: RepairRequest,
    db: Session = Depends(get_db)
):
    try:
        result = repair_service.repair_audio(
            synthesis_task_id=request.synthesis_task_id,
            repair_type=request.repair_type
        )
        
        if result["success"]:
            repair_record = RepairRecord(
                synthesis_task_id=request.synthesis_task_id,
                original_audio_path=result["original_path"],
                repaired_audio_path=result["repaired_path"],
                repair_type=request.repair_type,
                quality_score_before=result.get("score_before", 0),
                quality_score_after=result.get("score_after", 0)
            )
            db.add(repair_record)
            db.commit()
            
            return {
                "success": True,
                "original_audio": result["original_path"],
                "repaired_audio": result["repaired_path"],
                "quality_improvement": result.get("improvement", 0),
                "message": "语音修复完成"
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "修复失败"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修复失败: {str(e)}")

@router.post("/upload-and-repair")
async def upload_and_repair(
    repair_type: Optional[str] = "full",
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        os.makedirs(settings.AUDIO_STORAGE_PATH, exist_ok=True)
        
        file_ext = os.path.splitext(file.filename)[1]
        original_filename = f"repair_original_{uuid.uuid4()}{file_ext}"
        original_path = os.path.join(settings.AUDIO_STORAGE_PATH, original_filename)
        
        content = await file.read()
        with open(original_path, "wb") as f:
            f.write(content)
        
        result = repair_service.repair_audio_file(
            input_path=original_path,
            repair_type=repair_type
        )
        
        if result["success"]:
            repair_record = RepairRecord(
                synthesis_task_id="manual_upload",
                original_audio_path=original_path,
                repaired_audio_path=result["repaired_path"],
                repair_type=repair_type,
                quality_score_before=result.get("score_before", 0),
                quality_score_after=result.get("score_after", 0)
            )
            db.add(repair_record)
            db.commit()
            
            return {
                "success": True,
                "original_audio": original_path,
                "repaired_audio": result["repaired_path"],
                "quality_improvement": result.get("improvement", 0),
                "message": "语音修复完成"
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "修复失败"))
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"修复失败: {str(e)}")

@router.get("/repair-records")
async def get_repair_records(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    records = db.query(RepairRecord).order_by(RepairRecord.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": db.query(RepairRecord).count(), "records": records}

@router.get("/quality-assessment/{task_id}")
async def assess_audio_quality(
    task_id: str,
    db: Session = Depends(get_db)
):
    from models.database import SynthesisTask
    
    task = db.query(SynthesisTask).filter(SynthesisTask.task_id == task_id).first()
    if not task or not task.output_audio_path:
        raise HTTPException(status_code=404, detail="音频不存在")
    
    try:
        quality_score = repair_service.assess_quality(task.output_audio_path)
        return {
            "success": True,
            "task_id": task_id,
            "quality_score": quality_score,
            "details": {
                "clarity": quality_score.get("clarity", 0),
                "naturalness": quality_score.get("naturalness", 0),
                "noise_level": quality_score.get("noise_level", 0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"评估失败: {str(e)}")
