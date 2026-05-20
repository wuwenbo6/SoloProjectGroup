from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.db.database import engine, Base
from app.api import auth, stitches, works, comments, upload, stitch_steps, stitch_history, stitch_similarity

Base.metadata.create_all(bind=engine)

app = FastAPI(title="刺绣针法采集平台 API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(stitches.router, prefix="/api")
app.include_router(stitch_steps.router, prefix="/api")
app.include_router(stitch_history.router, prefix="/api")
app.include_router(stitch_similarity.router, prefix="/api")
app.include_router(works.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(upload.router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "欢迎使用刺绣针法采集平台 API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
