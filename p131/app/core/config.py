from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Gene Sequence Alignment API"
    VERSION: str = "1.0.0"
    
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "gene_db"
    
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024
    
    BLAST_WORD_SIZE_DNA: int = 11
    BLAST_WORD_SIZE_PROTEIN: int = 3
    EVALUE_THRESHOLD: float = 10.0
    
    class Config:
        case_sensitive = True


settings = Settings()
