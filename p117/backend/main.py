from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
import aiofiles
import os
import uuid
import json
from datetime import datetime
import numpy as np
from PIL import Image
import io
import logging
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from image_processing import FiberSegmentation
from ai_analysis import AgingAnalyzer, DamagePredictor
from enhanced_analysis import FiberOrientationAnalyzer, DurabilityPredictor, PaperTracing, ModelFineTuner

app = FastAPI(title="显微图像分析系统", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
RESULT_DIR = "results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

segmenter = FiberSegmentation()
aging_analyzer = AgingAnalyzer()
damage_predictor = DamagePredictor()
orientation_analyzer = FiberOrientationAnalyzer()
durability_predictor = DurabilityPredictor()
paper_tracer = PaperTracing()
model_tuner = ModelFineTuner()

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp'}
MAX_FILE_SIZE = 50 * 1024 * 1024


class OriginInfo(BaseModel):
    manufacturer: str
    production_date: Optional[str] = None
    batch_number: Optional[str] = None
    paper_type: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class SegmentationFeedback(BaseModel):
    min_area_adjustment: Optional[int] = None
    clahe_adjustment: Optional[float] = None
    threshold_method: Optional[str] = None


class AgingFeedback(BaseModel):
    weight_adjustments: Optional[Dict[str, float]] = None
    level_thresholds: Optional[List[float]] = None


class DurabilityFeedback(BaseModel):
    weight_adjustments: Optional[Dict[str, float]] = None
    base_lifespan: Optional[int] = None


def validate_file(file: UploadFile) -> None:
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件格式: {file_ext}. 支持的格式: {ALLOWED_EXTENSIONS}")


async def save_upload_file(file: UploadFile) -> str:
    validate_file(file)
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"文件过大. 最大支持 {MAX_FILE_SIZE/1024/1024}MB")
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(content)
    
    return file_path, file_id


def load_image(file_path: str) -> np.ndarray:
    try:
        img = Image.open(file_path)
        img.verify()
        img = Image.open(file_path)
        
        if img.mode not in ('L', 'RGB', 'RGBA'):
            img = img.convert('RGB')
        
        return np.array(img)
    except Exception as e:
        raise ValueError(f"图像加载失败: {str(e)}")





@app.post("/api/upload", summary="上传单张显微图像并完整分析")
async def upload_image(file: UploadFile = File(...)):
    try:
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        orientation_result = orientation_analyzer.analyze_orientation(image, segmentation_result)
        aging_result = aging_analyzer.analyze(image, segmentation_result)
        damage_result = damage_predictor.predict(image, segmentation_result)
        durability_result = durability_predictor.predict_durability(
            image, segmentation_result, aging_result, damage_result
        )
        fingerprint = paper_tracer.extract_fingerprint(image, segmentation_result, orientation_result)
        tracing_result = paper_tracer.trace_origin(fingerprint)
        
        result = {
            "file_id": file_id,
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            "segmentation": segmentation_result,
            "orientation": orientation_result,
            "aging_level": aging_result,
            "damage_prediction": damage_result,
            "durability": durability_result,
            "tracing": tracing_result,
            "fingerprint": fingerprint
        }
        
        return JSONResponse(status_code=200, content={"success": True, "data": result})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"上传处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/orientation", summary="仅进行纤维方向分析")
async def analyze_orientation(file: UploadFile = File(...)):
    try:
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        orientation_result = orientation_analyzer.analyze_orientation(image, segmentation_result)
        
        return JSONResponse(status_code=200, content={
            "success": True,
            "data": {
                "file_id": file_id,
                "segmentation": segmentation_result,
                "orientation": orientation_result
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"方向分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/durability", summary="仅进行耐久性预测")
async def predict_durability(file: UploadFile = File(...)):
    try:
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        aging_result = aging_analyzer.analyze(image, segmentation_result)
        damage_result = damage_predictor.predict(image, segmentation_result)
        durability_result = durability_predictor.predict_durability(
            image, segmentation_result, aging_result, damage_result
        )
        
        return JSONResponse(status_code=200, content={
            "success": True,
            "data": {
                "file_id": file_id,
                "durability": durability_result
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"耐久性预测失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/trace", summary="纸张溯源分析")
async def trace_paper(file: UploadFile = File(...)):
    try:
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        orientation_result = orientation_analyzer.analyze_orientation(image, segmentation_result)
        fingerprint = paper_tracer.extract_fingerprint(image, segmentation_result, orientation_result)
        tracing_result = paper_tracer.trace_origin(fingerprint)
        
        return JSONResponse(status_code=200, content={
            "success": True,
            "data": {
                "file_id": file_id,
                "fingerprint": fingerprint,
                "tracing": tracing_result
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"溯源分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/trace/add_sample", summary="添加参考样本到溯源数据库")
async def add_reference_sample(
    file: UploadFile = File(...),
    origin_info: str = Body(...)
):
    try:
        origin_data = json.loads(origin_info)
        
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        orientation_result = orientation_analyzer.analyze_orientation(image, segmentation_result)
        fingerprint = paper_tracer.extract_fingerprint(image, segmentation_result, orientation_result)
        
        sample_id = paper_tracer.add_reference_sample(fingerprint, origin_data)
        
        return JSONResponse(status_code=200, content={
            "success": True,
            "data": {
                "sample_id": sample_id,
                "message": "参考样本已添加到数据库"
            }
        })
    except Exception as e:
        logger.error(f"添加样本失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"添加样本失败: {str(e)}")


@app.get("/api/trace/stats", summary="获取溯源数据库统计信息")
async def get_trace_stats():
    try:
        stats = paper_tracer.get_database_stats()
        return JSONResponse(status_code=200, content={"success": True, "data": stats})
    except Exception as e:
        logger.error(f"获取统计失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取统计失败: {str(e)}")


@app.post("/api/finetune/segmentation", summary="微调分割参数")
async def finetune_segmentation(feedback: SegmentationFeedback):
    try:
        result = model_tuner.fine_tune_segmentation(feedback.dict())
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error(f"微调失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"微调失败: {str(e)}")


@app.post("/api/finetune/aging", summary="微调老化评估参数")
async def finetune_aging(feedback: AgingFeedback):
    try:
        result = model_tuner.fine_tune_aging(feedback.dict())
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error(f"微调失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"微调失败: {str(e)}")


@app.post("/api/finetune/durability", summary="微调耐久性预测参数")
async def finetune_durability(feedback: DurabilityFeedback):
    try:
        result = model_tuner.fine_tune_durability(feedback.dict())
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error(f"微调失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"微调失败: {str(e)}")


@app.get("/api/finetune/params", summary="获取当前模型参数")
async def get_model_params():
    try:
        params = model_tuner.get_current_params()
        return JSONResponse(status_code=200, content={"success": True, "data": params})
    except Exception as e:
        logger.error(f"获取参数失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取参数失败: {str(e)}")


@app.get("/api/finetune/history", summary="获取训练历史")
async def get_training_history(limit: int = 10):
    try:
        history = model_tuner.get_training_history(limit)
        return JSONResponse(status_code=200, content={"success": True, "data": history})
    except Exception as e:
        logger.error(f"获取历史失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取历史失败: {str(e)}")


@app.post("/api/finetune/reset", summary="重置为默认参数")
async def reset_params():
    try:
        result = model_tuner.reset_to_default()
        return JSONResponse(status_code=200, content=result)
    except Exception as e:
        logger.error(f"重置参数失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重置参数失败: {str(e)}")


@app.post("/api/batch", summary="批量上传显微图像并完整分析")
async def batch_analysis(files: List[UploadFile] = File(...)):
    results = []
    errors = []
    
    for i, file in enumerate(files):
        try:
            logger.info(f"处理文件 {i+1}/{len(files)}: {file.filename}")
            
            file_path, file_id = await save_upload_file(file)
            image = load_image(file_path)
            
            segmentation_result = segmenter.segment(image)
            orientation_result = orientation_analyzer.analyze_orientation(image, segmentation_result)
            aging_result = aging_analyzer.analyze(image, segmentation_result)
            damage_result = damage_predictor.predict(image, segmentation_result)
            durability_result = durability_predictor.predict_durability(
                image, segmentation_result, aging_result, damage_result
            )
            fingerprint = paper_tracer.extract_fingerprint(image, segmentation_result, orientation_result)
            tracing_result = paper_tracer.trace_origin(fingerprint)
            
            results.append({
                "file_id": file_id,
                "filename": file.filename,
                "timestamp": datetime.now().isoformat(),
                "segmentation": segmentation_result,
                "orientation": orientation_result,
                "aging_level": aging_result,
                "damage_prediction": damage_result,
                "durability": durability_result,
                "tracing": tracing_result
            })
                
        except Exception as e:
            logger.error(f"处理文件 {file.filename} 失败: {str(e)}")
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return JSONResponse(status_code=200, content={
        "success": True,
        "data": results,
        "count": len(results),
        "errors": errors,
        "error_count": len(errors),
        "total_files": len(files)
    })


@app.post("/api/segment", summary="仅进行纤维分割")
async def segment_image(file: UploadFile = File(...)):
    try:
        file_path, file_id = await save_upload_file(file)
        image = load_image(file_path)
        
        segmentation_result = segmenter.segment(image)
        
        return JSONResponse(status_code=200, content={
            "success": True,
            "data": {
                "file_id": file_id,
                "segmentation": segmentation_result
            }
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"分割处理失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.get("/api/health", summary="健康检查")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "version": "1.0.1"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
