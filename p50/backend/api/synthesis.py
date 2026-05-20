from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
from datetime import datetime
from models.database import get_db, SynthesisTask
from services.transformer_synthesizer import TransformerSynthesizer
from services.batch_exporter import ParallelSynthesizer
from config.settings import settings

router = APIRouter()
synthesizer = TransformerSynthesizer()
parallel_synthesizer = ParallelSynthesizer(synthesizer)

class SynthesisRequest(BaseModel):
    dialect_id: int
    text: str
    emotion: Optional[str] = "neutral"
    emotion_intensity: Optional[float] = 1.0
    speed: Optional[float] = 1.0
    pitch: Optional[float] = 1.0

class BatchSynthesisRequest(BaseModel):
    requests: List[SynthesisRequest]
    export_format: Optional[str] = "zip"
    output_filename: Optional[str] = None

class EmotionVariationRequest(BaseModel):
    text: str
    dialect_id: int
    emotions: Optional[List[str]] = None
    intensities: Optional[List[float]] = None

class SynthesisResponse(BaseModel):
    success: bool
    task_id: str
    status: str
    message: str

@router.post("/create", response_model=SynthesisResponse)
async def create_synthesis_task(
    request: SynthesisRequest,
    db: Session = Depends(get_db)
):
    try:
        task_id = str(uuid.uuid4())
        
        task = SynthesisTask(
            task_id=task_id,
            dialect_id=request.dialect_id,
            text=request.text,
            emotion=request.emotion,
            speed=request.speed,
            pitch=request.pitch,
            status="pending"
        )
        db.add(task)
        db.commit()
        
        return SynthesisResponse(
            success=True,
            task_id=task_id,
            status="pending",
            message="合成任务已创建"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")

@router.post("/execute/{task_id}")
async def execute_synthesis(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(SynthesisTask).filter(SynthesisTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    try:
        task.status = "processing"
        db.commit()
        
        os.makedirs(settings.AUDIO_STORAGE_PATH, exist_ok=True)
        output_filename = f"synthesis_{task_id}.wav"
        output_path = os.path.join(settings.AUDIO_STORAGE_PATH, output_filename)
        
        result = synthesizer.synthesize(
            text=task.text,
            dialect_id=task.dialect_id,
            emotion=task.emotion,
            speed=task.speed,
            pitch=task.pitch,
            output_path=output_path
        )
        
        if result["success"]:
            task.status = "completed"
            task.output_audio_path = output_path
            task.completed_at = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "task_id": task_id,
                "audio_path": output_path,
                "duration": result.get("duration", 0),
                "message": "合成完成"
            }
        else:
            task.status = "failed"
            task.error_message = result.get("error", "未知错误")
            db.commit()
            raise HTTPException(status_code=500, detail=result["error"])
            
    except Exception as e:
        task.status = "failed"
        task.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")

@router.get("/status/{task_id}")
async def get_synthesis_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(SynthesisTask).filter(SynthesisTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "task_id": task.task_id,
        "status": task.status,
        "text": task.text,
        "dialect_id": task.dialect_id,
        "emotion": task.emotion,
        "speed": task.speed,
        "pitch": task.pitch,
        "audio_path": task.output_audio_path,
        "error_message": task.error_message,
        "created_at": task.created_at,
        "completed_at": task.completed_at
    }

@router.get("/tasks")
async def list_synthesis_tasks(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(SynthesisTask)
    if status:
        query = query.filter(SynthesisTask.status == status)
    tasks = query.order_by(SynthesisTask.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": query.count(), "tasks": tasks}

@router.post("/batch")
async def batch_synthesis(
    request: BatchSynthesisRequest
):
    try:
        requests_dict = [r.dict() for r in request.requests]
        
        result = parallel_synthesizer.batch_synthesize_parallel(
            requests_dict,
            export_format=request.export_format,
            output_filename=request.output_filename
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量合成失败: {str(e)}")

@router.post("/emotion-variations")
async def generate_emotion_variations(
    request: EmotionVariationRequest,
    export_format: str = "zip"
):
    try:
        requests = parallel_synthesizer.create_emotion_variations(
            text=request.text,
            dialect_id=request.dialect_id,
            emotions=request.emotions,
            intensities=request.intensities
        )
        
        result = parallel_synthesizer.batch_synthesize_parallel(
            requests,
            export_format=export_format
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"情感变体生成失败: {str(e)}")

@router.get("/emotions")
async def get_available_emotions():
    try:
        emotions = synthesizer.emotion_engine.get_available_emotions()
        return {
            "success": True,
            "emotions": emotions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取情感列表失败: {str(e)}")

@router.get("/download/{filename}")
async def download_synthesis_file(filename: str):
    try:
        file_path = os.path.join(settings.AUDIO_STORAGE_PATH, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return FileResponse(
            file_path,
            media_type="audio/wav" if filename.endswith(".wav") else "application/zip",
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

@router.get("/cache-stats")
async def get_cache_statistics():
    try:
        stats = synthesizer.get_cache_stats()
        return {
            "success": True,
            "cache_stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取缓存统计失败: {str(e)}")
