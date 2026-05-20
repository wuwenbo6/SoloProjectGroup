from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import os
import uuid
import shutil
import aiofiles
from pydantic import BaseModel
from ..core.database import get_db
from ..core.security import get_current_active_user
from ..models import User, AudioSample, AnnotationStatus
from ..schemas import AudioSampleResponse, AudioSampleCreate, AudioSegmentRequest
from ..utils.audio_utils import (
    save_uploaded_file,
    get_audio_info,
    get_file_size,
    allowed_file,
    segment_audio,
    cleanup_temp_files
)
from ..core.config import settings
from ..services.clustering_service import clustering_service

router = APIRouter(prefix="/audio", tags=["audio"])


class CompleteUploadRequest(BaseModel):
    fileId: str
    filename: str
    totalChunks: int
    collector_name: Optional[str] = None
    collection_location: Optional[str] = None
    speaker_age: Optional[int] = None
    speaker_gender: Optional[str] = None
    speaker_education: Optional[str] = None
    dialect_category_id: Optional[int] = None


@router.post("/upload", response_model=AudioSampleResponse, status_code=status.HTTP_201_CREATED)
async def upload_audio(
    file: UploadFile = File(...),
    collector_name: Optional[str] = None,
    collection_location: Optional[str] = None,
    speaker_age: Optional[int] = None,
    speaker_gender: Optional[str] = None,
    speaker_education: Optional[str] = None,
    dialect_category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {settings.ALLOWED_EXTENSIONS}"
        )
    
    file_path, file_uuid = await save_uploaded_file(file)
    
    audio_info = get_audio_info(file_path)
    if "error" in audio_info:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio file: {audio_info['error']}"
        )
    
    file_size = get_file_size(file_path)
    
    audio_sample = AudioSample(
        uuid=file_uuid,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        duration=audio_info.get("duration"),
        sample_rate=audio_info.get("sample_rate"),
        channels=audio_info.get("channels"),
        format=audio_info.get("format"),
        collector_name=collector_name,
        collection_location=collection_location,
        speaker_age=speaker_age,
        speaker_gender=speaker_gender,
        speaker_education=speaker_education,
        dialect_category_id=dialect_category_id,
        annotation_status=AnnotationStatus.UNANNOTATED
    )
    
    db.add(audio_sample)
    await db.commit()
    await db.refresh(audio_sample)
    
    await clustering_service.extract_and_save_features(db, audio_sample, file_path)
    
    return audio_sample


@router.get("/", response_model=List[AudioSampleResponse])
async def get_audio_samples(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[AnnotationStatus] = None,
    region: Optional[str] = None,
    dialect_category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AudioSample)
    
    if status_filter:
        query = query.where(AudioSample.annotation_status == status_filter)
    if region:
        query = query.where(AudioSample.collection_location.like(f"%{region}%"))
    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    samples = result.scalars().all()
    return samples


@router.get("/{sample_id}", response_model=AudioSampleResponse)
async def get_audio_sample(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    return sample


@router.get("/{sample_id}/stream")
async def stream_audio(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    
    if not os.path.exists(sample.file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on server")
    
    return FileResponse(
        sample.file_path,
        media_type=f"audio/{sample.format}" if sample.format else "audio/wav",
        filename=sample.original_filename
    )


@router.post("/segment", response_model=AudioSampleResponse)
async def create_audio_segment(
    segment_request: AudioSegmentRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    parent_sample = await db.get(AudioSample, segment_request.audio_sample_id)
    if not parent_sample:
        raise HTTPException(status_code=404, detail="Parent audio sample not found")
    
    segment_uuid = str(uuid.uuid4())
    output_path = os.path.join(settings.UPLOAD_DIR, f"{segment_uuid}_segment.wav")
    
    success = segment_audio(
        parent_sample.file_path,
        output_path,
        segment_request.start_time,
        segment_request.end_time
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create audio segment"
        )
    
    audio_info = get_audio_info(output_path)
    file_size = get_file_size(output_path)
    
    segment = AudioSample(
        uuid=segment_uuid,
        original_filename=f"segment_{parent_sample.original_filename}",
        file_path=output_path,
        file_size=file_size,
        duration=audio_info.get("duration"),
        sample_rate=audio_info.get("sample_rate"),
        format="wav",
        is_segmented=True,
        parent_id=parent_sample.id,
        start_time=segment_request.start_time,
        end_time=segment_request.end_time,
        collection_location=parent_sample.collection_location,
        dialect_category_id=parent_sample.dialect_category_id,
        annotation_status=AnnotationStatus.UNANNOTATED
    )
    
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    
    await clustering_service.extract_and_save_features(db, segment, output_path)
    
    return segment


@router.put("/{sample_id}", response_model=AudioSampleResponse)
async def update_audio_sample(
    sample_id: int,
    sample_in: AudioSampleCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    
    update_data = sample_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sample, field, value)
    
    await db.commit()
    await db.refresh(sample)
    return sample


@router.delete("/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio_sample(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")
    
    if os.path.exists(sample.file_path):
        os.remove(sample.file_path)
    
    await db.delete(sample)
    await db.commit()
    return None


@router.get("/check-upload")
async def check_upload_status(
    fileId: str = Query(...),
    current_user: User = Depends(get_current_active_user)
):
    temp_dir = os.path.join(settings.UPLOAD_DIR, "chunks", fileId)
    
    if not os.path.exists(temp_dir):
        return {"fileId": fileId, "completed": False, "uploadedChunks": []}
    
    result = await db.execute(
        select(AudioSample).where(AudioSample.uuid == fileId)
    )
    existing_sample = result.scalar_one_or_none()
    if existing_sample:
        return {"fileId": fileId, "completed": True, "sample": existing_sample}
    
    uploaded_chunks = []
    if os.path.exists(temp_dir):
        for f in os.listdir(temp_dir):
            if f.startswith("chunk_"):
                try:
                    idx = int(f.split("_")[1].split(".")[0])
                    uploaded_chunks.append(idx)
                except:
                    pass
    
    return {"fileId": fileId, "completed": False, "uploadedChunks": uploaded_chunks}


@router.post("/upload-chunk")
async def upload_chunk(
    fileId: str = Form(...),
    chunkIndex: int = Form(...),
    totalChunks: int = Form(...),
    filename: str = Form(...),
    chunk: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if not allowed_file(filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed"
        )
    
    temp_dir = os.path.join(settings.UPLOAD_DIR, "chunks", fileId)
    os.makedirs(temp_dir, exist_ok=True)
    
    chunk_path = os.path.join(temp_dir, f"chunk_{chunkIndex}")
    
    async with aiofiles.open(chunk_path, 'wb') as out_file:
        content = await chunk.read()
        await out_file.write(content)
    
    return {
        "fileId": fileId,
        "chunkIndex": chunkIndex,
        "status": "received"
    }


@router.post("/complete-upload", response_model=AudioSampleResponse)
async def complete_upload(
    request: CompleteUploadRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    temp_dir = os.path.join(settings.UPLOAD_DIR, "chunks", request.fileId)
    
    if not os.path.exists(temp_dir):
        raise HTTPException(status_code=400, detail="No chunks found")
    
    existing_result = await db.execute(
        select(AudioSample).where(AudioSample.uuid == request.fileId)
    )
    existing_sample = existing_result.scalar_one_or_none()
    if existing_sample:
        return existing_sample
    
    file_ext = request.filename.split(".")[-1].lower()
    final_filename = f"{request.fileId}.{file_ext}"
    final_path = os.path.join(settings.UPLOAD_DIR, final_filename)
    
    try:
        with open(final_path, 'wb') as outfile:
            for i in range(request.totalChunks):
                chunk_path = os.path.join(temp_dir, f"chunk_{i}")
                if not os.path.exists(chunk_path):
                    raise HTTPException(status_code=400, detail=f"Missing chunk {i}")
                
                with open(chunk_path, 'rb') as infile:
                    shutil.copyfileobj(infile, outfile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge chunks: {str(e)}")
    
    audio_info = get_audio_info(final_path)
    if "error" in audio_info:
        os.remove(final_path)
        raise HTTPException(status_code=400, detail="Invalid audio file")
    
    file_size = get_file_size(final_path)
    
    audio_sample = AudioSample(
        uuid=request.fileId,
        original_filename=request.filename,
        file_path=final_path,
        file_size=file_size,
        duration=audio_info.get("duration"),
        sample_rate=audio_info.get("sample_rate"),
        channels=audio_info.get("channels"),
        format=audio_info.get("format"),
        collector_name=request.collector_name,
        collection_location=request.collection_location,
        speaker_age=request.speaker_age,
        speaker_gender=request.speaker_gender,
        speaker_education=request.speaker_education,
        dialect_category_id=request.dialect_category_id,
        annotation_status=AnnotationStatus.UNANNOTATED
    )
    
    db.add(audio_sample)
    await db.commit()
    await db.refresh(audio_sample)
    
    await clustering_service.extract_and_save_features(db, audio_sample, final_path)
    
    try:
        shutil.rmtree(temp_dir)
    except:
        pass
    
    await cleanup_temp_files(settings.UPLOAD_DIR, hours=24)
    
    return audio_sample
