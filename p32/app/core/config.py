from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "传统手工艺原料溯源系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    TRACEABILITY_DB_URL: str = "sqlite:///./database/traceability/traceability.db"
    QUALITY_DB_URL: str = "sqlite:///./database/quality/quality.db"
    BATCH_DB_URL: str = "sqlite:///./database/batch/batch.db"

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    THIRD_PARTY_API_URL: str = "https://api.testing-lab.com/v1"
    THIRD_PARTY_API_KEY: str = "your-api-key-here"

    class Config:
        env_file = ".env"


settings = Settings()
