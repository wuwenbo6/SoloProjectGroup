from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import shutil
import json
import asyncio
from typing import List, Optional, Dict
import logging
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from database import engine, get_db, Base
from models import AnalysisRecord, ModelConfig
from schemas import AnalysisRecordResponse, BatchAnalysisResponse
from image_processing import processor

Base.metadata.create_all(bind=engine)

app = FastAPI(title="纤维图像分析系统", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

PROCESS_TIMEOUT = 60


class ModelUpdateRequest(BaseModel):
    version: str
    strength_thresholds: Optional[Dict] = None
    fiber_color_ranges: Optional[Dict] = None
    impurity_classifier: Optional[Dict] = None
    description: Optional[str] = ""


async def run_with_timeout(func, *args, timeout=PROCESS_TIMEOUT):
    loop = asyncio.get_event_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(None, func, *args),
            timeout=timeout
        )
        return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="图像处理超时，请重试")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


def process_single_image(file_path: str, filename: str, batch_id: Optional[str], db: Session):
    try:
        result = processor.process_image(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise ValueError(f"图像处理失败: {str(e)}")

    fiber_ratio_str = json.dumps(result['fiber_ratio'], ensure_ascii=False)
    impurity_details_str = json.dumps(result['impurity_details'], ensure_ascii=False)
    impurity_source_str = json.dumps(result['impurity_source'], ensure_ascii=False)

    record = AnalysisRecord(
        filename=filename,
        file_path=file_path,
        fiber_type_ratio=fiber_ratio_str,
        strength=result['strength'],
        strength_level=result['strength_level']['level'],
        impurity_count=result['impurity_count'],
        impurity_details=impurity_details_str,
        impurity_source=impurity_source_str,
        batch_id=batch_id
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/")
async def root():
    return FileResponse("index.html")


@app.post("/api/upload", response_model=AnalysisRecordResponse)
async def upload_and_analyze(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图像文件")

    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")

    try:
        record = await run_with_timeout(
            process_single_image,
            file_path,
            file.filename,
            batch_id,
            db
        )
        return record
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise


@app.post("/api/batch", response_model=BatchAnalysisResponse)
async def batch_analysis(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="请至少上传一个文件")

    if len(files) > 20:
        raise HTTPException(status_code=400, detail="批量上传最多支持20个文件")

    batch_id = str(uuid.uuid4())
    results = []
    errors = []

    for idx, file in enumerate(files):
        if not file.content_type or not file.content_type.startswith("image/"):
            errors.append(f"{file.filename}: 不是有效的图像文件")
            continue

        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{batch_id}_{idx}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            record = process_single_image(file_path, file.filename, batch_id, db)
            results.append(record)
            logger.info(f"批量处理: {file.filename} 成功")

        except Exception as e:
            error_msg = f"{file.filename}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"批量处理失败: {error_msg}")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            continue

    if len(results) == 0 and len(errors) > 0:
        raise HTTPException(
            status_code=500,
            detail=f"所有文件处理失败: {'; '.join(errors)}"
        )

    return {
        "batch_id": batch_id,
        "total_files": len(results),
        "total_errors": len(errors),
        "errors": errors,
        "results": results
    }


@app.get("/api/batch/compare")
async def compare_batches(
    batch_ids: str,
    db: Session = Depends(get_db)
):
    batch_id_list = [bid.strip() for bid in batch_ids.split(",") if bid.strip()]

    if len(batch_id_list) < 2:
        raise HTTPException(status_code=400, detail="请至少提供2个批次ID进行对比")

    comparison = {
        "batch_ids": batch_id_list,
        "batch_stats": [],
        "summary": {}
    }

    all_strengths = []
    all_impurity_counts = []

    for batch_id in batch_id_list:
        records = db.query(AnalysisRecord).filter(AnalysisRecord.batch_id == batch_id).all()

        if not records:
            raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在或无数据")

        strengths = [r.strength for r in records if r.strength is not None]
        impurity_counts = [r.impurity_count for r in records if r.impurity_count is not None]
        level_counts = {}
        for r in records:
            if r.strength_level:
                level_counts[r.strength_level] = level_counts.get(r.strength_level, 0) + 1

        batch_stat = {
            "batch_id": batch_id,
            "sample_count": len(records),
            "avg_strength": round(sum(strengths) / len(strengths), 2) if strengths else 0,
            "max_strength": max(strengths) if strengths else 0,
            "min_strength": min(strengths) if strengths else 0,
            "avg_impurity_count": round(sum(impurity_counts) / len(impurity_counts), 2) if impurity_counts else 0,
            "total_impurities": sum(impurity_counts) if impurity_counts else 0,
            "strength_level_distribution": level_counts,
            "created_at": min(r.created_at for r in records).isoformat() if records else None
        }

        comparison["batch_stats"].append(batch_stat)
        all_strengths.extend(strengths)
        all_impurity_counts.extend(impurity_counts)

    comparison["summary"] = {
        "total_samples_compared": len(all_strengths),
        "overall_avg_strength": round(sum(all_strengths) / len(all_strengths), 2) if all_strengths else 0,
        "best_batch": max(comparison["batch_stats"], key=lambda x: x["avg_strength"])["batch_id"],
        "lowest_impurity_batch": min(comparison["batch_stats"], key=lambda x: x["avg_impurity_count"])["batch_id"]
    }

    return comparison


@app.get("/api/history", response_model=List[AnalysisRecordResponse])
async def get_history(
    skip: int = 0,
    limit: int = 50,
    batch_id: Optional[str] = None,
    strength_level: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(AnalysisRecord)

        if batch_id:
            query = query.filter(AnalysisRecord.batch_id == batch_id)
        if strength_level:
            query = query.filter(AnalysisRecord.strength_level == strength_level)

        records = query.order_by(AnalysisRecord.created_at.desc()).offset(skip).limit(limit).all()
        return records
    except Exception as e:
        logger.error(f"查询历史记录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@app.get("/api/history/{record_id}", response_model=dict)
async def get_record_detail(
    record_id: int,
    db: Session = Depends(get_db)
):
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="记录不存在")

        return {
            "id": record.id,
            "filename": record.filename,
            "fiber_type_ratio": json.loads(record.fiber_type_ratio),
            "strength": record.strength,
            "strength_level": record.strength_level,
            "impurity_count": record.impurity_count,
            "impurity_details": json.loads(record.impurity_details),
            "impurity_source": json.loads(record.impurity_source) if record.impurity_source else None,
            "created_at": record.created_at,
            "batch_id": record.batch_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取记录详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取详情失败: {str(e)}")


@app.get("/api/impurity/trace/{record_id}")
async def get_impurity_trace(
    record_id: int,
    db: Session = Depends(get_db)
):
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="记录不存在")

        if not record.impurity_source:
            return {
                "record_id": record_id,
                "has_impurity": False,
                "message": "该记录无杂质数据"
            }

        impurity_source = json.loads(record.impurity_source)

        same_source_records = db.query(AnalysisRecord)\
            .filter(AnalysisRecord.batch_id == record.batch_id)\
            .filter(AnalysisRecord.id != record_id)\
            .all()

        related_records = []
        for r in same_source_records:
            if r.impurity_source:
                r_source = json.loads(r.impurity_source)
                if r_source.get('primary_source') == impurity_source.get('primary_source'):
                    related_records.append({
                        "id": r.id,
                        "filename": r.filename,
                        "impurity_count": r.impurity_count
                    })

        return {
            "record_id": record_id,
            "has_impurity": True,
            "impurity_source": impurity_source,
            "related_records": related_records,
            "same_batch_count": len(same_source_records) + 1,
            "suggested_actions": impurity_source.get('recommendations', [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取杂质溯源失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"溯源失败: {str(e)}")


@app.delete("/api/history/{record_id}")
async def delete_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    try:
        record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="记录不存在")

        if os.path.exists(record.file_path):
            try:
                os.remove(record.file_path)
            except Exception as e:
                logger.warning(f"删除文件失败: {str(e)}")

        db.delete(record)
        db.commit()

        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除记录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    try:
        total_records = db.query(AnalysisRecord).count()
        strength_values = db.query(AnalysisRecord.strength).all()

        if strength_values:
            strengths = [s[0] for s in strength_values if s[0] is not None]
            avg_strength_value = sum(strengths) / len(strengths) if strengths else 0
            max_strength = max(strengths) if strengths else 0
            min_strength = min(strengths) if strengths else 0
        else:
            avg_strength_value = 0
            max_strength = 0
            min_strength = 0

        level_stats = db.query(
            AnalysisRecord.strength_level,
            db.func.count(AnalysisRecord.id)
        ).group_by(AnalysisRecord.strength_level).all()

        level_distribution = {level: count for level, count in level_stats if level}

        return {
            "total_analysis": total_records,
            "average_strength": round(avg_strength_value, 2),
            "max_strength": round(max_strength, 2),
            "min_strength": round(min_strength, 2),
            "strength_level_distribution": level_distribution
        }
    except Exception as e:
        logger.error(f"获取统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取统计失败: {str(e)}")


@app.get("/api/model/config")
async def get_model_config():
    return processor.get_config_info()


@app.post("/api/model/update")
async def update_model_config(
    request: ModelUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        existing = db.query(ModelConfig).filter(ModelConfig.version == request.version).first()
        if existing:
            raise HTTPException(status_code=400, detail="版本号已存在，请使用新版本号")

        current_config = processor.get_config_info()

        new_config = ModelConfig(
            version=request.version,
            strength_thresholds=json.dumps(
                request.strength_thresholds or current_config['strength_thresholds'],
                ensure_ascii=False
            ),
            fiber_color_ranges=json.dumps(
                request.fiber_color_ranges or current_config['fiber_colors_hsv'],
                ensure_ascii=False
            ),
            impurity_classifier=json.dumps(
                request.impurity_classifier or current_config['impurity_classifier'],
                ensure_ascii=False
            ),
            description=request.description,
            is_active=0
        )

        db.add(new_config)
        db.commit()
        db.refresh(new_config)

        return {
            "message": "模型配置已保存",
            "config_id": new_config.id,
            "version": new_config.version,
            "note": "配置已保存但未激活，调用 /api/model/activate 进行激活"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"保存模型配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")


@app.post("/api/model/activate/{config_id}")
async def activate_model_config(
    config_id: int,
    db: Session = Depends(get_db)
):
    try:
        new_config = db.query(ModelConfig).filter(ModelConfig.id == config_id).first()
        if not new_config:
            raise HTTPException(status_code=404, detail="配置不存在")

        db.query(ModelConfig).update({ModelConfig.is_active: 0})
        db.commit()

        new_config.is_active = 1
        db.commit()

        success = processor.reload_config()

        return {
            "message": "模型配置已激活并生效",
            "version": new_config.version,
            "reload_success": success
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"激活模型配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"激活失败: {str(e)}")


@app.get("/api/model/versions")
async def get_model_versions(db: Session = Depends(get_db)):
    try:
        configs = db.query(ModelConfig).order_by(ModelConfig.created_at.desc()).all()
        return [
            {
                "id": c.id,
                "version": c.version,
                "is_active": c.is_active == 1,
                "description": c.description,
                "created_at": c.created_at
            }
            for c in configs
        ]
    except Exception as e:
        logger.error(f"获取版本列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.1.0",
        "model_loaded": True
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_keep_alive=120)
