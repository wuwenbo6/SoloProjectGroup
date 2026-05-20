from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from typing import List, Optional
import re
from datetime import datetime
from ..core.database import get_db
from ..core.security import get_current_active_user, require_role
from ..models import User, UserRole, Annotation, AnnotationStatus, AudioSample
from ..schemas.correction import (
    BatchCorrectionRequest,
    BatchCorrectionItem,
    CorrectionType,
    CorrectionRule,
    ApplyRuleRequest
)

router = APIRouter(prefix="/correction", tags=["correction"])

CORRECTION_RULES = [
    CorrectionRule(
        id=1,
        name="常见错别字-的地得",
        description="统一处理助词使用错误",
        search_pattern=r"[的地得]",
        replace_pattern="",
        is_active=True
    ),
    CorrectionRule(
        id=2,
        name="数字标准化",
        description="将阿拉伯数字转成方言标注常用的汉字数字",
        search_pattern=r"(\d+)",
        replace_pattern="",
        is_active=True
    ),
    CorrectionRule(
        id=3,
        name="标点符号统一",
        description="统一使用中文标点符号",
        search_pattern=r"[,.!?;:]",
        replace_pattern="",
        is_active=True
    )
]


@router.post("/batch", status_code=status.HTTP_200_OK)
async def batch_correct_annotations(
    request: BatchCorrectionRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.REVIEWER)),
    db: AsyncSession = Depends(get_db)
):
    results = []
    error_count = 0
    success_count = 0

    for item in request.corrections:
        try:
            annotation = await db.get(Annotation, item.annotation_id)
            if not annotation:
                results.append({"id": item.annotation_id, "status": "error", "message": "Annotation not found"})
                error_count += 1
                continue

            if request.correction_type in [CorrectionType.TEXT, CorrectionType.ALL]:
                if item.text is not None:
                    annotation.text = item.text

            if request.correction_type in [CorrectionType.PHONETIC, CorrectionType.ALL]:
                if item.phonetic_transcription is not None:
                    annotation.phonetic_transcription = item.phonetic_transcription

            if request.correction_type in [CorrectionType.DIALECT_CATEGORY, CorrectionType.ALL]:
                if item.dialect_category_id is not None:
                    audio_sample = await db.get(AudioSample, annotation.audio_sample_id)
                    if audio_sample:
                        audio_sample.dialect_category_id = item.dialect_category_id

            if request.correction_type in [CorrectionType.QUALITY_SCORE, CorrectionType.ALL]:
                if item.quality_score is not None:
                    annotation.quality_score = item.quality_score

            annotation.reviewer_id = current_user.id
            annotation.reviewed_at = datetime.utcnow()
            if request.reviewer_comment:
                annotation.reviewer_comments = request.reviewer_comment

            await db.commit()
            success_count += 1
            results.append({"id": item.annotation_id, "status": "success"})

        except Exception as e:
            error_count += 1
            results.append({"id": item.annotation_id, "status": "error", "message": str(e)})

    return {
        "success_count": success_count,
        "error_count": error_count,
        "results": results
    }


@router.get("/rules", response_model=List[CorrectionRule])
async def get_correction_rules(
    dialect_category_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user)
):
    rules = CORRECTION_RULES
    if dialect_category_id:
        rules = [r for r in rules if r.dialect_category_id == dialect_category_id or r.dialect_category_id is None]
    return [r for r in rules if r.is_active]


@router.post("/apply-rule", status_code=status.HTTP_200_OK)
async def apply_correction_rule(
    request: ApplyRuleRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.REVIEWER)),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).where(Annotation.is_accepted == True)
    
    if request.annotation_ids:
        query = query.where(Annotation.id.in_(request.annotation_ids))
    if request.dialect_category_id:
        query = query.join(AudioSample).where(
            AudioSample.dialect_category_id == request.dialect_category_id
        )
    
    result = await db.execute(query)
    annotations = result.scalars().all()
    
    rules = [r for r in CORRECTION_RULES if r.id in request.rule_ids and r.is_active]
    
    updated_count = 0
    for annotation in annotations:
        original_text = annotation.text
        for rule in rules:
            if rule.search_pattern:
                try:
                    annotation.text = re.sub(rule.search_pattern, rule.replace_pattern, annotation.text)
                except:
                    pass
        
        if original_text != annotation.text:
            updated_count += 1
            annotation.reviewer_id = current_user.id
            annotation.reviewed_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "processed_count": len(annotations),
        "updated_count": updated_count,
        "applied_rules": [r.name for r in rules]
    }


@router.get("/find-errors")
async def find_annotation_errors(
    annotation_status: Optional[AnnotationStatus] = None,
    dialect_category_id: Optional[int] = None,
    min_length: int = 5,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).join(AudioSample)
    
    if annotation_status:
        query = query.where(AudioSample.annotation_status == annotation_status)
    if dialect_category_id:
        query = query.where(AudioSample.dialect_category_id == dialect_category_id)
    
    result = await db.execute(query)
    annotations = result.scalars().all()
    
    errors = []
    for ann in annotations:
        ann_errors = []
        
        if len(ann.text) < min_length:
            ann_errors.append({"type": "short_text", "message": f"文本过短，仅{len(ann.text)}字符"})
        
        if re.search(r"[a-zA-Z]", ann.text):
            ann_errors.append({"type": "contains_english", "message": "包含英文字符"})
        
        if re.search(r"[\uFF01-\uFF5E]", ann.text):
            ann_errors.append({"type": "fullwidth_chars", "message": "包含全角字符"})
        
        if ann_errors:
            errors.append({
                "annotation_id": ann.id,
                "audio_sample_id": ann.audio_sample_id,
                "current_text": ann.text,
                "errors": ann_errors
            })
    
    return {
        "total_checked": len(annotations),
        "error_count": len(errors),
        "errors": errors
    }


@router.post("/reject-batch", status_code=status.HTTP_200_OK)
async def batch_reject_annotations(
    annotation_ids: List[int],
    reviewer_comment: str = "批量驳回",
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER, UserRole.REVIEWER)),
    db: AsyncSession = Depends(get_db)
):
    success_count = 0
    error_count = 0
    
    for ann_id in annotation_ids:
        try:
            annotation = await db.get(Annotation, ann_id)
            if annotation:
                annotation.is_accepted = False
                annotation.reviewer_id = current_user.id
                annotation.reviewer_comments = reviewer_comment
                annotation.reviewed_at = datetime.utcnow()
                
                audio_sample = await db.get(AudioSample, annotation.audio_sample_id)
                if audio_sample:
                    audio_sample.annotation_status = AnnotationStatus.UNANNOTATED
                
                success_count += 1
        except Exception:
            error_count += 1
    
    await db.commit()
    
    return {
        "success_count": success_count,
        "error_count": error_count
    }
