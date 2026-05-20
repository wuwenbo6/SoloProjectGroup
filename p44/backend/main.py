from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import shutil
from pathlib import Path
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sync_evaluator.sync_evaluator import SyncEvaluator
from reporter.report_generator import ReportGenerator
from audio_video_aligner.aligner import AudioVideoAligner
from utils.memory_manager import memory_manager

app = FastAPI(title="Audio-Video Sync Evaluator API", version="1.1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("../uploads")
RESULTS_DIR = Path("../results")
ALIGNED_DIR = RESULTS_DIR / "aligned"
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)
ALIGNED_DIR.mkdir(exist_ok=True)

sync_evaluator = SyncEvaluator()
report_generator = ReportGenerator(output_dir=str(RESULTS_DIR))
aligner = AudioVideoAligner(upload_dir=str(UPLOAD_DIR), output_dir=str(ALIGNED_DIR))


class AlignRequest(BaseModel):
    video_filename: str
    audio_filename: str
    offset_seconds: float
    original_video_path: Optional[str] = None
    original_audio_path: Optional[str] = None


@app.get("/")
async def root():
    return {"message": "Audio-Video Sync Evaluator API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/evaluate")
async def evaluate_sync(
    video: UploadFile = File(...),
    audio: UploadFile = File(...)
):
    try:
        video_path = UPLOAD_DIR / f"{uuid.uuid4()}_{video.filename}"
        audio_path = UPLOAD_DIR / f"{uuid.uuid4()}_{audio.filename}"

        with video_path.open("wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        with audio_path.open("wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        result = sync_evaluator.evaluate_sync(str(video_path), str(audio_path))

        result['video_filename'] = video.filename
        result['audio_filename'] = audio.filename

        return {"status": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/batch-evaluate")
async def batch_evaluate(
    videos: List[UploadFile] = File(...),
    audios: List[UploadFile] = File(...)
):
    if len(videos) != len(audios):
        raise HTTPException(status_code=400, detail="Number of videos and audios must match")

    try:
        video_paths = []
        audio_paths = []

        for video, audio in zip(videos, audios):
            video_path = UPLOAD_DIR / f"{uuid.uuid4()}_{video.filename}"
            audio_path = UPLOAD_DIR / f"{uuid.uuid4()}_{audio.filename}"

            with video_path.open("wb") as buffer:
                shutil.copyfileobj(video.file, buffer)

            with audio_path.open("wb") as buffer:
                shutil.copyfileobj(audio.file, buffer)

            video_paths.append(str(video_path))
            audio_paths.append(str(audio_path))

        results = sync_evaluator.batch_evaluate(video_paths, audio_paths)

        for i, result in enumerate(results):
            if result['status'] == 'success':
                result['video_filename'] = videos[i].filename
                result['audio_filename'] = audios[i].filename

        memory_manager.full_cleanup(force=True)

        return {"status": "success", "data": results}

    except Exception as e:
        memory_manager.full_cleanup(force=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-report")
async def generate_report(result_data: dict):
    try:
        report_path = report_generator.generate_single_report(result_data)
        report_filename = os.path.basename(report_path)
        return {
            "status": "success",
            "report_url": f"/api/download-report/{report_filename}",
            "report_filename": report_filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-batch-report")
async def generate_batch_report(results_data: List[dict]):
    try:
        report_path = report_generator.generate_batch_report(results_data)
        report_filename = os.path.basename(report_path)
        return {
            "status": "success",
            "report_url": f"/api/download-report/{report_filename}",
            "report_filename": report_filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download-report/{filename}")
async def download_report(filename: str):
    report_path = RESULTS_DIR / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(str(report_path), filename=filename)


@app.get("/api/results")
async def list_results():
    try:
        files = []
        for file_path in RESULTS_DIR.iterdir():
            if file_path.is_file():
                files.append({
                    "filename": file_path.name,
                    "size": file_path.stat().st_size,
                    "modified": file_path.stat().st_mtime
                })
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/align")
async def align_audio_video(request: AlignRequest, background_tasks: BackgroundTasks):
    try:
        result = aligner.align_media(
            video_filename=request.video_filename,
            audio_filename=request.audio_filename,
            offset_seconds=request.offset_seconds,
            original_video_path=request.original_video_path,
            original_audio_path=request.original_audio_path
        )

        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])

        background_tasks.add_task(aligner.cleanup_old_files)

        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download-aligned/{filename}")
async def download_aligned(filename: str):
    file_path = ALIGNED_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        str(file_path),
        filename=filename,
        media_type="video/mp4"
    )


@app.get("/api/aligned-files")
async def list_aligned_files():
    try:
        files = aligner.list_aligned_files()
        return {"status": "success", "files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/check-ffmpeg")
async def check_ffmpeg():
    available = aligner._check_ffmpeg_available()
    return {
        "status": "success",
        "ffmpeg_available": available,
        "message": "FFmpeg is available" if available else "FFmpeg is not available. Please install FFmpeg."
    }


@app.get("/api/gpu-memory")
async def get_gpu_memory():
    memory_info = memory_manager.get_gpu_memory_info()
    return {"status": "success", "data": memory_info}


@app.post("/api/cleanup-memory")
async def cleanup_memory(force: bool = True):
    memory_manager.full_cleanup(force=force)
    memory_info = memory_manager.get_gpu_memory_info()
    return {"status": "success", "message": "Memory cleanup completed", "memory_info": memory_info}


@app.middleware("http")
async def cleanup_after_request(request, call_next):
    response = await call_next(request)
    if request.url.path in ["/api/evaluate", "/api/align"]:
        memory_manager.full_cleanup(force=False)
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
