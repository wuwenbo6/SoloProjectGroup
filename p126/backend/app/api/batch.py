from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import uuid
import shutil
import time
import asyncio
from typing import List
from app.schemas import BatchResponse, BatchItemResult
from app.services.image_processor import StainDetector, PaperClassifier, DamagePredictor

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def safe_remove_file(file_path: str):
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except:
        pass

@router.post("/", response_model=BatchResponse)
async def batch_process(files: List[UploadFile] = File(...)):
    start_time = time.time()
    batch_id = str(uuid.uuid4())
    
    results = []
    completed = 0
    failed = 0
    temp_files = []
    
    for file in files:
        file_id = str(uuid.uuid4())
        filename = file.filename or f"unknown_{file_id}"
        
        try:
            ext = os.path.splitext(filename)[1].lower()
            if not ext:
                ext = '.png'
            
            safe_filename = f"{file_id}{ext}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)
            temp_files.append(file_path)
            
            try:
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
            except Exception as e:
                failed += 1
                results.append(BatchItemResult(
                    file_id=file_id,
                    filename=filename,
                    status="failed",
                    error=f"文件保存失败: {str(e)}"
                ))
                continue
            
            try:
                detection_result = StainDetector.detect(file_path)
            except Exception as e:
                detection_result = {
                    "stains": [],
                    "total_stains": 0,
                    "processing_time": 0,
                    "error": str(e)
                }
            
            try:
                classification_result = PaperClassifier.classify(file_path)
            except Exception as e:
                classification_result = {
                    "paper_type": "未知",
                    "confidence": 0,
                    "sub_type": None,
                    "properties": {},
                    "error": str(e)
                }
            
            try:
                prediction_result = DamagePredictor.predict(file_path)
            except Exception as e:
                prediction_result = {
                    "predictions": [],
                    "overall_health": 0.5,
                    "risk_level": "未知",
                    "error": str(e)
                }
            
            completed += 1
            results.append(BatchItemResult(
                file_id=file_id,
                filename=filename,
                detection={
                    "file_id": file_id,
                    "stains": detection_result.get("stains", []),
                    "total_stains": detection_result.get("total_stains", 0),
                    "processing_time": detection_result.get("processing_time", 0)
                },
                classification={
                    "file_id": file_id,
                    "paper_type": classification_result.get("paper_type", "未知"),
                    "confidence": classification_result.get("confidence", 0),
                    "sub_type": classification_result.get("sub_type"),
                    "properties": classification_result.get("properties", {})
                },
                prediction={
                    "file_id": file_id,
                    "predictions": prediction_result.get("predictions", []),
                    "overall_health": prediction_result.get("overall_health", 0.5),
                    "risk_level": prediction_result.get("risk_level", "未知")
                },
                status="completed"
            ))
            
        except Exception as e:
            failed += 1
            results.append(BatchItemResult(
                file_id=file_id,
                filename=filename,
                status="failed",
                error=str(e)
            ))
    
    for f in temp_files:
        safe_remove_file(f)
    
    processing_time = time.time() - start_time
    
    return BatchResponse(
        batch_id=batch_id,
        total=len(files),
        completed=completed,
        failed=failed,
        results=results,
        processing_time=round(processing_time, 3)
    )
