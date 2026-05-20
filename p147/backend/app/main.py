from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import aiofiles
from typing import Optional, List
from dotenv import load_dotenv

from .database import get_db, init_db, SegyFile, Annotation
from .schemas import (
    SegyFileResponse, AnnotationCreate, AnnotationResponse,
    FileInfoResponse, HistogramResponse
)
from .segy_parser import SegyParser

load_dotenv()

app = FastAPI(title="地震数据可视化API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

segy_parser = SegyParser(UPLOAD_DIR)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/files/upload", response_model=SegyFileResponse)
async def upload_file(
    file: UploadFile = File(...),
    description: Optional[str] = None,
    db: Session = Depends(get_db)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    try:
        segy_info = segy_parser.parse_file(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"无法解析SEG-Y文件: {str(e)}")
    
    db_file = SegyFile(
        filename=segy_info.filename,
        file_path=file_path,
        file_size=segy_info.file_size,
        sample_count=segy_info.sample_count,
        trace_count=segy_info.trace_count,
        inline_count=segy_info.inline_count,
        crossline_count=segy_info.crossline_count,
        sample_interval=segy_info.sample_interval,
        min_amplitude=segy_info.min_amplitude,
        max_amplitude=segy_info.max_amplitude,
        mean_amplitude=segy_info.mean_amplitude,
        std_amplitude=segy_info.std_amplitude,
        description=description
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    return db_file


@app.get("/api/files", response_model=List[SegyFileResponse])
def get_files(db: Session = Depends(get_db)):
    return db.query(SegyFile).order_by(SegyFile.uploaded_at.desc()).all()


@app.get("/api/files/{file_id}", response_model=FileInfoResponse)
def get_file_info(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        segy_info = segy_parser.parse_file(db_file.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法读取文件: {str(e)}")
    
    return {
        "file": db_file,
        "inlines": segy_info.inlines,
        "crosslines": segy_info.crosslines
    }


@app.delete("/api/files/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if os.path.exists(db_file.file_path):
        os.remove(db_file.file_path)
    
    db.delete(db_file)
    db.commit()
    
    return {"message": "文件删除成功"}


@app.get("/api/files/{file_id}/histogram", response_model=HistogramResponse)
def get_histogram(
    file_id: int,
    bins: int = Query(100, ge=10, le=500),
    min_amp: Optional[float] = None,
    max_amp: Optional[float] = None,
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        return segy_parser.get_amplitude_histogram(
            db_file.file_path, bins=bins, min_amp=min_amp, max_amp=max_amp
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法计算直方图: {str(e)}")


@app.get("/api/files/{file_id}/slices/inline")
def get_inline_slice(
    file_id: int,
    index: int = Query(..., ge=0),
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        slice_data = segy_parser.get_inline_slice(db_file.file_path, index)
        return {
            "slice_type": "inline",
            "index": index,
            "shape": list(slice_data.shape),
            "data": slice_data.tolist()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法获取切片: {str(e)}")


@app.get("/api/files/{file_id}/slices/crossline")
def get_crossline_slice(
    file_id: int,
    index: int = Query(..., ge=0),
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        slice_data = segy_parser.get_crossline_slice(db_file.file_path, index)
        return {
            "slice_type": "crossline",
            "index": index,
            "shape": list(slice_data.shape),
            "data": slice_data.tolist()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法获取切片: {str(e)}")


@app.get("/api/files/{file_id}/slices/timeslice")
def get_timeslice(
    file_id: int,
    index: int = Query(..., ge=0),
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        slice_data = segy_parser.get_timeslice(db_file.file_path, index)
        return {
            "slice_type": "timeslice",
            "index": index,
            "shape": list(slice_data.shape),
            "data": slice_data.tolist()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法获取切片: {str(e)}")


@app.get("/api/files/{file_id}/volume")
def get_volume_data(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        return segy_parser.get_volume_data(db_file.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法获取体数据: {str(e)}")


@app.get("/api/files/{file_id}/traces/{trace_idx}")
def get_trace(file_id: int, trace_idx: int, db: Session = Depends(get_db)):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        return segy_parser.get_trace(db_file.file_path, trace_idx)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法获取道数据: {str(e)}")


@app.post("/api/annotations", response_model=AnnotationResponse)
def create_annotation(annotation: AnnotationCreate, db: Session = Depends(get_db)):
    db_file = db.query(SegyFile).filter(SegyFile.id == annotation.segy_file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    db_annotation = Annotation(**annotation.dict())
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)
    
    return db_annotation


@app.get("/api/annotations/{file_id}", response_model=List[AnnotationResponse])
def get_annotations(file_id: int, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.segy_file_id == file_id).all()


@app.delete("/api/annotations/{annotation_id}")
def delete_annotation(annotation_id: int, db: Session = Depends(get_db)):
    db_annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not db_annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    
    db.delete(db_annotation)
    db.commit()
    
    return {"message": "标注删除成功"}


@app.get("/api/files/compare/{file_ids}")
def compare_files(file_ids: str, db: Session = Depends(get_db)):
    id_list = [int(x) for x in file_ids.split(',')]
    files_info = []
    
    for fid in id_list:
        db_file = db.query(SegyFile).filter(SegyFile.id == fid).first()
        if db_file:
            files_info.append(db_file)
    
    return {
        "files": files_info,
        "count": len(files_info)
    }


@app.get("/api/files/{file_id}/analysis/fault-detection")
def detect_faults(
    file_id: int,
    slice_type: str = Query('inline', enum=['inline', 'crossline', 'timeslice']),
    index: int = Query(..., ge=0),
    low_threshold: float = Query(0.1, ge=0, le=1),
    high_threshold: float = Query(0.3, ge=0, le=1),
    sigma: float = Query(1.5, ge=0.1, le=5),
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        return segy_parser.detect_faults_canny(
            db_file.file_path,
            slice_type=slice_type,
            slice_index=index,
            low_threshold=low_threshold,
            high_threshold=high_threshold,
            sigma=sigma
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"断层检测失败: {str(e)}")


@app.post("/api/files/{file_id}/analysis/horizon-tracking")
def track_horizon(
    file_id: int,
    slice_type: str,
    slice_index: int,
    seed_points: List[List[int]],
    similarity_threshold: float = Query(0.15, ge=0, le=1),
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        seed_tuples = [(p[0], p[1]) for p in seed_points]
        return segy_parser.track_horizon(
            db_file.file_path,
            slice_type=slice_type,
            slice_index=slice_index,
            seed_points=seed_tuples,
            similarity_threshold=similarity_threshold
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"地层追踪失败: {str(e)}")


@app.post("/api/files/{file_id}/export/geotiff")
def export_geotiff(
    file_id: int,
    slice_type: str,
    slice_index: int,
    db: Session = Depends(get_db)
):
    db_file = db.query(SegyFile).filter(SegyFile.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        result = segy_parser.export_slice_to_geotiff(
            db_file.file_path,
            slice_type=slice_type,
            slice_index=slice_index
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出GeoTIFF失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
