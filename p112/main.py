from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys

from app.core.config import settings
from app.core.database import engine, Base
from app.api.yarn import router as yarn_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.1.0",
    description="纱线图像检测系统API - 支持毛羽检测、断纱识别、粗细异常判定、批量分析"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(yarn_router, prefix=settings.API_V1_STR + "/yarn", tags=["纱线检测"])


@app.get("/")
async def root():
    return {
        "message": "欢迎使用纱线图像检测系统",
        "api_docs": "/docs",
        "api_version": "v1.1",
        "features": [
            "图像上传",
            "毛羽检测",
            "断纱识别",
            "粗细异常判定",
            "批量分析",
            "历史记录查询"
        ]
    }


@app.get("/health")
async def health_check():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.1.0"
        }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


@app.get("/api/config")
async def get_config():
    return {
        "hairiness_threshold": settings.HAIRINESS_THRESHOLD,
        "breakage_threshold": settings.BREAKAGE_THRESHOLD,
        "thickness_std_threshold": settings.THICKNESS_STD_THRESHOLD,
        "allowed_extensions": list(settings.ALLOWED_EXTENSIONS),
        "max_file_size": settings.MAX_FILE_SIZE
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
