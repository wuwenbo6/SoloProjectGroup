from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import threading

from camera.driver import router as camera_router
from params.tuning import router as params_router
from params.backup import router as params_backup_router
from scanning.service import router as scanning_router, broadcast_worker
from scanning.multi_camera import router as multi_scan_router
from image.restoration import router as restoration_router
from restoration.history import router as history_router
from image.enhancement import router as enhancement_router
from archive.manager import router as archive_router
from archive.tags import router as tags_router

app = FastAPI(title="胶片数字化助手API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(camera_router, prefix="/api/camera", tags=["相机驱动"])
app.include_router(params_router, prefix="/api/params", tags=["参数调试"])
app.include_router(params_backup_router)
app.include_router(scanning_router, prefix="/api/scanning", tags=["扫描转录"])
app.include_router(multi_scan_router)
app.include_router(restoration_router, prefix="/api/restoration", tags=["图像修复"])
app.include_router(history_router)
app.include_router(enhancement_router, prefix="/api/enhancement", tags=["图像增强"])
app.include_router(archive_router, prefix="/api/archive", tags=["档案管理"])
app.include_router(tags_router)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_worker())


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "服务运行正常"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
