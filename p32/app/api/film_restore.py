from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import asyncio
from app.core.database import get_batch_db
from app.models.film_restore import (
    FilmCamera, PhotoArchive, PhotoTag,
    RestoreHistory, TranscriptionParams,
    TranscriptionTask, SyncBackupLog
)

router = APIRouter(tags=["胶片照片修复"])

camera_task_queues: Dict[str, asyncio.Queue] = {}


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


@router.get("/cameras", summary="获取所有相机列表")
async def get_cameras(
    status: Optional[str] = None,
    db: Session = Depends(get_batch_db)
):
    query = db.query(FilmCamera)
    if status:
        query = query.filter(FilmCamera.status == status)
    cameras = query.order_by(FilmCamera.created_at.desc()).all()
    return {
        "total": len(cameras),
        "data": cameras
    }


@router.post("/cameras/register", summary="注册新相机")
async def register_camera(
    camera_id: str,
    camera_name: str,
    camera_model: Optional[str] = None,
    camera_type: Optional[str] = None,
    ip_address: Optional[str] = None,
    firmware_version: Optional[str] = None,
    db: Session = Depends(get_batch_db)
):
    existing = db.query(FilmCamera).filter(FilmCamera.camera_id == camera_id).first()
    if existing:
        existing.last_heartbeat = datetime.utcnow()
        existing.status = "online"
        existing.ip_address = ip_address
        db.commit()
        return {"message": "相机已更新", "camera": existing}

    camera = FilmCamera(
        camera_id=camera_id,
        camera_name=camera_name,
        camera_model=camera_model,
        camera_type=camera_type,
        ip_address=ip_address,
        firmware_version=firmware_version,
        status="online",
        connection_time=datetime.utcnow(),
        last_heartbeat=datetime.utcnow()
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)

    if camera_id not in camera_task_queues:
        camera_task_queues[camera_id] = asyncio.Queue()

    return {"message": "相机注册成功", "camera": camera}


@router.post("/cameras/{camera_id}/heartbeat", summary="相机心跳")
async def camera_heartbeat(
    camera_id: str,
    status: Optional[str] = "online",
    db: Session = Depends(get_batch_db)
):
    camera = db.query(FilmCamera).filter(FilmCamera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="相机不存在")

    camera.last_heartbeat = datetime.utcnow()
    camera.status = status
    db.commit()

    return {"message": "心跳更新成功", "timestamp": datetime.utcnow().isoformat()}


@router.post("/cameras/{camera_id}/disconnect", summary="断开相机连接")
async def disconnect_camera(
    camera_id: str,
    db: Session = Depends(get_batch_db)
):
    camera = db.query(FilmCamera).filter(FilmCamera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="相机不存在")

    camera.status = "offline"
    db.commit()

    return {"message": "相机已断开连接"}


@router.get("/photos", summary="获取照片档案列表")
async def get_photos(
    camera_id: Optional[str] = None,
    tags: Optional[str] = None,
    is_restored: Optional[bool] = None,
    is_transcribed: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_batch_db)
):
    query = db.query(PhotoArchive)
    if camera_id:
        query = query.filter(PhotoArchive.camera_id == camera_id)
    if is_restored is not None:
        query = query.filter(PhotoArchive.is_restored == is_restored)
    if is_transcribed is not None:
        query = query.filter(PhotoArchive.is_transcribed == is_transcribed)

    total = query.count()
    photos = query.order_by(PhotoArchive.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": photos
    }


@router.post("/photos", summary="添加照片档案")
async def add_photo(
    photo_id: str,
    original_filename: str,
    file_path: str,
    file_size: Optional[float] = None,
    file_format: Optional[str] = None,
    camera_id: Optional[str] = None,
    film_type: Optional[str] = None,
    film_iso: Optional[int] = None,
    shutter_speed: Optional[str] = None,
    aperture: Optional[str] = None,
    photographer: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_batch_db)
):
    photo = PhotoArchive(
        photo_id=photo_id,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        file_format=file_format,
        camera_id=camera_id,
        film_type=film_type,
        film_iso=film_iso,
        shutter_speed=shutter_speed,
        aperture=aperture,
        photographer=photographer,
        description=description,
        tags=[]
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"message": "照片添加成功", "photo": photo}


@router.get("/photos/{photo_id}", summary="获取照片详情")
async def get_photo_detail(
    photo_id: str,
    db: Session = Depends(get_batch_db)
):
    photo = db.query(PhotoArchive).filter(PhotoArchive.photo_id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    return photo


@router.get("/photos/{photo_id}/history", summary="获取照片修复历史")
async def get_photo_history(
    photo_id: str,
    db: Session = Depends(get_batch_db)
):
    histories = db.query(RestoreHistory).filter(
        RestoreHistory.photo_id == photo_id
    ).order_by(RestoreHistory.created_at.desc()).all()

    return {
        "total": len(histories),
        "data": histories
    }


@router.post("/restore/history", summary="添加修复历史记录")
async def add_restore_history(
    photo_id: str,
    restore_type: str,
    original_file_path: str,
    restored_file_path: str,
    thumbnail_path: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    quality_score: Optional[float] = None,
    processing_time: Optional[float] = None,
    status: str = "completed",
    error_message: Optional[str] = None,
    restored_by: Optional[int] = None,
    db: Session = Depends(get_batch_db)
):
    history = RestoreHistory(
        history_id=generate_id("HIS"),
        photo_id=photo_id,
        restore_type=restore_type,
        restore_version=datetime.utcnow().strftime("%Y%m%d%H%M%S"),
        parameters=parameters or {},
        original_file_path=original_file_path,
        restored_file_path=restored_file_path,
        thumbnail_path=thumbnail_path,
        quality_score=quality_score,
        processing_time=processing_time,
        status=status,
        error_message=error_message,
        restored_by=restored_by
    )
    db.add(history)

    photo = db.query(PhotoArchive).filter(PhotoArchive.photo_id == photo_id).first()
    if photo:
        photo.is_restored = True
        photo.status = "restored"

    db.commit()
    db.refresh(history)

    return {"message": "修复历史记录添加成功", "history": history}


@router.get("/restore/history", summary="获取所有修复历史")
async def get_all_restore_history(
    photo_id: Optional[str] = None,
    restore_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_batch_db)
):
    query = db.query(RestoreHistory)
    if photo_id:
        query = query.filter(RestoreHistory.photo_id == photo_id)
    if restore_type:
        query = query.filter(RestoreHistory.restore_type == restore_type)
    if status:
        query = query.filter(RestoreHistory.status == status)
    if start_date:
        query = query.filter(RestoreHistory.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(RestoreHistory.created_at <= datetime.fromisoformat(end_date))

    total = query.count()
    histories = query.order_by(RestoreHistory.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": histories
    }


@router.get("/params", summary="获取转录参数列表")
async def get_transcription_params(
    camera_id: Optional[str] = None,
    is_default: Optional[bool] = None,
    db: Session = Depends(get_batch_db)
):
    query = db.query(TranscriptionParams)
    if camera_id:
        query = query.filter(TranscriptionParams.camera_id == camera_id)
    if is_default is not None:
        query = query.filter(TranscriptionParams.is_default == is_default)

    params = query.order_by(TranscriptionParams.updated_at.desc()).all()
    return {
        "total": len(params),
        "data": params
    }


@router.post("/params", summary="创建转录参数")
async def create_transcription_params(
    camera_id: str,
    params_name: str,
    brightness: float = 0.0,
    contrast: float = 1.0,
    saturation: float = 1.0,
    sharpness: float = 1.0,
    denoise_level: float = 0.0,
    color_correction: bool = True,
    white_balance_temp: int = 5500,
    white_balance_tint: int = 0,
    exposure_compensation: float = 0.0,
    gamma: float = 1.0,
    is_default: bool = False,
    created_by: Optional[int] = None,
    db: Session = Depends(get_batch_db)
):
    if is_default:
        db.query(TranscriptionParams).filter(
            TranscriptionParams.camera_id == camera_id,
            TranscriptionParams.is_default == True
        ).update({"is_default": False})

    params = TranscriptionParams(
        params_id=generate_id("PARAM"),
        camera_id=camera_id,
        params_name=params_name,
        brightness=brightness,
        contrast=contrast,
        saturation=saturation,
        sharpness=sharpness,
        denoise_level=denoise_level,
        color_correction=color_correction,
        white_balance_temp=white_balance_temp,
        white_balance_tint=white_balance_tint,
        exposure_compensation=exposure_compensation,
        gamma=gamma,
        is_default=is_default,
        sync_version=1,
        last_sync_time=datetime.utcnow(),
        created_by=created_by
    )
    db.add(params)
    db.commit()
    db.refresh(params)

    return {"message": "转录参数创建成功", "params": params}


@router.put("/params/{params_id}", summary="更新转录参数")
async def update_transcription_params(
    params_id: str,
    params_name: Optional[str] = None,
    brightness: Optional[float] = None,
    contrast: Optional[float] = None,
    saturation: Optional[float] = None,
    sharpness: Optional[float] = None,
    denoise_level: Optional[float] = None,
    color_correction: Optional[bool] = None,
    white_balance_temp: Optional[int] = None,
    white_balance_tint: Optional[int] = None,
    exposure_compensation: Optional[float] = None,
    gamma: Optional[float] = None,
    db: Session = Depends(get_batch_db)
):
    params = db.query(TranscriptionParams).filter(TranscriptionParams.params_id == params_id).first()
    if not params:
        raise HTTPException(status_code=404, detail="参数不存在")

    if params_name is not None:
        params.params_name = params_name
    if brightness is not None:
        params.brightness = brightness
    if contrast is not None:
        params.contrast = contrast
    if saturation is not None:
        params.saturation = saturation
    if sharpness is not None:
        params.sharpness = sharpness
    if denoise_level is not None:
        params.denoise_level = denoise_level
    if color_correction is not None:
        params.color_correction = color_correction
    if white_balance_temp is not None:
        params.white_balance_temp = white_balance_temp
    if white_balance_tint is not None:
        params.white_balance_tint = white_balance_tint
    if exposure_compensation is not None:
        params.exposure_compensation = exposure_compensation
    if gamma is not None:
        params.gamma = gamma

    params.sync_version += 1
    params.is_synced = False
    params.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(params)

    return {"message": "转录参数更新成功", "params": params}


@router.post("/params/{params_id}/sync", summary="同步转录参数到云端")
async def sync_params_to_cloud(
    params_id: str,
    db: Session = Depends(get_batch_db)
):
    params = db.query(TranscriptionParams).filter(TranscriptionParams.params_id == params_id).first()
    if not params:
        raise HTTPException(status_code=404, detail="参数不存在")

    sync_log = SyncBackupLog(
        sync_id=generate_id("SYNC"),
        sync_type="params",
        params_id=params_id,
        camera_id=params.camera_id,
        version=params.sync_version,
        sync_direction="upload",
        status="completed",
        sync_start_time=datetime.utcnow(),
        sync_end_time=datetime.utcnow()
    )
    db.add(sync_log)

    params.is_synced = True
    params.last_sync_time = datetime.utcnow()
    db.commit()

    return {"message": "参数同步成功", "sync_version": params.sync_version}


@router.get("/params/{camera_id}/backup/latest", summary="获取最新备份参数")
async def get_latest_backup_params(
    camera_id: str,
    db: Session = Depends(get_batch_db)
):
    params = db.query(TranscriptionParams).filter(
        TranscriptionParams.camera_id == camera_id
    ).order_by(TranscriptionParams.sync_version.desc()).first()

    if not params:
        raise HTTPException(status_code=404, detail="没有找到备份参数")

    return {
        "params": params,
        "backup_time": params.last_sync_time
    }


@router.get("/sync/logs", summary="获取同步备份日志")
async def get_sync_logs(
    sync_type: Optional[str] = None,
    camera_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_batch_db)
):
    query = db.query(SyncBackupLog)
    if sync_type:
        query = query.filter(SyncBackupLog.sync_type == sync_type)
    if camera_id:
        query = query.filter(SyncBackupLog.camera_id == camera_id)
    if status:
        query = query.filter(SyncBackupLog.status == status)

    total = query.count()
    logs = query.order_by(SyncBackupLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": logs
    }


@router.post("/transcription/tasks", summary="创建转录任务")
async def create_transcription_task(
    camera_id: str,
    photo_id: str,
    params_id: Optional[str] = None,
    task_type: str = "transcription",
    priority: int = 5,
    total_frames: int = 1,
    db: Session = Depends(get_batch_db)
):
    camera = db.query(FilmCamera).filter(FilmCamera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="相机不存在")

    task = TranscriptionTask(
        task_id=generate_id("TASK"),
        camera_id=camera_id,
        photo_id=photo_id,
        params_id=params_id,
        task_type=task_type,
        priority=priority,
        total_frames=total_frames
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    if camera_id not in camera_task_queues:
        camera_task_queues[camera_id] = asyncio.Queue()
    await camera_task_queues[camera_id].put(task.task_id)

    return {"message": "转录任务创建成功", "task": task}


@router.get("/transcription/tasks", summary="获取转录任务列表")
async def get_transcription_tasks(
    camera_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_batch_db)
):
    query = db.query(TranscriptionTask)
    if camera_id:
        query = query.filter(TranscriptionTask.camera_id == camera_id)
    if status:
        query = query.filter(TranscriptionTask.status == status)

    total = query.count()
    tasks = query.order_by(TranscriptionTask.priority.desc(), TranscriptionTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": tasks
    }


@router.get("/transcription/tasks/{task_id}", summary="获取任务详情")
async def get_task_detail(
    task_id: str,
    db: Session = Depends(get_batch_db)
):
    task = db.query(TranscriptionTask).filter(TranscriptionTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.put("/transcription/tasks/{task_id}/progress", summary="更新任务进度")
async def update_task_progress(
    task_id: str,
    progress: int,
    current_frame: Optional[int] = None,
    processing_speed: Optional[float] = None,
    db: Session = Depends(get_batch_db)
):
    task = db.query(TranscriptionTask).filter(TranscriptionTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    task.progress = progress
    if current_frame is not None:
        task.current_frame = current_frame
    if processing_speed is not None:
        task.processing_speed = processing_speed

    if progress >= 100:
        task.status = "completed"
        task.end_time = datetime.utcnow()
    elif progress > 0:
        task.status = "processing"

    db.commit()

    if progress >= 100:
        photo = db.query(PhotoArchive).filter(PhotoArchive.photo_id == task.photo_id).first()
        if photo:
            photo.is_transcribed = True
            db.commit()

    return {"message": "进度更新成功", "progress": progress}


@router.get("/transcription/overview", summary="获取转录概览")
async def get_transcription_overview(
    db: Session = Depends(get_batch_db)
):
    online_cameras = db.query(FilmCamera).filter(FilmCamera.status == "online").count()
    pending_tasks = db.query(TranscriptionTask).filter(TranscriptionTask.status == "pending").count()
    processing_tasks = db.query(TranscriptionTask).filter(TranscriptionTask.status == "processing").count()
    completed_today = db.query(TranscriptionTask).filter(
        TranscriptionTask.status == "completed",
        TranscriptionTask.end_time >= datetime.utcnow() - timedelta(days=1)
    ).count()

    return {
        "online_cameras": online_cameras,
        "pending_tasks": pending_tasks,
        "processing_tasks": processing_tasks,
        "completed_today": completed_today,
        "task_queues": {k: v.qsize() for k, v in camera_task_queues.items()}
    }


@router.get("/tags", summary="获取所有标签")
async def get_tags(
    tag_category: Optional[str] = None,
    db: Session = Depends(get_batch_db)
):
    query = db.query(PhotoTag)
    if tag_category:
        query = query.filter(PhotoTag.tag_category == tag_category)

    tags = query.order_by(PhotoTag.photo_count.desc()).all()
    return {
        "total": len(tags),
        "data": tags
    }


@router.post("/tags", summary="创建标签")
async def create_tag(
    tag_name: str,
    tag_category: Optional[str] = None,
    tag_color: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_batch_db)
):
    existing = db.query(PhotoTag).filter(PhotoTag.tag_name == tag_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="标签已存在")

    tag = PhotoTag(
        tag_id=generate_id("TAG"),
        tag_name=tag_name,
        tag_category=tag_category,
        tag_color=tag_color,
        description=description
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    return {"message": "标签创建成功", "tag": tag}


@router.post("/photos/{photo_id}/tags", summary="给照片添加标签")
async def add_tags_to_photo(
    photo_id: str,
    tag_ids: List[str],
    db: Session = Depends(get_batch_db)
):
    photo = db.query(PhotoArchive).filter(PhotoArchive.photo_id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    current_tags = photo.tags or []
    for tag_id in tag_ids:
        if tag_id not in current_tags:
            current_tags.append(tag_id)
            tag = db.query(PhotoTag).filter(PhotoTag.tag_id == tag_id).first()
            if tag:
                tag.photo_count += 1

    photo.tags = current_tags
    db.commit()

    return {"message": "标签添加成功", "tags": current_tags}


@router.delete("/photos/{photo_id}/tags/{tag_id}", summary="移除照片标签")
async def remove_tag_from_photo(
    photo_id: str,
    tag_id: str,
    db: Session = Depends(get_batch_db)
):
    photo = db.query(PhotoArchive).filter(PhotoArchive.photo_id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    current_tags = photo.tags or []
    if tag_id in current_tags:
        current_tags.remove(tag_id)
        tag = db.query(PhotoTag).filter(PhotoTag.tag_id == tag_id).first()
        if tag and tag.photo_count > 0:
            tag.photo_count -= 1

    photo.tags = current_tags
    db.commit()

    return {"message": "标签移除成功", "tags": current_tags}


@router.get("/tags/categories", summary="获取标签分类列表")
async def get_tag_categories(
    db: Session = Depends(get_batch_db)
):
    tags = db.query(PhotoTag).all()
    categories = {}
    for tag in tags:
        cat = tag.tag_category or "未分类"
        if cat not in categories:
            categories[cat] = {
                "category_name": cat,
                "tag_count": 0,
                "total_photos": 0
            }
        categories[cat]["tag_count"] += 1
        categories[cat]["total_photos"] += tag.photo_count

    return {"categories": list(categories.values())}


@router.get("/statistics/dashboard", summary="获取统计概览")
async def get_statistics_dashboard(
    db: Session = Depends(get_batch_db)
):
    total_photos = db.query(PhotoArchive).count()
    restored_photos = db.query(PhotoArchive).filter(PhotoArchive.is_restored == True).count()
    transcribed_photos = db.query(PhotoArchive).filter(PhotoArchive.is_transcribed == True).count()
    total_cameras = db.query(FilmCamera).count()
    total_tags = db.query(PhotoTag).count()

    return {
        "total_photos": total_photos,
        "restored_photos": restored_photos,
        "transcribed_photos": transcribed_photos,
        "total_cameras": total_cameras,
        "total_tags": total_tags,
        "restore_rate": restored_photos / total_photos if total_photos > 0 else 0,
        "transcribe_rate": transcribed_photos / total_photos if total_photos > 0 else 0
    }
