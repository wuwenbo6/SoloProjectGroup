from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import os
import uuid
from ..core.database import get_db
from ..core.security import get_current_active_user, require_role
from ..models import User, UserRole, AudioSample, Annotation, AnnotationStatus
from ..utils.audio_utils import extract_audio_features
from ..services.clustering_service import clustering_service
import numpy as np

router = APIRouter(prefix="/pronunciation", tags=["pronunciation"])


@router.post("/set-standard/{sample_id}")
async def set_standard_pronunciation(
    sample_id: int,
    file: UploadFile = File(...),
    source: Optional[str] = None,
    standard_text: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")

    upload_dir = "./uploads/standard_pronunciations"
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = file.filename.split(".")[-1].lower()
    file_uuid = str(uuid.uuid4())
    new_filename = f"{file_uuid}.{file_ext}"
    file_path = os.path.join(upload_dir, new_filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    sample.standard_pronunciation_path = file_path
    sample.standard_pronunciation_source = source
    sample.standard_pronunciation_text = standard_text

    try:
        dialect_features = extract_audio_features(file_path)
        if dialect_features is not None and sample.feature_vector:
            sample_vector = np.array(clustering_service._json_to_vector(sample.feature_vector))
            similarity = np.dot(sample_vector, dialect_features) / (
                np.linalg.norm(sample_vector) * np.linalg.norm(dialect_features)
            )
            sample.pronunciation_similarity_score = float(similarity)
    except Exception:
        pass

    await db.commit()
    await db.refresh(sample)

    return {
        "sample_id": sample_id,
        "standard_pronunciation_set": True,
        "similarity_score": sample.pronunciation_similarity_score
    }


@router.get("/compare/{sample_id}")
async def compare_pronunciation(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Audio sample not found")

    has_standard = sample.standard_pronunciation_path is not None and os.path.exists(
        sample.standard_pronunciation_path
    )

    annotation = await db.execute(
        select(Annotation).where(Annotation.audio_sample_id == sample_id).limit(1)
    )
    annotation = annotation.scalar_one_or_none()

    return {
        "sample_id": sample_id,
        "dialect_audio_url": f"/api/v1/audio/{sample_id}/stream",
        "dialect_text": annotation.text if annotation else None,
        "has_standard_pronunciation": has_standard,
        "standard_audio_url": (
            f"/api/v1/pronunciation/standard/{sample_id}/stream"
            if has_standard
            else None
        ),
        "standard_text": sample.standard_pronunciation_text,
        "standard_source": sample.standard_pronunciation_source,
        "similarity_score": sample.pronunciation_similarity_score,
        "dialect_category": {
            "id": sample.dialect_category_id,
        } if sample.dialect_category_id else None
    }


@router.get("/standard/{sample_id}/stream")
async def stream_standard_pronunciation(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    sample = await db.get(AudioSample, sample_id)
    if not sample or not sample.standard_pronunciation_path:
        raise HTTPException(status_code=404, detail="Standard pronunciation not found")

    if not os.path.exists(sample.standard_pronunciation_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        sample.standard_pronunciation_path,
        media_type="audio/wav"
    )


@router.get("/need-standard")
async def get_samples_needing_standard(
    skip: int = 0,
    limit: int = 50,
    dialect_category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AudioSample).where(
        AudioSample.annotation_status == AnnotationStatus.ACCEPTED,
        AudioSample.standard_pronunciation_path.is_(None)
    )

    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    samples = result.scalars().all()

    return {
        "total": len(samples),
        "samples": [
            {
                "id": s.id,
                "filename": s.original_filename,
                "dialect_category_id": s.dialect_category_id,
                "duration": s.duration
            }
            for s in samples
        ]
    }


@router.get("/with-standard")
async def get_samples_with_standard(
    skip: int = 0,
    limit: int = 50,
    dialect_category_id: Optional[int] = None,
    min_similarity: Optional[float] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AudioSample).where(AudioSample.standard_pronunciation_path.is_not(None))

    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)
    if min_similarity is not None:
        query = query.where(AudioSample.pronunciation_similarity_score >= min_similarity)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    samples = result.scalars().all()

    return {
        "total": len(samples),
        "samples": [
            {
                "id": s.id,
                "filename": s.original_filename,
                "standard_source": s.standard_pronunciation_source,
                "similarity_score": s.pronunciation_similarity_score,
                "dialect_category_id": s.dialect_category_id
            }
            for s in samples
        ]
    }


@router.post("/auto-assign")
async def auto_assign_standard_pronunciations(
    dialect_category_id: Optional[int] = None,
    min_quality_score: float = 0.8,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    query = select(AudioSample).where(
        AudioSample.annotation_status == AnnotationStatus.ACCEPTED,
        AudioSample.standard_pronunciation_path.is_(None)
    )

    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)

    result = await db.execute(query)
    samples = result.scalars().all()

    assigned_count = 0
    for sample in samples:
        ann_result = await db.execute(
            select(Annotation).where(
                Annotation.audio_sample_id == sample.id,
                Annotation.quality_score >= min_quality_score
            ).limit(1)
        )
        annotation = ann_result.scalar_one_or_none()

        if annotation:
            sample.standard_pronunciation_path = sample.file_path
            sample.standard_pronunciation_text = annotation.text
            sample.standard_pronunciation_source = "auto-assigned"
            sample.pronunciation_similarity_score = 1.0
            assigned_count += 1

    await db.commit()

    return {
        "assigned_count": assigned_count,
        "total_samples": len(samples)
    }
