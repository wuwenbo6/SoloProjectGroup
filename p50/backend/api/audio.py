from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import soundfile as sf
import numpy as np
from datetime import datetime
from models.database import get_db, Corpus, AudioFeature
from services.feature_extractor import FeatureExtractor
from services.audio_processor import AudioStreamProcessor, AudioQualityChecker
from config.settings import settings

router = APIRouter()
feature_extractor = FeatureExtractor()
audio_processor = AudioStreamProcessor()
quality_checker = AudioQualityChecker()

class AudioUploadResponse(BaseModel):
    success: bool
    corpus_id: int
    message: str

class FeatureExtractionResponse(BaseModel):
    success: bool
    features: dict
    message: str

@router.post("/upload")
async def upload_audio(
    dialect_id: int,
    text: str,
    speaker_id: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        os.makedirs(settings.AUDIO_STORAGE_PATH, exist_ok=True)
        
        temp_filename = f"temp_{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
        temp_path = os.path.join(settings.AUDIO_STORAGE_PATH, temp_filename)
        
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        
        validation = audio_processor.validate_audio_file(temp_path)
        
        processed_filename = f"processed_{uuid.uuid4()}.wav"
        processed_path = os.path.join(settings.AUDIO_STORAGE_PATH, processed_filename)
        
        process_result = audio_processor.process_audio_stream(temp_path, processed_path)
        
        if not process_result["success"]:
            os.remove(temp_path)
            raise HTTPException(status_code=400, detail=f"音频处理失败: {process_result.get('error', '未知错误')}")
        
        y, _ = sf.read(processed_path)
        quality = quality_checker.check_quality(y)
        
        os.remove(temp_path)
        
        corpus = Corpus(
            dialect_id=dialect_id,
            text=text,
            audio_path=processed_path,
            speaker_id=speaker_id or "anonymous",
            duration=process_result["duration"],
            is_approved=False
        )
        db.add(corpus)
        db.commit()
        db.refresh(corpus)
        
        return {
            "success": True,
            "corpus_id": corpus.id,
            "message": "音频上传并处理成功",
            "original_sample_rate": process_result["original_sample_rate"],
            "target_sample_rate": process_result["target_sample_rate"],
            "quality_score": quality["quality_score"],
            "quality_issues": quality["issues"],
            "validation_warnings": validation.get("issues", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@router.post("/extract-features/{corpus_id}", response_model=FeatureExtractionResponse)
async def extract_features(
    corpus_id: int,
    db: Session = Depends(get_db)
):
    corpus = db.query(Corpus).filter(Corpus.id == corpus_id).first()
    if not corpus:
        raise HTTPException(status_code=404, detail="语料不存在")
    
    if not os.path.exists(corpus.audio_path):
        raise HTTPException(status_code=404, detail="音频文件不存在")
    
    try:
        features = feature_extractor.extract_all_features(corpus.audio_path)
        
        audio_feature = AudioFeature(
            corpus_id=corpus_id,
            mfcc_features=str(features.get("mfcc", [])),
            pitch_contour=str(features.get("pitch", [])),
            energy=str(features.get("energy", [])),
            tempo=features.get("tempo", 0),
            speech_rate=features.get("speech_rate", 0)
        )
        db.add(audio_feature)
        db.commit()
        
        return FeatureExtractionResponse(
            success=True,
            features=features,
            message="特征提取成功"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"特征提取失败: {str(e)}")

@router.get("/corpora")
async def list_corpora(
    dialect_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Corpus)
    if dialect_id:
        query = query.filter(Corpus.dialect_id == dialect_id)
    corpora = query.offset(skip).limit(limit).all()
    return {"total": query.count(), "corpora": corpora}
