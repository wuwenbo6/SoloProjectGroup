from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os
import tempfile

from backend.services.dialect_database import DialectDatabaseConnector, DialectDatabaseInitializer
from backend.services.voice_similarity import VoiceSimilarityCalculator, DialectVoiceVerifier
from backend.services.incremental_trainer import UserCorpusManager, IncrementalModelTrainer

router = APIRouter(prefix="/dialect-db", tags=["方言保护数据库"])

class CorpusUploadRequest(BaseModel):
    dialect_id: int
    dialect_name: str
    text_content: str
    phonetic_transcription: Optional[str] = ""
    user_id: str = "anonymous"
    tags: Optional[List[str]] = None
    notes: Optional[str] = ""

class VerifyCorpusRequest(BaseModel):
    corpus_id: str
    verified_by: str
    is_approved: bool
    verification_notes: Optional[str] = ""

class CreateTrainingJobRequest(BaseModel):
    dialect_id: int
    dialect_name: str
    model_type: str = "tts_transformer"
    epochs: int = 10
    batch_size: int = 16
    learning_rate: float = 1e-4
    priority: int = 5

class SimilarityCompareRequest(BaseModel):
    audio_path1: str
    audio_path2: str
    algorithm: str = "cosine"

db_connector = None
similarity_calculator = None
voice_verifier = None
corpus_manager = None
trainer = None

def get_db_connector():
    global db_connector
    if db_connector is None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        engine = create_engine("sqlite:///./dialect_protection.db")
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        db_connector = DialectDatabaseConnector(db)
    return db_connector

def get_similarity_calculator():
    global similarity_calculator
    if similarity_calculator is None:
        similarity_calculator = VoiceSimilarityCalculator()
    return similarity_calculator

def get_voice_verifier():
    global voice_verifier
    if voice_verifier is None:
        voice_verifier = DialectVoiceVerifier()
    return voice_verifier

def get_corpus_manager():
    global corpus_manager
    if corpus_manager is None:
        corpus_manager = UserCorpusManager()
    return corpus_manager

def get_trainer():
    global trainer
    if trainer is None:
        trainer = IncrementalModelTrainer()
    return trainer

@router.post("/initialize", summary="初始化方言保护数据库")
async def initialize_database():
    try:
        connector = get_db_connector()
        source_result = DialectDatabaseInitializer.initialize_official_sources(connector)
        corpus_result = DialectDatabaseInitializer.seed_initial_corpus(connector)
        
        return {
            "success": True,
            "message": "方言保护数据库初始化成功",
            "sources": source_result,
            "seed_corpus": corpus_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics", summary="获取语料库统计信息")
async def get_corpus_statistics():
    try:
        connector = get_db_connector()
        stats = connector.get_corpus_statistics()
        return {"success": True, "statistics": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", summary="搜索语料")
async def search_corpus(
    dialect_id: Optional[int] = None,
    keyword: str = "",
    source_type: Optional[str] = None,
    quality_rating: Optional[str] = None,
    only_verified: bool = False,
    max_results: int = 100,
    offset: int = 0
):
    try:
        connector = get_db_connector()
        results = connector.search_corpus(
            dialect_id=dialect_id,
            keyword=keyword,
            source_type=source_type,
            quality_rating=quality_rating,
            only_verified=only_verified,
            max_results=max_results,
            offset=offset
        )
        return {"success": True, "count": len(results), "corpora": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto-supplement/{dialect_id}", summary="自动补充方言语料")
async def auto_supplement_corpus(dialect_id: int, target_count: int = 100):
    try:
        connector = get_db_connector()
        result = connector.auto_supplement_corpus(dialect_id, target_count)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify/{corpus_id}", summary="审核验证语料")
async def verify_corpus(
    corpus_id: int,
    verified_by: str,
    quality_score: Optional[float] = None
):
    try:
        connector = get_db_connector()
        result = connector.verify_corpus(corpus_id, verified_by, quality_score)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-similarity/compare", summary="计算两段语音的相似度")
async def compare_voice_similarity(request: SimilarityCompareRequest):
    try:
        calculator = get_similarity_calculator()
        result = calculator.calculate_similarity(
            request.audio_path1,
            request.audio_path2,
            request.algorithm
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-similarity/compare-files", summary="上传音频文件比较相似度")
async def compare_voice_files(
    audio1: UploadFile = File(...),
    audio2: UploadFile = File(...),
    algorithm: str = "cosine"
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f1:
            f1.write(await audio1.read())
            temp_path1 = f1.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f2:
            f2.write(await audio2.read())
            temp_path2 = f2.name
        
        calculator = get_similarity_calculator()
        result = calculator.calculate_similarity(temp_path1, temp_path2, algorithm)
        
        os.unlink(temp_path1)
        os.unlink(temp_path2)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/voice-similarity/identify", summary="识别方言")
async def identify_dialect(
    audio: UploadFile = File(...),
    dialect_ids: List[int] = Query([1, 2, 3, 4, 5])
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
            f.write(await audio.read())
            temp_path = f.name
        
        calculator = get_similarity_calculator()
        
        dialect_refs = {}
        for did in dialect_ids:
            dialect_refs[did] = []
        
        result = calculator.identify_dialect(temp_path, dialect_refs)
        os.unlink(temp_path)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pronunciation/verify", summary="验证发音准确度")
async def verify_pronunciation(
    user_audio: UploadFile = File(...),
    standard_audio: UploadFile = File(...),
    text_content: str = Form("")
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f1:
            f1.write(await user_audio.read())
            user_path = f1.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f2:
            f2.write(await standard_audio.read())
            standard_path = f2.name
        
        verifier = get_voice_verifier()
        result = verifier.verify_pronunciation_accuracy(user_path, standard_path, text_content)
        
        os.unlink(user_path)
        os.unlink(standard_path)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/corpus/upload", summary="用户上传方言语料")
async def upload_corpus(
    dialect_id: int = Form(...),
    dialect_name: str = Form(...),
    text_content: str = Form(...),
    phonetic_transcription: str = Form(""),
    user_id: str = Form("anonymous"),
    tags: str = Form(""),
    notes: str = Form(""),
    audio_file: Optional[UploadFile] = File(None)
):
    try:
        audio_path = ""
        if audio_file:
            suffix = os.path.splitext(audio_file.filename)[1] or ".wav"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
                f.write(await audio_file.read())
                audio_path = f.name
        
        tag_list = [t.strip() for t in tags.split(",")] if tags else []
        
        manager = get_corpus_manager()
        result = manager.upload_corpus(
            user_id=user_id,
            dialect_id=dialect_id,
            dialect_name=dialect_name,
            text_content=text_content,
            audio_file_path=audio_path,
            phonetic_transcription=phonetic_transcription,
            tags=tag_list,
            notes=notes
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/corpus/verify", summary="审核用户语料")
async def verify_user_corpus(request: VerifyCorpusRequest):
    try:
        manager = get_corpus_manager()
        result = manager.verify_corpus(
            request.corpus_id,
            request.verified_by,
            request.is_approved,
            request.verification_notes
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/corpus/stats", summary="获取用户语料统计")
async def get_user_corpus_stats(user_id: Optional[str] = None, dialect_id: Optional[int] = None):
    try:
        manager = get_corpus_manager()
        stats = manager.get_user_corpus_stats(user_id, dialect_id)
        return {"success": True, "statistics": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/training/create-job", summary="创建增量训练任务")
async def create_training_job(request: CreateTrainingJobRequest):
    try:
        trainer = get_trainer()
        result = trainer.create_training_job(
            dialect_id=request.dialect_id,
            dialect_name=request.dialect_name,
            model_type=request.model_type,
            epochs=request.epochs,
            batch_size=request.batch_size,
            learning_rate=request.learning_rate,
            priority=request.priority
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/training/run/{job_id}", summary="执行训练任务")
async def run_training_job(job_id: str):
    try:
        trainer = get_trainer()
        result = trainer.run_training_job(job_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/training/status/{job_id}", summary="获取训练状态")
async def get_training_status(job_id: str):
    try:
        trainer = get_trainer()
        result = trainer.get_training_status(job_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/training/jobs", summary="列出训练任务")
async def list_training_jobs(dialect_id: Optional[int] = None, status: Optional[str] = None):
    try:
        trainer = get_trainer()
        jobs = trainer.list_training_jobs(dialect_id, status)
        return {"success": True, "count": len(jobs), "jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
