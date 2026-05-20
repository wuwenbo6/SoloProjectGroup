from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dialect_synthesis.db"
    AUDIO_STORAGE_PATH: str = "./audio_storage"
    MODEL_CACHE_PATH: str = "./model_cache"
    SAMPLE_RATE: int = 22050
    MAX_AUDIO_LENGTH: int = 300
    CORS_ORIGINS: list = ["*"]
    
    class Config:
        env_file = ".env"

settings = Settings()
