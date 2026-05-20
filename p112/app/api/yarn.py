from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import uuid
import os
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import json

from app.core.config import settings
from app.core.database import get_db
from app.models.yarn import YarnDetection, ModelVersion
from app.schemas.yarn import (
    YarnDetectionResponse,
    BatchAnalysisResult,
    HistoryResponse,
    BatchCompareRequest,
    BatchCompareResponse,
    BatchStatistics,
    DensityStatisticsResponse,
    DefectTraceResponse,
    SimilarImage,
    ModelUpdateRequest,
    ModelUpdateResponse,
    ModelStatusResponse,
    ModelVersionResponse
)
from app.utils.image_processor import processor

logger = logging.getLogger(__name__)
router = APIRouter()

PROCESS_TIMEOUT = 30.0
MAX_BATCH_SIZE = 100


def save_upload_file(file: UploadFile) -> tuple:
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    ext = file.filename.split(".")[-1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式，仅支持: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = settings.UPLOAD_DIR / unique_filename
    
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())
    except Exception as e:
        logger.error(f"保存文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")
    
    return str(file_path), file.filename


async def process_single_detection(detection: YarnDetection, db: Session) -> Dict:
    try:
        result = await processor.analyze_image_async(detection.file_path, PROCESS_TIMEOUT)
        
        detection.hairiness_detected = result["hairiness"]["detected"]
        detection.hairiness_score = result["hairiness"]["score"]
        detection.hairiness_details = result["hairiness"]["details"]
        
        detection.breakage_detected = result["breakage"]["detected"]
        detection.breakage_score = result["breakage"]["score"]
        detection.breakage_details = result["breakage"]["details"]
        
        detection.thickness_abnormal = result["thickness"]["abnormal"]
        detection.thickness_mean = result["thickness"]["mean"]
        detection.thickness_std = result["thickness"]["std"]
        detection.thickness_details = result["thickness"]["details"]
        
        detection.density_abnormal = result["density"]["abnormal"]
        detection.density = result["density"]["density"]
        detection.density_std = result["density"]["density_std"]
        detection.density_details = result["density"]["details"]
        
        detection.image_hash = result["image_hash"]
        detection.feature_vector = result["feature_vector"]
        
        detection.overall_status = result["overall_status"]
        
        return {"success": True, "detection": detection, "error": None}
    except Exception as e:
        logger.error(f"批量处理单条失败: {detection.id}, {str(e)}")
        return {"success": False, "detection": detection, "error": str(e)}


@router.post("/upload", response_model=YarnDetectionResponse)
async def upload_image(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        file_path, filename = save_upload_file(file)
        
        detection = YarnDetection(
            filename=filename,
            file_path=file_path,
            batch_id=batch_id,
            overall_status="pending"
        )
        db.add(detection)
        db.commit()
        db.refresh(detection)
        
        return detection
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/detect/hairiness/{detection_id}", response_model=YarnDetectionResponse)
async def detect_hairiness(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        loop = asyncio.get_event_loop()
        detected, score, details = await asyncio.wait_for(
            loop.run_in_executor(None, processor.detect_hairiness, detection.file_path),
            timeout=PROCESS_TIMEOUT
        )
        
        detection.hairiness_detected = detected
        detection.hairiness_score = score
        detection.hairiness_details = details
        
        has_abnormal = (detected or detection.breakage_detected or 
                       detection.thickness_abnormal or detection.density_abnormal)
        detection.overall_status = "abnormal" if has_abnormal else "normal"
        
        db.commit()
        db.refresh(detection)
        
        return detection
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="处理超时，请重试")
    except Exception as e:
        logger.error(f"毛羽检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/detect/breakage/{detection_id}", response_model=YarnDetectionResponse)
async def detect_breakage(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        loop = asyncio.get_event_loop()
        detected, score, details = await asyncio.wait_for(
            loop.run_in_executor(None, processor.detect_breakage, detection.file_path),
            timeout=PROCESS_TIMEOUT
        )
        
        detection.breakage_detected = detected
        detection.breakage_score = score
        detection.breakage_details = details
        
        has_abnormal = (detection.hairiness_detected or detected or 
                       detection.thickness_abnormal or detection.density_abnormal)
        detection.overall_status = "abnormal" if has_abnormal else "normal"
        
        db.commit()
        db.refresh(detection)
        
        return detection
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="处理超时，请重试")
    except Exception as e:
        logger.error(f"断纱检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/detect/thickness/{detection_id}", response_model=YarnDetectionResponse)
async def detect_thickness(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        loop = asyncio.get_event_loop()
        abnormal, mean, std, details = await asyncio.wait_for(
            loop.run_in_executor(None, processor.detect_thickness_abnormality, detection.file_path),
            timeout=PROCESS_TIMEOUT
        )
        
        detection.thickness_abnormal = abnormal
        detection.thickness_mean = mean
        detection.thickness_std = std
        detection.thickness_details = details
        
        has_abnormal = (detection.hairiness_detected or detection.breakage_detected or 
                       abnormal or detection.density_abnormal)
        detection.overall_status = "abnormal" if has_abnormal else "normal"
        
        db.commit()
        db.refresh(detection)
        
        return detection
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="处理超时，请重试")
    except Exception as e:
        logger.error(f"粗细检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/detect/density/{detection_id}", response_model=YarnDetectionResponse)
async def detect_density(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        loop = asyncio.get_event_loop()
        abnormal, density, density_std, details = await asyncio.wait_for(
            loop.run_in_executor(None, processor.detect_density, detection.file_path),
            timeout=PROCESS_TIMEOUT
        )
        
        detection.density_abnormal = abnormal
        detection.density = density
        detection.density_std = density_std
        detection.density_details = details
        
        has_abnormal = (detection.hairiness_detected or detection.breakage_detected or 
                       detection.thickness_abnormal or abnormal)
        detection.overall_status = "abnormal" if has_abnormal else "normal"
        
        db.commit()
        db.refresh(detection)
        
        return detection
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="处理超时，请重试")
    except Exception as e:
        logger.error(f"密度检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/detect/all/{detection_id}", response_model=YarnDetectionResponse)
async def detect_all(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        result = await processor.analyze_image_async(detection.file_path, PROCESS_TIMEOUT)
        
        detection.hairiness_detected = result["hairiness"]["detected"]
        detection.hairiness_score = result["hairiness"]["score"]
        detection.hairiness_details = result["hairiness"]["details"]
        
        detection.breakage_detected = result["breakage"]["detected"]
        detection.breakage_score = result["breakage"]["score"]
        detection.breakage_details = result["breakage"]["details"]
        
        detection.thickness_abnormal = result["thickness"]["abnormal"]
        detection.thickness_mean = result["thickness"]["mean"]
        detection.thickness_std = result["thickness"]["std"]
        detection.thickness_details = result["thickness"]["details"]
        
        detection.density_abnormal = result["density"]["abnormal"]
        detection.density = result["density"]["density"]
        detection.density_std = result["density"]["density_std"]
        detection.density_details = result["density"]["details"]
        
        detection.image_hash = result["image_hash"]
        detection.feature_vector = result["feature_vector"]
        
        detection.overall_status = result["overall_status"]
        
        db.commit()
        db.refresh(detection)
        
        return detection
    except Exception as e:
        logger.error(f"全量检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/upload-and-detect", response_model=YarnDetectionResponse)
async def upload_and_detect(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        file_path, filename = save_upload_file(file)
        
        result = await processor.analyze_image_async(file_path, PROCESS_TIMEOUT)
        
        detection = YarnDetection(
            filename=filename,
            file_path=file_path,
            batch_id=batch_id,
            hairiness_detected=result["hairiness"]["detected"],
            hairiness_score=result["hairiness"]["score"],
            hairiness_details=result["hairiness"]["details"],
            breakage_detected=result["breakage"]["detected"],
            breakage_score=result["breakage"]["score"],
            breakage_details=result["breakage"]["details"],
            thickness_abnormal=result["thickness"]["abnormal"],
            thickness_mean=result["thickness"]["mean"],
            thickness_std=result["thickness"]["std"],
            thickness_details=result["thickness"]["details"],
            density_abnormal=result["density"]["abnormal"],
            density=result["density"]["density"],
            density_std=result["density"]["density_std"],
            density_details=result["density"]["details"],
            image_hash=result["image_hash"],
            feature_vector=result["feature_vector"],
            overall_status=result["overall_status"]
        )
        db.add(detection)
        db.commit()
        db.refresh(detection)
        
        return detection
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传检测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/batch-analyze/{batch_id}", response_model=BatchAnalysisResult)
async def batch_analyze(
    batch_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    detections = db.query(YarnDetection).filter(YarnDetection.batch_id == batch_id).all()
    
    if not detections:
        raise HTTPException(status_code=404, detail="批次不存在或无数据")
    
    if len(detections) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"批次数据过多({len(detections)}条)，单次最多处理{MAX_BATCH_SIZE}条"
        )
    
    pending_detections = [d for d in detections if d.overall_status == "pending"]
    
    if pending_detections:
        semaphore = asyncio.Semaphore(5)
        
        async def process_with_semaphore(detection):
            async with semaphore:
                return await process_single_detection(detection, db)
        
        tasks = [process_with_semaphore(d) for d in pending_detections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, dict) and result.get("success"):
                pass
        
        try:
            db.commit()
        except Exception as e:
            logger.error(f"批量提交数据库失败: {str(e)}")
            db.rollback()
    
    detections = db.query(YarnDetection).filter(YarnDetection.batch_id == batch_id).all()
    
    total_count = len(detections)
    hairiness_count = sum(1 for d in detections if d.hairiness_detected)
    breakage_count = sum(1 for d in detections if d.breakage_detected)
    thickness_abnormal_count = sum(1 for d in detections if d.thickness_abnormal)
    density_abnormal_count = sum(1 for d in detections if d.density_abnormal)
    abnormal_count = sum(1 for d in detections if d.overall_status == "abnormal")
    normal_count = total_count - abnormal_count
    error_count = sum(1 for d in detections if d.overall_status == "error")
    
    valid_detections = [d for d in detections if d.overall_status != "error"]
    avg_density = sum(d.density for d in valid_detections) / len(valid_detections) if valid_detections else 0
    avg_thickness = sum(d.thickness_mean for d in valid_detections) / len(valid_detections) if valid_detections else 0
    avg_hairiness = sum(d.hairiness_score for d in valid_detections) / len(valid_detections) if valid_detections else 0
    
    return BatchAnalysisResult(
        batch_id=batch_id,
        total_count=total_count,
        hairiness_count=hairiness_count,
        breakage_count=breakage_count,
        thickness_abnormal_count=thickness_abnormal_count,
        density_abnormal_count=density_abnormal_count,
        abnormal_count=abnormal_count,
        normal_count=normal_count,
        error_count=error_count,
        average_density=avg_density,
        average_thickness=avg_thickness,
        average_hairiness=avg_hairiness,
        details=detections
    )


@router.post("/batch-compare", response_model=BatchCompareResponse)
async def batch_compare(
    request: BatchCompareRequest,
    db: Session = Depends(get_db)
):
    if len(request.batch_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要比较2个批次")
    
    batch_statistics = []
    
    for batch_id in request.batch_ids:
        detections = db.query(YarnDetection).filter(
            YarnDetection.batch_id == batch_id,
            YarnDetection.overall_status != "pending"
        ).all()
        
        if not detections:
            continue
        
        total_count = len(detections)
        abnormal_count = sum(1 for d in detections if d.overall_status == "abnormal")
        normal_count = total_count - abnormal_count
        
        valid_detections = [d for d in detections if d.overall_status != "error"]
        
        stats = BatchStatistics(
            batch_id=batch_id,
            total_count=total_count,
            normal_count=normal_count,
            abnormal_count=abnormal_count,
            abnormal_rate=abnormal_count / total_count if total_count > 0 else 0,
            hairiness_rate=sum(1 for d in detections if d.hairiness_detected) / total_count if total_count > 0 else 0,
            breakage_rate=sum(1 for d in detections if d.breakage_detected) / total_count if total_count > 0 else 0,
            thickness_abnormal_rate=sum(1 for d in detections if d.thickness_abnormal) / total_count if total_count > 0 else 0,
            density_abnormal_rate=sum(1 for d in detections if d.density_abnormal) / total_count if total_count > 0 else 0,
            avg_density=sum(d.density for d in valid_detections) / len(valid_detections) if valid_detections else 0,
            avg_thickness=sum(d.thickness_mean for d in valid_detections) / len(valid_detections) if valid_detections else 0,
            avg_hairiness_score=sum(d.hairiness_score for d in valid_detections) / len(valid_detections) if valid_detections else 0,
            avg_breakage_score=sum(d.breakage_score for d in valid_detections) / len(valid_detections) if valid_detections else 0,
            first_upload_time=min(d.upload_time for d in detections) if detections else None,
            last_upload_time=max(d.upload_time for d in detections) if detections else None
        )
        batch_statistics.append(stats)
    
    if len(batch_statistics) < 2:
        raise HTTPException(status_code=404, detail="未找到足够的有效批次数据")
    
    compare_summary = {}
    all_abnormal_rates = [s.abnormal_rate for s in batch_statistics]
    compare_summary["max_abnormal_rate"] = max(all_abnormal_rates)
    compare_summary["min_abnormal_rate"] = min(all_abnormal_rates)
    compare_summary["avg_abnormal_rate"] = sum(all_abnormal_rates) / len(all_abnormal_rates)
    
    return BatchCompareResponse(
        batches=batch_statistics,
        compare_summary=compare_summary
    )


@router.get("/density-statistics", response_model=DensityStatisticsResponse)
async def get_density_statistics(
    batch_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(YarnDetection).filter(YarnDetection.overall_status != "pending")
    
    if batch_id:
        query = query.filter(YarnDetection.batch_id == batch_id)
    if start_time:
        query = query.filter(YarnDetection.upload_time >= start_time)
    if end_time:
        query = query.filter(YarnDetection.upload_time <= end_time)
    
    detections = query.all()
    
    if not detections:
        raise HTTPException(status_code=404, detail="未找到有效数据")
    
    densities = [d.density for d in detections if d.density > 0]
    
    if not densities:
        raise HTTPException(status_code=404, detail="无有效的密度数据")
    
    total_samples = len(densities)
    avg_density = sum(densities) / total_samples
    min_density = min(densities)
    max_density = max(densities)
    density_std = float(np.std(densities))
    
    bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0]
    hist, _ = np.histogram(densities, bins=bins)
    density_distribution = {
        f"{bins[i]}-{bins[i+1]}": int(hist[i]) for i in range(len(hist))
    }
    
    abnormal_count = sum(1 for d in detections if d.density_abnormal)
    abnormal_rate = abnormal_count / total_samples if total_samples > 0 else 0
    
    batch_density_avg = None
    if not batch_id:
        batch_results = db.query(
            YarnDetection.batch_id,
            func.avg(YarnDetection.density)
        ).filter(
            YarnDetection.batch_id.isnot(None),
            YarnDetection.density > 0
        ).group_by(YarnDetection.batch_id).all()
        
        batch_density_avg = {b[0]: float(b[1]) for b in batch_results}
    
    return DensityStatisticsResponse(
        total_samples=total_samples,
        avg_density=avg_density,
        min_density=min_density,
        max_density=max_density,
        density_std=density_std,
        density_distribution=density_distribution,
        abnormal_count=abnormal_count,
        abnormal_rate=abnormal_rate,
        batch_density_avg=batch_density_avg
    )


@router.post("/defect-trace/{detection_id}", response_model=DefectTraceResponse)
async def defect_trace(
    detection_id: int,
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    target = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    if not target.feature_vector:
        raise HTTPException(status_code=400, detail="目标图像缺少特征数据，请先执行全量检测")
    
    try:
        target_features = json.loads(target.feature_vector)
    except:
        raise HTTPException(status_code=400, detail="特征数据解析失败")
    
    other_detections = db.query(YarnDetection).filter(
        YarnDetection.id != detection_id,
        YarnDetection.feature_vector.isnot(None)
    ).all()
    
    similar_images = []
    for d in other_detections:
        try:
            features = json.loads(d.feature_vector)
            similarity = processor.compute_cosine_similarity(target_features, features)
            
            if similarity >= settings.FEATURE_SIMILARITY_THRESHOLD:
                similar_images.append({
                    "detection_id": d.id,
                    "filename": d.filename,
                    "batch_id": d.batch_id,
                    "similarity": similarity,
                    "upload_time": d.upload_time,
                    "has_hairiness": d.hairiness_detected,
                    "has_breakage": d.breakage_detected,
                    "has_thickness_abnormal": d.thickness_abnormal,
                    "has_density_abnormal": d.density_abnormal
                })
        except:
            continue
    
    similar_images.sort(key=lambda x: x["similarity"], reverse=True)
    top_similar = similar_images[:top_k]
    
    defect_pattern_analysis = {
        "target_defects": {
            "hairiness": target.hairiness_detected,
            "breakage": target.breakage_detected,
            "thickness_abnormal": target.thickness_abnormal,
            "density_abnormal": target.density_abnormal
        },
        "similar_count": len(top_similar),
        "avg_similarity": sum(s["similarity"] for s in top_similar) / len(top_similar) if top_similar else 0,
        "common_defects": {},
        "related_batches": list(set(s["batch_id"] for s in top_similar if s["batch_id"]))
    }
    
    for defect_type in ["has_hairiness", "has_breakage", "has_thickness_abnormal", "has_density_abnormal"]:
        count = sum(1 for s in top_similar if s[defect_type])
        defect_name = defect_type.replace("has_", "").replace("_", " ")
        defect_pattern_analysis["common_defects"][defect_name] = {
            "count": count,
            "rate": count / len(top_similar) if top_similar else 0
        }
    
    return DefectTraceResponse(
        target_detection=target,
        similar_defects=[SimilarImage(**s) for s in top_similar],
        defect_pattern_analysis=defect_pattern_analysis
    )


@router.post("/model/update", response_model=ModelUpdateResponse)
async def update_model(
    request: ModelUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        existing = db.query(ModelVersion).filter(
            ModelVersion.model_name == request.model_name,
            ModelVersion.version == request.version
        ).first()
        
        if existing:
            return ModelUpdateResponse(
                success=False,
                message=f"版本 {request.version} 已存在"
            )
        
        os.makedirs(settings.MODEL_DIR, exist_ok=True)
        model_file = f"{request.model_name}_{request.version}.pt"
        model_path = settings.MODEL_DIR / model_file
        
        import hashlib
        checksum = hashlib.sha256(f"{request.model_name}{request.version}".encode()).hexdigest()
        
        new_version = ModelVersion(
            model_name=request.model_name,
            version=request.version,
            file_path=str(model_path),
            checksum=checksum,
            description=request.description,
            is_active=False
        )
        
        if request.auto_activate:
            db.query(ModelVersion).filter(
                ModelVersion.model_name == request.model_name
            ).update({"is_active": False})
            new_version.is_active = True
        
        db.add(new_version)
        db.commit()
        
        return ModelUpdateResponse(
            success=True,
            message=f"模型版本 {request.version} 更新成功",
            version=request.version,
            previous_version=None
        )
        
    except Exception as e:
        logger.error(f"模型更新失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"模型更新失败: {str(e)}")


@router.get("/model/status", response_model=ModelStatusResponse)
async def get_model_status(db: Session = Depends(get_db)):
    try:
        all_versions = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
        
        active_version = next((v for v in all_versions if v.is_active), None)
        current_version = active_version.version if active_version else settings.CURRENT_MODEL_VERSION
        
        latest_version = all_versions[0] if all_versions else None
        update_available = (latest_version and active_version and 
                          latest_version.version != active_version.version)
        
        return ModelStatusResponse(
            current_version=current_version,
            available_versions=all_versions,
            last_update=latest_version.created_at if latest_version else None,
            update_available=update_available
        )
        
    except Exception as e:
        logger.error(f"获取模型状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")


@router.post("/model/activate/{version_id}", response_model=ModelUpdateResponse)
async def activate_model(
    version_id: int,
    db: Session = Depends(get_db)
):
    try:
        version = db.query(ModelVersion).filter(ModelVersion.id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="模型版本不存在")
        
        current_active = db.query(ModelVersion).filter(
            ModelVersion.model_name == version.model_name,
            ModelVersion.is_active == True
        ).first()
        
        previous_version = current_active.version if current_active else None
        
        db.query(ModelVersion).filter(
            ModelVersion.model_name == version.model_name
        ).update({"is_active": False})
        
        version.is_active = True
        db.commit()
        
        return ModelUpdateResponse(
            success=True,
            message=f"模型版本 {version.version} 已激活",
            version=version.version,
            previous_version=previous_version
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"激活模型失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"激活失败: {str(e)}")


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(YarnDetection)
        
        if batch_id:
            query = query.filter(YarnDetection.batch_id == batch_id)
        if status:
            query = query.filter(YarnDetection.overall_status == status)
        if start_time:
            query = query.filter(YarnDetection.upload_time >= start_time)
        if end_time:
            query = query.filter(YarnDetection.upload_time <= end_time)
        
        total = query.count()
        
        offset = (page - 1) * page_size
        items = query.order_by(YarnDetection.upload_time.desc()).offset(offset).limit(page_size).all()
        
        return HistoryResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=items
        )
    except Exception as e:
        logger.error(f"查询历史失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/detection/{detection_id}", response_model=YarnDetectionResponse)
async def get_detection(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    return detection


@router.delete("/detection/{detection_id}")
async def delete_detection(
    detection_id: int,
    db: Session = Depends(get_db)
):
    detection = db.query(YarnDetection).filter(YarnDetection.id == detection_id).first()
    if not detection:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    try:
        if os.path.exists(detection.file_path):
            os.remove(detection.file_path)
        
        db.delete(detection)
        db.commit()
        
        return {"message": "删除成功", "detection_id": detection_id}
    except Exception as e:
        logger.error(f"删除失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.get("/batch/list")
async def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(
            YarnDetection.batch_id,
            func.count(YarnDetection.id).label('count'),
            func.sum(YarnDetection.hairiness_detected.cast(int)).label('hairiness_count'),
            func.sum(YarnDetection.breakage_detected.cast(int)).label('breakage_count'),
            func.sum(YarnDetection.thickness_abnormal.cast(int)).label('thickness_abnormal_count'),
            func.sum(YarnDetection.density_abnormal.cast(int)).label('density_abnormal_count'),
            func.max(YarnDetection.upload_time).label('last_upload')
        ).filter(YarnDetection.batch_id.isnot(None)).group_by(YarnDetection.batch_id)
        
        total = query.count()
        batches = query.order_by(YarnDetection.upload_time.desc()).offset((page-1)*page_size).limit(page_size).all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "batches": [
                {
                    "batch_id": b.batch_id,
                    "count": b.count,
                    "hairiness_count": b.hairiness_count or 0,
                    "breakage_count": b.breakage_count or 0,
                    "thickness_abnormal_count": b.thickness_abnormal_count or 0,
                    "density_abnormal_count": b.density_abnormal_count or 0,
                    "last_upload": b.last_upload
                }
                for b in batches
            ]
        }
    except Exception as e:
        logger.error(f"查询批次列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


import numpy as np
