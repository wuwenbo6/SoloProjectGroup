from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import logging
import sys
from app.core.config import settings
from app.core.database import (
    BaseTraceability, BaseQuality, BaseBatch, BaseAuth,
    traceability_engine, quality_engine, batch_engine
)
from app.core.middleware import RateLimitMiddleware
from app.core.performance_monitor import PerformanceMonitorMiddleware, get_performance_metrics

from app.api import (
    material, traceability, quality, batch,
    third_party, auth, tracecode, export, geo, security, film_restore, performance
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log", encoding="utf-8")
    ]
)
logger = logging.getLogger(__name__)

BaseTraceability.metadata.create_all(bind=traceability_engine)
BaseQuality.metadata.create_all(bind=quality_engine)
BaseBatch.metadata.create_all(bind=batch_engine)
BaseAuth.metadata.create_all(bind=batch_engine)

app = FastAPI(
    title="传统手工艺原料溯源系统",
    description="基于 FastAPI 的分布式高并发接口服务，实现传统手工艺原料全链路溯源",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(PerformanceMonitorMiddleware, metrics=get_performance_metrics())
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(material.router, prefix="/api/v1")
app.include_router(traceability.router, prefix="/api/v1")
app.include_router(quality.router, prefix="/api/v1")
app.include_router(batch.router, prefix="/api/v1")
app.include_router(third_party.router, prefix="/api/v1")
app.include_router(tracecode.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(security.router, prefix="/api/v1")
app.include_router(film_restore.router, prefix="/api/v1")
app.include_router(performance.router)


@app.get("/")
async def root():
    return {
        "message": "传统手工艺原料溯源系统 API 服务",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "传统手工艺原料溯源系统"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
