from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models.database import get_db, CorpusAnnotation, AnnotationLabel, AnnotationProject, Corpus

router = APIRouter()

class AnnotationCreate(BaseModel):
    corpus_id: int
    annotation_type: str
    label: str
    value: Optional[str] = None
    confidence: Optional[float] = 1.0
    annotator: Optional[str] = None
    comment: Optional[str] = None

class AnnotationUpdate(BaseModel):
    label: Optional[str] = None
    value: Optional[str] = None
    confidence: Optional[float] = None
    comment: Optional[str] = None
    is_verified: Optional[bool] = None
    verified_by: Optional[str] = None

class LabelCreate(BaseModel):
    label_type: str
    label_name: str
    label_value: Optional[str] = None
    description: Optional[str] = None
    dialect_id: Optional[int] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dialect_id: Optional[int] = None
    annotation_types: Optional[str] = None
    created_by: Optional[str] = None

@router.post("/annotations")
async def create_annotation(
    annotation: AnnotationCreate,
    db: Session = Depends(get_db)
):
    try:
        db_annotation = CorpusAnnotation(
            corpus_id=annotation.corpus_id,
            annotation_type=annotation.annotation_type,
            label=annotation.label,
            value=annotation.value,
            confidence=annotation.confidence,
            annotator=annotation.annotator,
            comment=annotation.comment
        )
        db.add(db_annotation)
        db.commit()
        db.refresh(db_annotation)
        
        return {
            "success": True,
            "annotation": db_annotation,
            "message": "标注创建成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建标注失败: {str(e)}")

@router.get("/annotations/corpus/{corpus_id}")
async def get_corpus_annotations(
    corpus_id: int,
    annotation_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CorpusAnnotation).filter(CorpusAnnotation.corpus_id == corpus_id)
    if annotation_type:
        query = query.filter(CorpusAnnotation.annotation_type == annotation_type)
    
    annotations = query.order_by(CorpusAnnotation.created_at.desc()).all()
    
    return {
        "total": len(annotations),
        "annotations": annotations
    }

@router.put("/annotations/{annotation_id}")
async def update_annotation(
    annotation_id: int,
    update: AnnotationUpdate,
    db: Session = Depends(get_db)
):
    annotation = db.query(CorpusAnnotation).filter(CorpusAnnotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(annotation, field, value)
    
    if update.is_verified:
        annotation.verified_at = datetime.utcnow()
    
    annotation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(annotation)
    
    return {
        "success": True,
        "annotation": annotation,
        "message": "标注更新成功"
    }

@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: int,
    db: Session = Depends(get_db)
):
    annotation = db.query(CorpusAnnotation).filter(CorpusAnnotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    
    db.delete(annotation)
    db.commit()
    
    return {
        "success": True,
        "message": "标注删除成功"
    }

@router.post("/labels")
async def create_label(
    label: LabelCreate,
    db: Session = Depends(get_db)
):
    try:
        db_label = AnnotationLabel(
            label_type=label.label_type,
            label_name=label.label_name,
            label_value=label.label_value,
            description=label.description,
            dialect_id=label.dialect_id
        )
        db.add(db_label)
        db.commit()
        db.refresh(db_label)
        
        return {
            "success": True,
            "label": db_label,
            "message": "标签创建成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建标签失败: {str(e)}")

@router.get("/labels")
async def get_labels(
    label_type: Optional[str] = None,
    dialect_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AnnotationLabel).filter(AnnotationLabel.is_active == True)
    if label_type:
        query = query.filter(AnnotationLabel.label_type == label_type)
    if dialect_id:
        query = query.filter(AnnotationLabel.dialect_id == dialect_id)
    
    labels = query.order_by(AnnotationLabel.label_name).all()
    
    return {
        "total": len(labels),
        "labels": labels
    }

@router.get("/labels/types")
async def get_label_types(db: Session = Depends(get_db)):
    types = db.query(AnnotationLabel.label_type).distinct().all()
    return {
        "label_types": [t[0] for t in types]
    }

@router.post("/projects")
async def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db)
):
    try:
        db_project = AnnotationProject(
            name=project.name,
            description=project.description,
            dialect_id=project.dialect_id,
            annotation_types=project.annotation_types,
            created_by=project.created_by
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        
        return {
            "success": True,
            "project": db_project,
            "message": "标注项目创建成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建项目失败: {str(e)}")

@router.get("/projects")
async def get_projects(
    status: Optional[str] = None,
    dialect_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AnnotationProject)
    if status:
        query = query.filter(AnnotationProject.status == status)
    if dialect_id:
        query = query.filter(AnnotationProject.dialect_id == dialect_id)
    
    projects = query.order_by(AnnotationProject.created_at.desc()).all()
    
    return {
        "total": len(projects),
        "projects": projects
    }

@router.get("/projects/{project_id}/stats")
async def get_project_stats(
    project_id: int,
    db: Session = Depends(get_db)
):
    project = db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    total_annotations = db.query(CorpusAnnotation).count()
    verified_annotations = db.query(CorpusAnnotation).filter(CorpusAnnotation.is_verified == True).count()
    
    annotation_by_type = db.query(
        CorpusAnnotation.annotation_type,
        db.func.count(CorpusAnnotation.id)
    ).group_by(CorpusAnnotation.annotation_type).all()
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "total_annotations": total_annotations,
        "verified_annotations": verified_annotations,
        "annotation_by_type": {
            at: count for at, count in annotation_by_type
        }
    }

@router.get("/unannotated")
async def get_unannotated_corpora(
    dialect_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    annotated_corpus_ids = db.query(CorpusAnnotation.corpus_id).distinct()
    
    query = db.query(Corpus).filter(~Corpus.id.in_(annotated_corpus_ids))
    if dialect_id:
        query = query.filter(Corpus.dialect_id == dialect_id)
    
    corpora = query.limit(limit).all()
    
    return {
        "total": query.count(),
        "corpora": corpora
    }

@router.post("/batch-annotate")
async def batch_annotate(
    annotations: List[AnnotationCreate],
    db: Session = Depends(get_db)
):
    try:
        created_count = 0
        for ann in annotations:
            db_annotation = CorpusAnnotation(
                corpus_id=ann.corpus_id,
                annotation_type=ann.annotation_type,
                label=ann.label,
                value=ann.value,
                confidence=ann.confidence,
                annotator=ann.annotator,
                comment=ann.comment
            )
            db.add(db_annotation)
            created_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "created_count": created_count,
            "message": f"批量标注成功，创建了 {created_count} 条标注"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"批量标注失败: {str(e)}")

@router.get("/annotation-types")
async def get_annotation_types():
    types = [
        {"id": "phonetic", "name": "音标标注", "description": "方言发音的国际音标标注"},
        {"id": "tone", "name": "声调标注", "description": "声调类型和调值标注"},
        {"id": "emotion", "name": "情感标注", "description": "语音情感倾向标注"},
        {"id": "quality", "name": "质量标注", "description": "语音质量评分标注"},
        {"id": "transcription", "name": "文本转写", "description": "语音内容的文字转写"},
        {"id": "dialect_tag", "name": "方言标签", "description": "方言分类标签标注"}
    ]
    return {
        "annotation_types": types
    }
