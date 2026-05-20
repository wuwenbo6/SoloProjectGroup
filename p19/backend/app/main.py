from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.database import engine, Base
from .api import users, audio, dialects, tasks, annotations, correction, dialect_tree, pronunciation, translation, quality_check, researcher_access, storage, clustering
from .core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Dialect Corpus Annotation Platform",
    description="A platform for collecting, annotating, and classifying regional dialect audio samples",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1")
app.include_router(audio.router, prefix="/api/v1")
app.include_router(dialects.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(annotations.router, prefix="/api/v1")
app.include_router(correction.router, prefix="/api/v1")
app.include_router(dialect_tree.router, prefix="/api/v1")
app.include_router(pronunciation.router, prefix="/api/v1")
app.include_router(translation.router, prefix="/api/v1")
app.include_router(quality_check.router, prefix="/api/v1")
app.include_router(researcher_access.router, prefix="/api/v1")
app.include_router(storage.router, prefix="/api/v1")
app.include_router(clustering.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "Dialect Corpus Annotation Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
