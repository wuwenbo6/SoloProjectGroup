from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import user_engine, photo_engine, repair_engine, Base
from app.api import auth, photos

Base.metadata.create_all(bind=user_engine)
Base.metadata.create_all(bind=photo_engine)
Base.metadata.create_all(bind=repair_engine)

app = FastAPI(
    title="胶片照片修复 API",
    description="胶片照片修复服务后端API，支持照片上传、修复、分享和相册管理",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(photos.router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "胶片照片修复服务 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
