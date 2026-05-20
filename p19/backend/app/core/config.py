from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DATABASE_URL: str = "sqlite+aiosqlite:///./dialect_corpus.db"
    
    UPLOAD_DIR: str = "./uploads"
    CHUNK_SIZE: int = 1024 * 1024 * 5
    
    MAX_FILE_SIZE: int = 1024 * 1024 * 100
    ALLOWED_EXTENSIONS: set = {"wav", "mp3", "m4a", "flac", "ogg"}
    
    HOT_STORAGE_PATH: str = "./storage/hot"
    COLD_STORAGE_PATH: str = "./storage/cold"
    ARCHIVE_STORAGE_PATH: str = "./storage/archive"
    
    HOT_THRESHOLD_DAYS: int = 30
    COLD_THRESHOLD_DAYS: int = 90
    
    CLUSTER_BATCH_SIZE: int = 50
    CLUSTER_MAX_WORKERS: int = 4
    
    class Config:
        env_file = ".env"


settings = Settings()
